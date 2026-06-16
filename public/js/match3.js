(function () {
  'use strict';

  var COLS = 8, ROWS = 8, DURATION = 60;
  var FRUITS = [
    { emoji: '🍎', bg: '#e74c3c' },
    { emoji: '🍊', bg: '#e67e22' },
    { emoji: '🍋', bg: '#f1c40f' },
    { emoji: '🍇', bg: '#9b59b6' },
    { emoji: '🍉', bg: '#27ae60' },
    { emoji: '🍒', bg: '#d63031' },
  ];

  /* ====== SOUND ====== */
  var audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playPop(chain) {
    try {
      ensureAudio();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 500 + chain * 120;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {}
  }

  function playSwap() {
    try {
      ensureAudio();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 300;
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.08);
    } catch (e) {}
  }

  function playBad() {
    try {
      ensureAudio();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 150;
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
  }

  function playEnd() {
    try {
      ensureAudio();
      [523, 440, 349, 262].forEach(function (freq, i) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = freq;
        osc.type = 'triangle';
        var t = audioCtx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.start(t);
        osc.stop(t + 0.22);
      });
    } catch (e) {}
  }

  var board = [];
  var boardEl = document.getElementById('board');
  var hud = document.getElementById('hud');
  var hudScore = document.getElementById('hud-score');
  var hudTimer = document.getElementById('hud-timer');
  var hudTimerWrap = document.querySelector('.hud-timer');
  var screenStart = document.getElementById('screen-start');
  var screenOver = document.getElementById('screen-over');
  var screenRank = document.getElementById('screen-rank');
  var inputName = document.getElementById('input-name');
  var overScore = document.getElementById('over-score');
  var overStatus = document.getElementById('over-status');
  var rankList = document.getElementById('rank-list');

  var score = 0, timeLeft = DURATION, running = false;
  var selected = null, animating = false;
  var timerInterval = null;
  var playerName = '';

  function randFruit() {
    return Math.floor(Math.random() * FRUITS.length);
  }

  function initBoard() {
    board = [];
    for (var r = 0; r < ROWS; r++) {
      board[r] = [];
      for (var c = 0; c < COLS; c++) {
        var f;
        do {
          f = randFruit();
        } while (
          (c >= 2 && board[r][c-1] === f && board[r][c-2] === f) ||
          (r >= 2 && board[r-1][c] === f && board[r-2][c] === f)
        );
        board[r][c] = f;
      }
    }
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        var f = board[r][c];
        if (f >= 0) {
          cell.style.background = FRUITS[f].bg;
          cell.textContent = FRUITS[f].emoji;
        } else {
          cell.style.background = 'transparent';
          cell.textContent = '';
        }
        if (selected && selected.r === r && selected.c === c) {
          cell.classList.add('selected');
        }
        boardEl.appendChild(cell);
      }
    }
  }

  function getMatches() {
    var matched = [];
    // Horizontal
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS - 2; c++) {
        var f = board[r][c];
        if (f < 0) continue;
        if (board[r][c+1] === f && board[r][c+2] === f) {
          var len = 3;
          while (c + len < COLS && board[r][c+len] === f) len++;
          for (var i = 0; i < len; i++) matched.push({ r: r, c: c + i });
          c += len - 1;
        }
      }
    }
    // Vertical
    for (var c = 0; c < COLS; c++) {
      for (var r = 0; r < ROWS - 2; r++) {
        var f = board[r][c];
        if (f < 0) continue;
        if (board[r+1][c] === f && board[r+2][c] === f) {
          var len = 3;
          while (r + len < ROWS && board[r+len][c] === f) len++;
          for (var i = 0; i < len; i++) matched.push({ r: r + i, c: c });
          r += len - 1;
        }
      }
    }
    // Deduplicate
    var seen = {};
    var unique = [];
    for (var i = 0; i < matched.length; i++) {
      var key = matched[i].r + ',' + matched[i].c;
      if (!seen[key]) { seen[key] = true; unique.push(matched[i]); }
    }
    return unique;
  }

  function removeMatches(matches) {
    for (var i = 0; i < matches.length; i++) {
      board[matches[i].r][matches[i].c] = -1;
    }
  }

  function dropAndFill() {
    for (var c = 0; c < COLS; c++) {
      var empty = 0;
      for (var r = ROWS - 1; r >= 0; r--) {
        if (board[r][c] < 0) {
          empty++;
        } else if (empty > 0) {
          board[r + empty][c] = board[r][c];
          board[r][c] = -1;
        }
      }
      for (var r = 0; r < empty; r++) {
        board[r][c] = randFruit();
      }
    }
  }

  function swap(r1, c1, r2, c2) {
    var tmp = board[r1][c1];
    board[r1][c1] = board[r2][c2];
    board[r2][c2] = tmp;
  }

  function isAdjacent(r1, c1, r2, c2) {
    return (Math.abs(r1 - r2) + Math.abs(c1 - c2)) === 1;
  }

  function processChains(callback) {
    var chain = 0;
    function step() {
      var matches = getMatches();
      if (matches.length === 0) {
        animating = false;
        if (callback) callback();
        return;
      }
      chain++;
      var pts = matches.length * 10 * chain;
      score += pts;
      hudScore.textContent = score;
      playPop(chain);
      removeMatches(matches);
      renderBoard();

      setTimeout(function () {
        dropAndFill();
        renderBoard();
        setTimeout(step, 200);
      }, 250);
    }
    animating = true;
    step();
  }

  function onCellClick(e) {
    if (!running || animating) return;
    var cell = e.target.closest('.cell');
    if (!cell) return;
    var r = parseInt(cell.dataset.r);
    var c = parseInt(cell.dataset.c);

    if (!selected) {
      selected = { r: r, c: c };
      renderBoard();
    } else {
      if (selected.r === r && selected.c === c) {
        selected = null;
        renderBoard();
        return;
      }
      if (!isAdjacent(selected.r, selected.c, r, c)) {
        selected = { r: r, c: c };
        renderBoard();
        return;
      }
      // Try swap
      swap(selected.r, selected.c, r, c);
      var matches = getMatches();
      if (matches.length === 0) {
        // Invalid move, swap back
        swap(selected.r, selected.c, r, c);
        selected = null;
        renderBoard();
        playBad();
      } else {
        selected = null;
        playSwap();
        renderBoard();
        processChains();
      }
    }
  }

  boardEl.addEventListener('click', onCellClick);
  // Touch support for faster response
  boardEl.addEventListener('touchend', function (e) {
    e.preventDefault();
    var touch = e.changedTouches[0];
    var el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el) {
      onCellClick({ target: el });
    }
  }, { passive: false });

  function startGame() {
    score = 0;
    timeLeft = DURATION;
    selected = null;
    animating = false;
    running = true;

    initBoard();
    // Make sure no initial matches
    var safety = 0;
    while (getMatches().length > 0 && safety < 50) {
      initBoard();
      safety++;
    }

    hud.classList.remove('hidden');
    boardEl.classList.remove('hidden');
    hudScore.textContent = '0';
    hudTimer.textContent = DURATION;
    hudTimerWrap.classList.remove('warn');
    renderBoard();

    clearInterval(timerInterval);
    timerInterval = setInterval(function () {
      if (!running) return;
      timeLeft--;
      hudTimer.textContent = Math.max(0, timeLeft);
      if (timeLeft <= 10) hudTimerWrap.classList.add('warn');

      if (timeLeft <= 0) {
        running = false;
        clearInterval(timerInterval);
        endGame();
      }
    }, 1000);
  }

  function endGame() {
    hud.classList.add('hidden');
    boardEl.classList.add('hidden');
    overScore.textContent = score;
    screenOver.classList.remove('hidden');
    playEnd();
    submitScore();
  }

  function submitScore() {
    if (!playerName || score <= 0) {
      overStatus.textContent = playerName ? '' : '未输入昵称，分数未提交';
      return;
    }
    overStatus.textContent = '提交中...';
    fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerName, score: score, combo: 0, game: 'match3' })
    }).then(function (res) {
      overStatus.textContent = res.ok ? '✓ 已提交到排行榜' : '提交失败';
    }).catch(function () {
      overStatus.textContent = '网络错误，未提交';
    });
  }

  function showRank() {
    screenStart.classList.add('hidden');
    screenOver.classList.add('hidden');
    screenRank.classList.remove('hidden');
    rankList.innerHTML = '<p class="muted">加载中...</p>';
    fetch('/api/leaderboard?game=match3').then(function (r) { return r.json(); }).then(function (data) {
      if (!data.scores || data.scores.length === 0) {
        rankList.innerHTML = '<p class="muted">暂无记录</p>';
        return;
      }
      rankList.innerHTML = data.scores.map(function (e, i) {
        var cls = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
        var icon = ['🥇', '🥈', '🥉'][i] || (i + 1);
        return '<div class="rank-row"><span class="rank-pos ' + cls + '">' + icon + '</span><span class="rank-name">' + esc(e.name) + '</span><span class="rank-score">' + e.score + '</span></div>';
      }).join('');
    }).catch(function () {
      rankList.innerHTML = '<p class="muted">加载失败</p>';
    });
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  document.getElementById('btn-start').onclick = function () {
    var name = inputName.value.trim();
    if (!name) {
      inputName.classList.add('shake');
      inputName.focus();
      setTimeout(function () { inputName.classList.remove('shake'); }, 400);
      return;
    }
    playerName = name;
    screenStart.classList.add('hidden');
    startGame();
  };

  document.getElementById('btn-restart').onclick = function () {
    screenOver.classList.add('hidden');
    startGame();
  };

  document.getElementById('btn-rank').onclick = showRank;
  document.getElementById('btn-rank2').onclick = showRank;
  document.getElementById('btn-back').onclick = function () {
    screenRank.classList.add('hidden');
    screenStart.classList.remove('hidden');
  };

  // Prevent swipe-back
  function isInteractive(el) {
    if (!el) return false;
    var tag = el.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'A') return true;
    if (el.closest && el.closest('button, input, a, .btn, .rank-list, .cell')) return true;
    return false;
  }
  document.addEventListener('touchstart', function (e) { if (!isInteractive(e.target)) e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', function (e) { if (!isInteractive(e.target)) e.preventDefault(); }, { passive: false });

  // History stack protection
  window.history.pushState(null, '', location.href);
  window.history.pushState(null, '', location.href);
  window.history.pushState(null, '', location.href);
  window.addEventListener('popstate', function () { window.history.pushState(null, '', location.href); });

  // Exit save
  function saveOnExit() {
    if (!running || score <= 0 || !playerName) return;
    var data = JSON.stringify({ name: playerName, score: score, combo: 0, game: 'match3' });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/leaderboard', new Blob([data], { type: 'application/json' }));
    }
    try { localStorage.setItem('match3-pending', data); } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') saveOnExit(); });
  window.addEventListener('pagehide', saveOnExit);

  // Submit pending from previous session
  try {
    var pending = localStorage.getItem('match3-pending');
    if (pending) {
      fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: pending
      }).then(function (res) { if (res.ok) localStorage.removeItem('match3-pending'); }).catch(function () {});
    }
  } catch (e) {}

})();
