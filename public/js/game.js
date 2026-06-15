(function () {
  'use strict';

  var DURATION = 60;
  var FRUITS = [
    { emoji: '🍬', pts: 1, fill: '#ff6b6b', stroke: '#e74c3c' },
    { emoji: '🍭', pts: 1, fill: '#a29bfe', stroke: '#6c5ce7' },
    { emoji: '🍫', pts: 1, fill: '#b47040', stroke: '#8b5e34' },
    { emoji: '🍩', pts: 2, fill: '#fd79a8', stroke: '#e84393' },
    { emoji: '🧁', pts: 2, fill: '#fdcb6e', stroke: '#e1b12c' },
    { emoji: '🍪', pts: 2, fill: '#e67e22', stroke: '#d35400' },
    { emoji: '🎂', pts: 3, fill: '#ff7675', stroke: '#d63031' },
    { emoji: '🍡', pts: 3, fill: '#55efc4', stroke: '#00b894' },
    { emoji: '🍮', pts: 3, fill: '#ffeaa7', stroke: '#dab600' },
  ];

  /* ====== SOUND ====== */
  var audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playSlice(comboN) {
    try {
      ensureAudio();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      // pitch rises with combo
      osc.frequency.value = 600 + Math.min(comboN, 10) * 80;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  }

  function playBomb() {
    try {
      ensureAudio();
      // low rumble
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 80;
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.4);
      // noise burst
      var buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.2, audioCtx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      var noise = audioCtx.createBufferSource();
      var ng = audioCtx.createGain();
      noise.buffer = buf;
      noise.connect(ng);
      ng.connect(audioCtx.destination);
      ng.gain.setValueAtTime(0.25, audioCtx.currentTime);
      ng.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      noise.start(audioCtx.currentTime);
    } catch (e) {}
  }

  function playGameOver() {
    try {
      ensureAudio();
      var notes = [523, 440, 349, 262];
      notes.forEach(function (freq, i) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = freq;
        osc.type = 'triangle';
        var t = audioCtx.currentTime + i * 0.2;
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    } catch (e) {}
  }

  function playStart() {
    try {
      ensureAudio();
      var notes = [262, 330, 392, 523];
      notes.forEach(function (freq, i) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        var t = audioCtx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.start(t);
        osc.stop(t + 0.15);
      });
    } catch (e) {}
  }

  function playTick() {
    try {
      ensureAudio();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 1000;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.06);
    } catch (e) {}
  }

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

  var W = 0, H = 0, dpr = 1;
  var running = false;
  var score = 0, combo = 0, maxCombo = 0, timeLeft = DURATION;
  var objects = [];
  var particles = [];
  var trail = [];
  var spawnAcc = 0, spawnRate = 1.0;
  var lastFrame = 0;
  var comboTime = 0;
  var playerName = '';
  var pointerDown = false;
  var pointer = { x: 0, y: 0 };
  var prevPointer = { x: 0, y: 0 };

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

  function ptrPos(e) {
    var t = e.touches ? e.touches[0] : e;
    return { x: t.clientX, y: t.clientY };
  }

  function onDown(e) {
    if (!running) return;
    e.preventDefault();
    pointerDown = true;
    pointer = ptrPos(e);
    prevPointer = { x: pointer.x, y: pointer.y };
    trail = [{ x: pointer.x, y: pointer.y, t: performance.now() }];
  }

  function onMove(e) {
    if (!running) return;
    e.preventDefault();
    if (!pointerDown) return;
    prevPointer = { x: pointer.x, y: pointer.y };
    pointer = ptrPos(e);
    trail.push({ x: pointer.x, y: pointer.y, t: performance.now() });
    if (trail.length > 18) trail.shift();
    checkHits();
  }

  function onUp(e) {
    if (!running) return;
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
          comboTime = 0;
          spawnBurst(o.x, o.y, '#ff4444', 10);
          spawnBurst(o.x, o.y, '#ff8800', 6);
          playBomb();
        } else {
          var mul = 1 + Math.floor(combo / 3);
          score += o.data.pts * mul;
          combo++;
          comboTime = 0;
          if (combo > maxCombo) maxCombo = combo;
          spawnBurst(o.x, o.y, o.data.fill, 8);
          playSlice(combo);
        }
        updateHud();
      }
    }
  }

  function spawnBurst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var angle = Math.random() * 6.28;
      var spd = 2 + Math.random() * 5;
      particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        r: 3 + Math.random() * 4,
        color: color,
        life: 1
      });
    }
  }

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

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);

    var dt = Math.min(now - lastFrame, 40) / 1000;
    lastFrame = now;

    var prevSec = Math.ceil(timeLeft);
    timeLeft -= dt;
    var curSec = Math.ceil(timeLeft);
    if (curSec !== prevSec && curSec <= 5 && curSec > 0) {
      playTick();
    }
    if (timeLeft <= 0) {
      timeLeft = 0;
      running = false;
      updateHud();
      endGame();
      return;
    }

    // combo decay
    if (combo > 0) {
      comboTime += dt;
      if (comboTime > 1.0) {
        combo = 0;
        comboTime = 0;
      }
    }

    // difficulty
    var elapsed = DURATION - timeLeft;
    var diff = 1 + Math.floor(elapsed / 12);
    spawnRate = Math.max(0.35, 1.0 - diff * 0.06);

    // spawn
    spawnAcc += dt;
    if (spawnAcc >= spawnRate) {
      spawnAcc = 0;
      var count = 1 + Math.floor(Math.random() * Math.min(diff, 3));
      for (var i = 0; i < count; i++) spawnOne();
    }

    // update objects
    for (var i = objects.length - 1; i >= 0; i--) {
      var o = objects[i];
      if (o.hit) { objects.splice(i, 1); continue; }
      o.x += o.vx;
      o.vy += o.grav;
      o.y += o.vy;
      o.rot += o.rotV;
      if (o.y > H + 80) objects.splice(i, 1);
    }

    // update particles
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

  function render() {
    ctx.clearRect(0, 0, W, H);

    // bg
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a0a2e');
    bg.addColorStop(1, '#0f3460');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // particles
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.28);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // objects
    for (var i = 0; i < objects.length; i++) {
      var o = objects[i];
      if (o.hit) continue;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rot);

      if (o.bomb) {
        // bomb body
        ctx.beginPath();
        ctx.arc(0, 0, o.r, 0, 6.28);
        ctx.fillStyle = '#2d2d2d';
        ctx.fill();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.stroke();
        // fuse
        ctx.beginPath();
        ctx.moveTo(0, -o.r + 2);
        ctx.quadraticCurveTo(8, -o.r - 8, 4, -o.r - 14);
        ctx.strokeStyle = '#aa6600';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // spark
        ctx.beginPath();
        ctx.arc(4, -o.r - 14, 4, 0, 6.28);
        ctx.fillStyle = '#ffcc00';
        ctx.fill();
        // X mark
        ctx.strokeStyle = '#ff3333';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-10, -10); ctx.lineTo(10, 10);
        ctx.moveTo(10, -10); ctx.lineTo(-10, 10);
        ctx.stroke();
      } else {
        // fruit colored circle
        ctx.beginPath();
        ctx.arc(0, 0, o.r, 0, 6.28);
        ctx.fillStyle = o.data.fill;
        ctx.fill();
        ctx.strokeStyle = o.data.stroke;
        ctx.lineWidth = 3;
        ctx.stroke();
        // shine
        ctx.beginPath();
        ctx.arc(-o.r * 0.28, -o.r * 0.28, o.r * 0.28, 0, 6.28);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fill();
        // emoji
        ctx.font = Math.round(o.r * 1.1) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(o.data.emoji, 0, 2);
      }

      ctx.restore();
    }

    // trail
    if (trail.length > 1) {
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

  function startGame() {
    score = 0;
    combo = 0;
    maxCombo = 0;
    comboTime = 0;
    timeLeft = DURATION;
    objects = [];
    particles = [];
    trail = [];
    spawnAcc = 0;
    spawnRate = 1.0;
    running = true;
    lastFrame = performance.now();

    hud.classList.remove('hidden');
    updateHud();
    requestAnimationFrame(loop);
  }

  function endGame() {
    running = false;
    hud.classList.add('hidden');
    overScore.textContent = score;
    overCombo.textContent = maxCombo;
    screenOver.classList.remove('hidden');
    playGameOver();
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
      body: JSON.stringify({ name: playerName, score: score, combo: maxCombo })
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
    fetch('/api/leaderboard').then(function (r) { return r.json(); }).then(function (data) {
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

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ====== BUTTONS ====== */
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
    playStart();
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

  /* ====== INIT ====== */
  resize();
  window.addEventListener('resize', resize);
  render();

})();
