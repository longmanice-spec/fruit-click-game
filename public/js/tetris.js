(function () {
  'use strict';

  var COLS = 10, ROWS = 20;
  var COLORS = ['#00f0f0', '#0000f0', '#f0a000', '#f0f000', '#00f000', '#a000f0', '#f00000'];
  var PIECES = [
    [[1,1,1,1]],
    [[1,0,0],[1,1,1]],
    [[0,0,1],[1,1,1]],
    [[1,1],[1,1]],
    [[0,1,1],[1,1,0]],
    [[0,1,0],[1,1,1]],
    [[1,1,0],[0,1,1]],
  ];

  var canvas = document.getElementById('game-canvas');
  var ctx = canvas.getContext('2d');
  var hud = document.getElementById('hud');
  var controls = document.getElementById('controls');
  var hudScore = document.getElementById('hud-score');
  var hudLines = document.getElementById('hud-lines');
  var hudLevel = document.getElementById('hud-level');
  var screenStart = document.getElementById('screen-start');
  var screenOver = document.getElementById('screen-over');
  var screenRank = document.getElementById('screen-rank');
  var inputName = document.getElementById('input-name');
  var overScore = document.getElementById('over-score');
  var overLines = document.getElementById('over-lines');
  var overStatus = document.getElementById('over-status');
  var rankList = document.getElementById('rank-list');

  var cellSize, board, current, currentX, currentY, currentColor;
  var score, lines, level, running, dropInterval, lastDrop, animId;
  var playerName = '';

  /* ====== SOUND ====== */
  var audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }
  function playMove() {
    try { ensureAudio();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value = 200; o.type = 'sine';
      g.gain.setValueAtTime(0.06, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      o.start(); o.stop(audioCtx.currentTime + 0.05);
    } catch(e){}
  }
  function playRotate() {
    try { ensureAudio();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value = 400; o.type = 'sine';
      g.gain.setValueAtTime(0.08, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
      o.start(); o.stop(audioCtx.currentTime + 0.08);
    } catch(e){}
  }
  function playClear(n) {
    try { ensureAudio();
      var freq = 500 + n * 200;
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value = freq; o.type = 'square';
      g.gain.setValueAtTime(0.12, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      o.start(); o.stop(audioCtx.currentTime + 0.2);
    } catch(e){}
  }
  function playDrop() {
    try { ensureAudio();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.frequency.value = 150; o.type = 'triangle';
      g.gain.setValueAtTime(0.1, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      o.start(); o.stop(audioCtx.currentTime + 0.1);
    } catch(e){}
  }
  function playGameOver() {
    try { ensureAudio();
      [400,300,200,100].forEach(function(f,i){
        var o=audioCtx.createOscillator(),g=audioCtx.createGain();
        o.connect(g);g.connect(audioCtx.destination);
        o.frequency.value=f;o.type='sawtooth';
        var t=audioCtx.currentTime+i*0.2;
        g.gain.setValueAtTime(0.1,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.25);
        o.start(t);o.stop(t+0.25);
      });
    } catch(e){}
  }

  /* ====== SIZING ====== */
  function resize() {
    var maxH = window.innerHeight - 48 - 76;
    var maxW = window.innerWidth - 8;
    cellSize = Math.floor(Math.min(maxW / COLS, maxH / ROWS));
    canvas.width = cellSize * COLS;
    canvas.height = cellSize * ROWS;
  }

  /* ====== BOARD ====== */
  function createBoard() {
    board = [];
    for (var r = 0; r < ROWS; r++) {
      board[r] = [];
      for (var c = 0; c < COLS; c++) board[r][c] = 0;
    }
  }

  function spawnPiece() {
    var idx = Math.floor(Math.random() * PIECES.length);
    current = PIECES[idx].map(function(row) { return row.slice(); });
    currentColor = COLORS[idx];
    currentX = Math.floor((COLS - current[0].length) / 2);
    currentY = 0;
    if (collides(currentX, currentY, current)) {
      running = false;
      endGame();
    }
  }

  function collides(x, y, piece) {
    for (var r = 0; r < piece.length; r++) {
      for (var c = 0; c < piece[r].length; c++) {
        if (!piece[r][c]) continue;
        var bx = x + c, by = y + r;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && board[by][bx]) return true;
      }
    }
    return false;
  }

  function merge() {
    for (var r = 0; r < current.length; r++) {
      for (var c = 0; c < current[r].length; c++) {
        if (!current[r][c]) continue;
        var by = currentY + r;
        if (by >= 0) board[by][currentX + c] = currentColor;
      }
    }
  }

  function clearLines() {
    var cleared = 0;
    for (var r = ROWS - 1; r >= 0; r--) {
      var full = true;
      for (var c = 0; c < COLS; c++) { if (!board[r][c]) { full = false; break; } }
      if (full) {
        board.splice(r, 1);
        var empty = [];
        for (var c = 0; c < COLS; c++) empty.push(0);
        board.unshift(empty);
        cleared++;
        r++;
      }
    }
    if (cleared > 0) {
      var pts = [0, 100, 300, 500, 800][cleared] || 800;
      score += pts * level;
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 800 - (level - 1) * 60);
      playClear(cleared);
      updateHud();
    }
  }

  function rotate(piece) {
    var rows = piece.length, cols = piece[0].length;
    var rotated = [];
    for (var c = 0; c < cols; c++) {
      rotated[c] = [];
      for (var r = rows - 1; r >= 0; r--) {
        rotated[c].push(piece[r][c]);
      }
    }
    return rotated;
  }

  /* ====== ACTIONS ====== */
  function moveLeft() {
    if (!running) return;
    if (!collides(currentX - 1, currentY, current)) { currentX--; playMove(); }
  }
  function moveRight() {
    if (!running) return;
    if (!collides(currentX + 1, currentY, current)) { currentX++; playMove(); }
  }
  function moveDown() {
    if (!running) return;
    if (!collides(currentX, currentY + 1, current)) {
      currentY++;
    } else {
      lockPiece();
    }
  }
  function hardDrop() {
    if (!running) return;
    while (!collides(currentX, currentY + 1, current)) currentY++;
    playDrop();
    lockPiece();
  }
  function rotatePiece() {
    if (!running) return;
    var rotated = rotate(current);
    if (!collides(currentX, currentY, rotated)) { current = rotated; playRotate(); }
    else if (!collides(currentX - 1, currentY, rotated)) { currentX--; current = rotated; playRotate(); }
    else if (!collides(currentX + 1, currentY, rotated)) { currentX++; current = rotated; playRotate(); }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawnPiece();
  }

  /* ====== RENDER ====== */
  function render() {
    ctx.fillStyle = '#0f0f2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (var r = 1; r < ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * cellSize); ctx.lineTo(canvas.width, r * cellSize); ctx.stroke();
    }
    for (var c = 1; c < COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * cellSize, 0); ctx.lineTo(c * cellSize, canvas.height); ctx.stroke();
    }

    // Board
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (board[r][c]) {
          drawCell(c, r, board[r][c]);
        }
      }
    }

    // Ghost piece
    if (running && current) {
      var ghostY = currentY;
      while (!collides(currentX, ghostY + 1, current)) ghostY++;
      if (ghostY !== currentY) {
        ctx.globalAlpha = 0.2;
        for (var r = 0; r < current.length; r++) {
          for (var c = 0; c < current[r].length; c++) {
            if (current[r][c]) drawCell(currentX + c, ghostY + r, currentColor);
          }
        }
        ctx.globalAlpha = 1;
      }
    }

    // Current piece
    if (current) {
      for (var r = 0; r < current.length; r++) {
        for (var c = 0; c < current[r].length; c++) {
          if (current[r][c]) drawCell(currentX + c, currentY + r, currentColor);
        }
      }
    }
  }

  function drawCell(x, y, color) {
    if (y < 0) return;
    var px = x * cellSize, py = y * cellSize;
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(px + 1, py + 1, cellSize - 2, 3);
    ctx.fillRect(px + 1, py + 1, 3, cellSize - 2);
  }

  function updateHud() {
    hudScore.textContent = score;
    hudLines.textContent = lines;
    hudLevel.textContent = level;
  }

  /* ====== GAME LOOP ====== */
  function loop(now) {
    if (!running) return;
    animId = requestAnimationFrame(loop);
    if (now - lastDrop > dropInterval) {
      lastDrop = now;
      moveDown();
    }
    render();
  }

  /* ====== GAME FLOW ====== */
  function startGame() {
    resize();
    createBoard();
    score = 0; lines = 0; level = 1;
    dropInterval = 800;
    running = true;
    lastDrop = performance.now();
    spawnPiece();
    updateHud();
    hud.classList.remove('hidden');
    controls.classList.remove('hidden');
    animId = requestAnimationFrame(loop);
  }

  function endGame() {
    cancelAnimationFrame(animId);
    hud.classList.add('hidden');
    controls.classList.add('hidden');
    overScore.textContent = score;
    overLines.textContent = lines;
    screenOver.classList.remove('hidden');
    playGameOver();
    submitScore();
  }

  function submitScore() {
    if (!playerName || score <= 0) {
      overStatus.textContent = playerName ? '' : '未输入昵称';
      return;
    }
    overStatus.textContent = '提交中...';
    fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerName, score: score, combo: lines, game: 'tetris' })
    }).then(function (res) {
      overStatus.textContent = res.ok ? '✓ 已提交到排行榜' : '提交失败';
    }).catch(function () {
      overStatus.textContent = '网络错误';
    });
  }

  function showRank() {
    screenStart.classList.add('hidden');
    screenOver.classList.add('hidden');
    screenRank.classList.remove('hidden');
    rankList.innerHTML = '<p class="muted">加载中...</p>';
    fetch('/api/leaderboard?game=tetris').then(function(r){return r.json();}).then(function(data){
      if (!data.scores || data.scores.length === 0) { rankList.innerHTML = '<p class="muted">暂无记录</p>'; return; }
      rankList.innerHTML = data.scores.map(function(e, i){
        var cls = i===0?'r1':i===1?'r2':i===2?'r3':'';
        var icon = ['🥇','🥈','🥉'][i]||(i+1);
        return '<div class="rank-row"><span class="rank-pos '+cls+'">'+icon+'</span><span class="rank-name">'+esc(e.name)+'</span><span class="rank-score">'+e.score+'</span></div>';
      }).join('');
    }).catch(function(){ rankList.innerHTML = '<p class="muted">加载失败</p>'; });
  }

  function esc(s){ var d=document.createElement('div');d.textContent=s;return d.innerHTML; }

  /* ====== CONTROLS ====== */
  document.getElementById('btn-left').addEventListener('touchstart', function(e){ e.preventDefault(); moveLeft(); }, {passive:false});
  document.getElementById('btn-right').addEventListener('touchstart', function(e){ e.preventDefault(); moveRight(); }, {passive:false});
  document.getElementById('btn-down').addEventListener('touchstart', function(e){ e.preventDefault(); moveDown(); }, {passive:false});
  document.getElementById('btn-rotate').addEventListener('touchstart', function(e){ e.preventDefault(); rotatePiece(); }, {passive:false});
  document.getElementById('btn-drop').addEventListener('touchstart', function(e){ e.preventDefault(); hardDrop(); }, {passive:false});

  // Keyboard
  document.addEventListener('keydown', function(e) {
    if (!running) return;
    if (e.key === 'ArrowLeft') moveLeft();
    else if (e.key === 'ArrowRight') moveRight();
    else if (e.key === 'ArrowDown') moveDown();
    else if (e.key === 'ArrowUp') rotatePiece();
    else if (e.key === ' ') hardDrop();
  });

  /* ====== BUTTONS ====== */
  document.getElementById('btn-start').onclick = function() {
    var name = inputName.value.trim();
    if (!name) { inputName.classList.add('shake'); inputName.focus(); setTimeout(function(){inputName.classList.remove('shake');},400); return; }
    playerName = name;
    screenStart.classList.add('hidden');
    startGame();
  };
  document.getElementById('btn-restart').onclick = function() { screenOver.classList.add('hidden'); startGame(); };
  document.getElementById('btn-rank').onclick = showRank;
  document.getElementById('btn-rank2').onclick = showRank;
  document.getElementById('btn-back').onclick = function() { screenRank.classList.add('hidden'); screenStart.classList.remove('hidden'); };

  /* ====== PREVENT SWIPE-BACK ====== */
  function isInteractive(el) {
    if (!el) return false;
    var tag = el.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'A') return true;
    if (el.closest && el.closest('button, input, a, .btn, .ctrl-btn, .rank-list')) return true;
    return false;
  }
  document.addEventListener('touchstart', function(e){ if(!isInteractive(e.target)) e.preventDefault(); }, {passive:false});
  document.addEventListener('touchmove', function(e){ if(!isInteractive(e.target)) e.preventDefault(); }, {passive:false});
  window.history.pushState(null,'',location.href);
  window.history.pushState(null,'',location.href);
  window.history.pushState(null,'',location.href);
  window.addEventListener('popstate', function(){ window.history.pushState(null,'',location.href); });

  /* ====== EXIT SAVE ====== */
  function saveOnExit() {
    if (!running || score <= 0 || !playerName) return;
    running = false;
    var data = JSON.stringify({ name: playerName, score: score, combo: lines, game: 'tetris' });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/leaderboard', new Blob([data],{type:'application/json'}));
    try { localStorage.setItem('tetris-pending', data); } catch(e){}
  }
  document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='hidden') saveOnExit(); });
  window.addEventListener('pagehide', saveOnExit);
  try {
    var pending = localStorage.getItem('tetris-pending');
    if (pending) {
      fetch('/api/leaderboard',{method:'POST',headers:{'Content-Type':'application/json'},body:pending})
        .then(function(r){if(r.ok) localStorage.removeItem('tetris-pending');}).catch(function(){});
    }
  } catch(e){}

  /* ====== INIT ====== */
  resize();
  window.addEventListener('resize', resize);
})();
