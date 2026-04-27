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
  function drawButton(c, text, x, y, w, h, hover) {
    c.fillStyle = hover ? '#7744cc' : '#4a1f7a';
    c.fillRect(x, y, w, h);
    c.strokeStyle = '#ff66cc';
    c.lineWidth = 2;
    c.strokeRect(x, y, w, h);
    c.fillStyle = '#ffffff';
    c.font = 'bold 18px monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, x + w / 2, y + h / 2);
  }

  function hitButton(mx, my, x, y, w, h) {
    return mx >= x && mx <= x + w && my >= y && my <= y + h;
  }

  function wrapText(c, text, x, y, maxWidth, lineHeight) {
    var lines = text.split('\n');
    var dy = 0;
    for (var li = 0; li < lines.length; li++) {
      var words = lines[li].split(' ');
      var line = '';
      for (var i = 0; i < words.length; i++) {
        var test = line + words[i] + ' ';
        if (c.measureText(test).width > maxWidth && line.length > 0) {
          c.fillText(line.trim(), x, y + dy);
          line = words[i] + ' ';
          dy += lineHeight;
        } else {
          line = test;
        }
      }
      c.fillText(line.trim(), x, y + dy);
      dy += lineHeight;
    }
    return dy;
  }

  /* ---- Title Screen ---- */
  function drawTitleScreen(c) {
    titleAnimTimer++;

    /* Warm dusk-sky gradient over a hotel street */
    var grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#241430');
    grad.addColorStop(0.5, '#4a2858');
    grad.addColorStop(1, '#7a3a58');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    /* Twinkling stars over the dusk sky */
    for (var i = 0; i < titleBubbles.length; i++) {
      var b = titleBubbles[i];
      b.wobble += 0.04;
      var twinkle = 0.3 + 0.7 * Math.abs(Math.sin(b.wobble));
      c.save();
      c.globalAlpha = twinkle * 0.9;
      c.fillStyle = i % 13 === 0 ? '#ffd24a' : (i % 17 === 0 ? '#ff99cc' : '#ffffff');
      c.beginPath();
      c.arc(b.x, b.y, 0.8 + b.r * 0.3 * twinkle, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    /* Hotel facade in upper-right (replaces ringed planet) */
    c.save();
    var hx = W - 200, hy = 30;
    /* Building body */
    c.fillStyle = '#3a2418';
    c.fillRect(hx, hy, 160, 180);
    /* Roof */
    c.fillStyle = '#7a2840';
    c.beginPath();
    c.moveTo(hx - 8, hy);
    c.lineTo(hx + 80, hy - 24);
    c.lineTo(hx + 168, hy);
    c.closePath();
    c.fill();
    /* Roof finial flag */
    c.fillStyle = '#ffd24a';
    c.fillRect(hx + 78, hy - 40, 2, 16);
    c.fillStyle = '#ff66cc';
    c.beginPath();
    c.moveTo(hx + 80, hy - 40);
    c.lineTo(hx + 92, hy - 36);
    c.lineTo(hx + 80, hy - 32);
    c.closePath();
    c.fill();
    /* Windows — 4 floors x 4 windows; some lit yellow, some with animal silhouettes */
    var animalEmojis = ['🐘','🦁','🐯','🐻','🦒','🦓','🐺','🦅','🐼','🐧','🐰','🐱','🐶','🦦','🦘','🦄','👽','🐒'];
    for (var floor = 0; floor < 4; floor++) {
      for (var col = 0; col < 4; col++) {
        var wx = hx + 8 + col * 38;
        var wy = hy + 14 + floor * 40;
        c.fillStyle = '#fff0a0';
        c.fillRect(wx, wy, 26, 26);
        c.strokeStyle = '#5a3a18';
        c.lineWidth = 1;
        c.strokeRect(wx, wy, 26, 26);
        c.beginPath();
        c.moveTo(wx + 13, wy); c.lineTo(wx + 13, wy + 26);
        c.moveTo(wx, wy + 13); c.lineTo(wx + 26, wy + 13);
        c.stroke();
        /* Sprinkle some animal emojis behind a few windows */
        var idx = floor * 4 + col;
        if (idx < animalEmojis.length && idx % 2 === 0) {
          c.font = '18px sans-serif';
          c.textAlign = 'center';
          c.fillStyle = '#000000';
          c.fillText(animalEmojis[idx], wx + 13, wy + 20);
        }
      }
    }
    /* Hotel sign */
    c.fillStyle = '#ffd24a';
    c.fillRect(hx + 30, hy + 184, 100, 14);
    c.strokeStyle = '#5a3a18';
    c.strokeRect(hx + 30, hy + 184, 100, 14);
    c.fillStyle = '#1a1a1a';
    c.font = 'bold 9px monospace';
    c.textAlign = 'center';
    c.fillText('🏨 HOTEL', hx + 80, hy + 194);
    c.textAlign = 'left';
    c.restore();

    /* Title text */
    var title = Game.i18n.t('title');
    c.save();
    c.font = 'bold 36px monospace';
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
    c.font = '14px monospace';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('titleSubtitle'), W / 2, 140);

    /* Buttons */
    drawButton(c, Game.i18n.t('play'), W / 2 - 90, 200, 180, 44);
    drawButton(c, Game.i18n.t('howToPlay'), W / 2 - 90, 260, 180, 44);
    drawButton(c, Game.i18n.t('language') + ': ' + Game.i18n.t('langLabel'), W / 2 - 90, 320, 180, 44);

    /* Sound toggle */
    var muteLabel = Game.i18n.t(Game.audio.isMuted() ? 'soundOff' : 'soundOn');
    drawButton(c, muteLabel, W / 2 - 90, 380, 180, 36);

    /* Version stamp (bottom-right) – helps us know which build is running */
    if (Game.VERSION) {
      c.save();
      c.fillStyle = '#4a6a8a';
      c.font = '11px monospace';
      c.textAlign = 'right';
      c.textBaseline = 'alphabetic';
      var stamp = Game.VERSION + (Game.BUILD ? ' (' + Game.BUILD + ')' : '');
      c.fillText(stamp, W - 8, H - 8);
      c.restore();
    }

    /* Instructions overlay flag */
    return false;
  }

  var showInstructions = false;

  function drawInstructionsOverlay(c) {
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.85)';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#66ccff';
    c.font = 'bold 24px monospace';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('howToPlay'), W / 2, 80);
    c.fillStyle = '#ccddee';
    c.font = '16px monospace';
    c.textAlign = 'center';
    wrapText(c, Game.i18n.t('instructions'), W / 2, 130, 600, 28);
    drawButton(c, 'OK', W / 2 - 60, 350, 120, 40);
    c.restore();
  }

  /* Title click handler – returns action string or null */
  function handleTitleClick(mx, my) {
    if (showInstructions) {
      if (hitButton(mx, my, W / 2 - 60, 350, 120, 40)) {
        showInstructions = false;
        Game.audio.play('select');
        return null;
      }
      return null;
    }
    if (hitButton(mx, my, W / 2 - 90, 200, 180, 44)) { Game.audio.play('select'); return 'play'; }
    if (hitButton(mx, my, W / 2 - 90, 260, 180, 44)) { Game.audio.play('select'); showInstructions = true; return null; }
    if (hitButton(mx, my, W / 2 - 90, 320, 180, 44)) { Game.audio.play('select'); Game.i18n.toggleLanguage(); return null; }
    if (hitButton(mx, my, W / 2 - 90, 380, 180, 36)) { Game.audio.toggleMute(); return null; }
    return null;
  }

  /* (No HUD — exploration game; quest progress lives in drawQuestHUD.) */

  /* ---- Pause Menu ---- */
  var pauseFlossTimer = 0;
  function drawPauseMenu(c) {
    pauseFlossTimer++;
    c.save();
    c.fillStyle = 'rgba(10, 4, 32, 0.82)';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#44ffff';
    c.font = 'bold 32px monospace';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('paused'), W / 2, 90);

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

    drawButton(c, Game.i18n.t('resume'), W / 2 - 10, 150, 220, 38);
    drawButton(c, '🎟️ ' + Game.i18n.t('ledgerOpen'), W / 2 - 10, 198, 220, 38);
    drawButton(c, Game.i18n.t('language') + ': ' + Game.i18n.t('langLabel'), W / 2 - 10, 246, 220, 38);
    var muteLabel = Game.i18n.t(Game.audio.isMuted() ? 'soundOff' : 'soundOn');
    drawButton(c, muteLabel, W / 2 - 10, 294, 220, 38);
    drawButton(c, Game.i18n.t('quit'), W / 2 - 10, 342, 220, 38);

    /* Version stamp – matches the title-screen stamp so we can tell at a
       glance which build is paused (handy for bug reports). */
    if (Game.VERSION) {
      c.fillStyle = '#6688aa';
      c.font = '11px monospace';
      c.textAlign = 'right';
      c.textBaseline = 'alphabetic';
      var pStamp = Game.VERSION + (Game.BUILD ? ' (' + Game.BUILD + ')' : '');
      c.fillText(pStamp, W - 8, H - 8);
    }
    c.restore();
  }

  function handlePauseClick(mx, my) {
    if (hitButton(mx, my, W / 2 - 10, 150, 220, 38)) { Game.audio.play('select'); return 'resume'; }
    if (hitButton(mx, my, W / 2 - 10, 198, 220, 38)) { Game.audio.play('select'); return 'ledger'; }
    if (hitButton(mx, my, W / 2 - 10, 246, 220, 38)) { Game.audio.play('select'); Game.i18n.toggleLanguage(); return null; }
    if (hitButton(mx, my, W / 2 - 10, 294, 220, 38)) { Game.audio.toggleMute(); return null; }
    if (hitButton(mx, my, W / 2 - 10, 342, 220, 38)) { Game.audio.play('select'); return 'quit'; }
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
    c.font = 'bold 10px monospace';
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
    c.fillStyle = 'rgba(0, 15, 40, 0.92)';
    c.fillRect(boxX, boxY, boxW, boxH);
    c.strokeStyle = '#44aadd';
    c.lineWidth = 2;
    c.strokeRect(boxX, boxY, boxW, boxH);

    /* Speaker name */
    c.fillStyle = '#ffcc44';
    c.font = 'bold 14px monospace';
    c.textAlign = 'left';
    c.fillText(speaker, boxX + 12, boxY + 18);

    /* Text */
    c.fillStyle = '#ddeeff';
    c.font = '13px monospace';
    wrapText(c, text, boxX + 12, boxY + 36, boxW - 24, 17);

    c.restore();
  }

  /* ---- Game Over Screen ---- */
  function drawGameOver(c) {
    c.save();
    c.fillStyle = 'rgba(20, 0, 0, 0.85)';
    c.fillRect(0, 0, W, H);

    c.fillStyle = '#ff3344';
    c.font = 'bold 40px monospace';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('gameOver'), W / 2, 160);

    drawButton(c, Game.i18n.t('tryAgain'), W / 2 - 90, 240, 180, 48);
    c.restore();
  }

  function handleGameOverClick(mx, my) {
    if (hitButton(mx, my, W / 2 - 90, 240, 180, 48)) { Game.audio.play('select'); return 'retry'; }
    return null;
  }

  /* ---- Victory Screen ---- */
  var victoryParticles = [];
  var victoryTimer = 0;

  function drawVictory(c) {
    victoryTimer++;

    c.save();
    c.fillStyle = 'rgba(0, 10, 30, 0.85)';
    c.fillRect(0, 0, W, H);

    /* Fireworks particles */
    if (victoryTimer % 10 === 0) {
      var fx = 100 + Math.random() * 600;
      var fy = 100 + Math.random() * 200;
      var colors = ['#ff4466', '#44ff66', '#4488ff', '#ffcc33', '#ff66cc', '#66ffcc'];
      for (var i = 0; i < 12; i++) {
        var angle = (Math.PI * 2 * i) / 12;
        var sp = 1 + Math.random() * 2;
        victoryParticles.push({
          x: fx, y: fy,
          vx: Math.cos(angle) * sp,
          vy: Math.sin(angle) * sp,
          life: 40 + Math.random() * 20,
          maxLife: 60,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 2 + Math.random() * 3
        });
      }
    }

    for (var p = victoryParticles.length - 1; p >= 0; p--) {
      var part = victoryParticles[p];
      part.x += part.vx;
      part.y += part.vy;
      part.vy += 0.03;
      part.life--;
      if (part.life <= 0) { victoryParticles.splice(p, 1); continue; }
      c.globalAlpha = part.life / part.maxLife;
      c.fillStyle = part.color;
      c.fillRect(part.x - part.size / 2, part.y - part.size / 2, part.size, part.size);
    }
    c.globalAlpha = 1;

    c.fillStyle = '#ffcc33';
    c.font = 'bold 44px monospace';
    c.textAlign = 'center';
    c.shadowColor = '#ffaa00';
    c.shadowBlur = 20;
    c.fillText(Game.i18n.t('victory'), W / 2, 130);
    c.shadowBlur = 0;

    c.fillStyle = '#88ddff';
    c.font = '20px monospace';
    c.fillText(Game.i18n.t('savedOcean'), W / 2, 180);

    c.fillStyle = '#ccddee';
    c.font = '16px monospace';
    c.fillText(Game.i18n.t('thanks'), W / 2, 220);

    drawButton(c, Game.i18n.t('playAgain'), W / 2 - 90, 280, 180, 48);
    c.restore();
  }

  function handleVictoryClick(mx, my) {
    if (hitButton(mx, my, W / 2 - 90, 280, 180, 48)) {
      Game.audio.play('select');
      victoryParticles = [];
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
  var TAB_X = 320, TAB_Y = 60, TAB_W = 76, TAB_H = 34, TAB_GAP = 4;
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
    return GRID_Y + rows * (GRID_TILE_H + GRID_GAP) + 12;
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
    /* Background */
    var grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a1628');
    grad.addColorStop(1, '#162e50');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    /* Title */
    c.fillStyle = '#66ccff';
    c.font = 'bold 26px monospace';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('customize'), W / 2, 36);

    /* Preview stage – soft radial glow so Momoko pops against the bg */
    var stageCX = 160, stageCY = 240;
    var stageGrad = c.createRadialGradient(stageCX, stageCY, 20, stageCX, stageCY, 150);
    stageGrad.addColorStop(0, 'rgba(110,180,255,0.22)');
    stageGrad.addColorStop(1, 'rgba(110,180,255,0)');
    c.fillStyle = stageGrad;
    c.fillRect(10, 70, 300, 340);

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
      c.fillStyle = active ? '#3388cc' : '#1a3a5a';
      roundRect(c, tx, TAB_Y, TAB_W, TAB_H, 6);
      c.fill();
      if (active) {
        c.strokeStyle = '#ffdd88';
        c.lineWidth = 2;
        roundRect(c, tx, TAB_Y, TAB_W, TAB_H, 6);
        c.stroke();
      }
      c.fillStyle = active ? '#ffffff' : '#aaccee';
      c.font = 'bold 11px monospace';
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
      c.fillStyle = selected ? '#2b5580' : '#12253d';
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
      c.fillStyle = '#eef6ff';
      c.font = 'bold 12px monospace';
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
      c.fillStyle = '#88aacc';
      c.font = '13px monospace';
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
    c.fillStyle = '#88aacc';
    c.font = '13px monospace';
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
    drawButton(c, Game.i18n.t('startGame'), START_BTN_X, START_BTN_Y, START_BTN_W, START_BTN_H);
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

    /* Background – same deep-sea gradient as title for continuity */
    var grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a1628');
    grad.addColorStop(0.5, '#0d2847');
    grad.addColorStop(1, '#162e50');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    /* Drifting ambient bubbles */
    for (var i = 0; i < titleBubbles.length; i++) {
      var b = titleBubbles[i];
      b.wobble += 0.02;
      b.y -= b.speed * 0.4;
      if (b.y < -10) { b.y = H + 10; b.x = Math.random() * W; }
      c.save();
      c.globalAlpha = 0.2;
      c.fillStyle = '#66bbee';
      c.beginPath();
      c.arc(b.x + Math.sin(b.wobble) * 15, b.y, b.r, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }

    /* Momoko portrait (left) */
    c.save();
    c.translate(120, 200);
    c.scale(3.2, 3.2);
    if (Game.entities && Game.entities.drawMomokoSprite) {
      Game.entities.drawMomokoSprite(c, 0, 0, Game.customization, Math.floor(introAnimTimer / 8) % 4);
    }
    c.restore();

    /* Title */
    c.fillStyle = '#ffcc66';
    c.font = 'bold 28px monospace';
    c.textAlign = 'center';
    c.shadowColor = '#884400';
    c.shadowBlur = 6;
    c.fillText(Game.i18n.t('introTitle'), W / 2, 46);
    c.shadowBlur = 0;

    /* Story panel */
    var panelX = 240, panelY = 72, panelW = 540, panelH = 320;
    c.fillStyle = 'rgba(8, 24, 48, 0.75)';
    roundRect(c, panelX, panelY, panelW, panelH, 10);
    c.fill();
    c.strokeStyle = '#2a5580';
    c.lineWidth = 2;
    roundRect(c, panelX, panelY, panelW, panelH, 10);
    c.stroke();

    /* Story text */
    c.fillStyle = '#dfeeff';
    c.font = '14px monospace';
    c.textAlign = 'left';
    wrapText(c, Game.i18n.t('introText'), panelX + 18, panelY + 28, panelW - 36, 20);

    /* Continue button */
    drawButton(c, Game.i18n.t('continueBtn'), W / 2 - 90, H - 60, 180, 44);
  }

  function handleIntroClick(mx, my) {
    if (hitButton(mx, my, W / 2 - 90, H - 60, 180, 44)) {
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
    c.font = 'bold 30px monospace';
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
    c.font = '14px monospace';
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
    { key: 'destHerosPlanet', emoji: '🏨', body: '#aa6a2a', accent: '#ffd24a' },
    { key: 'destCheeseMoon',  emoji: '🦁', body: '#c89a4a', accent: '#a07832' },
    { key: 'destFloor3',      emoji: '🐺', body: '#4a6838', accent: '#88ff88' },
    { key: 'destFloor4',      emoji: '🦄', body: '#a468d4', accent: '#ff66cc' },
  ];

  function drawTravelMenu(c) {
    /* Dim backdrop over the game */
    c.save();
    c.fillStyle = 'rgba(20, 10, 40, 0.85)';
    c.fillRect(0, 0, W, H);

    /* Panel */
    c.fillStyle = '#3a2418';
    c.strokeStyle = '#ffd24a';
    c.lineWidth = 3;
    var px = W / 2 - 280, py = 50, pw = 560, ph = 380;
    roundRect(c, px, py, pw, ph, 14);
    c.fill();
    c.stroke();

    /* Title */
    c.fillStyle = '#ffd24a';
    c.font = 'bold 28px monospace';
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
    drawButton(c, Game.i18n.t('travelCancel'), W / 2 - 90, 400, 180, 30);
    c.restore();
  }

  function drawFloorCard(c, x, y, w, h, idx, info) {
    var current = (Game.engine && Game.engine.getCurrentZone && Game.engine.getCurrentZone()) || 0;
    var isCurrent = idx === current;
    c.save();
    c.fillStyle = isCurrent ? '#5a3a22' : info.body;
    c.strokeStyle = info.accent;
    c.lineWidth = 2;
    roundRect(c, x, y, w, h, 10);
    c.fill();
    c.stroke();

    /* Floor number */
    c.fillStyle = '#1a1a1a';
    c.font = 'bold 32px monospace';
    c.textAlign = 'left';
    c.fillText(String(idx + 1), x + 14, y + 44);

    /* Emoji */
    c.font = '40px sans-serif';
    c.textAlign = 'right';
    c.fillText(info.emoji, x + w - 14, y + 50);

    /* Label */
    c.fillStyle = '#fff8e0';
    c.font = 'bold 16px monospace';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t(info.key), x + w / 2, y + 80);

    /* Confirm button (or "You are here") */
    if (isCurrent) {
      c.fillStyle = '#3a2418';
      c.fillRect(x + 30, y + 95, w - 60, 26);
      c.strokeStyle = info.accent;
      c.strokeRect(x + 30, y + 95, w - 60, 26);
      c.fillStyle = info.accent;
      c.font = 'bold 13px monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('YOU ARE HERE', x + w / 2, y + 108);
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
    if (hitButton(mx, my, W / 2 - 90, 400, 180, 30)) {
      Game.audio.play('select');
      return 'cancel';
    }
    return null;
  }

  function updateTravelMenu(keys, jp) {
    /* no-op; click handles all interaction */
  }

  /* ============================================================ */
  /*                    ROCKET LAUNCH ANIMATION                     */
  /* ============================================================ */
  function drawRocketAnim(c, timer, target) {
    /* Elevator-shaft transition: cab travels through a dark shaft, lit by
       passing floor lights. Reuses the rocket-anim wiring so we don't have
       to fork the engine state machine. */
    c.fillStyle = '#0d0810';
    c.fillRect(0, 0, W, H);

    /* Side rails */
    c.fillStyle = '#1a1208';
    c.fillRect(0,       0, 80, H);
    c.fillRect(W - 80,  0, 80, H);
    c.strokeStyle = '#caa040';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(82, 0); c.lineTo(82, H); c.stroke();
    c.beginPath(); c.moveTo(W - 82, 0); c.lineTo(W - 82, H); c.stroke();

    /* Streaking floor markers (give a sense of motion) */
    var t = timer / 120; /* 0..1 */
    for (var f = 0; f < 8; f++) {
      var fy = ((timer * 12 + f * 80) % H);
      c.fillStyle = (f % 4 === 0) ? '#ffd24a' : '#5a3a18';
      c.fillRect(82, fy, 18, 4);
      c.fillRect(W - 100, fy, 18, 4);
    }

    /* Cab — slowly bobs in the middle */
    var cx = W / 2 - 120, cy = H / 2 - 110 + Math.sin(timer * 0.2) * 4;
    var cabW = 240, cabH = 220;
    c.fillStyle = '#2a1810';
    c.fillRect(cx - 10, cy - 10, cabW + 20, cabH + 20);
    /* Cab walls — wood paneling */
    c.fillStyle = '#5a3a18';
    c.fillRect(cx, cy, cabW, cabH);
    c.fillStyle = '#7a4a22';
    c.fillRect(cx + 4, cy + 4, cabW - 8, cabH - 8);
    /* Wood grain panels */
    c.strokeStyle = '#3a2010';
    c.lineWidth = 1.5;
    for (var pn = 0; pn < 3; pn++) {
      c.strokeRect(cx + 14 + pn * 70, cy + 50, 60, 140);
    }
    /* Cab ceiling light */
    c.fillStyle = '#fff0b0';
    c.fillRect(cx + 14, cy + 6, cabW - 28, 14);
    var glow = c.createRadialGradient(cx + cabW / 2, cy + 14, 4, cx + cabW / 2, cy + 14, 60);
    glow.addColorStop(0, 'rgba(255,240,176,0.5)');
    glow.addColorStop(1, 'rgba(255,240,176,0)');
    c.fillStyle = glow;
    c.fillRect(cx, cy, cabW, 80);

    /* Real Momoko sprite (scaled up) */
    if (Game.entities && Game.entities.drawMomokoSprite) {
      c.save();
      var heroX = cx + cabW / 2 - 14;
      var heroY = cy + cabH - 80;
      c.translate(heroX, heroY);
      /* Up to 1.6x for visibility */
      c.scale(1.6, 1.6);
      Game.entities.drawMomokoSprite(c, 0, 0, Game.customization, Math.floor(timer / 8) % 4);
      c.restore();
    }

    /* Brass control panel + floor display */
    c.fillStyle = '#caa040';
    c.fillRect(cx + cabW - 56, cy + 60, 44, 100);
    c.fillStyle = '#3a2418';
    c.fillRect(cx + cabW - 50, cy + 66, 32, 26);
    c.fillStyle = '#ffd24a';
    c.font = 'bold 18px monospace';
    c.textAlign = 'center';
    c.fillText(String((target || 0) + 1) + 'F', cx + cabW - 34, cy + 84);
    c.textAlign = 'left';
    /* Button column */
    for (var bn = 0; bn < 4; bn++) {
      var lit = bn === (target || 0);
      c.fillStyle = lit ? '#ffd24a' : '#5a3a18';
      c.beginPath();
      c.arc(cx + cabW - 34, cy + 110 + bn * 12, 4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fff8e0';
      c.font = '8px monospace';
      c.textAlign = 'center';
      c.fillText(String(bn + 1), cx + cabW - 34, cy + 113 + bn * 12);
    }
    c.textAlign = 'left';

    /* Up arrow indicator */
    var arrowBlink = Math.sin(timer * 0.3) > 0;
    c.fillStyle = arrowBlink ? '#ffd24a' : '#5a3a18';
    c.beginPath();
    c.moveTo(cx + cabW / 2, cy - 6);
    c.lineTo(cx + cabW / 2 - 12, cy + 6);
    c.lineTo(cx + cabW / 2 + 12, cy + 6);
    c.closePath();
    c.fill();

    /* Status text */
    c.fillStyle = '#ffd24a';
    c.font = 'bold 22px monospace';
    c.textAlign = 'center';
    c.fillText(
      timer < 90 ? Game.i18n.t('rocketLaunching') : Game.i18n.t('rocketArriving'),
      W / 2, 50
    );
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
      var raw = localStorage.getItem('momoko-space-furniture');
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fallthrough */ }
    return {};
  }

  function saveFurnitureState(state) {
    try {
      localStorage.setItem('momoko-space-furniture', JSON.stringify(state));
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
    c.font = 'bold 20px monospace';
    c.textAlign = 'left';
    var nameKey = houseId === 'heroHome' ? 'houseHero'
                : houseId === 'lilaHouse' ? 'houseLila'
                : 'houseMigword';
    c.fillText(Game.i18n.t(nameKey), 20, 40);

    /* Palette strip (categories on top, items below) */
    c.fillStyle = 'rgba(10, 4, 32, 0.78)';
    c.fillRect(0, 50, W, 144);
    c.fillStyle = '#ffd24a';
    c.font = '12px monospace';
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
    c.font = 'bold 11px monospace';
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
      c.font = 'bold 11px monospace';
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
      c.font = '8px monospace';
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
    c.font = 'bold 11px monospace';
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
    c.font = '7px monospace';
    c.textAlign = 'left';
    c.fillText('$1.50', 296, 133);
    /* Small chalkboard menu on the back wall */
    c.fillStyle = '#1a2a1a';
    c.fillRect(360, 70, 140, 64);
    c.strokeStyle = '#88553a';
    c.lineWidth = 3;
    c.strokeRect(360, 70, 140, 64);
    c.fillStyle = '#ffe9f4';
    c.font = 'bold 10px monospace';
    c.textAlign = 'center';
    c.fillText('~ COSMIC MENU ~', 430, 84);
    c.fillStyle = '#ffd24a';
    c.font = '9px monospace';
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
      c.font = '5px monospace';
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
    c.font = '12px monospace';
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
      c.font = 'bold 14px monospace';
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
    c.font = 'bold 11px monospace';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('furnitureExit'), W - 52, H - 141);
    /* Hint at the bottom */
    c.fillStyle = 'rgba(10, 4, 32, 0.7)';
    c.fillRect(0, H - 24, W - 100, 24);
    c.fillStyle = '#ffe9c8';
    c.font = 'bold 11px monospace';
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
      c.font = (hot ? 'bold ' : '') + '9px monospace';
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
      c.font = 'bold 9px monospace';
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
    c.font = 'bold 13px monospace';
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
    c.font = 'bold 26px monospace';
    c.textAlign = 'center';
    c.fillText('★ STAR BAZAAR ★', W / 2, 30);
    c.fillStyle = '#cdeaf4';
    c.font = '12px monospace';
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
      c.font = '9px monospace';
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
    c.font = 'bold 12px monospace';
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
      c.font = '11px monospace';
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
    c.font = 'bold 12px monospace';
    c.textAlign = 'left';
    c.fillText(Game.i18n.t('shopDeliveryTitle'), hintX + 12, hintY + 18);
    c.fillStyle = '#ffe9c8';
    c.font = '11px monospace';
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
    c.font = 'bold 11px monospace';
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
  function drawQuestHUD(c) {
    /* Hotel zoo: guest stamp ledger */
    if (!(Game.engine && Game.engine.getStampCount)) return;
    var got = Game.engine.getStampCount();
    var tot = Game.engine.getStampTotal();
    c.save();
    /* Ledger card top-right */
    var bx = W - 168, by = 38, bw = 158, bh = 30;
    c.fillStyle = 'rgba(58, 36, 24, 0.85)';
    c.fillRect(bx, by, bw, bh);
    c.strokeStyle = '#caa040';
    c.lineWidth = 2;
    c.strokeRect(bx, by, bw, bh);
    c.fillStyle = '#fff8e0';
    c.font = 'bold 12px monospace';
    c.textAlign = 'left';
    c.fillText('🎟️ Guests:', bx + 8, by + 19);
    c.fillStyle = got >= tot ? '#88ff88' : '#ffd24a';
    c.font = 'bold 13px monospace';
    c.textAlign = 'right';
    c.fillText(got + ' / ' + tot, bx + bw - 8, by + 19);
    c.textAlign = 'left';

    /* Banner when complete */
    if (got >= tot) {
      c.fillStyle = '#ffd24a';
      c.font = 'bold 18px monospace';
      c.textAlign = 'center';
      c.fillText('★ All Guests Greeted! ★', W / 2, 30);
      c.textAlign = 'left';
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
    if (species === 'bedroom') {
      roomState.animal = null;
      roomState.bed = (Game.entities && Game.entities.BedroomBed)
        ? new Game.entities.BedroomBed(W - 280, ROOM_FLOOR_BOTTOM - 60)
        : null;
    } else {
      /* Every species room now has both an animal AND a themed bed. */
      if (Game.entities && Game.entities.Animal) {
        /* Place the animal at the far right of the room. */
        roomState.animal = new Game.entities.Animal(species, W - 240, ROOM_FLOOR_BOTTOM - 100);
      }
      roomState.bed = (Game.entities && Game.entities.BedroomBed)
        ? new Game.entities.BedroomBed(ROOM_FLOOR_LEFT + 240, ROOM_FLOOR_BOTTOM - 50)
        : null;
      /* Mark this bed as decorative (won't trigger sleep cutscene). */
      if (roomState.bed) roomState.bed.decorative = true;
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

  function paintSky(c, top, mid, bot) {
    var grad = c.createLinearGradient(0, 0, 0, ROOM_FLOOR_TOP);
    grad.addColorStop(0, top);
    if (mid) grad.addColorStop(0.6, mid);
    grad.addColorStop(1, bot);
    c.fillStyle = grad;
    c.fillRect(0, 0, W, ROOM_FLOOR_TOP);
  }

  function paintGround(c, top, bot, stripe) {
    var g = c.createLinearGradient(0, ROOM_FLOOR_TOP, 0, H);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    c.fillStyle = g;
    c.fillRect(0, ROOM_FLOOR_TOP, W, H - ROOM_FLOOR_TOP);
    if (stripe) {
      c.fillStyle = stripe;
      for (var s = 0; s < W; s += 24) {
        c.fillRect(s, ROOM_FLOOR_TOP + 4, 12, 1.6);
      }
    }
  }

  function paintHabitat(c, habitat) {
    if (habitat === 'savanna') {
      paintSky(c, '#ffb66a', '#ffd28a', '#ffe6b3');
      paintGround(c, '#caa050', '#7a5018');
      /* Sun */
      c.fillStyle = '#fff4c0';
      c.beginPath(); c.arc(W - 140, 90, 30, 0, Math.PI * 2); c.fill();
      /* Acacia tree silhouette */
      c.strokeStyle = '#3a2008'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(140, ROOM_FLOOR_TOP); c.lineTo(140, 130); c.stroke();
      c.fillStyle = '#5a8030';
      c.beginPath(); c.ellipse(140, 110, 60, 18, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#7aa040';
      c.beginPath(); c.ellipse(140, 104, 50, 12, 0, 0, Math.PI * 2); c.fill();
      /* Tall grass tufts */
      c.fillStyle = '#a07820';
      for (var gt = 0; gt < 12; gt++) {
        var gx = 60 + gt * 60;
        c.beginPath();
        c.moveTo(gx, ROOM_FLOOR_TOP + 10);
        c.lineTo(gx + 4, ROOM_FLOOR_TOP - 4);
        c.lineTo(gx + 8, ROOM_FLOOR_TOP + 10);
        c.closePath();
        c.fill();
      }
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
      paintSky(c, '#1a1438', '#2a1858', '#3a2868');
      paintGround(c, '#1a1820', '#0a0810');
      /* Big moon */
      c.fillStyle = '#fff8c0';
      c.beginPath(); c.arc(W - 140, 80, 38, 0, Math.PI * 2); c.fill();
      /* Stars */
      c.fillStyle = '#ffffff';
      for (var stt = 0; stt < 50; stt++) {
        c.beginPath();
        c.arc(((stt * 73) % W), ((stt * 31) % ROOM_FLOOR_TOP), 0.8 + (stt % 3) * 0.5, 0, Math.PI * 2);
        c.fill();
      }
      /* Hollow tree (right) */
      c.fillStyle = '#3a2008';
      c.fillRect(80, ROOM_FLOOR_TOP - 140, 60, 140);
      c.fillStyle = '#1a1408';
      c.beginPath(); c.ellipse(110, ROOM_FLOOR_TOP - 80, 16, 22, 0, 0, Math.PI * 2); c.fill();
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
      paintSky(c, '#7898c8', '#a8c8e0', '#e0eef8');
      paintGround(c, '#ffffff', '#cce0ee');
      /* Iceberg shapes */
      c.fillStyle = '#cce0ee';
      c.beginPath();
      c.moveTo(0, ROOM_FLOOR_TOP);
      c.lineTo(160, ROOM_FLOOR_TOP - 40);
      c.lineTo(280, ROOM_FLOOR_TOP);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(W - 200, ROOM_FLOOR_TOP);
      c.lineTo(W - 100, ROOM_FLOOR_TOP - 50);
      c.lineTo(W, ROOM_FLOOR_TOP);
      c.closePath();
      c.fill();
      /* Aurora glow */
      c.save();
      c.globalAlpha = 0.4;
      var ag = c.createLinearGradient(0, 0, 0, 100);
      ag.addColorStop(0, '#88ffaa');
      ag.addColorStop(1, 'rgba(136,255,170,0)');
      c.fillStyle = ag;
      c.fillRect(0, 0, W, 120);
      c.restore();
    } else if (habitat === 'meadow') {
      paintSky(c, '#88c8e0', '#cce0ee', '#fff8c0');
      paintGround(c, '#7ac848', '#4a8028');
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
      /* Plush rug */
      c.fillStyle = '#aa4488';
      c.fillRect(W / 2 - 200, ROOM_FLOOR_BOTTOM - 8, 400, 8);
      /* Window */
      c.fillStyle = '#ffd24a';
      c.fillRect(120, 60, 100, 80);
      c.strokeStyle = '#5a3a18'; c.lineWidth = 3;
      c.strokeRect(120, 60, 100, 80);
      /* Yarn ball */
      c.fillStyle = '#ff66aa';
      c.beginPath(); c.arc(180, ROOM_FLOOR_BOTTOM - 18, 8, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#cc3377'; c.lineWidth = 1;
      for (var yb = 0; yb < 6; yb++) {
        c.beginPath();
        c.arc(180, ROOM_FLOOR_BOTTOM - 18, 8, yb, yb + Math.PI);
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
      paintSky(c, '#0a3858', '#1a5878', '#3a7898');
      paintGround(c, '#3a5048', '#1a2820');
      /* Kelp strands */
      c.strokeStyle = '#5a8038'; c.lineWidth = 4;
      for (var kp = 0; kp < 10; kp++) {
        var kpx = 60 + kp * 70;
        c.beginPath();
        c.moveTo(kpx, ROOM_FLOOR_TOP + 10);
        c.bezierCurveTo(kpx + 10, 200, kpx - 10, 80, kpx, 0);
        c.stroke();
      }
      /* Bubbles */
      c.fillStyle = 'rgba(255,255,255,0.4)';
      for (var bub = 0; bub < 12; bub++) {
        var bbx = 30 + bub * 60;
        var bby = ((bub * 37 - Date.now() * 0.05) % ROOM_FLOOR_TOP);
        if (bby < 0) bby += ROOM_FLOOR_TOP;
        c.beginPath(); c.arc(bbx, bby, 2 + (bub % 3), 0, Math.PI * 2); c.fill();
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
      paintSky(c, '#88c8e0', '#cce0ee', '#a8d8a8');
      paintGround(c, '#3a78a8', '#1a4878');
      /* Lily pads */
      c.fillStyle = '#3a8a30';
      for (var lp2 = 0; lp2 < 5; lp2++) {
        var lpx = 100 + lp2 * 130;
        c.beginPath(); c.ellipse(lpx, ROOM_FLOOR_BOTTOM - 16, 24, 8, 0, 0, Math.PI * 2); c.fill();
      }
      /* Lily flowers */
      c.fillStyle = '#ffaadd';
      for (var lf2 = 0; lf2 < 3; lf2++) {
        var lfx = 160 + lf2 * 200;
        c.beginPath(); c.arc(lfx, ROOM_FLOOR_BOTTOM - 22, 4, 0, Math.PI * 2); c.fill();
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
      c.font = 'bold 8px monospace';
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
    c.fillStyle = '#3a2418';
    c.fillRect(20, ROOM_FLOOR_BOTTOM - 90, 36, 110);
    c.fillStyle = '#caa040';
    c.fillRect(24, ROOM_FLOOR_BOTTOM - 86, 28, 102);
    c.fillStyle = '#fcd870';
    c.beginPath(); c.arc(46, ROOM_FLOOR_BOTTOM - 30, 2.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff8e0';
    c.font = 'bold 9px monospace';
    c.textAlign = 'center';
    c.fillText('EXIT', 38, ROOM_FLOOR_BOTTOM - 96);
    c.textAlign = 'left';
  }

  /* Themed bed painter — picks a color/prop based on the species. */
  function paintHabitatBed(c, species, bx, by) {
    /* Default frame */
    var p = (Game.entities && Game.entities.ANIMAL_PALETTES &&
             Game.entities.ANIMAL_PALETTES[species]) || { body: '#7a4818', shade: '#5a3018', accent: '#ffd24a' };
    /* Bed scaled up: 100w x 50h */
    c.fillStyle = '#3a2418';
    c.fillRect(bx - 6, by, 100, 50);
    c.fillStyle = p.shade;
    c.fillRect(bx, by + 4, 88, 42);
    /* Headboard */
    c.fillStyle = '#5a3018';
    c.fillRect(bx, by, 18, 50);
    /* Mattress */
    c.fillStyle = '#fff0d8';
    c.fillRect(bx + 18, by + 8, 70, 22);
    /* Pillow */
    c.fillStyle = '#ffffff';
    c.fillRect(bx + 22, by + 10, 22, 14);
    /* Quilt — themed accent */
    c.fillStyle = p.accent;
    c.fillRect(bx + 46, by + 10, 42, 18);
    /* Decorative species-tied prop on the quilt */
    c.fillStyle = p.body;
    c.beginPath();
    c.arc(bx + 67, by + 19, 4, 0, Math.PI * 2);
    c.fill();
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
      paintHabitatBed(c, species, roomState.bed.x, roomState.bed.y);
      /* For the bedroom, layer the heart-quilted bed on top to keep the
         original bedroom-bed look. */
      if (species === 'bedroom') {
        roomState.bed.update();
        roomState.bed.draw(c, 0, 0);
      }
    }

    /* Animal — scaled up so it reads like a zoo exhibit rather than a doll */
    if (roomState.animal) {
      roomState.animal.update();
      var scale = ANIMAL_ROOM_SCALE;
      var anchorX = roomState.animal.x + roomState.animal.w / 2;
      var anchorY = roomState.animal.y + roomState.animal.h;
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
        c.font = 'bold 18px monospace';
        c.textAlign = 'center';
        var bob = Math.sin(Date.now() * 0.005) * 2;
        c.fillText('!', anchorX, anchorY - roomState.animal.h * scale - 16 + bob);
        c.textAlign = 'left';
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

    /* Room title bar across the top */
    c.fillStyle = 'rgba(20, 12, 36, 0.6)';
    c.fillRect(0, 0, W, 28);
    c.fillStyle = '#fff8e0';
    c.font = 'bold 18px monospace';
    c.textAlign = 'center';
    var title = species === 'bedroom'
      ? Game.i18n.t('bedroomLabel')
      : Game.i18n.t('animalName_' + species) + (species === 'monkey' ? '' : "'s Habitat");
    c.fillText(title, W / 2, 20);
    c.textAlign = 'left';

    /* Bed prompt when standing near the bed (only the bedroom bed triggers sleep) */
    if (roomState.bed && !roomState.bed.decorative) {
      var bdx = roomState.px - (roomState.bed.x + roomState.bed.w / 2);
      var bdy = roomState.py - (roomState.bed.y + roomState.bed.h / 2);
      var bdist = Math.sqrt(bdx * bdx + bdy * bdy);
      if (bdist < 110) {
        c.fillStyle = '#88ddff';
        c.font = 'bold 14px monospace';
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
        c.font = 'bold 14px monospace';
        c.textAlign = 'center';
        c.fillText(Game.i18n.t('bookshelfPrompt'), W / 2, 50);
        c.textAlign = 'left';
      }
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
        roomState.animal.interact();
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
    if (roomState.bed)    roomState.bed.update();
  }

  function handleAnimalRoomClick(mx, my, species) {
    /* Tap exit door */
    if (mx >= 20 && mx <= 56 && my >= 320 && my <= 430) return 'exit';
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
  function drawSleepCutscene(c, timer) {
    c.save();

    /* ---- Twilight room backdrop ---- */
    var skyGrad = c.createLinearGradient(0, 0, 0, ROOM_FLOOR_TOP);
    skyGrad.addColorStop(0, '#0a0428');
    skyGrad.addColorStop(0.6, '#1a0c4a');
    skyGrad.addColorStop(1, '#3a2068');
    c.fillStyle = skyGrad;
    c.fillRect(0, 0, W, ROOM_FLOOR_TOP);
    /* Floor */
    c.fillStyle = '#3a2050';
    c.fillRect(0, ROOM_FLOOR_TOP, W, H - ROOM_FLOOR_TOP);
    /* Faint heart wallpaper */
    c.save();
    c.globalAlpha = 0.18;
    c.fillStyle = '#ff66aa';
    for (var hr = 0; hr < 8; hr++) {
      for (var hc = 0; hc < 6; hc++) {
        var hwx = 60 + hr * 100 + (hc % 2 === 0 ? 0 : 50);
        var hwy = 30 + hc * 30;
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
    c.restore();
    /* Window with moon + stars */
    var winX = 100, winY = 50, winW = 160, winH = 130;
    c.fillStyle = '#0a0428';
    c.fillRect(winX, winY, winW, winH);
    c.fillStyle = '#fff8c0';
    c.beginPath(); c.arc(winX + 110, winY + 36, 18, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3a2068';
    c.beginPath(); c.arc(winX + 122, winY + 30, 14, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    for (var stt = 0; stt < 30; stt++) {
      c.beginPath();
      c.arc(winX + ((stt * 13) % winW), winY + ((stt * 7) % winH), 1, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = '#caa040'; c.lineWidth = 3;
    c.strokeRect(winX, winY, winW, winH);
    c.beginPath();
    c.moveTo(winX + winW / 2, winY); c.lineTo(winX + winW / 2, winY + winH);
    c.moveTo(winX, winY + winH / 2); c.lineTo(winX + winW, winY + winH / 2);
    c.stroke();
    /* Pendant lamp glow over the bed */
    c.save();
    c.globalAlpha = 0.5;
    var lampX = W / 2 + 40;
    var lampGrad = c.createRadialGradient(lampX, 200, 6, lampX, 200, 180);
    lampGrad.addColorStop(0, 'rgba(255,224,160,0.55)');
    lampGrad.addColorStop(1, 'rgba(255,224,160,0)');
    c.fillStyle = lampGrad;
    c.beginPath(); c.arc(lampX, 200, 180, 0, Math.PI * 2); c.fill();
    c.restore();

    /* ---- Bed (large, centered-right so the hero is clearly visible) ---- */
    var bedW = 300, bedH = 90;
    var bx = W / 2 - bedW / 2 + 40;
    var by = ROOM_FLOOR_TOP + 70;
    /* Bed shadow */
    c.save();
    c.globalAlpha = 0.4;
    c.fillStyle = '#000000';
    c.beginPath();
    c.ellipse(bx + bedW / 2, by + bedH + 6, bedW / 2 + 10, 6, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    /* Frame */
    c.fillStyle = '#5a3a18';
    c.fillRect(bx, by + bedH - 30, bedW, 30);
    c.fillStyle = '#7a4828';
    c.fillRect(bx, by + bedH - 30, bedW, 4);
    /* Headboard */
    c.fillStyle = '#7a4828';
    c.fillRect(bx, by, 28, bedH);
    c.fillStyle = '#caa040';
    c.fillRect(bx + 4, by + 4, 4, bedH - 8);
    c.fillStyle = '#ffd24a';
    c.beginPath();
    c.moveTo(bx + 14, by - 8);
    c.lineTo(bx + 8, by);
    c.lineTo(bx + 20, by);
    c.closePath();
    c.fill();
    /* Bed legs */
    c.fillStyle = '#3a2010';
    c.fillRect(bx + 6, by + bedH, 6, 12);
    c.fillRect(bx + bedW - 12, by + bedH, 6, 12);
    /* Mattress */
    c.fillStyle = '#fff0d8';
    c.fillRect(bx + 28, by + 18, bedW - 36, bedH - 48);
    /* Pillow (where the head will rest) */
    c.fillStyle = '#ffffff';
    c.fillRect(bx + 40, by + 20, 70, 30);
    c.fillStyle = '#ff99cc';
    c.fillRect(bx + 44, by + 24, 60, 4);
    /* Pink quilt with hearts (covers most of the body) */
    c.fillStyle = '#ff99cc';
    c.fillRect(bx + 110, by + 18, bedW - 120, bedH - 48);
    c.fillStyle = '#ff5577';
    for (var qi = 0; qi < 6; qi++) {
      var qhx = bx + 130 + qi * 22;
      var qhy = by + 32;
      c.beginPath();
      c.arc(qhx - 3, qhy - 1, 3, 0, Math.PI * 2);
      c.arc(qhx + 3, qhy - 1, 3, 0, Math.PI * 2);
      c.moveTo(qhx - 5, qhy);
      c.lineTo(qhx, qhy + 6);
      c.lineTo(qhx + 5, qhy);
      c.closePath();
      c.fill();
    }
    /* Quilt trim */
    c.fillStyle = '#fff0f5';
    c.fillRect(bx + 110, by + 18, bedW - 120, 3);
    c.fillRect(bx + 110, by + bedH - 32, bedW - 120, 3);

    /* ---- Real Momoko sprite, lying down on the pillow ---- */
    if (Game.entities && Game.entities.drawMomokoSprite) {
      c.save();
      /* Center on pillow */
      var heroX = bx + 75;
      var heroY = by + 35;
      c.translate(heroX, heroY);
      /* Rotate -90° so she's lying on her back (head on pillow, feet under quilt) */
      c.rotate(-Math.PI / 2);
      /* Scale up so she's clearly visible */
      c.scale(2.0, 2.0);
      /* Draw with sprite center anchored at translation point */
      c.translate(-14, -20);
      Game.entities.drawMomokoSprite(c, 0, 0, Game.customization, 0);
      c.restore();
      /* Closed-eye overlay (sleeping face) — covers her eyes with two lash arcs */
      c.save();
      c.strokeStyle = '#1a1a1a';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(bx + 70, by + 36);
      c.quadraticCurveTo(bx + 73, by + 38, bx + 76, by + 36);
      c.moveTo(bx + 80, by + 36);
      c.quadraticCurveTo(bx + 83, by + 38, bx + 86, by + 36);
      c.stroke();
      /* Eyelashes */
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(bx + 70, by + 36); c.lineTo(bx + 68, by + 34);
      c.moveTo(bx + 76, by + 36); c.lineTo(bx + 78, by + 34);
      c.moveTo(bx + 80, by + 36); c.lineTo(bx + 78, by + 34);
      c.moveTo(bx + 86, by + 36); c.lineTo(bx + 88, by + 34);
      c.stroke();
      /* Rosy cheek */
      c.fillStyle = 'rgba(255,150,170,0.7)';
      c.beginPath(); c.arc(bx + 64, by + 38, 2.4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(bx + 92, by + 38, 2.4, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    /* ---- Plush bunny tucked beside her on the pillow ---- */
    var pbX = bx + 36, pbY = by + 36;
    c.fillStyle = '#fff0f5';
    c.beginPath(); c.arc(pbX, pbY, 8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(pbX - 4, pbY - 12, 1.6, 6, -0.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(pbX + 4, pbY - 12, 1.6, 6, 0.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.arc(pbX - 2, pbY - 1, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(pbX + 2, pbY - 1, 0.8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff99bb';
    c.beginPath(); c.arc(pbX, pbY + 1.6, 0.8, 0, Math.PI * 2); c.fill();

    /* ---- Animated rising ZZZ over the hero's head ---- */
    var zStartT = 20;
    if (timer > zStartT) {
      var zT = timer - zStartT;
      for (var i = 0; i < 4; i++) {
        var zPhase = (zT - i * 40) % 200;
        if (zPhase < 0) continue;
        var alpha = Math.max(0, 1 - zPhase / 200);
        var dy = -zPhase * 0.7;
        var size = 22 + i * 6 + zPhase * 0.08;
        c.save();
        c.globalAlpha = alpha;
        c.fillStyle = '#88ddff';
        c.font = 'bold ' + Math.floor(size) + 'px monospace';
        c.textAlign = 'center';
        c.fillText('Z', bx + 110 + i * 14, by + 4 + dy);
        c.restore();
      }
    }

    /* ---- Title text ---- */
    c.fillStyle = '#fff8e0';
    c.font = 'bold 26px monospace';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('sleepText'), W / 2, 36);

    /* Cozy "good night" line beneath the title */
    c.fillStyle = '#ffd6e8';
    c.font = '13px monospace';
    c.fillText('🌙 Good night, Momoko 🌙', W / 2, 60);

    /* Tap to wake hint after a beat */
    if (timer > 80) {
      c.fillStyle = '#bbbbcc';
      c.font = '12px monospace';
      c.fillText(Game.i18n.t('tapAnywhere'), W / 2, H - 18);
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
    c.font = 'bold 18px monospace';
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
    c.font = 'bold 14px monospace';
    c.textAlign = 'left';
    c.fillText(Game.i18n.t('receptionistName') + ' —', panelX + 12, panelY + 22);

    /* Body text — intro for the first ~60 frames, then story pages */
    c.fillStyle = '#fff4d8';
    c.font = '13px monospace';
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
      c.font = '11px monospace';
      c.textAlign = 'right';
      c.fillText('Page ' + (page + 1) + ' / ' + BOOK_PAGE_KEYS.length,
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
  /* Listed in floor order so the player can mentally map them. */
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
    c.fillRect(0, 0, W, H);

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
    c.font = 'bold 22px monospace';
    c.textAlign = 'left';
    c.fillText(Game.i18n.t('ledgerTitle'), cardX + 18, cardY + 30);

    var got = (Game.engine && Game.engine.getStampCount) ? Game.engine.getStampCount() : 0;
    var tot = (Game.engine && Game.engine.getStampTotal) ? Game.engine.getStampTotal() : LEDGER_SPECIES.length;
    var progress = Game.i18n.t('ledgerProgress')
      .replace('%s', got).replace('%s', tot);
    c.fillStyle = got >= tot ? '#3a8030' : '#7a5a18';
    c.font = 'bold 14px monospace';
    c.textAlign = 'right';
    c.fillText(progress, cardX + cardW - 18, cardY + 30);

    c.fillStyle = '#7a5a18';
    c.font = '12px monospace';
    c.textAlign = 'left';
    c.fillText(Game.i18n.t('ledgerSubtitle'), cardX + 18, cardY + 50);

    if (got >= tot) {
      c.fillStyle = '#3a8030';
      c.font = 'bold 14px monospace';
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
      c.font = 'bold 11px monospace';
      c.textAlign = 'left';
      c.fillText(Game.i18n.t('animalName_' + sp), ix + 6, iy + 14);

      /* Stamp / unvisited indicator */
      c.font = 'bold 10px monospace';
      c.textAlign = 'right';
      if (stamped) {
        /* Red rotated stamp-style label */
        c.save();
        c.translate(ix + colW - 14, iy + 14);
        c.rotate(-0.18);
        c.fillStyle = 'rgba(170, 24, 36, 0.92)';
        c.fillText('★ ' + Game.i18n.t('ledgerStamped'), 0, 0);
        c.restore();
      } else {
        c.fillStyle = '#aaa';
        c.fillText(Game.i18n.t('ledgerUnvisited'), ix + colW - 14, iy + 14);
      }
    }

    /* Hints + close button */
    c.fillStyle = '#7a5a18';
    c.font = '11px monospace';
    c.textAlign = 'left';
    c.fillText(Game.i18n.t('ledgerHint'), cardX + 18, cardY + cardH - 18);

    var btnW = 120, btnH = 32;
    var btnX = cardX + cardW - btnW - 18;
    var btnY = cardY + cardH - btnH - 14;
    ledgerCloseRect.x = btnX; ledgerCloseRect.y = btnY;
    ledgerCloseRect.w = btnW; ledgerCloseRect.h = btnH;
    c.fillStyle = '#ff99cc';
    roundRect(c, btnX, btnY, btnW, btnH, 8);
    c.fill();
    c.strokeStyle = '#a85578';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#3a1428';
    c.font = 'bold 14px monospace';
    c.textAlign = 'center';
    c.fillText(Game.i18n.t('ledgerClose'), btnX + btnW / 2, btnY + btnH / 2 + 5);
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
    /* The PLAYING-state world is still loaded; we paint it as the
       backdrop, then overlay the cutscene actors. */
    /* We can't easily call the engine's renderGame from here, so we
       paint a simple lobby tint over whatever was last rendered, then
       draw the monkey at a tweened position over the player. */
    c.save();
    c.fillStyle = 'rgba(10, 5, 20, 0.5)';
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

    /* Speech-bubble over the monkey */
    if (timer > 80) {
      c.fillStyle = '#fff8e0';
      c.strokeStyle = '#5a3a18';
      c.lineWidth = 2;
      var tx = monkeySx - 70, ty = monkeySy - 70, tw = 180, th = 36;
      roundRect(c, tx, ty, tw, th, 8);
      c.fill();
      c.stroke();
      c.fillStyle = '#1a1a1a';
      c.font = 'bold 12px monospace';
      c.textAlign = 'center';
      c.fillText(Game.i18n.t('monkeyEscort'), tx + tw / 2, ty + 22);
      c.textAlign = 'left';
    }
    c.restore();
  }

  window.Game.ui = {
    drawTitleScreen: function (c) {
      drawTitleScreen(c);
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
    c.font = '11px monospace';
    c.textAlign = 'right';
    c.textBaseline = 'alphabetic';
    var stamp = Game.VERSION + (Game.BUILD ? ' (' + Game.BUILD + ')' : '');
    c.fillText(stamp, W - 8, H - 8);
    c.restore();
  }
})();
