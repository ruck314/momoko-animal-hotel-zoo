/* songs.js – Animal Hotel Zoo soundtrack for the Game.music sequencer.

   Every piece quotes the same little "front desk" motif (scale degrees
   3-5-6-5, e.g. A C D C in F) so the floors feel like one hotel:
     title    grand-hotel waltz, Bb major, 3/4
     bgm0     Lobby: swing lounge, F major (clarinet, epiano, upright walk, brushes)
     bgm1     Safari Wing: sunny marimba / kalimba groove, D major
     bgm2     Wild Wing: woodland 6/8 trot, E minor / G major (flute, guitar)
     bgm3     Magic Wing: Eb lydian dream (celesta, choir, harp)
     lullaby  bedtime music box, G major, 3/4
   Floor songs are picked by audio.startMusic('bgm', floor) as 'bgm' + floor. */
(function () {
  'use strict';
  window.Game = window.Game || {};

  Game.songs = {
    /* ---- Title: "The Grand Welcome" -------------------------------- */
    title: {
      bpm: 132, beatsPerBar: 3, level: 1,
      reverb: { size: 2.6 }, delay: { beats: 1.5, feedback: 0.22 },
      tracks: {
        lead:  { inst: 'flute', vol: 0.62, pan: 0.05, rev: 0.35, dly: 0.12 },
        chime: { inst: 'bell', vol: 0.32, pan: 0.25, rev: 0.5 },
        horn:  { inst: 'brass', vol: 0.3, pan: -0.2, rev: 0.4, bright: 3 },
        pad:   { inst: 'strings', vol: 0.32, auto: 'pad', octave: 4, rev: 0.45, attack: 0.3 },
        waltz: { inst: 'piano', vol: 0.36, auto: 'stab', rhythm: '....x...x...', octave: 4, gate: 0.7, pan: -0.15 },
        harp:  { inst: 'pluck', vol: 0.2, auto: 'arp', pattern: 'up', rate: 0.5, octave: 4, range: 2, voices: 3, pan: 0.3, rev: 0.4 },
        bass:  { inst: 'bass', vol: 0.5, auto: 'bass', style: 'root5', rhythm: 'x...........', octave: 3, gate: 0.8 },
        drums: { vol: 0.4, rev: 0.25 }
      },
      grooves: {
        w: { kick: 'o...........', tri: 'x' + new Array(48).join('.') }
      },
      sections: {
        A: {
          chords: 'Bb:3 Bb/D:3 Eb:3 F7:3 Gm:3 C7:3 F7:3 Bb:3', drums: 'w', horn: false,
          lead:  'D5:1 F5 G5 | F5:2 D5:1 | Eb5:1 G5 Bb5 | A5:2 F5:1 | G5:2 D5:1 | E5:1 G5 Bb5 | A5:1.5 G5:0.5 Eb5:1 | D5:3',
          chime: 'D6:1 F6 G6 | F6:2 r:1 | r:18'
        },
        B: {
          chords: 'Ebmaj7:3 Ebm6:3 Bb/D:3 G7:3 Cm7:3 F7:3 Bb:3 F7:3', drums: 'w',
          lead: 'G5:2 F5:1 | Gb5:2 Eb5:1 | D5:1 F5 Bb5 | B5:2 G5:1 | C6:1.5 Bb5:0.5 G5:1 | A5:1 F5 Eb5 | D5:1 Eb5 F5 | A4:1 C5 Eb5',
          horn: 'G4:3 | Gb4:3 | F4:3 | F4:3 | Eb4:3 | Eb4:3 | D4:3 | C4:2 Eb4:1'
        },
        A2: {
          chords: 'Bb:3 Bb/D:3 Eb:3 F7:3 Gm:3 C7:3 Cm7:3 F7:3', drums: 'w', horn: false,
          lead:  'D5:1 F5 G5 | F5:2 D5:1 | Eb5:1 G5 Bb5 | A5:2 F5:1 | Bb5:2 G5:1 | G5:1 Bb5 C6 | Eb5:1.5 D5:0.5 C5:1 | A4:1 C5 F5',
          chime: 'D6:1 F6 G6 | F6:2 r:1 | r:12 | C6:3 | r:3'
        }
      },
      form: 'A B A2'
    },

    /* ---- Floor 1: Lobby lounge -------------------------------------- */
    bgm0: {
      bpm: 100, swing: 0.28, level: 1,
      reverb: { size: 1.8 }, delay: { beats: 0.75, feedback: 0.2 },
      tracks: {
        lead:  { inst: 'reed', vol: 0.62, pan: 0.12, rev: 0.25, dly: 0.08, vib: 8 },
        keys:  { inst: 'epiano', vol: 0.5, auto: 'stab', rhythm: 'x.....x.........', octave: 4, gate: 0.6, pan: -0.2, rev: 0.2 },
        pad:   { inst: 'strings', vol: 0.2, auto: 'pad', octave: 4, rev: 0.4, attack: 0.5, release: 0.6 },
        bass:  { inst: 'upright', vol: 0.8, auto: 'bass', style: 'walk', rhythm: 'x...x...x...x...', octave: 3, gate: 0.9 },
        drums: { vol: 0.5, rev: 0.12 }
      },
      grooves: {
        brush:  { brush: 'x...X.o.x...X.o.', hat: '....x.......x...', kick: 'o.......o.......' },
        bridge: { brush: 'x...X.o.x...X.o.', hat: '....x.......x...', kick: 'o.......o.......', rim: '............o...' }
      },
      sections: {
        A: {
          chords: 'Fmaj7:4 D7:4 Gm7:4 C7:4 Am7:2 D7:2 Gm7:2 C7:2 F6:4 Gm7:2 C7:2', drums: 'brush', pad: false,
          lead: 'A4:0.5 C5 D5:1 C5:2 | r:0.5 A4 F#4 A4 C5:1.5 r:0.5 | Bb4:0.5 D5 F5:1 D5:2 | r:0.5 E5 D5 C5 Bb4:1 G4 | ' +
                'A4:1 C5:0.5 E5 F#5:1 E5:0.5 D5 | D5:1.5 Bb4:0.5 C5:1 E4 | F5:2 E5:0.5 C5 A4:1 | r:1 Bb4:0.5 A4 G4:1 E4'
        },
        A2: {
          chords: 'Fmaj7:4 D7:4 Gm7:4 C7:4 Am7:2 D7:2 Gm7:2 C7:2 F6:4 F7:4', drums: 'brush',
          fill: { snare: '........o.o.x.o.' },
          lead: 'A4:0.5 C5 D5:1 C5 A4 | F#4:0.5 A4 D5:1 C5:2 | r:1 D5:0.5 F5 G5:1 F5 | E5:1.5 D5:0.5 C5:1 Bb4 | ' +
                'C5:1 A4 C5:0.5 D5 F#5:1 | F5:1 D5:0.5 Bb4 G4:1 Bb4 | A4:1.5 G4:0.5 F4:2 | r:1 C5:0.5 D5 Eb5:1 C5'
        },
        B: {
          chords: 'Bbmaj7:4 Bbm6:4 Am7:4 D7:4 Gm7:4 C7:4 Am7:2 Abdim7:2 Gm7:2 C7:2', drums: 'bridge',
          fill: { snare: '..........o.x.o.' },
          lead: 'D5:1.5 C5:0.5 D5:1 F5 | F5:2 Db5:1 Bb4 | C5:1.5 B4:0.5 C5:1 E5 | F#5:1.5 E5:0.5 D5:1 C5 | ' +
                'Bb4:1 D5 F5:1.5 E5:0.5 | G5:2 E5:1 C5 | C5:1 E5 D5 B4 | Bb4:1 A4:0.5 G4 E4:1 G4'
        }
      },
      form: 'A A2 B A'
    },

    /* ---- Floor 2: Safari Wing --------------------------------------- */
    bgm1: {
      bpm: 112, swing: 0.06, level: 1,
      reverb: { size: 1.6 }, delay: { beats: 0.75, feedback: 0.22 },
      tracks: {
        lead:  { inst: 'marimba', vol: 0.8, pan: 0.1, rev: 0.22, dly: 0.12 },
        kal:   { inst: 'kalimba', vol: 0.3, auto: 'arp', pattern: 'broken', rate: 0.5, octave: 4, continuous: true, pan: -0.3, rev: 0.25 },
        pad:   { inst: 'pad', vol: 0.32, auto: 'pad', octave: 4, rev: 0.35, cutoff: 1100 },
        bass:  { inst: 'bass', vol: 0.55, auto: 'bass', style: 'root5', rhythm: 'x.....x.x.......', octave: 3, gate: 0.7 },
        drums: { vol: 0.5, rev: 0.1 }
      },
      grooves: {
        sun:  { kick: 'x.......x.......', shaker: 'x.o.X.o.x.ooX.o.', block: 'x..x..x...x.x...' },
        sunB: { kick: 'x.......x.......', shaker: 'x.o.X.o.x.ooX.o.', block: 'x..x..x...x.x...', rim: '....o.......o...' }
      },
      sections: {
        A: {
          chords: 'Dadd9:4 Gmaj7:4 Bm7:4 Asus4:2 A:2 Dadd9:4 Gmaj7:4 Em7:2 A7:2 D:2 A7:2', drums: 'sun',
          lead: 'F#5:0.5 A5 B5 A5:1 F#5:0.5 r:1 | r:0.5 D5 G5 A5 B5:1 G5 | F#5:0.5 F#5 A5 F#5 D5:1 B4 | D5:1 E5 C#5:0.5 C#5 E5:1 | ' +
                'F#5:0.5 A5 B5 A5:1 F#5:0.5 r:1 | r:0.5 B5 D6 C#6 B5:1 F#5 | E5:0.5 G5 B5 G5 A5 G5 E5 C#5 | D5:1 r:0.5 A4 C#5:1 E5'
        },
        A2: {
          chords: 'Dadd9:4 Gmaj7:4 Bm7:4 Asus4:2 A:2 Dadd9:4 Gmaj7:4 Em7:2 A7:2 D:4', drums: 'sun',
          fill: { tom: '........x.x.x.xx' },
          lead: 'F#5:0.5 A5 B5 A5:1 F#5:0.5 r:1 | r:0.5 D5 G5 A5 B5:1 G5 | F#5:0.5 F#5 A5 F#5 D5:1 B4 | D5:1 E5 C#5:0.5 C#5 E5:1 | ' +
                'A5:0.5 B5 A5 F#5 E5:1 F#5 | G5:0.5 A5 B5:1 D6 B5 | G5:1 F#5:0.5 E5 C#5:1 E5:0.5 G5 | F#5:0.5 F#5 D5:1 r:2'
        },
        B: {
          chords: 'Gmaj7:4 A:4 F#m7:4 B7:4 Em7:4 C:4 Em7:2 A7sus4:2 A7:4', drums: 'sunB',
          fill: { block: 'x.x.x.x.x.xxx...' },
          lead: 'B5:0.5 B5 B5 A5 G5:1 D5 | C#6:0.5 C#6 C#6 B5 A5:1 E5 | A5:0.5 A5 A5 B5 A5:1 F#5 | D#5:0.5 F#5 A5 F#5 D#5:1 B4 | ' +
                'E5:0.5 G5 B5:1 D6 B5 | C6:0.5 B5 G5:1 E5 G5 | B5:1 G5 E5 D5 | C#5:0.5 E5 G5 A5 r:2'
        }
      },
      form: 'A A2 B A'
    },

    /* ---- Floor 3: Wild Wing (6/8: beat = eighth note) ---------------- */
    bgm2: {
      bpm: 204, beatsPerBar: 6, stepsPerBeat: 2, level: 1,
      reverb: { size: 2.4 }, delay: { beats: 3, feedback: 0.2, tone: 2200 },
      tracks: {
        lead:  { inst: 'flute', vol: 0.66, pan: 0.08, rev: 0.35, dly: 0.12 },
        gtr:   { inst: 'pluck', vol: 0.3, auto: 'arp', pattern: 'up', rate: 1, octave: 4, voices: 3, pan: -0.25, rev: 0.25, decay: 0.45 },
        pad:   { inst: 'strings', vol: 0.24, auto: 'pad', octave: 4, rev: 0.45, attack: 0.6, release: 0.8 },
        bass:  { inst: 'bass', vol: 0.55, auto: 'bass', style: 'root5', rhythm: 'x.....x.....', octave: 3, gate: 0.85 },
        drums: { vol: 0.45, rev: 0.2 }
      },
      grooves: {
        trot:  { kick: 'x.....o.....', shaker: 'X.o.x.X.o.x.' },
        trotB: { kick: 'x.....o.....', shaker: 'X.o.x.X.o.x.', tom: '..........o.', tri: 'x' + new Array(24).join('.') }
      },
      sections: {
        A: {
          chords: 'Em:6 C:6 G:6 D:6 Em:6 C:6 Am7:3 D:3 G:3 B7:3', drums: 'trot',
          lead: 'E5:2 G5:1 B5:3 | G5:2 A5:1 G5:2 E5:1 | D5:2 G5:1 B5:2 A5:1 | A5:3 F#5:2 D5:1 | ' +
                'E5:2 G5:1 B5:2 C6:1 | E6:2 D6:1 C6:3 | C6:2 B5:1 A5:2 F#5:1 | G5:3 F#5:2 D#5:1'
        },
        A2: {
          chords: 'Em:6 C:6 G:6 D:6 Em:6 C:6 Am7:3 D:3 G:6', drums: 'trot',
          fill: { tom: '......x.x.x.' },
          lead: 'B4:1 E5 G5 B5:3 | C6:2 B5:1 G5:3 | B5:2 A5:1 G5:2 D5:1 | F#5:2 E5:1 D5:3 | ' +
                'G5:2 F#5:1 E5:2 G5:1 | C6:3 G5:2 E5:1 | A5:2 C6:1 D6:2 A5:1 | G5:6'
        },
        B: {
          chords: 'C:6 D:6 Bm7:6 Em:6 Am7:6 D7:6 G:3 Em:3 Cmaj7:3 B7:3', drums: 'trotB',
          fill: { tom: '..x...x.x.x.' },
          lead: 'E5:2 G5:1 C6:3 | D6:2 C6:1 A5:3 | B5:2 A5:1 F#5:3 | G5:3 E5:3 | ' +
                'A5:2 C6:1 E6:3 | D6:2 C6:1 A5:2 F#5:1 | G5:2 A5:1 B5:2 G5:1 | E5:2 G5:1 F#5:2 D#5:1'
        }
      },
      form: 'A A2 B A'
    },

    /* ---- Floor 4: Magic Wing ---------------------------------------- */
    bgm3: {
      bpm: 80, level: 1.12,
      reverb: { size: 3.2 }, delay: { beats: 0.75, feedback: 0.35, tone: 3200 },
      tracks: {
        lead:  { inst: 'bell', vol: 0.75, pan: 0.1, rev: 0.45, dly: 0.25, decay: 1.1 },
        choir: { inst: 'choir', vol: 0.5, auto: 'pad', octave: 4, rev: 0.5, attack: 0.8, release: 1.4 },
        harp:  { inst: 'pluck', vol: 0.26, auto: 'arp', pattern: 'updown', rate: 0.5, octave: 4, range: 2, pan: -0.3, rev: 0.5, decay: 0.7 },
        bass:  { inst: 'bass', vol: 0.42, auto: 'bass', style: 'root5', rhythm: 'x.......x.......', octave: 3, gate: 0.95, tone: 2.5 },
        drums: { vol: 0.4, rev: 0.4 }
      },
      grooves: {
        dream: { tri: 'x' + new Array(32).join('.'), shaker: 'o.o.o.o.o.o.o.o.' }
      },
      sections: {
        A: {
          chords: 'Ebmaj7:4 F/Eb:4 Gm7:4 Cm9:4 Abmaj7:4 Abm6:4 Ebmaj7/G:4 Bb7sus4:2 Bb7:2', drums: 'dream',
          lead: 'G5:0.5 Bb5 C6:1 Bb5:2 | A5:1.5 G5:0.5 F5:2 | D6:1 Bb5 G5 F5 | Eb5:1.5 D5:0.5 C5:2 | ' +
                'Ab5:0.5 C6 Eb6:1 C6:2 | B5:1.5 Ab5:0.5 F5:2 | G5:1 Bb5 D6 Bb5 | Ab5:1 F5 D5 F5'
        },
        B: {
          chords: 'Abmaj7:4 Bb/Ab:4 Gm7:4 C7:4 Fm9:4 Bmaj7:4 Abmaj7:4 Bb7sus4:2 Bb7:2', drums: 'dream',
          lead: 'C6:2 G5:1 Eb5 | D6:2 Bb5:1 F5 | Bb5:1.5 A5:0.5 G5:1 D5 | E5:1 G5 Bb5 C6 | ' +
                'Ab5:1.5 G5:0.5 F5:2 | D#6:1.5 C#6:0.5 A#5:2 | C6:1.5 Bb5:0.5 G5:2 | F5:1 Eb5 D5:2'
        },
        A2: {
          chords: 'Ebmaj7:4 F/Eb:4 Gm7:4 Cm9:4 Abmaj7:4 Abm6:4 Ebmaj7/G:4 Bb7sus4:2 Bb7:2', drums: 'dream',
          lead: 'G5:0.5 Bb5 C6:1 Bb5:2 | A5:1.5 G5:0.5 F5:2 | D6:1 Bb5 G5 F5 | Eb5:1.5 D5:0.5 C5:2 | ' +
                'Ab5:0.5 C6 Eb6:1 C6:2 | B5:1.5 Ab5:0.5 F5:2 | Bb5:1 G5 D5 Eb5 | F5:2 D5'
        }
      },
      form: 'A B A2'
    },

    /* ---- Bedtime (sleep cutscene) ----------------------------------- */
    lullaby: {
      bpm: 76, beatsPerBar: 3, level: 1,
      reverb: { size: 3 }, delay: { beats: 1.5, feedback: 0.25 },
      tracks: {
        lead:  { inst: 'musicbox', vol: 0.8, rev: 0.45, dly: 0.15, decay: 0.9 },
        pad:   { inst: 'choir', vol: 0.4, auto: 'pad', octave: 4, rev: 0.5, attack: 0.9, release: 1.5 },
        harp:  { inst: 'pluck', vol: 0.22, auto: 'arp', pattern: 'up', rate: 1, octave: 4, voices: 3, pan: -0.25, rev: 0.45, decay: 0.8 },
        bass:  { inst: 'bass', vol: 0.4, auto: 'bass', rhythm: 'x...........', octave: 3, gate: 0.9, tone: 2.5 }
      },
      sections: {
        A: {
          chords: 'G:3 Em7:3 Cmaj7:3 D7:3 G:3 C:3 Am7:3 D7:3',
          lead: 'B4:1 D5 E5 | D5:2 B4:1 | C5:1 E5 G5 | F#5:2 D5:1 | B4:1 D5 G5 | E5:2 C5:1 | A4:1 C5 E5 | D5:2 C5:1'
        },
        A2: {
          chords: 'G:3 Bm7:3 Cmaj7:3 Cm6:3 G/D:3 D7:3 G:3 D7sus4:3',
          lead: 'B4:1 D5 E5 | D5:2 F#5:1 | G5:2 E5:1 | Eb5:2 C5:1 | B4:1 D5 G5 | A5:2 F#5:1 | G5:3 | C5:1 A4 G4'
        }
      },
      form: 'A A2'
    }
  };
})();
