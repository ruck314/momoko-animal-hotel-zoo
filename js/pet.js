/* pet.js – Momoko's pet dog: painter and follow rig.

   The puppy follows the In Space game's pet design (plump body, round
   head, cream muzzle, floppy ear, collar, wagging tail) drawn a size up
   with Momoko's own cel shading and hue-tinted outlines (Game.momoko.kit),
   so the two read as one family on screen.

   Units: 1 = one unit of Momoko's 28 x 34 sprite. The dog stands about
   15 units tall and 22 long, feet on y = 0, centred on x = 0, facing
   left (nose toward -x); callers mirror for facing right.

   A Rig follows her through the world: it trots to a spot behind her,
   breaks into a little bound to keep up when she runs, turns through a
   quick squash instead of snapping the mirror, sits when she stands
   still, and layers tail wags, blinks, ear springs, head tilts, panting
   and looking up at her on top. Its pose is a small bag of numbers that
   paint() turns into the figure. */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }

  /* Coats keep the save ids from the old crab pet: red/blue/gold. Breed
     traits: blaze (cream chest and paws), patch, fluff (ruff, plumed
     tail), point (pricked ears), curl (tail curled over the back), mask
     (pale face), poodle (pom-poms), beard (whiskery muzzle and brows). */
  var COATS = {
    red:  { body: '#a96a3b', ear: '#6b3f1f', cream: '#f5e0bf', nose: '#2c1a14', collar: '#e0405a', tag: '#ffd24a', blaze: true },
    blue: { body: '#f3efe8', ear: '#523c2f', cream: '#ffffff', nose: '#2c1a14', collar: '#3f8fe0', tag: '#ffd24a', patch: '#5c4434' },
    gold: { body: '#efbd5c', ear: '#c88b39', cream: '#fbe8bf', nose: '#3a2418', collar: '#ff6fa8', tag: '#fff3b8', blaze: true, fluff: true },
    shiba: { body: '#e8963c', ear: '#d07c2a', cream: '#fff6e6', nose: '#2c1a14', collar: '#d8344a', tag: '#ffd24a', blaze: true, point: true, curl: true, mask: true },
    husky: { body: '#8792aa', ear: '#5c667e', cream: '#ffffff', nose: '#2c2430', collar: '#3fb8c8', tag: '#ffd24a', blaze: true, point: true, fluff: true, mask: true, eye: '#3f9ee8' },
    poodle: { body: '#ffd9e6', ear: '#ffb8d0', cream: '#fff4f8', nose: '#5a3040', collar: '#a070e0', tag: '#ffd24a', poodle: true },
    scottie: { body: '#454050', ear: '#2e2a38', cream: '#5a5466', nose: '#16121a', collar: '#e8344a', tag: '#ffd24a', point: true, beard: true }
  };
  var ALIAS = { brown: 'red', spotted: 'blue', golden: 'gold' };
  var VARIANTS = ['none', 'red', 'blue', 'gold', 'shiba', 'husky', 'poodle', 'scottie'];
  var WEARS = ['none', 'bow', 'bandana', 'bell', 'flowers', 'sweater', 'partyHat', 'crown'];
  function coatOf(v) { return COATS[ALIAS[v] || v] || null; }

  function newPose() {
    return { ph: 0, gait: 0, bound: 0, bob: 0, pitch: 0, sit: 0, headUp: 0, tilt: 0,
             ear: 0, wag: 0, open: 1, pant: 0, tongue: 0, sx: 1, t: 0, reach: 1 };
  }

  /* ---- painting ---- */
  var K = null;                  /* Game.momoko.kit, bound lazily */
  function capsule(c, x0, y0, x1, y1, r0, r1) {
    var dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy) || 0.001;
    var a = Math.atan2(dy, dx);
    c.beginPath();
    c.arc(x0, y0, r0, a + Math.PI / 2, a - Math.PI / 2, false);
    c.arc(x0 + dx, y0 + dy, r1, a - Math.PI / 2, a + Math.PI / 2, false);
    c.closePath();
    if (L < 0) c.closePath();
  }
  function ellP(c, x, y, rx, ry, rot) {
    return function () { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); };
  }

  /* Leg i: 0 near-front, 1 far-front, 2 near-hind, 3 far-hind. */
  var HIP_X = [-3.1, -1.5, 5.9, 7.5];
  var TROT = [0, Math.PI, Math.PI, 0];
  var BOUND = [0, 0.45, Math.PI, Math.PI + 0.45];
  function footOf(P, i) {
    var g = P.gait, b = P.bound;
    var pt = P.ph + TROT[i], pb = P.ph + BOUND[i];
    var dxT = -Math.sin(pt) * 1.8, liftT = Math.max(0, Math.cos(pt)) * 1.25;
    var r = P.reach || 1;
    var dxB = -Math.sin(pb) * 3.0 * r, liftB = Math.max(0, Math.cos(pb)) * 1.7 * (0.6 + 0.4 * r);
    return [(dxT + (dxB - dxT) * b) * g, (liftT + (liftB - liftT) * b) * g];
  }

  function drawLeg(c, hx, hy, fx, fy, r, hex, paw, noInk) {
    K.part(c, function () { capsule(c, hx, hy, fx, fy - 0.55, r, r * 0.92); }, hex, 0.5, null, noInk);
    K.part(c, ellP(c, fx - 0.25, fy - 0.62, 1.5, 0.82, 0), paw, 0.4);
  }

  /* A fluffy pom: a ring of soft bumps. */
  function pomP(c, x, y, r) {
    return function () {
      c.beginPath();
      c.moveTo(x + r, y);
      for (var k = 0; k < 8; k++) {
        var a = (k + 0.5) * TAU / 8, b = (k + 1) * TAU / 8;
        c.quadraticCurveTo(x + Math.cos(a) * r * 1.42, y + Math.sin(a) * r * 1.42, x + Math.cos(b) * r, y + Math.sin(b) * r);
      }
      c.closePath();
    };
  }

  function paint(c, coat, P, u, wear) {
    if (!K) K = window.Game.momoko.kit;
    K.ink(u);
    var R = K.ramp(coat.body), far = R.m, earR = K.ramp(coat.ear);
    var sit = P.sit, a = sit * 0.5;                  /* rump drops about the front shoulder */
    var ca = Math.cos(a), sa = Math.sin(a);
    function rot(x, y) {                             /* body frame -> dog frame */
      var dx = x + 2.5, dy = y + 7;
      return [-2.5 + dx * ca - dy * sa, -7 + dx * sa + dy * ca + P.bob];
    }

    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';

    /* tail: up and wagging, lying on the floor when she sits */
    var tb = rot(9.3, -10.3);
    var ta = -1.05 + P.wag + sit * 0.85 - P.pitch;
    var tl = coat.fluff ? 6 : coat.beard ? 4.2 : 5.4;
    var tmx = tb[0] + Math.cos(ta + 0.5) * tl * 0.55, tmy = tb[1] + Math.sin(ta + 0.5) * tl * 0.55;
    var tex = tb[0] + Math.cos(ta - 0.35) * tl, tey = tb[1] + Math.sin(ta - 0.35) * tl;
    if (coat.curl) {
      /* curled over the back: a fat ring with a cream underside */
      var cxr = tb[0] + 0.6 + P.wag * 1.6, cyr = tb[1] - 2.6 + sit * 2.2;
      K.part(c, function () {
        c.beginPath();
        c.arc(cxr, cyr, 3.0, 0, TAU);
        c.moveTo(cxr + 1.1, cyr + 0.2); c.arc(cxr, cyr + 0.2, 1.1, 0, TAU, true);
      }, coat.body, 0.7, function () {
        c.beginPath(); c.arc(cxr, cyr + 0.2, 2.0, Math.PI * 0.1, Math.PI * 1.1);
        c.strokeStyle = coat.cream; c.lineWidth = 1.3; c.stroke();
      });
    } else if (coat.poodle) {
      c.beginPath(); c.moveTo(tb[0], tb[1]); c.quadraticCurveTo(tmx, tmy, tex, tey);
      c.strokeStyle = R.ink; c.lineWidth = 1.5 + K.ink(u) * 2; c.stroke();
      c.strokeStyle = R.c; c.lineWidth = 1.5; c.stroke();
      K.part(c, pomP(c, tex, tey, 1.9), coat.cream, 0.6);
    } else {
      c.beginPath(); c.moveTo(tb[0], tb[1]); c.quadraticCurveTo(tmx, tmy, tex, tey);
      c.strokeStyle = R.ink; c.lineWidth = (coat.fluff ? 3.1 : 2.4) + K.ink(u) * 2; c.stroke();
      c.strokeStyle = R.c; c.lineWidth = coat.fluff ? 3.1 : 2.4; c.stroke();
      c.beginPath(); c.moveTo(tmx, tmy); c.quadraticCurveTo(tmx + (tex - tmx) * 0.6, tmy + (tey - tmy) * 0.6, tex, tey);
      c.strokeStyle = coat.fluff ? coat.cream : R.l; c.lineWidth = coat.fluff ? 1.6 : 0.9; c.globalAlpha = 0.8; c.stroke(); c.globalAlpha = 1;
    }

    /* far legs */
    var f1 = footOf(P, 1), f3 = footOf(P, 3);
    var sh1 = rot(HIP_X[1], -6.4), hp3 = rot(HIP_X[3] - 0.6, -6.2);
    drawLeg(c, sh1[0], sh1[1], HIP_X[1] + f1[0], -f1[1], 1.05, far, K.ramp(far).m);
    var h3x = HIP_X[3] + f3[0] - sit * 4.6, h3y = -f3[1] * (1 - sit);
    drawLeg(c, hp3[0], hp3[1], h3x + (hp3[0] - h3x) * sit * 0.3, h3y, 1.15, far, K.ramp(far).m);

    /* body, then the haunch over it */
    c.save();
    c.translate(0, P.bob);
    c.translate(-2.5, -7); c.rotate(a + P.pitch); c.translate(2.5, 7);
    K.part(c, ellP(c, 2.2, -9.2, 7.7, 4.9, -0.04), coat.body, 0.9, function () {
      if (coat.blaze) { c.beginPath(); c.ellipse(-3.6, -7.4, 3.0, 2.9, 0.2, 0, TAU); c.fillStyle = coat.cream; c.fill(); }
      if (coat.patch) {
        c.beginPath(); c.ellipse(3.6, -12.2, 3.6, 2.4, 0.15, 0, TAU); c.fillStyle = coat.patch; c.fill();
        c.beginPath(); c.ellipse(8.4, -8.4, 1.4, 1.2, 0, 0, TAU); c.fill();
      }
    });
    K.part(c, ellP(c, 6.6, -8.4, 3.1, 3.4 + sit * 0.6, 0.15), coat.body, 0.6, coat.patch ? function () {
      c.beginPath(); c.ellipse(7.6, -9.8, 1.6, 1.3, 0, 0, TAU); c.fillStyle = coat.patch; c.fill();
    } : null, true);
    c.beginPath(); c.ellipse(6.6, -8.4, 3.1, 3.4 + sit * 0.6, 0.15, 1.6, 3.6);
    c.strokeStyle = R.ink; c.lineWidth = K.ink(u) * 0.8; c.stroke();
    if (coat.fluff) {                                  /* chest ruff */
      c.fillStyle = coat.cream;
      c.beginPath(); c.moveTo(-5.2, -9.6);
      c.lineTo(-6.0, -7.6); c.lineTo(-4.8, -7.9); c.lineTo(-5.2, -6.0); c.lineTo(-3.8, -6.6); c.lineTo(-3.4, -5.0); c.lineTo(-2.2, -6.2);
      c.closePath(); c.fill();
    }
    if (coat.poodle) K.part(c, pomP(c, -3.4, -8.6, 2.5), coat.cream, 0.7);
    if (wear === 'sweater') {
      /* striped knit jumper over her middle, ribbed at both ends */
      K.part(c, function () {
        c.beginPath();
        c.moveTo(-2.6, -13.6);
        c.quadraticCurveTo(2.4, -14.6, 6.6, -13.2);
        c.quadraticCurveTo(7.6, -9.4, 6.4, -5.0);
        c.quadraticCurveTo(2.2, -3.9, -2.4, -4.9);
        c.quadraticCurveTo(-3.6, -9.2, -2.6, -13.6);
        c.closePath();
      }, '#ff7aa8', 0.9, function () {
        c.fillStyle = '#fff4f8';
        for (var k = 0; k < 3; k++) c.fillRect(-0.9 + k * 2.6, -15, 1.0, 12);
        c.fillStyle = '#d8507e';
        c.fillRect(-3.6, -15, 1.3, 12); c.fillRect(5.9, -15, 1.4, 12);
        c.fillStyle = '#ffe27a';
        c.beginPath(); c.ellipse(2.2, -9.2, 1.0, 1.0, 0, 0, TAU); c.fill();
      });
    }
    c.restore();

    /* near legs */
    var f2 = footOf(P, 2), f0 = footOf(P, 0);
    var hp2 = rot(HIP_X[2] - 0.6, -6.2);
    var h2x = HIP_X[2] + f2[0] - sit * 4.4, h2y = -f2[1] * (1 - sit);
    var pawC = coat.blaze ? coat.cream : coat.body;
    drawLeg(c, hp2[0], hp2[1], h2x + (hp2[0] - h2x) * sit * 0.3, h2y, 1.2, coat.body, pawC);
    var sh0 = rot(HIP_X[0], -6.6);
    drawLeg(c, sh0[0], sh0[1], HIP_X[0] + f0[0], -f0[1], 1.1, coat.body, pawC);
    if (coat.poodle) {
      K.part(c, pomP(c, HIP_X[0] + f0[0], -f0[1] - 1.9, 1.25), coat.cream, 0.4);
      K.part(c, pomP(c, h2x + (hp2[0] - h2x) * sit * 0.3, h2y - 1.9, 1.3), coat.cream, 0.4);
    }

    /* head on the neck pivot */
    var nk = rot(-3.4, -10.6);
    c.save();
    c.translate(nk[0], nk[1] - P.bob * 0.35);
    c.rotate(P.tilt + P.headUp * 0.38 - P.pitch * 0.6);
    c.translate(3.4, 10.6);

    /* far ear peeking over the crown */
    if (coat.point) {
      K.part(c, function () {
        c.beginPath();
        c.moveTo(-9.6, -16.6); c.quadraticCurveTo(-9.9, -19.8, -8.6 - P.ear * 0.8, -21.4); c.quadraticCurveTo(-7.4, -19.4, -6.6, -17.4);
        c.closePath();
      }, earR.m, 0.4);
    } else if (coat.poodle) {
      K.part(c, pomP(c, -9.0, -15.2, 1.6), earR.m, 0.4);
    } else {
      K.part(c, ellP(c, -7.9, -17.6, 1.25, 2.1, -0.5 - P.ear * 0.5), earR.m, 0.4);
    }
    /* skull, muzzle */
    K.part(c, ellP(c, -6.7, -13.6, 5.1, 4.8, 0), coat.body, 0.8, coat.patch ? function () {
      c.beginPath(); c.ellipse(-7.9, -14.7, 2.1, 1.9, 0.2, 0, TAU); c.fillStyle = coat.patch; c.fill();
    } : coat.mask ? function () {
      /* pale face: cheeks and brow spots */
      c.fillStyle = coat.cream;
      c.beginPath(); c.ellipse(-8.4, -11.4, 4.6, 2.9, 0.1, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(-9.0, -16.3, 0.85, 0.6, 0.3, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(-6.4, -16.7, 0.85, 0.6, -0.2, 0, TAU); c.fill();
    } : function () {
      c.beginPath(); c.ellipse(-8.6, -15.6, 1.4, 2.2, 0.3, 0, TAU); c.fillStyle = coat.cream; c.globalAlpha = 0.55; c.fill(); c.globalAlpha = 1;
    });
    if (coat.beard) {
      K.part(c, function () {
        c.beginPath();
        c.moveTo(-13.2, -12.6);
        c.quadraticCurveTo(-10.4, -14.6, -7.4, -12.6);
        c.lineTo(-7.8, -9.6); c.lineTo(-8.8, -10.6); c.lineTo(-9.4, -8.8); c.lineTo(-10.4, -10.4); c.lineTo(-11.2, -8.8); c.lineTo(-12.0, -10.6); c.lineTo(-13.0, -9.6);
        c.closePath();
      }, coat.cream, 0.45);
    } else {
      K.part(c, ellP(c, -10.3, -11.9, 3.0, 2.2, 0.08), coat.cream, 0.45);
    }
    /* mouth: a little smile, or open with a tongue while panting */
    if (P.pant > 0.05) {
      var po = P.pant;
      c.beginPath(); c.ellipse(-10.6, -10.4, 1.25, 0.95 * po, 0, 0, Math.PI); c.fillStyle = '#7a2a3a'; c.fill();
      c.beginPath(); c.ellipse(-10.3, -9.9 + P.tongue * 0.25 * po, 0.8, 1.15 * po, 0.1, 0, TAU); c.fillStyle = '#ff7f9a'; c.fill();
    }
    if (!coat.beard) {
      c.beginPath(); c.moveTo(-12.0, -10.9); c.quadraticCurveTo(-11.2, -10.1, -10.4, -10.6); c.quadraticCurveTo(-9.8, -10.0, -9.0, -10.5);
      c.strokeStyle = K.ramp(coat.cream).ink; c.lineWidth = K.ink(u) * 0.9; c.stroke();
    }
    /* nose */
    c.beginPath(); c.ellipse(-12.8, -12.8, 1.2, 0.95, 0, 0, TAU); c.fillStyle = coat.nose; c.fill();
    K.gloss(c, -13.1, -13.2, 0.45, 0.28, 0, 0.75);
    /* cheek blush */
    c.beginPath(); c.ellipse(-7.6, -11.9, 1.15, 0.6, 0, 0, TAU); c.fillStyle = 'rgba(255,120,140,0.32)'; c.fill();
    /* eye */
    var op = P.open;
    if (op > 0.25) {
      c.beginPath(); c.ellipse(-8.2, -14.4, 1.0, 1.2 * op, 0, 0, TAU); c.fillStyle = '#2a1a14'; c.fill();
      if (coat.eye) { c.beginPath(); c.ellipse(-8.2, -14.2, 0.7, 0.8 * op, 0, 0, TAU); c.fillStyle = coat.eye; c.fill(); }
      K.gloss(c, -8.5, -14.9 * (op > 0.6 ? 1 : 0.995), 0.4, 0.4 * op, 0, 0.95);
      K.gloss(c, -7.9, -13.9, 0.18, 0.18 * op, 0, 0.8);
    } else {
      c.beginPath(); c.arc(-8.2, -14.6, 0.95, 0.25, Math.PI - 0.25);
      c.strokeStyle = '#2a1a14'; c.lineWidth = K.ink(u) * 1.1; c.stroke();
    }
    if (coat.beard) {                                   /* bushy brow */
      K.part(c, function () {
        c.beginPath();
        c.moveTo(-9.9, -15.4); c.quadraticCurveTo(-8.6, -17.0, -6.9, -16.0); c.lineTo(-7.3, -15.3); c.lineTo(-8.2, -15.9); c.lineTo(-8.9, -15.1);
        c.closePath();
      }, coat.cream, 0.3);
    }
    /* near ear: floppy and swinging on its spring, pricked, or a pom */
    c.save();
    c.translate(-4.4, -16.6); c.rotate(P.ear);
    if (coat.point) {
      c.rotate(-P.ear * 0.6);
      K.part(c, function () {
        c.beginPath();
        c.moveTo(-2.2, 0.9); c.quadraticCurveTo(-2.3, -3.2, -0.2, -5.4); c.quadraticCurveTo(1.6, -2.6, 2.2, 0.4);
        c.closePath();
      }, coat.ear, 0.5, function () {
        c.beginPath();
        c.moveTo(-1.2, 0.5); c.quadraticCurveTo(-1.3, -2.2, -0.2, -3.7); c.quadraticCurveTo(0.9, -1.8, 1.2, 0.2);
        c.closePath();
        c.fillStyle = coat.beard ? earR.l : '#ffc0cc'; c.globalAlpha = coat.beard ? 0.4 : 0.9; c.fill(); c.globalAlpha = 1;
      });
    } else if (coat.poodle) {
      K.part(c, pomP(c, 0.9, 3.2, 2.1), coat.ear, 0.5);
    } else {
      K.part(c, ellP(c, 0.9, 3.0, 1.8, 3.5, 0.3), coat.ear, 0.45, function () {
        c.beginPath(); c.ellipse(0.4, 2.2, 0.8, 2.2, 0.3, 0, TAU); c.fillStyle = earR.l; c.globalAlpha = 0.35; c.fill(); c.globalAlpha = 1;
      });
    }
    c.restore();
    if (coat.poodle) K.part(c, pomP(c, -6.4, -18.4, 2.3), coat.cream, 0.6);      /* topknot */
    /* collar and what hangs from it */
    var tg = 0.35 - P.ear * 0.6;
    var tx = -5.6 + Math.sin(tg) * 1.2, ty = -8.0 + Math.cos(tg) * 1.0;
    if (wear === 'flowers') {
      var fc = ['#ff8fb8', '#fff0a0', '#ffffff', '#c0a4ff', '#ff8fb8'];
      for (var fi = 0; fi < 5; fi++) {
        var fa = 0.5 + fi * 0.5, fpx = -4.3 + Math.cos(fa + 0.35) * 2.7 - Math.sin(fa) * 0.3, fpy = -10.7 + Math.sin(fa + 0.2) * 3.3;
        K.part(c, pomP(c, fpx, fpy, 1.05), fc[fi], 0.3);
        c.beginPath(); c.ellipse(fpx, fpy, 0.45, 0.45, 0, 0, TAU); c.fillStyle = '#ffb83a'; c.fill();
      }
    } else if (wear === 'bandana') {
      K.part(c, function () {
        c.beginPath();
        c.moveTo(-7.4, -10.6); c.quadraticCurveTo(-4.6, -8.2, -1.7, -9.2);
        c.quadraticCurveTo(-3.6, -6.6, -5.9 + Math.sin(tg) * 0.8, -4.6);
        c.quadraticCurveTo(-7.0, -7.4, -7.4, -10.6);
        c.closePath();
      }, '#e8344a', 0.5, function () {
        c.fillStyle = '#ffffff';
        var d = [-5.6, -8.4, -4.2, -7.8, -5.8, -6.6, -6.6, -9.4, -3.0, -8.6];
        for (var k = 0; k < d.length; k += 2) { c.beginPath(); c.ellipse(d[k], d[k + 1], 0.34, 0.34, 0, 0, TAU); c.fill(); }
      });
    } else {
      c.beginPath(); c.ellipse(-4.3, -10.7, 2.7, 3.3, 0.35, 0.35, 2.75);
      c.strokeStyle = K.ramp(coat.collar).ink; c.lineWidth = 1.35 + K.ink(u) * 2; c.stroke();
      c.strokeStyle = coat.collar; c.lineWidth = 1.35; c.stroke();
      c.beginPath(); c.ellipse(-4.3, -10.9, 2.7, 3.3, 0.35, 0.6, 1.5);
      c.strokeStyle = K.ramp(coat.collar).l; c.lineWidth = 0.35; c.stroke();
      if (wear === 'bow') {
        /* big satin bow tie under her chin */
        var BW = '#ff6fa8';
        for (var bs = -1; bs <= 1; bs += 2) {
          K.part(c, function () {
            c.beginPath();
            c.moveTo(tx, ty - 0.4);
            c.bezierCurveTo(tx + bs * 1.2, ty - 3.2, tx + bs * 4.2, ty - 2.4, tx + bs * 3.6, ty - 0.2);
            c.bezierCurveTo(tx + bs * 3.8, ty + 1.8, tx + bs * 1.2, ty + 1.4, tx, ty - 0.4);
            c.closePath();
          }, BW, 0.6, function () {
            c.beginPath(); c.moveTo(tx + bs * 0.6, ty - 0.5); c.quadraticCurveTo(tx + bs * 1.9, ty - 0.9, tx + bs * 2.7, ty - 0.2);
            c.strokeStyle = K.ramp(BW).d; c.lineWidth = 0.3; c.stroke();
            K.gloss(c, tx + bs * 2.2, ty - 1.4, 0.7, 0.3, bs * 0.4, 0.6);
          });
        }
        K.part(c, ellP(c, tx, ty - 0.4, 0.95, 1.05, 0), BW, 0.4);
      } else if (wear === 'bell') {
        K.part(c, ellP(c, tx, ty + 0.5, 1.75, 1.75, 0), '#ffd24a', 0.6, function () {
          c.beginPath(); c.moveTo(tx - 1.7, ty + 0.7); c.lineTo(tx + 1.7, ty + 0.7); c.moveTo(tx, ty + 0.7); c.lineTo(tx, ty + 2.2);
          c.strokeStyle = K.ramp('#ffd24a').ink; c.lineWidth = 0.3; c.stroke();
          c.beginPath(); c.ellipse(tx, ty + 1.2, 0.36, 0.36, 0, 0, TAU); c.fillStyle = K.ramp('#ffd24a').ink; c.fill();
          K.gloss(c, tx - 0.6, ty - 0.3, 0.5, 0.32, -0.4, 0.95);
        });
      } else {
        K.part(c, ellP(c, tx, ty, 0.95, 0.95, 0), coat.tag, 0.3, function () { K.gloss(c, tx - 0.25, ty - 0.3, 0.3, 0.2, 0, 0.9); });
      }
    }
    if (wear === 'partyHat') {
      c.save();
      c.translate(-6.0, -18.0 - (coat.poodle ? 1.4 : 0)); c.rotate(0.22);
      K.part(c, function () {
        c.beginPath();
        c.moveTo(-2.4, 0.3); c.lineTo(0.2, -6.2); c.lineTo(2.5, 0.3); c.quadraticCurveTo(0, 1.1, -2.4, 0.3);
        c.closePath();
      }, '#6fc0ff', 0.6, function () {
        c.fillStyle = '#ffe27a';
        c.beginPath();
        c.moveTo(-4, -0.9); c.lineTo(4, -2.9); c.lineTo(4, -1.9); c.lineTo(-4, 0.1); c.closePath();
        c.moveTo(-4, -3.3); c.lineTo(4, -5.3); c.lineTo(4, -4.3); c.lineTo(-4, -2.3); c.closePath();
        c.fill();
      });
      K.part(c, pomP(c, 0.2, -6.6, 0.95), '#ff7aa8', 0.3);
      c.restore();
    } else if (wear === 'crown') {
      c.save();
      c.translate(-6.2, -18.0 - (coat.poodle ? 1.6 : 0)); c.rotate(-0.12);
      K.part(c, function () {
        c.beginPath();
        c.moveTo(-2.7, 0.5); c.lineTo(-3.2, -2.9); c.lineTo(-1.6, -1.4); c.lineTo(0, -4.0); c.lineTo(1.6, -1.4); c.lineTo(3.2, -2.9); c.lineTo(2.7, 0.5);
        c.quadraticCurveTo(0, 1.3, -2.7, 0.5);
        c.closePath();
      }, '#ffd24a', 0.6, function () {
        K.gloss(c, -1.9, -0.8, 0.3, 0.9, 0.15, 0.7);
      });
      c.beginPath(); c.ellipse(0, -0.3, 0.6, 0.55, 0, 0, TAU); c.fillStyle = '#e8344a'; c.fill();
      K.gloss(c, -0.2, -0.5, 0.2, 0.14, 0, 0.9);
      c.fillStyle = '#fff4fa';
      c.beginPath(); c.ellipse(-3.2, -3.1, 0.42, 0.42, 0, 0, TAU); c.ellipse(0, -4.2, 0.42, 0.42, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(3.2, -3.1, 0.42, 0.42, 0, 0, TAU); c.fill();
      c.restore();
    }
    c.restore();

    c.restore();
  }

  /* Draw a pose at (x, y) = point between the feet, `scale` px per unit;
     wear is what the dog has on (one of WEARS). */
  function drawPose(c, x, y, variant, P, scale, wear) {
    var coat = coatOf(variant);
    if (!coat) return;
    if (WEARS.indexOf(wear) < 0) wear = 'none';
    var m = c.getTransform ? c.getTransform() : null;
    var u = (m ? Math.sqrt(m.a * m.a + m.b * m.b) : 1) * (scale || 1);
    c.save();
    c.translate(x, y);
    c.scale(-(P.sx || 1) * (scale || 1), scale || 1);
    paint(c, coat, P, u, wear);
    c.restore();
  }

  /* Still pose for icons: standing, tail up, facing right. */
  var ICON = newPose();
  ICON.wag = 0.2; ICON.ear = 0.08; ICON.sx = 1; ICON.headUp = 0.08;
  function drawIcon(c, x, y, variant, scale, wear) { drawPose(c, x, y, variant, ICON, scale, wear); }

  /* ---- rig ---- */
  function Rig(o) {
    this.scale = (o && o.scale) || 1.4;   /* screen px per unit where it is drawn */
    this.vmax = (o && o.vmax) || 192;     /* the owner's top speed, px/s */
    this.gap = (o && o.gap !== undefined) ? o.gap : 42;        /* how far behind her it trots, px */
    this.P = newPose();
    this.reset();
  }
  /* Swing: when she turns, the dog swings round behind her on a shallow
     ellipse instead of mirroring flat. th runs 0 (behind her left, she
     faces right) to PI (behind her right); sin(th) is its depth, which
     shrinks and lifts it (P.depth, applied by the caller). It narrows
     toward a front view and swaps its facing at the far point, where
     she hides it. Same timing and depth constants in every Momoko game. */
  var SWING_T = 0.3, SWING_NARROW = 0.5;
  Rig.prototype.reset = function () {
    this.x = null; this.bx = 0; this.vx = 0; this.face = 1; this.turnFrom = 1; this.turnT = 1;
    this.th = 0; this.thFrom = 0; this.thTo = 0; this.thU = 1;
    this.ph = 0; this.gait = 0; this.bound = 0; this.sit = 0; this.idle = 0; this.t = 0; this.last = 0;
    this.earX = 0; this.earV = 0; this.prevBob = 0; this.wagPh = 0; this.excite = 0.5;
    this.pant = 0; this.pantHold = 0; this.headUp = 0; this.ownerX = null; this.ownerS = 0;
    this.nextBlink = 1.4; this.blinkT = -1; this.tiltT = -1; this.nextTilt = 3; this.tiltDir = 1;
  };
  /* Owner's feet x (world px), the way she faces (1 right, -1 left),
     extras { air: she's floating, dt: fixed step for tests }. */
  Rig.prototype.update = function (ownerX, ownerFacing, o) {
    var dt;
    if (o && o.dt) dt = o.dt;
    else {
      var now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
      dt = this.last ? now - this.last : 1 / 60;
      if (dt < 0.002) return this.P;
      this.last = now;
      if (dt > 0.05) dt = 0.05;
    }
    var P = this.P, t = (this.t += dt);
    var air = (o && o.air) ? 1 : 0;
    var thTo = ownerFacing > 0 ? 0 : Math.PI;
    if (this.x === null || Math.abs(ownerX - this.bx) > 260) {
      this.bx = ownerX; this.vx = 0; this.face = ownerFacing; this.turnFrom = ownerFacing; this.turnT = 1;
      this.th = this.thFrom = this.thTo = thTo; this.thU = 1;
    }
    /* swing round behind her to the side she now trails */
    if (thTo !== this.thTo) { this.thFrom = this.th; this.thTo = thTo; this.thU = 0; this.earV += 5; }
    var th0 = this.th;
    if (this.thU < 1) {
      this.thU = Math.min(1, this.thU + dt / SWING_T);
      this.th = this.thFrom + (this.thTo - this.thFrom) * smooth(this.thU);
    }
    var co = Math.cos(this.th), swingV = this.gap * Math.abs(co - Math.cos(th0)) / dt;
    var ownerV = this.ownerX === null ? 0 : (ownerX - this.ownerX) / dt;
    this.ownerX = ownerX;
    /* her turbo (up to 2x her top speed) raises its follow gain and speed
       limit with her, so it keeps the same distance behind */
    this.ownerS += (Math.min(Math.abs(ownerV), this.vmax * 2) - this.ownerS) * Math.min(1, dt * 4);
    var keep = clamp(this.ownerS / this.vmax, 1, 2);

    /* follow: ease toward the spot behind her, with a little dead zone */
    var dx = ownerX - this.bx, dead = 5, lim = this.vmax * 1.35 * keep;
    var want = Math.abs(dx) < dead ? 0 : clamp((dx - (dx > 0 ? dead : -dead)) * 6 * keep, -lim, lim);
    this.vx += (want - this.vx) * Math.min(1, dt * 8);
    this.bx += this.vx * dt;
    this.x = this.bx - co * this.gap;
    /* the swing walks it round at a trot */
    var spd = Math.max(Math.abs(this.vx), Math.min(swingV, 110)), moving = spd > 12;

    /* facing: toward her (she is ahead of it), else the way it runs; it
       faces her all through a swing, swapping at the far point */
    var wf = Math.abs(ownerX - this.x) > 8 ? (ownerX > this.x ? 1 : -1) : moving ? (this.vx > 0 ? 1 : -1) : this.face;
    if (this.thU < 1) { wf = co < 0 ? -1 : 1; this.face = wf; this.turnT = 1; }
    if (wf !== this.face && this.turnT >= 1) { this.turnFrom = this.face; this.face = wf; this.turnT = 0; this.earV += 5; }
    this.turnT = Math.min(1, this.turnT + dt / 0.2);
    var tu = this.turnT, tm = Math.max(0.55, Math.abs(Math.cos(Math.PI * tu)));
    P.sx = (tu < 0.5 ? this.turnFrom : this.face) * tm;
    if (this.thU < 1) P.sx = wf * (SWING_NARROW + (1 - SWING_NARROW) * Math.abs(co));
    P.depth = Math.sin(this.th);

    /* gait: a trot whose feet stay planted, blending into a bound
       (front and hind pairs together, a little flight) at her run */
    var vu = spd / this.scale;
    var gw = moving ? Math.min(1, 0.45 + vu / 55) : 0;
    this.gait += (gw - this.gait) * Math.min(1, dt * (gw > this.gait ? 10 : 6));
    var bw = moving ? smooth((vu - 50) / 50) : 0;
    this.bound += (bw - this.bound) * Math.min(1, dt * 5);
    /* past her walking top speed the bound reaches further rather than
       quickening, so a turbo run reads as big leaps, not a scurry */
    var vtop = this.vmax / this.scale, over = smooth((vu - vtop) / vtop);
    var fT = Math.min(vu / 7.2, 4.4), fB = 2.6 + Math.min(vu, vtop) / 90 + Math.max(0, vu - vtop) / 300;
    var f = fT + (fB - fT) * this.bound;
    if (this.gait > 0.03) this.ph = (this.ph + f * TAU * dt) % TAU;
    else this.ph += (Math.round(this.ph / Math.PI) * Math.PI - this.ph) * Math.min(1, dt * 8);

    /* settle and sit */
    if (moving || air) this.idle = 0; else this.idle += dt;
    var sw = (this.idle > 2.4) ? 1 : 0;
    this.sit += (sw - this.sit) * Math.min(1, dt * (sw > this.sit ? 4 : 12));

    /* excitement drives the wag; running makes it pant a while */
    if (Math.abs(ownerV) > 40 || air) this.excite = Math.min(1, this.excite + dt * 2);
    else this.excite = Math.max(0.15, this.excite - dt * 0.25);
    this.wagPh += dt * (11 + 7 * this.excite);
    var wagAmp = (0.26 + 0.3 * this.excite + 0.1 * this.gait) * (1 - this.sit * 0.45);
    if (this.bound > 0.4) this.pantHold = 3;
    else this.pantHold = Math.max(0, this.pantHold - dt);
    var pw = this.pantHold > 0 || (this.excite > 0.7 && !moving) ? 1 : 0;
    this.pant += (pw - this.pant) * Math.min(1, dt * 5);

    /* bob: two soft bumps per trot cycle, a flight arc in the bound */
    var bob = -0.3 * this.gait * (1 - this.bound) * Math.abs(Math.cos(this.ph))
              - 1.3 * (1 + 0.35 * over) * this.bound * Math.max(0, Math.sin(this.ph))
              - Math.sin(t * 2.6) * 0.1 * (1 - this.gait) * (1 - this.sit * 0.5);
    var bv = (bob - this.prevBob) / dt; this.prevBob = bob;
    /* ear spring: kicked by the bob and by turns */
    this.earV += (-70 * this.earX - 6.5 * this.earV - bv * 2.2) * dt;
    this.earX = clamp(this.earX + this.earV * dt, -0.7, 0.6);

    /* look up at her when she floats or sits beside her; idle head tilts */
    var hu = air ? 0.65 : this.sit > 0.5 ? 0.32 : 0;
    this.headUp += (hu - this.headUp) * Math.min(1, dt * 5);
    var tilt = 0;
    if (this.idle > 1.5 && t > this.nextTilt && this.tiltT < 0) { this.tiltT = 0; this.tiltDir = -this.tiltDir; }
    if (this.tiltT >= 0) {
      this.tiltT += dt;
      tilt = 0.3 * this.tiltDir * smooth(this.tiltT / 0.2) * (1 - smooth((this.tiltT - 0.9) / 0.25));
      if (this.tiltT > 1.2 || moving) { this.tiltT = -1; this.nextTilt = t + 4 + Math.random() * 4; this.earV += 3; }
    }
    /* blinks */
    var open = 1;
    if (t > this.nextBlink && this.blinkT < 0) this.blinkT = 0;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      var bu = this.blinkT / 0.14;
      open = bu < 1 ? Math.abs(Math.cos(bu * Math.PI)) : 1;
      if (bu >= 1) { this.blinkT = -1; this.nextBlink = t + 2 + Math.random() * 3; }
    }

    P.t = t; P.ph = this.ph; P.gait = this.gait; P.bound = this.bound;
    P.bob = bob; P.pitch = this.bound * 0.1 * Math.cos(this.ph); P.sit = this.sit;
    P.headUp = this.headUp; P.tilt = tilt; P.ear = this.earX + 0.08;
    P.wag = Math.sin(this.wagPh) * wagAmp; P.open = open;
    P.pant = this.pant; P.tongue = Math.sin(t * 9); P.reach = 1 + 0.4 * over;
    return P;
  };

  var rigs = {};
  function rig(id, o) { return rigs[id] || (rigs[id] = new Rig(o)); }

  window.Game.pet = {
    draw: drawPose,
    drawIcon: drawIcon,
    rig: rig,
    Rig: Rig,
    coat: coatOf,
    variants: VARIANTS,
    wears: WEARS
  };
})();
