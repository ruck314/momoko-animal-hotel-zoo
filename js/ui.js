/* ui.js – title screen, HUD, menus, dialogue, game over, victory, beach cutscene */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var W = 800, H = 480;
  var titleAnimTimer = 0;
  var titleBubbles = [];

  /* Title-screen twinkling stars */
  for (var i = 0; i < 60; i++) {
    titleBubbles.push({
      x: Math.random() * W,
      y: Math.random() * H * 0.9,
      r: 1 + Math.random() * 4,
      speed: 0, /* stars stay put, they just twinkle */
      wobble: Math.random() * Math.PI * 2,
    });
  }

  /* ---- Helpers ---- */
  var FONT = '"M PLUS Rounded 1c", sans-serif';

  /* The rectangle the ambient backdrops fill, in game coordinates. It is
     the 800x480 viewport everywhere except on touch devices, where the
     engine widens it to the whole canvas for the title, customize and
     intro screens so the dusk sky fills the bezel instead of a dark
     frame. Everything else on those screens stays clipped to the
     viewport via clipGame(). */
  var VIEW = { x: 0, y: 0, w: W, h: H };
  function setView(x, y, w, h) { VIEW.x = x; VIEW.y = y; VIEW.w = w; VIEW.h = h; }
  function clipGame(c) { c.beginPath(); c.rect(0, 0, W, H); c.clip(); }

  /* Extra stars for the part of the view outside the viewport, made once
     per layout at the same density as the title's own star field. */
  var bezelStars = [], bezelKey = '';
  function viewBezelStars() {
    var key = VIEW.x + ',' + VIEW.y + ',' + VIEW.w + ',' + VIEW.h;
    if (key === bezelKey) return bezelStars;
    bezelKey = key;
    bezelStars = [];
    var extra = VIEW.w * VIEW.h - W * H;
    var n = Math.round(titleBubbles.length * extra / (W * H));
    for (var i = 0; i < n; i++) {
      var x, y, tries = 0;
      do {
        x = VIEW.x + Math.random() * VIEW.w;
        y = VIEW.y + Math.random() * VIEW.h;
      } while (x >= 0 && x < W && y >= 0 && y < H && ++tries < 20);
      bezelStars.push({ x: x, y: y, r: 1 + Math.random() * 4, wobble: Math.random() * Math.PI * 2 });
    }
    return bezelStars;
  }

  /* True when the mouse is over the rect, in whatever coordinate space
     the caller is currently drawing in (the pointer is stored in
     backing-store pixels and mapped back through the live transform). */
  var anyHot = false;
  function pointerOver(c, x, y, w, h) {
    var p = Game.input && Game.input.pointer;
    if (!p || p.px < 0 || !c.getTransform) return false;
    var pt = c.getTransform().inverse().transformPoint(new DOMPoint(p.px, p.py));
    var over = pt.x >= x && pt.x <= x + w && pt.y >= y && pt.y <= y + h;
    if (over) anyHot = true;
    return over;
  }

  /* Shrink the font until text fits maxW. Sets c.font to the given
     weight + size in the UI font family. */
  function fitFont(c, text, maxW, size, weight) {
    while (size > 8) {
      c.font = (weight ? weight + ' ' : '') + size + 'px ' + FONT;
      if (c.measureText(text).width <= maxW) break;
      size--;
    }
  }

  /* Rounded, glossy button with hover and press feedback. `style` picks a
     palette: undefined = standard plum, 'primary' = big pink call-to-action.
     Gold edges tie both into the hotel's brass trim. */
  function drawButton(c, text, x, y, w, h, hover, style) {
    hover = hover || pointerOver(c, x, y, w, h);
    var pressed = hover && Game.input.pointer.down;
    var r = Math.min(12, h / 2);
    var primary = style === 'primary';
    var pal = primary
      ? { top: '#ff9ad6', bot: '#e0399a', hTop: '#ffb8e4', hBot: '#f052b0', edge: '#ffe6a0' }
      : { top: '#6c3a9c', bot: '#3e1a64', hTop: '#8a52c4', hBot: '#55268a', edge: '#e8b860' };
    var oy = pressed ? 2 : 0;
    c.save();
    if (!pressed) {
      c.fillStyle = 'rgba(0, 0, 0, 0.35)';
      roundRect(c, x, y + 3, w, h, r);
      c.fill();
    }
    var g = c.createLinearGradient(0, y + oy, 0, y + oy + h);
    g.addColorStop(0, hover ? pal.hTop : pal.top);
    g.addColorStop(1, hover ? pal.hBot : pal.bot);
    c.fillStyle = g;
    roundRect(c, x, y + oy, w, h, r);
    c.fill();
    /* Soft top gloss */
    c.fillStyle = 'rgba(255, 255, 255, ' + (primary ? 0.2 : 0.12) + ')';
    roundRect(c, x + 3, y + oy + 2, w - 6, h * 0.42, Math.max(2, r - 3));
    c.fill();
    c.strokeStyle = hover ? '#ffffff' : pal.edge;
    c.lineWidth = primary ? 3 : 2;
    roundRect(c, x, y + oy, w, h, r);
    c.stroke();
    c.fillStyle = '#ffffff';
    fitFont(c, text, w - 16, primary ? Math.min(28, Math.round(h * 0.46)) : Math.min(18, Math.round(h * 0.42)), 'bold');
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = primary ? 'rgba(110, 10, 70, 0.6)' : 'rgba(0, 0, 0, 0.45)';
    c.shadowOffsetY = primary ? 2 : 1;
    c.fillText(text, x + w / 2, y + oy + h / 2 + 1);
    c.restore();
  }

  /* Big primary call-to-action — used for the Play button on the title
     and Start on the customize screen. Pulses a soft pink glow so it
     reads as the obvious thing to tap. */
  function drawPrimaryButton(c, text, x, y, w, h, animTimer) {
    var pulse = 0.5 + 0.5 * Math.sin((animTimer || 0) * 0.06);
    c.save();
    c.shadowColor = '#ff66cc';
    c.shadowBlur = 14 + 6 * pulse;
    c.fillStyle = '#ff3aa0';
    roundRect(c, x, y, w, h, Math.min(12, h / 2));
    c.fill();
    c.restore();
    drawButton(c, text, x, y, w, h, false, 'primary');
  }

  function hitButton(mx, my, x, y, w, h) {
    return mx >= x && mx <= x + w && my >= y && my <= y + h;
  }

  /* Split text into lines that fit maxWidth. Breaks on spaces, and falls
     back to per-character breaks for runs with no spaces (Japanese). */
  function layoutLines(c, text, maxWidth) {
    var out = [];
    var paras = text.split('\n');
    for (var li = 0; li < paras.length; li++) {
      var words = paras[li].split(' ');
      var line = '';
      for (var i = 0; i < words.length; i++) {
        var word = words[i];
        var test = line ? line + ' ' + word : word;
        if (c.measureText(test).width <= maxWidth) { line = test; continue; }
        if (line) { out.push(line); line = ''; }
        /* Word alone is too wide: break it character by character. */
        while (c.measureText(word).width > maxWidth && word.length > 1) {
          var n = word.length - 1;
          while (n > 1 && c.measureText(word.slice(0, n)).width > maxWidth) n--;
          /* Don't start a line with closing punctuation. */
          while (n > 1 && '、。！？」）ー'.indexOf(word.charAt(n)) >= 0) n--;
          out.push(word.slice(0, n));
          word = word.slice(n);
        }
        line = word;
      }
      out.push(line);
    }
    return out;
  }

  function wrapText(c, text, x, y, maxWidth, lineHeight) {
    var lines = layoutLines(c, text, maxWidth);
    for (var i = 0; i < lines.length; i++) c.fillText(lines[i], x, y + i * lineHeight);
    return lines.length * lineHeight;
  }

  /* ---- Title Screen ---- */
  var STREET_Y = 432;

  /* Distant skyline, a crescent moon, the occasional shooting star, the
     sidewalk and two street lamps. Everything is laid out around the
     button column (x 270..530) so nothing competes with it. */
  function drawTitleStreet(c, t) {
    /* Moon with a soft halo */
    var halo = c.createRadialGradient(132, 178, 10, 132, 178, 70);
    halo.addColorStop(0, 'rgba(255, 236, 190, 0.35)');
    halo.addColorStop(1, 'rgba(255, 236, 190, 0)');
    c.fillStyle = halo;
    c.fillRect(60, 108, 144, 144);
    /* Crescent: clip the bite out so the sky gradient shows through */
    c.save();
    c.beginPath();
    c.rect(100, 146, 64, 64);
    c.arc(144, 170, 21, 0, Math.PI * 2, true);
    c.clip('evenodd');
    c.fillStyle = '#fff1c8';
    c.beginPath(); c.arc(132, 178, 24, 0, Math.PI * 2); c.fill();
    c.restore();

    /* Shooting star every ~7s, crossing the upper sky */
    var st = t % 420;
    if (st < 40) {
      var p = st / 40;
      var sx = 220 + p * 260, sy = 30 + p * 70;
      var trail = c.createLinearGradient(sx - 60, sy - 16, sx, sy);
      trail.addColorStop(0, 'rgba(255, 255, 255, 0)');
      trail.addColorStop(1, 'rgba(255, 255, 255, ' + (0.9 * (1 - p)) + ')');
      c.strokeStyle = trail;
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(sx - 60, sy - 16); c.lineTo(sx, sy); c.stroke();
    }

    /* Soft plum clouds drifting slowly east. Most sit above the
       viewport and only show on tablets, where they fill the tall sky. */
    var clouds = [[-230, -150, 1.3], [90, -70, 0.9], [420, -170, 1.5], [760, -110, 1.1],
                  [1010, -40, 0.9], [-120, 30, 0.7], [690, 46, 0.6]];
    var span = VIEW.w + 320;
    for (var ci = 0; ci < clouds.length; ci++) {
      var ck = clouds[ci][2];
      var cxp = VIEW.x - 160 + ((clouds[ci][0] - VIEW.x + 160 + t * 0.05 * ck) % span + span) % span;
      var cyp = clouds[ci][1];
      c.fillStyle = 'rgba(122, 66, 120, 0.26)';
      c.beginPath();
      c.ellipse(cxp, cyp, 70 * ck, 14 * ck, 0, 0, Math.PI * 2);
      c.moveTo(cxp - 4 * ck, cyp - 8 * ck);
      c.arc(cxp - 26 * ck, cyp - 8 * ck, 22 * ck, 0, Math.PI * 2);
      c.moveTo(cxp + 42 * ck, cyp - 14 * ck);
      c.arc(cxp + 14 * ck, cyp - 14 * ck, 28 * ck, 0, Math.PI * 2);
      c.fill('nonzero');
      /* Pink moonlit rim along the top of the big puff */
      c.strokeStyle = 'rgba(255, 170, 200, 0.16)';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(cxp + 14 * ck, cyp - 14 * ck, 27 * ck, Math.PI * 1.15, Math.PI * 1.85);
      c.stroke();
    }

    /* Skyline silhouettes with a few warm windows */
    var blocks = [[0, 352, 56], [52, 330, 40], [96, 362, 70], [170, 318, 46],
                  [222, 372, 60], [500, 340, 54], [548, 300, 44],
                  /* Off-viewport blocks only show on tablets, where the
                     title spreads into the bezel beside the game. */
                  [-270, 346, 64], [-204, 368, 48], [-154, 324, 56], [-96, 358, 52], [-44, 338, 44],
                  [800, 356, 58], [862, 326, 46], [912, 364, 66], [982, 334, 50], [1036, 352, 60]];
    for (var i = 0; i < blocks.length; i++) {
      var bx = blocks[i][0], by = blocks[i][1], bw = blocks[i][2];
      c.fillStyle = '#331a3c';
      c.fillRect(bx, by, bw, STREET_Y - by);
      c.fillStyle = 'rgba(255, 210, 120, 0.55)';
      for (var wy = by + 10; wy < STREET_Y - 16; wy += 16) {
        for (var wx = bx + 8; wx < bx + bw - 8; wx += 12) {
          if (((wx * 7 + wy * 13 + i * 5) % 9) < 2) c.fillRect(wx, wy, 4, 6);
        }
      }
    }

    /* Sidewalk + curb, spanning the whole view width. On tablets the
       view runs on below the viewport, so the pavement ends at a kerb
       there and a quiet evening road fills the rest. */
    var vx0 = VIEW.x, vx1 = VIEW.x + VIEW.w, vBottom = VIEW.y + VIEW.h;
    var walk = c.createLinearGradient(0, STREET_Y, 0, H);
    walk.addColorStop(0, '#4a2a44');
    walk.addColorStop(1, '#2e1a34');
    c.fillStyle = walk;
    c.fillRect(vx0, STREET_Y, vx1 - vx0, H - STREET_Y);
    c.fillStyle = '#8a5a6a';
    c.fillRect(vx0, STREET_Y, vx1 - vx0, 2);
    c.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    c.lineWidth = 1;
    for (var sx2 = Math.floor(vx0 / 60) * 60 + 30; sx2 < vx1; sx2 += 60) {
      c.beginPath(); c.moveTo(sx2, STREET_Y + 2); c.lineTo(sx2 - 14, H); c.stroke();
    }
    if (vBottom > H) {
      var road = c.createLinearGradient(0, H, 0, vBottom);
      road.addColorStop(0, '#2a1832');
      road.addColorStop(1, '#170c1e');
      c.fillStyle = road;
      c.fillRect(vx0, H, vx1 - vx0, vBottom - H);
      /* Kerb stones with a lit top edge */
      c.fillStyle = '#5e3a56';
      c.fillRect(vx0, H, vx1 - vx0, 8);
      c.fillStyle = '#9a6a7a';
      c.fillRect(vx0, H, vx1 - vx0, 2);
      c.fillStyle = 'rgba(0, 0, 0, 0.3)';
      for (var kx = Math.floor(vx0 / 48) * 48; kx < vx1; kx += 48) c.fillRect(kx, H + 2, 1, 6);
      c.fillStyle = 'rgba(0, 0, 0, 0.35)';
      c.fillRect(vx0, H + 8, vx1 - vx0, 3);
      /* Dashed centre line */
      var laneY = H + 8 + (vBottom - H - 8) * 0.45;
      c.fillStyle = 'rgba(255, 220, 150, 0.28)';
      for (var lx2 = Math.floor(vx0 / 70) * 70; lx2 < vx1; lx2 += 70) c.fillRect(lx2, laneY, 36, 3);
      /* The hotel's lit lobby and windows shimmer on the wet road */
      var hRefl = c.createLinearGradient(0, H + 10, 0, H + 130);
      hRefl.addColorStop(0, 'rgba(255, 226, 140, 0.14)');
      hRefl.addColorStop(1, 'rgba(255, 226, 140, 0)');
      c.fillStyle = hRefl;
      for (var hr = 0; hr < 3; hr++) {
        c.beginPath(); c.ellipse(638 + hr * 52, H + 60, 13, 52, 0, 0, Math.PI * 2); c.fill();
      }
    }

    /* Street lamps with a slow, warm breathing glow */
    var lamps = [34, 560];
    for (var li = 0; li < lamps.length; li++) {
      var lx = lamps[li];
      var glow = 0.75 + 0.25 * Math.sin(t * 0.03 + li * 2);
      var lg = c.createRadialGradient(lx, 344, 4, lx, 344, 60);
      lg.addColorStop(0, 'rgba(255, 214, 130, ' + (0.45 * glow) + ')');
      lg.addColorStop(1, 'rgba(255, 214, 130, 0)');
      c.fillStyle = lg;
      c.fillRect(lx - 60, 284, 120, 120);
      c.fillStyle = 'rgba(255, 214, 130, ' + (0.18 * glow) + ')';
      c.beginPath(); c.ellipse(lx, STREET_Y + 10, 34, 6, 0, 0, Math.PI * 2); c.fill();
      if (vBottom > H) {
        var refl = c.createLinearGradient(0, H + 10, 0, H + 90);
        refl.addColorStop(0, 'rgba(255, 214, 130, ' + (0.16 * glow) + ')');
        refl.addColorStop(1, 'rgba(255, 214, 130, 0)');
        c.fillStyle = refl;
        c.beginPath(); c.ellipse(lx, H + 40, 16, 34, 0, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#2a1626';
      c.fillRect(lx - 2, 350, 4, STREET_Y - 350);
      c.fillRect(lx - 6, STREET_Y - 6, 12, 6);
      c.fillStyle = '#e8b860';
      c.fillRect(lx - 7, 334, 14, 3);
      c.fillStyle = '#fff0b8';
      roundRect(c, lx - 5, 337, 10, 13, 3);
      c.fill();
    }
  }

  /* The hotel itself, standing on the sidewalk at the right. Three window
     columns over four guest floors, a lobby with an awning, and a few
     guests peeking out. Lights in two windows fade on and off slowly. */
  var TITLE_PEEKS = [
    { col: 0, floor: 0, species: 'giraffe' }, { col: 2, floor: 0, species: 'penguin' },
    { col: 1, floor: 1, species: 'panda' }, { col: 0, floor: 2, species: 'lion' },
    { col: 2, floor: 2, species: 'cat' }, { col: 1, floor: 3, species: 'unicorn' },
  ];
  function drawTitleHotel(c, t) {
    var hx = 604, hw = 172, top = 150;
    /* Body with a little vertical shading so it reads as a solid block */
    var body = c.createLinearGradient(hx, 0, hx + hw, 0);
    body.addColorStop(0, '#5a3226');
    body.addColorStop(0.5, '#6e3e2c');
    body.addColorStop(1, '#4a281e');
    c.fillStyle = 'rgba(0, 0, 0, 0.3)';
    c.fillRect(hx + 6, top + 6, hw, STREET_Y - top - 6);
    c.fillStyle = body;
    c.fillRect(hx, top, hw, STREET_Y - top);
    /* Brick courses */
    c.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    c.lineWidth = 1;
    for (var by = top + 6; by < STREET_Y; by += 6) {
      c.beginPath(); c.moveTo(hx, by + 0.5); c.lineTo(hx + hw, by + 0.5); c.stroke();
    }
    /* Floor cornices */
    c.fillStyle = '#e8b860';
    for (var f = 0; f <= 4; f++) c.fillRect(hx - 3, top + f * 52 - 1, hw + 6, 3);

    /* Mansard roof + waving flag */
    c.fillStyle = '#7a2840';
    c.beginPath();
    c.moveTo(hx - 8, top); c.lineTo(hx + 14, top - 22);
    c.lineTo(hx + hw - 14, top - 22); c.lineTo(hx + hw + 8, top);
    c.closePath(); c.fill();
    c.fillStyle = '#e8b860';
    c.fillRect(hx + 10, top - 24, hw - 20, 3);
    var fx = hx + hw / 2;
    c.fillStyle = '#c89a48';
    c.fillRect(fx - 1, top - 52, 2, 30);
    var wave = Math.sin(t * 0.08) * 2;
    c.fillStyle = '#ff66cc';
    c.beginPath();
    c.moveTo(fx + 1, top - 52);
    c.quadraticCurveTo(fx + 8, top - 52 + wave, fx + 16, top - 48);
    c.quadraticCurveTo(fx + 8, top - 44 - wave, fx + 1, top - 42);
    c.closePath(); c.fill();

    /* Guest windows */
    for (var floor = 0; floor < 4; floor++) {
      for (var col = 0; col < 3; col++) {
        var wx = hx + 16 + col * 52, wy = top + 10 + floor * 52, ww = 36, wh = 34;
        var lit = 1;
        if ((floor === 1 && col === 0) || (floor === 3 && col === 2)) {
          lit = 0.5 + 0.5 * Math.sin(t * 0.012 + floor);
        }
        c.fillStyle = '#2a1a30';
        c.fillRect(wx, wy, ww, wh);
        c.fillStyle = 'rgba(255, 226, 140, ' + lit + ')';
        c.fillRect(wx, wy, ww, wh);
        var peek = null;
        for (var pi = 0; pi < TITLE_PEEKS.length; pi++) {
          if (TITLE_PEEKS[pi].col === col && TITLE_PEEKS[pi].floor === floor) peek = TITLE_PEEKS[pi];
        }
        if (peek && Game.entities && Game.entities.drawAnimalSprite) {
          c.save();
          c.beginPath(); c.rect(wx, wy, ww, wh); c.clip();
          var bob = Math.sin(t * 0.05 + floor * 1.7 + col) * 1.2;
          c.translate(wx + ww / 2 - 17, wy + 8 + bob);
          c.scale(0.72, 0.72);
          Game.entities.drawAnimalSprite(c, peek.species, 0, 0);
          c.restore();
        }
        /* Curtains, frame and mullion */
        c.fillStyle = '#c03a6a';
        c.fillRect(wx, wy, 5, wh);
        c.fillRect(wx + ww - 5, wy, 5, wh);
        c.strokeStyle = '#e8b860';
        c.lineWidth = 2;
        c.strokeRect(wx, wy, ww, wh);
        c.fillStyle = '#e8b860';
        c.fillRect(wx - 3, wy + wh, ww + 6, 3);
      }
    }

    /* Lobby: double doors, striped awning, paw-print plaque with blinking
       marquee bulbs, and a red carpet out to the kerb. */
    var ly = top + 208;
    var dx = hx + hw / 2 - 20;
    c.fillStyle = 'rgba(255, 220, 140, 0.9)';
    c.fillRect(dx, ly + 26, 40, STREET_Y - ly - 26);
    c.strokeStyle = '#e8b860';
    c.lineWidth = 2;
    c.strokeRect(dx, ly + 26, 40, STREET_Y - ly - 26);
    c.beginPath(); c.moveTo(dx + 20, ly + 26); c.lineTo(dx + 20, STREET_Y); c.stroke();
    for (var s = 0; s < 6; s++) {
      c.fillStyle = s % 2 ? '#fff0e0' : '#c03a6a';
      c.beginPath();
      c.moveTo(dx - 16 + s * 12, ly + 12); c.lineTo(dx - 4 + s * 12, ly + 12);
      c.lineTo(dx - 4 + s * 12, ly + 22); c.lineTo(dx - 16 + s * 12, ly + 22);
      c.closePath(); c.fill();
    }
    c.fillStyle = '#c03a6a';
    for (var sc = 0; sc < 6; sc++) {
      c.beginPath(); c.arc(dx - 10 + sc * 12, ly + 22, 6, 0, Math.PI); c.fill();
    }
    var plX = hx + 14, plY = ly + 30;
    c.fillStyle = '#3a2418';
    roundRect(c, plX, plY, 36, 30, 5); c.fill();
    c.strokeStyle = '#e8b860';
    roundRect(c, plX, plY, 36, 30, 5); c.stroke();
    c.fillStyle = '#ffd24a';
    c.beginPath(); c.ellipse(plX + 18, plY + 19, 6, 5, 0, 0, Math.PI * 2); c.fill();
    var toes = [[-7, -4], [-2.5, -8], [2.5, -8], [7, -4]];
    for (var ti = 0; ti < toes.length; ti++) {
      c.beginPath(); c.arc(plX + 18 + toes[ti][0], plY + 17 + toes[ti][1], 2.4, 0, Math.PI * 2); c.fill();
    }
    for (var bi = 0; bi < 8; bi++) {
      var on = (Math.floor(t / 12) + bi) % 2 === 0;
      c.fillStyle = on ? '#fff6c0' : '#8a6a30';
      var ang = (bi / 8) * Math.PI * 2;
      c.beginPath();
      c.arc(plX + 18 + Math.cos(ang) * 21, plY + 15 + Math.sin(ang) * 17, 1.6, 0, Math.PI * 2);
      c.fill();
    }
    /* Red carpet down the sidewalk, finished with gold edging, a brass
       rod and a fringe right at the kerb so it ends on purpose instead
       of running off the viewport edge. */
    var cEnd = H - 5;
    var cg = c.createLinearGradient(0, STREET_Y, 0, cEnd);
    cg.addColorStop(0, '#9a2040');
    cg.addColorStop(1, '#c43456');
    c.fillStyle = cg;
    c.beginPath();
    c.moveTo(dx + 2, STREET_Y); c.lineTo(dx + 38, STREET_Y);
    c.lineTo(dx + 48, cEnd); c.lineTo(dx - 8, cEnd);
    c.closePath(); c.fill();
    c.strokeStyle = '#e8b860';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(dx + 5, STREET_Y); c.lineTo(dx - 3, cEnd);
    c.moveTo(dx + 35, STREET_Y); c.lineTo(dx + 43, cEnd);
    c.stroke();
    c.fillStyle = '#e8b860';
    c.fillRect(dx - 10, cEnd - 1, 60, 3);
    for (var fr = dx - 7; fr <= dx + 47; fr += 4) c.fillRect(fr, cEnd + 2, 1.5, 3);
  }

  /* Momoko arriving with her suitcase, and two guests waiting to greet
     her. Fills the lower-left so the title has a story, not empty sky. */
  function drawTitleGuests(c, t) {
    if (!Game.entities) return;
    /* Suitcase */
    c.fillStyle = 'rgba(0, 0, 0, 0.3)';
    c.beginPath(); c.ellipse(76, STREET_Y + 2, 20, 4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#e06088';
    roundRect(c, 60, STREET_Y - 30, 32, 30, 5); c.fill();
    c.fillStyle = '#a03a60';
    c.fillRect(60, STREET_Y - 18, 32, 4);
    c.strokeStyle = '#3a2418';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(70, STREET_Y - 30); c.lineTo(70, STREET_Y - 36);
    c.lineTo(82, STREET_Y - 36); c.lineTo(82, STREET_Y - 30); c.stroke();
    c.fillStyle = '#ffd24a';
    c.beginPath(); c.arc(84, STREET_Y - 8, 4, 0, Math.PI * 2); c.fill();

    /* Momoko, with a gentle idle bob */
    var bob = Math.round(Math.sin(t * 0.06) * 1.5);
    c.fillStyle = 'rgba(0, 0, 0, 0.3)';
    c.beginPath(); c.ellipse(134, STREET_Y + 2, 26, 5, 0, 0, Math.PI * 2); c.fill();
    if (Game.entities.drawMomokoSprite) {
      c.save();
      c.translate(98, STREET_Y - 86 + bob);
      c.scale(2.6, 2.6);
      Game.entities.drawMomokoSprite(c, 0, 0, Game.customization, 0);
      c.restore();
    }

    /* Waiting guests */
    if (Game.entities.drawAnimalSprite) {
      var guests = [{ s: 'bunny', x: 178, k: 1.2 }, { s: 'elephant', x: 216, k: 1.15 }];
      for (var i = 0; i < guests.length; i++) {
        var g = guests[i];
        var hop = g.s === 'bunny' ? Math.max(0, Math.sin(t * 0.09)) * 4 : 0;
        c.fillStyle = 'rgba(0, 0, 0, 0.3)';
        c.beginPath(); c.ellipse(g.x + 24 * g.k, STREET_Y + 2, 22 * g.k, 4, 0, 0, Math.PI * 2); c.fill();
        c.save();
        c.translate(g.x, STREET_Y - 46 * g.k - hop);
        c.scale(g.k, g.k);
        Game.entities.drawAnimalSprite(c, g.s, 0, 0);
        c.restore();
      }
    }
  }

  /* Warm dusk sky with twinkling stars – the hotel's signature backdrop,
     shared by the title and every pre-game screen so they read as one
     place. `starAlpha` lets busier screens tone the stars down. */
  function drawDuskBackdrop(c, starAlpha) {
    var grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#241430');
    grad.addColorStop(0.5, '#4a2858');
    grad.addColorStop(1, '#7a3a58');
    c.fillStyle = grad;
    c.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    for (var i = 0; i < titleBubbles.length; i++) {
      drawDuskStar(c, titleBubbles[i], i, starAlpha);
    }
    if (VIEW.w > W || VIEW.h > H) {
      var extra = viewBezelStars();
      for (var j = 0; j < extra.length; j++) {
        /* The street covers the sky from STREET_Y down inside the
           viewport; keep the bezel stars to the sky above it too. */
        if (extra[j].y < STREET_Y) drawDuskStar(c, extra[j], j, starAlpha);
      }
    }
  }

  function drawDuskStar(c, b, i, starAlpha) {
    b.wobble += 0.04;
    var twinkle = 0.3 + 0.7 * Math.abs(Math.sin(b.wobble));
    c.save();
    c.globalAlpha = twinkle * starAlpha;
    c.fillStyle = i % 13 === 0 ? '#ffd24a' : (i % 17 === 0 ? '#ff99cc' : '#ffffff');
    c.beginPath();
    c.arc(b.x, b.y, 0.8 + b.r * 0.3 * twinkle, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  /* Plum panel with a brass edge – the modal style used by the elevator
     menu and passport, so overlays all look like hotel stationery. */
  function drawHotelPanel(c, x, y, w, h) {
    c.save();
    c.fillStyle = 'rgba(0, 0, 0, 0.35)';
    roundRect(c, x, y + 4, w, h, 14);
    c.fill();
    var g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(58, 30, 76, 0.96)');
    g.addColorStop(1, 'rgba(36, 18, 50, 0.96)');
    c.fillStyle = g;
    roundRect(c, x, y, w, h, 14);
    c.fill();
    c.strokeStyle = '#e8b860';
    c.lineWidth = 2.5;
    roundRect(c, x, y, w, h, 14);
    c.stroke();
    c.strokeStyle = 'rgba(232, 184, 96, 0.35)';
    c.lineWidth = 1;
    roundRect(c, x + 6, y + 6, w - 12, h - 12, 10);
    c.stroke();
    c.restore();
  }

  /* Gold page heading with a soft warm glow. */
  function drawHotelHeading(c, text, y, size) {
    c.save();
    fitFont(c, text, 560, size || 28, 'bold');
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#220044';
    c.fillText(text, W / 2 + 1, y + 2);
    c.shadowColor = 'rgba(255, 140, 60, 0.6)';
    c.shadowBlur = 10;
    c.fillStyle = '#ffd24a';
    c.fillText(text, W / 2, y);
    c.restore();
  }

  function drawTitleScreen(c) {
    titleAnimTimer++;

    drawDuskBackdrop(c, 0.9);
    drawTitleStreet(c, titleAnimTimer);
    clipGame(c);
    drawTitleHotel(c, titleAnimTimer);
    drawTitleGuests(c, titleAnimTimer);

    /* Title text */
    var title = Game.i18n.t('title');
    c.save();
    fitFont(c, title, 440, 36, 'bold');
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    /* Shadow */
    c.fillStyle = '#220044';
    c.fillText(title, W / 2 + 2, 102);
    /* Main */
    c.fillStyle = '#44ffff';
    c.fillText(title, W / 2, 100);
    /* Glow */
    c.shadowColor = '#ff66cc';
    c.shadowBlur = 16;
    c.fillText(title, W / 2, 100);
    c.restore();

    /* Subtitle */
    c.fillStyle = '#ffd24a';
    c.font = '14px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('titleSubtitle'), W / 2, 140);

    /* Buttons — Play is the loudest action; others are sized down. */
    drawPrimaryButton(c, Game.i18n.t('play'), W / 2 - 130, 196, 260, 60, titleAnimTimer);
    drawButton(c, Game.i18n.t('howToPlay'), W / 2 - 90, 276, 180, 36);
    drawButton(c, Game.i18n.t('language') + ': ' + Game.i18n.t('langLabel'), W / 2 - 90, 322, 180, 36);

    /* Sound toggle */
    var muteLabel = Game.i18n.t(Game.audio.isMuted() ? 'soundOff' : 'soundOn');
    drawButton(c, muteLabel, W / 2 - 90, 368, 180, 36);

    /* Instructions overlay flag */
    return false;
  }

  var showInstructions = false;
  var HOWTO_OK_Y = 312;

  function drawInstructionsOverlay(c) {
    c.save();
    /* The title buttons underneath aren't clickable while this is up. */
    anyHot = false;
    /* Scrim so the underlying menu buttons don't read through, while the
       dusk sky still glows faintly behind the modal. */
    c.fillStyle = 'rgba(16, 6, 26, 0.82)';
    c.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);

    var pX = W / 2 - 290, pY = 84, pW = 580, pH = 290;
    drawHotelPanel(c, pX, pY, pW, pH);
    drawHotelHeading(c, Game.i18n.t('howToPlay'), pY + 40, 26);

    /* One instruction per row, each with a brass bullet. */
    var lines = Game.i18n.t('instructions').split('\n');
    c.font = '16px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    for (var li = 0; li < lines.length; li++) {
      var ly = pY + 92 + li * 36;
      c.fillStyle = '#e8b860';
      c.beginPath(); c.arc(pX + 56, ly, 4, 0, Math.PI * 2); c.fill();
      c.fillStyle = li === lines.length - 1 ? '#ffd24a' : '#f4e6f4';
      fitFont(c, lines[li], pW - 120, 16, li === lines.length - 1 ? 'bold' : '');
      c.fillText(lines[li], pX + 72, ly);
    }
    c.textBaseline = 'alphabetic';
    drawButton(c, 'OK', W / 2 - 60, HOWTO_OK_Y, 120, 40);
    c.restore();
  }

  /* Title click handler – returns action string or null */
  function handleTitleClick(mx, my) {
    if (showInstructions) {
      if (hitButton(mx, my, W / 2 - 60, HOWTO_OK_Y, 120, 40)) {
        showInstructions = false;
        Game.audio.play('select');
        return null;
      }
      return null;
    }
    if (hitButton(mx, my, W / 2 - 130, 196, 260, 60)) { Game.audio.play('select'); return 'play'; }
    if (hitButton(mx, my, W / 2 - 90, 276, 180, 36)) { Game.audio.play('select'); showInstructions = true; return null; }
    if (hitButton(mx, my, W / 2 - 90, 322, 180, 36)) { Game.audio.play('select'); Game.i18n.toggleLanguage(); return null; }
    if (hitButton(mx, my, W / 2 - 90, 368, 180, 36)) { Game.audio.toggleMute(); return null; }
    return null;
  }

  /* (No HUD — exploration game; quest progress lives in drawQuestHUD.) */

  /* ---- Pause Menu ---- */
  var pauseFlossTimer = 0;
  function drawPauseMenu(c) {
    pauseFlossTimer++;
    c.save();
    c.fillStyle = 'rgba(10, 4, 32, 0.82)';
    c.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);
    c.font = 'bold 32px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    /* Centred over the button column (Momoko dances on the left). Gold
       with a warm glow, like every other in-hotel heading. */
    c.save();
    c.shadowColor = 'rgba(255, 140, 60, 0.6)';
    c.shadowBlur = 10;
    c.fillStyle = '#ffd24a';
    c.fillText(Game.i18n.t('paused'), W / 2 + 100, 110);
    c.restore();

    /* Floss-dance Momoko – phase advances at ~1.7Hz and the pose math
       smooths the beat with a tanh sigmoid so she transitions between
       sides across several frames instead of snapping between two.
       Placed to the left of the menu buttons so she's visible but not
       competing for space. */
    if (Game.entities && Game.entities.drawMomokoFloss) {
      c.save();
      c.translate(170, 220);
      c.scale(3.5, 3.5);
      Game.entities.drawMomokoFloss(c, 0, 0, Game.customization, pauseFlossTimer * 0.18);
      c.restore();
    }

    /* "Leave Room" only appears when we were paused from inside an animal
       room — gives kids a kid-proof escape if they can't find the EXIT
       door themselves. Game.currentRoom is set whenever Momoko's inside
       a room (and the bedroom is excluded so the bookshelf/sleep flows
       still work as designed). */
    var inRoom = !!Game.currentRoom && Game.currentRoom !== 'bedroom';
    drawButton(c, Game.i18n.t('resume'), W / 2 - 10, 150, 220, 38);
    var nextY = 198;
    if (inRoom) {
      drawButton(c, '🚪 ' + Game.i18n.t('leaveRoom'), W / 2 - 10, nextY, 220, 38);
      nextY += 48;
    }
    drawButton(c, '🎟️ ' + Game.i18n.t('ledgerOpen'), W / 2 - 10, nextY, 220, 38); nextY += 48;
    drawButton(c, Game.i18n.t('language') + ': ' + Game.i18n.t('langLabel'), W / 2 - 10, nextY, 220, 38); nextY += 48;
    var muteLabel = Game.i18n.t(Game.audio.isMuted() ? 'soundOff' : 'soundOn');
    drawButton(c, muteLabel, W / 2 - 10, nextY, 220, 38); nextY += 48;
    drawButton(c, Game.i18n.t('quit'), W / 2 - 10, nextY, 220, 38);
    c.restore();
  }

  function handlePauseClick(mx, my) {
    var inRoom = !!Game.currentRoom && Game.currentRoom !== 'bedroom';
    if (hitButton(mx, my, W / 2 - 10, 150, 220, 38)) { Game.audio.play('select'); return 'resume'; }
    var nextY = 198;
    if (inRoom) {
      if (hitButton(mx, my, W / 2 - 10, nextY, 220, 38)) { Game.audio.play('select'); return 'leaveRoom'; }
      nextY += 48;
    }
    if (hitButton(mx, my, W / 2 - 10, nextY, 220, 38)) { Game.audio.play('select'); return 'ledger'; }
    nextY += 48;
    if (hitButton(mx, my, W / 2 - 10, nextY, 220, 38)) { Game.audio.play('select'); Game.i18n.toggleLanguage(); return null; }
    nextY += 48;
    if (hitButton(mx, my, W / 2 - 10, nextY, 220, 38)) { Game.audio.toggleMute(); return null; }
    nextY += 48;
    if (hitButton(mx, my, W / 2 - 10, nextY, 220, 38)) { Game.audio.play('select'); return 'quit'; }
    return null;
  }

  /* ---- QR code ----
     Pre-computed Version-4 QR matrix (33×33 modules, error-correction
     level M) encoding the game's public URL. Generated offline; see the
     commit notes. Rendered in canvas-space so it sits in the empty
     upper-right strip area, inviting someone else to scan and play. */
  var QR_URL = 'https://ruck314.github.io/momoko-animal-hotel-zoo/';
  var QR_SIZE = 33;
  var QR_ROWS = [
    '111111100010000010111011101111111',
    '100000100101100110101110001000001',
    '101110101111101110001111101011101',
    '101110101111000000100010101011101',
    '101110101111011110001111101011101',
    '100000101000111001110100101000001',
    '111111101010101010101010101111111',
    '000000001000101010111111100000000',
    '101111100011011001111000001111100',
    '110010001110010011111111101101101',
    '011010101000011111000010000010100',
    '101110001011010011100111101011111',
    '110101100010001010010011010011000',
    '010101011111000101100101011001011',
    '110100100001101111001110011001110',
    '011000010010101100111100011001100',
    '001101110101101101010000110111001',
    '111100011111110010111001011101111',
    '101001101011101110100010010110110',
    '101001001110111110001111111111111',
    '010110111011100000100010110111011',
    '110000000111011111010011001001101',
    '100011101101101000100010100101110',
    '101101010011110010001100001001111',
    '100001111010111001001010111110000',
    '000000001010010011111100100010101',
    '111111100001101111001001101010110',
    '100000101111100011100101100011111',
    '101110101101011010010010111111001',
    '101110101001010101111101110011011',
    '101110101011101111000011111100000',
    '100000100101001100001111000011100',
    '111111101100110101110011110100010',
  ];

  /* Paints the QR code centered in the rect (cx, cy, size) with a white
     quiet zone so scanners don't choke on adjacent canvas colour. */
  function drawQRCode(c, cx, cy, size) {
    var quiet = 4; /* modules of white padding around the code */
    var totalModules = QR_SIZE + quiet * 2;
    var cell = Math.floor(size / totalModules);
    if (cell < 1) cell = 1;
    var rendered = cell * totalModules;
    var x0 = Math.round(cx - rendered / 2);
    var y0 = Math.round(cy - rendered / 2);
    c.save();
    /* White background (includes quiet zone) */
    c.fillStyle = '#ffffff';
    c.fillRect(x0, y0, rendered, rendered);
    c.fillStyle = '#000000';
    for (var r = 0; r < QR_SIZE; r++) {
      var row = QR_ROWS[r];
      for (var q = 0; q < QR_SIZE; q++) {
        if (row.charAt(q) === '1') {
          c.fillRect(
            x0 + (q + quiet) * cell,
            y0 + (r + quiet) * cell,
            cell, cell
          );
        }
      }
    }
    /* "SCAN" caption below */
    c.fillStyle = '#cfe6ff';
    c.font = 'bold 10px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillText('SCAN TO PLAY', cx, y0 + rendered + 14);
    c.restore();
  }

  /* ---- Dialogue Box ----
     Drawn in canvas-space (NOT game-space) so it lives in the bottom
     bezel area on touch devices and doesn't obscure gameplay. Caller
     supplies the canvas dimensions and where the game viewport sits
     inside them; the box floats below the viewport if there's bezel
     room, otherwise it hugs the bottom of the gameplay area with
     reduced height. */
  function drawDialogue(c, speaker, text, cw, ch, gx, gy) {
    /* Back-compat: if canvas dims aren't supplied, fall back to
       in-viewport rendering at the bottom of the gameplay area. */
    if (cw == null) { cw = W; ch = H; gx = 0; gy = 0; }
    var gameBottom = gy + H;
    var bezelBelow = Math.max(0, ch - gameBottom);
    var boxH, boxY;
    if (bezelBelow >= 56) {
      /* Sits fully in the bottom bezel */
      boxH = Math.min(bezelBelow - 8, 90);
      boxY = gameBottom + Math.max(4, (bezelBelow - boxH) / 2);
    } else if (bezelBelow > 0) {
      /* Overflow into the bezel plus a small fade over the game edge */
      boxH = Math.min(56 + bezelBelow, 80);
      boxY = ch - boxH - 4;
    } else {
      /* No bezel — tuck against the very bottom of gameplay with a
         shorter box so less of the screen is covered. */
      boxH = 56;
      boxY = gameBottom - boxH - 4;
    }
    var boxW = Math.min(560, cw - 40);
    var boxX = (cw - boxW) / 2;

    c.save();
    /* Size the box to the text so a third line never spills out. The
       bottom edge stays where the layout above put it. */
    c.font = '14px ' + FONT;
    var lines = layoutLines(c, text, boxW - 32);
    var need = 34 + lines.length * 19 + 10;
    if (need > boxH) { boxY -= need - boxH; boxH = need; }

    c.fillStyle = 'rgba(0, 0, 0, 0.35)';
    roundRect(c, boxX, boxY + 3, boxW, boxH, 12);
    c.fill();
    var g = c.createLinearGradient(0, boxY, 0, boxY + boxH);
    g.addColorStop(0, 'rgba(84, 30, 46, 0.96)');
    g.addColorStop(1, 'rgba(40, 14, 24, 0.96)');
    c.fillStyle = g;
    roundRect(c, boxX, boxY, boxW, boxH, 12);
    c.fill();
    c.strokeStyle = '#caa040';
    c.lineWidth = 2;
    roundRect(c, boxX, boxY, boxW, boxH, 12);
    c.stroke();

    /* Speaker name tag */
    c.font = 'bold 14px ' + FONT;
    var tagW = c.measureText(speaker).width + 20;
    c.fillStyle = '#ff66cc';
    roundRect(c, boxX + 14, boxY - 10, tagW, 22, 11);
    c.fill();
    c.fillStyle = '#ffffff';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(speaker, boxX + 24, boxY + 1);

    /* Text */
    c.fillStyle = '#fff4e0';
    c.font = '14px ' + FONT;
    c.textBaseline = 'alphabetic';
    for (var i = 0; i < lines.length; i++) {
      c.fillText(lines[i], boxX + 16, boxY + 34 + i * 19);
    }

    c.restore();
  }

  /* ---- Game Over Screen ---- */
  function drawGameOver(c) {
    c.save();
    c.fillStyle = 'rgba(20, 0, 0, 0.85)';
    c.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);

    c.fillStyle = '#ff3344';
    c.font = 'bold 40px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('gameOver'), W / 2, 160);

    drawButton(c, Game.i18n.t('tryAgain'), W / 2 - 90, 240, 180, 48);
    c.restore();
  }

  function handleGameOverClick(mx, my) {
    if (hitButton(mx, my, W / 2 - 90, 240, 180, 48)) { Game.audio.play('select'); return 'retry'; }
    return null;
  }

  /* ---- Victory Screen ----
     A party in the lobby (the engine renders the lobby underneath):
     bunting, a ribbon banner, Momoko flossing in a spotlight with a
     line of guests bouncing either side, confetti and sparkles. All
     motion is a function of victoryTimer and seeded per-piece offsets. */
  var victoryTimer = 0;
  /* Floor-standing guests only – the frog's lily pad reads oddly on carpet. */
  var VICTORY_GUESTS = ['lion', 'elephant', 'penguin', 'panda', 'bunny', 'unicorn', 'owl', 'cat'];
  var VICTORY_BTN = { x: W / 2 - 110, y: 206, w: 220, h: 50 };

  function drawVictory(c) {
    victoryTimer++;
    var t = victoryTimer;
    var floorY = 440;
    c.save();

    /* Warm party dimming over the lobby, darker at the top for text */
    var dim = c.createLinearGradient(0, 0, 0, H);
    dim.addColorStop(0, 'rgba(40, 8, 30, 0.72)');
    dim.addColorStop(0.5, 'rgba(40, 8, 30, 0.35)');
    dim.addColorStop(1, 'rgba(40, 8, 30, 0.2)');
    c.fillStyle = dim;
    c.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);

    /* Spotlight on the dance floor */
    c.save();
    c.globalCompositeOperation = 'lighter';
    var spot = c.createRadialGradient(W / 2, floorY - 40, 10, W / 2, floorY - 40, 220);
    spot.addColorStop(0, 'rgba(255, 220, 160, 0.35)');
    spot.addColorStop(1, 'rgba(255, 220, 160, 0)');
    c.fillStyle = spot;
    c.beginPath();
    c.moveTo(W / 2 - 40, 0); c.lineTo(W / 2 + 40, 0);
    c.lineTo(W / 2 + 200, floorY + 30); c.lineTo(W / 2 - 200, floorY + 30);
    c.closePath(); c.fill();
    c.restore();

    /* Bunting: two swags of pennants across the top */
    var flagCols = ['#ff5a8a', '#ffd24a', '#5ac8ff', '#88e070', '#b088ff'];
    for (var sw = 0; sw < 2; sw++) {
      var x0 = sw * W / 2, x1 = x0 + W / 2;
      c.strokeStyle = '#fff0c8';
      c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x0, 8); c.quadraticCurveTo((x0 + x1) / 2, 56, x1, 8); c.stroke();
      for (var fl = 1; fl < 10; fl++) {
        var ft = fl / 10;
        var fx = x0 + (x1 - x0) * ft;
        var fy = 8 + (56 - 8) * 2 * ft * (1 - ft);
        var flutter = Math.sin(t * 0.08 + fl + sw * 3) * 1.5;
        c.fillStyle = flagCols[(fl + sw) % flagCols.length];
        c.beginPath();
        c.moveTo(fx - 9, fy); c.lineTo(fx + 9, fy); c.lineTo(fx + flutter, fy + 18);
        c.closePath(); c.fill();
      }
    }

    /* Ribbon banner with the title */
    var title = Game.i18n.t('victoryTitle');
    var bw = 520, bh = 58, bx = W / 2 - bw / 2, by = 62;
    c.fillStyle = '#a01c48';
    for (var tail = -1; tail <= 1; tail += 2) {
      var tx = tail < 0 ? bx - 26 : bx + bw + 26;
      var ix = tail < 0 ? bx + 20 : bx + bw - 20;
      c.beginPath();
      c.moveTo(ix, by + 12); c.lineTo(tx, by + 12); c.lineTo(tx + tail * -14, by + bh / 2 + 12);
      c.lineTo(tx, by + bh + 12); c.lineTo(ix, by + bh + 12);
      c.closePath(); c.fill();
    }
    var bannerG = c.createLinearGradient(0, by, 0, by + bh);
    bannerG.addColorStop(0, '#ff4a7e');
    bannerG.addColorStop(1, '#d02a60');
    c.fillStyle = bannerG;
    roundRect(c, bx, by, bw, bh, 8);
    c.fill();
    c.strokeStyle = '#ffe6a0';
    c.lineWidth = 3;
    roundRect(c, bx + 5, by + 5, bw - 10, bh - 10, 6);
    c.stroke();
    c.fillStyle = '#fff8e0';
    fitFont(c, title, bw - 40, 34, 'bold');
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = 'rgba(90, 0, 30, 0.7)';
    c.shadowOffsetY = 2;
    c.fillText(title, W / 2, by + bh / 2 + 1);
    c.shadowOffsetY = 0;
    c.shadowColor = 'rgba(0,0,0,0)';

    /* Subtitle + thanks, on a soft plum plate so they stay readable
       over the bright lobby wallpaper. */
    fitFont(c, Game.i18n.t('victorySubtitle'), W - 120, 18, 'bold');
    var plateW = Math.min(W - 80, c.measureText(Game.i18n.t('victorySubtitle')).width + 48);
    c.fillStyle = 'rgba(48, 12, 40, 0.62)';
    roundRect(c, W / 2 - plateW / 2, 134, plateW, 60, 14);
    c.fill();
    c.fillStyle = '#ffe6f2';
    c.fillText(Game.i18n.t('victorySubtitle'), W / 2, 152);
    c.fillStyle = '#ffd6a0';
    fitFont(c, Game.i18n.t('thanks'), W - 120, 15);
    c.fillText(Game.i18n.t('thanks'), W / 2, 180);
    c.textBaseline = 'alphabetic';

    drawPrimaryButton(c, Game.i18n.t('playAgain'), VICTORY_BTN.x, VICTORY_BTN.y, VICTORY_BTN.w, VICTORY_BTN.h, t);

    /* Guests bouncing in a line either side of Momoko */
    var draw = Game.entities && Game.entities.drawAnimalSprite;
    if (draw) {
      var gs = 1.35;
      for (var g = 0; g < VICTORY_GUESTS.length; g++) {
        var left = g < VICTORY_GUESTS.length / 2;
        var slot = left ? g : g - VICTORY_GUESTS.length / 2;
        var gx = left ? 70 + slot * 70 : W / 2 + 110 + slot * 70;
        var hop = Math.max(0, Math.sin(t * 0.12 + g * 0.9)) * 14;
        c.save();
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.beginPath(); c.ellipse(gx, floorY + 2, 26 - hop * 0.6, 4, 0, 0, Math.PI * 2); c.fill();
        c.translate(gx, floorY - hop);
        c.scale(left ? -gs : gs, gs);
        c.translate(-24, -44);
        draw(c, VICTORY_GUESTS[g], 0, 0);
        c.restore();
      }
    }

    /* Momoko flossing centre stage */
    if (Game.entities && Game.entities.drawMomokoFloss) {
      var ms = 2.6;
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath(); c.ellipse(W / 2, floorY + 2, 30, 5, 0, 0, Math.PI * 2); c.fill();
      c.save();
      c.translate(W / 2 - 14 * ms, floorY - 35 * ms);
      c.scale(ms, ms);
      Game.entities.drawMomokoFloss(c, 0, 0, Game.customization, t * 0.18);
      c.restore();
    }

    /* Confetti: seeded pieces falling and tumbling */
    for (var p = 0; p < 70; p++) {
      var spd = 0.6 + hash01(p * 3) * 1.2;
      var cx = hash01(p) * W + Math.sin(t * 0.03 + p) * 18;
      var cy = (hash01(p + 100) * (H + 40) + t * spd) % (H + 40) - 20;
      var rot = t * 0.06 * (p % 2 ? 1 : -1) + p;
      c.save();
      c.translate(cx, cy);
      c.rotate(rot);
      c.scale(1, Math.abs(Math.cos(rot * 1.3)) * 0.8 + 0.2);
      c.fillStyle = flagCols[p % flagCols.length];
      c.fillRect(-3.5, -2, 7, 4);
      c.restore();
    }

    /* Sparkles twinkling round the spotlight (additive) */
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (var s = 0; s < 14; s++) {
      var a = s / 14 * Math.PI * 2 + t * 0.01;
      var sr = 70 + hash01(s + 7) * 90;
      var sx = W / 2 + Math.cos(a) * sr * 1.6;
      var sy = 350 + Math.sin(a) * sr * 0.5;
      var tw = Math.max(0, Math.sin(t * 0.09 + s * 2.1));
      if (tw <= 0) continue;
      var sg = c.createRadialGradient(sx, sy, 0, sx, sy, 10 * tw + 2);
      sg.addColorStop(0, 'rgba(255, 250, 220, 0.9)');
      sg.addColorStop(1, 'rgba(255, 200, 240, 0)');
      c.fillStyle = sg;
      c.beginPath(); c.arc(sx, sy, 10 * tw + 2, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255, 255, 255, ' + (0.8 * tw) + ')';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(sx - 8 * tw, sy); c.lineTo(sx + 8 * tw, sy);
      c.moveTo(sx, sy - 8 * tw); c.lineTo(sx, sy + 8 * tw);
      c.stroke();
    }
    c.restore();

    c.textAlign = 'left';
    c.restore();
  }

  function handleVictoryClick(mx, my) {
    if (hitButton(mx, my, VICTORY_BTN.x, VICTORY_BTN.y, VICTORY_BTN.w, VICTORY_BTN.h)) {
      Game.audio.play('select');
      victoryTimer = 0;
      return 'restart';
    }
    return null;
  }

  /* ---- Customization Screen ----
     Layout matches the sketch the user's daughter drew:
       - Title at top
       - Momoko preview on the left side (live, updates on every change)
       - Tab bar along the top-right (hair / dress / swim / shoes / crab / food)
       - 3x2 variant icon grid below the tabs
       - Color swatches below the grid when the current tab has a color
       - Start button at the bottom */
  var hairColors = ['#e06088', '#4a3728', '#f5d060', '#4488ff', '#222222', '#cc3333'];
  var suitColors = ['#e06088', '#3366aa', '#cc3333', '#7733aa', '#228844', '#dd7722'];
  var shoeColors = ['#ff99cc', '#33bb77', '#ffcc44', '#66aaff', '#ffffff', '#552211'];
  var skinTones  = ['#ffe0c0', '#ddb896', '#c68c5a', '#8d6e4c', '#5c3d2e'];

  /* Tab definitions – order matches the sketch. `field` is the key inside
     Game.customization this tab writes to. `colorField` (optional) enables
     a color-swatch row below the grid. Icons are drawn by name-dispatch in
     drawVariantIcon. */
  var customTabs = [
    { id: 'hair',  label: 'tabHair',  field: 'hairStyle', colorField: 'hair',    colors: hairColors,
      variants: [
        { id: 'twinTails',  label: 'varTwinTails' },
        { id: 'longBraids', label: 'varLongBraids' },
        { id: 'buns',       label: 'varBuns' },
      ] },
    { id: 'dress', label: 'tabDress', field: 'outfit',    colorField: 'suit',    colors: suitColors,
      variants: [
        { id: 'frillyDress', label: 'varFrillyDress' },
        { id: 'sailorDress', label: 'varSailorDress' },
        { id: 'starDress',   label: 'varStarDress' },
      ] },
    { id: 'swim',  label: 'tabSwim',  field: 'outfit',    colorField: 'suit',    colors: suitColors,
      variants: [
        { id: 'sailorSwimsuit', label: 'varSailorSwimsuit' },
        { id: 'onePiece',       label: 'varOnePiece' },
        { id: 'frillyBikini',   label: 'varFrillyBikini' },
      ] },
    { id: 'shoes', label: 'tabShoes', field: 'shoes',     colorField: 'flipper', colors: shoeColors,
      variants: [
        { id: 'maryJane', label: 'varMaryJane' },
        { id: 'sneaker',  label: 'varSneaker' },
        { id: 'flipper',  label: 'varFlipper' },
      ] },
    { id: 'crab',  label: 'tabCrab',  field: 'crab',      colorField: null, colors: null,
      variants: [
        { id: 'none', label: 'varNone' },
        { id: 'red',  label: 'varCrabRed' },
        { id: 'blue', label: 'varCrabBlue' },
        { id: 'gold', label: 'varCrabGold' },
      ] },
    { id: 'food',  label: 'tabFood',  field: 'food',      colorField: null, colors: null,
      variants: [
        { id: 'none',       label: 'varNone' },
        { id: 'iceCream',   label: 'varIceCream' },
        { id: 'onigiri',    label: 'varOnigiri' },
        { id: 'donut',      label: 'varDonut' },
        { id: 'crepe',      label: 'varCrepe' },
        { id: 'taiyaki',    label: 'varTaiyaki' },
        { id: 'parfait',    label: 'varParfait' },
        { id: 'macaron',    label: 'varMacaron' },
        { id: 'strawberry', label: 'varStrawberry' },
      ] },
  ];

  var customSelection = { tab: 'hair' };

  /* ---- Layout constants (shared by draw + hit-test) ----
     Grid is sized for up to 3 rows × 3 cols so the 9-variant food tab
     fits without scrolling. Colors + skin sit below at fixed Y so the
     layout stays stable when switching tabs. */
  /* Tab row ends at x=771, in line with the grid, not flush with the edge. */
  var TAB_X = 320, TAB_Y = 60, TAB_W = 71, TAB_H = 34, TAB_GAP = 5;
  var GRID_X = 320, GRID_Y = 100, GRID_COLS = 3, GRID_TILE_W = 146, GRID_TILE_H = 58, GRID_GAP = 6;
  var COLOR_X = 320, COLOR_STEP = 42;
  var START_BTN_W = 200, START_BTN_H = 46;
  var START_BTN_X = W / 2 - START_BTN_W / 2 + 150;
  var START_BTN_Y = 420;

  function getTab(id) {
    for (var i = 0; i < customTabs.length; i++) if (customTabs[i].id === id) return customTabs[i];
    return customTabs[0];
  }

  /* Where the color-swatch row anchors for this tab. Sits just below the
     active grid so tabs with fewer variants (e.g. hair) don't leave a
     gap. Used by both the draw pass and the hit-test. */
  function colorYFor(tab) {
    var rows = Math.max(1, Math.ceil(tab.variants.length / GRID_COLS));
    return GRID_Y + rows * (GRID_TILE_H + GRID_GAP) + 24;
  }

  /* Tile icon for a variant. Keeps per-tile drawing small and iconic so
     the 6 tiles visually contrast even when they share the same tab. */
  function drawVariantIcon(c, tabId, variantId, cx, cy, cust) {
    c.save();
    c.translate(cx, cy);
    if (tabId === 'hair') drawHairIcon(c, variantId, cust.hair);
    else if (tabId === 'dress' || tabId === 'swim') drawOutfitIcon(c, variantId, cust.suit);
    else if (tabId === 'shoes') drawShoeIcon(c, variantId, cust.flipper);
    else if (tabId === 'crab') drawCrabIcon(c, variantId);
    else if (tabId === 'food') drawFoodIcon(c, variantId);
    c.restore();
  }

  function drawHairIcon(c, id, hairC) {
    var color = hairC || '#e06088';
    /* Tiny head */
    c.fillStyle = '#ffddbb';
    c.beginPath(); c.arc(0, 4, 10, 0, Math.PI * 2); c.fill();
    if (id === 'longBraids') {
      c.fillStyle = color;
      for (var side = -1; side <= 1; side += 2) {
        for (var b = 0; b < 3; b++) {
          c.beginPath();
          c.ellipse(side * 10, -4 + b * 7, 3.4, 3.8, 0, 0, Math.PI * 2);
          c.fill();
        }
      }
      /* Top */
      c.beginPath();
      c.ellipse(0, -6, 12, 6, 0, Math.PI, 0);
      c.fill();
    } else if (id === 'buns') {
      c.fillStyle = color;
      c.beginPath(); c.arc(-8, -8, 5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(8, -8, 5, 0, Math.PI * 2); c.fill();
      c.beginPath();
      c.ellipse(0, -2, 11, 5, 0, Math.PI, 0);
      c.fill();
    } else {
      /* twinTails */
      c.fillStyle = color;
      c.beginPath();
      c.ellipse(-11, 4, 4, 10, 0.1, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(11, 4, 4, 10, -0.1, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(0, -4, 12, 7, 0, Math.PI, 0);
      c.fill();
    }
  }

  function drawOutfitIcon(c, id, suitC) {
    var color = suitC || '#e06088';
    if (id === 'frillyDress' || id === 'sailorDress' || id === 'starDress') {
      /* Bodice */
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(-10, -12);
      c.quadraticCurveTo(0, -14, 10, -12);
      c.lineTo(8, -2);
      c.lineTo(-8, -2);
      c.closePath();
      c.fill();
      /* Skirt */
      c.beginPath();
      c.moveTo(-8, -2);
      c.lineTo(-14, 14);
      c.lineTo(14, 14);
      c.lineTo(8, -2);
      c.closePath();
      c.fill();
      if (id === 'starDress') {
        /* Gold bow on chest */
        c.fillStyle = '#ffd24a';
        c.beginPath(); c.ellipse(-2.4, -8, 2, 1.6, -0.3, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse( 2.4, -8, 2, 1.6,  0.3, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#c88a1a';
        c.beginPath(); c.arc(0, -8, 0.9, 0, Math.PI * 2); c.fill();
        /* Stars on skirt */
        c.fillStyle = '#ffd24a';
        var iconStar = function (sx, sy, r) {
          c.beginPath();
          for (var k = 0; k < 10; k++) {
            var ang = -Math.PI / 2 + k * Math.PI / 5;
            var rr = k % 2 === 0 ? r : r * 0.4;
            var px = sx + Math.cos(ang) * rr;
            var py = sy + Math.sin(ang) * rr;
            if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
          }
          c.closePath(); c.fill();
        };
        iconStar(-6,  6, 1.3);
        iconStar( 0, 10, 1.4);
        iconStar( 6,  6, 1.3);
        /* Silver hem */
        c.strokeStyle = '#ffffff';
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(-14, 14); c.lineTo(14, 14);
        c.stroke();
      } else {
        /* Scalloped hem */
        c.fillStyle = '#ffffff';
        for (var s = -2; s <= 2; s++) {
          c.beginPath(); c.arc(s * 5, 15, 2.2, Math.PI, 0); c.fill();
        }
        if (id === 'frillyDress') {
          /* Heart gem */
          c.fillStyle = '#ff5577';
          c.beginPath();
          c.arc(-1.4, -8, 1.3, 0, Math.PI * 2);
          c.arc(1.4, -8, 1.3, 0, Math.PI * 2);
          c.moveTo(-2.6, -7);
          c.lineTo(0, -4);
          c.lineTo(2.6, -7);
          c.closePath();
          c.fill();
        } else {
          /* Sailor collar */
          c.fillStyle = '#ffffff';
          c.beginPath();
          c.moveTo(-8, -13);
          c.lineTo(0, -6);
          c.lineTo(8, -13);
          c.closePath();
          c.fill();
        }
      }
    } else if (id === 'frillyBikini') {
      /* Bunny Pjs preview */
      c.fillStyle = color;
      c.fillRect(-10, -12, 20, 22);
      c.fillStyle = '#fff8f0';
      c.beginPath(); c.ellipse(0, 0, 6, 5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff9944';
      c.fillRect(-1, -2, 2, 4);
      c.fillStyle = '#ff99bb';
      c.beginPath(); c.arc(-5, -7, 0.8, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(5, -7, 0.8, 0, Math.PI * 2); c.fill();
      /* Bunny ear hint */
      c.fillStyle = '#fff8f0';
      c.beginPath(); c.ellipse(-6, -16, 1.4, 4, -0.2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(6, -16, 1.4, 4, 0.2, 0, Math.PI * 2); c.fill();
    } else if (id === 'sailorSwimsuit') {
      /* Panda Pjs preview */
      c.fillStyle = '#fafafa';
      c.fillRect(-10, -12, 20, 22);
      c.fillStyle = '#1a1a1a';
      c.fillRect(-10, -12, 4, 22);
      c.fillRect(6, -12, 4, 22);
      c.fillStyle = '#5a8a38';
      c.fillRect(-3, 0, 6, 7);
      c.fillStyle = '#8aaa48';
      c.fillRect(-1.5, 0, 0.8, 7);
      c.fillRect(0.7, 0, 0.8, 7);
      c.fillStyle = '#1a1a1a';
      c.beginPath(); c.arc(-6, -15, 2.4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(6, -15, 2.4, 0, Math.PI * 2); c.fill();
    } else if (id === 'onePiece') {
      /* Unicorn Pjs preview — pastel rainbow stripes */
      var stripeColors = ['#ffb3d9', '#ffe6b3', '#d9ffb3', '#b3e6ff', '#d9b3ff'];
      for (var psi = 0; psi < stripeColors.length; psi++) {
        c.fillStyle = stripeColors[psi];
        c.fillRect(-10, -12 + psi * 4.4, 20, 4.6);
      }
      c.fillStyle = '#ffd24a';
      c.beginPath();
      c.moveTo(-2, -16); c.lineTo(0, -22); c.lineTo(2, -16); c.closePath();
      c.fill();
      c.fillStyle = '#fff4a8';
      var ss = 2;
      c.beginPath();
      for (var i = 0; i < 10; i++) {
        var ang = -Math.PI / 2 + i * Math.PI / 5;
        var rr = i % 2 === 0 ? ss : ss * 0.4;
        var px = 0 + Math.cos(ang) * rr;
        var py = 0 + Math.sin(ang) * rr;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
      c.fill();
    }
  }

  function drawShoeIcon(c, id, shoeC) {
    var color = shoeC || '#ff99cc';
    if (id === 'flipper') {
      c.fillStyle = color;
      c.beginPath();
      c.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(0,0,0,0.15)';
      c.beginPath();
      c.ellipse(-5, -1, 4, 2, 0, 0, Math.PI * 2);
      c.fill();
    } else if (id === 'sneaker') {
      c.fillStyle = color;
      c.fillRect(-12, -5, 24, 8);
      c.fillStyle = '#ffffff';
      c.fillRect(-12, 3, 24, 2.5);
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillRect(-10, -4, 6, 1);
      c.fillRect(-2, -4, 6, 1);
    } else {
      /* maryJane */
      c.fillStyle = color;
      c.beginPath();
      c.ellipse(0, 1, 14, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(-8, -3);
      c.lineTo(8, -3);
      c.stroke();
      c.fillStyle = '#fff4aa';
      c.beginPath(); c.arc(0, -3, 1.6, 0, Math.PI * 2); c.fill();
    }
  }

  function drawCrabIcon(c, id) {
    if (id === 'none') {
      c.strokeStyle = '#88aacc';
      c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.stroke();
      c.beginPath();
      c.moveTo(-7, -7);
      c.lineTo(7, 7);
      c.stroke();
      return;
    }
    if (Game.entities && Game.entities.drawCrabPet) {
      c.save();
      c.scale(2.2, 2.2);
      Game.entities.drawCrabPet(c, 0, 0, id, 0);
      c.restore();
    }
  }

  function drawFoodIcon(c, id) {
    if (id === 'none') {
      c.strokeStyle = '#88aacc';
      c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.stroke();
      c.beginPath();
      c.moveTo(-7, -7);
      c.lineTo(7, 7);
      c.stroke();
      return;
    }
    c.save();
    c.scale(2.8, 2.8);
    if (id === 'iceCream') {
      c.fillStyle = '#e0b070';
      c.beginPath();
      c.moveTo(-1.5, 2);
      c.lineTo(1.5, 2);
      c.lineTo(0, 6);
      c.closePath();
      c.fill();
      c.fillStyle = '#ffc8d4';
      c.beginPath(); c.arc(0, 1, 2.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff3355';
      c.beginPath(); c.arc(0, -1.5, 0.75, 0, Math.PI * 2); c.fill();
    } else if (id === 'onigiri') {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(0, -3);
      c.lineTo(-3.5, 3);
      c.lineTo(3.5, 3);
      c.closePath();
      c.fill();
      c.fillStyle = '#2a3a2a';
      c.fillRect(-3, 1, 6, 2);
      c.fillStyle = 'rgba(255,160,180,0.7)';
      c.beginPath(); c.arc(-1.1, 0, 0.55, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(1.1, 0, 0.55, 0, Math.PI * 2); c.fill();
    } else if (id === 'donut') {
      c.fillStyle = '#c88858';
      c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff99cc';
      c.beginPath(); c.arc(0, 0, 2.7, Math.PI + 0.3, -0.3, false); c.fill();
      c.fillStyle = '#ffe4b0';
      c.beginPath(); c.arc(0, 0, 1, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffff66'; c.fillRect(-1.4, -0.3, 0.5, 0.5);
      c.fillStyle = '#66ddff'; c.fillRect(1, 0, 0.5, 0.5);
    } else if (id === 'crepe') {
      c.fillStyle = '#f2d8a4';
      c.beginPath();
      c.moveTo(-2.6, -2.6);
      c.lineTo(2.6, -2.6);
      c.lineTo(0, 4);
      c.closePath();
      c.fill();
      c.fillStyle = '#ffdceb';
      c.beginPath(); c.arc(0, -2.6, 2, Math.PI, 0); c.fill();
      c.fillStyle = '#dd3355';
      c.beginPath(); c.arc(-0.4, -3, 0.8, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#2a5d2a';
      c.fillRect(-0.7, -3.8, 0.6, 0.6);
    } else if (id === 'taiyaki') {
      c.fillStyle = '#cc8844';
      c.beginPath();
      c.ellipse(-0.4, 0, 3.4, 1.8, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(2.6, 0);
      c.lineTo(4.4, -1.6);
      c.lineTo(4.4, 1.6);
      c.closePath();
      c.fill();
      c.fillStyle = '#e0a868';
      c.beginPath(); c.ellipse(-1, -0.6, 1.6, 0.5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a0c14';
      c.beginPath(); c.arc(-2.2, -0.4, 0.4, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#8a5520';
      c.lineWidth = 0.3;
      c.beginPath();
      c.moveTo(-1.4, 0.3); c.lineTo(1.6, 0.3);
      c.stroke();
    } else if (id === 'parfait') {
      c.strokeStyle = 'rgba(255,255,255,0.7)';
      c.lineWidth = 0.4;
      c.strokeRect(-1.8, -2, 3.6, 5.6);
      c.fillStyle = '#6b3a1a';
      c.fillRect(-1.6, 2, 3.2, 1.4);
      c.fillStyle = '#fff4dc';
      c.fillRect(-1.6, 0.5, 3.2, 1.4);
      c.fillStyle = '#ff6688';
      c.fillRect(-1.6, -1, 3.2, 1.4);
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(0, -2.3, 1.5, Math.PI, 0); c.fill();
      c.beginPath(); c.arc(-0.5, -2.9, 0.8, Math.PI, 0); c.fill();
      c.beginPath(); c.arc(0.4, -3.2, 0.6, Math.PI, 0); c.fill();
      c.fillStyle = '#dd2244';
      c.beginPath(); c.arc(0.7, -3.5, 0.55, 0, Math.PI * 2); c.fill();
    } else if (id === 'macaron') {
      c.fillStyle = '#ffbadb';
      c.beginPath(); c.ellipse(0, -1.2, 3, 1.4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffffff';
      c.fillRect(-3, -0.3, 6, 1.1);
      c.fillStyle = '#ff9ac2';
      c.beginPath(); c.ellipse(0, 1.6, 3, 1.4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.beginPath(); c.ellipse(-1, -1.5, 1.3, 0.4, 0, 0, Math.PI * 2); c.fill();
    } else if (id === 'strawberry') {
      c.fillStyle = '#e8344a';
      c.beginPath();
      c.moveTo(-2.6, -1.2);
      c.quadraticCurveTo(0, 4.8, 2.6, -1.2);
      c.closePath();
      c.fill();
      c.fillStyle = '#fff4a8';
      c.beginPath(); c.arc(-1, 0.7, 0.3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(0.8, 0.4, 0.3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(0, 2, 0.3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(-1.4, 2.3, 0.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3caf3c';
      c.beginPath();
      c.moveTo(-2.8, -1.2);
      c.lineTo(-0.8, -2.2);
      c.lineTo(0.8, -2.2);
      c.lineTo(2.8, -1.2);
      c.lineTo(0, -0.3);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  function drawCustomizeScreen(c) {
    drawDuskBackdrop(c, 0.45);
    clipGame(c);
    drawHotelHeading(c, Game.i18n.t('customize'), 30, 26);

    /* Preview stage – a warm spotlight and a round brass-edged rug, like
       a fitting-room mirror in the hotel boutique. */
    var stageCX = 160, stageCY = 240;
    var stageGrad = c.createRadialGradient(stageCX, stageCY, 20, stageCX, stageCY, 150);
    stageGrad.addColorStop(0, 'rgba(255,190,220,0.26)');
    stageGrad.addColorStop(1, 'rgba(255,190,220,0)');
    c.fillStyle = stageGrad;
    c.fillRect(10, 70, 300, 340);
    c.fillStyle = '#7a2840';
    c.beginPath(); c.ellipse(stageCX, 324, 96, 18, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#e8b860';
    c.lineWidth = 2;
    c.beginPath(); c.ellipse(stageCX, 324, 88, 14, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(stageCX, 322, 50, 8, 0, 0, Math.PI * 2); c.fill();

    /* Momoko preview */
    c.save();
    c.translate(stageCX - 70, stageCY - 85);
    c.scale(5, 5);
    drawMomokoPreview(c, Game.customization);
    c.restore();

    /* Tab bar */
    for (var ti = 0; ti < customTabs.length; ti++) {
      var tx = TAB_X + ti * (TAB_W + TAB_GAP);
      var tab = customTabs[ti];
      var active = customSelection.tab === tab.id;
      var tabHot = pointerOver(c, tx, TAB_Y, TAB_W, TAB_H);
      c.fillStyle = active ? '#8a46b8' : tabHot ? '#55286e' : '#3a1c4e';
      roundRect(c, tx, TAB_Y, TAB_W, TAB_H, 6);
      c.fill();
      if (active) {
        c.strokeStyle = '#ffdd88';
        c.lineWidth = 2;
        roundRect(c, tx, TAB_Y, TAB_W, TAB_H, 6);
        c.stroke();
      }
      c.fillStyle = active ? '#ffffff' : '#dcc4e4';
      fitFont(c, Game.i18n.t(tab.label), TAB_W - 8, 12, 'bold');
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(Game.i18n.t(tab.label), tx + TAB_W / 2, TAB_Y + TAB_H / 2);
    }
    c.textBaseline = 'alphabetic';

    /* Variant grid for the active tab */
    var activeTab = getTab(customSelection.tab);
    var currentVariantId = Game.customization[activeTab.field];
    for (var vi = 0; vi < activeTab.variants.length; vi++) {
      var row = Math.floor(vi / GRID_COLS);
      var col = vi % GRID_COLS;
      var gx = GRID_X + col * (GRID_TILE_W + GRID_GAP);
      var gy = GRID_Y + row * (GRID_TILE_H + GRID_GAP);
      var v = activeTab.variants[vi];
      var selected = v.id === currentVariantId;
      /* Tile bg */
      var tileHot = pointerOver(c, gx, gy, GRID_TILE_W, GRID_TILE_H);
      c.fillStyle = selected ? '#6a3490' : tileHot ? '#4a2464' : '#2e1640';
      roundRect(c, gx, gy, GRID_TILE_W, GRID_TILE_H, 8);
      c.fill();
      if (selected) {
        c.strokeStyle = '#ffdd88';
        c.lineWidth = 2.5;
        roundRect(c, gx, gy, GRID_TILE_W, GRID_TILE_H, 8);
        c.stroke();
      }
      /* Icon (left side of tile) */
      drawVariantIcon(c, activeTab.id, v.id, gx + 32, gy + GRID_TILE_H / 2 - 2, Game.customization);
      /* Label (right side) */
      c.fillStyle = '#fbeefa';
      fitFont(c, Game.i18n.t(v.label), GRID_TILE_W - 72, 12, 'bold');
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(Game.i18n.t(v.label), gx + 64, gy + GRID_TILE_H / 2);
    }
    c.textBaseline = 'alphabetic';

    /* Color swatches (when the active tab has a color dimension) */
    /* Color row anchor follows the grid so tabs with fewer variants pull
       the colors up instead of leaving a big empty band. */
    var colorY = colorYFor(activeTab);
    if (activeTab.colorField && activeTab.colors) {
      var labelKey = activeTab.colorField === 'hair' ? 'hairColor'
                   : activeTab.colorField === 'suit' ? 'suitColor'
                   : 'skinTone';
      c.fillStyle = '#e8c890';
      c.font = 'bold 13px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'left';
      c.fillText(Game.i18n.t(labelKey), COLOR_X, colorY - 8);
      var selColor = Game.customization[activeTab.colorField];
      for (var ci = 0; ci < activeTab.colors.length; ci++) {
        var ccx = COLOR_X + ci * COLOR_STEP + 16;
        var ccy = colorY + 16;
        c.fillStyle = activeTab.colors[ci];
        c.beginPath();
        c.arc(ccx, ccy, 14, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.35)';
        c.lineWidth = 1;
        c.stroke();
        if (activeTab.colors[ci] === selColor) {
          c.strokeStyle = '#ffdd88';
          c.lineWidth = 3;
          c.beginPath();
          c.arc(ccx, ccy, 17, 0, Math.PI * 2);
          c.stroke();
        }
      }
    }

    /* Skin tones – always visible regardless of tab (it's the only axis
       that doesn't belong to a category but still matters) */
    c.fillStyle = '#e8c890';
    c.font = 'bold 13px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'left';
    c.fillText(Game.i18n.t('skinTone'), COLOR_X, colorY + 48);
    for (var ki = 0; ki < skinTones.length; ki++) {
      var kcx = COLOR_X + ki * COLOR_STEP + 16;
      var kcy = colorY + 68;
      c.fillStyle = skinTones[ki];
      c.beginPath();
      c.arc(kcx, kcy, 14, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.lineWidth = 1;
      c.stroke();
      if (skinTones[ki] === Game.customization.skin) {
        c.strokeStyle = '#ffdd88';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(kcx, kcy, 17, 0, Math.PI * 2);
        c.stroke();
      }
    }

    /* Start button */
    drawPrimaryButton(c, Game.i18n.t('startGame'), START_BTN_X, START_BTN_Y, START_BTN_W, START_BTN_H, titleAnimTimer++);

    /* Keyboard hint so kids on a laptop don't have to reach for the mouse.
       Sits above the Start button to stay within the 480-tall canvas. */
    c.fillStyle = '#dcc4e4';
    c.font = '11px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.fillText(
      Game.i18n.t(Game.input.isTouch() ? 'customizeTouchHint' : 'customizeKbHint'),
      START_BTN_X + START_BTN_W / 2,
      START_BTN_Y - 8
    );
  }

  function drawMomokoPreview(c, cust) {
    if (!Game.entities) return;
    if (Game.entities.drawMomokoSprite) Game.entities.drawMomokoSprite(c, 0, 0, cust, 0);
    /* Crab pet appears next to her feet in the preview so the player can
       see the companion they just picked. */
    if (Game.entities.drawCrabPet && cust.crab && cust.crab !== 'none') {
      Game.entities.drawCrabPet(c, -8, 32, cust.crab, 0);
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function handleCustomizeClick(mx, my) {
    /* Tab bar */
    for (var ti = 0; ti < customTabs.length; ti++) {
      var tx = TAB_X + ti * (TAB_W + TAB_GAP);
      if (hitButton(mx, my, tx, TAB_Y, TAB_W, TAB_H)) {
        customSelection.tab = customTabs[ti].id;
        Game.audio.play('select');
        return null;
      }
    }

    var activeTab = getTab(customSelection.tab);

    /* Variant tiles */
    for (var vi = 0; vi < activeTab.variants.length; vi++) {
      var row = Math.floor(vi / GRID_COLS);
      var col = vi % GRID_COLS;
      var gx = GRID_X + col * (GRID_TILE_W + GRID_GAP);
      var gy = GRID_Y + row * (GRID_TILE_H + GRID_GAP);
      if (hitButton(mx, my, gx, gy, GRID_TILE_W, GRID_TILE_H)) {
        Game.customization[activeTab.field] = activeTab.variants[vi].id;
        Game.audio.play('select');
        return null;
      }
    }

    /* Tab color swatches */
    var colorY = colorYFor(activeTab);
    if (activeTab.colorField && activeTab.colors) {
      for (var ci = 0; ci < activeTab.colors.length; ci++) {
        var ccx = COLOR_X + ci * COLOR_STEP + 16;
        var ccy = colorY + 16;
        var dx = mx - ccx, dy = my - ccy;
        if (dx * dx + dy * dy < 17 * 17) {
          Game.customization[activeTab.colorField] = activeTab.colors[ci];
          Game.audio.play('select');
          return null;
        }
      }
    }

    /* Skin tone swatches (always shown) */
    for (var ki = 0; ki < skinTones.length; ki++) {
      var kcx = COLOR_X + ki * COLOR_STEP + 16;
      var kcy = colorY + 68;
      var kdx = mx - kcx, kdy = my - kcy;
      if (kdx * kdx + kdy * kdy < 17 * 17) {
        Game.customization.skin = skinTones[ki];
        Game.audio.play('select');
        return null;
      }
    }

    /* Start button */
    if (hitButton(mx, my, START_BTN_X, START_BTN_Y, START_BTN_W, START_BTN_H)) {
      Game.audio.play('select');
      return 'start';
    }
    return null;
  }

  /* ---- Intro / Backstory ---- */
  var introAnimTimer = 0;

  function drawIntroScreen(c) {
    introAnimTimer++;

    drawDuskBackdrop(c, 0.6);
    clipGame(c);
    drawHotelHeading(c, Game.i18n.t('introTitle'), 42, 28);

    /* Momoko portrait (left), standing on a little welcome mat */
    c.fillStyle = '#7a2840';
    c.beginPath(); c.ellipse(166, 312, 62, 12, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#e8b860';
    c.lineWidth = 2;
    c.beginPath(); c.ellipse(166, 312, 55, 9, 0, 0, Math.PI * 2); c.stroke();
    c.save();
    c.translate(120, 202);
    c.scale(3.2, 3.2);
    if (Game.entities && Game.entities.drawMomokoSprite) {
      Game.entities.drawMomokoSprite(c, 0, 0, Game.customization, Math.floor(introAnimTimer / 8) % 4);
    }
    c.restore();

    /* Story panel – sized to the text so it never sits half-empty */
    c.font = '16px "M PLUS Rounded 1c", sans-serif';
    var panelX = 260, panelW = 510;
    var storyLines = layoutLines(c, Game.i18n.t('introText'), panelW - 48);
    var panelH = storyLines.length * 26 + 40;
    var panelY = Math.max(76, 230 - panelH / 2);
    drawHotelPanel(c, panelX, panelY, panelW, panelH);
    c.fillStyle = '#f4e6f4';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    for (var sl = 0; sl < storyLines.length; sl++) {
      c.fillText(storyLines[sl], panelX + 24, panelY + 33 + sl * 26);
    }
    c.textBaseline = 'alphabetic';

    /* A little parade of guests strolling along the bottom */
    if (Game.entities && Game.entities.drawAnimalSprite) {
      var parade = ['elephant', 'penguin', 'giraffe', 'bunny', 'panda', 'koala', 'unicorn'];
      var span = W + 120;
      for (var pi = 0; pi < parade.length; pi++) {
        var px = ((introAnimTimer * 0.5 + pi * (span / parade.length)) % span) - 60;
        var step = Math.abs(Math.sin(introAnimTimer * 0.12 + pi)) * 2;
        c.save();
        c.globalAlpha = 0.9;
        c.fillStyle = 'rgba(0, 0, 0, 0.25)';
        c.beginPath(); c.ellipse(px + 19, 410, 17, 3, 0, 0, Math.PI * 2); c.fill();
        c.translate(px, 375 - step);
        c.scale(0.8, 0.8);
        Game.entities.drawAnimalSprite(c, parade[pi], 0, 0);
        c.restore();
      }
    }

    /* Continue button */
    drawPrimaryButton(c, Game.i18n.t('continueBtn'), W / 2 - 100, H - 58, 200, 46, introAnimTimer);
  }

  function handleIntroClick(mx, my) {
    if (hitButton(mx, my, W / 2 - 100, H - 58, 200, 46)) {
      Game.audio.play('select');
      introAnimTimer = 0;
      return 'start';
    }
    return null;
  }

  /* ---- Beach Cutscene ---- */
  /* Scene config is regenerated on every breach via startBeachCutscene()
     so each surface trip looks a little different (time of day, who's on
     the beach, what they're doing). Falls back to a default scene if the
     state ever ends up rendered without a config. */
  var beachTimer = 0;
  var beachKitty = null;
  var beachScene = null;

  /* Time-of-day palettes – each set drives sky gradient, distant hills,
     sand, water, and sun colour so the whole frame stays cohesive. */
  var BEACH_PALETTES = {
    morning: {
      sky: ['#aedcf2', '#dbeefb', '#fff1d4'],
      hills: '#7aa6c5',
      sand: ['#f3dfa6', '#ecca80', '#d8b070'],
      water: '#1e8fc8',
      waterMid: '#39a3d8',
      waterLight: '#73c4e8',
      sun: '#fff9c0',
      sunCore: '#fff8a8',
      sunRays: 'rgba(255,250,200,0.10)',
    },
    noon: {
      sky: ['#4a9ee6', '#89c6f2', '#ffd89b'],
      hills: '#7fa8c9',
      sand: ['#f0d590', '#e8c478', '#d4a968'],
      water: '#1e7bb8',
      waterMid: '#2e95cc',
      waterLight: '#5ab4dd',
      sun: '#fff6a8',
      sunCore: '#fff6a8',
      sunRays: 'rgba(255,244,176,0.12)',
    },
    sunset: {
      sky: ['#ff7e5f', '#feb47b', '#ffd29a'],
      hills: '#9a5e7e',
      sand: ['#f4c282', '#e69e63', '#c47a4a'],
      water: '#3a4a8a',
      waterMid: '#5a6cae',
      waterLight: '#8a9acf',
      sun: '#ffd06b',
      sunCore: '#ffb766',
      sunRays: 'rgba(255,180,110,0.18)',
    },
  };

  var BEACH_TITLES = ['beachTitle', 'beachTitleAlt1', 'beachTitleAlt2', 'beachTitleAlt3'];
  var BEACH_TEXTS = ['beachText', 'beachTextAlt1', 'beachTextAlt2', 'beachTextAlt3'];
  var BEACH_KID_COLORS = ['#33bb77', '#cc44aa', '#ee7733', '#3388dd', '#dd3344', '#9966dd'];

  function makeBeachScene() {
    var times = ['morning', 'noon', 'sunset'];
    var time = times[Math.floor(Math.random() * times.length)];
    var pal = BEACH_PALETTES[time];

    /* Seagulls (3-6 birds at varied heights) */
    var gullCount = 3 + Math.floor(Math.random() * 4);
    var gulls = [];
    for (var g = 0; g < gullCount; g++) {
      gulls.push({
        x: Math.random() * W,
        y: 40 + Math.random() * 90,
        spd: 0.25 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
      });
    }

    /* Crabs (2-4) with random base positions */
    var crabCount = 2 + Math.floor(Math.random() * 3);
    var crabs = [];
    for (var cb = 0; cb < crabCount; cb++) {
      crabs.push({
        baseX: 100 + Math.random() * (W - 200),
        dir: Math.random() > 0.5 ? 1 : -1,
        phase: Math.random() * Math.PI * 2,
      });
    }

    /* Kids (1-3) playing on the sand, each with a random shirt colour */
    var kidCount = 1 + Math.floor(Math.random() * 3);
    var kids = [];
    for (var k = 0; k < kidCount; k++) {
      kids.push({
        x: 180 + k * (440 / kidCount) + Math.random() * 40,
        y: 0.82 + Math.random() * 0.06,
        color: BEACH_KID_COLORS[Math.floor(Math.random() * BEACH_KID_COLORS.length)],
        bobOffset: Math.random() * Math.PI * 2,
      });
    }

    /* Optional flourishes */
    var hasBeachBall = Math.random() < 0.55;
    var ballX = 200 + Math.random() * 400;
    var hasFrisbee = Math.random() < 0.45;
    var frisbeeX = 200 + Math.random() * 400;
    var hasDolphin = Math.random() < 0.35;

    /* Title / subtitle pulled from translation pools so JP/EN both vary */
    var titleKey = BEACH_TITLES[Math.floor(Math.random() * BEACH_TITLES.length)];
    var textKey = BEACH_TEXTS[Math.floor(Math.random() * BEACH_TEXTS.length)];

    return {
      time: time,
      pal: pal,
      gulls: gulls,
      crabs: crabs,
      kids: kids,
      hasBeachBall: hasBeachBall,
      ballX: ballX,
      hasFrisbee: hasFrisbee,
      frisbeeX: frisbeeX,
      hasDolphin: hasDolphin,
      dolphinPhase: Math.random() * Math.PI * 2,
      titleKey: titleKey,
      textKey: textKey,
    };
  }

  /* Player-controlled Momoko state while the beach cutscene is up. She
     walks on the sand line between the palms; action key does a small
     hop. Position is in canvas-logical (0..W,0..H) coords. */
  var beachMomoko = null;
  var BEACH_GROUND_Y = H * 0.84;
  var BEACH_MIN_X = 60;
  var BEACH_MAX_X = W - 60;
  var BEACH_WALK_SPEED = 2.6;
  var BEACH_JUMP_V = -5.2;
  var BEACH_GRAVITY = 0.32;

  function startBeachCutscene() {
    beachTimer = 0;
    beachKitty = null;
    beachScene = makeBeachScene();
    beachMomoko = {
      x: W / 2,
      y: BEACH_GROUND_Y,
      vy: 0,
      facing: 1,
      walkPhase: 0,
      grounded: true,
      moving: false,
    };
  }

  /* Called from engine.js every frame while State.BEACH is active. `keys`
     and `jp` are the shared Game.input state. */
  function updateBeach(keys, jp) {
    if (!beachMomoko) return;
    var m = beachMomoko;
    m.moving = false;
    if (keys.left)  { m.x -= BEACH_WALK_SPEED; m.facing = -1; m.moving = true; }
    if (keys.right) { m.x += BEACH_WALK_SPEED; m.facing =  1; m.moving = true; }
    if (m.x < BEACH_MIN_X) m.x = BEACH_MIN_X;
    if (m.x > BEACH_MAX_X) m.x = BEACH_MAX_X;

    /* Hop on action (space / BUBBLE). Uses justPressed so holding the
       key doesn't auto-bounce. */
    if (jp && jp.action && m.grounded) {
      m.vy = BEACH_JUMP_V;
      m.grounded = false;
    }
    /* Gravity + ground clamp */
    m.vy += BEACH_GRAVITY;
    m.y += m.vy;
    if (m.y >= BEACH_GROUND_Y) {
      m.y = BEACH_GROUND_Y;
      m.vy = 0;
      m.grounded = true;
    }

    if (m.moving && m.grounded) m.walkPhase += 0.35;
  }

  function drawPalmTree(c, x, groundY, scale, sway) {
    var s = scale || 1;
    /* Trunk – curved bezier */
    c.strokeStyle = '#6b4321';
    c.lineWidth = 10 * s;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x, groundY);
    c.bezierCurveTo(x - 10 * s, groundY - 60 * s, x + 10 * s, groundY - 100 * s, x + sway, groundY - 140 * s);
    c.stroke();
    /* Trunk rings */
    c.strokeStyle = '#4a2d15';
    c.lineWidth = 1.5;
    for (var tr = 0; tr < 6; tr++) {
      var rt = (tr + 1) / 7;
      var rx = x - 10 * s * (1 - rt) + sway * rt;
      var ry = groundY - 140 * s * rt;
      c.beginPath();
      c.arc(rx, ry, 5 * s, 0, Math.PI, false);
      c.stroke();
    }
    /* Fronds */
    var topX = x + sway;
    var topY = groundY - 140 * s;
    c.fillStyle = '#2a8833';
    for (var fr = 0; fr < 7; fr++) {
      var ang = (fr / 7) * Math.PI * 2 + 0.3;
      var len = 60 * s + (fr % 2) * 10;
      var tipX = topX + Math.cos(ang) * len;
      var tipY = topY + Math.sin(ang) * len * 0.7;
      var midX = topX + Math.cos(ang) * len * 0.5;
      var midY = topY + Math.sin(ang) * len * 0.35;
      c.beginPath();
      c.moveTo(topX, topY);
      c.quadraticCurveTo(midX, midY - 12 * s, tipX, tipY);
      c.quadraticCurveTo(midX, midY + 12 * s, topX, topY);
      c.closePath();
      c.fill();
    }
    /* Frond highlights */
    c.fillStyle = '#3caa45';
    for (var fh = 0; fh < 7; fh++) {
      var ahg = (fh / 7) * Math.PI * 2 + 0.3;
      var lng = 60 * s + (fh % 2) * 10;
      var hx = topX + Math.cos(ahg) * lng * 0.7;
      var hy = topY + Math.sin(ahg) * lng * 0.5;
      c.beginPath();
      c.ellipse(hx, hy, lng * 0.25, 3 * s, ahg, 0, Math.PI * 2);
      c.fill();
    }
    /* Coconuts */
    c.fillStyle = '#3d2512';
    c.beginPath(); c.arc(topX - 6 * s, topY + 4 * s, 4 * s, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(topX + 5 * s, topY + 5 * s, 4 * s, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(topX, topY - 2 * s, 3.5 * s, 0, Math.PI * 2); c.fill();
  }

  function drawSandcastle(c, x, y) {
    /* Base */
    c.fillStyle = '#d4a968';
    c.beginPath();
    c.moveTo(x - 24, y);
    c.lineTo(x + 24, y);
    c.lineTo(x + 22, y - 14);
    c.lineTo(x - 22, y - 14);
    c.closePath();
    c.fill();
    /* Center tower */
    c.fillStyle = '#e0b876';
    c.beginPath();
    c.moveTo(x - 10, y - 14);
    c.lineTo(x + 10, y - 14);
    c.lineTo(x + 9, y - 36);
    c.lineTo(x - 9, y - 36);
    c.closePath();
    c.fill();
    /* Tower top – crenellations as arcs */
    c.fillStyle = '#e0b876';
    for (var cc = 0; cc < 3; cc++) {
      c.beginPath();
      c.arc(x - 7 + cc * 7, y - 38, 2.5, Math.PI, 0);
      c.fill();
    }
    /* Side turrets */
    c.beginPath();
    c.arc(x - 22, y - 14, 5, Math.PI, 0);
    c.fill();
    c.beginPath();
    c.arc(x + 22, y - 14, 5, Math.PI, 0);
    c.fill();
    /* Door */
    c.fillStyle = '#8a6338';
    c.beginPath();
    c.moveTo(x - 3, y - 14);
    c.lineTo(x + 3, y - 14);
    c.lineTo(x + 3, y - 22);
    c.quadraticCurveTo(x, y - 26, x - 3, y - 22);
    c.closePath();
    c.fill();
    /* Flag */
    c.strokeStyle = '#5d3a1b';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x, y - 36);
    c.lineTo(x, y - 48);
    c.stroke();
    c.fillStyle = '#ee4466';
    c.beginPath();
    c.moveTo(x, y - 48);
    c.lineTo(x + 8, y - 45);
    c.lineTo(x, y - 42);
    c.closePath();
    c.fill();
  }

  function drawBeachUmbrella(c, x, groundY) {
    /* Pole */
    c.strokeStyle = '#5d3a1b';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(x, groundY);
    c.lineTo(x, groundY - 62);
    c.stroke();
    /* Canopy dome – alternating stripes */
    var stripes = ['#ee4466', '#ffffff'];
    for (var st = 0; st < 6; st++) {
      var a0 = Math.PI + (st / 6) * Math.PI;
      var a1 = Math.PI + ((st + 1) / 6) * Math.PI;
      c.fillStyle = stripes[st % 2];
      c.beginPath();
      c.moveTo(x, groundY - 62);
      c.arc(x, groundY - 62, 38, a0, a1);
      c.closePath();
      c.fill();
    }
    /* Rim dots */
    c.fillStyle = '#cc2244';
    for (var rm = 0; rm < 7; rm++) {
      var ang = Math.PI + (rm / 6) * Math.PI;
      c.beginPath();
      c.arc(x + Math.cos(ang) * 38, groundY - 62 + Math.sin(ang) * 38, 2, 0, Math.PI * 2);
      c.fill();
    }
    /* Pole tip */
    c.fillStyle = '#ffcc33';
    c.beginPath();
    c.arc(x, groundY - 64, 3, 0, Math.PI * 2);
    c.fill();
  }

  function drawBeachTowel(c, x, y, w, h, c1, c2) {
    /* Towel base */
    c.fillStyle = c1;
    roundRect(c, x, y, w, h, 3);
    c.fill();
    /* Stripes */
    c.fillStyle = c2;
    var sw = w / 6;
    for (var s = 0; s < 3; s++) {
      c.fillRect(x + s * 2 * sw + sw * 0.5, y, sw * 0.6, h);
    }
    /* Fringe */
    c.strokeStyle = c2;
    c.lineWidth = 1;
    for (var fg = 0; fg < 8; fg++) {
      var fx = x + (fg / 7) * w;
      c.beginPath();
      c.moveTo(fx, y + h);
      c.lineTo(fx, y + h + 3);
      c.stroke();
    }
  }

  function drawSeagull(c, x, y, flap) {
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2;
    var wing = Math.sin(flap) * 5;
    c.beginPath();
    c.moveTo(x - 10, y + 2 + wing);
    c.quadraticCurveTo(x - 5, y - 5 - wing, x, y);
    c.quadraticCurveTo(x + 5, y - 5 - wing, x + 10, y + 2 + wing);
    c.stroke();
    /* Body dot */
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(x, y - 1, 1.6, 0, Math.PI * 2);
    c.fill();
  }

  function drawCrab(c, x, y, phase) {
    var leg = Math.sin(phase) * 2;
    c.fillStyle = '#dd4433';
    /* Body */
    c.beginPath();
    c.ellipse(x, y, 8, 5, 0, 0, Math.PI * 2);
    c.fill();
    /* Claws */
    c.beginPath();
    c.ellipse(x - 9, y - 2, 3.5, 2.5, -0.3, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(x + 9, y - 2, 3.5, 2.5, 0.3, 0, Math.PI * 2);
    c.fill();
    /* Legs */
    c.strokeStyle = '#aa2211';
    c.lineWidth = 1.4;
    for (var lg = 0; lg < 3; lg++) {
      var lx = x - 5 + lg * 5;
      var lOff = (lg % 2 === 0 ? leg : -leg);
      c.beginPath();
      c.moveTo(lx - 2, y + 3);
      c.lineTo(lx - 4, y + 6 + lOff);
      c.stroke();
      c.beginPath();
      c.moveTo(lx + 2, y + 3);
      c.lineTo(lx + 4, y + 6 - lOff);
      c.stroke();
    }
    /* Eyes */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(x - 3, y - 4, 1.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + 3, y - 4, 1.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#000000';
    c.beginPath(); c.arc(x - 3, y - 4, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + 3, y - 4, 0.8, 0, Math.PI * 2); c.fill();
  }

  function drawKid(c, x, groundY, outfit, bob) {
    var bobOff = Math.sin(bob) * 1.5;
    /* Head */
    c.fillStyle = '#ffddbb';
    c.beginPath();
    c.arc(x, groundY - 30 + bobOff, 5, 0, Math.PI * 2);
    c.fill();
    /* Hair tuft */
    c.fillStyle = '#553322';
    c.beginPath();
    c.arc(x, groundY - 34 + bobOff, 5, Math.PI + 0.3, Math.PI * 2 - 0.3);
    c.fill();
    /* Eyes */
    c.fillStyle = '#223344';
    c.beginPath(); c.arc(x - 2, groundY - 30 + bobOff, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + 2, groundY - 30 + bobOff, 0.8, 0, Math.PI * 2); c.fill();
    /* Smile */
    c.strokeStyle = '#aa3344';
    c.lineWidth = 0.8;
    c.beginPath();
    c.arc(x, groundY - 28 + bobOff, 1.6, 0.2, Math.PI - 0.2);
    c.stroke();
    /* Body / shirt */
    c.fillStyle = outfit;
    c.beginPath();
    c.moveTo(x - 5, groundY - 24 + bobOff);
    c.quadraticCurveTo(x - 6, groundY - 14, x - 4, groundY - 10);
    c.lineTo(x + 4, groundY - 10);
    c.quadraticCurveTo(x + 6, groundY - 14, x + 5, groundY - 24 + bobOff);
    c.closePath();
    c.fill();
    /* Arms – waving */
    c.strokeStyle = '#ffddbb';
    c.lineWidth = 2;
    c.lineCap = 'round';
    var arm = Math.sin(bob + 1) * 4;
    c.beginPath();
    c.moveTo(x - 5, groundY - 22 + bobOff);
    c.lineTo(x - 9, groundY - 18 - arm);
    c.stroke();
    c.beginPath();
    c.moveTo(x + 5, groundY - 22 + bobOff);
    c.lineTo(x + 9, groundY - 18 + arm);
    c.stroke();
    /* Legs */
    c.strokeStyle = outfit;
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(x - 2, groundY - 10);
    c.lineTo(x - 3, groundY);
    c.stroke();
    c.beginPath();
    c.moveTo(x + 2, groundY - 10);
    c.lineTo(x + 3, groundY);
    c.stroke();
  }

  function drawStarfish(c, x, y, size, rot, color) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.fillStyle = color;
    c.beginPath();
    for (var i = 0; i < 10; i++) {
      var r = (i % 2 === 0) ? size : size * 0.4;
      var a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      var px = Math.cos(a) * r;
      var py = Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.restore();
  }

  function drawBeachCutscene(c, wolfe) {
    beachTimer++;
    var t = beachTimer;
    /* Lazily seed a default scene if the engine somehow rendered the
       cutscene without calling startBeachCutscene first. */
    if (!beachScene) beachScene = makeBeachScene();
    var sc = beachScene;
    var pal = sc.pal;

    /* Sky gradient – three-stop palette per time of day */
    var skyGrad = c.createLinearGradient(0, 0, 0, H * 0.6);
    skyGrad.addColorStop(0, pal.sky[0]);
    skyGrad.addColorStop(0.6, pal.sky[1]);
    skyGrad.addColorStop(1, pal.sky[2]);
    c.fillStyle = skyGrad;
    c.fillRect(0, 0, W, H * 0.6);

    /* Sun position varies with time of day so sunset reads as low / warm */
    var sunX = sc.time === 'morning' ? 150 : sc.time === 'sunset' ? 690 : 650;
    var sunY = sc.time === 'sunset' ? 150 : 78;

    c.save();
    c.globalAlpha = 1;
    c.strokeStyle = pal.sun;
    c.lineWidth = 3;
    for (var ry = 0; ry < 14; ry++) {
      var ra = (ry / 14) * Math.PI * 2 + t * 0.002;
      c.globalAlpha = 0.12;
      c.beginPath();
      c.moveTo(sunX, sunY);
      c.lineTo(sunX + Math.cos(ra) * 180, sunY + Math.sin(ra) * 180);
      c.stroke();
    }
    c.restore();

    /* Sun glow */
    var sunGrad = c.createRadialGradient(sunX, sunY, 10, sunX, sunY, 80);
    sunGrad.addColorStop(0, pal.sunRays.replace(/[\d.]+\)$/, '0.9)'));
    sunGrad.addColorStop(1, pal.sunRays.replace(/[\d.]+\)$/, '0)'));
    c.fillStyle = sunGrad;
    c.fillRect(sunX - 90, sunY - 90, 180, 180);
    /* Sun core */
    c.fillStyle = pal.sunCore;
    c.beginPath();
    c.arc(sunX, sunY, 32, 0, Math.PI * 2);
    c.fill();

    /* Distant hills */
    c.fillStyle = pal.hills;
    c.beginPath();
    c.moveTo(0, H * 0.58);
    c.bezierCurveTo(120, H * 0.5, 200, H * 0.55, 320, H * 0.53);
    c.bezierCurveTo(460, H * 0.5, 560, H * 0.57, 700, H * 0.54);
    c.bezierCurveTo(760, H * 0.53, 800, H * 0.56, 800, H * 0.58);
    c.lineTo(800, H * 0.6);
    c.lineTo(0, H * 0.6);
    c.closePath();
    c.fill();

    /* Clouds – tinted slightly to match palette */
    c.fillStyle = sc.time === 'sunset' ? '#ffd0b0' : '#ffffff';
    for (var cl = 0; cl < 4; cl++) {
      var cx = ((200 + cl * 220 + t * 0.25) % (W + 200)) - 100;
      var cy = 50 + cl * 18;
      c.globalAlpha = 0.9;
      c.beginPath();
      c.arc(cx, cy, 18, 0, Math.PI * 2);
      c.arc(cx + 18, cy - 4, 22, 0, Math.PI * 2);
      c.arc(cx + 38, cy, 16, 0, Math.PI * 2);
      c.arc(cx + 24, cy + 8, 18, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }

    /* Seagulls (count / positions vary per visit) */
    for (var sg = 0; sg < sc.gulls.length; sg++) {
      var bird = sc.gulls[sg];
      bird.x += bird.spd;
      if (bird.x > W + 20) bird.x = -20;
      drawSeagull(c, bird.x, bird.y + Math.sin(t * 0.02 + bird.phase) * 4, t * 0.18 + bird.phase);
    }

    /* Optional dolphin breaching the waves in the distance */
    if (sc.hasDolphin) {
      var dPhase = t * 0.012 + sc.dolphinPhase;
      var dx = ((dPhase * 30) % (W + 200)) - 100;
      var dyOff = Math.sin(dPhase * 2) * 10 - 6;
      if (Math.sin(dPhase * 2) > 0) {
        c.fillStyle = '#3a4a55';
        c.beginPath();
        c.ellipse(dx, H * 0.92 + dyOff, 14, 5, -0.3, 0, Math.PI * 2);
        c.fill();
        /* Dorsal fin */
        c.beginPath();
        c.moveTo(dx, H * 0.92 + dyOff - 2);
        c.lineTo(dx + 4, H * 0.92 + dyOff - 9);
        c.lineTo(dx + 8, H * 0.92 + dyOff - 1);
        c.closePath();
        c.fill();
      }
    }

    /* Sand – main beach */
    var sandGrad = c.createLinearGradient(0, H * 0.55, 0, H);
    sandGrad.addColorStop(0, pal.sand[0]);
    sandGrad.addColorStop(0.5, pal.sand[1]);
    sandGrad.addColorStop(1, pal.sand[2]);
    c.fillStyle = sandGrad;
    c.beginPath();
    c.moveTo(0, H * 0.6);
    for (var sx = 0; sx <= W; sx += 8) {
      var sandY = H * 0.58 + Math.sin(sx * 0.008) * 4 + Math.sin(sx * 0.04) * 2;
      c.lineTo(sx, sandY);
    }
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.closePath();
    c.fill();

    /* Sand bumps / ripples */
    c.strokeStyle = 'rgba(183, 138, 78, 0.4)';
    c.lineWidth = 1;
    for (var rp = 0; rp < 6; rp++) {
      c.beginPath();
      c.moveTo(0, H * 0.7 + rp * 22);
      for (var rx2 = 0; rx2 <= W; rx2 += 20) {
        c.lineTo(rx2, H * 0.7 + rp * 22 + Math.sin(rx2 * 0.03 + rp) * 2);
      }
      c.stroke();
    }

    /* Palm trees (behind beach items) */
    drawPalmTree(c, 70, H * 0.6, 1.0, Math.sin(t * 0.008) * 4);
    drawPalmTree(c, 760, H * 0.6, 0.9, Math.sin(t * 0.009 + 1) * 4);
    drawPalmTree(c, 540, H * 0.58, 0.7, Math.sin(t * 0.007 + 2) * 3);

    /* Beach towels */
    drawBeachTowel(c, 160, H * 0.76, 70, 28, '#ee4466', '#ffffff');
    drawBeachTowel(c, 420, H * 0.8, 64, 26, '#44aadd', '#ffff66');

    /* Umbrella + accompanying towel */
    drawBeachUmbrella(c, 660, H * 0.84);

    /* Sandcastle */
    drawSandcastle(c, 320, H * 0.82);

    /* Beach ball – bouncing on the sand */
    if (sc.hasBeachBall) {
      var ballY = H * 0.86 - Math.abs(Math.sin(t * 0.06)) * 30;
      drawBeachBall(c, sc.ballX, ballY, t * 0.04);
    }
    /* Frisbee – arcing through the sky */
    if (sc.hasFrisbee) {
      var frX = (sc.frisbeeX + (t * 1.2) % 600) - 100;
      var frY = 200 + Math.sin(t * 0.025) * 60;
      drawFrisbee(c, frX, frY, t * 0.2);
    }

    /* Starfish scattered on sand */
    drawStarfish(c, 140, H * 0.84, 6, 0.4, '#e66442');
    drawStarfish(c, 500, H * 0.78, 5, 1.1, '#e6a84a');
    drawStarfish(c, 720, H * 0.77, 5, 0.7, '#d94a5a');

    /* Kids – count and colours vary per visit */
    for (var ki = 0; ki < sc.kids.length; ki++) {
      var kid = sc.kids[ki];
      drawKid(c, kid.x, H * kid.y, kid.color, t * 0.08 + kid.bobOffset);
    }

    /* Crabs walking on sand */
    for (var cb = 0; cb < sc.crabs.length; cb++) {
      var crab = sc.crabs[cb];
      var crabX = crab.baseX + Math.sin(t * 0.01 + crab.phase) * 30 * crab.dir;
      var crabY = H * 0.88 + Math.sin(t * 0.04 + crab.phase) * 1;
      drawCrab(c, crabX, crabY, t * 0.2 + crab.phase);
    }

    /* Wolfe on beach */
    if (wolfe) {
      wolfe.y = H * 0.6 - 22;
      wolfe.draw(c, 0, 0);
    }

    /* Water at bottom – tinted by time of day */
    c.fillStyle = pal.water;
    c.fillRect(0, H * 0.93, W, H * 0.07);

    /* Overlapping waves */
    c.fillStyle = pal.waterMid;
    c.beginPath();
    c.moveTo(0, H * 0.93);
    for (var w1 = 0; w1 <= W; w1 += 6) {
      c.lineTo(w1, H * 0.93 + Math.sin(t * 0.04 + w1 * 0.04) * 3);
    }
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.closePath();
    c.fill();

    c.fillStyle = pal.waterLight;
    c.beginPath();
    c.moveTo(0, H * 0.945);
    for (var w2 = 0; w2 <= W; w2 += 6) {
      c.lineTo(w2, H * 0.945 + Math.sin(t * 0.05 + w2 * 0.05 + 1.2) * 2.5);
    }
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.closePath();
    c.fill();

    /* Wave foam fringe */
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1.8;
    c.globalAlpha = 0.85;
    c.beginPath();
    for (var wf = 0; wf <= W; wf += 4) {
      var wfy = H * 0.93 + Math.sin(t * 0.04 + wf * 0.04) * 3;
      if (wf === 0) c.moveTo(wf, wfy);
      else c.lineTo(wf, wfy);
    }
    c.stroke();
    c.globalAlpha = 1;
    /* Foam dots */
    c.fillStyle = 'rgba(255,255,255,0.7)';
    for (var fd = 0; fd < 18; fd++) {
      var fdx = (fd * 46 + (t * 0.3) % 46) % W;
      var fdy = H * 0.93 + Math.sin(t * 0.04 + fdx * 0.04) * 3 + Math.sin(t * 0.07 + fd) * 1.5;
      c.beginPath();
      c.arc(fdx, fdy, 1.5, 0, Math.PI * 2);
      c.fill();
    }

    /* Player-controlled Momoko walking on the sand. Drawn after sand /
       decor and before Kitty so she sits in the natural z-order. Scaled
       2x so she matches the size of kids / beach props. The sprite's
       animFrame parameter drives her flipper/foot kick timing. */
    if (beachMomoko) {
      var mm = beachMomoko;
      /* Shadow on sand */
      c.save();
      c.fillStyle = 'rgba(0,0,0,0.22)';
      var shadowSquash = mm.grounded ? 1 : 0.6;
      c.beginPath();
      c.ellipse(mm.x, BEACH_GROUND_Y + 10, 16 * shadowSquash, 4 * shadowSquash, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();

      c.save();
      c.translate(mm.x, mm.y);
      c.scale(2, 2);
      if (mm.facing === -1) c.scale(-1, 1);
      /* The sprite's natural origin is its top-left, so shift up by full
         sprite height (34) to plant feet on the ground line. */
      if (Game.entities && Game.entities.drawMomokoSprite) {
        var frame = mm.moving ? Math.floor(mm.walkPhase) : 0;
        Game.entities.drawMomokoSprite(c, -14, -34, Game.customization, frame);
      }
      /* Companion crab trails behind her opposite facing direction */
      if (Game.entities && Game.entities.drawCrabPet &&
          Game.customization.crab && Game.customization.crab !== 'none') {
        Game.entities.drawCrabPet(c, -22, -2, Game.customization.crab, beachTimer);
      }
      c.restore();
    }

    /* Kitty Corn splashing at shore */
    if (!beachKitty && Game.entities && Game.entities.KittyCorn) {
      beachKitty = new Game.entities.KittyCorn(420, H * 0.9);
    }
    if (beachKitty) {
      beachKitty.update();
      beachKitty.x = 420 + Math.sin(t * 0.04) * 20;
      beachKitty.y = H * 0.9 - 8 + Math.sin(t * 0.12) * 3;
      beachKitty.draw(c, 0, 0);
      /* Splash particles */
      for (var sp2 = 0; sp2 < 3; sp2++) {
        var spa = -Math.PI / 2 + (sp2 - 1) * 0.5;
        var spr = 6 + (Math.sin(t * 0.1 + sp2) + 1) * 8;
        c.fillStyle = 'rgba(255,255,255,0.7)';
        c.beginPath();
        c.arc(beachKitty.x + 12 + Math.cos(spa) * spr, beachKitty.y + 20 + Math.sin(spa) * spr, 2, 0, Math.PI * 2);
        c.fill();
      }
    }

    /* Title text with shadow – pulled from a small pool so it varies */
    c.save();
    c.fillStyle = '#ffffff';
    c.font = 'bold 30px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.shadowColor = 'rgba(0,0,0,0.6)';
    c.shadowBlur = 6;
    c.shadowOffsetY = 2;
    c.fillText(Game.i18n.t(sc.titleKey), W / 2, 40);
    c.restore();

    /* Text panel */
    var panelW = 520, panelH = 60, panelX = (W - panelW) / 2, panelY = 58;
    c.fillStyle = 'rgba(0, 40, 70, 0.55)';
    roundRect(c, panelX, panelY, panelW, panelH, 10);
    c.fill();
    c.fillStyle = '#e8f4ff';
    c.font = '14px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    wrapText(c, Game.i18n.t(sc.textKey), W / 2, panelY + 22, panelW - 20, 20);

    drawButton(c, Game.i18n.t('back'), W / 2 - 90, 140, 180, 40);
  }

  function drawBeachBall(c, x, y, spin) {
    var r = 12;
    /* Base */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    /* Coloured wedges */
    var wedges = ['#ee4466', '#ffdd44', '#33aaee'];
    for (var w = 0; w < 3; w++) {
      var a0 = spin + (w / 3) * Math.PI * 2;
      var a1 = a0 + Math.PI / 6;
      c.fillStyle = wedges[w];
      c.beginPath();
      c.moveTo(x, y);
      c.arc(x, y, r, a0, a1);
      c.closePath();
      c.fill();
    }
    /* Outline */
    c.strokeStyle = '#333';
    c.lineWidth = 0.8;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
    /* Shadow on sand */
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.beginPath();
    c.ellipse(x, H * 0.88, 8, 2, 0, 0, Math.PI * 2);
    c.fill();
  }

  function drawFrisbee(c, x, y, spin) {
    c.save();
    c.translate(x, y);
    c.rotate(Math.sin(spin) * 0.3);
    c.fillStyle = '#ff6644';
    c.beginPath();
    c.ellipse(0, 0, 12, 3, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#cc3322';
    c.beginPath();
    c.ellipse(0, 1, 12, 1.5, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function handleBeachClick(mx, my) {
    if (hitButton(mx, my, W / 2 - 90, 140, 180, 40)) {
      Game.audio.play('select');
      beachTimer = 0;
      return 'dive';
    }
    return null;
  }

  /* ---- Exports ---- */
  /* ============================================================ */
  /*               TRAVEL MENU (rocket destinations)                */
  /* ============================================================ */
  /* Elevator floor menu — 2x2 grid of floors. */
  var FLOOR_CARDS = [
    { key: 'destHerosPlanet', icon: 'bell',    body: '#aa6a2a', accent: '#ffd24a' },
    { key: 'destCheeseMoon',  icon: 'lion',    body: '#c89a4a', accent: '#a07832' },
    { key: 'destFloor3',      icon: 'wolf',    body: '#4a6838', accent: '#88ff88' },
    { key: 'destFloor4',      icon: 'unicorn', body: '#a468d4', accent: '#ff66cc' },
  ];

  function drawTravelMenu(c) {
    /* Dim backdrop over the game */
    c.save();
    c.fillStyle = 'rgba(20, 10, 40, 0.85)';
    c.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);

    /* Panel */
    c.fillStyle = '#3a2418';
    c.strokeStyle = '#ffd24a';
    c.lineWidth = 3;
    /* Tall enough that the Cancel button sits clear of the bottom border. */
    var px = W / 2 - 280, py = 50, pw = 560, ph = 390;
    roundRect(c, px, py, pw, ph, 14);
    c.fill();
    c.stroke();

    /* Title */
    c.fillStyle = '#ffd24a';
    c.font = 'bold 28px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('travelMenuTitle'), W / 2, 90);

    /* 2x2 floor grid */
    var bw = 240, bh = 130, gap = 16;
    var totalW = bw * 2 + gap;
    var startX = W / 2 - totalW / 2;
    var startY = 110;
    for (var i = 0; i < 4; i++) {
      var col = i % 2;
      var row = Math.floor(i / 2);
      drawFloorCard(c,
        startX + col * (bw + gap),
        startY + row * (bh + gap),
        bw, bh, i, FLOOR_CARDS[i]);
    }

    /* Cancel */
    drawButton(c, Game.i18n.t('travelCancel'), W / 2 - 90, 396, 180, 30);
    c.restore();
  }

  /* Small in-game art for an elevator-menu card, centred on (cx, cy). */
  function drawFloorIcon(c, icon, cx, cy) {
    c.save();
    if (icon === 'bell') {
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath(); c.ellipse(cx, cy + 16, 24, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#7a5418';
      c.fillRect(cx - 22, cy + 8, 44, 6);
      var bg = c.createRadialGradient(cx - 7, cy - 6, 2, cx, cy, 22);
      bg.addColorStop(0, '#fff2b0');
      bg.addColorStop(0.5, '#e8b840');
      bg.addColorStop(1, '#9a6a18');
      c.fillStyle = bg;
      c.beginPath(); c.arc(cx, cy + 8, 18, Math.PI, 0); c.closePath(); c.fill();
      c.fillStyle = '#caa040';
      c.fillRect(cx - 3, cy - 16, 6, 6);
      c.beginPath(); c.arc(cx, cy - 16, 4, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.beginPath(); c.ellipse(cx - 7, cy - 2, 3, 6, -0.5, 0, Math.PI * 2); c.fill();
    } else if (Game.entities && Game.entities.drawAnimalSprite) {
      c.translate(cx, cy + 16);
      c.scale(1.05, 1.05);
      c.translate(-24, -44);
      Game.entities.drawAnimalSprite(c, icon, 0, 0);
    }
    c.restore();
  }

  function drawFloorCard(c, x, y, w, h, idx, info) {
    var current = (Game.engine && Game.engine.getCurrentZone && Game.engine.getCurrentZone()) || 0;
    var isCurrent = idx === current;
    var isHighlighted = (idx === travelSelection) && !isCurrent;
    c.save();
    c.fillStyle = isCurrent ? '#5a3a22' : info.body;
    c.strokeStyle = info.accent;
    c.lineWidth = isHighlighted ? 4 : 2;
    roundRect(c, x, y, w, h, 10);
    c.fill();
    c.stroke();
    /* Soft glow halo on the keyboard-highlighted card so it reads as
       "selected, ready to confirm" without requiring a mouse hover. */
    if (isHighlighted) {
      c.save();
      c.strokeStyle = '#fff8e0';
      c.lineWidth = 2;
      c.globalAlpha = 0.8;
      roundRect(c, x - 3, y - 3, w + 6, h + 6, 12);
      c.stroke();
      c.restore();
    }

    /* Floor number on a cream badge, readable on every card colour */
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.beginPath(); c.arc(x + 31, y + 34, 19, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff8e0';
    c.beginPath(); c.arc(x + 30, y + 32, 19, 0, Math.PI * 2); c.fill();
    c.strokeStyle = info.accent;
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#3a2418';
    c.font = 'bold 24px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(String(idx + 1), x + 30, y + 33);
    c.textBaseline = 'alphabetic';

    /* Floor icon: the lobby's brass desk bell, or a resident guest */
    drawFloorIcon(c, info.icon, x + w - 48, y + 34);

    /* Label, with a dark outline so it holds up on the pale safari card */
    c.font = 'bold 16px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(40, 20, 10, 0.7)';
    c.lineWidth = 4;
    c.strokeText(Game.i18n.t(info.key), x + w / 2, y + 80);
    c.fillStyle = '#fff8e0';
    c.fillText(Game.i18n.t(info.key), x + w / 2, y + 80);

    /* Confirm button (or "You are here") */
    if (isCurrent) {
      c.fillStyle = '#3a2418';
      c.fillRect(x + 30, y + 95, w - 60, 26);
      c.strokeStyle = info.accent;
      c.strokeRect(x + 30, y + 95, w - 60, 26);
      c.fillStyle = info.accent;
      c.font = 'bold 13px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(Game.i18n.t('travelHere'), x + w / 2, y + 108);
      c.textBaseline = 'alphabetic';
    } else {
      drawButton(c, Game.i18n.t('travelConfirm'), x + 30, y + 95, w - 60, 26);
    }
    c.restore();
  }

  function handleTravelMenuClick(mx, my) {
    var current = (Game.engine && Game.engine.getCurrentZone && Game.engine.getCurrentZone()) || 0;
    var bw = 240, bh = 130, gap = 16;
    var totalW = bw * 2 + gap;
    var startX = W / 2 - totalW / 2;
    var startY = 110;
    for (var i = 0; i < 4; i++) {
      var col = i % 2;
      var row = Math.floor(i / 2);
      var x = startX + col * (bw + gap);
      var y = startY + row * (bh + gap);
      if (i !== current && hitButton(mx, my, x + 30, y + 95, bw - 60, 26)) {
        Game.audio.play('select');
        return { zone: i };
      }
    }
    /* Cancel */
    if (hitButton(mx, my, W / 2 - 90, 396, 180, 30)) {
      Game.audio.play('select');
      return 'cancel';
    }
    return null;
  }

  /* Keyboard navigation for the travel menu. travelSelection holds the
     currently highlighted card index (0..3) and skips over the current
     floor so confirm always means "go somewhere new". travelKeyDelay
     debounces held arrow keys so a single tap moves exactly one cell. */
  var travelSelection = 0;
  var travelKeyDelay = 0;

  function resetTravelMenu() {
    var current = (Game.engine && Game.engine.getCurrentZone && Game.engine.getCurrentZone()) || 0;
    /* Start on the first non-current card so the player can confirm
       immediately. Floor 1 → start on Floor 2; Floor 4 → start on Floor 1. */
    travelSelection = (current === 0) ? 1 : 0;
    travelKeyDelay = 0;
  }

  function updateTravelMenu(keys, jp) {
    var current = (Game.engine && Game.engine.getCurrentZone && Game.engine.getCurrentZone()) || 0;
    if (travelKeyDelay > 0) travelKeyDelay--;

    /* 2x2 grid: 0 1 / 2 3. Up/Down cycle linearly through all floors
       (skipping the current one) so a 7-year-old hammering Down doesn't
       get stuck bouncing between the two cards in one column. Left/Right
       still nudge by column so the visual layout still works for mouse
       hovering / muscle memory. */
    function moveTo(next) {
      if (next < 0 || next > 3) return;
      /* Skip past the YOU-ARE-HERE card so confirm never lands on it. */
      if (next === current) return;
      travelSelection = next;
      travelKeyDelay = 8;
      Game.audio.play('select');
    }
    function cycle(dir) {
      var next = travelSelection;
      for (var i = 0; i < 4; i++) {
        next = (next + dir + 4) % 4;
        if (next !== current) { moveTo(next); return; }
      }
    }

    if (travelKeyDelay === 0) {
      if (keys.left)       moveTo(travelSelection - 1);
      else if (keys.right) moveTo(travelSelection + 1);
      else if (keys.up)    cycle(-1);
      else if (keys.down)  cycle(+1);
    }

    if (jp.action) {
      if (travelSelection !== current) {
        Game.audio.play('select');
        return { zone: travelSelection };
      }
    }
    return null;
  }

  /* ============================================================ */
  /*                    ROCKET LAUNCH ANIMATION                     */
  /* ============================================================ */
  function drawRocketAnim(c, timer, target) {
    /* Elevator-shaft transition: a brass-trimmed cab rides up a brick
       shaft past lit landings while the floor dial sweeps to the target.
       Reuses the rocket-anim wiring so we don't have to fork the engine
       state machine. */
    var dest = target || 0;
    var prog = Math.min(1, timer / 100);
    var GOLD = '#caa040', GOLD_HI = '#ffe08a', WOOD = '#6a4020', WOOD_D = '#452814', PLAQUE = 'rgba(58, 36, 24, 0.92)';
    var wallW = 150;
    var bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#120a18'); bg.addColorStop(0.5, '#1e1222'); bg.addColorStop(1, '#0d0810');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    /* Brick shaft walls scrolling downward */
    c.fillStyle = '#241418';
    c.fillRect(0, 0, wallW, H);
    c.fillRect(W - wallW, 0, wallW, H);
    var scroll = (timer * 9) % 24;
    c.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    c.lineWidth = 1.5;
    var row = 0;
    for (var by = scroll - 24; by < H + 24; by += 24, row++) {
      c.beginPath();
      c.moveTo(0, by); c.lineTo(wallW, by);
      c.moveTo(W - wallW, by); c.lineTo(W, by);
      c.stroke();
      var off = (row % 2) ? 20 : 0;
      for (var bxx = off; bxx < wallW; bxx += 40) {
        c.beginPath();
        c.moveTo(bxx, by); c.lineTo(bxx, by + 24);
        c.moveTo(W - wallW + bxx, by); c.lineTo(W - wallW + bxx, by + 24);
        c.stroke();
      }
    }
    /* Guide rails */
    c.fillStyle = '#3a2a1c';
    c.fillRect(wallW, 0, 10, H);
    c.fillRect(W - wallW - 10, 0, 10, H);
    c.fillStyle = GOLD;
    c.fillRect(wallW + 3, 0, 3, H);
    c.fillRect(W - wallW - 6, 0, 3, H);

    /* Passing landings: warm light spilling into the shaft, sconces on the walls */
    var span = 260;
    for (var f = 0; f < 4; f++) {
      var fy = ((timer * 7 + f * span) % (H + span)) - span / 2;
      var g = c.createLinearGradient(0, fy - 44, 0, fy + 44);
      g.addColorStop(0, 'rgba(255, 214, 120, 0)');
      g.addColorStop(0.5, 'rgba(255, 214, 120, 0.26)');
      g.addColorStop(1, 'rgba(255, 214, 120, 0)');
      c.fillStyle = g;
      c.fillRect(wallW + 10, fy - 44, W - 2 * wallW - 20, 88);
      c.fillStyle = '#5a3a20';
      c.fillRect(wallW + 10, fy + 16, W - 2 * wallW - 20, 6);
      var sc;
      for (sc = 0; sc < 2; sc++) {
        var sxp = sc ? W - wallW + 18 : wallW - 18;
        var sg = c.createRadialGradient(sxp, fy, 2, sxp, fy, 44);
        sg.addColorStop(0, 'rgba(255, 224, 140, 0.55)');
        sg.addColorStop(1, 'rgba(255, 224, 140, 0)');
        c.fillStyle = sg;
        c.fillRect(sxp - 44, fy - 44, 88, 88);
        c.fillStyle = GOLD;
        c.fillRect(sxp - 5, fy - 2, 10, 10);
        c.fillStyle = '#fff0b0';
        c.beginPath(); c.arc(sxp, fy - 4, 5, 0, Math.PI * 2); c.fill();
      }
    }

    /* Cab geometry — bobs gently */
    var cabW = 320, cabH = 250;
    var cx = W / 2 - cabW / 2;
    var cy = H / 2 - cabH / 2 + 26 + Math.sin(timer * 0.2) * 3;

    /* Hoist cables and roof bracket */
    c.strokeStyle = '#7a7a84';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(cx + cabW * 0.3, 0); c.lineTo(cx + cabW * 0.3, cy - 14);
    c.moveTo(cx + cabW * 0.7, 0); c.lineTo(cx + cabW * 0.7, cy - 14);
    c.stroke();
    c.strokeStyle = '#b8b8c4';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx + cabW * 0.3 - 1, 0); c.lineTo(cx + cabW * 0.3 - 1, cy - 14);
    c.moveTo(cx + cabW * 0.7 - 1, 0); c.lineTo(cx + cabW * 0.7 - 1, cy - 14);
    c.stroke();
    c.fillStyle = '#2a1810';
    c.fillRect(cx + cabW * 0.3 - 14, cy - 22, cabW * 0.4 + 28, 12);

    /* Brass floor dial on the cab roof */
    var dx = W / 2, dy = cy - 10, dr = 50;
    c.fillStyle = GOLD;
    c.beginPath(); c.arc(dx, dy, dr, Math.PI, Math.PI * 2); c.closePath(); c.fill();
    c.fillStyle = '#3a2418';
    c.beginPath(); c.arc(dx, dy, dr - 6, Math.PI, Math.PI * 2); c.closePath(); c.fill();
    c.fillStyle = '#fff8e0';
    c.font = 'bold 11px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    var labels = ['L', '2', '3', '4'];
    for (var li = 0; li < 4; li++) {
      var la = Math.PI + (Math.PI * (0.14 + 0.72 * li / 3));
      c.fillStyle = li === dest ? GOLD_HI : '#fff8e0';
      c.fillText(labels[li], dx + Math.cos(la) * (dr - 17), dy + Math.sin(la) * (dr - 17) + 4);
      c.fillStyle = GOLD;
      c.fillRect(dx + Math.cos(la) * (dr - 8) - 1, dy + Math.sin(la) * (dr - 8) - 1, 2, 2);
    }
    var na = Math.PI + (Math.PI * (0.14 + 0.72 * (dest * prog) / 3));
    c.strokeStyle = '#e04050';
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(dx, dy); c.lineTo(dx + Math.cos(na) * (dr - 12), dy + Math.sin(na) * (dr - 12)); c.stroke();
    c.lineCap = 'butt';
    c.fillStyle = GOLD;
    c.beginPath(); c.arc(dx, dy, 4, 0, Math.PI * 2); c.fill();

    /* Cab shell with double brass trim */
    c.fillStyle = '#2a1810';
    c.fillRect(cx - 10, cy - 10, cabW + 20, cabH + 20);
    c.strokeStyle = GOLD;
    c.lineWidth = 3;
    c.strokeRect(cx - 6, cy - 6, cabW + 12, cabH + 12);
    c.strokeStyle = GOLD_HI;
    c.lineWidth = 1;
    c.strokeRect(cx - 2, cy - 2, cabW + 4, cabH + 4);
    /* Walls: warm wood */
    var wg = c.createLinearGradient(0, cy, 0, cy + cabH);
    wg.addColorStop(0, WOOD); wg.addColorStop(1, WOOD_D);
    c.fillStyle = wg;
    c.fillRect(cx, cy, cabW, cabH);
    /* Ceiling with lamp */
    c.fillStyle = '#f0dcb0';
    c.fillRect(cx, cy, cabW, 22);
    c.fillStyle = GOLD;
    c.fillRect(cx, cy + 22, cabW, 3);
    c.fillStyle = '#fff6c8';
    c.fillRect(cx + cabW / 2 - 50, cy + 4, 100, 12);
    var glow = c.createRadialGradient(cx + cabW / 2, cy + 14, 6, cx + cabW / 2, cy + 14, 120);
    glow.addColorStop(0, 'rgba(255, 240, 176, 0.55)');
    glow.addColorStop(1, 'rgba(255, 240, 176, 0)');
    c.fillStyle = glow;
    c.fillRect(cx, cy, cabW, 150);
    /* Panelling with brass inlays */
    for (var pn = 0; pn < 3; pn++) {
      var px = cx + 22 + pn * 96;
      c.fillStyle = WOOD_D;
      c.fillRect(px, cy + 44, 80, 120);
      c.strokeStyle = GOLD;
      c.lineWidth = 1.5;
      c.strokeRect(px + 6, cy + 50, 68, 108);
      c.fillStyle = 'rgba(255, 224, 140, 0.08)';
      c.fillRect(px + 8, cy + 52, 64, 50);
    }
    /* Brass handrail */
    c.fillStyle = GOLD;
    c.fillRect(cx + 10, cy + 150, cabW - 20, 6);
    c.fillStyle = GOLD_HI;
    c.fillRect(cx + 10, cy + 150, cabW - 20, 2);
    c.fillStyle = '#3a2418';
    c.fillRect(cx + 14, cy + 156, 6, 8);
    c.fillRect(cx + cabW - 20, cy + 156, 6, 8);
    /* Carpeted floor with a gold border */
    c.fillStyle = '#8a2030';
    c.fillRect(cx, cy + cabH - 34, cabW, 34);
    c.fillStyle = GOLD;
    c.fillRect(cx, cy + cabH - 34, cabW, 3);
    c.fillStyle = '#a03040';
    for (var fd = 0; fd < 8; fd++) {
      c.beginPath();
      c.moveTo(cx + 24 + fd * 40, cy + cabH - 17);
      c.lineTo(cx + 30 + fd * 40, cy + cabH - 23);
      c.lineTo(cx + 36 + fd * 40, cy + cabH - 17);
      c.lineTo(cx + 30 + fd * 40, cy + cabH - 11);
      c.closePath(); c.fill();
    }

    /* Momoko riding the cab */
    if (Game.entities && Game.entities.drawMomokoSprite) {
      c.save();
      c.globalAlpha = 0.25;
      c.fillStyle = '#000';
      c.beginPath(); c.ellipse(cx + cabW / 2 - 24, cy + cabH - 16, 26, 5, 0, 0, Math.PI * 2); c.fill();
      c.restore();
      c.save();
      c.translate(cx + cabW / 2 - 50, cy + cabH - 18 - 34 * 1.8);
      c.scale(1.8, 1.8);
      Game.entities.drawMomokoSprite(c, 0, 0, Game.customization, Math.floor(timer / 8) % 4);
      c.restore();
    }

    /* Brass control panel: floor display + button column */
    var ppx = cx + cabW - 70, ppy = cy + 56;
    c.fillStyle = GOLD;
    c.fillRect(ppx, ppy, 50, 118);
    c.strokeStyle = GOLD_HI;
    c.lineWidth = 1;
    c.strokeRect(ppx + 2, ppy + 2, 46, 114);
    c.fillStyle = '#3a2418';
    c.fillRect(ppx + 8, ppy + 8, 34, 28);
    c.fillStyle = GOLD_HI;
    c.font = 'bold 18px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.fillText(String(dest + 1) + 'F', ppx + 25, ppy + 28);
    for (var bn = 0; bn < 4; bn++) {
      var lit = bn === dest;
      var bYY = ppy + 52 + bn * 16;
      c.fillStyle = '#3a2418';
      c.beginPath(); c.arc(ppx + 25, bYY, 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = lit ? GOLD_HI : '#6a4a2a';
      c.beginPath(); c.arc(ppx + 25, bYY, 4.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = lit ? '#3a2418' : '#fff8e0';
      c.font = 'bold 8px "M PLUS Rounded 1c", sans-serif';
      c.fillText(String(bn + 1), ppx + 25, bYY + 3);
    }
    c.textAlign = 'left';

    /* Status plaque, styled like the HUD ledger card */
    var msg = timer < 90 ? Game.i18n.t('rocketLaunching') : Game.i18n.t('rocketArriving');
    c.font = 'bold 22px "M PLUS Rounded 1c", sans-serif';
    var pw = Math.max(180, Math.ceil(c.measureText(msg).width) + 48), ph = 40;
    c.fillStyle = PLAQUE;
    c.fillRect(W / 2 - pw / 2, 22, pw, ph);
    c.strokeStyle = GOLD;
    c.lineWidth = 2;
    c.strokeRect(W / 2 - pw / 2, 22, pw, ph);
    c.fillStyle = '#ffd24a';
    c.textAlign = 'center';
    c.fillText(msg, W / 2, 50);
    c.textAlign = 'left';
  }

  /* ============================================================ */
  /*                    HOUSE INTERIOR & FURNITURE                  */
  /* ============================================================ */
  /* Furniture is organised into named categories. Each category has its
     own row of buyable pieces in the palette so a player who wants only
     plants doesn't have to scroll through unrelated items. */
  var FURNITURE_CATEGORIES = [
    { id: 'sleep',  items: ['bed'] },
    { id: 'seat',   items: ['chair', 'sofa', 'stool'] },
    { id: 'tables', items: ['table', 'coffeeTable', 'desk'] },
    { id: 'light',  items: ['lamp', 'ceilingLight', 'candle'] },
    { id: 'decor',  items: ['painting', 'rug', 'mirror'] },
    { id: 'plants', items: ['plant', 'flowers'] },
    { id: 'tech',   items: ['tv'] },
    { id: 'store',  items: ['bookshelf', 'dresser'] },
  ];
  /* Flat list kept as the source-of-truth for the drawing switch below
     and for back-compat with previously saved rooms. */
  var FURNITURE_TYPES = (function () {
    var t = [];
    for (var i = 0; i < FURNITURE_CATEGORIES.length; i++) {
      for (var j = 0; j < FURNITURE_CATEGORIES[i].items.length; j++) {
        t.push(FURNITURE_CATEGORIES[i].items[j]);
      }
    }
    return t;
  })();
  var selectedCategory = 0;
  var selectedFurniture = null;
  /* Each house keeps its own walked-around Momoko position so re-entering
     a house drops her where she was. */
  var housePlayerPos = {};
  /* Anim timer for the in-house Momoko sprite. */
  var housePlayerFrame = 0;
  var housePlayerFacing = 1;
  /* Bounds where Momoko is allowed to walk (matches the floor area, leaves
     room for the palette strip up top and the exit-door at the right).
     The top is pushed below the category tabs + palette row. */
  var HOUSE_FLOOR_TOP = 196;
  var HOUSE_FLOOR_BOTTOM = H - 30;
  var HOUSE_FLOOR_LEFT = 20;
  var HOUSE_FLOOR_RIGHT = W - 110;

  function loadFurnitureState() {
    try {
      var raw = localStorage.getItem(Game.saveKey('furniture'));
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fallthrough */ }
    return {};
  }

  function saveFurnitureState(state) {
    try {
      localStorage.setItem(Game.saveKey('furniture'), JSON.stringify(state));
    } catch (e) { /* storage disabled */ }
  }

  function getHousePlayerPos(houseId) {
    if (!housePlayerPos[houseId]) {
      housePlayerPos[houseId] = { x: 100, y: H - 80 };
    }
    return housePlayerPos[houseId];
  }

  function drawHouseInterior(c, houseId) {
    /* Room background */
    c.fillStyle = '#2a1458';
    c.fillRect(0, 0, W, H);
    /* Back wall gradient */
    var wallGrad = c.createLinearGradient(0, 0, 0, H - 140);
    wallGrad.addColorStop(0, '#3d2468');
    wallGrad.addColorStop(1, '#5a3888');
    c.fillStyle = wallGrad;
    c.fillRect(0, 0, W, H - 140);
    /* Floor */
    c.fillStyle = '#6a4aa0';
    c.fillRect(0, H - 140, W, 140);
    /* Floor planks */
    c.strokeStyle = '#4a2a70';
    c.lineWidth = 1;
    for (var pl = 0; pl < 9; pl++) {
      c.beginPath();
      c.moveTo(0, H - 140 + pl * 16);
      c.lineTo(W, H - 140 + pl * 16);
      c.stroke();
    }
    /* Window with stars */
    c.fillStyle = '#0a0420';
    c.fillRect(540, 60, 160, 100);
    c.strokeStyle = '#ff66cc';
    c.lineWidth = 3;
    c.strokeRect(540, 60, 160, 100);
    /* Pre-baked twinkle dots so they don't reflow each frame */
    c.fillStyle = '#ffffff';
    for (var ws = 0; ws < 12; ws++) {
      var sxw = 550 + ((ws * 13) % 140);
      var syw = 70 + ((ws * 27) % 80);
      c.globalAlpha = 0.4 + ((ws * 17) % 60) / 100;
      c.beginPath();
      c.arc(sxw, syw, 0.8 + (ws % 3) * 0.5, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    /* House name label */
    c.fillStyle = '#44ffff';
    c.font = 'bold 20px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'left';
    var nameKey = houseId === 'heroHome' ? 'houseHero'
                : houseId === 'lilaHouse' ? 'houseLila'
                : 'houseMigword';
    c.fillText(Game.i18n.t(nameKey), 20, 40);

    /* Palette strip (categories on top, items below) */
    c.fillStyle = 'rgba(10, 4, 32, 0.78)';
    c.fillRect(0, 50, W, 144);
    c.fillStyle = '#ffd24a';
    c.font = '12px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'left';
    c.fillText(Game.i18n.t('furnitureTabTitle'), 10, 64);
    /* Clear button (top-right of the palette strip) */
    var clearW = 84, clearH = 22, clearX = W - clearW - 10, clearY = 54;
    c.fillStyle = '#cc4466';
    c.strokeStyle = '#ff99aa';
    c.lineWidth = 1.5;
    roundRect(c, clearX, clearY, clearW, clearH, 6);
    c.fill();
    c.stroke();
    c.fillStyle = '#ffffff';
    c.font = 'bold 11px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('furnitureClear'), clearX + clearW / 2, clearY + 14);
    /* Category tabs */
    var catTabW = Math.min(86, Math.floor((W - 20) / FURNITURE_CATEGORIES.length));
    for (var ci = 0; ci < FURNITURE_CATEGORIES.length; ci++) {
      var cat = FURNITURE_CATEGORIES[ci];
      var cx = 10 + ci * catTabW;
      var cy = 72;
      var catHover = ci === selectedCategory;
      c.fillStyle = catHover ? '#7744cc' : '#1a0a3a';
      c.strokeStyle = catHover ? '#ffd24a' : '#44ffff';
      c.lineWidth = catHover ? 2.5 : 1;
      roundRect(c, cx, cy, catTabW - 4, 26, 6);
      c.fill();
      c.stroke();
      c.fillStyle = catHover ? '#ffffff' : '#aaccee';
      c.font = 'bold 11px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'center';
      c.fillText(
        Game.i18n.t('furnitureCat_' + cat.id),
        cx + (catTabW - 4) / 2,
        cy + 17
      );
    }
    /* Selected category's items */
    var items = FURNITURE_CATEGORIES[selectedCategory].items;
    for (var fi = 0; fi < items.length; fi++) {
      var ft = items[fi];
      var fx = 20 + fi * 78;
      var fy = 108;
      var hover = selectedFurniture === ft;
      c.fillStyle = hover ? '#7744cc' : '#2a1458';
      c.strokeStyle = '#44ffff';
      c.lineWidth = hover ? 3 : 1;
      roundRect(c, fx, fy, 68, 76, 8);
      c.fill();
      c.stroke();
      drawFurniture(c, ft, fx + 34, fy + 38, 'palette');
      /* Tiny label under each piece */
      c.fillStyle = '#ffe9c8';
      c.font = '8px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'center';
      c.fillText(
        Game.i18n.t('furniture_' + ft) || ft,
        fx + 34,
        fy + 70
      );
    }

    /* Placed furniture (drawn before the player so they layer below) */
    var state = loadFurnitureState();
    var items = state[houseId] || [];
    for (var pi = 0; pi < items.length; pi++) {
      drawFurniture(c, items[pi].type, items[pi].x, items[pi].y);
    }

    /* Momoko walking inside — she can mingle with the placed furniture. */
    var pp = getHousePlayerPos(houseId);
    if (Game.entities && Game.entities.drawMomokoSprite) {
      c.save();
      var psx = pp.x - 14, psy = pp.y - 30;
      if (housePlayerFacing === -1) {
        c.translate(psx + 14, 0);
        c.scale(-1, 1);
        psx = -14;
      }
      Game.entities.drawMomokoSprite(c, psx, psy, Game.customization, housePlayerFrame);
      c.restore();
    }

    /* Exit door (right side, bigger so it reads as an actual exit) */
    c.fillStyle = '#3a2412';
    c.fillRect(W - 84, H - 140, 64, 110);
    c.fillStyle = '#8a5a32';
    c.fillRect(W - 80, H - 136, 56, 102);
    c.strokeStyle = '#5a3a22';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(W - 52, H - 132); c.lineTo(W - 52, H - 36); c.stroke();
    c.fillStyle = '#ffd24a';
    c.beginPath();
    c.arc(W - 36, H - 86, 3, 0, Math.PI * 2);
    c.fill();
    /* "Outside" sign */
    c.fillStyle = '#44ffff';
    c.fillRect(W - 92, H - 152, 80, 16);
    c.fillStyle = '#0a0420';
    c.font = 'bold 11px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('furnitureExit'), W - 52, H - 141);
    /* One-shot top-right EXIT button (drawn after the palette so it
       sits above category tabs / clear button visually). */
    drawExitButton(c);
  }

  function drawFurniture(c, type, x, y, mode) {
    /* mode: undefined | 'palette' (medium icon) — placed furniture is 1.6×
       so it reads at a glance, palette icons are 0.85×. Each piece is
       rendered with layered shading, gradients, and trim detail rather
       than flat blocks. */
    c.save();
    var scale = mode === 'palette' ? 0.85 : 1.6;
    c.translate(x, y);
    c.scale(scale, scale);
    /* Soft contact shadow under most pieces (skip rug/painting). */
    if (type !== 'rug' && type !== 'painting' && type !== 'mirror' && type !== 'ceilingLight') {
      c.save();
      c.globalAlpha = 0.25;
      c.fillStyle = '#000';
      c.beginPath();
      c.ellipse(0, 16, 26, 4, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    switch (type) {
      case 'bed': {
        /* Carved wooden footboard */
        var foot = c.createLinearGradient(0, 8, 0, 18);
        foot.addColorStop(0, '#a36a3a');
        foot.addColorStop(1, '#5a3418');
        c.fillStyle = foot;
        c.fillRect(-32, 8, 64, 10);
        c.fillStyle = '#c98a4e';
        c.fillRect(-32, 8, 64, 1.5);
        /* Carved beading along the footboard */
        c.fillStyle = '#3a1e0a';
        for (var bf = 0; bf < 7; bf++) {
          c.beginPath();
          c.arc(-26 + bf * 9, 13, 0.9, 0, Math.PI * 2);
          c.fill();
        }
        /* Mattress with piped trim */
        var matt = c.createLinearGradient(0, -6, 0, 10);
        matt.addColorStop(0, '#fff4f8');
        matt.addColorStop(1, '#f0c8d8');
        c.fillStyle = matt;
        c.fillRect(-30, -6, 60, 16);
        c.strokeStyle = '#cc77a0';
        c.lineWidth = 1;
        c.strokeRect(-30, -6, 60, 16);
        /* Mattress button tufts */
        c.fillStyle = '#cc77a0';
        for (var bm = 0; bm < 5; bm++) {
          c.beginPath();
          c.arc(-22 + bm * 11, 0, 0.9, 0, Math.PI * 2);
          c.fill();
        }
        /* Quilted star blanket folded over the foot */
        var blank = c.createLinearGradient(0, 4, 0, 12);
        blank.addColorStop(0, '#7ab8ff');
        blank.addColorStop(1, '#3a78cc');
        c.fillStyle = blank;
        c.fillRect(-30, 2, 60, 8);
        c.fillStyle = '#aad8ff';
        c.fillRect(-30, 2, 60, 1.2);
        /* Tiny stars on the blanket */
        c.fillStyle = '#ffe98a';
        for (var bs = 0; bs < 6; bs++) {
          var bsx = -25 + bs * 10, bsy = 6;
          c.beginPath();
          c.moveTo(bsx, bsy - 1.6);
          c.lineTo(bsx + 0.5, bsy - 0.5);
          c.lineTo(bsx + 1.6, bsy);
          c.lineTo(bsx + 0.5, bsy + 0.5);
          c.lineTo(bsx, bsy + 1.6);
          c.lineTo(bsx - 0.5, bsy + 0.5);
          c.lineTo(bsx - 1.6, bsy);
          c.lineTo(bsx - 0.5, bsy - 0.5);
          c.closePath();
          c.fill();
        }
        /* Pillows — two with lace edges */
        for (var pi2 = 0; pi2 < 2; pi2++) {
          var pX = pi2 === 0 ? -25 : -10;
          var plg = c.createLinearGradient(0, -10, 0, -2);
          plg.addColorStop(0, '#ffffff');
          plg.addColorStop(1, '#ffd9e8');
          c.fillStyle = plg;
          c.fillRect(pX, -10, 13, 8);
          c.strokeStyle = '#ff8ab0';
          c.lineWidth = 0.6;
          for (var pl = 0; pl < 4; pl++) {
            c.beginPath();
            c.arc(pX + 1.5 + pl * 3.3, -10, 0.9, Math.PI, 0);
            c.stroke();
          }
        }
        /* Tall headboard with heart cutout */
        var hb = c.createLinearGradient(0, -28, 0, -6);
        hb.addColorStop(0, '#a36a3a');
        hb.addColorStop(1, '#7a4a22');
        c.fillStyle = hb;
        c.beginPath();
        c.moveTo(-32, -6);
        c.lineTo(-32, -22);
        c.quadraticCurveTo(-32, -30, -24, -30);
        c.lineTo(24, -30);
        c.quadraticCurveTo(32, -30, 32, -22);
        c.lineTo(32, -6);
        c.closePath();
        c.fill();
        c.strokeStyle = '#5a3418';
        c.lineWidth = 0.8;
        c.stroke();
        /* Heart cutout */
        c.fillStyle = '#2a1458';
        c.beginPath();
        c.arc(-2, -22, 2, 0, Math.PI * 2);
        c.arc(2, -22, 2, 0, Math.PI * 2);
        c.moveTo(-3.6, -21);
        c.lineTo(0, -16);
        c.lineTo(3.6, -21);
        c.closePath();
        c.fill();
        /* Headboard finials */
        c.fillStyle = '#c98a4e';
        c.beginPath(); c.arc(-26, -29, 2.5, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(26, -29, 2.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ff66cc';
        c.beginPath(); c.arc(-26, -32, 1.4, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(26, -32, 1.4, 0, Math.PI * 2); c.fill();
        break;
      }
      case 'table': {
        /* Round bistro table — polished wood with pedestal base */
        /* Cross-base feet */
        c.fillStyle = '#3a2010';
        c.beginPath();
        c.moveTo(-16, 14);
        c.lineTo(16, 14);
        c.lineTo(12, 17);
        c.lineTo(-12, 17);
        c.closePath();
        c.fill();
        /* Pedestal with brass rings */
        var ped = c.createLinearGradient(-3, 0, 3, 0);
        ped.addColorStop(0, '#5a3418');
        ped.addColorStop(0.5, '#a36a3a');
        ped.addColorStop(1, '#5a3418');
        c.fillStyle = ped;
        c.fillRect(-3, -4, 6, 18);
        c.fillStyle = '#ffd24a';
        c.fillRect(-3, 0, 6, 1.5);
        c.fillRect(-3, 9, 6, 1.5);
        /* Tabletop ellipse with rim */
        c.fillStyle = '#3a2010';
        c.beginPath();
        c.ellipse(0, -4, 26, 7, 0, 0, Math.PI * 2);
        c.fill();
        var top = c.createRadialGradient(-4, -8, 2, 0, -6, 24);
        top.addColorStop(0, '#d8a064');
        top.addColorStop(0.6, '#a36a3a');
        top.addColorStop(1, '#7a4818');
        c.fillStyle = top;
        c.beginPath();
        c.ellipse(0, -6, 25, 5.5, 0, 0, Math.PI * 2);
        c.fill();
        /* Wood grain lines */
        c.strokeStyle = 'rgba(60,30,12,0.4)';
        c.lineWidth = 0.4;
        for (var tg = 0; tg < 4; tg++) {
          c.beginPath();
          c.ellipse(0, -6, 18 - tg * 4, 4 - tg, 0, 0, Math.PI * 2);
          c.stroke();
        }
        /* Highlight specular */
        c.save();
        c.globalAlpha = 0.5;
        c.fillStyle = '#ffe9c8';
        c.beginPath();
        c.ellipse(-8, -8, 8, 1.4, -0.3, 0, Math.PI * 2);
        c.fill();
        c.restore();
        /* Tiny vase + flower as a centerpiece */
        c.fillStyle = '#cc88ff';
        c.beginPath();
        c.moveTo(-3, -8);
        c.lineTo(3, -8);
        c.lineTo(2, -14);
        c.lineTo(-2, -14);
        c.closePath();
        c.fill();
        c.fillStyle = '#ff66cc';
        c.beginPath(); c.arc(0, -16, 2.2, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffd24a';
        c.beginPath(); c.arc(0, -16, 0.9, 0, Math.PI * 2); c.fill();
        /* Stem */
        c.strokeStyle = '#44aa55';
        c.lineWidth = 0.6;
        c.beginPath();
        c.moveTo(0, -14); c.lineTo(0, -16);
        c.stroke();
        break;
      }
      case 'chair': {
        /* Plush armchair — high back with button tufts */
        /* Wooden legs (peeking out at the bottom) */
        c.fillStyle = '#3a2010';
        c.fillRect(-12, 10, 3, 6);
        c.fillRect(9, 10, 3, 6);
        c.fillStyle = '#ffd24a';
        c.fillRect(-12, 14, 3, 1);
        c.fillRect(9, 14, 3, 1);
        /* Arms */
        var armG = c.createLinearGradient(0, -2, 0, 8);
        armG.addColorStop(0, '#dd5599');
        armG.addColorStop(1, '#8a2a66');
        c.fillStyle = armG;
        c.beginPath();
        c.moveTo(-15, -4);
        c.quadraticCurveTo(-17, -6, -15, -8);
        c.quadraticCurveTo(-13, -10, -11, -8);
        c.lineTo(-11, 10);
        c.lineTo(-15, 10);
        c.closePath();
        c.fill();
        c.beginPath();
        c.moveTo(15, -4);
        c.quadraticCurveTo(17, -6, 15, -8);
        c.quadraticCurveTo(13, -10, 11, -8);
        c.lineTo(11, 10);
        c.lineTo(15, 10);
        c.closePath();
        c.fill();
        /* High back */
        var backG = c.createLinearGradient(0, -22, 0, 0);
        backG.addColorStop(0, '#ffaacc');
        backG.addColorStop(1, '#cc4488');
        c.fillStyle = backG;
        c.beginPath();
        c.moveTo(-11, 0);
        c.lineTo(-11, -18);
        c.quadraticCurveTo(-11, -24, -5, -24);
        c.lineTo(5, -24);
        c.quadraticCurveTo(11, -24, 11, -18);
        c.lineTo(11, 0);
        c.closePath();
        c.fill();
        /* Highlight stripe down the back */
        c.save();
        c.globalAlpha = 0.5;
        c.fillStyle = '#ffd9e8';
        c.fillRect(-9, -22, 2, 22);
        c.restore();
        /* Button tufts */
        c.fillStyle = '#8a2a66';
        var tufts = [[-5, -16], [5, -16], [0, -10], [-5, -4], [5, -4]];
        for (var tt = 0; tt < tufts.length; tt++) {
          c.beginPath();
          c.arc(tufts[tt][0], tufts[tt][1], 0.9, 0, Math.PI * 2);
          c.fill();
        }
        /* Cushion (seat) — rounded */
        var cuG = c.createLinearGradient(0, -2, 0, 10);
        cuG.addColorStop(0, '#ffe9f4');
        cuG.addColorStop(1, '#f0a8c8');
        c.fillStyle = cuG;
        c.beginPath();
        c.moveTo(-12, 0);
        c.quadraticCurveTo(-14, 4, -10, 8);
        c.lineTo(10, 8);
        c.quadraticCurveTo(14, 4, 12, 0);
        c.closePath();
        c.fill();
        c.strokeStyle = '#cc6688';
        c.lineWidth = 0.6;
        c.stroke();
        /* Piping along the cushion crease */
        c.fillStyle = '#cc6688';
        for (var cp = 0; cp < 4; cp++) {
          c.beginPath();
          c.arc(-7 + cp * 4.6, 4, 0.5, 0, Math.PI * 2);
          c.fill();
        }
        break;
      }
      case 'lamp': {
        /* Floor lamp with fringed pleated shade and warm glow */
        /* Glow halo */
        c.save();
        c.globalAlpha = 0.45;
        var halo = c.createRadialGradient(0, -16, 2, 0, -16, 26);
        halo.addColorStop(0, 'rgba(255,232,140,0.9)');
        halo.addColorStop(1, 'rgba(255,232,140,0)');
        c.fillStyle = halo;
        c.beginPath(); c.arc(0, -16, 26, 0, Math.PI * 2); c.fill();
        c.restore();
        /* Brass base */
        c.fillStyle = '#3a2a14';
        c.fillRect(-8, 12, 16, 4);
        var baseG = c.createLinearGradient(-8, 8, 8, 12);
        baseG.addColorStop(0, '#7a5a22');
        baseG.addColorStop(0.5, '#ffd24a');
        baseG.addColorStop(1, '#7a5a22');
        c.fillStyle = baseG;
        c.beginPath();
        c.ellipse(0, 12, 8, 3, 0, 0, Math.PI * 2);
        c.fill();
        /* Pole */
        var poleG = c.createLinearGradient(-2, 0, 2, 0);
        poleG.addColorStop(0, '#5a4218');
        poleG.addColorStop(0.5, '#c89a3a');
        poleG.addColorStop(1, '#5a4218');
        c.fillStyle = poleG;
        c.fillRect(-1, -8, 2, 22);
        /* Decorative knob midway */
        c.fillStyle = '#ffd24a';
        c.beginPath(); c.arc(0, 2, 1.6, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#7a5a22';
        c.beginPath(); c.arc(0, 2, 0.7, 0, Math.PI * 2); c.fill();
        /* Pleated shade — drawn as a polygon with vertical fold lines */
        var sh = c.createLinearGradient(0, -22, 0, -8);
        sh.addColorStop(0, '#fff2a0');
        sh.addColorStop(1, '#d8a040');
        c.fillStyle = sh;
        c.beginPath();
        c.moveTo(-8, -22);
        c.lineTo(8, -22);
        c.lineTo(13, -8);
        c.lineTo(-13, -8);
        c.closePath();
        c.fill();
        c.strokeStyle = '#a86820';
        c.lineWidth = 0.5;
        for (var pf = 0; pf < 6; pf++) {
          var px2 = -10 + pf * 4;
          c.beginPath();
          c.moveTo(px2, -22 + Math.abs(pf - 2.5) * 0.5);
          c.lineTo(px2 + (px2 < 0 ? -2 : 2) * 0.5, -8);
          c.stroke();
        }
        /* Top trim band */
        c.fillStyle = '#a86820';
        c.fillRect(-8, -23, 16, 1.5);
        /* Bottom fringe */
        c.fillStyle = '#ffd24a';
        for (var fr = 0; fr < 7; fr++) {
          var frx = -13 + fr * 4.4;
          c.beginPath();
          c.moveTo(frx, -8);
          c.lineTo(frx + 1.5, -5);
          c.lineTo(frx + 3, -8);
          c.closePath();
          c.fill();
        }
        /* Glowing bulb tip */
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(0, -10, 1.4, 0, Math.PI * 2); c.fill();
        break;
      }
      case 'rug': {
        /* Persian-style oval rug with medallion */
        /* Outer dark border */
        c.fillStyle = '#3a1840';
        c.beginPath();
        c.ellipse(0, 0, 32, 11, 0, 0, Math.PI * 2);
        c.fill();
        /* Main field */
        var rugG = c.createRadialGradient(0, 0, 2, 0, 0, 30);
        rugG.addColorStop(0, '#cc4466');
        rugG.addColorStop(0.7, '#882244');
        rugG.addColorStop(1, '#5a1830');
        c.fillStyle = rugG;
        c.beginPath();
        c.ellipse(0, 0, 29, 9.5, 0, 0, Math.PI * 2);
        c.fill();
        /* Inner border line */
        c.strokeStyle = '#ffd24a';
        c.lineWidth = 0.8;
        c.beginPath();
        c.ellipse(0, 0, 27, 8.6, 0, 0, Math.PI * 2);
        c.stroke();
        c.beginPath();
        c.ellipse(0, 0, 25, 7.6, 0, 0, Math.PI * 2);
        c.stroke();
        /* Central medallion */
        c.fillStyle = '#3a1840';
        c.beginPath();
        c.ellipse(0, 0, 12, 4, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#ffd24a';
        c.beginPath();
        c.ellipse(0, 0, 9, 2.8, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#cc4466';
        c.beginPath();
        c.ellipse(0, 0, 4, 1.4, 0, 0, Math.PI * 2);
        c.fill();
        /* Diamond motifs at the cardinal points */
        c.fillStyle = '#44ccff';
        var diamonds = [[-21, 0], [21, 0], [0, -6.5], [0, 6.5]];
        for (var dm = 0; dm < diamonds.length; dm++) {
          var dxr = diamonds[dm][0], dyr = diamonds[dm][1];
          c.beginPath();
          c.moveTo(dxr, dyr - 1.6);
          c.lineTo(dxr + 1.6, dyr);
          c.lineTo(dxr, dyr + 1.6);
          c.lineTo(dxr - 1.6, dyr);
          c.closePath();
          c.fill();
        }
        /* Corner flourishes */
        c.fillStyle = '#ff99cc';
        var flourish = [[-15, -4], [15, -4], [-15, 4], [15, 4]];
        for (var ff = 0; ff < flourish.length; ff++) {
          c.beginPath();
          c.arc(flourish[ff][0], flourish[ff][1], 1.2, 0, Math.PI * 2);
          c.fill();
        }
        /* End tassels */
        c.strokeStyle = '#ffe9c8';
        c.lineWidth = 0.5;
        for (var ts = 0; ts < 9; ts++) {
          var tsy2 = -4 + ts * 1;
          c.beginPath();
          c.moveTo(-32, tsy2);
          c.lineTo(-35, tsy2);
          c.stroke();
          c.beginPath();
          c.moveTo(32, tsy2);
          c.lineTo(35, tsy2);
          c.stroke();
        }
        break;
      }
      case 'plant': {
        /* Potted monstera with glossy leaves and decorated terracotta pot */
        /* Pot body — terracotta with painted band */
        var potG = c.createLinearGradient(0, 4, 0, 18);
        potG.addColorStop(0, '#d88848');
        potG.addColorStop(1, '#7a3a18');
        c.fillStyle = potG;
        c.beginPath();
        c.moveTo(-9, 4);
        c.lineTo(9, 4);
        c.lineTo(7, 18);
        c.lineTo(-7, 18);
        c.closePath();
        c.fill();
        /* Pot rim */
        c.fillStyle = '#f0a868';
        c.fillRect(-10, 2, 20, 3);
        c.fillStyle = '#5a2810';
        c.fillRect(-10, 5, 20, 0.6);
        /* Painted geo-pattern band */
        c.fillStyle = '#ffe9c8';
        c.fillRect(-8, 9, 16, 3);
        c.fillStyle = '#7a3a18';
        for (var pp2 = 0; pp2 < 4; pp2++) {
          c.beginPath();
          c.moveTo(-7 + pp2 * 4, 9);
          c.lineTo(-5 + pp2 * 4, 12);
          c.lineTo(-3 + pp2 * 4, 9);
          c.closePath();
          c.fill();
        }
        /* Soil */
        c.fillStyle = '#3a2010';
        c.beginPath();
        c.ellipse(0, 4, 9, 1.6, 0, 0, Math.PI * 2);
        c.fill();
        /* Leaf drawing helper — split monstera-style */
        function leaf(cx2, cy2, w, h, rot, light, dark, slits) {
          c.save();
          c.translate(cx2, cy2);
          c.rotate(rot);
          var lg = c.createLinearGradient(0, -h, 0, h);
          lg.addColorStop(0, light);
          lg.addColorStop(1, dark);
          c.fillStyle = lg;
          c.beginPath();
          c.moveTo(0, h);
          c.bezierCurveTo(-w, h * 0.4, -w, -h * 0.6, 0, -h);
          c.bezierCurveTo(w, -h * 0.6, w, h * 0.4, 0, h);
          c.closePath();
          c.fill();
          /* Center vein */
          c.strokeStyle = dark;
          c.lineWidth = 0.6;
          c.beginPath();
          c.moveTo(0, h);
          c.lineTo(0, -h);
          c.stroke();
          /* Side veins / monstera slits */
          for (var ll = 0; ll < slits; ll++) {
            var ly = -h * 0.7 + (ll / (slits - 1)) * h * 1.4;
            c.lineWidth = 0.4;
            c.beginPath();
            c.moveTo(0, ly);
            c.lineTo(w * 0.7, ly + h * 0.1);
            c.stroke();
            c.beginPath();
            c.moveTo(0, ly);
            c.lineTo(-w * 0.7, ly + h * 0.1);
            c.stroke();
          }
          c.restore();
        }
        leaf(-7, -2, 6, 10, -0.5, '#7ad06a', '#1f5a28', 4);
        leaf(7, -3, 6, 11, 0.5, '#7ad06a', '#1f5a28', 4);
        leaf(-3, -10, 5, 12, -0.15, '#a8e088', '#2a6a30', 4);
        leaf(3, -12, 5, 11, 0.15, '#a8e088', '#2a6a30', 4);
        leaf(0, -16, 4, 9, 0, '#c8f098', '#2a6a30', 3);
        /* Highlight glints on a couple of leaves */
        c.save();
        c.globalAlpha = 0.5;
        c.fillStyle = '#fff';
        c.beginPath(); c.arc(-7, -4, 0.9, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(5, -10, 0.7, 0, Math.PI * 2); c.fill();
        c.restore();
        break;
      }
      case 'painting': {
        /* Ornate gilt-framed cosmic landscape */
        /* Outer dark frame edge */
        c.fillStyle = '#3a2a14';
        c.fillRect(-19, -17, 38, 34);
        /* Gilt frame with gradient */
        var frG = c.createLinearGradient(-18, -16, 18, 16);
        frG.addColorStop(0, '#ffe9a8');
        frG.addColorStop(0.5, '#c89a3a');
        frG.addColorStop(1, '#7a5a22');
        c.fillStyle = frG;
        c.fillRect(-18, -16, 36, 32);
        /* Inner mat */
        c.fillStyle = '#1a0a2a';
        c.fillRect(-15, -13, 30, 26);
        /* Painted scene — dusk sky gradient */
        var sky = c.createLinearGradient(0, -12, 0, 12);
        sky.addColorStop(0, '#4a1858');
        sky.addColorStop(0.6, '#cc5577');
        sky.addColorStop(1, '#ffaa66');
        c.fillStyle = sky;
        c.fillRect(-14, -12, 28, 24);
        /* Distant ringed planet */
        c.fillStyle = '#ffd24a';
        c.beginPath();
        c.arc(-5, -6, 4, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#ffe9c8';
        c.lineWidth = 0.8;
        c.beginPath();
        c.ellipse(-5, -6, 7, 2, -0.3, 0, Math.PI * 2);
        c.stroke();
        /* Tiny moon */
        c.fillStyle = '#ffe9c8';
        c.beginPath();
        c.arc(7, -8, 1.6, 0, Math.PI * 2);
        c.fill();
        /* Stars */
        c.fillStyle = '#ffffff';
        var stars = [[-10, -10], [10, -4], [-8, -2], [4, -10], [-2, -9]];
        for (var st = 0; st < stars.length; st++) {
          c.beginPath();
          c.arc(stars[st][0], stars[st][1], 0.6, 0, Math.PI * 2);
          c.fill();
        }
        /* Foreground mountains */
        c.fillStyle = '#1a0a2a';
        c.beginPath();
        c.moveTo(-14, 12);
        c.lineTo(-10, 4);
        c.lineTo(-5, 9);
        c.lineTo(0, 2);
        c.lineTo(6, 7);
        c.lineTo(11, 3);
        c.lineTo(14, 12);
        c.closePath();
        c.fill();
        /* Frame corner ornaments */
        c.fillStyle = '#ffe9a8';
        var corners = [[-18, -16], [18, -16], [-18, 16], [18, 16]];
        for (var co = 0; co < corners.length; co++) {
          c.beginPath();
          c.arc(corners[co][0], corners[co][1], 2.4, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = '#7a5a22';
        for (var co2 = 0; co2 < corners.length; co2++) {
          c.beginPath();
          c.arc(corners[co2][0], corners[co2][1], 1.1, 0, Math.PI * 2);
          c.fill();
        }
        /* Hanging hook & wire */
        c.strokeStyle = '#5a4218';
        c.lineWidth = 0.5;
        c.beginPath();
        c.moveTo(-10, -18);
        c.quadraticCurveTo(0, -22, 10, -18);
        c.stroke();
        c.fillStyle = '#3a2a14';
        c.beginPath();
        c.arc(0, -21, 1.2, 0, Math.PI * 2);
        c.fill();
        break;
      }
      case 'bookshelf': {
        /* Carved bookshelf with varied books, plant, drawer */
        /* Outer carved frame */
        var bsG = c.createLinearGradient(-18, 0, 18, 0);
        bsG.addColorStop(0, '#3a2010');
        bsG.addColorStop(0.5, '#7a4a22');
        bsG.addColorStop(1, '#3a2010');
        c.fillStyle = bsG;
        c.fillRect(-18, -26, 36, 50);
        /* Crown molding */
        c.fillStyle = '#a36a3a';
        c.fillRect(-19, -28, 38, 4);
        c.fillStyle = '#5a3418';
        c.fillRect(-19, -25, 38, 1);
        /* Decorative pediment */
        c.fillStyle = '#a36a3a';
        c.beginPath();
        c.moveTo(-14, -28);
        c.lineTo(0, -32);
        c.lineTo(14, -28);
        c.closePath();
        c.fill();
        c.fillStyle = '#ffd24a';
        c.beginPath(); c.arc(0, -30, 1.4, 0, Math.PI * 2); c.fill();
        /* Inset back panel */
        c.fillStyle = '#2a1408';
        c.fillRect(-15, -23, 30, 38);
        /* Shelf horizontals */
        c.fillStyle = '#5a3418';
        c.fillRect(-15, -10, 30, 1.5);
        c.fillRect(-15, 4, 30, 1.5);
        /* --- TOP SHELF: tall books, leaning */
        var topBooks = [
          {x: -13, w: 4, h: 12, c: '#cc4466', t: '#ffd24a'},
          {x: -8.5, w: 3, h: 11, c: '#4488cc', t: '#ffe9c8'},
          {x: -4.5, w: 4, h: 12, c: '#44aa66', t: '#ffd24a'},
          {x: 0, w: 3, h: 10, c: '#ffd24a', t: '#cc4466'},
          {x: 3.5, w: 3.5, h: 11, c: '#cc88ff', t: '#fff'},
          {x: 7.5, w: 4, h: 12, c: '#ff7733', t: '#ffe9c8'},
        ];
        for (var tb = 0; tb < topBooks.length; tb++) {
          var bk = topBooks[tb];
          var bkg = c.createLinearGradient(bk.x, 0, bk.x + bk.w, 0);
          bkg.addColorStop(0, bk.c);
          bkg.addColorStop(0.5, bk.t);
          bkg.addColorStop(1, bk.c);
          c.fillStyle = bk.c;
          c.fillRect(bk.x, -10 - bk.h, bk.w, bk.h);
          c.fillStyle = bk.t;
          c.fillRect(bk.x, -10 - bk.h, bk.w, 1);
          c.fillRect(bk.x, -12, bk.w, 0.6);
          /* Tiny title band */
          c.fillStyle = bk.t;
          c.fillRect(bk.x + 0.6, -10 - bk.h * 0.6, bk.w - 1.2, 0.6);
        }
        /* Leaning book */
        c.save();
        c.translate(12, -10);
        c.rotate(-0.3);
        c.fillStyle = '#44ccff';
        c.fillRect(0, -8, 3, 8);
        c.fillStyle = '#ffd24a';
        c.fillRect(0, -8, 3, 0.6);
        c.restore();
        /* --- MIDDLE SHELF: shorter books + a tiny plant */
        var midBooks = [
          {x: -13, w: 3, h: 9, c: '#6a3aaa'},
          {x: -9.5, w: 4, h: 8, c: '#aa4466'},
          {x: -5, w: 3, h: 9, c: '#22aa88'},
          {x: -1.5, w: 3, h: 8, c: '#ddaa44'},
        ];
        for (var mb = 0; mb < midBooks.length; mb++) {
          var mbk = midBooks[mb];
          c.fillStyle = mbk.c;
          c.fillRect(mbk.x, 4 - mbk.h, mbk.w, mbk.h);
          c.fillStyle = '#ffd24a';
          c.fillRect(mbk.x, 4 - mbk.h, mbk.w, 0.5);
        }
        /* Small plant on the middle shelf */
        c.fillStyle = '#a36a3a';
        c.fillRect(4, -2, 5, 5);
        c.fillStyle = '#44aa66';
        c.beginPath();
        c.arc(4, -3, 2.2, 0, Math.PI * 2);
        c.arc(7.5, -4, 2.2, 0, Math.PI * 2);
        c.arc(10, -2, 2.2, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#ff66cc';
        c.beginPath();
        c.arc(7.5, -5, 0.9, 0, Math.PI * 2);
        c.fill();
        /* Tiny clock */
        c.fillStyle = '#ffd24a';
        c.beginPath();
        c.arc(11, 2, 1.6, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#3a2010';
        c.lineWidth = 0.4;
        c.beginPath(); c.moveTo(11, 2); c.lineTo(11, 0.8);
        c.moveTo(11, 2); c.lineTo(12, 2);
        c.stroke();
        /* --- DRAWER at the bottom */
        var dwG = c.createLinearGradient(0, 6, 0, 24);
        dwG.addColorStop(0, '#a36a3a');
        dwG.addColorStop(1, '#5a3418');
        c.fillStyle = dwG;
        c.fillRect(-15, 6, 30, 12);
        c.strokeStyle = '#3a2010';
        c.lineWidth = 0.6;
        c.strokeRect(-15, 6, 30, 12);
        /* Drawer dividers */
        c.beginPath();
        c.moveTo(0, 6); c.lineTo(0, 18);
        c.stroke();
        /* Brass knobs */
        c.fillStyle = '#ffd24a';
        c.beginPath(); c.arc(-7.5, 12, 1.4, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(7.5, 12, 1.4, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#7a5a22';
        c.beginPath(); c.arc(-7.5, 12, 0.6, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(7.5, 12, 0.6, 0, Math.PI * 2); c.fill();
        /* Bottom feet */
        c.fillStyle = '#3a2010';
        c.fillRect(-18, 22, 5, 4);
        c.fillRect(13, 22, 5, 4);
        /* Side carving accents */
        c.fillStyle = '#a36a3a';
        c.fillRect(-18, -22, 1.5, 32);
        c.fillRect(16.5, -22, 1.5, 32);
        break;
      }
      case 'sofa': {
        /* Three-cushion velvet sofa */
        c.fillStyle = '#3a2010';
        c.fillRect(-26, 12, 4, 6);
        c.fillRect(22, 12, 4, 6);
        var sofaBack = c.createLinearGradient(0, -16, 0, 4);
        sofaBack.addColorStop(0, '#cc4488');
        sofaBack.addColorStop(1, '#7a2454');
        c.fillStyle = sofaBack;
        c.beginPath();
        c.moveTo(-30, -2);
        c.quadraticCurveTo(-30, -16, -22, -16);
        c.lineTo(22, -16);
        c.quadraticCurveTo(30, -16, 30, -2);
        c.lineTo(30, 12);
        c.lineTo(-30, 12);
        c.closePath();
        c.fill();
        /* Three seat cushions */
        var cs = c.createLinearGradient(0, -2, 0, 12);
        cs.addColorStop(0, '#ff99cc');
        cs.addColorStop(1, '#cc4488');
        c.fillStyle = cs;
        for (var sc = 0; sc < 3; sc++) {
          c.fillRect(-26 + sc * 18, -2, 17, 14);
          c.strokeStyle = '#7a2454';
          c.lineWidth = 0.6;
          c.strokeRect(-26 + sc * 18, -2, 17, 14);
        }
        /* Pillows */
        c.fillStyle = '#ffe9c8';
        c.fillRect(-22, -10, 6, 6);
        c.fillStyle = '#88ddff';
        c.fillRect(16, -10, 6, 6);
        /* Tufts on the back */
        c.fillStyle = '#5a1a3a';
        for (var sft = 0; sft < 5; sft++) {
          c.beginPath();
          c.arc(-18 + sft * 9, -10, 0.7, 0, Math.PI * 2);
          c.fill();
        }
        break;
      }
      case 'stool': {
        /* Round padded stool with brass legs */
        c.fillStyle = '#ffd24a';
        c.fillRect(-9, 6, 2, 10);
        c.fillRect(7, 6, 2, 10);
        c.fillStyle = '#a86820';
        c.fillRect(-9, 14, 2, 2);
        c.fillRect(7, 14, 2, 2);
        var sto = c.createRadialGradient(0, 2, 2, 0, 4, 14);
        sto.addColorStop(0, '#ee99dd');
        sto.addColorStop(1, '#aa3a88');
        c.fillStyle = sto;
        c.beginPath();
        c.ellipse(0, 4, 12, 5, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#552266';
        c.beginPath(); c.arc(0, 4, 0.9, 0, Math.PI * 2); c.fill();
        break;
      }
      case 'coffeeTable': {
        /* Low rectangular coffee table with magazine + mug */
        c.fillStyle = '#3a2010';
        c.fillRect(-20, 10, 4, 6);
        c.fillRect(16, 10, 4, 6);
        var ctop = c.createLinearGradient(0, -2, 0, 10);
        ctop.addColorStop(0, '#d8a064');
        ctop.addColorStop(1, '#7a4818');
        c.fillStyle = ctop;
        c.fillRect(-22, -2, 44, 12);
        c.fillStyle = '#5a2a14';
        c.fillRect(-22, -2, 44, 1.5);
        /* Magazine */
        c.fillStyle = '#88ddff';
        c.fillRect(-14, 0, 14, 8);
        c.fillStyle = '#ff66cc';
        c.fillRect(-13, 1, 6, 1);
        c.fillRect(-13, 3, 8, 1);
        /* Mug */
        c.fillStyle = '#ffd24a';
        c.fillRect(4, 1, 6, 6);
        c.strokeStyle = '#ffd24a';
        c.lineWidth = 1;
        c.beginPath(); c.arc(11, 4, 2, -Math.PI / 2, Math.PI / 2); c.stroke();
        break;
      }
      case 'desk': {
        /* Writing desk with drawer + lamp + book */
        c.fillStyle = '#3a2010';
        c.fillRect(-22, -4, 44, 6);
        c.fillRect(-22, 2, 6, 18);
        c.fillRect(16, 2, 6, 18);
        /* Drawer */
        c.fillStyle = '#a36a3a';
        c.fillRect(-15, 4, 30, 8);
        c.strokeStyle = '#3a2010';
        c.lineWidth = 0.6;
        c.strokeRect(-15, 4, 30, 8);
        c.fillStyle = '#ffd24a';
        c.beginPath(); c.arc(0, 8, 1.4, 0, Math.PI * 2); c.fill();
        /* Desk top highlight */
        c.fillStyle = '#d8a064';
        c.fillRect(-22, -4, 44, 1.4);
        /* Tiny task lamp */
        c.strokeStyle = '#ddddee';
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(-12, -4);
        c.lineTo(-12, -10);
        c.lineTo(-7, -12);
        c.stroke();
        c.fillStyle = '#ffd24a';
        c.beginPath();
        c.moveTo(-9, -10);
        c.lineTo(-3, -10);
        c.lineTo(-5, -7);
        c.lineTo(-7, -7);
        c.closePath();
        c.fill();
        /* Stack of books */
        c.fillStyle = '#cc4466';
        c.fillRect(6, -8, 10, 2);
        c.fillStyle = '#44aa66';
        c.fillRect(7, -10, 9, 2);
        c.fillStyle = '#4488cc';
        c.fillRect(6, -12, 10, 2);
        break;
      }
      case 'ceilingLight': {
        /* Pendant chandelier — small but ornate */
        c.strokeStyle = '#3a1a2a';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(0, -22);
        c.lineTo(0, -12);
        c.stroke();
        c.fillStyle = '#ffd24a';
        c.beginPath();
        c.moveTo(-10, -12);
        c.lineTo(10, -12);
        c.lineTo(7, -2);
        c.lineTo(-7, -2);
        c.closePath();
        c.fill();
        c.fillStyle = '#ffe9a8';
        c.beginPath(); c.arc(0, -2, 2.6, 0, Math.PI * 2); c.fill();
        /* Glow */
        c.save();
        c.globalAlpha = 0.4;
        var ceilG = c.createRadialGradient(0, -2, 2, 0, -2, 24);
        ceilG.addColorStop(0, '#ffe98a');
        ceilG.addColorStop(1, 'rgba(255,232,140,0)');
        c.fillStyle = ceilG;
        c.beginPath(); c.arc(0, -2, 24, 0, Math.PI * 2); c.fill();
        c.restore();
        /* Drop crystals */
        c.fillStyle = '#cdeaf4';
        c.beginPath(); c.arc(-6, 1, 1, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(0, 3, 1.2, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(6, 1, 1, 0, Math.PI * 2); c.fill();
        break;
      }
      case 'candle': {
        /* Three pillar candles in a brass tray */
        c.fillStyle = '#3a2014';
        c.beginPath();
        c.ellipse(0, 14, 16, 3, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#ffd24a';
        c.fillRect(-14, 12, 28, 2);
        var heights = [-6, -10, -4];
        var cposx = [-9, 0, 9];
        for (var ca = 0; ca < 3; ca++) {
          c.fillStyle = '#ffe9c8';
          c.fillRect(cposx[ca] - 2, heights[ca], 4, 12 - heights[ca]);
          c.fillStyle = '#cc8855';
          c.fillRect(cposx[ca] - 2, heights[ca], 4, 1.4);
          c.strokeStyle = '#3a2010';
          c.lineWidth = 0.5;
          c.beginPath();
          c.moveTo(cposx[ca], heights[ca] - 1);
          c.lineTo(cposx[ca], heights[ca] - 4);
          c.stroke();
          c.fillStyle = '#ffaa44';
          c.beginPath();
          c.ellipse(cposx[ca], heights[ca] - 5, 1.2, 2.4, 0, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = '#ffe98a';
          c.beginPath();
          c.ellipse(cposx[ca], heights[ca] - 5, 0.6, 1.6, 0, 0, Math.PI * 2);
          c.fill();
        }
        break;
      }
      case 'mirror': {
        /* Tall ornate oval mirror */
        c.fillStyle = '#3a2a14';
        c.beginPath();
        c.ellipse(0, 0, 14, 22, 0, 0, Math.PI * 2);
        c.fill();
        var mirG = c.createLinearGradient(-12, -20, 12, 20);
        mirG.addColorStop(0, '#ffe9a8');
        mirG.addColorStop(0.5, '#c89a3a');
        mirG.addColorStop(1, '#7a5a22');
        c.fillStyle = mirG;
        c.beginPath();
        c.ellipse(0, 0, 13, 20, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#cdeaf4';
        c.beginPath();
        c.ellipse(0, 0, 10, 17, 0, 0, Math.PI * 2);
        c.fill();
        /* Reflection sheen */
        c.save();
        c.globalAlpha = 0.5;
        c.fillStyle = '#fff';
        c.beginPath();
        c.ellipse(-3, -8, 3, 8, -0.3, 0, Math.PI * 2);
        c.fill();
        c.restore();
        /* Top crown ornament */
        c.fillStyle = '#ffd24a';
        c.beginPath(); c.arc(0, -22, 2, 0, Math.PI * 2); c.fill();
        break;
      }
      case 'flowers': {
        /* Bouquet vase with mixed wildflowers */
        c.fillStyle = '#cdeaf4';
        c.beginPath();
        c.moveTo(-7, 6);
        c.lineTo(7, 6);
        c.lineTo(5, 18);
        c.lineTo(-5, 18);
        c.closePath();
        c.fill();
        c.fillStyle = '#88ccdd';
        c.fillRect(-7, 6, 14, 1.4);
        /* Stems */
        c.strokeStyle = '#3a8a3a';
        c.lineWidth = 0.6;
        for (var ss = 0; ss < 5; ss++) {
          c.beginPath();
          c.moveTo(-4 + ss * 2, 6);
          c.lineTo(-4 + ss * 2 + (ss - 2) * 0.6, -6 - ss * 0.5);
          c.stroke();
        }
        /* Flower heads */
        var flCol = ['#ff66cc', '#ffd24a', '#cc88ff', '#ff8866', '#88ddff'];
        var flY = [-8, -10, -7, -11, -9];
        for (var flI = 0; flI < 5; flI++) {
          c.fillStyle = flCol[flI];
          c.beginPath();
          c.arc(-4 + flI * 2 + (flI - 2) * 0.6, flY[flI], 2.2, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = '#ffd24a';
          c.beginPath();
          c.arc(-4 + flI * 2 + (flI - 2) * 0.6, flY[flI], 0.7, 0, Math.PI * 2);
          c.fill();
        }
        /* Leaves */
        c.fillStyle = '#3a8a3a';
        c.beginPath();
        c.ellipse(-3, 2, 3, 1.2, 0.4, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.ellipse(3, 2, 3, 1.2, -0.4, 0, Math.PI * 2);
        c.fill();
        break;
      }
      case 'tv': {
        /* Retro tube TV on a wooden stand */
        c.fillStyle = '#3a2010';
        c.fillRect(-20, 10, 40, 8);
        c.fillStyle = '#5a3418';
        c.fillRect(-20, 10, 40, 1.4);
        c.fillStyle = '#3a2010';
        c.fillRect(-16, 18, 4, 6);
        c.fillRect(12, 18, 4, 6);
        /* TV body */
        c.fillStyle = '#3a3a4a';
        c.fillRect(-18, -16, 36, 26);
        /* Screen */
        var scr = c.createLinearGradient(-14, -12, 14, 6);
        scr.addColorStop(0, '#88aaff');
        scr.addColorStop(0.5, '#cdeaf4');
        scr.addColorStop(1, '#3a4488');
        c.fillStyle = scr;
        c.fillRect(-14, -12, 28, 18);
        /* Static / scan lines */
        c.strokeStyle = 'rgba(255,255,255,0.18)';
        c.lineWidth = 0.4;
        for (var sl = 0; sl < 4; sl++) {
          c.beginPath();
          c.moveTo(-14, -10 + sl * 4);
          c.lineTo(14, -10 + sl * 4);
          c.stroke();
        }
        /* Heart on the screen */
        c.fillStyle = '#ff66cc';
        c.beginPath();
        c.arc(-2, -3, 1.4, 0, Math.PI * 2);
        c.arc(2, -3, 1.4, 0, Math.PI * 2);
        c.moveTo(-3.4, -2);
        c.lineTo(0, 1.2);
        c.lineTo(3.4, -2);
        c.closePath();
        c.fill();
        /* Knobs and antenna */
        c.fillStyle = '#7a8896';
        c.beginPath(); c.arc(-15, 2, 1.4, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(-15, 6, 1.4, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#7a8896';
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(-6, -16); c.lineTo(-12, -22);
        c.moveTo(6, -16); c.lineTo(12, -22);
        c.stroke();
        c.fillStyle = '#ff66cc';
        c.beginPath(); c.arc(-12, -22, 0.9, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(12, -22, 0.9, 0, Math.PI * 2); c.fill();
        break;
      }
      case 'dresser': {
        /* Mid-century three-drawer dresser with mirror */
        var drG = c.createLinearGradient(-22, 0, 22, 0);
        drG.addColorStop(0, '#5a3418');
        drG.addColorStop(0.5, '#a36a3a');
        drG.addColorStop(1, '#5a3418');
        c.fillStyle = drG;
        c.fillRect(-22, -10, 44, 30);
        /* Top edge highlight */
        c.fillStyle = '#d8a064';
        c.fillRect(-22, -10, 44, 1.6);
        /* Three drawers */
        c.strokeStyle = '#3a2010';
        c.lineWidth = 0.8;
        for (var dr = 0; dr < 3; dr++) {
          c.strokeRect(-20, -7 + dr * 9, 40, 8);
          c.fillStyle = '#ffd24a';
          c.beginPath(); c.arc(-8, -3 + dr * 9, 1.2, 0, Math.PI * 2); c.fill();
          c.beginPath(); c.arc(8, -3 + dr * 9, 1.2, 0, Math.PI * 2); c.fill();
        }
        /* Vanity items on top */
        c.fillStyle = '#ff99cc';
        c.fillRect(-12, -14, 6, 4);
        c.fillStyle = '#cc88ff';
        c.beginPath(); c.arc(2, -12, 2.4, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffd24a';
        c.beginPath(); c.arc(2, -13, 0.8, 0, Math.PI * 2); c.fill();
        /* Feet */
        c.fillStyle = '#3a2010';
        c.fillRect(-22, 20, 4, 4);
        c.fillRect(18, 20, 4, 4);
        break;
      }
    }
    c.restore();
  }

  function handleHouseInteriorClick(mx, my, houseId) {
    /* One-shot top-right EXIT button */
    if (hitExitButton(mx, my)) {
      Game.audio.play('select');
      selectedFurniture = null;
      return 'exit';
    }
    /* Exit door */
    if (hitButton(mx, my, W - 92, H - 152, 80, 122)) {
      Game.audio.play('select');
      selectedFurniture = null;
      return 'exit';
    }
    /* Clear button — wipes all furniture for this house in one shot */
    var clearW = 84, clearH = 22, clearX = W - clearW - 10, clearY = 54;
    if (hitButton(mx, my, clearX, clearY, clearW, clearH)) {
      var st0 = loadFurnitureState();
      st0[houseId] = [];
      saveFurnitureState(st0);
      selectedFurniture = null;
      Game.audio.play('select');
      return null;
    }
    /* Category tabs */
    var catTabW = Math.min(86, Math.floor((W - 20) / FURNITURE_CATEGORIES.length));
    for (var ci = 0; ci < FURNITURE_CATEGORIES.length; ci++) {
      var cx = 10 + ci * catTabW;
      var cy = 72;
      if (hitButton(mx, my, cx, cy, catTabW - 4, 26)) {
        selectedCategory = ci;
        selectedFurniture = null;
        Game.audio.play('select');
        return null;
      }
    }
    /* Item palette clicks (selected category only) */
    var palItems = FURNITURE_CATEGORIES[selectedCategory].items;
    for (var fi = 0; fi < palItems.length; fi++) {
      var fx = 20 + fi * 78;
      var fy = 108;
      if (hitButton(mx, my, fx, fy, 68, 76)) {
        selectedFurniture = palItems[fi];
        Game.audio.play('pickup');
        return null;
      }
    }
    /* Place or remove furniture on the floor area */
    if (my > HOUSE_FLOOR_TOP && my < HOUSE_FLOOR_BOTTOM) {
      var state = loadFurnitureState();
      if (!state[houseId]) state[houseId] = [];
      /* Click on existing item → remove (radius scales with the new size) */
      for (var ei = state[houseId].length - 1; ei >= 0; ei--) {
        var it = state[houseId][ei];
        var d = Math.sqrt((mx - it.x) * (mx - it.x) + (my - it.y) * (my - it.y));
        if (d < 36) {
          state[houseId].splice(ei, 1);
          saveFurnitureState(state);
          Game.audio.play('pickup');
          return null;
        }
      }
      /* Place if furniture selected */
      if (selectedFurniture && mx < HOUSE_FLOOR_RIGHT) {
        state[houseId].push({ type: selectedFurniture, x: mx, y: my });
        saveFurnitureState(state);
        Game.audio.play('pickup');
      }
    }
    return null;
  }

  function updateHouseInterior(keys, jp, houseId) {
    /* Walk Momoko around the room with arrow keys / D-pad. */
    var pp = getHousePlayerPos(houseId);
    var sp = 2.4;
    var moved = false;
    if (keys.left)  { pp.x -= sp; housePlayerFacing = -1; moved = true; }
    if (keys.right) { pp.x += sp; housePlayerFacing = 1;  moved = true; }
    if (keys.up)    { pp.y -= sp; moved = true; }
    if (keys.down)  { pp.y += sp; moved = true; }
    if (pp.x < HOUSE_FLOOR_LEFT)  pp.x = HOUSE_FLOOR_LEFT;
    if (pp.x > HOUSE_FLOOR_RIGHT) pp.x = HOUSE_FLOOR_RIGHT;
    if (pp.y < HOUSE_FLOOR_TOP)   pp.y = HOUSE_FLOOR_TOP;
    if (pp.y > HOUSE_FLOOR_BOTTOM) pp.y = HOUSE_FLOOR_BOTTOM;
    if (moved) housePlayerFrame = (housePlayerFrame + 1) % 24;
  }

  /* ============================================================ */
  /*                  COSMIC CAFÉ — comfy cutscene                  */
  /* ============================================================ */
  /* Cozy cafe interior with warm lighting, a barista, patrons sipping
     drinks, drifting steam and floating hearts. Momoko walks in and sits
     at a table with her dog. Press the action button or tap the door to
     leave. */
  var cafeTimer = 0;
  var cafePlayerX = 130;
  var cafePlayerY = H - 80;
  var cafeFacing = 1;
  var cafeFrame = 0;
  var cafeHearts = [];

  /* Buyable items on the cafe counter. Buying an item swaps the held-food
     slot in Game.customization so the snack appears in Momoko's hand once
     she leaves the cafe. Positions are tuned to sit on top of the counter
     band (y ≈ 158) within the rendered counter (x ≈ 40..560). */
  var CAFE_MENU = [
    { food: 'iceCream',   labelKey: 'varIceCream',   x: 80,  y: 152 },
    { food: 'donut',      labelKey: 'varDonut',      x: 180, y: 152 },
    { food: 'macaron',    labelKey: 'varMacaron',    x: 280, y: 152 },
    { food: 'crepe',      labelKey: 'varCrepe',      x: 380, y: 152 },
    { food: 'parfait',    labelKey: 'varParfait',    x: 480, y: 152 },
    { food: 'taiyaki',    labelKey: 'varTaiyaki',    x: 80,  y: 248 },
    { food: 'onigiri',    labelKey: 'varOnigiri',    x: 180, y: 248 },
    { food: 'strawberry', labelKey: 'varStrawberry', x: 280, y: 248 },
  ];
  /* Index of the menu item Momoko is currently close enough to buy with
     the action button (-1 = none). Recomputed each frame from her
     position. */
  var cafeNearMenuIdx = -1;
  /* Brief feedback bubble — "Yum!" text shown after a purchase. */
  var cafeYumTimer = 0;
  var cafeYumX = 0;
  var cafeYumY = 0;

  function startCafeCutscene() {
    cafeTimer = 0;
    cafePlayerX = 130;
    cafePlayerY = H - 80;
    cafeFacing = 1;
    cafeFrame = 0;
    cafeHearts = [];
    cafeNearMenuIdx = -1;
    cafeYumTimer = 0;
    for (var hi = 0; hi < 6; hi++) {
      cafeHearts.push({
        x: 80 + Math.random() * (W - 160),
        y: H - 40 - Math.random() * 200,
        vy: -0.2 - Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        size: 2 + Math.random() * 2,
      });
    }
  }

  /* Apply a purchase: swap in the held-food slot, persist, sparkle and
     pop a "Yum!" bubble above the player. */
  function buyCafeItem(idx) {
    if (idx < 0 || idx >= CAFE_MENU.length) return;
    var item = CAFE_MENU[idx];
    if (!Game.customization) return;
    Game.customization.food = item.food;
    if (Game.engine && Game.engine.savePersistent) Game.engine.savePersistent();
    cafeYumTimer = 60;
    cafeYumX = cafePlayerX;
    cafeYumY = cafePlayerY - 40;
    if (Game.audio && Game.audio.play) Game.audio.play('pickup');
  }

  function updateCafeInterior(keys, jp) {
    cafeTimer++;
    if (cafeYumTimer > 0) cafeYumTimer--;
    /* Walk Momoko around the cafe floor */
    var sp = 2.0;
    var moved = false;
    if (keys.left)  { cafePlayerX -= sp; cafeFacing = -1; moved = true; }
    if (keys.right) { cafePlayerX += sp; cafeFacing = 1;  moved = true; }
    if (keys.up)    { cafePlayerY -= sp; moved = true; }
    if (keys.down)  { cafePlayerY += sp; moved = true; }
    if (cafePlayerX < 30)       cafePlayerX = 30;
    if (cafePlayerX > W - 110)  cafePlayerX = W - 110;
    if (cafePlayerY < 200)      cafePlayerY = 200;
    if (cafePlayerY > H - 30)   cafePlayerY = H - 30;
    if (moved) cafeFrame = (cafeFrame + 1) % 24;
    /* Hearts drift up and respawn at the bottom */
    for (var hi = 0; hi < cafeHearts.length; hi++) {
      var h = cafeHearts[hi];
      h.y += h.vy;
      h.phase += 0.04;
      if (h.y < 60) {
        h.y = H - 30;
        h.x = 80 + Math.random() * (W - 160);
      }
    }
    /* Find the closest menu item within proximity range so the action
       button buys it instead of exiting. */
    cafeNearMenuIdx = -1;
    var bestDist = 70;
    for (var mi = 0; mi < CAFE_MENU.length; mi++) {
      var m = CAFE_MENU[mi];
      var dx = cafePlayerX - m.x;
      var dy = cafePlayerY - m.y;
      var dd = Math.sqrt(dx * dx + dy * dy);
      if (dd < bestDist) {
        bestDist = dd;
        cafeNearMenuIdx = mi;
      }
    }
    /* Action button: buy if near a menu item. The EXIT button + door
       tile handle leaving so action stays focused on interaction. */
    if (jp.action && cafeNearMenuIdx >= 0) {
      buyCafeItem(cafeNearMenuIdx);
    }
    return null;
  }

  function drawCafeCounter(c) {
    /* Long pink wood counter along the back wall */
    c.fillStyle = '#5a2a44';
    c.fillRect(40, 158, W - 240, 12);
    var topG = c.createLinearGradient(0, 150, 0, 158);
    topG.addColorStop(0, '#ffd9a8');
    topG.addColorStop(1, '#cc7a44');
    c.fillStyle = topG;
    c.fillRect(40, 150, W - 240, 8);
    /* Counter front */
    var frG = c.createLinearGradient(0, 170, 0, 220);
    frG.addColorStop(0, '#aa3a66');
    frG.addColorStop(1, '#5a1a2a');
    c.fillStyle = frG;
    c.fillRect(40, 170, W - 240, 50);
    /* Heart panels along the front */
    for (var hp = 0; hp < 6; hp++) {
      var hpx = 80 + hp * 80;
      c.fillStyle = '#ff8ab0';
      c.beginPath();
      c.arc(hpx - 3, 188, 3, 0, Math.PI * 2);
      c.arc(hpx + 3, 188, 3, 0, Math.PI * 2);
      c.moveTo(hpx - 5.4, 190);
      c.lineTo(hpx, 197);
      c.lineTo(hpx + 5.4, 190);
      c.closePath();
      c.fill();
    }
    /* Espresso machine */
    c.fillStyle = '#d8d8e0';
    c.fillRect(70, 110, 64, 40);
    c.fillStyle = '#7a8896';
    c.fillRect(74, 144, 56, 6);
    /* Espresso machine spouts */
    c.fillStyle = '#3a2a44';
    c.fillRect(86, 150, 4, 6);
    c.fillRect(112, 150, 4, 6);
    /* Indicator lights */
    var indicator = (Math.sin(cafeTimer * 0.06) + 1) * 0.5;
    c.fillStyle = '#ff6644';
    c.globalAlpha = 0.5 + indicator * 0.5;
    c.beginPath(); c.arc(82, 122, 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#44ff88';
    c.beginPath(); c.arc(92, 122, 2, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    /* Steam puff */
    c.save();
    c.globalAlpha = 0.5 + Math.sin(cafeTimer * 0.05) * 0.2;
    c.fillStyle = '#fff';
    var stY = 100 - (cafeTimer * 0.5 % 30);
    c.beginPath(); c.arc(102, stY, 4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(106, stY - 6, 3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(98, stY - 10, 2.5, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Pastry display case */
    c.fillStyle = '#ffe9c8';
    c.fillRect(160, 122, 100, 30);
    c.strokeStyle = '#5a2a44';
    c.lineWidth = 1.5;
    c.strokeRect(160, 122, 100, 30);
    /* Cakes inside */
    var cakeColors = ['#ff66cc', '#ffd24a', '#cc88ff', '#88ddff'];
    for (var ck = 0; ck < 4; ck++) {
      var ckx = 170 + ck * 22;
      c.fillStyle = cakeColors[ck];
      c.fillRect(ckx, 138, 14, 12);
      c.fillStyle = '#ffffff';
      c.fillRect(ckx, 136, 14, 2);
      c.fillStyle = '#ff3366';
      c.beginPath(); c.arc(ckx + 7, 134, 1.4, 0, Math.PI * 2); c.fill();
    }
    /* Cash register */
    c.fillStyle = '#3a2a44';
    c.fillRect(290, 124, 36, 26);
    c.fillStyle = '#ffd24a';
    c.fillRect(294, 128, 28, 6);
    c.fillStyle = '#0a0420';
    c.fillRect(294, 128, 28, 6);
    c.fillStyle = '#44ffff';
    c.font = '7px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'left';
    c.fillText('$1.50', 296, 133);
    /* Small chalkboard menu on the back wall */
    c.fillStyle = '#1a2a1a';
    c.fillRect(360, 70, 140, 64);
    c.strokeStyle = '#88553a';
    c.lineWidth = 3;
    c.strokeRect(360, 70, 140, 64);
    c.fillStyle = '#ffe9f4';
    c.font = 'bold 10px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.fillText('~ COSMIC MENU ~', 430, 84);
    c.fillStyle = '#ffd24a';
    c.font = '9px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'left';
    c.fillText('star latte ........ $2', 370, 98);
    c.fillText('moon mocha ..... $3', 370, 110);
    c.fillText('comet cake ...... $1', 370, 122);
  }

  /* Hash a position into a deterministic per-patron variant index so
     facial style / outfit varies between patrons but stays consistent
     between frames. */
  function cafePatronVariant(x, n) {
    return Math.abs(Math.floor(x * 13 + 7)) % n;
  }

  function drawCafePatron(c, x, y, color, hairColor, t, drink) {
    var variant = cafePatronVariant(x, 4);
    var hairStyle = cafePatronVariant(x + 41, 4);
    var bob = Math.sin(t * 0.05 + x * 0.01) * 0.6;
    var blink = Math.sin(t * 0.04 + x * 0.013) > 0.95;
    /* ===== Chair behind the patron ===== */
    /* Chair legs peek out at the bottom */
    c.fillStyle = '#3a1a2a';
    c.fillRect(x - 13, y + 12, 2.6, 8);
    c.fillRect(x + 10.4, y + 12, 2.6, 8);
    /* Chair seat */
    var seatG = c.createLinearGradient(0, y + 8, 0, y + 16);
    seatG.addColorStop(0, '#cc4488');
    seatG.addColorStop(1, '#7a2454');
    c.fillStyle = seatG;
    c.beginPath();
    c.moveTo(x - 14, y + 16);
    c.quadraticCurveTo(x - 16, y + 10, x - 12, y + 8);
    c.lineTo(x + 12, y + 8);
    c.quadraticCurveTo(x + 16, y + 10, x + 14, y + 16);
    c.closePath();
    c.fill();
    /* Chair back — high curved with button tufts */
    var backG = c.createLinearGradient(0, y - 18, 0, y + 8);
    backG.addColorStop(0, '#aa3a66');
    backG.addColorStop(1, '#5a1a3a');
    c.fillStyle = backG;
    c.beginPath();
    c.moveTo(x - 13, y + 8);
    c.lineTo(x - 13, y - 10);
    c.quadraticCurveTo(x - 13, y - 18, x - 7, y - 18);
    c.lineTo(x + 7, y - 18);
    c.quadraticCurveTo(x + 13, y - 18, x + 13, y - 10);
    c.lineTo(x + 13, y + 8);
    c.closePath();
    c.fill();
    /* Button tufts on the chair back */
    c.fillStyle = '#3a0a22';
    var tufts = [[-5, -12], [5, -12], [0, -7], [-5, -2], [5, -2]];
    for (var ct = 0; ct < tufts.length; ct++) {
      c.beginPath();
      c.arc(x + tufts[ct][0], y + tufts[ct][1], 0.7, 0, Math.PI * 2);
      c.fill();
    }
    /* ===== Body / outfit ===== */
    /* Outfit shading */
    var bodyG = c.createLinearGradient(0, y - 12, 0, y + 8);
    bodyG.addColorStop(0, color);
    bodyG.addColorStop(1, hexShadeUI(color, -25));
    c.fillStyle = bodyG;
    c.beginPath();
    c.moveTo(x - 9, y + 8);
    c.lineTo(x - 9, y - 10);
    c.quadraticCurveTo(x - 9, y - 12, x - 7, y - 12);
    c.lineTo(x + 7, y - 12);
    c.quadraticCurveTo(x + 9, y - 12, x + 9, y - 10);
    c.lineTo(x + 9, y + 8);
    c.closePath();
    c.fill();
    /* Outfit detail per variant — collar, scarf, jacket, sweater */
    if (variant === 0) {
      /* V-neck collar with brooch */
      c.fillStyle = '#ffe9c8';
      c.beginPath();
      c.moveTo(x - 5, y - 10);
      c.lineTo(x, y - 4);
      c.lineTo(x + 5, y - 10);
      c.closePath();
      c.fill();
      c.fillStyle = '#ffd24a';
      c.beginPath(); c.arc(x, y - 7, 0.9, 0, Math.PI * 2); c.fill();
    } else if (variant === 1) {
      /* Striped scarf around the neck */
      c.fillStyle = '#ffe9c8';
      c.fillRect(x - 8, y - 12, 16, 3);
      c.fillStyle = '#cc4466';
      c.fillRect(x - 8, y - 11, 16, 0.6);
      c.fillRect(x - 8, y - 9.6, 16, 0.6);
      c.fillStyle = '#ffe9c8';
      c.fillRect(x - 5, y - 9, 3, 6);
    } else if (variant === 2) {
      /* Cardigan with row of buttons */
      c.fillStyle = hexShadeUI(color, -40);
      c.fillRect(x - 9, y - 11, 1.4, 19);
      c.fillRect(x + 7.6, y - 11, 1.4, 19);
      c.fillStyle = '#ffd24a';
      for (var bb = 0; bb < 3; bb++) {
        c.beginPath(); c.arc(x, y - 8 + bb * 5, 0.8, 0, Math.PI * 2); c.fill();
      }
    } else {
      /* Striped sweater */
      c.fillStyle = hexShadeUI(color, 30);
      c.fillRect(x - 9, y - 8, 18, 1.4);
      c.fillRect(x - 9, y - 4, 18, 1.4);
      c.fillRect(x - 9, y, 18, 1.4);
      c.fillRect(x - 9, y + 4, 18, 1.4);
    }
    /* Visible sleeve / arm on the table side, holding the drink/snack */
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x + 6, y - 8);
    c.quadraticCurveTo(x + 12, y - 4, x + 8, y);
    c.lineTo(x + 4, y);
    c.lineTo(x + 4, y - 6);
    c.closePath();
    c.fill();
    c.fillStyle = '#ffccaa';
    c.beginPath();
    c.arc(x + 7, y - 1, 1.8, 0, Math.PI * 2);
    c.fill();
    /* ===== Head ===== */
    var hy = y - 16 + bob;
    /* Neck */
    c.fillStyle = '#ddaa88';
    c.fillRect(x - 2.2, y - 12, 4.4, 3);
    /* Head shape */
    c.fillStyle = '#ffccaa';
    c.beginPath();
    c.arc(x, hy, 7, 0, Math.PI * 2);
    c.fill();
    /* Cheek blush */
    c.save();
    c.globalAlpha = 0.6;
    c.fillStyle = '#ff99aa';
    c.beginPath(); c.arc(x - 4, hy + 1, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + 4, hy + 1, 1.6, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Ears */
    c.fillStyle = '#ddaa88';
    c.beginPath(); c.arc(x - 7, hy + 1, 1.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + 7, hy + 1, 1.4, 0, Math.PI * 2); c.fill();
    /* Earrings */
    c.fillStyle = '#ffd24a';
    c.beginPath(); c.arc(x - 7, hy + 2.8, 0.55, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + 7, hy + 2.8, 0.55, 0, Math.PI * 2); c.fill();
    /* ===== Hair (4 styles) ===== */
    if (hairStyle === 0) {
      /* Long flowing hair with side bangs */
      c.fillStyle = hairColor;
      c.beginPath();
      c.arc(x, hy - 1, 8, Math.PI, Math.PI * 2);
      c.fill();
      c.fillRect(x - 8, hy - 1, 16, 5);
      /* Side strands flowing down past shoulders */
      c.beginPath();
      c.moveTo(x - 8, hy + 4);
      c.bezierCurveTo(x - 11, hy + 8, x - 10, hy + 12, x - 8, hy + 14);
      c.lineTo(x - 5, hy + 14);
      c.lineTo(x - 5, hy + 4);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(x + 8, hy + 4);
      c.bezierCurveTo(x + 11, hy + 8, x + 10, hy + 12, x + 8, hy + 14);
      c.lineTo(x + 5, hy + 14);
      c.lineTo(x + 5, hy + 4);
      c.closePath();
      c.fill();
      /* Bangs */
      c.fillStyle = hexShadeUI(hairColor, -15);
      c.beginPath();
      c.moveTo(x - 7, hy - 4);
      c.bezierCurveTo(x - 4, hy - 1, x + 4, hy - 1, x + 7, hy - 4);
      c.lineTo(x + 6, hy + 1);
      c.lineTo(x - 6, hy + 1);
      c.closePath();
      c.fill();
      /* Hair bow */
      c.fillStyle = '#ff66cc';
      c.beginPath();
      c.moveTo(x - 6, hy - 6);
      c.lineTo(x - 9, hy - 9);
      c.lineTo(x - 9, hy - 4);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(x - 6, hy - 6);
      c.lineTo(x - 4, hy - 9);
      c.lineTo(x - 4, hy - 4);
      c.closePath();
      c.fill();
      c.fillStyle = '#ffd24a';
      c.beginPath(); c.arc(x - 6, hy - 6, 0.7, 0, Math.PI * 2); c.fill();
    } else if (hairStyle === 1) {
      /* Twin-tail buns */
      c.fillStyle = hairColor;
      c.beginPath();
      c.arc(x, hy - 1, 8, Math.PI, Math.PI * 2);
      c.fill();
      c.fillRect(x - 8, hy - 1, 16, 4);
      c.beginPath(); c.arc(x - 8, hy - 5, 3.4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x + 8, hy - 5, 3.4, 0, Math.PI * 2); c.fill();
      /* Bangs */
      c.fillStyle = hexShadeUI(hairColor, -15);
      c.fillRect(x - 6, hy - 3, 12, 3);
      /* Bun ribbons */
      c.fillStyle = '#ff66cc';
      c.fillRect(x - 9.6, hy - 6, 3.2, 0.8);
      c.fillRect(x + 6.4, hy - 6, 3.2, 0.8);
    } else if (hairStyle === 2) {
      /* Short bob with side fringe */
      c.fillStyle = hairColor;
      c.beginPath();
      c.arc(x, hy, 8.4, Math.PI - 0.1, Math.PI * 2 + 0.1);
      c.fill();
      c.fillRect(x - 8, hy, 16, 5);
      c.fillStyle = hexShadeUI(hairColor, 25);
      c.fillRect(x - 7, hy - 4, 6, 3);
      /* Hair clip */
      c.fillStyle = '#ffd24a';
      c.fillRect(x + 4, hy - 4, 3, 1.2);
    } else {
      /* Curly afro / pile */
      c.fillStyle = hairColor;
      var puffs = [[-7, -4], [-3, -7], [3, -7], [7, -4], [-5, -1], [5, -1], [0, -8]];
      for (var pf = 0; pf < puffs.length; pf++) {
        c.beginPath();
        c.arc(x + puffs[pf][0], hy + puffs[pf][1], 4, 0, Math.PI * 2);
        c.fill();
      }
      /* Headband */
      c.fillStyle = '#ff66cc';
      c.fillRect(x - 8, hy - 1, 16, 1.2);
      c.fillStyle = '#ffd24a';
      c.beginPath(); c.arc(x, hy - 0.4, 0.8, 0, Math.PI * 2); c.fill();
    }
    /* ===== Eyes ===== */
    c.fillStyle = '#220033';
    if (blink) {
      c.fillRect(x - 3.2, hy + 0.5, 2.4, 0.7);
      c.fillRect(x + 0.8, hy + 0.5, 2.4, 0.7);
    } else {
      /* Eye whites */
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(x - 2.2, hy + 0.6, 1.5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x + 2.2, hy + 0.6, 1.5, 0, Math.PI * 2); c.fill();
      /* Pupils */
      c.fillStyle = '#220033';
      c.beginPath(); c.arc(x - 2.2, hy + 0.8, 1, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x + 2.2, hy + 0.8, 1, 0, Math.PI * 2); c.fill();
      /* Eye shine */
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(x - 1.7, hy + 0.4, 0.5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x + 2.7, hy + 0.4, 0.5, 0, Math.PI * 2); c.fill();
      /* Eyelashes */
      c.strokeStyle = '#220033';
      c.lineWidth = 0.5;
      c.beginPath(); c.moveTo(x - 3.5, hy - 0.4); c.lineTo(x - 4.4, hy - 1.4); c.stroke();
      c.beginPath(); c.moveTo(x + 3.5, hy - 0.4); c.lineTo(x + 4.4, hy - 1.4); c.stroke();
    }
    /* Eyebrows */
    c.strokeStyle = hexShadeUI(hairColor, -30);
    c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(x - 4, hy - 1.6); c.lineTo(x - 1, hy - 2.2); c.stroke();
    c.beginPath(); c.moveTo(x + 1, hy - 2.2); c.lineTo(x + 4, hy - 1.6); c.stroke();
    /* Nose */
    c.strokeStyle = '#cc8866';
    c.lineWidth = 0.4;
    c.beginPath();
    c.moveTo(x, hy + 1.4);
    c.lineTo(x + 0.4, hy + 2.4);
    c.stroke();
    /* Smile */
    c.strokeStyle = '#aa3a66';
    c.lineWidth = 0.8;
    c.beginPath();
    c.arc(x, hy + 3, 1.7, 0.2, Math.PI - 0.2);
    c.stroke();
    /* Lip blush */
    c.save();
    c.globalAlpha = 0.5;
    c.strokeStyle = '#ff99aa';
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(x, hy + 3, 1.4, 0.6, Math.PI - 0.6);
    c.stroke();
    c.restore();
    /* ===== Drink + dessert in front ===== */
    if (drink) {
      var mugVariant = cafePatronVariant(x + 7, 3);
      /* Mug body */
      var mugColors = ['#ff8ab0', '#88ddff', '#ffd24a'];
      var mugColor = mugColors[mugVariant];
      c.fillStyle = mugColor;
      c.beginPath();
      c.moveTo(x + 4, y - 6);
      c.lineTo(x + 12, y - 6);
      c.lineTo(x + 11, y - 1);
      c.lineTo(x + 5, y - 1);
      c.closePath();
      c.fill();
      /* Mug rim band */
      c.fillStyle = hexShadeUI(mugColor, 25);
      c.fillRect(x + 4, y - 6, 8, 1);
      /* Mug heart */
      c.fillStyle = '#fff';
      var hcX = x + 8, hcY = y - 4;
      c.beginPath();
      c.arc(hcX - 0.9, hcY - 0.3, 0.8, 0, Math.PI * 2);
      c.arc(hcX + 0.9, hcY - 0.3, 0.8, 0, Math.PI * 2);
      c.moveTo(hcX - 1.6, hcY);
      c.lineTo(hcX, hcY + 1.6);
      c.lineTo(hcX + 1.6, hcY);
      c.closePath();
      c.fill();
      /* Mug handle */
      c.strokeStyle = mugColor;
      c.lineWidth = 1;
      c.beginPath(); c.arc(x + 13, y - 3.4, 1.6, -Math.PI / 2, Math.PI / 2); c.stroke();
      /* Drink surface — coffee crema */
      c.fillStyle = '#a8744a';
      c.beginPath();
      c.ellipse(x + 8, y - 6, 4, 0.8, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffe9c8';
      c.save();
      c.globalAlpha = 0.6;
      c.beginPath();
      c.ellipse(x + 7.4, y - 6.1, 2, 0.5, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
      /* Steam (rising) */
      c.save();
      c.globalAlpha = 0.55 + Math.sin(t * 0.06 + x) * 0.2;
      c.fillStyle = '#fff';
      var stPhase = (t * 0.4 + x * 0.1) % 12;
      c.beginPath(); c.arc(x + 7, y - 8 - stPhase, 1.4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x + 9.4, y - 11 - stPhase, 1.1, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x + 6.4, y - 13 - stPhase, 0.9, 0, Math.PI * 2); c.fill();
      c.restore();
      /* Pastry plate */
      var dessertVariant = cafePatronVariant(x + 19, 4);
      c.fillStyle = '#ffe9c8';
      c.beginPath();
      c.ellipse(x - 5, y - 1, 5, 1.4, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#cdaaee';
      c.lineWidth = 0.4;
      c.beginPath();
      c.ellipse(x - 5, y - 1, 5, 1.4, 0, 0, Math.PI * 2);
      c.stroke();
      if (dessertVariant === 0) {
        /* Pink macaron */
        c.fillStyle = '#ff8ab0';
        c.beginPath(); c.ellipse(x - 5, y - 3, 3, 1.4, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffe9c8';
        c.fillRect(x - 7.2, y - 2.6, 4.4, 0.6);
        c.fillStyle = '#ff99cc';
        c.beginPath(); c.ellipse(x - 5, y - 4, 3, 1.4, 0, 0, Math.PI * 2); c.fill();
      } else if (dessertVariant === 1) {
        /* Slice of cake */
        c.fillStyle = '#ffd9e8';
        c.beginPath();
        c.moveTo(x - 8, y - 2.4);
        c.lineTo(x - 2, y - 2.4);
        c.lineTo(x - 5, y - 7);
        c.closePath();
        c.fill();
        c.fillStyle = '#ff66cc';
        c.beginPath();
        c.arc(x - 5, y - 7, 1, 0, Math.PI * 2);
        c.fill();
      } else if (dessertVariant === 2) {
        /* Donut */
        c.fillStyle = '#a8744a';
        c.beginPath(); c.ellipse(x - 5, y - 3, 2.8, 1.6, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ff66cc';
        c.beginPath(); c.ellipse(x - 5, y - 3.4, 2.6, 1, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffe9c8';
        c.beginPath(); c.arc(x - 5, y - 3.2, 0.7, 0, Math.PI * 2); c.fill();
        /* Sprinkles */
        c.fillStyle = '#ffd24a';
        c.fillRect(x - 6, y - 4, 0.5, 0.5);
        c.fillStyle = '#88ddff';
        c.fillRect(x - 4, y - 3.4, 0.5, 0.5);
        c.fillStyle = '#fff';
        c.fillRect(x - 5.5, y - 3.6, 0.5, 0.5);
      } else {
        /* Croissant */
        c.fillStyle = '#d8a064';
        c.beginPath();
        c.arc(x - 5, y - 3, 3, Math.PI, 0);
        c.fill();
        c.fillStyle = '#a8744a';
        c.beginPath();
        c.arc(x - 5, y - 3, 3, Math.PI, 0);
        c.stroke();
      }
    }
    /* ===== Conversation bubble — occasionally shows a chat icon ===== */
    var chatPhase = Math.sin(t * 0.012 + x * 0.07);
    if (chatPhase > 0.92) {
      c.save();
      c.globalAlpha = (chatPhase - 0.92) / 0.08;
      var bx = x + 10, by = hy - 10;
      c.fillStyle = '#fff';
      c.beginPath();
      c.ellipse(bx, by, 6, 4, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(bx - 3, by + 3);
      c.lineTo(bx - 5, by + 6);
      c.lineTo(bx - 1, by + 4);
      c.closePath();
      c.fill();
      c.fillStyle = '#220033';
      c.font = '5px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'center';
      c.fillText('♥♥♥', bx, by + 1.5);
      c.restore();
    }
  }

  /* Lightweight color shader for the cafe — local to ui.js so we don't
     reach into entities.js. Positive `pct` lightens, negative darkens. */
  function hexShadeUI(hex, pct) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    var f = pct / 100;
    function adj(v) {
      var nv = v + (f >= 0 ? (255 - v) * f : v * f);
      return Math.max(0, Math.min(255, Math.round(nv)));
    }
    var r2 = adj(r), g2 = adj(g), b2 = adj(b);
    return '#' + ((1 << 24) + (r2 << 16) + (g2 << 8) + b2).toString(16).slice(1);
  }

  function drawCafeTable(c, x, y) {
    /* Round bistro table */
    c.fillStyle = '#3a2010';
    c.beginPath();
    c.ellipse(x, y, 20, 5, 0, 0, Math.PI * 2);
    c.fill();
    var topG = c.createRadialGradient(x - 4, y - 2, 2, x, y, 22);
    topG.addColorStop(0, '#d8a064');
    topG.addColorStop(1, '#7a4818');
    c.fillStyle = topG;
    c.beginPath();
    c.ellipse(x, y - 2, 19, 4, 0, 0, Math.PI * 2);
    c.fill();
    /* Pedestal */
    c.fillStyle = '#5a3418';
    c.fillRect(x - 2, y, 4, 18);
    /* Cross-base feet */
    c.fillStyle = '#3a2010';
    c.fillRect(x - 12, y + 18, 24, 3);
    /* Mug + flower vase */
    c.fillStyle = '#ff8ab0';
    c.fillRect(x - 8, y - 8, 6, 6);
    c.strokeStyle = '#ff8ab0';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(x - 1, y - 5, 2, -Math.PI / 2, Math.PI / 2);
    c.stroke();
    /* Vase + flower */
    c.fillStyle = '#cc88ff';
    c.beginPath();
    c.moveTo(x + 4, y - 4);
    c.lineTo(x + 9, y - 4);
    c.lineTo(x + 8, y - 10);
    c.lineTo(x + 5, y - 10);
    c.closePath();
    c.fill();
    c.fillStyle = '#ff66cc';
    c.beginPath(); c.arc(x + 6.5, y - 12, 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffd24a';
    c.beginPath(); c.arc(x + 6.5, y - 12, 0.8, 0, Math.PI * 2); c.fill();
  }

  function drawCafeInterior(c) {
    cafeTimer++;
    /* Warm interior gradient — sunset peach into cream */
    var bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#5a1a3a');
    bg.addColorStop(0.55, '#a83a5a');
    bg.addColorStop(1, '#3a1024');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);
    /* Wallpaper pattern — repeating tiny stars */
    c.save();
    c.globalAlpha = 0.18;
    c.fillStyle = '#ffd9a8';
    for (var ws = 0; ws < 60; ws++) {
      var wsx = (ws * 71) % W;
      var wsy = (ws * 43) % (H - 200) + 20;
      c.beginPath();
      c.arc(wsx, wsy, 1.4, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    /* Ceiling beam */
    c.fillStyle = '#3a1a2a';
    c.fillRect(0, 50, W, 14);
    c.fillStyle = '#5a2a44';
    c.fillRect(0, 60, W, 4);
    /* Hanging pendant lamps with warm glow */
    for (var lp = 0; lp < 5; lp++) {
      var lpx = 100 + lp * 140;
      c.strokeStyle = '#3a1a2a';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(lpx, 64);
      c.lineTo(lpx, 86);
      c.stroke();
      c.fillStyle = '#ffd24a';
      c.beginPath();
      c.moveTo(lpx - 9, 86);
      c.lineTo(lpx + 9, 86);
      c.lineTo(lpx + 6, 96);
      c.lineTo(lpx - 6, 96);
      c.closePath();
      c.fill();
      c.save();
      c.globalAlpha = 0.4 + Math.sin(cafeTimer * 0.04 + lp) * 0.05;
      var glow = c.createRadialGradient(lpx, 96, 4, lpx, 96, 60);
      glow.addColorStop(0, 'rgba(255,210,138,0.7)');
      glow.addColorStop(1, 'rgba(255,210,138,0)');
      c.fillStyle = glow;
      c.beginPath(); c.arc(lpx, 96, 60, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    /* Floor — warm wood planks */
    var fl = c.createLinearGradient(0, 220, 0, H);
    fl.addColorStop(0, '#7a4818');
    fl.addColorStop(1, '#3a2010');
    c.fillStyle = fl;
    c.fillRect(0, 220, W, H - 220);
    c.strokeStyle = 'rgba(0,0,0,0.3)';
    c.lineWidth = 1;
    for (var pl = 0; pl < 7; pl++) {
      c.beginPath();
      c.moveTo(0, 240 + pl * 24);
      c.lineTo(W, 240 + pl * 24);
      c.stroke();
    }
    /* Counter at the back */
    drawCafeCounter(c);
    /* Barista behind the counter */
    drawCafePatron(c, 220, 138, '#ee99dd', '#cc4488', cafeTimer, false);
    /* Small "Welcome to the Cosmic Café!" sign */
    c.fillStyle = '#ffe9c8';
    c.font = 'bold 22px "Brush Script MT", cursive';
    c.textAlign = 'center';
    c.fillText('~ Cosmic Café ~', W / 2, 40);
    c.font = '12px "M PLUS Rounded 1c", sans-serif';
    c.fillStyle = '#ffd9a8';
    c.fillText('a cozy spot among the stars', W / 2, 56);
    /* Tables with patrons */
    drawCafeTable(c, 130, 320);
    drawCafePatron(c, 130, 320 - 6, '#88ddff', '#3a4488', cafeTimer + 30, true);
    drawCafeTable(c, 360, 350);
    drawCafePatron(c, 350, 350 - 6, '#ffd24a', '#7a4418', cafeTimer + 70, true);
    drawCafePatron(c, 372, 350 - 6, '#cc88ff', '#552288', cafeTimer + 110, true);
    drawCafeTable(c, 560, 320);
    drawCafePatron(c, 560, 320 - 6, '#88ee88', '#3a7a3a', cafeTimer + 50, true);
    /* Window with stars (right side) */
    c.fillStyle = '#0a0420';
    c.fillRect(W - 200, 90, 130, 90);
    c.strokeStyle = '#ffd24a';
    c.lineWidth = 3;
    c.strokeRect(W - 200, 90, 130, 90);
    /* Cross frame */
    c.beginPath();
    c.moveTo(W - 135, 90); c.lineTo(W - 135, 180); c.stroke();
    c.beginPath();
    c.moveTo(W - 200, 135); c.lineTo(W - 70, 135); c.stroke();
    /* Stars inside the window */
    c.fillStyle = '#fff';
    for (var sw = 0; sw < 14; sw++) {
      var swx = (W - 196) + ((sw * 13) % 122);
      var swy = 96 + ((sw * 27) % 78);
      c.globalAlpha = 0.5 + ((sw * 17) % 50) / 100;
      c.beginPath();
      c.arc(swx, swy, 0.8 + (sw % 3) * 0.4, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    /* Tiny ringed planet visible */
    c.fillStyle = '#ff66cc';
    c.beginPath(); c.arc(W - 120, 145, 7, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ffd24a';
    c.lineWidth = 1.2;
    c.beginPath();
    c.ellipse(W - 120, 145, 12, 3, -0.3, 0, Math.PI * 2);
    c.stroke();
    /* Floating hearts (atmosphere) */
    for (var hi = 0; hi < cafeHearts.length; hi++) {
      var h = cafeHearts[hi];
      var sway = Math.sin(h.phase) * 8;
      var hx = h.x + sway;
      c.save();
      c.globalAlpha = 0.55;
      c.fillStyle = '#ff99cc';
      c.beginPath();
      c.arc(hx - h.size, h.y - h.size * 0.5, h.size, 0, Math.PI * 2);
      c.arc(hx + h.size, h.y - h.size * 0.5, h.size, 0, Math.PI * 2);
      c.moveTo(hx - h.size * 1.8, h.y);
      c.lineTo(hx, h.y + h.size * 1.8);
      c.lineTo(hx + h.size * 1.8, h.y);
      c.closePath();
      c.fill();
      c.restore();
    }
    /* Buyable menu items on the counter — drawn before Momoko so she
       walks in front of the food stand. */
    drawCafeMenuItems(c);
    /* Momoko walking around the cafe */
    if (Game.entities && Game.entities.drawMomokoSprite) {
      c.save();
      var psx = cafePlayerX - 14, psy = cafePlayerY - 30;
      if (cafeFacing === -1) {
        c.translate(psx + 14, 0);
        c.scale(-1, 1);
        psx = -14;
      }
      Game.entities.drawMomokoSprite(c, psx, psy, Game.customization, cafeFrame);
      c.restore();
    }
    /* Yum! purchase feedback bubble */
    if (cafeYumTimer > 0) {
      c.save();
      c.globalAlpha = Math.min(1, cafeYumTimer / 30);
      var ybY = cafeYumY - (60 - cafeYumTimer) * 0.4;
      c.fillStyle = '#fff';
      c.beginPath();
      c.ellipse(cafeYumX, ybY, 20, 12, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ff66cc';
      c.font = 'bold 14px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(Game.i18n.t('cafeYum'), cafeYumX, ybY);
      c.textBaseline = 'alphabetic';
      c.restore();
    }
    /* Exit door (right side) */
    c.fillStyle = '#3a2412';
    c.fillRect(W - 84, H - 140, 64, 110);
    c.fillStyle = '#aa5a32';
    c.fillRect(W - 80, H - 136, 56, 102);
    c.strokeStyle = '#5a3a22';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(W - 52, H - 132); c.lineTo(W - 52, H - 36); c.stroke();
    c.fillStyle = '#ffd24a';
    c.beginPath();
    c.arc(W - 36, H - 86, 3, 0, Math.PI * 2);
    c.fill();
    /* "Outside" sign */
    c.fillStyle = '#44ffff';
    c.fillRect(W - 92, H - 152, 80, 16);
    c.fillStyle = '#0a0420';
    c.font = 'bold 11px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('furnitureExit'), W - 52, H - 141);
    /* Hint at the bottom */
    c.fillStyle = 'rgba(10, 4, 32, 0.7)';
    c.fillRect(0, H - 24, W - 100, 24);
    c.fillStyle = '#ffe9c8';
    c.font = 'bold 11px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('cafeHint'), (W - 100) / 2, H - 8);
    /* One-shot top-right EXIT button (always visible) */
    drawExitButton(c);
  }

  /* Render each buyable menu item on the counter as a small framed
     dish. Highlights the one Momoko is closest to. */
  function drawCafeMenuItems(c) {
    for (var mi = 0; mi < CAFE_MENU.length; mi++) {
      var m = CAFE_MENU[mi];
      var hot = (mi === cafeNearMenuIdx);
      /* Plate */
      c.save();
      c.fillStyle = '#3a1a2a';
      c.beginPath();
      c.ellipse(m.x, m.y + 18, 22, 4, 0, 0, Math.PI * 2);
      c.fill();
      /* Stand frame */
      c.fillStyle = hot ? '#ffd24a' : '#a86820';
      c.fillRect(m.x - 22, m.y - 14, 44, 4);
      /* Plate ring */
      var plateG = c.createRadialGradient(m.x - 4, m.y + 12, 2, m.x, m.y + 14, 22);
      plateG.addColorStop(0, '#ffe9c8');
      plateG.addColorStop(1, '#cdaaee');
      c.fillStyle = plateG;
      c.beginPath();
      c.ellipse(m.x, m.y + 14, 20, 5, 0, 0, Math.PI * 2);
      c.fill();
      /* Item icon — borrow the held-food drawing logic by creating a
         tiny inline sprite per food type. */
      drawCafeFoodIcon(c, m.food, m.x, m.y);
      /* Highlight ring + price tag when Momoko is near */
      if (hot) {
        c.save();
        c.globalAlpha = 0.55 + Math.sin(cafeTimer * 0.18) * 0.25;
        c.strokeStyle = '#ffd24a';
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(m.x, m.y + 14, 24, 7, 0, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
      /* Label */
      c.fillStyle = hot ? '#ffd24a' : '#ffe9c8';
      c.font = (hot ? 'bold ' : '') + '9px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'center';
      c.fillText(Game.i18n.t(m.labelKey) || m.food, m.x, m.y + 28);
      c.restore();
    }
    /* Action prompt above the closest item */
    if (cafeNearMenuIdx >= 0) {
      var nm = CAFE_MENU[cafeNearMenuIdx];
      var px = nm.x, py = nm.y - 22;
      c.save();
      c.globalAlpha = 0.85;
      c.fillStyle = '#0a0420';
      c.strokeStyle = '#ffd24a';
      c.lineWidth = 1.5;
      roundRect(c, px - 32, py - 9, 64, 18, 5);
      c.fill();
      c.stroke();
      c.fillStyle = '#ffd24a';
      c.font = 'bold 9px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(Game.i18n.t('cafeBuyPrompt'), px, py);
      c.textBaseline = 'alphabetic';
      c.restore();
    }
  }

  /* Tiny food icons drawn at the menu position. Mirrors the held-food
     options so the player sees what she's buying. */
  function drawCafeFoodIcon(c, food, x, y) {
    if (food === 'iceCream') {
      /* Cone */
      c.fillStyle = '#e0b070';
      c.beginPath();
      c.moveTo(x - 5, y + 6);
      c.lineTo(x + 5, y + 6);
      c.lineTo(x, y + 14);
      c.closePath();
      c.fill();
      c.strokeStyle = '#9a7048';
      c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(x - 3, y + 7); c.lineTo(x + 3, y + 13); c.stroke();
      c.fillStyle = '#ffc8d4';
      c.beginPath(); c.arc(x, y + 4, 6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff3355';
      c.beginPath(); c.arc(x, y - 2, 1.6, 0, Math.PI * 2); c.fill();
    } else if (food === 'donut') {
      c.fillStyle = '#a8744a';
      c.beginPath(); c.ellipse(x, y + 6, 9, 5, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff66cc';
      c.beginPath(); c.ellipse(x, y + 5, 8, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffe9c8';
      c.beginPath(); c.arc(x, y + 5, 1.8, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffd24a';
      c.fillRect(x - 4, y + 3, 1, 1);
      c.fillStyle = '#88ddff';
      c.fillRect(x + 3, y + 4, 1, 1);
      c.fillStyle = '#fff';
      c.fillRect(x, y + 7, 1, 1);
    } else if (food === 'macaron') {
      c.fillStyle = '#ff8ab0';
      c.beginPath(); c.ellipse(x, y + 3, 7, 3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffe9c8';
      c.fillRect(x - 6, y + 5, 12, 2);
      c.fillStyle = '#ff99cc';
      c.beginPath(); c.ellipse(x, y + 8, 7, 3, 0, 0, Math.PI * 2); c.fill();
    } else if (food === 'crepe') {
      c.fillStyle = '#e8c898';
      c.beginPath();
      c.moveTo(x - 7, y + 12);
      c.lineTo(x + 7, y + 12);
      c.lineTo(x, y - 4);
      c.closePath();
      c.fill();
      c.fillStyle = '#ffd9e8';
      c.beginPath();
      c.moveTo(x - 4, y - 2);
      c.lineTo(x + 4, y - 2);
      c.lineTo(x, y + 6);
      c.closePath();
      c.fill();
      c.fillStyle = '#cc4466';
      c.beginPath(); c.arc(x, y - 1, 1.4, 0, Math.PI * 2); c.fill();
    } else if (food === 'parfait') {
      /* Glass */
      c.strokeStyle = '#cdeaf4';
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(x - 5, y - 2);
      c.lineTo(x - 4, y + 12);
      c.lineTo(x + 4, y + 12);
      c.lineTo(x + 5, y - 2);
      c.stroke();
      c.fillStyle = '#cc4466';
      c.fillRect(x - 4, y + 3, 8, 4);
      c.fillStyle = '#ffd9e8';
      c.fillRect(x - 4, y, 8, 3);
      c.fillStyle = '#ffe9c8';
      c.beginPath(); c.arc(x, y - 2, 3, Math.PI, 0); c.fill();
      c.fillStyle = '#ff3366';
      c.beginPath(); c.arc(x, y - 4, 1, 0, Math.PI * 2); c.fill();
    } else if (food === 'taiyaki') {
      c.fillStyle = '#d8a064';
      c.beginPath();
      c.ellipse(x, y + 6, 8, 4, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#7a4818';
      c.beginPath(); c.arc(x - 4, y + 5, 0.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffe9c8';
      c.beginPath();
      c.moveTo(x + 6, y + 6);
      c.lineTo(x + 10, y + 4);
      c.lineTo(x + 10, y + 8);
      c.closePath();
      c.fill();
    } else if (food === 'onigiri') {
      c.fillStyle = '#fff';
      c.beginPath();
      c.moveTo(x - 7, y + 10);
      c.lineTo(x, y - 4);
      c.lineTo(x + 7, y + 10);
      c.closePath();
      c.fill();
      c.fillStyle = '#3a2010';
      c.fillRect(x - 5, y + 5, 10, 4);
    } else if (food === 'strawberry') {
      c.fillStyle = '#ff3366';
      c.beginPath();
      c.moveTo(x, y + 12);
      c.bezierCurveTo(x - 8, y + 10, x - 8, y - 2, x, y - 2);
      c.bezierCurveTo(x + 8, y - 2, x + 8, y + 10, x, y + 12);
      c.closePath();
      c.fill();
      c.fillStyle = '#ffd24a';
      c.beginPath(); c.arc(x - 2, y + 2, 0.6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x + 2, y + 5, 0.6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(x, y + 8, 0.6, 0, Math.PI * 2); c.fill();
      /* Leaves */
      c.fillStyle = '#3a8a3a';
      c.beginPath();
      c.moveTo(x - 4, y - 1);
      c.lineTo(x, y - 5);
      c.lineTo(x + 4, y - 1);
      c.closePath();
      c.fill();
    }
  }

  /* ============================================================ */
  /*                  ONE-SHOT EXIT BUTTON                          */
  /* ============================================================ */
  /* Compact button rendered in the top-right corner of every interior
     scene (cafe, shop, house). One tap returns the player to the
     planet, no matter where they are in the room. */
  var EXIT_BTN = { x: W - 80, y: 8, w: 72, h: 30 };
  function drawExitButton(c) {
    c.save();
    c.fillStyle = '#cc4466';
    c.strokeStyle = '#ff99aa';
    c.lineWidth = 2;
    roundRect(c, EXIT_BTN.x, EXIT_BTN.y, EXIT_BTN.w, EXIT_BTN.h, 8);
    c.fill();
    c.stroke();
    c.fillStyle = '#fff';
    c.font = 'bold 13px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(
      Game.i18n.t('exitButton') + ' ✕',
      EXIT_BTN.x + EXIT_BTN.w / 2,
      EXIT_BTN.y + EXIT_BTN.h / 2
    );
    c.textBaseline = 'alphabetic';
    c.restore();
  }
  function hitExitButton(mx, my) {
    return hitButton(mx, my, EXIT_BTN.x, EXIT_BTN.y, EXIT_BTN.w, EXIT_BTN.h);
  }

  function handleCafeInteriorClick(mx, my) {
    /* One-shot top-right EXIT button */
    if (hitExitButton(mx, my)) {
      Game.audio.play('select');
      return 'exit';
    }
    /* Exit door */
    if (hitButton(mx, my, W - 92, H - 152, 80, 122)) {
      Game.audio.play('select');
      return 'exit';
    }
    /* Tap a counter menu item to buy it directly. */
    for (var mi = 0; mi < CAFE_MENU.length; mi++) {
      var m = CAFE_MENU[mi];
      if (hitButton(mx, my, m.x - 28, m.y - 28, 56, 70)) {
        buyCafeItem(mi);
        return null;
      }
    }
    return null;
  }

  /* ============================================================ */
  /*                  STAR BAZAAR — shop interior                   */
  /* ============================================================ */
  /* The shop renders a grid of buyable furniture (one of each type from
     FURNITURE_TYPES). Tapping/clicking a tile adds it to Game.shop.cart;
     the cart is shown in the corner. The hero exits via the right-side
     door, then walks to a houseDoor — entering deposits the cart. */
  var shopTimer = 0;
  var shopFlashItem = null;
  var shopFlashTimer = 0;

  function startShopInterior() {
    shopTimer = 0;
    shopFlashItem = null;
    shopFlashTimer = 0;
  }

  function updateShopInterior(keys, jp) {
    shopTimer++;
    if (shopFlashTimer > 0) shopFlashTimer--;
    if (jp.action) return 'exit';
    return null;
  }

  function shopGrid() {
    /* Layout: 9 columns × 2 rows so all 18 furniture types fit between
       the banner (y < 70) and the lower cart/delivery panels (y > 370). */
    var cols = 9;
    var cellW = 84, cellH = 130;
    var startX = (W - cols * cellW) / 2;
    var startY = 90;
    var positions = [];
    for (var i = 0; i < FURNITURE_TYPES.length; i++) {
      var col = i % cols;
      var row = Math.floor(i / cols);
      positions.push({
        type: FURNITURE_TYPES[i],
        x: startX + col * cellW,
        y: startY + row * cellH,
        w: cellW,
        h: cellH,
      });
    }
    return positions;
  }

  function drawShopInterior(c) {
    shopTimer++;
    /* Warm gold/teal interior */
    var bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a3a4a');
    bg.addColorStop(0.55, '#3aa8c4');
    bg.addColorStop(1, '#0a1a22');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);
    /* Star wallpaper */
    c.save();
    c.globalAlpha = 0.18;
    c.fillStyle = '#ffd24a';
    for (var ws = 0; ws < 50; ws++) {
      var wx = (ws * 67) % W;
      var wy = (ws * 41) % H;
      c.beginPath(); c.arc(wx, wy, 1.2, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    /* Banner */
    c.fillStyle = '#0a1a22';
    c.fillRect(0, 0, W, 70);
    c.strokeStyle = '#ffd24a';
    c.lineWidth = 3;
    c.strokeRect(2, 2, W - 4, 66);
    c.fillStyle = '#ffd24a';
    c.font = 'bold 26px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.fillText('★ STAR BAZAAR ★', W / 2, 30);
    c.fillStyle = '#cdeaf4';
    c.font = '12px "M PLUS Rounded 1c", sans-serif';
    c.fillText(Game.i18n.t('shopHint'), W / 2, 52);
    /* Item grid */
    var grid = shopGrid();
    for (var gi = 0; gi < grid.length; gi++) {
      var g = grid[gi];
      /* Tile */
      c.fillStyle = '#247088';
      c.strokeStyle = '#cdeaf4';
      c.lineWidth = 1.5;
      roundRect(c, g.x + 4, g.y + 4, g.w - 8, g.h - 8, 8);
      c.fill();
      c.stroke();
      /* Furniture preview — drawn at palette scale */
      drawFurniture(c, g.type, g.x + g.w / 2, g.y + g.h / 2 + 4, 'palette');
      /* Label */
      c.fillStyle = '#ffe9c8';
      c.font = '9px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'center';
      c.fillText(
        Game.i18n.t('furniture_' + g.type) || g.type,
        g.x + g.w / 2,
        g.y + g.h - 8
      );
      /* Flash highlight on the just-bought item */
      if (shopFlashItem === g.type && shopFlashTimer > 0) {
        c.save();
        c.globalAlpha = shopFlashTimer / 20;
        c.strokeStyle = '#ffd24a';
        c.lineWidth = 4;
        roundRect(c, g.x + 2, g.y + 2, g.w - 4, g.h - 4, 8);
        c.stroke();
        c.restore();
      }
    }
    /* Cart panel (lower-left) */
    var cartX = 12, cartY = H - 110, cartW = 220, cartH = 96;
    c.fillStyle = 'rgba(10, 26, 34, 0.85)';
    c.strokeStyle = '#ffd24a';
    c.lineWidth = 2;
    roundRect(c, cartX, cartY, cartW, cartH, 10);
    c.fill();
    c.stroke();
    c.fillStyle = '#ffd24a';
    c.font = 'bold 12px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'left';
    c.fillText(
      Game.i18n.t('shopCart') + ' ' +
        (Game.shop ? Game.shop.cart.length : 0) + '/' +
        (Game.shop ? Game.shop.MAX : 4),
      cartX + 10,
      cartY + 18
    );
    /* Cart icons */
    var cart = (Game.shop && Game.shop.cart) || [];
    for (var ci = 0; ci < cart.length; ci++) {
      var cixx = cartX + 24 + ci * 48;
      var ciyy = cartY + 60;
      c.fillStyle = '#1a3a4a';
      c.beginPath(); c.arc(cixx, ciyy, 20, 0, Math.PI * 2); c.fill();
      drawFurniture(c, cart[ci].type, cixx, ciyy + 4, 'palette');
    }
    if (cart.length === 0) {
      c.fillStyle = '#88aabb';
      c.font = '11px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'left';
      c.fillText(Game.i18n.t('shopCartEmpty'), cartX + 10, cartY + 56);
    }
    /* Delivery hint (lower-right) */
    var hintX = W - 280, hintY = H - 110;
    c.fillStyle = 'rgba(10, 26, 34, 0.85)';
    c.strokeStyle = '#ff66cc';
    c.lineWidth = 2;
    roundRect(c, hintX, hintY, 270, 68, 10);
    c.fill();
    c.stroke();
    c.fillStyle = '#ff99cc';
    c.font = 'bold 12px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'left';
    c.fillText(Game.i18n.t('shopDeliveryTitle'), hintX + 12, hintY + 18);
    c.fillStyle = '#ffe9c8';
    c.font = '11px "M PLUS Rounded 1c", sans-serif';
    var lines = (Game.i18n.t('shopDeliveryDesc') || '').split('\n');
    for (var ln = 0; ln < lines.length; ln++) {
      c.fillText(lines[ln], hintX + 12, hintY + 36 + ln * 14);
    }
    /* Exit door */
    c.fillStyle = '#3a2412';
    c.fillRect(W - 84, H - 220, 64, 110);
    c.fillStyle = '#aa5a32';
    c.fillRect(W - 80, H - 216, 56, 102);
    c.strokeStyle = '#5a3a22';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(W - 52, H - 212); c.lineTo(W - 52, H - 116); c.stroke();
    c.fillStyle = '#ffd24a';
    c.beginPath();
    c.arc(W - 36, H - 166, 3, 0, Math.PI * 2);
    c.fill();
    /* "Outside" sign */
    c.fillStyle = '#44ffff';
    c.fillRect(W - 92, H - 232, 80, 16);
    c.fillStyle = '#0a0420';
    c.font = 'bold 11px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('furnitureExit'), W - 52, H - 221);
    /* One-shot top-right EXIT button */
    drawExitButton(c);
  }

  function handleShopInteriorClick(mx, my) {
    /* One-shot top-right EXIT button */
    if (hitExitButton(mx, my)) {
      Game.audio.play('select');
      return 'exit';
    }
    /* Exit door */
    if (hitButton(mx, my, W - 92, H - 232, 80, 122)) {
      Game.audio.play('select');
      return 'exit';
    }
    /* Item grid */
    var grid = shopGrid();
    for (var gi = 0; gi < grid.length; gi++) {
      var g = grid[gi];
      if (hitButton(mx, my, g.x + 4, g.y + 4, g.w - 8, g.h - 8)) {
        if (Game.shop && Game.shop.cart.length < Game.shop.MAX) {
          Game.shop.cart.push({ type: g.type });
          shopFlashItem = g.type;
          shopFlashTimer = 20;
          Game.audio.play('pickup');
        } else {
          Game.audio.play('select');
        }
        return null;
      }
    }
    return null;
  }

  /* Carry-overlay – bobbing icons of items in the cart, hovering above
     Momoko's head while she walks the world map. */
  function drawCarryOverlay(c, player, camX, camY) {
    if (!Game.shop || !Game.shop.cart || Game.shop.cart.length === 0) return;
    var bx = Math.round(player.x - camX) + (player.w || 28) / 2;
    var by = Math.round(player.y - camY) - 18;
    var t = Date.now() * 0.005;
    var bob = Math.sin(t * 2) * 2;
    /* Pillow under the items */
    c.save();
    c.globalAlpha = 0.55;
    c.fillStyle = '#000';
    c.beginPath();
    c.ellipse(bx, by + 14, 22, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    /* Stack items */
    var items = Game.shop.cart;
    for (var i = 0; i < items.length; i++) {
      var ix = bx + (i - (items.length - 1) / 2) * 22;
      var iy = by + bob - i * 1.5;
      /* Halo behind each item */
      c.save();
      c.globalAlpha = 0.55;
      var halo = c.createRadialGradient(ix, iy, 2, ix, iy, 18);
      halo.addColorStop(0, 'rgba(255,232,140,0.8)');
      halo.addColorStop(1, 'rgba(255,232,140,0)');
      c.fillStyle = halo;
      c.beginPath(); c.arc(ix, iy, 18, 0, Math.PI * 2); c.fill();
      c.restore();
      drawFurniture(c, items[i].type, ix, iy, 'palette');
    }
  }

  /* ============================================================ */
  /*                         QUEST HUD                              */
  /* ============================================================ */
  function drawQuestHUD(c, opts) {
    var showPauseHint = !opts || opts.showPauseHint !== false;
    /* Hotel zoo: guest stamp ledger */
    if (!(Game.engine && Game.engine.getStampCount)) return;
    var got = Game.engine.getStampCount();
    var tot = Game.engine.getStampTotal();
    /* Decrement the stamp-celebration timer so the pulse fades out. */
    var pulse = Game.flags && Game.flags.stampPulse;
    if (pulse && pulse.t > 0) pulse.t--;
    var pulseAmt = (pulse && pulse.t > 0) ? Math.max(0, pulse.t / 110) : 0;
    c.save();
    /* Ledger card top-right — bounces while a guest stamp is fresh.
       Scales about its right edge so the pulse grows into the screen
       instead of past the 800px canvas edge. */
    var bx = W - 168, by = 38, bw = 158, bh = 30;
    var scale = 1 + 0.18 * Math.sin(pulseAmt * Math.PI);
    c.save();
    c.translate(bx + bw, by + bh / 2);
    c.scale(scale, scale);
    c.translate(-(bx + bw), -(by + bh / 2));
    c.fillStyle = pulseAmt > 0 ? 'rgba(120, 80, 30, 0.95)' : 'rgba(58, 36, 24, 0.85)';
    c.fillRect(bx, by, bw, bh);
    c.strokeStyle = pulseAmt > 0 ? '#ffe680' : '#caa040';
    c.lineWidth = 2;
    c.strokeRect(bx, by, bw, bh);
    c.fillStyle = '#fff8e0';
    c.font = 'bold 12px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'left';
    fitFont(c, Game.i18n.t('hudGuests'), bw - 70, 12, 'bold');
    c.fillText(Game.i18n.t('hudGuests'), bx + 8, by + 19);
    c.fillStyle = got >= tot ? '#88ff88' : '#ffd24a';
    c.font = 'bold 13px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'right';
    c.fillText(got + ' / ' + tot, bx + bw - 8, by + 19);
    c.textAlign = 'left';
    c.restore();

    /* Stamp toast: a postcard-style "Met the Tiger!" pop-up that floats
       up briefly when a new guest is added. */
    if (pulse && pulse.t > 0) {
      var name = Game.i18n.t('animalName_' + pulse.species);
      var pre = Game.i18n.t('stampToastPrefix') || '';
      var post = Game.i18n.t('stampToastSuffix') || '';
      var msg = pre + name + post;
      var rise = (1 - pulseAmt) * 14;
      var alpha = Math.min(1, pulseAmt * 2.4);
      c.save();
      c.globalAlpha = alpha;
      /* Card width follows the message: stamp circle + text + padding. */
      c.font = 'bold 16px "M PLUS Rounded 1c", sans-serif';
      var tw = Math.max(200, Math.ceil(c.measureText(msg).width) + 70), th = 56;
      var tx = W / 2 - tw / 2, ty = 60 - rise;
      /* Card */
      c.fillStyle = '#fff4c0';
      c.fillRect(tx, ty, tw, th);
      c.strokeStyle = '#caa040';
      c.lineWidth = 3;
      c.strokeRect(tx, ty, tw, th);
      /* Stamp circle on the left */
      c.fillStyle = '#ff3aa0';
      c.beginPath();
      c.arc(tx + 26, ty + th / 2, 16, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.font = 'bold 14px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('★', tx + 26, ty + th / 2);
      /* Message */
      c.fillStyle = '#3a2418';
      c.font = 'bold 16px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(msg, tx + 52, ty + th / 2);
      c.restore();
    }

    /* Banner when complete */
    if (got >= tot) {
      c.fillStyle = '#ffd24a';
      c.font = 'bold 18px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'center';
      c.fillText(Game.i18n.t('hudAllGuests'), W / 2, 30);
      c.textAlign = 'left';
    }

    /* Mid-progress cheer toast — fired from stampGuest() at 10/26.
       Drifts down from the top with a chandelier-monkey emoji so it
       reads as the monkey shouting from above. */
    var cheer = Game.flags && Game.flags.cheerToast;
    if (cheer && cheer.t > 0) {
      cheer.t--;
      var cAlpha = Math.min(1, cheer.t / 40);
      var msg2 = Game.i18n.t(cheer.key) || '';
      c.save();
      c.globalAlpha = cAlpha;
      /* Width follows the message so long cheers stay on the card. */
      c.font = 'bold 14px "M PLUS Rounded 1c", sans-serif';
      var tw2 = Math.min(W - 40, Math.max(360, Math.ceil(c.measureText('🐒  ' + msg2).width) + 40)), th2 = 44;
      var tx2 = W / 2 - tw2 / 2, ty2 = 100 - (1 - cAlpha) * 12;
      c.fillStyle = '#fff4c0';
      roundRect(c, tx2, ty2, tw2, th2, 10);
      c.fill();
      c.strokeStyle = '#caa040';
      c.lineWidth = 3;
      roundRect(c, tx2, ty2, tw2, th2, 10);
      c.stroke();
      c.fillStyle = '#3a2418';
      c.font = 'bold 14px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('🐒  ' + msg2, tx2 + tw2 / 2, ty2 + th2 / 2);
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      c.restore();
    }

    /* Pause hint for desktop (touch already has a visible pause btn).
       Sized large enough to read at a glance — it's the only desktop
       discoverability cue for the menu. Suppressed inside animal rooms
       and cutscenes so it doesn't compete with the cozy art. */
    if (showPauseHint && Game.input && !Game.input.isTouch()) {
      c.save();
      c.fillStyle = 'rgba(255, 255, 255, 0.85)';
      c.font = 'bold 13px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'right';
      c.textBaseline = 'alphabetic';
      c.fillText(Game.i18n.t('pauseHint') || 'PAUSE (P)', W - 10, H - 10);
      c.restore();
    }
    c.restore();
  }

  /* ============================================================
   *  HOTEL ZOO: animal room interior, sleep cutscene, lobby intro.
   *  Animal rooms reuse the proven HOUSE_INTERIOR layout pattern —
   *  fixed-bounds floor, side-facing Momoko walk, and proximity
   *  interaction with a single fixed NPC (the animal). The bedroom
   *  has a Bed instead of an animal; interacting with it triggers
   *  the sleep cutscene.
   * ============================================================ */
  /* Walking bounds inside any animal room.
     Tighter than the original to keep the animal big and the walk short. */
  var ROOM_FLOOR_TOP    = 290;
  var ROOM_FLOOR_BOTTOM = H - 36;
  var ROOM_FLOOR_LEFT   = 110;
  var ROOM_FLOOR_RIGHT  = W - 200;
  /* Animal sprite scale inside a room */
  var ANIMAL_ROOM_SCALE = 2.6;

  /* Per-room state: position, facing, anim frame. */
  var roomState = {
    species: null,
    px: 200, py: 380, vx: 0, facing: 1,
    frame: 0, frameTimer: 0,
    /* The animal NPC inside the room (or the bed for the bedroom). */
    animal: null,
    bed: null,
    /* Cooldown so a single press doesn't double-fire interaction. */
    interactCooldown: 0,
    /* Set true after the player has successfully greeted the animal in this
       visit — drives the "← EXIT" hint that points kids back to the door. */
    hasGreeted: false,
    /* Tracks whether the follow-up dialogue line has been shown for this
       greeting cycle. Reset when the room is re-entered. */
    showedFollowUp: false,
  };

  /* Per-species wallpaper / accent colors for animal-room interiors. */
  function roomTheme(species) {
    var palettes = (Game.entities && Game.entities.ANIMAL_PALETTES) || {};
    var p = palettes[species];
    if (!p) {
      return { wallTop: '#5a3a22', wallMid: '#7a5028', wallBot: '#3a2418', accent: '#ffd24a', floor: '#aa6a2a', floorB: '#7a4a18' };
    }
    return {
      wallTop: p.shade,
      wallMid: p.body,
      wallBot: '#3a2418',
      accent: p.accent,
      floor: '#aa6a2a',
      floorB: '#7a4a18',
    };
  }

  function resetAnimalRoom(species) {
    roomState.species = species;
    roomState.px = ROOM_FLOOR_LEFT + 60;
    roomState.py = ROOM_FLOOR_BOTTOM - 30;
    roomState.vx = 0;
    roomState.facing = 1;
    roomState.frame = 0;
    roomState.frameTimer = 0;
    roomState.interactCooldown = 30;
    roomState.hasGreeted = false;
    roomState.showedFollowUp = false;
    if (species === 'bedroom') {
      roomState.animal = null;
      roomState.bed = (Game.entities && Game.entities.BedroomBed)
        ? new Game.entities.BedroomBed(W - 280, ROOM_FLOOR_BOTTOM - 60)
        : null;
    } else {
      /* Layout per the v0.8 design: animal centered in the room, themed
         bed pushed to the far-right wall so the habitat reads as the
         guest's actual suite (animal at home + their bed). */
      if (Game.entities && Game.entities.Animal) {
        /* Animal w=48; +scale 2.6 means ~125px wide on screen.
           Place its top-left so the visible center sits at W/2. */
        roomState.animal = new Game.entities.Animal(
          species,
          Math.round(W / 2 - 24),
          ROOM_FLOOR_BOTTOM - 100
        );
      }
      /* Decorative themed bed on the right wall — non-interactive, pure
         set dressing. The bedroom's real BedroomBed is the only one that
         triggers the sleep cutscene. */
      roomState.bed = {
        x: W - 130,
        y: ROOM_FLOOR_BOTTOM - 50,
        w: 100,
        h: 50,
        decorative: true,
      };
    }
  }

  /* ============================================================
   *  HABITAT BACKGROUNDS — paint each species' natural environment
   *  behind the room. Each species gets its own scene so the room
   *  feels like the matching zoo exhibit.
   * ============================================================ */
  var HABITAT_BY_SPECIES = {
    elephant: 'savanna',  lion: 'savanna',     tiger: 'jungle',
    bear: 'pineForest',   wolf: 'snowyMtn',    giraffe: 'savanna',
    zebra: 'savanna',     eagle: 'mountain',   fox: 'autumnForest',
    owl: 'nightTree',     panda: 'bamboo',     penguin: 'arctic',
    bunny: 'meadow',      cat: 'cozyRoom',     dog: 'backyard',
    seaOtter: 'kelpForest', kangaroo: 'outback', unicorn: 'rainbowGrove',
    alien: 'starship',    monkey: 'jungle',
    koala: 'eucalyptus',  hippo: 'riverBank',  rhino: 'savanna',
    polarBear: 'arctic',  frog: 'lilyPond',    gorilla: 'jungle',
    bedroom: 'bedroom',
  };

  /* Stable pseudo-random 0..1 from a number (seeded room props). */
  function hash01(n) {
    var s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function paintSky(c, top, mid, bot) {
    var grad = c.createLinearGradient(0, 0, 0, ROOM_FLOOR_TOP);
    grad.addColorStop(0, top);
    if (mid) grad.addColorStop(0.6, mid);
    grad.addColorStop(1, bot);
    c.fillStyle = grad;
    c.fillRect(0, 0, W, ROOM_FLOOR_TOP);
    /* Haze along the horizon so far props sit back in the air */
    var hz = c.createLinearGradient(0, ROOM_FLOOR_TOP - 60, 0, ROOM_FLOOR_TOP);
    hz.addColorStop(0, 'rgba(255,255,255,0)');
    hz.addColorStop(1, 'rgba(255,255,255,0.18)');
    c.fillStyle = hz;
    c.fillRect(0, ROOM_FLOOR_TOP - 60, W, 60);
  }

  /* Floor plane: gradient, a shaded back edge, texture flecks that
     shrink and tighten toward the back (so it recedes), and a darker
     front lip. */
  function paintGround(c, top, bot, stripe) {
    var g = c.createLinearGradient(0, ROOM_FLOOR_TOP, 0, H);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    c.fillStyle = g;
    c.fillRect(0, ROOM_FLOOR_TOP, W, H - ROOM_FLOOR_TOP);
    var be = c.createLinearGradient(0, ROOM_FLOOR_TOP, 0, ROOM_FLOOR_TOP + 18);
    be.addColorStop(0, 'rgba(0,0,0,0.2)');
    be.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = be;
    c.fillRect(0, ROOM_FLOOR_TOP, W, 18);
    c.fillStyle = 'rgba(0,0,0,0.09)';
    for (var r = 0; r < 5; r++) {
      var ry = ROOM_FLOOR_TOP + 12 + r * 16 + r * r * 4;
      var sp = 34 + r * 16, len = 6 + r * 4, th = 1 + r * 0.5;
      for (var fx = (r * 37) % sp; fx < W; fx += sp) {
        c.fillRect(fx + hash01(fx + r * 91) * 12, ry + hash01(fx * 3 + r) * 6, len, th);
      }
    }
    if (stripe) {
      c.fillStyle = stripe;
      for (var s = 0; s < W; s += 24) {
        c.fillRect(s, ROOM_FLOOR_TOP + 4, 12, 1.6);
      }
    }
    var fl = c.createLinearGradient(0, H - 40, 0, H);
    fl.addColorStop(0, 'rgba(0,0,0,0)');
    fl.addColorStop(1, 'rgba(0,0,0,0.22)');
    c.fillStyle = fl;
    c.fillRect(0, H - 40, W, 40);
  }

  /* Clumps of grass blades (back rows smaller) */
  function paintGrassTufts(c, col, y, count, size, seed) {
    c.strokeStyle = col;
    c.lineWidth = Math.max(1, size * 0.18);
    c.lineCap = 'round';
    for (var t = 0; t < count; t++) {
      var tx = (t + hash01(seed + t) * 0.8) * (W / count);
      var ty = y + hash01(seed + t * 7) * size * 0.8;
      for (var b = -2; b <= 2; b++) {
        c.beginPath();
        c.moveTo(tx + b * size * 0.12, ty);
        c.quadraticCurveTo(tx + b * size * 0.2, ty - size * 0.6, tx + b * size * 0.45, ty - size * (1 - Math.abs(b) * 0.15));
        c.stroke();
      }
    }
    c.lineCap = 'butt';
  }

  /* Flat-topped acacia with a layered umbrella canopy */
  function paintAcacia(c, x, groundY, s, dark) {
    c.fillStyle = dark ? '#6a4a2a' : '#4a2e14';
    c.beginPath();
    c.moveTo(x - 6 * s, groundY);
    c.quadraticCurveTo(x - 3 * s, groundY - 60 * s, x - 34 * s, groundY - 120 * s);
    c.lineTo(x - 28 * s, groundY - 122 * s);
    c.quadraticCurveTo(x + 2 * s, groundY - 80 * s, x + 4 * s, groundY - 100 * s);
    c.quadraticCurveTo(x + 18 * s, groundY - 116 * s, x + 40 * s, groundY - 124 * s);
    c.lineTo(x + 42 * s, groundY - 120 * s);
    c.quadraticCurveTo(x + 12 * s, groundY - 90 * s, x + 6 * s, groundY);
    c.closePath();
    c.fill();
    var layers = dark ? [['#9a8a5a', 0]] : [['#3e5a22', 0], ['#5a7e30', -6], ['#7aa040', -11]];
    for (var l = 0; l < layers.length; l++) {
      c.fillStyle = layers[l][0];
      var ly = groundY - 128 * s + layers[l][1] * s;
      c.beginPath();
      c.ellipse(x, ly, 90 * s, 14 * s, 0, 0, Math.PI * 2);
      for (var k = -3; k <= 3; k++) {
        c.moveTo(x + k * 24 * s + 22 * s, ly - 4 * s);
        c.ellipse(x + k * 24 * s, ly - 4 * s, 22 * s, (10 + (k % 2 === 0 ? 3 : 0)) * s, 0, 0, Math.PI * 2);
      }
      c.fill();
    }
  }

  /* Tall bookcase stuffed with seeded books */
  function paintBookcase(c, x, y, w, h, seed) {
    var bookCols = ['#c84a4a', '#3a6aa8', '#e0b040', '#4a8a4a', '#8a4aa0', '#e07a30', '#2a8a8a', '#f0e0c0'];
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(x + 6, y + 6, w, h);
    c.fillStyle = '#5a3418';
    c.fillRect(x, y, w, h);
    c.fillStyle = '#3a200c';
    c.fillRect(x + 6, y + 8, w - 12, h - 14);
    c.fillStyle = '#7a4a24';
    c.fillRect(x - 4, y - 6, w + 8, 8);
    var shelves = Math.floor((h - 14) / 40);
    for (var sh = 0; sh < shelves; sh++) {
      var sy = y + 8 + (sh + 1) * 40;
      var bx = x + 8;
      var n = 0;
      while (bx < x + w - 12) {
        var r = hash01(seed + sh * 31 + n * 7);
        var bw = 6 + Math.floor(r * 6);
        var bh = 24 + Math.floor(hash01(seed + sh * 13 + n * 3) * 12);
        if (bx + bw > x + w - 8) break;
        if (r > 0.9 && bx + bh < x + w - 8) {
          /* A book lying flat */
          c.fillStyle = bookCols[(n + sh) % bookCols.length];
          c.fillRect(bx, sy - 7, bh, 7);
          bx += bh + 2;
        } else {
          c.fillStyle = bookCols[Math.floor(r * 97) % bookCols.length];
          c.fillRect(bx, sy - bh, bw, bh);
          c.fillStyle = 'rgba(255,255,255,0.35)';
          c.fillRect(bx + 1, sy - bh + 4, bw - 2, 1.5);
          c.fillRect(bx + 1, sy - 7, bw - 2, 1);
          c.fillStyle = 'rgba(0,0,0,0.2)';
          c.fillRect(bx + bw - 1.5, sy - bh, 1.5, bh);
          bx += bw + 1;
        }
        n++;
      }
      c.fillStyle = '#7a4a24';
      c.fillRect(x + 4, sy, w - 8, 4);
      c.fillStyle = '#9a6a3a';
      c.fillRect(x + 4, sy, w - 8, 1);
    }
  }

  function paintHabitat(c, habitat) {
    if (habitat === 'savanna') {
      paintSky(c, '#ffa860', '#ffd28a', '#ffe8b8');
      /* Low sun with halo */
      var sunG = c.createRadialGradient(W - 150, 110, 10, W - 150, 110, 90);
      sunG.addColorStop(0, 'rgba(255,248,210,0.9)');
      sunG.addColorStop(1, 'rgba(255,248,210,0)');
      c.fillStyle = sunG;
      c.fillRect(W - 240, 20, 180, 180);
      c.fillStyle = '#fff4c8';
      c.beginPath(); c.arc(W - 150, 110, 30, 0, Math.PI * 2); c.fill();
      /* Distant hills, two layers */
      c.fillStyle = '#e8b070';
      c.beginPath(); c.ellipse(200, ROOM_FLOOR_TOP + 10, 300, 70, 0, Math.PI, 0); c.fill();
      c.beginPath(); c.ellipse(700, ROOM_FLOOR_TOP + 10, 260, 56, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#d4964e';
      c.beginPath(); c.ellipse(480, ROOM_FLOOR_TOP + 14, 280, 44, 0, Math.PI, 0); c.fill();
      /* Tiny far acacias on the ridge */
      paintAcacia(c, 560, ROOM_FLOOR_TOP - 26, 0.22, true);
      paintAcacia(c, 640, ROOM_FLOOR_TOP - 22, 0.16, true);
      paintGround(c, '#d0a454', '#8a5a1e');
      paintGrassTufts(c, '#b08a3a', ROOM_FLOOR_TOP + 8, 16, 12, 3);
      /* Big acacia, front-left */
      paintAcacia(c, 150, ROOM_FLOOR_TOP + 16, 1, false);
      /* Termite mound */
      c.fillStyle = '#a8683a';
      c.beginPath();
      c.moveTo(W - 300, ROOM_FLOOR_TOP + 24);
      c.quadraticCurveTo(W - 296, ROOM_FLOOR_TOP - 30, W - 284, ROOM_FLOOR_TOP - 40);
      c.quadraticCurveTo(W - 272, ROOM_FLOOR_TOP - 20, W - 262, ROOM_FLOOR_TOP + 24);
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.15)';
      c.beginPath(); c.ellipse(W - 278, ROOM_FLOOR_TOP - 6, 6, 18, 0.1, 0, Math.PI * 2); c.fill();
      paintGrassTufts(c, '#9a7428', H - 30, 9, 22, 11);
    } else if (habitat === 'jungle') {
      paintSky(c, '#1a3a18', '#2a5028', '#3a6838');
      paintGround(c, '#3a4818', '#1f2810');
      /* Vines hanging from top */
      c.strokeStyle = '#4a8038'; c.lineWidth = 2;
      for (var v = 0; v < 8; v++) {
        var vx = 60 + v * 100;
        c.beginPath();
        c.moveTo(vx, 0);
        c.bezierCurveTo(vx + 10, 60, vx - 10, 100, vx, 160);
        c.stroke();
        c.fillStyle = '#5fa040';
        c.beginPath(); c.ellipse(vx + 4, 80, 6, 3, 0.4, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(vx - 4, 130, 6, 3, -0.4, 0, Math.PI * 2); c.fill();
      }
      /* Big tropical leaves on sides */
      c.fillStyle = '#3a6028';
      for (var lf = 0; lf < 6; lf++) {
        var lfa = -Math.PI / 2 + lf * 0.5;
        c.beginPath();
        c.ellipse(20, ROOM_FLOOR_TOP - 30 + lf * 6, 40, 10, lfa, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.ellipse(W - 20, ROOM_FLOOR_TOP - 30 + lf * 6, 40, 10, -lfa, 0, Math.PI * 2);
        c.fill();
      }
    } else if (habitat === 'pineForest') {
      paintSky(c, '#3a4868', '#5a6878', '#7a8898');
      paintGround(c, '#3a4828', '#1a2010');
      /* Pine trees in the distance */
      for (var pt = 0; pt < 6; pt++) {
        var ptx = 80 + pt * 110;
        c.fillStyle = '#1a3018';
        c.beginPath();
        c.moveTo(ptx, ROOM_FLOOR_TOP - 80);
        c.lineTo(ptx - 28, ROOM_FLOOR_TOP);
        c.lineTo(ptx + 28, ROOM_FLOOR_TOP);
        c.closePath();
        c.fill();
        c.fillStyle = '#2a4018';
        c.beginPath();
        c.moveTo(ptx, ROOM_FLOOR_TOP - 60);
        c.lineTo(ptx - 22, ROOM_FLOOR_TOP - 20);
        c.lineTo(ptx + 22, ROOM_FLOOR_TOP - 20);
        c.closePath();
        c.fill();
      }
    } else if (habitat === 'snowyMtn') {
      paintSky(c, '#5a7898', '#7a98b8', '#cce0ee');
      paintGround(c, '#e8eef4', '#a8b8c8');
      /* Mountain peaks */
      c.fillStyle = '#7a98b8';
      c.beginPath();
      c.moveTo(0, ROOM_FLOOR_TOP);
      c.lineTo(180, 120); c.lineTo(360, ROOM_FLOOR_TOP);
      c.lineTo(420, 90);  c.lineTo(620, ROOM_FLOOR_TOP);
      c.lineTo(720, 110); c.lineTo(W, ROOM_FLOOR_TOP);
      c.closePath();
      c.fill();
      /* Snow caps */
      c.fillStyle = '#ffffff';
      c.beginPath(); c.moveTo(160, 138); c.lineTo(180, 120); c.lineTo(200, 138); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(400, 108); c.lineTo(420, 90);  c.lineTo(440, 108); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(700, 128); c.lineTo(720, 110); c.lineTo(740, 128); c.closePath(); c.fill();
      /* Snowflakes */
      c.fillStyle = '#ffffff';
      for (var sf = 0; sf < 30; sf++) {
        c.beginPath();
        c.arc(((sf * 73) % W), ((sf * 41 + Date.now() * 0.05) % ROOM_FLOOR_TOP), 1.2, 0, Math.PI * 2);
        c.fill();
      }
    } else if (habitat === 'mountain') {
      paintSky(c, '#3a78a8', '#88c8e8', '#ffeeb0');
      paintGround(c, '#7a6a48', '#3a3018');
      /* Distant peaks */
      c.fillStyle = '#5a4838';
      c.beginPath();
      c.moveTo(0, ROOM_FLOOR_TOP);
      c.lineTo(200, 80); c.lineTo(380, ROOM_FLOOR_TOP);
      c.closePath();
      c.fill();
      /* Snow tip */
      c.fillStyle = '#ffffff';
      c.beginPath(); c.moveTo(180, 100); c.lineTo(200, 80); c.lineTo(220, 100); c.closePath(); c.fill();
      /* Eagle nest twigs */
      c.strokeStyle = '#5a3018'; c.lineWidth = 2;
      for (var tw = 0; tw < 10; tw++) {
        c.beginPath();
        c.moveTo(W - 200 + tw * 4, ROOM_FLOOR_BOTTOM - 18);
        c.lineTo(W - 180 + tw * 4, ROOM_FLOOR_BOTTOM - 14);
        c.stroke();
      }
    } else if (habitat === 'autumnForest') {
      paintSky(c, '#a85838', '#cc7a48', '#e89868');
      paintGround(c, '#7a4818', '#3a2010');
      /* Trees */
      for (var ft = 0; ft < 5; ft++) {
        var ftx = 60 + ft * 130;
        c.fillStyle = '#3a2008';
        c.fillRect(ftx - 4, ROOM_FLOOR_TOP - 80, 8, 80);
        c.fillStyle = '#cc6020';
        c.beginPath(); c.arc(ftx, ROOM_FLOOR_TOP - 90, 26, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#e88840';
        c.beginPath(); c.arc(ftx + 6, ROOM_FLOOR_TOP - 95, 18, 0, Math.PI * 2); c.fill();
      }
      /* Falling leaves */
      c.fillStyle = '#cc7a30';
      for (var fal = 0; fal < 10; fal++) {
        var flx = ((fal * 87 + Date.now() * 0.04) % W);
        var fly = ((fal * 53 + Date.now() * 0.06) % ROOM_FLOOR_TOP);
        c.beginPath(); c.ellipse(flx, fly, 3, 2, fal, 0, Math.PI * 2); c.fill();
      }
    } else if (habitat === 'nightTree') {
      /* Owl's reading nook: panelled study, moonlit round window with
         a branch across it, bookcases, armchair and a reading lamp */
      var nkG = c.createLinearGradient(0, 0, 0, ROOM_FLOOR_TOP);
      nkG.addColorStop(0, '#2a3a34');
      nkG.addColorStop(1, '#3e5048');
      c.fillStyle = nkG;
      c.fillRect(0, 0, W, ROOM_FLOOR_TOP);
      c.fillStyle = 'rgba(255,255,255,0.05)';
      for (var nkp = 0; nkp < W; nkp += 48) c.fillRect(nkp, 0, 2, ROOM_FLOOR_TOP);
      c.fillStyle = '#4a2c16';
      c.fillRect(0, ROOM_FLOOR_TOP - 70, W, 70);
      c.fillStyle = '#6a4224';
      c.fillRect(0, ROOM_FLOOR_TOP - 72, W, 6);
      for (var wp = 0; wp < W; wp += 80) {
        c.strokeStyle = 'rgba(0,0,0,0.3)';
        c.lineWidth = 1.5;
        c.strokeRect(wp + 10, ROOM_FLOOR_TOP - 58, 60, 46);
      }
      /* Round window with the moon */
      var rwx = W / 2, rwy = 108, rwr = 62;
      c.save();
      c.beginPath(); c.arc(rwx, rwy, rwr, 0, Math.PI * 2); c.clip();
      var rwG = c.createLinearGradient(0, rwy - rwr, 0, rwy + rwr);
      rwG.addColorStop(0, '#141a44');
      rwG.addColorStop(1, '#3a3a78');
      c.fillStyle = rwG;
      c.fillRect(rwx - rwr, rwy - rwr, rwr * 2, rwr * 2);
      c.fillStyle = '#fff8e0';
      for (var nst = 0; nst < 14; nst++) {
        c.fillRect(rwx - rwr + hash01(nst) * rwr * 2, rwy - rwr + hash01(nst + 30) * rwr * 1.4, 1.4, 1.4);
      }
      var mnG = c.createRadialGradient(rwx + 20, rwy - 16, 6, rwx + 20, rwy - 16, 46);
      mnG.addColorStop(0, 'rgba(255,248,200,0.6)');
      mnG.addColorStop(1, 'rgba(255,248,200,0)');
      c.fillStyle = mnG;
      c.fillRect(rwx - 30, rwy - 66, 100, 100);
      c.fillStyle = '#fff4c0';
      c.beginPath(); c.arc(rwx + 20, rwy - 16, 18, 0, Math.PI * 2); c.fill();
      /* Branch silhouette */
      c.strokeStyle = '#141008';
      c.lineWidth = 6;
      c.beginPath(); c.moveTo(rwx - rwr, rwy + 30); c.quadraticCurveTo(rwx - 10, rwy + 14, rwx + rwr, rwy + 34); c.stroke();
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(rwx - 20, rwy + 20); c.lineTo(rwx - 36, rwy - 4); c.stroke();
      c.fillStyle = '#141008';
      for (var lv = 0; lv < 6; lv++) {
        c.beginPath(); c.ellipse(rwx - 40 + lv * 16, rwy + 20 + (lv % 2) * 8, 6, 3, lv, 0, Math.PI * 2); c.fill();
      }
      c.restore();
      c.strokeStyle = '#7a4a24'; c.lineWidth = 10;
      c.beginPath(); c.arc(rwx, rwy, rwr + 3, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#a06a34'; c.lineWidth = 3;
      c.beginPath(); c.arc(rwx, rwy, rwr + 1, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(rwx - rwr, rwy); c.lineTo(rwx + rwr, rwy); c.moveTo(rwx, rwy - rwr); c.lineTo(rwx, rwy + rwr); c.stroke();
      /* Bookcases either side */
      paintBookcase(c, 96, 60, 140, ROOM_FLOOR_TOP - 54, 5);
      paintBookcase(c, W - 250, 60, 140, ROOM_FLOOR_TOP - 54, 17);
      /* Floor: planks + round rug */
      paintGround(c, '#7a5030', '#4a2c16');
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1;
      for (var nfl = 0; nfl < 5; nfl++) {
        var nfy = ROOM_FLOOR_TOP + 10 + nfl * 14 + nfl * nfl * 4;
        c.beginPath(); c.moveTo(0, nfy); c.lineTo(W, nfy); c.stroke();
      }
      c.fillStyle = '#7a2a3a';
      c.beginPath(); c.ellipse(W / 2, ROOM_FLOOR_BOTTOM - 10, 230, 34, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#e0b860'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(W / 2, ROOM_FLOOR_BOTTOM - 10, 214, 28, 0, 0, Math.PI * 2); c.stroke();
      /* Armchair + reading lamp by the right bookcase */
      var acx = W - 330, acy = ROOM_FLOOR_TOP + 40;
      c.fillStyle = '#5a7a3a';
      c.beginPath(); c.moveTo(acx - 30, acy); c.lineTo(acx - 26, acy - 52); c.quadraticCurveTo(acx, acy - 64, acx + 26, acy - 52); c.lineTo(acx + 30, acy); c.closePath(); c.fill();
      c.fillStyle = '#6a8a48';
      c.fillRect(acx - 36, acy - 22, 72, 22);
      c.beginPath(); c.arc(acx - 34, acy - 20, 8, 0, Math.PI * 2); c.arc(acx + 34, acy - 20, 8, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3a2010';
      c.fillRect(acx - 30, acy, 4, 8); c.fillRect(acx + 26, acy, 4, 8);
      c.fillStyle = '#c84a4a';
      c.fillRect(acx - 10, acy - 30, 18, 6); /* open book on the cushion */
      c.fillStyle = '#fff4dc';
      c.fillRect(acx - 9, acy - 32, 16, 3);
      var rlx = acx + 56;
      c.fillStyle = '#3a2a1a';
      c.fillRect(rlx - 1.5, acy - 96, 3, 96);
      c.fillRect(rlx - 10, acy - 2, 20, 4);
      c.save();
      c.globalCompositeOperation = 'lighter';
      var rlG = c.createRadialGradient(rlx, acy - 92, 4, rlx, acy - 92, 110);
      rlG.addColorStop(0, 'rgba(255,200,120,0.35)');
      rlG.addColorStop(1, 'rgba(255,200,120,0)');
      c.fillStyle = rlG;
      c.fillRect(rlx - 110, acy - 202, 220, 220);
      c.restore();
      c.fillStyle = '#e8c070';
      c.beginPath(); c.moveTo(rlx - 14, acy - 90); c.lineTo(rlx - 8, acy - 110); c.lineTo(rlx + 8, acy - 110); c.lineTo(rlx + 14, acy - 90); c.closePath(); c.fill();
    } else if (habitat === 'bamboo') {
      paintSky(c, '#3a5028', '#5a7028', '#88a040');
      paintGround(c, '#5a7028', '#3a4818');
      /* Bamboo stalks */
      c.fillStyle = '#88a040';
      for (var bm = 0; bm < 12; bm++) {
        var bmx = 50 + bm * 60;
        c.fillRect(bmx, 30, 6, ROOM_FLOOR_TOP - 30);
        c.strokeStyle = '#3a4818';
        c.lineWidth = 1;
        for (var bj = 0; bj < 6; bj++) {
          c.beginPath();
          c.moveTo(bmx, 60 + bj * 30); c.lineTo(bmx + 6, 60 + bj * 30);
          c.stroke();
        }
      }
      /* Bamboo leaves */
      c.fillStyle = '#5a8038';
      for (var bml = 0; bml < 8; bml++) {
        var bmlx = 80 + bml * 90;
        c.beginPath(); c.ellipse(bmlx, 50 + (bml % 2) * 20, 12, 4, bml * 0.4, 0, Math.PI * 2); c.fill();
      }
    } else if (habitat === 'arctic') {
      paintSky(c, '#5a78b8', '#a0c4e4', '#e4f2fa');
      /* Aurora ribbons */
      c.save();
      c.globalCompositeOperation = 'lighter';
      var auT = Date.now() * 0.0006;
      for (var au = 0; au < 3; au++) {
        c.strokeStyle = au === 1 ? 'rgba(160,120,255,0.1)' : 'rgba(120,255,180,0.12)';
        c.lineWidth = 30 - au * 6;
        c.lineJoin = 'round';
        c.beginPath();
        for (var aux = -20; aux <= W + 20; aux += 40) {
          var auy = 50 + au * 22 + Math.sin(aux * 0.012 + auT + au) * 16;
          if (aux === -20) c.moveTo(aux, auy); else c.lineTo(aux, auy);
        }
        c.stroke();
      }
      c.restore();
      /* Far icebergs with a lit face and a shadow face */
      var bergs = [[120, 70, 46], [380, 50, 30], [W - 150, 80, 56]];
      for (var bg = 0; bg < bergs.length; bg++) {
        var bgx = bergs[bg][0], bgw = bergs[bg][1], bgh = bergs[bg][2];
        c.fillStyle = '#f4faff';
        c.beginPath(); c.moveTo(bgx - bgw, ROOM_FLOOR_TOP); c.lineTo(bgx - bgw * 0.3, ROOM_FLOOR_TOP - bgh); c.lineTo(bgx + bgw * 0.1, ROOM_FLOOR_TOP - bgh * 0.8); c.lineTo(bgx, ROOM_FLOOR_TOP); c.closePath(); c.fill();
        c.fillStyle = '#b8d4ea';
        c.beginPath(); c.moveTo(bgx, ROOM_FLOOR_TOP); c.lineTo(bgx + bgw * 0.1, ROOM_FLOOR_TOP - bgh * 0.8); c.lineTo(bgx + bgw * 0.5, ROOM_FLOOR_TOP - bgh * 0.5); c.lineTo(bgx + bgw, ROOM_FLOOR_TOP); c.closePath(); c.fill();
      }
      /* Open water band with drifting floes */
      var wTop = ROOM_FLOOR_TOP, wBot = ROOM_FLOOR_TOP + 40;
      var awG = c.createLinearGradient(0, wTop, 0, wBot);
      awG.addColorStop(0, '#4a88b8');
      awG.addColorStop(1, '#2a5a8a');
      c.fillStyle = awG;
      c.fillRect(0, wTop, W, wBot - wTop);
      var flT = Date.now() * 0.002;
      c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 1;
      for (var rp2 = 0; rp2 < 9; rp2++) {
        var rpx = (rp2 * 97 + flT * 6) % (W + 40) - 20;
        c.beginPath(); c.moveTo(rpx, wTop + 8 + (rp2 % 3) * 9); c.lineTo(rpx + 18, wTop + 8 + (rp2 % 3) * 9); c.stroke();
      }
      var floes = [[70, 12, 34], [250, 22, 46], [430, 10, 28], [600, 24, 40], [740, 14, 30]];
      for (var fo = 0; fo < floes.length; fo++) {
        var fox = floes[fo][0] + Math.sin(flT * 0.5 + fo) * 4;
        var foy = wTop + floes[fo][1] + Math.sin(flT + fo * 1.7) * 1.5;
        var fow = floes[fo][2];
        c.fillStyle = '#9ec2de';
        c.beginPath(); c.ellipse(fox, foy + 3, fow, 5, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath(); c.ellipse(fox, foy, fow, 5, 0, 0, Math.PI * 2); c.fill();
      }
      /* Ice shelf (the walkable floor) with a crisp edge */
      var shG = c.createLinearGradient(0, wBot, 0, H);
      shG.addColorStop(0, '#ffffff');
      shG.addColorStop(1, '#c4dcee');
      c.fillStyle = shG;
      c.beginPath();
      c.moveTo(0, wBot);
      for (var sx2 = 0; sx2 <= W; sx2 += 40) c.lineTo(sx2, wBot - 3 + hash01(sx2) * 6);
      c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
      c.fillStyle = '#8ab4d8';
      c.fillRect(0, wBot + 2, W, 3);
      c.strokeStyle = 'rgba(120,160,200,0.45)'; c.lineWidth = 1;
      for (var ck = 0; ck < 7; ck++) {
        var ckx = 60 + ck * 110, cky = wBot + 30 + (ck % 3) * 26;
        c.beginPath(); c.moveTo(ckx, cky); c.lineTo(ckx + 14, cky + 6); c.lineTo(ckx + 30, cky + 2); c.stroke();
      }
    } else if (habitat === 'meadow') {
      paintSky(c, '#88c8e0', '#cce0ee', '#fff8c0');
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(150, 70, 16, 0, Math.PI * 2); c.arc(176, 62, 22, 0, Math.PI * 2); c.arc(202, 72, 14, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(W - 240, 100, 12, 0, Math.PI * 2); c.arc(W - 220, 94, 16, 0, Math.PI * 2); c.arc(W - 202, 102, 10, 0, Math.PI * 2); c.fill();
      /* Rolling hills, two layers, with a tiny far tree */
      c.fillStyle = '#a8d880';
      c.beginPath(); c.ellipse(180, ROOM_FLOOR_TOP + 10, 320, 66, 0, Math.PI, 0); c.fill();
      c.beginPath(); c.ellipse(690, ROOM_FLOOR_TOP + 10, 280, 54, 0, Math.PI, 0); c.fill();
      c.fillStyle = '#5a3a20';
      c.fillRect(598, ROOM_FLOOR_TOP - 54, 3, 14);
      c.fillStyle = '#7ab858';
      c.beginPath(); c.arc(599.5, ROOM_FLOOR_TOP - 60, 10, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#8ccc60';
      c.beginPath(); c.ellipse(440, ROOM_FLOOR_TOP + 14, 300, 40, 0, Math.PI, 0); c.fill();
      paintGround(c, '#7ac848', '#4a8028');
      paintGrassTufts(c, '#5aa838', ROOM_FLOOR_TOP + 10, 14, 12, 5);
      /* Carrots in the ground */
      for (var cr = 0; cr < 6; cr++) {
        var crx = 80 + cr * 110;
        c.fillStyle = '#ff8830';
        c.beginPath();
        c.moveTo(crx, ROOM_FLOOR_BOTTOM - 4);
        c.lineTo(crx - 3, ROOM_FLOOR_BOTTOM - 16);
        c.lineTo(crx + 3, ROOM_FLOOR_BOTTOM - 16);
        c.closePath();
        c.fill();
        c.fillStyle = '#3a8a30';
        c.fillRect(crx - 1, ROOM_FLOOR_BOTTOM - 22, 0.8, 6);
        c.fillRect(crx + 0.2, ROOM_FLOOR_BOTTOM - 22, 0.8, 6);
      }
      /* Flowers */
      var flowerColors = ['#ff66aa', '#ffd24a', '#ff8888', '#ddaaff'];
      for (var fl = 0; fl < 16; fl++) {
        c.fillStyle = flowerColors[fl % flowerColors.length];
        var fx = 30 + fl * 50;
        c.beginPath(); c.arc(fx, ROOM_FLOOR_BOTTOM - 8, 2.4, 0, Math.PI * 2); c.fill();
      }
    } else if (habitat === 'cozyRoom') {
      paintSky(c, '#cca0a0', '#e0c0c0', '#f0d8d8');
      paintGround(c, '#ad7838', '#7a4818');
      /* Patterned wallpaper — vertical pinstripes for parlor feel */
      c.save();
      c.globalAlpha = 0.18;
      c.strokeStyle = '#7a3050';
      c.lineWidth = 1.4;
      for (var ws = 0; ws < 22; ws++) {
        c.beginPath();
        c.moveTo(ws * 38 + 8, 0);
        c.lineTo(ws * 38 + 8, ROOM_FLOOR_TOP);
        c.stroke();
      }
      c.restore();
      /* Pendant lamp from the ceiling — the same warm glow as the
         sleep cutscene, signalling "comfy" without subtlety. */
      c.strokeStyle = '#5a3a18'; c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(W / 2 + 80, 0); c.lineTo(W / 2 + 80, 90);
      c.stroke();
      c.fillStyle = '#caa040';
      c.beginPath();
      c.moveTo(W / 2 + 60, 90); c.lineTo(W / 2 + 100, 90);
      c.lineTo(W / 2 + 92, 116); c.lineTo(W / 2 + 68, 116); c.closePath(); c.fill();
      c.save();
      c.globalAlpha = 0.55;
      var lampG = c.createRadialGradient(W / 2 + 80, 116, 6, W / 2 + 80, 116, 160);
      lampG.addColorStop(0, 'rgba(255, 224, 160, 0.7)');
      lampG.addColorStop(1, 'rgba(255, 224, 160, 0)');
      c.fillStyle = lampG;
      c.beginPath(); c.arc(W / 2 + 80, 116, 160, 0, Math.PI * 2); c.fill();
      c.restore();
      /* Window with city skyline silhouette + warm sash */
      c.fillStyle = '#3a2058';
      c.fillRect(120, 60, 120, 90);
      /* Tiny skyline */
      c.fillStyle = '#1a0e2a';
      for (var sk = 0; sk < 7; sk++) {
        var skh = 10 + (sk * 7) % 26;
        c.fillRect(124 + sk * 16, 60 + 90 - skh, 12, skh);
      }
      /* Stars */
      c.fillStyle = '#fff8c0';
      for (var stt = 0; stt < 8; stt++) {
        c.beginPath();
        c.arc(128 + stt * 12, 70 + (stt * 7) % 30, 1, 0, Math.PI * 2);
        c.fill();
      }
      /* Window frame */
      c.strokeStyle = '#7a3050'; c.lineWidth = 4;
      c.strokeRect(120, 60, 120, 90);
      c.beginPath(); c.moveTo(180, 60); c.lineTo(180, 150); c.stroke();
      c.beginPath(); c.moveTo(120, 105); c.lineTo(240, 105); c.stroke();
      /* Curtains */
      c.fillStyle = '#aa4488';
      c.beginPath();
      c.moveTo(108, 50); c.lineTo(140, 50); c.lineTo(132, 160); c.lineTo(112, 158);
      c.closePath(); c.fill();
      c.beginPath();
      c.moveTo(220, 50); c.lineTo(252, 50); c.lineTo(248, 158); c.lineTo(228, 160);
      c.closePath(); c.fill();
      /* Plush oval rug — much bigger than the old strip, with a border */
      c.fillStyle = '#aa4488';
      c.beginPath();
      c.ellipse(W / 2, ROOM_FLOOR_BOTTOM - 6, 200, 26, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#cc66a0';
      c.beginPath();
      c.ellipse(W / 2, ROOM_FLOOR_BOTTOM - 6, 184, 20, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffd6e8';
      c.beginPath();
      c.ellipse(W / 2, ROOM_FLOOR_BOTTOM - 6, 80, 8, 0, 0, Math.PI * 2);
      c.fill();
      /* Side table with steaming teacup */
      var tt_x = W / 2 - 250, tt_y = ROOM_FLOOR_BOTTOM - 50;
      c.fillStyle = '#7a4828';
      c.fillRect(tt_x, tt_y, 60, 6);
      c.fillRect(tt_x + 4, tt_y + 6, 6, 38);
      c.fillRect(tt_x + 50, tt_y + 6, 6, 38);
      /* Teacup */
      c.fillStyle = '#fff8e0';
      c.beginPath();
      c.moveTo(tt_x + 18, tt_y - 14);
      c.lineTo(tt_x + 42, tt_y - 14);
      c.lineTo(tt_x + 38, tt_y - 2);
      c.lineTo(tt_x + 22, tt_y - 2);
      c.closePath(); c.fill();
      /* Cup handle */
      c.strokeStyle = '#fff8e0'; c.lineWidth = 2;
      c.beginPath(); c.arc(tt_x + 44, tt_y - 8, 4, -Math.PI / 2, Math.PI / 2); c.stroke();
      /* Saucer */
      c.fillStyle = '#fff8e0';
      c.beginPath();
      c.ellipse(tt_x + 30, tt_y - 1, 14, 3, 0, 0, Math.PI * 2);
      c.fill();
      /* Cup tea ring */
      c.fillStyle = '#aa6a3a';
      c.beginPath();
      c.ellipse(tt_x + 30, tt_y - 11, 9, 2, 0, 0, Math.PI * 2);
      c.fill();
      /* Steam wisps from the cup */
      c.save();
      c.strokeStyle = '#ffffff'; c.lineWidth = 1.5;
      c.globalAlpha = 0.7;
      var stPhase = Date.now() * 0.003;
      for (var stm = 0; stm < 3; stm++) {
        c.beginPath();
        var stx = tt_x + 24 + stm * 6;
        var sty = tt_y - 16;
        c.moveTo(stx, sty);
        c.quadraticCurveTo(stx + Math.sin(stPhase + stm) * 4, sty - 8,
                           stx + Math.sin(stPhase + stm + 1) * 4, sty - 16);
        c.stroke();
      }
      c.restore();
      /* Yarn ball on the rug */
      c.fillStyle = '#ff66aa';
      c.beginPath(); c.arc(W / 2 + 140, ROOM_FLOOR_BOTTOM - 18, 10, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#cc3377'; c.lineWidth = 1;
      for (var yb = 0; yb < 6; yb++) {
        c.beginPath();
        c.arc(W / 2 + 140, ROOM_FLOOR_BOTTOM - 18, 10, yb, yb + Math.PI);
        c.stroke();
      }
    } else if (habitat === 'backyard') {
      paintSky(c, '#88c8e0', '#cce0ee', '#fff8c0');
      paintGround(c, '#5fc858', '#3a8030');
      /* Picket fence */
      c.fillStyle = '#fff8e0';
      for (var pf = 0; pf < 16; pf++) {
        c.fillRect(40 + pf * 50, ROOM_FLOOR_TOP - 30, 12, 30);
      }
      c.fillRect(0, ROOM_FLOOR_TOP - 18, W, 4);
      /* Bone */
      c.fillStyle = '#fff8e0';
      c.beginPath(); c.ellipse(180, ROOM_FLOOR_BOTTOM - 18, 14, 4, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(166, ROOM_FLOOR_BOTTOM - 18, 4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(194, ROOM_FLOOR_BOTTOM - 18, 4, 0, Math.PI * 2); c.fill();
    } else if (habitat === 'kelpForest') {
      paintSky(c, '#7ec4f0', '#b8e2fa', '#e4f6ff');
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(160, 70, 18, 0, Math.PI * 2); c.arc(186, 62, 24, 0, Math.PI * 2); c.arc(212, 72, 16, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(W - 220, 96, 14, 0, Math.PI * 2); c.arc(W - 198, 90, 18, 0, Math.PI * 2); c.arc(W - 178, 98, 12, 0, Math.PI * 2); c.fill();
      /* Sea from the horizon to the shore */
      var seaTop = 170;
      var seaG = c.createLinearGradient(0, seaTop, 0, ROOM_FLOOR_TOP);
      seaG.addColorStop(0, '#2a78b0');
      seaG.addColorStop(1, '#4aa8c8');
      c.fillStyle = seaG;
      c.fillRect(0, seaTop, W, ROOM_FLOOR_TOP - seaTop);
      /* Distant rocky islet */
      c.fillStyle = '#4a5a6a';
      c.beginPath(); c.moveTo(W - 210, seaTop + 2); c.quadraticCurveTo(W - 170, seaTop - 34, W - 120, seaTop + 2); c.closePath(); c.fill();
      /* Sun glitter + animated ripple arcs */
      var rT = Date.now() * 0.002;
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.4;
      for (var rr2 = 0; rr2 < 22; rr2++) {
        var rrx = (hash01(rr2) * W + rT * 8 * (1 + (rr2 % 3))) % W;
        var rry = seaTop + 10 + hash01(rr2 + 50) * (ROOM_FLOOR_TOP - seaTop - 20);
        var rrw = 6 + (rry - seaTop) * 0.12;
        c.beginPath(); c.arc(rrx, rry, rrw, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
      }
      /* Kelp tops bobbing at the surface */
      for (var kp = 0; kp < 6; kp++) {
        var kpx = 80 + kp * 130 + hash01(kp) * 40;
        var kpy = seaTop + 50 + hash01(kp + 9) * 40 + Math.sin(rT + kp) * 2;
        c.fillStyle = '#6a8a2a';
        c.beginPath(); c.ellipse(kpx, kpy, 10, 3, 0.2, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#8aa83a';
        c.beginPath(); c.arc(kpx + 6, kpy - 1, 2.6, 0, Math.PI * 2); c.fill();
      }
      /* Pebbly shore (the floor) with lapping foam */
      paintGround(c, '#e8d4a4', '#b89466');
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.beginPath();
      c.moveTo(0, ROOM_FLOOR_TOP);
      for (var fm = 0; fm <= W; fm += 20) c.lineTo(fm, ROOM_FLOOR_TOP + 4 + Math.sin(fm * 0.05 + rT) * 3);
      c.lineTo(W, ROOM_FLOOR_TOP); c.closePath(); c.fill();
      for (var pb = 0; pb < 26; pb++) {
        var pbx = hash01(pb * 3) * W, pby = ROOM_FLOOR_TOP + 16 + hash01(pb * 5) * (H - ROOM_FLOOR_TOP - 24);
        var pbs = 2 + (pby - ROOM_FLOOR_TOP) * 0.03;
        c.fillStyle = pb % 3 === 0 ? '#9a8a7a' : (pb % 3 === 1 ? '#c0aa8a' : '#7a7a80');
        c.beginPath(); c.ellipse(pbx, pby, pbs * 1.5, pbs, 0, 0, Math.PI * 2); c.fill();
      }
    } else if (habitat === 'outback') {
      paintSky(c, '#c84838', '#e87858', '#ffb888');
      paintGround(c, '#a85028', '#5a2810');
      /* Red rocks */
      c.fillStyle = '#7a3018';
      c.beginPath();
      c.moveTo(50, ROOM_FLOOR_TOP);
      c.lineTo(80, ROOM_FLOOR_TOP - 60);
      c.lineTo(140, ROOM_FLOOR_TOP - 70);
      c.lineTo(200, ROOM_FLOOR_TOP);
      c.closePath();
      c.fill();
      c.fillStyle = '#5a2010';
      c.fillRect(80, ROOM_FLOOR_TOP - 30, 80, 30);
    } else if (habitat === 'rainbowGrove') {
      paintSky(c, '#ffd2ee', '#ffe6f5', '#fff8c0');
      paintGround(c, '#cca0e8', '#9870c8');
      /* Rainbow arc */
      var bands = ['#ff66aa', '#ff8a30', '#ffd24a', '#88ff88', '#88ddff', '#aa88ee'];
      for (var rb = 0; rb < bands.length; rb++) {
        c.strokeStyle = bands[rb]; c.lineWidth = 8;
        c.beginPath();
        c.arc(W / 2, ROOM_FLOOR_TOP + 100, 280 - rb * 8, Math.PI * 1.05, Math.PI * 1.95);
        c.stroke();
      }
      /* Sparkles */
      c.fillStyle = '#ffffff';
      for (var sp = 0; sp < 30; sp++) {
        c.beginPath(); c.arc(((sp * 73) % W), ((sp * 31) % ROOM_FLOOR_TOP), 0.8, 0, Math.PI * 2); c.fill();
      }
    } else if (habitat === 'starship') {
      paintSky(c, '#080418', '#10082a', '#1a0a3a');
      paintGround(c, '#3a2058', '#1a0a3a');
      /* Stars */
      c.fillStyle = '#ffffff';
      for (var ss = 0; ss < 80; ss++) {
        c.beginPath(); c.arc(((ss * 53) % W), ((ss * 31) % ROOM_FLOOR_TOP), 1, 0, Math.PI * 2); c.fill();
      }
      /* Porthole window */
      c.fillStyle = '#1a0838';
      c.beginPath(); c.arc(W / 2, 80, 48, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#caa040'; c.lineWidth = 4;
      c.beginPath(); c.arc(W / 2, 80, 48, 0, Math.PI * 2); c.stroke();
      /* Earth visible */
      c.fillStyle = '#3a78c8';
      c.beginPath(); c.arc(W / 2, 80, 24, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#5a9858';
      c.beginPath(); c.arc(W / 2 - 6, 76, 8, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(W / 2 + 8, 86, 6, 0, Math.PI * 2); c.fill();
    } else if (habitat === 'eucalyptus') {
      paintSky(c, '#8898a8', '#a8b8c8', '#cce0d8');
      paintGround(c, '#5a7048', '#3a4828');
      /* Eucalyptus trees */
      for (var et = 0; et < 4; et++) {
        var etx = 80 + et * 180;
        c.fillStyle = '#9aa090';
        c.fillRect(etx - 5, ROOM_FLOOR_TOP - 100, 10, 100);
        c.fillStyle = '#7a9088';
        c.beginPath(); c.ellipse(etx, ROOM_FLOOR_TOP - 110, 36, 24, 0, 0, Math.PI * 2); c.fill();
      }
    } else if (habitat === 'riverBank') {
      paintSky(c, '#8898a8', '#a8b8c8', '#cce0d8');
      paintGround(c, '#3a78a8', '#1a3848');
      /* Mud bank */
      c.fillStyle = '#5a4828';
      c.fillRect(0, ROOM_FLOOR_TOP, W, 24);
      /* Reeds */
      c.strokeStyle = '#3a5028'; c.lineWidth = 2;
      for (var rd = 0; rd < 10; rd++) {
        var rdx = 30 + rd * 80;
        c.beginPath();
        c.moveTo(rdx, ROOM_FLOOR_TOP + 28);
        c.lineTo(rdx, ROOM_FLOOR_TOP - 30);
        c.stroke();
        c.fillStyle = '#5a7028';
        c.beginPath(); c.ellipse(rdx, ROOM_FLOOR_TOP - 28, 2, 8, 0, 0, Math.PI * 2); c.fill();
      }
      /* Ripples */
      c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 1;
      for (var rp = 0; rp < 5; rp++) {
        c.beginPath();
        c.arc(W / 2 + rp * 30, ROOM_FLOOR_BOTTOM - 20, 30 + rp * 8, Math.PI * 1.1, Math.PI * 1.9);
        c.stroke();
      }
    } else if (habitat === 'lilyPond') {
      paintSky(c, '#88c8e0', '#cce0ee', '#d8ecc8');
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(170, 74, 16, 0, Math.PI * 2); c.arc(194, 66, 22, 0, Math.PI * 2); c.arc(218, 76, 14, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(W - 250, 104, 12, 0, Math.PI * 2); c.arc(W - 230, 98, 16, 0, Math.PI * 2); c.arc(W - 212, 106, 10, 0, Math.PI * 2); c.fill();
      /* Far bank: a soft willow and bush line along the horizon */
      c.fillStyle = '#7ab070';
      for (var fb = 0; fb < 9; fb++) {
        c.beginPath();
        c.ellipse(fb * 100 + hash01(fb + 3) * 40, ROOM_FLOOR_TOP, 70, 22 + hash01(fb) * 16, 0, Math.PI, 0);
        c.fill();
      }
      c.fillStyle = '#5a9858';
      for (var fb2 = 0; fb2 < 7; fb2++) {
        c.beginPath();
        c.ellipse(50 + fb2 * 125, ROOM_FLOOR_TOP, 46, 12 + hash01(fb2 + 20) * 8, 0, Math.PI, 0);
        c.fill();
      }
      paintGround(c, '#3a78a8', '#1a4878');
      /* Bank reflected in the still water */
      c.fillStyle = 'rgba(60, 120, 80, 0.35)';
      c.fillRect(0, ROOM_FLOOR_TOP, W, 8);
      /* Cattails on the far bank */
      for (var ct = 0; ct < 7; ct++) {
        var ctx2 = 120 + ct * 95 + hash01(ct + 40) * 30;
        var cth = 30 + hash01(ct + 60) * 18;
        c.strokeStyle = '#4a7a38'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(ctx2, ROOM_FLOOR_TOP + 6); c.lineTo(ctx2 + 2, ROOM_FLOOR_TOP - cth); c.stroke();
        c.fillStyle = '#7a4a28';
        c.beginPath(); c.ellipse(ctx2 + 1.6, ROOM_FLOOR_TOP - cth + 9, 2.6, 7, 0, 0, Math.PI * 2); c.fill();
      }
      /* Gentle shimmer streaks drifting on the water */
      var lpT = Date.now() * 0.001;
      c.fillStyle = 'rgba(255, 255, 255, 0.28)';
      for (var sh = 0; sh < 16; sh++) {
        var shy = ROOM_FLOOR_TOP + 16 + hash01(sh + 80) * (ROOM_FLOOR_BOTTOM - ROOM_FLOOR_TOP - 40);
        var shw = 10 + (shy - ROOM_FLOOR_TOP) * 0.15;
        var shx = (hash01(sh + 90) * W + lpT * 6) % (W + 40) - 20;
        c.fillRect(shx, shy, shw, 1.5);
      }
      /* Small pads floating out in the pond */
      for (var bp = 0; bp < 7; bp++) {
        var bpx = 70 + bp * 105 + hash01(bp + 100) * 40;
        var bpy = ROOM_FLOOR_TOP + 22 + hash01(bp + 110) * 60;
        var bps = 0.4 + (bpy - ROOM_FLOOR_TOP) / 200;
        c.fillStyle = '#4a9a40';
        c.beginPath();
        c.moveTo(bpx, bpy);
        c.ellipse(bpx, bpy, 18 * bps, 6 * bps, 0, 0.4, Math.PI * 2 - 0.1);
        c.closePath(); c.fill();
      }
      /* Lily pads – notched, with a light rim and a centre vein */
      for (var lp2 = 0; lp2 < 5; lp2++) {
        var lpx = 100 + lp2 * 130;
        var lpy = ROOM_FLOOR_BOTTOM - 16;
        c.fillStyle = 'rgba(0, 30, 60, 0.3)';
        c.beginPath(); c.ellipse(lpx + 2, lpy + 3, 25, 8, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#3a8a30';
        c.beginPath();
        c.moveTo(lpx, lpy);
        c.ellipse(lpx, lpy, 24, 8, 0, 0.35, Math.PI * 2 - 0.1);
        c.closePath(); c.fill();
        c.fillStyle = '#5aaa48';
        c.beginPath();
        c.moveTo(lpx, lpy - 1);
        c.ellipse(lpx, lpy - 1, 19, 5.5, 0, 0.45, Math.PI * 2 - 0.15);
        c.closePath(); c.fill();
        c.strokeStyle = 'rgba(40, 100, 30, 0.6)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(lpx - 16, lpy - 1); c.lineTo(lpx, lpy - 1); c.stroke();
      }
      /* Lotus flowers */
      for (var lf2 = 0; lf2 < 3; lf2++) {
        var lfx = 160 + lf2 * 200, lfy = ROOM_FLOOR_BOTTOM - 22;
        c.fillStyle = '#ffaadd';
        for (var pe = -2; pe <= 2; pe++) {
          c.beginPath(); c.ellipse(lfx + pe * 3.2, lfy - 1 + Math.abs(pe), 2.6, 6, pe * 0.35, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = '#ff77bb';
        c.beginPath(); c.ellipse(lfx, lfy - 2, 2.2, 5, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffe070';
        c.beginPath(); c.arc(lfx, lfy + 1, 1.6, 0, Math.PI * 2); c.fill();
      }
    } else if (habitat === 'bedroom') {
      /* ---- Walls: pink stripes + heart wallpaper ---- */
      var wallGrad = c.createLinearGradient(0, 0, 0, ROOM_FLOOR_TOP);
      wallGrad.addColorStop(0, '#ffd6e0');
      wallGrad.addColorStop(1, '#ffb8d0');
      c.fillStyle = wallGrad;
      c.fillRect(0, 0, W, ROOM_FLOOR_TOP);
      /* Wall vertical stripes */
      c.save();
      c.globalAlpha = 0.18;
      c.fillStyle = '#ff8ab0';
      for (var ws = 0; ws < W; ws += 36) c.fillRect(ws, 0, 14, ROOM_FLOOR_TOP);
      c.restore();
      /* Heart wallpaper sprinkles */
      c.fillStyle = '#ff5577';
      for (var hr = 0; hr < 10; hr++) {
        for (var hc = 0; hc < 8; hc++) {
          var hwx = 60 + hr * 80 + (hc % 2 === 0 ? 0 : 40);
          var hwy = 30 + hc * 26;
          if (hwy > ROOM_FLOOR_TOP - 20) continue;
          c.beginPath();
          c.arc(hwx - 2, hwy - 1, 2, 0, Math.PI * 2);
          c.arc(hwx + 2, hwy - 1, 2, 0, Math.PI * 2);
          c.moveTo(hwx - 3.6, hwy);
          c.lineTo(hwx, hwy + 3.5);
          c.lineTo(hwx + 3.6, hwy);
          c.closePath();
          c.fill();
        }
      }
      /* Crown molding */
      c.fillStyle = '#fff0f5';
      c.fillRect(0, 0, W, 8);
      c.fillRect(0, ROOM_FLOOR_TOP - 14, W, 4);
      c.fillStyle = '#caa040';
      c.fillRect(0, 6, W, 1.4);
      c.fillRect(0, ROOM_FLOOR_TOP - 11, W, 1.2);

      /* ---- Floor: pink-and-cream wood planks ---- */
      paintGround(c, '#caa088', '#a07058');
      c.strokeStyle = '#7a4830'; c.lineWidth = 0.6;
      for (var pk = 0; pk < W; pk += 60) {
        c.beginPath(); c.moveTo(pk, ROOM_FLOOR_TOP); c.lineTo(pk, H); c.stroke();
      }
      /* Plush oval rug center-of-room */
      c.fillStyle = '#ffaad0';
      c.beginPath();
      c.ellipse(W / 2, ROOM_FLOOR_BOTTOM - 8, 200, 22, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fff0f5';
      c.beginPath();
      c.ellipse(W / 2, ROOM_FLOOR_BOTTOM - 8, 160, 14, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#ff66aa'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(W / 2, ROOM_FLOOR_BOTTOM - 8, 180, 18, 0, 0, Math.PI * 2); c.stroke();
      /* Big star in the rug */
      c.fillStyle = '#ffd24a';
      var rstx = W / 2, rsty = ROOM_FLOOR_BOTTOM - 8;
      c.beginPath();
      for (var ri = 0; ri < 10; ri++) {
        var ang = -Math.PI / 2 + ri * Math.PI / 5;
        var rr = ri % 2 === 0 ? 16 : 6;
        var px = rstx + Math.cos(ang) * rr;
        var py = rsty + Math.sin(ang) * rr * 0.4;
        if (ri === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
      c.fill();

      /* ---- Big crystal pendant chandelier ---- */
      c.strokeStyle = '#caa040'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(W / 2 + 220, 0); c.lineTo(W / 2 + 220, 50); c.stroke();
      c.fillStyle = '#fff8c0';
      c.beginPath();
      c.moveTo(W / 2 + 220, 50);
      c.lineTo(W / 2 + 200, 80);
      c.lineTo(W / 2 + 240, 80);
      c.closePath();
      c.fill();
      c.fillStyle = '#caa040';
      c.beginPath();
      c.ellipse(W / 2 + 220, 80, 22, 4, 0, 0, Math.PI * 2);
      c.fill();
      for (var ch = 0; ch < 5; ch++) {
        c.fillStyle = ch % 2 === 0 ? '#ffe070' : '#fff8c0';
        c.beginPath();
        c.moveTo(W / 2 + 200 + ch * 10, 84);
        c.lineTo(W / 2 + 198 + ch * 10, 92);
        c.lineTo(W / 2 + 202 + ch * 10, 92);
        c.closePath();
        c.fill();
      }
      /* Halo glow */
      c.save();
      c.globalAlpha = 0.4;
      var bgGlow = c.createRadialGradient(W / 2 + 220, 90, 6, W / 2 + 220, 90, 70);
      bgGlow.addColorStop(0, 'rgba(255,240,176,0.8)');
      bgGlow.addColorStop(1, 'rgba(255,240,176,0)');
      c.fillStyle = bgGlow;
      c.beginPath(); c.arc(W / 2 + 220, 90, 70, 0, Math.PI * 2); c.fill();
      c.restore();

      /* ---- Window with sheer pink curtains and a moon outside ---- */
      var winX = 110, winY = 40, winW = 140, winH = 120;
      /* Sky inside window */
      c.fillStyle = '#1a1448';
      c.fillRect(winX, winY, winW, winH);
      /* Stars + moon */
      c.fillStyle = '#fff8c0';
      c.beginPath(); c.arc(winX + 100, winY + 28, 14, 0, Math.PI * 2); c.fill();
      for (var swst = 0; swst < 14; swst++) {
        c.beginPath();
        c.arc(winX + (swst * 17 % winW), winY + (swst * 11 % winH), 1, 0, Math.PI * 2);
        c.fill();
      }
      /* Hotel skyline silhouette */
      c.fillStyle = '#0a0820';
      c.fillRect(winX, winY + winH - 20, winW, 20);
      for (var bld = 0; bld < 8; bld++) {
        var bldH = 6 + (bld * 7 % 18);
        c.fillRect(winX + bld * 18, winY + winH - 20 - bldH, 14, bldH);
      }
      /* Sash + frame */
      c.fillStyle = '#fff0f5';
      c.fillRect(winX - 4, winY - 4, winW + 8, 6);
      c.fillRect(winX - 4, winY + winH - 2, winW + 8, 6);
      c.fillRect(winX - 4, winY - 4, 4, winH + 12);
      c.fillRect(winX + winW, winY - 4, 4, winH + 12);
      c.strokeStyle = '#caa040'; c.lineWidth = 1.4;
      c.strokeRect(winX, winY, winW, winH);
      c.beginPath();
      c.moveTo(winX + winW / 2, winY); c.lineTo(winX + winW / 2, winY + winH);
      c.moveTo(winX, winY + winH / 2); c.lineTo(winX + winW, winY + winH / 2);
      c.stroke();
      /* Pink curtains tied back */
      c.fillStyle = '#ff99cc';
      c.beginPath();
      c.moveTo(winX - 14, winY - 6);
      c.quadraticCurveTo(winX - 24, winY + 60, winX - 8, winY + winH + 14);
      c.lineTo(winX + 16, winY + winH + 14);
      c.quadraticCurveTo(winX + 8, winY + 60, winX + 8, winY - 6);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(winX + winW + 14, winY - 6);
      c.quadraticCurveTo(winX + winW + 24, winY + 60, winX + winW + 8, winY + winH + 14);
      c.lineTo(winX + winW - 16, winY + winH + 14);
      c.quadraticCurveTo(winX + winW - 8, winY + 60, winX + winW - 8, winY - 6);
      c.closePath();
      c.fill();
      /* Curtain ribbon ties */
      c.fillStyle = '#ff66aa';
      c.fillRect(winX - 10, winY + 60, 22, 4);
      c.fillRect(winX + winW - 12, winY + 60, 22, 4);
      /* Curtain rod */
      c.fillStyle = '#caa040';
      c.fillRect(winX - 22, winY - 12, winW + 44, 4);
      c.beginPath(); c.arc(winX - 22, winY - 10, 4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(winX + winW + 22, winY - 10, 4, 0, Math.PI * 2); c.fill();

      /* ---- Vanity table with mirror ---- */
      var vnX = W - 200, vnY = ROOM_FLOOR_TOP + 12;
      /* Mirror */
      c.fillStyle = '#caa040';
      c.fillRect(vnX, vnY - 100, 90, 110);
      c.fillStyle = '#cce8ff';
      c.fillRect(vnX + 6, vnY - 94, 78, 98);
      /* Mirror reflection (pink hint) */
      c.fillStyle = '#ffe6f0';
      c.fillRect(vnX + 12, vnY - 88, 32, 86);
      /* Vanity tabletop */
      c.fillStyle = '#5a3a18';
      c.fillRect(vnX - 10, vnY, 110, 8);
      c.fillStyle = '#7a5028';
      c.fillRect(vnX - 10, vnY + 8, 110, 50);
      /* Drawers */
      c.fillStyle = '#caa040';
      c.fillRect(vnX, vnY + 14, 4, 4);
      c.fillRect(vnX, vnY + 28, 4, 4);
      c.fillRect(vnX, vnY + 42, 4, 4);
      /* Perfume bottle + brush */
      c.fillStyle = '#ff66aa';
      c.fillRect(vnX + 12, vnY - 14, 8, 14);
      c.fillStyle = '#ffd24a';
      c.fillRect(vnX + 14, vnY - 18, 4, 4);
      c.fillStyle = '#88ddff';
      c.fillRect(vnX + 30, vnY - 10, 6, 10);
      c.beginPath(); c.arc(vnX + 33, vnY - 14, 4, 0, Math.PI * 2); c.fill();
      /* Cosmetics tray */
      c.fillStyle = '#fff8e0';
      c.fillRect(vnX + 50, vnY - 6, 30, 6);
      c.fillStyle = '#ff66aa';
      c.beginPath(); c.arc(vnX + 56, vnY - 4, 1.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#88ddff';
      c.beginPath(); c.arc(vnX + 64, vnY - 4, 1.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#88ff88';
      c.beginPath(); c.arc(vnX + 72, vnY - 4, 1.6, 0, Math.PI * 2); c.fill();
      /* Stool in front of vanity */
      c.fillStyle = '#5a3a18';
      c.fillRect(vnX + 30, vnY + 60, 30, 4);
      c.fillRect(vnX + 32, vnY + 64, 4, 14);
      c.fillRect(vnX + 54, vnY + 64, 4, 14);
      c.fillStyle = '#ff66aa';
      c.fillRect(vnX + 30, vnY + 56, 30, 6);

      /* ---- Bookshelf on the back wall ---- */
      var bsX = 280, bsY = ROOM_FLOOR_TOP - 110;
      c.fillStyle = '#7a4828';
      c.fillRect(bsX, bsY, 110, 110);
      c.fillStyle = '#5a3018';
      c.fillRect(bsX, bsY + 28, 110, 2);
      c.fillRect(bsX, bsY + 56, 110, 2);
      c.fillRect(bsX, bsY + 84, 110, 2);
      c.fillRect(bsX, bsY + 108, 110, 4);
      /* Books spine-on */
      var bookCols = ['#ff66aa', '#ffd24a', '#88ddff', '#88ff88', '#ff8a30', '#aa88ee'];
      for (var sh = 0; sh < 3; sh++) {
        var shY = bsY + sh * 28 + 4;
        for (var bk = 0; bk < 8; bk++) {
          c.fillStyle = bookCols[(bk + sh) % bookCols.length];
          var bkH = 18 + (bk * 3 % 6);
          c.fillRect(bsX + 4 + bk * 13, shY + 24 - bkH, 11, bkH);
          c.fillStyle = '#fff8e0';
          c.fillRect(bsX + 5 + bk * 13, shY + 24 - bkH + 2, 9, 1);
        }
      }
      /* Picture frame on top */
      c.fillStyle = '#caa040';
      c.fillRect(bsX + 16, bsY - 24, 30, 24);
      c.fillStyle = '#fff8e0';
      c.fillRect(bsX + 18, bsY - 22, 26, 20);
      c.fillStyle = '#ff66aa';
      var pcx = bsX + 31, pcy = bsY - 12;
      c.beginPath();
      c.arc(pcx - 3, pcy - 1, 3, 0, Math.PI * 2);
      c.arc(pcx + 3, pcy - 1, 3, 0, Math.PI * 2);
      c.moveTo(pcx - 5, pcy);
      c.lineTo(pcx, pcy + 6);
      c.lineTo(pcx + 5, pcy);
      c.closePath();
      c.fill();
      /* Plush teddy on top */
      c.fillStyle = '#cba070';
      c.beginPath(); c.arc(bsX + 76, bsY - 10, 8, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#a07050';
      c.beginPath(); c.arc(bsX + 70, bsY - 16, 3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(bsX + 82, bsY - 16, 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a1a1a';
      c.beginPath(); c.arc(bsX + 73, bsY - 10, 0.8, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(bsX + 79, bsY - 10, 0.8, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#cba070';
      c.fillRect(bsX + 70, bsY - 4, 12, 8);

      /* ---- Toy chest at the back ---- */
      var tcX = 440, tcY = ROOM_FLOOR_TOP - 50;
      c.fillStyle = '#5a3a18';
      c.fillRect(tcX, tcY, 90, 50);
      c.fillStyle = '#caa040';
      c.fillRect(tcX, tcY, 90, 8);
      c.fillStyle = '#ff66aa';
      c.fillRect(tcX + 14, tcY + 14, 62, 32);
      c.fillStyle = '#ffd24a';
      c.fillRect(tcX + 38, tcY + 18, 14, 24);
      /* "TOYS" label */
      c.fillStyle = '#3a2418';
      c.font = 'bold 8px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'center';
      c.fillText('TOYS', tcX + 45, tcY + 38);
      c.textAlign = 'left';
      /* Plushies poking out */
      c.fillStyle = '#88ddff';
      c.beginPath(); c.arc(tcX + 8, tcY - 4, 7, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#5a8aa8';
      c.beginPath(); c.arc(tcX + 4, tcY - 9, 2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(tcX + 12, tcY - 9, 2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a1a1a';
      c.beginPath(); c.arc(tcX + 6, tcY - 4, 0.8, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(tcX + 10, tcY - 4, 0.8, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff8a30';
      c.beginPath(); c.arc(tcX + 88, tcY - 4, 7, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#cc5410';
      c.beginPath(); c.moveTo(tcX + 84, tcY - 12); c.lineTo(tcX + 86, tcY - 8); c.lineTo(tcX + 88, tcY - 12); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(tcX + 88, tcY - 12); c.lineTo(tcX + 90, tcY - 8); c.lineTo(tcX + 92, tcY - 12); c.closePath(); c.fill();

      /* ---- Posters above the toy chest ---- */
      var poX = 440;
      c.fillStyle = '#fff8e0';
      c.fillRect(poX + 4, ROOM_FLOOR_TOP - 130, 50, 70);
      c.strokeStyle = '#caa040'; c.lineWidth = 1.4;
      c.strokeRect(poX + 4, ROOM_FLOOR_TOP - 130, 50, 70);
      /* Star + heart art */
      c.fillStyle = '#ffd24a';
      var pst = poX + 29, pst2 = ROOM_FLOOR_TOP - 95;
      c.beginPath();
      for (var pi = 0; pi < 10; pi++) {
        var pang = -Math.PI / 2 + pi * Math.PI / 5;
        var prr = pi % 2 === 0 ? 16 : 6;
        var ppx = pst + Math.cos(pang) * prr;
        var ppy = pst2 + Math.sin(pang) * prr;
        if (pi === 0) c.moveTo(ppx, ppy); else c.lineTo(ppx, ppy);
      }
      c.closePath();
      c.fill();
      /* Second poster */
      c.fillStyle = '#fff8e0';
      c.fillRect(poX + 60, ROOM_FLOOR_TOP - 124, 44, 60);
      c.strokeRect(poX + 60, ROOM_FLOOR_TOP - 124, 44, 60);
      c.fillStyle = '#ff66aa';
      var phx = poX + 82, phy = ROOM_FLOOR_TOP - 100;
      c.beginPath();
      c.arc(phx - 6, phy - 3, 6, 0, Math.PI * 2);
      c.arc(phx + 6, phy - 3, 6, 0, Math.PI * 2);
      c.moveTo(phx - 11, phy);
      c.lineTo(phx, phy + 12);
      c.lineTo(phx + 11, phy);
      c.closePath();
      c.fill();
      /* "MOMOKO" tape */
      c.fillStyle = '#ffd24a';
      c.fillRect(poX + 22, ROOM_FLOOR_TOP - 132, 18, 4);

      /* ---- Slippers next to the bed (right side, near where bed will go) ---- */
      var slX = W - 350, slY = ROOM_FLOOR_BOTTOM - 8;
      c.fillStyle = '#ff99cc';
      c.beginPath(); c.ellipse(slX, slY, 12, 4, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(slX + 18, slY, 12, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff0f5';
      c.beginPath(); c.ellipse(slX, slY - 1, 8, 2.4, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(slX + 18, slY - 1, 8, 2.4, 0, 0, Math.PI * 2); c.fill();

      /* ---- Plush bunny on the floor near the bed ---- */
      var pbX = W - 380, pbY = ROOM_FLOOR_BOTTOM - 22;
      c.fillStyle = '#fff0f5';
      c.beginPath(); c.arc(pbX, pbY, 8, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(pbX, pbY + 10, 7, 6, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(pbX - 4, pbY - 10, 1.4, 5, -0.2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(pbX + 4, pbY - 10, 1.4, 5, 0.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a1a1a';
      c.beginPath(); c.arc(pbX - 2, pbY - 1, 0.8, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(pbX + 2, pbY - 1, 0.8, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff99bb';
      c.beginPath(); c.arc(pbX, pbY + 1, 0.8, 0, Math.PI * 2); c.fill();

      /* ---- Garland of paper hearts strung between window and chandelier ---- */
      c.strokeStyle = '#ff99cc'; c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(winX + winW / 2, 30);
      c.quadraticCurveTo(W / 2, 80, W / 2 + 220, 50);
      c.stroke();
      var garX = [320, 380, 440, 500, 560, 620, 680, 740];
      for (var gi = 0; gi < garX.length; gi++) {
        var gpx = garX[gi];
        var gpy = 30 + Math.sin((gpx - winX) * 0.02) * 18 + 16;
        c.fillStyle = gi % 2 === 0 ? '#ff66aa' : '#ffd24a';
        c.beginPath();
        c.arc(gpx - 2, gpy - 1, 2.2, 0, Math.PI * 2);
        c.arc(gpx + 2, gpy - 1, 2.2, 0, Math.PI * 2);
        c.moveTo(gpx - 4, gpy);
        c.lineTo(gpx, gpy + 4);
        c.lineTo(gpx + 4, gpy);
        c.closePath();
        c.fill();
      }

      /* ---- Tall potted plant in a corner ---- */
      var ppX = W - 60, ppY = ROOM_FLOOR_BOTTOM - 6;
      c.fillStyle = '#a05028';
      c.fillRect(ppX - 12, ppY - 24, 24, 24);
      c.fillStyle = '#7a3818';
      c.fillRect(ppX - 12, ppY - 26, 24, 4);
      c.fillStyle = '#3a7838';
      for (var lpi = 0; lpi < 7; lpi++) {
        var lpa = -Math.PI / 2 + (lpi - 3) * 0.3;
        c.beginPath();
        c.ellipse(ppX + Math.cos(lpa) * 18, ppY - 30 + Math.sin(lpa) * 18, 8, 16, lpa, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#5a9848';
      c.beginPath(); c.ellipse(ppX, ppY - 46, 6, 16, 0, 0, Math.PI * 2); c.fill();

      /* ---- Diary on the floor ---- */
      var dyX = W / 2 - 80, dyY = ROOM_FLOOR_BOTTOM - 18;
      c.fillStyle = '#ff66aa';
      c.fillRect(dyX, dyY, 28, 20);
      c.fillStyle = '#fff8e0';
      c.fillRect(dyX + 2, dyY + 2, 24, 16);
      c.fillStyle = '#ff66aa';
      var dphx = dyX + 14, dphy = dyY + 10;
      c.beginPath();
      c.arc(dphx - 3, dphy - 1, 3, 0, Math.PI * 2);
      c.arc(dphx + 3, dphy - 1, 3, 0, Math.PI * 2);
      c.moveTo(dphx - 5, dphy);
      c.lineTo(dphx, dphy + 6);
      c.lineTo(dphx + 5, dphy);
      c.closePath();
      c.fill();
      c.fillStyle = '#ffd24a';
      c.fillRect(dyX + 26, dyY + 4, 4, 12);

      /* ---- Cloud-shaped night light ---- */
      var nlX = bsX + 90, nlY = ROOM_FLOOR_TOP - 18;
      c.fillStyle = '#fff8e0';
      c.beginPath(); c.arc(nlX, nlY, 6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(nlX + 6, nlY - 2, 5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(nlX - 6, nlY - 2, 5, 0, Math.PI * 2); c.fill();
      c.save();
      c.globalAlpha = 0.4;
      var nlGlow = c.createRadialGradient(nlX, nlY, 2, nlX, nlY, 30);
      nlGlow.addColorStop(0, 'rgba(255,240,176,0.7)');
      nlGlow.addColorStop(1, 'rgba(255,240,176,0)');
      c.fillStyle = nlGlow;
      c.beginPath(); c.arc(nlX, nlY, 30, 0, Math.PI * 2); c.fill();
      c.restore();
    } else {
      /* Fallback — generic peach hotel room */
      paintSky(c, '#cca0a0', '#e0c0c0', '#f0d8d8');
      paintGround(c, '#ad7838', '#7a4818');
    }
  }

  /* Painter for an exit door — drawn after the habitat. */
  function paintExitDoor(c) {
    /* Doorway is wider, brighter, and topped with a green-on-glow EXIT
       sign so it reads as "the way out" on first sight — the previous
       thin yellow strip was easy to miss. */
    var dx = 14, dy = ROOM_FLOOR_BOTTOM - 130;
    var dw = 56, dh = 130;
    /* Frame */
    c.fillStyle = '#2a1808';
    c.fillRect(dx - 4, dy - 4, dw + 8, dh + 4);
    /* Door panel */
    var doorG = c.createLinearGradient(dx, dy, dx + dw, dy);
    doorG.addColorStop(0, '#b88828');
    doorG.addColorStop(0.5, '#e0b850');
    doorG.addColorStop(1, '#b88828');
    c.fillStyle = doorG;
    c.fillRect(dx, dy, dw, dh);
    /* Door panel insets so it reads as a real door */
    c.strokeStyle = '#7a5818';
    c.lineWidth = 1.5;
    c.strokeRect(dx + 6, dy + 10, dw - 12, dh / 2 - 16);
    c.strokeRect(dx + 6, dy + dh / 2 + 6, dw - 12, dh / 2 - 16);
    /* Round handle with brass plate */
    c.fillStyle = '#7a5818';
    c.beginPath(); c.arc(dx + dw - 10, ROOM_FLOOR_BOTTOM - 50, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffd870';
    c.beginPath(); c.arc(dx + dw - 10, ROOM_FLOOR_BOTTOM - 50, 2.6, 0, Math.PI * 2); c.fill();

    /* Glowing EXIT sign over the doorway */
    var sx = dx - 6, sy = dy - 28, sw = dw + 12, sh = 22;
    c.save();
    var sigGlow = c.createRadialGradient(sx + sw / 2, sy + sh / 2, 4,
                                          sx + sw / 2, sy + sh / 2, 36);
    sigGlow.addColorStop(0, 'rgba(120, 255, 130, 0.45)');
    sigGlow.addColorStop(1, 'rgba(120, 255, 130, 0)');
    c.fillStyle = sigGlow;
    c.fillRect(sx - 16, sy - 8, sw + 32, sh + 24);
    c.restore();
    c.fillStyle = '#1a3a1a';
    c.fillRect(sx, sy, sw, sh);
    c.strokeStyle = '#88ff88';
    c.lineWidth = 1.5;
    c.strokeRect(sx, sy, sw, sh);
    c.fillStyle = '#88ff88';
    c.font = 'bold 13px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(Game.i18n.t('exitSign') || 'EXIT', sx + sw / 2, sy + sh / 2 + 1);
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';

    /* Animated arrow on the floor in front of the door pointing left
       so the player sees where to stand to leave. */
    var arrPhase = Date.now() * 0.005;
    var arrX = dx + dw + 28 + Math.sin(arrPhase) * 4;
    var arrY = ROOM_FLOOR_BOTTOM - 18;
    c.save();
    c.fillStyle = 'rgba(136, 255, 136, 0.85)';
    c.beginPath();
    c.moveTo(arrX, arrY);
    c.lineTo(arrX + 12, arrY - 6);
    c.lineTo(arrX + 12, arrY - 2);
    c.lineTo(arrX + 22, arrY - 2);
    c.lineTo(arrX + 22, arrY + 2);
    c.lineTo(arrX + 12, arrY + 2);
    c.lineTo(arrX + 12, arrY + 6);
    c.closePath();
    /* The arrow above is right-pointing; flip it so it points back to the door. */
    c.restore();
    c.save();
    c.translate(arrX + 22, arrY);
    c.scale(-1, 1);
    c.translate(-arrX, -arrY);
    c.fillStyle = 'rgba(136, 255, 136, 0.85)';
    c.beginPath();
    c.moveTo(arrX, arrY);
    c.lineTo(arrX + 12, arrY - 6);
    c.lineTo(arrX + 12, arrY - 2);
    c.lineTo(arrX + 22, arrY - 2);
    c.lineTo(arrX + 22, arrY + 2);
    c.lineTo(arrX + 12, arrY + 2);
    c.lineTo(arrX + 12, arrY + 6);
    c.closePath();
    c.fill();
    c.restore();
  }

  /* Side-view bed: headboard on the right, footboard on the left,
     mattress, pillow, and a quilt that drapes over the front with a
     turned-down sheet and a pattern. pal: { wood, quilt, quiltHi,
     motif ('hearts' | 'dots' | 'stripes'), dot }. */
  function paintSideBed(c, x, y, w, h, pal) {
    var wood = pal.wood || '#7a4a24';
    var woodHi = hexShadeUI(wood, 25);
    var woodLo = hexShadeUI(wood, -35);
    var floorY = y + h;
    var mTop = y + h * 0.36, mBot = y + h * 0.7;
    /* Floor shadow */
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.beginPath(); c.ellipse(x + w / 2, floorY, w * 0.56, 6, 0, 0, Math.PI * 2); c.fill();
    /* Headboard (right) */
    c.fillStyle = woodLo;
    c.fillRect(x + w - 12, y - h * 0.3, 12, h * 1.3);
    c.fillStyle = wood;
    c.beginPath();
    c.moveTo(x + w - 12, floorY);
    c.lineTo(x + w - 12, y - h * 0.2);
    c.quadraticCurveTo(x + w - 6, y - h * 0.42, x + w, y - h * 0.2);
    c.lineTo(x + w, floorY);
    c.closePath(); c.fill();
    c.fillStyle = woodHi;
    c.fillRect(x + w - 10, y - h * 0.18, 2, h * 1.1);
    /* Frame rail + legs */
    c.fillStyle = woodLo;
    c.fillRect(x + 4, mBot, w - 14, h * 0.14);
    c.fillRect(x + 6, mBot, 5, floorY - mBot);
    c.fillRect(x + w - 18, mBot, 5, floorY - mBot);
    /* Mattress */
    c.fillStyle = '#fff6e6';
    roundRect(c, x + 6, mTop, w - 18, mBot - mTop, 5);
    c.fill();
    /* Pillow against the headboard */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(x + w - 30, mTop - 2, 16, 7, -0.1, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(x + w - 30, mTop - 2, 16, 7, -0.1, 0, Math.PI * 2); c.stroke();
    /* Quilt: over the top, draping down the front with a wavy hem */
    var qR = x + w - 46, qL = x + 2;
    var qg = c.createLinearGradient(0, mTop - 4, 0, mBot + 10);
    qg.addColorStop(0, pal.quiltHi || pal.quilt);
    qg.addColorStop(1, pal.quilt);
    c.fillStyle = qg;
    c.beginPath();
    c.moveTo(qR, mTop - 4);
    c.quadraticCurveTo((qL + qR) / 2, mTop - 9, qL + 4, mTop - 2);
    c.quadraticCurveTo(qL - 2, mTop + 6, qL, mBot + 8);
    for (var hm = 0; hm <= 5; hm++) {
      var hx = qL + (qR + 6 - qL) * hm / 5;
      c.quadraticCurveTo(hx - (qR - qL) / 10, mBot + 12, hx, mBot + 8);
    }
    c.lineTo(qR + 6, mTop);
    c.closePath();
    c.fill();
    /* Pattern, clipped to the quilt */
    c.save();
    c.clip();
    c.fillStyle = pal.dot || '#ffffff';
    c.strokeStyle = pal.dot || '#ffffff';
    if (pal.motif === 'stripes') {
      c.globalAlpha = 0.5;
      c.lineWidth = 3;
      for (var st = qL; st < qR + 10; st += 12) {
        c.beginPath(); c.moveTo(st, mTop - 10); c.lineTo(st, mBot + 14); c.stroke();
      }
    } else {
      c.globalAlpha = 0.75;
      for (var row = 0; row < 3; row++) {
        for (var col = 0; col < 8; col++) {
          var px = qL + 8 + col * 12 + (row % 2) * 6, py = mTop + 2 + row * 9;
          if (px > qR) continue;
          if (pal.motif === 'hearts') {
            c.beginPath();
            c.arc(px - 1.6, py - 1, 1.8, 0, Math.PI * 2);
            c.arc(px + 1.6, py - 1, 1.8, 0, Math.PI * 2);
            c.moveTo(px - 3.2, py - 0.4); c.lineTo(px, py + 3); c.lineTo(px + 3.2, py - 0.4);
            c.fill();
          } else {
            c.beginPath(); c.arc(px, py, 1.8, 0, Math.PI * 2); c.fill();
          }
        }
      }
    }
    c.restore();
    /* Turned-down sheet fold by the pillow */
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(qR - 8, mTop - 5); c.lineTo(qR + 6, mTop - 3); c.lineTo(qR + 6, mBot + 6); c.lineTo(qR - 8, mBot + 8);
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.1)';
    c.fillRect(qR - 8, mTop - 4, 2, mBot - mTop + 12);
    /* Footboard (left) */
    c.fillStyle = wood;
    c.beginPath();
    c.moveTo(x - 4, floorY); c.lineTo(x - 4, mTop - 4);
    c.quadraticCurveTo(x + 2, mTop - 14, x + 8, mTop - 4);
    c.lineTo(x + 8, floorY); c.closePath(); c.fill();
    c.fillStyle = woodHi;
    c.fillRect(x - 2, mTop - 2, 2, floorY - mTop);
  }

  /* Guest bed in each suite, coloured from the species palette. */
  function paintHabitatBed(c, species, bx, by) {
    var p = (Game.entities && Game.entities.ANIMAL_PALETTES &&
             Game.entities.ANIMAL_PALETTES[species]) || { body: '#7a4818', shade: '#5a3018', accent: '#ffd24a' };
    var motifs = ['dots', 'stripes', 'hearts'];
    var m = 0;
    for (var i = 0; i < species.length; i++) m += species.charCodeAt(i);
    paintSideBed(c, bx - 6, by, 106, 50, {
      wood: '#7a4a24', quilt: p.shade, quiltHi: p.body, motif: motifs[m % 3], dot: p.accent,
    });
  }

  function drawRoomBackground(c, species) {
    /* Habitat-themed environment */
    var hab = HABITAT_BY_SPECIES[species] || 'cozyRoom';
    paintHabitat(c, hab);
    /* Exit door */
    paintExitDoor(c);
  }

  function drawAnimalRoomInterior(c) {
    var species = roomState.species || 'lion';
    /* Backdrop */
    c.save();
    drawRoomBackground(c, species);

    /* Themed bed in the corner of every room */
    if (roomState.bed) {
      if (species === 'bedroom') {
        /* Momoko's own bed: pink heart quilt and a bobbing ZZZ prompt */
        roomState.bed.update();
        var mbx = roomState.bed.x - 16, mby = roomState.bed.y + 4;
        paintSideBed(c, mbx, mby, 120, 56, {
          wood: '#e8b0c8', quilt: '#ff7ab0', quiltHi: '#ffa8cc', motif: 'hearts', dot: '#ffffff',
        });
        c.fillStyle = '#88ddff';
        c.font = 'bold 13px ' + FONT;
        c.fillText('ZZZ', mbx + 44, mby - 12 + Math.sin(roomState.bed.timer * 0.08) * 2);
      } else {
        paintHabitatBed(c, species, roomState.bed.x, roomState.bed.y);
      }
    }

    /* Animal — scaled up so it reads like a zoo exhibit rather than a doll */
    if (roomState.animal) {
      roomState.animal.update();
      var scale = ANIMAL_ROOM_SCALE;
      var anchorX = roomState.animal.x + roomState.animal.w / 2;
      var anchorY = roomState.animal.y + roomState.animal.h;
      var animalTopY = anchorY - roomState.animal.h * scale;
      c.save();
      c.translate(anchorX, anchorY);
      c.scale(scale, scale);
      c.translate(-roomState.animal.w / 2, -roomState.animal.h);
      roomState.animal.draw(c, roomState.animal.x, roomState.animal.y);
      c.restore();

      /* Interaction prompt over the animal */
      var dx = roomState.px - anchorX;
      var dy = roomState.py - (anchorY - roomState.animal.h * scale / 2);
      var dd = Math.sqrt(dx * dx + dy * dy);
      if (dd < 160 && !roomState.animal.talking) {
        c.fillStyle = '#ffd24a';
        c.font = 'bold 18px "M PLUS Rounded 1c", sans-serif';
        c.textAlign = 'center';
        var bob = Math.sin(Date.now() * 0.005) * 2;
        c.fillText('!', anchorX, animalTopY - 16 + bob);
        c.textAlign = 'left';
      }

      /* In-room greeting feedback: a comic speech bubble next to the
         animal showing its onomatopoeia — anchors the reaction at the
         player's actual eye-line instead of leaving them to read the
         bottom dialogue panel and the top stamp toast. */
      if (roomState.animal.talking && roomState.animal.currentText) {
        var elapsed = 360 - (roomState.animal.talkTimer || 0);
        var pop = elapsed < 18 ? elapsed / 18 : 1;
        c.save();
        c.font = 'bold 14px "M PLUS Rounded 1c", sans-serif';
        var msg = roomState.animal.currentText;
        var tw = Math.min(W - 60, c.measureText(msg).width + 28);
        var th = 36;
        var bubX = anchorX - tw / 2;
        var bubY = animalTopY - th - 22;
        if (bubX < 12) bubX = 12;
        if (bubX + tw > W - 12) bubX = W - 12 - tw;
        if (bubY < 36) bubY = 36;
        c.translate(bubX + tw / 2, bubY + th / 2);
        c.scale(pop, pop);
        c.translate(-(bubX + tw / 2), -(bubY + th / 2));
        c.fillStyle = '#fff8e0';
        c.strokeStyle = '#5a3a18';
        c.lineWidth = 2;
        roundRect(c, bubX, bubY, tw, th, 10);
        c.fill();
        c.stroke();
        /* Tail pointing toward the animal */
        var tailX = Math.max(bubX + 14, Math.min(bubX + tw - 14, anchorX));
        c.beginPath();
        c.moveTo(tailX - 6, bubY + th);
        c.lineTo(tailX + 6, bubY + th);
        c.lineTo(tailX, bubY + th + 10);
        c.closePath();
        c.fillStyle = '#fff8e0';
        c.fill();
        c.strokeStyle = '#5a3a18';
        c.lineWidth = 2;
        /* Cover the top edge of the tail so the bubble outline doesn't
           cut across the connection. */
        c.beginPath();
        c.moveTo(tailX - 6, bubY + th);
        c.lineTo(tailX, bubY + th + 10);
        c.lineTo(tailX + 6, bubY + th);
        c.stroke();
        c.fillStyle = '#1a1a1a';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(msg, bubX + tw / 2, bubY + th / 2);
        c.textBaseline = 'alphabetic';
        c.textAlign = 'left';
        c.restore();

        /* Sparkle hearts around the animal during the first ~30 frames
           so the greeting moment feels celebratory. */
        if (elapsed < 36) {
          c.save();
          var sparkleAlpha = 1 - elapsed / 36;
          c.globalAlpha = sparkleAlpha;
          var palette = ['#ff88cc', '#ffd24a', '#88ddff'];
          for (var s = 0; s < 6; s++) {
            var sa = (s / 6) * Math.PI * 2 + elapsed * 0.18;
            var sr = 60 + elapsed * 2.6;
            var ssx = anchorX + Math.cos(sa) * sr;
            var ssy = (animalTopY + roomState.animal.h * scale / 2) + Math.sin(sa) * sr * 0.55;
            c.fillStyle = palette[s % palette.length];
            c.beginPath();
            c.arc(ssx, ssy, 4, 0, Math.PI * 2);
            c.fill();
          }
          c.restore();
        }
      }
    }

    /* Momoko (also scaled up to match the bigger room scale).
       Walk-bob: a tiny vertical bounce while moving keeps the cozy
       aesthetic even though room walking is grid-coarse. */
    if (Game.entities && Game.entities.drawMomokoSprite) {
      var heroScale = 1.6;
      var hx = Math.round(roomState.px);
      var moving = (roomState.frame !== 0) || (roomState.frameTimer > 0);
      var bob = moving ? Math.abs(Math.sin(roomState.frame * Math.PI / 2 +
                                           roomState.frameTimer * 0.4)) * 2 : 0;
      var hy = Math.round(roomState.py - bob);
      c.save();
      c.translate(hx, hy);
      c.scale(roomState.facing === -1 ? -heroScale : heroScale, heroScale);
      c.translate(-14, -34);
      Game.entities.drawMomokoSprite(c, 0, 0, Game.customization, roomState.frame);
      c.restore();
    }

    /* Room title band across the top — same plaque styling as the
       Guests ledger card so the two read as one HUD. */
    c.fillStyle = 'rgba(58, 36, 24, 0.85)';
    c.fillRect(0, 0, W, 30);
    c.fillStyle = '#caa040';
    c.fillRect(0, 30, W, 2);
    c.fillStyle = 'rgba(255, 224, 138, 0.35)';
    c.fillRect(0, 32, W, 1);
    c.fillStyle = '#fff8e0';
    c.font = 'bold 18px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    var habitatKey = 'habitatName_' + species;
    var habitatName = Game.i18n.t(habitatKey);
    var title;
    if (species === 'bedroom') {
      title = Game.i18n.t('bedroomLabel');
    } else if (habitatName && habitatName !== habitatKey) {
      /* Storybook-style themed name (e.g. "Bashful Lion's Den"). */
      title = habitatName;
    } else {
      title = Game.i18n.t('animalName_' + species) + (species === 'monkey' ? '' : "'s Habitat");
    }
    c.fillText(title, W / 2, 21);
    c.textAlign = 'left';

    /* Bed prompt when standing near the bed (only the bedroom bed triggers sleep) */
    if (roomState.bed && !roomState.bed.decorative) {
      var bdx = roomState.px - (roomState.bed.x + roomState.bed.w / 2);
      var bdy = roomState.py - (roomState.bed.y + roomState.bed.h / 2);
      var bdist = Math.sqrt(bdx * bdx + bdy * bdy);
      if (bdist < 110) {
        c.fillStyle = '#88ddff';
        c.font = 'bold 14px "M PLUS Rounded 1c", sans-serif';
        c.textAlign = 'center';
        c.fillText(Game.i18n.t('bedPrompt'), W / 2, 50);
        c.textAlign = 'left';
      }
    }

    /* Bookshelf prompt — only in the bedroom. */
    if (species === 'bedroom') {
      var bsCx2 = 280 + 55;
      if (Math.abs(roomState.px - bsCx2) < 80) {
        c.fillStyle = '#ffd24a';
        c.font = 'bold 14px "M PLUS Rounded 1c", sans-serif';
        c.textAlign = 'center';
        c.fillText(Game.i18n.t('bookshelfPrompt'), W / 2, 50);
        c.textAlign = 'left';
      }
    }

    /* "← EXIT" pulsing hint after the player has greeted the animal — kids
       sometimes don't realize they can leave once the dialogue has played. */
    if (roomState.hasGreeted && species !== 'bedroom') {
      var exitPulse = 0.55 + 0.35 * Math.abs(Math.sin(Date.now() * 0.005));
      c.save();
      c.globalAlpha = exitPulse;
      c.fillStyle = '#88ff88';
      c.font = 'bold 14px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'left';
      c.fillText('← ' + (Game.i18n.t('exitHint') || 'EXIT'),
                 ROOM_FLOOR_LEFT + 12, ROOM_FLOOR_BOTTOM - 70);
      c.restore();
    }
    c.restore();
  }

  function getAnimalRoomDialogue() {
    if (!roomState.animal || !roomState.animal.talking) return null;
    return {
      speaker: Game.i18n.t('animalName_' + roomState.animal.species),
      text: roomState.animal.currentText || '',
    };
  }

  function updateAnimalRoom(keys, jp, species) {
    /* Player walking — faster than corridor speed because rooms are short. */
    var spd = 4.6;
    if (keys.left)  { roomState.px -= spd; roomState.facing = -1; }
    if (keys.right) { roomState.px += spd; roomState.facing = 1; }
    if (keys.up)    roomState.py -= spd * 0.7;
    if (keys.down)  roomState.py += spd * 0.7;

    /* Bounds */
    if (roomState.px < ROOM_FLOOR_LEFT)  roomState.px = ROOM_FLOOR_LEFT;
    if (roomState.px > ROOM_FLOOR_RIGHT) roomState.px = ROOM_FLOOR_RIGHT;
    if (roomState.py < ROOM_FLOOR_TOP)   roomState.py = ROOM_FLOOR_TOP;
    if (roomState.py > ROOM_FLOOR_BOTTOM) roomState.py = ROOM_FLOOR_BOTTOM;

    /* Walk anim */
    if (keys.left || keys.right || keys.up || keys.down) {
      roomState.frameTimer++;
      if (roomState.frameTimer > 8) {
        roomState.frameTimer = 0;
        roomState.frame = (roomState.frame + 1) % 4;
      }
    } else {
      roomState.frame = 0;
    }

    if (roomState.interactCooldown > 0) roomState.interactCooldown--;
    var interact = (jp.action || jp.up) && roomState.interactCooldown <= 0;

    /* Exit door — left edge of room */
    if (roomState.px < ROOM_FLOOR_LEFT + 40 && interact) {
      roomState.interactCooldown = 30;
      if (Game.engine && Game.engine.exitAnimalRoom) Game.engine.exitAnimalRoom();
      return;
    }

    /* Animal interaction (wider radius — the animal is scaled up) */
    if (roomState.animal && interact) {
      var dx = roomState.px - (roomState.animal.x + roomState.animal.w / 2);
      var dy = roomState.py - roomState.animal.y;
      if (Math.sqrt(dx * dx + dy * dy) < 160) {
        /* If we're already mid-talk and haven't shown the follow-up yet,
           swap in the second line so re-pressing Z gives a tiny "tell me
           more" beat instead of just re-firing the same greeting. */
        if (roomState.animal.talking && !roomState.showedFollowUp) {
          var followKey = 'animalDialogueB_' + roomState.animal.species;
          var follow = Game.i18n.t(followKey);
          if (follow && follow !== followKey) {
            roomState.animal.currentText = follow;
            roomState.animal.talkTimer = 360;
            roomState.showedFollowUp = true;
            if (Game.audio && Game.audio.play) Game.audio.play('select');
          }
        } else {
          roomState.animal.interact();
          roomState.showedFollowUp = false;
        }
        roomState.hasGreeted = true;
        roomState.interactCooldown = 30;
      }
    }

    /* Bed interaction → sleep cutscene (only for the real bedroom bed) */
    if (roomState.bed && !roomState.bed.decorative && interact) {
      var bdx = roomState.px - (roomState.bed.x + roomState.bed.w / 2);
      var bdy = roomState.py - (roomState.bed.y + roomState.bed.h / 2);
      if (Math.sqrt(bdx * bdx + bdy * bdy) < 110) {
        roomState.interactCooldown = 30;
        if (Game.engine && Game.engine.enterSleepCutscene) Game.engine.enterSleepCutscene();
      }
    }

    /* Bookshelf interaction → story-time cutscene (bedroom only). The
       bookshelf is painted in paintHabitat at (280, ROOM_FLOOR_TOP-110)
       with width 110, so the proximity check uses a horizontal band
       centered on the bookshelf foot. */
    if (species === 'bedroom' && interact) {
      var bsCx = 280 + 55; /* keep in sync with paintHabitat bookshelf */
      var bspdx = roomState.px - bsCx;
      if (Math.abs(bspdx) < 80) {
        roomState.interactCooldown = 30;
        if (Game.engine && Game.engine.enterBookshelfCutscene) {
          Game.engine.enterBookshelfCutscene();
        }
        return;
      }
    }

    /* Animal idle update (so its bob loop runs even when not interacted) */
    if (roomState.animal) roomState.animal.update();
    /* Only the bedroom's BedroomBed is a real entity with an update loop;
       guest-room beds are plain decorative props (see resetAnimalRoom). */
    if (roomState.bed && !roomState.bed.decorative) roomState.bed.update();
  }

  function handleAnimalRoomClick(mx, my, species) {
    /* Tap exit door (kept generous so kid-fingers land on it). */
    if (mx >= 10 && mx <= 78 && my >= ROOM_FLOOR_BOTTOM - 160 && my <= ROOM_FLOOR_BOTTOM + 4) return 'exit';
    /* Tap bed (in bedroom) */
    if (roomState.bed && !roomState.bed.decorative) {
      var bx = roomState.bed.x, by = roomState.bed.y;
      if (mx >= bx && mx <= bx + roomState.bed.w &&
          my >= by && my <= by + roomState.bed.h) {
        return 'sleep';
      }
    }
    /* Tap bookshelf (bedroom only) */
    if (species === 'bedroom') {
      var bsX = 280, bsY = ROOM_FLOOR_TOP - 110;
      if (mx >= bsX && mx <= bsX + 110 && my >= bsY - 30 && my <= bsY + 110) {
        return 'bookshelf';
      }
    }
    /* Tap animal — trigger interact */
    if (roomState.animal) {
      var ax = roomState.animal.x, ay = roomState.animal.y;
      if (mx >= ax && mx <= ax + roomState.animal.w &&
          my >= ay - 10 && my <= ay + roomState.animal.h + 10) {
        roomState.animal.interact();
      }
    }
    return null;
  }

  /* ============================================================
   *  SLEEP CUTSCENE
   * ============================================================ */
  /* Moonlit bedroom: Momoko tucked in side-on, head on the pillow
     against the headboard, under a patchwork quilt. The bed's legs end
     above y = 440 so the "Tap anywhere" hint below stays clear. */
  function drawSleepCutscene(c, timer) {
    c.save();
    var floorY = 300;
    var t = timer || 0;

    /* ---- Wall: night-blue wallpaper with faint hearts ---- */
    var wallG = c.createLinearGradient(0, 0, 0, floorY);
    wallG.addColorStop(0, '#1c1848');
    wallG.addColorStop(1, '#342a6a');
    c.fillStyle = wallG;
    c.fillRect(0, 0, W, floorY);
    c.fillStyle = 'rgba(255,140,200,0.14)';
    for (var hr = 0; hr < 11; hr++) {
      for (var hc = 0; hc < 6; hc++) {
        var hwx = 30 + hr * 76 + (hc % 2) * 38, hwy = 26 + hc * 38;
        c.beginPath();
        c.arc(hwx - 2.4, hwy - 1, 2.4, 0, Math.PI * 2);
        c.arc(hwx + 2.4, hwy - 1, 2.4, 0, Math.PI * 2);
        c.moveTo(hwx - 4.4, hwy - 0.2); c.lineTo(hwx, hwy + 4.4); c.lineTo(hwx + 4.4, hwy - 0.2);
        c.fill();
      }
    }
    /* Wainscot + floorboards */
    c.fillStyle = '#2a2050';
    c.fillRect(0, floorY - 64, W, 64);
    c.fillStyle = '#4a3a7a';
    c.fillRect(0, floorY - 66, W, 5);
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.5;
    for (var wp = 0; wp < W; wp += 80) c.strokeRect(wp + 10, floorY - 52, 60, 40);
    var flG = c.createLinearGradient(0, floorY, 0, H);
    flG.addColorStop(0, '#3a2a4a');
    flG.addColorStop(1, '#55405e');
    c.fillStyle = flG;
    c.fillRect(0, floorY, W, H - floorY);
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1;
    for (var fb = 0; fb < 6; fb++) {
      var fby = floorY + 8 + fb * 14 + fb * fb * 3;
      c.beginPath(); c.moveTo(0, fby); c.lineTo(W, fby); c.stroke();
    }

    /* ---- Window with moon and stars ---- */
    var winX = 70, winY = 44, winW = 150, winH = 150;
    c.save();
    c.beginPath(); c.rect(winX, winY, winW, winH); c.clip();
    var skyG = c.createLinearGradient(0, winY, 0, winY + winH);
    skyG.addColorStop(0, '#0a0a30');
    skyG.addColorStop(1, '#2a2a68');
    c.fillStyle = skyG;
    c.fillRect(winX, winY, winW, winH);
    for (var st = 0; st < 22; st++) {
      c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 0.05 + st * 1.3);
      c.fillStyle = '#fff8e0';
      c.fillRect(winX + hash01(st + 3) * winW, winY + hash01(st + 70) * winH * 0.8, 1.5, 1.5);
    }
    c.globalAlpha = 1;
    var mx = winX + 100, my = winY + 46;
    var mg = c.createRadialGradient(mx, my, 8, mx, my, 60);
    mg.addColorStop(0, 'rgba(255,248,210,0.55)');
    mg.addColorStop(1, 'rgba(255,248,210,0)');
    c.fillStyle = mg;
    c.fillRect(mx - 60, my - 60, 120, 120);
    c.fillStyle = '#fff4c4';
    c.beginPath(); c.arc(mx, my, 20, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(210,200,150,0.55)';
    c.beginPath(); c.arc(mx - 6, my - 4, 4, 0, Math.PI * 2); c.arc(mx + 7, my + 6, 3, 0, Math.PI * 2); c.fill();
    /* Rooftops of the town below */
    c.fillStyle = '#141236';
    for (var rf = 0; rf < 7; rf++) {
      var rfx = winX + rf * 24 - 4, rfh = 14 + hash01(rf + 40) * 22;
      c.fillRect(rfx, winY + winH - rfh, 20, rfh);
      c.beginPath(); c.moveTo(rfx - 2, winY + winH - rfh); c.lineTo(rfx + 10, winY + winH - rfh - 10); c.lineTo(rfx + 22, winY + winH - rfh); c.fill();
      if (hash01(rf) > 0.4) { c.fillStyle = '#ffd88a'; c.fillRect(rfx + 7, winY + winH - rfh + 6, 4, 5); c.fillStyle = '#141236'; }
    }
    c.restore();
    c.strokeStyle = '#d8c8f0'; c.lineWidth = 6;
    c.strokeRect(winX - 3, winY - 3, winW + 6, winH + 6);
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(winX + winW / 2, winY); c.lineTo(winX + winW / 2, winY + winH);
    c.moveTo(winX, winY + winH / 2); c.lineTo(winX + winW, winY + winH / 2);
    c.stroke();
    c.fillStyle = '#d8c8f0';
    c.fillRect(winX - 12, winY + winH + 2, winW + 24, 8);
    /* Sheer curtains */
    for (var cs = -1; cs <= 1; cs += 2) {
      var cex = cs < 0 ? winX - 18 : winX + winW + 18;
      var cix = cs < 0 ? winX + 14 : winX + winW - 14;
      c.fillStyle = 'rgba(255,170,215,0.75)';
      c.beginPath();
      c.moveTo(cex, winY - 12); c.lineTo(cix, winY - 12);
      c.quadraticCurveTo(cix - cs * 6, winY + 70, cex + cs * 8, winY + 96);
      c.quadraticCurveTo(cex + cs * 12, winY + 150, cex + cs * 14, floorY - 70);
      c.lineTo(cex - cs * 2, floorY - 70);
      c.closePath(); c.fill();
      c.fillStyle = '#ff7ab0';
      c.fillRect(cex + cs * 4 - 5, winY + 92, 12, 5);
    }
    c.fillStyle = '#caa040';
    c.fillRect(winX - 26, winY - 16, winW + 52, 4);

    /* Moonbeam falling across the bed (additive) */
    c.save();
    c.globalCompositeOperation = 'lighter';
    var beam = c.createLinearGradient(winX, winY, winX + 360, 420);
    beam.addColorStop(0, 'rgba(170,190,255,0.22)');
    beam.addColorStop(1, 'rgba(170,190,255,0)');
    c.fillStyle = beam;
    c.beginPath();
    c.moveTo(winX, winY + 10); c.lineTo(winX + winW, winY + 10);
    c.lineTo(winX + winW + 330, 440); c.lineTo(winX + 160, 440);
    c.closePath(); c.fill();
    c.restore();

    /* ---- Nightstand with a dim lamp, right of the bed ---- */
    var nsx = 664, nsTop = 360;
    c.fillStyle = '#6a4a7a';
    c.fillRect(nsx, nsTop, 64, 72);
    c.fillStyle = '#8a6a9a';
    c.fillRect(nsx - 4, nsTop - 4, 72, 6);
    c.fillStyle = '#ffd24a';
    c.beginPath(); c.arc(nsx + 32, nsTop + 30, 2.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#4a3058';
    c.fillRect(nsx + 28, nsTop - 30, 8, 26);
    c.save();
    c.globalCompositeOperation = 'lighter';
    var lg = c.createRadialGradient(nsx + 32, nsTop - 44, 4, nsx + 32, nsTop - 44, 90);
    lg.addColorStop(0, 'rgba(255,190,120,0.3)');
    lg.addColorStop(1, 'rgba(255,190,120,0)');
    c.fillStyle = lg;
    c.fillRect(nsx - 60, nsTop - 136, 184, 184);
    c.restore();
    c.fillStyle = '#ffc8a0';
    c.beginPath(); c.moveTo(nsx + 14, nsTop - 30); c.lineTo(nsx + 22, nsTop - 56); c.lineTo(nsx + 42, nsTop - 56); c.lineTo(nsx + 50, nsTop - 30); c.closePath(); c.fill();

    /* ---- Bed ---- */
    var hbX = 270, ftX = 636, mTop = 348, mBot = 376, bedFloor = 432;
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse((hbX + ftX) / 2 + 10, bedFloor, 210, 9, 0, 0, Math.PI * 2); c.fill();
    /* Headboard: tall, rounded, with a heart cut-out */
    c.fillStyle = '#d890b8';
    c.beginPath();
    c.moveTo(hbX, bedFloor); c.lineTo(hbX, 270);
    c.quadraticCurveTo(hbX + 16, 236, hbX + 32, 270);
    c.lineTo(hbX + 32, bedFloor); c.closePath(); c.fill();
    c.fillStyle = '#f0b0d0';
    c.fillRect(hbX + 4, 272, 4, bedFloor - 276);
    c.fillStyle = '#ff6aa8';
    var hhx = hbX + 16, hhy = 276;
    c.beginPath();
    c.arc(hhx - 4, hhy - 2, 4.5, 0, Math.PI * 2); c.arc(hhx + 4, hhy - 2, 4.5, 0, Math.PI * 2);
    c.moveTo(hhx - 8.5, hhy - 1); c.lineTo(hhx, hhy + 9); c.lineTo(hhx + 8.5, hhy - 1);
    c.fill();
    /* Side rail + legs */
    c.fillStyle = '#b06a98';
    c.fillRect(hbX + 30, mBot, ftX - hbX - 26, 22);
    c.fillStyle = '#c880ac';
    c.fillRect(hbX + 30, mBot, ftX - hbX - 26, 3);
    c.fillStyle = '#8a4a78';
    c.fillRect(hbX + 36, mBot + 22, 8, bedFloor - mBot - 22);
    c.fillRect(ftX - 14, mBot + 22, 8, bedFloor - mBot - 22);
    /* Mattress */
    c.fillStyle = '#fff4ea';
    roundRect(c, hbX + 30, mTop, ftX - hbX - 30, mBot - mTop, 6);
    c.fill();
    /* Big puffy pillow against the headboard */
    var pX = hbX + 74, pY = mTop - 12;
    c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(pX, pY, 44, 17, -0.06, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(200,180,230,0.5)';
    c.beginPath(); c.ellipse(pX + 4, pY + 6, 38, 8, -0.06, 0, Math.PI); c.fill();

    /* ---- Momoko's head on the pillow (sprite clipped at the neck,
       tipped as if snuggled in, eyes painted closed) ---- */
    var breathe = Math.sin(t * 0.045);
    if (Game.entities && Game.entities.drawMomokoSprite) {
      var hs = 2.6;
      c.save();
      c.translate(pX - 14, pY - 16 + breathe * 0.6);
      c.rotate(-0.26);
      c.scale(hs, hs);
      c.translate(-14, -16);
      c.beginPath(); c.rect(-6, -6, 40, 26); c.clip();
      Game.entities.drawMomokoSprite(c, 0, 0, Game.customization, 0);
      var skin = (Game.customization && Game.customization.skin) || '#ffddbb';
      for (var ey = 0; ey < 2; ey++) {
        var ex = ey === 0 ? 10.3 : 17.7;
        c.fillStyle = skin;
        c.beginPath(); c.ellipse(ex, 13.6, 3.3, 3.1, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#1a0c14';
        c.lineWidth = 0.8;
        c.lineCap = 'round';
        c.beginPath(); c.moveTo(ex - 2.5, 13.2); c.quadraticCurveTo(ex, 15.4, ex + 2.5, 13.2); c.stroke();
        c.lineWidth = 0.5;
        c.beginPath();
        c.moveTo(ex - 1.4, 14.5); c.lineTo(ex - 1.9, 15.6);
        c.moveTo(ex + 1.4, 14.5); c.lineTo(ex + 1.9, 15.6);
        c.stroke();
      }
      c.restore();
    }

    /* Plush bunny tucked beside her on the pillow */
    var pbX = pX + 26, pbY = pY - 12;
    c.fillStyle = '#fff0f5';
    c.beginPath(); c.arc(pbX, pbY, 8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(pbX - 4, pbY - 12, 1.8, 6, -0.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(pbX + 4, pbY - 12, 1.8, 6, 0.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.arc(pbX - 2.4, pbY - 1, 0.9, 0, Math.PI * 2); c.arc(pbX + 2.4, pbY - 1, 0.9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff99bb';
    c.beginPath(); c.arc(pbX, pbY + 1.8, 0.9, 0, Math.PI * 2); c.fill();

    /* ---- Patchwork quilt pulled up to her chin, rising and falling
       with her breathing, draping over the side with a scalloped hem ---- */
    var qL = pX - 2, qR = ftX + 6;
    var rise = breathe * 1.5;
    function quiltPath() {
      c.beginPath();
      c.moveTo(qL, mTop - 2);
      c.quadraticCurveTo(qL + 30, mTop - 22 - rise, qL + 90, mTop - 20 - rise);   /* shoulder */
      c.quadraticCurveTo(qL + 160, mTop - 14 - rise, qL + 200, mTop - 18);          /* hip */
      c.quadraticCurveTo(qL + 250, mTop - 8, qR - 40, mTop - 14);                   /* knees / toes */
      c.quadraticCurveTo(qR - 14, mTop - 14, qR, mTop + 2);
      c.lineTo(qR + 2, mBot + 14);
      var hemN = 10;
      for (var hm = 1; hm <= hemN; hm++) {
        var hx = qR + 2 - (qR + 2 - qL) * hm / hemN;
        c.quadraticCurveTo(hx + (qR - qL) / hemN / 2, mBot + 22, hx, mBot + 14);
      }
      c.closePath();
    }
    quiltPath();
    var qG = c.createLinearGradient(0, mTop - 24, 0, mBot + 22);
    qG.addColorStop(0, '#ff9ac8');
    qG.addColorStop(1, '#e05a9a');
    c.fillStyle = qG;
    c.fill();
    c.save();
    quiltPath();
    c.clip();
    /* Patches: alternating squares, each with a heart, star or dot */
    var patchCols = ['rgba(255,255,255,0.18)', 'rgba(150,110,255,0.25)'];
    for (var px = qL; px < qR + 30; px += 30) {
      for (var py = mTop - 30; py < mBot + 30; py += 26) {
        var k = Math.round((px - qL) / 30 + (py - mTop) / 26);
        c.fillStyle = patchCols[((k % 2) + 2) % 2];
        c.fillRect(px, py, 30, 26);
        var cx = px + 15, cy = py + 13, kind = ((k % 3) + 3) % 3;
        c.fillStyle = kind === 1 ? '#ffe680' : '#ffffff';
        if (kind === 0) {
          c.beginPath();
          c.arc(cx - 2.6, cy - 1.4, 2.8, 0, Math.PI * 2); c.arc(cx + 2.6, cy - 1.4, 2.8, 0, Math.PI * 2);
          c.moveTo(cx - 5.2, cy - 0.6); c.lineTo(cx, cy + 5); c.lineTo(cx + 5.2, cy - 0.6);
          c.fill();
        } else if (kind === 1) {
          c.beginPath();
          for (var sp = 0; sp < 10; sp++) {
            var sa = -Math.PI / 2 + sp * Math.PI / 5, sr = sp % 2 === 0 ? 5 : 2.2;
            if (sp === 0) c.moveTo(cx + Math.cos(sa) * sr, cy + Math.sin(sa) * sr);
            else c.lineTo(cx + Math.cos(sa) * sr, cy + Math.sin(sa) * sr);
          }
          c.closePath(); c.fill();
        } else {
          c.beginPath(); c.arc(cx, cy, 2.4, 0, Math.PI * 2); c.fill();
        }
      }
    }
    /* Stitching */
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 1;
    c.setLineDash([3, 3]);
    for (var sx = qL + 30; sx < qR; sx += 30) { c.beginPath(); c.moveTo(sx, mTop - 30); c.lineTo(sx, mBot + 30); c.stroke(); }
    c.setLineDash([]);
    /* Shade where the quilt turns down over the mattress edge */
    var edgeG = c.createLinearGradient(0, mTop + 2, 0, mBot + 22);
    edgeG.addColorStop(0, 'rgba(60,0,40,0)');
    edgeG.addColorStop(0.3, 'rgba(60,0,40,0.18)');
    edgeG.addColorStop(1, 'rgba(60,0,40,0.05)');
    c.fillStyle = edgeG;
    c.fillRect(qL, mTop + 2, qR - qL + 4, mBot - mTop + 24);
    c.restore();
    /* Turned-down sheet fold along the top by her chin */
    c.fillStyle = '#fff6fb';
    c.beginPath();
    c.moveTo(qL - 2, mTop - 1);
    c.quadraticCurveTo(qL + 30, mTop - 23 - rise, qL + 90, mTop - 21 - rise);
    c.lineTo(qL + 92, mTop - 12 - rise);
    c.quadraticCurveTo(qL + 30, mTop - 13 - rise, qL + 4, mTop + 6);
    c.closePath(); c.fill();
    c.strokeStyle = '#ffb0d4'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(qL + 4, mTop + 6); c.quadraticCurveTo(qL + 30, mTop - 13 - rise, qL + 92, mTop - 12 - rise); c.stroke();
    /* Footboard */
    c.fillStyle = '#d890b8';
    c.beginPath();
    c.moveTo(ftX - 4, bedFloor); c.lineTo(ftX - 4, mTop - 20);
    c.quadraticCurveTo(ftX + 6, mTop - 34, ftX + 16, mTop - 20);
    c.lineTo(ftX + 16, bedFloor); c.closePath(); c.fill();
    c.fillStyle = '#f0b0d0';
    c.fillRect(ftX, mTop - 18, 3, bedFloor - mTop + 18);

    /* ---- Floating Zs: drift up and away from her head, swaying ---- */
    if (t > 20) {
      var zT = t - 20;
      for (var i = 0; i < 4; i++) {
        var zPhase = (zT - i * 50) % 200;
        if (zPhase < 0) continue;
        var alpha = Math.min(1, zPhase / 20) * Math.max(0, 1 - zPhase / 200);
        var zx = pX + 30 + zPhase * 0.55 + Math.sin(zPhase * 0.05 + i) * 10;
        var zy = pY - 48 - zPhase * 0.9;
        var size = 16 + zPhase * 0.1;
        c.save();
        c.globalAlpha = alpha;
        c.translate(zx, zy);
        c.rotate(-0.2 + Math.sin(zPhase * 0.04) * 0.15);
        c.font = 'bold ' + Math.floor(size) + 'px ' + FONT;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineWidth = 3;
        c.strokeStyle = '#3a2a7a';
        c.strokeText('Z', 0, 0);
        c.fillStyle = i % 2 ? '#ffd6f0' : '#b8e4ff';
        c.fillText('Z', 0, 0);
        c.restore();
      }
    }

    /* Soft vignette */
    var vg = c.createRadialGradient(W / 2, H / 2, 160, W / 2, H / 2, W * 0.7);
    vg.addColorStop(0, 'rgba(10,6,30,0)');
    vg.addColorStop(1, 'rgba(10,6,30,0.45)');
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);

    /* ---- Title text ---- */
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.fillStyle = '#fff8e0';
    c.font = 'bold 26px ' + FONT;
    c.fillText(Game.i18n.t('sleepText'), W / 2 + 70, 52);
    c.fillStyle = '#ffd6e8';
    fitFont(c, Game.i18n.t('goodNight'), 300, 14);
    c.fillText(Game.i18n.t('goodNight'), W / 2 + 70, 76);

    /* Tap-to-wake hint after a beat, on a pill below the bed */
    if (t > 80) {
      var tip = Game.i18n.t('tapAnywhere');
      c.font = '13px ' + FONT;
      var tw = c.measureText(tip).width + 28;
      c.fillStyle = 'rgba(20,12,50,0.6)';
      roundRect(c, W / 2 - tw / 2, H - 34, tw, 24, 12);
      c.fill();
      c.fillStyle = '#e8e0ff';
      c.textBaseline = 'middle';
      c.fillText(tip, W / 2, H - 21);
      c.textBaseline = 'alphabetic';
    }
    c.textAlign = 'left';
    c.restore();
  }

  /* ============================================================
   *  LOBBY INTRO CUTSCENE — chandelier monkey drops + escorts
   * ============================================================ */
  function updateLobbyIntro(timer) {
    /* timer drives the cutscene; nothing else to do (positions are
       computed in drawLobbyIntro from the timer). */
  }

  /* ============================================================
   *  BOOKSHELF CUTSCENE — receptionist reads "Little Red Riding Hood"
   *  (public domain — Perrault 1697 / Brothers Grimm 1812).
   *
   *  Scene layout: same cozy bedroom backdrop. The receptionist walks
   *  in from the exit door on the left, sits next to Momoko (seated
   *  on the floor by the bookshelf), and narrates the tale page by
   *  page. The player advances pages with action / up / tap.
   * ============================================================ */
  var BOOK_PAGE_KEYS = [
    'bookPage1', 'bookPage2', 'bookPage3',
    'bookPage4', 'bookPage5', 'bookPage6'
  ];

  function getBookshelfPageCount() { return BOOK_PAGE_KEYS.length; }

  function drawBookshelfCutscene(c, timer, page) {
    c.save();

    /* Bedroom backdrop (reuse the bedroom habitat painter so the room
       art stays consistent with where the cutscene was triggered). */
    paintHabitat(c, 'bedroom');
    paintExitDoor(c);

    /* Soft warm lamp glow over the seating area. */
    c.save();
    c.globalAlpha = 0.45;
    var lampGrad = c.createRadialGradient(W / 2, ROOM_FLOOR_TOP + 50, 8,
                                          W / 2, ROOM_FLOOR_TOP + 50, 240);
    lampGrad.addColorStop(0, 'rgba(255,224,160,0.55)');
    lampGrad.addColorStop(1, 'rgba(255,224,160,0)');
    c.fillStyle = lampGrad;
    c.fillRect(0, 0, W, H);
    c.restore();

    /* ---- Receptionist walks in from the exit door (left side) ----
       Phase 1: timer 0..60   — walk from x=60 → reading spot (220)
       Phase 2: timer >60     — sit next to Momoko and read */
    var seatedX = 240;          /* receptionist sits here */
    var momokoSeatX = 350;      /* Momoko sits to his right */
    var seatY = ROOM_FLOOR_BOTTOM - 18;
    var rxRaw, sitting;
    if (timer < 60) {
      var t = timer / 60;
      rxRaw = 60 + (seatedX - 60) * t;
      sitting = false;
    } else {
      rxRaw = seatedX;
      sitting = true;
    }
    var rx = Math.round(rxRaw);

    /* ---- Momoko, seated on the floor, listening ---- */
    if (Game.entities && Game.entities.drawMomokoSprite) {
      c.save();
      var mScale = 1.6;
      c.translate(momokoSeatX, seatY);
      c.scale(-mScale, mScale); /* face left toward the receptionist */
      c.translate(-14, -34);
      Game.entities.drawMomokoSprite(c, 0, 0, Game.customization, 0);
      c.restore();
      /* Tiny attentive sparkle while the story is told */
      if (sitting) {
        var sparkAlpha = 0.4 + 0.4 * Math.abs(Math.sin(timer * 0.12));
        c.save();
        c.globalAlpha = sparkAlpha;
        c.fillStyle = '#ffd24a';
        c.beginPath();
        c.arc(momokoSeatX + 14, seatY - 60, 1.8, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }

    /* ---- Receptionist sprite (walking, then seated) ----
       The Receptionist drawer expects (x, y, camX, camY) and lifts feet
       up by 60 internally — we want him standing on the floor. */
    if (Game.entities && Game.entities.Receptionist) {
      var bobR = sitting ? 0 : Math.abs(Math.sin(timer * 0.25)) * 2;
      /* For the seated pose: scoot the sprite down a touch and keep it
         left of Momoko. */
      var rDrawX = rx - 32;
      var rDrawY = sitting ? seatY - 30 : seatY - 64 - bobR;
      var tmpRec = new Game.entities.Receptionist(rDrawX, rDrawY + 60);
      tmpRec.draw(c, 0, 0);
      /* If seated, draw a small open book in his hands. */
      if (sitting) {
        var bkX = rDrawX + 18, bkY = rDrawY + 50;
        c.fillStyle = '#aa3344';
        c.fillRect(bkX, bkY, 36, 22);
        c.fillStyle = '#fff8e0';
        c.fillRect(bkX + 2, bkY + 2, 32, 18);
        c.strokeStyle = '#caa040';
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(bkX + 18, bkY + 2); c.lineTo(bkX + 18, bkY + 20);
        c.stroke();
        /* Tiny squiggle "lines of text" */
        c.fillStyle = '#5a3a18';
        for (var bl = 0; bl < 4; bl++) {
          c.fillRect(bkX + 4, bkY + 5 + bl * 3, 12, 1);
          c.fillRect(bkX + 20, bkY + 5 + bl * 3, 12, 1);
        }
      }
    }

    /* ---- Title bar across the top ---- */
    c.fillStyle = 'rgba(20, 12, 36, 0.7)';
    c.fillRect(0, 0, W, 28);
    c.fillStyle = '#ffd6a0';
    c.font = 'bold 18px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('bookshelfTitle') + '  ' + Game.i18n.t('bookTitle'),
               W / 2, 20);
    c.textAlign = 'left';

    /* ---- Story text panel near the bottom of the screen ---- */
    var pad = 18;
    var panelX = pad;
    var panelW = W - pad * 2;
    var panelH = 100;
    var panelY = H - panelH - pad;
    c.fillStyle = 'rgba(10, 8, 24, 0.88)';
    roundRect(c, panelX, panelY, panelW, panelH, 12);
    c.fill();
    c.strokeStyle = '#caa040';
    c.lineWidth = 2;
    c.stroke();

    /* Speaker name */
    c.fillStyle = '#ffcc44';
    c.font = 'bold 14px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'left';
    c.fillText(Game.i18n.t('receptionistName'), panelX + 12, panelY + 22);

    /* Body text — intro for the first ~60 frames, then story pages */
    c.fillStyle = '#fff4d8';
    c.font = '13px "M PLUS Rounded 1c", sans-serif';
    var body;
    if (timer < 60) {
      body = Game.i18n.t('receptionistReadIntro');
    } else {
      var key = BOOK_PAGE_KEYS[Math.min(page, BOOK_PAGE_KEYS.length - 1)];
      body = Game.i18n.t(key);
    }
    var lines = String(body).split('\n');
    for (var ln = 0; ln < lines.length; ln++) {
      c.fillText(lines[ln], panelX + 12, panelY + 46 + ln * 18);
    }

    /* Page indicator + advance hint (only after the lead-in) */
    if (timer >= 60) {
      var isLast = page >= BOOK_PAGE_KEYS.length - 1;
      c.fillStyle = '#aab8d0';
      c.font = '11px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'right';
      c.fillText(Game.i18n.t('bookPage').replace('%s', page + 1).replace('%s', BOOK_PAGE_KEYS.length),
                 panelX + panelW - 12, panelY + 22);
      c.fillStyle = '#88ddff';
      c.textAlign = 'center';
      c.fillText(Game.i18n.t(isLast ? 'bookEndHint' : 'bookSkipHint'),
                 W / 2, panelY + panelH - 10);
      c.textAlign = 'left';
    }

    c.restore();
  }

  /* ============================================================
   *  GUEST PASSPORT (LEDGER) — full-screen overlay listing every
   *  animal in the hotel with a stamped indicator for visited ones.
   *  Sits over a paused PLAYING / ANIMAL_ROOM scene.
   * ============================================================ */
  /* Listed in floor order so the player can mentally map them. The
     chandelier monkey is the 26th guest — Momoko meets them during the
     lobby check-in escort, which is where the stamp is awarded. */
  var LEDGER_SPECIES = [
    'owl',
    'elephant', 'lion', 'tiger', 'bear', 'giraffe', 'zebra', 'hippo', 'rhino',
    'wolf', 'eagle', 'fox', 'panda', 'penguin', 'polarBear', 'gorilla',
    'bunny', 'cat', 'dog', 'seaOtter', 'kangaroo', 'unicorn', 'alien', 'koala', 'frog',
    'monkey'
  ];

  /* Ledger close-button rect (set in drawLedger, read in handleLedgerClick). */
  var ledgerCloseRect = { x: 0, y: 0, w: 0, h: 0 };

  function drawLedger(c) {
    c.save();
    /* Dim the underlying scene */
    c.fillStyle = 'rgba(8, 4, 24, 0.86)';
    c.fillRect(VIEW.x, VIEW.y, VIEW.w, VIEW.h);

    /* Paper / card background */
    var pad = 28;
    var cardX = pad, cardY = pad;
    var cardW = W - pad * 2;
    var cardH = H - pad * 2;
    c.fillStyle = '#fff4d8';
    roundRect(c, cardX, cardY, cardW, cardH, 12);
    c.fill();
    c.strokeStyle = '#caa040';
    c.lineWidth = 3;
    c.stroke();

    /* Title row */
    c.fillStyle = '#5a3018';
    c.font = 'bold 22px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'left';
    c.fillText(Game.i18n.t('ledgerTitle'), cardX + 18, cardY + 30);

    var got = (Game.engine && Game.engine.getStampCount) ? Game.engine.getStampCount() : 0;
    var tot = (Game.engine && Game.engine.getStampTotal) ? Game.engine.getStampTotal() : LEDGER_SPECIES.length;
    var progress = Game.i18n.t('ledgerProgress')
      .replace('%s', got).replace('%s', tot);
    c.fillStyle = got >= tot ? '#3a8030' : '#7a5a18';
    c.font = 'bold 14px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'right';
    c.fillText(progress, cardX + cardW - 18, cardY + 30);

    c.fillStyle = '#7a5a18';
    c.font = '12px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'left';
    c.fillText(Game.i18n.t('ledgerSubtitle'), cardX + 18, cardY + 50);

    if (got >= tot) {
      c.fillStyle = '#3a8030';
      c.font = 'bold 14px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'center';
      c.fillText(Game.i18n.t('ledgerComplete'), cardX + cardW / 2, cardY + 50);
      c.textAlign = 'left';
    }

    /* Grid of species rows — 4 columns. */
    var gridX = cardX + 18;
    var gridY = cardY + 70;
    var gridW = cardW - 36;
    var cols = 4;
    var rowH = 26;
    var colW = Math.floor(gridW / cols);
    var stamps = (Game.flags && Game.flags.stamps) || {};

    for (var i = 0; i < LEDGER_SPECIES.length; i++) {
      var sp = LEDGER_SPECIES[i];
      var col = i % cols;
      var row = Math.floor(i / cols);
      var ix = gridX + col * colW;
      var iy = gridY + row * rowH;
      var stamped = !!stamps[sp];

      /* Row background */
      c.fillStyle = stamped ? '#e6f5d8' : '#f4ead4';
      c.fillRect(ix, iy, colW - 6, rowH - 4);

      /* Species name */
      c.fillStyle = stamped ? '#3a8030' : '#7a5a18';
      c.font = 'bold 11px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(Game.i18n.t('animalName_' + sp), ix + 6, iy + (rowH - 4) / 2);

      /* Stamp / unvisited indicator */
      c.font = 'bold 10px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'right';
      if (stamped) {
        /* Red stamp-style label, centred on the row with only a slight
           tilt so its ends stay inside the row band. */
        c.save();
        c.translate(ix + colW - 14, iy + (rowH - 4) / 2);
        c.rotate(-0.08);
        c.textBaseline = 'middle';
        c.fillStyle = 'rgba(170, 24, 36, 0.92)';
        c.fillText('★ ' + Game.i18n.t('ledgerStamped'), 0, 0);
        c.restore();
      } else {
        c.fillStyle = '#aaa';
        c.fillText(Game.i18n.t('ledgerUnvisited'), ix + colW - 14, iy + (rowH - 4) / 2);
      }
      c.textBaseline = 'alphabetic';
    }

    /* Stamp album: a perforated stamp per guest along the bottom of the
       page — the animal's portrait once greeted, a faint ghost until
       then, with a red postmark over the stamped ones. */
    var stW = 46, stH = 50, stGap = 4, perRow = 13;
    var albumX = cardX + (cardW - (perRow * (stW + stGap) - stGap)) / 2;
    var albumY = gridY + Math.ceil(LEDGER_SPECIES.length / cols) * rowH + 10;
    var pal = (Game.entities && Game.entities.ANIMAL_PALETTES) || {};
    for (var si = 0; si < LEDGER_SPECIES.length; si++) {
      var ssp = LEDGER_SPECIES[si];
      var sx = albumX + (si % perRow) * (stW + stGap);
      var sy = albumY + Math.floor(si / perRow) * (stH + 6);
      var got1 = !!stamps[ssp];
      var tilt = (hash01(si + 3) - 0.5) * 0.08;
      c.save();
      c.translate(sx + stW / 2, sy + stH / 2);
      c.rotate(tilt);
      c.translate(-stW / 2, -stH / 2);
      /* Perforated paper edge */
      c.fillStyle = got1 ? '#ffffff' : 'rgba(255,255,255,0.55)';
      c.shadowColor = 'rgba(90,60,20,0.25)';
      c.shadowBlur = got1 ? 3 : 0;
      c.shadowOffsetY = 1;
      c.fillRect(0, 0, stW, stH);
      c.shadowColor = 'rgba(0,0,0,0)';
      c.fillStyle = '#fff4d8';
      for (var pf = 3; pf < stW; pf += 5) {
        c.beginPath(); c.arc(pf, 0, 1.6, 0, Math.PI * 2); c.arc(pf, stH, 1.6, 0, Math.PI * 2); c.fill();
      }
      for (var pv = 3; pv < stH; pv += 5) {
        c.beginPath(); c.arc(0, pv, 1.6, 0, Math.PI * 2); c.arc(stW, pv, 1.6, 0, Math.PI * 2); c.fill();
      }
      /* Inner panel + portrait */
      var pp = pal[ssp] || { accent: '#ffd24a' };
      c.fillStyle = got1 ? hexShadeUI(pp.accent && pp.accent.length === 7 ? pp.accent : '#ffd24a', 55) : '#efe4cc';
      c.fillRect(4, 4, stW - 8, stH - 8);
      if (Game.entities && Game.entities.drawAnimalSprite) {
        c.save();
        c.beginPath(); c.rect(4, 4, stW - 8, stH - 8); c.clip();
        c.globalAlpha = got1 ? 1 : 0.14;
        c.translate(stW / 2, stH - 8);
        c.scale(0.68, 0.68);
        c.translate(-24, -44);
        Game.entities.drawAnimalSprite(c, ssp, 0, 0);
        c.restore();
      }
      if (got1) {
        /* Postmark: ink ring + wavy cancel lines */
        c.strokeStyle = 'rgba(170, 24, 36, 0.55)';
        c.lineWidth = 1.2;
        c.beginPath(); c.arc(stW - 10, 11, 8, 0, Math.PI * 2); c.stroke();
        c.beginPath();
        for (var wl = 0; wl < 3; wl++) {
          c.moveTo(stW - 30, 6 + wl * 4);
          c.quadraticCurveTo(stW - 25, 4 + wl * 4, stW - 20, 6 + wl * 4);
        }
        c.stroke();
        c.fillStyle = 'rgba(170, 24, 36, 0.6)';
        c.font = 'bold 7px ' + FONT;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('★', stW - 10, 11);
        c.textBaseline = 'alphabetic';
      } else {
        c.strokeStyle = 'rgba(122, 90, 24, 0.3)';
        c.setLineDash([2, 2]);
        c.strokeRect(4.5, 4.5, stW - 9, stH - 9);
        c.setLineDash([]);
      }
      c.restore();
    }

    /* Hints + close button */
    c.fillStyle = '#7a5a18';
    c.font = '11px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'left';
    c.fillText(Game.i18n.t(Game.input.isTouch() ? 'ledgerHintTouch' : 'ledgerHint'), cardX + 18, cardY + cardH - 18);

    var btnW = 120, btnH = 32;
    var btnX = cardX + cardW - btnW - 18;
    var btnY = cardY + cardH - btnH - 14;
    ledgerCloseRect.x = btnX; ledgerCloseRect.y = btnY;
    ledgerCloseRect.w = btnW; ledgerCloseRect.h = btnH;
    drawButton(c, Game.i18n.t('ledgerClose'), btnX, btnY, btnW, btnH, false, 'primary');
    c.textAlign = 'left';

    c.restore();
  }

  function handleLedgerClick(mx, my) {
    if (mx >= ledgerCloseRect.x && mx <= ledgerCloseRect.x + ledgerCloseRect.w &&
        my >= ledgerCloseRect.y && my <= ledgerCloseRect.y + ledgerCloseRect.h) {
      return 'close';
    }
    /* Tap anywhere outside the close button still closes the passport
       (matches the "tap-anywhere-to-dismiss" feel of other screens). */
    return 'close';
  }

  function drawLobbyIntro(c, timer, player, npcs) {
    /* The engine renders the live lobby underneath us before this
       function is called, so we just lay a soft "spotlight" tint on
       top and overlay the escort animation. */
    c.save();
    c.fillStyle = 'rgba(10, 5, 20, 0.32)';
    c.fillRect(0, 0, W, H);

    /* Phase 1 (0..120): monkey drops from chandelier to player */
    /* Phase 2 (120..360): monkey walks player toward elevator */
    var camX = (player && player.x) ? Math.max(0, player.x - W / 2) : 0;
    var monkeySx, monkeySy, momokoSx, momokoSy;
    /* Original chandelier hangs at world x=400, y=110. */
    var chx = 400, chy = 110;
    /* Player worldX during cutscene goes from her current x toward
       the elevator (x≈2180). */
    var startPx = (player && player.x) ? player.x : 80;
    var elevatorX = 2180;
    if (timer <= 120) {
      /* Drop animation */
      var t = timer / 120;
      monkeySx = chx - camX;
      monkeySy = chy + (player.y - chy - 30) * t;
      momokoSx = startPx - camX;
      momokoSy = player.y;
    } else {
      var t2 = (timer - 120) / 240;
      if (t2 > 1) t2 = 1;
      var curX = startPx + (elevatorX - startPx) * t2;
      camX = Math.max(0, curX - W / 2);
      monkeySx = curX - 30 - camX;
      monkeySy = player.y;
      momokoSx = curX - camX;
      momokoSy = player.y;
    }

    /* Draw the monkey (small) */
    if (Game.entities && Game.entities.drawAnimalSprite) {
      Game.entities.drawAnimalSprite(c, 'monkey', monkeySx - 22, monkeySy);
    }

    /* Speech-bubble over the monkey. Sized off the actual text width
       so longer translations (e.g. "Ook ook! Right this way to the
       elevator!") don't spill past the bubble's edges, and clamped
       inside the canvas so it never disappears off the left/right when
       the monkey is near the player who is near a wall. */
    if (timer > 80) {
      c.font = 'bold 12px "M PLUS Rounded 1c", sans-serif';
      var msg = Game.i18n.t('monkeyEscort');
      var twText = c.measureText(msg).width;
      var tw = Math.min(W - 24, twText + 28);
      var th = 32;
      var tx = monkeySx - tw / 2;
      if (tx < 12) tx = 12;
      if (tx + tw > W - 12) tx = W - 12 - tw;
      var ty = monkeySy - th - 28;
      if (ty < 8) ty = 8;
      c.fillStyle = '#fff8e0';
      c.strokeStyle = '#5a3a18';
      c.lineWidth = 2;
      roundRect(c, tx, ty, tw, th, 8);
      c.fill();
      c.stroke();
      c.fillStyle = '#1a1a1a';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(msg, tx + tw / 2, ty + th / 2);
      c.textBaseline = 'alphabetic';
      c.textAlign = 'left';
    }
    c.restore();
  }

  /* Canvas text doesn't trigger web-font downloads reliably (Safari), so
     ask for every weight we draw with, covering all game text. */
  if (document.fonts && document.fonts.load) {
    var sample = Game.i18n.allText();
    ['400', '700'].forEach(function (wgt) {
      document.fonts.load(wgt + ' 16px "M PLUS Rounded 1c"', sample).catch(function () {});
    });
  }

  window.Game.ui = {
    beginFrame: function () { anyHot = false; },
    setView: setView,
    isHot: function () { return anyHot; },
    drawTitleScreen: function (c) {
      /* The title clips itself to the viewport; pop that before the
         How-to card so its scrim can dim the whole tablet screen. */
      c.save();
      drawTitleScreen(c);
      c.restore();
      /* Version stamp in the bottom-right corner of the screen (the
         bezel corner on tablets) – helps us know which build is running. */
      if (Game.VERSION) {
        c.save();
        c.fillStyle = 'rgba(255, 230, 200, 0.45)';
        c.font = '11px "M PLUS Rounded 1c", sans-serif';
        c.textAlign = 'right';
        c.textBaseline = 'alphabetic';
        var stamp = Game.VERSION + (Game.BUILD ? ' (' + Game.BUILD + ')' : '');
        c.fillText(stamp, VIEW.x + VIEW.w - 8, VIEW.y + VIEW.h - 8);
        c.restore();
      }
      if (showInstructions) drawInstructionsOverlay(c);
    },
    drawPauseMenu: drawPauseMenu,
    drawDialogue: drawDialogue,
    drawQRCode: drawQRCode,
    drawGameOver: drawGameOver,
    drawVictory: drawVictory,
    drawCustomizeScreen: drawCustomizeScreen,
    drawIntroScreen: drawIntroScreen,
    drawBeachCutscene: drawBeachCutscene,
    startBeachCutscene: startBeachCutscene,
    updateBeach: updateBeach,
    handleTitleClick: handleTitleClick,
    handlePauseClick: handlePauseClick,
    handleGameOverClick: handleGameOverClick,
    handleVictoryClick: handleVictoryClick,
    handleCustomizeClick: handleCustomizeClick,
    handleIntroClick: handleIntroClick,
    handleBeachClick: handleBeachClick,
    isShowingInstructions: function () { return showInstructions; },
    /* Space re-theme additions */
    drawTravelMenu: drawTravelMenu,
    handleTravelMenuClick: handleTravelMenuClick,
    updateTravelMenu: updateTravelMenu,
    resetTravelMenu: resetTravelMenu,
    drawRocketAnim: drawRocketAnim,
    drawHouseInterior: drawHouseInterior,
    handleHouseInteriorClick: handleHouseInteriorClick,
    updateHouseInterior: updateHouseInterior,
    drawCafeInterior: drawCafeInterior,
    handleCafeInteriorClick: handleCafeInteriorClick,
    updateCafeInterior: updateCafeInterior,
    startCafeCutscene: startCafeCutscene,
    drawShopInterior: drawShopInterior,
    handleShopInteriorClick: handleShopInteriorClick,
    updateShopInterior: updateShopInterior,
    startShopInterior: startShopInterior,
    drawCarryOverlay: drawCarryOverlay,
    drawQuestHUD: drawQuestHUD,
    drawVersionStamp: drawVersionStamp,
    /* Hotel zoo additions */
    drawAnimalRoomInterior: drawAnimalRoomInterior,
    updateAnimalRoom: updateAnimalRoom,
    handleAnimalRoomClick: handleAnimalRoomClick,
    resetAnimalRoom: resetAnimalRoom,
    getAnimalRoomDialogue: getAnimalRoomDialogue,
    drawSleepCutscene: drawSleepCutscene,
    drawLobbyIntro: drawLobbyIntro,
    updateLobbyIntro: updateLobbyIntro,
    drawBookshelfCutscene: drawBookshelfCutscene,
    getBookshelfPageCount: getBookshelfPageCount,
    drawLedger: drawLedger,
    handleLedgerClick: handleLedgerClick,
  };

  /* Reusable version stamp — same position + style as the title screen
     so you can tell at a glance which build is running during gameplay. */
  function drawVersionStamp(c) {
    if (!Game.VERSION) return;
    c.save();
    c.fillStyle = '#4a6a8a';
    c.font = '11px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'right';
    c.textBaseline = 'alphabetic';
    var stamp = Game.VERSION + (Game.BUILD ? ' (' + Game.BUILD + ')' : '');
    c.fillText(stamp, W - 8, H - 8);
    c.restore();
  }
})();
