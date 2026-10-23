const GOAL_CANS = 20;
const GAME_SECONDS = 30;
const OBSTACLE_PENALTY = 2;
const winningMessages = [
  'Mission complete! Your clean-water team brought 20 cans to the community.',
  'You made every second count. The clean-water mission is complete!',
  'Water hero! You reached the 20-can goal.'
];
const losingMessages = [
  'So close! Gather 20 cans next time to complete the mission.',
  'The community still needs you. Try again and beat the 20-can goal.',
  'One more run could make the difference. You have got this!'
];

let currentCans = 0;
let timeLeft = GAME_SECONDS;
let gameActive = false;
let spawnInterval;
let timerInterval;
let obstacleInterval;
let confettiTimeout;

const grid = document.querySelector('.game-grid');
const canCount = document.getElementById('current-cans');
const timer = document.getElementById('timer');
const startButton = document.getElementById('start-game');
const resetButton = document.getElementById('reset-game');
const achievement = document.getElementById('achievements');
const confetti = document.getElementById('confetti');

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

  clearGridItems();
  const cells = grid.querySelectorAll('.grid-cell');
  const randomCell = cells[Math.floor(Math.random() * cells.length)];
  randomCell.innerHTML = `
    <button class="water-can-wrapper" type="button" aria-label="Collect water can">
      <span class="water-can" aria-hidden="true"></span>
    </button>
  `;
}

function spawnObstacle() {
  if (!gameActive) return;

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
  currentCans = Math.max(0, currentCans + amount);
  canCount.textContent = currentCans;
  canCount.classList.remove('score-pop');
  void canCount.offsetWidth;
  canCount.classList.add(amount > 0 ? 'score-pop' : 'score-loss');

  if (currentCans >= GOAL_CANS) {
    endGame(true);
  }
}

function chooseMessage(messages) {
  return messages[Math.floor(Math.random() * messages.length)];
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
  clearGridItems();
  timeLeft = goalReached ? timeLeft : 0;
  timer.textContent = timeLeft;
  startButton.textContent = 'Play Again';
  startButton.disabled = false;
  achievement.textContent = chooseMessage(goalReached ? winningMessages : losingMessages);
  achievement.className = `achievement ${goalReached ? 'won' : 'lost'}`;
  if (goalReached) celebrate();
}

function resetGame() {
  gameActive = false;
  clearInterval(spawnInterval);
  clearInterval(timerInterval);
  clearInterval(obstacleInterval);
  clearTimeout(confettiTimeout);
  currentCans = 0;
  timeLeft = GAME_SECONDS;
  canCount.textContent = '0';
  timer.textContent = GAME_SECONDS;
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

  currentCans = 0;
  timeLeft = GAME_SECONDS;
  gameActive = true;
  canCount.textContent = currentCans;
  timer.textContent = timeLeft;
  achievement.textContent = '';
  achievement.className = 'achievement';
  startButton.textContent = 'Game in Progress';
  startButton.disabled = true;

  createGrid();
  spawnWaterCan();
  spawnInterval = setInterval(spawnWaterCan, 900);
  obstacleInterval = setInterval(spawnObstacle, 2100);
  timerInterval = setInterval(() => {
    timeLeft -= 1;
    timer.textContent = timeLeft;
    if (timeLeft <= 0) endGame(false);
  }, 1000);
}

grid.addEventListener('click', (event) => {
  if (!gameActive) return;

  const can = event.target.closest('.water-can-wrapper');
  const obstacle = event.target.closest('.obstacle');
  if (can) {
    can.closest('.grid-cell').innerHTML = '';
    updateScore();
  } else if (obstacle) {
    obstacle.closest('.grid-cell').innerHTML = '';
    updateScore(-OBSTACLE_PENALTY);
  }

  if (gameActive) spawnWaterCan();
});

startButton.addEventListener('click', startGame);
resetButton.addEventListener('click', resetGame);
createGrid();
