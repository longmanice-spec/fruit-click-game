const API_BASE = '/api';

const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);

const startScreen = document.getElementById('start-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const leaderboardScreen = document.getElementById('leaderboard-screen');
const scoreEl = document.getElementById('score');
const comboDisplay = document.getElementById('combo-display');
const comboCountEl = document.getElementById('combo-count');
const livesEl = document.getElementById('lives');
const finalScoreEl = document.getElementById('final-score');
const finalComboEl = document.getElementById('final-combo');
const submitSection = document.getElementById('submit-score');
const playerNameInput = document.getElementById('player-name');
const leaderboardList = document.getElementById('leaderboard-list');

function updateLives(lives) {
  livesEl.textContent = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
}

game.onScoreUpdate = (score, combo) => {
  scoreEl.textContent = score;
  if (combo >= 2) {
    comboDisplay.classList.remove('hidden');
    comboCountEl.textContent = combo;
  } else {
    comboDisplay.classList.add('hidden');
  }
};

game.onLifeLost = (lives) => {
  updateLives(lives);
};

game.onGameOver = (score, maxCombo) => {
  gameoverScreen.classList.remove('hidden');
  finalScoreEl.textContent = score;
  finalComboEl.textContent = maxCombo;
  if (score > 0) {
    submitSection.classList.remove('hidden');
  }
};

document.getElementById('start-btn').addEventListener('click', () => {
  startScreen.classList.add('hidden');
  updateLives(3);
  scoreEl.textContent = '0';
  comboDisplay.classList.add('hidden');
  game.start();
});

document.getElementById('restart-btn').addEventListener('click', () => {
  gameoverScreen.classList.add('hidden');
  submitSection.classList.add('hidden');
  updateLives(3);
  scoreEl.textContent = '0';
  comboDisplay.classList.add('hidden');
  game.start();
});

document.getElementById('submit-btn').addEventListener('click', async () => {
  const name = playerNameInput.value.trim();
  if (!name) {
    playerNameInput.style.borderColor = '#ff3b30';
    return;
  }
  playerNameInput.style.borderColor = '';

  const btn = document.getElementById('submit-btn');
  btn.textContent = '提交中...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score: game.score, combo: game.maxCombo }),
    });
    if (res.ok) {
      btn.textContent = '已提交 ✓';
      submitSection.querySelector('input').disabled = true;
    } else {
      btn.textContent = '提交失败';
      btn.disabled = false;
    }
  } catch {
    btn.textContent = '网络错误';
    btn.disabled = false;
  }
});

async function showLeaderboard() {
  startScreen.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
  leaderboardScreen.classList.remove('hidden');
  leaderboardList.innerHTML = '<p style="text-align:center;opacity:0.6">加载中...</p>';

  try {
    const res = await fetch(`${API_BASE}/leaderboard`);
    const data = await res.json();

    if (!data.scores || data.scores.length === 0) {
      leaderboardList.innerHTML = '<p style="text-align:center;opacity:0.6">暂无记录，快来创造第一个记录吧！</p>';
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
