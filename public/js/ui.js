const API_BASE = '/api';

const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);

const startScreen = document.getElementById('start-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const leaderboardScreen = document.getElementById('leaderboard-screen');
const scoreEl = document.getElementById('score');
const comboDisplay = document.getElementById('combo-display');
const comboCountEl = document.getElementById('combo-count');
const timerEl = document.getElementById('timer');
const timerDisplay = document.getElementById('timer-display');
const finalScoreEl = document.getElementById('final-score');
const finalComboEl = document.getElementById('final-combo');
const playerNameInput = document.getElementById('player-name');
const submitStatus = document.getElementById('submit-status');

let playerName = '';

game.onScoreUpdate = (score, combo) => {
  scoreEl.textContent = score;
  if (combo >= 2) {
    comboDisplay.classList.remove('hidden');
    comboCountEl.textContent = combo;
  } else {
    comboDisplay.classList.add('hidden');
  }
};

game.onTimerUpdate = (timeLeft) => {
  timerEl.textContent = Math.ceil(timeLeft);
  if (timeLeft <= 10) {
    timerDisplay.classList.add('warning');
  } else {
    timerDisplay.classList.remove('warning');
  }
};

game.onGameOver = async (score, maxCombo) => {
  gameoverScreen.classList.remove('hidden');
  finalScoreEl.textContent = score;
  finalComboEl.textContent = maxCombo;

  if (score > 0 && playerName) {
    submitStatus.textContent = '提交分数中...';
    try {
      const res = await fetch(`${API_BASE}/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName, score, combo: maxCombo }),
      });
      if (res.ok) {
        submitStatus.textContent = '✓ 分数已提交';
      } else {
        submitStatus.textContent = '提交失败，请检查网络';
      }
    } catch {
      submitStatus.textContent = '网络错误，分数未提交';
    }
  } else if (!playerName) {
    submitStatus.textContent = '未输入名字，分数未提交';
  } else {
    submitStatus.textContent = '';
  }
};

document.getElementById('start-btn').addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  if (!name) {
    playerNameInput.classList.add('error');
    playerNameInput.focus();
    setTimeout(() => playerNameInput.classList.remove('error'), 500);
    return;
  }
  playerName = name;
  startScreen.classList.add('hidden');
  scoreEl.textContent = '0';
  timerEl.textContent = '60';
  timerDisplay.classList.remove('warning');
  comboDisplay.classList.add('hidden');
  game.start();
});

document.getElementById('restart-btn').addEventListener('click', () => {
  gameoverScreen.classList.add('hidden');
  scoreEl.textContent = '0';
  timerEl.textContent = '60';
  timerDisplay.classList.remove('warning');
  comboDisplay.classList.add('hidden');
  game.start();
});

async function showLeaderboard() {
  startScreen.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
  leaderboardScreen.classList.remove('hidden');
  const leaderboardList = document.getElementById('leaderboard-list');
  leaderboardList.innerHTML = '<p style="text-align:center;opacity:0.6">加载中...</p>';

  try {
    const res = await fetch(`${API_BASE}/leaderboard`);
    const data = await res.json();

    if (!data.scores || data.scores.length === 0) {
      leaderboardList.innerHTML = '<p style="text-align:center;opacity:0.6">暂无记录，快来创造第一个！</p>';
      return;
    }

    leaderboardList.innerHTML = data.scores.map((entry, i) => {
      const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      const rankText = i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}`;
      return `
        <div class="lb-entry">
          <span class="lb-rank ${rankClass}">${rankText}</span>
          <span class="lb-name">${escapeHtml(entry.name)}</span>
          <span class="lb-score">${entry.score}</span>
        </div>
      `;
    }).join('');
  } catch {
    leaderboardList.innerHTML = '<p style="text-align:center;opacity:0.6">加载失败，请稍后再试</p>';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById('leaderboard-btn').addEventListener('click', showLeaderboard);
document.getElementById('gameover-leaderboard-btn').addEventListener('click', showLeaderboard);
document.getElementById('back-btn').addEventListener('click', () => {
  leaderboardScreen.classList.add('hidden');
  if (game.state === 'over') {
    gameoverScreen.classList.remove('hidden');
  } else {
    startScreen.classList.remove('hidden');
  }
});
