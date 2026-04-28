/* levels.js – hotel-floor data (replaces space zones) */
(function () {
  'use strict';
  window.Game = window.Game || {};

  /*
   * Floor data format (compatible with the old zone schema):
   *   name              – display string (e.g. "Floor 2 — Safari Wing")
   *   width / height    – world dimensions in pixels
   *   floorY            – y coord of the corridor floor
   *   bgTop/Mid/Bottom  – wall gradient stops
   *   bgLayer*          – parallax wallpaper colors
   *   floorColorA/B     – carpet stripe colors
   *   decorations[]     – visual-only props (chandelier, lampPost, room sign...)
   *   spawns.player     – { x, y }
   *   spawns.enemies[]  – empty (no combat in the hotel)
   *   spawns.npcs[]     – animalDoor / receptionist / chandelierMonkey /
   *                        elevator / stairs / bedroomDoor / sleepRoomDoor
   *   spawns.pickups[]  – empty (no collectibles in v1)
   */

  /* Wallpaper palettes shared by all floors. */
  var HOTEL_TOP    = '#3a2418';
  var HOTEL_MID    = '#5a3a22';
  var HOTEL_BOTTOM = '#2a1810';
  var CARPET_A     = '#7a3030';
  var CARPET_B     = '#5a2020';

  /* ========== FLOOR 1 — FANCY NYC LOBBY ========== */
  var FLOOR_1_LOBBY = {
    name: 'Floor 1 — Lobby',
    width: 2400,
    height: 480,
    waterSurface: 60,
    floorY: 440,

    /* Burgundy + gold "Plaza"-style palette */
    bgTop: '#3a1010',
    bgMid: '#7a1c2a',
    bgBottom: '#caa040',
    bgLayer0: ['#3a1010', '#4a1818', '#2a0808'],
    bgLayer1: ['#7a1c2a', '#9a2a3a', '#5a1820'],
    bgLayer2: ['#caa040', '#a07a18', '#7a5a18'],

    floorColorA: '#fbf3e6',
    floorColorB: '#e6dcc8',

    showRings: false,

    decorations: [
      /* Marble floor with a long red runner */
      { type: 'marbleFloor',    x: 0,    y: 440, w: 2400 },
      { type: 'corridorCarpet', x: 200,  y: 440, w: 2000 },

      /* Crown molding strip across the top of the wall */
      { type: 'crownMolding',   x: 0,    y: 56, w: 2400 },

      /* Wainscoting (lower wall paneling) */
      { type: 'wainscoting',    x: 0,    y: 320, w: 2400 },

      /* Marble columns flanking the lobby */
      { type: 'fancyColumn', x: 240,  y: 440 },
      { type: 'fancyColumn', x: 600,  y: 440 },
      { type: 'fancyColumn', x: 1380, y: 440 },
      { type: 'fancyColumn', x: 2080, y: 440 },

      /* Three crystal chandeliers — monkeys hang on these */
      { type: 'chandelier', x: 400,  y: 80 },
      { type: 'chandelier', x: 900,  y: 80 },
      { type: 'chandelier', x: 1500, y: 80 },

      /* Reception desk + adjacent decor */
      { type: 'receptionDesk', x: 750,  y: 440 },
      { type: 'velvetRope',    x: 850,  y: 440 },
      { type: 'velvetRope',    x: 920,  y: 440 },
      { type: 'luggageStand',  x: 980,  y: 440 },

      /* Plush velvet armchairs + tall potted palms */
      { type: 'lobbySofa',  x: 1100, y: 440 },
      { type: 'lobbyRug',   x: 1100, y: 440 },
      { type: 'lobbyPlant', x: 480,  y: 440 },
      { type: 'lobbyPlant', x: 1280, y: 440 },
      { type: 'lobbyPlant', x: 1720, y: 440 },
      { type: 'lobbyPlant', x: 1980, y: 440 },

      /* Gilded wall art */
      { type: 'goldFrame',    x: 280,  y: 200, art: 'cityscape' },
      { type: 'goldFrame',    x: 1180, y: 200, art: 'jungle'    },
      { type: 'goldFrame',    x: 1860, y: 200, art: 'sea'       },

      /* Marquee neon over reception */
      { type: 'marqueeSign',  x: 720, y: 130, text: 'THE PLAZA ZOO', color: '#ffd24a' },

      /* Lobby midpoint wayfinder — keeps kids oriented in the wide lobby */
      { type: 'wayfindSign',  x: 1200, y: 440 },

      /* Bedroom door + extra suite */
      { type: 'roomDoorFrame', x: 280,  y: 388, color: '#ff99cc' },
      { type: 'roomDoorFrame', x: 1900, y: 388, color: '#88ddff' },

      /* Peekers — cat + fox stalking Momoko from behind columns */
      { type: 'peeker', x: 600,  y: 200, species: 'cat', side: 1 },
      { type: 'peeker', x: 1380, y: 200, species: 'fox', side: -1 },

      /* Elevator shaft + stairs */
      { type: 'elevatorShaft', x: 2176, y: 440 },
      { type: 'stairwellDoor', x: 2300, y: 440 },
    ],

    spawns: {
      player: { x: 80, y: 380 },
      enemies: [],
      npcs: [
        /* Receptionist greets Momoko */
        { type: 'receptionist', x: 770, y: 380 },

        /* Chandelier monkeys (the first one is the escort monkey) */
        { type: 'chandelierMonkey', x: 400,  y: 110, escort: true },
        { type: 'chandelierMonkey', x: 900,  y: 110 },
        { type: 'chandelierMonkey', x: 1500, y: 110 },

        /* Momoko's bedroom door (with bed inside that triggers the sleep cutscene) */
        { type: 'animalDoor', x: 280,  y: 388, species: 'bedroom' },

        /* Bonus suite — owl reading-nook (extra cozy) */
        { type: 'animalDoor', x: 1900, y: 388, species: 'owl' },

        /* Elevator + stairs */
        { type: 'elevator', x: 2180, y: 388 },
        { type: 'stairs',   x: 2310, y: 388, dir: 'up' },
      ],
      pickups: [],
    },
  };

  /* ========== FLOOR 2 — SAFARI WING ========== */
  var FLOOR_2_SAFARI = {
    name: 'Floor 2 — Safari Wing',
    width: 2900,
    height: 480,
    waterSurface: 60,
    floorY: 440,

    bgTop: '#3a2810',
    bgMid: '#7a5828',
    bgBottom: '#aa7a38',
    bgLayer0: ['#5a3a18', '#6a4820', '#4a3010'],
    bgLayer1: ['#8a6228', '#9a7232', '#7a5220'],
    bgLayer2: ['#3a2810', '#4a3018', '#2a1808'],

    floorColorA: '#c89a4a',
    floorColorB: '#a07832',

    showRings: false,

    decorations: [
      { type: 'corridorCarpet', x: 0, y: 440, w: 2900 },
      { type: 'ceilingBeam', x: 200,  y: 60 },
      { type: 'ceilingBeam', x: 700,  y: 60 },
      { type: 'ceilingBeam', x: 1200, y: 60 },
      { type: 'ceilingBeam', x: 1700, y: 60 },
      { type: 'ceilingBeam', x: 2200, y: 60 },
      { type: 'ceilingBeam', x: 2700, y: 60 },
      { type: 'lobbyPlant',  x: 200,  y: 440 },
      { type: 'lobbyPlant',  x: 2550, y: 440 },
      { type: 'wallPainting', x: 600,  y: 200, art: 'savanna' },
      { type: 'wallPainting', x: 1900, y: 200, art: 'savanna' },
      { type: 'neonSign',     x: 100,  y: 200, text: 'SAFARI', color: '#ffaa44' },

      /* Mid-corridor lounge that breaks up the long hallway. */
      { type: 'commonArea', x: 1300, y: 440, w: 220, theme: 'safari',
        label: 'SAFARI LOUNGE' },

      { type: 'roomDoorFrame', x: 320,  y: 388, color: '#cc8844' }, /* elephant */
      { type: 'roomDoorFrame', x: 600,  y: 388, color: '#dd9944' }, /* lion */
      { type: 'roomDoorFrame', x: 880,  y: 388, color: '#aa6644' }, /* tiger */
      { type: 'roomDoorFrame', x: 1160, y: 388, color: '#664422' }, /* bear */
      { type: 'roomDoorFrame', x: 1440, y: 388, color: '#ddbb66' }, /* giraffe */
      { type: 'roomDoorFrame', x: 1720, y: 388, color: '#ddddee' }, /* zebra */
      { type: 'roomDoorFrame', x: 2000, y: 388, color: '#7a6a8a' }, /* hippo */
      { type: 'roomDoorFrame', x: 2280, y: 388, color: '#9a9088' }, /* rhino */

      { type: 'peeker', x: 720, y: 200, species: 'monkey', side: 1 },
      { type: 'peeker', x: 1500, y: 200, species: 'monkey', side: -1 },

      { type: 'elevatorShaft', x: 2676, y: 440 },
      { type: 'stairwellDoor', x: 2800, y: 440 },
    ],

    spawns: {
      player: { x: 80, y: 380 },
      enemies: [],
      npcs: [
        { type: 'animalDoor', x: 320,  y: 388, species: 'elephant' },
        { type: 'animalDoor', x: 600,  y: 388, species: 'lion'     },
        { type: 'animalDoor', x: 880,  y: 388, species: 'tiger'    },
        { type: 'animalDoor', x: 1160, y: 388, species: 'bear'     },
        { type: 'animalDoor', x: 1440, y: 388, species: 'giraffe'  },
        { type: 'animalDoor', x: 1720, y: 388, species: 'zebra'    },
        { type: 'animalDoor', x: 2000, y: 388, species: 'hippo'    },
        { type: 'animalDoor', x: 2280, y: 388, species: 'rhino'    },
        { type: 'elevator',   x: 2680, y: 388 },
        { type: 'stairs',     x: 2810, y: 388, dir: 'both' },
      ],
      pickups: [],
    },
  };

  /* ========== FLOOR 3 — WILD WING ========== */
  var FLOOR_3_WILD = {
    name: 'Floor 3 — Wild Wing',
    width: 2900,
    height: 480,
    waterSurface: 60,
    floorY: 440,

    bgTop: '#1a2818',
    bgMid: '#284028',
    bgBottom: '#3a5838',
    bgLayer0: ['#1f3018', '#284028', '#152010'],
    bgLayer1: ['#3a5828', '#4a6838', '#284018'],
    bgLayer2: ['#1a2810', '#283820', '#101810'],

    floorColorA: '#4a6838',
    floorColorB: '#324a28',

    showRings: false,

    decorations: [
      { type: 'corridorCarpet', x: 0, y: 440, w: 2900 },
      { type: 'ceilingBeam', x: 200,  y: 60 },
      { type: 'ceilingBeam', x: 700,  y: 60 },
      { type: 'ceilingBeam', x: 1200, y: 60 },
      { type: 'ceilingBeam', x: 1700, y: 60 },
      { type: 'ceilingBeam', x: 2200, y: 60 },
      { type: 'ceilingBeam', x: 2700, y: 60 },
      { type: 'lobbyPlant',  x: 200,  y: 440 },
      { type: 'lobbyPlant',  x: 2550, y: 440 },
      { type: 'wallPainting', x: 600,  y: 200, art: 'forest' },
      { type: 'wallPainting', x: 1900, y: 200, art: 'forest' },
      { type: 'neonSign',     x: 100,  y: 200, text: 'WILD', color: '#88ff88' },

      /* Mid-corridor forest glade. */
      { type: 'commonArea', x: 1300, y: 440, w: 220, theme: 'forest',
        label: 'FOREST GLADE' },

      { type: 'roomDoorFrame', x: 320,  y: 388, color: '#5a5a8a' }, /* wolf */
      { type: 'roomDoorFrame', x: 600,  y: 388, color: '#8a6a3a' }, /* eagle */
      { type: 'roomDoorFrame', x: 880,  y: 388, color: '#cc7733' }, /* fox */
      { type: 'roomDoorFrame', x: 1160, y: 388, color: '#666688' }, /* owl */
      { type: 'roomDoorFrame', x: 1440, y: 388, color: '#222222' }, /* panda */
      { type: 'roomDoorFrame', x: 1720, y: 388, color: '#88aacc' }, /* penguin */
      { type: 'roomDoorFrame', x: 2000, y: 388, color: '#fafafa' }, /* polar bear */
      { type: 'roomDoorFrame', x: 2280, y: 388, color: '#3a3a3a' }, /* gorilla */

      { type: 'peeker', x: 760, y: 200, species: 'monkey', side: 1 },
      { type: 'peeker', x: 1500, y: 200, species: 'monkey', side: -1 },

      { type: 'elevatorShaft', x: 2676, y: 440 },
      { type: 'stairwellDoor', x: 2800, y: 440 },
    ],

    spawns: {
      player: { x: 80, y: 380 },
      enemies: [],
      npcs: [
        { type: 'animalDoor', x: 320,  y: 388, species: 'wolf'      },
        { type: 'animalDoor', x: 600,  y: 388, species: 'eagle'     },
        { type: 'animalDoor', x: 880,  y: 388, species: 'fox'       },
        { type: 'animalDoor', x: 1160, y: 388, species: 'owl'       },
        { type: 'animalDoor', x: 1440, y: 388, species: 'panda'     },
        { type: 'animalDoor', x: 1720, y: 388, species: 'penguin'   },
        { type: 'animalDoor', x: 2000, y: 388, species: 'polarBear' },
        { type: 'animalDoor', x: 2280, y: 388, species: 'gorilla'   },
        { type: 'elevator',   x: 2680, y: 388 },
        { type: 'stairs',     x: 2810, y: 388, dir: 'both' },
      ],
      pickups: [],
    },
  };

  /* ========== FLOOR 4 — MAGIC WING ========== */
  var FLOOR_4_PETS = {
    name: 'Floor 4 — Magic Wing',
    width: 3200,
    height: 480,
    waterSurface: 60,
    floorY: 440,

    bgTop: '#2a1840',
    bgMid: '#4a2870',
    bgBottom: '#6a3aa0',
    bgLayer0: ['#3a1860', '#4a2078', '#2a1450'],
    bgLayer1: ['#7a4ac0', '#8a5acc', '#6a3aa8'],
    bgLayer2: ['#2a1448', '#3a1c58', '#180830'],

    floorColorA: '#a468d4',
    floorColorB: '#7a48a8',

    showRings: false,

    decorations: [
      { type: 'corridorCarpet', x: 0, y: 440, w: 3200 },
      { type: 'ceilingBeam', x: 200,  y: 60 },
      { type: 'ceilingBeam', x: 700,  y: 60 },
      { type: 'ceilingBeam', x: 1200, y: 60 },
      { type: 'ceilingBeam', x: 1700, y: 60 },
      { type: 'ceilingBeam', x: 2200, y: 60 },
      { type: 'ceilingBeam', x: 2700, y: 60 },
      { type: 'ceilingBeam', x: 3100, y: 60 },
      { type: 'lobbyPlant',  x: 200,  y: 440 },
      { type: 'lobbyPlant',  x: 2850, y: 440 },
      { type: 'wallPainting', x: 600,  y: 200, art: 'sea'    },
      { type: 'wallPainting', x: 2200, y: 200, art: 'rainbow'},
      { type: 'neonSign',     x: 100,  y: 200, text: 'MAGIC', color: '#ff66cc' },

      /* Mid-corridor magic garden. */
      { type: 'commonArea', x: 1300, y: 440, w: 220, theme: 'magic',
        label: 'MAGIC GARDEN' },

      { type: 'roomDoorFrame', x: 320,  y: 388, color: '#ffeecc' }, /* bunny */
      { type: 'roomDoorFrame', x: 600,  y: 388, color: '#ffaa88' }, /* cat */
      { type: 'roomDoorFrame', x: 880,  y: 388, color: '#aa7744' }, /* dog */
      { type: 'roomDoorFrame', x: 1160, y: 388, color: '#88aaee' }, /* sea otter */
      { type: 'roomDoorFrame', x: 1440, y: 388, color: '#cc8855' }, /* kangaroo */
      { type: 'roomDoorFrame', x: 1720, y: 388, color: '#ff99ee' }, /* unicorn */
      { type: 'roomDoorFrame', x: 2000, y: 388, color: '#88ff88' }, /* alien */
      { type: 'roomDoorFrame', x: 2280, y: 388, color: '#a8a8b8' }, /* koala */
      { type: 'roomDoorFrame', x: 2560, y: 388, color: '#5fc858' }, /* frog */

      { type: 'peeker', x: 760, y: 200, species: 'monkey', side: 1 },
      { type: 'peeker', x: 1900, y: 200, species: 'monkey', side: -1 },

      { type: 'elevatorShaft', x: 2976, y: 440 },
      { type: 'stairwellDoor', x: 3100, y: 440 },
    ],

    spawns: {
      player: { x: 80, y: 380 },
      enemies: [],
      npcs: [
        { type: 'animalDoor', x: 320,  y: 388, species: 'bunny'    },
        { type: 'animalDoor', x: 600,  y: 388, species: 'cat'      },
        { type: 'animalDoor', x: 880,  y: 388, species: 'dog'      },
        { type: 'animalDoor', x: 1160, y: 388, species: 'seaOtter' },
        { type: 'animalDoor', x: 1440, y: 388, species: 'kangaroo' },
        { type: 'animalDoor', x: 1720, y: 388, species: 'unicorn'  },
        { type: 'animalDoor', x: 2000, y: 388, species: 'alien'    },
        { type: 'animalDoor', x: 2280, y: 388, species: 'koala'    },
        { type: 'animalDoor', x: 2560, y: 388, species: 'frog'     },
        { type: 'elevator',   x: 2980, y: 388 },
        { type: 'stairs',     x: 3110, y: 388, dir: 'down' },
      ],
      pickups: [],
    },
  };

  window.Game.levels = {
    data: [FLOOR_1_LOBBY, FLOOR_2_SAFARI, FLOOR_3_WILD, FLOOR_4_PETS],
    get: function (index) { return this.data[index] || null; },
    count: function () { return this.data.length; }
  };
})();
