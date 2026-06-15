const FRUITS = [
  { emoji: '🍎', points: 1, color: '#ff3b30' },
  { emoji: '🍊', points: 1, color: '#ff9500' },
  { emoji: '🍋', points: 1, color: '#ffcc00' },
  { emoji: '🍇', points: 2, color: '#af52de' },
  { emoji: '🍉', points: 2, color: '#34c759' },
  { emoji: '🍑', points: 2, color: '#ff6b6b' },
  { emoji: '🍍', points: 3, color: '#ffcc00' },
  { emoji: '🥝', points: 3, color: '#30d158' },
  { emoji: '🍒', points: 3, color: '#ff2d55' },
];

const BOMB = { emoji: '💣', color: '#333' };

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();

    this.state = 'idle';
    this.score = 0;
    this.lives = 3;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.objects = [];
    this.sliceTrail = [];
    this.particles = [];
    this.splashes = [];
    this.spawnTimer = 0;
    this.spawnInterval = 1200;
    this.difficulty = 1;
    this.elapsed = 0;

    this.mouseDown = false;
    this.mousePos = { x: 0, y: 0 };
    this.prevMousePos = { x: 0, y: 0 };

    this._bindEvents();
    this._loop = this._loop.bind(this);
    this._lastTime = 0;

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.width = this.canvas.width;
    this.height = this.canvas.height;
  }

  start() {
    this.state = 'playing';
    this.score = 0;
    this.lives = 3;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.objects = [];
    this.sliceTrail = [];
    this.particles = [];
    this.splashes = [];
    this.spawnTimer = 0;
    this.spawnInterval = 1200;
    this.difficulty = 1;
    this.elapsed = 0;
    this._lastTime = performance.now();
    this._loop(this._lastTime);
  }

  stop() {
    this.state = 'over';
  }

  _bindEvents() {
    const getPos = (e) => {
      const touch = e.touches ? e.touches[0] : e;
      return { x: touch.clientX, y: touch.clientY };
    };

    const onStart = (e) => {
      e.preventDefault();
      this.mouseDown = true;
      this.mousePos = getPos(e);
      this.prevMousePos = { ...this.mousePos };
      this.sliceTrail = [{ ...this.mousePos, time: performance.now() }];
    };

    const onMove = (e) => {
      e.preventDefault();
      if (!this.mouseDown) return;
      this.prevMousePos = { ...this.mousePos };
      this.mousePos = getPos(e);
      this.sliceTrail.push({ ...this.mousePos, time: performance.now() });
      if (this.sliceTrail.length > 20) this.sliceTrail.shift();
      if (this.state === 'playing') this._checkSlice();
    };

    const onEnd = (e) => {
      e.preventDefault();
      this.mouseDown = false;
      this.sliceTrail = [];
    };

    this.canvas.addEventListener('mousedown', onStart);
    this.canvas.addEventListener('mousemove', onMove);
    this.canvas.addEventListener('mouseup', onEnd);
    this.canvas.addEventListener('mouseleave', onEnd);
    this.canvas.addEventListener('touchstart', onStart, { passive: false });
    this.canvas.addEventListener('touchmove', onMove, { passive: false });
    this.canvas.addEventListener('touchend', onEnd, { passive: false });
  }

  _checkSlice() {
    const mx = this.mousePos.x;
    const my = this.mousePos.y;
    const px = this.prevMousePos.x;
    const py = this.prevMousePos.y;
    const speed = Math.hypot(mx - px, my - py);
    if (speed < 5) return;

    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      if (obj.sliced) continue;
      const dist = Math.hypot(mx - obj.x, my - obj.y);
      if (dist < obj.radius + 10) {
        obj.sliced = true;
        if (obj.isBomb) {
          this._hitBomb(obj);
        } else {
          this._sliceFruit(obj);
        }
      }
    }
  }

  _sliceFruit(obj) {
    this.score += obj.data.points * (1 + Math.floor(this.combo / 3));
    this.combo++;
    this.comboTimer = 800;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this._spawnParticles(obj.x, obj.y, obj.data.color, 8);
    this._spawnSplash(obj.x, obj.y, obj.data.color);

    if (typeof this.onScoreUpdate === 'function') {
      this.onScoreUpdate(this.score, this.combo);
    }
  }

  _hitBomb(obj) {
    this.lives--;
    this.combo = 0;
    this._spawnParticles(obj.x, obj.y, '#ff0000', 12);
    this.canvas.style.animation = 'none';
    this.canvas.offsetHeight;
    this.canvas.style.animation = '';

    if (typeof this.onLifeLost === 'function') {
      this.onLifeLost(this.lives);
    }

    if (this.lives <= 0) {
      this.stop();
      if (typeof this.onGameOver === 'function') {
        this.onGameOver(this.score, this.maxCombo);
      }
    }
  }

  _spawnObject() {
    const isBomb = Math.random() < 0.15 + this.difficulty * 0.02;
    const margin = 80;
    const x = margin + Math.random() * (this.width - margin * 2);
    const speedY = -(this.height * 0.012 + Math.random() * this.height * 0.006) * (1 + this.difficulty * 0.05);
    const speedX = (Math.random() - 0.5) * 4;

    const obj = {
      x,
      y: this.height + 60,
      vx: speedX,
      vy: speedY,
      gravity: 0.35 + this.difficulty * 0.01,
      radius: 30 + Math.random() * 10,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.1,
      sliced: false,
      isBomb,
      data: isBomb ? BOMB : FRUITS[Math.floor(Math.random() * FRUITS.length)],
    };
    this.objects.push(obj);
  }

  _spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        radius: 3 + Math.random() * 5,
        color,
        life: 1,
        decay: 0.02 + Math.random() * 0.02,
      });
    }
  }

  _spawnSplash(x, y, color) {
    this.splashes.push({ x, y, radius: 5, color, life: 1 });
  }

  _loop(time) {
    if (this.state !== 'playing') return;
    requestAnimationFrame(this._loop);

    const dt = Math.min(time - this._lastTime, 50);
    this._lastTime = time;
    this.elapsed += dt;

    this.difficulty = 1 + Math.floor(this.elapsed / 15000);
    this.spawnInterval = Math.max(400, 1200 - this.difficulty * 80);

    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      const count = 1 + Math.floor(Math.random() * Math.min(this.difficulty, 4));
      for (let i = 0; i < count; i++) {
        setTimeout(() => this._spawnObject(), i * 100);
      }
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        if (typeof this.onScoreUpdate === 'function') {
          this.onScoreUpdate(this.score, 0);
        }
      }
    }

    for (const obj of this.objects) {
      if (obj.sliced) continue;
      obj.x += obj.vx;
      obj.y += obj.vy;
      obj.vy += obj.gravity;
      obj.rotation += obj.rotSpeed;
    }

    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      if (obj.y > this.height + 100) {
        if (!obj.sliced && !obj.isBomb) {
          this.lives--;
          if (typeof this.onLifeLost === 'function') {
            this.onLifeLost(this.lives);
          }
          if (this.lives <= 0) {
            this.stop();
            if (typeof this.onGameOver === 'function') {
              this.onGameOver(this.score, this.maxCombo);
            }
            return;
          }
        }
        this.objects.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.life -= p.decay;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i];
      s.radius += 3;
      s.life -= 0.04;
      if (s.life <= 0) this.splashes.splice(i, 1);
    }

    this._render();
  }

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    this._drawBackground();
    this._drawSplashes();
    this._drawObjects();
    this._drawParticles();
    this._drawSliceTrail();
  }

  _drawBackground() {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, '#1a0a2e');
    grad.addColorStop(0.5, '#16213e');
    grad.addColorStop(1, '#0f3460');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  _drawObjects() {
    const ctx = this.ctx;
    for (const obj of this.objects) {
      if (obj.sliced) continue;
      ctx.save();
      ctx.translate(obj.x, obj.y);
      ctx.rotate(obj.rotation);
      ctx.font = `${obj.radius * 1.5}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.shadowColor = obj.isBomb ? 'rgba(255,0,0,0.5)' : 'rgba(255,255,255,0.3)';
      ctx.shadowBlur = 15;
      ctx.fillText(obj.data.emoji, 0, 0);
      ctx.restore();
    }
  }

  _drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawSplashes() {
    const ctx = this.ctx;
    for (const s of this.splashes) {
      ctx.globalAlpha = s.life * 0.3;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawSliceTrail() {
    if (this.sliceTrail.length < 2) return;
    const ctx = this.ctx;
    const now = performance.now();

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 1; i < this.sliceTrail.length; i++) {
      const p0 = this.sliceTrail[i - 1];
      const p1 = this.sliceTrail[i];
      const age = now - p1.time;
      const alpha = Math.max(0, 1 - age / 200);

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3 * alpha + 1;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
}
