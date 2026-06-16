(function(){
  'use strict';

  var SIZE = 4;
  var grid, score, best, moved, playerName = '';
  var boardEl = document.getElementById('board');
  var hudScore = document.getElementById('hud-score');
  var hudBest = document.getElementById('hud-best');
  var screenStart = document.getElementById('screen-start');
  var screenOver = document.getElementById('screen-over');
  var screenRank = document.getElementById('screen-rank');
  var inputName = document.getElementById('input-name');
  var overScore = document.getElementById('over-score');
  var overStatus = document.getElementById('over-status');
  var rankList = document.getElementById('rank-list');

  var TILE_COLORS = {
    0:'rgba(238,228,218,0.35)',2:'#eee4da',4:'#ede0c8',8:'#f2b179',
    16:'#f59563',32:'#f67c5f',64:'#f65e3b',128:'#edcf72',
    256:'#edcc61',512:'#edc850',1024:'#edc53f',2048:'#edc22e'
  };
  var TILE_TEXT = {
    0:'',2:'#776e65',4:'#776e65',8:'#f9f6f2',16:'#f9f6f2',
    32:'#f9f6f2',64:'#f9f6f2',128:'#f9f6f2',256:'#f9f6f2',
    512:'#f9f6f2',1024:'#f9f6f2',2048:'#f9f6f2'
  };

  function init(){
    grid=[];
    for(var r=0;r<SIZE;r++){grid[r]=[];for(var c=0;c<SIZE;c++)grid[r][c]=0;}
    score=0;
    best=parseInt(localStorage.getItem('2048-best'))||0;
    addRandom();addRandom();
    render();updateHud();
  }

  function addRandom(){
    var empty=[];
    for(var r=0;r<SIZE;r++)for(var c=0;c<SIZE;c++)if(grid[r][c]===0)empty.push({r:r,c:c});
    if(empty.length===0)return;
    var cell=empty[Math.floor(Math.random()*empty.length)];
    grid[cell.r][cell.c]=Math.random()<0.9?2:4;
  }

  function render(){
    boardEl.innerHTML='';
    for(var r=0;r<SIZE;r++){
      for(var c=0;c<SIZE;c++){
        var v=grid[r][c];
        var div=document.createElement('div');
        div.className='tile';
        var bg=TILE_COLORS[v]||'#3c3a32';
        var fg=TILE_TEXT[v]||'#f9f6f2';
        var fs=v>=1024?'24px':v>=128?'28px':'34px';
        div.style.cssText='background:'+bg+';color:'+fg+';font-size:'+fs;
        div.textContent=v||'';
        boardEl.appendChild(div);
      }
    }
  }

  function updateHud(){
    hudScore.textContent=score;
    if(score>best){best=score;try{localStorage.setItem('2048-best',best);}catch(e){}}
    hudBest.textContent=best;
  }

  function slide(row){
    var arr=row.filter(function(v){return v!==0;});
    var res=[];
    for(var i=0;i<arr.length;i++){
      if(i<arr.length-1&&arr[i]===arr[i+1]){
        var merged=arr[i]*2;
        res.push(merged);
        score+=merged;
        i++;
      }else{
        res.push(arr[i]);
      }
    }
    while(res.length<SIZE)res.push(0);
    return res;
  }

  function move(dir){
    moved=false;
    var newGrid=[];
    for(var r=0;r<SIZE;r++){newGrid[r]=grid[r].slice();}

    if(dir==='left'){
      for(var r=0;r<SIZE;r++){
        var row=slide(grid[r]);
        if(row.join(',')!==grid[r].join(','))moved=true;
        newGrid[r]=row;
      }
    }else if(dir==='right'){
      for(var r=0;r<SIZE;r++){
        var row=slide(grid[r].slice().reverse()).reverse();
        if(row.join(',')!==grid[r].join(','))moved=true;
        newGrid[r]=row;
      }
    }else if(dir==='up'){
      for(var c=0;c<SIZE;c++){
        var col=[];for(var r=0;r<SIZE;r++)col.push(grid[r][c]);
        var res=slide(col);
        for(var r=0;r<SIZE;r++){if(newGrid[r][c]!==res[r])moved=true;newGrid[r][c]=res[r];}
      }
    }else if(dir==='down'){
      for(var c=0;c<SIZE;c++){
        var col=[];for(var r=0;r<SIZE;r++)col.push(grid[r][c]);
        var res=slide(col.reverse()).reverse();
        for(var r=0;r<SIZE;r++){if(newGrid[r][c]!==res[r])moved=true;newGrid[r][c]=res[r];}
      }
    }

    if(moved){
      grid=newGrid;
      addRandom();
      render();
      updateHud();
      playTick();
      if(isGameOver())endGame();
    }
  }

  function isGameOver(){
    for(var r=0;r<SIZE;r++)for(var c=0;c<SIZE;c++){
      if(grid[r][c]===0)return false;
      if(c<SIZE-1&&grid[r][c]===grid[r][c+1])return false;
      if(r<SIZE-1&&grid[r][c]===grid[r+1][c])return false;
    }
    return true;
  }

  // Sound
  var audioCtx=null;
  function ensureAudio(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();}
  function playTick(){try{ensureAudio();var o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.frequency.value=440+score%200;o.type='sine';g.gain.setValueAtTime(0.06,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.08);o.start();o.stop(audioCtx.currentTime+0.08);}catch(e){}}

  // Swipe detection
  var sx,sy;
  document.addEventListener('touchstart',function(e){
    if(e.target.closest('button,input,a,.btn,.rank-list'))return;
    e.preventDefault();
    sx=e.touches[0].clientX;sy=e.touches[0].clientY;
  },{passive:false});
  document.addEventListener('touchmove',function(e){e.preventDefault();},{passive:false});
  document.addEventListener('touchend',function(e){
    if(!sx&&sx!==0)return;
    var dx=e.changedTouches[0].clientX-sx;
    var dy=e.changedTouches[0].clientY-sy;
    sx=sy=null;
    if(Math.abs(dx)<20&&Math.abs(dy)<20)return;
    if(Math.abs(dx)>Math.abs(dy)){move(dx>0?'right':'left');}
    else{move(dy>0?'down':'up');}
  },{passive:false});
  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowLeft')move('left');
    else if(e.key==='ArrowRight')move('right');
    else if(e.key==='ArrowUp')move('up');
    else if(e.key==='ArrowDown')move('down');
  });

  function startGame(){
    init();
    document.getElementById('hud').classList.remove('hidden');
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
      body:JSON.stringify({name:playerName,score:score,combo:0,game:'2048'})
    }).then(function(r){overStatus.textContent=r.ok?'✓ 已提交':'提交失败';}).catch(function(){overStatus.textContent='网络错误';});
  }

  function showRank(){
    screenStart.classList.add('hidden');screenOver.classList.add('hidden');screenRank.classList.remove('hidden');
    rankList.innerHTML='<p class="muted">加载中...</p>';
    fetch('/api/leaderboard?game=2048').then(function(r){return r.json();}).then(function(data){
      if(!data.scores||data.scores.length===0){rankList.innerHTML='<p class="muted">暂无记录</p>';return;}
      rankList.innerHTML=data.scores.map(function(e,i){
        var cls=i===0?'r1':i===1?'r2':i===2?'r3':'';
        var icon=['🥇','🥈','🥉'][i]||(i+1);
        return '<div class="rank-row"><span class="rank-pos '+cls+'">'+icon+'</span><span class="rank-name">'+esc(e.name)+'</span><span class="rank-score">'+e.score+'</span></div>';
      }).join('');
    }).catch(function(){rankList.innerHTML='<p class="muted">加载失败</p>';});
  }
  function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}

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
  window.history.pushState(null,'',location.href);
  window.history.pushState(null,'',location.href);
  window.addEventListener('popstate',function(){window.history.pushState(null,'',location.href);});
})();
