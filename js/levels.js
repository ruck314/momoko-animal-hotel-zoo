/* levels.js – hotel-floor data (replaces space zones) */
(function () {
  'use strict';
  window.Game = window.Game || {};

  /*
   * Floor data format (compatible with the old zone schema):
   *   name              – display string (e.g. "Floor 2 — Safari Wing")
   *   width / height    – world dimensions in pixels
   *   floorY            – y coord of the corridor floor
   *   wing              – 'lobby' | 'safari' | 'wild' | 'magic': picks the
   *                       wallpaper, trim, carpet, lamps and window view
   *                       (WINGS in engine.js)
   *   windows[]         – world x of each window's centre
   *   decorations[]     – visual-only props (chandelier, lampPost, room sign...)
   *   spawns.player     – { x, y }
   *   spawns.enemies[]  – empty (no combat in the hotel)
   *   spawns.npcs[]     – animalDoor / receptionist / chandelierMonkey /
   *                        elevator / stairs / bedroomDoor / sleepRoomDoor
   *   spawns.pickups[]  – empty (no collectibles in v1)
   */

  /* ========== FLOOR 1 — FANCY NYC LOBBY ========== */
  var FLOOR_1_LOBBY = {
    name: 'Floor 1 — Lobby',
    wing: 'lobby',
    windows: [500, 1010, 1640],
    width: 2400,
    height: 480,
    waterSurface: 60,
    floorY: 440,

    decorations: [
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
      { type: 'marqueeSign',  x: 720, y: 130, textKey: 'signPlazaZoo', color: '#ffd24a' },

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

        /* Elevator + stairs (lobby has only one set, on the right) */
        { type: 'elevator', x: 2180, y: 388, side: 'right' },
        { type: 'stairs',   x: 2310, y: 388, dir: 'up', side: 'right' },
      ],
      pickups: [],
    },
  };

  /* ========== FLOOR 2 — SAFARI WING ========== */
  var FLOOR_2_SAFARI = {
    name: 'Floor 2 — Safari Wing',
    wing: 'safari',
    windows: [684, 964, 1244, 1524, 1804, 2084, 2364],
    width: 2900,
    height: 480,
    waterSurface: 60,
    floorY: 440,

    decorations: [
      { type: 'lobbyPlant',  x: 2550, y: 440 },
      { type: 'wallPainting', x: 824,  y: 214, art: 'savanna' },
      { type: 'wallPainting', x: 1944, y: 214, art: 'savanna' },
      { type: 'wingPlaque',   x: 400,  y: 160, textKey: 'destCheeseMoon' },

      /* Mid-corridor lounge that breaks up the long hallway. */
      { type: 'commonArea', x: 1300, y: 440, w: 220, theme: 'safari',
        label: 'SAFARI LOUNGE' },

      { type: 'roomDoorFrame', x: 520,  y: 388, color: '#cc8844' }, /* elephant */
      { type: 'roomDoorFrame', x: 800,  y: 388, color: '#dd9944' }, /* lion */
      { type: 'roomDoorFrame', x: 1080, y: 388, color: '#aa6644' }, /* tiger */
      { type: 'roomDoorFrame', x: 1360, y: 388, color: '#664422' }, /* bear */
      { type: 'roomDoorFrame', x: 1640, y: 388, color: '#ddbb66' }, /* giraffe */
      { type: 'roomDoorFrame', x: 1920, y: 388, color: '#ddddee' }, /* zebra */
      { type: 'roomDoorFrame', x: 2200, y: 388, color: '#7a6a8a' }, /* hippo */
      { type: 'roomDoorFrame', x: 2480, y: 388, color: '#9a9088' }, /* rhino */

      { type: 'peeker', x: 1040, y: 200, species: 'monkey', side: 1 },
      { type: 'peeker', x: 1728, y: 200, species: 'monkey', side: -1 },

      /* LEFT elevator + stairs (new in v0.8) */
      { type: 'elevatorShaft', x: 116, y: 440 },
      { type: 'stairwellDoor', x: 230, y: 440 },

      /* RIGHT elevator + stairs */
      { type: 'elevatorShaft', x: 2676, y: 440 },
      { type: 'stairwellDoor', x: 2800, y: 440 },
    ],

    spawns: {
      player: { x: 80, y: 380 },
      enemies: [],
      npcs: [
        /* LEFT-side transit — symmetric exits so the player isn't forced
           to walk all the way across the floor to leave. */
        { type: 'elevator',   x: 120,  y: 388, side: 'left' },
        { type: 'stairs',     x: 240,  y: 388, dir: 'both', side: 'left' },

        { type: 'animalDoor', x: 520,  y: 388, species: 'elephant' },
        { type: 'animalDoor', x: 800,  y: 388, species: 'lion'     },
        { type: 'animalDoor', x: 1080, y: 388, species: 'tiger'    },
        { type: 'animalDoor', x: 1360, y: 388, species: 'bear'     },
        { type: 'animalDoor', x: 1640, y: 388, species: 'giraffe'  },
        { type: 'animalDoor', x: 1920, y: 388, species: 'zebra'    },
        { type: 'animalDoor', x: 2200, y: 388, species: 'hippo'    },
        { type: 'animalDoor', x: 2480, y: 388, species: 'rhino'    },

        { type: 'elevator',   x: 2680, y: 388, side: 'right' },
        { type: 'stairs',     x: 2810, y: 388, dir: 'both', side: 'right' },
      ],
      pickups: [],
    },
  };

  /* ========== FLOOR 3 — WILD WING ========== */
  var FLOOR_3_WILD = {
    name: 'Floor 3 — Wild Wing',
    wing: 'wild',
    windows: [684, 964, 1244, 1524, 1804, 2084, 2364],
    width: 2900,
    height: 480,
    waterSurface: 60,
    floorY: 440,

    decorations: [
      { type: 'lobbyPlant',  x: 2550, y: 440 },
      { type: 'wallPainting', x: 824,  y: 214, art: 'forest' },
      { type: 'wallPainting', x: 1944, y: 214, art: 'forest' },
      { type: 'wingPlaque',   x: 400,  y: 160, textKey: 'destFloor3' },

      /* Mid-corridor forest glade. */
      { type: 'commonArea', x: 1300, y: 440, w: 220, theme: 'forest',
        label: 'FOREST GLADE' },

      { type: 'roomDoorFrame', x: 520,  y: 388, color: '#5a5a8a' }, /* wolf */
      { type: 'roomDoorFrame', x: 800,  y: 388, color: '#8a6a3a' }, /* eagle */
      { type: 'roomDoorFrame', x: 1080, y: 388, color: '#cc7733' }, /* fox */
      { type: 'roomDoorFrame', x: 1360, y: 388, color: '#666688' }, /* owl */
      { type: 'roomDoorFrame', x: 1640, y: 388, color: '#222222' }, /* panda */
      { type: 'roomDoorFrame', x: 1920, y: 388, color: '#88aacc' }, /* penguin */
      { type: 'roomDoorFrame', x: 2200, y: 388, color: '#fafafa' }, /* polar bear */
      { type: 'roomDoorFrame', x: 2480, y: 388, color: '#3a3a3a' }, /* gorilla */

      { type: 'peeker', x: 1040, y: 200, species: 'monkey', side: 1 },
      { type: 'peeker', x: 1728, y: 200, species: 'monkey', side: -1 },

      /* LEFT elevator + stairs */
      { type: 'elevatorShaft', x: 116, y: 440 },
      { type: 'stairwellDoor', x: 230, y: 440 },

      /* RIGHT elevator + stairs */
      { type: 'elevatorShaft', x: 2676, y: 440 },
      { type: 'stairwellDoor', x: 2800, y: 440 },
    ],

    spawns: {
      player: { x: 80, y: 380 },
      enemies: [],
      npcs: [
        { type: 'elevator',   x: 120,  y: 388, side: 'left' },
        { type: 'stairs',     x: 240,  y: 388, dir: 'both', side: 'left' },

        { type: 'animalDoor', x: 520,  y: 388, species: 'wolf'      },
        { type: 'animalDoor', x: 800,  y: 388, species: 'eagle'     },
        { type: 'animalDoor', x: 1080, y: 388, species: 'fox'       },
        { type: 'animalDoor', x: 1360, y: 388, species: 'owl'       },
        { type: 'animalDoor', x: 1640, y: 388, species: 'panda'     },
        { type: 'animalDoor', x: 1920, y: 388, species: 'penguin'   },
        { type: 'animalDoor', x: 2200, y: 388, species: 'polarBear' },
        { type: 'animalDoor', x: 2480, y: 388, species: 'gorilla'   },

        { type: 'elevator',   x: 2680, y: 388, side: 'right' },
        { type: 'stairs',     x: 2810, y: 388, dir: 'both', side: 'right' },
      ],
      pickups: [],
    },
  };

  /* ========== FLOOR 4 — MAGIC WING ========== */
  var FLOOR_4_PETS = {
    name: 'Floor 4 — Magic Wing',
    wing: 'magic',
    windows: [684, 964, 1244, 1524, 1804, 2084, 2364, 2644],
    width: 3200,
    height: 480,
    waterSurface: 60,
    floorY: 440,

    decorations: [
      { type: 'lobbyPlant',  x: 2850, y: 440 },
      { type: 'wallPainting', x: 824,  y: 214, art: 'sea'    },
      { type: 'wallPainting', x: 2224, y: 214, art: 'rainbow'},
      { type: 'wingPlaque',   x: 400,  y: 160, textKey: 'destFloor4' },

      /* Mid-corridor magic garden. */
      { type: 'commonArea', x: 1300, y: 440, w: 220, theme: 'magic',
        label: 'MAGIC GARDEN' },

      { type: 'roomDoorFrame', x: 520,  y: 388, color: '#ffeecc' }, /* bunny */
      { type: 'roomDoorFrame', x: 800,  y: 388, color: '#ffaa88' }, /* cat */
      { type: 'roomDoorFrame', x: 1080, y: 388, color: '#aa7744' }, /* dog */
      { type: 'roomDoorFrame', x: 1360, y: 388, color: '#88aaee' }, /* sea otter */
      { type: 'roomDoorFrame', x: 1640, y: 388, color: '#cc8855' }, /* kangaroo */
      { type: 'roomDoorFrame', x: 1920, y: 388, color: '#ff99ee' }, /* unicorn */
      { type: 'roomDoorFrame', x: 2200, y: 388, color: '#88ff88' }, /* alien */
      { type: 'roomDoorFrame', x: 2480, y: 388, color: '#a8a8b8' }, /* koala */
      { type: 'roomDoorFrame', x: 2760, y: 388, color: '#5fc858' }, /* frog */

      { type: 'peeker', x: 1040, y: 200, species: 'monkey', side: 1 },
      { type: 'peeker', x: 2288, y: 200, species: 'monkey', side: -1 },

      /* LEFT elevator + stairs */
      { type: 'elevatorShaft', x: 116, y: 440 },
      { type: 'stairwellDoor', x: 230, y: 440 },

      /* RIGHT elevator + stairs */
      { type: 'elevatorShaft', x: 2976, y: 440 },
      { type: 'stairwellDoor', x: 3100, y: 440 },
    ],

    spawns: {
      player: { x: 80, y: 380 },
      enemies: [],
      npcs: [
        { type: 'elevator',   x: 120,  y: 388, side: 'left' },
        { type: 'stairs',     x: 240,  y: 388, dir: 'both', side: 'left' },

        { type: 'animalDoor', x: 520,  y: 388, species: 'bunny'    },
        { type: 'animalDoor', x: 800,  y: 388, species: 'cat'      },
        { type: 'animalDoor', x: 1080, y: 388, species: 'dog'      },
        { type: 'animalDoor', x: 1360, y: 388, species: 'seaOtter' },
        { type: 'animalDoor', x: 1640, y: 388, species: 'kangaroo' },
        { type: 'animalDoor', x: 1920, y: 388, species: 'unicorn'  },
        { type: 'animalDoor', x: 2200, y: 388, species: 'alien'    },
        { type: 'animalDoor', x: 2480, y: 388, species: 'koala'    },
        { type: 'animalDoor', x: 2760, y: 388, species: 'frog'     },

        { type: 'elevator',   x: 2980, y: 388, side: 'right' },
        { type: 'stairs',     x: 3110, y: 388, dir: 'both', side: 'right' },
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
