(function(){
  'use strict';

  var canvas=document.getElementById('game-canvas');
  var ctx=canvas.getContext('2d');
  var W,H,dpr;
  var screenStart=document.getElementById('screen-start');
  var screenOver=document.getElementById('screen-over');
  var screenRank=document.getElementById('screen-rank');
  var inputName=document.getElementById('input-name');
  var overScore=document.getElementById('over-score');
  var overStatus=document.getElementById('over-status');
  var rankList=document.getElementById('rank-list');

  var bird,pipes,score,running,gameOver,frame;
  var gravity=0.35,jump=-7,pipeSpeed=2.2,pipeGap=180,pipeWidth=52;
  var playerName='';

  // Sound
  var audioCtx=null;
  function ensureAudio(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();}
  function playFlap(){try{ensureAudio();var o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.frequency.value=600;o.type='sine';g.gain.setValueAtTime(0.1,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.1);o.start();o.stop(audioCtx.currentTime+0.1);}catch(e){}}
  function playScore(){try{ensureAudio();var o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.frequency.value=880;o.type='sine';g.gain.setValueAtTime(0.08,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.15);o.start();o.stop(audioCtx.currentTime+0.15);}catch(e){}}
  function playHit(){try{ensureAudio();var o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.frequency.value=120;o.type='sawtooth';g.gain.setValueAtTime(0.15,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.3);o.start();o.stop(audioCtx.currentTime+0.3);}catch(e){}}

  function resize(){
    dpr=Math.min(window.devicePixelRatio||1,2);
    W=window.innerWidth;H=window.innerHeight;
    canvas.width=W*dpr;canvas.height=H*dpr;
    canvas.style.width=W+'px';canvas.style.height=H+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();window.addEventListener('resize',resize);

  function init(){
    bird={x:W*0.25,y:H*0.4,vy:0,r:18};
    pipes=[];score=0;running=true;gameOver=false;frame=0;
    pipeGap=Math.max(160,H*0.26);
  }

  function flap(){
    if(!running)return;
    bird.vy=jump;
    playFlap();
  }

  function spawnPipe(){
    var minY=80;var maxY=H-pipeGap-80;
    var topH=minY+Math.random()*(maxY-minY);
    pipes.push({x:W,topH:topH,scored:false});
  }

  function update(){
    frame++;
    bird.vy+=gravity;
    bird.y+=bird.vy;

    // Spawn pipes
    if(frame%110===0)spawnPipe();

    // Move pipes
    for(var i=pipes.length-1;i>=0;i--){
      pipes[i].x-=pipeSpeed;
      // Score
      if(!pipes[i].scored&&pipes[i].x+pipeWidth<bird.x){
        pipes[i].scored=true;
        score++;
        playScore();
        // Speed up slightly
        if(score%8===0)pipeSpeed+=0.2;
      }
      if(pipes[i].x<-pipeWidth)pipes.splice(i,1);
    }

    // Collision
    if(bird.y+bird.r>H-60||bird.y-bird.r<0){die();return;}
    for(var i=0;i<pipes.length;i++){
      var p=pipes[i];
      if(bird.x+bird.r>p.x&&bird.x-bird.r<p.x+pipeWidth){
        if(bird.y-bird.r<p.topH||bird.y+bird.r>p.topH+pipeGap){die();return;}
      }
    }
  }

  function die(){
    running=false;gameOver=true;
    playHit();
    setTimeout(endGame,500);
  }

  function render(){
    // Sky
    var sky=ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#4ec0ca');sky.addColorStop(1,'#71c9ce');
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);

    // Ground
    ctx.fillStyle='#ded895';ctx.fillRect(0,H-60,W,60);
    ctx.fillStyle='#6b8e23';ctx.fillRect(0,H-60,W,8);

    // Pipes
    ctx.fillStyle='#6bbd5b';
    for(var i=0;i<pipes.length;i++){
      var p=pipes[i];
      // Top pipe
      ctx.fillRect(p.x,0,pipeWidth,p.topH);
      ctx.fillRect(p.x-4,p.topH-20,pipeWidth+8,20);
      // Bottom pipe
      var botY=p.topH+pipeGap;
      ctx.fillRect(p.x,botY,pipeWidth,H-60-botY);
      ctx.fillRect(p.x-4,botY,pipeWidth+8,20);
    }
    // Pipe borders
    ctx.strokeStyle='#3a7d32';ctx.lineWidth=2;
    for(var i=0;i<pipes.length;i++){
      var p=pipes[i];
      ctx.strokeRect(p.x,0,pipeWidth,p.topH);
      ctx.strokeRect(p.x,p.topH+pipeGap,pipeWidth,H-60-p.topH-pipeGap);
    }

    // Bird
    ctx.save();
    ctx.translate(bird.x,bird.y);
    var angle=Math.min(bird.vy*0.05,0.5);
    ctx.rotate(angle);
    // Body
    ctx.fillStyle='#f5c842';
    ctx.beginPath();ctx.ellipse(0,0,bird.r,bird.r*0.8,0,0,6.28);ctx.fill();
    ctx.strokeStyle='#e6a800';ctx.lineWidth=2;ctx.stroke();
    // Eye
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(8,-4,6,0,6.28);ctx.fill();
    ctx.fillStyle='#222';ctx.beginPath();ctx.arc(10,-4,3,0,6.28);ctx.fill();
    // Beak
    ctx.fillStyle='#e8590c';ctx.beginPath();ctx.moveTo(14,2);ctx.lineTo(22,-1);ctx.lineTo(14,5);ctx.fill();
    // Wing
    ctx.fillStyle='#f0a500';ctx.beginPath();ctx.ellipse(-5,4,8,5,0.3,0,6.28);ctx.fill();
    ctx.restore();

    // Score display
    ctx.fillStyle='#fff';ctx.font='bold 36px sans-serif';ctx.textAlign='center';
    ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=3;
    ctx.strokeText(score,W/2,60);ctx.fillText(score,W/2,60);
  }

  function loop(){
    if(!running&&!gameOver){render();return;}
    if(running){update();render();requestAnimationFrame(loop);}
    else{render();}
  }

  function startGame(){
    init();resize();
    requestAnimationFrame(loop);
  }

  function endGame(){
    overScore.textContent=score;
    screenOver.classList.remove('hidden');
    submitScore();
  }

  function submitScore(){
    if(!playerName||score<=0){overStatus.textContent=playerName?'':'未输入昵称';return;}
    overStatus.textContent='提交中...';
    fetch('/api/leaderboard',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:playerName,score:score,combo:0,game:'flappy'})
    }).then(function(r){overStatus.textContent=r.ok?'✓ 已提交':'提交失败';}).catch(function(){overStatus.textContent='网络错误';});
  }

  function showRank(){
    screenStart.classList.add('hidden');screenOver.classList.add('hidden');screenRank.classList.remove('hidden');
    rankList.innerHTML='<p class="muted">加载中...</p>';
    fetch('/api/leaderboard?game=flappy').then(function(r){return r.json();}).then(function(data){
      if(!data.scores||data.scores.length===0){rankList.innerHTML='<p class="muted">暂无记录</p>';return;}
      rankList.innerHTML=data.scores.map(function(e,i){
        var cls=i===0?'r1':i===1?'r2':i===2?'r3':'';
        var icon=['🥇','🥈','🥉'][i]||(i+1);
        return '<div class="rank-row"><span class="rank-pos '+cls+'">'+icon+'</span><span class="rank-name">'+esc(e.name)+'</span><span class="rank-score">'+e.score+'</span></div>';
      }).join('');
    }).catch(function(){rankList.innerHTML='<p class="muted">加载失败</p>';});
  }
  function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}

  // Input
  function onTap(e){
    if(e.target.closest('button,input,a,.btn,.rank-list'))return;
    e.preventDefault();
    flap();
  }
  canvas.addEventListener('touchstart',onTap,{passive:false});
  canvas.addEventListener('mousedown',onTap);
  document.addEventListener('keydown',function(e){if(e.key===' '||e.key==='ArrowUp')flap();});

  document.getElementById('btn-start').onclick=function(){
    var name=inputName.value.trim();
    if(!name){inputName.classList.add('shake');inputName.focus();setTimeout(function(){inputName.classList.remove('shake');},400);return;}
    playerName=name;screenStart.classList.add('hidden');startGame();
  };
  document.getElementById('btn-restart').onclick=function(){screenOver.classList.add('hidden');startGame();};
  document.getElementById('btn-rank').onclick=showRank;
  document.getElementById('btn-rank2').onclick=showRank;
  document.getElementById('btn-back').onclick=function(){screenRank.classList.add('hidden');screenStart.classList.remove('hidden');};

  // Prevent swipe-back
  document.addEventListener('touchmove',function(e){if(!e.target.closest('.rank-list'))e.preventDefault();},{passive:false});
  window.history.pushState(null,'',location.href);
  window.history.pushState(null,'',location.href);
  window.addEventListener('popstate',function(){window.history.pushState(null,'',location.href);});
})();
