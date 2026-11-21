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

  /* Coats keep the save ids from the old crab pet: red/blue/gold. */
  var COATS = {
    red:  { body: '#a96a3b', ear: '#6b3f1f', cream: '#f5e0bf', nose: '#2c1a14', collar: '#e0405a', tag: '#ffd24a', blaze: true },
    blue: { body: '#f3efe8', ear: '#523c2f', cream: '#ffffff', nose: '#2c1a14', collar: '#3f8fe0', tag: '#ffd24a', patch: '#5c4434' },
    gold: { body: '#efbd5c', ear: '#c88b39', cream: '#fbe8bf', nose: '#3a2418', collar: '#ff6fa8', tag: '#fff3b8', blaze: true, fluff: true }
  };
  var ALIAS = { brown: 'red', spotted: 'blue', golden: 'gold' };
  function coatOf(v) { return COATS[ALIAS[v] || v] || null; }

  function newPose() {
    return { ph: 0, gait: 0, bound: 0, bob: 0, pitch: 0, sit: 0, headUp: 0, tilt: 0,
             ear: 0, wag: 0, open: 1, pant: 0, tongue: 0, sx: 1, t: 0 };
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
    var dxB = -Math.sin(pb) * 3.0, liftB = Math.max(0, Math.cos(pb)) * 1.7;
    return [(dxT + (dxB - dxT) * b) * g, (liftT + (liftB - liftT) * b) * g];
  }

  function drawLeg(c, hx, hy, fx, fy, r, hex, paw, noInk) {
    K.part(c, function () { capsule(c, hx, hy, fx, fy - 0.55, r, r * 0.92); }, hex, 0.5, null, noInk);
    K.part(c, ellP(c, fx - 0.25, fy - 0.62, 1.5, 0.82, 0), paw, 0.4);
  }

  function paint(c, coat, P, u) {
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
    var tl = coat.fluff ? 6 : 5.4;
    var tmx = tb[0] + Math.cos(ta + 0.5) * tl * 0.55, tmy = tb[1] + Math.sin(ta + 0.5) * tl * 0.55;
    var tex = tb[0] + Math.cos(ta - 0.35) * tl, tey = tb[1] + Math.sin(ta - 0.35) * tl;
    c.beginPath(); c.moveTo(tb[0], tb[1]); c.quadraticCurveTo(tmx, tmy, tex, tey);
    c.strokeStyle = R.ink; c.lineWidth = (coat.fluff ? 3.1 : 2.4) + K.ink(u) * 2; c.stroke();
    c.strokeStyle = R.c; c.lineWidth = coat.fluff ? 3.1 : 2.4; c.stroke();
    c.beginPath(); c.moveTo(tmx, tmy); c.quadraticCurveTo(tmx + (tex - tmx) * 0.6, tmy + (tey - tmy) * 0.6, tex, tey);
    c.strokeStyle = coat.fluff ? coat.cream : R.l; c.lineWidth = coat.fluff ? 1.6 : 0.9; c.globalAlpha = 0.8; c.stroke(); c.globalAlpha = 1;

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
    c.restore();

    /* near legs */
    var f2 = footOf(P, 2), f0 = footOf(P, 0);
    var hp2 = rot(HIP_X[2] - 0.6, -6.2);
    var h2x = HIP_X[2] + f2[0] - sit * 4.4, h2y = -f2[1] * (1 - sit);
    var pawC = coat.blaze ? coat.cream : coat.body;
    drawLeg(c, hp2[0], hp2[1], h2x + (hp2[0] - h2x) * sit * 0.3, h2y, 1.2, coat.body, pawC);
    var sh0 = rot(HIP_X[0], -6.6);
    drawLeg(c, sh0[0], sh0[1], HIP_X[0] + f0[0], -f0[1], 1.1, coat.body, pawC);

    /* head on the neck pivot */
    var nk = rot(-3.4, -10.6);
    c.save();
    c.translate(nk[0], nk[1] - P.bob * 0.35);
    c.rotate(P.tilt + P.headUp * 0.38 - P.pitch * 0.6);
    c.translate(3.4, 10.6);

    /* far ear peeking over the crown */
    K.part(c, ellP(c, -7.9, -17.6, 1.25, 2.1, -0.5 - P.ear * 0.5), earR.m, 0.4);
    /* skull, muzzle */
    K.part(c, ellP(c, -6.7, -13.6, 5.1, 4.8, 0), coat.body, 0.8, coat.patch ? function () {
      c.beginPath(); c.ellipse(-7.9, -14.7, 2.1, 1.9, 0.2, 0, TAU); c.fillStyle = coat.patch; c.fill();
    } : function () {
      c.beginPath(); c.ellipse(-8.6, -15.6, 1.4, 2.2, 0.3, 0, TAU); c.fillStyle = coat.cream; c.globalAlpha = 0.55; c.fill(); c.globalAlpha = 1;
    });
    K.part(c, ellP(c, -10.3, -11.9, 3.0, 2.2, 0.08), coat.cream, 0.45);
    /* mouth: a little smile, or open with a tongue while panting */
    if (P.pant > 0.05) {
      var po = P.pant;
      c.beginPath(); c.ellipse(-10.6, -10.4, 1.25, 0.95 * po, 0, 0, Math.PI); c.fillStyle = '#7a2a3a'; c.fill();
      c.beginPath(); c.ellipse(-10.3, -9.9 + P.tongue * 0.25 * po, 0.8, 1.15 * po, 0.1, 0, TAU); c.fillStyle = '#ff7f9a'; c.fill();
    }
    c.beginPath(); c.moveTo(-12.0, -10.9); c.quadraticCurveTo(-11.2, -10.1, -10.4, -10.6); c.quadraticCurveTo(-9.8, -10.0, -9.0, -10.5);
    c.strokeStyle = K.ramp(coat.cream).ink; c.lineWidth = K.ink(u) * 0.9; c.stroke();
    /* nose */
    c.beginPath(); c.ellipse(-12.8, -12.8, 1.2, 0.95, 0, 0, TAU); c.fillStyle = coat.nose; c.fill();
    K.gloss(c, -13.1, -13.2, 0.45, 0.28, 0, 0.75);
    /* cheek blush */
    c.beginPath(); c.ellipse(-7.6, -11.9, 1.15, 0.6, 0, 0, TAU); c.fillStyle = 'rgba(255,120,140,0.32)'; c.fill();
    /* eye */
    var op = P.open;
    if (op > 0.25) {
      c.beginPath(); c.ellipse(-8.2, -14.4, 1.0, 1.2 * op, 0, 0, TAU); c.fillStyle = '#2a1a14'; c.fill();
      K.gloss(c, -8.5, -14.9 * (op > 0.6 ? 1 : 0.995), 0.4, 0.4 * op, 0, 0.95);
      K.gloss(c, -7.9, -13.9, 0.18, 0.18 * op, 0, 0.8);
    } else {
      c.beginPath(); c.arc(-8.2, -14.6, 0.95, 0.25, Math.PI - 0.25);
      c.strokeStyle = '#2a1a14'; c.lineWidth = K.ink(u) * 1.1; c.stroke();
    }
    /* near ear: floppy, swinging on its spring */
    c.save();
    c.translate(-4.4, -16.6); c.rotate(P.ear);
    K.part(c, ellP(c, 0.9, 3.0, 1.8, 3.5, 0.3), coat.ear, 0.45, function () {
      c.beginPath(); c.ellipse(0.4, 2.2, 0.8, 2.2, 0.3, 0, TAU); c.fillStyle = earR.l; c.globalAlpha = 0.35; c.fill(); c.globalAlpha = 1;
    });
    c.restore();
    /* collar and swinging tag */
    c.beginPath(); c.ellipse(-4.3, -10.7, 2.7, 3.3, 0.35, 0.35, 2.75);
    c.strokeStyle = K.ramp(coat.collar).ink; c.lineWidth = 1.35 + K.ink(u) * 2; c.stroke();
    c.strokeStyle = coat.collar; c.lineWidth = 1.35; c.stroke();
    var tg = 0.35 - P.ear * 0.6;
    var tx = -5.6 + Math.sin(tg) * 1.2, ty = -8.0 + Math.cos(tg) * 1.0;
    K.part(c, ellP(c, tx, ty, 0.95, 0.95, 0), coat.tag, 0.3);
    c.restore();

    c.restore();
  }

  /* Draw a pose at (x, y) = point between the feet, `scale` px per unit. */
  function drawPose(c, x, y, variant, P, scale) {
    var coat = coatOf(variant);
    if (!coat) return;
    var m = c.getTransform ? c.getTransform() : null;
    var u = (m ? Math.sqrt(m.a * m.a + m.b * m.b) : 1) * (scale || 1);
    c.save();
    c.translate(x, y);
    c.scale(-(P.sx || 1) * (scale || 1), scale || 1);
    paint(c, coat, P, u);
    c.restore();
  }

  /* Still pose for icons: standing, tail up, facing right. */
  var ICON = newPose();
  ICON.wag = 0.2; ICON.ear = 0.08; ICON.sx = 1; ICON.headUp = 0.08;
  function drawIcon(c, x, y, variant, scale) { drawPose(c, x, y, variant, ICON, scale); }

  /* ---- rig ---- */
  function Rig(o) {
    this.scale = (o && o.scale) || 1.4;   /* screen px per unit where it is drawn */
    this.vmax = (o && o.vmax) || 192;     /* the owner's top speed, px/s */
    this.gap = (o && o.gap !== undefined) ? o.gap : 42;        /* how far behind her it trots, px */
    this.P = newPose();
    this.reset();
  }
  Rig.prototype.reset = function () {
    this.x = null; this.vx = 0; this.face = 1; this.turnFrom = 1; this.turnT = 1;
    this.ph = 0; this.gait = 0; this.bound = 0; this.sit = 0; this.idle = 0; this.t = 0; this.last = 0;
    this.earX = 0; this.earV = 0; this.prevBob = 0; this.wagPh = 0; this.excite = 0.5;
    this.pant = 0; this.pantHold = 0; this.headUp = 0; this.ownerX = null;
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
    var target = ownerX - ownerFacing * this.gap;
    if (this.x === null || Math.abs(target - this.x) > 260) {
      this.x = target; this.vx = 0; this.face = ownerFacing; this.turnFrom = ownerFacing; this.turnT = 1;
    }
    var ownerV = this.ownerX === null ? 0 : (ownerX - this.ownerX) / dt;
    this.ownerX = ownerX;

    /* follow: ease toward the spot behind her, with a little dead zone */
    var dx = target - this.x, dead = 5;
    var want = Math.abs(dx) < dead ? 0 : clamp((dx - (dx > 0 ? dead : -dead)) * 6, -this.vmax * 1.35, this.vmax * 1.35);
    this.vx += (want - this.vx) * Math.min(1, dt * 8);
    this.x += this.vx * dt;
    var spd = Math.abs(this.vx), moving = spd > 12;

    /* facing: the way it runs, or toward her when it stops */
    var wf = moving ? (this.vx > 0 ? 1 : -1) : (Math.abs(ownerX - this.x) > 8 ? (ownerX > this.x ? 1 : -1) : this.face);
    if (wf !== this.face && this.turnT >= 1) { this.turnFrom = this.face; this.face = wf; this.turnT = 0; this.earV += 5; }
    this.turnT = Math.min(1, this.turnT + dt / 0.2);
    var tu = this.turnT, tm = Math.max(0.55, Math.abs(Math.cos(Math.PI * tu)));
    P.sx = (tu < 0.5 ? this.turnFrom : this.face) * tm;

    /* gait: a trot whose feet stay planted, blending into a bound
       (front and hind pairs together, a little flight) at her run */
    var vu = spd / this.scale;
    var gw = moving ? Math.min(1, 0.45 + vu / 55) : 0;
    this.gait += (gw - this.gait) * Math.min(1, dt * (gw > this.gait ? 10 : 6));
    var bw = moving ? smooth((vu - 50) / 50) : 0;
    this.bound += (bw - this.bound) * Math.min(1, dt * 5);
    var fT = Math.min(vu / 7.2, 4.4), fB = 2.6 + vu / 90;
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
              - 1.3 * this.bound * Math.max(0, Math.sin(this.ph))
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
    P.pant = this.pant; P.tongue = Math.sin(t * 9);
    return P;
  };

  var rigs = {};
  function rig(id, o) { return rigs[id] || (rigs[id] = new Rig(o)); }

  window.Game.pet = {
    draw: drawPose,
    drawIcon: drawIcon,
    rig: rig,
    Rig: Rig,
    coat: coatOf
  };
})();
