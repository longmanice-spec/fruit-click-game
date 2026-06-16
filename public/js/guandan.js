(function () {
  'use strict';

  // Positions: 0=me(south), 1=left(opponent A), 2=top(opponent B/partner of 1), 3=right(my partner)
  // Teams: [0,3] vs [1,2]

  var SUITS = ['♠','♥','♦','♣'];
  var RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  var RANK_VALUES = {2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13,A:14};

  var currentLevel = 2; // Current rank being played (2-A)
  var deck, hands, turn, lastPlay, lastPlayer, passCount;
  var finished; // order of finish
  var running = false;

  var handEl = document.getElementById('my-hand');
  var actionsEl = document.getElementById('actions');
  var turnInfo = document.getElementById('turn-info');
  var rankDisplay = document.getElementById('rank-display');
  var screenStart = document.getElementById('screen-start');
  var screenResult = document.getElementById('screen-result');

  function isRed(suit) { return suit === '♥' || suit === '♦'; }

  function makeCard(rank, suit) {
    return { rank: rank, suit: suit, val: RANK_VALUES[rank] || 0 };
  }

  function buildDeck() {
    var d = [];
    for (var i = 0; i < 2; i++) {
      for (var s = 0; s < 4; s++) {
        for (var r = 0; r < RANKS.length; r++) {
          d.push(makeCard(RANKS[r], SUITS[s]));
        }
      }
      d.push({ rank: 'S', suit: '🃏', val: 16 }); // Small joker
      d.push({ rank: 'B', suit: '🃏', val: 17 }); // Big joker
    }
    return d;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
  }

  function cardSortVal(c) {
    if (c.rank === 'B') return 100;
    if (c.rank === 'S') return 99;
    // Wild cards (current level rank of hearts) are high
    if (c.val === currentLevel && c.suit === '♥') return 98;
    return c.val * 10 + SUITS.indexOf(c.suit);
  }

  function sortHand(hand) {
    hand.sort(function(a, b) { return cardSortVal(a) - cardSortVal(b); });
  }

  function cardLabel(c) {
    if (c.rank === 'B') return '大王';
    if (c.rank === 'S') return '小王';
    return c.rank;
  }

  function cardSuitLabel(c) {
    if (c.rank === 'B' || c.rank === 'S') return '';
    return c.suit;
  }

  function isWild(c) {
    return (c.val === currentLevel && c.suit === '♥');
  }

  // ===== Hand type detection =====
  function getHandType(cards) {
    var n = cards.length;
    if (n === 0) return null;

    var vals = cards.map(function(c) {
      if (c.rank === 'B') return 17;
      if (c.rank === 'S') return 16;
      if (isWild(c)) return 15; // treat wilds specially
      return c.val;
    }).sort(function(a,b){return a-b;});

    // Single
    if (n === 1) return { type: 'single', rank: vals[0] };

    // Pair
    if (n === 2 && vals[0] === vals[1]) return { type: 'pair', rank: vals[0] };

    // Joker bomb (both big jokers or both small jokers? No - 4 jokers = bomb in guandan)
    // Actually in guandan: 4 same = bomb, king bomb = 2 big + 2 small jokers
    if (n === 2 && vals[0] === 16 && vals[1] === 17) return null; // not valid pair

    // Three of a kind (三条, can be played in some variants - we'll skip, use triple+pair)

    // Triple
    if (n === 3 && vals[0] === vals[1] && vals[1] === vals[2]) return { type: 'triple', rank: vals[0] };

    // Bomb (4 same)
    if (n === 4 && vals[0] === vals[1] && vals[1] === vals[2] && vals[2] === vals[3]) {
      return { type: 'bomb4', rank: vals[0], power: 100 + vals[0] };
    }

    // 5-card bomb
    if (n === 5) {
      var counts = {};
      vals.forEach(function(v){ counts[v] = (counts[v]||0) + 1; });
      var keys = Object.keys(counts);
      if (keys.length === 1) return { type: 'bomb5', rank: vals[0], power: 200 + vals[0] };
    }

    // 6-card bomb
    if (n === 6) {
      var counts = {};
      vals.forEach(function(v){ counts[v] = (counts[v]||0) + 1; });
      var keys = Object.keys(counts);
      if (keys.length === 1) return { type: 'bomb6', rank: vals[0], power: 300 + vals[0] };
    }

    // Straight (5+ consecutive singles)
    if (n >= 5) {
      var isStraight = true;
      for (var i = 1; i < n; i++) {
        if (vals[i] !== vals[0] + i) { isStraight = false; break; }
      }
      // No 2 or jokers in straight
      if (isStraight && vals[0] >= 3 && vals[n-1] <= 14) {
        return { type: 'straight', rank: vals[n-1], len: n };
      }
    }

    // Consecutive pairs (连对, 3+ pairs)
    if (n >= 6 && n % 2 === 0) {
      var isPairSeq = true;
      for (var i = 0; i < n; i += 2) {
        if (vals[i] !== vals[i+1]) { isPairSeq = false; break; }
        if (i > 0 && vals[i] !== vals[i-2] + 1) { isPairSeq = false; break; }
      }
      if (isPairSeq && vals[0] >= 3 && vals[n-1] <= 14) {
        return { type: 'pairseq', rank: vals[n-1], len: n / 2 };
      }
    }

    // Plate (三顺 - consecutive triples, 2+ sets)
    if (n >= 6 && n % 3 === 0) {
      var isTriSeq = true;
      for (var i = 0; i < n; i += 3) {
        if (vals[i] !== vals[i+1] || vals[i+1] !== vals[i+2]) { isTriSeq = false; break; }
        if (i > 0 && vals[i] !== vals[i-3] + 1) { isTriSeq = false; break; }
      }
      if (isTriSeq && vals[0] >= 3 && vals[n-1] <= 14) {
        return { type: 'triseq', rank: vals[n-1], len: n / 3 };
      }
    }

    // King bomb (大小王各两张)
    if (n === 4) {
      var jokers = vals.filter(function(v){ return v >= 16; });
      if (jokers.length === 4) return { type: 'kingbomb', power: 999 };
    }

    return null;
  }

  function canBeat(play, last) {
    if (!last) return true;
    if (!play) return false;
    // Bombs beat everything
    if (play.power && !last.power) return true;
    if (play.power && last.power) return play.power > last.power;
    if (!play.power && last.power) return false;
    // Same type comparison
    if (play.type !== last.type) return false;
    if (play.len && play.len !== last.len) return false;
    return play.rank > last.rank;
  }

  // ===== AI Logic =====
  function aiPlay(playerIdx) {
    var hand = hands[playerIdx];
    if (hand.length === 0) return null;

    // Must beat lastPlay or free play
    var needBeat = lastPlay && lastPlayer !== playerIdx && (lastPlayer + 2) % 4 !== playerIdx;
    // If partner played last, we can pass
    var partnerPlayed = lastPlayer === (playerIdx + 2) % 4;

    if (!lastPlay || partnerPlayed) {
      // Free play - play smallest single
      return [0];
    }

    // Try to find cards that beat lastPlay
    var found = findBeatingPlay(hand, lastPlay);
    if (found) return found;
    return null; // pass
  }

  function findBeatingPlay(hand, target) {
    var n = hand.length;

    if (target.type === 'single') {
      for (var i = 0; i < n; i++) {
        var t = getHandType([hand[i]]);
        if (t && canBeat(t, target)) return [i];
      }
    }

    if (target.type === 'pair') {
      for (var i = 0; i < n - 1; i++) {
        var pair = [hand[i], hand[i+1]];
        var t = getHandType(pair);
        if (t && t.type === 'pair' && canBeat(t, target)) return [i, i+1];
      }
    }

    if (target.type === 'triple') {
      for (var i = 0; i < n - 2; i++) {
        var tri = [hand[i], hand[i+1], hand[i+2]];
        var t = getHandType(tri);
        if (t && t.type === 'triple' && canBeat(t, target)) return [i, i+1, i+2];
      }
    }

    if (target.type === 'straight') {
      var len = target.len;
      for (var i = 0; i <= n - len; i++) {
        var cards = hand.slice(i, i + len);
        var t = getHandType(cards);
        if (t && t.type === 'straight' && canBeat(t, target)) {
          var indices = [];
          for (var j = i; j < i + len; j++) indices.push(j);
          return indices;
        }
      }
    }

    // Try bomb
    for (var i = 0; i < n - 3; i++) {
      var bomb = hand.slice(i, i + 4);
      var t = getHandType(bomb);
      if (t && t.power && canBeat(t, target)) return [i, i+1, i+2, i+3];
    }

    return null;
  }

  // ===== Rendering =====
  function renderHand() {
    handEl.innerHTML = '';
    var hand = hands[0];
    for (var i = 0; i < hand.length; i++) {
      var c = hand[i];
      var div = document.createElement('div');
      div.className = 'hand-card' + (isRed(c.suit) ? ' red' : ' black');
      if (isWild(c)) div.classList.add('wild');
      div.dataset.idx = i;
      div.innerHTML = '<span>' + cardSuitLabel(c) + '</span><span>' + cardLabel(c) + '</span>';
      div.addEventListener('click', onCardClick);
      handEl.appendChild(div);
    }
  }

  var selectedIndices = [];

  function onCardClick(e) {
    if (turn !== 0 || !running) return;
    var idx = parseInt(e.currentTarget.dataset.idx);
    var pos = selectedIndices.indexOf(idx);
    if (pos >= 0) {
      selectedIndices.splice(pos, 1);
    } else {
      selectedIndices.push(idx);
    }
    updateSelection();
  }

  function updateSelection() {
    var cards = handEl.children;
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.toggle('selected', selectedIndices.indexOf(i) >= 0);
    }
  }

  function renderPlayed(playerIdx, cards) {
    var elId = ['', 'left-played', 'top-played', 'right-played'][playerIdx];
    if (playerIdx === 0) return; // we see our own in center
    var el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = '';
    if (!cards) return;
    cards.forEach(function(c) {
      var div = document.createElement('div');
      div.className = 'played-card' + (isRed(c.suit) ? ' red' : ' black');
      div.innerHTML = '<span style="font-size:8px">' + cardSuitLabel(c) + '</span><span>' + cardLabel(c) + '</span>';
      el.appendChild(div);
    });
  }

  function updateCounts() {
    document.getElementById('left-count').textContent = hands[1].length + '张';
    document.getElementById('top-count').textContent = hands[2].length + '张';
    document.getElementById('right-count').textContent = hands[3].length + '张';
  }

  // ===== Game Flow =====
  function startGame() {
    deck = buildDeck();
    shuffle(deck);
    hands = [[], [], [], []];
    for (var i = 0; i < deck.length; i++) {
      hands[i % 4].push(deck[i]);
    }
    hands.forEach(sortHand);

    turn = 0;
    lastPlay = null;
    lastPlayer = -1;
    passCount = 0;
    finished = [];
    running = true;
    selectedIndices = [];

    rankDisplay.textContent = RANKS[currentLevel - 2] || '2';
    renderHand();
    updateCounts();
    clearAllPlayed();
    actionsEl.classList.remove('hidden');
    turnInfo.textContent = '你的回合';
    doTurn();
  }

  function clearAllPlayed() {
    renderPlayed(1, null);
    renderPlayed(2, null);
    renderPlayed(3, null);
  }

  function doTurn() {
    if (!running) return;
    if (hands[turn].length === 0) {
      nextFinish(turn);
      return;
    }

    if (turn === 0) {
      turnInfo.textContent = '你的回合';
      actionsEl.classList.remove('hidden');
      selectedIndices = [];
      updateSelection();
    } else {
      turnInfo.textContent = ['', '对手A思考中...', '对手B思考中...', '队友思考中...'][turn];
      actionsEl.classList.add('hidden');
      setTimeout(function() { aiDoTurn(); }, 800);
    }
  }

  function aiDoTurn() {
    var indices = aiPlay(turn);
    if (indices) {
      var cards = indices.map(function(i) { return hands[turn][i]; });
      var ht = getHandType(cards);
      // Remove cards
      indices.sort(function(a,b){return b-a;});
      indices.forEach(function(i) { hands[turn].splice(i, 1); });
      lastPlay = ht;
      lastPlayer = turn;
      passCount = 0;
      renderPlayed(turn, cards);
      turnInfo.textContent = ['', '对手A', '对手B', '队友'][turn] + '出了 ' + cards.map(cardLabel).join(' ');
    } else {
      turnInfo.textContent = ['', '对手A', '对手B', '队友'][turn] + ' 不要';
      passCount++;
      renderPlayed(turn, null);
    }

    updateCounts();
    if (hands[turn].length === 0) {
      nextFinish(turn);
    }
    advanceTurn();
  }

  function nextFinish(p) {
    if (finished.indexOf(p) < 0) finished.push(p);
    checkEnd();
  }

  function advanceTurn() {
    // If 3 consecutive passes, reset
    if (passCount >= 3) {
      lastPlay = null;
      lastPlayer = -1;
      passCount = 0;
      clearAllPlayed();
    }

    var next = (turn + 1) % 4;
    // Skip finished players
    var tries = 0;
    while (hands[next].length === 0 && tries < 4) { next = (next + 1) % 4; tries++; }
    turn = next;

    if (!checkEnd()) {
      setTimeout(doTurn, 300);
    }
  }

  function checkEnd() {
    // Game ends when one team finishes both players
    var team1Done = hands[0].length === 0 && hands[3].length === 0;
    var team2Done = hands[1].length === 0 && hands[2].length === 0;
    if (team1Done || team2Done) {
      running = false;
      actionsEl.classList.add('hidden');
      var title = document.getElementById('result-title');
      var desc = document.getElementById('result-desc');
      if (team1Done) {
        title.textContent = '🎉 胜利！';
        desc.textContent = '你和队友先出完了所有牌！';
      } else {
        title.textContent = '😢 失败';
        desc.textContent = '对手先出完了所有牌，下次加油！';
      }
      screenResult.classList.remove('hidden');
      return true;
    }
    // If 3 players finished
    if (finished.length >= 3) {
      running = false;
      actionsEl.classList.add('hidden');
      var weWon = finished[0] === 0 || finished[0] === 3;
      var title = document.getElementById('result-title');
      var desc = document.getElementById('result-desc');
      title.textContent = weWon ? '🎉 胜利！' : '😢 失败';
      desc.textContent = weWon ? '你的队伍获得了头游！' : '对手获得了头游，再接再厉！';
      screenResult.classList.remove('hidden');
      return true;
    }
    return false;
  }

  // ===== Player Actions =====
  document.getElementById('btn-play').onclick = function() {
    if (turn !== 0 || !running) return;
    if (selectedIndices.length === 0) return;

    var cards = selectedIndices.map(function(i) { return hands[0][i]; });
    var ht = getHandType(cards);
    if (!ht) { turnInfo.textContent = '无效牌型！'; return; }

    if (lastPlay && lastPlayer !== 0 && lastPlayer !== 2) {
      if (!canBeat(ht, lastPlay)) { turnInfo.textContent = '压不过！'; return; }
    }

    // Play cards
    selectedIndices.sort(function(a,b){return b-a;});
    selectedIndices.forEach(function(i) { hands[0].splice(i, 1); });
    selectedIndices = [];
    lastPlay = ht;
    lastPlayer = 0;
    passCount = 0;

    turnInfo.textContent = '你出了 ' + cards.map(cardLabel).join(' ');
    renderHand();
    updateCounts();
    clearAllPlayed();

    if (hands[0].length === 0) nextFinish(0);
    advanceTurn();
  };

  document.getElementById('btn-pass').onclick = function() {
    if (turn !== 0 || !running) return;
    // Can't pass if you're the lead player
    if (!lastPlay || lastPlayer === 0 || lastPlayer === 2) {
      turnInfo.textContent = '你必须出牌！';
      return;
    }
    selectedIndices = [];
    updateSelection();
    passCount++;
    turnInfo.textContent = '你选择不要';
    advanceTurn();
  };

  document.getElementById('btn-hint').onclick = function() {
    if (turn !== 0 || !running) return;
    var indices = findBeatingPlay(hands[0], lastPlay || { type: 'single', rank: 0 });
    if (indices) {
      selectedIndices = indices;
      updateSelection();
    } else {
      turnInfo.textContent = '没有能出的牌';
    }
  };

  // ===== Buttons =====
  document.getElementById('btn-start').onclick = function() {
    screenStart.classList.add('hidden');
    startGame();
  };
  document.getElementById('btn-again').onclick = function() {
    screenResult.classList.add('hidden');
    startGame();
  };

  // ===== Prevent swipe-back =====
  function isInteractive(el) {
    if (!el) return false;
    var tag = el.tagName;
    if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'A') return true;
    if (el.closest && el.closest('button, a, .btn, .act-btn, .hand-card, .rank-list')) return true;
    return false;
  }
  document.addEventListener('touchstart', function(e){ if(!isInteractive(e.target)) e.preventDefault(); }, {passive:false});
  document.addEventListener('touchmove', function(e){ e.preventDefault(); }, {passive:false});
  window.history.pushState(null,'',location.href);
  window.history.pushState(null,'',location.href);
  window.addEventListener('popstate', function(){ window.history.pushState(null,'',location.href); });

})();
