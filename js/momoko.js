/* momoko.js – the hero renderer and her animation rig.

   Momoko is painted in the same 28 x 34 slot every caller already uses
   (feet on y = 34, head centred on x = 14), so gameplay, the customize
   preview, the intro, the elevator, the cutscenes and the pause / victory
   floss all share one character. Collision boxes never change; callers
   scale her up from the feet.

   How she is built, back to front:
     cape -> sun-hat brim -> long hair / tails / braids / ponytail ->
     nape -> backpack, wings -> far arm (when turned) -> legs, socks and
     shoes -> outfit -> apron, bag, badge, necklace, scarf -> near arm
     and held item -> cape collar -> neck -> face and face paint ->
     glasses -> fringe -> hood -> hats and bows -> balloon.

   Every surface is a flat fill with two hard cel bands on the side away
   from the light (skin shadows warm toward red, cloth and hair cool toward
   plum), soft occlusion where one form tucks under another and an outline
   in a dark shade of its own hue instead of black. The scene's key light
   and rim are added on top by Game.fx.lit, so this file only models form.

   Animation is a pose: a small bag of numbers (walk phase, stride, bob,
   lean, head turn, blink, spring offsets for hair / skirt / ears / charms,
   arm angles) that paint() turns into a figure. A Rig builds that pose
   each frame from where the caller says she is: it differentiates her
   position into velocity and acceleration, runs a walk cycle off speed,
   turns her head through a three-quarter view instead of snapping the
   mirror, drives spring-damper secondaries from the motion (so tails lag,
   overshoot and settle when she stops), and layers idle breathing,
   blinks, glances, weight shifts and one-shot actions (pet, cheer, wave)
   on top. Callers without a rig get a simple pose from their walk frame
   and the wall clock. */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var TAU = Math.PI * 2;

  /* ---- options (the customize screen lists these; anything else in a
     save falls back to the default) ---- */
  var OPT = {
    hairStyle: ['twinTails', 'longBraids', 'buns', 'ponytail', 'bob', 'longHair',
                'sideTail', 'lowTails', 'curls', 'wavy', 'hime', 'pixie'],
    outfit: ['frillyDress', 'sailorDress', 'starDress', 'bellhop', 'overalls', 'kimono',
             'maid', 'princess', 'tutu', 'zookeeper',
             'frillyBikini', 'sailorSwimsuit', 'onePiece', 'catPjs', 'bearPjs', 'frogPjs', 'penguinPjs',
             'dinoPjs', 'foxPjs', 'lionPjs', 'sharkPjs'],
    shoes: ['maryJane', 'sneaker', 'flipper', 'slipper', 'highBoot', 'ballet', 'sandal', 'roller', 'paw'],
    hat: ['none', 'hotelCap', 'bigBow', 'hairClips', 'flowerCrown', 'catEars', 'tiara',
          'crown', 'beret', 'strawHat', 'chefHat', 'partyHat', 'safariHat'],
    extra: ['none', 'glasses', 'heartGlasses', 'nameBadge', 'satchel', 'backpack', 'scarf',
            'starShades', 'necklace', 'apron', 'wings', 'cape'],
    face: ['none', 'heartEyes', 'sparkleEyes', 'freckles', 'heartCheeks', 'starSticker', 'whiskers', 'bandage'],
    food: ['none', 'iceCream', 'onigiri', 'donut', 'crepe', 'taiyaki', 'parfait', 'macaron', 'strawberry',
           'lollipop', 'dango', 'cupcake', 'balloon', 'teddy',
           'roomKey', 'deskBell', 'suitcase', 'bouquet', 'starWand', 'pinwheel']
  };
  var DEF = { hairStyle: 'twinTails', outfit: 'frillyDress', shoes: 'maryJane', hat: 'none', extra: 'none', face: 'none',
              food: 'none', hair: '#e06088', suit: '#e06088', skin: '#ffddbb', flipper: '#ff99cc', eyes: '#7c3452' };
  function pick(field, v) { return OPT[field].indexOf(v) >= 0 ? v : DEF[field]; }
  var HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  function col(field, v) { return (typeof v === 'string' && HEX.test(v)) ? v : DEF[field]; }

  /* ---- colour helpers (all results cached; nothing allocates per frame
     once a palette has been seen) ---- */
  function rgbOf(hex) {
    if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    var n = parseInt(hex.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hexOf(r, g, b) {
    r = Math.max(0, Math.min(255, Math.round(r)));
    g = Math.max(0, Math.min(255, Math.round(g)));
    b = Math.max(0, Math.min(255, Math.round(b)));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function mix(a, b, k) {
    var p = rgbOf(a), q = rgbOf(b);
    return hexOf(p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k);
  }
  function add(a, amt) {
    var p = rgbOf(a);
    return hexOf(p[0] + amt, p[1] + amt, p[2] + amt);
  }
  /* Where a surface turns from the light: skin warms toward blood red,
     everything else cools toward the hotel's plum. */
  function shadowOf(c, amt, warm) {
    return mix(add(c, -amt), warm ? '#c0483a' : '#4a2470', warm ? amt / 190 : amt / 160);
  }
  /* Outline: the same hue pushed dark and a little more saturated, with a
     third of the house ink so every line belongs to one family. */
  function inkOf(c0) {
    var p = rgbOf(c0), r = p[0] / 255, g = p[1] / 255, b = p[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    var s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (s < 0.16) return mix(hexOf(p[0] * 0.38, p[1] * 0.38, p[2] * 0.38), '#3a1c34', 0.42);
    var h;
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    var l2 = Math.min(0.25, l * 0.48), s2 = Math.min(1, s * 0.8 + 0.2);
    var cc = (1 - Math.abs(2 * l2 - 1)) * s2, x = cc * (1 - Math.abs((h / 60) % 2 - 1)), m = l2 - cc / 2;
    var rr = 0, gg = 0, bb = 0;
    if (h < 60) { rr = cc; gg = x; } else if (h < 120) { rr = x; gg = cc; }
    else if (h < 180) { gg = cc; bb = x; } else if (h < 240) { gg = x; bb = cc; }
    else if (h < 300) { rr = x; bb = cc; } else { rr = cc; bb = x; }
    return mix(hexOf((rr + m) * 255, (gg + m) * 255, (bb + m) * 255), '#3a1c34', 0.3);
  }

  var rampCache = {};
  function ramp(c0, warm) {
    var k = c0 + (warm ? 'w' : '');
    var R = rampCache[k];
    if (R) return R;
    R = rampCache[k] = {
      c: c0,
      m: shadowOf(c0, 18, warm),
      d: shadowOf(c0, 38, warm),
      l: mix(add(c0, 34), '#ffffff', 0.3),
      ink: inkOf(warm ? shadowOf(c0, 70, true) : c0)
    };
    return R;
  }
  var palCache = {};
  function paletteFor(cust) {
    var hair = col('hair', cust && cust.hair);
    var suit = col('suit', cust && cust.suit);
    var skin = col('skin', cust && cust.skin);
    var shoe = col('flipper', cust && cust.flipper);
    var eyes = col('eyes', cust && cust.eyes);
    var k = hair + suit + skin + shoe + eyes;
    var p = palCache[k];
    if (p) return p;
    p = palCache[k] = {
      hair: ramp(hair, false),
      suit: ramp(suit, false),
      skin: ramp(skin, true),
      shoe: ramp(shoe, false),
      white: ramp('#fff6f8', false),
      sash: ramp(mix(suit, '#ffffff', 0.55), false),
      gloss: mix(add(hair, 70), '#ffffff', 0.45),
      blush: 'rgba(255,110,140,0.34)',
      /* iris: dark at the lid, the picked colour, a bright bounce below */
      iris: eyes === DEF.eyes ? { d: '#3a1428', c: eyes, l: '#e08aa4' }
          : { d: mix(eyes, '#160610', 0.6), c: eyes, l: mix(add(eyes, 80), '#ffffff', 0.3) }
    };
    p.white = { c: p.white.c, m: p.white.m, d: p.white.d, l: p.white.l, ink: mix(p.suit.ink, '#8a6a7a', 0.35) };
    p.hair = { c: p.hair.c, m: p.hair.m, d: p.hair.d, l: p.hair.l, ink: p.hair.ink,
               deep: mix(shadowOf(hair, 70, false), '#2a1030', 0.15) };
    p.nape = { c: p.hair.m, m: p.hair.d, d: p.hair.deep, ink: p.hair.ink };
    return p;
  }
  var GOLD = ramp('#ffd24a', false), SILVER = ramp('#e6e8f4', false), INK = '#2a0e1e';

  /* ---- drawing primitives ---- */
  var LW = 0.5;            /* outline width in local units, set per call */
  var LX = -0.35, LY = -1; /* light direction used for the cel bands */

  /* Fill, two cel bands on the far side, optional extra shading clipped
     to the shape, then the hue-tinted outline. */
  function part(c, path, R, s, extra, noInk) {
    s = s || 1;
    c.save();
    path();
    c.clip();
    c.fillStyle = R.d;
    c.fillRect(-24, -30, 80, 80);
    c.translate(LX * 1.1 * s, LY * 1.1 * s);
    path();
    c.fillStyle = R.m;
    c.fill();
    c.translate(LX * 0.6 * s, LY * 0.6 * s);
    path();
    c.fillStyle = R.c;
    c.fill();
    c.restore();
    if (extra) {
      c.save();
      path();
      c.clip();
      extra();
      c.restore();
    }
    if (!noInk) {
      path();
      c.strokeStyle = R.ink;
      c.lineWidth = LW;
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.stroke();
    }
  }
  function ell(c, x, y, rx, ry, rot) {
    c.beginPath();
    c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU);
  }
  function starPath(c, cx, cy, r, inner) {
    c.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 === 0 ? r : r * (inner || 0.42);
      if (i === 0) c.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      else c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    c.closePath();
  }
  function fillStar(c, cx, cy, r) { starPath(c, cx, cy, r); c.fill(); }
  function heartPath(c, x, y, r) {
    c.beginPath();
    c.moveTo(x, y + r * 0.9);
    c.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.7, y - r * 1.25, x, y - r * 0.45);
    c.bezierCurveTo(x + r * 0.7, y - r * 1.25, x + r * 1.5, y - r * 0.1, x, y + r * 0.9);
    c.closePath();
  }
  function stroke(c, cl, w, a) {
    c.strokeStyle = cl;
    c.lineWidth = w;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (a !== undefined && a < 1) {
      var ga = c.globalAlpha;
      c.globalAlpha = ga * a;
      c.stroke();
      c.globalAlpha = ga;
    } else {
      c.stroke();
    }
  }
  function gloss(c, x, y, rx, ry, rot, a, cl) {
    var ga = c.globalAlpha;
    c.globalAlpha = ga * (a || 0.6);
    ell(c, x, y, rx, ry, rot);
    c.fillStyle = cl || '#ffffff';
    c.fill();
    c.globalAlpha = ga;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }

  /* A soft tapered limb along a curve through three joints (shoulder,
     elbow, wrist / hip, knee, ankle), radius easing r0 -> r1 -> r2 with
     an optional muscle bulge at t = bt. Rounded caps both ends. */
  var LA = new Float64Array(26), LB = new Float64Array(26);
  function limbPath(c, x0, y0, x1, y1, x2, y2, r0, r1, r2, bt, br) {
    var qx = 2 * x1 - (x0 + x2) / 2, qy = 2 * y1 - (y0 + y2) / 2;
    var N = 10, a0 = 0, aN = 0, rS = r0, rE = r2;
    for (var i = 0; i <= N; i++) {
      var t = i / N, it = 1 - t;
      var px = it * it * x0 + 2 * it * t * qx + t * t * x2;
      var py = it * it * y0 + 2 * it * t * qy + t * t * y2;
      var tx = 2 * it * (qx - x0) + 2 * t * (x2 - qx);
      var ty = 2 * it * (qy - y0) + 2 * t * (y2 - qy);
      var tl = Math.sqrt(tx * tx + ty * ty) || 1;
      var nx = -ty / tl, ny = tx / tl;
      var r = t < 0.5 ? r0 + (r1 - r0) * t * 2 : r1 + (r2 - r1) * (t - 0.5) * 2;
      if (br) r += br * Math.exp(-((t - bt) * (t - bt)) / 0.03);
      LA[i * 2] = px + nx * r; LA[i * 2 + 1] = py + ny * r;
      LB[i * 2] = px - nx * r; LB[i * 2 + 1] = py - ny * r;
      if (i === 0) { a0 = Math.atan2(ny, nx); rS = r; }
      if (i === N) { aN = Math.atan2(ny, nx); rE = r; }
    }
    c.beginPath();
    c.moveTo(LA[0], LA[1]);
    for (i = 1; i < N; i++) {
      c.quadraticCurveTo(LA[i * 2], LA[i * 2 + 1], (LA[i * 2] + LA[i * 2 + 2]) / 2, (LA[i * 2 + 1] + LA[i * 2 + 3]) / 2);
    }
    c.lineTo(LA[N * 2], LA[N * 2 + 1]);
    c.arc(x2, y2, rE, aN, aN - Math.PI, true);
    for (i = N - 1; i > 0; i--) {
      c.quadraticCurveTo(LB[i * 2], LB[i * 2 + 1], (LB[i * 2] + LB[i * 2 - 2]) / 2, (LB[i * 2 + 1] + LB[i * 2 - 1]) / 2);
    }
    c.lineTo(LB[0], LB[1]);
    c.arc(x0, y0, rS, a0 + Math.PI, a0, true);
    c.closePath();
  }

  /* ================================================================
     HAIR
     ================================================================ */

  /* One twin-tail, left side (the right one is mirrored). Rooted high on
     the side of the head, it bells out, then splits into three locks
     whose tips trail the motion; w is a small per-lock flutter. */
  function tailPath(c, sw, w) {
    c.beginPath();
    c.moveTo(6.2, 4.6);
    c.bezierCurveTo(1.6, 3.6, -1.4 + sw * 0.15, 8.6, -1.1 + sw * 0.3, 14.4);
    c.bezierCurveTo(-0.9 + sw * 0.4, 19.4, -0.2 + sw * 0.6, 23.6, -1.0 + sw + w * 0.35, 28.6);
    c.quadraticCurveTo(0.9 + sw * 0.8, 26.6, 1.5 + sw * 0.7, 24.8);
    c.quadraticCurveTo(1.8 + sw * 0.9, 28.2, 3.2 + sw * 1.15 - w * 0.3, 31.0);
    c.quadraticCurveTo(3.7 + sw * 0.7, 27.0, 3.9 + sw * 0.5, 24.2);
    c.quadraticCurveTo(4.7 + sw * 0.5, 25.6, 5.6 + sw * 0.6 + w * 0.25, 26.4);
    c.bezierCurveTo(4.0 + sw * 0.3, 21.0, 3.3 + sw * 0.1, 15.0, 5.0, 9.4);
    c.closePath();
  }
  function drawTail(c, P, sw, w) {
    var H = P.hair;
    part(c, function () { tailPath(c, sw, w); }, H, 1.4, function () {
      c.beginPath();
      c.moveTo(3.4, 7.0);
      c.bezierCurveTo(0.9, 12, 0.9 + sw * 0.3, 19, 1.5 + sw * 0.7, 24.6);
      c.moveTo(4.8, 9.6);
      c.bezierCurveTo(3.2, 15, 3.0 + sw * 0.3, 20, 3.9 + sw * 0.5, 24.0);
      stroke(c, H.d, 0.55);
      c.beginPath();
      c.moveTo(2.2, 6.6);
      c.bezierCurveTo(0.6, 9.0, 0.2 + sw * 0.1, 11.6, 0.4 + sw * 0.2, 14.2);
      stroke(c, P.gloss, 0.9, 0.75);
      c.beginPath();
      c.moveTo(0.9 + sw * 0.3, 16.0);
      c.lineTo(1.0 + sw * 0.35, 17.6);
      stroke(c, P.gloss, 0.7, 0.55);
    });
    /* a loose strand that flies a little further than the rest */
    c.beginPath();
    c.moveTo(1.0 + sw * 0.4, 18.0);
    c.quadraticCurveTo(-0.8 + sw * 0.9, 23.0, -1.4 + sw * 1.3 + w * 0.5, 26.4);
    stroke(c, H.ink, LW * 0.8, 0.8);
  }

  /* Two lobes of braid per segment with a crease between, tapering. */
  function drawBraid(c, P, sw, w) {
    var H = P.hair;
    for (var i = 0; i < 6; i++) {
      var t = i / 5;
      var bx = 2.4 - t * 0.6 + sw * t * t * 1.4 + (i % 2 ? 0.45 : -0.45) + w * t * 0.2;
      var by = 8.6 + i * 3.9;
      var rx = 2.7 - t * 0.7, ry = 2.3 - t * 0.3;
      part(c, function () { ell(c, bx, by, rx, ry, i % 2 ? 0.35 : -0.35); }, H, 0.9, function () {
        c.beginPath();
        c.moveTo(bx - rx * 0.7, by - ry * 0.2);
        c.quadraticCurveTo(bx, by + ry * 0.5, bx + rx * 0.7, by - ry * 0.2);
        stroke(c, H.d, 0.4);
        gloss(c, bx - rx * 0.35, by - ry * 0.45, rx * 0.35, ry * 0.2, -0.3, 0.7, P.gloss);
      });
    }
    var ex = 1.9 + sw * 1.5 + w * 0.3, ey = 31.2;
    part(c, function () {
      c.beginPath();
      c.moveTo(ex - 1.2, ey - 1.2);
      c.quadraticCurveTo(ex - 1.8, ey + 1.4, ex - 0.6 + w * 0.2, ey + 3.0);
      c.quadraticCurveTo(ex + 0.2, ey + 1.8, ex + 0.8 + w * 0.3, ey + 2.8);
      c.quadraticCurveTo(ex + 1.6, ey + 1.0, ex + 1.1, ey - 1.2);
      c.closePath();
    }, H, 0.8);
    part(c, function () { ell(c, ex, ey - 1.1, 1.7, 0.9, 0); }, P.suit, 0.6);
  }

  /* High ponytail tied at the back of the crown, falling behind her. */
  function drawPonytail(c, P, sw, w, by) {
    var H = P.hair;
    c.save();
    c.translate(0, 3);
    c.scale(1, 1 - by * 0.035);
    c.translate(0, -3);
    part(c, function () {
      c.beginPath();
      c.moveTo(9.0, 1.8);
      c.bezierCurveTo(3.6, 0.0, -0.8, 4.6, -0.2 + sw * 0.25, 10.0);
      c.bezierCurveTo(0.2 + sw * 0.45, 14.6, -0.4 + sw * 0.75, 18.4, 0.4 + sw + w * 0.35, 22.4);
      c.quadraticCurveTo(1.7 + sw * 0.8, 20.0, 2.4 + sw * 0.7, 18.0);
      c.quadraticCurveTo(3.0 + sw * 0.85, 21.0, 4.0 + sw * 1.05 - w * 0.25, 24.0);
      c.quadraticCurveTo(4.3 + sw * 0.6, 19.6, 4.4 + sw * 0.5, 16.6);
      c.quadraticCurveTo(5.0 + sw * 0.4, 17.6, 5.8 + sw * 0.45 + w * 0.2, 18.2);
      c.bezierCurveTo(4.6 + sw * 0.2, 12.4, 5.4, 7.0, 9.6, 4.4);
      c.closePath();
    }, H, 1.3, function () {
      c.beginPath();
      c.moveTo(6.4, 3.4);
      c.bezierCurveTo(2.4, 6, 1.6 + sw * 0.3, 12, 2.4 + sw * 0.7, 18.0);
      c.moveTo(7.6, 4.6);
      c.bezierCurveTo(4.6, 8, 3.8 + sw * 0.3, 13, 4.4 + sw * 0.5, 16.6);
      stroke(c, H.d, 0.5);
      c.beginPath();
      c.moveTo(4.6, 2.6);
      c.bezierCurveTo(1.6, 4.2, 0.8, 7.0, 0.9 + sw * 0.15, 10.2);
      stroke(c, P.gloss, 0.85, 0.7);
    });
    c.restore();
    /* scrunchie */
    part(c, function () { ell(c, 8.6, 3.0, 1.7, 1.35, -0.5); }, P.suit, 0.6, function () {
      c.beginPath();
      c.moveTo(7.4, 2.4); c.lineTo(8.0, 3.8);
      c.moveTo(8.8, 1.8); c.lineTo(9.3, 3.6);
      stroke(c, P.suit.d, 0.35);
      gloss(c, 8.0, 2.3, 0.6, 0.3, -0.5, 0.6, P.suit.l);
    });
  }

  /* Long straight hair falling to the waist behind her, tips trailing. */
  function drawLongHair(c, P, sw, w) {
    var H = P.hair;
    part(c, function () {
      c.beginPath();
      c.moveTo(4.4, 10.0);
      c.bezierCurveTo(2.6, 16, 2.4 + sw * 0.3, 22, 2.2 + sw * 0.7, 27.4);
      c.quadraticCurveTo(3.2 + sw * 0.85, 29.6, 3.6 + sw * 0.95 + w * 0.3, 31.0);
      c.quadraticCurveTo(5.2 + sw * 0.8, 28.6, 6.6 + sw * 0.8, 29.2);
      c.quadraticCurveTo(7.8 + sw * 0.8, 30.6, 8.6 + sw * 0.85 - w * 0.2, 31.2);
      c.lineTo(19.4 + sw * 0.85 + w * 0.2, 31.2);
      c.quadraticCurveTo(20.2 + sw * 0.8, 30.6, 21.4 + sw * 0.8, 29.2);
      c.quadraticCurveTo(22.8 + sw * 0.8, 28.6, 24.4 + sw * 0.95 - w * 0.3, 31.0);
      c.quadraticCurveTo(24.8 + sw * 0.85, 29.6, 25.8 + sw * 0.7, 27.4);
      c.bezierCurveTo(25.6 + sw * 0.3, 22, 25.4, 16, 23.6, 10.0);
      c.bezierCurveTo(23.6, 0.8, 4.4, 0.8, 4.4, 10.0);
      c.closePath();
    }, H, 1.4, function () {
      c.beginPath();
      c.moveTo(5.0, 12); c.bezierCurveTo(4.0, 18, 4.4 + sw * 0.4, 24, 5.2 + sw * 0.8, 29.0);
      c.moveTo(23.0, 12); c.bezierCurveTo(24.0, 18, 23.6 + sw * 0.4, 24, 22.8 + sw * 0.8, 29.0);
      stroke(c, H.d, 0.5);
      c.beginPath();
      c.moveTo(3.6, 13); c.bezierCurveTo(3.0, 16, 3.0 + sw * 0.2, 19, 3.2 + sw * 0.35, 21.4);
      stroke(c, P.gloss, 0.85, 0.6);
    });
  }

  /* Long loose waves: the same fall as long hair with scalloped sides
     and a curled hem. */
  function drawWavy(c, P, sw, w) {
    var H = P.hair, i;
    function side(m) {         /* m = 1 down the left edge, -1 back up the right */
      var X = function (x) { return m > 0 ? x : 28 - x; };
      var pts = [4.2, 10.0, 1.9, 13.2, 3.5, 16.4, 1.3, 19.6, 3.1, 22.8, 0.9, 26.0, 2.6, 29.6];
      var k, t;
      if (m > 0) {
        for (k = 2; k < pts.length; k += 4) {
          t = (pts[k + 1] - 10) / 20;
          c.quadraticCurveTo(X(pts[k]) + sw * t, pts[k + 1], X(pts[k + 2]) + sw * (t + 0.08), pts[k + 3]);
        }
      } else {
        for (k = pts.length - 4; k >= 2; k -= 4) {
          t = (pts[k + 1] - 10) / 20;
          c.quadraticCurveTo(X(pts[k]) + sw * t, pts[k + 1], X(pts[k - 2]) + sw * (t - 0.08), pts[k - 1]);
        }
      }
    }
    part(c, function () {
      c.beginPath();
      c.moveTo(4.2, 10.0);
      side(1);
      /* curled hem: five soft scallops */
      for (i = 0; i < 5; i++) {
        var x0 = 2.6 + i * 4.56 + sw, fl = (i % 2 ? -1 : 1) * w * 0.25;
        c.quadraticCurveTo(x0 + 2.28 + fl, 32.6 - (i === 2 ? 0.4 : 0), x0 + 4.56, 29.6 + (i === 4 ? 0 : 0.5));
      }
      side(-1);
      c.bezierCurveTo(23.8, 0.6, 4.2, 0.6, 4.2, 10.0);
      c.closePath();
    }, H, 1.4, function () {
      c.beginPath();
      for (i = 0; i < 2; i++) {
        var q = i ? -1 : 1, bx = i ? 28 : 0;
        c.moveTo(bx + q * 5.4, 12);
        c.bezierCurveTo(bx + q * 3.4, 15, bx + q * 6.4 + sw * 0.3, 18, bx + q * 4.2 + sw * 0.5, 21.4);
        c.bezierCurveTo(bx + q * 2.6 + sw * 0.6, 24, bx + q * 5.6 + sw * 0.8, 26.6, bx + q * 4.4 + sw, 29.4);
      }
      stroke(c, H.d, 0.5);
      c.beginPath();
      c.moveTo(3.0, 13.2); c.quadraticCurveTo(2.6, 14.6, 3.6, 16.0);
      c.moveTo(2.4, 19.6); c.quadraticCurveTo(2.0, 21.0, 3.2, 22.4);
      c.moveTo(2.0 + sw * 0.6, 26.0); c.quadraticCurveTo(1.6 + sw * 0.7, 27.4, 2.6 + sw * 0.8, 28.6);
      stroke(c, P.gloss, 0.85, 0.65);
    });
  }

  /* Low pigtail, left side: a short fluffy bunch tied at the jaw. */
  function drawLowTail(c, P, sw, w) {
    var H = P.hair;
    part(c, function () {
      c.beginPath();
      c.moveTo(5.4, 13.4);
      c.bezierCurveTo(2.2, 13.8, -0.4 + sw * 0.3, 17.4, 0.0 + sw * 0.6, 21.2);
      c.bezierCurveTo(0.1 + sw * 0.8, 23.4, 0.6 + sw * 0.9 + w * 0.3, 25.0, 1.5 + sw + w * 0.35, 26.8);
      c.quadraticCurveTo(2.3 + sw * 0.85, 25.0, 3.0 + sw * 0.8, 24.0);
      c.quadraticCurveTo(3.6 + sw * 0.9, 26.0, 4.7 + sw - w * 0.3, 27.6);
      c.quadraticCurveTo(5.3 + sw * 0.7, 25.0, 5.7 + sw * 0.6, 23.4);
      c.quadraticCurveTo(6.5 + sw * 0.55, 24.6, 7.5 + sw * 0.6 + w * 0.2, 25.2);
      c.bezierCurveTo(7.7 + sw * 0.3, 21.0, 8.0, 17.0, 7.2, 13.6);
      c.closePath();
    }, H, 1.2, function () {
      c.beginPath();
      c.moveTo(4.4, 15.0); c.bezierCurveTo(2.4, 18.0, 2.4 + sw * 0.4, 21.4, 3.0 + sw * 0.8, 24.0);
      c.moveTo(6.0, 15.0); c.bezierCurveTo(5.2, 18.4, 5.2 + sw * 0.4, 21.0, 5.7 + sw * 0.6, 23.4);
      stroke(c, H.d, 0.5);
      c.beginPath();
      c.moveTo(2.6, 15.6); c.bezierCurveTo(1.0, 17.2, 0.8 + sw * 0.2, 19.2, 1.0 + sw * 0.4, 21.0);
      stroke(c, P.gloss, 0.9, 0.7);
    });
  }
  /* The tie on a low pigtail: two glossy bobbles. */
  function drawBobbles(c, R, x, y) {
    for (var i = 0; i < 2; i++) {
      var bx = x + (i ? 1.15 : -0.5), by = y + (i ? 0.55 : -0.3);
      part(c, function () { ell(c, bx, by, 0.95, 0.95, 0); }, R, 0.4, function () {
        gloss(c, bx - 0.3, by - 0.35, 0.32, 0.22, -0.5, 0.9);
      });
    }
  }

  /* Ringlet, left side: a drill curl winding down from the crown to a
     point, scalloped where each turn overlaps the next. */
  function drawRinglet(c, P, sw, w) {
    var H = P.hair, N = 4, L = 17.5, Y0 = 6.4, i;
    function cx(t) { return 3.5 - 0.5 * t + sw * t * t * 1.4 + w * t * 0.25; }
    function r(t) { return 3.9 * (1 - 0.8 * t); }
    function y(t) { return Y0 + L * t; }
    part(c, function () {
      c.beginPath();
      c.moveTo(cx(0) - 1.6, Y0 - 1.2);
      for (i = 0; i < N; i++) {
        var tm = (i + 0.5) / N, t1 = (i + 1) / N;
        c.quadraticCurveTo(cx(tm) - r(tm) * 1.35, y(tm) - 0.4, cx(t1) - r(t1) * 0.7, y(t1));
      }
      c.quadraticCurveTo(cx(1) - 0.4 + w * 0.3, y(1) + 2.0, cx(1) + 0.5 + w * 0.4, y(1) + 3.2);
      c.quadraticCurveTo(cx(1) + 0.9, y(1) + 1.0, cx(1 - 0.5 / N) + r(1 - 0.5 / N) * 0.7, y(1 - 0.5 / N));
      for (i = N - 1; i >= 1; i--) {
        var ta = i / N, tb = (i - 0.5) / N;
        c.quadraticCurveTo(cx(ta) + r(ta) * 1.35, y(ta) - 0.4, cx(tb) + r(tb) * 0.7, y(tb));
      }
      c.quadraticCurveTo(cx(0) + r(0) * 1.1, Y0 + 0.4, cx(0) + 2.6, Y0 - 1.4);
      c.closePath();
    }, H, 1.3, function () {
      c.beginPath();
      for (i = 0; i < N; i++) {
        var t1 = (i + 1) / N, tv = (i + 0.5) / N;
        c.moveTo(cx(t1) - r(t1) * 0.7, y(t1));
        c.quadraticCurveTo(cx(t1) + r(t1) * 0.2, y(t1) - 0.3, cx(tv) + r(tv) * 0.7, y(tv));
      }
      stroke(c, H.d, 0.55, 0.9);
      c.beginPath();
      for (i = 0; i < N; i++) {
        var tg = (i + 0.3) / N;
        c.moveTo(cx(tg) - r(tg) * 0.75, y(tg) + 0.3);
        c.quadraticCurveTo(cx(tg) - r(tg) * 0.5, y(tg) - 1.1, cx(tg) + r(tg) * 0.1, y(tg) - 1.3);
      }
      stroke(c, P.gloss, 0.8, 0.75);
    });
  }

  /* Pixie crop: a short nape whose ends flick out below the ears. */
  function pixiePath(c, s) {
    c.beginPath();
    c.moveTo(4.4, 11.0);
    c.bezierCurveTo(4.0, 1.2, 24.0, 1.2, 23.6, 11.0);
    c.bezierCurveTo(23.9, 13.6, 24.8 + s, 15.2, 26.3 + s, 15.6);
    c.quadraticCurveTo(24.6 + s * 0.6, 17.4, 22.9, 16.6);
    c.quadraticCurveTo(23.4 + s * 0.4, 18.4, 22.6 + s * 0.4, 19.6);
    c.quadraticCurveTo(21.6, 19.2, 20.8, 18.2);
    c.lineTo(7.2, 18.2);
    c.quadraticCurveTo(6.4, 19.2, 5.4 + s * 0.4, 19.6);
    c.quadraticCurveTo(4.6 + s * 0.4, 18.4, 5.1, 16.6);
    c.quadraticCurveTo(3.4 + s * 0.6, 17.4, 1.7 + s, 15.6);
    c.bezierCurveTo(3.2 + s, 15.2, 4.1, 13.6, 4.4, 11.0);
    c.closePath();
  }

  /* Hime cut: a blunt, straight side lock to the jaw (left side). */
  function himeLockPath(c, s) {
    c.beginPath();
    c.moveTo(4.5, 10.4);
    c.bezierCurveTo(3.8, 13.2, 3.7 + s * 0.5, 16.8, 3.9 + s, 20.2);
    c.lineTo(7.9 + s * 0.8, 20.2);
    c.bezierCurveTo(7.3 + s * 0.3, 16.4, 7.3, 12.6, 7.9, 9.6);
    c.closePath();
  }

  /* Bob: a fuller nape that ends at the jaw with an inward curl. */
  function bobPath(c, s) {
    c.beginPath();
    c.moveTo(3.8, 11.0);
    c.bezierCurveTo(3.2, 0.4, 24.8, 0.4, 24.2, 11.0);
    c.bezierCurveTo(24.8, 14.8, 25.0 + s, 18.0, 23.8 + s, 20.4);
    c.quadraticCurveTo(22.4 + s, 21.6, 20.6 + s * 0.6, 20.2);
    c.lineTo(7.4 + s * 0.6, 20.2);
    c.quadraticCurveTo(5.6 + s, 21.6, 4.2 + s, 20.4);
    c.bezierCurveTo(3.0 + s, 18.0, 3.2, 14.8, 3.8, 11.0);
    c.closePath();
  }
  function bobLockPath(c, s) {
    c.beginPath();
    c.moveTo(4.6, 10.6);
    c.bezierCurveTo(3.6, 14.0, 3.8 + s, 18.4, 5.6 + s, 20.4);
    c.quadraticCurveTo(7.4 + s * 0.8, 20.8, 8.0 + s * 0.6, 19.4);
    c.quadraticCurveTo(6.8, 17.8, 7.2, 14.0);
    c.quadraticCurveTo(7.4, 11.6, 7.9, 9.6);
    c.closePath();
  }

  /* Back of the head: the nape and the hair behind the shoulders. */
  function backHairPath(c) {
    c.beginPath();
    c.moveTo(4.6, 11.4);
    c.bezierCurveTo(4.2, 1.4, 23.8, 1.4, 23.4, 11.4);
    c.bezierCurveTo(23.6, 14.6, 23.2, 17.4, 22.0, 19.6);
    c.quadraticCurveTo(14, 21.6, 6.0, 19.6);
    c.bezierCurveTo(4.8, 17.4, 4.4, 14.6, 4.6, 11.4);
    c.closePath();
  }

  /* The front hair: skull cap, five bang locks, and a lock down each
     cheek. fx shifts the bang tips with the head turn. */
  function capPath(c, fx) {
    fx = fx || 0;
    c.beginPath();
    c.moveTo(4.5, 11.8);
    c.bezierCurveTo(4.2, 14.4, 4.8, 16.8, 6.4, 18.6);
    c.quadraticCurveTo(6.4, 15.2, 7.3, 12.6);
    c.quadraticCurveTo(7.4, 10.8, 7.9 + fx * 0.3, 9.4);
    c.quadraticCurveTo(8.0 + fx * 0.4, 10.6, 8.7 + fx * 0.5, 11.4);
    c.quadraticCurveTo(9.4 + fx * 0.6, 9.2, 10.4 + fx * 0.7, 8.2);
    c.quadraticCurveTo(10.6 + fx * 0.7, 10.4, 11.9 + fx * 0.8, 12.0);
    c.quadraticCurveTo(12.6 + fx * 0.8, 9.6, 13.6 + fx * 0.8, 8.4);
    c.quadraticCurveTo(14.4 + fx * 0.8, 10.2, 15.3 + fx * 0.8, 11.6);
    c.quadraticCurveTo(16.0 + fx * 0.7, 9.4, 17.2 + fx * 0.7, 8.2);
    c.quadraticCurveTo(17.8 + fx * 0.6, 10.2, 18.9 + fx * 0.5, 11.5);
    c.quadraticCurveTo(19.4 + fx * 0.4, 9.6, 20.2 + fx * 0.3, 8.9);
    c.quadraticCurveTo(20.4, 10.0, 20.7, 10.6);
    c.quadraticCurveTo(20.8, 12.0, 20.8, 12.6);
    c.quadraticCurveTo(21.6, 15.2, 21.6, 18.6);
    c.bezierCurveTo(23.2, 16.8, 23.8, 14.4, 23.5, 11.8);
    c.bezierCurveTo(23.6, 0.6, 4.4, 0.6, 4.5, 11.8);
    c.closePath();
  }
  function drawCap(c, P, ah, fx, sw) {
    var H = P.hair;
    /* cowlick first, so the cap overlaps its root */
    part(c, function () {
      c.beginPath();
      c.moveTo(13.2 + fx * 0.6, 2.6);
      c.quadraticCurveTo(14.2 + fx * 0.7, -0.8 + ah * 0.2, 17.6 + ah + fx * 0.4 + sw * 0.4, -1.4 - Math.abs(sw) * 0.1);
      c.quadraticCurveTo(15.6 + ah * 0.5 + fx * 0.6, -0.2, 15.4 + fx * 0.6, 2.8);
      c.closePath();
    }, H, 0.6);
    part(c, function () { capPath(c, fx); }, H, 1.6, function () {
      var px = 14 + fx * 0.9;
      c.beginPath();
      c.moveTo(px - 0.2, 2.6); c.quadraticCurveTo(10.6 + fx * 0.6, 4.6, 10.4 + fx * 0.7, 8.2);
      c.moveTo(px + 0.2, 2.6); c.quadraticCurveTo(13.4 + fx * 0.8, 5.2, 13.6 + fx * 0.8, 8.4);
      c.moveTo(px + 0.6, 2.6); c.quadraticCurveTo(16.8 + fx * 0.8, 4.8, 17.2 + fx * 0.7, 8.2);
      c.moveTo(px - 1.2, 3.0); c.quadraticCurveTo(7.6 + fx * 0.3, 5.4, 6.2, 11.0);
      c.moveTo(px + 1.4, 3.0); c.quadraticCurveTo(20.6 + fx * 0.3, 5.4, 21.8, 11.0);
      stroke(c, H.d, 0.42, 0.8);
      /* angel ring: a toothed band of gloss following the skull */
      var gx = 14 + fx * 0.5;
      c.beginPath();
      c.arc(gx, 10.4, 7.6, Math.PI * 1.13, Math.PI * 1.87);
      for (var i = 9; i >= 0; i--) {
        var a = Math.PI * 1.13 + Math.PI * 0.74 * (i / 9);
        var r = 7.6 - (i % 2 ? 2.2 : 1.1);
        c.lineTo(gx + Math.cos(a) * r, 10.4 + Math.sin(a) * r);
      }
      c.closePath();
      c.globalAlpha = 0.6;
      c.fillStyle = P.gloss;
      c.fill();
      c.globalAlpha = 1;
      c.beginPath();
      c.moveTo(8.2, 10.6); c.quadraticCurveTo(14 + fx, 7.4, 20.4, 10.4);
      stroke(c, H.d, 0.5, 0.35);
    });
  }

  /* Ribbon bow: two shaded loops, a knot, two tails that sway (tw). */
  function drawBow(c, R, x, y, s, flip, tw) {
    tw = tw || 0;
    c.save();
    c.translate(x, y);
    c.scale(flip ? -s : s, s);
    part(c, function () {
      c.beginPath();
      c.moveTo(0, 0.4);
      c.quadraticCurveTo(-0.6 + tw * 0.3, 1.8, -1.2 + tw, 3.4);
      c.lineTo(-0.2 + tw * 0.8, 2.8); c.lineTo(0.3 + tw * 0.9, 3.6);
      c.quadraticCurveTo(0.6 + tw * 0.4, 1.8, 0.6, 0.4);
      c.closePath();
    }, R, 0.6);
    part(c, function () {
      c.beginPath();
      c.moveTo(0, 0);
      c.bezierCurveTo(-1.6, -2.4, -3.6, -1.2, -3.0, 0.6);
      c.bezierCurveTo(-2.6, 1.8, -1.0, 1.2, 0, 0);
      c.moveTo(0, 0);
      c.bezierCurveTo(1.6, -2.4, 3.6, -1.2, 3.0, 0.6);
      c.bezierCurveTo(2.6, 1.8, 1.0, 1.2, 0, 0);
    }, R, 0.7, function () {
      gloss(c, -1.9, -0.6, 0.8, 0.4, -0.5, 0.6, R.l);
      c.beginPath();
      c.moveTo(-0.6, -0.2); c.quadraticCurveTo(-1.8, -0.4, -2.4, 0.4);
      c.moveTo(0.6, -0.2); c.quadraticCurveTo(1.8, -0.4, 2.4, 0.4);
      stroke(c, R.d, 0.3, 0.7);
    });
    part(c, function () { ell(c, 0, 0.1, 0.8, 0.85, 0); }, R, 0.4);
    c.restore();
  }

  function drawBuns(c, P) {
    for (var bn = 0; bn < 2; bn++) {
      var bx = bn ? 22.4 : 5.6;
      part(c, function () { ell(c, bx, 3.0, 3.9, 3.6, 0); }, P.hair, 1.1, function () {
        c.beginPath();
        c.arc(bx + 0.2, 3.2, 2.0, Math.PI * 0.9, Math.PI * 2.2);
        stroke(c, P.hair.d, 0.45);
        c.beginPath();
        c.arc(bx + 0.1, 3.0, 3.0, Math.PI * 1.1, Math.PI * 1.6);
        stroke(c, P.hair.d, 0.35, 0.6);
        gloss(c, bx - 1.2, 1.6, 1.2, 0.6, -0.5, 0.7, P.gloss);
      });
    }
  }

  /* ================================================================
     FACE
     ================================================================ */
  function facePath(c) {
    c.beginPath();
    c.moveTo(5.9, 11.2);
    c.bezierCurveTo(5.9, 4.4, 22.1, 4.4, 22.1, 11.2);
    c.bezierCurveTo(22.1, 15.2, 18.7, 19.2, 14, 19.5);
    c.bezierCurveTo(9.3, 19.2, 5.9, 15.2, 5.9, 11.2);
    c.closePath();
  }

  var LASH = '#2a0e1e';
  /* x,y eye centre; side -1 left / 1 right; sq squeezes the far eye in a
     turn; open 0..1 is the lid (blink); gx/gy point the iris; I is the
     iris ramp from the palette. */
  function drawEye(c, I, x, y, side, mode, sq, open, gx, gy, glint) {
    if (mode === 'happy' || mode === 'sleep') {
      c.beginPath();
      if (mode === 'happy') c.arc(x, y + 1.2, 2.1 * sq, Math.PI * 1.12, Math.PI * 1.88);
      else c.arc(x, y - 0.2, 2.4 * sq, Math.PI * 0.15, Math.PI * 0.85);
      stroke(c, LASH, 0.95);
      c.beginPath();
      c.moveTo(x + side * 2.2 * sq, y + (mode === 'happy' ? 0.2 : 0.6));
      c.lineTo(x + side * 3.0 * sq, y + (mode === 'happy' ? -0.4 : 0.1));
      stroke(c, LASH, 0.6);
      return;
    }
    var wide = mode === 'wide';
    var rx = 2.55 * sq * (wide ? 1.06 : 1), ry = 3.2 * (wide ? 1.08 : 1);
    if (open < 0.18) {
      /* lid shut: a soft downward curve with the outer flick */
      c.beginPath();
      c.moveTo(x - rx, y + 0.5);
      c.quadraticCurveTo(x, y + 1.6, x + rx, y + 0.5);
      stroke(c, LASH, 0.9);
      c.beginPath();
      c.moveTo(x + side * rx, y + 0.5);
      c.lineTo(x + side * (rx + 0.9), y);
      stroke(c, LASH, 0.6);
      return;
    }
    var top = y + ry - 2 * ry * open;   /* lid edge */
    c.save();
    ell(c, x, y, rx, ry, 0);
    c.fillStyle = '#fffdfb';
    c.fill();
    c.clip();
    if (open < 1) { c.beginPath(); c.rect(x - rx - 1, top, rx * 2 + 2, ry * 3); c.clip(); }
    var ix = x + side * 0.15 + gx * 0.75 * sq, iy = y + 0.35 + gy * 0.6;
    var g = c.createLinearGradient(0, iy - ry, 0, iy + ry);
    g.addColorStop(0, I.d);
    g.addColorStop(0.5, I.c);
    g.addColorStop(1, I.l);
    var ir = wide ? 0.78 : 0.84;
    ell(c, ix, iy, rx * ir, ry * 0.88 * (wide ? 0.92 : 1), 0);
    c.fillStyle = g;
    c.fill();
    /* limbal ring and a few radial flecks */
    c.lineWidth = 0.28;
    c.strokeStyle = 'rgba(40,8,24,0.55)';
    c.stroke();
    ell(c, ix, iy + 0.2, wide ? 0.75 : 1.0, wide ? 1.0 : 1.35, 0);
    c.fillStyle = '#1a0612';
    c.fill();
    /* lid shadow across the top of the eye */
    ell(c, x, top + ry * 0.05, rx * 1.3, ry * 0.62, 0);
    c.fillStyle = 'rgba(70,20,50,0.32)';
    c.fill();
    /* catchlights: Momoko's signature star, plus a small bounce */
    c.fillStyle = '#ffffff';
    var hx = x - side * 0.65 + gx * 0.3, hy = y - 0.9 + gy * 0.2;
    if (glint === 'heartEyes') {
      heartPath(c, hx, hy + 0.1, 1.2); c.fill();
    } else if (glint === 'sparkleEyes') {
      sparklePath(c, hx, hy, 1.7); c.fill();
      sparklePath(c, x + side * 1.0 + gx * 0.3, y - 1.9, 0.7); c.fill();
      ell(c, x - side * 1.1 + gx * 0.3, y + 1.9, 0.3, 0.3, 0); c.fill();
    } else {
      fillStar(c, hx, hy, 1.25);
    }
    ell(c, x + side * 0.85 + gx * 0.3, y + 1.5, 0.5, 0.42, 0);
    c.fill();
    c.restore();
    /* upper lash line rides the lid: heavy, thinning in, flicked out */
    c.save();
    c.translate(0, 2 * ry * (1 - open));
    c.beginPath();
    c.ellipse(x, y + 0.1, rx + 0.25, ry + 0.2, 0, side < 0 ? Math.PI * 1.04 : Math.PI * 1.22, side < 0 ? Math.PI * 1.78 : Math.PI * 1.96);
    stroke(c, LASH, 0.9);
    c.beginPath();
    c.moveTo(x + side * (rx - 0.1), y - ry * 0.55);
    c.quadraticCurveTo(x + side * (rx + 0.9), y - ry * 0.8, x + side * (rx + 1.3), y - ry * 1.05);
    stroke(c, LASH, 0.6);
    c.restore();
    /* lower lash hint */
    c.beginPath();
    c.ellipse(x, y + 0.1, rx * 0.8, ry * 0.95, 0, Math.PI * 0.35, Math.PI * 0.65);
    stroke(c, '#8a3a5a', 0.3, 0.6);
  }

  function drawBrow(c, x, y, side, lift, sq) {
    c.beginPath();
    c.moveTo(x - 1.4 * sq, y - lift * 0.4 + side * 0.15);
    c.quadraticCurveTo(x, y - 0.6 - lift, x + 1.4 * sq, y - lift * 0.4 - side * 0.15);
    stroke(c, 'rgba(90,30,50,0.55)', 0.42);
  }

  /* Face extras, painted on the skin inside the face clip, in the strip
     of cheek under her eyes: b1 / b2 are the cheek centres (near, far),
     far squeezes the far cheek with the head turn, mx is the nose line. */
  function sparklePath(c, x, y, r) {
    c.beginPath();
    c.moveTo(x, y - r);
    c.quadraticCurveTo(x + r * 0.16, y - r * 0.16, x + r, y);
    c.quadraticCurveTo(x + r * 0.16, y + r * 0.16, x, y + r);
    c.quadraticCurveTo(x - r * 0.16, y + r * 0.16, x - r, y);
    c.quadraticCurveTo(x - r * 0.16, y - r * 0.16, x, y - r);
    c.closePath();
  }
  function drawFacePaint(c, S, kind, b1, b2, far, mx) {
    var i, x1 = b1 + 1.9, x2 = b2 - 2.2 * far, cy = 17.35;
    if (kind === 'freckles') {
      c.fillStyle = mix(S.ink, '#b0603a', 0.5);
      c.globalAlpha = 0.8;
      var fk = [-1.0, 0.0, 0.25, -0.2, -0.45, 0.21, 0.6, 0.05, 0.25, 0.1, 0.5, 0.2];
      for (i = 0; i < fk.length; i += 3) {
        ell(c, x1 + fk[i], cy + fk[i + 1], fk[i + 2], fk[i + 2] * 0.9, 0); c.fill();
        ell(c, x2 - fk[i] * far, cy + fk[i + 1], fk[i + 2] * far, fk[i + 2] * 0.9, 0); c.fill();
      }
      ell(c, mx - 0.75, 15.5, 0.19, 0.18, 0); c.fill();
      ell(c, mx + 0.85, 15.7, 0.19, 0.18, 0); c.fill();
      c.globalAlpha = 1;
    } else if (kind === 'heartCheeks') {
      /* blush drawn as two rosy hearts */
      for (i = 0; i < 2; i++) {
        c.save();
        c.translate(i ? x2 : x1, cy); c.scale(i ? far : 1, 1); c.rotate(i ? 0.2 : -0.2);
        heartPath(c, 0, 0.05, 0.98); c.fillStyle = '#ff6f96'; c.fill();
        stroke(c, '#d8456e', 0.18, 0.8);
        gloss(c, -0.38, -0.38, 0.26, 0.16, -0.5, 0.9);
        c.restore();
      }
    } else if (kind === 'starSticker') {
      /* a puffy gold star sticker on the near cheek, a pink one on the far */
      for (i = 0; i < 2; i++) {
        c.save();
        c.translate(i ? x2 : x1 - 0.1, cy); c.scale(i ? far * 0.82 : 1, i ? 0.82 : 1); c.rotate(i ? 0.3 : -0.25);
        starPath(c, 0, 0, 1.32, 0.52); c.fillStyle = '#ffffff'; c.fill();
        starPath(c, 0, 0, 1.04, 0.52); c.fillStyle = i ? '#ff8fc0' : '#ffc82e'; c.fill();
        stroke(c, i ? '#d8508a' : '#c8862a', 0.16);
        gloss(c, -0.28, -0.34, 0.24, 0.14, -0.4, 0.95);
        c.restore();
      }
    } else if (kind === 'whiskers') {
      /* kitty face paint: three whiskers a side and a pink nose tip */
      c.beginPath();
      for (i = -1; i <= 1; i++) {
        c.moveTo(x1 + 0.9, cy - 0.1 + i * 0.42); c.lineTo(x1 - 1.9, cy - 0.3 + i * 0.95);
        c.moveTo(x2 - 0.9 * far, cy - 0.1 + i * 0.42); c.lineTo(x2 + 1.9 * far, cy - 0.3 + i * 0.95);
      }
      stroke(c, '#4a2030', 0.34, 0.9);
      c.beginPath();
      c.moveTo(mx - 0.8, 15.25); c.quadraticCurveTo(mx, 15.0, mx + 0.8, 15.25); c.quadraticCurveTo(mx, 16.45, mx - 0.8, 15.25);
      c.closePath();
      c.fillStyle = '#ff6f96'; c.fill();
      stroke(c, '#a8324e', 0.22);
      gloss(c, mx - 0.2, 15.38, 0.24, 0.12, 0, 0.85);
    } else if (kind === 'bandage') {
      /* a sticking plaster stuck slantwise on the near cheek */
      var T = ramp('#f4cfa6', true);
      c.save();
      c.translate(x1 - 0.1, cy); c.rotate(-0.42);
      c.beginPath();
      c.moveTo(-1.25, -0.6); c.lineTo(1.25, -0.6); c.quadraticCurveTo(1.85, 0, 1.25, 0.6);
      c.lineTo(-1.25, 0.6); c.quadraticCurveTo(-1.85, 0, -1.25, -0.6); c.closePath();
      c.fillStyle = T.c; c.fill();
      c.save(); c.clip(); c.fillStyle = T.m; c.fillRect(-2, 0.25, 4, 0.5); c.restore();
      stroke(c, T.ink, LW * 0.8, 0.9);
      c.fillStyle = '#fff6e6'; c.fillRect(-0.55, -0.6, 1.1, 1.2);
      c.fillStyle = T.ink; c.globalAlpha = 0.5;
      for (i = -1; i <= 1; i += 2) { ell(c, i * 1.1, 0, 0.12, 0.12, 0); c.fill(); }
      c.globalAlpha = 1;
      c.restore();
    }
  }

  /* expr: 'open' | 'happy' | 'sleep' | 'grin' | 'wide' | 'smile' */
  function drawFace(c, P, Z) {
    var S = P.skin, fx = Z.fx, expr = Z.expr;
    part(c, function () { facePath(c); }, S, 0.7, function () {
      c.save();
      c.translate(0.1, 1.1);
      capPath(c, fx);
      c.fillStyle = S.m;
      c.fill();
      c.restore();
      /* jaw shading on the side turned away */
      if (Z.look > 0.05) {
        c.globalAlpha = 0.35 * Z.look;
        ell(c, 22.4, 14.0, 2.2, 5.0, 0);
        c.fillStyle = S.m;
        c.fill();
        c.globalAlpha = 1;
      }
      var b1 = 8.4 + fx * 1.1, b2 = 19.6 + fx * 0.8, far = 1 - 0.2 * Z.look, fc = Z.face;
      if (fc !== 'heartCheeks') {
        ell(c, b1, 16.1, 2.4, 1.4, 0);
        c.fillStyle = P.blush;
        c.fill();
        ell(c, b2, 16.1, 2.4 * far, 1.4, 0);
        c.fill();
        c.beginPath();
        c.moveTo(b1 - 0.8, 16.6); c.lineTo(b1 - 0.2, 15.6);
        c.moveTo(b1 + 0.2, 16.6); c.lineTo(b1 + 0.8, 15.6);
        c.moveTo(b2 - 0.8, 16.6); c.lineTo(b2 - 0.2, 15.6);
        c.moveTo(b2 + 0.2, 16.6); c.lineTo(b2 + 0.8, 15.6);
        stroke(c, '#e0607e', 0.28, 0.5);
      }
      if (fc !== 'none') drawFacePaint(c, S, fc, b1, b2, far, 14 + fx * 1.05);
    });
    var eyeMode = expr === 'happy' || expr === 'grin' ? 'happy' : expr === 'sleep' ? 'sleep' : expr === 'wide' ? 'wide' : 'open';
    var sqN = 1 + 0.06 * Z.look, sqF = 1 - 0.16 * Z.look;
    drawEye(c, P.iris, Z.ex1, Z.ey, -1, eyeMode, sqN, Z.open, Z.gx, Z.gy, Z.face);
    drawEye(c, P.iris, Z.ex2, Z.ey, 1, eyeMode, sqF, Z.open, Z.gx, Z.gy, Z.face);
    if (eyeMode === 'open' || eyeMode === 'wide') {
      var lift = eyeMode === 'wide' ? 0.7 : 0;
      drawBrow(c, Z.ex1, Z.ey - 4.6, -1, lift, sqN);
      drawBrow(c, Z.ex2, Z.ey - 4.6, 1, lift, sqF);
    }
    var mx = 14 + fx * 1.05;
    /* nose: a single warm tick */
    c.beginPath();
    c.moveTo(mx + 0.3 + Z.look * 0.3, 15.4); c.lineTo(mx, 16.0);
    stroke(c, S.ink, 0.35, 0.55);
    if (expr === 'sleep') {
      c.beginPath();
      c.arc(mx, 17.0, 0.7, 0.2, Math.PI - 0.2);
      stroke(c, '#a8394e', 0.45);
    } else if (expr === 'wide') {
      ell(c, mx, 17.5, 0.75, 0.85, 0);
      c.fillStyle = '#93304a';
      c.fill();
      stroke(c, '#7a2238', 0.3);
    } else {
      var big = expr === 'grin' || expr === 'happy';
      var mw = (big ? 1.9 : 1.4) * (1 - 0.12 * Z.look);
      c.beginPath();
      c.moveTo(mx - mw, 16.7);
      c.quadraticCurveTo(mx, big ? 17.3 : 17.05, mx + mw, 16.7);
      c.quadraticCurveTo(mx, big ? 19.6 : 18.4, mx - mw, 16.7);
      c.closePath();
      c.fillStyle = '#93304a';
      c.fill();
      stroke(c, '#7a2238', 0.3);
      c.save();
      c.clip();
      ell(c, mx, big ? 19.0 : 18.1, big ? 1.2 : 0.9, 0.6, 0);
      c.fillStyle = '#f0788e';
      c.fill();
      if (big) { c.fillStyle = '#ffffff'; c.fillRect(mx - 1.6, 16.7, 3.2, 0.6); }
      c.restore();
    }
  }

  /* ================================================================
     LIMBS
     ================================================================ */

  /* A hand at the wrist (x, y) pointing along ang. mode: 'rest' (relaxed
     mitten with a thumb), 'open' (fingers spread), 'fist' (gripping). */
  function drawHand(c, S, x, y, ang, mode, side) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.scale(1, side);
    if (mode === 'open') {
      part(c, function () {
        c.beginPath();
        c.ellipse(0.95, 0, 1.0, 0.92, 0, 0, TAU);
        c.moveTo(2.9, -0.95); c.ellipse(2.2, -0.75, 0.75, 0.33, -0.35, 0, TAU);
        c.moveTo(3.0, -0.1); c.ellipse(2.35, -0.1, 0.78, 0.33, 0, 0, TAU);
        c.moveTo(2.85, 0.6); c.ellipse(2.2, 0.55, 0.7, 0.32, 0.35, 0, TAU);
        c.moveTo(1.2, 1.3); c.ellipse(0.75, 1.1, 0.68, 0.36, 0.9, 0, TAU);
      }, S, 0.4);
    } else if (mode === 'fist') {
      part(c, function () { ell(c, 1.0, 0.05, 1.15, 1.02, 0); }, S, 0.5, function () {
        c.beginPath();
        c.moveTo(1.7, -0.75); c.quadraticCurveTo(2.25, 0, 1.7, 0.75);
        c.moveTo(0.4, 0.55); c.quadraticCurveTo(1.0, 0.25, 1.6, 0.55);
        stroke(c, S.ink, LW * 0.7, 0.6);
      });
    } else {
      part(c, function () {
        c.beginPath();
        c.moveTo(-0.1, -0.72);
        c.bezierCurveTo(0.6, -1.05, 1.95, -1.0, 2.3, -0.2);
        c.bezierCurveTo(2.55, 0.5, 1.95, 0.92, 1.4, 0.82);
        c.bezierCurveTo(1.3, 1.32, 0.62, 1.42, 0.46, 0.94);
        c.bezierCurveTo(0.25, 0.84, -0.05, 0.8, -0.1, 0.7);
        c.closePath();
      }, S, 0.5, function () {
        c.beginPath();
        c.moveTo(1.55, -0.55); c.quadraticCurveTo(2.0, -0.35, 2.15, 0.1);
        stroke(c, S.ink, LW * 0.6, 0.45);
      });
    }
    c.restore();
  }

  /* Arm from the shoulder: a1 swings the upper arm (0 = hanging, + toward
     her facing), a2 bends the elbow. sleeve: null (bare), a ramp for a
     long sleeve with a cuff, or {wide: ramp} for a kimono sleeve. */
  var AG = { ex: 0, ey: 0, wx: 0, wy: 0, ang: 0 };
  function armGeom(sx, sy, a1, a2) {
    AG.ex = sx + Math.sin(a1) * 2.9;
    AG.ey = sy + Math.cos(a1) * 2.9;
    var t2 = a1 + a2;
    AG.wx = AG.ex + Math.sin(t2) * 2.6;
    AG.wy = AG.ey + Math.cos(t2) * 2.6;
    AG.ang = Math.atan2(AG.wy - AG.ey, AG.wx - AG.ex);
    return AG;
  }
  function drawArm(c, P, sx, sy, a1, a2, hand, side, sleeve, sway) {
    var g = armGeom(sx, sy, a1, a2);
    var ex = g.ex, ey = g.ey, wx = g.wx, wy = g.wy, ang = g.ang;
    var S = P.skin;
    if (sleeve && sleeve.wide) {
      /* kimono sleeve: the forearm shows, the sleeve hangs from the arm */
      part(c, function () { limbPath(c, sx, sy, ex, ey, wx, wy, 1.0, 0.8, 0.62, 0.62, 0.1); }, S, 0.6);
      drawHand(c, S, wx, wy, ang, hand, side);
      var R = sleeve.wide, sw = sway || 0;
      part(c, function () {
        c.beginPath();
        c.moveTo(sx - 1.4, sy - 0.6);
        c.lineTo(sx + 1.4, sy - 0.6);
        c.lineTo(ex + 1.5, ey + 0.2);
        c.quadraticCurveTo(ex + 1.6 + sw * 0.5, ey + 2.8, ex + 0.6 + sw, ey + 3.6);
        c.quadraticCurveTo(ex - 1.0 + sw * 0.8, ey + 3.9, ex - 1.7 + sw * 0.6, ey + 2.8);
        c.lineTo(ex - 1.4, ey - 0.2);
        c.closePath();
      }, R, 0.8, function () {
        c.fillStyle = R.d;
        c.globalAlpha = 0.5;
        c.fillRect(ex - 3, ey + 2.6, 7, 2);
        c.globalAlpha = 1;
        if (R.dots) { c.fillStyle = '#ffffff'; sakura(c, ex, ey + 1.4, 0.55); }
      });
      return g;
    }
    if (sleeve) {
      part(c, function () { limbPath(c, sx, sy, ex, ey, wx, wy, 1.3, 1.08, 0.98, 0.5, 0.06); }, sleeve, 0.8, function () {
        c.beginPath();
        c.moveTo(ex - 0.6, ey - 0.3); c.quadraticCurveTo(ex, ey + 0.4, ex + 0.7, ey - 0.2);
        stroke(c, sleeve.d, 0.35, 0.7);
      });
      var cuff = sleeve.cuff || sleeve;
      var cx = wx - Math.cos(ang) * 0.35, cy = wy - Math.sin(ang) * 0.35;
      part(c, function () { ell(c, cx, cy, 0.6, 1.15, ang); }, cuff, 0.4);
      drawHand(c, S, wx + Math.cos(ang) * 0.1, wy + Math.sin(ang) * 0.1, ang, hand, side);
      return g;
    }
    part(c, function () { limbPath(c, sx, sy, ex, ey, wx, wy, 1.02, 0.8, 0.6, 0.64, 0.1); }, S, 0.6, function () {
      /* elbow crease */
      c.beginPath();
      c.arc(ex, ey, 0.5, ang - 0.6, ang + 0.6);
      stroke(c, S.m, 0.3, 0.6);
    });
    drawHand(c, S, wx, wy, ang, hand, side);
    return g;
  }

  /* Leg from the hip to the ankle with the knee pushed forward when the
     leg is shorter than its rest length (IK), a calf, and a narrow
     ankle. R is skin, or cloth for pyjama legs. */
  var LEG = 5.3;
  function legKnee(hx, hy, ax, ay, fwd) {
    var dx = ax - hx, dy = ay - hy, d = Math.sqrt(dx * dx + dy * dy) || 1;
    var k = d < LEG ? Math.sqrt(LEG * LEG / 4 - d * d / 4) : 0;
    var nx = -dy / d, ny = dx / d;   /* perpendicular; +x side for a downward leg is -nx */
    if (nx * fwd < 0) { nx = -nx; ny = -ny; }
    return [(hx + ax) / 2 + nx * k, (hy + ay) / 2 + ny * k];
  }
  function drawLeg(c, R, hx, hy, ax, ay, fwd, cloth, sockR, frills) {
    var kn = legKnee(hx, hy, ax, ay, fwd);
    if (cloth) {
      part(c, function () { limbPath(c, hx, hy, kn[0], kn[1], ax, ay - 0.2, 1.75, 1.45, 1.3, 0.3, 0.1); }, R, 0.8, function () {
        c.beginPath();
        c.moveTo(kn[0] - 1.0, kn[1]); c.quadraticCurveTo(kn[0], kn[1] + 0.5, kn[0] + 1.0, kn[1] - 0.1);
        stroke(c, R.d, 0.35, 0.6);
      });
      return;
    }
    part(c, function () { limbPath(c, hx, hy, kn[0], kn[1], ax, ay, 1.4, 1.0, 0.66, 0.66, 0.24); }, R, 0.6, function () {
      gloss(c, kn[0] - 0.25, kn[1] + 0.2, 0.3, 0.6, 0, 0.35, R.l);
      if (sockR) {
        c.fillStyle = sockR.c;
        c.fillRect(ax - 3, ay - 1.0, 6, 3);
        c.fillStyle = sockR.m;
        c.fillRect(ax + 0.2, ay - 1.0, 3, 3);
      }
    });
    if (sockR && frills) {
      c.beginPath();
      for (var i = -1; i <= 1; i++) {
        c.moveTo(ax + i * 0.75 + 0.42, ay - 1.0);
        c.arc(ax + i * 0.75, ay - 1.0, 0.42, 0, Math.PI, true);
      }
      c.fillStyle = sockR.c;
      c.fill();
      stroke(c, sockR.ink, LW * 0.7, 0.8);
    }
  }

  /* Shoes, drawn in the foot's frame: ankle at (0,0), sole at y = 1.5,
     toe toward +x by tl (longer as she turns side-on), pitched by pr. */
  function drawShoe(c, P, style, x, y, tl, pr, ear) {
    var R = P.shoe;
    var fr = 1.4 + 1.5 * tl, bk = -1.75 + 0.25 * tl;
    c.save();
    c.translate(x, y);
    c.rotate(pr);
    if (style === 'flipper' || style === 'highBoot') {
      var tall = style === 'highBoot' ? 4.4 : 3.0;
      part(c, function () {
        c.beginPath();
        c.moveTo(-1.45, -tall);
        c.lineTo(1.45, -tall);
        c.lineTo(1.5, -0.6);
        c.quadraticCurveTo(fr + 0.2, -0.6, fr + 0.1, 0.6);
        c.quadraticCurveTo(fr, 1.5, fr - 0.8, 1.5);
        c.lineTo(bk - 0.1, 1.5);
        c.quadraticCurveTo(bk - 0.4, -0.6, -1.45, -1.2);
        c.closePath();
      }, R, 0.8, function () {
        c.fillStyle = R.d;
        c.fillRect(-4, 0.9, 9, 0.8);
        if (style === 'highBoot') {
          c.beginPath();
          c.moveTo(-0.7, -3.4); c.lineTo(0.7, -2.6); c.moveTo(0.7, -3.4); c.lineTo(-0.7, -2.6);
          c.moveTo(-0.7, -2.2); c.lineTo(0.7, -1.4); c.moveTo(0.7, -2.2); c.lineTo(-0.7, -1.4);
          stroke(c, R.l, 0.3);
          c.fillStyle = R.d;
          c.fillRect(bk - 0.2, 1.0, 1.4, 0.7);
        }
        if (style === 'flipper') {
          c.beginPath();
          c.moveTo(-1.6, -2.0); c.lineTo(1.6, -2.0);
          c.moveTo(-1.6, -1.1); c.quadraticCurveTo(0.4, -1.3, 1.7, -0.7);
          stroke(c, R.d, 0.26, 0.8);
          c.fillStyle = '#fff4a8';
          fillStar(c, 0.45, -1.55, 0.5);
        }
        gloss(c, -0.8, -tall * 0.5, 0.3, tall * 0.3, 0, 0.6, R.l);
        gloss(c, fr - 1.0, -0.1, 0.7, 0.3, -0.2, 0.7, R.l);
      });
      /* fold-over cuff */
      part(c, function () {
        c.beginPath();
        c.moveTo(-1.75, -tall - 0.4);
        c.quadraticCurveTo(0, -tall - 0.9, 1.75, -tall - 0.4);
        c.lineTo(1.6, -tall + 0.7);
        c.quadraticCurveTo(0, -tall + 0.3, -1.6, -tall + 0.7);
        c.closePath();
      }, style === 'highBoot' ? ramp(mix(R.c, '#ffffff', 0.6), false) : ramp(add(R.c, 20), false), 0.4);
    } else if (style === 'slipper') {
      /* fluffy bunny slipper: round body, two floppy ears, a pom nose */
      var fur = ramp(mix(R.c, '#ffffff', 0.55), false);
      var ea = ear || 0;
      for (var e = 0; e < 2; e++) {
        var ex = fr * 0.25 + (e ? 0.9 : -0.3), rot = (e ? 0.5 : 0.1) - ea * 0.25;
        part(c, function () { ell(c, ex - 0.6, -1.4 - 0.3 * e, 0.55, 1.5, -0.7 + rot); }, fur, 0.5, function () {
          ell(c, ex - 0.6, -1.4 - 0.3 * e, 0.22, 1.0, -0.7 + rot);
          c.fillStyle = '#ffb0c8';
          c.fill();
        });
      }
      part(c, function () {
        c.beginPath();
        c.moveTo(bk - 0.2, 1.5);
        c.bezierCurveTo(bk - 0.8, -1.2, fr + 0.3, -1.6, fr + 0.4, 0.6);
        c.quadraticCurveTo(fr + 0.4, 1.5, fr - 0.4, 1.5);
        c.closePath();
      }, fur, 0.8, function () {
        c.fillStyle = fur.d;
        c.fillRect(-4, 1.0, 9, 0.6);
        c.beginPath();
        for (var k = 0; k < 4; k++) { c.moveTo(bk + 0.5 + k * 1.0, -0.5); c.lineTo(bk + 0.7 + k * 1.0, 0.2); }
        stroke(c, fur.m, 0.3, 0.8);
      });
      ell(c, fr - 0.4, 0.2, 0.42, 0.38, 0);
      c.fillStyle = '#ff8fb0';
      c.fill();
      c.fillStyle = INK;
      ell(c, fr - 1.4, -0.4, 0.2, 0.24, 0); c.fill();
    } else if (style === 'ballet') {
      /* satin slipper, cut low, with ribbons crossed up the ankle */
      for (var rb2 = 0; rb2 < 2; rb2++) {
        c.beginPath();
        c.moveTo(-0.72, -0.5); c.lineTo(0.72, -1.7);
        c.moveTo(0.72, -0.5); c.lineTo(-0.72, -1.7);
        c.moveTo(-0.8, -2.25); c.lineTo(0.8, -2.25);
        stroke(c, rb2 ? R.c : R.ink, rb2 ? 0.36 : 0.36 + LW);
      }
      part(c, function () {
        c.beginPath();
        c.moveTo(bk + 0.1, 1.5);
        c.quadraticCurveTo(bk - 0.4, 0.0, -0.9, -0.5);
        c.quadraticCurveTo(0.2, 0.5, 1.2, 0.1);
        c.quadraticCurveTo(fr * 0.75, -0.2, fr + 0.15, 0.75);
        c.quadraticCurveTo(fr + 0.2, 1.5, fr - 0.6, 1.5);
        c.closePath();
      }, R, 0.7, function () {
        gloss(c, fr * 0.55, 0.45, 0.9, 0.26, -0.1, 0.85, R.l);
        c.fillStyle = R.d;
        c.fillRect(-4, 1.15, 9, 0.5);
      });
      drawBow(c, R, fr * 0.4, 0.3, 0.3, false);
    } else if (style === 'sandal') {
      /* bare foot on a cork sole, two straps and a flower */
      var SK = P.skin, cork = ramp('#d8a868', false);
      part(c, function () {
        c.beginPath();
        c.moveTo(bk + 0.2, 0.9);
        c.quadraticCurveTo(bk - 0.1, -0.7, -0.4, -0.9);
        c.quadraticCurveTo(fr * 0.6, -0.9, fr, 0.3);
        c.quadraticCurveTo(fr + 0.1, 0.9, fr - 0.5, 0.95);
        c.closePath();
      }, SK, 0.5, function () {
        c.beginPath();
        c.moveTo(fr - 0.75, 0.25); c.lineTo(fr - 0.6, 0.85);
        c.moveTo(fr - 1.2, 0.2); c.lineTo(fr - 1.1, 0.85);
        stroke(c, SK.ink, LW * 0.6, 0.5);
      });
      part(c, function () {
        c.beginPath();
        c.moveTo(bk - 0.1, 0.85); c.lineTo(fr + 0.25, 0.85);
        c.quadraticCurveTo(fr + 0.4, 1.6, fr - 0.3, 1.6);
        c.lineTo(bk, 1.6);
        c.quadraticCurveTo(bk - 0.4, 1.3, bk - 0.1, 0.85);
        c.closePath();
      }, cork, 0.3);
      c.beginPath();
      c.moveTo(fr * 0.38, -0.8); c.quadraticCurveTo(fr * 0.5, 0.1, fr * 0.42, 0.9);
      c.moveTo(-1.3, -0.75); c.quadraticCurveTo(0, -1.25, 1.1, -0.7);
      stroke(c, R.ink, 0.62 + LW);
      c.beginPath();
      c.moveTo(fr * 0.38, -0.8); c.quadraticCurveTo(fr * 0.5, 0.1, fr * 0.42, 0.9);
      c.moveTo(-1.3, -0.75); c.quadraticCurveTo(0, -1.25, 1.1, -0.7);
      stroke(c, R.c, 0.62);
      c.fillStyle = R.l;
      sakura(c, fr * 0.44, -0.05, 0.7);
      ell(c, fr * 0.44, -0.05, 0.22, 0.22, 0); c.fillStyle = '#ffd24a'; c.fill();
    } else if (style === 'roller') {
      /* roller skate: laced high-top on a plate with two wheels */
      var WH = ramp('#ffd24a', false), lift = -1.15;
      for (var wi = 0; wi < 2; wi++) {
        var wx = wi ? fr - 0.75 : bk + 0.7;
        part(c, function () { ell(c, wx, 0.75, 0.82, 0.82, 0); }, WH, 0.4, function () {
          ell(c, wx, 0.75, 0.3, 0.3, 0); c.fillStyle = '#ffffff'; c.fill();
        });
      }
      c.fillStyle = '#b8bcd0';
      c.fillRect(bk + 0.1, lift + 1.45, fr - bk - 0.2, 0.42);
      part(c, function () {
        c.beginPath();
        c.moveTo(-1.5, lift - 3.0);
        c.lineTo(1.45, lift - 3.0);
        c.lineTo(1.5, lift - 0.7);
        c.quadraticCurveTo(fr + 0.25, lift - 0.6, fr + 0.15, lift + 0.6);
        c.quadraticCurveTo(fr + 0.1, lift + 1.5, fr - 0.7, lift + 1.5);
        c.lineTo(bk, lift + 1.5);
        c.quadraticCurveTo(bk - 0.35, lift - 0.6, -1.5, lift - 1.2);
        c.closePath();
      }, R, 0.8, function () {
        c.fillStyle = '#ffffff';
        ell(c, fr - 0.35, lift + 0.75, 1.0, 0.85, 0); c.fill();
        c.fillRect(-4, lift + 1.0, 9, 0.6);
        c.beginPath();
        c.moveTo(0.3, lift - 2.5); c.lineTo(1.4, lift - 2.0);
        c.moveTo(0.3, lift - 1.7); c.lineTo(1.4, lift - 1.2);
        c.moveTo(0.5, lift - 0.9); c.lineTo(1.7, lift - 0.4);
        stroke(c, '#ffffff', 0.34);
        c.fillStyle = WH.c;
        fillStar(c, -0.55, lift - 1.3, 0.62);
        gloss(c, -1.0, lift - 2.3, 0.22, 0.6, 0, 0.5, R.l);
      });
      part(c, function () {
        c.beginPath();
        c.moveTo(-1.75, lift - 3.4); c.quadraticCurveTo(0, lift - 3.85, 1.7, lift - 3.4);
        c.lineTo(1.6, lift - 2.6); c.quadraticCurveTo(0, lift - 3.0, -1.65, lift - 2.6);
        c.closePath();
      }, ramp('#ffffff', false), 0.3);
    } else if (style === 'paw') {
      /* plush paw slipper: round toes, pink beans, a fluffy cuff */
      var PW = ramp(mix(R.c, '#ffffff', 0.45), false);
      part(c, function () {
        c.beginPath();
        c.moveTo(bk - 0.3, 1.5);
        c.bezierCurveTo(bk - 1.0, -1.0, -0.2, -1.5, 0.9, -1.2);
        c.quadraticCurveTo(fr * 0.5, -1.9, fr * 0.72, -0.9);
        c.quadraticCurveTo(fr + 0.2, -1.2, fr + 0.45, -0.1);
        c.quadraticCurveTo(fr + 0.9, 0.9, fr + 0.2, 1.5);
        c.closePath();
      }, PW, 0.8, function () {
        c.fillStyle = '#ff9fbf';
        ell(c, fr - 0.15, 0.55, 0.4, 0.34, 0.2); c.fill();
        ell(c, fr - 0.85, -0.3, 0.36, 0.32, 0); c.fill();
        ell(c, fr - 1.8, -0.75, 0.34, 0.3, -0.2); c.fill();
        ell(c, fr - 1.4, 0.55, 0.62, 0.5, 0); c.fill();
        c.fillStyle = PW.d;
        c.fillRect(-4, 1.1, 9, 0.5);
        gloss(c, -0.7, -0.7, 0.6, 0.25, -0.3, 0.6, PW.l);
      });
      part(c, function () {
        c.beginPath();
        c.moveTo(-1.9, -1.1);
        c.quadraticCurveTo(-1.5, -2.1, -0.7, -1.7); c.quadraticCurveTo(0, -2.3, 0.7, -1.7); c.quadraticCurveTo(1.5, -2.1, 1.9, -1.1);
        c.quadraticCurveTo(1.3, -0.5, 0.6, -0.8); c.quadraticCurveTo(0, -0.4, -0.6, -0.8); c.quadraticCurveTo(-1.3, -0.5, -1.9, -1.1);
        c.closePath();
      }, ramp('#ffffff', false), 0.3);
    } else if (style === 'sneaker') {
      part(c, function () {
        c.beginPath();
        c.moveTo(bk, 1.5);
        c.quadraticCurveTo(bk - 0.3, -1.2, -0.3, -1.4);
        c.quadraticCurveTo(fr * 0.55, -1.4, fr + 0.15, 0.3);
        c.quadraticCurveTo(fr + 0.4, 1.5, fr - 0.4, 1.5);
        c.closePath();
      }, R, 0.8, function () {
        c.fillStyle = '#ffffff';
        c.fillRect(-4, 0.75, 9, 0.9);
        c.fillStyle = 'rgba(120,100,140,0.5)';
        c.fillRect(-4, 1.35, 9, 0.3);
        ell(c, fr - 0.3, 0.3, 0.9, 0.7, 0);
        c.fillStyle = '#ffffff';
        c.fill();
        c.beginPath();
        c.moveTo(-0.5, -1.0); c.lineTo(0.6, -0.2);
        c.moveTo(0.3, -1.25); c.lineTo(1.4, -0.45);
        stroke(c, '#ffffff', 0.35);
      });
    } else {
      /* mary-jane: rounded toe, strap and a gold button */
      part(c, function () {
        c.beginPath();
        c.moveTo(bk, 1.5);
        c.quadraticCurveTo(bk - 0.45, -0.7, -0.2, -0.95);
        c.quadraticCurveTo(fr * 0.65, -1.15, fr + 0.1, 0.45);
        c.quadraticCurveTo(fr + 0.2, 1.5, fr - 0.6, 1.5);
        c.closePath();
      }, R, 0.8, function () {
        gloss(c, fr * 0.5, -0.45, 1.0, 0.33, -0.2, 0.85, R.l);
        c.fillStyle = R.d;
        c.fillRect(-4, 1.0, 9, 0.6);
        c.fillStyle = 'rgba(40,10,30,0.25)';
        c.fillRect(bk - 0.2, 1.0, 1.3, 0.6);
      });
      c.beginPath();
      c.moveTo(-1.5, -0.85); c.quadraticCurveTo(-0.2, -1.4, 1.0, -0.95);
      stroke(c, R.ink, 0.55);
      c.fillStyle = '#ffe07a';
      ell(c, 1.0, -0.95, 0.42, 0.42, 0);
      c.fill();
    }
    c.restore();
  }

  /* ================================================================
     OUTFITS
     ================================================================ */
  function sakura(c, x, y, r) {
    c.beginPath();
    for (var i = 0; i < 5; i++) {
      var a = -Math.PI / 2 + i * TAU / 5;
      c.moveTo(x + Math.cos(a) * r * 0.55 + r * 0.45, y + Math.sin(a) * r * 0.55);
      c.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.45, 0, TAU);
    }
    c.fill();
  }

  function skirtPath(c, sw, flare, hem) {
    var hl = 4.6 - flare + sw, hr = 23.4 + flare + sw, h = hem;
    c.beginPath();
    c.moveTo(9.3, 24.2);
    c.bezierCurveTo(7.6, 25.8, hl + 0.6, h - 2.2, hl, h);
    c.quadraticCurveTo(hl + 2.3, h + 1.0, hl + 4.7, h + 0.2);
    c.quadraticCurveTo(hl + 7.0, h + 1.1, 14 + sw, h + 0.3);
    c.quadraticCurveTo(hr - 7.0, h + 1.1, hr - 4.7, h + 0.2);
    c.quadraticCurveTo(hr - 2.3, h + 1.0, hr, h);
    c.bezierCurveTo(hr - 0.6, h - 2.2, 20.4, 25.8, 18.7, 24.2);
    c.closePath();
  }

  var HEM = 28.9;
  function drawSkirt(c, P, outfit, sw, flare, R) {
    var hl = 4.6 - flare + sw, hr = 23.4 + flare + sw, h = HEM;
    if (outfit === 'kimono') {
      part(c, function () {
        c.beginPath();
        c.moveTo(9.4, 24.0);
        c.bezierCurveTo(8.8, 27.0, 8.2 + sw * 0.4, 30.0, 8.0 + sw * 0.6, 31.6);
        c.quadraticCurveTo(14 + sw * 0.6, 32.3, 20.0 + sw * 0.6, 31.6);
        c.bezierCurveTo(19.8 + sw * 0.4, 30.0, 19.2, 27.0, 18.6, 24.0);
        c.closePath();
      }, R, 1.1, function () {
        c.beginPath();
        c.moveTo(16.8, 25.0); c.quadraticCurveTo(15.4 + sw * 0.3, 28.6, 13.0 + sw * 0.6, 32.0);
        stroke(c, R.ink, LW, 0.9);
        c.fillStyle = R.m;
        c.beginPath();
        c.moveTo(16.8, 25.0); c.quadraticCurveTo(15.4 + sw * 0.3, 28.6, 13.0 + sw * 0.6, 32.0);
        c.lineTo(11.6 + sw * 0.6, 32.0); c.quadraticCurveTo(14.4, 28.4, 15.6, 25.0);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.92)';
        sakura(c, 10.6 + sw * 0.4, 27.2, 0.8);
        sakura(c, 17.6 + sw * 0.4, 28.6, 0.7);
        sakura(c, 12.2 + sw * 0.5, 30.4, 0.65);
        sakura(c, 18.6 + sw * 0.5, 31.0, 0.55);
        c.fillStyle = 'rgba(255,200,220,0.9)';
        ell(c, 10.6 + sw * 0.4, 27.2, 0.22, 0.22, 0); c.fill();
        ell(c, 17.6 + sw * 0.4, 28.6, 0.2, 0.2, 0); c.fill();
      });
      return;
    }
    if (outfit === 'tutu') { drawTutu(c, P, sw, flare, R); return; }
    if (outfit === 'zookeeper') { drawShorts(c, sw, R); return; }
    if (outfit === 'princess') {
      /* floor-length gown: a pale underskirt showing through a parted overskirt */
      h = 31.0; hl -= 1.3; hr += 1.3;
      var U = P.sash;
      part(c, function () { skirtPath(c, sw, flare + 1.3, h); }, U, 1.2, function () {
        c.fillStyle = U.m;
        c.fillRect(0, h - 2.4, 28, 0.5);
        c.fillStyle = '#ffffff';
        c.globalAlpha = 0.85;
        for (var d = 0; d < 3; d++) {
          sparklePath(c, 12.4 + d * 1.6 + sw * 0.6, 26.6 + (d % 2) * 1.5, 0.5); c.fill();
        }
        c.globalAlpha = 1;
      });
      for (var pn = 0; pn < 2; pn++) {
        var q = pn ? -1 : 1, ox = pn ? 28 : 0;
        part(c, function () {
          c.beginPath();
          c.moveTo(ox + q * 9.3, 24.2);
          c.bezierCurveTo(ox + q * 7.6, 25.8, ox + q * (hl + 0.6) + (pn ? 2 * sw : 0), h - 2.2, ox + q * hl + (pn ? 2 * sw : 0), h);
          c.quadraticCurveTo(ox + q * (hl + 2.6) + (pn ? 2 * sw : 0), h + 1.1, ox + q * (hl + 5.6) + (pn ? 2 * sw : 0), h + 0.4);
          c.bezierCurveTo(ox + q * 11.6 + sw * 0.7, h - 3.0, ox + q * 12.4, 27.0, ox + q * 13.2, 24.4);
          c.closePath();
        }, R, 1.2, function () {
          c.fillStyle = R.m;
          c.beginPath();
          c.moveTo(ox + q * 10.6, 24.6); c.lineTo(ox + q * 6.4 + sw, h + 1); c.lineTo(ox + q * 8.2 + sw, h + 1); c.closePath();
          c.fill();
          c.fillStyle = GOLD.c;
          for (var e = 0; e < 3; e++) { fillStar(c, ox + q * (5.2 + e * 1.9) + sw, h - 1.0 - (e % 2) * 0.5, 0.45); }
        });
        c.beginPath();
        c.moveTo(ox + q * 13.2, 24.4);
        c.bezierCurveTo(ox + q * 12.4, 27.0, ox + q * 11.6 + sw * 0.7, h - 3.0, ox + q * (hl + 5.6) + (pn ? 2 * sw : 0), h + 0.4);
        stroke(c, GOLD.c, 0.5);
      }
      return;
    }
    if (outfit === 'bellhop') h = 28.2;
    if (outfit === 'frillyDress' || outfit === 'sailorDress' || outfit === 'maid') {
      /* petticoat lace peeking under the skirt */
      c.beginPath();
      c.moveTo(hl + 0.4, h - 0.4);
      for (var i = 0; i <= 8; i++) {
        var x = hl + 0.4 + (hr - hl - 0.8) * (i / 8);
        c.arc(x, h + 0.35, 0.85, Math.PI * 0.95, Math.PI * 0.05, true);
      }
      c.lineTo(hr - 0.4, h - 0.4);
      c.closePath();
      c.fillStyle = P.white.c;
      c.fill();
      stroke(c, P.white.ink, LW * 0.8, 0.8);
      c.beginPath();
      for (i = 0; i <= 8; i++) {
        var lx = hl + 0.4 + (hr - hl - 0.8) * (i / 8);
        c.moveTo(lx + 0.25, h + 0.65); c.arc(lx, h + 0.65, 0.25, 0, TAU);
      }
      c.fillStyle = P.white.m;
      c.fill();
    }
    part(c, function () { skirtPath(c, sw, flare, h); }, R, 1.2, function () {
      c.fillStyle = R.m;
      c.beginPath();
      c.moveTo(11.0, 24.6); c.lineTo(8.4 - flare * 0.5 + sw, h + 1); c.lineTo(10.2 - flare * 0.3 + sw, h + 1); c.closePath();
      c.moveTo(14.3, 24.6); c.lineTo(15.0 + sw, h + 1); c.lineTo(16.6 + sw, h + 1); c.closePath();
      c.moveTo(17.4, 24.6); c.lineTo(20.8 + flare * 0.5 + sw, h + 1); c.lineTo(22.6 + flare * 0.6 + sw, h + 1); c.closePath();
      c.fill();
      c.globalAlpha = 0.55;
      c.fillStyle = R.l;
      c.beginPath();
      c.moveTo(12.2, 24.6); c.lineTo(11.0 + sw, h + 1); c.lineTo(12.2 + sw, h + 1); c.closePath();
      c.fill();
      c.globalAlpha = 1;
      if (outfit === 'starDress') {
        c.fillStyle = '#ffd24a';
        fillStar(c, 8.0 + sw, h - 0.8, 0.9);
        fillStar(c, 12.0 + sw, h, 0.8);
        fillStar(c, 16.2 + sw, h - 1.2, 0.9);
        fillStar(c, 20.0 + sw, h - 0.1, 0.8);
        fillStar(c, 14.0 + sw * 0.5, h - 3.0, 0.6);
      } else if (outfit === 'sailorDress') {
        c.fillStyle = '#ffffff';
        c.fillRect(0, h - 0.4, 28, 0.55);
        c.fillRect(0, h - 1.4, 28, 0.35);
      } else if (outfit === 'bellhop') {
        c.fillStyle = GOLD.c;
        c.fillRect(0, h - 0.2, 28, 0.6);
      } else if (outfit === 'overalls') {
        /* front pocket with a heart, and stitching along the hem */
        c.fillStyle = R.m;
        c.fillRect(11.6 + sw * 0.4, 25.6, 4.8, 2.8);
        c.strokeStyle = R.l;
        c.lineWidth = 0.25;
        c.setLineDash([0.5, 0.4]);
        c.strokeRect(11.9 + sw * 0.4, 25.9, 4.2, 2.2);
        c.beginPath();
        c.moveTo(4, h - 0.5); c.lineTo(24, h - 0.5);
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = '#ff6f8e';
        heartPath(c, 14 + sw * 0.4, 27.0, 0.75);
        c.fill();
      }
    });
    if (outfit === 'starDress') {
      c.beginPath();
      c.moveTo(4.6 - flare + sw, h);
      c.quadraticCurveTo(14 + sw, h + 1.2, 23.4 + flare + sw, h);
      stroke(c, '#fff4c0', 0.6);
    } else if (outfit === 'maid') {
      drawApronSkirt(c, P, sw * 0.6, h);
    }
  }

  /* Ballet tutu: leotard briefs, then two stiff layers of tulle that
     stand out from the waist and bounce with her skirt spring. */
  function drawTutu(c, P, sw, flare, R) {
    part(c, function () {
      c.beginPath();
      c.moveTo(9.3, 24.4); c.lineTo(18.7, 24.4);
      c.quadraticCurveTo(19.0, 27.6, 14, 29.4);
      c.quadraticCurveTo(9.0, 27.6, 9.3, 24.4);
      c.closePath();
    }, R, 0.8);
    var layers = [ramp(mix(R.c, '#ffffff', 0.62), false), ramp(mix(R.c, '#ffffff', 0.25), false)];
    for (var k = 0; k < 2; k++) {
      var T = layers[k], ex = (k ? 0 : 1.2) + flare * 1.6, dy = k ? 0 : 0.9, lift = flare * 0.5;
      part(c, function () {
        c.beginPath();
        c.moveTo(9.4, 24.2);
        c.quadraticCurveTo(4.4 - ex + sw, 24.4 - lift, 2.2 - ex + sw, 26.4 + dy - lift);
        for (var i = 1; i <= 12; i++) {
          var x = 2.2 - ex + sw + (23.6 + 2 * ex) * (i / 12);
          var arc = Math.sin(Math.PI * (i - 0.5) / 12) * 1.5;
          c.lineTo(x - (23.6 + 2 * ex) / 24, 27.5 + dy + arc - lift * Math.abs(i - 6.5) / 6);
          c.lineTo(x, 26.6 + dy + Math.sin(Math.PI * i / 12) * 1.5 - lift * Math.abs(i - 6) / 6);
        }
        c.quadraticCurveTo(23.6 + ex + sw, 24.4 - lift, 18.6, 24.2);
        c.closePath();
      }, T, 0.9, function () {
        c.beginPath();
        for (var i = 1; i < 12; i++) {
          var x = 2.2 - ex + sw + (23.6 + 2 * ex) * (i / 12);
          c.moveTo(14 + (x - 14) * 0.45, 24.8); c.lineTo(x, 27.0 + dy + Math.sin(Math.PI * i / 12) * 1.3);
        }
        stroke(c, T.m, 0.25, 0.8);
        if (k) {
          c.fillStyle = '#ffffff';
          sparklePath(c, 7.0 + sw, 26.2, 0.55); c.fill();
          sparklePath(c, 12.2 + sw, 27.3, 0.45); c.fill();
          sparklePath(c, 17.8 + sw, 26.8, 0.55); c.fill();
          sparklePath(c, 22.0 + sw, 26.0, 0.4); c.fill();
        }
      });
    }
  }

  /* Zoo-keeper shorts with turned-up cuffs. */
  function drawShorts(c, sw, R) {
    var k = sw * 0.25;
    part(c, function () {
      c.beginPath();
      c.moveTo(9.2, 24.2); c.lineTo(18.8, 24.2);
      c.quadraticCurveTo(20.0, 26.4, 19.9 + k, 28.9);
      c.lineTo(14.7 + k, 29.2); c.lineTo(14, 27.4); c.lineTo(13.3 + k, 29.2);
      c.lineTo(8.1 + k, 28.9);
      c.quadraticCurveTo(8.0, 26.4, 9.2, 24.2);
      c.closePath();
    }, R, 1.0, function () {
      c.fillStyle = R.l;
      c.globalAlpha = 0.7;
      c.fillRect(7, 28.1, 14, 1.2);
      c.globalAlpha = 1;
      c.beginPath();
      c.moveTo(7, 28.1); c.lineTo(21, 28.1);
      c.moveTo(14, 25.4); c.lineTo(14, 27.4);
      stroke(c, R.d, 0.3, 0.9);
      c.beginPath();
      c.moveTo(9.6, 25.4); c.quadraticCurveTo(10.6, 26.6, 11.8, 26.6);
      c.moveTo(18.4, 25.4); c.quadraticCurveTo(17.4, 26.6, 16.2, 26.6);
      stroke(c, R.d, 0.28, 0.8);
    });
  }

  var KHAKI = ramp('#f2e4c0', false), LEATHER = ramp('#9a5f34', false);
  function bodicePath(c) {
    c.beginPath();
    c.moveTo(9.0, 20.6);
    c.quadraticCurveTo(14, 19.6, 19.0, 20.6);
    c.quadraticCurveTo(19.4, 22.6, 18.8, 24.9);
    c.lineTo(9.2, 24.9);
    c.quadraticCurveTo(8.6, 22.6, 9.0, 20.6);
    c.closePath();
  }

  function drawBodice(c, P, outfit, R, tx) {
    var white = P.white;
    var top = outfit === 'overalls' ? white : outfit === 'zookeeper' ? KHAKI : R;
    part(c, function () { bodicePath(c); }, top, 0.9, function () {
      ell(c, 14 + tx, 20.0, 3.4, 1.2, 0);
      c.fillStyle = top.d;
      c.globalAlpha = 0.6;
      c.fill();
      c.globalAlpha = 1;
      if (outfit === 'kimono') {
        c.fillStyle = 'rgba(255,255,255,0.9)';
        sakura(c, 10.6, 22.4, 0.6);
        sakura(c, 17.8, 21.6, 0.5);
      }
    });
    if (outfit === 'frillyDress') {
      part(c, function () {
        c.beginPath();
        c.moveTo(14 + tx, 20.4);
        c.bezierCurveTo(12.6 + tx, 20.0, 10.0 + tx, 19.8, 10.0 + tx, 21.0);
        c.bezierCurveTo(10.2 + tx, 22.4, 12.6 + tx, 22.6, 14 + tx, 21.4);
        c.bezierCurveTo(15.4 + tx, 22.6, 17.8 + tx, 22.4, 18.0 + tx, 21.0);
        c.bezierCurveTo(18.0 + tx, 19.8, 15.4 + tx, 20.0, 14 + tx, 20.4);
        c.closePath();
      }, white, 0.4);
      var hx = 14 + tx, hy = 22.5;
      c.fillStyle = '#ff4f74';
      heartPath(c, hx, hy, 0.95);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.85)';
      ell(c, hx - 0.5, hy - 0.4, 0.25, 0.2, 0);
      c.fill();
    } else if (outfit === 'sailorDress') {
      part(c, function () {
        c.beginPath();
        c.moveTo(9.4, 20.5); c.lineTo(14 + tx, 23.6); c.lineTo(18.6, 20.5);
        c.lineTo(17.0, 20.2); c.lineTo(14 + tx, 22.0); c.lineTo(11.0, 20.2);
        c.closePath();
      }, white, 0.3);
      c.beginPath();
      c.moveTo(10.2, 20.9); c.lineTo(14 + tx, 23.0); c.lineTo(17.8, 20.9);
      stroke(c, R.d, 0.35);
      part(c, function () {
        c.beginPath();
        c.moveTo(13.2 + tx, 23.0); c.lineTo(14.8 + tx, 23.0); c.lineTo(14.4 + tx, 24.6); c.lineTo(13.6 + tx, 24.6);
        c.closePath();
      }, white, 0.3);
    } else if (outfit === 'starDress') {
      drawBow(c, GOLD, 14 + tx, 21.2, 0.55, false);
      c.fillStyle = '#fff4a8';
      fillStar(c, 14 + tx, 23.5, 1.25);
    } else if (outfit === 'bellhop') {
      /* fitted jacket: mandarin collar, gold piping, double-breasted */
      part(c, function () {
        c.beginPath();
        c.moveTo(11.6 + tx, 19.9); c.lineTo(16.4 + tx, 19.9); c.lineTo(16.0 + tx, 21.0); c.lineTo(12.0 + tx, 21.0);
        c.closePath();
      }, white, 0.3);
      c.beginPath();
      c.moveTo(9.2, 21.0); c.quadraticCurveTo(14 + tx, 21.6, 18.8, 21.0);
      stroke(c, GOLD.c, 0.45);
      for (var b = 0; b < 3; b++) {
        for (var s = -1; s <= 1; s += 2) {
          var bx = 14 + tx + s * 1.5, by = 22.0 + b * 1.3;
          ell(c, bx, by, 0.42, 0.42, 0);
          c.fillStyle = GOLD.c; c.fill();
          stroke(c, GOLD.ink, 0.2);
          gloss(c, bx - 0.12, by - 0.14, 0.15, 0.1, 0, 0.9);
        }
      }
    } else if (outfit === 'overalls') {
      /* bib and straps over the blouse, with buttons */
      part(c, function () {
        c.beginPath();
        c.moveTo(10.6, 22.0); c.lineTo(17.4, 22.0); c.lineTo(18.4, 25.0); c.lineTo(9.6, 25.0);
        c.closePath();
      }, R, 0.6, function () {
        c.fillStyle = R.m;
        c.fillRect(12.4 + tx, 22.8, 3.2, 1.4);
      });
      c.beginPath();
      c.moveTo(10.9, 22.3); c.lineTo(9.6, 20.6);
      c.moveTo(17.1, 22.3); c.lineTo(18.4, 20.6);
      stroke(c, R.ink, 1.25);
      c.beginPath();
      c.moveTo(10.9, 22.3); c.lineTo(9.6, 20.6);
      c.moveTo(17.1, 22.3); c.lineTo(18.4, 20.6);
      stroke(c, R.c, 0.8);
      ell(c, 11.0, 22.4, 0.45, 0.45, 0); c.fillStyle = GOLD.c; c.fill(); stroke(c, GOLD.ink, 0.2);
      ell(c, 17.0, 22.4, 0.45, 0.45, 0); c.fill(); stroke(c, GOLD.ink, 0.2);
      /* blouse collar */
      part(c, function () {
        c.beginPath();
        c.moveTo(14 + tx, 20.6);
        c.quadraticCurveTo(12.0 + tx, 20.0, 11.2 + tx, 20.8);
        c.quadraticCurveTo(12.2 + tx, 21.8, 14 + tx, 21.2);
        c.quadraticCurveTo(15.8 + tx, 21.8, 16.8 + tx, 20.8);
        c.quadraticCurveTo(16.0 + tx, 20.0, 14 + tx, 20.6);
        c.closePath();
      }, white, 0.3);
    } else if (outfit === 'maid') {
      /* apron bib with ruffled shoulder straps, a round collar and a ribbon */
      part(c, function () {
        c.beginPath();
        c.moveTo(11.4 + tx, 21.6); c.lineTo(16.6 + tx, 21.6); c.lineTo(17.4, 24.4); c.lineTo(10.6, 24.4);
        c.closePath();
      }, white, 0.5, function () {
        c.beginPath();
        c.moveTo(11.9 + tx, 22.1); c.lineTo(16.1 + tx, 22.1);
        stroke(c, white.m, 0.25);
      });
      for (var ms = 0; ms < 2; ms++) {
        var mq = ms ? -1 : 1, mo = ms ? 28 : 0;
        part(c, function () {
          c.beginPath();
          c.moveTo(mo + mq * (11.6 + mq * tx), 21.8);
          c.quadraticCurveTo(mo + mq * 9.4, 20.0, mo + mq * 8.6, 20.6);
          c.quadraticCurveTo(mo + mq * 8.0, 21.6, mo + mq * 8.8, 22.2);
          c.quadraticCurveTo(mo + mq * 9.4, 21.4, mo + mq * 10.2, 22.4);
          c.quadraticCurveTo(mo + mq * 10.8, 21.8, mo + mq * (11.4 + mq * tx), 22.8);
          c.closePath();
        }, white, 0.3);
      }
      part(c, function () {
        c.beginPath();
        c.moveTo(14 + tx, 20.5);
        c.quadraticCurveTo(12.0 + tx, 19.9, 11.2 + tx, 20.7);
        c.quadraticCurveTo(12.2 + tx, 21.7, 14 + tx, 21.1);
        c.quadraticCurveTo(15.8 + tx, 21.7, 16.8 + tx, 20.7);
        c.quadraticCurveTo(16.0 + tx, 19.9, 14 + tx, 20.5);
        c.closePath();
      }, white, 0.3);
      drawBow(c, ramp('#e0405a', false), 14 + tx, 21.3, 0.42, false);
    } else if (outfit === 'princess') {
      /* sweetheart neckline, laced stomacher and a heart jewel */
      part(c, function () {
        c.beginPath();
        c.moveTo(12.2 + tx, 21.0); c.lineTo(15.8 + tx, 21.0); c.lineTo(15.0 + tx, 24.2); c.lineTo(13.0 + tx, 24.2);
        c.closePath();
      }, P.sash, 0.3, function () {
        c.beginPath();
        c.moveTo(12.6 + tx, 22.0); c.lineTo(15.2 + tx, 22.8);
        c.moveTo(15.4 + tx, 22.0); c.lineTo(12.8 + tx, 22.8);
        c.moveTo(12.9 + tx, 23.0); c.lineTo(15.0 + tx, 23.7);
        c.moveTo(15.1 + tx, 23.0); c.lineTo(13.0 + tx, 23.7);
        stroke(c, GOLD.c, 0.24);
      });
      c.beginPath();
      c.moveTo(9.4, 20.9);
      c.quadraticCurveTo(11.8 + tx, 20.3, 14 + tx, 21.5);
      c.quadraticCurveTo(16.2 + tx, 20.3, 18.6, 20.9);
      stroke(c, GOLD.ink, 0.75);
      c.beginPath();
      c.moveTo(9.4, 20.9);
      c.quadraticCurveTo(11.8 + tx, 20.3, 14 + tx, 21.5);
      c.quadraticCurveTo(16.2 + tx, 20.3, 18.6, 20.9);
      stroke(c, GOLD.c, 0.45);
      part(c, function () { heartPath(c, 14 + tx, 21.7, 0.8); }, ramp('#ff5a9a', false), 0.3, function () {
        gloss(c, 13.7 + tx, 21.4, 0.24, 0.16, -0.4, 0.95);
      });
    } else if (outfit === 'tutu') {
      /* leotard: scoop neck piped in white, a satin bow, a few sequins */
      c.beginPath();
      c.moveTo(10.2, 20.6); c.quadraticCurveTo(14 + tx, 23.0, 17.8, 20.6);
      c.lineTo(17.0, 20.4); c.quadraticCurveTo(14 + tx, 22.2, 11.0, 20.4);
      c.closePath();
      c.fillStyle = P.skin.c; c.fill();
      c.beginPath();
      c.moveTo(10.2, 20.6); c.quadraticCurveTo(14 + tx, 23.0, 17.8, 20.6);
      stroke(c, white.c, 0.42);
      drawBow(c, P.sash, 14 + tx, 22.4, 0.4, false);
      c.fillStyle = '#ffffff';
      sparklePath(c, 11.4, 23.2, 0.42); c.fill();
      sparklePath(c, 16.8, 23.4, 0.36); c.fill();
    } else if (outfit === 'zookeeper') {
      /* camp shirt: collar, button placket, a chest pocket with a paw
         patch, and a neckerchief in her colour */
      c.beginPath();
      c.moveTo(14 + tx, 21.2); c.lineTo(14 + tx * 0.9, 24.2);
      stroke(c, KHAKI.d, 0.3);
      c.fillStyle = LEATHER.c;
      ell(c, 14 + tx, 22.6, 0.26, 0.26, 0); c.fill();
      ell(c, 14 + tx, 23.6, 0.26, 0.26, 0); c.fill();
      part(c, function () { c.beginPath(); c.rect(15.3 + tx * 0.5, 22.0, 2.4, 1.9); }, KHAKI, 0.3, function () {
        c.fillStyle = KHAKI.m;
        c.fillRect(15.3 + tx * 0.5, 22.0, 2.4, 0.55);
        c.fillStyle = '#c8823a';
        ell(c, 16.5 + tx * 0.5, 23.3, 0.42, 0.34, 0); c.fill();
        ell(c, 16.0 + tx * 0.5, 22.85, 0.17, 0.17, 0); c.fill();
        ell(c, 16.5 + tx * 0.5, 22.72, 0.17, 0.17, 0); c.fill();
        ell(c, 17.0 + tx * 0.5, 22.85, 0.17, 0.17, 0); c.fill();
      });
      part(c, function () {
        c.beginPath();
        c.moveTo(10.4 + tx, 20.3); c.quadraticCurveTo(14 + tx, 19.5, 17.6 + tx, 20.3);
        c.lineTo(15.2 + tx, 21.8); c.lineTo(14 + tx, 21.2); c.lineTo(12.8 + tx, 21.8);
        c.closePath();
      }, R, 0.4, function () {
        c.fillStyle = '#ffffff';
        ell(c, 11.9 + tx, 20.7, 0.22, 0.22, 0); c.fill();
        ell(c, 16.1 + tx, 20.7, 0.22, 0.22, 0); c.fill();
        ell(c, 14 + tx, 20.3, 0.22, 0.22, 0); c.fill();
      });
      part(c, function () {
        c.beginPath();
        c.moveTo(13.4 + tx, 21.2); c.lineTo(14.6 + tx, 21.2); c.lineTo(15.0 + tx, 23.0); c.lineTo(14 + tx, 22.5); c.lineTo(13.0 + tx, 23.0);
        c.closePath();
      }, R, 0.3);
    } else if (outfit === 'kimono') {
      /* crossed collar: white under-collar, left over right */
      part(c, function () {
        c.beginPath();
        c.moveTo(11.4 + tx, 20.2); c.lineTo(15.6 + tx, 24.0); c.lineTo(14.4 + tx, 24.0); c.lineTo(10.4 + tx, 20.6);
        c.closePath();
        c.moveTo(16.6 + tx, 20.2); c.lineTo(13.2 + tx, 23.2); c.lineTo(12.6 + tx, 22.4); c.lineTo(15.6 + tx, 20.0);
        c.closePath();
      }, white, 0.3);
    }
    /* waist sash / obi */
    if (outfit === 'kimono') {
      var obi = ramp(mix(R.c, '#ffd24a', 0.6), false);
      part(c, function () {
        c.beginPath();
        c.moveTo(9.0, 23.2); c.lineTo(19.0, 23.2); c.lineTo(18.9, 25.8); c.lineTo(9.1, 25.8);
        c.closePath();
      }, obi, 0.4, function () {
        c.fillStyle = obi.m;
        c.fillRect(8, 24.3, 12, 0.5);
        c.fillStyle = '#ff6f8e';
        c.fillRect(8, 24.4, 12, 0.3);
      });
      /* bow peeking out at her back */
      c.save();
      c.translate(8.6, 24.4);
      part(c, function () {
        c.beginPath();
        c.moveTo(0.4, 0);
        c.bezierCurveTo(-0.8, -2.4, -2.8, -1.4, -2.4, 0.2);
        c.bezierCurveTo(-2.8, 1.8, -0.8, 2.4, 0.4, 0);
        c.closePath();
      }, obi, 0.5);
      c.restore();
    } else if (outfit !== 'overalls') {
      var sashR = outfit === 'starDress' || outfit === 'bellhop' || outfit === 'princess' ? GOLD
                : outfit === 'sailorDress' || outfit === 'maid' ? white : outfit === 'zookeeper' ? LEATHER : P.sash;
      part(c, function () {
        c.beginPath();
        c.moveTo(9.1, 24.0); c.lineTo(18.9, 24.0); c.lineTo(18.8, 25.2); c.lineTo(9.2, 25.2);
        c.closePath();
      }, sashR, 0.3);
      if (outfit === 'bellhop') {
        ell(c, 14 + tx, 24.6, 0.7, 0.5, 0);
        c.fillStyle = GOLD.d; c.fill();
      } else if (outfit === 'zookeeper') {
        part(c, function () { c.beginPath(); c.rect(13.1 + tx, 23.85, 1.8, 1.5); }, GOLD, 0.3, function () {
          c.fillStyle = LEATHER.d;
          c.fillRect(13.6 + tx, 24.3, 0.8, 0.6);
        });
      } else if (outfit === 'princess') {
        part(c, function () { ell(c, 14 + tx, 24.6, 0.95, 0.8, 0); }, ramp('#7ad0ff', false), 0.3, function () {
          gloss(c, 13.7 + tx, 24.35, 0.3, 0.18, -0.4, 0.95);
        });
      }
    }
  }

  function drawSleeve(c, x, y, R, frill) {
    part(c, function () { ell(c, x, y, 2.05, 1.75, 0); }, R, 0.8, function () {
      gloss(c, x - 0.5, y - 0.7, 0.9, 0.45, -0.3, 0.6, R.l);
      c.beginPath();
      c.moveTo(x - 0.6, y - 1.6); c.quadraticCurveTo(x - 0.9, y, x - 0.4, y + 1.6);
      c.moveTo(x + 0.7, y - 1.6); c.quadraticCurveTo(x + 1.0, y, x + 0.6, y + 1.6);
      stroke(c, R.m, 0.3, 0.7);
    });
    if (frill) {
      c.beginPath();
      c.moveTo(x - 1.8, y + 1.0);
      c.quadraticCurveTo(x, y + 2.3, x + 1.8, y + 1.0);
      stroke(c, frill, 0.55);
    }
  }

  /* ---- animal-pajama onesies ---- */
  var PJ = {
    frillyBikini: { body: null, limbs: null, belly: '#fffaf4', ears: 'bunny', tail: 'puff', mark: 'carrot', inner: '#ff9fbf' },
    sailorSwimsuit: { body: '#fafafa', hood: '#ffffff', limbs: '#1e1a20', belly: null, ears: 'panda', tail: 'none', mark: 'bamboo' },
    onePiece: { body: '#ffe6f5', hood: '#ffe6f5', limbs: '#e8d8ff', belly: null, ears: 'none', horn: true, tail: 'none', mark: 'rainbow' },
    catPjs: { body: '#c9c2d4', hood: '#c9c2d4', limbs: null, belly: '#fbf6ff', ears: 'cat', tail: 'cat', mark: 'paw', inner: '#ffb0c8' },
    bearPjs: { body: '#b07a4e', hood: '#b07a4e', limbs: null, belly: '#f0d2a8', ears: 'bear', tail: 'bear', mark: 'honey', inner: '#e8b888' },
    frogPjs: { body: '#7ccc58', hood: '#7ccc58', limbs: null, belly: '#e8f8b8', ears: 'frog', tail: 'none', mark: 'none' },
    penguinPjs: { body: '#2c2c44', hood: '#2c2c44', limbs: null, belly: '#ffffff', ears: 'penguin', tail: 'none', mark: 'bowtie' },
    dinoPjs: { body: '#56b884', hood: '#56b884', limbs: null, belly: '#ffeeb0', ears: 'dino', tail: 'dino', mark: 'none', inner: '#ff9a4a' },
    foxPjs: { body: '#ee8a3e', hood: '#ee8a3e', limbs: null, belly: '#fff6e8', ears: 'fox', tail: 'fox', mark: 'none', inner: '#fff0dc' },
    lionPjs: { body: '#f4c45c', hood: '#f4c45c', limbs: null, belly: '#fff2cc', ears: 'lion', tail: 'lion', mark: 'none', inner: '#c8702a' },
    sharkPjs: { body: '#6f9ed6', hood: '#6f9ed6', limbs: null, belly: '#ffffff', ears: 'shark', tail: 'shark', mark: 'none' }
  };
  /* Hoods whose crown is taken (horn, crest, spikes, fin): a hat perches
     to one side on these, on the crown on the others. */
  PJ.onePiece.crest = PJ.penguinPjs.crest = PJ.dinoPjs.crest = PJ.sharkPjs.crest = true;
  function pjBody(outfit, P) { return PJ[outfit].body ? ramp(PJ[outfit].body, false) : P.suit; }
  function pjLimb(outfit, P) { return PJ[outfit].limbs ? ramp(PJ[outfit].limbs, false) : pjBody(outfit, P); }
  function pjHood(outfit, P) { return PJ[outfit].hood ? ramp(PJ[outfit].hood, false) : ramp(mix(P.suit.c, '#fff4ee', 0.55), false); }

  function onesiePath(c) {
    c.beginPath();
    c.moveTo(9.0, 20.4);
    c.quadraticCurveTo(14, 19.5, 19.0, 20.4);
    c.quadraticCurveTo(20.2, 23.6, 19.9, 26.6);
    c.quadraticCurveTo(19.4, 28.8, 16.4, 29.0);
    c.quadraticCurveTo(14.6, 29.0, 14, 28.0);
    c.quadraticCurveTo(13.4, 29.0, 11.6, 29.0);
    c.quadraticCurveTo(8.6, 28.8, 8.1, 26.6);
    c.quadraticCurveTo(7.8, 23.6, 9.0, 20.4);
    c.closePath();
  }

  function drawOnesieTail(c, P, outfit, sw, w) {
    var T = PJ[outfit].tail, R = pjBody(outfit, P);
    if (T === 'cat') {
      part(c, function () {
        c.beginPath();
        c.moveTo(9.0, 26.6);
        c.bezierCurveTo(5.0 + sw * 0.3, 27.6, 3.0 + sw * 0.6, 26.0, 2.6 + sw * 0.9 + w * 0.3, 22.4);
        c.quadraticCurveTo(2.4 + sw + w * 0.3, 20.8, 3.6 + sw + w * 0.3, 21.0);
        c.quadraticCurveTo(4.2 + sw * 0.8, 21.4, 4.0 + sw * 0.7, 23.0);
        c.bezierCurveTo(4.2 + sw * 0.5, 25.2, 6.0, 25.6, 9.0, 25.0);
        c.closePath();
      }, R, 0.6, function () {
        c.fillStyle = R.d;
        c.fillRect(2, 20.6, 4, 1.4);
      });
    } else if (T === 'puff' || T === 'bear') {
      var pr = T === 'puff' ? ramp('#fffaf4', false) : R;
      part(c, function () { ell(c, 7.9 + sw * 0.15, 27.0, 1.8, 1.7, 0); }, pr, 0.6);
    } else if (T === 'fox') {
      /* big brush with a cream tip */
      var tipx = 1.2 + sw * 1.1 + w * 0.3;
      part(c, function () {
        c.beginPath();
        c.moveTo(9.0, 27.2);
        c.bezierCurveTo(5.4 + sw * 0.3, 29.4, 0.6 + sw * 0.7, 27.6, tipx - 0.8, 21.4);
        c.quadraticCurveTo(tipx - 0.2, 19.2, tipx + 0.9, 18.6);
        c.bezierCurveTo(tipx + 3.4, 20.4, 5.4 + sw * 0.4, 23.8, 9.0, 24.8);
        c.closePath();
      }, R, 0.9, function () {
        c.beginPath();
        c.moveTo(tipx - 2, 22.6);
        c.quadraticCurveTo(tipx - 0.2, 23.6, tipx + 0.6, 22.4);
        c.quadraticCurveTo(tipx + 1.6, 23.4, tipx + 3.4, 21.8);
        c.lineTo(tipx + 3, 17); c.lineTo(tipx - 3, 17);
        c.closePath();
        c.fillStyle = '#fff6e8'; c.fill();
        c.beginPath();
        c.moveTo(6.6, 25.2); c.quadraticCurveTo(4.6 + sw * 0.4, 25.8, 3.2 + sw * 0.7, 24.6);
        stroke(c, R.d, 0.35, 0.7);
      });
    } else if (T === 'dino') {
      /* stout tail with two back plates */
      var I = ramp(PJ[outfit].inner, false);
      for (var sp = 0; sp < 2; sp++) {
        var spx = 6.6 - sp * 2.4 + sw * (0.3 + sp * 0.3), spy = 24.5 + sp * 0.9;
        part(c, function () {
          c.beginPath();
          c.moveTo(spx - 1.0, spy + 0.6); c.lineTo(spx - 0.2, spy - 1.5); c.lineTo(spx + 1.0, spy + 0.3);
          c.closePath();
        }, I, 0.3);
      }
      part(c, function () {
        c.beginPath();
        c.moveTo(9.2, 24.6);
        c.bezierCurveTo(6.4 + sw * 0.3, 24.4, 3.6 + sw * 0.7, 25.6, 1.0 + sw * 1.1 + w * 0.3, 28.6);
        c.bezierCurveTo(4.2 + sw * 0.7, 28.8, 6.8 + sw * 0.3, 28.6, 9.2, 27.6);
        c.closePath();
      }, R, 0.8);
    } else if (T === 'lion') {
      /* a whip of a tail ending in a tuft */
      var lx = 3.0 + sw * 1.0 + w * 0.3, ly = 22.6;
      c.beginPath();
      c.moveTo(9.0, 27.0); c.bezierCurveTo(5.4, 28.4, 3.4 + sw * 0.5, 26.6, lx, ly);
      stroke(c, R.ink, 1.0 + LW * 2);
      c.beginPath();
      c.moveTo(9.0, 27.0); c.bezierCurveTo(5.4, 28.4, 3.4 + sw * 0.5, 26.6, lx, ly);
      stroke(c, R.c, 1.0);
      part(c, function () {
        c.beginPath();
        c.moveTo(lx - 1.3, ly + 0.6);
        c.quadraticCurveTo(lx - 1.7, ly - 1.6, lx - 0.3, ly - 2.9);
        c.quadraticCurveTo(lx + 0.1, ly - 1.9, lx + 1.0, ly - 2.3);
        c.quadraticCurveTo(lx + 1.7, ly - 0.6, lx + 0.9, ly + 0.8);
        c.closePath();
      }, ramp(PJ[outfit].inner, false), 0.5);
    } else if (T === 'shark') {
      /* tail fin: two swept lobes */
      part(c, function () {
        c.beginPath();
        c.moveTo(9.0, 25.6);
        c.quadraticCurveTo(6.0 + sw * 0.3, 25.4, 4.6 + sw * 0.6, 25.8);
        c.quadraticCurveTo(2.6 + sw * 0.9, 23.6, 1.6 + sw * 1.1 + w * 0.3, 21.0);
        c.quadraticCurveTo(4.6 + sw * 0.8, 22.6, 5.2 + sw * 0.6, 25.0);
        c.quadraticCurveTo(5.0 + sw * 0.6, 26.2, 5.2 + sw * 0.6, 27.0);
        c.quadraticCurveTo(4.2 + sw * 0.8, 28.6, 2.6 + sw * 1.0 - w * 0.2, 29.6);
        c.quadraticCurveTo(5.6 + sw * 0.6, 29.6, 9.0, 27.6);
        c.closePath();
      }, R, 0.7);
    }
  }

  function drawOnesie(c, P, outfit, tx) {
    var D = PJ[outfit], R = pjBody(outfit, P);
    part(c, function () { onesiePath(c); }, R, 1.0, function () {
      if (D.belly) {
        ell(c, 14 + tx * 0.8, 25.2, outfit === 'penguinPjs' ? 4.4 : 3.7, outfit === 'penguinPjs' ? 4.4 : 3.2, 0);
        c.fillStyle = D.belly;
        c.fill();
      }
      if (D.mark === 'bamboo') {
        c.fillStyle = '#1e1a20';
        c.fillRect(0, 19, 28, 1.6);
        c.fillStyle = '#5a8a38';
        c.fillRect(12.2 + tx, 23.0, 3.6, 3.8);
        c.fillStyle = '#8aba58';
        c.fillRect(13.0 + tx, 23.0, 0.55, 3.8);
        c.fillRect(14.4 + tx, 23.0, 0.55, 3.8);
      } else if (D.mark === 'rainbow') {
        var st = ['#ffb3d9', '#ffe6b3', '#d9ffb3', '#b3e6ff', '#d9b3ff'];
        for (var i = 0; i < 6; i++) {
          c.fillStyle = st[i % 5];
          c.fillRect(0, 20.4 + i * 1.6, 28, 1.6);
        }
        c.fillStyle = '#fff4a8';
        fillStar(c, 14 + tx, 24.4, 1.4);
      } else if (D.mark === 'carrot') {
        c.fillStyle = '#ff9944';
        c.beginPath(); c.moveTo(13.4 + tx, 24.2); c.lineTo(14.6 + tx, 24.2); c.lineTo(14 + tx, 26.6); c.closePath(); c.fill();
        c.fillStyle = '#3a8a38';
        c.fillRect(13.6 + tx, 23.5, 0.8, 0.8);
      } else if (D.mark === 'paw') {
        c.fillStyle = '#ffb0c8';
        ell(c, 14 + tx, 25.8, 1.0, 0.8, 0); c.fill();
        ell(c, 12.9 + tx, 24.6, 0.4, 0.45, 0); c.fill();
        ell(c, 14 + tx, 24.2, 0.4, 0.45, 0); c.fill();
        ell(c, 15.1 + tx, 24.6, 0.4, 0.45, 0); c.fill();
      } else if (D.mark === 'honey') {
        c.fillStyle = '#ffc93a';
        ell(c, 14 + tx, 25.4, 1.3, 1.4, 0); c.fill();
        c.fillStyle = '#c87a1a';
        c.fillRect(12.7 + tx, 24.2, 2.6, 0.5);
      } else if (D.mark === 'bowtie') {
        c.fillStyle = '#ff5a7a';
        c.beginPath();
        c.moveTo(14 + tx, 21.6); c.lineTo(12.4 + tx, 20.8); c.lineTo(12.4 + tx, 22.4); c.closePath();
        c.moveTo(14 + tx, 21.6); c.lineTo(15.6 + tx, 20.8); c.lineTo(15.6 + tx, 22.4); c.closePath();
        c.fill();
      }
      /* fabric shading at the side away from the light */
      c.fillStyle = 'rgba(74,36,112,0.16)';
      c.fillRect(18.2, 21, 2, 9);
      /* zip / placket line */
      c.beginPath();
      c.moveTo(14 + tx, 20.2); c.lineTo(14 + tx * 0.9, 22.6);
      stroke(c, R.d, 0.3, 0.6);
    });
    c.fillStyle = D.mark === 'bamboo' ? P.suit.c : '#ff99bb';
    ell(c, 11.4 + tx, 21.6, 0.5, 0.5, 0); c.fill();
    ell(c, 16.6 + tx, 21.6, 0.5, 0.5, 0); c.fill();
  }

  function drawHood(c, P, outfit, ear, ah) {
    var D = PJ[outfit], R = pjHood(outfit, P);
    var inner = D.inner || '#ff9fbf';
    if (D.ears === 'bunny') {
      for (var e = 0; e < 2; e++) {
        var ex = e ? 19.4 : 8.6, rot = (e ? 0.25 : -0.25) + ear * 0.12 + (e ? ear * 0.06 : 0);
        c.save();
        c.translate(ex, 0.6);
        c.rotate(rot);
        part(c, function () {
          c.beginPath();
          c.moveTo(-1.4, 0);
          c.bezierCurveTo(-2.6, -4.0, -1.8, -10.6, 0, -11.0);
          c.bezierCurveTo(1.8, -10.6, 2.6, -4.0, 1.4, 0);
          c.closePath();
        }, R, 0.8, function () {
          ell(c, 0, -5.0, 0.95, 4.4, 0);
          c.fillStyle = inner;
          c.fill();
        });
        c.restore();
      }
    } else if (D.ears === 'cat') {
      for (e = 0; e < 2; e++) {
        c.save();
        c.translate(e ? 20.6 : 7.4, 2.6);
        c.scale(e ? -1 : 1, 1);
        c.rotate(-0.2 + ear * 0.08 * (e ? -1 : 1) + (e ? 0 : 0));
        part(c, function () {
          c.beginPath();
          c.moveTo(-2.4, 1.2); c.quadraticCurveTo(-2.4, -3.0, -0.6, -4.6); c.quadraticCurveTo(1.0, -2.2, 2.6, 0.6);
          c.closePath();
        }, R, 0.7, function () {
          c.beginPath();
          c.moveTo(-1.5, 0.6); c.quadraticCurveTo(-1.5, -2.2, -0.6, -3.2); c.quadraticCurveTo(0.6, -1.6, 1.4, 0.2);
          c.closePath();
          c.fillStyle = inner;
          c.fill();
        });
        c.restore();
      }
    } else if (D.ears === 'bear' || D.ears === 'panda') {
      var ER = D.ears === 'panda' ? ramp('#1e1a20', false) : R;
      for (e = 0; e < 2; e++) {
        var bx = (e ? 21.4 : 6.6) + ear * 0.15, by = 2.0 - Math.abs(ear) * 0.05;
        part(c, function () { ell(c, bx, by, 2.9, 2.7, 0); }, ER, 0.8, function () {
          if (D.ears === 'bear') { ell(c, bx + (e ? -0.3 : 0.3), by + 0.4, 1.5, 1.4, 0); c.fillStyle = inner; c.fill(); }
        });
      }
    }
    else if (D.ears === 'fox') {
      var tipR = ramp('#5a3020', false);
      for (e = 0; e < 2; e++) {
        c.save();
        c.translate(e ? 20.8 : 7.2, 2.4);
        c.scale(e ? -1 : 1, 1);
        c.rotate(-0.28 + ear * 0.09 * (e ? -1 : 1));
        part(c, function () {
          c.beginPath();
          c.moveTo(-2.8, 1.4); c.quadraticCurveTo(-2.9, -4.4, -0.7, -7.4); c.quadraticCurveTo(1.6, -3.6, 3.0, 0.8);
          c.closePath();
        }, R, 0.8, function () {
          c.beginPath();
          c.moveTo(-1.7, 0.8); c.quadraticCurveTo(-1.8, -3.2, -0.7, -5.2); c.quadraticCurveTo(0.8, -2.6, 1.7, 0.4);
          c.closePath();
          c.fillStyle = inner; c.fill();
          c.beginPath();
          c.moveTo(-3, -4.6); c.lineTo(3, -5.6); c.lineTo(3, -9); c.lineTo(-3, -9);
          c.closePath();
          c.fillStyle = tipR.c; c.fill();
        });
        c.restore();
      }
    } else if (D.ears === 'lion') {
      /* mane: a ring of tufts round the hood, then two small round ears */
      var M = ramp(inner, false);
      part(c, function () {
        c.beginPath();
        for (var k = 0; k < 13; k++) {
          var a = Math.PI * (0.84 + k * 1.32 / 13), a2 = Math.PI * (0.84 + (k + 0.5) * 1.32 / 13), a3 = Math.PI * (0.84 + (k + 1) * 1.32 / 13);
          var rr = 14.0 + (k % 2 ? 0.7 : 0) + Math.abs(ear) * 0.15;
          if (k === 0) c.moveTo(14 + Math.cos(a) * 10.4, 9.8 + Math.sin(a) * 10.2);
          c.quadraticCurveTo(14 + Math.cos(a2 - 0.07) * rr, 9.8 + Math.sin(a2 - 0.07) * (rr - 0.3),
                             14 + Math.cos(a3) * 10.4, 9.8 + Math.sin(a3) * 10.2);
        }
        c.arc(14, 9.8, 9.0, Math.PI * 2.16, Math.PI * 0.84, true);
        c.closePath();
      }, M, 1.0, function () {
        c.beginPath();
        for (var k = 1; k < 13; k++) {
          var a = Math.PI * (0.84 + k * 1.32 / 13);
          c.moveTo(14 + Math.cos(a) * 10.2, 9.8 + Math.sin(a) * 10.0);
          c.lineTo(14 + Math.cos(a) * 11.4, 9.8 + Math.sin(a) * 11.2);
        }
        stroke(c, M.d, 0.4, 0.8);
      });
      for (e = 0; e < 2; e++) {
        var lx = (e ? 21.0 : 7.0) + ear * 0.15, ly = 1.6;
        part(c, function () { ell(c, lx, ly, 2.3, 2.2, 0); }, R, 0.7, function () {
          ell(c, lx + (e ? -0.2 : 0.2), ly + 0.4, 1.15, 1.1, 0); c.fillStyle = M.c; c.fill();
        });
      }
    } else if (D.ears === 'dino') {
      /* a row of back plates over the crown */
      var SPK = ramp(inner, false);
      for (e = 0; e < 4; e++) {
        var sx0 = 9.4 + e * 3.0, sy0 = 0.6 + Math.abs(e - 1.5) * 0.75;
        part(c, function () {
          c.beginPath();
          c.moveTo(sx0 - 1.5, sy0 + 0.8);
          c.quadraticCurveTo(sx0 - 0.6, sy0 - 1.6, sx0 + 0.3 + ear * 0.15, sy0 - 3.4);
          c.quadraticCurveTo(sx0 + 1.2, sy0 - 1.4, sx0 + 1.6, sy0 + 0.8);
          c.closePath();
        }, SPK, 0.5, function () { gloss(c, sx0 - 0.2, sy0 - 1.4, 0.3, 0.8, 0.2, 0.5, SPK.l); });
      }
    } else if (D.ears === 'shark') {
      /* dorsal fin, swept back */
      part(c, function () {
        c.beginPath();
        c.moveTo(11.4, 0.4);
        c.quadraticCurveTo(12.6, -3.6, 16.6 + ear * 0.25, -6.0);
        c.quadraticCurveTo(15.8, -2.4, 17.2, 0.4);
        c.closePath();
      }, R, 0.7, function () {
        c.beginPath();
        c.moveTo(13.2, -1.0); c.quadraticCurveTo(14.4, -2.8, 15.6, -4.2);
        stroke(c, R.l, 0.4, 0.6);
      });
    }
    part(c, function () {
      c.beginPath();
      c.moveTo(3.4, 16.4);
      c.bezierCurveTo(1.6, 6.0, 7.0, -0.6, 14, -0.6);
      c.bezierCurveTo(21.0, -0.6, 26.4, 6.0, 24.6, 16.4);
      c.quadraticCurveTo(23.2, 18.4, 21.4, 18.2);
      c.bezierCurveTo(23.6, 11.4, 21.0, 4.0, 14, 4.0);
      c.bezierCurveTo(7.0, 4.0, 4.4, 11.4, 6.6, 18.2);
      c.quadraticCurveTo(4.8, 18.4, 3.4, 16.4);
      c.closePath();
    }, R, 1.0, function () {
      c.beginPath();
      c.moveTo(6.6, 18.2);
      c.bezierCurveTo(4.4, 11.4, 7.0, 4.0, 14, 4.0);
      c.bezierCurveTo(21.0, 4.0, 23.6, 11.4, 21.4, 18.2);
      stroke(c, R.d, 1.3, 0.6);
      gloss(c, 8.4, 2.4, 2.4, 0.9, -0.5, 0.45, R.l);
      if (outfit === 'catPjs') {
        c.beginPath();
        c.moveTo(12.4, 0.0); c.lineTo(12.8, 1.8);
        c.moveTo(14.0, -0.4); c.lineTo(14.0, 1.6);
        c.moveTo(15.6, 0.0); c.lineTo(15.2, 1.8);
        stroke(c, R.d, 0.55, 0.8);
      }
    });
    if (D.ears === 'frog') {
      for (e = 0; e < 2; e++) {
        var fx = e ? 19.6 : 8.4, fy = 0.4 - Math.abs(ear) * 0.1;
        part(c, function () { ell(c, fx, fy, 2.6, 2.4, 0); }, R, 0.8, function () {
          ell(c, fx, fy - 0.2, 1.7, 1.6, 0);
          c.fillStyle = '#ffffff';
          c.fill();
          ell(c, fx + 0.3, fy - 0.1, 0.8, 1.0, 0);
          c.fillStyle = INK;
          c.fill();
          ell(c, fx - 0.1, fy - 0.6, 0.3, 0.3, 0);
          c.fillStyle = '#ffffff';
          c.fill();
        });
      }
    } else if (D.ears === 'penguin') {
      part(c, function () {
        c.beginPath();
        c.moveTo(12.2, 3.4); c.quadraticCurveTo(14, 2.6, 15.8, 3.4); c.lineTo(14, 5.4);
        c.closePath();
      }, ramp('#ffa53a', false), 0.4);
      part(c, function () {
        c.beginPath();
        c.moveTo(13.4, -0.4); c.quadraticCurveTo(13.8 + ah * 0.4, -2.6, 15.4 + ah, -2.8);
        c.quadraticCurveTo(14.6, -1.6, 14.8, -0.4);
        c.closePath();
      }, R, 0.4);
    }
    if (D.ears === 'dino' || D.ears === 'shark') {
      /* a face on the hood: teeth along the brim, eyes up on the crown */
      c.beginPath();
      for (e = 0; e < 7; e++) {
        var tu = (e + 0.5) / 7, ta = Math.PI * (1.2 + 0.6 * tu);
        var tx0 = 14 + Math.cos(ta) * 8.0, ty0 = 11.4 + Math.sin(ta) * 7.5;
        var tn = D.ears === 'shark' ? 1.5 : 1.15;
        c.moveTo(tx0 - 0.7, ty0 - 0.25);
        c.lineTo(tx0 + (14 - tx0) * 0.06, ty0 + tn);
        c.lineTo(tx0 + 0.7, ty0 - 0.25);
        c.closePath();
      }
      c.fillStyle = '#ffffff'; c.fill();
      stroke(c, R.ink, LW * 0.7, 0.8);
      for (e = 0; e < 2; e++) {
        var ex0 = e ? 19.6 : 8.4;
        ell(c, ex0, 2.6, 1.05, 1.15, 0); c.fillStyle = '#ffffff'; c.fill(); stroke(c, R.ink, LW * 0.6, 0.8);
        ell(c, ex0 + 0.2, 2.8, 0.55, 0.65, 0); c.fillStyle = INK; c.fill();
        ell(c, ex0, 2.5, 0.2, 0.2, 0); c.fillStyle = '#ffffff'; c.fill();
      }
      if (D.ears === 'shark') {
        c.beginPath();
        for (e = 0; e < 3; e++) { c.moveTo(4.6 + e * 0.5, 9.0 + e * 1.3); c.lineTo(6.0 + e * 0.4, 8.6 + e * 1.3); }
        stroke(c, R.d, 0.4, 0.9);
      } else {
        ell(c, 12.9, 1.2, 0.3, 0.2, 0.3); c.fillStyle = R.d; c.fill();
        ell(c, 15.1, 1.2, 0.3, 0.2, -0.3); c.fill();
      }
    }
    if (D.horn) {
      part(c, function () {
        c.beginPath();
        c.moveTo(12.2, 0.6); c.lineTo(14.2 + ah * 0.3, -9.6); c.lineTo(16.0, 0.6);
        c.closePath();
      }, ramp('#ffd24a', false), 0.6, function () {
        c.beginPath();
        c.moveTo(12.8, -1.4); c.lineTo(15.4, -2.4);
        c.moveTo(13.2, -4.2); c.lineTo(15.0, -5.0);
        c.moveTo(13.6, -6.8); c.lineTo(14.6, -7.2);
        stroke(c, '#ff99cc', 0.5);
      });
      /* a little pastel mane tuft behind the horn */
      part(c, function () {
        c.beginPath();
        c.moveTo(16.4, 0.2);
        c.quadraticCurveTo(19.0 + ear * 0.3, -0.8, 20.6 + ear * 0.6, 1.4);
        c.quadraticCurveTo(18.6, 0.8, 17.4, 1.8);
        c.closePath();
      }, ramp('#c8a8ff', false), 0.5);
    }
  }

  /* ================================================================
     ACCESSORIES
     ================================================================ */
  var CAP_RED = ramp('#c8283c', false), STRAW = ramp('#f2d48c', false), PITH = ramp('#e0c890', false),
      TOQUE = ramp('#fff8f4', false);
  /* A gold-set jewel: round or heart, with a facet and a hot spot. */
  function gem(c, x, y, r, hex, heart) {
    var G = ramp(hex, false);
    part(c, function () { if (heart) heartPath(c, x, y, r); else ell(c, x, y, r, r * 0.92, 0); }, G, 0.3, function () {
      c.beginPath();
      c.moveTo(x - r, y + r * 0.1); c.lineTo(x, y + r * 0.2); c.lineTo(x + r, y - r * 0.2);
      stroke(c, G.l, r * 0.22, 0.7);
      gloss(c, x - r * 0.35, y - r * 0.4, r * 0.3, r * 0.2, -0.4, 0.95);
    });
  }
  /* Where a hat sits. Bare-headed, the origin is the top of her skull.
     Over a onesie hood a hat is worn a size down, on the crown of the
     hood, or perched to one side when the hood has a horn, crest or fin. */
  function hatFrame(c, hood, Z) {
    if (!hood) { c.translate(14 + Z.fx * 0.5, 3.4); return; }
    if (hood.crest) { c.translate(19.7 + Z.fx * 0.3, 1.1); c.rotate(0.5); c.scale(0.72, 0.72); }
    else { c.translate(14 + Z.fx * 0.3, -0.5); c.scale(0.8, 0.8); }
  }
  /* Bands, garlands and ears follow the curve of the head, or of the hood. */
  function bandFrame(c, hood, Z) {
    c.translate(Z.fx * 0.4, 0);
    if (hood) { c.translate(14, 11.2); c.scale(1.15, 1.17); c.translate(-14, -11.2); }
  }

  /* The part of a hat that shows behind her head (the sun hat is worn
     pushed back, so its brim frames her like a halo). */
  function drawHatBack(c, P, hat, hood, Z) {
    if (hat !== 'strawHat') return;
    c.save();
    c.translate(14 + Z.fx * 0.3, hood ? 0.6 : 3.4);
    if (hood) c.scale(1.12, 1.12);
    part(c, function () { ell(c, 0, 0.4, 13.2, 5.9, -0.03); }, STRAW, 1.2, function () {
      ell(c, 0.4, 2.6, 10.6, 5.0, 0);
      c.fillStyle = STRAW.d; c.globalAlpha = 0.4; c.fill(); c.globalAlpha = 1;
      c.beginPath();
      c.ellipse(0, 0.4, 11.4, 4.9, -0.03, 0, TAU);
      c.moveTo(9.6, 0.4); c.ellipse(0, 0.4, 9.6, 3.9, -0.03, 0, TAU);
      stroke(c, STRAW.m, 0.3, 0.8);
      c.beginPath();
      for (var i = 0; i < 16; i++) {
        var a = Math.PI + (i + 0.5) * Math.PI / 16;
        c.moveTo(Math.cos(a) * 7.4, 0.4 + Math.sin(a) * 3.0); c.lineTo(Math.cos(a) * 13.0, 0.4 + Math.sin(a) * 5.7);
      }
      stroke(c, STRAW.m, 0.22, 0.6);
      c.beginPath();
      c.ellipse(0, 0.4, 12.6, 5.5, -0.03, Math.PI * 1.1, Math.PI * 1.5);
      stroke(c, STRAW.l, 0.45, 0.8);
    });
    part(c, function () {
      c.beginPath();
      c.moveTo(-7.5, 0.8);
      c.bezierCurveTo(-7.8, -5.6, -4.3, -7.6, 0, -7.6);
      c.bezierCurveTo(4.3, -7.6, 7.8, -5.6, 7.5, 0.8);
      c.closePath();
    }, STRAW, 1.1, function () {
      c.beginPath();
      for (var i = 0; i < 4; i++) { c.moveTo(-7, -5.4 + i * 1.2); c.quadraticCurveTo(0, -7.0 + i * 1.2, 7, -5.4 + i * 1.2); }
      stroke(c, STRAW.m, 0.24, 0.8);
      gloss(c, -2.8, -5.2, 1.6, 0.6, -0.3, 0.45, STRAW.l);
    });
    part(c, function () {
      c.beginPath();
      c.moveTo(-7.62, -1.9); c.quadraticCurveTo(0, -3.3, 7.62, -1.9);
      c.lineTo(7.52, 0.8); c.quadraticCurveTo(0, -0.7, -7.52, 0.8);
      c.closePath();
    }, P.suit, 0.5, function () {
      c.beginPath();
      c.moveTo(-7.6, -1.2); c.quadraticCurveTo(0, -2.6, 7.6, -1.2);
      stroke(c, P.suit.l, 0.3, 0.7);
    });
    c.restore();
  }

  function drawHat(c, P, hat, hood, Z) {
    var fx = Z.fx, tw = Z.charm, i;
    c.save();
    if (hat === 'hotelCap') {
      /* bellhop pillbox worn at a tilt: gold braid, a top button and a
         tassel that swings */
      hatFrame(c, hood, Z);
      c.translate(1.9, 0.3);
      c.rotate(0.17);
      part(c, function () {
        c.beginPath();
        c.moveTo(-4.7, 0.6);
        c.lineTo(-4.4, -4.0);
        c.quadraticCurveTo(0, -5.1, 4.4, -4.0);
        c.lineTo(4.7, 0.6);
        c.quadraticCurveTo(0, 2.0, -4.7, 0.6);
        c.closePath();
      }, CAP_RED, 1.0, function () {
        c.beginPath();
        c.moveTo(-4.8, -0.35); c.quadraticCurveTo(0, 1.05, 4.8, -0.35);
        stroke(c, GOLD.d, 1.25);
        c.beginPath();
        c.moveTo(-4.8, -0.45); c.quadraticCurveTo(0, 0.95, 4.8, -0.45);
        stroke(c, GOLD.c, 0.95);
        c.beginPath();
        c.moveTo(-4.8, -0.75); c.quadraticCurveTo(0, 0.65, 4.8, -0.75);
        stroke(c, GOLD.l, 0.28);
        c.beginPath();
        c.moveTo(-4.6, -2.3); c.quadraticCurveTo(0, -1.0, 4.6, -2.3);
        stroke(c, GOLD.c, 0.3);
        gloss(c, -2.6, -2.5, 0.6, 1.5, 0.05, 0.4, CAP_RED.l);
      });
      part(c, function () { ell(c, 0, -4.3, 4.4, 1.15, 0); }, ramp('#de4054', false), 0.5, function () {
        ell(c, 0, -4.3, 3.2, 0.72, 0);
        stroke(c, GOLD.c, 0.26);
      });
      c.beginPath();
      c.moveTo(0.5, -4.5); c.quadraticCurveTo(4.6, -4.9, 5.4 + tw * 0.35, -1.9);
      stroke(c, GOLD.ink, 0.5);
      c.beginPath();
      c.moveTo(0.5, -4.5); c.quadraticCurveTo(4.6, -4.9, 5.4 + tw * 0.35, -1.9);
      stroke(c, GOLD.c, 0.26);
      part(c, function () {
        c.beginPath();
        c.moveTo(5.0 + tw * 0.35, -2.0); c.lineTo(5.8 + tw * 0.35, -2.0);
        c.lineTo(6.3 + tw * 0.55, 0.2); c.lineTo(4.7 + tw * 0.55, 0.2);
        c.closePath();
      }, GOLD, 0.3, function () {
        c.beginPath();
        c.moveTo(5.2 + tw * 0.5, -1.2); c.lineTo(5.1 + tw * 0.55, 0.2);
        c.moveTo(5.7 + tw * 0.5, -1.2); c.lineTo(5.9 + tw * 0.55, 0.2);
        stroke(c, GOLD.d, 0.2);
      });
      part(c, function () { ell(c, 0, -4.55, 0.9, 0.62, 0); }, GOLD, 0.3, function () {
        gloss(c, -0.25, -4.75, 0.3, 0.16, 0, 0.95);
      });
    } else if (hat === 'bigBow') {
      /* a great satin bow across the crown, spotted, with swinging tails */
      hatFrame(c, hood, Z);
      c.translate(0, -0.6);
      var B = P.suit;
      for (i = -1; i <= 1; i += 2) {
        part(c, function () {
          c.beginPath();
          c.moveTo(i * 0.2, 0.6);
          c.quadraticCurveTo(i * 2.4 + tw * 0.4, 2.2, i * 4.0 + tw * 0.9, 5.2);
          c.lineTo(i * 2.9 + tw * 0.8, 4.5); c.lineTo(i * 2.2 + tw * 0.8, 5.6);
          c.quadraticCurveTo(i * 1.4 + tw * 0.3, 3.0, i * -0.4, 1.0);
          c.closePath();
        }, B, 0.7);
      }
      for (i = -1; i <= 1; i += 2) {
        c.save();
        c.scale(i, 1);
        part(c, function () {
          c.beginPath();
          c.moveTo(0, 0);
          c.bezierCurveTo(1.6, -4.8, 7.6, -4.6, 7.0, 0.2);
          c.bezierCurveTo(6.6, 3.4, 2.0, 2.4, 0, 0);
          c.closePath();
        }, B, 1.0, function () {
          c.fillStyle = B.m;
          c.beginPath();
          c.moveTo(0, 0); c.quadraticCurveTo(2.6, -1.6, 4.4, -1.4); c.quadraticCurveTo(2.8, 0.2, 4.0, 1.4); c.quadraticCurveTo(1.6, 1.2, 0, 0);
          c.fill();
          c.fillStyle = '#ffffff';
          c.globalAlpha = 0.85;
          ell(c, 5.2, -2.0, 0.5, 0.5, 0); c.fill();
          ell(c, 5.9, 0.4, 0.45, 0.45, 0); c.fill();
          ell(c, 3.4, -3.0, 0.42, 0.42, 0); c.fill();
          ell(c, 4.4, 1.9, 0.38, 0.38, 0); c.fill();
          c.globalAlpha = 1;
          c.beginPath();
          c.moveTo(1.6, -2.6); c.quadraticCurveTo(3.8, -4.0, 5.8, -3.2);
          stroke(c, B.l, 0.6, 0.7);
        });
        c.restore();
      }
      part(c, function () {
        c.beginPath();
        c.moveTo(-1.2, -1.5); c.quadraticCurveTo(0, -1.9, 1.2, -1.5);
        c.quadraticCurveTo(1.7, 0, 1.2, 1.6); c.quadraticCurveTo(0, 2.0, -1.2, 1.6);
        c.quadraticCurveTo(-1.7, 0, -1.2, -1.5);
        c.closePath();
      }, B, 0.6, function () {
        c.beginPath();
        c.moveTo(-0.5, -1.4); c.quadraticCurveTo(-0.8, 0, -0.5, 1.5);
        c.moveTo(0.5, -1.4); c.quadraticCurveTo(0.8, 0, 0.5, 1.5);
        stroke(c, B.d, 0.25, 0.7);
        gloss(c, -0.1, -0.7, 0.4, 0.3, 0, 0.5, B.l);
      });
    } else if (hat === 'hairClips') {
      /* two enamel clips in her fringe: a star and a heart on gold pins */
      c.translate(fx * 0.6, 0);
      for (i = 0; i < 2; i++) {
        c.save();
        c.translate(19.0 + i * 1.9, 6.4 + i * 2.7);
        c.rotate(-0.5);
        c.beginPath();
        c.moveTo(-2.4, 0); c.lineTo(2.2, 0);
        stroke(c, GOLD.ink, 0.95);
        c.beginPath();
        c.moveTo(-2.4, 0); c.lineTo(2.2, 0);
        stroke(c, GOLD.c, 0.55);
        c.beginPath();
        c.moveTo(-2.2, -0.12); c.lineTo(1.0, -0.12);
        stroke(c, GOLD.l, 0.18);
        c.rotate(0.7);
        if (i) gem(c, 0.4, 0, 1.25, '#6fc0ff', true);
        else part(c, function () { starPath(c, 0.4, 0, 1.75, 0.5); }, ramp('#ff7aa8', false), 0.4, function () {
          gloss(c, 0, -0.5, 0.4, 0.24, -0.3, 0.9);
        });
        c.restore();
      }
    } else if (hat === 'flowerCrown') {
      /* garland: a twisted vine, leaves, six blooms and a trailing ribbon */
      bandFrame(c, hood, Z);
      var fl = ['#ff8fb8', '#fff0a0', '#ffffff', '#c0a4ff', '#ff8fb8', '#9ad8ff'];
      var LEAF = ramp('#6cbc58', false);
      part(c, function () {
        c.beginPath();
        c.moveTo(5.0, 9.2);
        c.quadraticCurveTo(3.4 + tw * 0.4, 11.4, 2.6 + tw * 0.8, 14.2);
        c.lineTo(3.8 + tw * 0.7, 13.6); c.lineTo(4.4 + tw * 0.7, 14.6);
        c.quadraticCurveTo(4.8 + tw * 0.3, 11.6, 6.0, 9.6);
        c.closePath();
      }, P.suit, 0.5);
      c.beginPath();
      c.ellipse(14, 10.6, 9.5, 7.5, 0, Math.PI * 1.06, Math.PI * 1.94);
      stroke(c, LEAF.ink, 0.95);
      c.beginPath();
      c.ellipse(14, 10.6, 9.5, 7.5, 0, Math.PI * 1.06, Math.PI * 1.94);
      stroke(c, LEAF.c, 0.55);
      for (i = 0; i < 7; i++) {
        var la = Math.PI * (1.07 + i * 0.143);
        c.save();
        c.translate(14 + Math.cos(la) * 9.6, 10.6 + Math.sin(la) * 7.6);
        c.rotate(la + Math.PI / 2 + (i % 2 ? 0.7 : -0.7));
        part(c, function () {
          c.beginPath();
          c.moveTo(0, 0); c.quadraticCurveTo(1.0, -1.1, 2.4, -0.3); c.quadraticCurveTo(1.2, 0.8, 0, 0);
          c.closePath();
        }, LEAF, 0.3, function () {
          c.beginPath(); c.moveTo(0.2, 0); c.lineTo(2.0, -0.2);
          stroke(c, LEAF.d, 0.18);
        });
        c.restore();
      }
      for (i = 0; i < 6; i++) {
        var a = Math.PI * (1.135 + i * 0.146), big = i % 2 === 0;
        var px = 14 + Math.cos(a) * 9.5, py = 10.5 + Math.sin(a) * 7.5, pr = big ? 1.0 : 0.78;
        var FR = ramp(fl[i], false);
        part(c, function () {
          c.beginPath();
          for (var k = 0; k < 5; k++) {
            var b = k * TAU / 5 + i * 0.7;
            c.moveTo(px + Math.cos(b) * pr * 1.1 + pr, py + Math.sin(b) * pr * 1.1);
            c.arc(px + Math.cos(b) * pr * 1.1, py + Math.sin(b) * pr * 1.1, pr, 0, TAU);
          }
        }, FR, 0.5, function () {
          c.beginPath();
          for (var k = 0; k < 5; k++) {
            var b = k * TAU / 5 + i * 0.7;
            c.moveTo(px + Math.cos(b) * pr * 0.5, py + Math.sin(b) * pr * 0.5);
            c.lineTo(px + Math.cos(b) * pr * 1.5, py + Math.sin(b) * pr * 1.5);
          }
          stroke(c, FR.m, 0.2, 0.9);
        });
        ell(c, px, py, pr * 0.62, pr * 0.62, 0);
        c.fillStyle = i === 1 ? '#ff9a3a' : '#ffc93a'; c.fill();
        stroke(c, '#b8741a', 0.16);
        gloss(c, px - pr * 0.2, py - pr * 0.25, pr * 0.22, pr * 0.16, 0, 0.9);
      }
    } else if (hat === 'catEars') {
      /* plush cat-ear band in her hair colour, with a belled ribbon */
      if (hood && hood.ears === 'cat') { c.restore(); return; }
      bandFrame(c, hood, Z);
      var band = ramp(mix(P.hair.c, '#2a1a2a', 0.45), false);
      c.beginPath();
      c.arc(14, 11.2, 9.0, Math.PI * 1.1, Math.PI * 1.9);
      stroke(c, band.ink, 1.3);
      c.beginPath();
      c.arc(14, 11.2, 9.0, Math.PI * 1.1, Math.PI * 1.9);
      stroke(c, band.c, 0.8);
      for (i = 0; i < 2; i++) {
        c.save();
        c.translate(i ? 20.2 : 7.8, 3.6);
        c.scale(i ? -1 : 1, 1);
        c.rotate(-0.25 + Z.ear * 0.12 * (i ? -1 : 1));
        part(c, function () {
          c.beginPath();
          c.moveTo(-2.9, 1.1); c.quadraticCurveTo(-3.1, -4.2, -0.6, -6.0); c.quadraticCurveTo(1.6, -3.0, 3.1, 0.5);
          c.closePath();
        }, band, 0.8, function () {
          c.beginPath();
          c.moveTo(-1.9, 0.7); c.quadraticCurveTo(-2.0, -3.0, -0.7, -4.4); c.quadraticCurveTo(0.8, -2.2, 1.9, 0.2);
          c.closePath();
          c.fillStyle = '#ffa8c4';
          c.fill();
          c.beginPath();
          c.moveTo(-1.2, 0.4); c.quadraticCurveTo(-1.2, -1.8, -0.6, -2.8); c.quadraticCurveTo(0.3, -1.4, 1.0, 0.1);
          c.closePath();
          c.fillStyle = '#ffd0de';
          c.fill();
          c.beginPath();
          c.moveTo(-1.6, 0.6); c.lineTo(-1.2, -0.7);
          c.moveTo(-0.7, 0.5); c.lineTo(-0.5, -1.0);
          c.moveTo(0.3, 0.4); c.lineTo(0.2, -0.9);
          c.moveTo(1.2, 0.2); c.lineTo(0.8, -0.8);
          stroke(c, '#ffffff', 0.3, 0.9);
        });
        c.restore();
      }
      drawBow(c, P.suit, 7.0, 6.0, 0.62, false, tw * 0.4);
      part(c, function () { ell(c, 7.0, 7.5, 0.95, 0.95, 0); }, GOLD, 0.3, function () {
        c.beginPath(); c.moveTo(6.3, 7.6); c.lineTo(7.7, 7.6); c.moveTo(7.0, 7.6); c.lineTo(7.0, 8.4);
        stroke(c, GOLD.ink, 0.2);
        gloss(c, 6.7, 7.1, 0.3, 0.2, -0.4, 0.95);
      });
    } else if (hat === 'tiara') {
      /* silver filigree tiara: pearls on five points, a heart jewel */
      hatFrame(c, hood, Z);
      part(c, function () {
        c.beginPath();
        c.moveTo(-6.7, 2.5);
        c.lineTo(-6.3, 0.2); c.quadraticCurveTo(-5.3, 1.5, -4.4, 0.8);
        c.lineTo(-3.5, -2.2); c.quadraticCurveTo(-2.6, 0.1, -1.7, -0.7);
        c.lineTo(0, -4.8);
        c.lineTo(1.7, -0.7); c.quadraticCurveTo(2.6, 0.1, 3.5, -2.2);
        c.lineTo(4.4, 0.8); c.quadraticCurveTo(5.3, 1.5, 6.3, 0.2);
        c.lineTo(6.7, 2.5);
        c.quadraticCurveTo(0, 0.5, -6.7, 2.5);
        c.closePath();
      }, SILVER, 0.7, function () {
        c.beginPath();
        c.moveTo(-6.6, 1.6); c.quadraticCurveTo(0, -0.4, 6.6, 1.6);
        stroke(c, SILVER.d, 0.3);
        c.beginPath();
        c.moveTo(-3.5, -1.2); c.quadraticCurveTo(-2.6, 0.6, -1.2, 0.2);
        c.moveTo(3.5, -1.2); c.quadraticCurveTo(2.6, 0.6, 1.2, 0.2);
        stroke(c, SILVER.d, 0.22, 0.8);
        c.beginPath();
        c.moveTo(-5.8, 1.2); c.quadraticCurveTo(-3, 0.3, -0.6, 0.1);
        stroke(c, '#ffffff', 0.4, 0.9);
      });
      var pe = [-6.3, 0.0, -3.5, -2.5, 0, -5.1, 3.5, -2.5, 6.3, 0.0];
      for (i = 0; i < pe.length; i += 2) {
        part(c, function () { ell(c, pe[i], pe[i + 1], 0.62, 0.62, 0); }, ramp('#fff4fa', false), 0.2, function () {
          gloss(c, pe[i] - 0.18, pe[i + 1] - 0.2, 0.2, 0.14, 0, 1);
        });
      }
      gem(c, 0, -1.5, 1.3, '#ff5a9a', true);
      gem(c, -3.5, 0.3, 0.55, '#7ad0ff');
      gem(c, 3.5, 0.3, 0.55, '#7ad0ff');
      c.fillStyle = '#ffffff';
      sparklePath(c, 2.2, -3.8, 0.9); c.fill();
    } else if (hat === 'crown') {
      /* little royal crown: velvet cap, jewelled band, pearl-tipped points */
      hatFrame(c, hood, Z);
      c.translate(-0.3, 0.1);
      c.rotate(-0.1);
      part(c, function () {
        c.beginPath();
        c.moveTo(-3.9, -1.4); c.quadraticCurveTo(0, -8.6, 3.9, -1.4);
        c.closePath();
      }, ramp('#b8283c', false), 0.8);
      part(c, function () {
        c.beginPath();
        c.moveTo(-4.3, 1.0);
        c.lineTo(-5.1, -4.0); c.lineTo(-3.7, -2.2); c.lineTo(-2.6, -5.4); c.lineTo(-1.3, -2.5);
        c.lineTo(0, -6.5);
        c.lineTo(1.3, -2.5); c.lineTo(2.6, -5.4); c.lineTo(3.7, -2.2); c.lineTo(5.1, -4.0);
        c.lineTo(4.3, 1.0);
        c.quadraticCurveTo(0, 2.3, -4.3, 1.0);
        c.closePath();
      }, GOLD, 0.9, function () {
        c.beginPath();
        c.moveTo(-4.7, -1.5); c.quadraticCurveTo(0, -0.2, 4.7, -1.5);
        stroke(c, GOLD.d, 0.3);
        c.beginPath();
        c.moveTo(-4.4, 0.3); c.quadraticCurveTo(0, 1.6, 4.4, 0.3);
        stroke(c, GOLD.l, 0.3, 0.9);
        gloss(c, -3.2, -1.0, 0.4, 1.4, 0.15, 0.6, '#fff6c8');
      });
      gem(c, 0, -0.1, 0.8, '#e8344a');
      gem(c, -2.5, -0.45, 0.55, '#58b8ff');
      gem(c, 2.5, -0.45, 0.55, '#58b8ff');
      var tp = [-5.1, -4.2, -2.6, -5.7, 0, -6.9, 2.6, -5.7, 5.1, -4.2];
      for (i = 0; i < tp.length; i += 2) {
        part(c, function () { ell(c, tp[i], tp[i + 1], 0.62, 0.62, 0); }, i === 4 ? ramp('#fff4fa', false) : GOLD, 0.2, function () {
          gloss(c, tp[i] - 0.18, tp[i + 1] - 0.2, 0.2, 0.14, 0, 1);
        });
      }
      c.fillStyle = '#ffffff';
      sparklePath(c, 3.6, -6.4, 0.9); c.fill();
    } else if (hat === 'beret') {
      /* soft wool beret slouched to one side, with a stalk and a star pin */
      hatFrame(c, hood, Z);
      c.translate(0.4, 0.3);
      var W = P.suit;
      part(c, function () {
        c.beginPath();
        c.moveTo(-7.5, 2.9);
        c.bezierCurveTo(-10.4, -0.4, -7.2, -5.9, -0.8, -6.1);
        c.bezierCurveTo(5.4, -6.4, 11.8, -4.0, 11.0, 0.6);
        c.bezierCurveTo(10.6, 2.9, 8.4, 3.4, 7.3, 2.5);
        c.quadraticCurveTo(0, -1.0, -7.5, 2.9);
        c.closePath();
      }, W, 1.3, function () {
        c.beginPath();
        c.moveTo(-7.5, 2.9); c.quadraticCurveTo(0, -1.0, 7.3, 2.5);
        stroke(c, W.d, 1.5, 0.85);
        c.beginPath();
        c.moveTo(0.4, -5.6); c.quadraticCurveTo(-3.6, -4.0, -6.4, -0.4);
        c.moveTo(1.0, -5.6); c.quadraticCurveTo(5.4, -4.6, 8.8, -1.0);
        c.moveTo(0.7, -5.6); c.quadraticCurveTo(1.0, -3.4, 0.6, -1.4);
        stroke(c, W.m, 0.35, 0.8);
        gloss(c, -3.6, -3.9, 2.2, 0.8, -0.5, 0.4, W.l);
      });
      part(c, function () {
        c.beginPath();
        c.moveTo(0.2, -5.9); c.quadraticCurveTo(0.3, -7.6, 1.2, -7.7); c.quadraticCurveTo(1.3, -6.6, 1.3, -5.9);
        c.closePath();
      }, W, 0.3);
      part(c, function () { starPath(c, -5.0, 0.4, 1.2, 0.5); }, GOLD, 0.3, function () {
        gloss(c, -5.3, 0.0, 0.3, 0.2, 0, 0.95);
      });
    } else if (hat === 'strawHat') {
      /* the brim and crown are painted behind her head; in front, a daisy
         tucked in the ribbon and the ribbon's tails */
      c.translate(14 + fx * 0.3, hood ? 0.6 : 3.4);
      if (hood) c.scale(1.12, 1.12);
      for (i = 0; i < 2; i++) {
        part(c, function () {
          c.beginPath();
          c.moveTo(7.0, -1.0);
          c.quadraticCurveTo(8.8 + tw * 0.3, 0.2 + i * 1.0, 10.2 + tw * 0.7, 2.6 + i * 2.2);
          c.lineTo(8.8 + tw * 0.6, 2.6 + i * 2.0); c.lineTo(8.6 + tw * 0.6, 3.8 + i * 2.0);
          c.quadraticCurveTo(7.8 + tw * 0.2, 1.4 + i * 0.8, 6.8, 0.4);
          c.closePath();
        }, P.suit, 0.5);
      }
      var DA = ramp('#ffffff', false);
      part(c, function () {
        c.beginPath();
        for (var k = 0; k < 7; k++) {
          var b = k * TAU / 7;
          c.moveTo(6.4 + Math.cos(b) * 1.25 + 0.75, -1.2 + Math.sin(b) * 1.25);
          c.arc(6.4 + Math.cos(b) * 1.25, -1.2 + Math.sin(b) * 1.25, 0.75, 0, TAU);
        }
      }, DA, 0.4);
      part(c, function () { ell(c, 6.4, -1.2, 0.85, 0.85, 0); }, ramp('#ffc93a', false), 0.3, function () {
        gloss(c, 6.15, -1.45, 0.26, 0.18, 0, 0.9);
      });
    } else if (hat === 'chefHat') {
      /* tall pleated toque for the hotel kitchen */
      hatFrame(c, hood, Z);
      c.translate(0.3, 0.2);
      c.rotate(-0.07);
      part(c, function () {
        c.beginPath();
        c.moveTo(-5.2, -1.2);
        c.bezierCurveTo(-8.8, -2.2, -8.6, -7.6, -4.6, -7.4);
        c.bezierCurveTo(-4.0, -10.6, 1.0, -11.0, 2.2, -8.4);
        c.bezierCurveTo(5.8, -10.0, 9.2, -5.8, 5.4, -1.2);
        c.closePath();
      }, TOQUE, 1.2, function () {
        c.beginPath();
        c.moveTo(-3.4, -1.4); c.quadraticCurveTo(-4.4, -4.4, -4.2, -7.0);
        c.moveTo(-1.2, -1.6); c.quadraticCurveTo(-1.4, -5.6, -0.6, -8.4);
        c.moveTo(1.2, -1.6); c.quadraticCurveTo(1.8, -5.0, 2.2, -8.0);
        c.moveTo(3.4, -1.4); c.quadraticCurveTo(4.8, -3.8, 5.2, -6.2);
        stroke(c, TOQUE.d, 0.3, 0.75);
        gloss(c, -5.0, -5.2, 1.4, 1.0, -0.4, 0.9);
        gloss(c, -1.4, -8.4, 1.6, 0.8, -0.2, 0.9);
      });
      part(c, function () {
        c.beginPath();
        c.moveTo(-5.2, 1.6);
        c.lineTo(-5.5, -2.0); c.quadraticCurveTo(0, -3.1, 5.5, -2.0); c.lineTo(5.2, 1.6);
        c.quadraticCurveTo(0, 0.3, -5.2, 1.6);
        c.closePath();
      }, TOQUE, 0.8, function () {
        c.beginPath();
        for (var k = -2; k <= 2; k++) { c.moveTo(k * 1.9, -2.4 + Math.abs(k) * 0.2); c.lineTo(k * 1.8, 0.8 + Math.abs(k) * 0.3); }
        stroke(c, TOQUE.m, 0.26, 0.9);
        c.beginPath();
        c.moveTo(-5.2, 1.0); c.quadraticCurveTo(0, -0.3, 5.2, 1.0);
        stroke(c, TOQUE.d, 0.5, 0.5);
      });
    } else if (hat === 'partyHat') {
      /* spotted party cone with a ruffle and a pom-pom */
      hatFrame(c, hood, Z);
      c.translate(0.8, 0.5);
      c.rotate(0.15);
      var C1 = P.suit;
      part(c, function () {
        c.beginPath();
        c.moveTo(-4.0, 0.4); c.lineTo(0.3, -9.8); c.lineTo(4.2, 0.4);
        c.quadraticCurveTo(0, 1.9, -4.0, 0.4);
        c.closePath();
      }, C1, 1.0, function () {
        c.fillStyle = '#ffe27a';
        c.beginPath();
        c.moveTo(-6, -1.4); c.lineTo(6, -4.4); c.lineTo(6, -2.9); c.lineTo(-6, 0.1); c.closePath();
        c.moveTo(-6, -5.0); c.lineTo(6, -8.0); c.lineTo(6, -6.5); c.lineTo(-6, -3.5); c.closePath();
        c.fill();
        c.fillStyle = '#ffffff';
        ell(c, -1.4, -0.9, 0.5, 0.5, 0); c.fill();
        ell(c, 1.6, -1.4, 0.5, 0.5, 0); c.fill();
        ell(c, 0.2, -4.4, 0.45, 0.45, 0); c.fill();
        ell(c, 0.3, -7.6, 0.3, 0.3, 0); c.fill();
        gloss(c, -1.3, -4.0, 0.4, 2.6, 0.38, 0.35);
      });
      part(c, function () {
        c.beginPath();
        c.moveTo(-4.5, 0.2);
        for (var k = 0; k < 6; k++) c.arc(-3.75 + k * 1.52, 1.0 + Math.sin(Math.PI * (k + 0.5) / 6) * 0.9, 0.76, Math.PI, 0, true);
        c.quadraticCurveTo(0, 1.0, -4.5, 0.2);
        c.closePath();
      }, ramp('#ffffff', false), 0.3);
      part(c, function () {
        c.beginPath();
        c.moveTo(1.9, -10.4);
        for (var k = 0; k < 9; k++) {
          var b = (k + 0.5) * TAU / 9, b1 = (k + 1) * TAU / 9;
          c.quadraticCurveTo(0.3 + Math.cos(b) * 2.5, -10.4 + Math.sin(b) * 2.5, 0.3 + Math.cos(b1) * 1.6, -10.4 + Math.sin(b1) * 1.6);
        }
        c.closePath();
      }, ramp('#ffe27a', false), 0.6, function () { gloss(c, -0.3, -11.0, 0.6, 0.4, -0.4, 0.85); });
    } else if (hat === 'safariHat') {
      /* zoo-keeper pith helmet: sloping brim, leather band, a paw badge */
      hatFrame(c, hood, Z);
      c.translate(0, 0.5);
      part(c, function () {
        c.beginPath();
        c.moveTo(-7.0, -0.6);
        c.quadraticCurveTo(-10.8, 0.6, -10.4, 2.7);
        c.quadraticCurveTo(0, 5.6, 10.4, 2.7);
        c.quadraticCurveTo(10.8, 0.6, 7.0, -0.6);
        c.closePath();
      }, PITH, 0.9, function () {
        c.beginPath();
        c.moveTo(-10.4, 2.7); c.quadraticCurveTo(0, 5.6, 10.4, 2.7);
        stroke(c, PITH.d, 1.3, 0.7);
      });
      part(c, function () {
        c.beginPath();
        c.moveTo(-7.3, 0.3);
        c.bezierCurveTo(-7.5, -6.3, -3.8, -7.2, 0, -7.2);
        c.bezierCurveTo(3.8, -7.2, 7.5, -6.3, 7.3, 0.3);
        c.quadraticCurveTo(0, 2.3, -7.3, 0.3);
        c.closePath();
      }, PITH, 1.2, function () {
        c.beginPath();
        c.moveTo(0, -7.2); c.lineTo(0, 1.4);
        c.moveTo(-3.4, -6.6); c.quadraticCurveTo(-4.6, -3.0, -4.2, 1.0);
        c.moveTo(3.4, -6.6); c.quadraticCurveTo(4.6, -3.0, 4.2, 1.0);
        stroke(c, PITH.m, 0.3, 0.9);
        c.beginPath();
        c.moveTo(-7.4, -0.5); c.quadraticCurveTo(0, 1.5, 7.4, -0.5);
        stroke(c, LEATHER.ink, 1.45);
        c.beginPath();
        c.moveTo(-7.4, -0.5); c.quadraticCurveTo(0, 1.5, 7.4, -0.5);
        stroke(c, LEATHER.c, 1.05);
        gloss(c, -3.6, -4.6, 1.5, 0.9, -0.5, 0.5, PITH.l);
      });
      part(c, function () { ell(c, 0, -7.2, 1.0, 0.5, 0); }, PITH, 0.3);
      part(c, function () { ell(c, 0, 0.3, 1.5, 1.35, 0); }, GOLD, 0.3, function () {
        c.fillStyle = LEATHER.d;
        ell(c, 0, 0.65, 0.6, 0.48, 0); c.fill();
        ell(c, -0.7, 0.0, 0.24, 0.26, 0); c.fill();
        ell(c, 0, -0.25, 0.24, 0.26, 0); c.fill();
        ell(c, 0.7, 0.0, 0.24, 0.26, 0); c.fill();
      });
    }
    c.restore();
  }

  /* Eyewear sits on her eyes and squeezes the far lens with the head turn. */
  function drawGlasses(c, Z, kind) {
    var y = Z.ey + 0.2, i, x, s;
    var x1 = Z.ex1, x2 = Z.ex2, fs = 1 - 0.16 * Z.look;
    function bridge(dx, dy, ink, col) {
      c.beginPath();
      c.moveTo(x1 + dx, y + dy); c.quadraticCurveTo((x1 + x2) / 2, y + dy - 0.9, x2 - dx * fs, y + dy);
      stroke(c, ink, 0.8);
      c.beginPath();
      c.moveTo(x1 + dx, y + dy); c.quadraticCurveTo((x1 + x2) / 2, y + dy - 0.9, x2 - dx * fs, y + dy);
      stroke(c, col, 0.42);
    }
    if (kind === 'heartGlasses') {
      /* rose-tinted hearts in glossy pink frames */
      bridge(2.5, -0.9, '#a01248', '#ff5a9a');
      for (i = 0; i < 2; i++) {
        c.save();
        c.translate(i ? x2 : x1, y);
        c.scale(i ? fs : 1, 1);
        heartPath(c, 0, 0.1, 3.0);
        var hg = c.createLinearGradient(0, -3, 0, 3.2);
        hg.addColorStop(0, 'rgba(255,70,140,0.72)');
        hg.addColorStop(1, 'rgba(255,150,190,0.3)');
        c.fillStyle = hg;
        c.fill();
        stroke(c, '#a01248', 0.95);
        heartPath(c, 0, 0.1, 3.0);
        stroke(c, '#ff5a9a', 0.5);
        c.beginPath();
        c.moveTo(-2.3, -1.2); c.quadraticCurveTo(-1.8, -2.5, -0.7, -2.2);
        stroke(c, '#ffd0e2', 0.3);
        gloss(c, -1.2, -1.0, 0.75, 0.36, -0.5, 0.8);
        c.fillStyle = '#ffffff';
        sparklePath(c, 1.5, 0.6, 0.55); c.fill();
        c.restore();
      }
      return;
    }
    if (kind === 'starShades') {
      /* star-shaped sunglasses: sunny frames, smoky violet lenses */
      bridge(2.2, -0.4, GOLD.ink, GOLD.c);
      for (i = 0; i < 2; i++) {
        c.save();
        c.translate(i ? x2 : x1, y + 0.2);
        c.scale(i ? fs : 1, 1);
        c.rotate(i ? 0.12 : -0.12);
        starPath(c, 0, 0, 3.9, 0.56);
        c.fillStyle = GOLD.ink; c.fill();
        starPath(c, 0, 0, 3.6, 0.57);
        c.fillStyle = GOLD.c; c.fill();
        starPath(c, -0.1, -0.15, 3.3, 0.58);
        stroke(c, GOLD.l, 0.22, 0.9);
        starPath(c, 0, 0, 2.95, 0.6);
        var sg = c.createLinearGradient(0, -2.6, 0, 2.6);
        sg.addColorStop(0, '#2a1048');
        sg.addColorStop(1, '#8a4aa8');
        c.fillStyle = sg;
        c.fill();
        c.save();
        c.clip();
        c.beginPath();
        c.moveTo(-2.4, 0.2); c.lineTo(0.2, -2.4);
        stroke(c, '#ffffff', 0.5, 0.75);
        c.beginPath();
        c.moveTo(-1.4, 1.0); c.lineTo(1.0, -1.4);
        stroke(c, '#ffffff', 0.25, 0.6);
        c.restore();
        c.restore();
      }
      return;
    }
    /* round wire glasses in gold, with a pale lens and two glints */
    bridge(3.0, -0.4, GOLD.ink, GOLD.c);
    for (i = 0; i < 2; i++) {
      x = i ? x2 : x1; s = i ? fs : 1;
      ell(c, x, y, 3.1 * s, 3.15, 0);
      c.fillStyle = 'rgba(210,236,255,0.2)';
      c.fill();
      stroke(c, GOLD.ink, 0.9);
      ell(c, x, y, 3.1 * s, 3.15, 0);
      stroke(c, GOLD.c, 0.5);
      c.beginPath();
      c.ellipse(x, y, 3.1 * s, 3.15, 0, Math.PI * 1.05, Math.PI * 1.55);
      stroke(c, GOLD.l, 0.24);
      c.save();
      ell(c, x, y, 2.8 * s, 2.85, 0);
      c.clip();
      c.beginPath();
      c.moveTo(x - 2.4 * s, y - 0.2); c.lineTo(x - 0.4 * s, y - 2.6);
      stroke(c, '#ffffff', 0.5, 0.7);
      c.beginPath();
      c.moveTo(x - 1.6 * s, y + 0.7); c.lineTo(x + 0.2 * s, y - 1.6);
      stroke(c, '#ffffff', 0.22, 0.6);
      c.restore();
    }
    /* temple arms running back into her hair */
    c.beginPath();
    c.moveTo(x1 - 3.0, y - 0.6); c.lineTo(x1 - 4.4, y - 1.0);
    c.moveTo(x2 + 3.0 * fs, y - 0.6); c.lineTo(x2 + 4.2 * fs, y - 1.0);
    stroke(c, GOLD.ink, 0.5);
  }

  /* Hotel name badge: a gold-rimmed plate with a heart and two lines of
     "writing", pinned to her chest. */
  function drawBadge(c, tx) {
    c.save();
    c.translate(16.9 + tx, 22.5);
    c.rotate(-0.08);
    part(c, function () {
      c.beginPath();
      c.moveTo(-1.5, -1.2); c.lineTo(1.5, -1.2); c.quadraticCurveTo(2.1, -1.2, 2.1, -0.6);
      c.lineTo(2.1, 0.6); c.quadraticCurveTo(2.1, 1.2, 1.5, 1.2); c.lineTo(-1.5, 1.2);
      c.quadraticCurveTo(-2.1, 1.2, -2.1, 0.6); c.lineTo(-2.1, -0.6); c.quadraticCurveTo(-2.1, -1.2, -1.5, -1.2);
      c.closePath();
    }, GOLD, 0.4, function () {
      c.fillStyle = '#fff8e8';
      c.fillRect(-1.7, -0.82, 3.4, 1.64);
      c.fillStyle = '#e8344a';
      heartPath(c, -0.95, 0.02, 0.55); c.fill();
      c.fillStyle = '#8a5a48';
      c.fillRect(-0.15, -0.45, 1.6, 0.26);
      c.fillRect(-0.15, 0.15, 1.1, 0.26);
      gloss(c, -1.2, -1.0, 0.7, 0.14, 0, 0.9);
    });
    c.restore();
  }

  /* String of gold beads with a heart pendant that swings a little. */
  function drawNecklace(c, Z) {
    var tx = Z.tx, sw = Z.charm * 0.12, i, t, it, n = 9;
    var ax = 10.3, ay = 20.3, bx = 14 + tx, by = 23.5, ex = 17.7, ey = 20.3;
    c.beginPath();
    for (i = 0; i < n; i++) {
      t = (i + 0.5) / n; it = 1 - t;
      var px = it * it * ax + 2 * it * t * bx + t * t * ex, py = it * it * ay + 2 * it * t * by + t * t * ey;
      c.moveTo(px + 0.46, py); c.arc(px, py, 0.46, 0, TAU);
    }
    c.fillStyle = GOLD.c; c.fill();
    stroke(c, GOLD.ink, LW * 0.8);
    c.beginPath();
    for (i = 0; i < n; i++) {
      t = (i + 0.5) / n; it = 1 - t;
      var gx = it * it * ax + 2 * it * t * bx + t * t * ex - 0.14, gy = it * it * ay + 2 * it * t * by + t * t * ey - 0.14;
      c.moveTo(gx + 0.15, gy); c.arc(gx, gy, 0.15, 0, TAU);
    }
    c.fillStyle = '#fff6c8'; c.fill();
    c.save();
    c.translate(14 + tx, 21.95);
    c.rotate(-sw);
    part(c, function () { ell(c, 0, 0.3, 0.42, 0.42, 0); }, GOLD, 0.2);
    gem(c, 0, 1.45, 1.0, '#ff5a9a', true);
    c.restore();
  }

  /* Frilled half apron with a heart pocket (the maid dress wears one,
     and it is an extra over any outfit). */
  function drawApronSkirt(c, P, ax, h) {
    var W = P.white;
    part(c, function () {
      c.beginPath();
      c.moveTo(10.2, 24.8);
      c.quadraticCurveTo(8.6 + ax, 26.6, 8.2 + ax, h - 1.0);
      for (var a = 0; a < 6; a++) c.arc(9.17 + a * 1.93 + ax, h - 1.0, 0.97, Math.PI, 0, true);
      c.quadraticCurveTo(19.4 + ax, 26.6, 17.8, 24.8);
      c.closePath();
    }, W, 0.8, function () {
      c.beginPath();
      c.moveTo(8.4 + ax, h - 1.5); c.lineTo(19.6 + ax, h - 1.5);
      stroke(c, W.m, 0.3);
      c.beginPath();
      c.moveTo(12.6 + ax, 25.4); c.lineTo(12.3 + ax, h - 1.6);
      c.moveTo(15.4 + ax, 25.4); c.lineTo(15.7 + ax, h - 1.6);
      stroke(c, W.m, 0.25, 0.7);
      c.fillStyle = '#ff6f8e';
      heartPath(c, 14 + ax, 26.9, 0.7);
      c.fill();
    });
  }
  function drawApron(c, P, Z, sw) {
    var W = P.white, tx = Z.tx;
    drawApronSkirt(c, P, sw * 0.6, HEM);
    part(c, function () {
      c.beginPath();
      c.moveTo(11.6 + tx, 21.8); c.lineTo(16.4 + tx, 21.8); c.lineTo(17.2, 24.2); c.lineTo(10.8, 24.2);
      c.closePath();
    }, W, 0.5, function () {
      c.beginPath();
      c.moveTo(12.0 + tx, 22.3); c.lineTo(16.0 + tx, 22.3);
      stroke(c, W.m, 0.25);
    });
    c.beginPath();
    c.moveTo(11.8 + tx, 21.9); c.lineTo(10.2, 20.5);
    c.moveTo(16.2 + tx, 21.9); c.lineTo(17.8, 20.5);
    stroke(c, W.ink, 0.95);
    c.beginPath();
    c.moveTo(11.8 + tx, 21.9); c.lineTo(10.2, 20.5);
    c.moveTo(16.2 + tx, 21.9); c.lineTo(17.8, 20.5);
    stroke(c, W.c, 0.6);
    part(c, function () {
      c.beginPath();
      c.moveTo(9.0, 24.0); c.lineTo(19.0, 24.0); c.lineTo(18.9, 25.2); c.lineTo(9.1, 25.2);
      c.closePath();
    }, W, 0.3);
    /* the bow tied at her back peeks out at the hip */
    drawBow(c, W, 8.4, 24.8, 0.62, false, Z.charm * 0.4);
  }

  /* Knitted scarf: ribbed, striped and fringed. */
  function drawScarf(c, P, part2, Z) {
    var R = ramp(mix(P.suit.c, '#ff6060', 0.35), false), sw = Z.charm, tx = Z.tx, i;
    if (part2 === 'back') {
      /* the loose end flying out behind her */
      part(c, function () {
        c.beginPath();
        c.moveTo(9.4, 19.6);
        c.bezierCurveTo(6.6 + sw * 0.3, 19.8, 4.4 + sw * 0.8, 21.6, 2.4 + sw * 1.2, 24.6 + Math.abs(sw) * 0.2);
        c.lineTo(4.8 + sw * 1.1, 25.6);
        c.bezierCurveTo(5.8 + sw * 0.7, 22.8, 7.6 + sw * 0.3, 21.8, 10.0, 21.8);
        c.closePath();
      }, R, 0.6, function () {
        c.beginPath();
        c.moveTo(2.2 + sw * 1.2, 23.4); c.lineTo(5.6 + sw * 1.05, 24.6);
        c.moveTo(3.0 + sw * 1.1, 22.3); c.lineTo(6.2 + sw * 0.95, 23.5);
        stroke(c, '#ffffff', 0.5, 0.85);
      });
      c.beginPath();
      for (i = 0; i < 4; i++) {
        c.moveTo(2.7 + i * 0.6 + sw * 1.2, 24.8 + i * 0.25); c.lineTo(2.2 + i * 0.6 + sw * 1.35, 26.0 + i * 0.25);
      }
      stroke(c, R.ink, 0.5);
      c.beginPath();
      for (i = 0; i < 4; i++) {
        c.moveTo(2.7 + i * 0.6 + sw * 1.2, 24.8 + i * 0.25); c.lineTo(2.2 + i * 0.6 + sw * 1.35, 26.0 + i * 0.25);
      }
      stroke(c, R.c, 0.28);
      return;
    }
    part(c, function () {
      c.beginPath();
      c.moveTo(8.6, 19.2);
      c.quadraticCurveTo(14 + tx, 18.2, 19.4, 19.2);
      c.quadraticCurveTo(19.9, 20.8, 19.0, 21.8);
      c.quadraticCurveTo(14 + tx, 22.9, 9.0, 21.8);
      c.quadraticCurveTo(8.1, 20.8, 8.6, 19.2);
      c.closePath();
    }, R, 0.6, function () {
      c.beginPath();
      for (i = 0; i < 8; i++) { c.moveTo(9.4 + i * 1.35, 19.0); c.lineTo(9.9 + i * 1.35, 22.2); }
      stroke(c, R.m, 0.3, 0.85);
      c.beginPath();
      c.moveTo(8.6, 20.3); c.quadraticCurveTo(14 + tx, 21.3, 19.4, 20.3);
      stroke(c, '#ffffff', 0.5, 0.85);
      gloss(c, 11.2, 19.4, 1.6, 0.35, 0.05, 0.4, R.l);
    });
    /* front tail hanging over the chest, with a fringe */
    var fxp = 16.2 + tx + sw * 0.3;
    c.beginPath();
    for (i = 0; i < 4; i++) { c.moveTo(fxp + 0.2 + i * 0.6, 25.3); c.lineTo(fxp + 0.1 + i * 0.6 + sw * 0.1, 26.5); }
    stroke(c, R.ink, 0.5);
    c.beginPath();
    for (i = 0; i < 4; i++) { c.moveTo(fxp + 0.2 + i * 0.6, 25.3); c.lineTo(fxp + 0.1 + i * 0.6 + sw * 0.1, 26.5); }
    stroke(c, R.c, 0.28);
    part(c, function () {
      c.beginPath();
      c.moveTo(15.2 + tx, 21.0);
      c.quadraticCurveTo(16.2 + tx + sw * 0.15, 23.4, fxp - 0.2, 25.5);
      c.lineTo(fxp + 2.4, 25.3);
      c.quadraticCurveTo(18.3 + tx + sw * 0.1, 23.0, 17.8 + tx, 20.8);
      c.closePath();
    }, R, 0.5, function () {
      c.fillStyle = '#ffffff';
      c.globalAlpha = 0.85;
      c.fillRect(15, 23.3, 5, 0.5);
      c.fillRect(15, 24.3, 5, 0.5);
      c.globalAlpha = 1;
    });
    /* the knot */
    part(c, function () { ell(c, 16.4 + tx, 21.4, 1.35, 1.15, 0.2); }, R, 0.4, function () {
      c.beginPath(); c.moveTo(15.6 + tx, 21.0); c.quadraticCurveTo(16.4 + tx, 21.9, 17.3 + tx, 21.2);
      stroke(c, R.d, 0.25);
    });
  }

  /* Bunny backpack: a plush rabbit riding on her back, peeking round
     her side, ears flopping on their spring. */
  function drawBackpack(c, P, Z) {
    var R = ramp(mix(P.suit.c, '#ffffff', 0.62), false), ear = Z.ear;
    for (var e = 0; e < 2; e++) {
      c.save();
      c.translate(e ? 8.4 : 4.6, 18.8);
      c.rotate(-0.6 + e * 0.5 + ear * 0.16);
      part(c, function () {
        c.beginPath();
        c.moveTo(-1.1, 0.4); c.bezierCurveTo(-1.9, -2.8, -1.3, -6.4, 0, -6.6); c.bezierCurveTo(1.3, -6.4, 1.9, -2.8, 1.1, 0.4);
        c.closePath();
      }, R, 0.6, function () {
        ell(c, 0, -3.2, 0.55, 2.4, 0); c.fillStyle = '#ffb0c8'; c.fill();
      });
      c.restore();
    }
    part(c, function () {
      c.beginPath();
      c.moveTo(1.8, 21.6);
      c.quadraticCurveTo(1.4, 18.0, 6.4, 18.0);
      c.quadraticCurveTo(11.0, 18.2, 11.0, 22.0);
      c.lineTo(10.8, 27.8);
      c.quadraticCurveTo(6.4, 29.8, 2.0, 28.0);
      c.closePath();
    }, R, 1.0, function () {
      /* front pocket with a zip */
      c.beginPath();
      c.moveTo(1.6, 24.6); c.quadraticCurveTo(5.6, 23.8, 9.6, 24.6);
      stroke(c, R.d, 0.5, 0.9);
      c.beginPath();
      c.moveTo(2.2, 25.2); c.quadraticCurveTo(5.6, 24.5, 9.2, 25.2);
      c.setLineDash([0.45, 0.4]);
      stroke(c, '#ffffff', 0.22, 0.9);
      c.setLineDash([]);
      /* sleepy bunny face */
      c.fillStyle = INK;
      ell(c, 3.3, 21.6, 0.42, 0.5, 0); c.fill();
      ell(c, 6.3, 21.6, 0.42, 0.5, 0); c.fill();
      c.fillStyle = '#ffffff';
      ell(c, 3.2, 21.45, 0.14, 0.14, 0); c.fill();
      ell(c, 6.2, 21.45, 0.14, 0.14, 0); c.fill();
      c.fillStyle = '#ff8fb0';
      ell(c, 4.8, 22.5, 0.5, 0.36, 0); c.fill();
      c.fillStyle = 'rgba(255,120,150,0.4)';
      ell(c, 2.6, 22.8, 0.7, 0.42, 0); c.fill();
      ell(c, 7.2, 22.8, 0.7, 0.42, 0); c.fill();
      c.beginPath();
      c.moveTo(4.8, 22.9); c.lineTo(4.8, 23.4);
      c.moveTo(4.2, 23.5); c.quadraticCurveTo(4.8, 23.9, 5.4, 23.5);
      stroke(c, R.ink, 0.22);
      gloss(c, 4.4, 19.2, 2.0, 0.5, -0.1, 0.55, R.l);
    });
    /* zip pull */
    part(c, function () { ell(c, 2.3, 25.5 + Math.abs(Z.charm) * 0.1, 0.5, 0.62, 0.2); }, GOLD, 0.2);
  }

  /* Leather satchel on a cross-body strap: stitched flap, brass buckle,
     a star charm dangling from its ring. */
  function drawSatchel(c, P, Z, front) {
    var R = LEATHER, F = ramp('#7e4826', false), sw = Z.charm * 0.4, tx = Z.tx;
    if (!front) {
      /* strap from her far shoulder across the chest */
      c.beginPath();
      c.moveTo(18.6, 20.8); c.lineTo(9.6 + sw * 0.2, 26.2);
      stroke(c, R.ink, 1.25);
      c.beginPath();
      c.moveTo(18.6, 20.8); c.lineTo(9.6 + sw * 0.2, 26.2);
      stroke(c, R.c, 0.82);
      c.beginPath();
      c.moveTo(18.5, 20.6); c.lineTo(9.5 + sw * 0.2, 26.0);
      c.setLineDash([0.5, 0.5]);
      stroke(c, R.l, 0.16, 0.9);
      c.setLineDash([]);
      return;
    }
    var bx = 7.4 + sw * 0.6 + tx * 0.3, by = 26.6;
    c.save();
    c.translate(bx, by);
    c.rotate(sw * 0.06);
    part(c, function () {
      c.beginPath();
      c.moveTo(-3.0, -1.5); c.lineTo(3.0, -1.5); c.quadraticCurveTo(3.4, 2.4, 2.3, 2.8);
      c.lineTo(-2.3, 2.8); c.quadraticCurveTo(-3.4, 2.4, -3.0, -1.5);
      c.closePath();
    }, R, 0.8, function () {
      c.beginPath();
      c.moveTo(-2.5, 2.3); c.lineTo(2.5, 2.3);
      c.setLineDash([0.45, 0.4]);
      stroke(c, R.l, 0.18, 0.9);
      c.setLineDash([]);
    });
    part(c, function () {
      c.beginPath();
      c.moveTo(-3.15, -1.65); c.lineTo(3.15, -1.65); c.lineTo(2.95, 0.5); c.quadraticCurveTo(0, 1.7, -2.95, 0.5);
      c.closePath();
    }, F, 0.5, function () {
      c.beginPath();
      c.moveTo(-2.65, 0.2); c.quadraticCurveTo(0, 1.25, 2.65, 0.2);
      c.setLineDash([0.45, 0.4]);
      stroke(c, R.l, 0.18, 0.9);
      c.setLineDash([]);
      gloss(c, -1.4, -1.1, 1.3, 0.25, 0, 0.35, R.l);
    });
    /* buckle strap and brass buckle */
    c.fillStyle = R.c;
    c.fillRect(-0.45, -0.4, 0.9, 2.0);
    part(c, function () { c.beginPath(); c.rect(-0.75, 0.75, 1.5, 1.2); }, GOLD, 0.3, function () {
      c.fillStyle = F.d;
      c.fillRect(-0.35, 1.1, 0.7, 0.5);
      gloss(c, -0.4, 0.95, 0.3, 0.12, 0, 0.9);
    });
    /* dangling star charm on a little chain */
    var cx = 2.6 + Z.charm * 0.5, cy = 4.6;
    c.beginPath();
    c.moveTo(2.3, 2.3); c.lineTo(cx, cy - 0.8);
    stroke(c, GOLD.d, 0.28);
    part(c, function () { starPath(c, cx, cy, 1.15, 0.48); }, GOLD, 0.3, function () {
      gloss(c, cx - 0.3, cy - 0.35, 0.28, 0.18, 0, 0.95);
    });
    c.restore();
  }

  /* Fairy wings: two pairs of glassy wings behind her shoulders that
     flutter; her hair shows through them. */
  function drawWings(c, P, Z) {
    var W = ramp(mix(P.suit.c, '#ffffff', 0.74), false), f = 0.94 + 0.07 * Z.flut, d = Z.charm * 0.25;
    var ga = c.globalAlpha;
    for (var i = 0; i < 2; i++) {
      c.save();
      if (i) { c.translate(28, 0); c.scale(-1, 1); }
      c.translate(12.4, 22);
      c.scale(i ? f * 0.96 : f, 1);
      c.translate(-12.4, -22);
      c.globalAlpha = ga * 0.84;
      part(c, function () {
        c.beginPath();
        c.moveTo(12.2, 24.0);
        c.bezierCurveTo(8.0, 23.4, 1.6 + d, 25.0, 0.2 + d, 29.0);
        c.bezierCurveTo(3.0 + d, 31.4, 9.0, 28.8, 12.4, 22.6);
        c.closePath();
      }, W, 0.9, function () {
        c.beginPath();
        c.moveTo(11.6, 24.0); c.quadraticCurveTo(6.0, 25.0, 2.0 + d, 28.6);
        c.moveTo(11.0, 24.8); c.quadraticCurveTo(7.6, 26.8, 5.2 + d, 29.2);
        stroke(c, '#ffffff', 0.3, 0.9);
      });
      part(c, function () {
        c.beginPath();
        c.moveTo(12.4, 21.4);
        c.bezierCurveTo(9.0, 15.0, 2.0 + d, 9.6, -3.4 + d, 10.8);
        c.bezierCurveTo(-6.4 + d, 14.6, -1.8, 21.4, 12.2, 23.4);
        c.closePath();
      }, W, 1.2, function () {
        c.beginPath();
        c.moveTo(11.6, 21.6); c.quadraticCurveTo(5.0, 15.0, -2.4 + d, 11.8);
        c.moveTo(11.2, 22.2); c.quadraticCurveTo(3.6, 18.2, -3.4 + d, 14.6);
        c.moveTo(10.6, 22.7); c.quadraticCurveTo(4.6, 21.0, -0.6 + d, 18.6);
        stroke(c, '#ffffff', 0.34, 0.9);
        c.fillStyle = P.suit.l;
        c.globalAlpha = ga * 0.5;
        ell(c, -1.6 + d, 13.2, 1.5, 1.1, 0.5); c.fill();
        c.globalAlpha = ga;
        c.fillStyle = '#ffffff';
        sparklePath(c, 1.0 + d, 15.6, 0.8); c.fill();
        sparklePath(c, 4.6, 19.8, 0.55); c.fill();
      });
      c.restore();
    }
    c.globalAlpha = ga;
  }

  /* Royal cape: back = the long drape behind her (painted before her
     hair); front = the collar over her shoulders and a jewelled clasp. */
  function drawCape(c, P, part2, Z, sw) {
    var R = ramp(mix(add(P.suit.c, -26), '#5a1a6a', 0.28), false), tx = Z.tx;
    if (part2 === 'back') {
      var x0 = 0.4 + sw * 1.2, x1 = 27.6 + sw * 1.2;
      part(c, function () {
        c.beginPath();
        c.moveTo(8.4, 20.2);
        c.bezierCurveTo(5.0 + sw * 0.2, 22.6, 1.4 + sw * 0.8, 27.4, x0, 32.2);
        for (var i = 0; i < 5; i++) {
          var a = x0 + (x1 - x0) * i / 5, b = x0 + (x1 - x0) * (i + 1) / 5;
          c.quadraticCurveTo((a + b) / 2, 34.4 - (i === 2 ? 0.5 : 0), b, 32.2);
        }
        c.bezierCurveTo(26.6 + sw * 0.8, 27.4, 23.0 + sw * 0.2, 22.6, 19.6, 20.2);
        c.closePath();
      }, R, 1.4, function () {
        c.fillStyle = R.m;
        for (var i = 1; i < 5; i++) {
          var fxx = x0 + (x1 - x0) * i / 5;
          c.beginPath();
          c.moveTo(14 + (fxx - 14) * 0.35, 21.5); c.lineTo(fxx - 0.9, 33.6); c.lineTo(fxx + 0.9, 33.6);
          c.closePath(); c.fill();
        }
        c.beginPath();
        c.moveTo(x0, 31.4);
        for (i = 0; i < 5; i++) {
          var a = x0 + (x1 - x0) * i / 5, b = x0 + (x1 - x0) * (i + 1) / 5;
          c.quadraticCurveTo((a + b) / 2, 33.6 - (i === 2 ? 0.5 : 0), b, 31.4);
        }
        stroke(c, GOLD.c, 0.5);
        c.fillStyle = GOLD.c;
        fillStar(c, 2.6 + sw * 1.1, 29.4, 0.7);
        fillStar(c, 25.4 + sw * 1.1, 29.4, 0.7);
        fillStar(c, 4.2 + sw * 0.8, 26.2, 0.5);
        fillStar(c, 23.8 + sw * 0.8, 26.2, 0.5);
      });
      return;
    }
    for (var s2 = 0; s2 < 2; s2++) {
      var q = s2 ? -1 : 1, o = s2 ? 28 : 0;
      part(c, function () {
        c.beginPath();
        c.moveTo(o + q * (13.0 + q * tx), 20.4);
        c.quadraticCurveTo(o + q * 9.4, 19.2, o + q * 6.6, 20.6);
        c.quadraticCurveTo(o + q * 5.6, 22.4, o + q * 6.4, 24.0);
        c.quadraticCurveTo(o + q * 8.2, 24.2, o + q * 9.6, 23.2);
        c.quadraticCurveTo(o + q * 11.4, 22.8, o + q * (13.4 + q * tx), 21.6);
        c.closePath();
      }, R, 0.8, function () {
        c.beginPath();
        c.moveTo(o + q * 6.5, 23.5); c.quadraticCurveTo(o + q * 8.2, 23.7, o + q * 9.6, 22.7);
        c.quadraticCurveTo(o + q * 11.4, 22.3, o + q * (13.3 + q * tx), 21.1);
        stroke(c, GOLD.c, 0.42);
        gloss(c, o + q * 8.6, 20.6, 1.5, 0.4, q * 0.1, 0.35, R.l);
      });
    }
    part(c, function () { ell(c, 14 + tx, 21.0, 1.35, 1.1, 0); }, GOLD, 0.3);
    gem(c, 14 + tx, 21.0, 0.72, '#58b8ff');
  }

  /* ================================================================
     HELD ITEMS
     ================================================================ */
  var ITEM_S = 1.3;
  function drawItem(c, food, fx, fy, Z) {
    var sw = Z ? Z.charm : 0;
    if (food === 'iceCream') {
      /* waffle cone, two scoops, a drip and a cherry */
      part(c, function () { c.beginPath(); c.moveTo(fx - 1.9, fy + 1.8); c.lineTo(fx + 1.9, fy + 1.8); c.lineTo(fx, fy + 6.2); c.closePath(); }, ramp('#e0b070', false), 0.4, function () {
        c.beginPath();
        for (var k = -2; k <= 2; k++) { c.moveTo(fx + k * 0.9 - 1.5, fy + 1.8); c.lineTo(fx + k * 0.9 + 1.5, fy + 5.6); c.moveTo(fx + k * 0.9 + 1.5, fy + 1.8); c.lineTo(fx + k * 0.9 - 1.5, fy + 5.6); }
        stroke(c, '#9a7048', 0.22, 0.8);
      });
      part(c, function () {
        c.beginPath();
        c.moveTo(fx - 2.5, fy + 1.4);
        c.bezierCurveTo(fx - 3.0, fy - 1.6, fx + 3.0, fy - 1.6, fx + 2.5, fy + 1.4);
        c.quadraticCurveTo(fx + 2.0, fy + 2.5, fx + 1.3, fy + 1.9);
        c.quadraticCurveTo(fx + 0.6, fy + 3.3, fx - 0.2, fy + 2.0);
        c.quadraticCurveTo(fx - 1.2, fy + 2.7, fx - 2.5, fy + 1.4);
        c.closePath();
      }, ramp('#ffc8d4', false), 0.6, function () {
        gloss(c, fx - 1.0, fy - 0.1, 0.9, 0.5, -0.4, 0.7);
      });
      part(c, function () { ell(c, fx + 0.2, fy - 1.5, 1.9, 1.7, 0); }, ramp('#fff2c8', false), 0.5, function () {
        gloss(c, fx - 0.5, fy - 2.1, 0.7, 0.4, -0.4, 0.8);
        c.fillStyle = '#ff7aa8'; c.fillRect(fx + 0.6, fy - 1.6, 0.5, 0.22);
        c.fillStyle = '#6fc0ff'; c.fillRect(fx - 0.6, fy - 0.9, 0.5, 0.22);
        c.fillStyle = '#7ad88a'; c.fillRect(fx + 0.1, fy - 2.4, 0.22, 0.5);
      });
      c.beginPath(); c.moveTo(fx + 0.3, fy - 3.2); c.quadraticCurveTo(fx + 0.8, fy - 4.4, fx + 1.6, fy - 4.4);
      stroke(c, '#5a8a38', 0.3);
      part(c, function () { ell(c, fx + 0.3, fy - 3.3, 0.8, 0.8, 0); }, ramp('#ff3355', false), 0.3, function () { gloss(c, fx, fy - 3.6, 0.25, 0.18, 0, 0.9); });
    } else if (food === 'onigiri') {
      /* rice ball with a nori wrap and a happy face */
      part(c, function () {
        c.beginPath();
        c.moveTo(fx, fy - 2.4);
        c.bezierCurveTo(fx - 1.6, fy - 2.4, fx - 3.6, fy + 1.6, fx - 3.0, fy + 2.8);
        c.quadraticCurveTo(fx, fy + 3.7, fx + 3.0, fy + 2.8);
        c.bezierCurveTo(fx + 3.6, fy + 1.6, fx + 1.6, fy - 2.4, fx, fy - 2.4);
        c.closePath();
      }, ramp('#fffdf6', false), 0.7, function () {
        c.fillStyle = '#263a2c';
        c.beginPath();
        c.moveTo(fx - 1.8, fy + 1.4); c.lineTo(fx + 1.8, fy + 1.4); c.lineTo(fx + 2.1, fy + 4); c.lineTo(fx - 2.1, fy + 4);
        c.closePath(); c.fill();
        c.fillStyle = '#3e5a44';
        c.fillRect(fx - 1.7, fy + 1.4, 3.4, 0.4);
        c.fillStyle = INK;
        ell(c, fx - 0.95, fy + 0.1, 0.26, 0.32, 0); c.fill();
        ell(c, fx + 0.95, fy + 0.1, 0.26, 0.32, 0); c.fill();
        c.beginPath(); c.arc(fx, fy + 0.45, 0.42, 0.2, Math.PI - 0.2);
        stroke(c, INK, 0.2);
        c.fillStyle = 'rgba(255,120,150,0.5)';
        ell(c, fx - 1.7, fy + 0.6, 0.45, 0.28, 0); c.fill();
        ell(c, fx + 1.7, fy + 0.6, 0.45, 0.28, 0); c.fill();
        gloss(c, fx - 0.8, fy - 1.4, 0.5, 0.3, -0.5, 0.9);
      });
    } else if (food === 'donut') {
      part(c, function () { ell(c, fx, fy + 1, 2.4, 2.4, 0); }, ramp('#c88858', false), 0.5, function () {
        c.fillStyle = '#ff99cc';
        c.beginPath(); c.arc(fx, fy + 1, 2.2, Math.PI + 0.3, -0.3, false); c.quadraticCurveTo(fx, fy + 1.4, fx - 2.0, fy + 0.4); c.fill();
        c.fillStyle = '#ffff66'; c.fillRect(fx - 1, fy - 0.2, 0.4, 0.4);
        c.fillStyle = '#66ddff'; c.fillRect(fx + 0.8, fy, 0.4, 0.4);
        c.fillStyle = '#ff66aa'; c.fillRect(fx - 0.2, fy + 0.5, 0.4, 0.4);
      });
      ell(c, fx, fy + 1, 0.75, 0.7, 0);
      c.fillStyle = '#ffe4b0'; c.fill(); stroke(c, '#8a5a32', 0.25);
    } else if (food === 'crepe') {
      /* rolled crepe in a paper sleeve: cream, strawberries, a wafer */
      part(c, function () {
        c.beginPath();
        c.moveTo(fx - 2.6, fy - 1.6); c.quadraticCurveTo(fx, fy - 0.4, fx + 2.6, fy - 1.6); c.lineTo(fx + 0.2, fy + 5.2);
        c.closePath();
      }, ramp('#f2d49a', false), 0.6, function () {
        c.beginPath();
        c.moveTo(fx - 0.6, fy - 0.9); c.quadraticCurveTo(fx + 0.4, fy + 2.0, fx + 0.2, fy + 5.0);
        stroke(c, '#c89a58', 0.3, 0.8);
      });
      part(c, function () {
        c.beginPath();
        c.moveTo(fx - 1.9, fy + 1.0); c.lineTo(fx + 1.9, fy + 0.6); c.lineTo(fx + 0.2, fy + 5.6);
        c.closePath();
      }, ramp('#ff9ec8', false), 0.4, function () {
        c.fillStyle = '#ffffff';
        ell(c, fx - 0.3, fy + 2.2, 0.32, 0.32, 0); c.fill();
        ell(c, fx + 0.5, fy + 3.2, 0.28, 0.28, 0); c.fill();
        ell(c, fx + 0.7, fy + 1.6, 0.26, 0.26, 0); c.fill();
      });
      part(c, function () {
        c.beginPath();
        c.moveTo(fx - 2.5, fy - 1.5);
        c.quadraticCurveTo(fx - 2.6, fy - 3.2, fx - 1.2, fy - 3.0);
        c.quadraticCurveTo(fx - 0.4, fy - 4.2, fx + 0.6, fy - 3.2);
        c.quadraticCurveTo(fx + 2.6, fy - 3.4, fx + 2.5, fy - 1.5);
        c.quadraticCurveTo(fx, fy - 0.5, fx - 2.5, fy - 1.5);
        c.closePath();
      }, ramp('#fffaf0', false), 0.4, function () { gloss(c, fx - 1.2, fy - 2.4, 0.6, 0.3, -0.3, 0.9); });
      part(c, function () { c.beginPath(); c.moveTo(fx + 0.6, fy - 1.8); c.lineTo(fx + 1.4, fy - 5.0); c.lineTo(fx + 2.1, fy - 4.8); c.lineTo(fx + 1.5, fy - 1.7); c.closePath(); }, ramp('#d8a060', false), 0.3);
      part(c, function () { c.beginPath(); c.moveTo(fx - 1.9, fy - 2.6); c.quadraticCurveTo(fx - 0.9, fy - 3.9, fx + 0.1, fy - 2.5); c.quadraticCurveTo(fx - 0.9, fy - 0.9, fx - 1.9, fy - 2.6); c.closePath(); }, ramp('#e8344a', false), 0.3, function () {
        c.fillStyle = '#fff4a8';
        ell(c, fx - 1.1, fy - 2.5, 0.14, 0.18, 0); c.fill();
        ell(c, fx - 0.6, fy - 2.0, 0.14, 0.18, 0); c.fill();
        gloss(c, fx - 1.3, fy - 3.0, 0.3, 0.18, -0.4, 0.8);
      });
    } else if (food === 'taiyaki') {
      part(c, function () {
        c.beginPath(); c.ellipse(fx, fy + 1, 3, 1.8, 0, 0, TAU);
        c.moveTo(fx + 2.4, fy + 1); c.lineTo(fx + 4.1, fy - 0.6); c.lineTo(fx + 4.1, fy + 2.6); c.closePath();
      }, ramp('#cc8844', false), 0.5, function () {
        c.beginPath(); c.moveTo(fx - 0.4, fy - 0.2); c.lineTo(fx + 0.4, fy + 2.2); c.moveTo(fx + 0.8, fy - 0.2); c.lineTo(fx + 1.6, fy + 2.2);
        stroke(c, '#a06030', 0.3);
        gloss(c, fx - 0.5, fy + 0.3, 1.6, 0.45, 0, 0.5, '#f0c080');
      });
      ell(c, fx - 1.8, fy + 0.5, 0.32, 0.32, 0); c.fillStyle = INK; c.fill();
    } else if (food === 'parfait') {
      /* layered sundae in a footed glass, cream, a wafer and a cherry */
      c.fillStyle = 'rgba(220,240,255,0.9)';
      c.fillRect(fx - 0.3, fy + 3.4, 0.6, 1.5);
      part(c, function () { ell(c, fx, fy + 5.0, 1.5, 0.45, 0); }, ramp('#d8ecfa', false), 0.2);
      part(c, function () {
        c.beginPath();
        c.moveTo(fx - 2.1, fy - 1.2); c.lineTo(fx + 2.1, fy - 1.2);
        c.quadraticCurveTo(fx + 1.8, fy + 2.8, fx, fy + 3.6);
        c.quadraticCurveTo(fx - 1.8, fy + 2.8, fx - 2.1, fy - 1.2);
        c.closePath();
      }, ramp('#fff4dc', false), 0.5, function () {
        c.fillStyle = '#7a4420'; c.fillRect(fx - 3, fy + 1.7, 6, 2.2);
        c.fillStyle = '#ffd24a'; c.fillRect(fx - 3, fy + 0.9, 6, 0.8);
        c.fillStyle = '#ff6688'; c.fillRect(fx - 3, fy - 0.3, 6, 1.2);
        c.fillStyle = 'rgba(255,255,255,0.55)';
        c.beginPath(); c.moveTo(fx - 1.6, fy - 1.0); c.lineTo(fx - 1.1, fy - 1.0); c.lineTo(fx - 0.7, fy + 2.6); c.lineTo(fx - 1.1, fy + 2.4); c.closePath(); c.fill();
      });
      part(c, function () { c.beginPath(); c.moveTo(fx + 0.5, fy - 1.4); c.lineTo(fx + 1.5, fy - 4.6); c.lineTo(fx + 2.2, fy - 4.4); c.lineTo(fx + 1.5, fy - 1.3); c.closePath(); }, ramp('#d8a060', false), 0.3);
      part(c, function () {
        c.beginPath();
        c.moveTo(fx - 2.2, fy - 1.1);
        c.quadraticCurveTo(fx - 2.2, fy - 2.6, fx - 0.9, fy - 2.5);
        c.quadraticCurveTo(fx - 0.2, fy - 3.8, fx + 0.8, fy - 2.6);
        c.quadraticCurveTo(fx + 2.3, fy - 2.6, fx + 2.2, fy - 1.1);
        c.closePath();
      }, ramp('#ffffff', false), 0.4, function () { gloss(c, fx - 1.0, fy - 2.0, 0.6, 0.3, -0.3, 0.9); });
      part(c, function () { ell(c, fx - 0.3, fy - 3.5, 0.7, 0.7, 0); }, ramp('#dd2244', false), 0.3, function () { gloss(c, fx - 0.55, fy - 3.75, 0.22, 0.16, 0, 0.9); });
    } else if (food === 'macaron') {
      /* a little stack of two macarons with ruffled feet */
      for (var mk = 0; mk < 2; mk++) {
        var my = fy + 1.6 - mk * 2.7, mx = fx + (mk ? 0.5 : 0), MC = ramp(mk ? '#bfe6c8' : '#ffb0d2', false);
        part(c, function () { ell(c, mx, my + 0.75, 2.5, 0.95, 0); }, MC, 0.4);
        c.fillStyle = mk ? '#fff6e0' : '#ffffff';
        c.beginPath();
        c.moveTo(mx - 2.5, my - 0.25);
        for (var mf = 0; mf < 6; mf++) c.arc(mx - 2.08 + mf * 0.83, my + 0.3, 0.42, Math.PI, 0, true);
        c.lineTo(mx + 2.5, my - 0.25);
        c.closePath(); c.fill();
        stroke(c, MC.ink, LW * 0.6, 0.7);
        part(c, function () {
          c.beginPath();
          c.moveTo(mx - 2.5, my); c.bezierCurveTo(mx - 2.6, my - 1.8, mx + 2.6, my - 1.8, mx + 2.5, my);
          c.quadraticCurveTo(mx, my + 0.5, mx - 2.5, my);
          c.closePath();
        }, MC, 0.5, function () { gloss(c, mx - 0.9, my - 0.85, 1.0, 0.28, -0.1, 0.7); });
      }
    } else if (food === 'strawberry') {
      part(c, function () { c.beginPath(); c.moveTo(fx - 2.1, fy - 1); c.quadraticCurveTo(fx - 1.6, fy + 3.2, fx, fy + 3.4); c.quadraticCurveTo(fx + 1.6, fy + 3.2, fx + 2.1, fy - 1); c.closePath(); }, ramp('#e8344a', false), 0.5, function () {
        c.fillStyle = '#fff4a8';
        ell(c, fx - 0.8, fy + 0.5, 0.22, 0.25, 0); c.fill();
        ell(c, fx + 0.6, fy + 0.3, 0.22, 0.25, 0); c.fill();
        ell(c, fx, fy + 1.6, 0.22, 0.25, 0); c.fill();
        ell(c, fx - 0.5, fy + 2.4, 0.2, 0.22, 0); c.fill();
        gloss(c, fx - 1.0, fy - 0.2, 0.4, 0.6, 0.3, 0.5);
      });
      part(c, function () { c.beginPath(); c.moveTo(fx - 2.3, fy - 1); c.lineTo(fx - 0.6, fy - 1.9); c.lineTo(fx, fy - 2.6); c.lineTo(fx + 0.6, fy - 1.9); c.lineTo(fx + 2.3, fy - 1); c.lineTo(fx, fy - 0.2); c.closePath(); }, ramp('#3caf3c', false), 0.3);
    } else if (food === 'lollipop') {
      c.beginPath(); c.moveTo(fx, fy + 1); c.lineTo(fx, fy + 5.4);
      stroke(c, '#c8b8a0', 0.9); c.beginPath(); c.moveTo(fx, fy + 1); c.lineTo(fx, fy + 5.4); stroke(c, '#ffffff', 0.5);
      part(c, function () { ell(c, fx, fy - 0.6, 2.5, 2.5, 0); }, ramp('#ff7ab8', false), 0.5, function () {
        c.beginPath();
        for (var k = 0; k < 28; k++) {
          var a = k * 0.42, r = k * 0.085;
          if (k === 0) c.moveTo(fx, fy - 0.6); else c.lineTo(fx + Math.cos(a) * r, fy - 0.6 + Math.sin(a) * r);
        }
        stroke(c, '#ffffff', 0.55);
        gloss(c, fx - 0.9, fy - 1.5, 0.7, 0.35, -0.5, 0.7);
      });
    } else if (food === 'dango') {
      c.beginPath(); c.moveTo(fx + 1.0, fy + 5.6); c.lineTo(fx - 0.6, fy - 4.4);
      stroke(c, '#b08a5a', 0.55);
      var dc = ['#a8d86c', '#fff8f0', '#ff9ab8'];
      for (var d = 0; d < 3; d++) {
        var dy = fy + 2.6 - d * 2.3, dx = fx + 0.6 - d * 0.36;
        part(c, function () { ell(c, dx, dy, 1.35, 1.25, 0); }, ramp(dc[d], false), 0.4, function () { gloss(c, dx - 0.45, dy - 0.45, 0.4, 0.25, -0.4, 0.8); });
      }
    } else if (food === 'cupcake') {
      part(c, function () { c.beginPath(); c.moveTo(fx - 2.0, fy + 0.8); c.lineTo(fx + 2.0, fy + 0.8); c.lineTo(fx + 1.4, fy + 3.8); c.lineTo(fx - 1.4, fy + 3.8); c.closePath(); }, ramp('#7ac8f0', false), 0.4, function () {
        c.beginPath();
        for (var k = -1; k <= 1; k++) { c.moveTo(fx + k * 1.0, fy + 0.8); c.lineTo(fx + k * 0.7, fy + 3.8); }
        stroke(c, '#4a98c0', 0.3);
      });
      part(c, function () {
        c.beginPath();
        c.moveTo(fx - 2.3, fy + 1.0);
        c.quadraticCurveTo(fx - 2.6, fy - 1.0, fx - 1.0, fy - 1.2);
        c.quadraticCurveTo(fx - 0.4, fy - 2.8, fx + 0.8, fy - 1.8);
        c.quadraticCurveTo(fx + 2.6, fy - 1.4, fx + 2.3, fy + 1.0);
        c.closePath();
      }, ramp('#ffd0e4', false), 0.5, function () { gloss(c, fx - 1.0, fy - 0.8, 0.8, 0.35, -0.3, 0.7); });
      part(c, function () { ell(c, fx + 0.2, fy - 2.6, 0.6, 0.6, 0); }, ramp('#e8344a', false), 0.3);
    } else if (food === 'teddy') {
      var B = ramp('#c8925a', false);
      part(c, function () {
        c.beginPath();
        c.ellipse(fx - 1.7, fy - 3.4, 0.85, 0.85, 0, 0, TAU);
        c.moveTo(fx + 2.55, fy - 3.4); c.ellipse(fx + 1.7, fy - 3.4, 0.85, 0.85, 0, 0, TAU);
      }, B, 0.4);
      part(c, function () { ell(c, fx, fy + 1.6, 2.1, 2.3, 0); }, B, 0.6, function () {
        ell(c, fx, fy + 2.0, 1.2, 1.3, 0); c.fillStyle = '#f0d0a0'; c.fill();
      });
      part(c, function () { ell(c, fx, fy - 1.8, 2.2, 2.0, 0); }, B, 0.6, function () {
        ell(c, fx, fy - 1.1, 0.95, 0.7, 0); c.fillStyle = '#f0d0a0'; c.fill();
        c.fillStyle = INK;
        ell(c, fx - 0.85, fy - 2.2, 0.26, 0.3, 0); c.fill();
        ell(c, fx + 0.85, fy - 2.2, 0.26, 0.3, 0); c.fill();
        ell(c, fx, fy - 1.35, 0.3, 0.2, 0); c.fill();
      });
      drawBow(c, ramp('#ff6f9e', false), fx, fy - 0.1, 0.4, false);
    } else if (food === 'roomKey') {
      /* a big brass room key with a numbered fob swinging from its ring */
      c.save();
      c.translate(fx, fy + 1.0);
      c.rotate(0.12);
      part(c, function () {
        c.beginPath();
        c.rect(-0.45, -0.6, 0.9, 5.6);
        c.rect(0.45, 3.0, 1.5, 0.75);
        c.rect(0.45, 4.2, 1.1, 0.75);
      }, GOLD, 0.3);
      part(c, function () {
        c.beginPath();
        c.arc(0, -2.6, 2.3, 0, TAU);
        c.moveTo(1.05, -2.6); c.arc(0, -2.6, 1.05, 0, TAU, true);
      }, GOLD, 0.6, function () {
        c.beginPath();
        c.arc(0, -2.6, 1.7, Math.PI * 1.05, Math.PI * 1.6);
        stroke(c, '#fff6c8', 0.38, 0.95);
      });
      part(c, function () { ell(c, 0, -0.5, 0.75, 0.5, 0); }, GOLD, 0.3);
      c.restore();
      var kx = fx - 2.2 + sw * 0.5, ky = fy + 1.8;
      c.beginPath(); c.moveTo(fx - 1.6, fy - 1.0); c.lineTo(kx + 0.4, ky - 1.2);
      stroke(c, GOLD.d, 0.28);
      c.save();
      c.translate(kx, ky);
      c.rotate(-0.3 - sw * 0.08);
      part(c, function () {
        c.beginPath();
        c.moveTo(-1.3, -1.3); c.lineTo(1.3, -1.3); c.lineTo(1.3, 1.3); c.quadraticCurveTo(0, 2.3, -1.3, 1.3);
        c.closePath();
      }, CAP_RED, 0.4, function () {
        c.fillStyle = GOLD.c;
        fillStar(c, 0, 0.3, 0.8);
        ell(c, 0, -0.85, 0.24, 0.24, 0); c.fillStyle = '#fff6e0'; c.fill();
      });
      c.restore();
    } else if (food === 'deskBell') {
      /* the front-desk call bell on her palm */
      part(c, function () { ell(c, fx, fy + 2.9, 3.3, 0.95, 0); }, ramp('#5a2a3a', false), 0.4);
      part(c, function () {
        c.beginPath();
        c.moveTo(fx - 2.9, fy + 2.5);
        c.bezierCurveTo(fx - 2.9, fy - 1.9, fx + 2.9, fy - 1.9, fx + 2.9, fy + 2.5);
        c.quadraticCurveTo(fx, fy + 3.5, fx - 2.9, fy + 2.5);
        c.closePath();
      }, GOLD, 0.9, function () {
        c.beginPath();
        c.moveTo(fx - 2.9, fy + 1.7); c.quadraticCurveTo(fx, fy + 2.7, fx + 2.9, fy + 1.7);
        stroke(c, GOLD.d, 0.3);
        c.beginPath();
        c.arc(fx, fy + 2.2, 2.3, Math.PI * 1.12, Math.PI * 1.45);
        stroke(c, '#fff6c8', 0.6, 0.95);
        gloss(c, fx + 1.0, fy + 0.2, 0.3, 0.5, 0.5, 0.5, '#fff6c8');
      });
      c.fillStyle = GOLD.d;
      c.fillRect(fx - 0.25, fy - 1.9, 0.5, 1.0);
      part(c, function () { ell(c, fx, fy - 2.1, 0.85, 0.55, 0); }, GOLD, 0.3, function () { gloss(c, fx - 0.25, fy - 2.3, 0.3, 0.14, 0, 0.95); });
      c.beginPath();
      c.moveTo(fx + 2.8, fy - 2.0); c.lineTo(fx + 3.8, fy - 3.0);
      c.moveTo(fx + 3.3, fy - 0.6); c.lineTo(fx + 4.6, fy - 0.9);
      c.moveTo(fx + 1.6, fy - 2.9); c.lineTo(fx + 2.0, fy - 4.2);
      stroke(c, '#fff0a0', 0.34, 0.95);
    } else if (food === 'suitcase') {
      /* a little travel case carried by its handle: straps, corner caps,
         a luggage tag and a heart sticker */
      var CS = ramp('#58b8c8', false);
      c.save();
      c.translate(fx, fy);
      c.rotate(-sw * 0.05);
      c.scale(0.8, 0.8);
      c.beginPath();
      c.moveTo(-1.5, 1.4); c.lineTo(-1.5, 0.2); c.quadraticCurveTo(0, -0.7, 1.5, 0.2); c.lineTo(1.5, 1.4);
      stroke(c, LEATHER.ink, 1.0);
      c.beginPath();
      c.moveTo(-1.5, 1.4); c.lineTo(-1.5, 0.2); c.quadraticCurveTo(0, -0.7, 1.5, 0.2); c.lineTo(1.5, 1.4);
      stroke(c, LEATHER.c, 0.55);
      part(c, function () {
        c.beginPath();
        c.moveTo(-3.3, 1.3); c.lineTo(3.3, 1.3); c.quadraticCurveTo(4.0, 1.3, 4.0, 2.0);
        c.lineTo(4.0, 6.0); c.quadraticCurveTo(4.0, 6.7, 3.3, 6.7); c.lineTo(-3.3, 6.7);
        c.quadraticCurveTo(-4.0, 6.7, -4.0, 6.0); c.lineTo(-4.0, 2.0); c.quadraticCurveTo(-4.0, 1.3, -3.3, 1.3);
        c.closePath();
      }, CS, 0.9, function () {
        c.fillStyle = LEATHER.c;
        c.fillRect(-2.6, 1, 0.8, 6); c.fillRect(1.8, 1, 0.8, 6);
        c.fillStyle = GOLD.c;
        c.fillRect(-2.7, 3.2, 1.0, 0.75); c.fillRect(1.7, 3.2, 1.0, 0.75);
        c.fillStyle = CS.d;
        c.fillRect(-4.2, 3.9, 8.4, 0.25);
        c.fillStyle = LEATHER.d;
        c.beginPath();
        c.moveTo(-4.1, 1.2); c.lineTo(-3.0, 1.2); c.lineTo(-4.1, 2.3);
        c.moveTo(4.1, 1.2); c.lineTo(3.0, 1.2); c.lineTo(4.1, 2.3);
        c.moveTo(-4.1, 6.8); c.lineTo(-3.0, 6.8); c.lineTo(-4.1, 5.7);
        c.moveTo(4.1, 6.8); c.lineTo(3.0, 6.8); c.lineTo(4.1, 5.7);
        c.fill();
        c.fillStyle = '#ff6f8e';
        heartPath(c, 0, 5.3, 0.8); c.fill();
        c.fillStyle = '#ffe27a';
        fillStar(c, 0.1, 2.6, 0.62);
        gloss(c, -0.6, 1.8, 1.0, 0.2, 0, 0.5, CS.l);
      });
      c.restore();
    } else if (food === 'bouquet') {
      /* posy in a paper wrap tied with a ribbon */
      var LF = ramp('#6cbc58', false);
      part(c, function () {
        c.beginPath();
        c.moveTo(fx - 2.6, fy - 0.6); c.quadraticCurveTo(fx - 1.0, fy - 2.2, fx - 0.2, fy - 0.4);
        c.moveTo(fx + 2.8, fy - 0.8); c.quadraticCurveTo(fx + 1.2, fy - 2.4, fx + 0.4, fy - 0.4);
        c.lineTo(fx + 2.8, fy - 0.8);
        c.moveTo(fx - 2.6, fy - 0.6); c.lineTo(fx - 0.2, fy - 0.4);
      }, LF, 0.3);
      var bq = [-1.7, -1.8, '#ff8fb8', 1.3, 1.6, -2.1, '#fff0a0', 1.25, 0, -3.4, '#c0a4ff', 1.35, -0.1, -1.2, '#ffffff', 1.1];
      for (var bi = 0; bi < bq.length; bi += 4) {
        var bxx = fx + bq[bi], byy = fy + bq[bi + 1], br = bq[bi + 3] * 0.52;
        part(c, function () {
          c.beginPath();
          for (var k = 0; k < 5; k++) {
            var b = k * TAU / 5 + bi;
            c.moveTo(bxx + Math.cos(b) * br * 1.1 + br, byy + Math.sin(b) * br * 1.1);
            c.arc(bxx + Math.cos(b) * br * 1.1, byy + Math.sin(b) * br * 1.1, br, 0, TAU);
          }
        }, ramp(bq[bi + 2], false), 0.4);
        ell(c, bxx, byy, br * 0.6, br * 0.6, 0); c.fillStyle = '#ffb83a'; c.fill();
      }
      part(c, function () {
        c.beginPath();
        c.moveTo(fx - 2.9, fy - 0.3); c.quadraticCurveTo(fx, fy + 1.1, fx + 3.1, fy - 0.5);
        c.lineTo(fx + 0.5, fy + 5.8); c.lineTo(fx - 0.3, fy + 5.8);
        c.closePath();
      }, ramp('#fff4e0', false), 0.6, function () {
        c.beginPath();
        c.moveTo(fx + 0.4, fy + 0.6); c.lineTo(fx + 0.2, fy + 5.6);
        stroke(c, '#e0c8a0', 0.3);
        c.fillStyle = '#ffd0e2';
        c.beginPath(); c.moveTo(fx - 2.9, fy - 0.3); c.lineTo(fx - 0.6, fy + 0.5); c.lineTo(fx - 1.0, fy + 2.6); c.closePath(); c.fill();
      });
      drawBow(c, ramp('#ff6f9e', false), fx + 0.1, fy + 3.5, 0.5, false, sw * 0.3);
    } else if (food === 'starWand') {
      /* star wand with streaming ribbons and a few sparkles */
      c.beginPath(); c.moveTo(fx + 0.7, fy + 5.8); c.lineTo(fx - 0.4, fy - 0.4);
      stroke(c, '#a85a8a', 1.05);
      c.beginPath(); c.moveTo(fx + 0.7, fy + 5.8); c.lineTo(fx - 0.4, fy - 0.4);
      stroke(c, '#ffb0d8', 0.6);
      for (var rk = 0; rk < 2; rk++) {
        var rx = sw * (0.6 + rk * 0.3), ry = rk * 1.3;
        part(c, function () {
          c.beginPath();
          c.moveTo(fx - 0.3, fy + 0.1);
          c.bezierCurveTo(fx - 2.4 + rx * 0.4, fy + 0.4 + ry, fx - 0.8 + rx * 0.7, fy + 2.6 + ry, fx - 3.2 + rx, fy + 3.6 + ry);
          c.lineTo(fx - 2.6 + rx, fy + 4.5 + ry);
          c.bezierCurveTo(fx + 0.2 + rx * 0.7, fy + 3.4 + ry, fx - 1.4 + rx * 0.4, fy + 1.4 + ry, fx + 0.1, fy + 1.0);
          c.closePath();
        }, ramp(rk ? '#8fd8ff' : '#ff8fc0', false), 0.3);
      }
      c.save();
      c.translate(fx - 0.6, fy - 2.4);
      c.rotate(-0.15);
      part(c, function () { starPath(c, 0, 0, 3.1, 0.5); }, GOLD, 0.7, function () {
        starPath(c, 0, 0.1, 1.7, 0.5); c.fillStyle = '#fff6c8'; c.fill();
        gloss(c, -1.0, -1.2, 0.5, 0.3, -0.5, 0.95);
      });
      c.restore();
      c.fillStyle = '#ffffff';
      sparklePath(c, fx + 2.6, fy - 3.8, 0.9); c.fill();
      sparklePath(c, fx - 3.4, fy - 0.8, 0.6); c.fill();
      sparklePath(c, fx + 2.0, fy - 0.4, 0.5); c.fill();
    } else if (food === 'pinwheel') {
      /* paper windmill that spins as she goes */
      c.beginPath(); c.moveTo(fx + 0.6, fy + 5.8); c.lineTo(fx - 0.3, fy - 2.2);
      stroke(c, '#8a6a4a', 1.0);
      c.beginPath(); c.moveTo(fx + 0.6, fy + 5.8); c.lineTo(fx - 0.3, fy - 2.2);
      stroke(c, '#f0dcb8', 0.55);
      var vc = ['#ff7aa8', '#ffd24a', '#6fc8ff', '#8ad88a'];
      c.save();
      c.translate(fx - 0.3, fy - 2.2);
      c.rotate((Z && Z.t ? Z.t : 0) * 5 + 0.3);
      for (var pv = 0; pv < 4; pv++) {
        var V = ramp(vc[pv], false);
        part(c, function () {
          c.beginPath();
          c.moveTo(0, 0);
          c.bezierCurveTo(0.4, -2.8, 3.2, -3.8, 4.6, -1.7);
          c.bezierCurveTo(3.2, -1.6, 1.5, -0.7, 0, 0);
          c.closePath();
        }, V, 0.6, function () {
          c.beginPath();
          c.moveTo(0.4, -0.6); c.quadraticCurveTo(1.6, -2.6, 3.6, -2.4);
          stroke(c, V.l, 0.4, 0.8);
        });
        c.rotate(Math.PI / 2);
      }
      part(c, function () { ell(c, 0, 0, 0.6, 0.6, 0); }, GOLD, 0.2, function () { gloss(c, -0.2, -0.2, 0.2, 0.14, 0, 0.95); });
      c.restore();
    } else if (food === 'balloon') {
      /* the balloon floats up and back on its string, lagging her moves */
      var bx = fx - 3.6 + sw * 1.1, by = fy - 13.6 + Math.abs(sw) * 0.3 + (Z ? Z.bob * 0.4 : 0);
      c.beginPath();
      c.moveTo(fx, fy + 0.4);
      c.quadraticCurveTo(fx - 1.0 + sw * 0.4, fy - 6.0, bx + 0.1, by + 3.4);
      stroke(c, '#ffffff', 0.3, 0.9);
      part(c, function () { heartPath(c, bx, by, 3.0); }, ramp('#ff4f86', false), 0.8, function () {
        gloss(c, bx - 1.3, by - 1.4, 0.8, 0.5, -0.6, 0.75);
      });
      part(c, function () { c.beginPath(); c.moveTo(bx - 0.5, by + 3.0); c.lineTo(bx + 0.5, by + 3.0); c.lineTo(bx, by + 2.4); c.closePath(); }, ramp('#ff4f86', false), 0.2);
    }
  }

  /* ================================================================
     POSE
     ================================================================ */
  function newPose() {
    return {
      mir: 1, look: 1, walk: 0, ph: 0, spd: 0, bob: 0, lean: 0, sq: 0, hop: 0, air: 0,
      stride: 0, duty: 0.5, run: 0, boost: 0,
      breath: 0, open: 1, gx: 0, gy: 0, tilt: 0, hip: 0,
      hair: 0, hairY: 0, skirt: 0, ear: 0, charm: 0, flut: 0,
      expr: 'open', act: null, actU: 0, actT: 0, t: 0, climb: 0,
      floss: false, phase: 0, eyes: null
    };
  }

  /* Pose for callers without a rig: walk frame 0 stands, 1..3 walk, and
     the wall clock drives breathing, a blink every few seconds, and a
     slow hair sway. */
  var FP = newPose();
  function framePose(frame, opts, t) {
    var P = FP, f = (frame || 0) % 4;
    P.t = t;
    P.walk = f !== 0 ? 1 : 0;
    P.ph = f * Math.PI / 2 + (f ? 0 : 0);
    P.spd = P.walk * 0.7;
    P.look = P.walk ? 0.85 : 0.35;
    P.mir = 1;
    P.bob = P.walk * 0.6 * (0.5 - 0.5 * Math.cos(2 * P.ph));
    P.stride = P.walk * (0.9 + 1.3 * P.spd) * (0.35 + 0.65 * P.look);
    P.duty = 0.5; P.run = 0;
    P.lean = P.walk * 0.04;
    P.breath = Math.sin(t * TAU / 3.2);
    var bt = t % 4.3;
    P.open = bt < 0.16 ? Math.abs(Math.cos(bt / 0.16 * Math.PI)) : 1;
    P.gx = 0.15; P.gy = 0;
    P.hair = Math.sin(t * 1.4) * 0.35 - P.walk * (0.8 + 0.4 * Math.sin(2 * P.ph));
    P.hairY = 0;
    P.skirt = -P.walk * 0.3;
    P.ear = Math.sin(t * 2.6) * 0.5;
    P.charm = Math.sin(t * 1.7) * 0.5 - P.walk * 0.8;
    P.flut = Math.sin(t * 3.1);
    P.tilt = 0; P.hip = 0; P.sq = 0; P.hop = 0; P.air = 0; P.climb = 0;
    P.act = null;
    P.floss = !!(opts && opts.pose === 'floss');
    P.phase = (opts && opts.phase) || 0;
    P.eyes = (opts && opts.eyes) || null;
    P.expr = 'open';
    return P;
  }

  /* ================================================================
     PAINT
     ================================================================ */
  var Z = { fx: 0, tx: 0, look: 0, ex1: 10.3, ex2: 17.7, ey: 13.2, open: 1, gx: 0, gy: 0, expr: 'open', charm: 0, ear: 0, bob: 0,
            face: 'none', flut: 0, hood: null, t: 0 };

  function paint(c, sx, sy, cust, Q) {
    var P = paletteFor(cust);
    var hairStyle = pick('hairStyle', cust && cust.hairStyle);
    var outfit = pick('outfit', cust && cust.outfit);
    var shoes = pick('shoes', cust && cust.shoes);
    var food = pick('food', cust && cust.food);
    var hat = pick('hat', cust && cust.hat);
    var extra = pick('extra', cust && cust.extra);
    var face = pick('face', cust && cust.face);
    var pajama = !!PJ[outfit];
    var dressR = P.suit;

    /* outline: about one device pixel at gameplay size, thinner in local
       units as she is drawn bigger so close-ups stay crisp */
    var u = 2;
    if (c.getTransform) { var m = c.getTransform(); u = Math.sqrt(m.a * m.a + m.b * m.b) || 2; }
    LW = Math.max(0.9, Math.min(3.0, u * 0.42)) / u;

    var t = Q.t, look = Q.look, walk = Q.walk;
    var floss = Q.floss;
    var expr = Q.eyes === 'sleep' ? 'sleep' : Q.expr;
    var beat = 0, hip = Q.hip;
    if (floss) {
      beat = Math.tanh(Math.sin(Q.phase) * 3.2);
      hip = beat * 1.6;
      look = 0.15;
      expr = 'grin';
    }
    var fx = look * 0.95, tx = look * 0.55;
    var breath = Q.breath * 0.16;
    var hs = Q.hair, hy = Q.hairY;

    /* ---- walk cycle: per-leg foot offset, lift and pitch ---- */
    /* each foot is planted for `duty` of the cycle (0.5 walking, less
       when she runs, leaving a short flight) and swings forward for the rest */
    var spd = Q.spd, run = Q.run, duty = Q.duty;
    var S = Q.stride;
    var LH = walk * (0.8 + 0.7 * spd + Q.climb * 1.6) + run * 0.8;
    var feet = [0, 0, 0, 0, 0, 0];   /* near x, lift, pitch, far x, lift, pitch */
    for (var leg = 0; leg < 2; leg++) {
      var uu = ((Q.ph / TAU) + (leg ? 0.5 : 0)) % 1;
      if (uu < 0) uu += 1;
      var fxo, lift, pr;
      if (uu < duty) {
        fxo = S * (1 - 2 * uu / duty); lift = 0; pr = 0;
      } else {
        var s = (uu - duty) / (1 - duty);
        fxo = -S + 2 * S * (0.5 - 0.5 * Math.cos(Math.PI * s));
        lift = Math.sin(Math.PI * Math.pow(s, 0.8)) * LH;
        pr = (s < 0.55 ? -0.4 * Math.sin(s / 0.55 * Math.PI) : 0.22 * Math.sin((s - 0.55) / 0.45 * Math.PI)) * walk * look;
      }
      feet[leg * 3] = fxo; feet[leg * 3 + 1] = lift; feet[leg * 3 + 2] = pr;
    }
    if (Q.air > 0) {
      var pad = Math.sin(t * 5.2);
      feet[1] = Math.max(feet[1], Q.air * (1.6 + 0.5 * pad)); feet[4] = Math.max(feet[4], Q.air * (1.1 - 0.5 * pad));
      feet[0] += Q.air * (0.6 + 0.4 * pad); feet[3] -= Q.air * (0.3 + 0.4 * pad);
      feet[2] += Q.air * 0.25 * pad; feet[5] -= Q.air * 0.25 * pad;
    }
    if (floss) { feet[0] = -hip * 0.2; feet[3] = -hip * 0.2; }

    var bob = Q.bob, hop = Q.hop;
    var bodyY = -bob - breath * 0.7;          /* upper body offset */
    var headY = bodyY - breath * 0.35 + hy * 0.05;
    var sqx = 1 + 0.04 * Q.sq, sqy = 1 - 0.05 * Q.sq;
    Z.fx = fx; Z.tx = tx; Z.look = look;
    Z.ex1 = 10.3 + fx * 1.15; Z.ex2 = 17.7 + fx * 0.85; Z.ey = 13.2;
    Z.open = Q.open; Z.gx = Q.gx + look * 0.35; Z.gy = Q.gy; Z.expr = expr;
    Z.charm = Q.charm; Z.ear = Q.ear; Z.bob = bob;
    Z.face = face; Z.flut = Q.flut; Z.hood = pajama ? PJ[outfit] : null; Z.t = t;

    c.save();
    c.translate(sx, sy);
    if (Q.mir < 0) { c.translate(28, 0); c.scale(-1, 1); }
    c.translate(0, -hop);
    c.translate(14, 34);
    c.scale(sqx, sqy);
    c.translate(-14, -34);

    /* the upper-body transform: bob, lean about the hips, floss sway */
    var lean = Q.lean + (floss ? beat * 0.07 : 0);
    function upper() {
      c.translate(hip * 0.6, bodyY);
      c.translate(14, 28.5);
      c.rotate(lean);
      c.translate(-14, -28.5);
    }
    function headXf() {
      c.translate(0, headY - bodyY);
      c.translate(14, 19.8);
      c.rotate(Q.tilt + lean * 0.4);
      c.translate(-14, -19.8);
      if (floss) c.translate(hip * 0.3, 0);
    }

    /* ---- arm poses ---- */
    var hasItem = food !== 'none';
    var nA1 = -0.3 + walk * look * 0.25, nA2 = 0.25, fA1 = 0.3 - walk * look * 0.25, fA2 = -0.25;
    var nH = 'rest', fH = 'rest';
    var sN = S > 0.01 ? feet[0] / S : 0;
    var amp = walk * (0.45 + 0.35 * spd) * (0.4 + 0.6 * look) * (1 + run * 0.35 + Q.boost * 0.2);
    nA1 += -amp * sN; nA2 += amp * Math.max(0, -sN) * 0.6 + run * 0.55;
    fA1 += amp * sN; fA2 += amp * Math.max(0, sN) * 0.6 - run * 0.55;
    if (Q.air > 0) { var fl = Math.sin(t * 3.4) * 0.18; nA1 -= Q.air * (0.6 + fl); fA1 += Q.air * (0.6 + fl); }
    if (Q.climb > 0) { fA1 = 1.1 + 0.1 * Math.sin(Q.ph); fA2 = -0.5; fH = 'fist'; }
    /* idle: arms settle slightly behind / clasp loosely */
    var idleW = 1 - walk;
    nA1 += idleW * Math.sin(t * TAU / 3.2) * 0.03;
    fA1 -= idleW * Math.sin(t * TAU / 3.2) * 0.03;
    var act = Q.act, au = Q.actU, ae = 0;
    if (act) ae = smooth(au / 0.18) * (1 - smooth((au - 0.8) / 0.2));
    if (act === 'pet') {
      fA1 += (1.25 - fA1) * ae; fA2 += (0.2 - fA2) * ae + Math.sin(Q.actT * 15) * 0.18 * ae;
      fH = ae > 0.4 ? 'open' : fH;
      lean += 0.07 * ae;
      if (ae > 0.3) expr = 'happy';
    } else if (act === 'cheer' || act === 'pose') {
      var up = act === 'cheer' ? 2.25 : 1.0;
      nA1 += (-up - nA1) * ae; nA2 += ((act === 'cheer' ? -0.25 : 0.35) - nA2) * ae;
      fA1 += (up - fA1) * ae; fA2 += ((act === 'cheer' ? 0.25 : -0.35) - fA2) * ae;
      if (act === 'cheer') { nA2 += Math.sin(Q.actT * 18) * 0.15 * ae; fA2 -= Math.sin(Q.actT * 18) * 0.15 * ae; }
      nH = fH = ae > 0.4 ? 'open' : 'rest';
      if (ae > 0.2) expr = act === 'cheer' ? 'grin' : 'happy';
    } else if (act === 'wave') {
      fA1 += (2.3 - fA1) * ae; fA2 += (-0.1 + Math.sin(Q.actT * 13) * 0.4 - fA2) * ae;
      fH = ae > 0.3 ? 'open' : fH;
      if (ae > 0.3) expr = 'happy';
    } else if (act === 'surprise') {
      nA1 += (-0.7 - nA1) * ae; fA1 += (0.7 - fA1) * ae;
      nH = fH = 'open';
      if (ae > 0.2) expr = 'wide';
    }
    /* held items set the near arm (unless she is cheering with it) */
    if (hasItem && act !== 'cheer') {
      var hw = 1 - (act === 'pose' ? ae : 0);
      if (food === 'balloon') { nA1 += (-1.75 - nA1) * hw; nA2 += (0.35 - nA2) * hw; }
      else if (food === 'teddy') { nA1 += (0.55 - nA1) * hw; nA2 += (1.45 - nA2) * hw; }
      else if (food === 'suitcase') { nA1 += (-0.22 - nA1) * hw; nA2 += (0.12 - nA2) * hw; }
      else { nA1 += (-0.55 - nA1) * hw; nA2 += (-0.95 - nA2) * hw; }
      nA1 += Math.sin(Q.ph) * 0.05 * walk;
      nH = 'fist';
    }
    if (floss) {
      var ad = -beat;
      var wob = Math.sin(Q.phase * 2) * 0.3;
      var tN = Math.atan2(14 + ad * 7.6 + hip * 0.6 - 8.7, 27.6 + wob - 21.4);
      var tF = Math.atan2(14 + ad * 10.2 + hip * 0.5 - 19.3, 25.4 - wob - 21.4);
      nA1 = tN; nA2 = 0.05; fA1 = tF; fA2 = 0.05; nH = fH = 'open';
    }

    var sleeveR = null, wide = null, puff = true;
    if (pajama) { sleeveR = pjLimb(outfit, P); sleeveR = { c: sleeveR.c, m: sleeveR.m, d: sleeveR.d, l: sleeveR.l, ink: sleeveR.ink, cuff: ramp(mix(sleeveR.c, '#ffffff', 0.35), false) }; puff = false; }
    else if (outfit === 'bellhop') { sleeveR = { c: dressR.c, m: dressR.m, d: dressR.d, l: dressR.l, ink: dressR.ink, cuff: GOLD }; puff = false; }
    else if (outfit === 'kimono') { wide = { wide: { c: dressR.c, m: dressR.m, d: dressR.d, l: dressR.l, ink: dressR.ink, dots: true } }; puff = false; }
    else if (outfit === 'tutu') puff = false;
    var puffR = outfit === 'overalls' ? P.white : outfit === 'zookeeper' ? KHAKI : dressR;
    var frillC = outfit === 'frillyDress' || outfit === 'maid' ? P.white.c : outfit === 'princess' ? GOLD.c : null;
    var sleeveArg = wide || sleeveR;
    var farBehind = look > 0.35 && !floss && act !== 'pet' && act !== 'wave' && act !== 'cheer';
    var shN = [8.7 + tx * 0.3, 21.4], shF = [19.3 - tx * 0.5, 21.4];

    /* ---------------- back layers ---------------- */
    if (extra === 'cape') { c.save(); upper(); drawCape(c, P, 'back', Z, Q.skirt * 0.6 + hs * 0.25); c.restore(); }
    c.save();
    upper();
    headXf();
    drawHatBack(c, P, hat, Z.hood, Z);
    c.translate(-look * 0.8, 0);
    var w = Q.flut;
    if (hairStyle === 'longBraids') {
      drawBraid(c, P, hs, w);
      c.save(); c.translate(28, 0); c.scale(-1, 1); drawBraid(c, P, -hs * 0.85, -w); c.restore();
    } else if (hairStyle === 'buns') {
      for (var rb = 0; rb < 2; rb++) {
        c.save();
        if (rb) { c.translate(28, 0); c.scale(-1, 1); }
        var rs = rb ? -hs * 0.8 : hs;
        part(c, function () {
          c.beginPath();
          c.moveTo(4.2, 5.4);
          c.quadraticCurveTo(1.0 + rs * 0.5, 13, 1.8 + rs + w * 0.3, 22.4);
          c.lineTo(3.0 + rs, 21.0);
          c.lineTo(4.4 + rs - w * 0.2, 22.2);
          c.quadraticCurveTo(4.6 + rs * 0.5, 13, 6.6, 5.6);
          c.closePath();
        }, P.suit, 0.8);
        c.restore();
      }
    } else if (hairStyle === 'ponytail') {
      drawPonytail(c, P, hs * 1.15, w, hy);
    } else if (hairStyle === 'longHair' || hairStyle === 'hime') {
      drawLongHair(c, P, hs * 0.9, w);
    } else if (hairStyle === 'wavy') {
      drawWavy(c, P, hs * 0.9, w);
    } else if (hairStyle === 'twinTails') {
      c.save();
      c.translate(0, 4.6); c.scale(1, 1 - hy * 0.035); c.translate(0, -4.6);
      drawTail(c, P, hs, w);
      c.save(); c.translate(28, 0); c.scale(-1, 1); drawTail(c, P, -hs * 0.85, -w); c.restore();
      c.restore();
    } else if (hairStyle === 'sideTail') {
      /* one big tail, a size up, rooted on the side of the crown */
      c.save();
      c.translate(5.6, 4.8); c.scale(1.22, 1.16 - hy * 0.04); c.translate(-6.2, -4.6);
      drawTail(c, P, hs * 0.9, w);
      c.restore();
    } else if (hairStyle === 'lowTails') {
      drawLowTail(c, P, hs * 0.7, w);
      c.save(); c.translate(28, 0); c.scale(-1, 1); drawLowTail(c, P, -hs * 0.6, -w); c.restore();
    } else if (hairStyle === 'curls') {
      drawRinglet(c, P, hs * 0.8, w);
      c.save(); c.translate(28, 0); c.scale(-1, 1); drawRinglet(c, P, -hs * 0.7, -w); c.restore();
    }
    if (hairStyle === 'bob') part(c, function () { bobPath(c, hs * 0.25); }, P.nape, 1.2);
    else if (hairStyle === 'pixie') part(c, function () { pixiePath(c, hs * 0.2); }, P.hair, 1.2);
    else part(c, function () { backHairPath(c); }, P.nape, 1);
    c.restore();

    /* worn on her back, over the hair that falls there */
    if (extra === 'backpack') { c.save(); upper(); drawBackpack(c, P, Z); c.restore(); }
    if (extra === 'wings') { c.save(); upper(); drawWings(c, P, Z); c.restore(); }
    if (extra === 'scarf') { c.save(); upper(); drawScarf(c, P, 'back', Z); c.restore(); }
    if (pajama) { c.save(); upper(); drawOnesieTail(c, P, outfit, hs * 0.6, w); c.restore(); }

    /* far arm passes behind the body when she is turned side-on */
    if (farBehind) {
      c.save(); upper();
      drawArm(c, P, shF[0], shF[1], fA1, fA2, fH, -1, sleeveArg, Q.skirt);
      c.restore();
    }

    /* ---------------- legs and shoes ---------------- */
    var hipY = 27.6 - bob - breath * 0.4;
    var legs = [[11.6 + hip, feet[0], feet[1], feet[2]], [16.4 + hip, feet[3], feet[4], feet[5]]];
    var legR = pajama ? pjLimb(outfit, P) : P.skin;
    var sockR = pajama || shoes === 'flipper' || shoes === 'highBoot' || shoes === 'ballet' || shoes === 'sandal' || shoes === 'paw'
              ? null : P.white;
    var tl = 0.25 + 0.75 * look;
    for (var li = 1; li >= 0; li--) {
      var L = legs[li];
      var hxL = L[0], ax = (li ? 16.4 : 11.6) + L[1], ay = 33.0 - L[2];
      drawLeg(c, legR, hxL, hipY, ax, ay, 1, pajama, sockR, !pajama);
      if (pajama) {
        var cf = ramp(mix(legR.c, '#ffffff', 0.35), false);
        part(c, function () { ell(c, ax, ay - 0.4, 1.45, 0.65, 0); }, cf, 0.3);
      }
      drawShoe(c, P, shoes, ax - 0.2, ay, tl, L[3], Q.ear);
    }

    /* ---------------- outfit ---------------- */
    c.save();
    upper();
    if (pajama) {
      drawOnesie(c, P, outfit, tx);
    } else {
      var flare = walk * 0.3 + Q.air * 0.8 + Math.abs(hop) * 0.12;
      drawSkirt(c, P, outfit, floss ? -hip * 0.3 : Q.skirt, flare, dressR);
      drawBodice(c, P, outfit, dressR, tx);
    }
    if (extra === 'apron') drawApron(c, P, Z, pajama ? 0 : Q.skirt);
    if (extra === 'satchel') drawSatchel(c, P, Z, false);
    if (extra === 'nameBadge') drawBadge(c, tx);
    if (extra === 'necklace') drawNecklace(c, Z);
    if (extra === 'scarf') drawScarf(c, P, 'front', Z);
    if (extra === 'backpack') {
      /* a strap over each shoulder */
      var strapR = ramp(mix(P.suit.c, '#ffffff', 0.62), false);
      for (var st = 0; st < 2; st++) {
        c.beginPath();
        if (st) { c.moveTo(18.4, 20.8); c.quadraticCurveTo(17.4, 22.6, 18.0, 24.6); }
        else { c.moveTo(9.6, 20.8); c.quadraticCurveTo(10.6, 22.6, 10.0, 24.6); }
        stroke(c, strapR.ink, 1.0);
        c.beginPath();
        if (st) { c.moveTo(18.4, 20.8); c.quadraticCurveTo(17.4, 22.6, 18.0, 24.6); }
        else { c.moveTo(9.6, 20.8); c.quadraticCurveTo(10.6, 22.6, 10.0, 24.6); }
        stroke(c, strapR.c, 0.58);
      }
    }

    /* ---------------- arms ---------------- */
    if (!farBehind) drawArm(c, P, shF[0], shF[1], fA1, fA2, fH, -1, sleeveArg, Q.skirt);
    if (puff) drawSleeve(c, shF[0] + 0.1, 21.4, puffR, frillC);
    if (food === 'teddy' && act !== 'cheer') {
      c.save();
      c.translate(11.6 + tx * 0.5, 25.4);
      c.scale(1.2, 1.2);
      drawItem(c, 'teddy', 0, -1.2, Z);
      c.restore();
    }
    var g = drawArm(c, P, shN[0], shN[1], nA1, nA2, nH, -1, sleeveArg, Q.skirt);
    if (puff) drawSleeve(c, shN[0] - 0.1, 21.4, puffR, frillC);
    if (hasItem && food !== 'teddy') {
      var ix = g.wx + Math.cos(g.ang) * 1.1, iy = g.wy + Math.sin(g.ang) * 1.1;
      if (food === 'balloon') drawItem(c, food, ix, iy, Z);
      else {
        /* drawn a size up about her grip, so it reads at corridor scale */
        var lw0 = LW;
        LW = lw0 / ITEM_S;
        c.save();
        c.translate(ix, iy);
        c.scale(ITEM_S, ITEM_S);
        if (food === 'suitcase') drawItem(c, food, 0, -0.4, Z);
        else drawItem(c, food, -0.5, -2.2, Z);
        c.restore();
        LW = lw0;
      }
    } else if (food === 'teddy' && act === 'cheer') {
      drawItem(c, 'teddy', g.wx, g.wy - 3, Z);
    }
    if (extra === 'satchel') drawSatchel(c, P, Z, true);
    if (extra === 'cape') drawCape(c, P, 'front', Z, 0);

    /* ---------------- head ---------------- */
    headXf();
    part(c, function () {
      c.beginPath();
      c.rect(12.8 + tx * 0.4, 17.6, 2.4, 3.0);
    }, P.skin, 0.4, function () {
      c.fillStyle = P.skin.m;
      c.fillRect(12, 17.6, 4, 2.6);
    }, true);
    drawFace(c, P, Z);
    if (extra === 'glasses' || extra === 'heartGlasses' || extra === 'starShades') drawGlasses(c, Z, extra);
    if (hairStyle === 'bob' || hairStyle === 'hime') {
      var lockPath = hairStyle === 'bob' ? bobLockPath : himeLockPath;
      part(c, function () { lockPath(c, hs * 0.2); }, P.hair, 1);
      c.save(); c.translate(28, 0); c.scale(-1, 1);
      part(c, function () { lockPath(c, -hs * 0.2); }, P.hair, 1);
      c.restore();
    }
    drawCap(c, P, Q.ear * 0.8, fx, hs);
    if (hairStyle === 'buns' && pajama) drawBuns(c, P);
    if (pajama) drawHood(c, P, outfit, Q.ear, Q.ear * 0.6);
    var bowTw = Q.charm * 0.35;
    if (hairStyle === 'buns') {
      if (!pajama) drawBuns(c, P);
      drawBow(c, P.suit, 8.4, 5.2, 0.6, false, bowTw);
      drawBow(c, P.suit, 19.6, 5.2, 0.6, true, -bowTw);
    } else if ((hairStyle === 'twinTails' || hairStyle === 'curls') && !pajama) {
      drawBow(c, P.suit, 5.6 - look * 0.8, 5.2, 0.75, false, bowTw);
      drawBow(c, P.suit, 22.4 - look * 0.8, 5.2, 0.75, true, -bowTw);
    } else if (hairStyle === 'twinTails' || hairStyle === 'curls') {
      drawBow(c, P.suit, 4.6, 12.6, 0.6, false, bowTw);
      drawBow(c, P.suit, 23.4, 12.6, 0.6, true, -bowTw);
    } else if (hairStyle === 'sideTail') {
      if (pajama) drawBow(c, P.suit, 4.6, 12.6, 0.7, false, bowTw);
      else drawBow(c, P.suit, 5.2 - look * 0.8, 5.0, 1.0, false, bowTw);
    } else if (hairStyle === 'lowTails') {
      drawBobbles(c, P.suit, 5.6 - look * 0.5, 14.0);
      c.save(); c.translate(28, 0); c.scale(-1, 1); drawBobbles(c, P.suit, 5.6 + look * 0.5, 14.0); c.restore();
    } else if (hairStyle === 'longBraids' && !pajama) {
      drawBow(c, P.suit, 5.0 - look * 0.6, 7.6, 0.5, false, bowTw);
      drawBow(c, P.suit, 23.0 - look * 0.6, 7.6, 0.5, true, -bowTw);
    }
    if (hat !== 'none') drawHat(c, P, hat, Z.hood, Z);
    c.restore();

    c.restore();
  }

  /* ================================================================
     RIG
     ================================================================ */
  function Spring(k, d) { this.k = k; this.d = d; this.x = 0; this.v = 0; }
  Spring.prototype.step = function (target, force, dt) {
    var a = this.k * (target - this.x) - this.d * this.v + force;
    this.v += a * dt;
    this.x += this.v * dt;
  };

  function Rig(id, o) {
    this.id = id;
    this.vmax = (o && o.vmax) || 190;
    this.scale = (o && o.scale) || 1.4;        /* screen px per sprite unit where she is drawn */
    this.pose = newPose();
    this.hair = new Spring(70, 5.2);
    this.hairY = new Spring(120, 7);
    this.skirt = new Spring(150, 9);
    this.ear = new Spring(95, 5.5);
    this.charm = new Spring(38, 3.2);
    this.sqS = new Spring(260, 15);
    this.puffs = [];                           /* turbo dust puffs, world px */
    for (var i = 0; i < 6; i++) this.puffs.push({ x: 0, y: 0, age: -1, dir: 1, k: 1 });
    this.reset();
  }
  Rig.prototype.reset = function () {
    this.last = 0; this.px = null; this.py = null;
    this.vx = 0; this.vy = 0; this.ax = 0; this.ay = 0;
    this.L = 0.5; this.Lv = 0; this.walk = 0; this.ph = 0; this.time = 0;
    this.idle = 0; this.moving = false;
    this.nextBlink = 1.5; this.blinkT = -1; this.dbl = false;
    this.nextGlance = 3.5; this.glanceT = -1; this.glX = 0; this.glY = 0;
    this.nextShift = 6; this.shiftT = -1; this.shiftDir = 1;
    this.act = null; this.actT = 0; this.actDur = 0;
    this.prevBob = 0; this.bobV = 0;
    this.boost = 0; this.hc = 0; this.puffI = 0;
    for (var i = 0; i < this.puffs.length; i++) this.puffs[i].age = -1;
    this.hair.x = this.hair.v = this.hairY.x = this.hairY.v = 0;
    this.skirt.x = this.skirt.v = this.ear.x = this.ear.v = 0;
    this.charm.x = this.charm.v = this.sqS.x = this.sqS.v = 0;
  };
  /* One-shot action: 'pet', 'cheer', 'wave', 'pose', 'surprise'. */
  Rig.prototype.play = function (kind, dur) {
    this.act = kind;
    this.actT = 0;
    this.landed = false;
    this.tookOff = false;
    this.actDur = dur || ({ pet: 1.3, cheer: 1.4, wave: 1.2, pose: 0.9, surprise: 0.9 })[kind] || 1;
    if (kind === 'cheer' || kind === 'pose') { this.ear.v += 6; }
    if (kind === 'surprise') { this.hairY.v -= 10; this.sqS.v -= 6; }
    return this;
  };
  /* Feed her position (world px, feet), the direction she faces and, for
     cutscenes, extras: { air: 0..1, ride: true (carried, so vertical
     motion is not walking), gaze: [x, y], climb: 0..1, expr, eyes,
     boost: the turbo speed multiplier, 1..2 }. */
  Rig.prototype.update = function (x, y, facing, o) {
    var dt;
    if (o && o.dt) {
      dt = o.dt;                                 /* fixed step (tests, contact sheets) */
    } else {
      var now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
      dt = this.last ? now - this.last : 1 / 60;
      if (dt < 0.002) return this.pose;          /* same frame, already posed */
      this.last = now;
      if (dt > 0.05) dt = 0.05;
    }
    var Q = this.pose;
    this.time += dt;
    var t = this.time;
    if (this.px === null || Math.abs(x - this.px) > 60 || Math.abs(y - this.py) > 60) {
      this.px = x; this.py = y; this.vx = 0; this.vy = 0; this.ax = 0; this.ay = 0;
      this.L = facing >= 0 ? 0.6 : -0.6;
    }
    var rvx = (x - this.px) / dt, rvy = (y - this.py) / dt;
    this.px = x; this.py = y;
    var k = Math.min(1, dt * 18);
    var nvx = this.vx + (rvx - this.vx) * k, nvy = this.vy + (rvy - this.vy) * k;
    this.ax += ((nvx - this.vx) / dt - this.ax) * Math.min(1, dt * 12);
    this.ay += ((nvy - this.vy) / dt - this.ay) * Math.min(1, dt * 12);
    this.vx = nvx; this.vy = nvy;
    var vm = this.vmax;
    var spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy * (o && (o.air || o.ride) ? 0 : 1));
    var spdN = Math.min(1, spd / vm);
    var climb = (o && o.climb) || 0;
    if (climb) spdN = Math.max(spdN, 0.55);
    var moving = spd > 14 || climb > 0;
    var wantWalk = moving ? Math.min(1, 0.35 + spdN * 1.2) : 0;
    if (o && o.air) wantWalk *= 1 - o.air;
    this.walk += (wantWalk - this.walk) * Math.min(1, dt * (wantWalk > this.walk ? 12 : moving ? 7 : 9));
    if (moving && !this.moving) { this.sqS.v += 7; }               /* push-off dip */
    if (!moving && this.moving) { this.sqS.v += 5; this.idle = 0; } /* settle on stop */
    this.moving = moving;
    /* turbo: past her top speed (the long-hold 2x) she stretches into a
       longer, leaning run with streaming hair, not quicker steps */
    var bw = moving && o && o.boost ? clamp(o.boost - 1, 0, 1) : 0;
    this.boost += (bw - this.boost) * Math.min(1, dt * 6);
    var tb = this.boost;
    /* gait: the stride and duty set how far one cycle carries her, and the
       cadence follows the ground she covers so planted feet stay put, up
       to a quick little-kid trot; faster than that she runs (shorter
       contact, a flight bounce, pumping arms) instead of blurring steps */
    var run = this.walk * smooth((spdN - 0.4) / 0.5) * (1 - climb);
    var duty = 0.5 - 0.22 * run;
    var stride = this.walk * (1.1 + 1.7 * spdN) * (0.35 + 0.65 * Math.min(1, Math.abs(this.L))) * (1 + climb * 0.3) * (1 + 0.35 * run) * (1 + 0.3 * tb);
    var vu = spd / this.scale;
    /* a full-speed run tops out near 3 strides a second: faster than
       that the legs, arms and bounce flicker instead of reading as a run */
    var cad = Math.min(1.6 + vu / 45, 4.4 - 1.3 * run + 0.25 * tb);
    if (stride > 0.05) cad = Math.min(cad, vu * duty / (2 * stride));
    if (!moving) cad = 2.4;                    /* settling steps as the stride shrinks */
    if (this.walk > 0.02) this.ph = (this.ph + dt * cad * TAU) % TAU;
    else this.ph += (Math.round(this.ph / Math.PI) * Math.PI - this.ph) * Math.min(1, dt * 8);
    /* a soft dust puff from each footfall in turbo */
    var hc = Math.floor(this.ph / Math.PI), pf;
    for (var pi = 0; pi < this.puffs.length; pi++) if (this.puffs[pi].age >= 0) this.puffs[pi].age += dt;
    if (hc !== this.hc) {
      this.hc = hc;
      if (tb > 0.08 && !(o && (o.air || o.ride))) {
        pf = this.puffs[this.puffI]; this.puffI = (this.puffI + 1) % this.puffs.length;
        pf.dir = this.vx >= 0 ? 1 : -1;
        pf.x = x - pf.dir * 3 * this.scale; pf.y = y; pf.age = 0; pf.k = 0.5 + 0.5 * tb;
      }
    }

    /* head turn: a critically damped spring through the front view */
    var lt = facing * (this.walk > 0.15 ? 1 : 0.55);
    var prevSign = this.L >= 0 ? 1 : -1;
    var w0 = 20;
    this.Lv += (w0 * w0 * (lt - this.L) - 2 * w0 * this.Lv) * dt;
    this.L += this.Lv * dt;
    var sign = this.L >= 0 ? 1 : -1;
    if (sign !== prevSign) { this.hair.v += -sign * 18; this.skirt.v += -sign * 8; this.sqS.v += 4; this.charm.v += -sign * 6; }

    /* idle life */
    if (!moving && !this.act) this.idle += dt; else this.idle = 0;
    if (t > this.nextBlink && this.blinkT < 0) { this.blinkT = 0; }
    var open = 1;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      var bu = this.blinkT / 0.15;
      open = bu < 1 ? Math.abs(Math.cos(bu * Math.PI)) : 1;
      if (bu >= 1) {
        this.blinkT = -1;
        if (!this.dbl && Math.random() < 0.22) { this.dbl = true; this.nextBlink = t + 0.12; }
        else { this.dbl = false; this.nextBlink = t + 2.2 + Math.random() * 3.2; }
      }
    }
    var gx = 0, gy = 0, gTurn = 0;
    if (this.idle > 1.2 && t > this.nextGlance && this.glanceT < 0) {
      this.glanceT = 0;
      this.glX = Math.random() < 0.5 ? -1 : 1;
      this.glY = Math.random() < 0.4 ? -0.8 : 0.15;
    }
    if (this.glanceT >= 0) {
      this.glanceT += dt;
      var ge = smooth(this.glanceT / 0.18) * (1 - smooth((this.glanceT - 1.1) / 0.25));
      gx = this.glX * ge; gy = this.glY * ge; gTurn = this.glX * 0.3 * ge;
      if (this.glanceT > 1.4 || moving) { this.glanceT = -1; this.nextGlance = t + 3.5 + Math.random() * 4; }
    }
    var hipShift = 0;
    if (this.idle > 2.5 && t > this.nextShift && this.shiftT < 0) { this.shiftT = 0; this.shiftDir = -this.shiftDir; }
    if (this.shiftT >= 0) {
      this.shiftT += dt;
      hipShift = Math.sin(Math.min(1, this.shiftT / 1.8) * Math.PI) * 0.55 * this.shiftDir;
      if (this.shiftT > 1.8 || moving) { this.shiftT = -1; this.nextShift = t + 5 + Math.random() * 4; }
    }

    /* action clock */
    var hop = 0, actU = 0, actSq = 0, actBob = 0, actTilt = 0, actLean = 0;
    if (this.act) {
      this.actT += dt;
      actU = this.actT / this.actDur;
      var ae = smooth(actU / 0.18) * (1 - smooth((actU - 0.8) / 0.2));
      if (this.act === 'cheer' || this.act === 'pose') {
        /* crouch, spring up (stretched), land and squash */
        var big = this.act === 'cheer', a0 = big ? 0.1 : 0.08, a1 = big ? 0.45 : 0.36;
        var hu = (actU - a0) / a1;
        if (actU < a0) actSq = Math.sin(actU / a0 * Math.PI * 0.5) * (big ? 1.1 : 0.7);
        else if (hu < 1) {
          if (!this.tookOff) { this.tookOff = true; this.hairY.v -= big ? 14 : 9; this.ear.v += 8; }
          hop = Math.sin(hu * Math.PI) * (big ? 3.6 : 1.6);
          actSq = -Math.abs(Math.cos(hu * Math.PI)) * (big ? 0.6 : 0.35) * (hu < 0.5 ? 1 : 0.6);
        } else if (!this.landed) { this.landed = true; this.sqS.v += big ? 9 : 6; this.hairY.v += 8; }
      } else if (this.act === 'pet') {
        /* lean in, a little knee bob with each stroke, head tipped to the guest */
        actBob = -0.45 * ae * (0.5 + 0.5 * Math.sin(this.actT * 15));
        actTilt = 0.07 * ae;
        actLean = 0.03 * ae;
      } else if (this.act === 'wave') {
        actTilt = -0.06 * ae + Math.sin(this.actT * 13) * 0.015 * ae;
        actLean = -0.025 * ae;
        actBob = 0.25 * ae * Math.max(0, Math.sin(this.actT * 13));
      }
      if (actU >= 1) this.act = null;
    }

    /* walk bob, and how fast it changes (it kicks the hair) */
    var walkB = 0.5 + 0.5 * Math.cos(2 * this.ph - duty * TAU);   /* high at mid-stance */
    var bob = this.walk * (0.55 + 0.6 * spdN * (1 - 0.35 * run) + climb * 0.6) * (walkB + run * (1 - 2 * walkB)) + run * 0.35 * (1 - walkB);
    var bv = (bob - this.prevBob) / dt;
    var bAcc = (bv - this.bobV) / dt;
    this.prevBob = bob; this.bobV = bv;

    /* secondaries (world space; converted to her local frame below) */
    var vxN = this.vx / vm, axN = clamp(this.ax / vm, -12, 12);
    var hl = 3 + 1.5 * tb;
    this.hair.step(clamp(-vxN * 2.4, -hl, hl), -axN * 2.2, dt);
    this.hairY.step(0, -bAcc * 0.012 + clamp(this.ay / vm, -10, 10) * 1.6 + (hop > 0 ? -2 : 0), dt);
    this.skirt.step(clamp(-vxN * 1.0, -1.4 - 0.6 * tb, 1.4 + 0.6 * tb), -axN * 1.1, dt);
    this.ear.step(clamp(-vxN * 1.4, -2, 2), -axN * 1.4 - bAcc * 0.004, dt);
    this.charm.step(clamp(-vxN * 2.8, -3.5, 3.5), -axN * 2.6, dt);
    this.sqS.step(0, 0, dt);
    this.hair.x = clamp(this.hair.x, -4.5 - 1.5 * tb, 4.5 + 1.5 * tb);
    this.charm.x = clamp(this.charm.x, -5, 5);

    var mir = this.L < 0 ? -1 : 1;
    Q.t = t;
    Q.mir = mir;
    Q.look = clamp(Math.abs(this.L) + gTurn * mir, 0, 1);
    Q.walk = this.walk;
    Q.ph = this.ph;
    Q.spd = spdN;
    Q.stride = stride;
    Q.duty = duty;
    Q.run = run;
    Q.boost = tb;
    Q.bob = bob + actBob;
    Q.hop = hop;
    Q.air = (o && o.air) || 0;
    Q.climb = climb;
    Q.lean = this.walk * (0.035 + 0.05 * spdN) + clamp(this.ax * mir / vm * 0.012, -0.06, 0.07) + climb * 0.08 + actLean + tb * 0.07;
    Q.sq = clamp(this.sqS.x * 0.18 + actSq, -1, 1.2);
    Q.breath = Math.sin(t * TAU / 3.2) * (1 - this.walk * 0.6);
    Q.open = open;
    Q.gx = o && o.gaze ? o.gaze[0] * mir : gx * mir;
    Q.gy = o && o.gaze ? o.gaze[1] : gy;
    Q.tilt = (gy < -0.3 ? -0.04 : 0) + Math.sin(t * 0.9) * 0.012 * (1 - this.walk) + actTilt;
    Q.hip = hipShift * mir;
    Q.hair = this.hair.x * mir + Math.sin(t * 1.3) * 0.25 * (1 - this.walk);
    Q.hairY = this.hairY.x;
    Q.skirt = this.skirt.x * mir;
    Q.ear = this.ear.x * mir + Math.sin(t * 2.2) * 0.2;
    Q.charm = this.charm.x * mir + Math.sin(t * 1.6) * 0.3;
    Q.flut = Math.sin(t * (5.3 + 3 * tb)) * (0.3 + this.walk * 0.7 * spdN + 0.4 * tb) + Math.sin(t * 2.1) * 0.3;
    Q.act = this.act;
    Q.actU = actU;
    Q.actT = this.actT;
    Q.expr = (o && o.expr) || 'open';
    Q.floss = false;
    Q.eyes = (o && o.eyes) || null;
    return Q;
  };

  var rigs = {};
  function rig(id, o) {
    return rigs[id] || (rigs[id] = new Rig(id, o));
  }

  /* Turbo cue, drawn behind her (and the dog): the rig's footfall dust
     puffs and a few soft speed streaks trailing her back, both fading in
     with the boost. (x, y) are her feet now, (ox, oy) the camera, in the
     same world px the rig is fed; s is her draw scale. */
  function trail(c, R, ox, oy, x, y, s) {
    var tb = R.boost, i, p;
    c.save();
    for (i = 0; i < R.puffs.length; i++) {
      p = R.puffs[i];
      if (p.age < 0 || p.age > 0.45) continue;
      var u = p.age / 0.45, r = (1.8 + 3.6 * u) * s * p.k;
      c.globalAlpha = 0.5 * (1 - u) * (1 - u);
      c.fillStyle = '#fff4e4';
      c.beginPath();
      c.arc(p.x - ox - p.dir * u * 7 * s, p.y - oy - r * 0.7 - u * 2 * s, r, 0, TAU);
      c.fill();
    }
    var hv = clamp(Math.abs(R.vx) / R.vmax, 0, 1);  /* streaks run with her, not up/down */
    if (tb * hv > 0.02) {
      var d = R.vx >= 0 ? 1 : -1, bx = x - ox - d * 15 * s;
      c.globalAlpha = 0.55 * tb * hv;
      c.strokeStyle = '#ffffff';
      c.lineCap = 'round';
      c.lineWidth = 1.3 * s;
      c.beginPath();
      for (i = 0; i < 3; i++) {
        var len = (10 + 7 * (0.5 + 0.5 * Math.sin(R.time * 7 + i * 2.3))) * s * tb;
        var sy = y - oy - (9 + i * 7) * s, sx = bx + d * (i === 1 ? -2 : 0) * s;
        c.moveTo(sx, sy);
        c.lineTo(sx - d * len, sy);
      }
      c.stroke();
    }
    c.restore();
  }

  /* ================================================================
     DRAW (with a sprite cache)
     ================================================================
     Painting her costs one to two milliseconds (dozens of clipped,
     banded shapes), so the finished figure is kept per draw scale and
     repainted only when something visible changes: for rig callers the
     30 Hz pose stamp, for frame callers the outfit, walk frame or the
     15 Hz secondary clock. The bitmap is blitted 1:1 on whole device
     pixels, so it is as sharp as painting directly. Rotated or skewed
     callers (the pillow in the sleep scene) and the floss dance paint
     directly. */
  var X0 = -8, Y0 = -16, CW = 44, CH = 54;
  var cache = {}, cacheOrder = [];
  function cacheSlot(u, tag) {
    var id = (tag || '') + u.toFixed(3), s = cache[id];
    if (!s) {
      if (cacheOrder.length >= 12) delete cache[cacheOrder.shift()];
      s = cache[id] = { cv: document.createElement('canvas'), key: null };
      s.cv.width = Math.ceil(CW * u);
      s.cv.height = Math.ceil(CH * u);
      s.ctx = s.cv.getContext('2d');
      cacheOrder.push(id);
    }
    return s;
  }
  function custKey(cu) {
    return cu.hair + cu.suit + cu.skin + cu.flipper + cu.hairStyle + cu.outfit + cu.shoes + cu.food + cu.hat + cu.extra +
           cu.face + cu.eyes;
  }
  function blit(c, s, m, sx, sy) {
    c.save();
    c.setTransform(m.a < 0 ? -1 : 1, 0, 0, m.d < 0 ? -1 : 1,
                   Math.round(m.a * (sx + X0) + m.e), Math.round(m.d * (sy + Y0) + m.f));
    c.drawImage(s.cv, 0, 0);
    c.restore();
  }
  function fill(s, u, cust, pose) {
    var b = s.ctx;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, s.cv.width, s.cv.height);
    b.setTransform(u, 0, 0, u, -X0 * u, -Y0 * u);
    paint(b, 0, 0, cust, pose);
  }
  function draw(c, sx, sy, cust, frame, opts) {
    cust = cust || {};
    var m = c.getTransform ? c.getTransform() : null;
    var skew = !m || Math.abs(m.b) > 1e-6 || Math.abs(m.c) > 1e-6 || Math.abs(Math.abs(m.a) - Math.abs(m.d)) > 1e-6;
    if (opts && opts.rig) {
      /* Rigs repaint every frame while she walks, otherwise "on twos"
         (30 Hz while she acts or her hair is still swinging; 20 Hz
         standing idle or once the effects watchdog has stepped down):
         the pose is still integrated every
         frame and her position moves at full rate, but the figure is
         only redrawn when the stamp ticks over. */
      var R = opts.rig;
      if (skew || !R.id) { paint(c, sx, sy, cust, R.pose); return; }
      var ua = Math.abs(m.a), rs = cacheSlot(ua, R.id);
      var busy = R.pose.walk > 0.05 || R.pose.act || R.pose.hop > 0 || Math.abs(R.hair.v) > 2;
      var low = window.Game.FX && window.Game.FX.tier > 0;
      var hz = low ? 20 : busy ? 30 : 20;
      /* Walking or running, her feet cover several pixels a frame, so a
         pose held for two frames reads as a stutter: repaint every frame
         (until the effects watchdog steps down). */
      var stamp = (!low && R.pose.walk > 0.3) ? R.time : Math.floor(R.time * hz);
      var rkey = custKey(cust) + '|' + stamp + '|' + R.pose.mir;
      if (rs.key !== rkey) { fill(rs, ua, cust, R.pose); rs.key = rkey; }
      blit(c, rs, m, sx, sy);
      return;
    }
    var tick = Math.floor(Date.now() * 0.015);
    if (skew || (opts && opts.pose === 'floss')) {
      paint(c, sx, sy, cust, framePose(frame, opts, Date.now() * 0.001));
      return;
    }
    var u = Math.abs(m.a);
    var s = cacheSlot(u);
    var key = custKey(cust) + '|' + ((frame || 0) % 4) + '|' + ((opts && opts.eyes) || '') + '|' + tick;
    if (s.key !== key) { fill(s, u, cust, framePose(frame, opts, tick / 15)); s.key = key; }
    blit(c, s, m, sx, sy);
  }

  /* Static crops of her for the customize tiles: crop = [x, y, w, h] in
     sprite units, rendered at u device px per unit into a cached canvas. */
  var cropCache = {}, cropOrder = [];
  var CP = newPose();
  function renderCrop(cust, crop, u) {
    var key = custKey(cust) + '|' + crop.join(',') + '|' + u.toFixed(2);
    var hit = cropCache[key];
    if (hit) return hit;
    var cv = document.createElement('canvas');
    cv.width = Math.ceil(crop[2] * u);
    cv.height = Math.ceil(crop[3] * u);
    var b = cv.getContext('2d');
    b.setTransform(u, 0, 0, u, -crop[0] * u, -crop[1] * u);
    CP.look = 0.3; CP.mir = 1; CP.t = 0.4; CP.open = 1; CP.gx = 0.1;
    CP.hair = -0.3; CP.charm = -0.4; CP.ear = 0.2; CP.flut = 0.2; CP.expr = 'smile';
    paint(b, 0, 0, cust, CP);
    cropCache[key] = cv;
    cropOrder.push(key);
    if (cropOrder.length > 96) delete cropCache[cropOrder.shift()];
    return cv;
  }

  /* A held item on its own, for the customize tile icons: (x, y) is the
     floor under it, s the scale of a full-height item (short ones are
     shown a little bigger). */
  var ICON_BOX = {           /* top and bottom of each item about its anchor */
    iceCream: [-4.2, 6.2], onigiri: [-2.4, 3.5], donut: [-1.4, 3.4], crepe: [-5.0, 5.6], taiyaki: [-0.8, 2.8],
    parfait: [-4.6, 5.4], macaron: [-2.2, 3.4], strawberry: [-2.6, 3.4], lollipop: [-3.1, 5.4], dango: [-4.4, 5.6],
    cupcake: [-3.2, 3.8], teddy: [-4.3, 3.9], roomKey: [-3.9, 6.0], deskBell: [-2.7, 3.9], suitcase: [-0.5, 5.4],
    bouquet: [-4.2, 5.8], starWand: [-5.5, 5.8], pinwheel: [-6.2, 5.8], balloon: [-16.6, 0.6]
  };
  function drawItemIcon(c, food, x, y, s) {
    var B = ICON_BOX[food];
    if (!B) return;
    var hgt = B[1] - B[0];
    s = Math.min(s * (food === 'balloon' ? 0.62 : 1.3), s * 11.6 / hgt);
    var u = 2;
    if (c.getTransform) { var m = c.getTransform(); u = Math.sqrt(m.a * m.a + m.b * m.b) * s || 2; }
    LW = Math.max(0.9, Math.min(3.0, u * 0.3)) / u;
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    drawItem(c, food, food === 'balloon' ? 1.8 : 0, -B[1], { charm: 0, bob: 0, t: 0.1 });
    c.restore();
  }

  /* A pair of shoes on their own (ankles and socks included), side on,
     for the customize tiles: (x, y) is the floor between them. */
  function drawShoeIcon(c, cust, style, x, y, s) {
    var P = paletteFor(cust), u = 2;
    if (c.getTransform) { var m = c.getTransform(); u = Math.sqrt(m.a * m.a + m.b * m.b) * s || 2; }
    LW = Math.max(0.9, Math.min(3.0, u * 0.3)) / u;
    var sockR = style === 'maryJane' || style === 'sneaker' || style === 'slipper' || style === 'roller' ? P.white : null;
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    for (var i = 1; i >= 0; i--) {
      var ax = i ? 2.0 : -3.4, ay = -1.5 - i * 0.6;
      drawLeg(c, P.skin, ax, ay - LEG - 0.4, ax, ay, 1, false, sockR, true);
      drawShoe(c, P, pick('shoes', style), ax - 0.2, ay, 1, 0, 0.3);
    }
    c.restore();
  }

  window.Game.momoko = {
    draw: draw,
    palette: paletteFor,
    rig: rig,
    trail: trail,
    renderCrop: renderCrop,
    drawItemIcon: drawItemIcon,
    drawShoeIcon: drawShoeIcon,
    options: OPT,
    defaults: DEF,
    /* Her cel shading for companions painted in the same style (the pet
       dog): part(c, pathFn, '#hex', bandScale, extraFn, noInk) fills with
       two cel bands and a hue-tinted outline; ink(u) sets the outline for
       u device px per unit; ramp(hex) gives { c, m, d, l, ink }. */
    kit: {
      part: function (c, path, hex, s, extra, noInk) { part(c, path, ramp(hex, false), s, extra, noInk); },
      ink: function (u) { LW = Math.max(0.9, Math.min(3.0, u * 0.3)) / u; return LW; },
      ramp: function (hex) { return ramp(hex, false); },
      gloss: gloss
    }
  };
})();
