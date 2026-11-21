/* momoko.js – the hero renderer.

   Momoko is painted in the same 28 x 34 slot every caller already uses
   (feet on y = 34, head centred on x = 14), so gameplay, the customize
   preview, the intro, the elevator, the cutscenes and the pause / victory
   floss all share one character.

   How she is built, back to front:
     twin-tails / braids / bun ribbons -> back hair -> legs and shoes ->
     outfit (skirt, bodice, sleeves) -> arms and hands -> neck -> face ->
     hair cap with clustered bangs -> hood, bows, held snack.

   Every surface is a flat fill with two hard cel bands on the side away
   from the light (skin shadows warm toward red, cloth and hair cool toward
   plum), soft occlusion where one form tucks under another (bangs on the
   forehead, chin on the neck, skirt on the legs) and an outline in a dark
   shade of its own hue instead of black. The scene's key light and rim are
   added on top by Game.fx.lit, so this file only models form.

   Secondary motion runs off the wall clock: breathing, a slow hair sway
   and the tails trailing the walk cycle. */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var TAU = Math.PI * 2;

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
  function shadowOf(col, amt, warm) {
    return mix(add(col, -amt), warm ? '#c0483a' : '#4a2470', warm ? amt / 190 : amt / 160);
  }
  /* Outline: the same hue pushed dark and a little more saturated, with a
     third of the house ink so every line belongs to one family. */
  function inkOf(col) {
    var p = rgbOf(col), r = p[0] / 255, g = p[1] / 255, b = p[2] / 255;
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

  var palCache = {};
  function ramp(col, warm) {
    return {
      c: col,
      m: shadowOf(col, 18, warm),
      d: shadowOf(col, 38, warm),
      l: mix(add(col, 34), '#ffffff', 0.3),
      ink: inkOf(warm ? shadowOf(col, 70, true) : col)
    };
  }
  function paletteFor(cust) {
    var hair = (cust && cust.hair) || '#e06088';
    var suit = (cust && cust.suit) || '#e06088';
    var skin = (cust && cust.skin) || '#ffddbb';
    var shoe = (cust && cust.flipper) || '#ff99cc';
    var k = hair + suit + skin + shoe;
    var p = palCache[k];
    if (p) return p;
    p = palCache[k] = {
      hair: ramp(hair, false),
      suit: ramp(suit, false),
      skin: ramp(skin, true),
      shoe: ramp(shoe, false),
      white: ramp('#fff6f8', false),
      tights: ramp('#fff0f4', false),
      gloss: mix(add(hair, 70), '#ffffff', 0.45),
      blush: 'rgba(255,110,140,0.34)'
    };
    p.white.ink = mix(p.suit.ink, '#8a6a7a', 0.35);
    p.tights.ink = p.white.ink;
    p.hair.deep = mix(shadowOf(hair, 70, false), '#2a1030', 0.15);
    return p;
  }

  /* ---- drawing primitives ---- */
  var LW = 0.5;          /* outline width in local units, set per call */
  var LX = -0.35, LY = -1; /* light direction used for the cel bands */

  /* Fill, two cel bands on the far side, optional extra shading clipped
     to the shape, then the hue-tinted outline. */
  function part(c, path, R, s, extra, noInk) {
    s = s || 1;
    c.save();
    path();
    c.clip();
    c.fillStyle = R.d;
    c.fillRect(-12, -16, 52, 56);
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
    c.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
  }
  function fillStar(c, cx, cy, r) {
    c.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 === 0 ? r : r * 0.42;
      if (i === 0) c.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      else c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
  }
  function stroke(c, col, w, a) {
    c.strokeStyle = col;
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

  /* ---- hair ---- */

  /* One twin-tail, left side (the right one is mirrored). Rooted high on
     the side of the head, it bells out, then splits into three locks
     whose tips trail behind the motion. */
  function tailPath(c, sw) {
    c.beginPath();
    c.moveTo(6.2, 4.6);
    c.bezierCurveTo(1.6, 3.6, -1.4, 8.6, -1.1, 14.4);
    c.bezierCurveTo(-0.9, 19.4, -0.2 + sw * 0.5, 23.6, -1.0 + sw, 28.6);
    c.quadraticCurveTo(0.9 + sw * 0.8, 26.6, 1.5 + sw * 0.7, 24.8);
    c.quadraticCurveTo(1.8 + sw * 0.9, 28.2, 3.2 + sw * 1.15, 31.0);
    c.quadraticCurveTo(3.7 + sw * 0.7, 27.0, 3.9 + sw * 0.5, 24.2);
    c.quadraticCurveTo(4.7 + sw * 0.5, 25.6, 5.6 + sw * 0.6, 26.2);
    c.bezierCurveTo(4.0, 21.0, 3.3, 15.0, 5.0, 9.4);
    c.closePath();
  }
  function drawTail(c, P, sw) {
    var H = P.hair;
    part(c, function () { tailPath(c, sw); }, H, 1.4, function () {
      /* clustered strands: darker partings running down the flow */
      c.beginPath();
      c.moveTo(3.4, 7.0);
      c.bezierCurveTo(0.9, 12, 0.9, 19, 1.5 + sw * 0.7, 24.6);
      c.moveTo(4.8, 9.6);
      c.bezierCurveTo(3.2, 15, 3.0, 20, 3.9 + sw * 0.5, 24.0);
      stroke(c, H.d, 0.55);
      /* gloss streak on the lit shoulder of the tail */
      c.beginPath();
      c.moveTo(2.2, 6.6);
      c.bezierCurveTo(0.6, 9.0, 0.2, 11.6, 0.4, 14.2);
      stroke(c, P.gloss, 0.9, 0.75);
      c.beginPath();
      c.moveTo(0.9, 16.0);
      c.lineTo(1.0, 17.4);
      stroke(c, P.gloss, 0.7, 0.55);
    });
  }

  /* Two lobes of braid per segment with a crease between, tapering. */
  function drawBraid(c, P, sw) {
    var H = P.hair;
    for (var i = 0; i < 6; i++) {
      var t = i / 5;
      var bx = 2.4 - t * 0.6 + sw * t * 1.2 + (i % 2 ? 0.45 : -0.45);
      var by = 8.6 + i * 3.9;
      var rx = 2.7 - t * 0.7, ry = 2.3 - t * 0.3;
      part(c, function () { ell(c, bx, by, rx, ry, i % 2 ? 0.35 : -0.35); }, H, 0.9, function () {
        c.beginPath();
        c.moveTo(bx - rx * 0.7, by - ry * 0.2);
        c.quadraticCurveTo(bx, by + ry * 0.5, bx + rx * 0.7, by - ry * 0.2);
        stroke(c, H.d, 0.4);
        c.globalAlpha = 0.7;
        ell(c, bx - rx * 0.35, by - ry * 0.45, rx * 0.35, ry * 0.2, -0.3);
        c.fillStyle = P.gloss;
        c.fill();
        c.globalAlpha = 1;
      });
    }
    /* tuft and ribbon at the end */
    var ex = 1.9 + sw * 1.3, ey = 31.2;
    part(c, function () {
      c.beginPath();
      c.moveTo(ex - 1.2, ey - 1.2);
      c.quadraticCurveTo(ex - 1.8, ey + 1.4, ex - 0.6, ey + 3.0);
      c.quadraticCurveTo(ex + 0.2, ey + 1.8, ex + 0.8, ey + 2.8);
      c.quadraticCurveTo(ex + 1.6, ey + 1.0, ex + 1.1, ey - 1.2);
      c.closePath();
    }, H, 0.8);
    part(c, function () { ell(c, ex, ey - 1.1, 1.7, 0.9, 0); }, P.suit, 0.6);
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

  /* The front hair: skull cap, five bang locks, and a lock down each cheek.
     ah = cowlick sway. */
  function capPath(c) {
    c.beginPath();
    c.moveTo(4.5, 11.8);
    /* left cheek lock */
    c.bezierCurveTo(4.2, 14.4, 4.8, 16.8, 6.4, 18.6);
    c.quadraticCurveTo(6.4, 15.2, 7.3, 12.6);
    c.quadraticCurveTo(7.4, 10.8, 7.9, 9.4);
    /* bangs: tips swept slightly toward the parting */
    c.quadraticCurveTo(8.0, 10.6, 8.7, 11.4);
    c.quadraticCurveTo(9.4, 9.2, 10.4, 8.2);
    c.quadraticCurveTo(10.6, 10.4, 11.9, 12.0);
    c.quadraticCurveTo(12.6, 9.6, 13.6, 8.4);
    c.quadraticCurveTo(14.4, 10.2, 15.3, 11.6);
    c.quadraticCurveTo(16.0, 9.4, 17.2, 8.2);
    c.quadraticCurveTo(17.8, 10.2, 18.9, 11.5);
    c.quadraticCurveTo(19.4, 9.6, 20.2, 8.9);
    c.quadraticCurveTo(20.4, 10.0, 20.7, 10.6);
    /* right cheek lock */
    c.quadraticCurveTo(20.8, 12.0, 20.8, 12.6);
    c.quadraticCurveTo(21.6, 15.2, 21.6, 18.6);
    c.bezierCurveTo(23.2, 16.8, 23.8, 14.4, 23.5, 11.8);
    /* crown */
    c.bezierCurveTo(23.6, 0.6, 4.4, 0.6, 4.5, 11.8);
    c.closePath();
  }
  function drawCap(c, P, ah) {
    var H = P.hair;
    /* cowlick first, so the cap overlaps its root */
    part(c, function () {
      c.beginPath();
      c.moveTo(13.2, 2.6);
      c.quadraticCurveTo(14.2, -0.8 + ah * 0.2, 17.6 + ah, -1.4);
      c.quadraticCurveTo(15.6 + ah * 0.5, -0.2, 15.4, 2.8);
      c.closePath();
    }, H, 0.6);
    part(c, function () { capPath(c); }, H, 1.6, function () {
      /* partings: strands converge at the crown */
      c.beginPath();
      c.moveTo(13.8, 2.6); c.quadraticCurveTo(10.6, 4.6, 10.4, 8.2);
      c.moveTo(14.2, 2.6); c.quadraticCurveTo(13.4, 5.2, 13.6, 8.4);
      c.moveTo(14.6, 2.6); c.quadraticCurveTo(16.8, 4.8, 17.2, 8.2);
      c.moveTo(12.8, 3.0); c.quadraticCurveTo(7.6, 5.4, 6.2, 11.0);
      c.moveTo(15.4, 3.0); c.quadraticCurveTo(20.6, 5.4, 21.8, 11.0);
      stroke(c, H.d, 0.42, 0.8);
      /* angel ring: a toothed band of gloss following the skull */
      c.beginPath();
      c.arc(14, 10.4, 7.6, Math.PI * 1.13, Math.PI * 1.87);
      for (var i = 9; i >= 0; i--) {
        var a = Math.PI * 1.13 + Math.PI * 0.74 * (i / 9);
        var r = 7.6 - (i % 2 ? 2.2 : 1.1);
        c.lineTo(14 + Math.cos(a) * r, 10.4 + Math.sin(a) * r);
      }
      c.closePath();
      c.globalAlpha = 0.6;
      c.fillStyle = P.gloss;
      c.fill();
      c.globalAlpha = 1;
      /* inner shadow where the bangs lift off the forehead */
      c.beginPath();
      c.moveTo(8.2, 10.6); c.quadraticCurveTo(14, 7.4, 20.4, 10.4);
      stroke(c, H.d, 0.5, 0.35);
    });
  }

  /* Ribbon bow: two shaded loops, a knot, two short tails. */
  function drawBow(c, P, x, y, s, flip) {
    c.save();
    c.translate(x, y);
    c.scale(flip ? -s : s, s);
    var R = P.suit;
    part(c, function () {
      c.beginPath();
      c.moveTo(0, 0.4); c.lineTo(-1.0, 3.2); c.lineTo(-0.1, 2.7); c.lineTo(0.4, 3.4); c.lineTo(0.6, 0.4);
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
      c.globalAlpha = 0.6;
      ell(c, -1.9, -0.6, 0.8, 0.4, -0.5);
      c.fillStyle = R.l;
      c.fill();
      c.globalAlpha = 1;
    });
    part(c, function () { ell(c, 0, 0.1, 0.8, 0.85, 0); }, R, 0.4);
    c.restore();
  }

  /* ---- face ---- */
  function facePath(c) {
    c.beginPath();
    c.moveTo(5.9, 11.2);
    c.bezierCurveTo(5.9, 4.4, 22.1, 4.4, 22.1, 11.2);
    c.bezierCurveTo(22.1, 15.2, 18.7, 19.2, 14, 19.5);
    c.bezierCurveTo(9.3, 19.2, 5.9, 15.2, 5.9, 11.2);
    c.closePath();
  }

  var IRIS_D = '#3a1428', IRIS = '#7c3452', IRIS_L = '#e08aa4', LASH = '#2a0e1e';
  function drawEye(c, x, y, side, mode) {
    if (mode === 'happy' || mode === 'sleep') {
      c.beginPath();
      if (mode === 'happy') c.arc(x, y + 1.2, 2.1, Math.PI * 1.12, Math.PI * 1.88);
      else c.arc(x, y - 0.2, 2.4, Math.PI * 0.15, Math.PI * 0.85);
      stroke(c, LASH, 0.95);
      if (mode === 'sleep') {
        c.beginPath();
        c.moveTo(x + side * 2.2, y + 0.6); c.lineTo(x + side * 3.0, y + 0.1);
        stroke(c, LASH, 0.6);
      }
      return;
    }
    var rx = 2.55, ry = 3.2;
    c.save();
    ell(c, x, y, rx, ry, 0);
    c.fillStyle = '#fffdfb';
    c.fill();
    c.clip();
    /* iris: dark under the lid, glowing toward the bottom */
    var g = c.createLinearGradient(0, y - ry, 0, y + ry);
    g.addColorStop(0, IRIS_D);
    g.addColorStop(0.5, IRIS);
    g.addColorStop(1, IRIS_L);
    ell(c, x + side * 0.15, y + 0.35, rx * 0.84, ry * 0.88, 0);
    c.fillStyle = g;
    c.fill();
    ell(c, x + side * 0.15, y + 0.55, 1.0, 1.35, 0);
    c.fillStyle = '#1a0612';
    c.fill();
    /* lid shadow across the top of the eye */
    ell(c, x, y - ry * 0.95, rx * 1.3, ry * 0.62, 0);
    c.fillStyle = 'rgba(70,20,50,0.32)';
    c.fill();
    /* catchlights: Momoko's signature star, plus a small bounce */
    c.fillStyle = '#ffffff';
    fillStar(c, x - side * 0.65, y - 0.9, 1.25);
    ell(c, x + side * 0.85, y + 1.5, 0.5, 0.42, 0);
    c.fill();
    c.restore();
    /* upper lash line: heavy, thinning to the inner corner, flicked out */
    c.beginPath();
    c.ellipse(x, y + 0.1, rx + 0.25, ry + 0.2, 0, side < 0 ? Math.PI * 1.04 : Math.PI * 1.22, side < 0 ? Math.PI * 1.78 : Math.PI * 1.96);
    stroke(c, LASH, 0.9);
    c.beginPath();
    c.moveTo(x + side * (rx - 0.1), y - ry * 0.55);
    c.quadraticCurveTo(x + side * (rx + 0.9), y - ry * 0.8, x + side * (rx + 1.3), y - ry * 1.05);
    stroke(c, LASH, 0.6);
  }

  function drawFace(c, P, mode) {
    var S = P.skin;
    part(c, function () { facePath(c); }, S, 0.7, function () {
      /* occlusion cast by the bangs onto the forehead */
      c.save();
      c.translate(0.1, 1.1);
      capPath(c);
      c.fillStyle = S.m;
      c.fill();
      c.restore();
      /* soft cheek bounce and blush */
      ell(c, 8.4, 16.1, 2.4, 1.4, 0);
      c.fillStyle = P.blush;
      c.fill();
      ell(c, 19.6, 16.1, 2.4, 1.4, 0);
      c.fill();
      c.beginPath();
      c.moveTo(7.6, 16.6); c.lineTo(8.2, 15.6);
      c.moveTo(8.6, 16.6); c.lineTo(9.2, 15.6);
      c.moveTo(18.8, 16.6); c.lineTo(19.4, 15.6);
      c.moveTo(19.8, 16.6); c.lineTo(20.4, 15.6);
      stroke(c, '#e0607e', 0.28, 0.5);
    });
    drawEye(c, 10.3, 13.2, -1, mode === 'floss' ? 'happy' : mode);
    drawEye(c, 17.7, 13.2, 1, mode === 'floss' ? 'happy' : mode);
    /* nose: a single warm tick */
    c.beginPath();
    c.moveTo(14.3, 15.4); c.lineTo(14.0, 16.0);
    stroke(c, S.ink, 0.35, 0.55);
    /* mouth */
    if (mode === 'sleep') {
      c.beginPath();
      c.arc(14, 17.0, 0.7, 0.2, Math.PI - 0.2);
      stroke(c, '#a8394e', 0.45);
    } else {
      var big = mode === 'floss';
      var mw = big ? 1.9 : 1.4;
      c.beginPath();
      c.moveTo(14 - mw, 16.7);
      c.quadraticCurveTo(14, big ? 17.3 : 17.05, 14 + mw, 16.7);
      c.quadraticCurveTo(14, big ? 19.6 : 18.4, 14 - mw, 16.7);
      c.closePath();
      c.fillStyle = '#93304a';
      c.fill();
      stroke(c, '#7a2238', 0.3);
      c.save();
      c.clip();
      ell(c, 14, big ? 19.0 : 18.1, big ? 1.2 : 0.9, 0.6, 0);
      c.fillStyle = '#f0788e';
      c.fill();
      if (big) { c.fillStyle = '#ffffff'; c.fillRect(12.4, 16.7, 3.2, 0.6); }
      c.restore();
    }
  }

  /* ---- body ---- */

  function legPath(c, x, top, bot) {
    c.beginPath();
    c.moveTo(x - 1.25, top);
    c.lineTo(x + 1.25, top);
    c.quadraticCurveTo(x + 1.3, (top + bot) / 2, x + 0.95, bot);
    c.lineTo(x - 0.95, bot);
    c.quadraticCurveTo(x - 1.3, (top + bot) / 2, x - 1.25, top);
    c.closePath();
  }

  function drawShoe(c, P, style, x, y) {
    var R = P.shoe;
    if (style === 'flipper') {
      /* rain boot: a shaft up the shin and a rounded toe */
      part(c, function () {
        c.beginPath();
        c.moveTo(x - 1.5, y - 3.4);
        c.lineTo(x + 1.5, y - 3.4);
        c.lineTo(x + 1.6, y - 0.6);
        c.quadraticCurveTo(x + 3.4, y - 0.4, x + 3.2, y + 0.9);
        c.lineTo(x - 1.9, y + 0.9);
        c.quadraticCurveTo(x - 2.2, y - 0.6, x - 1.5, y - 1.2);
        c.closePath();
      }, R, 0.8, function () {
        c.fillStyle = R.d;
        c.fillRect(x - 3, y + 0.2, 7, 0.8);
        c.fillStyle = R.l;
        c.fillRect(x - 1.6, y - 3.4, 3.2, 0.7);
        c.globalAlpha = 0.7;
        c.fillRect(x - 1.0, y - 2.5, 0.5, 2.0);
        c.globalAlpha = 1;
      });
    } else if (style === 'sneaker') {
      part(c, function () {
        c.beginPath();
        c.moveTo(x - 2.2, y + 0.9);
        c.quadraticCurveTo(x - 2.4, y - 1.6, x - 0.4, y - 1.8);
        c.quadraticCurveTo(x + 1.6, y - 1.8, x + 3.2, y - 0.2);
        c.quadraticCurveTo(x + 3.6, y + 0.9, x + 3.0, y + 0.9);
        c.closePath();
      }, R, 0.8, function () {
        c.fillStyle = '#ffffff';
        c.fillRect(x - 3, y + 0.1, 7, 0.8);
        c.beginPath();
        c.moveTo(x - 0.4, y - 1.4); c.lineTo(x + 0.8, y - 0.6);
        c.moveTo(x + 0.4, y - 1.6); c.lineTo(x + 1.6, y - 0.8);
        stroke(c, '#ffffff', 0.35);
      });
    } else {
      /* mary-jane: rounded toe, strap and a gold button */
      part(c, function () {
        c.beginPath();
        c.moveTo(x - 2.1, y + 0.9);
        c.quadraticCurveTo(x - 2.5, y - 1.5, x - 0.2, y - 1.6);
        c.quadraticCurveTo(x + 2.8, y - 1.6, x + 3.1, y + 0.2);
        c.quadraticCurveTo(x + 3.1, y + 0.9, x + 2.4, y + 0.9);
        c.closePath();
      }, R, 0.8, function () {
        c.globalAlpha = 0.85;
        ell(c, x + 1.3, y - 0.9, 1.0, 0.35, -0.2);
        c.fillStyle = R.l;
        c.fill();
        c.globalAlpha = 1;
        c.fillStyle = R.d;
        c.fillRect(x - 3, y + 0.3, 7, 0.7);
      });
      c.beginPath();
      c.moveTo(x - 1.4, y - 1.4); c.lineTo(x + 1.0, y - 1.5);
      stroke(c, R.ink, 0.55);
      c.fillStyle = '#ffe07a';
      ell(c, x + 1.0, y - 1.5, 0.45, 0.45, 0);
      c.fill();
    }
  }

  /* An arm from the shoulder (sx, sy) to the hand (hx, hy) with a little
     mitten hand and a thumb on the side facing the body. */
  function drawArm(c, P, sx, sy, hx, hy, side) {
    var S = P.skin;
    var dx = hx - sx, dy = hy - sy, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len, ny = dx / len;
    var w0 = 0.95, w1 = 0.8;
    part(c, function () {
      c.beginPath();
      c.moveTo(sx + nx * w0, sy + ny * w0);
      c.quadraticCurveTo((sx + hx) / 2 + nx * (w0 + 0.15), (sy + hy) / 2 + ny * (w0 + 0.15), hx + nx * w1, hy + ny * w1);
      c.lineTo(hx - nx * w1, hy - ny * w1);
      c.quadraticCurveTo((sx + hx) / 2 - nx * (w0 + 0.15), (sy + hy) / 2 - ny * (w0 + 0.15), sx - nx * w0, sy - ny * w0);
      c.closePath();
    }, S, 0.6);
    var ux = dx / len, uy = dy / len;
    var cx = hx + ux * 0.55, cy = hy + uy * 0.55, ang = Math.atan2(uy, ux);
    part(c, function () { ell(c, cx, cy, 1.45, 1.25, ang); }, S, 0.5, function () {
      /* thumb crease on the side facing the body */
      c.beginPath();
      c.moveTo(cx - side * 0.2 - ux * 0.9, cy - uy * 0.9);
      c.quadraticCurveTo(cx - side * 0.9, cy, cx - side * 0.5 + ux * 0.6, cy + uy * 0.6);
      stroke(c, S.ink, LW * 0.7, 0.55);
    });
  }

  function skirtPath(c, sw, flare) {
    var hl = 4.6 - flare + sw, hr = 23.4 + flare + sw;
    c.beginPath();
    c.moveTo(9.3, 24.2);
    c.bezierCurveTo(7.6, 26.0, hl + 0.6, 28.4, hl, 30.4);
    /* hem waves (folds seen end-on) */
    c.quadraticCurveTo(hl + 2.3, 31.4, hl + 4.7, 30.6);
    c.quadraticCurveTo(hl + 7.0, 31.5, 14 + sw, 30.7);
    c.quadraticCurveTo(hr - 7.0, 31.5, hr - 4.7, 30.6);
    c.quadraticCurveTo(hr - 2.3, 31.4, hr, 30.4);
    c.bezierCurveTo(hr - 0.6, 28.4, 20.4, 26.0, 18.7, 24.2);
    c.closePath();
  }

  function drawDress(c, P, outfit, sw, flare) {
    var R = P.suit;
    /* petticoat / lace hem peeking under the skirt */
    if (outfit !== 'starDress') {
      var hl = 4.6 - flare + sw, hr = 23.4 + flare + sw;
      c.beginPath();
      c.moveTo(hl + 0.4, 30.0);
      for (var i = 0; i <= 8; i++) {
        var x = hl + 0.4 + (hr - hl - 0.8) * (i / 8);
        c.arc(x, 30.9, 1.05, Math.PI * 0.95, Math.PI * 0.05, true);
      }
      c.lineTo(hr - 0.4, 30.0);
      c.closePath();
      c.fillStyle = P.white.c;
      c.fill();
      stroke(c, P.white.ink, LW * 0.8, 0.8);
    }
    part(c, function () { skirtPath(c, sw, flare); }, R, 1.2, function () {
      /* pleat shadows fanning out from the waist, highlight between */
      c.fillStyle = R.m;
      c.beginPath();
      c.moveTo(11.0, 24.6); c.lineTo(8.4 - flare * 0.5 + sw, 31); c.lineTo(10.2 - flare * 0.3 + sw, 31); c.closePath();
      c.moveTo(14.3, 24.6); c.lineTo(15.0 + sw, 31); c.lineTo(16.6 + sw, 31); c.closePath();
      c.moveTo(17.4, 24.6); c.lineTo(20.8 + flare * 0.5 + sw, 31); c.lineTo(22.6 + flare * 0.6 + sw, 31); c.closePath();
      c.fill();
      c.globalAlpha = 0.55;
      c.fillStyle = R.l;
      c.beginPath();
      c.moveTo(12.2, 24.6); c.lineTo(11.0 + sw, 31); c.lineTo(12.2 + sw, 31); c.closePath();
      c.fill();
      c.globalAlpha = 1;
      if (outfit === 'starDress') {
        c.fillStyle = '#ffd24a';
        fillStar(c, 8.0 + sw, 28.8, 0.9);
        fillStar(c, 12.0 + sw, 29.6, 0.8);
        fillStar(c, 16.2 + sw, 28.4, 0.9);
        fillStar(c, 20.0 + sw, 29.5, 0.8);
        fillStar(c, 14.0 + sw * 0.5, 26.6, 0.6);
      } else if (outfit === 'sailorDress') {
        c.fillStyle = '#ffffff';
        c.fillRect(0, 29.2, 28, 0.55);
        c.fillRect(0, 28.2, 28, 0.35);
      }
    });
    if (outfit === 'starDress') {
      c.beginPath();
      c.moveTo(4.6 - flare + sw, 30.4);
      c.quadraticCurveTo(14 + sw, 31.6, 23.4 + flare + sw, 30.4);
      stroke(c, '#fff4c0', 0.6);
    }
  }

  var GOLD = ramp('#ffd24a', false);
  var sashCache = {};
  function sashOf(P) { return sashCache[P.suit.c] || (sashCache[P.suit.c] = ramp(mix(P.suit.c, '#ffffff', 0.55), false)); }

  function bodicePath(c) {
    c.beginPath();
    c.moveTo(9.0, 20.6);
    c.quadraticCurveTo(14, 19.6, 19.0, 20.6);
    c.quadraticCurveTo(19.4, 22.6, 18.8, 24.9);
    c.lineTo(9.2, 24.9);
    c.quadraticCurveTo(8.6, 22.6, 9.0, 20.6);
    c.closePath();
  }

  function drawBodice(c, P, outfit) {
    var R = P.suit;
    part(c, function () { bodicePath(c); }, R, 0.9, function () {
      /* occlusion under the chin */
      ell(c, 14, 20.0, 3.4, 1.2, 0);
      c.fillStyle = R.d;
      c.globalAlpha = 0.6;
      c.fill();
      c.globalAlpha = 1;
    });
    if (outfit === 'frillyDress') {
      /* lace collar: two rounded petals and a heart gem */
      part(c, function () {
        c.beginPath();
        c.moveTo(14, 20.4);
        c.bezierCurveTo(12.6, 20.0, 10.0, 19.8, 10.0, 21.0);
        c.bezierCurveTo(10.2, 22.4, 12.6, 22.6, 14, 21.4);
        c.bezierCurveTo(15.4, 22.6, 17.8, 22.4, 18.0, 21.0);
        c.bezierCurveTo(18.0, 19.8, 15.4, 20.0, 14, 20.4);
        c.closePath();
      }, P.white, 0.4);
      var hx = 14, hy = 22.5;
      c.fillStyle = '#ff4f74';
      c.beginPath();
      c.arc(hx - 0.55, hy - 0.25, 0.62, 0, TAU);
      c.arc(hx + 0.55, hy - 0.25, 0.62, 0, TAU);
      c.moveTo(hx - 1.1, hy); c.lineTo(hx, hy + 1.2); c.lineTo(hx + 1.1, hy);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.85)';
      ell(c, hx - 0.6, hy - 0.45, 0.25, 0.2, 0);
      c.fill();
    } else if (outfit === 'sailorDress') {
      part(c, function () {
        c.beginPath();
        c.moveTo(9.4, 20.5); c.lineTo(14, 23.6); c.lineTo(18.6, 20.5);
        c.lineTo(17.0, 20.2); c.lineTo(14, 22.0); c.lineTo(11.0, 20.2);
        c.closePath();
      }, P.white, 0.3);
      c.beginPath();
      c.moveTo(10.2, 20.9); c.lineTo(14, 23.0); c.lineTo(17.8, 20.9);
      stroke(c, R.d, 0.35);
      /* neckerchief knot */
      part(c, function () {
        c.beginPath();
        c.moveTo(13.2, 23.0); c.lineTo(14.8, 23.0); c.lineTo(14.4, 24.6); c.lineTo(13.6, 24.6);
        c.closePath();
      }, P.white, 0.3);
    } else if (outfit === 'starDress') {
      drawBow(c, { suit: GOLD }, 14, 21.2, 0.55, false);
      c.fillStyle = '#fff4a8';
      fillStar(c, 14, 23.5, 1.25);
    }
    /* waist sash */
    part(c, function () {
      c.beginPath();
      c.moveTo(9.1, 24.0); c.lineTo(18.9, 24.0); c.lineTo(18.8, 25.2); c.lineTo(9.2, 25.2);
      c.closePath();
    }, outfit === 'starDress' ? GOLD : outfit === 'sailorDress' ? P.white : sashOf(P), 0.3);
  }

  function drawSleeve(c, P, x, y, R) {
    part(c, function () { ell(c, x, y, 2.05, 1.75, 0); }, R || P.suit, 0.8, function () {
      c.globalAlpha = 0.6;
      ell(c, x - 0.5, y - 0.7, 0.9, 0.45, -0.3);
      c.fillStyle = (R || P.suit).l;
      c.fill();
      c.globalAlpha = 1;
    });
  }

  /* ---- animal-pajama onesies ---- */
  var PJ = {
    frillyBikini: { body: null, hood: null, inner: '#ff99bb' },   /* tinted by the suit colour */
    sailorSwimsuit: { body: '#fafafa', hood: '#ffffff', inner: '#1a1a1a' },
    onePiece: { body: '#ffe6f5', hood: '#ffe6f5', inner: '#ffd24a' }
  };
  var pjRamps = {};
  function pjRamp(col) { return pjRamps[col] || (pjRamps[col] = ramp(col, false)); }
  function pjBody(outfit, P) { return PJ[outfit].body ? pjRamp(PJ[outfit].body) : P.suit; }
  function pjHood(outfit, P) { return PJ[outfit].hood ? pjRamp(PJ[outfit].hood) : pjRamp(mix(P.suit.c, '#fff4ee', 0.55)); }

  function onesiePath(c, sw) {
    c.beginPath();
    c.moveTo(9.0, 20.4);
    c.quadraticCurveTo(14, 19.5, 19.0, 20.4);
    c.quadraticCurveTo(20.0, 24.0, 19.6, 27.0);
    c.lineTo(18.6 + sw * 0.2, 32.4);
    c.lineTo(15.0, 32.4);
    c.lineTo(14.4, 28.6);
    c.lineTo(13.6, 28.6);
    c.lineTo(13.0, 32.4);
    c.lineTo(9.4 - sw * 0.2, 32.4);
    c.lineTo(8.4, 27.0);
    c.quadraticCurveTo(8.0, 24.0, 9.0, 20.4);
    c.closePath();
  }

  function drawOnesie(c, P, outfit, sw) {
    var R = pjBody(outfit, P);
    part(c, function () { onesiePath(c, sw); }, R, 1.0, function () {
      if (outfit === 'sailorSwimsuit') {
        /* panda: black limbs and a band across the hips */
        c.fillStyle = '#1e1a20';
        c.fillRect(0, 27.4, 28, 6);
        c.fillRect(0, 19, 28, 1.6);
        c.fillStyle = '#5a8a38';
        c.fillRect(12.2, 23.0, 3.6, 3.8);
        c.fillStyle = '#8aba58';
        c.fillRect(13.0, 23.0, 0.55, 3.8);
        c.fillRect(14.4, 23.0, 0.55, 3.8);
      } else if (outfit === 'onePiece') {
        var st = ['#ffb3d9', '#ffe6b3', '#d9ffb3', '#b3e6ff', '#d9b3ff'];
        for (var i = 0; i < 7; i++) {
          c.fillStyle = st[i % 5];
          c.fillRect(0, 20.4 + i * 1.75, 28, 1.75);
        }
        c.fillStyle = '#fff4a8';
        fillStar(c, 14, 24.4, 1.4);
      } else {
        /* bunny: fluffy belly and a carrot button */
        ell(c, 14, 25.4, 3.6, 3.0, 0);
        c.fillStyle = '#fffaf4';
        c.fill();
        c.fillStyle = '#ff9944';
        c.fillRect(13.6, 24.4, 0.8, 1.9);
        c.fillStyle = '#3a8a38';
        c.fillRect(13.6, 23.8, 0.8, 0.7);
      }
      /* fabric shading: crotch and side folds */
      c.fillStyle = 'rgba(74,36,112,0.18)';
      c.fillRect(13.2, 28.4, 1.6, 4);
      c.fillRect(18.0, 21, 2, 12);
    });
    /* buttons */
    c.fillStyle = outfit === 'sailorSwimsuit' ? P.suit.c : '#ff99bb';
    ell(c, 11.4, 21.8, 0.55, 0.55, 0); c.fill();
    ell(c, 16.6, 21.8, 0.55, 0.55, 0); c.fill();
    if (outfit === 'frillyBikini') {
      part(c, function () { ell(c, 20.6, 28.4, 1.8, 1.7, 0); }, pjRamp('#fffaf4'), 0.6);
    }
  }

  function drawHood(c, P, outfit, ah) {
    var R = pjHood(outfit, P);
    /* ears go behind the hood */
    if (outfit === 'frillyBikini') {
      for (var e = 0; e < 2; e++) {
        var ex = e ? 19.4 : 8.6, rot = e ? 0.25 + ah * 0.05 : -0.25 + ah * 0.05;
        part(c, function () { ell(c, ex, -4.6, 2.1, 6.4, rot); }, R, 0.8, function () {
          ell(c, ex, -4.2, 1.0, 4.4, rot);
          c.fillStyle = '#ff9fbf';
          c.fill();
        });
      }
    } else if (outfit === 'sailorSwimsuit') {
      var dark = pjRamp('#1e1a20');
      part(c, function () { ell(c, 6.4, 2.2, 3.0, 2.8, 0); }, dark, 0.8);
      part(c, function () { ell(c, 21.6, 2.2, 3.0, 2.8, 0); }, dark, 0.8);
    }
    part(c, function () {
      c.beginPath();
      c.moveTo(3.4, 16.4);
      c.bezierCurveTo(1.6, 6.0, 7.0, -0.6, 14, -0.6);
      c.bezierCurveTo(21.0, -0.6, 26.4, 6.0, 24.6, 16.4);
      c.quadraticCurveTo(23.2, 18.4, 21.4, 18.2);
      /* face opening, traced back the other way */
      c.bezierCurveTo(23.6, 11.4, 21.0, 4.0, 14, 4.0);
      c.bezierCurveTo(7.0, 4.0, 4.4, 11.4, 6.6, 18.2);
      c.quadraticCurveTo(4.8, 18.4, 3.4, 16.4);
      c.closePath();
    }, R, 1.0, function () {
      /* inner rim of the opening, in shadow */
      c.beginPath();
      c.moveTo(6.6, 18.2);
      c.bezierCurveTo(4.4, 11.4, 7.0, 4.0, 14, 4.0);
      c.bezierCurveTo(21.0, 4.0, 23.6, 11.4, 21.4, 18.2);
      stroke(c, R.d, 1.3, 0.6);
    });
    if (outfit === 'onePiece') {
      /* spiral unicorn horn */
      part(c, function () {
        c.beginPath();
        c.moveTo(12.2, 0.6); c.lineTo(14.2 + ah * 0.3, -9.6); c.lineTo(16.0, 0.6);
        c.closePath();
      }, pjRamp('#ffd24a'), 0.6, function () {
        c.beginPath();
        c.moveTo(12.8, -1.4); c.lineTo(15.4, -2.4);
        c.moveTo(13.2, -4.2); c.lineTo(15.0, -5.0);
        c.moveTo(13.6, -6.8); c.lineTo(14.6, -7.2);
        stroke(c, '#ff99cc', 0.5);
      });
    }
  }

  function drawBuns(c, P) {
    for (var bn = 0; bn < 2; bn++) {
      var bx = bn ? 22.4 : 5.6;
      part(c, function () { ell(c, bx, 3.0, 3.9, 3.6, 0); }, P.hair, 1.1, function () {
        c.beginPath();
        c.arc(bx + 0.2, 3.2, 2.0, Math.PI * 0.9, Math.PI * 2.2);
        stroke(c, P.hair.d, 0.45);
        c.globalAlpha = 0.7;
        ell(c, bx - 1.2, 1.6, 1.2, 0.6, -0.5);
        c.fillStyle = P.gloss;
        c.fill();
        c.globalAlpha = 1;
      });
    }
  }

  /* ---- held snack (unchanged menu, re-inked) ---- */
  function drawFood(c, food, fx, fy) {
    if (food === 'iceCream') {
      c.fillStyle = '#e0b070';
      c.beginPath(); c.moveTo(fx - 1.5, fy + 2); c.lineTo(fx + 1.5, fy + 2); c.lineTo(fx, fy + 6); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(fx - 1, fy + 2.5); c.lineTo(fx + 0.8, fy + 5); stroke(c, '#9a7048', 0.4);
      c.fillStyle = '#ffc8d4';
      ell(c, fx, fy + 1, 2.2, 2.2, 0); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.6)';
      ell(c, fx - 0.7, fy + 0.3, 0.8, 0.5, -0.4); c.fill();
      c.fillStyle = '#ff3355';
      ell(c, fx, fy - 1.3, 0.7, 0.7, 0); c.fill();
    } else if (food === 'onigiri') {
      c.fillStyle = '#ffffff';
      c.beginPath(); c.moveTo(fx, fy - 1.5); c.quadraticCurveTo(fx - 3.2, fy + 2.8, fx, fy + 2.6); c.quadraticCurveTo(fx + 3.2, fy + 2.8, fx, fy - 1.5); c.closePath(); c.fill();
      stroke(c, '#8a8a9a', 0.3);
      c.fillStyle = '#2a3a2a';
      c.fillRect(fx - 1.4, fy + 1, 2.8, 1.5);
    } else if (food === 'donut') {
      c.fillStyle = '#c88858';
      ell(c, fx, fy + 1, 2.3, 2.3, 0); c.fill();
      c.fillStyle = '#ff99cc';
      c.beginPath(); c.arc(fx, fy + 1, 2.1, Math.PI + 0.3, -0.3, false); c.fill();
      c.fillStyle = '#ffe4b0';
      ell(c, fx, fy + 1, 0.75, 0.75, 0); c.fill();
      c.fillStyle = '#ffff66'; c.fillRect(fx - 1, fy - 0.2, 0.4, 0.4);
      c.fillStyle = '#66ddff'; c.fillRect(fx + 0.8, fy, 0.4, 0.4);
      c.fillStyle = '#ff66aa'; c.fillRect(fx - 0.2, fy + 0.5, 0.4, 0.4);
    } else if (food === 'crepe') {
      c.fillStyle = '#f2d8a4';
      c.beginPath(); c.moveTo(fx - 2, fy - 2); c.lineTo(fx + 2, fy - 2); c.lineTo(fx, fy + 4); c.closePath(); c.fill();
      c.fillStyle = '#ffdceb';
      c.beginPath(); c.arc(fx, fy - 1.8, 1.4, Math.PI, 0); c.fill();
      c.fillStyle = '#dd3355';
      ell(c, fx - 0.6, fy - 2.2, 0.55, 0.55, 0); c.fill();
    } else if (food === 'taiyaki') {
      c.fillStyle = '#cc8844';
      ell(c, fx, fy + 1, 3, 1.8, 0); c.fill();
      c.beginPath(); c.moveTo(fx + 2.5, fy + 1); c.lineTo(fx + 4, fy - 0.5); c.lineTo(fx + 4, fy + 2.5); c.closePath(); c.fill();
      c.fillStyle = '#e0a868';
      ell(c, fx - 0.5, fy + 0.3, 1.6, 0.5, 0); c.fill();
      c.fillStyle = '#1a0c14';
      ell(c, fx - 1.8, fy + 0.5, 0.3, 0.3, 0); c.fill();
    } else if (food === 'parfait') {
      c.fillStyle = '#6b3a1a'; c.fillRect(fx - 1.4, fy + 2, 2.8, 1.3);
      c.fillStyle = '#fff4dc'; c.fillRect(fx - 1.4, fy + 0.7, 2.8, 1.3);
      c.fillStyle = '#ff6688'; c.fillRect(fx - 1.4, fy - 0.6, 2.8, 1.3);
      c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.4;
      c.strokeRect(fx - 1.6, fy - 1.5, 3.2, 5);
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(fx, fy - 1.8, 1.3, Math.PI, 0); c.fill();
      c.fillStyle = '#dd2244';
      ell(c, fx + 0.6, fy - 2.9, 0.5, 0.5, 0); c.fill();
    } else if (food === 'macaron') {
      c.fillStyle = '#ffbadb'; ell(c, fx, fy - 0.8, 2.4, 1.1, 0); c.fill();
      c.fillStyle = '#ffffff'; c.fillRect(fx - 2.4, fy - 0.1, 4.8, 0.9);
      c.fillStyle = '#ff9ac2'; ell(c, fx, fy + 1.3, 2.4, 1.1, 0); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.5)'; ell(c, fx - 0.8, fy - 1, 1, 0.3, 0); c.fill();
    } else if (food === 'strawberry') {
      c.fillStyle = '#e8344a';
      c.beginPath(); c.moveTo(fx - 2, fy - 1); c.quadraticCurveTo(fx, fy + 4, fx + 2, fy - 1); c.closePath(); c.fill();
      c.fillStyle = '#fff4a8';
      ell(c, fx - 0.8, fy + 0.5, 0.25, 0.25, 0); c.fill();
      ell(c, fx + 0.6, fy + 0.3, 0.25, 0.25, 0); c.fill();
      ell(c, fx, fy + 1.6, 0.25, 0.25, 0); c.fill();
      c.fillStyle = '#3caf3c';
      c.beginPath(); c.moveTo(fx - 2.2, fy - 1); c.lineTo(fx - 0.6, fy - 1.8); c.lineTo(fx + 0.6, fy - 1.8); c.lineTo(fx + 2.2, fy - 1); c.lineTo(fx, fy - 0.2); c.closePath(); c.fill();
    }
  }

  /* ---- the whole figure ----
     opts (optional): { pose: 'floss', phase, eyes: 'sleep' } */
  function paint(c, sx, sy, cust, frame, opts, t) {
    var P = paletteFor(cust);
    var hairStyle = (cust && cust.hairStyle) || 'twinTails';
    var outfit = (cust && cust.outfit) || 'frillyDress';
    var shoes = (cust && cust.shoes) || 'maryJane';
    var food = (cust && cust.food) || 'none';
    var pajama = !!PJ[outfit];
    if (!pajama && outfit !== 'sailorDress' && outfit !== 'starDress') outfit = 'frillyDress';
    var floss = opts && opts.pose === 'floss';
    var mode = floss ? 'floss' : (opts && opts.eyes) || 'open';

    /* outline width: about one device pixel at gameplay size, thinner in
       local units as she is drawn bigger so close-ups stay crisp */
    var u = 2;
    if (c.getTransform) { var m = c.getTransform(); u = Math.sqrt(m.a * m.a + m.b * m.b) || 2; }
    LW = Math.max(0.9, Math.min(3.0, u * 0.42)) / u;

    var f = (frame || 0) % 4;
    var ph = f * Math.PI / 2;
    var step = Math.sin(ph);                  /* -1..1 across the walk cycle */
    var walking = f !== 0;
    var breath = Math.sin(t * 2.1);
    var sway = Math.sin(t * 1.4) * 0.35 + (walking ? -0.6 - Math.abs(step) * 0.5 : 0);
    var ah = Math.sin(t * 2.6) * 0.5 + (walking ? step * 0.4 : 0);

    var beat = 0, hip = 0;
    if (floss) {
      beat = Math.tanh(Math.sin(opts.phase || 0) * 3.2);
      hip = beat * 1.6;
      sway = -beat * 1.2;
    }

    c.save();
    c.translate(sx, sy);
    if (floss) {
      c.translate(14, 22);
      c.rotate(beat * 0.07);
      c.translate(-14, -22);
    }

    /* ---- hair behind everything ---- */
    var headLift = breath * 0.18;
    c.save();
    c.translate(0, -headLift);
    if (hairStyle === 'longBraids') {
      drawBraid(c, P, sway);
      c.save(); c.translate(28, 0); c.scale(-1, 1); drawBraid(c, P, -sway * 0.8); c.restore();
    } else if (hairStyle === 'buns') {
      /* ribbon tails hanging beside the head */
      for (var rb = 0; rb < 2; rb++) {
        c.save();
        if (rb) { c.translate(28, 0); c.scale(-1, 1); }
        var rs = rb ? -sway * 0.8 : sway;
        part(c, function () {
          c.beginPath();
          c.moveTo(4.2, 5.4);
          c.quadraticCurveTo(1.0 + rs * 0.5, 13, 1.8 + rs, 22.4);
          c.lineTo(3.0 + rs, 21.0);
          c.lineTo(4.4 + rs, 22.2);
          c.quadraticCurveTo(4.6 + rs * 0.5, 13, 6.6, 5.6);
          c.closePath();
        }, P.suit, 0.8);
        c.restore();
      }
    } else {
      drawTail(c, P, sway);
      c.save(); c.translate(28, 0); c.scale(-1, 1); drawTail(c, P, -sway * 0.8); c.restore();
    }
    part(c, function () { backHairPath(c); }, { c: P.hair.m, m: P.hair.d, d: P.hair.deep, ink: P.hair.ink }, 1);
    c.restore();

    /* ---- floss: the arm that swings behind the body ---- */
    var armDir = -beat;
    if (floss) {
      /* both hands swing out to the same side: this one passes behind
         the body from the near shoulder */
      drawArm(c, P, 14 + armDir * 4.2 + hip * 0.5, 22.0, 14 + armDir * 10.2 + hip * 0.5, 25.4 - Math.sin((opts.phase || 0) * 2) * 0.3, armDir > 0 ? 1 : -1);
    }

    /* ---- legs and shoes ---- */
    var liftL = walking ? Math.max(0, step) * 1.1 : 0;
    var liftR = walking ? Math.max(0, -step) * 1.1 : 0;
    var lx = 11.5 + hip, rx = 16.5 + hip;
    var legR = pajama ? null : P.tights;
    if (legR) {
      part(c, function () { legPath(c, lx, 28.6, 33.0 - liftL); }, legR, 0.6);
      part(c, function () { legPath(c, rx, 28.6, 33.0 - liftR); }, legR, 0.6);
    }
    drawShoe(c, P, shoes, lx - 0.4, 33.6 - liftL);
    drawShoe(c, P, shoes, rx - 0.4, 33.6 - liftR);

    /* ---- outfit ---- */
    var bodyY = breath * 0.12;
    c.save();
    c.translate(hip * 0.6, -bodyY);
    var flare = walking ? 0.3 : 0;
    if (pajama) {
      drawOnesie(c, P, outfit, sway * 0.2);
    } else {
      drawDress(c, P, outfit, (floss ? -hip * 0.3 : sway * 0.18), flare);
      drawBodice(c, P, outfit);
    }
    c.restore();

    /* ---- arms ---- */
    var sleeveR = pajama ? pjBody(outfit, P) : P.suit;
    var swing = walking ? step * 0.7 : 0;
    if (floss) {
      drawSleeve(c, P, 8.6 + hip * 0.6, 21.4, sleeveR);
      drawSleeve(c, P, 19.4 + hip * 0.6, 21.4, sleeveR);
      /* ...and this one crosses the front from the far shoulder */
      drawArm(c, P, 14 - armDir * 4.6 + hip * 0.6, 21.9, 14 + armDir * 7.6 + hip * 0.6, 27.6 + Math.sin((opts.phase || 0) * 2) * 0.3, armDir > 0 ? 1 : -1);
    } else {
      var hasFood = food !== 'none';
      /* left arm (viewer's left): raised to hold the snack, or swinging */
      if (hasFood) drawArm(c, P, 8.3, 21.8, 5.6, 24.4, -1);
      else drawArm(c, P, 8.3, 21.8, 6.6 - swing * 0.3, 26.6 + swing * 0.4, -1);
      drawArm(c, P, 19.7, 21.8, 21.4 + swing * 0.3, 26.6 - swing * 0.4, 1);
      drawSleeve(c, P, 8.5, 21.4 - bodyY, sleeveR);
      drawSleeve(c, P, 19.5, 21.4 - bodyY, sleeveR);
      if (hasFood) drawFood(c, food, 4.6, 21.6);
    }

    /* ---- head ---- */
    c.save();
    c.translate(floss ? hip * 0.3 : 0, -headLift);
    /* neck, with the chin's shadow across the top */
    part(c, function () {
      c.beginPath();
      c.rect(12.8, 17.6, 2.4, 3.0);
    }, P.skin, 0.4, function () {
      c.fillStyle = P.skin.m;
      c.fillRect(12, 17.6, 4, 2.6);
    }, true);
    drawFace(c, P, mode);
    drawCap(c, P, ah);
    /* buns sit under the hood when she wears pajamas, on top otherwise */
    if (hairStyle === 'buns' && pajama) drawBuns(c, P);
    if (pajama) drawHood(c, P, outfit, ah);
    if (hairStyle === 'buns') {
      if (!pajama) drawBuns(c, P);
      drawBow(c, P, 8.4, 5.2, 0.6, false);
      drawBow(c, P, 19.6, 5.2, 0.6, true);
    } else if (hairStyle === 'twinTails' && !pajama) {
      drawBow(c, P, 5.6, 5.2, 0.75, false);
      drawBow(c, P, 22.4, 5.2, 0.75, true);
    } else if (hairStyle === 'twinTails') {
      drawBow(c, P, 4.6, 12.6, 0.6, false);
      drawBow(c, P, 23.4, 12.6, 0.6, true);
    }
    c.restore();

    c.restore();
  }

  /* ---- sprite cache ----
     Painting her costs ~1 ms (dozens of clipped, banded shapes), so the
     finished figure is kept per draw scale and only repainted when
     something visible changes: the outfit, the walk frame, or the
     secondary-motion clock, which ticks at 15 Hz. The cached bitmap is
     blitted 1:1 on whole device pixels, so it is as sharp as painting
     directly. Rotated or skewed callers (the pillow in the sleep scene)
     and the floss dance paint directly. */
  var X0 = -5, Y0 = -14, CW = 38, CH = 52;
  var cache = {}, cacheOrder = [];
  function cacheSlot(u) {
    var id = u.toFixed(3), s = cache[id];
    if (!s) {
      if (cacheOrder.length >= 8) delete cache[cacheOrder.shift()];
      s = cache[id] = { cv: document.createElement('canvas'), key: null };
      s.cv.width = Math.ceil(CW * u);
      s.cv.height = Math.ceil(CH * u);
      s.ctx = s.cv.getContext('2d');
      cacheOrder.push(id);
    }
    return s;
  }
  function draw(c, sx, sy, cust, frame, opts) {
    var tick = Math.floor(Date.now() * 0.015);
    var m = c.getTransform ? c.getTransform() : null;
    if (!m || (opts && opts.pose === 'floss') || Math.abs(m.b) > 1e-6 || Math.abs(m.c) > 1e-6 ||
        Math.abs(Math.abs(m.a) - Math.abs(m.d)) > 1e-6) {
      paint(c, sx, sy, cust, frame, opts, Date.now() * 0.001);
      return;
    }
    var u = Math.abs(m.a);
    var s = cacheSlot(u);
    var cu = cust || {};
    var key = cu.hair + cu.suit + cu.skin + cu.flipper + cu.hairStyle + cu.outfit + cu.shoes + cu.food +
              '|' + ((frame || 0) % 4) + '|' + ((opts && opts.eyes) || '') + '|' + tick;
    if (s.key !== key) {
      var b = s.ctx;
      b.setTransform(1, 0, 0, 1, 0, 0);
      b.clearRect(0, 0, s.cv.width, s.cv.height);
      b.setTransform(u, 0, 0, u, -X0 * u, -Y0 * u);
      paint(b, 0, 0, cust, frame, opts, tick / 15);
      s.key = key;
    }
    c.save();
    c.setTransform(m.a < 0 ? -1 : 1, 0, 0, m.d < 0 ? -1 : 1,
                   Math.round(m.a * (sx + X0) + m.e), Math.round(m.d * (sy + Y0) + m.f));
    c.drawImage(s.cv, 0, 0);
    c.restore();
  }

  window.Game.momoko = { draw: draw, palette: paletteFor };
})();
