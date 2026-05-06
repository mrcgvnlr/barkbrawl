/* ============================================================
   BARK BATTLE — game.js
   Voice-controlled dog fighting game
   ============================================================ */

'use strict';

/* ============================================================
   DOG DATA
   ============================================================ */
const DOGS = {
  small: [
    {
      id: 'chihuahua',
      name: 'Chihuahua',
      emoji: '🐕',
      tagline: 'Tiny but fierce!',
      speedLabel: 'Low',
      hpLabel: 'Low',
    },
    {
      id: 'pomeranian',
      name: 'Pomeranian',
      emoji: '🦊',
      tagline: 'Fluffy & feisty!',
      speedLabel: 'Low',
      hpLabel: 'Low',
    },
    {
      id: 'dachshund',
      name: 'Dachshund',
      emoji: '🌭',
      tagline: 'Long & loud!',
      speedLabel: 'Low',
      hpLabel: 'Low',
    },
    {
      id: 'frenchbulldog',
      name: 'French Bulldog',
      emoji: '🐶',
      tagline: 'Stubborn power!',
      speedLabel: 'Med',
      hpLabel: 'Med',
    },
  ],
  big: [
    {
      id: 'germanshepherd',
      name: 'German Shepherd',
      emoji: '🐕‍🦺',
      tagline: 'Strong & commanding!',
      powerLabel: 'High',
      hpLabel: 'High',
    },
    {
      id: 'husky',
      name: 'Husky',
      emoji: '🐺',
      tagline: 'Howl master!',
      powerLabel: 'Med',
      hpLabel: 'Med',
    },
    {
      id: 'rottweiler',
      name: 'Rottweiler',
      emoji: '🐾',
      tagline: 'Deep & powerful!',
      powerLabel: 'High',
      hpLabel: 'High',
    },
    {
      id: 'goldenretriever',
      name: 'Golden Retriever',
      emoji: '🦮',
      tagline: 'Friendly & loud!',
      powerLabel: 'Med',
      hpLabel: 'Med',
    },
  ],
};

/* ============================================================
   DIFFICULTY CONFIG
   ============================================================ */
const DIFFICULTIES = [
  {
    id: 'easy',
    name: 'Easy',
    icon: '🐾',
    desc: 'Puppy mode — CPU barks rarely',
    cpuRate: 3800,
    cpuPowerMult: 0.45,
  },
  {
    id: 'medium',
    name: 'Medium',
    icon: '🐕',
    desc: 'Balanced — a real challenge',
    cpuRate: 2000,
    cpuPowerMult: 1.0,
  },
  {
    id: 'hard',
    name: 'Hard',
    icon: '🔥',
    desc: 'Beast mode — non-stop barking',
    cpuRate: 900,
    cpuPowerMult: 1.6,
  },
];

/* ============================================================
   AUDIO SYNTHESIS
   Generates a unique bark sound for each dog breed using
   the Web Audio API — no external files needed.
   ============================================================ */
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Bark sound configs per breed.
 * freq      – fundamental pitch (Hz)
 * type      – oscillator waveform
 * duration  – single bark length (seconds)
 * reps      – number of barks in burst
 * repGap    – silence between barks (seconds)
 * gain      – master volume (0–1)
 * pitchDrop – end-freq multiplier (adds growl/yap character)
 */
const BARK_CONFIGS = {
  chihuahua:       { freq: 1250, type: 'sawtooth', duration: 0.10, reps: 3, repGap: 0.07, gain: 0.32, pitchDrop: 0.55 },
  pomeranian:      { freq: 1050, type: 'sawtooth', duration: 0.13, reps: 2, repGap: 0.09, gain: 0.33, pitchDrop: 0.60 },
  dachshund:       { freq:  720, type: 'square',   duration: 0.18, reps: 2, repGap: 0.12, gain: 0.38, pitchDrop: 0.65 },
  frenchbulldog:   { freq:  510, type: 'square',   duration: 0.20, reps: 2, repGap: 0.14, gain: 0.42, pitchDrop: 0.70 },
  germanshepherd:  { freq:  275, type: 'sawtooth', duration: 0.30, reps: 1, repGap: 0.22, gain: 0.58, pitchDrop: 0.62 },
  husky:           { freq:  310, type: 'sine',     duration: 0.55, reps: 1, repGap: 0.30, gain: 0.52, pitchDrop: 1.40 }, // rises like a howl
  rottweiler:      { freq:  195, type: 'sawtooth', duration: 0.36, reps: 1, repGap: 0.25, gain: 0.62, pitchDrop: 0.58 },
  goldenretriever: { freq:  375, type: 'sawtooth', duration: 0.24, reps: 2, repGap: 0.18, gain: 0.48, pitchDrop: 0.68 },
};

function playBarkSound(dogId, powerMultiplier = 1) {
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') ctx.resume();

  const cfg = BARK_CONFIGS[dogId] || BARK_CONFIGS.germanshepherd;
  const gainVal = Math.min(1.0, cfg.gain * powerMultiplier);

  for (let r = 0; r < cfg.reps; r++) {
    const t0 = ctx.currentTime + r * (cfg.duration + cfg.repGap);

    // Oscillator (tone body)
    const osc       = ctx.createOscillator();
    const gainNode  = ctx.createGain();
    const filter    = ctx.createBiquadFilter();

    osc.type = cfg.type;
    osc.frequency.setValueAtTime(cfg.freq, t0);
    osc.frequency.exponentialRampToValueAtTime(cfg.freq * cfg.pitchDrop, t0 + cfg.duration);

    filter.type      = 'bandpass';
    filter.frequency.value = cfg.freq * 1.6;
    filter.Q.value   = 1.8;

    gainNode.gain.setValueAtTime(0, t0);
    gainNode.gain.linearRampToValueAtTime(gainVal, t0 + 0.018);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + cfg.duration);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + cfg.duration);

    // Noise burst (adds breath/roughness)
    const noiseSamples  = Math.floor(ctx.sampleRate * 0.09);
    const noiseBuffer   = ctx.createBuffer(1, noiseSamples, ctx.sampleRate);
    const noiseData     = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseSamples; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.18;
    }

    const noise      = ctx.createBufferSource();
    const noiseGain  = ctx.createGain();
    noise.buffer = noiseBuffer;
    noiseGain.gain.setValueAtTime(gainVal * 0.35, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t0);
  }
}

/* ============================================================
   GAME STATE
   ============================================================ */
let selectedDog   = null;
let selectedSize  = null;   // 'small' | 'big'
let selectedDiff  = 'medium';
let cpuDog        = null;
let tugPosition   = 50;     // 0 = CPU wins, 100 = Player wins
let barkCount     = 0;
let battleActive  = false;
let battleStartTime = 0;

// CPU timing
let cpuTimer = null;

// Audio / mic
let mediaStream   = null;
let analyser      = null;
let animFrame     = null;
let micListening  = false;
let micAvailable  = false; // whether mic permission was granted

// Voice detection state
let voiceActive     = false;
let voiceStartTime  = 0;
let voicePeakVol    = 0;
let voiceTimeout    = null;

// Mobile tap-to-bark state
let tapHolding      = false;
let tapStartTime    = 0;
let tapPeakVol      = 0.6; // fixed volume for tap input

/* ============================================================
   SELECT SCREEN — RENDER
   ============================================================ */
function renderSelect() {
  renderDogGroup('small-dogs-grid', DOGS.small, 'small');
  renderDogGroup('big-dogs-grid',   DOGS.big,   'big');
  renderDifficulties();
  document.getElementById('fight-btn').addEventListener('click', startBattle);
}

function renderDogGroup(containerId, dogs, size) {
  const grid = document.getElementById(containerId);
  grid.innerHTML = '';
  dogs.forEach(dog => {
    const card = document.createElement('div');
    card.className = 'dog-card';
    card.id = 'dog-' + dog.id;

    const statsHtml = size === 'small'
      ? `<span class="stat-speed">⚡ ${dog.speedLabel}</span><span class="stat-hp">❤ ${dog.hpLabel}</span>`
      : `<span class="stat-power">💥 ${dog.powerLabel}</span><span class="stat-hp">❤ ${dog.hpLabel}</span>`;

    card.innerHTML = `
      <div class="dog-avatar">${dog.emoji}</div>
      <div class="dog-name">${dog.name}</div>
      <div class="dog-tagline">${dog.tagline}</div>
      <div class="dog-stats">${statsHtml}</div>
    `;
    card.addEventListener('click', () => selectDog(dog, size));

    // Touch support — prevent double-fire
    card.addEventListener('touchend', e => {
      e.preventDefault();
      selectDog(dog, size);
    }, { passive: false });

    grid.appendChild(card);
  });
}

function renderDifficulties() {
  const grid = document.getElementById('diff-grid');
  grid.innerHTML = '';
  DIFFICULTIES.forEach(d => {
    const card = document.createElement('div');
    card.className = 'diff-card' + (d.id === selectedDiff ? ' selected' : '');
    card.innerHTML = `
      <div class="diff-icon">${d.icon}</div>
      <div class="diff-name">${d.name}</div>
      <div class="diff-desc">${d.desc}</div>
    `;
    card.addEventListener('click', () => selectDifficulty(d.id, card));
    card.addEventListener('touchend', e => {
      e.preventDefault();
      selectDifficulty(d.id, card);
    }, { passive: false });
    grid.appendChild(card);
  });
}

function selectDog(dog, size) {
  // Resume audio context on first user interaction
  if (audioCtx) audioCtx.resume();

  document.querySelectorAll('.dog-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('dog-' + dog.id).classList.add('selected');
  selectedDog  = dog;
  selectedSize = size;

  const btn = document.getElementById('fight-btn');
  btn.textContent = `🐾 Fight as ${dog.name}!`;
}

function selectDifficulty(id, cardEl) {
  selectedDiff = id;
  document.querySelectorAll('.diff-card').forEach(c => c.classList.remove('selected'));
  cardEl.classList.add('selected');
}

/* ============================================================
   START BATTLE
   ============================================================ */
function startBattle() {
  if (!selectedDog) return;

  // Initialise AudioContext on user gesture (required by browsers)
  getAudioCtx();

  // Pick random CPU opponent (different dog)
  const allDogs = [...DOGS.small, ...DOGS.big].filter(d => d.id !== selectedDog.id);
  cpuDog = allDogs[Math.floor(Math.random() * allDogs.length)];
  cpuDog._size = DOGS.small.find(d => d.id === cpuDog.id) ? 'small' : 'big';

  // Reset state
  tugPosition      = 50;
  barkCount        = 0;
  battleActive     = true;
  battleStartTime  = Date.now();

  // Populate battle UI
  setText('b-player-name', selectedDog.name);
  setText('b-cpu-name',    cpuDog.name);
  setText('player-avatar', selectedDog.emoji);
  setText('cpu-avatar',    cpuDog.emoji);
  setText('player-name-lbl', selectedDog.name);
  setText('cpu-name-lbl',    cpuDog.name);
  setText('tug-player-name', selectedDog.name);
  setText('tug-cpu-name',    cpuDog.name);
  setText('bark-count',      '0');
  document.getElementById('attack-log').innerHTML = '';

  const diff = getDiff();
  setText('b-diff-badge', `${diff.icon} ${diff.name} difficulty`);

  updateTug();
  showScreen('battle-screen');
  startMic();
  scheduleCpuAttack();
}

/* ============================================================
   CPU ATTACK SCHEDULER
   ============================================================ */
function scheduleCpuAttack() {
  if (!battleActive) return;
  const diff    = getDiff();
  const jitter  = diff.cpuRate * (0.4 + Math.random() * 0.8);

  cpuTimer = setTimeout(() => {
    if (!battleActive) return;

    const vol   = 0.25 + Math.random() * 0.75;
    const dur   = 0.15 + Math.random() * 0.85;
    const power = calcAttackPower(cpuDog._size, vol, dur) * diff.cpuPowerMult;

    tugPosition = Math.max(0, tugPosition - power);
    barkCount++;
    setText('bark-count', barkCount);

    playBarkSound(cpuDog.id, Math.min(1.2, vol * diff.cpuPowerMult));
    flashFighter('cpu');
    addLog(`💥 ${cpuDog.name} barks! -${power.toFixed(1)} power`, 'cpu-log');
    setCpuThinking(true);
    setTimeout(() => setCpuThinking(false), 450);

    updateTug();
    checkWin();
    if (battleActive) scheduleCpuAttack();
  }, jitter);
}

function setCpuThinking(on) {
  const el = document.getElementById('cpu-thinking');
  if (on) {
    el.textContent = `${cpuDog.emoji} ${cpuDog.name} is barking...`;
    el.classList.add('active');
  } else {
    el.textContent = '';
    el.classList.remove('active');
  }
}

/* ============================================================
   POWER CALCULATION
   Small dogs: long duration = powerful, loud volume = normal
   Big dogs:   loud volume = powerful, long duration = normal
   ============================================================ */
function calcAttackPower(size, volume, durationSec) {
  const volNorm = Math.min(volume, 1);
  const durNorm = Math.min(durationSec / 3, 1); // 3 s = maximum

  if (size === 'small') {
    return (durNorm * 13) + (volNorm * 4);
  } else {
    return (volNorm * 13) + (durNorm * 4);
  }
}

/* ============================================================
   MICROPHONE / VOICE DETECTION
   ============================================================ */
async function startMic() {
  setMicStatus('off', '🎤 Requesting mic…');

  // Check API support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setMicStatus('error', '❌ Mic not supported on this browser');
    showTapButton();
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    const ctx    = getAudioCtx();
    if (ctx.state === 'suspended') await ctx.resume();

    const source = ctx.createMediaStreamSource(mediaStream);
    analyser     = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);

    micListening = true;
    micAvailable = true;
    setMicStatus('listening', '🎤 Listening… Bark to attack!');
    updateHoldTip(); // set correct tip for dog type
    monitorVoice();

  } catch (err) {
    console.warn('Mic error:', err);
    const msg = err.name === 'NotAllowedError'
      ? '❌ Mic denied — use the TAP button below'
      : '❌ Mic unavailable — use the TAP button below';
    setMicStatus('error', msg);
    showTapButton();
  }
}

function monitorVoice() {
  if (!micListening) return;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function loop() {
    if (!micListening) return;
    animFrame = requestAnimationFrame(loop);
    analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    const avg     = sum / dataArray.length;
    const volFrac = Math.min(avg / 75, 1);

    document.getElementById('vol-bar').style.width = (volFrac * 100) + '%';

    const THRESHOLD = 0.07;

    if (volFrac > THRESHOLD) {
      if (!voiceActive) {
        voiceActive    = true;
        voiceStartTime = performance.now();
        voicePeakVol   = volFrac;
        setMicStatus('active', '🎤 BARKING!');
      } else {
        voicePeakVol = Math.max(voicePeakVol, volFrac);
      }
      clearTimeout(voiceTimeout);
      voiceTimeout = setTimeout(() => {
        if (voiceActive) endVoice();
      }, 280);
    }
  }

  loop();
}

function endVoice() {
  if (!voiceActive || !battleActive) return;
  voiceActive = false;

  const durationSec = (performance.now() - voiceStartTime) / 1000;
  playerAttack(voicePeakVol, durationSec);
  setMicStatus('listening', '🎤 Listening… Bark again!');
}

/* ============================================================
   TAP-TO-BARK (mobile fallback when mic unavailable)
   ============================================================ */
function showTapButton() {
  const btn = document.getElementById('tap-bark-btn');
  btn.style.display = 'block';
  updateHoldTip();

  // Touch events for mobile
  btn.addEventListener('touchstart', onTapStart, { passive: false });
  btn.addEventListener('touchend',   onTapEnd,   { passive: false });
  btn.addEventListener('touchcancel',onTapEnd,   { passive: false });

  // Mouse events for desktop testing
  btn.addEventListener('mousedown', onTapStart);
  btn.addEventListener('mouseup',   onTapEnd);
  btn.addEventListener('mouseleave',onTapEnd);
}

function onTapStart(e) {
  e.preventDefault();
  if (!battleActive || tapHolding) return;
  tapHolding    = true;
  tapStartTime  = performance.now();
  tapPeakVol    = 0.5 + Math.random() * 0.5; // simulate random volume
  document.getElementById('tap-bark-btn').classList.add('holding');
  setMicStatus('active', '🐾 BARKING!');

  // Animate vol bar while holding
  animateTapVolBar();
}

function onTapEnd(e) {
  e.preventDefault();
  if (!tapHolding) return;
  tapHolding = false;
  document.getElementById('tap-bark-btn').classList.remove('holding');

  const durationSec = (performance.now() - tapStartTime) / 1000;
  if (durationSec > 0.05 && battleActive) {
    playerAttack(tapPeakVol, durationSec);
  }
  setMicStatus('off', '🎤 Tap & hold to bark!');
  document.getElementById('vol-bar').style.width = '0%';
}

function animateTapVolBar() {
  if (!tapHolding) return;
  const elapsed  = (performance.now() - tapStartTime) / 1000;
  const fillFrac = Math.min(elapsed / 3, 1);
  const noise    = 0.85 + Math.random() * 0.15;
  document.getElementById('vol-bar').style.width = (fillFrac * noise * 100) + '%';
  requestAnimationFrame(animateTapVolBar);
}

/* ============================================================
   PLAYER ATTACK
   ============================================================ */
function playerAttack(volume, durationSec) {
  if (!battleActive) return;

  const power = calcAttackPower(selectedSize, volume, durationSec);
  tugPosition = Math.min(100, tugPosition + power);
  barkCount++;
  setText('bark-count', barkCount);

  playBarkSound(selectedDog.id, Math.min(1.2, volume));
  flashFighter('player');

  const hint = selectedSize === 'small'
    ? `⏱ ${durationSec.toFixed(1)}s (longer = stronger!)`
    : `📢 Vol ${(volume * 100).toFixed(0)}% (louder = stronger!)`;

  addLog(`🎤 You bark! +${power.toFixed(1)} power  ${hint}`, 'player-log');
  updateHoldTip(volume, durationSec);
  updateTug();
  checkWin();
}

function updateHoldTip(vol, dur) {
  const tip = document.getElementById('hold-tip');
  if (!selectedSize) return;

  if (!vol && !dur) {
    // Initial hint
    tip.textContent = selectedSize === 'small'
      ? '⏱ Hold your shout LONGER for max power!'
      : '📢 Shout LOUDER for max power!';
    return;
  }

  if (selectedSize === 'small') {
    if (dur < 0.5)      tip.textContent = '⏱ Hold your shout LONGER for max power!';
    else if (dur < 1.5) tip.textContent = '🔥 Good! Keep holding for even more!';
    else                tip.textContent = '💥 EPIC bark duration! Max power!';
  } else {
    if (vol < 0.3)      tip.textContent = '📢 Shout LOUDER for max power!';
    else if (vol < 0.7) tip.textContent = '🔥 Good volume! Shout even louder!';
    else                tip.textContent = '💥 DEAFENING bark! Unstoppable!';
  }
}

/* ============================================================
   TUG OF WAR UI
   ============================================================ */
function updateTug() {
  document.getElementById('tug-bar').style.width = tugPosition + '%';

  const status = document.getElementById('tug-status');
  if (tugPosition > 68) {
    status.textContent  = `${selectedDog.name} is dominating! 🔥`;
    status.style.color  = '#92400E';
  } else if (tugPosition > 55) {
    status.textContent  = `${selectedDog.name} is winning! 💪`;
    status.style.color  = '#B45309';
  } else if (tugPosition < 32) {
    status.textContent  = `${cpuDog.name} is crushing it! 😬`;
    status.style.color  = '#DC2626';
  } else if (tugPosition < 45) {
    status.textContent  = `${cpuDog.name} is pulling ahead! 😰`;
    status.style.color  = '#EA580C';
  } else {
    status.textContent  = `Neck and neck! 🐕`;
    status.style.color  = '#666';
  }
}

/* ============================================================
   ATTACK LOG
   ============================================================ */
function addLog(msg, cls) {
  const log   = document.getElementById('attack-log');
  const entry = document.createElement('div');
  entry.className = 'log-entry ' + cls;
  entry.textContent = msg;
  log.prepend(entry);
  while (log.children.length > 10) log.lastChild.remove();
}

/* ============================================================
   WIN / LOSE CHECK
   ============================================================ */
function checkWin() {
  if (tugPosition >= 100) endBattle(true);
  else if (tugPosition <= 0) endBattle(false);
}

function endBattle(playerWon) {
  battleActive = false;
  stopMic();

  const elapsed = Math.round((Date.now() - battleStartTime) / 1000);

  setTimeout(() => {
    showScreen('win-screen');

    if (playerWon) {
      setText('win-emoji',  '🏆');
      setText('win-title',  'YOU WIN!');
      setText('win-sub',    `${selectedDog.name}'s barks were unstoppable! 🎉`);
      document.getElementById('win-title').className = 'win-title win';
      spawnParticles(['🐾', '⭐', '🏆', '🎉', '💥', '🐕']);
    } else {
      setText('win-emoji',  '😔');
      setText('win-title',  'YOU LOSE!');
      setText('win-sub',    `${cpuDog.name} out-barked you! Train harder! 💪`);
      document.getElementById('win-title').className = 'win-title lose';
    }

    const diff = getDiff();
    document.getElementById('win-stats').innerHTML = `
      🐾 Your dog: <strong>${selectedDog.name}</strong><br>
      🤖 CPU dog: <strong>${cpuDog.name}</strong><br>
      🎮 Difficulty: <strong>${diff.name}</strong><br>
      🎤 Total barks: <strong>${barkCount}</strong><br>
      ⏱ Duration: <strong>${elapsed}s</strong>
    `;

    document.getElementById('play-again-btn').onclick = backToSelect;
  }, 350);
}

function stopMic() {
  micListening = false;
  voiceActive  = false;
  tapHolding   = false;
  clearTimeout(cpuTimer);
  clearTimeout(voiceTimeout);
  cancelAnimationFrame(animFrame);
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
}

/* ============================================================
   PARTICLES
   ============================================================ */
function spawnParticles(emojis) {
  const burst = document.createElement('div');
  burst.className = 'particle-burst';
  document.body.appendChild(burst);

  for (let i = 0; i < 28; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    p.style.left            = Math.random() * 100 + 'vw';
    p.style.animationDelay  = Math.random() * 1.3 + 's';
    p.style.animationDuration = (1.1 + Math.random() * 0.9) + 's';
    burst.appendChild(p);
  }

  setTimeout(() => burst.remove(), 3200);
}

/* ============================================================
   FIGHTER FLASH ANIMATION
   ============================================================ */
function flashFighter(who) {
  const id = who === 'player' ? 'player-avatar' : 'cpu-avatar';
  const el = document.getElementById(id);
  el.classList.remove('attack-flash');
  void el.offsetWidth; // force reflow to restart animation
  el.classList.add('attack-flash');
}

/* ============================================================
   SCREEN MANAGEMENT
   ============================================================ */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function backToSelect() {
  stopMic();
  tugPosition   = 50;
  barkCount     = 0;
  battleActive  = false;

  // Hide tap button for fresh start
  const tapBtn = document.getElementById('tap-bark-btn');
  if (tapBtn) tapBtn.style.display = 'none';

  showScreen('select-screen');
}

/* ============================================================
   UTILITY HELPERS
   ============================================================ */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setMicStatus(state, text) {
  const dot = document.getElementById('mic-dot');
  dot.className = 'mic-dot';
  if (state === 'listening') dot.classList.add('listening');
  else if (state === 'active') dot.classList.add('active');
  else if (state === 'error') dot.classList.add('error');
  setText('mic-status', text);
}

function getDiff() {
  return DIFFICULTIES.find(d => d.id === selectedDiff) || DIFFICULTIES[1];
}

/* ============================================================
   INITIALISE
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  renderSelect();

  // Pre-warm AudioContext on any first user gesture (iOS requirement)
  const warmUp = () => {
    getAudioCtx();
    document.removeEventListener('touchstart', warmUp);
    document.removeEventListener('mousedown',  warmUp);
  };
  document.addEventListener('touchstart', warmUp, { once: true, passive: true });
  document.addEventListener('mousedown',  warmUp, { once: true });
});
