/* input.js – keyboard + touch controls */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var keys = { left: false, right: false, up: false, down: false, action: false, pause: false, ledger: false };
  /* Keyboard state, kept separate from touch and merged into `keys`
     every frame by processTouches(). Both sources used to write into
     `keys` directly, which meant a finger release could never be
     cleared -- worked around by zeroing the keyboard on any touch-
     capable device, which disabled the keyboard on touchscreen
     laptops and tablets with keyboard cases. */
  var kb = { left: false, right: false, up: false, down: false, action: false, pause: false, ledger: false };
  var justPressed = { action: false, pause: false, ledger: false };
  var prevKeys = { action: false, pause: false, ledger: false };
  /* A key tapped and released between two frames would never be seen
     by the per-frame edge detect in update(), so keydown latches it
     here until the next update() consumes it. */
  var tapped = { action: false, pause: false, ledger: false };

  /* Touch state – each touch: { x, y, button } where button is a sticky binding
     so a finger that lands on a direction button keeps that button pressed
     even if the finger slides off it (matches keyboard hold feel). */
  var touches = {};
  var touchButtons = {
    up: { x: 0, y: 0, r: 0, active: false },
    down: { x: 0, y: 0, r: 0, active: false },
    left: { x: 0, y: 0, r: 0, active: false },
    right: { x: 0, y: 0, r: 0, active: false },
    action: { x: 0, y: 0, r: 0, active: false },
    pause: { x: 0, y: 0, r: 0, active: false },
  };
  var BUTTON_NAMES = ['up', 'down', 'left', 'right', 'action', 'pause'];
  var isTouchDevice = false;
  /* Mouse pointer in game-space, for button hover/press feedback. Only
     real mice update it -- touch taps would leave a stale "hover". */
  var pointer = { x: -1, y: -1, px: -1, py: -1, down: false };
  var canvas = null;
  var canvasRect = null;
  var GAME_W = 800;   /* logical game viewport width */
  var GAME_H = 480;   /* logical game viewport height */

  /* Helpers: the canvas's backing store is scaled by devicePixelRatio for
     crisp rendering, so canvas.width / canvas.height are *not* logical
     pixels. These helpers return the logical (pre-DPR) dimensions that
     all game/input math reasons about. */
  function dprFactor() {
    return Math.min(3, window.devicePixelRatio || 1);
  }
  function canvasLogicalW() {
    if (!canvas) return 0;
    return canvas.width / dprFactor();
  }
  function canvasLogicalH() {
    if (!canvas) return 0;
    return canvas.height / dprFactor();
  }
  /* On touch devices the canvas is wider (and sometimes taller) than the
     game viewport – control strips live on the sides, optional bezels
     above/below for tablets. Engine.js publishes Game.TOUCH_LEFT_W /
     Game.TOUCH_RIGHT_W / Game.GAME_Y; fall back to centred padding if
     it hasn't initialised yet. */
  function hasAsymmetricStrips() {
    return canvas &&
           typeof Game.TOUCH_LEFT_W === 'number' &&
           typeof Game.TOUCH_RIGHT_W === 'number' &&
           canvasLogicalW() > GAME_W;
  }
  function leftStripW() {
    if (hasAsymmetricStrips()) return Game.TOUCH_LEFT_W;
    return Math.max(0, Math.floor((canvasLogicalW() - GAME_W) / 2));
  }
  function rightStripW() {
    if (hasAsymmetricStrips()) return Game.TOUCH_RIGHT_W;
    return Math.max(0, Math.floor((canvasLogicalW() - GAME_W) / 2));
  }
  function topStripH() {
    if (canvas && typeof Game.GAME_Y === 'number') return Game.GAME_Y;
    return Math.max(0, Math.floor((canvasLogicalH() - GAME_H) / 2));
  }
  function bottomStripH() {
    if (!canvas) return 0;
    return Math.max(0, canvasLogicalH() - GAME_H - topStripH());
  }
  function gameOffsetX() {
    return leftStripW();
  }
  function gameOffsetY() {
    return topStripH();
  }
  /* Back-compat helper – any caller that asks for "the strip width" really
     wants the left one, because that's the D-pad side. */
  function sideStripW() {
    return leftStripW();
  }

  /* Keyboard */
  function onKeyDown(e) {
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': kb.left = true; break;
      case 'ArrowRight': case 'KeyD': kb.right = true; break;
      case 'ArrowUp': case 'KeyW': kb.up = true; break;
      case 'ArrowDown': case 'KeyS': kb.down = true; break;
      case 'Space': case 'KeyZ': if (!kb.action) tapped.action = true; kb.action = true; e.preventDefault(); break;
      case 'Escape': case 'KeyP': if (!kb.pause) tapped.pause = true; kb.pause = true; break;
      case 'KeyB': if (!kb.ledger) tapped.ledger = true; kb.ledger = true; break;
    }
  }

  function onKeyUp(e) {
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': kb.left = false; break;
      case 'ArrowRight': case 'KeyD': kb.right = false; break;
      case 'ArrowUp': case 'KeyW': kb.up = false; break;
      case 'ArrowDown': case 'KeyS': kb.down = false; break;
      case 'Space': case 'KeyZ': kb.action = false; break;
      case 'Escape': case 'KeyP': kb.pause = false; break;
      case 'KeyB': kb.ledger = false; break;
    }
  }

  /* Touch coord mapping – scale to actual canvas dimensions
     (canvas may be 800×480 on desktop or 800×600 on touch devices). */
  function touchToCanvas(touch) {
    if (!canvasRect) canvasRect = canvas.getBoundingClientRect();
    return {
      x: (touch.clientX - canvasRect.left) / (canvasRect.width / canvasLogicalW()),
      y: (touch.clientY - canvasRect.top) / (canvasRect.height / canvasLogicalH())
    };
  }

  function buttonAt(pos) {
    for (var i = 0; i < BUTTON_NAMES.length; i++) {
      if (hitTest(pos, touchButtons[BUTTON_NAMES[i]])) return BUTTON_NAMES[i];
    }
    return null;
  }

  function hitTest(pos, btn) {
    var dx = pos.x - btn.x;
    var dy = pos.y - btn.y;
    return (dx * dx + dy * dy) <= (btn.r * btn.r);
  }

  function processTouches() {
    for (var i = 0; i < BUTTON_NAMES.length; i++) touchButtons[BUTTON_NAMES[i]].active = false;

    var ids = Object.keys(touches);
    for (var i2 = 0; i2 < ids.length; i2++) {
      var tr = touches[ids[i2]];
      if (tr.button) touchButtons[tr.button].active = true;
    }

    /* Merge both input sources instead of letting either clobber the other. */
    keys.up = kb.up || touchButtons.up.active;
    keys.down = kb.down || touchButtons.down.active;
    keys.left = kb.left || touchButtons.left.active;
    keys.right = kb.right || touchButtons.right.active;
    keys.action = kb.action || touchButtons.action.active;
    keys.pause = kb.pause || touchButtons.pause.active;
    keys.ledger = kb.ledger;
  }

  function onTouchStart(e) {
    e.preventDefault();
    isTouchDevice = true;
    canvasRect = canvas.getBoundingClientRect();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      var pos = touchToCanvas(t);
      touches[t.identifier] = { x: pos.x, y: pos.y, button: buttonAt(pos) };
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    canvasRect = canvas.getBoundingClientRect();
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      var pos = touchToCanvas(t);
      var tr = touches[t.identifier];
      if (!tr) continue;
      tr.x = pos.x; tr.y = pos.y;
      /* Sticky: only re-bind if finger slides ONTO a different button.
         Sliding off into empty space keeps the existing button pressed. */
      var over = buttonAt(pos);
      if (over) tr.button = over;
    }
  }

  function onTouchEnd(e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) {
      delete touches[e.changedTouches[i].identifier];
    }
  }

  /* Layout touch buttons in canvas coordinates. On touch devices the
     canvas is wider than the game viewport (side strips on each side);
     the D-pad lives in the left strip and BUBBLE in the right strip, so
     thumbs never cover gameplay. The buttons are vertically centered on
     the canvas (not the game viewport) so on tall tablets where the
     canvas extends above/below the game, thumbs land naturally on the
     side bezel rather than reaching toward the middle of the screen.
     Pause sits in the upper-right corner of the game viewport so it's
     close at hand but out of the way. */
  function layoutButtons() {
    if (!canvas) return;
    var lStrip = leftStripW();
    var rStrip = rightStripW();
    var tStrip = topStripH();
    var hasSideStrips = lStrip > 0;
    if (hasSideStrips) {
      var leftCx = lStrip / 2;
      var rightCx = canvasLogicalW() - rStrip / 2;
      var cy = canvasLogicalH() / 2;
      /* D-pad sized off the actual strip width so a wider strip gives
         larger, easier-to-hit buttons on iPhone. The 0.85 factor shrinks
         the buttons 15% from the previous layout at Momoko's request so
         they sit more comfortably in the left strip. */
      var pad = Math.floor(Math.min(54, Math.floor(lStrip / 4.5)) * 0.85);
      var spacing = Math.floor(Math.min(66, Math.floor(lStrip / 3.8)) * 0.85);
      touchButtons.up =    { x: leftCx, y: cy - spacing, r: pad, active: false };
      touchButtons.down =  { x: leftCx, y: cy + spacing, r: pad, active: false };
      touchButtons.left =  { x: leftCx - spacing, y: cy, r: pad, active: false };
      touchButtons.right = { x: leftCx + spacing, y: cy, r: pad, active: false };
      touchButtons.action = { x: rightCx, y: cy, r: 80, active: false };
      /* Pause sits in the upper-right bezel square (the empty space above
         the BUBBLE button) rather than over gameplay, so it no longer
         obscures the action. */
      touchButtons.pause  = { x: rightCx, y: 30, r: 22, active: false };
    } else {
      /* Keyboard-only / desktop fallback – touch buttons aren't actually
         drawn in this branch (isTouchDevice is false), but keep a layout
         so hit-tests remain well-defined. */
      var pad2 = 38, bx2 = 100, by2 = 370, sp2 = pad2 * 2;
      touchButtons.up =    { x: bx2, y: by2 - sp2, r: pad2, active: false };
      touchButtons.down =  { x: bx2, y: by2 + sp2, r: pad2, active: false };
      touchButtons.left =  { x: bx2 - sp2, y: by2, r: pad2, active: false };
      touchButtons.right = { x: bx2 + sp2, y: by2, r: pad2, active: false };
      touchButtons.action = { x: 700, y: 380, r: 50, active: false };
      touchButtons.pause  = { x: 770, y: 30, r: 25, active: false };
    }
  }

  function init(cvs) {
    canvas = cvs;
    canvasRect = canvas.getBoundingClientRect();
    layoutButtons();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
    canvas.addEventListener('pointermove', onPointer);
    canvas.addEventListener('pointerdown', onPointer);
    window.addEventListener('pointerup', onPointer);
    canvas.addEventListener('pointerleave', function () {
      pointer.x = pointer.y = pointer.px = pointer.py = -1;
      pointer.down = false;
    });

    isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  }

  /* Call once per frame before reading keys */
  function update() {
    /* Detect just-pressed (rising edge) */
    justPressed.action = (keys.action && !prevKeys.action) || tapped.action;
    justPressed.pause = (keys.pause && !prevKeys.pause) || tapped.pause;
    justPressed.ledger = (keys.ledger && !prevKeys.ledger) || tapped.ledger;
    prevKeys.action = keys.action;
    prevKeys.pause = keys.pause;
    prevKeys.ledger = keys.ledger;
    tapped.action = false;
    tapped.pause = false;
    tapped.ledger = false;
  }

  /* Call at end of frame to clear keyboard-only states (touch states reset via processTouches) */
  function postUpdate() {
    /* Reset keyboard-only flags for single-frame presses handled by justPressed */
  }

  /* Refresh rect on resize */
  function refreshLayout() {
    if (canvas) canvasRect = canvas.getBoundingClientRect();
  }

  /* Paint the bezel surrounding the game viewport plus (optionally) the
     touch buttons. Called every frame on touch devices so the bezel
     background is always present under the buttons. The game viewport
     itself gets fully overwritten by the state renderer afterwards, so
     it's safe to paint across it here. */
  function drawTouchStrip(c, showButtons) {
    if (!canvas) return;
    var cw = canvasLogicalW();
    var ch = canvasLogicalH();
    var gx = gameOffsetX();
    var gy = gameOffsetY();
    var rEdge = gx + GAME_W;
    var bEdge = gy + GAME_H;

    c.save();
    /* Bezel fill across the entire canvas – deep plum, the hotel's night
       colour, so the frame belongs to the game rather than the device. */
    var bz = c.createLinearGradient(0, 0, 0, ch);
    bz.addColorStop(0, '#1e0e26');
    bz.addColorStop(1, '#140818');
    c.fillStyle = bz;
    c.fillRect(0, 0, cw, ch);

    /* Inner-edge glow framing the game viewport so the bezel reads as a
       deliberate frame rather than letterboxing. Skip a side if the game
       viewport is already flush against that edge. */
    /* The glow and frame hug the viewport only. Running them the full
       canvas width/height crossed the side bezels and split them into
       boxes. */
    if (gx > 0) paintEdgeGlow(c, gx - 10, gy, 10, GAME_H, 'h', false);
    if (rEdge < cw) paintEdgeGlow(c, rEdge, gy, 10, GAME_H, 'h', true);
    if (gy > 0) paintEdgeGlow(c, gx, gy - 10, GAME_W, 10, 'v', false);
    if (bEdge < ch) paintEdgeGlow(c, gx, bEdge, GAME_W, 10, 'v', true);

    /* Brass hairline at the game viewport edges (drawn in bezel space –
       the state renderer will paint over the inside of the rect). */
    if (gx > 0 || gy > 0 || rEdge < cw || bEdge < ch) {
      c.strokeStyle = '#8a6430';
      c.lineWidth = 2;
      c.strokeRect(gx - 1, gy - 1, GAME_W + 2, GAME_H + 2);
    }
    c.restore();

    if (showButtons) drawTouchButtons(c);
  }

  /* `dir` is 'h' for a vertical bezel band (gradient runs horizontally)
     or 'v' for a horizontal bezel band (gradient runs vertically). When
     `inward` is true the glow brightens toward the game-viewport side. */
  function paintEdgeGlow(c, x, y, w, h, dir, inward) {
    var grad;
    if (dir === 'h') {
      grad = c.createLinearGradient(x, 0, x + w, 0);
    } else {
      grad = c.createLinearGradient(0, y, 0, y + h);
    }
    if (inward) {
      grad.addColorStop(0, 'rgba(232,184,96,0.22)');
      grad.addColorStop(1, 'rgba(30,14,38,0)');
    } else {
      grad.addColorStop(0, 'rgba(30,14,38,0)');
      grad.addColorStop(1, 'rgba(232,184,96,0.22)');
    }
    c.fillStyle = grad;
    c.fillRect(x, y, w, h);
  }

  function drawTouchButtons(c) {
    if (!isTouchDevice) return;
    c.save();
    c.globalAlpha = 0.9;

    /* D-pad center – computed from button positions so it matches layout.
       Drawn first as a plum cross-plate the four buttons sit on. */
    var centerX = (touchButtons.left.x + touchButtons.right.x) / 2;
    var centerY = (touchButtons.up.y + touchButtons.down.y) / 2;
    c.fillStyle = '#2a1436';
    c.beginPath();
    c.arc(centerX, centerY, 26, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(232,184,96,0.5)';
    c.lineWidth = 2;
    c.stroke();

    /* D-pad buttons – the same plum-and-brass as the menu buttons */
    var btns = ['up', 'down', 'left', 'right'];
    var arrows = ['\u25B2', '\u25BC', '\u25C0', '\u25B6'];
    for (var i = 0; i < btns.length; i++) {
      var b = touchButtons[btns[i]];
      paintRoundButton(c, b, b.active ? ['#a868d8', '#6a34a0'] : ['#6c3a9c', '#3e1a64'], '#e8b860');
      c.fillStyle = b.active ? '#ffffff' : '#fbe8ff';
      c.font = 'bold 30px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(arrows[i], b.x, b.y + (b.active ? 2 : 0));
    }

    /* Action button – the pink call-to-action colour, gold rim */
    var ab = touchButtons.action;
    paintRoundButton(c, ab, ab.active ? ['#ffb8e4', '#f052b0'] : ['#ff8ad0', '#d0308c'], '#ffe6a0');
    c.fillStyle = '#ffffff';
    c.font = 'bold 24px "M PLUS Rounded 1c", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = 'rgba(110, 10, 70, 0.6)';
    c.shadowOffsetY = 2;
    var bubbleLabel = (window.Game && Game.i18n) ? Game.i18n.t('bubbleBtn') : 'BUBBLE';
    c.fillText(bubbleLabel, ab.x, ab.y + (ab.active ? 2 : 0));
    c.shadowColor = 'transparent';
    c.shadowOffsetY = 0;

    /* Pause button */
    var pb = touchButtons.pause;
    paintRoundButton(c, pb, pb.active ? ['#8a52c4', '#55268a'] : ['#4e2a6e', '#2e1444'], '#c89a48');
    c.fillStyle = '#fbe8ff';
    c.fillRect(pb.x - 6, pb.y - 7, 4, 14);
    c.fillRect(pb.x + 2, pb.y - 7, 4, 14);

    c.restore();
  }

  /* Glossy round touch button: drop shadow, vertical gradient, top
     highlight and a metallic rim. Sinks 2px while held. */
  function paintRoundButton(c, b, cols, rim) {
    var oy = b.active ? 2 : 0;
    if (!b.active) {
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.beginPath(); c.arc(b.x, b.y + 3, b.r, 0, Math.PI * 2); c.fill();
    }
    var g = c.createLinearGradient(0, b.y - b.r + oy, 0, b.y + b.r + oy);
    g.addColorStop(0, cols[0]);
    g.addColorStop(1, cols[1]);
    c.fillStyle = g;
    c.beginPath(); c.arc(b.x, b.y + oy, b.r, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.16)';
    c.beginPath(); c.ellipse(b.x, b.y + oy - b.r * 0.45, b.r * 0.7, b.r * 0.35, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = rim;
    c.lineWidth = 2;
    c.beginPath(); c.arc(b.x, b.y + oy, b.r, 0, Math.PI * 2); c.stroke();
  }

  /* Click handling for menus. Returns game-space coordinates (0..GAME_W,
     0..GAME_H) so menu hit-tests keep working regardless of whether the
     canvas is padded with side strips. */
  function getClickPos(e) {
    var rect = canvas.getBoundingClientRect();
    var cx, cy;
    if (e.changedTouches && e.changedTouches.length > 0) {
      cx = e.changedTouches[0].clientX;
      cy = e.changedTouches[0].clientY;
    } else {
      cx = e.clientX;
      cy = e.clientY;
    }
    var canvasX = (cx - rect.left) / (rect.width / canvasLogicalW());
    var canvasY = (cy - rect.top) / (rect.height / canvasLogicalH());
    return { x: canvasX - gameOffsetX(), y: canvasY - gameOffsetY() };
  }

  function onPointer(e) {
    if (e.pointerType !== 'mouse') return;
    if (e.type === 'pointerup') { pointer.down = false; return; }
    var p = getClickPos(e);
    var rect = canvas.getBoundingClientRect();
    pointer.x = p.x;
    pointer.y = p.y;
    /* Backing-store pixels, so painters can map it through whatever
       transform is current when they draw (see ui.js pointerOver). */
    pointer.px = (e.clientX - rect.left) * canvas.width / rect.width;
    pointer.py = (e.clientY - rect.top) * canvas.height / rect.height;
    if (e.type === 'pointerdown') pointer.down = true;
  }

  window.Game.input = {
    init: init,
    update: function () {
      processTouches();
      update();
    },
    postUpdate: postUpdate,
    refreshLayout: function () { refreshLayout(); layoutButtons(); },
    keys: keys,
    justPressed: justPressed,
    drawTouchStrip: drawTouchStrip,
    drawTouchButtons: drawTouchButtons,
    /* Legacy alias – calls the new strip + buttons painter. */
    drawTouchControls: function (c) { drawTouchStrip(c, true); },
    getClickPos: getClickPos,
    pointer: pointer,
    isTouch: function () { return isTouchDevice; },
  };
})();
