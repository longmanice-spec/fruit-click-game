(function () {
  'use strict';

  /* ====== CONFIG ====== */
  var DURATION = 60;
  var FRUITS = [
    { emoji: '🍎', pts: 1, fill: '#e74c3c', stroke: '#c0392b' },
    { emoji: '🍊', pts: 1, fill: '#e67e22', stroke: '#d35400' },
    { emoji: '🍋', pts: 1, fill: '#f1c40f', stroke: '#d4ac0f' },
    { emoji: '🍇', pts: 2, fill: '#9b59b6', stroke: '#7d3c98' },
    { emoji: '🍉', pts: 2, fill: '#27ae60', stroke: '#1e8449' },
    { emoji: '🍑', pts: 2, fill: '#fd79a8', stroke: '#e84393' },
    { emoji: '🍍', pts: 3, fill: '#fdcb6e', stroke: '#e1b12c' },
    { emoji: '🥝', pts: 3, fill: '#00b894', stroke: '#00a87d' },
    { emoji: '🍒', pts: 3, fill: '#d63031', stroke: '#b71c1c' },
  ];

  /* ====== DOM ====== */
  var canvas = document.getElementById('game-canvas');
  var ctx = canvas.getContext('2d');
  var hud = document.getElementById('hud');
  var hudScore = document.getElementById('hud-score');
  var hudCombo = document.getElementById('hud-combo');
  var hudComboVal = document.getElementById('hud-combo-val');
  var hudTimer = document.getElementById('hud-timer');
  var hudTimerWrap = document.querySelector('.hud-timer');

  var screenStart = document.getElementById('screen-start');
  var screenOver = document.getElementById('screen-over');
  var screenRank = document.getElementById('screen-rank');
  var inputName = document.getElementById('input-name');
  var overScore = document.getElementById('over-score');
  var overCombo = document.getElementById('over-combo');
  var overStatus = document.getElementById('over-status');
  var rankList = document.getElementById('rank-list');

  /* ====== STATE ====== */
  var W, H, dpr;
  var running = false;
  var score, combo, maxCombo, timeLeft;
  var objects, particles, trail;
  var spawnAcc, spawnRate;
  var lastFrame;
  var playerName = '';
  var pointerDown = false;
  var pointer = { x: 0, y: 0 };
  var prevPointer = { x: 0, y: 0 };

  /* ====== RESIZE ====== */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  /* ====== INPUT ====== */
  function ptrPos(e) {
    var t = e.touches ? e.touches[0] : e;
    return { x: t.clientX, y: t.clientY };
  }

  function onDown(e) {
    e.preventDefault();
    pointerDown = true;
    pointer = ptrPos(e);
    prevPointer = { x: pointer.x, y: pointer.y };
    trail = [{ x: pointer.x, y: pointer.y, t: performance.now() }];
  }

  function onMove(e) {
    e.preventDefault();
    if (!pointerDown) return;
    prevPointer = { x: pointer.x, y: pointer.y };
    pointer = ptrPos(e);
    trail.push({ x: pointer.x, y: pointer.y, t: performance.now() });
    if (trail.length > 18) trail.shift();
    if (running) checkHits();
  }

  function onUp(e) {
    e.preventDefault();
    pointerDown = false;
    trail = [];
  }

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseup', onUp);
  canvas.addEventListener('mouseleave', onUp);
  canvas.addEventListener('touchstart', onDown, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onUp, { passive: false });
  canvas.addEventListener('touchcancel', onUp, { passive: false });

  /* ====== HIT DETECTION ====== */
  function checkHits() {
    var dx = pointer.x - prevPointer.x;
    var dy = pointer.y - prevPointer.y;
    var speed = Math.sqrt(dx * dx + dy * dy);
    if (speed < 4) return;

    for (var i = objects.length - 1; i >= 0; i--) {
      var o = objects[i];
      if (o.hit) continue;
      var dist = Math.sqrt(Math.pow(pointer.x - o.x, 2) + Math.pow(pointer.y - o.y, 2));
      if (dist < o.r + 18) {
        o.hit = true;
        if (o.bomb) {
          score = Math.max(0, score - 10);
          combo = 0;
          spawnBurst(o.x, o.y, '#ff4444', 10);
          spawnBurst(o.x, o.y, '#ff8800', 6);
        } else {
          var mul = 1 + Math.floor(combo / 3);
          score += o.data.pts * mul;
          combo++;
          if (combo > maxCombo) maxCombo = combo;
          spawnBurst(o.x, o.y, o.data.fill, 8);
        }
        updateHud();
      }
    }
  }

  /* ====== PARTICLES ====== */
  function spawnBurst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 2 + Math.random() * 5;
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 3 + Math.random() * 4,
        color: color,
        life: 1
      });
    }
  }

  /* ====== SPAWN FRUIT ====== */
  function spawnOne() {
    var margin = 50;
    var x = margin + Math.random() * (W - margin * 2);
    var isBomb = Math.random() < 0.13;
    var vy = -(H * 0.018 + Math.random() * H * 0.007);
    objects.push({
      x: x,
      y: H + 50,
      vx: (Math.random() - 0.5) * 3.5,
      vy: vy,
      grav: 0.4,
      r: 28,
      rot: Math.random() * 6.28,
      rotV: (Math.random() - 0.5) * 0.08,
      hit: false,
      bomb: isBomb,
      data: isBomb ? null : FRUITS[Math.floor(Math.random() * FRUITS.length)]
    });
  }

  /* ====== HUD ====== */
  function updateHud() {
    hudScore.textContent = score;
    var secs = Math.ceil(timeLeft);
    hudTimer.textContent = secs;
    if (secs <= 10) {
      hudTimerWrap.classList.add('warn');
    } else {
      hudTimerWrap.classList.remove('warn');
    }
    if (combo >= 2) {
      hudCombo.classList.remove('hidden');
      hudComboVal.textContent = combo;
    } else {
      hudCombo.classList.add('hidden');
    }
  }

  /* ====== GAME LOOP ====== */
  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);

    var dt = Math.min(now - lastFrame, 40) / 1000;
    lastFrame = now;

    // Timer
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      running = false;
      updateHud();
      endGame();
      return;
    }

    // Combo decay
    if (combo > 0) {
      if (!loop._comboTime) loop._comboTime = 0;
      loop._comboTime += dt;
      if (loop._comboTime > 0.8) {
        combo = 0;
        loop._comboTime = 0;
        updateHud();
      }
    }
    // Reset timer on combo hit
    if (combo > 0) loop._comboTime = 0;

    // Difficulty
    var elapsed = DURATION - timeLeft;
    var diff = 1 + Math.floor(elapsed / 12);
    spawnRate = Math.max(0.3, 1.0 - diff * 0.06);

    // Spawn
    spawnAcc += dt;
    if (spawnAcc >= spawnRate) {
      spawnAcc = 0;
      var count = 1 + Math.floor(Math.random() * Math.min(diff, 3));
      for (var i = 0; i < count; i++) spawnOne();
    }

    // Update objects
    for (var i = objects.length - 1; i >= 0; i--) {
      var o = objects[i];
      if (o.hit) { objects.splice(i, 1); continue; }
      o.x += o.vx;
      o.vy += o.grav;
      o.y += o.vy;
      o.rot += o.rotV;
      if (o.y > H + 80) objects.splice(i, 1);
    }

    // Update particles
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life -= 0.025;
      if (p.life <= 0) particles.splice(i, 1);
    }

    updateHud();
    render();
  }

  /* ====== RENDER ====== */
  function render() {
    ctx.clearRect(0, 0, W, H);

    // Background gradient
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a0a2e');
    bg.addColorStop(1, '#0f3460');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Particles
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.28);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Objects
    for (var i = 0; i < objects.length; i++) {
      var o = objects[i];
      if (o.hit) continue;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rot);

      if (o.bomb) {
        // Draw bomb as filled circle + fuse
        ctx.beginPath();
        ctx.arc(0, 0, o.r, 0, 6.28);
        ctx.fillStyle = '#2d2d2d';
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Fuse
        ctx.beginPath();
        ctx.moveTo(0, -o.r);
        ctx.lineTo(4, -o.r - 12);
        ctx.strokeStyle = '#ff8800';
        ctx.lineWidth = 3;
        ctx.stroke();
        // Spark
        ctx.beginPath();
        ctx.arc(4, -o.r - 12, 4, 0, 6.28);
        ctx.fillStyle = '#ffdd00';
        ctx.fill();
        // Skull icon
        ctx.fillStyle = '#fff';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💣', 0, 0);
      } else {
        // Fruit: colored circle + emoji
        ctx.beginPath();
        ctx.arc(0, 0, o.r, 0, 6.28);
        ctx.fillStyle = o.data.fill;
        ctx.fill();
        ctx.strokeStyle = o.data.stroke;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Highlight
        ctx.beginPath();
        ctx.arc(-o.r * 0.3, -o.r * 0.3, o.r * 0.3, 0, 6.28);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fill();

        // Emoji on top
        ctx.font = (o.r * 1.2) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(o.data.emoji, 0, 2);
      }

      ctx.restore();
    }

    // Slice trail
    if (trail && trail.length > 1) {
      var now = performance.now();
      ctx.lineCap = 'round';
      for (var i = 1; i < trail.length; i++) {
        var a = trail[i - 1];
        var b = trail[i];
        var age = (now - b.t) / 180;
        var alpha = Math.max(0, 1 - age);
        if (alpha <= 0) continue;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3 + 2 * alpha;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ====== GAME FLOW ====== */
  function startGame() {
    score = 0;
    combo = 0;
    maxCombo = 0;
    timeLeft = DURATION;
    objects = [];
    particles = [];
    trail = [];
    spawnAcc = 0;
    spawnRate = 1.0;
    loop._comboTime = 0;
    running = true;
    lastFrame = performance.now();

    hud.classList.remove('hidden');
    updateHud();
    requestAnimationFrame(loop);
  }

  function endGame() {
    hud.classList.add('hidden');
    overScore.textContent = score;
    overCombo.textContent = maxCombo;
    screenOver.classList.remove('hidden');
    submitScore();
  }

  async function submitScore() {
    if (!playerName || score <= 0) {
      overStatus.textContent = playerName ? '' : '未输入昵称，分数未提交';
      return;
    }
    overStatus.textContent = '提交中...';
    try {
      var res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName, score: score, combo: maxCombo })
      });
      overStatus.textContent = res.ok ? '✓ 已提交到排行榜' : '提交失败';
    } catch (e) {
      overStatus.textContent = '网络错误，未提交';
    }
  }

  async function showRank() {
    screenStart.classList.add('hidden');
    screenOver.classList.add('hidden');
    screenRank.classList.remove('hidden');
    rankList.innerHTML = '<p class="muted">加载中...</p>';
    try {
      var res = await fetch('/api/leaderboard');
      var data = await res.json();
      if (!data.scores || data.scores.length === 0) {
        rankList.innerHTML = '<p class="muted">暂无记录</p>';
        return;
      }
      rankList.innerHTML = data.scores.map(function (e, i) {
        var cls = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
        var icon = ['🥇','🥈','🥉'][i] || (i + 1);
        return '<div class="rank-row"><span class="rank-pos ' + cls + '">' + icon + '</span><span class="rank-name">' + esc(e.name) + '</span><span class="rank-score">' + e.score + '</span></div>';
      }).join('');
    } catch (e) {
      rankList.innerHTML = '<p class="muted">加载失败</p>';
    }
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ====== BUTTONS ====== */
  document.getElementById('btn-start').addEventListener('click', function () {
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
  });

  document.getElementById('btn-restart').addEventListener('click', function () {
    screenOver.classList.add('hidden');
    startGame();
  });

  document.getElementById('btn-rank').addEventListener('click', showRank);
  document.getElementById('btn-rank2').addEventListener('click', showRank);
  document.getElementById('btn-back').addEventListener('click', function () {
    screenRank.classList.add('hidden');
    if (running) return;
    if (score !== undefined && !screenOver.classList.contains('hidden')) return;
    screenStart.classList.remove('hidden');
  });

  // Draw idle background
  render();
})();
