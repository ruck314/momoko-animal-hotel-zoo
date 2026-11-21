/* fx.js – shared lighting helpers: cached layers, glows, soft shadows,
   lit sprites, ambient motes and the adaptive effects fallback.

   Everything here is built so a frame never allocates: layers and sprite
   buffers live in named slots that are re-used, and anything static is
   baked once and blitted. Full-canvas blend-mode passes are avoided on
   purpose (they are the slow path on tablets); blend modes are only used
   while baking, or on small sprites. */
(function () {
  'use strict';
  window.Game = window.Game || {};

  /* Toggles. Flip any of them from the console to A/B an effect; baked
     layers rebuild themselves because key() is part of their cache key. */
  var FX = window.Game.FX = {
    bloom: true,     /* additive glow on lamps, suns, moons, windows */
    grade: true,     /* warm-light / cool-shade colour grade baked into backdrops */
    vignette: true,  /* darkened frame edges */
    shadows: true,   /* soft contact shadows and ambient occlusion */
    rim: true,       /* directional shading + rim light on characters */
    motes: true,     /* dust, fireflies, snow, sparkles */
    depth: true,     /* soft-focus foreground props */
    auto: true,      /* let the frame-time watchdog switch effects off */
    tier: 0          /* 0 = everything, 1 = live effects off, 2 = all off */
  };

  function dpr() { return Math.min(3, window.devicePixelRatio || 1); }

  function key() {
    return (FX.bloom ? 'b' : '-') + (FX.grade ? 'g' : '-') + (FX.vignette ? 'v' : '-') +
           (FX.shadows ? 's' : '-') + (FX.depth ? 'd' : '-') + dpr();
  }

  /* ---- Adaptive fallback ----
     EMA of the rAF delta. If it sits above ~28 ms (under ~36 fps) for a
     couple of seconds the per-frame effects go first, then the rest. It
     never switches them back on, so it cannot oscillate. */
  var ema = 16.7, slow = 0;
  function tick(delta) {
    if (!FX.auto || FX.tier >= 2 || !(delta > 0) || delta > 250) return;
    ema += (delta - ema) * 0.05;
    if (ema > 28) slow++; else if (slow > 0) slow--;
    if (slow < 120) return;
    slow = 0;
    ema = 16.7;
    FX.tier++;
    if (FX.tier === 1) {
      FX.motes = false; FX.depth = false; FX.rim = false;
    } else {
      FX.bloom = false; FX.grade = false; FX.vignette = false; FX.shadows = false;
    }
  }

  /* ---- Slots: named offscreen canvases, resized only when needed ---- */
  var slots = {};
  function slot(name, pw, ph) {
    var s = slots[name];
    if (!s) {
      s = slots[name] = { cv: document.createElement('canvas'), ctx: null, key: null };
      s.ctx = s.cv.getContext('2d');
    }
    if (s.cv.width !== pw || s.cv.height !== ph) {
      s.cv.width = pw; s.cv.height = ph; s.key = null;
    }
    return s;
  }

  /* Paint a static layer once per `k` into slot `name` (w x h logical
     pixels at `res` device pixels each) and blit it at (x, y). */
  function bake(c, name, k, x, y, w, h, paint, res) {
    res = res || dpr();
    var s = slot(name, Math.ceil(w * res), Math.ceil(h * res));
    if (s.key !== k) {
      var b = s.ctx;
      b.setTransform(1, 0, 0, 1, 0, 0);
      b.globalAlpha = 1;
      b.globalCompositeOperation = 'source-over';
      b.clearRect(0, 0, s.cv.width, s.cv.height);
      b.setTransform(res, 0, 0, res, 0, 0);
      b.save();
      paint(b);
      b.restore();
      s.key = k;
    }
    c.drawImage(s.cv, x, y, w, h);
    return s;
  }

  /* ctx.filter is missing in Safari before 18, so blurs fall back to a
     halving chain (bilinear down, then back up). Only used while baking. */
  var filterOK = (function () {
    try { return typeof document.createElement('canvas').getContext('2d').filter === 'string'; }
    catch (e) { return false; }
  })();

  /* Bake a blurred (soft-focus) layer into slot `name`. Returns the slot;
     the caller blits s.cv wherever it wants. */
  function soft(name, k, w, h, radius, paint, res) {
    res = res || 1;
    var pw = Math.ceil(w * res), ph = Math.ceil(h * res);
    var s = slot(name, pw, ph);
    if (s.key === k) return s;
    var t = slot('softTmp', pw, ph);
    var tc = t.ctx;
    tc.setTransform(1, 0, 0, 1, 0, 0);
    tc.globalAlpha = 1;
    tc.globalCompositeOperation = 'source-over';
    tc.clearRect(0, 0, pw, ph);
    tc.setTransform(res, 0, 0, res, 0, 0);
    tc.save();
    paint(tc);
    tc.restore();
    var sc = s.ctx;
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.clearRect(0, 0, pw, ph);
    if (filterOK) {
      sc.filter = 'blur(' + (radius * res).toFixed(1) + 'px)';
      sc.drawImage(t.cv, 0, 0);
      sc.filter = 'none';
    } else {
      var cur = t.cv, cw = pw, ch = ph;
      var steps = Math.max(1, Math.round(Math.log(radius * res) / Math.LN2));
      for (var i = 0; i < steps && cw > 8 && ch > 8; i++) {
        var nw = Math.ceil(cw / 2), nh = Math.ceil(ch / 2);
        var d = slot('softD' + i, nw, nh);
        d.ctx.setTransform(1, 0, 0, 1, 0, 0);
        d.ctx.clearRect(0, 0, nw, nh);
        d.ctx.drawImage(cur, 0, 0, cw, ch, 0, 0, nw, nh);
        cur = d.cv; cw = nw; ch = nh;
      }
      sc.imageSmoothingEnabled = true;
      sc.drawImage(cur, 0, 0, cw, ch, 0, 0, pw, ph);
    }
    s.key = k;
    return s;
  }

  /* ---- Radial sprites (one per colour), used for glows and shadows ---- */
  var sprites = {};
  function radial(rgb, tight) {
    var id = rgb + (tight ? 't' : 'g');
    var s = sprites[id];
    if (s) return s;
    s = document.createElement('canvas');
    s.width = s.height = 96;
    var x = s.getContext('2d');
    var g = x.createRadialGradient(48, 48, 0, 48, 48, 48);
    if (tight) {
      /* shadow falloff: flat core, soft edge */
      g.addColorStop(0, 'rgba(' + rgb + ',1)');
      g.addColorStop(0.45, 'rgba(' + rgb + ',0.72)');
      g.addColorStop(0.8, 'rgba(' + rgb + ',0.2)');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
    } else {
      /* glow falloff: hot centre, long tail */
      g.addColorStop(0, 'rgba(' + rgb + ',1)');
      g.addColorStop(0.18, 'rgba(' + rgb + ',0.6)');
      g.addColorStop(0.5, 'rgba(' + rgb + ',0.17)');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
    }
    x.fillStyle = g;
    x.fillRect(0, 0, 96, 96);
    sprites[id] = s;
    return s;
  }

  /* Additive glow centred on (x, y). ry defaults to r. */
  function glow(c, x, y, r, rgb, a, ry) {
    if (!FX.bloom || a <= 0) return;
    var op = c.globalCompositeOperation, ga = c.globalAlpha;
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = ga * a;
    ry = ry || r;
    c.drawImage(radial(rgb, false), x - r, y - ry, r * 2, ry * 2);
    c.globalAlpha = ga;
    c.globalCompositeOperation = op;
  }

  /* Soft contact shadow: a wide penumbra plus a tight core. */
  function shadow(c, x, y, rx, ry, rgb, a) {
    if (!FX.shadows || a <= 0) return;
    var ga = c.globalAlpha, sp = radial(rgb || '20,10,30', true);
    c.globalAlpha = ga * a * 0.55;
    c.drawImage(sp, x - rx * 1.25, y - ry * 1.5, rx * 2.5, ry * 3);
    c.globalAlpha = ga * a;
    c.drawImage(sp, x - rx * 0.78, y - ry * 0.7, rx * 1.56, ry * 1.4);
    c.globalAlpha = ga;
  }

  /* ---- Lit sprite ----
     Renders paint(ctx) (a w x h sprite, drawn at local 0,0) into a
     buffer, shades it along the light direction with a warm key and a
     tinted shadow side, adds a rim on the edges that face the light,
     and blits the result at (x, y) scaled by `scale`.
     L = { dx, dy (unit vector toward the light), light, shade ('r,g,b'),
           key, dark, rim (alphas) }. */
  function lit(c, name, x, y, w, h, scale, pad, paint, L) {
    if (!FX.rim || !L) {
      c.save();
      c.translate(x, y);
      c.scale(scale, scale);
      paint(c);
      c.restore();
      return null;
    }
    var d = dpr(), k = d * scale;
    var pw = Math.ceil((w + pad * 2) * k), ph = Math.ceil((h + pad * 2) * k);
    var A = slot(name + 'A', pw, ph), B = slot(name + 'B', pw, ph);
    var a = A.ctx, b = B.ctx;
    a.setTransform(1, 0, 0, 1, 0, 0);
    a.globalCompositeOperation = 'source-over';
    a.globalAlpha = 1;
    a.clearRect(0, 0, pw, ph);
    a.setTransform(k, 0, 0, k, pad * k, pad * k);
    a.save();
    paint(a);
    a.restore();
    a.setTransform(1, 0, 0, 1, 0, 0);
    a.globalAlpha = 1;

    /* Rim mask: silhouette minus the silhouette pushed away from the light */
    var rw = (0.8 + 0.55 * scale) * d;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b.clearRect(0, 0, pw, ph);
    b.drawImage(A.cv, 0, 0);
    b.globalCompositeOperation = 'source-in';
    b.fillStyle = 'rgb(' + L.light + ')';
    b.fillRect(0, 0, pw, ph);
    b.globalCompositeOperation = 'destination-out';
    b.drawImage(A.cv, -L.dx * rw, -L.dy * rw);

    /* Key light fading into a tinted shadow side */
    var cx = pw / 2, cy = ph / 2, R = Math.max(pw, ph) * 0.5;
    var g = a.createLinearGradient(cx + L.dx * R, cy + L.dy * R, cx - L.dx * R, cy - L.dy * R);
    g.addColorStop(0, 'rgba(' + L.light + ',' + L.key + ')');
    g.addColorStop(0.42, 'rgba(' + L.light + ',0)');
    g.addColorStop(0.58, 'rgba(' + L.shade + ',0)');
    g.addColorStop(1, 'rgba(' + L.shade + ',' + L.dark + ')');
    a.globalCompositeOperation = 'source-atop';
    a.fillStyle = g;
    a.fillRect(0, 0, pw, ph);
    a.globalAlpha = L.rim;
    a.drawImage(B.cv, 0, 0);
    a.globalAlpha = 1;
    a.globalCompositeOperation = 'source-over';

    /* Land on whole device pixels so the buffer isn't resampled (soft) */
    A.x = Math.round((x - pad * scale) * d) / d;
    A.y = Math.round((y - pad * scale) * d) / d;
    c.drawImage(A.cv, A.x, A.y, pw / d, ph / d);
    return A;
  }

  /* ---- Ambient motes ----
     Positions come from a hash of the index plus time, so there is no
     particle state to allocate or update.
     o = { kind, n, rgb, x, y, w, h, size, a, seed } */
  function h01(n) {
    var s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function motes(c, o) {
    if (!FX.motes || !o) return;
    var t = Date.now() * 0.001;
    var sp = radial(o.rgb, false);
    var op = c.globalCompositeOperation, ga = c.globalAlpha;
    c.globalCompositeOperation = o.kind === 'snow' ? 'source-over' : 'lighter';
    var seed = o.seed || 1;
    for (var i = 0; i < o.n; i++) {
      var a1 = h01(i * 3.1 + seed), a2 = h01(i * 5.7 + seed + 9), a3 = h01(i * 7.3 + seed + 21);
      var x, y, al, sz = o.size * (0.55 + a3 * 0.9);
      if (o.kind === 'snow') {
        var fall = (a2 * o.h + t * (14 + a3 * 22)) % o.h;
        x = o.x + (a1 * o.w + Math.sin(t * 0.7 + a2 * 6.3) * 14 + t * 5) % o.w;
        y = o.y + fall;
        al = 0.55 + 0.4 * a3;
      } else if (o.kind === 'firefly') {
        x = o.x + a1 * o.w + Math.sin(t * (0.25 + a3 * 0.3) + a2 * 6.3) * 34;
        y = o.y + a2 * o.h + Math.cos(t * (0.21 + a1 * 0.3) + a3 * 6.3) * 16;
        al = Math.sin(t * (0.9 + a1) + a2 * 6.3);
        al = al > 0 ? al * al : 0;
      } else if (o.kind === 'sparkle') {
        x = o.x + a1 * o.w;
        y = o.y + a2 * o.h;
        al = Math.sin(t * (1.2 + a3 * 1.6) + a1 * 6.3);
        al = al > 0 ? al * al * al : 0;
      } else {
        /* dust / pollen: slow drift up and sideways */
        x = o.x + (a1 * o.w + t * (3 + a3 * 6) + Math.sin(t * 0.5 + a2 * 6.3) * 10) % o.w;
        y = o.y + o.h - ((a2 * o.h + t * (2 + a1 * 5)) % o.h);
        al = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.5 + a3) + a1 * 6.3));
      }
      if (al <= 0.02) continue;
      c.globalAlpha = ga * al * o.a;
      c.drawImage(sp, x - sz, y - sz, sz * 2, sz * 2);
      if (o.kind === 'sparkle' && al > 0.3) {
        /* four-point glint */
        if (!o.css) o.css = 'rgb(' + o.rgb + ')';
        c.fillStyle = o.css;
        c.fillRect(x - sz * 1.5, y - 0.4, sz * 3, 0.8);
        c.fillRect(x - 0.4, y - sz * 1.5, 0.8, sz * 3);
      }
    }
    c.globalAlpha = ga;
    c.globalCompositeOperation = op;
  }

  window.Game.fx = {
    dpr: dpr,
    key: key,
    tick: tick,
    slot: slot,
    bake: bake,
    soft: soft,
    glow: glow,
    shadow: shadow,
    lit: lit,
    motes: motes,
    h01: h01
  };
})();
