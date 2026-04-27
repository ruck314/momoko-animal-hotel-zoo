/* audio.js – Web Audio API chiptune sound effects & music */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var ctx = null;
  var masterGain = null;
  var musicGain = null;
  var sfxGain = null;
  var currentMusic = null;
  var muted = false;
  var initialized = false;

  function init() {
    if (initialized) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.5;
      masterGain.connect(ctx.destination);

      musicGain = ctx.createGain();
      musicGain.gain.value = 0.35;
      musicGain.connect(masterGain);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.6;
      sfxGain.connect(masterGain);

      initialized = true;
    } catch (e) { /* Web Audio not available */ }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  /* ---- helpers ---- */
  function playNote(freq, type, duration, gain, dest, startTime) {
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain || 0.3, startTime || ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, (startTime || ctx.currentTime) + duration);
    osc.connect(g);
    g.connect(dest || sfxGain);
    osc.start(startTime || ctx.currentTime);
    osc.stop((startTime || ctx.currentTime) + duration);
  }

  function noise(duration, dest, startTime) {
    if (!ctx) return;
    var bufferSize = ctx.sampleRate * duration;
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buffer;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.15, startTime || ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, (startTime || ctx.currentTime) + duration);
    src.connect(g);
    g.connect(dest || sfxGain);
    src.start(startTime || ctx.currentTime);
  }

  /* ---- SFX ---- */
  function bubble() {
    if (!ctx) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.15);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  function enemyHit() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(500, 'square', 0.06, 0.3, sfxGain, t);
    playNote(700, 'square', 0.06, 0.3, sfxGain, t + 0.06);
    playNote(900, 'square', 0.08, 0.2, sfxGain, t + 0.12);
  }

  function enemyDefeat() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(400, 'square', 0.05, 0.3, sfxGain, t);
    playNote(600, 'square', 0.05, 0.3, sfxGain, t + 0.05);
    playNote(800, 'square', 0.05, 0.3, sfxGain, t + 0.1);
    playNote(1000, 'triangle', 0.1, 0.25, sfxGain, t + 0.15);
  }

  function damage() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(300, 'sawtooth', 0.08, 0.3, sfxGain, t);
    playNote(200, 'sawtooth', 0.1, 0.3, sfxGain, t + 0.08);
    noise(0.1, sfxGain, t + 0.05);
  }

  function pickup() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(880, 'triangle', 0.08, 0.25, sfxGain, t);
    playNote(1100, 'triangle', 0.08, 0.25, sfxGain, t + 0.08);
    playNote(1320, 'triangle', 0.12, 0.2, sfxGain, t + 0.16);
  }

  function menuSelect() {
    if (!ctx) return;
    playNote(660, 'square', 0.06, 0.15, sfxGain);
  }

  function victoryJingle() {
    if (!ctx) return;
    var t = ctx.currentTime;
    var notes = [523, 587, 659, 784, 659, 784, 1047];
    var dur = [0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.4];
    var time = t;
    for (var i = 0; i < notes.length; i++) {
      playNote(notes[i], 'square', dur[i], 0.3, sfxGain, time);
      playNote(notes[i] * 0.5, 'triangle', dur[i], 0.15, sfxGain, time);
      time += dur[i];
    }
  }

  function gameOverSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(400, 'sawtooth', 0.2, 0.3, sfxGain, t);
    playNote(350, 'sawtooth', 0.2, 0.3, sfxGain, t + 0.2);
    playNote(300, 'sawtooth', 0.2, 0.3, sfxGain, t + 0.4);
    playNote(200, 'sawtooth', 0.5, 0.3, sfxGain, t + 0.6);
  }

  /* ---- Animal SFX ---- */
  /* Pitched growl with frequency ramp; used by lion/tiger/bear/wolf variants. */
  function growl(startF, endF, dur, type) {
    if (!ctx) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'sawtooth';
    osc.frequency.setValueAtTime(startF, t);
    osc.frequency.exponentialRampToValueAtTime(endF, t + dur);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + dur);
    /* Layer in noise for breathy texture */
    noise(dur * 0.7, sfxGain, t);
  }

  function elephantSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    /* Low rumble */
    playNote(80, 'sawtooth', 0.4, 0.3, sfxGain, t);
    /* Trumpet swoop */
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, t + 0.1);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.45);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.7);
    g.gain.setValueAtTime(0.22, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t + 0.1); osc.stop(t + 0.7);
  }

  function lionSfx()  { growl(220, 90,  0.6, 'sawtooth'); }
  function tigerSfx() { growl(260, 140, 0.45, 'sawtooth'); }
  function bearSfx()  { growl(150, 70,  0.55, 'sawtooth'); }

  function wolfSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(560, t + 0.4);
    osc.frequency.exponentialRampToValueAtTime(220, t + 1.0);
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.15);
    g.gain.linearRampToValueAtTime(0.18, t + 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t); osc.stop(t + 1.0);
  }

  function giraffeSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(180, 'sine', 0.6, 0.18, sfxGain, t);
    playNote(220, 'sine', 0.5, 0.10, sfxGain, t + 0.05);
  }

  function zebraSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.1);
    osc.frequency.exponentialRampToValueAtTime(330, t + 0.4);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t); osc.stop(t + 0.4);
  }

  function eagleSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(2400, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.3);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t); osc.stop(t + 0.3);
  }

  function foxSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(900, 'square', 0.08, 0.25, sfxGain, t);
    playNote(720, 'square', 0.10, 0.22, sfxGain, t + 0.13);
  }

  function owlSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(440, 'sine', 0.25, 0.22, sfxGain, t);
    playNote(330, 'sine', 0.30, 0.20, sfxGain, t + 0.32);
  }

  function pandaSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.18);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t); osc.stop(t + 0.22);
  }

  function penguinSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(220, 'square', 0.12, 0.28, sfxGain, t);
    playNote(220, 'square', 0.12, 0.28, sfxGain, t + 0.18);
  }

  function bunnySfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(1200, 'sine', 0.05, 0.18, sfxGain, t);
    playNote(1400, 'sine', 0.05, 0.16, sfxGain, t + 0.08);
    noise(0.06, sfxGain, t + 0.16);
  }

  function catSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(540, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.15);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.45);
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t); osc.stop(t + 0.45);
  }

  function dogSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(420, 'square', 0.08, 0.3, sfxGain, t);
    playNote(360, 'square', 0.08, 0.25, sfxGain, t + 0.05);
    playNote(440, 'square', 0.08, 0.3, sfxGain, t + 0.22);
    playNote(380, 'square', 0.08, 0.25, sfxGain, t + 0.27);
  }

  function seaOtterSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(1100, 'triangle', 0.08, 0.22, sfxGain, t);
    playNote(1320, 'triangle', 0.08, 0.22, sfxGain, t + 0.09);
    /* Splash */
    noise(0.18, sfxGain, t + 0.18);
  }

  function kangarooSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    /* Two ground thumps */
    playNote(80, 'sine', 0.10, 0.35, sfxGain, t);
    playNote(80, 'sine', 0.10, 0.35, sfxGain, t + 0.18);
    /* Soft chirp */
    playNote(900, 'triangle', 0.12, 0.16, sfxGain, t + 0.30);
  }

  function unicornSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    /* Sparkle arpeggio */
    var notes = [880, 1175, 1397, 1760];
    for (var i = 0; i < notes.length; i++) {
      playNote(notes[i], 'triangle', 0.12, 0.18, sfxGain, t + i * 0.06);
    }
    /* Soft neigh */
    playNote(660, 'square', 0.18, 0.16, sfxGain, t + 0.32);
  }

  function alienSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    /* Wobble */
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.linearRampToValueAtTime(990, t + 0.08);
    osc.frequency.linearRampToValueAtTime(440, t + 0.16);
    osc.frequency.linearRampToValueAtTime(880, t + 0.28);
    osc.frequency.linearRampToValueAtTime(550, t + 0.4);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t); osc.stop(t + 0.4);
  }

  function monkeySfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    var notes = [800, 1100, 700, 1300, 900];
    for (var i = 0; i < notes.length; i++) {
      playNote(notes[i], 'square', 0.06, 0.22, sfxGain, t + i * 0.07);
    }
  }

  function snoreSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    /* Inhale */
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.7);
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t); osc.stop(t + 0.7);
    /* Soft exhale noise */
    noise(0.5, sfxGain, t + 0.7);
  }

  function elevatorDingSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(880,  'sine', 0.25, 0.28, sfxGain, t);
    playNote(1175, 'sine', 0.45, 0.22, sfxGain, t + 0.12);
  }

  /* New species SFX */
  function koalaSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    playNote(180, 'sawtooth', 0.4, 0.22, sfxGain, t);
    playNote(140, 'sawtooth', 0.5, 0.18, sfxGain, t + 0.18);
  }

  function hippoSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.5);
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g); g.connect(sfxGain);
    osc.start(t); osc.stop(t + 0.5);
    noise(0.4, sfxGain, t);
  }

  function rhinoSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    /* Heavy snort + thump */
    noise(0.18, sfxGain, t);
    playNote(95, 'sawtooth', 0.25, 0.32, sfxGain, t + 0.05);
    playNote(60, 'sine', 0.18, 0.4, sfxGain, t + 0.30);
  }

  function polarBearSfx() {
    if (!ctx) return;
    /* Lower than regular bear */
    growl(120, 60, 0.7, 'sawtooth');
  }

  function frogSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    /* Two ribbits */
    var osc1 = ctx.createOscillator();
    var g1 = ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(180, t);
    osc1.frequency.exponentialRampToValueAtTime(110, t + 0.18);
    g1.gain.setValueAtTime(0.28, t); g1.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc1.connect(g1); g1.connect(sfxGain);
    osc1.start(t); osc1.stop(t + 0.2);
    var osc2 = ctx.createOscillator();
    var g2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(180, t + 0.3);
    osc2.frequency.exponentialRampToValueAtTime(110, t + 0.48);
    g2.gain.setValueAtTime(0.28, t + 0.3); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc2.connect(g2); g2.connect(sfxGain);
    osc2.start(t + 0.3); osc2.stop(t + 0.5);
  }

  function gorillaSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    /* Chest thumps + low growl */
    noise(0.06, sfxGain, t);
    playNote(60, 'sine', 0.12, 0.45, sfxGain, t + 0.02);
    noise(0.06, sfxGain, t + 0.18);
    playNote(60, 'sine', 0.12, 0.45, sfxGain, t + 0.20);
    growl(170, 90, 0.4, 'sawtooth');
  }

  /* ---- Music (looping chiptune patterns) ---- */
  var musicInterval = null;

  /* Hotel lobby BGM — laid-back jazz progression in F major (ii–V–I)
     with a lounge-y melody. Distinct from the space template's pentatonic
     drift. Sevenths and walking bass give it that brass-and-velvet hotel
     feel. */
  var bgmPattern = [
    /* Phrase A — Fmaj7 → Dm7 */
    [349, 'sine'], [440, 'sine'], [523, 'sine'], [659, 'sine'],
    [523, 'sine'], [440, 'sine'], [392, 'sine'], [349, 'sine'],
    [294, 'sine'], [349, 'sine'], [440, 'sine'], [523, 'sine'],
    [440, 'sine'], [349, 'sine'], [294, 'sine'], [220, 'sine'],
    /* Phrase B — Gm7 → C7 → Fmaj7 */
    [392, 'sine'], [466, 'sine'], [587, 'sine'], [466, 'sine'],
    [392, 'sine'], [349, 'sine'], [294, 'sine'], [262, 'sine'],
    [262, 'sine'], [330, 'sine'], [392, 'sine'], [523, 'sine'],
    [440, 'sine'], [349, 'sine'], [330, 'sine'], [349, 'sine'],
  ];

  /* Walking bass — F → D → G → C around 1 octave */
  var bgmBass = [
    87, 110, 131, 110,    87, 110, 131, 110,
    73, 98,  117, 98,     73, 98,  117, 98,
    98, 117, 147, 117,    98, 117, 147, 117,
    65, 87,  98, 110,     87, 73,  87, 87,
  ];

  /* Boss music – ominous, faster */
  var bossPattern = [
    [196, 'square'], [233, 'square'], [262, 'square'], [233, 'square'],
    [196, 'square'], [175, 'square'], [196, 'square'], [147, 'square'],
    [175, 'square'], [208, 'square'], [233, 'square'], [208, 'square'],
    [175, 'square'], [165, 'square'], [175, 'square'], [131, 'square'],
    [196, 'square'], [262, 'square'], [330, 'square'], [262, 'square'],
    [196, 'square'], [175, 'square'], [147, 'square'], [131, 'square'],
    [147, 'square'], [175, 'square'], [196, 'square'], [175, 'square'],
    [147, 'square'], [131, 'square'], [147, 'square'], [196, 'square'],
  ];

  var bossBass = [
    98, 98, 131, 131, 98, 98, 87, 87,
    87, 87, 117, 117, 87, 87, 82, 82,
    98, 98, 131, 131, 98, 98, 87, 87,
    73, 73, 87, 87, 73, 73, 98, 98,
  ];

  /* Title-screen music – NES-era heroic march in C major, 16th-note
     square lead over a triangle-bass walk with a kick-hat noise pulse
     on every beat. Two 8-bar phrases so it doesn't loop too quickly. */
  var titlePattern = [
    /* Phrase A */
    [523, 'square'], [659, 'square'], [784, 'square'], [659, 'square'],
    [784, 'square'], [1047, 'square'], [988, 'square'], [784, 'square'],
    [880, 'square'], [1047, 'square'], [1319, 'square'], [1047, 'square'],
    [988, 'square'], [784, 'square'], [659, 'square'], [523, 'square'],
    /* Phrase B */
    [698, 'square'], [880, 'square'], [1047, 'square'], [880, 'square'],
    [1047, 'square'], [1397, 'square'], [1319, 'square'], [1047, 'square'],
    [1175, 'square'], [988, 'square'], [784, 'square'], [587, 'square'],
    [659, 'square'], [784, 'square'], [1047, 'square'], [784, 'square'],
  ];
  var titleBass = [
    131, 131, 131, 131, 196, 196, 196, 196,
    220, 220, 220, 220, 131, 131, 196, 196,
    175, 175, 175, 175, 220, 220, 220, 220,
    196, 196, 147, 147, 131, 131, 196, 131,
  ];
  /* 1 = kick (noise burst), 0 = nothing — NES-era drum-less synth still
     benefits from a small noise thump on the strong beats. */
  var titleDrums = [
    1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0,
    1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0,
  ];

  /* Per-floor flavor for the lobby BGM. Each floor transposes the lead
     by a few semitones, nudges tempo, and picks a complementary lead
     waveform so the wings feel sonically distinct without needing a
     whole new pattern.
       semi  – semitones to transpose the melody (bass stays grounded)
       wave  – override for the lead waveform
       tempoMul – multiplier on the base tempo (1.0 = unchanged) */
  var FLOOR_FLAVOR = [
    /* Floor 0 (Lobby)   – default jazz lounge */
    { semi:  0, wave: null,       tempoMul: 1.00, sparkle: false },
    /* Floor 1 (Safari)  – brighter, slightly faster, square lead */
    { semi:  4, wave: 'square',   tempoMul: 1.06, sparkle: false },
    /* Floor 2 (Wild)    – a touch lower and more triangle-mellow */
    { semi: -3, wave: 'triangle', tempoMul: 0.96, sparkle: false },
    /* Floor 3 (Magic)   – ethereal: shimmery sine + sparkle drum */
    { semi:  7, wave: 'sine',     tempoMul: 1.00, sparkle: true },
  ];

  function semiToRatio(semi) { return Math.pow(2, semi / 12); }

  function startMusic(type, floorIndex) {
    stopMusic();
    if (!ctx || muted) return;
    var pattern, bass, drums, tempo;
    if (type === 'boss') {
      pattern = bossPattern; bass = bossBass; drums = null; tempo = 180;
    } else if (type === 'title') {
      pattern = titlePattern; bass = titleBass; drums = titleDrums; tempo = 150;
    } else {
      pattern = bgmPattern; bass = bgmBass; drums = null; tempo = 88;
    }

    /* Floor flavor only applies to the in-hotel BGM. */
    var flavor = (type !== 'title' && type !== 'boss')
      ? (FLOOR_FLAVOR[floorIndex || 0] || FLOOR_FLAVOR[0])
      : { semi: 0, wave: null, tempoMul: 1.0, sparkle: false };
    var pitchRatio = semiToRatio(flavor.semi);
    tempo = Math.round(tempo * flavor.tempoMul);

    var beatDur = 60 / tempo;
    var noteIdx = 0;

    function scheduleNotes() {
      if (!ctx || muted) return;
      var t = ctx.currentTime;
      for (var i = 0; i < 4; i++) {
        var idx = (noteIdx + i) % pattern.length;
        var note = pattern[idx];
        var bNote = bass[idx];
        var when = t + i * beatDur;

        /* Melody */
        var melodyGain = type === 'title' ? 0.13 : 0.15;
        var leadFreq = note[0] * pitchRatio;
        var leadType = flavor.wave || note[1];
        playNote(leadFreq, leadType, beatDur * 0.8, melodyGain, musicGain, when);
        /* Title gets a subtle second square an octave lower for width */
        if (type === 'title') {
          playNote(note[0] * 0.5, 'square', beatDur * 0.8, 0.06, musicGain, when);
        }
        /* Bass */
        playNote(bNote, 'triangle', beatDur * 0.9, 0.12, musicGain, when);

        if (type === 'boss') {
          if (idx % 4 === 0) noise(0.04, musicGain, when);
        } else if (type === 'title' && drums && drums[idx]) {
          noise(0.035, musicGain, when);
        } else if (flavor.sparkle && idx % 4 === 2) {
          /* Magic floor: a tiny high-pitched twinkle on the upbeat. */
          playNote(2093, 'triangle', 0.06, 0.05, musicGain, when);
        }
      }
      noteIdx = (noteIdx + 4) % pattern.length;
    }

    scheduleNotes();
    musicInterval = setInterval(scheduleNotes, beatDur * 4 * 1000);
    currentMusic = type;
  }

  function stopMusic() {
    if (musicInterval) {
      clearInterval(musicInterval);
      musicInterval = null;
    }
    currentMusic = null;
  }

  function toggleMute() {
    muted = !muted;
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
    if (muted) stopMusic();
  }

  window.Game.audio = {
    init: init,
    resume: resume,
    play: function (name) {
      if (muted || !ctx) return;
      resume();
      switch (name) {
        case 'bubble': bubble(); break;
        case 'enemyHit': enemyHit(); break;
        case 'enemyDefeat': enemyDefeat(); break;
        case 'damage': damage(); break;
        case 'pickup': pickup(); break;
        case 'select': menuSelect(); break;
        case 'victory': victoryJingle(); break;
        case 'gameOver': gameOverSfx(); break;
        case 'elephant': elephantSfx(); break;
        case 'lion': lionSfx(); break;
        case 'tiger': tigerSfx(); break;
        case 'bear': bearSfx(); break;
        case 'wolf': wolfSfx(); break;
        case 'giraffe': giraffeSfx(); break;
        case 'zebra': zebraSfx(); break;
        case 'eagle': eagleSfx(); break;
        case 'fox': foxSfx(); break;
        case 'owl': owlSfx(); break;
        case 'panda': pandaSfx(); break;
        case 'penguin': penguinSfx(); break;
        case 'bunny': bunnySfx(); break;
        case 'cat': catSfx(); break;
        case 'dog': dogSfx(); break;
        case 'seaOtter': seaOtterSfx(); break;
        case 'kangaroo': kangarooSfx(); break;
        case 'unicorn': unicornSfx(); break;
        case 'alien': alienSfx(); break;
        case 'monkey': monkeySfx(); break;
        case 'snore': snoreSfx(); break;
        case 'elevatorDing': elevatorDingSfx(); break;
        case 'koala': koalaSfx(); break;
        case 'hippo': hippoSfx(); break;
        case 'rhino': rhinoSfx(); break;
        case 'polarBear': polarBearSfx(); break;
        case 'frog': frogSfx(); break;
        case 'gorilla': gorillaSfx(); break;
      }
    },
    startMusic: function (type, floorIndex) {
      resume();
      startMusic(type, floorIndex);
    },
    stopMusic: stopMusic,
    toggleMute: toggleMute,
    isMuted: function () { return muted; },
    currentMusic: function () { return currentMusic; },
  };
})();
