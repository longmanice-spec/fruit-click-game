(function(){
  'use strict';

  var canvas = document.getElementById('game-canvas');
  var ctx = canvas.getContext('2d');
  var hud = document.getElementById('hud');
  var controlsEl = document.getElementById('controls');
  var hudScore = document.getElementById('hud-score');
  var hudLen = document.getElementById('hud-len');
  var screenStart = document.getElementById('screen-start');
  var screenOver = document.getElementById('screen-over');
  var screenRank = document.getElementById('screen-rank');
  var inputName = document.getElementById('input-name');
  var overScore = document.getElementById('over-score');
  var overLen = document.getElementById('over-len');
  var overStatus = document.getElementById('over-status');
  var rankList = document.getElementById('rank-list');

  var CELL, COLS, ROWS;
  var snake, dir, nextDir, food, score, running, interval;
  var speed = 220;
  var playerName = '';

  // Sound
  var audioCtx = null;
  function ensureAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); }
  function playEat() {
    try { ensureAudio();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value = 600 + snake.length * 10; o.type = 'sine';
      g.gain.setValueAtTime(0.12, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      o.start(); o.stop(audioCtx.currentTime + 0.1);
    } catch(e) {}
  }
  function playDie() {
    try { ensureAudio();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value = 100; o.type = 'sawtooth';
      g.gain.setValueAtTime(0.15, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      o.start(); o.stop(audioCtx.currentTime + 0.35);
    } catch(e) {}
  }

  function resize() {
    var maxW = window.innerWidth - 4;
    var maxH = window.innerHeight - 48 - 200;
    CELL = Math.floor(Math.min(maxW, maxH) / 20);
    COLS = Math.floor(maxW / CELL);
    ROWS = Math.floor(maxH / CELL);
    if (COLS < 10) COLS = 10;
    if (ROWS < 10) ROWS = 10;
    canvas.width = COLS * CELL;
    canvas.height = ROWS * CELL;
  }

  function spawnFood() {
    var tries = 0;
    do {
      food = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
      tries++;
    } while (snakeHas(food.x, food.y) && tries < 200);
  }

  function snakeHas(x, y) {
    for (var i = 0; i < snake.length; i++) {
      if (snake[i].x === x && snake[i].y === y) return true;
    }
    return false;
  }

  function init() {
    resize();
    var cx = Math.floor(COLS / 2);
    var cy = Math.floor(ROWS / 2);
    snake = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    speed = 220;
    spawnFood();
    updateHud();
  }

  function updateHud() {
    hudScore.textContent = score;
    hudLen.textContent = snake.length;
  }

  function step() {
    dir = { x: nextDir.x, y: nextDir.y };
    var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // Wall collision
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      die(); return;
    }
    // Self collision
    if (snakeHas(head.x, head.y)) {
      die(); return;
    }

    snake.unshift(head);

    // Eat food
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      playEat();
      spawnFood();
      // Speed up slightly
      if (speed > 100) speed -= 1;
    } else {
      snake.pop();
    }

    updateHud();
    render();
  }

  function die() {
    running = false;
    clearTimeout(interval);
    playDie();
    setTimeout(endGame, 300);
  }

  function render() {
    ctx.fillStyle = '#0f0f23';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(0,255,100,0.04)';
    ctx.lineWidth = 1;
    for (var r = 1; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(canvas.width, r * CELL); ctx.stroke(); }
    for (var c = 1; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, canvas.height); ctx.stroke(); }

    // Snake
    for (var i = 0; i < snake.length; i++) {
      var s = snake[i];
      var isHead = i === 0;
      ctx.fillStyle = isHead ? '#00ff64' : '#00cc50';
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
      if (isHead) {
        // Eyes
        ctx.fillStyle = '#fff';
        var ex1, ey1, ex2, ey2;
        if (dir.x === 1) { ex1 = 0.65; ey1 = 0.25; ex2 = 0.65; ey2 = 0.75; }
        else if (dir.x === -1) { ex1 = 0.35; ey1 = 0.25; ex2 = 0.35; ey2 = 0.75; }
        else if (dir.y === -1) { ex1 = 0.25; ey1 = 0.35; ex2 = 0.75; ey2 = 0.35; }
        else { ex1 = 0.25; ey1 = 0.65; ex2 = 0.75; ey2 = 0.65; }
        var er = CELL * 0.12;
        ctx.beginPath(); ctx.arc(s.x * CELL + CELL * ex1, s.y * CELL + CELL * ey1, er, 0, 6.28); ctx.fill();
        ctx.beginPath(); ctx.arc(s.x * CELL + CELL * ex2, s.y * CELL + CELL * ey2, er, 0, 6.28); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(s.x * CELL + CELL * ex1, s.y * CELL + CELL * ey1, er * 0.5, 0, 6.28); ctx.fill();
        ctx.beginPath(); ctx.arc(s.x * CELL + CELL * ex2, s.y * CELL + CELL * ey2, er * 0.5, 0, 6.28); ctx.fill();
      }
      // Gradient on body
      if (!isHead && i < snake.length - 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
      }
    }

    // Food
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL * 0.4, 0, 6.28);
    ctx.fill();
    // Food shine
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL * 0.4, food.y * CELL + CELL * 0.4, CELL * 0.12, 0, 6.28);
    ctx.fill();
  }

  function setDir(x, y) {
    // Prevent reversing
    if (dir.x === -x && dir.y === -y) return;
    if (x === dir.x && y === dir.y) return;
    nextDir = { x: x, y: y };
  }

  // Controls
  document.getElementById('btn-up').addEventListener('touchstart', function(e) { e.preventDefault(); setDir(0, -1); }, { passive: false });
  document.getElementById('btn-down').addEventListener('touchstart', function(e) { e.preventDefault(); setDir(0, 1); }, { passive: false });
  document.getElementById('btn-left').addEventListener('touchstart', function(e) { e.preventDefault(); setDir(-1, 0); }, { passive: false });
  document.getElementById('btn-right').addEventListener('touchstart', function(e) { e.preventDefault(); setDir(1, 0); }, { passive: false });

  // Keyboard
  document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowUp') setDir(0, -1);
    else if (e.key === 'ArrowDown') setDir(0, 1);
    else if (e.key === 'ArrowLeft') setDir(-1, 0);
    else if (e.key === 'ArrowRight') setDir(1, 0);
  });

  // Swipe on canvas
  var sx, sy;
  canvas.addEventListener('touchstart', function(e) { e.preventDefault(); sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: false });
  canvas.addEventListener('touchend', function(e) {
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx;
    var dy = e.changedTouches[0].clientY - sy;
    sx = sy = null;
    if (Math.abs(dx) < 15 && Math.abs(dy) < 15) return;
    if (Math.abs(dx) > Math.abs(dy)) { setDir(dx > 0 ? 1 : -1, 0); }
    else { setDir(0, dy > 0 ? 1 : -1); }
  }, { passive: false });

  function startGame() {
    init();
    running = true;
    hud.classList.remove('hidden');
    controlsEl.classList.remove('hidden');
    render();
    clearTimeout(interval);
    function tick() {
      if (!running) return;
      step();
      interval = setTimeout(tick, speed);
    }
    interval = setTimeout(tick, speed);
  }

  function endGame() {
    hud.classList.add('hidden');
    controlsEl.classList.add('hidden');
    overScore.textContent = score;
    overLen.textContent = snake.length;
    screenOver.classList.remove('hidden');
    submitScore();
  }

  function submitScore() {
    if (!playerName || score <= 0) { overStatus.textContent = playerName ? '' : '未输入昵称'; return; }
    overStatus.textContent = '提交中...';
    fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerName, score: score, combo: snake.length, game: 'snake' })
    }).then(function(r) { overStatus.textContent = r.ok ? '✓ 已提交' : '提交失败'; }).catch(function() { overStatus.textContent = '网络错误'; });
  }

  function showRank() {
    screenStart.classList.add('hidden'); screenOver.classList.add('hidden'); screenRank.classList.remove('hidden');
    rankList.innerHTML = '<p class="muted">加载中...</p>';
    fetch('/api/leaderboard?game=snake').then(function(r) { return r.json(); }).then(function(data) {
      if (!data.scores || data.scores.length === 0) { rankList.innerHTML = '<p class="muted">暂无记录</p>'; return; }
      rankList.innerHTML = data.scores.map(function(e, i) {
        var cls = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
        var icon = ['🥇', '🥈', '🥉'][i] || (i + 1);
        return '<div class="rank-row"><span class="rank-pos ' + cls + '">' + icon + '</span><span class="rank-name">' + esc(e.name) + '</span><span class="rank-score">' + e.score + '</span></div>';
      }).join('');
    }).catch(function() { rankList.innerHTML = '<p class="muted">加载失败</p>'; });
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  document.getElementById('btn-start').onclick = function() {
    var name = inputName.value.trim();
    if (!name) { inputName.classList.add('shake'); inputName.focus(); setTimeout(function() { inputName.classList.remove('shake'); }, 400); return; }
    playerName = name; screenStart.classList.add('hidden'); startGame();
  };
  document.getElementById('btn-restart').onclick = function() { screenOver.classList.add('hidden'); startGame(); };
  document.getElementById('btn-rank').onclick = showRank;
  document.getElementById('btn-rank2').onclick = showRank;
  document.getElementById('btn-back').onclick = function() { screenRank.classList.add('hidden'); screenStart.classList.remove('hidden'); };

  // Prevent swipe-back
  function isInteractive(el) {
    if (!el) return false;
    var tag = el.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'A') return true;
    if (el.closest && el.closest('button, input, a, .btn, .ctrl-btn, .rank-list')) return true;
    return false;
  }
  document.addEventListener('touchstart', function(e) { if (!isInteractive(e.target)) e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', function(e) { if (!isInteractive(e.target)) e.preventDefault(); }, { passive: false });
  window.history.pushState(null, '', location.href);
  window.history.pushState(null, '', location.href);
  window.addEventListener('popstate', function() { window.history.pushState(null, '', location.href); });

  // Exit save
  function saveOnExit() {
    if (!running || score <= 0 || !playerName) return; running = false;
    var data = JSON.stringify({ name: playerName, score: score, combo: snake.length, game: 'snake' });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/leaderboard', new Blob([data], { type: 'application/json' }));
  }
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'hidden') saveOnExit(); });
  window.addEventListener('pagehide', saveOnExit);

  resize();
  window.addEventListener('resize', resize);
})();
