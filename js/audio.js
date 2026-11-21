/* audio.js – Web Audio API sound effects & music (music via Game.music) */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var ctx = null;
  var masterGain = null;
  var musicGain = null;
  var sfxGain = null;
  var currentMusic = null;
  var player = null;
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

      player = Game.music.createPlayer(ctx, musicGain);

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

  /* Musical one-shots go through the Game.music instruments; jingleGain
     lifts their softer timbres to the old square-wave loudness. */
  var jingleGain = null;
  function jingleBus() {
    if (!jingleGain) {
      jingleGain = ctx.createGain();
      jingleGain.gain.value = 1.6;
      jingleGain.connect(sfxGain);
    }
    return jingleGain;
  }

  function victoryJingle() {
    if (!ctx) return;
    var M = Game.music, out = jingleBus();
    var notes = ['C5', 'D5', 'E5', 'G5', 'E5', 'G5', 'C6'];
    var dur = [0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.4];
    var time = ctx.currentTime + 0.02, last = notes.length - 1;
    for (var i = 0; i <= last; i++) {
      if (i > 0) time += dur[i - 1];
      M.voice(ctx, out, 'pluck', notes[i], time, dur[i], i === last ? 1 : 0.85, { decay: 0.3 });
      M.voice(ctx, out, 'bell', notes[i], time, dur[i], 0.6, { decay: 0.4 });
    }
    /* Final chord under the top C, with a triangle tap. */
    M.voice(ctx, out, 'epiano', 'E4', time, 0.6, 0.7);
    M.voice(ctx, out, 'epiano', 'G4', time, 0.6, 0.7);
    M.voice(ctx, out, 'epiano', 'C5', time, 0.6, 0.7);
    M.voice(ctx, out, 'bass', 'C3', time, 0.5, 0.8);
    M.drum(ctx, out, 'tri', time, 0.8);
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

  /* Deer: a soft, high fawn bleat, twice. */
  function deerSfx() {
    if (!ctx) return;
    var t = ctx.currentTime;
    for (var i = 0; i < 2; i++) {
      var o = ctx.createOscillator(), g = ctx.createGain(), t0 = t + i * 0.22;
      o.type = 'triangle';
      o.frequency.setValueAtTime(760, t0);
      o.frequency.linearRampToValueAtTime(980, t0 + 0.06);
      o.frequency.exponentialRampToValueAtTime(620, t0 + 0.16);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.2, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.17);
      o.connect(g); g.connect(sfxGain);
      o.start(t0); o.stop(t0 + 0.18);
    }
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
    var M = Game.music, out = jingleBus(), t = ctx.currentTime + 0.01;
    M.voice(ctx, out, 'bell', 'A5', t, 0.25, 0.9, { decay: 0.45 });
    M.voice(ctx, out, 'marimba', 'A4', t, 0.25, 0.5);
    M.voice(ctx, out, 'bell', 'D6', t + 0.12, 0.45, 0.85, { decay: 0.8 });
    M.voice(ctx, out, 'marimba', 'D5', t + 0.12, 0.45, 0.45);
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

  /* ---- Music (Game.music sequencer; songs live in songs.js) ---- */
  /* Hotel BGM is one arrangement per floor ('bgm0'..'bgm3'); riding the
     elevator crossfades between them instead of restarting. */
  function startMusic(type, floorIndex) {
    if (!ctx || muted || !player) { stopMusic(); return; }
    var name = type === 'bgm' ? 'bgm' + (floorIndex || 0) : type;
    var song = Game.songs[name] || Game.songs.bgm0;
    if (player.current() === name) { currentMusic = type; return; }
    player.play(song, { name: name, fade: (type === 'bgm' && currentMusic === 'bgm') ? 1.5 : 0.8 });
    currentMusic = type;
  }

  function stopMusic() {
    if (player) player.stop(0.4);
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
        case 'deer': deerSfx(); break;
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
