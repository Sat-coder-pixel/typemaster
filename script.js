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
const resultAccuracy = document.getElementById('resultAccuracy');
const correctChars = document.getElementById('correctChars');
const wrongChars = document.getElementById('wrongChars');
const resultTime = document.getElementById('resultTime');
const comparisonList = document.getElementById('comparisonList');
const wrongWordsList = document.getElementById('wrongWordsList');

const state = {
  refText: '',
  started: false,
  finished: false,
  startTime: null,
  intervalId: null,
  elapsedSeconds: 0,
};

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function startTimer() {
  state.startTime = Date.now();
  state.intervalId = setInterval(() => {
    state.elapsedSeconds = Math.max(0, Math.floor((Date.now() - state.startTime) / 1000));
    timeValue.textContent = formatTime(state.elapsedSeconds);
    updateLiveStats();
  }, 250);
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

function getWordPairs(referenceText, typedText) {
  const referenceWords = referenceText.split(/\s+/).filter(Boolean);
  const typedWords = typedText.split(/\s+/).filter(Boolean);
  const maxWords = Math.max(referenceWords.length, typedWords.length);
  const rows = [];

  for (let i = 0; i < maxWords; i++) {
    const expected = referenceWords[i] ?? '';
    const actual = typedWords[i] ?? '';
    const isCorrect = expected === actual && expected !== '';
    rows.push({
      index: i + 1,
      expected,
      actual,
      isCorrect,
    });
  }

  return rows;
}

function getAdjustedWpm(realWpm) {
  return Math.max(0, realWpm - 3);
}

function calculateStats() {
  const referenceText = state.refText;
  const typedText = typingInput.value;
  const referenceChars = referenceText.split('');
  const typedChars = typedText.split('');
  const maxLength = Math.max(referenceChars.length, typedChars.length);

  let correctCharsCount = 0;
  let wrongCharsCount = 0;

  for (let i = 0; i < maxLength; i++) {
    const expected = referenceChars[i] ?? '';
    const actual = typedChars[i] ?? '';

    if (actual === expected) {
      correctCharsCount++;
    } else if (actual !== '') {
      wrongCharsCount++;
    }
  }

  const typedLength = typedText.length;
  const accuracy = typedLength > 0 ? ((correctCharsCount / typedLength) * 100) : 0;
  const elapsedMinutes = state.elapsedSeconds > 0 ? state.elapsedSeconds / 60 : 1 / 60;
  const grossWpm = typedLength > 0 ? (typedLength / 5) / elapsedMinutes : 0;
  const netWpm = correctCharsCount > 0 ? (correctCharsCount / 5) / elapsedMinutes : 0;
  const adjustedWpm = getAdjustedWpm(netWpm);

  const wrongWordRows = getWordPairs(referenceText, typedText).filter((row) => !row.isCorrect);

  return {
    correctCharsCount,
    wrongCharsCount,
    accuracy,
    grossWpm,
    netWpm,
    adjustedWpm,
    wrongWordRows,
    typedLength,
  };
}

function updateLiveStats() {
  const { accuracy, wrongCharsCount, adjustedWpm, typedLength } = calculateStats();
  wpmValue.textContent = adjustedWpm.toFixed(1);
  accuracyValue.textContent = `${Math.min(100, accuracy).toFixed(1)}%`;
  mistakesValue.textContent = String(wrongCharsCount);

  if (typedLength === 0 && state.elapsedSeconds === 0) {
    wpmValue.textContent = '0.0';
    accuracyValue.textContent = '0%';
    mistakesValue.textContent = '0';
  }
}

function renderComparison() {
  const rows = getWordPairs(state.refText, typingInput.value);

  if (rows.length === 0) {
    comparisonList.innerHTML = '<div class="empty-state">No comparison available yet.</div>';
    return;
  }

  comparisonList.innerHTML = rows
    .map((row) => {
      const expectedText = row.expected || '∅';
      const actualText = row.actual || '∅';
      const expectedClass = row.isCorrect ? 'correct' : 'wrong';
      const actualClass = row.isCorrect ? 'correct' : 'wrong';

      return `
        <div class="word-row">
          <strong>#${row.index}</strong>
          <div class="word-box ${expectedClass}">${escapeHtml(expectedText)}</div>
          <div class="word-box ${actualClass}">${escapeHtml(actualText)}</div>
        </div>
      `;
    })
    .join('');
}

function renderWrongWords() {
  const rows = getWordPairs(state.refText, typingInput.value).filter((row) => !row.isCorrect && (row.expected || row.actual));

  if (rows.length === 0) {
    wrongWordsList.innerHTML = '<div class="empty-state">No wrong words found. Great job.</div>';
    return;
  }

  wrongWordsList.innerHTML = rows
    .map((row) => `
      <div class="word-row">
        <strong>#${row.index}</strong>
        <div class="word-box muted">Expected: ${escapeHtml(row.expected || 'blank')}</div>
        <div class="word-box wrong">Typed: ${escapeHtml(row.actual || 'blank')}</div>
      </div>
    `)
    .join('');
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
  typingInput.value = '';
  typingInput.focus();

  setupPanel.classList.add('hidden');
  testPanel.classList.remove('hidden');
  resultPanel.classList.add('hidden');

  timeValue.textContent = '00:00';
  wpmValue.textContent = '0.0';
  accuracyValue.textContent = '0%';
  mistakesValue.textContent = '0';

  startTimer();
}

function finishTest() {
  if (!state.started || state.finished) {
    return;
  }

  state.finished = true;
  stopTimer();

  const { correctCharsCount, wrongCharsCount, accuracy, adjustedWpm } = calculateStats();

  resultWpm.textContent = adjustedWpm.toFixed(1);
  resultAccuracy.textContent = `${Math.min(100, accuracy).toFixed(1)}%`;
  correctChars.textContent = String(correctCharsCount);
  wrongChars.textContent = String(wrongCharsCount);
  resultTime.textContent = formatTime(state.elapsedSeconds);

  renderComparison();
  renderWrongWords();

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
  typingInput.value = '';
  referenceInput.value = '';
  timeValue.textContent = '00:00';
  wpmValue.textContent = '0.0';
  accuracyValue.textContent = '0%';
  mistakesValue.textContent = '0';

  resultPanel.classList.add('hidden');
  testPanel.classList.add('hidden');
  setupPanel.classList.remove('hidden');
  referenceInput.focus();
  comparisonList.innerHTML = '';
  wrongWordsList.innerHTML = '';
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
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    finishTest();
  }
});

resetPractice();
