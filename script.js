const OBSTACLE_PENALTY = 2;
const difficulties = {
  easy: { goal: 12, seconds: 45, canInterval: 1100, canLifetime: 3500, obstacleInterval: 3200 },
  normal: { goal: 20, seconds: 30, canInterval: 900, canLifetime: 2700, obstacleInterval: 2100 },
  hard: { goal: 24, seconds: 25, canInterval: 650, canLifetime: 1900, obstacleInterval: 1300 }
};
const winningMessages = [
  () => `Mission complete! Your clean-water team reached the ${difficulties[selectedDifficulty].goal}-can goal.`,
  'You made every second count. The clean-water mission is complete!',
  'Water hero! You reached your can goal.'
];
const losingMessages = [
  () => `So close! Gather ${difficulties[selectedDifficulty].goal} cans next time to complete the mission.`,
  'The community still needs you. Try again and complete the clean-water mission.',
  'One more run could make the difference. You have got this!'
];
const milestones = [
  { fraction: 0.25, message: 'A quarter of the way! Keep collecting.' },
  { fraction: 0.5, message: 'Halfway there! Keep going.' },
  { fraction: 0.75, message: 'Three-quarters there. The goal is in sight!' }
];

let currentCans = 0;
let timeLeft = difficulties.normal.seconds;
let gameActive = false;
let selectedDifficulty = 'normal';
let reachedMilestones = new Set();
let audioContext;
let spawnInterval;
let timerInterval;
let obstacleInterval;
let canTimeout;
let confettiTimeout;

const grid = document.querySelector('.game-grid');
const canCount = document.getElementById('current-cans');
const goalCount = document.getElementById('goal-count');
const timer = document.getElementById('timer');
const progress = document.getElementById('goal-progress');
const instructions = document.getElementById('game-instructions');
const difficultyOptions = document.getElementById('difficulty-options');
const startButton = document.getElementById('start-game');
const resetButton = document.getElementById('reset-game');
const soundEffects = document.getElementById('sound-effects');
const achievement = document.getElementById('achievements');
const confetti = document.getElementById('confetti');

const soundCues = {
  click: [{ start: 520, end: 440, duration: 0.055, volume: 0.035, type: 'sine' }],
  collect: [
    { start: 740, end: 820, duration: 0.075, volume: 0.07, type: 'sine' },
    { start: 990, end: 1100, duration: 0.09, delay: 0.065, volume: 0.055, type: 'sine' }
  ],
  miss: [{ start: 240, end: 120, duration: 0.18, volume: 0.075, type: 'triangle' }],
  milestone: [
    { start: 660, end: 720, duration: 0.09, volume: 0.055, type: 'sine' },
    { start: 880, end: 940, duration: 0.12, delay: 0.085, volume: 0.055, type: 'sine' }
  ],
  win: [
    { start: 523, end: 587, duration: 0.14, volume: 0.06, type: 'sine' },
    { start: 659, end: 698, duration: 0.14, delay: 0.12, volume: 0.06, type: 'sine' },
    { start: 784, end: 831, duration: 0.14, delay: 0.24, volume: 0.06, type: 'sine' },
    { start: 1047, end: 1047, duration: 0.3, delay: 0.36, volume: 0.065, type: 'sine' }
  ]
};

function playCue(name) {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!soundEffects.checked || !AudioContextConstructor) return;

  audioContext ??= new AudioContextConstructor();
  if (audioContext.state === 'suspended') audioContext.resume();

  const now = audioContext.currentTime;
  soundCues[name].forEach((note) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const startTime = now + (note.delay || 0);
    const endTime = startTime + note.duration;

    oscillator.type = note.type;
    oscillator.frequency.setValueAtTime(note.start, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(note.end, endTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(note.volume, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(endTime);
  });
}

function createGrid() {
  grid.innerHTML = '';
  for (let index = 0; index < 9; index += 1) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    grid.appendChild(cell);
  }
}

function clearGridItems() {
  grid.querySelectorAll('.grid-cell').forEach((cell) => {
    cell.innerHTML = '';
  });
}

function spawnWaterCan() {
  if (!gameActive) return;
  if (grid.querySelector('.water-can-wrapper')) return;

  const cells = [...grid.querySelectorAll('.grid-cell')];
  const emptyCells = cells.filter((cell) => !cell.firstElementChild);
  if (emptyCells.length === 0) return;

  const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  randomCell.innerHTML = `
    <button class="water-can-wrapper" type="button" aria-label="Collect water can">
      <span class="water-can" aria-hidden="true"></span>
    </button>
  `;
  const can = randomCell.querySelector('.water-can-wrapper');
  canTimeout = setTimeout(() => {
    if (!gameActive || !can.isConnected) return;
    can.closest('.grid-cell').innerHTML = '';
    playCue('miss');
  }, difficulties[selectedDifficulty].canLifetime);
}

function spawnObstacle() {
  if (!gameActive) return;
  const obstacleLimit = selectedDifficulty === 'hard' ? 3 : 2;
  if (grid.querySelectorAll('.obstacle').length >= obstacleLimit) return;

  const cells = grid.querySelectorAll('.grid-cell');
  const emptyCells = [...cells].filter((cell) => !cell.firstElementChild);
  if (emptyCells.length === 0) return;

  const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  randomCell.innerHTML = `
    <button class="obstacle" type="button" aria-label="Avoid contaminant; costs 2 points">
      <span aria-hidden="true">-2</span>
    </button>
  `;
}

function updateScore(amount = 1) {
  const difficulty = difficulties[selectedDifficulty];
  const previousCans = currentCans;
  currentCans = Math.max(0, currentCans + amount);
  canCount.textContent = currentCans;
  progress.value = currentCans;
  canCount.classList.remove('score-pop');
  void canCount.offsetWidth;
  canCount.classList.add(amount > 0 ? 'score-pop' : 'score-loss');

  if (amount > 0) {
    milestones.forEach((milestone, index) => {
      const threshold = Math.ceil(difficulty.goal * milestone.fraction);
      if (previousCans < threshold && currentCans >= threshold && !reachedMilestones.has(index)) {
        reachedMilestones.add(index);
        achievement.textContent = milestone.message;
        achievement.className = 'achievement milestone';
        playCue('milestone');
      }
    });
  }

  if (currentCans >= difficulty.goal) {
    endGame(true);
  }
}

function chooseMessage(messages) {
  const message = messages[Math.floor(Math.random() * messages.length)];
  return typeof message === 'function' ? message() : message;
}

function celebrate() {
  const colors = ['#ffc907', '#2e9df7', '#4fcb53', '#f16061', '#ff902a'];
  confetti.innerHTML = '';

  for (let index = 0; index < 60; index += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.setProperty('--x', `${Math.random() * 100}vw`);
    piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 180}px`);
    piece.style.setProperty('--rotation', `${Math.random() * 720 - 360}deg`);
    piece.style.setProperty('--delay', `${Math.random() * 0.7}s`);
    piece.style.setProperty('--duration', `${2.2 + Math.random() * 1.8}s`);
    piece.style.background = colors[index % colors.length];
    confetti.appendChild(piece);
  }

  clearTimeout(confettiTimeout);
  confettiTimeout = setTimeout(() => {
    confetti.innerHTML = '';
  }, 5000);
}

function endGame(goalReached = false) {
  if (!gameActive) return;

  gameActive = false;
  clearInterval(spawnInterval);
  clearInterval(timerInterval);
  clearInterval(obstacleInterval);
  clearTimeout(canTimeout);
  clearGridItems();
  difficultyOptions.disabled = false;
  timeLeft = goalReached ? timeLeft : 0;
  timer.textContent = timeLeft;
  startButton.textContent = 'Play Again';
  startButton.disabled = false;
  achievement.textContent = chooseMessage(goalReached ? winningMessages : losingMessages);
  achievement.className = `achievement ${goalReached ? 'won' : 'lost'}`;
  if (goalReached) {
    playCue('win');
    celebrate();
  } else {
    playCue('miss');
  }
}

function resetGame() {
  gameActive = false;
  clearInterval(spawnInterval);
  clearInterval(timerInterval);
  clearInterval(obstacleInterval);
  clearTimeout(canTimeout);
  clearTimeout(confettiTimeout);
  currentCans = 0;
  reachedMilestones = new Set();
  timeLeft = difficulties[selectedDifficulty].seconds;
  canCount.textContent = '0';
  timer.textContent = timeLeft;
  progress.value = 0;
  progress.max = difficulties[selectedDifficulty].goal;
  canCount.classList.remove('score-pop', 'score-loss');
  confetti.innerHTML = '';
  achievement.textContent = '';
  achievement.className = 'achievement';
  startButton.textContent = 'Start Game';
  startButton.disabled = false;
  createGrid();
}

function startGame() {
  if (gameActive) return;

  const difficulty = difficulties[selectedDifficulty];
  currentCans = 0;
  reachedMilestones = new Set();
  timeLeft = difficulty.seconds;
  gameActive = true;
  canCount.textContent = currentCans;
  timer.textContent = timeLeft;
  progress.value = 0;
  difficultyOptions.disabled = true;
  achievement.textContent = '';
  achievement.className = 'achievement';
  startButton.textContent = 'Game in Progress';
  startButton.disabled = true;

  createGrid();
  spawnWaterCan();
  spawnInterval = setInterval(spawnWaterCan, difficulty.canInterval);
  obstacleInterval = setInterval(spawnObstacle, difficulty.obstacleInterval);
  timerInterval = setInterval(() => {
    timeLeft -= 1;
    timer.textContent = timeLeft;
    if (timeLeft <= 0) endGame(false);
  }, 1000);
}

function updateDifficulty() {
  const selected = difficultyOptions.querySelector('input:checked');
  if (!selected || gameActive) return;

  selectedDifficulty = selected.value;
  const difficulty = difficulties[selectedDifficulty];
  currentCans = 0;
  reachedMilestones = new Set();
  timeLeft = difficulty.seconds;
  canCount.textContent = '0';
  goalCount.textContent = difficulty.goal;
  timer.textContent = timeLeft;
  progress.value = 0;
  progress.max = difficulty.goal;
  achievement.textContent = '';
  achievement.className = 'achievement';
  instructions.textContent = `Collect ${difficulty.goal} cans in ${difficulty.seconds} seconds. Avoid red contaminants that cost ${OBSTACLE_PENALTY} points!`;
}

grid.addEventListener('click', (event) => {
  if (!gameActive) return;

  const can = event.target.closest('.water-can-wrapper');
  const obstacle = event.target.closest('.obstacle');
  if (can) {
    playCue('collect');
    clearTimeout(canTimeout);
    can.closest('.grid-cell').innerHTML = '';
    updateScore();
  } else if (obstacle) {
    playCue('miss');
    obstacle.closest('.grid-cell').innerHTML = '';
    updateScore(-OBSTACLE_PENALTY);
  } else {
    playCue('miss');
  }
});

difficultyOptions.addEventListener('click', () => playCue('click'));
difficultyOptions.addEventListener('change', updateDifficulty);
startButton.addEventListener('click', () => {
  playCue('click');
  startGame();
});
resetButton.addEventListener('click', () => {
  playCue('click');
  resetGame();
});
createGrid();
updateDifficulty();
