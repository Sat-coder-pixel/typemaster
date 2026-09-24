const referenceInput = document.getElementById('referenceInput');
const typingInput = document.getElementById('typingInput');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const finishBtn = document.getElementById('finishBtn');
const newTestBtn = document.getElementById('newTestBtn');

const setupPanel = document.getElementById('setupPanel');
const testPanel = document.getElementById('testPanel');
const resultPanel = document.getElementById('resultPanel');

const timeValue = document.getElementById('timeValue');
const wpmValue = document.getElementById('wpmValue');
const accuracyValue = document.getElementById('accuracyValue');
const mistakesValue = document.getElementById('mistakesValue');

const resultWpm = document.getElementById('resultWpm');
const resultKeystrokeWpm = document.getElementById('resultKeystrokeWpm');
const resultKeystrokes = document.getElementById('resultKeystrokes');
const resultAccuracy = document.getElementById('resultAccuracy');
const correctChars = document.getElementById('correctChars');
const wrongChars = document.getElementById('wrongChars');
const resultTime = document.getElementById('resultTime');
const comparisonList = document.getElementById('comparisonList');

const state = {
  refText: '',
  started: false,
  finished: false,
  startTime: null,
  intervalId: null,
  elapsedSeconds: 0,
  backspaceCount: 0,
};

const TEST_DURATION_SECONDS = 10 * 60;

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function startTimer() {
  state.startTime = Date.now();
  state.intervalId = setInterval(() => {
    const preciseElapsed = (Date.now() - state.startTime) / 1000;
    state.elapsedSeconds = Math.max(0, preciseElapsed);
    const remainingSeconds = Math.max(0, TEST_DURATION_SECONDS - Math.floor(state.elapsedSeconds));
    timeValue.textContent = formatTime(remainingSeconds);

    if (remainingSeconds === 0) {
      finishTest();
    }
  }, 100);
}

function stopTimer() {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
}

function normalizeParagraph(text) {
  return text.replace(/\r\n/g, '\n');
}

function getWords(text) {
  return [...text.matchAll(/\S+/g)].map((match) => match[0]);
}

function getSeparator(text, wordIndex) {
  return text.split(/\S+/)[wordIndex] ?? '';
}

function normalizeSeparator(separator) {
  return /[\r\n]/.test(separator) ? ' ' : separator;
}

function alignWords(referenceText, typedText) {
  const referenceWords = getWords(referenceText);
  const typedWords = getWords(typedText);
  const rows = Array.from({ length: referenceWords.length + 1 }, () => (
    Array(typedWords.length + 1).fill(null)
  ));

  rows[referenceWords.length][typedWords.length] = { cost: 0, action: null };

  for (let referenceIndex = referenceWords.length; referenceIndex >= 0; referenceIndex--) {
    for (let typedIndex = typedWords.length; typedIndex >= 0; typedIndex--) {
      if (referenceIndex === referenceWords.length && typedIndex === typedWords.length) {
        continue;
      }

      const choices = [];
      const addChoice = (cost, action, priority) => {
        choices.push({ cost, action, priority });
      };

      if (referenceIndex < referenceWords.length && typedIndex < typedWords.length) {
        const isMatch = referenceWords[referenceIndex] === typedWords[typedIndex];
        addChoice(rows[referenceIndex + 1][typedIndex + 1].cost + (isMatch ? 0 : 1), isMatch ? 'match' : 'replace', isMatch ? 0 : 3);

        if (
          referenceIndex + 1 < referenceWords.length &&
          typedWords[typedIndex] === referenceWords[referenceIndex] + referenceWords[referenceIndex + 1]
        ) {
          addChoice(rows[referenceIndex + 2][typedIndex + 1].cost + 1, 'merge', 1);
        }
      }

      if (referenceIndex < referenceWords.length) {
        addChoice(rows[referenceIndex + 1][typedIndex].cost + 1, 'omit', 4);
      }

      if (typedIndex < typedWords.length) {
        addChoice(rows[referenceIndex][typedIndex + 1].cost + 1, 'add', 5);
      }

      choices.sort((left, right) => left.cost - right.cost || left.priority - right.priority);
      rows[referenceIndex][typedIndex] = choices[0];
    }
  }

  const operations = [];
  let referenceIndex = 0;
  let typedIndex = 0;

  while (referenceIndex < referenceWords.length || typedIndex < typedWords.length) {
    const operation = rows[referenceIndex][typedIndex].action;
    const operationData = { type: operation, referenceIndex, typedIndex };

    if (operation === 'merge') {
      operationData.expected = `${referenceWords[referenceIndex]} ${referenceWords[referenceIndex + 1]}`;
      operationData.actual = typedWords[typedIndex];
      referenceIndex += 2;
      typedIndex++;
    } else if (operation === 'match' || operation === 'replace') {
      operationData.expected = referenceWords[referenceIndex];
      operationData.actual = typedWords[typedIndex];
      referenceIndex++;
      typedIndex++;
    } else if (operation === 'omit') {
      operationData.expected = referenceWords[referenceIndex];
      operationData.actual = '';
      referenceIndex++;
    } else {
      operationData.expected = '';
      operationData.actual = typedWords[typedIndex];
      typedIndex++;
    }

    operations.push(operationData);
  }

  return { operations, referenceWords, typedWords };
}

function getAdjustedWpm(realWpm) {
  return Math.max(0, realWpm - 3);
}

function getComparison(referenceText, typedText) {
  const alignment = alignWords(referenceText, typedText);
  const operations = alignment.operations.slice();

  while (operations.at(-1)?.type === 'omit') {
    operations.pop();
  }

  let mistakes = 0;
  let correctCharsCount = 0;
  let wrongCharsCount = 0;
  let separatorMistakes = 0;

  operations.forEach((operation) => {
    if (operation.type === 'match') {
      correctCharsCount += operation.actual.length;
    } else {
      mistakes++;
      wrongCharsCount += operation.actual.length;
    }
  });

  for (let index = 1; index < operations.length; index++) {
    const previous = operations[index - 1];
    const current = operations[index];

    if (previous.type === 'match' && current.type === 'match') {
      const typedSeparator = getSeparator(typedText, current.typedIndex);
      const expectedSeparator = getSeparator(referenceText, current.referenceIndex);

      if (normalizeSeparator(typedSeparator) === normalizeSeparator(expectedSeparator)) {
        correctCharsCount += typedSeparator.length;
      } else {
        mistakes++;
        wrongCharsCount += typedSeparator.length;
        separatorMistakes++;
      }
    }
  }

  return { ...alignment, operations, mistakes, correctCharsCount, wrongCharsCount, separatorMistakes };
}

function calculateStats() {
  const referenceText = state.refText;
  const typedText = typingInput.value;
  const comparison = getComparison(referenceText, typedText);
  const { correctCharsCount, mistakes } = comparison;

  const typedLength = typedText.length;
  const totalKeystrokes = typedLength;
  
  // Character-level accuracy: valid characters divided by total typed characters
  const accuracy = totalKeystrokes > 0 ? ((correctCharsCount / totalKeystrokes) * 100) : 0;
  
  const elapsedMinutes = state.elapsedSeconds > 0 ? state.elapsedSeconds / 60 : 1 / 60;
  const grossWpm = typedLength > 0 ? (typedLength / 5) / elapsedMinutes : 0;
  
  // Strict Net WPM based on valid matched characters
  const netWpm = correctCharsCount > 0 ? (correctCharsCount / 5) / elapsedMinutes : 0;
  const adjustedWpm = getAdjustedWpm(netWpm);
  
  // Keystroke WPM strictly uses valid keystrokes to avoid inflating speed stats
  const countedKeystrokes = correctCharsCount;
  const keystrokeWpm = countedKeystrokes > 0 ? (countedKeystrokes / 5) / elapsedMinutes : 0;

  return {
    correctCharsCount,
    wrongCharsCount: comparison.wrongCharsCount,
    accuracy,
    grossWpm,
    netWpm,
    adjustedWpm,
    keystrokeWpm,
    countedKeystrokes,
    mistakes,
    typedLength,
  };
}

function updateLiveStats() {
  const { accuracy, mistakes, adjustedWpm, typedLength } = calculateStats();
  wpmValue.textContent = adjustedWpm.toFixed(1);
  accuracyValue.textContent = `${Math.min(100, accuracy).toFixed(1)}%`;
  mistakesValue.textContent = String(mistakes);

  if (typedLength === 0 && state.elapsedSeconds === 0) {
    wpmValue.textContent = '0.0';
    accuracyValue.textContent = '0%';
    mistakesValue.textContent = '0';
  }
}

function renderComparison() {
  const comparison = getComparison(state.refText, typingInput.value);

  if (comparison.operations.length === 0) {
    comparisonList.innerHTML = '<div class="empty-state">No comparison available yet.</div>';
    return;
  }

  let paragraph = '';
  comparison.operations.forEach((operation, index) => {
    if (index > 0 && operation.actual) {
      const typedSeparator = getSeparator(typingInput.value, operation.typedIndex) || ' ';
      const expectedSeparator = getSeparator(state.refText, operation.referenceIndex) || ' ';
      const previous = comparison.operations[index - 1];
      paragraph += previous.type === 'match' && operation.type === 'match' && normalizeSeparator(typedSeparator) !== normalizeSeparator(expectedSeparator)
        ? `<span class="comparison-wrong">${escapeHtml(typedSeparator)}</span><span class="comparison-expected"> (${escapeHtml(expectedSeparator)})</span>`
        : escapeHtml(typedSeparator);
    }

    if (operation.type === 'match') {
      paragraph += `<span class="comparison-correct">${escapeHtml(operation.actual)}</span>`;
    } else if (operation.actual) {
      paragraph += `<span class="comparison-wrong">${escapeHtml(operation.actual)}</span> <span class="comparison-expected">(${escapeHtml(operation.expected || '[nothing]')})</span>`;
    } else {
      paragraph += `<span class="comparison-wrong">[missing]</span> <span class="comparison-expected">(${escapeHtml(operation.expected)})</span>`;
    }
  });

  comparisonList.innerHTML = `<p class="comparison-paragraph">${paragraph}</p>`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function startTest() {
  const paragraph = normalizeParagraph(referenceInput.value).trim();

  if (!paragraph) {
    alert('Please paste a paragraph before starting the test.');
    referenceInput.focus();
    return;
  }

  state.refText = paragraph;
  state.started = true;
  state.finished = false;
  state.elapsedSeconds = 0;
  state.backspaceCount = 0;
  typingInput.value = '';
  typingInput.focus();

  setupPanel.classList.add('hidden');
  testPanel.classList.remove('hidden');
  resultPanel.classList.add('hidden');

  timeValue.textContent = formatTime(TEST_DURATION_SECONDS);

  startTimer();
}

function finishTest() {
  if (!state.started || state.finished) {
    return;
  }

  state.finished = true;
  stopTimer();

  const { correctCharsCount, wrongCharsCount, accuracy, adjustedWpm, keystrokeWpm, countedKeystrokes } = calculateStats();

  resultWpm.textContent = adjustedWpm.toFixed(1);
  resultKeystrokeWpm.textContent = keystrokeWpm.toFixed(1);
  resultKeystrokes.textContent = String(countedKeystrokes);
  resultAccuracy.textContent = `${Math.min(100, accuracy).toFixed(1)}%`;
  correctChars.textContent = String(correctCharsCount);
  wrongChars.textContent = String(wrongCharsCount);
  document.getElementById('backspaceCount').textContent = String(state.backspaceCount);
  resultTime.textContent = formatTime(Math.floor(state.elapsedSeconds));

  renderComparison();

  testPanel.classList.add('hidden');
  resultPanel.classList.remove('hidden');
}

function resetPractice() {
  stopTimer();
  state.started = false;
  state.finished = false;
  state.elapsedSeconds = 0;
  state.startTime = null;
  state.refText = '';
  state.backspaceCount = 0;
  typingInput.value = '';
  referenceInput.value = '';
  timeValue.textContent = formatTime(TEST_DURATION_SECONDS);
  wpmValue.textContent = '0.0';
  accuracyValue.textContent = '0%';
  mistakesValue.textContent = '0';

  resultPanel.classList.add('hidden');
  testPanel.classList.add('hidden');
  setupPanel.classList.remove('hidden');
  referenceInput.focus();
  comparisonList.innerHTML = '';
}

startBtn.addEventListener('click', startTest);
resetBtn.addEventListener('click', resetPractice);
finishBtn.addEventListener('click', finishTest);
newTestBtn.addEventListener('click', resetPractice);

typingInput.addEventListener('input', () => {
  if (!state.started || state.finished) {
    return;
  }

  if (state.startTime === null) {
    startTimer();
  }

  updateLiveStats();
});

typingInput.addEventListener('keydown', (event) => {
  if (event.key === 'Backspace') {
    state.backspaceCount++;
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    finishTest();
  }
});

resetPractice();
