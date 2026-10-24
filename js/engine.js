/* engine.js – game loop, state machine, camera, collision, rendering */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var W = 800, H = 480;
  /* On touch devices we pad the canvas around the 800×480 game viewport
     so thumbs never cover the playfield and the canvas can match the
     screen's aspect ratio (so it scales up to fill the display).

     Horizontal strips: D-pad on the left, BUBBLE on the right. The left
     strip is wider so the D-pad has breathing room on narrow iPhones.

     Vertical bezels: when the screen is taller-aspect than the base
     canvas (iPads, ChromeOS tablets), extra space is split equally above
     and below the game viewport so the canvas can be scaled up to use
     the full screen height instead of being letterboxed.

     GAME_X / GAME_Y are the offsets where the game viewport begins
     inside the canvas; the render loop translates by them so game code
     keeps using logical 0..W, 0..H coordinates. */
  var TOUCH_LEFT_W = 260;
  var TOUCH_RIGHT_W = 200;
  var CANVAS_W = W;
  var CANVAS_H = H;
  var GAME_X = 0;
  var GAME_Y = 0;
  /* Version stamp shown on the title screen and pause menu. Bump manually
     at release time and tag the matching git release (`git tag vX.Y.Z`)
     so the in-game stamp lines up with the git tag for debugging. */
  Game.VERSION = 'v0.19.0';
  Game.BUILD = '';
  var canvas, ctx;

  /* ---- Save keys ----
     Every game on ruck314.github.io shares one localStorage origin. This
     game was forked from the space game and kept writing its
     'momoko-space-*' keys, so the two clobbered each other. Everything
     now goes through KEY(); ui.js reaches it via Game.saveKey. */
  var NS = 'momoko-hotel-';
  function KEY(n) { return NS + n; }
  Game.saveKey = KEY;

  /* One-time copy of the old shared keys so an existing player keeps
     their Momoko. Only fills keys the hotel doesn't have yet, and never
     writes the space keys. */
  function migrateSpaceKeys() {
    var names = ['customization', 'furniture', 'quests'];
    try {
      for (var i = 0; i < names.length; i++) {
        if (localStorage.getItem(KEY(names[i])) !== null) continue;
        var old = localStorage.getItem('momoko-space-' + names[i]);
        if (old !== null) localStorage.setItem(KEY(names[i]), old);
      }
    } catch (e) { /* storage may be disabled */ }
  }

  /* ---- Game state ---- */
  var State = {
    TITLE: 'title',
    CUSTOMIZE: 'customize',
    INTRO: 'intro',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameOver',
    VICTORY: 'victory',
    BEACH: 'beach',
    TRAVEL_MENU: 'travelMenu',
    ROCKET_ANIM: 'rocketAnim',
    HOUSE_INTERIOR: 'houseInterior',
    CAFE_INTERIOR: 'cafeInterior',
    SHOP_INTERIOR: 'shopInterior',
    /* Hotel-zoo additions: */
    ANIMAL_ROOM: 'animalRoom',
    SLEEP_CUTSCENE: 'sleepCutscene',
    LOBBY_INTRO: 'lobbyIntro',
    BOOKSHELF_CUTSCENE: 'bookshelfCutscene',
    LEDGER: 'ledger',
  };
  var state = State.TITLE;
  var prevState = null;

  /* ---- Customization defaults ----
     Split across two concerns: tintable colors (hair/suit/skin/flipper) and
     swappable variants (hairStyle/outfit/shoes/crab/food). Variants are
     strings that the sprite painter branches on; 'none' means skip. */
  Game.customization = {
    hair: '#e06088',
    suit: '#e06088',
    skin: '#ffddbb',
    flipper: '#ff99cc',
    hairStyle: 'twinTails',
    outfit: 'frillyDress',
    shoes: 'maryJane',
    crab: 'none',
    food: 'none',
  };

  /* Quest state – persisted in localStorage. */
  Game.quests = {
    lila: 'notStarted',      /* 'notStarted' | 'inProgress' | 'done' */
    migword: 'notStarted',
    progress: { gems: 0, cheese: 0 },
  };

  /* Shop delivery state – items the hero has purchased and is carrying.
     Each entry: { type: <furniture-type> }. Cleared (deposited) when
     she enters a houseDoor. */
  Game.shop = {
    cart: [],
    MAX: 4,
  };

  /* ---- Camera ---- */
  var camera = { x: 0, y: 0 };

  /* ---- Level & entities ---- */
  var level = null;
  var player = null;
  var bubbles = [];
  var enemies = [];
  var npcs = []; /* { entity, type } */
  var pickups = [];
  var particles = [];
  var wolfe = null;
  var npcCooldowns = {};
  /* Rings-view cutscene trigger arming. Fires when the player floats above
     the scene's upper-sky line, re-arms after they descend back below. */
  var beachReady = true;
  /* Current zone index for multi-planet travel (0 = hero's planet, 1 = moon). */
  var currentZone = 0;
  /* Rocket travel animation timer & destination. */
  var rocketAnimTimer = 0;
  var rocketTarget = 0;
  /* House interior state. */
  var currentHouseId = null;
  /* Hotel-zoo: which animal room is open, sleep cutscene timer, lobby intro
     timer. The lobby intro is a scripted state where a chandelier monkey
     drops down and walks Momoko to the elevator on first check-in. */
  Game.currentRoom = null;
  Game.flags = Game.flags || { checkedIn: false, stamps: {}, stampCount: 0 };
  if (!Game.flags.stamps) Game.flags.stamps = {};
  var sleepCutsceneTimer = 0;
  var lobbyIntroTimer = 0;
  /* Tracks the escort monkey's animation state during LOBBY_INTRO. */
  var lobbyIntroPhase = 'drop'; /* 'drop' | 'walk' | 'done' */
  /* Per-session guard so the auto-greeting only schedules once even if
     the player walks in and out of PLAYING (e.g. opens the pause menu). */
  var lobbyIntroAutoFired = false;
  /* Bookshelf cutscene: timer + current page (0..N-1). The receptionist
     walks in from the door, sits, then narrates pages of a public-domain
     fairy tale. The player advances pages with the action button. */
  var bookshelfTimer = 0;
  var bookshelfPage = 0;
  /* Where to return after closing the ledger (PLAYING vs ANIMAL_ROOM). */
  var ledgerPrevState = null;

  /* Dialogue message queued during the playing-state render; drawn in
     canvas-space after the game viewport is painted so it can live in
     the bottom bezel instead of covering gameplay. */
  var pendingDialogue = null;

  /* ---- Hotel interior backdrop ----
     Every floor is a hotel corridor seen side-on: ceiling + crown
     moulding, a wallpapered wall with windows and pendant lamps, a
     wainscot below the chair rail, and a flat floor whose top edge is
     level.floorY (so entities, doors and the elevator never shift).
     level.wing picks the palette, wallpaper motif, window view and lamp.
     Wallpaper is a pattern tile painted once per wing; everything else
     is either fixed geometry or seeded from world x, so no scenery calls
     Math.random() per frame. */
  var CEIL_Y = 34;   /* bottom edge of the ceiling plane */
  var WALL_Y = 54;   /* bottom edge of the crown moulding */
  var RAIL_Y = 340;  /* top of the chair rail */
  var BASE_Y = 428;  /* top of the skirting board */
  var WINGS = {
    lobby: {
      ceil: '#3e1018', ceilHi: '#6a2030', wall: '#eedbb2', motif: '#d6b468',
      trim: '#caa040', trimHi: '#fcd870', trimLo: '#7a5a18',
      wains: '#6a2a24', wainsHi: '#8e4034', wainsLo: '#3e1410',
      floor: 'marble', carpet: '#8a1c2c', carpetHi: '#b23446', carpetEdge: '#ffd24a',
      curtain: '#8a1c2c', curtainHi: '#b8344a', view: 'city', lamp: 'none',
      tileW: 60, tileH: 84
    },
    safari: {
      ceil: '#5a3a1c', ceilHi: '#7e5428', wall: '#efce94', motif: '#5a3a1c',
      trim: '#9a6a32', trimHi: '#d8a860', trimLo: '#5a3a1c',
      wains: '#8a5a2c', wainsHi: '#aa7840', wainsLo: '#5a3818',
      floor: 'carpet', carpet: '#b0502c', carpetHi: '#d06a3a', carpetEdge: '#f0c060',
      curtain: '#c87a34', curtainHi: '#e8a050', view: 'savanna', lamp: 'rattan',
      tileW: 96, tileH: 96
    },
    wild: {
      ceil: '#22301e', ceilHi: '#3a4a2e', wall: '#3f6a4a', motif: '#5a8a62',
      trim: '#6a4424', trimHi: '#9a6a3a', trimLo: '#3a2210',
      wains: '#5a3a22', wainsHi: '#7a5434', wainsLo: '#341e0e',
      floor: 'carpet', carpet: '#7a2a24', carpetHi: '#9a3a2e', carpetEdge: '#e8d8a0',
      curtain: '#8a3a2a', curtainHi: '#b05a3a', view: 'forest', lamp: 'lantern',
      tileW: 72, tileH: 96
    },
    magic: {
      ceil: '#3a2862', ceilHi: '#5a3a8a', wall: '#cdb8ec', motif: '#ffffff',
      trim: '#caa040', trimHi: '#fcd870', trimLo: '#7a5a18',
      wains: '#7a5ab8', wainsHi: '#9a7ad4', wainsLo: '#4a3080',
      floor: 'carpet', carpet: '#4a2c8a', carpetHi: '#6a44b0', carpetEdge: '#ff99dd',
      curtain: '#e88ac8', curtainHi: '#ffb8e4', view: 'rainbow', lamp: 'orb',
      tileW: 80, tileH: 80
    }
  };
  var wallPatterns = {}; /* wing -> CanvasPattern, built on first use */

  /* Stable pseudo-random 0..1 from a number (for seeded scenery). */
  function hash01(n) {
    var s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function wingTheme() {
    return WINGS[(level && level.wing) || 'lobby'];
  }

  /* -- Wallpaper tiles (painted once into an offscreen canvas) -- */
  function paintDamask(t, cx, cy, col, bg) {
    t.fillStyle = col;
    t.beginPath();
    t.moveTo(cx, cy - 22);
    t.bezierCurveTo(cx + 11, cy - 10, cx + 14, cy + 6, cx, cy + 22);
    t.bezierCurveTo(cx - 14, cy + 6, cx - 11, cy - 10, cx, cy - 22);
    t.fill();
    for (var s = -1; s <= 1; s += 2) {
      t.beginPath();
      t.moveTo(cx, cy + 6);
      t.quadraticCurveTo(cx + s * 22, cy, cx + s * 17, cy - 15);
      t.quadraticCurveTo(cx + s * 12, cy - 4, cx, cy + 10);
      t.fill();
      t.beginPath();
      t.arc(cx + s * 17, cy - 16, 2.4, 0, Math.PI * 2);
      t.fill();
    }
    t.beginPath(); t.arc(cx, cy - 27, 3, 0, Math.PI * 2); t.fill();
    t.beginPath(); t.arc(cx, cy + 27, 2, 0, Math.PI * 2); t.fill();
    /* Hollow the centre so it reads as damask, not a blob */
    t.fillStyle = bg;
    t.beginPath();
    t.moveTo(cx, cy - 11);
    t.bezierCurveTo(cx + 5, cy - 4, cx + 6, cy + 4, cx, cy + 11);
    t.bezierCurveTo(cx - 6, cy + 4, cx - 5, cy - 4, cx, cy - 11);
    t.fill();
    t.fillStyle = col;
    t.beginPath(); t.arc(cx, cy, 2.2, 0, Math.PI * 2); t.fill();
  }

  function paintLeaf(t, x, y, ang, len, col) {
    t.save();
    t.translate(x, y);
    t.rotate(ang);
    t.fillStyle = col;
    t.beginPath();
    t.moveTo(0, -len);
    t.quadraticCurveTo(len * 0.55, 0, 0, len);
    t.quadraticCurveTo(-len * 0.55, 0, 0, -len);
    t.fill();
    t.strokeStyle = 'rgba(255,255,255,0.35)';
    t.lineWidth = 1;
    t.beginPath(); t.moveTo(0, -len + 2); t.lineTo(0, len - 2); t.stroke();
    t.restore();
  }

  function paintPine(t, x, y, col) {
    t.fillStyle = col;
    t.fillRect(x - 1.5, y + 10, 3, 6);
    for (var k = 0; k < 3; k++) {
      var ty = y - 12 + k * 7, hw = 5 + k * 3.5;
      t.beginPath();
      t.moveTo(x, ty - 4);
      t.lineTo(x + hw, ty + 8);
      t.lineTo(x - hw, ty + 8);
      t.closePath();
      t.fill();
    }
  }

  function paintPaw(t, x, y, col) {
    t.fillStyle = col;
    t.beginPath(); t.ellipse(x, y + 3, 6, 5, 0, 0, Math.PI * 2); t.fill();
    var toes = [[-6, -4], [-2, -8], [2.5, -8], [6.5, -4]];
    for (var k = 0; k < toes.length; k++) {
      t.beginPath(); t.ellipse(x + toes[k][0], y + toes[k][1], 2.2, 2.8, 0, 0, Math.PI * 2); t.fill();
    }
  }

  function paintStar(t, x, y, r, col) {
    t.fillStyle = col;
    t.beginPath();
    for (var k = 0; k < 10; k++) {
      var a = -Math.PI / 2 + k * Math.PI / 5;
      var rr = k % 2 === 0 ? r : r * 0.45;
      if (k === 0) t.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else t.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    t.closePath();
    t.fill();
  }

  function wallPattern(wing) {
    if (wallPatterns[wing]) return wallPatterns[wing];
    var th = WINGS[wing];
    var tc = document.createElement('canvas');
    var tw = th.tileW, tH = th.tileH;
    tc.width = tw;
    tc.height = tH;
    var t = tc.getContext('2d');
    t.fillStyle = th.wall;
    t.fillRect(0, 0, tw, tH);
    if (wing === 'lobby') {
      /* Cream-and-gold damask, half-drop repeat, between pinstripes */
      t.globalAlpha = 0.55;
      paintDamask(t, tw / 2, tH / 2, th.motif, th.wall);
      paintDamask(t, 0, 0, th.motif, th.wall);
      paintDamask(t, tw, 0, th.motif, th.wall);
      paintDamask(t, 0, tH, th.motif, th.wall);
      paintDamask(t, tw, tH, th.motif, th.wall);
      t.globalAlpha = 0.25;
      t.fillStyle = th.motif;
      t.fillRect(tw / 4 - 0.5, 0, 1, tH);
      t.fillRect(tw * 3 / 4 - 0.5, 0, 1, tH);
    } else if (wing === 'safari') {
      /* A band of zebra stripes, then a column of palm leaves */
      t.globalAlpha = 0.16;
      t.fillStyle = th.motif;
      for (var zs = 0; zs < 6; zs++) {
        var zy = 4 + zs * 16;
        t.beginPath();
        t.moveTo(6, zy);
        t.quadraticCurveTo(20, zy - 7, 36, zy + 3);
        t.lineTo(36, zy + 8);
        t.quadraticCurveTo(20, zy - 1, 6, zy + 6);
        t.closePath();
        t.fill();
      }
      t.globalAlpha = 0.3;
      t.fillStyle = '#c08a3a';
      t.fillRect(2, 0, 1.5, tH);
      t.fillRect(40, 0, 1.5, tH);
      t.globalAlpha = 0.32;
      paintLeaf(t, 68, 24, 0.5, 13, '#7a8a3a');
      paintLeaf(t, 68, 72, -0.5, 13, '#7a8a3a');
      paintLeaf(t, 80, 48, 1.1, 9, '#8a9a48');
    } else if (wing === 'wild') {
      /* Pines and paw prints, alternating rows */
      t.globalAlpha = 0.5;
      paintPine(t, 18, 26, th.motif);
      paintPaw(t, 54, 30, th.motif);
      paintPaw(t, 18, 78, th.motif);
      paintPine(t, 54, 74, th.motif);
    } else {
      /* Lilac with stars and tiny rainbows */
      t.globalAlpha = 0.75;
      paintStar(t, 20, 20, 6, '#ffffff');
      t.globalAlpha = 0.5;
      paintStar(t, 62, 30, 2.5, '#fff4b0');
      paintStar(t, 22, 62, 2.5, '#ffe0f4');
      t.globalAlpha = 0.55;
      var rbc = ['#ff8ac0', '#ffd870', '#88d0ff'];
      t.lineWidth = 2.4;
      for (var rb = 0; rb < 3; rb++) {
        t.strokeStyle = rbc[rb];
        t.beginPath();
        t.arc(60, 66, 10 - rb * 2.6, Math.PI, 0);
        t.stroke();
      }
      t.fillStyle = '#ffffff';
      t.beginPath(); t.arc(50, 66, 3, 0, Math.PI * 2); t.arc(70, 66, 3, 0, Math.PI * 2); t.fill();
    }
    t.globalAlpha = 1;
    wallPatterns[wing] = ctx.createPattern(tc, 'repeat');
    return wallPatterns[wing];
  }

  /* -- Views (window scenes and painted wall art) --
     Painted into the rect (x, y, w, h) with the caller's clip active.
     `ox` shifts the scene for window parallax; `seed` keeps each
     window's skyline / trees stable. */
  function drawView(c, kind, x, y, w, h, ox, seed) {
    var g = c.createLinearGradient(0, y, 0, y + h);
    var cx = x + w / 2 + ox;
    var gy = y + h; /* ground line */
    var i, bx, r;
    if (kind === 'city') {
      g.addColorStop(0, '#2c2c6a');
      g.addColorStop(0.6, '#a85a8a');
      g.addColorStop(1, '#f6a878');
      c.fillStyle = g;
      c.fillRect(x, y, w, h);
      /* A few early stars */
      c.fillStyle = '#fff8e0';
      for (i = 0; i < 8; i++) {
        c.fillRect(x + hash01(seed + i) * w, y + hash01(seed + i + 20) * h * 0.35, 1.2, 1.2);
      }
      /* Far then near skyline, with lit windows */
      var rows = [{ col: '#5a4478', lit: 0.25, hMin: 0.3, hMax: 0.6, step: 18 },
                  { col: '#2e2448', lit: 0.4, hMin: 0.15, hMax: 0.45, step: 24 }];
      for (var rw = 0; rw < 2; rw++) {
        var row = rows[rw];
        for (i = -6; i < 8; i++) {
          bx = cx + i * row.step - 6;
          var bw = row.step - 4 + hash01(seed * 3 + i + rw * 50) * 6;
          var bh = h * (row.hMin + hash01(seed + i * 7 + rw * 31) * (row.hMax - row.hMin));
          c.fillStyle = row.col;
          c.fillRect(bx, gy - bh, bw, bh);
          if (hash01(seed + i * 13 + rw) > 0.7) c.fillRect(bx + bw / 2 - 1, gy - bh - 8, 2, 8); /* spire */
          c.fillStyle = '#ffd88a';
          for (var wy = gy - bh + 5; wy < gy - 4; wy += 7) {
            for (var wx = bx + 3; wx < bx + bw - 3; wx += 5) {
              if (hash01(wx * 0.37 + wy * 1.31 + seed) < row.lit) c.fillRect(wx, wy, 2, 3);
            }
          }
        }
      }
      /* Park treetops along the bottom */
      c.fillStyle = '#2a4a34';
      for (i = -8; i < 10; i++) {
        c.beginPath(); c.arc(cx + i * 12, gy + 2, 8 + hash01(seed + i) * 3, Math.PI, 0); c.fill();
      }
    } else if (kind === 'savanna') {
      g.addColorStop(0, '#ff9a5a');
      g.addColorStop(0.7, '#ffd08a');
      g.addColorStop(1, '#ffe8b0');
      c.fillStyle = g;
      c.fillRect(x, y, w, h);
      /* Low sun with a soft halo */
      var sunX = cx + 18, sunY = gy - h * 0.38;
      var sg = c.createRadialGradient(sunX, sunY, 4, sunX, sunY, 40);
      sg.addColorStop(0, 'rgba(255,250,220,0.9)');
      sg.addColorStop(1, 'rgba(255,250,220,0)');
      c.fillStyle = sg;
      c.fillRect(sunX - 40, sunY - 40, 80, 80);
      c.fillStyle = '#fff4cc';
      c.beginPath(); c.arc(sunX, sunY, 13, 0, Math.PI * 2); c.fill();
      /* Distant hills */
      c.fillStyle = '#d89850';
      c.beginPath(); c.ellipse(cx - 40, gy, 90, h * 0.22, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#c47e3a';
      c.beginPath(); c.ellipse(cx + 60, gy + 4, 100, h * 0.18, 0, Math.PI, 0); c.fill();
      /* Acacia silhouette */
      var ax = cx - 22 + hash01(seed) * 20;
      c.fillStyle = '#5a3418';
      c.beginPath();
      c.moveTo(ax - 2, gy); c.lineTo(ax - 1, gy - 30); c.lineTo(ax - 10, gy - 40);
      c.lineTo(ax - 8, gy - 41); c.lineTo(ax + 1, gy - 33); c.lineTo(ax + 9, gy - 42);
      c.lineTo(ax + 11, gy - 41); c.lineTo(ax + 3, gy - 30); c.lineTo(ax + 3, gy);
      c.closePath(); c.fill();
      c.beginPath(); c.ellipse(ax, gy - 44, 26, 6, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(ax - 10, gy - 47, 13, 4, 0, 0, Math.PI * 2); c.fill();
      /* Far-off giraffe in some windows */
      if (hash01(seed + 5) > 0.45) {
        var gx = cx + 40;
        c.fillRect(gx - 6, gy - 16, 12, 6);
        c.fillRect(gx - 5, gy - 10, 2, 10);
        c.fillRect(gx + 3, gy - 10, 2, 10);
        c.beginPath(); c.moveTo(gx + 3, gy - 15); c.lineTo(gx + 8, gy - 34); c.lineTo(gx + 11, gy - 33); c.lineTo(gx + 6, gy - 14); c.closePath(); c.fill();
        c.fillRect(gx + 8, gy - 37, 6, 3);
      }
      /* Grass line */
      c.fillStyle = '#a0682a';
      c.fillRect(x, gy - 4, w, 4);
    } else if (kind === 'forest') {
      g.addColorStop(0, '#16224a');
      g.addColorStop(1, '#4a6a8e');
      c.fillStyle = g;
      c.fillRect(x, y, w, h);
      c.fillStyle = '#fff8e0';
      for (i = 0; i < 12; i++) {
        r = hash01(seed + i * 3) > 0.8 ? 1.6 : 1;
        c.fillRect(x + hash01(seed + i) * w, y + hash01(seed + i + 40) * h * 0.5, r, r);
      }
      /* Moon with a soft glow — part of the view, not the wall */
      var mx = cx + 20, my = y + h * 0.26;
      var mg = c.createRadialGradient(mx, my, 6, mx, my, 34);
      mg.addColorStop(0, 'rgba(255,248,210,0.5)');
      mg.addColorStop(1, 'rgba(255,248,210,0)');
      c.fillStyle = mg;
      c.fillRect(mx - 34, my - 34, 68, 68);
      c.fillStyle = '#fff4cc';
      c.beginPath(); c.arc(mx, my, 10, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(200,190,150,0.6)';
      c.beginPath(); c.arc(mx - 3, my - 2, 2.2, 0, Math.PI * 2); c.arc(mx + 4, my + 3, 1.6, 0, Math.PI * 2); c.fill();
      /* Mountains */
      c.fillStyle = '#2e4462';
      c.beginPath();
      c.moveTo(cx - 140, gy);
      c.lineTo(cx - 70, gy - h * 0.5); c.lineTo(cx - 20, gy - h * 0.25);
      c.lineTo(cx + 40, gy - h * 0.55); c.lineTo(cx + 140, gy);
      c.closePath(); c.fill();
      c.fillStyle = '#dfe8f4';
      c.beginPath();
      c.moveTo(cx + 40, gy - h * 0.55); c.lineTo(cx + 30, gy - h * 0.45); c.lineTo(cx + 50, gy - h * 0.46);
      c.closePath(); c.fill();
      /* Pine silhouettes */
      c.fillStyle = '#14261c';
      for (i = -7; i < 8; i++) {
        var px = cx + i * 14 + hash01(seed + i) * 6;
        var ph = 24 + hash01(seed + i * 5) * 22;
        c.beginPath(); c.moveTo(px, gy - ph); c.lineTo(px + 9, gy); c.lineTo(px - 9, gy); c.closePath(); c.fill();
      }
    } else if (kind === 'sea') {
      g.addColorStop(0, '#8ad0f4');
      g.addColorStop(1, '#e0f4ff');
      c.fillStyle = g;
      c.fillRect(x, y, w, h);
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(cx - 14, y + h * 0.25, 6, 0, Math.PI * 2); c.arc(cx - 6, y + h * 0.22, 8, 0, Math.PI * 2); c.arc(cx + 3, y + h * 0.26, 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3a8ac8';
      c.fillRect(x, y + h * 0.55, w, h * 0.45);
      c.fillStyle = '#5aaae0';
      c.fillRect(x, y + h * 0.55, w, 3);
      c.strokeStyle = 'rgba(255,255,255,0.6)';
      c.lineWidth = 1;
      for (i = 0; i < 4; i++) {
        var wvy = y + h * (0.66 + i * 0.09);
        c.beginPath(); c.moveTo(x + 4 + i * 6, wvy); c.quadraticCurveTo(x + 10 + i * 6, wvy - 2, x + 16 + i * 6, wvy); c.stroke();
      }
      /* Sailboat */
      c.fillStyle = '#ffffff';
      c.beginPath(); c.moveTo(cx + 4, y + h * 0.53); c.lineTo(cx + 4, y + h * 0.25); c.lineTo(cx + 16, y + h * 0.53); c.closePath(); c.fill();
      c.fillStyle = '#c83a3a';
      c.fillRect(cx - 4, y + h * 0.53, 24, 4);
    } else {
      /* 'rainbow' — the Magic Wing's candy sky */
      g.addColorStop(0, '#b8a8ff');
      g.addColorStop(0.6, '#ffc8ec');
      g.addColorStop(1, '#fff0d8');
      c.fillStyle = g;
      c.fillRect(x, y, w, h);
      var arcs = ['#ff7aa8', '#ffb060', '#ffe670', '#88e088', '#78c0ff', '#b088ff'];
      c.lineWidth = 4;
      for (i = 0; i < arcs.length; i++) {
        c.strokeStyle = arcs[i];
        c.globalAlpha = 0.85;
        c.beginPath(); c.arc(cx - 10, gy + 6, 56 - i * 4, Math.PI, 0); c.stroke();
      }
      c.globalAlpha = 1;
      /* Floating castle on a cloud */
      var kx = cx + 34, ky = y + h * 0.42;
      c.fillStyle = '#fff4ff';
      c.fillRect(kx - 10, ky - 8, 20, 10);
      c.fillRect(kx - 13, ky - 16, 6, 18);
      c.fillRect(kx + 7, ky - 16, 6, 18);
      c.fillStyle = '#ff99dd';
      c.beginPath(); c.moveTo(kx - 14, ky - 16); c.lineTo(kx - 10, ky - 24); c.lineTo(kx - 6, ky - 16); c.fill();
      c.beginPath(); c.moveTo(kx + 6, ky - 16); c.lineTo(kx + 10, ky - 24); c.lineTo(kx + 14, ky - 16); c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(kx - 12, ky + 4, 7, 0, Math.PI * 2); c.arc(kx, ky + 6, 9, 0, Math.PI * 2); c.arc(kx + 12, ky + 4, 7, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(cx - 64, gy, 10, 0, Math.PI * 2); c.arc(cx - 50, gy - 2, 12, 0, Math.PI * 2); c.arc(cx + 40, gy, 12, 0, Math.PI * 2); c.arc(cx + 56, gy + 2, 10, 0, Math.PI * 2); c.fill();
      /* Twinkling sparkles at fixed spots */
      var tw = Date.now() * 0.003;
      for (i = 0; i < 6; i++) {
        c.globalAlpha = 0.5 + 0.5 * Math.sin(tw + i * 1.7);
        paintStar(c, x + hash01(seed + i) * w, y + hash01(seed + i + 9) * h * 0.5, 3, '#ffffff');
      }
      c.globalAlpha = 1;
    }
  }

  /* -- Window: view + mullions + sill + drapes, all in screen space -- */
  function drawHotelWindow(sx, wx, th, wing) {
    var lobby = wing === 'lobby';
    var w = lobby ? 92 : 80;
    var top = lobby ? 82 : 96;
    var h = lobby ? 170 : 136;
    var x = sx - w / 2;
    var archR = lobby ? w / 2 : 0;
    var c = ctx;
    function glassPath(inset) {
      c.beginPath();
      if (archR) {
        c.moveTo(x + inset, top + h - inset);
        c.lineTo(x + inset, top + archR);
        c.arc(sx, top + archR, archR - inset, Math.PI, 0);
        c.lineTo(x + w - inset, top + h - inset);
        c.closePath();
      } else {
        c.rect(x + inset, top + inset, w - inset * 2, h - inset * 2);
      }
    }
    /* Recess shadow + trim */
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.3)';
    c.shadowBlur = 8;
    c.shadowOffsetY = 3;
    c.fillStyle = th.trimLo;
    glassPath(-6);
    c.fill();
    c.restore();
    c.fillStyle = th.trim;
    glassPath(-4);
    c.fill();
    /* View, with gentle parallax as the window slides past */
    c.save();
    glassPath(2);
    c.clip();
    drawView(c, th.view, x, top, w, h, (W / 2 - sx) * 0.12, Math.floor(wx));
    /* Glass sheen */
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.beginPath();
    c.moveTo(x + 8, top + h); c.lineTo(x + 26, top + h); c.lineTo(x + w - 10, top); c.lineTo(x + w - 28, top);
    c.closePath(); c.fill();
    c.restore();
    /* Mullions */
    c.fillStyle = th.trim;
    c.fillRect(sx - 1.5, top + (archR ? archR * 0.4 : 0), 3, h - (archR ? archR * 0.4 : 0));
    c.fillRect(x, top + h * (lobby ? 0.58 : 0.5) - 1.5, w, 3);
    c.fillStyle = th.trimHi;
    c.fillRect(sx - 0.5, top + (archR ? archR * 0.4 : 0), 1, h - (archR ? archR * 0.4 : 0));
    /* Sill */
    c.fillStyle = th.trimLo;
    c.fillRect(x - 10, top + h + 2, w + 20, 7);
    c.fillStyle = th.trimHi;
    c.fillRect(x - 10, top + h + 2, w + 20, 2);
    /* Drapes: pleated panels gathered by a tie-back, under a valance */
    var dTop = top - (lobby ? 4 : 8);
    var dBot = lobby ? RAIL_Y - 6 : top + h + 26;
    for (var s = -1; s <= 1; s += 2) {
      var ex = s < 0 ? x - 12 : x + w + 12;   /* outer edge */
      var ix = s < 0 ? x + 8 : x + w - 8;     /* inner edge at the top */
      var tieY = top + h * 0.62;
      var dg = c.createLinearGradient(ex, 0, ix, 0);
      dg.addColorStop(0, th.curtain);
      dg.addColorStop(0.5, th.curtainHi);
      dg.addColorStop(1, th.curtain);
      c.fillStyle = dg;
      c.beginPath();
      c.moveTo(ex, dTop);
      c.lineTo(ix, dTop);
      c.quadraticCurveTo(ix - s * 4, tieY - 20, ex + s * 7, tieY);
      c.quadraticCurveTo(ex + s * 12, dBot - 20, ex + s * 16, dBot);
      c.lineTo(ex - s * 2, dBot);
      c.closePath();
      c.fill();
      /* Pleat lines */
      c.strokeStyle = 'rgba(0,0,0,0.18)';
      c.lineWidth = 1;
      for (var pl = 1; pl < 3; pl++) {
        c.beginPath();
        c.moveTo(ex + s * pl * 5, dTop + 2);
        c.quadraticCurveTo(ex + s * (pl * 2 + 2), tieY, ex + s * (pl * 4 + 2), dBot - 2);
        c.stroke();
      }
      /* Tie-back */
      c.fillStyle = th.trimHi;
      c.fillRect(ex + s * 2 - 3, tieY - 2, 9, 4);
    }
    /* Valance + rod */
    c.fillStyle = th.trimLo;
    c.fillRect(x - 18, dTop - 4, w + 36, 4);
    c.fillStyle = th.curtain;
    c.beginPath();
    c.moveTo(x - 16, dTop);
    for (var sc = 0; sc <= 4; sc++) {
      var vx = x - 16 + sc * (w + 32) / 4;
      if (sc > 0) c.quadraticCurveTo(vx - (w + 32) / 8, dTop + 16, vx, dTop);
    }
    c.closePath();
    c.fill();
    c.fillStyle = th.trimHi;
    c.beginPath(); c.arc(x - 18, dTop - 2, 3, 0, Math.PI * 2); c.arc(x + w + 18, dTop - 2, 3, 0, Math.PI * 2); c.fill();
  }

  /* Back half of the corridor: ceiling, moulding, wallpaper, windows,
     wainscot and floor. Drawn before the level's decorations. */
  function drawHotelBackdrop() {
    var wing = (level && level.wing) || 'lobby';
    var th = WINGS[wing];
    var camX = camera.x;
    var floorY = level.floorY - camera.y;
    var c = ctx;
    var i, sx, wxs;

    /* Ceiling plane, lit from below */
    var cg = c.createLinearGradient(0, 0, 0, CEIL_Y);
    cg.addColorStop(0, th.ceil);
    cg.addColorStop(1, th.ceilHi);
    c.fillStyle = cg;
    c.fillRect(0, 0, W, CEIL_Y);
    /* Coffer joints every 160 world px */
    c.fillStyle = 'rgba(0,0,0,0.2)';
    for (wxs = Math.floor(camX / 160) * 160; wxs < camX + W + 160; wxs += 160) {
      c.fillRect(wxs - camX, 0, 3, CEIL_Y);
    }

    /* Wallpaper */
    c.save();
    c.translate(-(camX % th.tileW), 0);
    c.fillStyle = wallPattern(wing);
    c.fillRect(0, WALL_Y, W + th.tileW, RAIL_Y - WALL_Y);
    c.restore();
    /* Shade the wall: darker up under the moulding */
    var wg = c.createLinearGradient(0, WALL_Y, 0, RAIL_Y);
    wg.addColorStop(0, 'rgba(30,10,0,0.28)');
    wg.addColorStop(0.35, 'rgba(30,10,0,0.04)');
    wg.addColorStop(1, 'rgba(30,10,0,0.1)');
    c.fillStyle = wg;
    c.fillRect(0, WALL_Y, W, RAIL_Y - WALL_Y);

    /* Crown moulding: stepped profile + dentils */
    c.fillStyle = th.trimLo;
    c.fillRect(0, CEIL_Y, W, 4);
    c.fillStyle = th.trim;
    c.fillRect(0, CEIL_Y + 4, W, 9);
    c.fillStyle = th.trimHi;
    c.fillRect(0, CEIL_Y + 5, W, 1.5);
    c.fillStyle = th.trimLo;
    for (wxs = Math.floor(camX / 14) * 14; wxs < camX + W + 14; wxs += 14) {
      c.fillRect(wxs - camX + 2, CEIL_Y + 13, 8, 4);
    }
    c.fillStyle = th.trim;
    c.fillRect(0, CEIL_Y + 17, W, 3);

    /* Windows */
    var wins = level.windows || [];
    for (i = 0; i < wins.length; i++) {
      sx = wins[i] - camX;
      if (sx < -80 || sx > W + 80) continue;
      drawHotelWindow(sx, wins[i], th, wing);
    }

    /* Wainscot: chair rail, raised panels, skirting */
    c.fillStyle = th.wains;
    c.fillRect(0, RAIL_Y, W, BASE_Y - RAIL_Y);
    var pTop = RAIL_Y + 22, pBot = BASE_Y - 12;
    for (wxs = Math.floor(camX / 80) * 80; wxs < camX + W + 80; wxs += 80) {
      sx = wxs - camX;
      c.fillStyle = th.wainsLo;
      c.fillRect(sx + 10, pTop, 60, pBot - pTop);
      c.fillStyle = th.wainsHi;
      c.fillRect(sx + 10, pTop, 59, pBot - pTop - 1);
      c.fillStyle = th.wains;
      c.fillRect(sx + 13, pTop + 3, 54, pBot - pTop - 6);
    }
    c.fillStyle = th.trimLo;
    c.fillRect(0, RAIL_Y, W, 10);
    c.fillStyle = th.trim;
    c.fillRect(0, RAIL_Y, W, 6);
    c.fillStyle = th.trimHi;
    c.fillRect(0, RAIL_Y + 1, W, 1.5);
    /* Skirting board */
    c.fillStyle = th.wainsLo;
    c.fillRect(0, BASE_Y, W, floorY - BASE_Y);
    c.fillStyle = th.trimLo;
    c.fillRect(0, BASE_Y, W, 2);

    /* Floor */
    var fH = H - floorY;
    if (th.floor === 'marble') {
      var mg = c.createLinearGradient(0, floorY, 0, H);
      mg.addColorStop(0, '#e2d6c0');
      mg.addColorStop(1, '#f6efe2');
      c.fillStyle = mg;
      c.fillRect(0, floorY, W, fH);
      /* Checker tiles with perspective joints (they fan out toward
         the viewer, so the floor reads as a plane, not a stripe). */
      for (wxs = Math.floor(camX / 60) * 60 - 60; wxs < camX + W + 120; wxs += 60) {
        sx = wxs - camX;
        var bx0 = sx + (sx - W / 2) * 0.22;
        var bx1 = sx + 60 + (sx + 60 - W / 2) * 0.22;
        if ((wxs / 60) % 2 === 0) {
          c.fillStyle = 'rgba(160,130,100,0.18)';
          c.beginPath();
          c.moveTo(sx, floorY); c.lineTo(sx + 60, floorY); c.lineTo(bx1, H); c.lineTo(bx0, H);
          c.closePath(); c.fill();
        }
        c.strokeStyle = 'rgba(140,110,80,0.35)';
        c.lineWidth = 1;
        c.beginPath(); c.moveTo(sx, floorY); c.lineTo(bx0, H); c.stroke();
        /* One seeded vein per tile */
        c.strokeStyle = 'rgba(150,130,110,0.3)';
        var vs = hash01(wxs);
        c.beginPath();
        c.moveTo(sx + 10 + vs * 20, floorY + 2);
        c.quadraticCurveTo(sx + 30, floorY + 12 + vs * 10, sx + 50 - vs * 10, H);
        c.stroke();
      }
    } else {
      /* Wall-to-wall carpet, darker where it meets the wall */
      var fg = c.createLinearGradient(0, floorY, 0, H);
      fg.addColorStop(0, th.carpet);
      fg.addColorStop(1, th.carpetHi);
      c.fillStyle = fg;
      c.fillRect(0, floorY, W, fH);
    }
    /* Runner along the corridor, with a border and a repeat motif */
    var rTop = floorY + 12, rBot = H - 4;
    c.fillStyle = th.floor === 'marble' ? th.carpet : th.carpetHi;
    c.fillRect(0, rTop, W, rBot - rTop);
    c.fillStyle = th.carpetEdge;
    c.fillRect(0, rTop + 2, W, 1.5);
    c.fillRect(0, rBot - 3.5, W, 1.5);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(0, rTop, W, 1);
    var my = (rTop + rBot) / 2;
    for (wxs = Math.floor(camX / 40) * 40; wxs < camX + W + 40; wxs += 40) {
      sx = wxs - camX + 20;
      c.fillStyle = th.carpetEdge;
      if (wing === 'magic') {
        paintStar(c, sx, my, 4.5, th.carpetEdge);
      } else if (wing === 'wild') {
        /* Lodge chevrons */
        c.strokeStyle = th.carpetEdge;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(sx - 8, my + 3); c.lineTo(sx - 2, my - 3); c.lineTo(sx + 4, my + 3);
        c.moveTo(sx + 2, my + 3); c.lineTo(sx + 8, my - 3); c.lineTo(sx + 14, my + 3);
        c.stroke();
      } else {
        c.beginPath();
        c.moveTo(sx, my - 5); c.lineTo(sx + 6, my); c.lineTo(sx, my + 5); c.lineTo(sx - 6, my);
        c.closePath(); c.fill();
        if (wing === 'safari') {
          c.fillRect(sx + 12, my - 1, 6, 2);
          c.fillRect(sx - 18, my - 1, 6, 2);
        }
      }
    }
    /* Contact shadow where the floor meets the wall */
    var sg = c.createLinearGradient(0, floorY, 0, floorY + 10);
    sg.addColorStop(0, 'rgba(0,0,0,0.3)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sg;
    c.fillRect(0, floorY, W, 10);
  }

  /* Pendant lamp painted per wing style at (sx, y) — y is the shade's top. */
  function drawPendant(c, style, sx, y, th) {
    c.strokeStyle = th.trimLo;
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(sx, CEIL_Y + 20); c.lineTo(sx, y); c.stroke();
    c.fillStyle = th.trim;
    c.fillRect(sx - 5, CEIL_Y + 18, 10, 3);
    if (style === 'rattan') {
      c.fillStyle = '#c8964a';
      c.beginPath(); c.ellipse(sx, y + 14, 15, 14, 0, Math.PI, 0); c.fill();
      c.strokeStyle = '#8a5a24';
      c.lineWidth = 0.8;
      for (var k = -2; k <= 2; k++) {
        c.beginPath(); c.moveTo(sx + k * 5, y + 1); c.lineTo(sx + k * 6.5, y + 14); c.stroke();
      }
      c.beginPath(); c.moveTo(sx - 13, y + 8); c.lineTo(sx + 13, y + 8); c.stroke();
      c.fillStyle = '#8a5a24';
      c.fillRect(sx - 15, y + 13, 30, 2);
      c.fillStyle = '#fff2c0';
      c.beginPath(); c.ellipse(sx, y + 15, 8, 2.5, 0, 0, Math.PI * 2); c.fill();
    } else if (style === 'lantern') {
      c.fillStyle = '#2a2a2a';
      c.beginPath(); c.moveTo(sx - 9, y + 4); c.lineTo(sx, y - 2); c.lineTo(sx + 9, y + 4); c.closePath(); c.fill();
      c.fillStyle = '#ffd890';
      c.fillRect(sx - 7, y + 4, 14, 16);
      c.fillStyle = '#fff6d8';
      c.fillRect(sx - 3, y + 7, 6, 10);
      c.strokeStyle = '#2a2a2a';
      c.lineWidth = 1.4;
      c.strokeRect(sx - 7, y + 4, 14, 16);
      c.beginPath(); c.moveTo(sx, y + 4); c.lineTo(sx, y + 20); c.stroke();
      c.fillStyle = '#2a2a2a';
      c.fillRect(sx - 8, y + 20, 16, 3);
    } else {
      /* Magic orb: glass globe with a star inside */
      var og = c.createRadialGradient(sx - 3, y + 7, 1, sx, y + 10, 10);
      og.addColorStop(0, '#ffffff');
      og.addColorStop(0.6, '#ffd8f4');
      og.addColorStop(1, '#c8a0ff');
      c.fillStyle = og;
      c.beginPath(); c.arc(sx, y + 10, 10, 0, Math.PI * 2); c.fill();
      paintStar(c, sx, y + 10, 4.5, '#ffd24a');
      c.fillStyle = th.trim;
      c.fillRect(sx - 4, y - 1, 8, 3);
    }
  }

  /* Front half of the lighting: pendant lamps over each guest door and
     warm light pools on the wall and floor (additive). Drawn after the
     decorations, before the NPCs. */
  function drawHotelLighting() {
    var wing = (level && level.wing) || 'lobby';
    var th = WINGS[wing];
    var c = ctx;
    var floorY = level.floorY - camera.y;
    var lights = [];
    var i, n, sx;
    if (th.lamp !== 'none') {
      for (n = 0; n < level.spawns.npcs.length; n++) {
        var nd = level.spawns.npcs[n];
        if (nd.type === 'animalDoor') lights.push({ x: nd.x + 24, y: 150, pendant: true });
      }
    } else {
      for (i = 0; i < level.decorations.length; i++) {
        if (level.decorations[i].type === 'chandelier') {
          lights.push({ x: level.decorations[i].x, y: level.decorations[i].y + 26, pendant: false });
        }
      }
    }
    var flick = 0.94 + 0.06 * Math.sin(Date.now() * 0.004);
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (i = 0; i < lights.length; i++) {
      sx = lights[i].x - camera.x;
      if (sx < -160 || sx > W + 160) continue;
      var ly = lights[i].y + 14;
      /* Wall wash around the lamp */
      var wg = c.createRadialGradient(sx, ly, 4, sx, ly, 110);
      wg.addColorStop(0, 'rgba(255,200,120,' + (0.2 * flick) + ')');
      wg.addColorStop(1, 'rgba(255,200,120,0)');
      c.fillStyle = wg;
      c.fillRect(sx - 110, ly - 110, 220, 220);
      /* Faint cone down to the guest door below (pendants only) */
      if (lights[i].pendant) {
        var cg = c.createLinearGradient(0, ly, 0, floorY);
        cg.addColorStop(0, 'rgba(255,220,150,0.07)');
        cg.addColorStop(1, 'rgba(255,220,150,0)');
        c.fillStyle = cg;
        c.beginPath();
        c.moveTo(sx - 10, ly); c.lineTo(sx + 10, ly); c.lineTo(sx + 60, floorY); c.lineTo(sx - 60, floorY);
        c.closePath(); c.fill();
      }
      /* Pool on the floor */
      c.save();
      c.translate(sx, floorY + 16);
      c.scale(1, 0.18);
      var fg = c.createRadialGradient(0, 0, 4, 0, 0, 80);
      fg.addColorStop(0, 'rgba(255,220,150,0.3)');
      fg.addColorStop(1, 'rgba(255,220,150,0)');
      c.fillStyle = fg;
      c.beginPath(); c.arc(0, 0, 80, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    c.restore();
    for (i = 0; i < lights.length; i++) {
      if (!lights[i].pendant) continue;
      sx = lights[i].x - camera.x;
      if (sx < -40 || sx > W + 40) continue;
      drawPendant(c, th.lamp, sx, lights[i].y, th);
    }
  }

  /* Recessed casing around a doorway (guest doors, stairs, elevator):
     a soft drop shadow so it sits in the wall, a moulded frame in the
     wing's trim, and a dark reveal just inside. */
  function drawDoorCasing(c, x, top, w, bottom, accent, transom) {
    var th = wingTheme();
    if (transom) {
      /* Fanlight over the door: arched glass glowing with the room's
         lamplight, so the doorway reads taller than the wainscot */
      var tcx = x + w / 2, tr = w / 2 + 2, tby = top - 10;
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.35)';
      c.shadowBlur = 8;
      c.shadowOffsetY = 2;
      c.fillStyle = th.trimLo;
      c.beginPath(); c.arc(tcx, tby, tr + 8, Math.PI, 0); c.closePath(); c.fill();
      c.restore();
      c.fillStyle = th.trim;
      c.beginPath(); c.arc(tcx, tby, tr + 6, Math.PI, 0); c.closePath(); c.fill();
      var fg = c.createRadialGradient(tcx, tby, 2, tcx, tby, tr);
      fg.addColorStop(0, '#fff2c8');
      fg.addColorStop(1, accent || '#e8b860');
      c.fillStyle = fg;
      c.beginPath(); c.arc(tcx, tby, tr, Math.PI, 0); c.closePath(); c.fill();
      c.strokeStyle = th.trim;
      c.lineWidth = 2;
      for (var sp = 1; sp < 4; sp++) {
        var sa = Math.PI + sp * Math.PI / 4;
        c.beginPath(); c.moveTo(tcx, tby); c.lineTo(tcx + Math.cos(sa) * tr, tby + Math.sin(sa) * tr); c.stroke();
      }
      c.fillStyle = th.trim;
      c.beginPath(); c.arc(tcx, tby, 5, Math.PI, 0); c.fill();
    }
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.4)';
    c.shadowBlur = 10;
    c.shadowOffsetY = 3;
    c.fillStyle = th.trimLo;
    c.fillRect(x - 8, top - 10, w + 16, bottom - top + 10);
    c.restore();
    c.fillStyle = th.trim;
    c.fillRect(x - 6, top - 8, w + 12, bottom - top + 8);
    c.fillStyle = th.trimHi;
    c.fillRect(x - 6, top - 8, w + 12, 1.5);
    c.fillRect(x - 6, top - 8, 1.5, bottom - top + 8);
    /* Header cap with the species accent */
    c.fillStyle = th.trimLo;
    c.fillRect(x - 10, top - 12, w + 20, 4);
    if (accent) {
      c.fillStyle = accent;
      c.fillRect(x - 6, top - 6, w + 12, 3);
    }
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(x - 2, top - 2, w + 4, bottom - top + 2);
  }

  /* ---- Level loading ---- */
  function loadLevel(index) {
    level = Game.levels.get(index);
    if (!level) return;

    /* Player */
    var sp = level.spawns.player;
    player = new Game.entities.Momoko(sp.x, sp.y);
    /* Expose so entity draw code (receptionist callout, chandelier monkey
       proximity, bedroom-door sparkle) can react to Momoko's position
       without threading it through every draw signature. */
    Game.player = player;

    /* Enemies – friendly aliens (Fish class). */
    enemies = [];
    for (var i = 0; i < level.spawns.enemies.length; i++) {
      var e = level.spawns.enemies[i];
      if (e.type === 'fish' || e.type === 'alien') {
        enemies.push(new Game.entities.Fish(e.x, e.y, e.pattern, e.dir, e.species));
      }
    }

    /* NPCs */
    npcs = [];
    npcCooldowns = {};
    for (var n = 0; n < level.spawns.npcs.length; n++) {
      var nd = level.spawns.npcs[n];
      var npcEntity;
      if (nd.type === 'oliver') npcEntity = new Game.entities.Oliver(nd.x, nd.y);
      else if (nd.type === 'kittycorn') npcEntity = new Game.entities.KittyCorn(nd.x, nd.y);
      else if (nd.type === 'bob') npcEntity = new Game.entities.Bob(nd.x, nd.y);
      else if (nd.type === 'crab') npcEntity = new Game.entities.Crab(nd.x, nd.y);
      else if (nd.type === 'lila' && Game.entities.Lila) npcEntity = new Game.entities.Lila(nd.x, nd.y);
      else if (nd.type === 'migword' && Game.entities.MigWord) npcEntity = new Game.entities.MigWord(nd.x, nd.y);
      else if (nd.type === 'moonMouse' && Game.entities.MoonMouse) npcEntity = new Game.entities.MoonMouse(nd.x, nd.y, nd.mouseId, nd.color);
      else if (nd.type === 'rocket' && Game.entities.RocketShip) npcEntity = new Game.entities.RocketShip(nd.x, nd.y);
      else if (nd.type === 'houseDoor' && Game.entities.HouseDoor) npcEntity = new Game.entities.HouseDoor(nd.x, nd.y, nd.houseId);
      else if (nd.type === 'cafeDoor' && Game.entities.CafeDoor) npcEntity = new Game.entities.CafeDoor(nd.x, nd.y);
      else if (nd.type === 'shopDoor' && Game.entities.ShopDoor) npcEntity = new Game.entities.ShopDoor(nd.x, nd.y);
      /* ---- Hotel zoo NPC types ---- */
      else if (nd.type === 'animalDoor' && Game.entities.AnimalDoor) {
        npcEntity = new Game.entities.AnimalDoor(nd.x, nd.y, nd.species);
      }
      else if (nd.type === 'receptionist' && Game.entities.Receptionist) {
        npcEntity = new Game.entities.Receptionist(nd.x, nd.y);
      }
      else if (nd.type === 'chandelierMonkey' && Game.entities.ChandelierMonkey) {
        npcEntity = new Game.entities.ChandelierMonkey(nd.x, nd.y, !!nd.escort);
      }
      else if (nd.type === 'elevator' && Game.entities.Elevator) {
        npcEntity = new Game.entities.Elevator(nd.x, nd.y);
      }
      else if (nd.type === 'stairs' && Game.entities.Stairs) {
        npcEntity = new Game.entities.Stairs(nd.x, nd.y, nd.dir);
      }
      if (npcEntity) npcs.push({ entity: npcEntity, type: nd.type, data: nd });
    }

    /* Pickups – star gems for Lila's quest. */
    pickups = [];
    for (var p = 0; p < level.spawns.pickups.length; p++) {
      var pd = level.spawns.pickups[p];
      pickups.push(new Game.entities.HeartPickup(pd.x, pd.y));
    }

    /* Wolfe */
    if (level.wolfe) {
      wolfe = new Game.entities.Wolfe(level.wolfe.x, level.wolfe.y, level.wolfe.patrolWidth);
    } else {
      wolfe = null;
    }

    /* Bubbles & particles */
    bubbles = [];
    particles = [];
  }

  /* If both quests have completed, drop into VICTORY after a short beat. */
  function checkVictory() {
    if (!Game.quests) return;
    if (Game.quests.lila === 'done' &&
        Game.quests.migword === 'done' &&
        state === State.PLAYING) {
      setTimeout(function () {
        if (state === State.PLAYING) {
          state = State.VICTORY;
          Game.audio.stopMusic();
          Game.audio.play('victory');
        }
      }, 800);
    }
  }

  /* ---- Collision helpers ---- */
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function circleRect(cx, cy, cr, rx, ry, rw, rh) {
    var nearX = Math.max(rx, Math.min(cx, rx + rw));
    var nearY = Math.max(ry, Math.min(cy, ry + rh));
    var dx = cx - nearX;
    var dy = cy - nearY;
    return (dx * dx + dy * dy) < (cr * cr);
  }

  /* ---- Update ---- */
  function update() {
    Game.input.update();
    var keys = Game.input.keys;
    var jp = Game.input.justPressed;

    switch (state) {
      case State.TITLE:
        /* Title animation handled by ui.js */
        break;

      case State.CUSTOMIZE:
        /* Keyboard fallback so kids on a laptop can finish customize without
           the mouse — Space/Z confirms whatever's currently selected. */
        if (jp.action) {
          Game.audio.play('select');
          state = State.INTRO;
        }
        break;

      case State.INTRO:
        /* Keyboard advance — same as clicking Continue. */
        if (jp.action) {
          Game.audio.play('select');
          startGame();
        }
        break;

      case State.PLAYING:
        if (jp.pause) { prevState = State.PLAYING; state = State.PAUSED; return; }
        if (jp.ledger) { openLedger(); return; }

        /* First-arrival check-in: the chandelier monkey escorts Momoko to
           the elevator the first time she's in the lobby. Plays once per
           save so a player who heads straight for the elevator still sees
           the welcome rather than skipping it. */
        if (!Game.flags.checkedIn && !lobbyIntroAutoFired && currentZone === 0) {
          lobbyIntroAutoFired = true;
          setTimeout(beginLobbyIntro, 700);
        }

        /* Player */
        player.update(keys, level);

        /* Bubbles (still ticked so any in-flight effects fade out
           cleanly; the action button no longer spawns new ones — it
           is now the universal "interact" trigger handled below). */
        for (var bi = bubbles.length - 1; bi >= 0; bi--) {
          bubbles[bi].update();
          if (!bubbles[bi].active) bubbles.splice(bi, 1);
        }

        /* Enemies */
        for (var ei = 0; ei < enemies.length; ei++) {
          enemies[ei].update();
        }

        /* NPCs */
        for (var ni = 0; ni < npcs.length; ni++) {
          npcs[ni].entity.update();
        }

        /* Pickups */
        for (var pi = 0; pi < pickups.length; pi++) {
          pickups[pi].update();
        }

        /* Wolfe */
        if (wolfe) wolfe.update();

        /* Particles */
        for (var pa = particles.length - 1; pa >= 0; pa--) {
          particles[pa].update();
          if (!particles[pa].active) particles.splice(pa, 1);
        }

        /* ---- Collisions ---- */

        /* Sparkle vs friendly aliens — aliens twirl happily, no defeat */
        for (var bei = bubbles.length - 1; bei >= 0; bei--) {
          var bub = bubbles[bei];
          if (!bub.active) continue;
          for (var ej = 0; ej < enemies.length; ej++) {
            var en = enemies[ej];
            if (!en.active) continue;
            if (circleRect(bub.x, bub.y, bub.r, en.x, en.y, en.w, en.h)) {
              bub.active = false;
              if (typeof en.delight === 'function') {
                en.delight();
              }
              var heartColors = ['#ff88cc', '#ffd24a', '#44ffff'];
              particles = particles.concat(
                Game.entities.spawnBurst(bub.x, bub.y, 5, heartColors)
              );
              Game.audio.play('pickup');
              break;
            }
          }
        }

        /* Aliens don't hurt Momoko anymore — skipped.
           This is a "comfortable RPG" for a 7-year-old. */

        /* Player vs pickups — exploration only, all pickups are star gems
           that count for Lila's quest. */
        for (var pk = 0; pk < pickups.length; pk++) {
          var pick = pickups[pk];
          if (!pick.active) continue;
          if (aabb(player, pick)) {
            pick.active = false;
            if (Game.quests && Game.quests.lila === 'inProgress') {
              Game.quests.progress.gems = (Game.quests.progress.gems || 0) + 1;
              if (Game.quests.progress.gems >= 5) {
                Game.quests.lila = 'done';
              }
              savePersistent();
            }
            var hColors = ['#44ffff', '#ff66cc', '#ffd24a'];
            particles = particles.concat(
              Game.entities.spawnBurst(pick.x + 8, pick.y + 8, 8, hColors)
            );
            Game.audio.play('pickup');
            checkVictory();
          }
        }

        /* Player vs NPCs – trigger dialogue (or rocket/house interaction) */
        for (var nc = 0; nc < npcs.length; nc++) {
          var npc = npcs[nc].entity;
          var npcType = npcs[nc].type;
          var npcData = npcs[nc].data || {};
          var dist;
          if (npcType === 'chandelierMonkey') {
            /* Monkeys hang on the chandelier ~270px above the corridor;
               full Euclidean distance would never qualify. Use horizontal
               distance only so a kid walking directly under one can call
               them down for a re-greeting. */
            dist = Math.abs(player.x - npc.x);
          } else {
            dist = Math.sqrt(
              Math.pow(player.x - npc.x, 2) + Math.pow(player.y - npc.y, 2)
            );
          }
          if (dist < 80 && !npc.talking && (!npcCooldowns[npcType] || npcCooldowns[npcType] <= 0)) {
            /* Universal "interact" trigger: action button (Sparkle on
               touch, Space/Z on keyboard) or Up. */
            var interact = jp.up || keys.up || jp.action;
            /* Rocket – open travel menu. */
            if (npcType === 'rocket') {
              if (interact) {
                onRocketInteract();
                npcCooldowns[npcType] = 300;
              }
            } else if (npcType === 'houseDoor') {
              if (interact) {
                var hid = npcData.houseId || 'heroHome';
                /* Deliver any carried shop items into this house's
                   furniture state, scattered across the floor. */
                if (Game.shop && Game.shop.cart && Game.shop.cart.length > 0) {
                  depositCartIntoHouse(hid);
                }
                enterHouse(hid);
                npcCooldowns[npcType] = 300;
              }
            } else if (npcType === 'cafeDoor') {
              if (interact) {
                enterCafe();
                npcCooldowns[npcType] = 300;
              }
            } else if (npcType === 'shopDoor') {
              if (interact) {
                enterShop();
                npcCooldowns[npcType] = 300;
              }
            } else if (npcType === 'animalDoor') {
              if (interact) {
                var sp = npcData.species || 'lion';
                if (sp === 'bedroom') {
                  enterAnimalRoom('bedroom');
                } else {
                  enterAnimalRoom(sp);
                }
                npcCooldowns[npcType] = 300;
              }
            } else if (npcType === 'elevator') {
              if (interact) {
                /* Remember which side the player tapped so when they arrive
                   on the destination floor we can spawn them next to the
                   matching elevator instead of teleporting them to the
                   other end of the corridor. */
                Game.flags.lastTransitSide = npcData.side || 'right';
                onElevatorInteract();
                npcCooldowns[npcType] = 300;
              }
            } else if (npcType === 'stairs') {
              if (interact) {
                Game.flags.lastTransitSide = npcData.side || 'right';
                useStairs(npcData.dir || 'both');
                npcCooldowns[npcType] = 300;
              }
            } else if (npcType === 'receptionist') {
              if (interact) {
                if (npc.interact) npc.interact();
                if (!Game.flags.checkedIn) {
                  /* Trigger the lobby intro cutscene a beat after greeting */
                  setTimeout(beginLobbyIntro, 1200);
                }
                npcCooldowns[npcType] = 300;
              }
            } else if (npcType === 'chandelierMonkey') {
              if (interact) {
                if (npc.interact) npc.interact();
                npcCooldowns[npcType] = 240;
              }
            } else if (npcType === 'lila') {
              if (npc.interact) npc.interact();
              /* Start quest on first contact */
              if (Game.quests && Game.quests.lila === 'notStarted') {
                Game.quests.lila = 'inProgress';
                Game.quests.progress.gems = Game.quests.progress.gems || 0;
                savePersistent();
              }
              npcCooldowns[npcType] = 300;
            } else if (npcType === 'migword') {
              if (npc.interact) npc.interact();
              if (Game.quests && Game.quests.migword === 'notStarted') {
                Game.quests.migword = 'inProgress';
                Game.quests.progress.cheese = Game.quests.progress.cheese || 0;
                Game.quests.progress.miceMet = Game.quests.progress.miceMet || {};
                savePersistent();
              }
              npcCooldowns[npcType] = 300;
            } else if (npcType === 'moonMouse') {
              if (npc.interact) npc.interact();
              /* Greeting a moon mouse advances MigWord's quest, but only
                 once per unique mouse. */
              var mid = npcData.mouseId;
              if (mid && Game.quests && Game.quests.migword === 'inProgress') {
                Game.quests.progress.miceMet = Game.quests.progress.miceMet || {};
                if (!Game.quests.progress.miceMet[mid]) {
                  Game.quests.progress.miceMet[mid] = true;
                  Game.quests.progress.cheese = (Game.quests.progress.cheese || 0) + 1;
                  if (Game.quests.progress.cheese >= 3) {
                    Game.quests.migword = 'done';
                  }
                  savePersistent();
                  checkVictory();
                }
              }
              npcCooldowns[npcType] = 240;
            } else {
              if (npc.interact) npc.interact();
              npcCooldowns[npcType] = 300;
            }
          }
          if (npcCooldowns[npcType] > 0) npcCooldowns[npcType]--;
        }

        /* Rings-view cutscene disabled in Momoko in Space — the town is open
           sky; no ocean surface to break. */

        /* Camera follow */
        var targetCamX = player.x - W / 2 + player.w / 2;
        var targetCamY = player.y - H / 2 + player.h / 2;
        camera.x += (targetCamX - camera.x) * 0.08;
        camera.y += (targetCamY - camera.y) * 0.08;
        /* Clamp camera */
        if (camera.x < 0) camera.x = 0;
        if (camera.x > level.width - W) camera.x = level.width - W;
        camera.y = Math.max(0, Math.min(camera.y, level.height - H));
        /* For this game, clamp y to keep the view mostly stable */
        camera.y = 0; /* Single-screen height */

        break;

      case State.PAUSED:
        if (jp.pause) { state = prevState || State.PLAYING; }
        break;

      case State.GAME_OVER:
        break;

      case State.VICTORY:
        /* Particles still update for fireworks */
        break;

      case State.BEACH:
        if (wolfe) wolfe.update();
        if (Game.ui.updateBeach) Game.ui.updateBeach(keys, jp);
        break;

      case State.TRAVEL_MENU:
        if (jp.pause) { state = State.PLAYING; break; }
        if (Game.ui.updateTravelMenu) {
          var tvKb = Game.ui.updateTravelMenu(keys, jp);
          if (tvKb && typeof tvKb.zone === 'number') {
            rocketTarget = tvKb.zone;
            rocketAnimTimer = 0;
            state = State.ROCKET_ANIM;
            Game.audio.play('victory');
          }
        }
        break;

      case State.ROCKET_ANIM:
        rocketAnimTimer++;
        /* ~2 seconds at 60fps */
        if (rocketAnimTimer > 120) {
          enterZone(rocketTarget);
        }
        break;

      case State.HOUSE_INTERIOR:
        if (jp.pause) { exitHouse(); }
        if (Game.ui.updateHouseInterior) Game.ui.updateHouseInterior(keys, jp, currentHouseId);
        break;

      case State.CAFE_INTERIOR:
        if (jp.pause) { exitCafe(); }
        if (Game.ui.updateCafeInterior) Game.ui.updateCafeInterior(keys, jp);
        break;

      case State.SHOP_INTERIOR:
        if (jp.pause) { exitShop(); }
        if (Game.ui.updateShopInterior) Game.ui.updateShopInterior(keys, jp);
        break;

      case State.ANIMAL_ROOM:
        if (jp.pause) {
          /* Pause from inside an animal room opens the pause menu (and
             returns here on resume) instead of dumping the player back
             out into the corridor — a 7-year-old hitting Esc to "stop"
             expects a menu, not an eject. The EXIT door + arrow on the
             left wall remain the deliberate way out. */
          prevState = State.ANIMAL_ROOM;
          state = State.PAUSED;
          break;
        }
        if (jp.ledger) { openLedger(); break; }
        if (Game.ui.updateAnimalRoom) Game.ui.updateAnimalRoom(keys, jp, Game.currentRoom);
        break;

      case State.SLEEP_CUTSCENE:
        sleepCutsceneTimer++;
        /* Snore loop every ~1.4s */
        if (sleepCutsceneTimer === 30 || sleepCutsceneTimer === 110 || sleepCutsceneTimer === 190) {
          if (Game.audio && Game.audio.play) Game.audio.play('snore');
        }
        /* Allow tap / action to wake early after a brief minimum */
        if (sleepCutsceneTimer > 60 && (jp.action || jp.up || jp.pause)) {
          exitSleepCutscene();
        } else if (sleepCutsceneTimer > 360) {
          exitSleepCutscene();
        }
        break;

      case State.LOBBY_INTRO:
        lobbyIntroTimer++;
        if (Game.ui.updateLobbyIntro) Game.ui.updateLobbyIntro(lobbyIntroTimer);
        if (lobbyIntroTimer > 360) {
          state = State.PLAYING;
          Game.flags.checkedIn = true;
          /* The cutscene visually walks Momoko from her spawn to the
             elevator. Match her real position to where the camera left
             her so she doesn't snap back to the lobby door — otherwise
             she has to walk the full 2100px again to reach what the
             monkey just escorted her to. */
          if (player && level) {
            var elev = null;
            for (var lni = 0; lni < npcs.length; lni++) {
              if (npcs[lni].type === 'elevator') { elev = npcs[lni].entity; break; }
            }
            if (elev) {
              player.x = elev.x - 60;
              player.y = elev.y;
              player.vx = 0; player.vy = 0;
              player.facing = 1;
              camera.x = Math.max(0, Math.min(player.x - W / 2, level.width - W));
            }
          }
          /* The escort is the player's actual meeting with the chandelier
             monkey — stamp them here so the passport's 26th slot is
             reachable in normal play (the monkeys hang well above
             Momoko's interaction radius, so they can't be greeted from
             the floor). */
          stampGuest('monkey');
          savePersistent();
        }
        break;

      case State.BOOKSHELF_CUTSCENE:
        bookshelfTimer++;
        /* Advance pages on action / up press, after a brief lead-in so
           the receptionist can walk in. The total page count comes
           from ui.js so the engine doesn't need to know the story. */
        var bsAdvance = jp.action || jp.up;
        if (bookshelfTimer > 60 && bsAdvance) {
          var totalPages = (Game.ui && Game.ui.getBookshelfPageCount)
            ? Game.ui.getBookshelfPageCount() : 6;
          if (bookshelfPage < totalPages - 1) {
            bookshelfPage++;
          } else {
            exitBookshelfCutscene();
          }
        }
        if (jp.pause) exitBookshelfCutscene();
        break;

      case State.LEDGER:
        if (jp.pause || jp.action || jp.up || jp.ledger) closeLedger();
        break;
    }
  }

  /* ---- Render ---- */
  /* Runs fn with drawing clipped to the game viewport. The overlay
     states (pause, game over) widen the view to the whole canvas on
     tablets so their scrim covers the bezel too; the frozen scene under
     the menu still has to stay inside the 800x480 window. */
  function drawClipped(fn) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    fn();
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    /* Paint side-strip backgrounds first so they sit underneath the pause
       button (which is drawn last, in canvas space). The game viewport in
       the middle is fully overwritten by the state renderer below, so it
       doesn't matter that we paint across it here. */
    /* Menu screens have no touch controls, so on a tablet they paint
       their own dusk sky across the whole canvas instead of sitting in a
       dark frame. Gameplay keeps the bezel so the D-pad has a quiet
       backdrop. */
    var fullBleed = Game.input.isTouch() && (
      state === State.TITLE || state === State.CUSTOMIZE || state === State.INTRO);
    /* Pause and game-over dim the whole screen, bezel included, so the
       menu floats over the frozen game instead of a bright island. */
    var dimAll = Game.input.isTouch() && (
      state === State.PAUSED || state === State.GAME_OVER ||
      state === State.TRAVEL_MENU || state === State.LEDGER || state === State.VICTORY);
    if (Game.input.isTouch() && !fullBleed) {
      Game.input.drawTouchStrip(ctx, false);
    }

    /* Translate so all game / menu rendering keeps using logical 0..W,
       0..H coordinates regardless of the side / top / bottom padding. */
    ctx.save();
    if (GAME_X || GAME_Y) ctx.translate(GAME_X, GAME_Y);
    if (fullBleed || dimAll) {
      Game.ui.setView(-GAME_X, -GAME_Y, CANVAS_W, CANVAS_H);
    } else {
      Game.ui.setView(0, 0, W, H);
      /* Keep the world inside the viewport so it can't bleed into the
         touch bezels. */
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
    }
    if (Game.ui.beginFrame) Game.ui.beginFrame();

    switch (state) {
      case State.TITLE:
        Game.ui.drawTitleScreen(ctx);
        break;

      case State.CUSTOMIZE:
        Game.ui.drawCustomizeScreen(ctx);
        break;

      case State.INTRO:
        Game.ui.drawIntroScreen(ctx);
        break;

      case State.PLAYING:
        renderGame();
        if (Game.ui.drawQuestHUD) Game.ui.drawQuestHUD(ctx);
        /* Dialogue is deferred to canvas-space after the restore so it
           can live in the bottom bezel instead of covering gameplay. */
        pendingDialogue = null;
        for (var nd = 0; nd < npcs.length; nd++) {
          var npc = npcs[nd].entity;
          if (npc.talking) {
            var name = npcs[nd].type;
            var speakerName;
            if (name === 'oliver') speakerName = 'Oliver';
            else if (name === 'kittycorn') speakerName = 'Kitty Corn';
            else if (name === 'bob') speakerName = 'Bob';
            else if (name === 'crab') speakerName = Game.i18n.t('crabName');
            else if (name === 'lila') speakerName = 'Lila';
            else if (name === 'migword') speakerName = 'MigWord';
            else if (name === 'moonMouse') speakerName = Game.i18n.t('mouseName');
            else if (name === 'receptionist') speakerName = Game.i18n.t('receptionistName');
            else if (name === 'chandelierMonkey') speakerName = Game.i18n.t('monkeyName');
            else if (name === 'animal') {
              speakerName = Game.i18n.t('animalName_' + (npc.species || 'lion'));
            }
            else speakerName = name;
            var text = npc.currentJoke || npc.currentText || '';
            pendingDialogue = { speaker: speakerName, text: text };
          }
        }
        break;

      case State.TRAVEL_MENU:
        drawClipped(renderGame);
        if (Game.ui.drawTravelMenu) Game.ui.drawTravelMenu(ctx);
        break;

      case State.ROCKET_ANIM:
        if (Game.ui.drawRocketAnim) Game.ui.drawRocketAnim(ctx, rocketAnimTimer, rocketTarget);
        break;

      case State.HOUSE_INTERIOR:
        if (Game.ui.drawHouseInterior) Game.ui.drawHouseInterior(ctx, currentHouseId, player);
        break;

      case State.CAFE_INTERIOR:
        if (Game.ui.drawCafeInterior) Game.ui.drawCafeInterior(ctx);
        break;

      case State.SHOP_INTERIOR:
        if (Game.ui.drawShopInterior) Game.ui.drawShopInterior(ctx);
        break;

      case State.ANIMAL_ROOM:
        if (Game.ui.drawAnimalRoomInterior) Game.ui.drawAnimalRoomInterior(ctx, Game.currentRoom, player);
        /* HUD here too, so the stamp celebration toast lands at the moment
           the player greets a new animal — but suppress the PAUSE (P)
           hint inside the cozy room, where it competes with the art. */
        if (Game.ui.drawQuestHUD) Game.ui.drawQuestHUD(ctx, { showPauseHint: false });
        /* Surface dialogue from the in-room animal (if any) below the
           viewport in the bottom bezel — same flow as PLAYING. */
        pendingDialogue = null;
        if (Game.ui.getAnimalRoomDialogue) {
          var arDlg = Game.ui.getAnimalRoomDialogue();
          if (arDlg) pendingDialogue = arDlg;
        }
        break;

      case State.SLEEP_CUTSCENE:
        if (Game.ui.drawSleepCutscene) Game.ui.drawSleepCutscene(ctx, sleepCutsceneTimer);
        break;

      case State.LOBBY_INTRO:
        /* Render the lobby behind the cutscene so the escort reads as
           "monkey walking Momoko across the room" rather than a black
           void with a floating sprite. */
        renderGame();
        if (Game.ui.drawLobbyIntro) Game.ui.drawLobbyIntro(ctx, lobbyIntroTimer, player, npcs);
        break;

      case State.BOOKSHELF_CUTSCENE:
        if (Game.ui.drawBookshelfCutscene) {
          Game.ui.drawBookshelfCutscene(ctx, bookshelfTimer, bookshelfPage);
        }
        break;

      case State.LEDGER:
        /* Render the underlying state first (so the ledger sits over it
           like a paused overlay), then draw the passport on top. */
        drawClipped(function () {
          if (ledgerPrevState === State.ANIMAL_ROOM) {
            if (Game.ui.drawAnimalRoomInterior) Game.ui.drawAnimalRoomInterior(ctx, Game.currentRoom, player);
          } else {
            renderGame();
            if (Game.ui.drawQuestHUD) Game.ui.drawQuestHUD(ctx);
          }
        });
        if (Game.ui.drawLedger) Game.ui.drawLedger(ctx);
        break;

      case State.PAUSED:
        /* Paint the underlying scene so the pause menu reads as an
           overlay on top of "where she actually is" — corridor lobby
           if she paused from PLAYING, animal-room habitat if she
           paused from inside a guest's room. */
        drawClipped(function () {
          if (prevState === State.ANIMAL_ROOM && Game.ui.drawAnimalRoomInterior) {
            Game.ui.drawAnimalRoomInterior(ctx, Game.currentRoom, player);
          } else {
            renderGame();
          }
        });
        Game.ui.drawPauseMenu(ctx);
        break;

      case State.GAME_OVER:
        drawClipped(renderGame);
        Game.ui.drawGameOver(ctx);
        break;

      case State.VICTORY:
        /* Render the live lobby/floor underneath so the celebration
           feels rooted in the place she just finished. */
        drawClipped(renderGame);
        Game.ui.drawVictory(ctx);
        break;

      case State.BEACH:
        Game.ui.drawBeachCutscene(ctx, wolfe);
        break;
    }

    ctx.restore();

    updateChrome();

    /* Canvas-space overlays sit outside the game viewport so they can
       use the bezel area. */
    if (Game.input.isTouch() && (state === State.PLAYING || state === State.PAUSED)) {
      /* QR code in the upper-right bezel inviting another player to scan.
         Sized to fit between the pause button (top) and the BUBBLE
         action button (middle) even on a short iPhone canvas. */
      var rightCx = CANVAS_W - Game.TOUCH_RIGHT_W / 2;
      var qrSize = Math.min(Game.TOUCH_RIGHT_W - 16, 110);
      var qrCy = 62 + qrSize / 2;
      if (qrSize >= 60 && Game.ui.drawQRCode) {
        Game.ui.drawQRCode(ctx, rightCx, qrCy, qrSize);
      }
    }
    if (Game.input.isTouch() && (
        state === State.PLAYING ||
        state === State.BEACH ||
        state === State.HOUSE_INTERIOR ||
        state === State.CAFE_INTERIOR ||
        state === State.SHOP_INTERIOR ||
        state === State.ANIMAL_ROOM ||
        state === State.LOBBY_INTRO ||
        state === State.BOOKSHELF_CUTSCENE)) {
      Game.input.drawTouchButtons(ctx);
    }

    /* Dialogue – drawn in canvas-space so it lives in the bottom bezel. */
    if ((state === State.PLAYING || state === State.ANIMAL_ROOM) &&
        pendingDialogue && Game.ui.drawDialogue) {
      Game.ui.drawDialogue(
        ctx,
        pendingDialogue.speaker,
        pendingDialogue.text,
        CANVAS_W, CANVAS_H, GAME_X, GAME_Y
      );
    }
  }

  /* DOM bits that track the game state: the Game Center link only shows
     where it can't cover play, and the cursor turns into a pointer over
     anything clickable. */
  var linkEl = null, lastLinkShown = null, lastCursor = null;
  function updateChrome() {
    if (!linkEl) linkEl = document.getElementById('game-center-link');
    var show = state === State.TITLE || state === State.PAUSED;
    if (linkEl && show !== lastLinkShown) {
      linkEl.classList.toggle('hidden', !show);
      lastLinkShown = show;
    }
    var cursor = Game.ui.isHot && Game.ui.isHot() ? 'pointer' : 'default';
    if (cursor !== lastCursor) { canvas.style.cursor = cursor; lastCursor = cursor; }
  }

  function renderGame() {
    if (!level) return;

    /* Hotel corridor: ceiling, wallpaper, windows, wainscot, floor */
    drawHotelBackdrop();

    /* Decorations */
    renderDecorations();

    /* Lamps and their warm light pools sit over the decorations */
    drawHotelLighting();

    /* (No collision platforms — Momoko floats freely through open space.) */

    /* Pickups */
    for (var pk = 0; pk < pickups.length; pk++) {
      pickups[pk].draw(ctx, camera.x, camera.y);
    }

    /* NPCs */
    for (var nc = 0; nc < npcs.length; nc++) {
      npcs[nc].entity.draw(ctx, camera.x, camera.y);
      /* Interaction indicator — a small bobbing "↑" card so kids who
         can't read "!" still know the up arrow / Talk button does
         something here. Shows whenever the player is inside the same
         80px radius the interact handler uses. */
      var npc = npcs[nc].entity;
      if (!npc.talking) {
        var ndist = Math.sqrt(
          Math.pow(player.x - npc.x, 2) + Math.pow(player.y - npc.y, 2)
        );
        if (ndist < 80) {
          var ix = npc.x - camera.x + npc.w / 2;
          var iy = npc.y - camera.y - 22;
          var bob = Math.sin(Date.now() * 0.005) * 2;
          var bw = 26, bh = 22;
          ctx.save();
          ctx.translate(0, bob);
          /* Pill background */
          ctx.fillStyle = '#fff8e0';
          ctx.strokeStyle = '#caa040';
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(ix - bw / 2, iy - bh / 2, bw, bh, 6);
          else ctx.rect(ix - bw / 2, iy - bh / 2, bw, bh);
          ctx.fill();
          ctx.stroke();
          /* Up arrow */
          ctx.fillStyle = '#a8211f';
          ctx.font = 'bold 16px "M PLUS Rounded 1c", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('↑', ix, iy + 1);
          ctx.textBaseline = 'alphabetic';
          ctx.restore();
        }
      }
    }

    /* Hanging wayfinding sign above the elevator so players can tell it
       apart from the stairs. Animal doors and stairs carry their own
       name plates (entities.js), so they don't get a second label here.
       Rendered after the NPCs so the sign sits over the frame's top edge. */
    for (var nm = 0; nm < npcs.length; nm++) {
      if (npcs[nm].type !== 'elevator') continue;
      var dnpc = npcs[nm].entity;
      var nx = dnpc.x - camera.x + dnpc.w / 2;
      var ny = dnpc.y - camera.y - 24;
      var label = Game.i18n.t('signElevator').toUpperCase();
      ctx.font = 'bold 9px "M PLUS Rounded 1c", sans-serif';
      var tw = ctx.measureText(label).width;
      var pw = Math.max(tw + 14, 44);
      var ph = 14;
      /* Sign rope */
      ctx.strokeStyle = '#caa040';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(nx - 6, ny - ph / 2 - 4);
      ctx.lineTo(nx - 6, ny - ph / 2);
      ctx.moveTo(nx + 6, ny - ph / 2 - 4);
      ctx.lineTo(nx + 6, ny - ph / 2);
      ctx.stroke();
      /* Sign body */
      ctx.fillStyle = '#fff8e0';
      ctx.fillRect(nx - pw / 2, ny - ph / 2, pw, ph);
      ctx.strokeStyle = '#7a5018';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(nx - pw / 2, ny - ph / 2, pw, ph);
      ctx.fillStyle = '#3a1f10';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, nx, ny + 0.5);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
    }

    /* Bob submarine (drawn by npc loop above) */

    /* Enemies */
    for (var ei = 0; ei < enemies.length; ei++) {
      enemies[ei].draw(ctx, camera.x, camera.y);
    }

    /* Player bubbles */
    for (var bi = 0; bi < bubbles.length; bi++) {
      bubbles[bi].draw(ctx, camera.x, camera.y);
    }

    /* Player */
    if (player) player.draw(ctx, camera.x, camera.y);

    /* Shop-cart carry overlay — bobbing item icons floating above Momoko's
       head while she walks her purchases home. */
    if (player && Game.shop && Game.shop.cart && Game.shop.cart.length > 0 && Game.ui && Game.ui.drawCarryOverlay) {
      Game.ui.drawCarryOverlay(ctx, player, camera.x, camera.y);
    }

    /* Wolfe (visible near surface) */
    if (wolfe && camera.y <= 20) {
      wolfe.draw(ctx, camera.x, camera.y);
    }

    /* Particles */
    for (var pa = 0; pa < particles.length; pa++) {
      particles[pa].draw(ctx, camera.x, camera.y);
    }

    /* Warm vignette so the corridor feels lamp-lit at the edges */
    var fogGrad = ctx.createRadialGradient(W / 2, H / 2, 160, W / 2, H / 2, W * 0.72);
    fogGrad.addColorStop(0, 'rgba(40, 18, 6, 0)');
    fogGrad.addColorStop(1, 'rgba(40, 18, 6, 0.32)');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, 0, W, H);
  }

  function renderDecorations() {
    if (!level) return;
    for (var i = 0; i < level.decorations.length; i++) {
      var d = level.decorations[i];
      var dx = d.x - camera.x;
      if (dx < -100 || dx > W + 100) continue;
      var dy = d.y - camera.y;

      if (d.type === 'antenna') {
        /* Radio tower silhouette with blinking top light */
        var th = d.h || 80;
        ctx.strokeStyle = '#7d8896';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx, dy - th);
        ctx.stroke();
        /* Cross beams */
        ctx.lineWidth = 1;
        for (var an = 1; an <= 4; an++) {
          var ay = dy - (th * an / 5);
          var aw = 3 + (4 - an) * 2;
          ctx.beginPath();
          ctx.moveTo(dx - aw, ay);
          ctx.lineTo(dx + aw, ay);
          ctx.stroke();
        }
        /* Blink tip */
        var blink = (Math.sin(Date.now() * 0.004 + d.x * 0.01) > 0) ? '#ff3344' : '#661122';
        ctx.fillStyle = blink;
        ctx.beginPath();
        ctx.arc(dx, dy - th - 2, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === 'satellite') {
        /* Satellite dish on a tripod */
        ctx.fillStyle = '#556677';
        ctx.fillRect(dx - 1, dy - 8, 2, 8);
        ctx.beginPath();
        ctx.moveTo(dx - 6, dy);
        ctx.lineTo(dx - 2, dy - 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(dx + 6, dy);
        ctx.lineTo(dx + 2, dy - 10);
        ctx.stroke();
        /* Dish */
        ctx.fillStyle = '#99aabb';
        ctx.beginPath();
        ctx.arc(dx, dy - 12, 7, Math.PI * 0.1, Math.PI * 0.9, true);
        ctx.fill();
        ctx.fillStyle = '#ffd24a';
        ctx.beginPath();
        ctx.arc(dx, dy - 13, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === 'crystal') {
        /* Glowing crystal cluster */
        var cColors = ['#88ddff', '#ff66cc', '#ffd24a'];
        var baseC = cColors[(d.variant || 0) % cColors.length];
        ctx.fillStyle = baseC;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx - 4, dy - 2);
        ctx.lineTo(dx - 2, dy - 10);
        ctx.lineTo(dx + 2, dy - 10);
        ctx.lineTo(dx + 4, dy - 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.moveTo(dx - 1, dy - 2);
        ctx.lineTo(dx - 1, dy - 9);
        ctx.lineTo(dx + 1, dy - 9);
        ctx.closePath();
        ctx.fill();
      } else if (d.type === 'planetRing') {
        /* Small ringed planet in foreground */
        ctx.fillStyle = d.color || '#cc88ff';
        ctx.beginPath();
        ctx.arc(dx, dy, d.r || 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffd24a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(dx, dy, (d.r || 18) + 8, 4, -0.3, 0, Math.PI * 2);
        ctx.stroke();
      } else if (d.type === 'rocketPad') {
        /* Static pad — the actual Rocket NPC draws the ship */
        ctx.fillStyle = '#4a4a5a';
        ctx.fillRect(dx - 30, dy - 4, 60, 6);
        ctx.fillStyle = '#66667a';
        ctx.fillRect(dx - 28, dy - 5, 56, 2);
        /* Warning stripes */
        ctx.fillStyle = '#ffd24a';
        for (var rsv = 0; rsv < 4; rsv++) {
          ctx.fillRect(dx - 26 + rsv * 14, dy - 4, 6, 1.5);
        }
      } else if (d.type === 'houseDecor') {
        /* Big sci-fi house silhouette behind the door */
        var hc = d.color || '#8866aa';
        var rc = d.roofColor || '#cc4488';
        /* Body */
        ctx.fillStyle = hc;
        ctx.fillRect(dx - 50, dy - 90, 100, 90);
        /* Side trim shading */
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(dx + 35, dy - 90, 15, 90);
        /* Roof — dome plus trim ring */
        ctx.fillStyle = rc;
        ctx.beginPath();
        ctx.ellipse(dx, dy - 90, 56, 26, 0, Math.PI, 0);
        ctx.fill();
        /* Roof antenna */
        ctx.strokeStyle = '#ddddee';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dx, dy - 116);
        ctx.lineTo(dx, dy - 134);
        ctx.stroke();
        ctx.fillStyle = '#44ffff';
        ctx.beginPath();
        ctx.arc(dx, dy - 136, 3, 0, Math.PI * 2);
        ctx.fill();
        /* Glowing windows — three across */
        var winColors = ['#ffd24a', '#44ffff', '#ff88cc'];
        for (var hwn = 0; hwn < 3; hwn++) {
          ctx.fillStyle = winColors[hwn];
          ctx.fillRect(dx - 38 + hwn * 28, dy - 70, 18, 18);
          /* Cross frames */
          ctx.fillStyle = '#221133';
          ctx.fillRect(dx - 38 + hwn * 28 + 8, dy - 70, 2, 18);
          ctx.fillRect(dx - 38 + hwn * 28, dy - 62, 18, 2);
        }
        /* Glowing trim along the base */
        ctx.fillStyle = '#44ffff';
        ctx.fillRect(dx - 50, dy - 6, 100, 2);
        /* Door arch outline above the actual door entity */
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(dx - 26, dy - 50, 52, 50);
      } else if (d.type === 'cafeBuilding') {
        /* COSMIC CAFÉ — pink storefront, striped awning, big window with
           espresso machine + tiny patron, drifting steam. */
        var cbT = Date.now() * 0.003;
        /* Building body — deep magenta with vertical wall gradient */
        var cbBody = ctx.createLinearGradient(dx, dy - 130, dx, dy);
        cbBody.addColorStop(0, '#d8438a');
        cbBody.addColorStop(0.55, '#a82c6e');
        cbBody.addColorStop(1, '#5a1842');
        ctx.fillStyle = cbBody;
        ctx.fillRect(dx - 70, dy - 130, 140, 130);
        /* Outer trim */
        ctx.strokeStyle = '#ffe9f4';
        ctx.lineWidth = 2;
        ctx.strokeRect(dx - 70, dy - 130, 140, 130);
        /* Tile-band trim along the bottom */
        ctx.fillStyle = '#2a0a1a';
        ctx.fillRect(dx - 70, dy - 14, 140, 14);
        for (var cbi = 0; cbi < 7; cbi++) {
          ctx.fillStyle = (cbi % 2) ? '#ffd24a' : '#44ffff';
          ctx.fillRect(dx - 68 + cbi * 20, dy - 11, 16, 8);
        }
        /* Striped awning — pink + cream stripes, scalloped bottom */
        var awY = dy - 100;
        for (var aw = 0; aw < 7; aw++) {
          ctx.fillStyle = (aw % 2) ? '#ffe9f4' : '#ff66aa';
          ctx.fillRect(dx - 70 + aw * 20, awY, 20, 18);
        }
        ctx.fillStyle = '#ff4488';
        ctx.fillRect(dx - 72, awY - 4, 144, 6);
        /* Scalloped fringe */
        ctx.fillStyle = '#ff66aa';
        for (var sc = 0; sc < 7; sc++) {
          ctx.beginPath();
          ctx.arc(dx - 60 + sc * 20, awY + 18, 6, 0, Math.PI);
          ctx.fill();
        }
        /* Cursive "Café" label across the awning */
        ctx.save();
        ctx.fillStyle = '#3a0a22';
        ctx.font = 'bold italic 16px "Brush Script MT", cursive';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Café', dx, awY + 9);
        ctx.restore();
        /* Big front window — warm interior glow */
        var winX = dx - 55, winY = dy - 78, winW = 70, winH = 50;
        var winGrad = ctx.createLinearGradient(winX, winY, winX, winY + winH);
        winGrad.addColorStop(0, '#ffd28a');
        winGrad.addColorStop(1, '#d97a3a');
        ctx.fillStyle = winGrad;
        ctx.fillRect(winX, winY, winW, winH);
        /* Window frame */
        ctx.strokeStyle = '#3a1a2a';
        ctx.lineWidth = 2;
        ctx.strokeRect(winX, winY, winW, winH);
        ctx.beginPath();
        ctx.moveTo(winX + winW / 2, winY); ctx.lineTo(winX + winW / 2, winY + winH);
        ctx.moveTo(winX, winY + winH / 2); ctx.lineTo(winX + winW, winY + winH / 2);
        ctx.stroke();
        /* Espresso machine on the counter inside (left pane) */
        ctx.fillStyle = '#d8d8e0';
        ctx.fillRect(winX + 6, winY + 22, 22, 16);
        ctx.fillStyle = '#7a8896';
        ctx.fillRect(winX + 8, winY + 36, 18, 4);
        ctx.fillStyle = '#3a2a44';
        ctx.fillRect(winX + 12, winY + 40, 10, 5);
        /* Tiny patron silhouette in the right pane */
        ctx.fillStyle = '#3a1a2a';
        ctx.beginPath(); ctx.arc(winX + 52, winY + 28, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(winX + 48, winY + 32, 8, 12);
        /* Steam puff — drifts up animated */
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(cbT) * 0.2;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(winX + 19, winY + 14 - (cbT * 6 % 16), 3, 0, Math.PI * 2);
        ctx.arc(winX + 22, winY + 10 - (cbT * 6 % 16), 2.4, 0, Math.PI * 2);
        ctx.arc(winX + 17, winY + 9 - (cbT * 6 % 16), 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        /* Cafe door (right side) — heart cutout window */
        ctx.fillStyle = '#7a2454';
        ctx.fillRect(dx + 22, dy - 56, 28, 56);
        ctx.strokeStyle = '#ffd24a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(dx + 22, dy - 56, 28, 56);
        ctx.fillStyle = '#ffd24a';
        var hX = dx + 36, hY = dy - 38;
        ctx.beginPath();
        ctx.arc(hX - 2.5, hY - 2, 2.5, 0, Math.PI * 2);
        ctx.arc(hX + 2.5, hY - 2, 2.5, 0, Math.PI * 2);
        ctx.moveTo(hX - 4.5, hY); ctx.lineTo(hX, hY + 5); ctx.lineTo(hX + 4.5, hY);
        ctx.closePath();
        ctx.fill();
        /* Door knob */
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath(); ctx.arc(dx + 27, dy - 28, 1.6, 0, Math.PI * 2); ctx.fill();
        /* Outdoor table + chair on the patio */
        var tbx = dx - 90;
        ctx.fillStyle = '#3a2a44';
        ctx.fillRect(tbx - 1.5, dy - 18, 3, 18);
        ctx.fillStyle = '#ffe9f4';
        ctx.beginPath();
        ctx.ellipse(tbx, dy - 18, 11, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        /* Mug on the table */
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(tbx - 3, dy - 26, 6, 6);
        ctx.strokeStyle = '#ffd24a';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(tbx + 5, dy - 23, 2.5, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        /* Steam from the mug */
        ctx.save();
        ctx.globalAlpha = 0.6 + Math.sin(cbT * 1.2) * 0.2;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(tbx, dy - 30 - (cbT * 4 % 6), 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(tbx + 2, dy - 33 - (cbT * 4 % 6), 1.1, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        /* Chair next to it */
        ctx.fillStyle = '#ff66aa';
        ctx.fillRect(tbx + 12, dy - 14, 7, 14);
        ctx.fillRect(tbx + 12, dy - 22, 2, 10);
        /* Chalkboard menu hung beside the door */
        ctx.fillStyle = '#1a2a1a';
        ctx.fillRect(dx + 50, dy - 70, 18, 26);
        ctx.strokeStyle = '#88553a';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(dx + 50, dy - 70, 18, 26);
        ctx.fillStyle = '#ffe9f4';
        ctx.font = '5px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('MENU', dx + 59, dy - 62);
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(dx + 53, dy - 58, 12, 1);
        ctx.fillRect(dx + 53, dy - 54, 10, 1);
        ctx.fillRect(dx + 53, dy - 50, 11, 1);
        ctx.textAlign = 'left';
      } else if (d.type === 'shopBuilding') {
        /* SPACE BAZAAR — gold/teal storefront, big display window with
           merchandise, glowing OPEN sign, retro double doors. */
        var sbT = Date.now() * 0.004;
        /* Body */
        var sbBody = ctx.createLinearGradient(dx, dy - 130, dx, dy);
        sbBody.addColorStop(0, '#3aa8c4');
        sbBody.addColorStop(0.6, '#247088');
        sbBody.addColorStop(1, '#0e3a4a');
        ctx.fillStyle = sbBody;
        ctx.fillRect(dx - 75, dy - 130, 150, 130);
        ctx.strokeStyle = '#cdeaf4';
        ctx.lineWidth = 2;
        ctx.strokeRect(dx - 75, dy - 130, 150, 130);
        /* Stepped roofline (deco-style) */
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(dx - 75, dy - 130, 150, 8);
        ctx.fillStyle = '#ffaa22';
        ctx.fillRect(dx - 60, dy - 138, 120, 8);
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(dx - 35, dy - 146, 70, 8);
        /* Roof antenna with blinker */
        ctx.strokeStyle = '#cdeaf4';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(dx, dy - 146); ctx.lineTo(dx, dy - 162);
        ctx.stroke();
        ctx.fillStyle = (Math.sin(sbT * 4) > 0) ? '#ff4466' : '#660022';
        ctx.beginPath(); ctx.arc(dx, dy - 164, 2.6, 0, Math.PI * 2); ctx.fill();
        /* "BAZAAR" name plate above window */
        ctx.fillStyle = '#0a1a22';
        ctx.fillRect(dx - 60, dy - 116, 120, 18);
        ctx.fillStyle = '#ffd24a';
        ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★ BAZAAR ★', dx, dy - 107);
        ctx.textBaseline = 'alphabetic';
        /* Big display window with shelves */
        var swX = dx - 64, swY = dy - 92, swW = 92, swH = 60;
        var swGrad = ctx.createLinearGradient(swX, swY, swX, swY + swH);
        swGrad.addColorStop(0, '#cdeaf4');
        swGrad.addColorStop(1, '#6aaec0');
        ctx.fillStyle = swGrad;
        ctx.fillRect(swX, swY, swW, swH);
        ctx.strokeStyle = '#0a1a22';
        ctx.lineWidth = 2;
        ctx.strokeRect(swX, swY, swW, swH);
        /* Shelves (3 rows) */
        ctx.fillStyle = '#a87a3a';
        ctx.fillRect(swX + 2, swY + 18, swW - 4, 2);
        ctx.fillRect(swX + 2, swY + 38, swW - 4, 2);
        /* Merchandise — top shelf: potions */
        var pot = ['#ff66aa', '#44ff88', '#ffd24a', '#cc88ff'];
        for (var pp = 0; pp < 4; pp++) {
          var px = swX + 8 + pp * 21;
          ctx.fillStyle = pot[pp];
          ctx.fillRect(px, swY + 8, 6, 10);
          ctx.fillStyle = '#3a2a44';
          ctx.fillRect(px + 1, swY + 6, 4, 3);
        }
        /* Middle shelf: hat, helmet, ring, gem */
        ctx.fillStyle = '#5a3a8a';
        ctx.beginPath();
        ctx.moveTo(swX + 8, swY + 38);
        ctx.lineTo(swX + 14, swY + 24);
        ctx.lineTo(swX + 20, swY + 38);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(swX + 6, swY + 36, 16, 2);
        /* Helmet */
        ctx.fillStyle = '#aabbcc';
        ctx.beginPath();
        ctx.arc(swX + 32, swY + 33, 6, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#44ffff';
        ctx.fillRect(swX + 28, swY + 30, 8, 2);
        /* Ring */
        ctx.strokeStyle = '#ffd24a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(swX + 50, swY + 32, 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ff66cc';
        ctx.beginPath();
        ctx.arc(swX + 50, swY + 28, 1.6, 0, Math.PI * 2);
        ctx.fill();
        /* Gem (shimmery) */
        var gemA = 0.6 + Math.sin(sbT * 2) * 0.4;
        ctx.save();
        ctx.globalAlpha = gemA;
        ctx.fillStyle = '#44ffff';
        ctx.beginPath();
        ctx.moveTo(swX + 70, swY + 28);
        ctx.lineTo(swX + 75, swY + 32);
        ctx.lineTo(swX + 70, swY + 38);
        ctx.lineTo(swX + 65, swY + 32);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        /* Bottom shelf: stack of books, scroll, boots */
        ctx.fillStyle = '#cc4466';
        ctx.fillRect(swX + 6, swY + 46, 14, 4);
        ctx.fillStyle = '#4488cc';
        ctx.fillRect(swX + 6, swY + 50, 14, 4);
        ctx.fillStyle = '#44aa66';
        ctx.fillRect(swX + 6, swY + 54, 14, 4);
        /* Scroll */
        ctx.fillStyle = '#ffe9c8';
        ctx.fillRect(swX + 28, swY + 50, 14, 8);
        ctx.fillStyle = '#aa6622';
        ctx.fillRect(swX + 28, swY + 50, 2, 8);
        ctx.fillRect(swX + 40, swY + 50, 2, 8);
        /* Boots */
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(swX + 56, swY + 50, 6, 8);
        ctx.fillRect(swX + 64, swY + 50, 6, 8);
        ctx.fillRect(swX + 60, swY + 56, 14, 2);
        /* Window mullion cross */
        ctx.strokeStyle = '#0a1a22';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(swX + swW / 2, swY); ctx.lineTo(swX + swW / 2, swY + swH);
        ctx.stroke();
        /* OPEN sign — flickers */
        var openOn = (Math.sin(sbT * 3 + d.x * 0.01) > -0.6);
        ctx.save();
        ctx.globalAlpha = openOn ? 1 : 0.35;
        ctx.fillStyle = '#1a0a14';
        ctx.fillRect(swX + 8, swY - 12, 28, 12);
        ctx.fillStyle = '#ff4466';
        ctx.font = 'bold 9px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('OPEN', swX + 22, swY - 6);
        ctx.restore();
        ctx.textBaseline = 'alphabetic';
        /* Display-window glow halo */
        ctx.save();
        ctx.globalAlpha = 0.18 + Math.sin(sbT) * 0.04;
        var halo = ctx.createRadialGradient(dx, swY + swH / 2, 4, dx, swY + swH / 2, 90);
        halo.addColorStop(0, '#ffd24a');
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.fillRect(swX - 20, swY - 20, swW + 40, swH + 40);
        ctx.restore();
        /* Double doors on the right */
        var sdX = dx + 30;
        ctx.fillStyle = '#1a0a14';
        ctx.fillRect(sdX, dy - 56, 38, 56);
        ctx.fillStyle = '#7a3344';
        ctx.fillRect(sdX + 1, dy - 55, 17, 54);
        ctx.fillRect(sdX + 20, dy - 55, 17, 54);
        ctx.strokeStyle = '#ffd24a';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(sdX + 1, dy - 55, 17, 54);
        ctx.strokeRect(sdX + 20, dy - 55, 17, 54);
        /* Door porthole windows */
        ctx.fillStyle = '#cdeaf4';
        ctx.beginPath(); ctx.arc(sdX + 9.5, dy - 42, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sdX + 28.5, dy - 42, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#0a1a22';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sdX + 9.5, dy - 42, 3.5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(sdX + 28.5, dy - 42, 3.5, 0, Math.PI * 2); ctx.stroke();
        /* Door knobs (center pull-handles) */
        ctx.fillStyle = '#ffd24a';
        ctx.beginPath(); ctx.arc(sdX + 16, dy - 26, 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sdX + 22, dy - 26, 1.4, 0, Math.PI * 2); ctx.fill();
        /* Welcome mat */
        ctx.fillStyle = '#ff66aa';
        ctx.fillRect(sdX - 2, dy - 4, 42, 4);
        ctx.fillStyle = '#ffe9f4';
        ctx.fillRect(sdX, dy - 3, 38, 1);
        /* Sandwich-board sign on the sidewalk */
        ctx.fillStyle = '#3a2a44';
        ctx.fillRect(dx - 92, dy - 24, 12, 24);
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(dx - 90, dy - 22, 8, 2);
        ctx.fillRect(dx - 90, dy - 18, 8, 2);
        ctx.fillRect(dx - 90, dy - 14, 8, 2);
        ctx.fillRect(dx - 90, dy - 10, 6, 2);
        /* Tiny barrel beside it */
        ctx.fillStyle = '#7a4a22';
        ctx.fillRect(dx - 110, dy - 18, 14, 18);
        ctx.strokeStyle = '#ffd24a';
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(dx - 110, dy - 14); ctx.lineTo(dx - 96, dy - 14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(dx - 110, dy - 8); ctx.lineTo(dx - 96, dy - 8); ctx.stroke();
      } else if (d.type === 'lampPost') {
        /* Tall thin pole with a glowing neon lamp on top */
        var lpC = d.color || '#44ffff';
        ctx.fillStyle = '#7d8896';
        ctx.fillRect(dx - 1.5, dy - 80, 3, 80);
        /* Lamp head */
        ctx.fillStyle = '#3a3a4a';
        ctx.beginPath();
        ctx.ellipse(dx, dy - 84, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        /* Glow */
        ctx.save();
        ctx.globalAlpha = 0.4 + Math.sin(Date.now() * 0.003 + d.x * 0.01) * 0.1;
        var lpGrd = ctx.createRadialGradient(dx, dy - 80, 2, dx, dy - 80, 28);
        lpGrd.addColorStop(0, lpC);
        lpGrd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = lpGrd;
        ctx.beginPath();
        ctx.arc(dx, dy - 80, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        /* Bulb */
        ctx.fillStyle = lpC;
        ctx.beginPath();
        ctx.arc(dx, dy - 80, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(dx - 0.8, dy - 81, 1.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === 'wingPlaque') {
        /* Brass wall plaque naming the wing */
        var wpq = wingTheme();
        var wpText = Game.i18n.t(d.textKey);
        ctx.font = 'bold 15px "M PLUS Rounded 1c", sans-serif';
        var wpW = Math.max(150, ctx.measureText(wpText).width + 36);
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = wpq.trimLo;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(dx - wpW / 2, dy - 20, wpW, 40, 8); ctx.fill(); }
        else ctx.fillRect(dx - wpW / 2, dy - 20, wpW, 40);
        ctx.restore();
        var wpg = ctx.createLinearGradient(0, dy - 16, 0, dy + 16);
        wpg.addColorStop(0, '#fcd870');
        wpg.addColorStop(1, '#b08a30');
        ctx.fillStyle = wpg;
        ctx.fillRect(dx - wpW / 2 + 4, dy - 16, wpW - 8, 32);
        ctx.fillStyle = '#5a3a10';
        ctx.beginPath(); ctx.arc(dx - wpW / 2 + 11, dy, 2, 0, Math.PI * 2); ctx.arc(dx + wpW / 2 - 11, dy, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a2008';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(wpText, dx, dy + 1);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
      } else if (d.type === 'rooftopSign') {
        /* Compact neon sign mounted on the rooftop of the cafe/shop building
           — sits above the awning so it doesn't obscure the storefront. */
        var rsC = d.color || '#44ffff';
        var rsTxt = d.text || 'SHOP';
        var rsY = dy - 158;
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(dx - 38, rsY, 76, 22);
        ctx.strokeStyle = rsC;
        ctx.lineWidth = 2;
        ctx.strokeRect(dx - 38, rsY, 76, 22);
        ctx.save();
        ctx.globalAlpha = 0.85 + Math.sin(Date.now() * 0.012 + d.x * 0.03) * 0.15;
        ctx.fillStyle = rsC;
        ctx.font = 'bold 13px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(rsTxt, dx, rsY + 11);
        ctx.restore();
        /* Soft halo */
        ctx.save();
        var rsHalo = ctx.createRadialGradient(dx, rsY + 11, 4, dx, rsY + 11, 60);
        rsHalo.addColorStop(0, rsC);
        rsHalo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.18 + Math.sin(Date.now() * 0.004 + d.x * 0.01) * 0.05;
        ctx.fillStyle = rsHalo;
        ctx.fillRect(dx - 60, rsY - 14, 120, 50);
        ctx.restore();
        ctx.textBaseline = 'alphabetic';
      } else if (d.type === 'techPanel') {
        /* Embedded ground panel with pulsing lights */
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(dx - 18, dy - 4, 36, 6);
        ctx.fillStyle = '#3a3a4a';
        ctx.fillRect(dx - 17, dy - 3, 34, 4);
        /* Pulse lights */
        var pulse = (Math.sin(Date.now() * 0.005 + d.x * 0.02) + 1) * 0.5;
        var lightCols = ['#44ff88', '#44ffff', '#ff66cc'];
        for (var tpl = 0; tpl < 3; tpl++) {
          ctx.fillStyle = lightCols[tpl];
          ctx.globalAlpha = 0.5 + pulse * 0.5;
          ctx.beginPath();
          ctx.arc(dx - 12 + tpl * 12, dy - 1, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else if (d.type === 'robotStatue') {
        /* Cute mascot robot statue on a small pedestal */
        /* Pedestal */
        ctx.fillStyle = '#445566';
        ctx.fillRect(dx - 12, dy - 8, 24, 8);
        ctx.fillStyle = '#5a6a78';
        ctx.fillRect(dx - 14, dy - 10, 28, 3);
        /* Body */
        ctx.fillStyle = '#aabbcc';
        ctx.fillRect(dx - 8, dy - 26, 16, 18);
        /* Head */
        ctx.fillStyle = '#ccdde8';
        ctx.fillRect(dx - 7, dy - 38, 14, 12);
        /* Antenna */
        ctx.strokeStyle = '#ccdde8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(dx, dy - 38);
        ctx.lineTo(dx, dy - 44);
        ctx.stroke();
        ctx.fillStyle = '#ff66cc';
        ctx.beginPath();
        ctx.arc(dx, dy - 45, 1.5, 0, Math.PI * 2);
        ctx.fill();
        /* Eyes */
        ctx.fillStyle = '#44ffff';
        ctx.fillRect(dx - 4, dy - 34, 2.5, 2.5);
        ctx.fillRect(dx + 1.5, dy - 34, 2.5, 2.5);
        /* Mouth speaker grill */
        ctx.fillStyle = '#222';
        ctx.fillRect(dx - 3, dy - 30, 6, 1.5);
        /* Chest light */
        ctx.fillStyle = '#ffd24a';
        ctx.beginPath();
        ctx.arc(dx, dy - 18, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === 'mouseHole') {
        /* Little mound + dark hole entrance — visual hint near a moon mouse */
        ctx.fillStyle = '#7a5418';
        ctx.beginPath();
        ctx.ellipse(dx, dy + 4, 18, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a0a08';
        ctx.beginPath();
        ctx.ellipse(dx, dy + 1, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        /* Cheese crumbs around */
        ctx.fillStyle = '#ffcc44';
        ctx.beginPath(); ctx.arc(dx - 9, dy + 6, 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(dx + 11, dy + 5, 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(dx + 5, dy + 8, 0.6, 0, Math.PI * 2); ctx.fill();
      } else if (d.type === 'cheeseCrater') {
        /* Cheese-hole crater — yellow pocked moon surface */
        ctx.fillStyle = '#b98a28';
        ctx.beginPath();
        ctx.arc(dx, dy, d.r || 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8a6220';
        ctx.beginPath();
        ctx.arc(dx - 2, dy - 2, (d.r || 14) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === 'cheeseWedge') {
        /* Big triangular cheese wedge sticking up from the surface, with
           characteristic round holes. */
        var wR = d.size || 1;
        ctx.save();
        ctx.translate(dx, dy);
        ctx.scale(wR, wR);
        var wG = ctx.createLinearGradient(0, -36, 0, 0);
        wG.addColorStop(0, '#ffd64a');
        wG.addColorStop(1, '#c8862a');
        ctx.fillStyle = wG;
        ctx.beginPath();
        ctx.moveTo(-30, 0);
        ctx.lineTo(30, 0);
        ctx.lineTo(20, -34);
        ctx.lineTo(-20, -34);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#7a4818';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        /* Front-face highlight */
        ctx.fillStyle = '#ffe98a';
        ctx.beginPath();
        ctx.moveTo(-26, -2);
        ctx.lineTo(26, -2);
        ctx.lineTo(18, -32);
        ctx.lineTo(-18, -32);
        ctx.closePath();
        ctx.fill();
        /* Holes */
        ctx.fillStyle = '#a86820';
        var holes = [[-12, -10, 3], [6, -16, 4], [-4, -22, 2.4], [10, -8, 2], [-8, -28, 1.8]];
        for (var hwI = 0; hwI < holes.length; hwI++) {
          ctx.beginPath();
          ctx.arc(holes[hwI][0], holes[hwI][1], holes[hwI][2], 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#5a2a10';
        for (var hwJ = 0; hwJ < holes.length; hwJ++) {
          ctx.beginPath();
          ctx.arc(holes[hwJ][0] - 0.6, holes[hwJ][1] - 0.6, holes[hwJ][2] * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (d.type === 'cheeseChunk') {
        /* Small cube of cheese on the ground */
        ctx.fillStyle = '#ffd64a';
        ctx.fillRect(dx - 9, dy - 12, 18, 12);
        ctx.fillStyle = '#ffe98a';
        ctx.fillRect(dx - 9, dy - 12, 18, 2);
        ctx.fillStyle = '#a86820';
        ctx.fillRect(dx - 9, dy - 1, 18, 1);
        /* Holes */
        ctx.fillStyle = '#a86820';
        ctx.beginPath(); ctx.arc(dx - 4, dy - 7, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(dx + 3, dy - 4, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(dx + 5, dy - 9, 1, 0, Math.PI * 2); ctx.fill();
      } else if (d.type === 'cheeseDrip') {
        /* Patch of melted cheese with droplets dripping off the ledge */
        ctx.fillStyle = '#ffaa22';
        ctx.beginPath();
        ctx.moveTo(dx - 18, dy);
        ctx.bezierCurveTo(dx - 18, dy + 14, dx - 6, dy + 16, dx, dy + 14);
        ctx.bezierCurveTo(dx + 6, dy + 18, dx + 16, dy + 12, dx + 18, dy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffd24a';
        ctx.beginPath();
        ctx.moveTo(dx - 14, dy + 1);
        ctx.bezierCurveTo(dx - 14, dy + 9, dx - 4, dy + 11, dx, dy + 10);
        ctx.bezierCurveTo(dx + 4, dy + 12, dx + 12, dy + 8, dx + 14, dy + 1);
        ctx.closePath();
        ctx.fill();
        /* Drips dangling */
        ctx.fillStyle = '#ffaa22';
        ctx.beginPath(); ctx.arc(dx - 10, dy + 18, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(dx + 8, dy + 16, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(dx, dy + 22, 2, 0, Math.PI * 2); ctx.fill();
      } else if (d.type === 'cheeseTree') {
        /* Stylised cheese-fondue palm tree — yellow trunk with wedge fronds */
        ctx.fillStyle = '#a86820';
        ctx.fillRect(dx - 3, dy - 36, 6, 36);
        ctx.fillStyle = '#7a4818';
        ctx.fillRect(dx - 3, dy - 36, 1.4, 36);
        /* Cheese frond crown */
        var crown = [[-14, -36, -24, -42], [14, -36, 24, -42], [-8, -42, -14, -52], [8, -42, 14, -52], [0, -44, 0, -56]];
        ctx.fillStyle = '#ffd64a';
        ctx.strokeStyle = '#a86820';
        ctx.lineWidth = 1;
        for (var ct = 0; ct < crown.length; ct++) {
          var p = crown[ct];
          ctx.beginPath();
          ctx.moveTo(dx + p[0] - 3, dy + p[1]);
          ctx.lineTo(dx + p[2], dy + p[3]);
          ctx.lineTo(dx + p[0] + 3, dy + p[1]);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        /* Cheese-coconuts */
        ctx.fillStyle = '#ffaa22';
        ctx.beginPath(); ctx.arc(dx - 5, dy - 38, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(dx + 5, dy - 38, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a86820';
        ctx.beginPath(); ctx.arc(dx - 5, dy - 38, 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(dx + 5, dy - 38, 0.7, 0, Math.PI * 2); ctx.fill();
      } else if (d.type === 'cheeseSign') {
        /* Wooden sign with a cheese-wedge logo */
        ctx.fillStyle = '#3a2010';
        ctx.fillRect(dx - 1.6, dy - 32, 3.2, 32);
        ctx.fillStyle = '#a86820';
        ctx.fillRect(dx - 24, dy - 56, 48, 24);
        ctx.fillStyle = '#7a4818';
        ctx.fillRect(dx - 24, dy - 56, 48, 1.5);
        ctx.fillRect(dx - 24, dy - 33.5, 48, 1.5);
        /* Cheese wedge logo */
        ctx.fillStyle = '#ffd64a';
        ctx.beginPath();
        ctx.moveTo(dx - 18, dy - 38);
        ctx.lineTo(dx - 8, dy - 50);
        ctx.lineTo(dx - 4, dy - 38);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#a86820';
        ctx.beginPath(); ctx.arc(dx - 12, dy - 42, 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(dx - 8, dy - 45, 0.7, 0, Math.PI * 2); ctx.fill();
        /* Sign text */
        ctx.fillStyle = '#ffe9c8';
        ctx.font = 'bold 9px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(d.text || 'CHEESE', dx + 6, dy - 41);
      } else if (d.type === 'cheeseMoonBg') {
        /* Big cheese moon in the parallax sky */
        ctx.save();
        var cmX = dx - camera.x * 0.15;
        ctx.fillStyle = '#ffd64a';
        ctx.beginPath();
        ctx.arc(cmX, dy, d.r || 90, 0, Math.PI * 2);
        ctx.fill();
        /* Crescent shadow */
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#7a4818';
        ctx.beginPath();
        ctx.arc(cmX + (d.r || 90) * 0.25, dy, (d.r || 90) * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        /* Holes */
        ctx.fillStyle = '#a86820';
        var moonHoles = [[-30, -20, 8], [10, 30, 6], [-20, 18, 5], [25, -10, 7], [0, -38, 4]];
        for (var mh = 0; mh < moonHoles.length; mh++) {
          ctx.beginPath();
          ctx.arc(cmX + moonHoles[mh][0], dy + moonHoles[mh][1], moonHoles[mh][2], 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      /* ---- Hotel zoo decorations ---- */
      else if (d.type === 'chandelier') {
        /* Three-tier crystal chandelier — much more ornate. */
        ctx.save();
        /* Chain */
        ctx.strokeStyle = '#caa040';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dx, CEIL_Y);
        ctx.lineTo(dx, dy);
        ctx.stroke();
        /* Ceiling rose */
        ctx.fillStyle = '#caa040';
        ctx.beginPath();
        ctx.ellipse(dx, CEIL_Y, 12, 4, 0, 0, Math.PI);
        ctx.fill();
        /* Top brass cap */
        ctx.fillStyle = '#fcd870';
        ctx.beginPath();
        ctx.ellipse(dx, dy, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        /* Three brass rings, each smaller below the previous */
        var ringDefs = [
          { w: 36, y: 8 },
          { w: 28, y: 22 },
          { w: 18, y: 34 },
        ];
        for (var rg = 0; rg < ringDefs.length; rg++) {
          ctx.fillStyle = '#caa040';
          ctx.beginPath();
          ctx.ellipse(dx, dy + ringDefs[rg].y, ringDefs[rg].w, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fcd870';
          ctx.beginPath();
          ctx.ellipse(dx, dy + ringDefs[rg].y - 1, ringDefs[rg].w - 2, 1.4, 0, 0, Math.PI * 2);
          ctx.fill();
          /* Crystal teardrops on each ring */
          var crystalCount = rg === 0 ? 9 : (rg === 1 ? 7 : 5);
          for (var ci = 0; ci < crystalCount; ci++) {
            var t = ci / (crystalCount - 1);
            var cx = dx - ringDefs[rg].w + t * ringDefs[rg].w * 2;
            var cy = dy + ringDefs[rg].y + 4;
            var twinkle = (Math.sin(Date.now() * 0.004 + ci + rg * 1.7) > 0) ? '#ffffff' : '#fff8c0';
            ctx.fillStyle = twinkle;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx - 2, cy + 4);
            ctx.lineTo(cx, cy + 8);
            ctx.lineTo(cx + 2, cy + 4);
            ctx.closePath();
            ctx.fill();
          }
        }
        /* Center bulb */
        ctx.fillStyle = '#fff8c0';
        ctx.beginPath();
        ctx.arc(dx, dy + 26, 5, 0, Math.PI * 2);
        ctx.fill();
        /* Glow halo */
        ctx.globalAlpha = 0.4;
        var grad = ctx.createRadialGradient(dx, dy + 22, 6, dx, dy + 22, 70);
        grad.addColorStop(0, 'rgba(255,240,176,0.8)');
        grad.addColorStop(1, 'rgba(255,240,176,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(dx, dy + 22, 70, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (d.type === 'receptionDesk') {
        /* Tall front desk */
        ctx.fillStyle = '#5a3a18';
        ctx.fillRect(dx - 60, dy - 50, 120, 50);
        /* Top counter */
        ctx.fillStyle = '#caa040';
        ctx.fillRect(dx - 64, dy - 54, 128, 6);
        /* Front trim */
        ctx.fillStyle = '#3a2418';
        ctx.fillRect(dx - 60, dy - 8, 120, 4);
        /* Bell */
        ctx.fillStyle = '#ffd24a';
        ctx.beginPath();
        ctx.arc(dx - 30, dy - 56, 5, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#caa040';
        ctx.fillRect(dx - 31, dy - 51, 2, 1);
        /* Logbook */
        ctx.fillStyle = '#fff8e0';
        ctx.fillRect(dx + 14, dy - 56, 24, 4);
        /* "RECEPTION" label */
        ctx.fillStyle = '#ffd24a';
        ctx.font = 'bold 9px "M PLUS Rounded 1c", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(Game.i18n.t('signReception'), dx, dy - 24);
        ctx.textAlign = 'left';
      } else if (d.type === 'lobbyPlant') {
        /* Rustle: leaves sway harder when Momoko walks past so the
           corridor reads as alive rather than as a series of static props. */
        var lpPlayerCx = player ? (player.x + player.w / 2) : -99999;
        var lpDist = Math.abs(lpPlayerCx - d.x);
        var lpRustle = lpDist < 90 ? (1 - lpDist / 90) : 0;
        var lpPhase = Date.now() * 0.012;
        /* Pot */
        ctx.fillStyle = '#a05028';
        ctx.fillRect(dx - 10, dy - 14, 20, 14);
        ctx.fillStyle = '#7a3818';
        ctx.fillRect(dx - 10, dy - 16, 20, 2);
        /* Leaves */
        ctx.fillStyle = '#3a7838';
        for (var lp = 0; lp < 6; lp++) {
          var baseAng = -Math.PI / 2 + (lp - 3) * 0.4;
          var ang = baseAng + Math.sin(lpPhase + lp * 0.7) * lpRustle * 0.32;
          var lx = dx + Math.cos(ang) * 16;
          var ly = dy - 18 + Math.sin(ang) * 16;
          ctx.beginPath();
          ctx.ellipse(lx, ly, 6, 12, ang, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#5a9848';
        ctx.beginPath();
        ctx.ellipse(dx + Math.sin(lpPhase) * lpRustle * 1.6, dy - 24, 6, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (d.type === 'lobbySofa') {
        ctx.fillStyle = '#7a3050';
        ctx.fillRect(dx - 50, dy - 20, 100, 20);
        ctx.fillRect(dx - 50, dy - 32, 100, 14);
        ctx.fillStyle = '#aa4a78';
        ctx.fillRect(dx - 50, dy - 32, 100, 4);
        /* Cushions */
        ctx.fillStyle = '#aa4a78';
        ctx.fillRect(dx - 46, dy - 28, 30, 8);
        ctx.fillRect(dx - 14, dy - 28, 30, 8);
        ctx.fillRect(dx + 18, dy - 28, 30, 8);
      } else if (d.type === 'lobbyRug') {
        ctx.fillStyle = '#7a2840';
        ctx.fillRect(dx - 80, dy - 4, 160, 4);
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(dx - 78, dy - 4, 156, 1);
      } else if (d.type === 'wallPainting') {
        /* Small framed painting — same painted scenes as the windows */
        var wpTh = wingTheme();
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = wpTh.trimLo;
        ctx.fillRect(dx - 32, dy - 30, 64, 50);
        ctx.restore();
        ctx.fillStyle = wpTh.trim;
        ctx.fillRect(dx - 30, dy - 28, 60, 46);
        ctx.fillStyle = wpTh.trimHi;
        ctx.fillRect(dx - 30, dy - 28, 60, 1.5);
        ctx.save();
        ctx.beginPath();
        ctx.rect(dx - 25, dy - 23, 50, 36);
        ctx.clip();
        drawView(ctx, d.art === 'savanna' || d.art === 'forest' || d.art === 'sea' ? d.art : 'rainbow',
                 dx - 25, dy - 23, 50, 36, 0, d.x);
        ctx.restore();
      } else if (d.type === 'roomDoorFrame') {
        /* Recessed casing behind the door NPC so it sits in the wall */
        drawDoorCasing(ctx, dx, dy, 48, level.floorY - camera.y, d.color, true);
      } else if (d.type === 'commonArea') {
        /* A small floor lounge / themed garden landmark that breaks up
           the long hallways. d.theme picks the visual treatment:
           'safari' → palm + savanna pad,
           'forest' → mossy log + ferns,
           'magic'  → starry pedestal + sparkles. */
        var caTheme = d.theme || 'safari';
        var caW = d.w || 200;
        /* Floor pad / rug */
        var padCol = caTheme === 'safari' ? '#a07028'
                   : caTheme === 'forest' ? '#3a5a28'
                   :                        '#5a3aa0';
        ctx.fillStyle = padCol;
        ctx.fillRect(dx - caW / 2, dy - 4, caW, 4);
        /* Rug border */
        ctx.fillStyle = caTheme === 'safari' ? '#c89a4a'
                      : caTheme === 'forest' ? '#5a8a38'
                      :                        '#88aaff';
        ctx.fillRect(dx - caW / 2, dy - 5, caW, 1.4);

        if (caTheme === 'safari') {
          /* Palm tree on the left */
          ctx.fillStyle = '#7a4818';
          ctx.fillRect(dx - 60, dy - 90, 8, 86);
          ctx.fillStyle = '#3a7838';
          for (var sf = 0; sf < 5; sf++) {
            var sang = -Math.PI / 2 + (sf - 2) * 0.45;
            ctx.beginPath();
            ctx.ellipse(dx - 56 + Math.cos(sang) * 22,
                        dy - 90 + Math.sin(sang) * 14,
                        24, 8, sang, 0, Math.PI * 2);
            ctx.fill();
          }
          /* Coconuts */
          ctx.fillStyle = '#5a3018';
          ctx.beginPath(); ctx.arc(dx - 56, dy - 86, 3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(dx - 50, dy - 84, 3, 0, Math.PI * 2); ctx.fill();
          /* Lounge chair on the right */
          ctx.fillStyle = '#caa040';
          ctx.fillRect(dx + 20, dy - 22, 50, 4);
          ctx.fillRect(dx + 20, dy - 22, 4, 22);
          ctx.fillRect(dx + 66, dy - 22, 4, 22);
          ctx.fillStyle = '#ff99cc';
          ctx.fillRect(dx + 24, dy - 18, 42, 4);
        } else if (caTheme === 'forest') {
          /* Mossy fallen log */
          ctx.fillStyle = '#5a3a18';
          ctx.fillRect(dx - 60, dy - 16, 100, 14);
          ctx.fillStyle = '#3a8030';
          ctx.fillRect(dx - 60, dy - 18, 100, 4);
          /* Log rings */
          ctx.fillStyle = '#3a2010';
          ctx.beginPath(); ctx.arc(dx - 60, dy - 9, 7, -Math.PI / 2, Math.PI / 2); ctx.fill();
          ctx.fillStyle = '#5a3a18';
          ctx.beginPath(); ctx.arc(dx - 60, dy - 9, 4, -Math.PI / 2, Math.PI / 2); ctx.fill();
          /* Ferns */
          ctx.strokeStyle = '#5a8a38'; ctx.lineWidth = 1.4;
          for (var fn = 0; fn < 5; fn++) {
            var fnx = dx + 50 + fn * 8;
            ctx.beginPath();
            ctx.moveTo(fnx, dy);
            ctx.quadraticCurveTo(fnx + 4, dy - 14, fnx + 2, dy - 28);
            ctx.stroke();
          }
          /* Mushrooms */
          ctx.fillStyle = '#cc4444';
          ctx.beginPath(); ctx.arc(dx - 30, dy - 4, 5, Math.PI, 2 * Math.PI); ctx.fill();
          ctx.fillStyle = '#fff8e0';
          ctx.beginPath(); ctx.arc(dx - 32, dy - 5, 1.2, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(dx - 28, dy - 6, 1.2, 0, Math.PI * 2); ctx.fill();
        } else if (caTheme === 'magic') {
          /* Crystal pedestal */
          ctx.fillStyle = '#5a3aa0';
          ctx.beginPath();
          ctx.moveTo(dx - 18, dy - 4);
          ctx.lineTo(dx + 18, dy - 4);
          ctx.lineTo(dx + 14, dy - 38);
          ctx.lineTo(dx - 14, dy - 38);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#88aaff';
          ctx.beginPath();
          ctx.moveTo(dx, dy - 80);
          ctx.lineTo(dx - 10, dy - 50);
          ctx.lineTo(dx, dy - 38);
          ctx.lineTo(dx + 10, dy - 50);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ffd24a';
          ctx.beginPath(); ctx.arc(dx, dy - 60, 4, 0, Math.PI * 2); ctx.fill();
          /* Sparkle dust */
          for (var sk = 0; sk < 8; sk++) {
            var sx = dx + Math.cos(Date.now() * 0.001 + sk) * (40 + sk * 3);
            var sy = dy - 50 + Math.sin(Date.now() * 0.0013 + sk) * 14;
            ctx.fillStyle = sk % 2 === 0 ? '#ffd24a' : '#ff99ee';
            ctx.beginPath(); ctx.arc(sx, sy, 1.4, 0, Math.PI * 2); ctx.fill();
          }
        }

        /* Banner / nameplate above */
        var caLabel = d.label || '';
        if (caLabel) {
          ctx.font = 'bold 12px "M PLUS Rounded 1c", sans-serif';
          var ctw = ctx.measureText(caLabel).width;
          var bw = ctw + 20, bh = 18;
          ctx.fillStyle = '#fff8e0';
          ctx.fillRect(dx - bw / 2, dy - 110, bw, bh);
          ctx.strokeStyle = '#caa040';
          ctx.lineWidth = 1.4;
          ctx.strokeRect(dx - bw / 2, dy - 110, bw, bh);
          ctx.fillStyle = '#5a3018';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(caLabel, dx, dy - 110 + bh / 2 + 0.5);
          ctx.textBaseline = 'alphabetic';
          ctx.textAlign = 'left';
        }
      } else if (d.type === 'elevatorShaft') {
        /* Brass-framed recess around the elevator doors, with the
           floor-indicator dial above it */
        drawDoorCasing(ctx, dx + 2, dy - 54, 60, dy, null);
        var esTh = wingTheme();
        ctx.fillStyle = esTh.trimLo;
        ctx.beginPath();
        ctx.arc(dx + 32, dy - 70, 22, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#2a1a10';
        ctx.beginPath();
        ctx.arc(dx + 32, dy - 70, 18, Math.PI, 0);
        ctx.fill();
        for (var fl = 0; fl < 4; fl++) {
          var lit = fl === ((Game.engine && Game.engine.getCurrentZone && Game.engine.getCurrentZone()) || 0);
          var fa = Math.PI + (fl + 0.5) * Math.PI / 4;
          ctx.fillStyle = lit ? '#ffd24a' : '#6a4a22';
          ctx.beginPath();
          ctx.arc(dx + 32 + Math.cos(fa) * 13, dy - 70 + Math.sin(fa) * 13, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (d.type === 'stairwellDoor') {
        /* Casing around the stairs doorway (the Stairs NPC sits 10px in) */
        drawDoorCasing(ctx, dx + 10, dy - 56, 50, dy, null);
      } else if (d.type === 'fancyColumn') {
        /* Tall marble column with capital + base */
        var colTop = WALL_Y;
        var colW = 26;
        ctx.fillStyle = 'rgba(40,20,0,0.18)';
        ctx.fillRect(dx - colW / 2 + 6, colTop, colW + 4, dy - colTop);
        /* Shaft */
        var colGrad = ctx.createLinearGradient(dx - colW / 2, 0, dx + colW / 2, 0);
        colGrad.addColorStop(0, '#cfc0a4');
        colGrad.addColorStop(0.5, '#fbf3e6');
        colGrad.addColorStop(1, '#cfc0a4');
        ctx.fillStyle = colGrad;
        ctx.fillRect(dx - colW / 2, colTop, colW, dy - colTop);
        /* Fluting */
        ctx.strokeStyle = '#b8a878';
        ctx.lineWidth = 0.5;
        for (var fl2 = -2; fl2 <= 2; fl2++) {
          ctx.beginPath();
          ctx.moveTo(dx + fl2 * 5, colTop + 10);
          ctx.lineTo(dx + fl2 * 5, dy - 14);
          ctx.stroke();
        }
        /* Capital */
        ctx.fillStyle = '#caa040';
        ctx.fillRect(dx - 18, colTop, 36, 8);
        ctx.fillRect(dx - 14, colTop + 8, 28, 4);
        /* Base */
        ctx.fillStyle = '#caa040';
        ctx.fillRect(dx - 18, dy - 14, 36, 8);
        ctx.fillRect(dx - 14, dy - 18, 28, 4);
      } else if (d.type === 'velvetRope') {
        /* Brass stanchion with red velvet rope */
        ctx.fillStyle = '#caa040';
        ctx.fillRect(dx - 2, dy - 38, 4, 38);
        ctx.beginPath(); ctx.arc(dx, dy - 40, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fcd870';
        ctx.beginPath(); ctx.arc(dx - 1, dy - 41, 1.4, 0, Math.PI * 2); ctx.fill();
        /* Rope drooping rightward (one segment between stanchions) */
        ctx.strokeStyle = '#7a1c2a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(dx, dy - 40);
        ctx.quadraticCurveTo(dx + 35, dy - 28, dx + 70, dy - 40);
        ctx.stroke();
      } else if (d.type === 'luggageStand') {
        /* Brass luggage cart with stacked suitcases */
        ctx.fillStyle = '#caa040';
        ctx.fillRect(dx - 30, dy - 4, 60, 4);
        /* Wheels */
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath(); ctx.arc(dx - 24, dy, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(dx + 24, dy, 3, 0, Math.PI * 2); ctx.fill();
        /* Vertical brass rails */
        ctx.fillStyle = '#caa040';
        ctx.fillRect(dx - 30, dy - 50, 3, 46);
        ctx.fillRect(dx + 27, dy - 50, 3, 46);
        ctx.fillRect(dx - 30, dy - 52, 60, 3);
        /* Suitcases */
        ctx.fillStyle = '#5a3a18';
        ctx.fillRect(dx - 26, dy - 18, 28, 14);
        ctx.fillStyle = '#8a5a30';
        ctx.fillRect(dx - 24, dy - 16, 24, 4);
        ctx.fillStyle = '#7a3050';
        ctx.fillRect(dx - 8, dy - 32, 24, 12);
        ctx.fillStyle = '#aa4a78';
        ctx.fillRect(dx - 6, dy - 30, 20, 3);
      } else if (d.type === 'goldFrame') {
        /* Gilded picture frame with painted scene */
        var fw = 70, fh = 56;
        ctx.fillStyle = '#caa040';
        ctx.fillRect(dx - fw / 2, dy - fh / 2, fw, fh);
        ctx.fillStyle = '#fcd870';
        ctx.fillRect(dx - fw / 2 + 2, dy - fh / 2 + 2, fw - 4, 2);
        /* Inner art */
        ctx.fillStyle = '#fff8e0';
        ctx.fillRect(dx - fw / 2 + 4, dy - fh / 2 + 4, fw - 8, fh - 8);
        ctx.save();
        ctx.beginPath();
        ctx.rect(dx - fw / 2 + 5, dy - fh / 2 + 5, fw - 10, fh - 10);
        ctx.clip();
        drawView(ctx, d.art === 'cityscape' ? 'city' : (d.art === 'jungle' ? 'savanna' : d.art),
                 dx - fw / 2 + 5, dy - fh / 2 + 5, fw - 10, fh - 10, 0, d.x);
        ctx.restore();
      } else if (d.type === 'marqueeSign') {
        /* Big gilded marquee sign with bulb lights */
        var mw = 220, mh = 36;
        ctx.fillStyle = '#5a1820';
        ctx.fillRect(dx - mw / 2, dy - mh / 2, mw, mh);
        ctx.strokeStyle = '#caa040';
        ctx.lineWidth = 3;
        ctx.strokeRect(dx - mw / 2, dy - mh / 2, mw, mh);
        /* Bulb dots around the border */
        var bulbs = 24;
        for (var bi = 0; bi < bulbs; bi++) {
          var t = bi / bulbs;
          var bx, by;
          if (t < 0.25) { bx = dx - mw / 2 + t * 4 * mw; by = dy - mh / 2; }
          else if (t < 0.5) { bx = dx + mw / 2; by = dy - mh / 2 + (t - 0.25) * 4 * mh; }
          else if (t < 0.75) { bx = dx + mw / 2 - (t - 0.5) * 4 * mw; by = dy + mh / 2; }
          else { bx = dx - mw / 2; by = dy + mh / 2 - (t - 0.75) * 4 * mh; }
          var lit = (Math.floor(Date.now() * 0.005) + bi) % 3 === 0;
          ctx.fillStyle = lit ? '#fff8c0' : '#caa040';
          ctx.beginPath(); ctx.arc(bx, by, 2.4, 0, Math.PI * 2); ctx.fill();
        }
        /* Text, shrunk to fit inside the bulb border */
        var mqText = d.textKey ? Game.i18n.t(d.textKey) : (d.text || 'HOTEL');
        var mqSize = 18;
        do {
          ctx.font = 'bold ' + mqSize + 'px "M PLUS Rounded 1c", sans-serif';
        } while (ctx.measureText(mqText).width > mw - 24 && --mqSize > 10);
        ctx.fillStyle = d.color || '#ffd24a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(mqText, dx, dy);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
      } else if (d.type === 'wayfindSign') {
        /* Free-standing brass post with two arrows pointing toward the
           bedroom (left) and the elevator (right). Drops a clear
           orientation cue at the lobby midpoint so kids can re-find
           the bedroom without exhaustively walking the whole lobby. */
        var psW = 12, psH = 110;
        var psX = dx - psW / 2, psY = d.y - psH;
        /* Post */
        ctx.fillStyle = '#3a2010';
        ctx.fillRect(psX, psY, psW, psH);
        ctx.fillStyle = '#caa040';
        ctx.fillRect(psX + 2, psY, psW - 4, psH);
        /* Top finial */
        ctx.fillStyle = '#fcd870';
        ctx.beginPath();
        ctx.arc(dx, psY - 3, 5, 0, Math.PI * 2);
        ctx.fill();
        /* Helper to draw a labeled arrow plate */
        function drawPlate(side, label, icon, plateY) {
          var pw = 84, ph = 22;
          var px = side > 0 ? dx + 6 : dx - 6 - pw;
          var py = plateY;
          ctx.fillStyle = '#fff8e0';
          ctx.fillRect(px, py, pw, ph);
          ctx.strokeStyle = '#7a3a18';
          ctx.lineWidth = 1.4;
          ctx.strokeRect(px, py, pw, ph);
          /* Arrow tip extending into the post */
          ctx.fillStyle = '#fff8e0';
          ctx.beginPath();
          if (side > 0) {
            ctx.moveTo(px, py);
            ctx.lineTo(px - 8, py + ph / 2);
            ctx.lineTo(px, py + ph);
          } else {
            ctx.moveTo(px + pw, py);
            ctx.lineTo(px + pw + 8, py + ph / 2);
            ctx.lineTo(px + pw, py + ph);
          }
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#7a3a18';
          ctx.beginPath();
          if (side > 0) {
            ctx.moveTo(px, py); ctx.lineTo(px - 8, py + ph / 2); ctx.lineTo(px, py + ph);
          } else {
            ctx.moveTo(px + pw, py); ctx.lineTo(px + pw + 8, py + ph / 2); ctx.lineTo(px + pw, py + ph);
          }
          ctx.stroke();
          /* Text */
          ctx.fillStyle = '#3a2418';
          ctx.font = 'bold 9px "M PLUS Rounded 1c", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((side > 0 ? '' : '← ') + label + (side > 0 ? ' →' : ''),
                       px + pw / 2, py + ph / 2);
          ctx.font = '12px sans-serif';
          ctx.textBaseline = 'alphabetic';
          ctx.textAlign = 'left';
        }
        drawPlate(-1, Game.i18n.t('wayfindBedroom') || 'BED', '', psY + 10);
        drawPlate(+1, Game.i18n.t('wayfindElevator') || 'ELEV', '', psY + 50);
      } else if (d.type === 'peeker') {
        /* An animal peeking around a column, watching the player.
           A small bob plus a slow wobble makes it feel alive — and
           when Momoko walks directly underneath, the head ducks back
           behind the column with a brief "!" surprise so the corridor
           rewards traversal. */
        var palettes = (Game.entities && Game.entities.ANIMAL_PALETTES) || {};
        var pp = palettes[d.species] || { body: '#888', shade: '#444', accent: '#fff' };
        var side = d.side || 1;
        var pkPlayerCx = player ? (player.x + player.w / 2) : -99999;
        var pkDist = Math.abs(pkPlayerCx - d.x);
        /* Duck factor 0..1 — closer = more ducked. Clamps the head down
           toward the column so only the eyes/ears stay visible. */
        var pkDuck = pkDist < 180 ? (1 - pkDist / 180) : 0;
        var bob = Math.sin(Date.now() * 0.003 + d.x * 0.01) * 2;
        var slide = Math.sin(Date.now() * 0.0015 + d.x * 0.02) * 4 * (1 - pkDuck);
        var px = dx + slide;
        var py = dy + bob + pkDuck * 14;
        ctx.save();
        /* Wall pilaster to peek from behind (the lobby peekers hide
           behind its marble columns instead) */
        if (level.wing !== 'lobby') {
          var pkTh = wingTheme();
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(dx - 6, WALL_Y, 18, RAIL_Y - WALL_Y);
          ctx.fillStyle = pkTh.trim;
          ctx.fillRect(dx - 8, WALL_Y, 16, RAIL_Y - WALL_Y);
          ctx.fillStyle = pkTh.trimHi;
          ctx.fillRect(dx - 6, WALL_Y, 2, RAIL_Y - WALL_Y);
          ctx.fillStyle = pkTh.trimLo;
          ctx.fillRect(dx - 11, WALL_Y, 22, 6);
          ctx.fillRect(dx - 11, RAIL_Y - 6, 22, 6);
        }
        /* Top of head */
        ctx.fillStyle = pp.body;
        ctx.beginPath();
        ctx.arc(px + side * 6, py, 10, 0, Math.PI * 2);
        ctx.fill();
        /* Two eyes peeking */
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath(); ctx.arc(px + side * 4, py - 1, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + side * 9, py - 1, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(px + side * 3.6, py - 1.4, 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + side * 8.6, py - 1.4, 0.6, 0, Math.PI * 2); ctx.fill();
        /* Species-specific top accent (ears / hat) */
        if (d.species === 'cat' || d.species === 'fox') {
          ctx.fillStyle = pp.body;
          ctx.beginPath();
          ctx.moveTo(px + side * 3, py - 8); ctx.lineTo(px + side * 5, py - 14); ctx.lineTo(px + side * 7, py - 8); ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(px + side * 8, py - 8); ctx.lineTo(px + side * 10, py - 14); ctx.lineTo(px + side * 12, py - 8); ctx.closePath(); ctx.fill();
        } else if (d.species === 'monkey') {
          ctx.fillStyle = pp.body;
          ctx.beginPath(); ctx.arc(px + side * 1.5, py - 5, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(px + side * 13, py - 5, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        /* "!" surprise just as Momoko enters proximity (the brief moment
           between idle and full duck) so a kid sees the peeker react. */
        if (pkDuck > 0.05 && pkDuck < 0.4) {
          ctx.save();
          ctx.fillStyle = '#ffd24a';
          ctx.font = 'bold 18px "M PLUS Rounded 1c", sans-serif';
          ctx.textAlign = 'center';
          var pulse = Math.sin(Date.now() * 0.02) * 1.5;
          ctx.fillText('!', dx, dy - 36 + pulse);
          ctx.restore();
        }
        ctx.restore();
      }
    }
  }

  /* ---- Click handling ---- */
  function onClick(e) {
    var pos = Game.input.getClickPos(e);
    var mx = pos.x, my = pos.y;

    switch (state) {
      case State.TITLE:
        /* First click on the title bootstraps Web Audio (browsers block
           autoplay) so the menu music can start. */
        Game.audio.init();
        Game.audio.resume();
        if (Game.audio.currentMusic() !== 'title') Game.audio.startMusic('title');
        var action = Game.ui.handleTitleClick(mx, my);
        if (action === 'play') state = State.CUSTOMIZE;
        break;

      case State.CUSTOMIZE:
        var cAction = Game.ui.handleCustomizeClick(mx, my);
        if (cAction === 'start') state = State.INTRO;
        break;

      case State.INTRO:
        var iAction = Game.ui.handleIntroClick(mx, my);
        if (iAction === 'start') startGame();
        break;

      case State.PAUSED:
        var pAction = Game.ui.handlePauseClick(mx, my);
        if (pAction === 'resume') state = prevState || State.PLAYING;
        else if (pAction === 'leaveRoom') {
          /* Pause was opened from inside an animal room; "Leave Room"
             dumps the player back to the corridor instead of the cab. */
          prevState = null;
          exitAnimalRoom();
        }
        else if (pAction === 'ledger') {
          /* Open the passport from inside the pause menu — return to the
             paused gameplay when the player closes it. */
          ledgerPrevState = prevState || State.PLAYING;
          state = State.LEDGER;
        }
        else if (pAction === 'quit') { Game.audio.startMusic('title'); state = State.TITLE; }
        break;

      case State.LEDGER:
        if (Game.ui.handleLedgerClick) {
          var lAction = Game.ui.handleLedgerClick(mx, my);
          if (lAction === 'close') closeLedger();
        } else {
          closeLedger();
        }
        break;

      case State.BOOKSHELF_CUTSCENE:
        /* Tap to advance after lead-in; same flow as keyboard. */
        if (bookshelfTimer > 60) {
          var totalPagesC = (Game.ui && Game.ui.getBookshelfPageCount)
            ? Game.ui.getBookshelfPageCount() : 6;
          if (bookshelfPage < totalPagesC - 1) {
            bookshelfPage++;
          } else {
            exitBookshelfCutscene();
          }
        }
        break;

      case State.GAME_OVER:
        var gAction = Game.ui.handleGameOverClick(mx, my);
        if (gAction === 'retry') startGame();
        break;

      case State.TRAVEL_MENU:
        if (Game.ui.handleTravelMenuClick) {
          var tvResult = Game.ui.handleTravelMenuClick(mx, my);
          if (tvResult === 'cancel') {
            state = State.PLAYING;
          } else if (tvResult && typeof tvResult.zone === 'number') {
            rocketTarget = tvResult.zone;
            rocketAnimTimer = 0;
            state = State.ROCKET_ANIM;
            Game.audio.play('victory');
          }
        }
        break;

      case State.HOUSE_INTERIOR:
        if (Game.ui.handleHouseInteriorClick) {
          var hiResult = Game.ui.handleHouseInteriorClick(mx, my, currentHouseId);
          if (hiResult === 'exit') {
            exitHouse();
          }
        }
        break;

      case State.CAFE_INTERIOR:
        if (Game.ui.handleCafeInteriorClick) {
          var ciResult = Game.ui.handleCafeInteriorClick(mx, my);
          if (ciResult === 'exit') exitCafe();
        }
        break;

      case State.SHOP_INTERIOR:
        if (Game.ui.handleShopInteriorClick) {
          var siResult = Game.ui.handleShopInteriorClick(mx, my);
          if (siResult === 'exit') exitShop();
        }
        break;

      case State.ANIMAL_ROOM:
        if (Game.ui.handleAnimalRoomClick) {
          var arResult = Game.ui.handleAnimalRoomClick(mx, my, Game.currentRoom);
          if (arResult === 'exit') exitAnimalRoom();
          else if (arResult === 'sleep') enterSleepCutscene();
          else if (arResult === 'bookshelf') enterBookshelfCutscene();
        }
        break;

      case State.SLEEP_CUTSCENE:
        /* Tap anywhere after a brief minimum to wake up early */
        if (sleepCutsceneTimer > 60) exitSleepCutscene();
        break;

      case State.VICTORY:
        var vAction = Game.ui.handleVictoryClick(mx, my);
        if (vAction === 'restart') { Game.audio.startMusic('title'); state = State.TITLE; }
        break;

      case State.BEACH:
        var bAction = Game.ui.handleBeachClick(mx, my);
        if (bAction === 'dive') {
          state = State.PLAYING;
          player.y = level.waterSurface + 20;
          player.vy = 1;
        }
        break;
    }
  }

  /* ---- Start game ---- */
  function startGame() {
    currentZone = 0;
    loadLevel(currentZone);
    camera = { x: 0, y: 0 };
    Game.audio.init();
    Game.audio.resume();
    beachReady = true;
    Game.audio.startMusic('bgm', currentZone);
    state = State.PLAYING;
  }

  /* ---- Zone switching (elevator/stairs) ---- */
  function enterZone(zoneIndex) {
    currentZone = zoneIndex;
    loadLevel(currentZone);
    /* Spawn Momoko at the elevator that matches the side she just departed
       from — so taking the LEFT elevator on floor 2 drops her at the LEFT
       elevator on floor 3, not way across the corridor. The lobby is
       special-cased: it only has one elevator (right side), so any arrival
       lands next to it.
       We also push her one viewport-width away from the cab on the
       destination side so an immediate Up press doesn't re-trigger the
       elevator she just stepped out of. */
    if (player) {
      var wantSide = (Game.flags && Game.flags.lastTransitSide) || 'right';
      var elev = null, fallback = null;
      for (var ni = 0; ni < npcs.length; ni++) {
        if (npcs[ni].type === 'elevator') {
          if (!fallback) fallback = npcs[ni];
          if ((npcs[ni].data && npcs[ni].data.side) === wantSide) {
            elev = npcs[ni];
            break;
          }
        }
      }
      if (!elev) elev = fallback;
      if (elev) {
        var elevSide = (elev.data && elev.data.side) || 'right';
        /* Lobby: keep legacy 60px snug-to-cab spawn. Other floors: push
           the player away from the elevator into the corridor. */
        var offset = (zoneIndex === 0) ? -60 : (elevSide === 'left' ? +180 : -180);
        player.x = elev.entity.x + offset;
        player.y = elev.entity.y;
        player.vx = 0; player.vy = 0;
        /* Face into the corridor — left elevators face right, right ones face left. */
        player.facing = (elevSide === 'left') ? 1 : -1;
      }
    }
    /* Camera follows the player's new position */
    camera = { x: 0, y: 0 };
    if (player) {
      camera.x = Math.max(0, Math.min(player.x - W / 2, level.width - W));
    }
    beachReady = true;
    if (Game.audio && Game.audio.play) Game.audio.play('elevatorDing');
    /* Re-cue the BGM with this floor's flavor (transpose / tempo / wave). */
    if (Game.audio && Game.audio.startMusic) Game.audio.startMusic('bgm', currentZone);
    state = State.PLAYING;
  }

  function onRocketInteract() {
    state = State.TRAVEL_MENU;
  }

  /* ---- Hotel zoo: elevator + stairs ---- */
  function onElevatorInteract() {
    state = State.TRAVEL_MENU;
    if (Game.ui && Game.ui.resetTravelMenu) Game.ui.resetTravelMenu();
    if (Game.audio && Game.audio.play) Game.audio.play('select');
  }

  function useStairs(dir) {
    var n = Game.levels.count();
    var target = currentZone;
    if (dir === 'up') target = currentZone + 1;
    else if (dir === 'down') target = currentZone - 1;
    else target = (currentZone + 1) % n;
    if (target < 0) target = 0;
    if (target >= n) target = n - 1;
    if (target === currentZone) return;
    rocketTarget = target;
    rocketAnimTimer = 80; /* Skip most of the rocket-anim — quick fade */
    state = State.ROCKET_ANIM;
    if (Game.audio && Game.audio.play) Game.audio.play('elevatorDing');
  }

  /* ---- Hotel zoo: animal rooms ---- */
  function enterAnimalRoom(species) {
    Game.currentRoom = species;
    /* Drop any stale stamp toast from the corridor so it doesn't bleed
       through onto the animal-room habitat. */
    if (Game.flags && Game.flags.stampPulse) Game.flags.stampPulse = null;
    if (Game.ui && Game.ui.resetAnimalRoom) Game.ui.resetAnimalRoom(species);
    state = State.ANIMAL_ROOM;
  }

  function exitAnimalRoom() {
    Game.currentRoom = null;
    state = State.PLAYING;
  }

  /* ---- Hotel zoo: sleep cutscene ---- */
  function enterSleepCutscene() {
    sleepCutsceneTimer = 0;
    state = State.SLEEP_CUTSCENE;
    if (Game.audio && Game.audio.play) Game.audio.play('snore');
  }

  function exitSleepCutscene() {
    /* If the player has already greeted all 26 guests, the very next
       sleep cutscene is the *real* ending — roll directly into the
       VICTORY overlay so the storybook beat lands on a high note,
       instead of dumping the player back into the bedroom. */
    if (Game.flags && Game.flags.readyForVictory) {
      Game.flags.readyForVictory = false;
      sleepCutsceneTimer = 0;
      Game.currentRoom = null;
      if (Game.audio && Game.audio.stopMusic) Game.audio.stopMusic();
      stageVictoryInLobby();
      state = State.VICTORY;
      return;
    }
    /* Return to the bedroom interior */
    sleepCutsceneTimer = 0;
    Game.currentRoom = 'bedroom';
    if (Game.ui && Game.ui.resetAnimalRoom) Game.ui.resetAnimalRoom('bedroom');
    state = State.ANIMAL_ROOM;
  }

  /* ---- Hotel zoo side quest: guest ledger stamps ---- */
  /* Total unique species players can greet (excludes the bedroom door). */
  var TOTAL_GUESTS = 26;
  var ALL_STAMPED_FLAG = false;
  /* Mid-progress acknowledgment: at 10 stamps the chandelier monkey
     shouts a halfway-cheer. Tracked so we don't re-fire on subsequent
     stamps. */
  var MID_CHEER_FIRED = false;
  function stampGuest(species) {
    /* The bedroom door is Momoko's own room, not a guest. */
    if (!species || species === 'bedroom') return;
    if (!Game.flags.stamps) Game.flags.stamps = {};
    if (Game.flags.stamps[species]) return;
    Game.flags.stamps[species] = true;
    Game.flags.stampCount = (Game.flags.stampCount || 0) + 1;
    /* Trigger a brief celebration: HUD pulse + species toast.
       drawQuestHUD reads Game.flags.stampPulse and decrements it. */
    Game.flags.stampPulse = { species: species, t: 110 };
    if (Game.audio && Game.audio.play) Game.audio.play('select');
    savePersistent();
    /* Halfway cheer: at 10/26, queue a chandelier-monkey shout for the
       next time Momoko walks in the lobby. We surface it via a global
       toast that drawQuestHUD reads. */
    if (Game.flags.stampCount >= 10 && !MID_CHEER_FIRED) {
      MID_CHEER_FIRED = true;
      Game.flags.cheerToast = { t: 280, key: 'midCheer' };
      if (Game.audio && Game.audio.play) Game.audio.play('victory');
    }
    /* When the ledger fills, *don't* slam straight into a victory overlay.
       The bedroom door sparkles (see AnimalDoor.draw), and a "Bedtime!"
       celebration toast nudges the player toward it. The actual victory
       screen plays after the bedroom sleep cutscene — so the kid earns
       the ending by tucking Momoko in herself instead of having it
       happen TO her. */
    if (Game.flags.stampCount >= TOTAL_GUESTS && !ALL_STAMPED_FLAG) {
      ALL_STAMPED_FLAG = true;
      if (Game.audio && Game.audio.play) Game.audio.play('victory');
      Game.flags.readyForVictory = true;
      Game.flags.cheerToast = { t: 360, key: 'bedtimeCheer' };
    }
  }

  function triggerVictory() {
    /* Bring the player out of the animal-room close-up first so the
       victory overlay sits on top of the lobby/floor, not a habitat. */
    if (state === State.ANIMAL_ROOM) state = State.PLAYING;
    if (state === State.PLAYING) {
      if (Game.audio && Game.audio.stopMusic) Game.audio.stopMusic();
      stageVictoryInLobby();
      state = State.VICTORY;
    }
  }

  /* The ending party always happens in the lobby: load it if needed,
     frame its left end (bedroom door, chandelier, window) and park the
     corridor Momoko off-screen, since ui.drawVictory paints her dancing. */
  function stageVictoryInLobby() {
    if (currentZone !== 0) {
      currentZone = 0;
      loadLevel(0);
    }
    camera = { x: 0, y: 0 };
    if (player) { player.x = -200; player.vx = 0; }
  }

  /* ---- Hotel zoo: bookshelf cutscene (Little Red Riding Hood) ---- */
  function enterBookshelfCutscene() {
    bookshelfTimer = 0;
    bookshelfPage = 0;
    state = State.BOOKSHELF_CUTSCENE;
    if (Game.audio && Game.audio.play) Game.audio.play('select');
  }

  function exitBookshelfCutscene() {
    bookshelfTimer = 0;
    bookshelfPage = 0;
    /* Return to the bedroom interior so the player can keep exploring. */
    Game.currentRoom = 'bedroom';
    if (Game.ui && Game.ui.resetAnimalRoom) Game.ui.resetAnimalRoom('bedroom');
    state = State.ANIMAL_ROOM;
  }

  /* ---- Hotel zoo: guest passport (ledger) overlay ---- */
  function openLedger() {
    if (state !== State.PLAYING && state !== State.ANIMAL_ROOM) return;
    ledgerPrevState = state;
    state = State.LEDGER;
    if (Game.audio && Game.audio.play) Game.audio.play('select');
  }

  function closeLedger() {
    state = ledgerPrevState || State.PLAYING;
    ledgerPrevState = null;
    if (Game.audio && Game.audio.play) Game.audio.play('select');
  }

  /* ---- Hotel zoo: lobby intro cutscene ---- */
  function beginLobbyIntro() {
    if (Game.flags.checkedIn) return;
    if (state !== State.PLAYING) return;
    lobbyIntroTimer = 0;
    lobbyIntroPhase = 'drop';
    state = State.LOBBY_INTRO;
  }

  /* ---- House interior ---- */
  function enterHouse(id) {
    currentHouseId = id;
    state = State.HOUSE_INTERIOR;
  }

  function exitHouse() {
    currentHouseId = null;
    state = State.PLAYING;
  }

  /* ---- Cafe cutscene ---- */
  function enterCafe() {
    if (Game.ui.startCafeCutscene) Game.ui.startCafeCutscene();
    state = State.CAFE_INTERIOR;
  }

  function exitCafe() {
    state = State.PLAYING;
  }

  /* ---- Shop ---- */
  function enterShop() {
    if (Game.ui.startShopInterior) Game.ui.startShopInterior();
    state = State.SHOP_INTERIOR;
  }

  function exitShop() {
    state = State.PLAYING;
  }

  /* When the hero enters a houseDoor with a non-empty shopping cart,
     deposit each item into that house's furniture state at scattered
     positions along the floor area. Then clear the cart. */
  function depositCartIntoHouse(houseId) {
    if (!Game.shop || !Game.shop.cart || Game.shop.cart.length === 0) return;
    var raw = null;
    try { raw = localStorage.getItem(KEY('furniture')); } catch (e) {}
    var furn = {};
    try { furn = raw ? JSON.parse(raw) : {}; } catch (e) { furn = {}; }
    if (!furn[houseId]) furn[houseId] = [];
    /* Floor placement bounds — match HOUSE_FLOOR_* in ui.js. */
    var FX_LEFT = 60, FX_RIGHT = 680, FY_TOP = 220, FY_BOTTOM = 440;
    for (var ci = 0; ci < Game.shop.cart.length; ci++) {
      var ix = FX_LEFT + Math.floor(Math.random() * (FX_RIGHT - FX_LEFT));
      var iy = FY_TOP + Math.floor(Math.random() * (FY_BOTTOM - FY_TOP));
      furn[houseId].push({ type: Game.shop.cart[ci].type, x: ix, y: iy });
    }
    try { localStorage.setItem(KEY('furniture'), JSON.stringify(furn)); } catch (e) {}
    Game.shop.cart = [];
    if (Game.audio && Game.audio.play) Game.audio.play('victory');
  }

  /* ---- Persistence ---- */
  function savePersistent() {
    try {
      localStorage.setItem(KEY('customization'), JSON.stringify(Game.customization));
      if (Game.quests) {
        localStorage.setItem(KEY('quests'), JSON.stringify(Game.quests));
      }
      localStorage.setItem(KEY('flags'), JSON.stringify(Game.flags || {}));
    } catch (e) { /* storage may be disabled */ }
  }

  function loadPersistent() {
    migrateSpaceKeys();
    try {
      var cs = localStorage.getItem(KEY('customization'));
      if (cs) {
        var parsed = JSON.parse(cs);
        for (var k in parsed) { Game.customization[k] = parsed[k]; }
      }
      var qs = localStorage.getItem(KEY('quests'));
      if (qs) {
        Game.quests = JSON.parse(qs);
      }
      var hf = localStorage.getItem(KEY('flags'));
      if (hf) {
        Game.flags = JSON.parse(hf);
      }
    } catch (e) { /* corrupted storage – ignore */ }
  }

  /* ---- Game loop ---- */
  var lastTime = 0;
  var accumulator = 0;
  var FIXED_DT = 1000 / 60;

  function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    var delta = timestamp - lastTime;
    lastTime = timestamp;

    /* Cap delta to avoid spiral of death */
    if (delta > 100) delta = 100;

    accumulator += delta;
    while (accumulator >= FIXED_DT) {
      update();
      accumulator -= FIXED_DT;
    }

    render();
    requestAnimationFrame(gameLoop);
  }

  /* Compute canvas dimensions to match the current viewport's aspect ratio.
     Always centers the 800×480 game viewport. Adds horizontal strips for
     touch controls (asymmetric — wider D-pad side) and additional top /
     bottom bezel padding when the screen is taller-aspect than the base
     canvas (iPads etc.) so the canvas can scale up to fill the display
     instead of being letterboxed in dead space. */
  function computeCanvasLayout() {
    var sW = window.innerWidth || W;
    var sH = window.innerHeight || H;
    var screenAspect = sW / sH;
    var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    if (isTouch) {
      var lStrip = TOUCH_LEFT_W;
      var rStrip = TOUCH_RIGHT_W;
      var baseW = W + lStrip + rStrip;     /* 1260 */
      var baseH = H;                        /* 480 */
      var baseAspect = baseW / baseH;       /* 2.625 */

      if (screenAspect < baseAspect * 0.98) {
        /* Tall-aspect screen (iPad, tablet) — extend canvas vertically so
           it matches screen aspect. Bezel splits above/below the game. */
        CANVAS_W = baseW;
        CANVAS_H = Math.round(baseW / screenAspect);
        /* Cap so we don't go wildly tall on edge-case displays. */
        CANVAS_H = Math.min(CANVAS_H, baseH * 4);
        GAME_X = lStrip;
        GAME_Y = Math.floor((CANVAS_H - H) / 2);
      } else if (screenAspect > baseAspect * 1.05) {
        /* Ultra-wide screen — extend horizontal strips equally. */
        CANVAS_W = Math.round(baseH * screenAspect);
        CANVAS_H = baseH;
        var extraW = CANVAS_W - baseW;
        GAME_X = lStrip + Math.floor(extraW / 2);
        GAME_Y = 0;
      } else {
        CANVAS_W = baseW;
        CANVAS_H = baseH;
        GAME_X = lStrip;
        GAME_Y = 0;
      }
      /* Publish to input.js so touch-strip layout / click mapping match. */
      Game.TOUCH_LEFT_W = GAME_X;
      Game.TOUCH_RIGHT_W = CANVAS_W - GAME_X - W;
      Game.GAME_Y = GAME_Y;
    } else {
      CANVAS_W = W;
      CANVAS_H = H;
      GAME_X = 0;
      GAME_Y = 0;
      Game.TOUCH_LEFT_W = 0;
      Game.TOUCH_RIGHT_W = 0;
      Game.GAME_Y = 0;
    }
  }

  /* Resize the backing store to match logical canvas dimensions × DPR so
     rendering stays crisp on retina displays. Cap DPR at 3× to keep the
     backing-store memory sane on pathological screens. The 2D context's
     base transform is scaled by dpr so all game code keeps drawing in
     logical CANVAS_W × CANVAS_H coordinates. */
  function resizeBackingStore() {
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  /* ---- Init ---- */
  function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    computeCanvasLayout();
    resizeBackingStore();

    /* Load saved customization + quest progress */
    loadPersistent();

    /* Input */
    Game.input.init(canvas);

    /* Audio init on first interaction */
    Game.audio.init();

    /* Click handler for menus */
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchend', function (e) {
      /* Prevent double-fire on touch devices */
      if (state !== State.PLAYING) {
        onClick(e);
      }
    });

    /* Handle resize – recompute layout (in case orientation / DPR / size
       changed), re-allocate the backing store, then scale-to-fit via CSS. */
    function resize() {
      computeCanvasLayout();
      resizeBackingStore();
      var container = canvas.parentElement;
      var cw = container.clientWidth;
      var ch = container.clientHeight;
      var scale = Math.min(cw / CANVAS_W, ch / CANVAS_H);
      canvas.style.width = Math.floor(CANVAS_W * scale) + 'px';
      canvas.style.height = Math.floor(CANVAS_H * scale) + 'px';
      Game.input.refreshLayout();
    }
    window.addEventListener('resize', resize);
    /* iOS Safari fires orientationchange separately from resize on some
       devices – listen for both so the layout actually re-fits. */
    window.addEventListener('orientationchange', resize);
    resize();

    /* Prevent default touch behavior on canvas */
    canvas.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });

    /* Start */
    requestAnimationFrame(gameLoop);
  }

  /* ---- Export ---- */
  window.Game.engine = {
    init: init,
    State: State,
    onRocketInteract: onRocketInteract,
    enterHouse: enterHouse,
    exitHouse: exitHouse,
    savePersistent: savePersistent,
    getCurrentZone: function () { return currentZone; },
    /* Hotel zoo: */
    onElevatorInteract: onElevatorInteract,
    useStairs: useStairs,
    enterAnimalRoom: enterAnimalRoom,
    exitAnimalRoom: exitAnimalRoom,
    enterSleepCutscene: enterSleepCutscene,
    exitSleepCutscene: exitSleepCutscene,
    beginLobbyIntro: beginLobbyIntro,
    enterBookshelfCutscene: enterBookshelfCutscene,
    exitBookshelfCutscene: exitBookshelfCutscene,
    openLedger: openLedger,
    closeLedger: closeLedger,
    stampGuest: stampGuest,
    getStampCount: function () { return Game.flags.stampCount || 0; },
    getStampTotal: function () { return TOTAL_GUESTS; },
    /* Test/debug helpers — used by Playwright drivers to capture state
       without waiting on requestAnimationFrame, which is throttled in
       headless Chromium. Cheap to keep in production. */
    _getState: function () { return state; },
    _forceRender: function () { render(); },
  };

  /* Auto-init when DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
