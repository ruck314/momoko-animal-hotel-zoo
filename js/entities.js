/* entities.js – all game characters, enemies, projectiles, particles */
(function () {
  'use strict';
  window.Game = window.Game || {};

  var W = 800, H = 480;

  /* ========== SPRITE CACHE ========== */
  var spriteCache = {};
  function getCachedSprite(key, w, h, drawFn) {
    if (spriteCache[key]) return spriteCache[key];
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var cx = c.getContext('2d');
    drawFn(cx);
    spriteCache[key] = c;
    return c;
  }

  /* Flip a sprite horizontally */
  function flipSprite(key, src) {
    if (spriteCache[key]) return spriteCache[key];
    var c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    var cx = c.getContext('2d');
    cx.translate(c.width, 0);
    cx.scale(-1, 1);
    cx.drawImage(src, 0, 0);
    spriteCache[key] = c;
    return c;
  }

  /* ========== MOMOKO (Player) ========== */
  function Momoko(x, y) {
    this.x = x;
    this.y = y;
    this.w = 28;
    this.h = 34;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1; /* 1=right, -1=left */
    this.animFrame = 0;
    this.animTimer = 0;
    this.shootCooldown = 0;
  }

  Momoko.SWIM_FORCE = 0.45;
  Momoko.MAX_VEL = 3.2;
  Momoko.GRAVITY = 0.12;
  Momoko.FRICTION = 0.94;
  Momoko.SHOOT_CD = 12;

  Momoko.prototype.update = function (keys, level) {
    /* Swimming */
    if (keys.left) { this.vx -= Momoko.SWIM_FORCE; this.facing = -1; }
    if (keys.right) { this.vx += Momoko.SWIM_FORCE; this.facing = 1; }
    if (keys.up) this.vy -= Momoko.SWIM_FORCE;
    if (keys.down) this.vy += Momoko.SWIM_FORCE;

    /* Gravity (gentle sinking) */
    this.vy += Momoko.GRAVITY;

    /* Friction */
    this.vx *= Momoko.FRICTION;
    this.vy *= Momoko.FRICTION;

    /* Clamp velocity */
    var speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > Momoko.MAX_VEL) {
      this.vx = (this.vx / speed) * Momoko.MAX_VEL;
      this.vy = (this.vy / speed) * Momoko.MAX_VEL;
    }

    /* Apply velocity */
    this.x += this.vx;
    this.y += this.vy;

    /* World bounds */
    if (this.x < 0) { this.x = 0; this.vx = 0; }
    if (this.x + this.w > level.width) { this.x = level.width - this.w; this.vx = 0; }
    if (this.y + this.h > level.floorY) { this.y = level.floorY - this.h; this.vy = 0; }

    /* Shoot cooldown */
    if (this.shootCooldown > 0) this.shootCooldown--;

    /* Animation */
    this.animTimer++;
    if (this.animTimer > 6) { this.animTimer = 0; this.animFrame = (this.animFrame + 1) % 4; }
  };

  Momoko.prototype.shoot = function () {
    if (this.shootCooldown > 0) return null;
    this.shootCooldown = Momoko.SHOOT_CD;
    Game.audio.play('bubble');
    return new Bubble(
      this.x + (this.facing === 1 ? this.w : -8),
      this.y + this.h / 2 - 4,
      this.facing
    );
  };

  /* ---- Shared color helpers (hoisted so sub-painters can share) ---- */
  function hexShade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, ((n >> 16) & 255) - amt);
    var g = Math.max(0, ((n >> 8) & 255) - amt);
    var b = Math.max(0, (n & 255) - amt);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  function hexTint(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.min(255, ((n >> 16) & 255) + amt);
    var g = Math.min(255, ((n >> 8) & 255) + amt);
    var b = Math.min(255, (n & 255) + amt);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* Five-point star fill centered at (cx, cy) with outer radius r. */
  function fillStar(c, cx, cy, r) {
    c.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + i * Math.PI / 5;
      var rr = i % 2 === 0 ? r : r * 0.4;
      var px = cx + Math.cos(ang) * rr;
      var py = cy + Math.sin(ang) * rr;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
  }

  /* Shared Momoko sprite painter – called by gameplay draw and the
     customize-screen preview so both stay visually in sync.

     Precure-inspired design:
       – oversized round head with huge sparkle eyes (star-shaped catch-
         light in each pupil) and rosy blush patches
       – a peach tiara (gold band + peach gem + green leaf) crowning her
         hair, a nod to her "Peach Princess" title from the intro
       – hair with bow accents at the pigtail roots, plus alternate
         styles (long braids, twin buns with ribbon tails)
       – swappable outfits (frilly dress, sailor swimsuit, one-piece,
         classic t-shirt) and shoes (mary-jane, sneaker, flipper)
       – optional held food in the left hand (ice-cream, onigiri, donut)

     Crab companion lives outside this painter so it can follow the
     player in world space – see drawCrabPet. */
  function drawMomokoSprite(c, sx, sy, cust, frame) {
    var hairC = (cust && cust.hair) || '#e06088';
    var suitC = (cust && cust.suit) || '#e06088';
    var skinC = (cust && cust.skin) || '#ffddbb';
    var shoeC = (cust && cust.flipper) || '#ff99cc';
    var hairStyle = (cust && cust.hairStyle) || 'twinTails';
    var outfit = (cust && cust.outfit) || 'frillyDress';
    var shoeStyle = (cust && cust.shoes) || 'maryJane';
    var food = (cust && cust.food) || 'none';
    var f = frame || 0;
    var kick = Math.sin(f * 1.5) * 2;

    var hairShade = hexShade(hairC, 40);
    var suitShade = hexShade(suitC, 35);
    var suitLight = hexTint(suitC, 40);

    /* ---------- Legs / tights ---------- */
    /* Under the frilly dress she wears light tights; other outfits show
       dark leggings/pants so her silhouette still reads against any
       background. */
    c.fillStyle = outfit === 'frillyDress' || outfit === 'sailorDress'
      ? '#ffe8ee' : '#3a2a18';
    c.fillRect(sx + 9, sy + 25, 4, 7);
    c.fillRect(sx + 15, sy + 25, 4, 7);

    /* ---------- Shoes ---------- */
    function drawShoe(cx, cy) {
      if (shoeStyle === 'flipper') {
        c.fillStyle = shoeC;
        c.beginPath();
        c.ellipse(cx, cy, 3.2, 1.7, 0, 0, Math.PI * 2);
        c.fill();
      } else if (shoeStyle === 'sneaker') {
        c.fillStyle = shoeC;
        c.fillRect(cx - 3, cy - 1.6, 6, 2.4);
        c.fillStyle = '#ffffff';
        c.fillRect(cx - 3, cy + 0.4, 6, 0.9);
        c.fillStyle = hexShade(shoeC, 50);
        c.fillRect(cx - 3, cy + 1.1, 6, 0.5);
      } else {
        /* maryJane (default) */
        c.fillStyle = shoeC;
        c.beginPath();
        c.ellipse(cx, cy + 0.2, 3.2, 1.9, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = hexShade(shoeC, 30);
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(cx - 2.2, cy - 0.6);
        c.lineTo(cx + 2.2, cy - 0.6);
        c.stroke();
        c.fillStyle = '#fff4aa';
        c.beginPath();
        c.arc(cx, cy - 0.6, 0.55, 0, Math.PI * 2);
        c.fill();
      }
    }
    drawShoe(sx + 11, sy + 33 + kick * 0.3);
    drawShoe(sx + 17, sy + 33 - kick * 0.3);

    /* ---------- Back hair mass ---------- */
    c.fillStyle = hairShade;
    c.beginPath();
    c.moveTo(sx + 3, sy + 9);
    c.bezierCurveTo(sx - 1, sy + 20, sx + 1, sy + 27, sx + 5, sy + 30);
    c.lineTo(sx + 23, sy + 30);
    c.bezierCurveTo(sx + 27, sy + 27, sx + 29, sy + 20, sx + 25, sy + 9);
    c.closePath();
    c.fill();

    /* ---------- Hairstyle variant ---------- */
    if (hairStyle === 'longBraids') {
      /* Braided pigtails – stacked lozenges form a zigzag down each side */
      for (var side = 0; side < 2; side++) {
        var bx = side === 0 ? sx + 2 : sx + 26;
        c.fillStyle = hairC;
        for (var b = 0; b < 5; b++) {
          var by = sy + 10 + b * 5;
          var off = b % 2 === 0 ? -0.8 : 0.8;
          c.beginPath();
          c.ellipse(bx + off, by, 2.6, 2.9, 0, 0, Math.PI * 2);
          c.fill();
        }
        /* Ribbon tie at the end */
        c.fillStyle = suitC;
        c.beginPath();
        c.ellipse(bx, sy + 35, 1.8, 1, 0, 0, Math.PI * 2);
        c.fill();
      }
    } else if (hairStyle === 'buns') {
      /* Twin buns on top, no long pigtails */
      c.fillStyle = hairC;
      c.beginPath(); c.arc(sx + 5, sy + 3, 4.2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(sx + 23, sy + 3, 4.2, 0, Math.PI * 2); c.fill();
      /* Bun highlight swirls */
      c.strokeStyle = hairShade;
      c.lineWidth = 0.6;
      c.beginPath(); c.arc(sx + 5, sy + 3, 2.2, 0, Math.PI * 1.5); c.stroke();
      c.beginPath(); c.arc(sx + 23, sy + 3, 2.2, 0, Math.PI * 1.5); c.stroke();
      /* Ribbon tails hanging beside the head */
      c.fillStyle = suitC;
      c.beginPath();
      c.moveTo(sx + 4, sy + 6);
      c.quadraticCurveTo(sx + 0, sy + 14, sx + 2, sy + 24);
      c.lineTo(sx + 5, sy + 24);
      c.quadraticCurveTo(sx + 5, sy + 14, sx + 7, sy + 6);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(sx + 24, sy + 6);
      c.quadraticCurveTo(sx + 28, sy + 14, sx + 26, sy + 24);
      c.lineTo(sx + 23, sy + 24);
      c.quadraticCurveTo(sx + 23, sy + 14, sx + 21, sy + 6);
      c.closePath();
      c.fill();
    } else {
      /* twinTails (default) with bow accents at the roots */
      c.fillStyle = hairC;
      c.beginPath();
      c.moveTo(sx + 3, sy + 10);
      c.bezierCurveTo(sx - 3, sy + 18, sx - 2, sy + 26, sx + 1, sy + 30);
      c.bezierCurveTo(sx - 2, sy + 28, sx - 4, sy + 24, sx - 1, sy + 20);
      c.bezierCurveTo(sx + 1, sy + 16, sx + 2, sy + 12, sx + 5, sy + 11);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(sx + 25, sy + 10);
      c.bezierCurveTo(sx + 31, sy + 18, sx + 30, sy + 26, sx + 27, sy + 30);
      c.bezierCurveTo(sx + 30, sy + 28, sx + 32, sy + 24, sx + 29, sy + 20);
      c.bezierCurveTo(sx + 27, sy + 16, sx + 26, sy + 12, sx + 23, sy + 11);
      c.closePath();
      c.fill();
      /* Ribbon bows */
      function drawBow(bx, by) {
        c.fillStyle = suitC;
        c.beginPath(); c.ellipse(bx - 1.6, by, 1.6, 1.9, -0.3, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(bx + 1.6, by, 1.6, 1.9, 0.3, 0, Math.PI * 2); c.fill();
        c.fillStyle = suitShade;
        c.beginPath(); c.arc(bx, by, 0.75, 0, Math.PI * 2); c.fill();
      }
      drawBow(sx + 4, sy + 11);
      drawBow(sx + 24, sy + 11);
    }

    /* ---------- Hair dome + face + bangs ---------- */
    c.fillStyle = hairC;
    c.beginPath();
    c.ellipse(sx + 14, sy + 6, 12, 7, 0, Math.PI, 0);
    c.fill();

    c.fillStyle = skinC;
    c.beginPath();
    c.ellipse(sx + 14, sy + 12, 8, 7.5, 0, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = hairC;
    c.beginPath();
    c.moveTo(sx + 6, sy + 7);
    c.quadraticCurveTo(sx + 10, sy + 12, sx + 14, sy + 10);
    c.quadraticCurveTo(sx + 18, sy + 12, sx + 22, sy + 7);
    c.quadraticCurveTo(sx + 21, sy + 4, sx + 14, sy + 3);
    c.quadraticCurveTo(sx + 7, sy + 4, sx + 6, sy + 7);
    c.closePath();
    c.fill();
    c.beginPath(); c.ellipse(sx + 6, sy + 14, 2.2, 5, 0.15, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 22, sy + 14, 2.2, 5, -0.15, 0, Math.PI * 2); c.fill();

    /* (Peach tiara removed — Momoko now wears just her bubble helmet.) */

    /* ---------- Eyes ---------- */
    /* White sclera */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(sx + 10.3, sy + 13, 2.9, 3.6, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 17.7, sy + 13, 2.9, 3.6, 0, 0, Math.PI * 2); c.fill();
    /* Iris */
    c.fillStyle = '#6e3a4a';
    c.beginPath(); c.ellipse(sx + 10.3, sy + 13.3, 2.3, 3.0, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 17.7, sy + 13.3, 2.3, 3.0, 0, 0, Math.PI * 2); c.fill();
    /* Inner iris glow */
    c.fillStyle = '#b0606e';
    c.beginPath(); c.arc(sx + 10.3, sy + 13.6, 1.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 17.7, sy + 13.6, 1.3, 0, Math.PI * 2); c.fill();
    /* Pupil */
    c.fillStyle = '#1a0c14';
    c.beginPath(); c.arc(sx + 10.3, sy + 13.9, 0.7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 17.7, sy + 13.9, 0.7, 0, Math.PI * 2); c.fill();
    /* Star sparkle highlight */
    c.fillStyle = '#ffffff';
    fillStar(c, sx + 11, sy + 12, 1.2);
    fillStar(c, sx + 18.4, sy + 12, 1.2);
    /* Secondary round highlight */
    c.beginPath(); c.arc(sx + 9.5, sy + 14.3, 0.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 16.9, sy + 14.3, 0.5, 0, Math.PI * 2); c.fill();

    /* Eyelashes – upper arc + outer flicks */
    c.strokeStyle = '#1a0c14';
    c.lineWidth = 0.9;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(sx + 7.8, sy + 10.8); c.quadraticCurveTo(sx + 10.3, sy + 9.3, sx + 12.9, sy + 10.8); c.stroke();
    c.beginPath(); c.moveTo(sx + 15.1, sy + 10.8); c.quadraticCurveTo(sx + 17.7, sy + 9.3, sx + 20.2, sy + 10.8); c.stroke();
    c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(sx + 7.8, sy + 10.8); c.lineTo(sx + 6.9, sy + 10.0); c.stroke();
    c.beginPath(); c.moveTo(sx + 20.2, sy + 10.8); c.lineTo(sx + 21.1, sy + 10.0); c.stroke();

    /* ---------- Blush + mouth ---------- */
    c.fillStyle = 'rgba(255,160,190,0.78)';
    c.beginPath(); c.ellipse(sx + 7.5, sy + 15.9, 2.2, 1.3, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 20.5, sy + 15.9, 2.2, 1.3, 0, 0, Math.PI * 2); c.fill();

    c.strokeStyle = '#b24a5a';
    c.lineWidth = 0.95;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(sx + 14, sy + 17, 1.3, 0.2, Math.PI - 0.2);
    c.stroke();

    /* ---------- Neck ---------- */
    c.fillStyle = skinC;
    c.fillRect(sx + 12, sy + 18.5, 4, 1.5);

    /* ---------- Outfit ---------- */
    if (outfit === 'frillyDress' || outfit === 'sailorDress' || outfit === 'starDress') {
      /* Bodice */
      c.fillStyle = suitC;
      c.beginPath();
      c.moveTo(sx + 7, sy + 21);
      c.quadraticCurveTo(sx + 10, sy + 19.5, sx + 14, sy + 20.2);
      c.quadraticCurveTo(sx + 18, sy + 19.5, sx + 21, sy + 21);
      c.lineTo(sx + 20, sy + 25);
      c.lineTo(sx + 8, sy + 25);
      c.closePath();
      c.fill();
      if (outfit === 'frillyDress') {
        /* Lace collar + heart gem */
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.moveTo(sx + 10, sy + 20);
        c.quadraticCurveTo(sx + 14, sy + 22, sx + 18, sy + 20);
        c.lineTo(sx + 17.5, sy + 21);
        c.quadraticCurveTo(sx + 14, sy + 23, sx + 10.5, sy + 21);
        c.closePath();
        c.fill();
        var hcx = sx + 14, hcy = sy + 22.6;
        c.fillStyle = '#ff5577';
        c.beginPath();
        c.arc(hcx - 0.6, hcy - 0.3, 0.65, 0, Math.PI * 2);
        c.arc(hcx + 0.6, hcy - 0.3, 0.65, 0, Math.PI * 2);
        c.moveTo(hcx - 1.15, hcy);
        c.lineTo(hcx, hcy + 1.3);
        c.lineTo(hcx + 1.15, hcy);
        c.closePath();
        c.fill();
      } else if (outfit === 'sailorDress') {
        /* Sailor-dress collar */
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.moveTo(sx + 9, sy + 20.5);
        c.lineTo(sx + 14, sy + 23.5);
        c.lineTo(sx + 19, sy + 20.5);
        c.lineTo(sx + 17, sy + 20.5);
        c.lineTo(sx + 14, sy + 22.2);
        c.lineTo(sx + 11, sy + 20.5);
        c.closePath();
        c.fill();
        c.strokeStyle = suitShade;
        c.lineWidth = 0.5;
        c.beginPath();
        c.moveTo(sx + 10, sy + 21);
        c.lineTo(sx + 14, sy + 23);
        c.lineTo(sx + 18, sy + 21);
        c.stroke();
      } else {
        /* Star dress – gold bow at the chest and a wide star in place of
           a collar. Bodice stays the suit color for tintability. */
        c.fillStyle = '#ffd24a';
        c.beginPath();
        c.ellipse(sx + 12.4, sy + 21.2, 1.5, 1.2, -0.3, 0, Math.PI * 2); c.fill();
        c.beginPath();
        c.ellipse(sx + 15.6, sy + 21.2, 1.5, 1.2, 0.3, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#c88a1a';
        c.beginPath(); c.arc(sx + 14, sy + 21.2, 0.7, 0, Math.PI * 2); c.fill();
        /* Gold star medallion below the bow */
        c.fillStyle = '#fff4a8';
        fillStar(c, sx + 14, sy + 23.5, 1.4);
      }
      /* Flared skirt */
      c.fillStyle = suitC;
      c.beginPath();
      c.moveTo(sx + 8, sy + 25);
      c.lineTo(sx + 5, sy + 30);
      c.lineTo(sx + 23, sy + 30);
      c.lineTo(sx + 20, sy + 25);
      c.closePath();
      c.fill();
      /* Hem decoration: scalloped for frilly/sailor, star-sprinkled for
         starDress */
      if (outfit === 'starDress') {
        c.fillStyle = '#ffd24a';
        fillStar(c, sx +  7, sy + 28.5, 0.9);
        fillStar(c, sx + 11, sy + 29.4, 0.8);
        fillStar(c, sx + 15, sy + 28.2, 0.9);
        fillStar(c, sx + 19, sy + 29.3, 0.8);
        /* Silver trim along the hem */
        c.strokeStyle = '#ffffff';
        c.lineWidth = 0.7;
        c.beginPath();
        c.moveTo(sx + 5, sy + 30);
        c.lineTo(sx + 23, sy + 30);
        c.stroke();
      } else {
        c.fillStyle = '#ffffff';
        for (var s = 0; s < 5; s++) {
          var scx = sx + 6 + s * 4;
          c.beginPath(); c.arc(scx, sy + 30.5, 1.3, Math.PI, 0); c.fill();
        }
      }
      /* Skirt shading wedge */
      c.fillStyle = suitShade;
      c.beginPath();
      c.moveTo(sx + 14, sy + 25);
      c.lineTo(sx + 14, sy + 30);
      c.lineTo(sx + 18, sy + 30);
      c.lineTo(sx + 17, sy + 25);
      c.closePath();
      c.fill();
    } else if (outfit === 'frillyBikini') {
      /* "Bunny Pjs" — soft pastel one-piece pajamas with a fluffy belly. */
      c.fillStyle = suitC;
      c.beginPath();
      c.moveTo(sx + 7, sy + 20);
      c.quadraticCurveTo(sx + 14, sy + 19, sx + 21, sy + 20);
      c.lineTo(sx + 21, sy + 31);
      c.lineTo(sx + 7, sy + 31);
      c.closePath();
      c.fill();
      /* Fluffy belly oval */
      c.fillStyle = '#fff8f0';
      c.beginPath();
      c.ellipse(sx + 14, sy + 26, 5, 4, 0, 0, Math.PI * 2);
      c.fill();
      /* Carrot button */
      c.fillStyle = '#ff9944';
      c.fillRect(sx + 13.5, sy + 25, 1, 2);
      c.fillStyle = '#3a8a38';
      c.fillRect(sx + 13.5, sy + 24.4, 1, 0.8);
      /* Tail (pom-pom on hip) */
      c.fillStyle = '#fff8f0';
      c.beginPath();
      c.arc(sx + 22, sy + 28, 2, 0, Math.PI * 2);
      c.fill();
      /* Buttons */
      c.fillStyle = '#ff99bb';
      c.beginPath(); c.arc(sx + 11, sy + 22, 0.7, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(sx + 17, sy + 22, 0.7, 0, Math.PI * 2); c.fill();
    } else if (outfit === 'sailorSwimsuit') {
      /* "Panda Pjs" — black/white striped one-piece with bamboo pocket. */
      /* White base */
      c.fillStyle = '#fafafa';
      c.fillRect(sx + 7, sy + 20, 14, 11);
      /* Black side panels */
      c.fillStyle = '#1a1a1a';
      c.fillRect(sx + 7, sy + 20, 3, 11);
      c.fillRect(sx + 18, sy + 20, 3, 11);
      /* Black collar */
      c.fillRect(sx + 7, sy + 19.5, 14, 1.6);
      /* Bamboo pocket on chest */
      c.fillStyle = '#5a8a38';
      c.fillRect(sx + 12, sy + 24, 4, 5);
      c.fillStyle = '#8aaa48';
      c.fillRect(sx + 13, sy + 24, 0.6, 5);
      c.fillRect(sx + 14.4, sy + 24, 0.6, 5);
      /* Buttons */
      c.fillStyle = suitC;
      c.beginPath(); c.arc(sx + 11, sy + 22, 0.7, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(sx + 17, sy + 22, 0.7, 0, Math.PI * 2); c.fill();
    } else if (outfit === 'onePiece') {
      /* "Unicorn Pjs" — pastel rainbow striped pajamas with a star pocket. */
      var stripes = ['#ffb3d9', '#ffe6b3', '#d9ffb3', '#b3e6ff', '#d9b3ff'];
      for (var ui = 0; ui < stripes.length; ui++) {
        c.fillStyle = stripes[ui];
        c.fillRect(sx + 7, sy + 20 + ui * 2.2, 14, 2.4);
      }
      /* Sleeves edges */
      c.fillStyle = '#ffe6f5';
      c.fillRect(sx + 7, sy + 20, 14, 1);
      c.fillRect(sx + 7, sy + 30.2, 14, 1);
      /* Star pocket */
      c.fillStyle = '#fff4a8';
      fillStar(c, sx + 14, sy + 26, 1.5);
      /* Hem ruffles */
      c.fillStyle = '#fff8f0';
      for (var ui2 = 0; ui2 < 4; ui2++) {
        c.beginPath();
        c.arc(sx + 8.5 + ui2 * 4, sy + 31, 1, Math.PI, 0);
        c.fill();
      }
    } else {
      /* Classic t-shirt */
      c.fillStyle = suitC;
      c.beginPath();
      c.moveTo(sx + 7, sy + 21);
      c.quadraticCurveTo(sx + 10, sy + 19.5, sx + 14, sy + 20.2);
      c.quadraticCurveTo(sx + 18, sy + 19.5, sx + 21, sy + 21);
      c.lineTo(sx + 21, sy + 26);
      c.lineTo(sx + 7, sy + 26);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.2)';
      c.beginPath();
      c.moveTo(sx + 12, sy + 20);
      c.quadraticCurveTo(sx + 14, sy + 21.5, sx + 16, sy + 20);
      c.lineTo(sx + 16, sy + 20.5);
      c.quadraticCurveTo(sx + 14, sy + 22, sx + 12, sy + 20.5);
      c.closePath();
      c.fill();
    }

    /* ---------- Arms ---------- */
    c.fillStyle = skinC;
    c.beginPath();
    c.ellipse(sx + 5.5, sy + 24, 1.7, 2.8, 0.1, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(sx + 23, sy + 23, 2.3, 1.9, -0.2, 0, Math.PI * 2);
    c.fill();

    /* ---------- Held food (left hand) ---------- */
    if (food !== 'none') {
      var fx = sx + 4, fy = sy + 22;
      if (food === 'iceCream') {
        c.fillStyle = '#e0b070';
        c.beginPath();
        c.moveTo(fx - 1.5, fy + 2);
        c.lineTo(fx + 1.5, fy + 2);
        c.lineTo(fx, fy + 6);
        c.closePath();
        c.fill();
        c.strokeStyle = '#9a7048';
        c.lineWidth = 0.5;
        c.beginPath(); c.moveTo(fx - 1, fy + 2.5); c.lineTo(fx + 0.8, fy + 5); c.stroke();
        c.fillStyle = '#ffc8d4';
        c.beginPath(); c.arc(fx, fy + 1, 2.2, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ff3355';
        c.beginPath(); c.arc(fx, fy - 1.3, 0.7, 0, Math.PI * 2); c.fill();
      } else if (food === 'onigiri') {
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.moveTo(fx, fy - 1.5);
        c.lineTo(fx - 2.4, fy + 2.5);
        c.lineTo(fx + 2.4, fy + 2.5);
        c.closePath();
        c.fill();
        c.fillStyle = '#2a3a2a';
        c.fillRect(fx - 2, fy + 1, 4, 1.4);
        c.fillStyle = 'rgba(255,160,180,0.6)';
        c.beginPath(); c.arc(fx - 0.9, fy + 0.5, 0.4, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(fx + 0.9, fy + 0.5, 0.4, 0, Math.PI * 2); c.fill();
      } else if (food === 'donut') {
        c.fillStyle = '#c88858';
        c.beginPath(); c.arc(fx, fy + 1, 2.3, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ff99cc';
        c.beginPath(); c.arc(fx, fy + 1, 2.1, Math.PI + 0.3, -0.3, false); c.fill();
        c.fillStyle = '#ffe4b0';
        c.beginPath(); c.arc(fx, fy + 1, 0.75, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffff66'; c.fillRect(fx - 1, fy - 0.2, 0.4, 0.4);
        c.fillStyle = '#66ddff'; c.fillRect(fx + 0.8, fy, 0.4, 0.4);
        c.fillStyle = '#ff66aa'; c.fillRect(fx - 0.2, fy + 0.5, 0.4, 0.4);
      } else if (food === 'crepe') {
        /* Rolled cream crepe – beige cone wrap with pink cream peeking */
        c.fillStyle = '#f2d8a4';
        c.beginPath();
        c.moveTo(fx - 2, fy - 2);
        c.lineTo(fx + 2, fy - 2);
        c.lineTo(fx, fy + 4);
        c.closePath();
        c.fill();
        /* Cream */
        c.fillStyle = '#ffdceb';
        c.beginPath(); c.arc(fx, fy - 1.8, 1.4, Math.PI, 0); c.fill();
        /* Berry */
        c.fillStyle = '#dd3355';
        c.beginPath(); c.arc(fx - 0.6, fy - 2.2, 0.55, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#2a5d2a';
        c.fillRect(fx - 0.8, fy - 2.7, 0.4, 0.4);
      } else if (food === 'taiyaki') {
        /* Fish-shaped pastry */
        c.fillStyle = '#cc8844';
        c.beginPath();
        c.ellipse(fx, fy + 1, 3, 1.8, 0, 0, Math.PI * 2);
        c.fill();
        /* Tail fin */
        c.beginPath();
        c.moveTo(fx + 2.5, fy + 1);
        c.lineTo(fx + 4, fy - 0.5);
        c.lineTo(fx + 4, fy + 2.5);
        c.closePath();
        c.fill();
        /* Side highlight */
        c.fillStyle = '#e0a868';
        c.beginPath(); c.ellipse(fx - 0.5, fy + 0.3, 1.6, 0.5, 0, 0, Math.PI * 2); c.fill();
        /* Eye */
        c.fillStyle = '#1a0c14';
        c.beginPath(); c.arc(fx - 1.8, fy + 0.5, 0.3, 0, Math.PI * 2); c.fill();
        /* Scale line */
        c.strokeStyle = '#8a5520';
        c.lineWidth = 0.3;
        c.beginPath();
        c.moveTo(fx - 1, fy + 0.2); c.lineTo(fx + 1.5, fy + 0.2);
        c.stroke();
      } else if (food === 'parfait') {
        /* Glass with stacked layers, cream swirl on top */
        /* Glass cup */
        c.strokeStyle = 'rgba(255,255,255,0.6)';
        c.lineWidth = 0.4;
        c.strokeRect(fx - 1.6, fy - 1.5, 3.2, 5);
        /* Chocolate layer (bottom) */
        c.fillStyle = '#6b3a1a';
        c.fillRect(fx - 1.4, fy + 2, 2.8, 1.3);
        /* Cream layer */
        c.fillStyle = '#fff4dc';
        c.fillRect(fx - 1.4, fy + 0.7, 2.8, 1.3);
        /* Strawberry layer */
        c.fillStyle = '#ff6688';
        c.fillRect(fx - 1.4, fy - 0.6, 2.8, 1.3);
        /* Whipped cream swirl */
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(fx, fy - 1.8, 1.3, Math.PI, 0); c.fill();
        c.beginPath(); c.arc(fx - 0.5, fy - 2.3, 0.7, Math.PI, 0); c.fill();
        c.beginPath(); c.arc(fx + 0.3, fy - 2.6, 0.5, Math.PI, 0); c.fill();
        /* Cherry */
        c.fillStyle = '#dd2244';
        c.beginPath(); c.arc(fx + 0.6, fy - 2.9, 0.5, 0, Math.PI * 2); c.fill();
      } else if (food === 'macaron') {
        /* Two pastel shells with a cream filling */
        c.fillStyle = '#ffbadb';
        c.beginPath();
        c.ellipse(fx, fy - 0.8, 2.4, 1.1, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#ffffff';
        c.fillRect(fx - 2.4, fy - 0.1, 4.8, 0.9);
        c.fillStyle = '#ff9ac2';
        c.beginPath();
        c.ellipse(fx, fy + 1.3, 2.4, 1.1, 0, 0, Math.PI * 2);
        c.fill();
        /* Top sheen */
        c.fillStyle = 'rgba(255,255,255,0.5)';
        c.beginPath();
        c.ellipse(fx - 0.8, fy - 1, 1, 0.3, 0, 0, Math.PI * 2);
        c.fill();
      } else if (food === 'strawberry') {
        /* Red cone with leafy cap and seed dots */
        c.fillStyle = '#e8344a';
        c.beginPath();
        c.moveTo(fx - 2, fy - 1);
        c.quadraticCurveTo(fx, fy + 4, fx + 2, fy - 1);
        c.closePath();
        c.fill();
        /* Seeds */
        c.fillStyle = '#fff4a8';
        c.beginPath(); c.arc(fx - 0.8, fy + 0.5, 0.25, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(fx + 0.6, fy + 0.3, 0.25, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(fx, fy + 1.6, 0.25, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(fx - 1.1, fy + 1.9, 0.25, 0, Math.PI * 2); c.fill();
        /* Green cap */
        c.fillStyle = '#3caf3c';
        c.beginPath();
        c.moveTo(fx - 2.2, fy - 1);
        c.lineTo(fx - 0.6, fy - 1.8);
        c.lineTo(fx + 0.6, fy - 1.8);
        c.lineTo(fx + 2.2, fy - 1);
        c.lineTo(fx, fy - 0.2);
        c.closePath();
        c.fill();
      }
    }

    /* (Space helmet removed for the hotel-zoo theme.) */

    /* ---------- Pajama hood / accessory overlay ----------
       For the animal-pajama outfits we tuck a little ear-hood on top so
       Momoko's pajamas look like the matching critter. */
    if (outfit === 'frillyBikini') {
      /* Bunny hood — pink hood with two long ears */
      c.save();
      c.fillStyle = '#ffeedd';
      c.beginPath(); c.arc(sx + 14, sy + 4, 9, Math.PI, 0); c.fill();
      /* Floppy ears */
      c.fillStyle = '#ffeedd';
      c.beginPath(); c.ellipse(sx + 9, sy - 6, 2, 7, -0.2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(sx + 19, sy - 6, 2, 7, 0.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff99bb';
      c.beginPath(); c.ellipse(sx + 9, sy - 6, 1, 4, -0.2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(sx + 19, sy - 6, 1, 4, 0.2, 0, Math.PI * 2); c.fill();
      c.restore();
    } else if (outfit === 'sailorSwimsuit') {
      /* Panda hood — white hood with two black round ears */
      c.save();
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(sx + 14, sy + 4, 9, Math.PI, 0); c.fill();
      c.fillStyle = '#1a1a1a';
      c.beginPath(); c.arc(sx + 7, sy - 1, 3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(sx + 21, sy - 1, 3, 0, Math.PI * 2); c.fill();
      c.restore();
    } else if (outfit === 'onePiece') {
      /* Unicorn hood — pastel hood with rainbow horn */
      c.save();
      c.fillStyle = '#ffe6f5';
      c.beginPath(); c.arc(sx + 14, sy + 4, 9, Math.PI, 0); c.fill();
      /* Horn */
      c.fillStyle = '#ffd24a';
      c.beginPath();
      c.moveTo(sx + 12, sy - 2);
      c.lineTo(sx + 14, sy - 12);
      c.lineTo(sx + 16, sy - 2);
      c.closePath();
      c.fill();
      c.strokeStyle = '#ff99cc'; c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(sx + 13, sy - 5); c.lineTo(sx + 14.5, sy - 8);
      c.stroke();
      c.restore();
    }
  }

  /* Pet-dog companion — re-themed from crab. `variant` picks the coat
     palette (brown/blue/gold remapped to brown/spotted/golden) or 'none'. */
  function drawCrabPet(c, px, py, variant, frame) {
    if (!variant || variant === 'none') return;
    var body, accent;
    if (variant === 'blue' || variant === 'spotted') {
      body = '#dddddd'; accent = '#553322';
    } else if (variant === 'gold' || variant === 'golden') {
      body = '#ffcc66'; accent = '#aa6622';
    } else {
      /* red → brown */
      body = '#8a5a32'; accent = '#5a3818';
    }
    var wobble = Math.sin((frame || 0) * 0.2) * 0.8;
    /* Body — plump ellipse */
    c.fillStyle = body;
    c.beginPath();
    c.ellipse(px, py, 6, 4, 0, 0, Math.PI * 2);
    c.fill();
    /* Head */
    c.beginPath();
    c.arc(px - 5, py - 1, 3, 0, Math.PI * 2);
    c.fill();
    /* Ear */
    c.fillStyle = accent;
    c.beginPath();
    c.moveTo(px - 6, py - 3.5);
    c.lineTo(px - 4.5, py - 4.6);
    c.lineTo(px - 4, py - 3);
    c.closePath();
    c.fill();
    /* Spots for 'spotted' coat */
    if (variant === 'blue' || variant === 'spotted') {
      c.fillStyle = '#443322';
      c.beginPath(); c.arc(px + 1, py - 1, 0.9, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(px + 3, py + 1, 0.8, 0, Math.PI * 2); c.fill();
    }
    /* Snout */
    c.fillStyle = accent;
    c.beginPath(); c.arc(px - 7, py, 0.8, 0, Math.PI * 2); c.fill();
    /* Eye */
    c.fillStyle = '#000000';
    c.beginPath(); c.arc(px - 5.5, py - 1.4, 0.5, 0, Math.PI * 2); c.fill();
    /* Tail (wagging) */
    c.strokeStyle = body;
    c.lineWidth = 1.8;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(px + 5, py - 1);
    c.lineTo(px + 8, py - 2 + wobble * 2);
    c.stroke();
    /* Legs */
    c.strokeStyle = accent;
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(px - 3, py + 3); c.lineTo(px - 3, py + 4.8);
    c.moveTo(px - 1, py + 3); c.lineTo(px - 1, py + 4.8);
    c.moveTo(px + 1, py + 3); c.lineTo(px + 1, py + 4.8);
    c.moveTo(px + 3, py + 3); c.lineTo(px + 3, py + 4.8);
    c.stroke();
  }

  Momoko.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    /* Walk-bob: a small vertical bounce while she's actually moving so
       the corridor walk reads as cozy. Uses the animation timer so the
       bob phase is tied to the leg-kick cycle. */
    var spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    var bob = spd > 0.4 ? Math.abs(Math.sin(this.animTimer * 0.5 +
                                            this.animFrame * Math.PI / 2)) * 1.6 : 0;
    var sy = Math.round(this.y - camY - bob);
    var cust = window.Game.customization || {};

    c.save();
    if (this.facing === -1) {
      c.translate(sx + this.w / 2, 0);
      c.scale(-1, 1);
      sx = -this.w / 2;
    }
    drawMomokoSprite(c, sx, sy, cust, this.animFrame);
    /* Crab pet trails at foot level; drawn inside the flip transform so
       it stays on the side opposite the facing direction (i.e. behind
       her as she swims). */
    if (cust.crab && cust.crab !== 'none') {
      drawCrabPet(c, sx - 8, sy + 32, cust.crab, this.animTimer);
    }
    c.restore();
  };

  /* Floss-dance Momoko – arms swing rigid across the body while the hips
     tilt the opposite direction on each beat. Phase is in radians so the
     caller can drive it off a timer. Drawn at the same 28×34 footprint
     so it drops into the existing sprite slot. */
  function drawMomokoFloss(c, sx, sy, cust, phase) {
    var hairC = (cust && cust.hair) || '#e06088';
    var shirtC = (cust && cust.suit) || '#3366aa';
    var skinC = (cust && cust.skin) || '#ffddbb';
    var shoeC = (cust && cust.flipper) || '#33bb77';
    /* Soft-clamped sigmoid (tanh of a boosted sine) gives smooth in-
       between frames while still "holding" near ±1 at each beat, so
       the pose reads as floss instead of a lazy hula. `beat` is used
       in the drawing math where it treats the value as a scalar
       displacement – any value in [-1, 1] is fine. */
    var beat = Math.tanh(Math.sin(phase) * 3.2);
    /* Secondary bob that never zeroes out, for subtle motion during
       the "hold" portion of each beat. */
    var ease = Math.sin(phase * 2) * 0.3;
    var hipShift = beat * 2;
    var bodyTilt = beat * 0.08;

    c.save();
    c.translate(sx + 14, sy + 22);
    c.rotate(bodyTilt);
    c.translate(-14, -22);

    /* Pants – shifted by hip motion */
    c.fillStyle = '#3a2a18';
    c.fillRect(9 + hipShift, 25, 4, 7);
    c.fillRect(15 + hipShift, 25, 4, 7);

    /* Shoes */
    c.fillStyle = shoeC;
    c.beginPath();
    c.ellipse(11 + hipShift, 33, 3, 1.6, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(17 + hipShift, 33, 3, 1.6, 0, 0, Math.PI * 2);
    c.fill();

    /* Back hair – swings opposite to hips for floss feel */
    function darken(hex, amt) {
      var n = parseInt(hex.slice(1), 16);
      var r = Math.max(0, ((n >> 16) & 255) - amt);
      var g = Math.max(0, ((n >> 8) & 255) - amt);
      var b = Math.max(0, (n & 255) - amt);
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
    c.fillStyle = darken(hairC, 40);
    c.beginPath();
    c.moveTo(3 - beat, 9);
    c.bezierCurveTo(-1 - beat, 20, 1 - beat, 27, 5 - beat, 30);
    c.lineTo(23 - beat, 30);
    c.bezierCurveTo(27 - beat, 27, 29 - beat, 20, 25 - beat, 9);
    c.closePath();
    c.fill();

    /* Pigtails swinging */
    c.fillStyle = hairC;
    c.beginPath();
    c.moveTo(3 - beat, 10);
    c.bezierCurveTo(-3 - beat * 2, 18, -2 - beat * 2, 26, 1 - beat * 2, 30);
    c.bezierCurveTo(-2 - beat * 2, 28, -4 - beat * 2, 24, -1 - beat * 2, 20);
    c.bezierCurveTo(1 - beat, 16, 2 - beat, 12, 5 - beat, 11);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(25 - beat, 10);
    c.bezierCurveTo(31 - beat * 2, 18, 30 - beat * 2, 26, 27 - beat * 2, 30);
    c.bezierCurveTo(30 - beat * 2, 28, 32 - beat * 2, 24, 29 - beat * 2, 20);
    c.bezierCurveTo(27 - beat, 16, 26 - beat, 12, 23 - beat, 11);
    c.closePath();
    c.fill();

    /* Crown / bangs */
    c.fillStyle = hairC;
    c.beginPath();
    c.ellipse(14, 6, 12, 7, 0, Math.PI, 0);
    c.fill();

    /* Face */
    c.fillStyle = skinC;
    c.beginPath();
    c.ellipse(14, 12, 8, 7.5, 0, 0, Math.PI * 2);
    c.fill();

    /* Front bangs */
    c.fillStyle = hairC;
    c.beginPath();
    c.moveTo(6, 7);
    c.quadraticCurveTo(10, 12, 14, 10);
    c.quadraticCurveTo(18, 12, 22, 7);
    c.quadraticCurveTo(21, 4, 14, 3);
    c.quadraticCurveTo(7, 4, 6, 7);
    c.closePath();
    c.fill();
    c.beginPath();
    c.ellipse(6, 14, 2.2, 5, 0.15, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(22, 14, 2.2, 5, -0.15, 0, Math.PI * 2);
    c.fill();

    /* Peach tiara – matches drawMomokoSprite so the pause pose reads as
       the same character. */
    c.strokeStyle = '#ffd24a';
    c.lineWidth = 1.3;
    c.beginPath();
    c.arc(14, 8, 6.5, Math.PI + 0.55, -0.55);
    c.stroke();
    c.fillStyle = '#fff4a8';
    c.beginPath(); c.arc(9.2, 4.6, 0.7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(18.8, 4.6, 0.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffb8a0';
    c.beginPath(); c.arc(13.4, 2.9, 1.9, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(14.6, 2.9, 1.9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff9a82';
    c.beginPath(); c.arc(14.5, 3.5, 1.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5cbd5c';
    c.beginPath();
    c.ellipse(12.5, 0.8, 1.1, 0.55, -0.6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.beginPath(); c.arc(13.1, 2.3, 0.55, 0, Math.PI * 2); c.fill();

    /* Eyes – closed & happy (floss joy!) */
    c.strokeStyle = '#2a1a12';
    c.lineWidth = 1;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(10.5, 13, 1.8, Math.PI + 0.2, -0.2, false);
    c.stroke();
    c.beginPath();
    c.arc(17.5, 13, 1.8, Math.PI + 0.2, -0.2, false);
    c.stroke();

    /* Blush */
    c.fillStyle = 'rgba(255,170,195,0.65)';
    c.beginPath(); c.arc(8, 15.5, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(20, 15.5, 1.6, 0, Math.PI * 2); c.fill();

    /* Big grinning mouth */
    c.fillStyle = '#b24a5a';
    c.beginPath();
    c.arc(14, 16.5, 2, 0, Math.PI);
    c.fill();
    c.fillStyle = '#ffffff';
    c.fillRect(12.5, 16.4, 3, 0.9);

    /* Neck */
    c.fillStyle = skinC;
    c.fillRect(12, 18.5, 4, 1.5);

    /* Shirt */
    c.fillStyle = shirtC;
    c.beginPath();
    c.moveTo(7, 21);
    c.quadraticCurveTo(10, 19.5, 14, 20.2);
    c.quadraticCurveTo(18, 19.5, 21, 21);
    c.lineTo(21, 26);
    c.lineTo(7, 26);
    c.closePath();
    c.fill();

    /* Floss arms: both swing to the same side (the hallmark of the move).
       When beat=+1, both arms cross to the right side of the body; when
       beat=-1, to the left. Arms drawn as stubby stick-figure segments
       with skin-tone hands. */
    c.strokeStyle = skinC;
    c.lineWidth = 3;
    c.lineCap = 'round';
    var armDir = -beat; /* opposite to hips */
    /* Top arm – goes across the front of the body */
    c.beginPath();
    c.moveTo(14 - armDir * 4, 22);
    c.lineTo(14 + armDir * 9, 21 + ease);
    c.stroke();
    /* Bottom arm – goes across behind the body (lower) */
    c.beginPath();
    c.moveTo(14 + armDir * 4, 23);
    c.lineTo(14 - armDir * 9, 26 - ease);
    c.stroke();
    /* Hands */
    c.fillStyle = skinC;
    c.beginPath(); c.arc(14 + armDir * 10, 21 + ease, 1.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(14 - armDir * 10, 26 - ease, 1.8, 0, Math.PI * 2); c.fill();

    c.restore();
  }

  /* ========== BUBBLE (Projectile) ========== */
  function Bubble(x, y, dir) {
    this.x = x;
    this.y = y;
    this.r = 6;
    this.dir = dir;
    this.speed = 5;
    this.life = 90; /* frames */
    this.active = true;
    this.hue = Math.random() * 360;
    this.wobble = Math.random() * Math.PI * 2;
  }

  Bubble.prototype.update = function () {
    this.x += this.speed * this.dir;
    this.wobble += 0.15;
    this.y += Math.sin(this.wobble) * 0.8;
    this.hue = (this.hue + 5) % 360;
    this.life--;
    if (this.life <= 0) this.active = false;
  };

  /* Re-themed as Sparkle — a 4-point twinkling star with a colour cycle. */
  Bubble.prototype.draw = function (c, camX, camY) {
    if (!this.active) return;
    var sx = this.x - camX;
    var sy = this.y - camY;
    c.save();
    c.globalAlpha = 0.95;
    var col = 'hsl(' + this.hue + ',95%,70%)';
    c.fillStyle = col;
    var r = this.r;
    /* 4-point star */
    c.beginPath();
    c.moveTo(sx, sy - r);
    c.lineTo(sx + r * 0.35, sy - r * 0.35);
    c.lineTo(sx + r, sy);
    c.lineTo(sx + r * 0.35, sy + r * 0.35);
    c.lineTo(sx, sy + r);
    c.lineTo(sx - r * 0.35, sy + r * 0.35);
    c.lineTo(sx - r, sy);
    c.lineTo(sx - r * 0.35, sy - r * 0.35);
    c.closePath();
    c.fill();
    /* Bright core */
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(sx, sy, r * 0.35, 0, Math.PI * 2);
    c.fill();
    /* Soft halo */
    c.globalAlpha = 0.35;
    c.fillStyle = col;
    c.beginPath();
    c.arc(sx, sy, r * 1.6, 0, Math.PI * 2);
    c.fill();
    c.restore();
  };

  /* ========== FISH (Enemy) ========== */
  /* species: 'tropical' (default reef-fish-shaped friendly star), 'swordfish'
     (long/fast variant), 'blowfish' (round/slow, 2 HP), 'clownfish' (orange
     stripes). Appearance, size, hp, and speed vary per species so levels
     can mix them for visual and gameplay variety. */
  function Fish(x, y, pattern, dir, species) {
    this.spawnX = x;
    this.spawnY = y;
    this.x = x;
    this.y = y;
    this.species = species || 'tropical';
    this.pattern = pattern || 'sine';
    this.dir = dir || -1;
    this.timer = Math.random() * 100;
    this.active = true;
    this.flash = 0;

    if (this.species === 'swordfish') {
      this.w = 36; this.h = 14;
      this.hp = 2;
      this.speed = 1.8;
      this.color = '#3a5a78';
    } else if (this.species === 'blowfish') {
      this.w = 26; this.h = 24;
      this.hp = 2;
      this.speed = 0.7;
      this.color = '#d9b24a';
    } else if (this.species === 'clownfish') {
      this.w = 24; this.h = 16;
      this.hp = 1;
      this.speed = 1.4;
      this.color = '#ff7a22';
    } else {
      /* tropical */
      this.w = 24; this.h = 16;
      this.hp = 1;
      this.speed = 1.2;
      this.color = ['#ee4444', '#44bb44', '#4488ee', '#eeaa22'][Math.floor(Math.random() * 4)];
    }
  }

  Fish.prototype.update = function () {
    if (!this.active) return;
    this.timer++;
    if (this.flash > 0) this.flash--;

    if (this.pattern === 'sine') {
      this.x += this.speed * this.dir;
      this.y = this.spawnY + Math.sin(this.timer * 0.04) * 40;
    } else {
      this.x += this.speed * this.dir;
    }

    /* Reverse if too far from spawn */
    if (Math.abs(this.x - this.spawnX) > 150) {
      this.dir *= -1;
    }
  };

  /* Comfortable RPG — aliens are friendly. Sparkle makes them twirl. */
  Fish.prototype.delight = function () {
    this.flash = 6;
    this.delighted = 60;
    Game.audio.play('pickup');
    return false;
  };

  Fish.prototype.draw = function (c, camX, camY) {
    if (!this.active) return;
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);

    c.save();
    if (this.dir === 1) {
      c.translate(sx + this.w / 2, 0);
      c.scale(-1, 1);
      sx = -this.w / 2;
    }

    if (this.flash > 0 && this.flash % 2 === 0) { c.restore(); return; }

    if (this.species === 'swordfish') drawSwordfish(c, sx, sy, this.color, this.timer);
    else if (this.species === 'blowfish') drawBlowfish(c, sx, sy, this.color, this.timer);
    else if (this.species === 'clownfish') drawClownfish(c, sx, sy, this.timer);
    else drawTropicalFish(c, sx, sy, this.color);

    c.restore();
  };

  /* ---- Friendly space creatures (replaced fish renderings) ---- */

  /* Tropical → "Starlet": a smiling 5-point star with eyes. */
  function drawTropicalFish(c, sx, sy, color) {
    var cx = sx + 12, cy = sy + 8;
    /* Glow halo */
    c.fillStyle = 'rgba(255,255,255,0.15)';
    c.beginPath(); c.arc(cx, cy, 14, 0, Math.PI * 2); c.fill();
    /* Star body */
    c.fillStyle = color;
    fillStar(c, cx, cy, 10);
    /* Lighter inner star */
    c.fillStyle = hexTint(color, 50);
    fillStar(c, cx, cy, 5.5);
    /* Eyes */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(cx - 2.5, cy, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(cx + 2.5, cy, 1.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a0c14';
    c.beginPath(); c.arc(cx - 2.3, cy + 0.3, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(cx + 2.7, cy + 0.3, 0.8, 0, Math.PI * 2); c.fill();
    /* Smile */
    c.strokeStyle = '#1a0c14';
    c.lineWidth = 0.8;
    c.beginPath();
    c.arc(cx, cy + 2, 1.6, 0.2, Math.PI - 0.2);
    c.stroke();
  }

  /* Swordfish → "Comet": a glowing rock with a long sparkly tail. */
  function drawSwordfish(c, sx, sy, color, timer) {
    var hx = sx + 26, hy = sy + 7;
    /* Tail flames trailing behind */
    c.save();
    var tailFlick = Math.sin(timer * 0.18) * 0.6;
    var grd = c.createLinearGradient(sx - 12, hy, hx, hy);
    grd.addColorStop(0, 'rgba(120,200,255,0)');
    grd.addColorStop(0.4, 'rgba(120,200,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0.9)');
    c.fillStyle = grd;
    c.beginPath();
    c.moveTo(hx, hy - 5);
    c.quadraticCurveTo(sx + 5, hy - 3 + tailFlick, sx - 12, hy);
    c.quadraticCurveTo(sx + 5, hy + 3 + tailFlick, hx, hy + 5);
    c.closePath();
    c.fill();
    /* Spark dots in trail */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 6, hy - 1 + tailFlick, 0.9, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 16, hy + 1, 0.7, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Comet head */
    c.fillStyle = '#cccccc';
    c.beginPath(); c.arc(hx, hy, 6.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffe4a0';
    c.beginPath(); c.arc(hx - 1.5, hy - 1.5, 4.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(hx - 2, hy - 2, 1.8, 0, Math.PI * 2); c.fill();
    /* Smile + tiny eyes */
    c.fillStyle = '#1a0c14';
    c.beginPath(); c.arc(hx - 1, hy, 0.7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(hx + 2, hy, 0.7, 0, Math.PI * 2); c.fill();
  }

  /* Blowfish → "Pufflon": round purple alien with bouncing antenna spikes. */
  function drawBlowfish(c, sx, sy, color, timer) {
    var puff = 1 + Math.sin(timer * 0.06) * 0.08;
    var cx = sx + 13, cy = sy + 12;
    var r = 10 * puff;
    /* Antenna spokes with glowing tips */
    c.strokeStyle = '#bb88ff';
    c.lineWidth = 1.2;
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2 + timer * 0.01;
      var x1 = cx + Math.cos(a) * r;
      var y1 = cy + Math.sin(a) * r;
      var x2 = cx + Math.cos(a) * (r + 5);
      var y2 = cy + Math.sin(a) * (r + 5);
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.fillStyle = '#fff4a8';
      c.beginPath(); c.arc(x2, y2, 1.1, 0, Math.PI * 2); c.fill();
    }
    /* Body */
    c.fillStyle = '#9966dd';
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#bb88ee';
    c.beginPath(); c.arc(cx - 2, cy - 2, r * 0.7, 0, Math.PI * 2); c.fill();
    /* Big alien eyes */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(cx - 3, cy - 1, 2.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(cx + 3, cy - 1, 2.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#220033';
    c.beginPath(); c.arc(cx - 3, cy - 0.5, 1.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(cx + 3, cy - 0.5, 1.3, 0, Math.PI * 2); c.fill();
    /* Smile */
    c.strokeStyle = '#3a1a4f';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(cx, cy + 3, 2.2, 0.2, Math.PI - 0.2);
    c.stroke();
  }

  /* Clownfish → "Sparklette": glowing teardrop alien sprite. */
  function drawClownfish(c, sx, sy, timer) {
    var cx = sx + 12, cy = sy + 8;
    var bob = Math.sin(timer * 0.08) * 1.2;
    /* Glow halo */
    c.fillStyle = 'rgba(120,255,220,0.25)';
    c.beginPath(); c.arc(cx, cy + bob, 11, 0, Math.PI * 2); c.fill();
    /* Body — teardrop */
    c.fillStyle = '#44ddcc';
    c.beginPath();
    c.moveTo(cx, cy - 9 + bob);
    c.bezierCurveTo(cx + 9, cy - 4 + bob, cx + 9, cy + 7 + bob, cx, cy + 8 + bob);
    c.bezierCurveTo(cx - 9, cy + 7 + bob, cx - 9, cy - 4 + bob, cx, cy - 9 + bob);
    c.closePath();
    c.fill();
    /* Light core */
    c.fillStyle = '#aaffee';
    c.beginPath(); c.ellipse(cx, cy + bob, 5, 7, 0, 0, Math.PI * 2); c.fill();
    /* Sparkle ring */
    c.fillStyle = '#ffffff';
    fillStar(c, cx + 5, cy - 4 + bob, 1.5);
    fillStar(c, cx - 5, cy + 3 + bob, 1.2);
    /* Eyes */
    c.fillStyle = '#003344';
    c.beginPath(); c.arc(cx - 1.6, cy - 1 + bob, 0.9, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(cx + 1.6, cy - 1 + bob, 0.9, 0, Math.PI * 2); c.fill();
    /* Smile */
    c.strokeStyle = '#003344';
    c.lineWidth = 0.6;
    c.beginPath();
    c.arc(cx, cy + 1 + bob, 1.4, 0.2, Math.PI - 0.2);
    c.stroke();
  }

  /* ========== OLIVER (NPC - Otter) ========== */
  function Oliver(x, y) {
    this.x = x;
    this.y = y;
    this.w = 28;
    this.h = 20;
    this.spawnX = x;
    this.spawnY = y;
    this.timer = 0;
    this.talking = false;
    this.talkTimer = 0;
    this.currentJoke = '';
    this.interacted = false;
  }

  Oliver.prototype.update = function () {
    this.timer++;
    this.x = this.spawnX + Math.sin(this.timer * 0.02) * 40;
    this.y = this.spawnY + Math.cos(this.timer * 0.03) * 20;
    if (this.talking) {
      this.talkTimer--;
      if (this.talkTimer <= 0) this.talking = false;
    }
  };

  Oliver.prototype.interact = function () {
    this.talking = true;
    this.talkTimer = 540;
    this.currentJoke = Game.i18n.getJoke();
  };

  Oliver.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);

    c.save();
    /* Body */
    c.fillStyle = '#996633';
    c.beginPath();
    c.ellipse(sx + 14, sy + 12, 14, 10, 0, 0, Math.PI * 2);
    c.fill();

    /* Belly */
    c.fillStyle = '#ccaa77';
    c.beginPath();
    c.ellipse(sx + 14, sy + 14, 8, 6, 0, 0, Math.PI * 2);
    c.fill();

    /* Head */
    c.fillStyle = '#996633';
    c.beginPath();
    c.arc(sx + 6, sy + 5, 8, 0, Math.PI * 2);
    c.fill();

    /* Ears */
    c.fillStyle = '#885522';
    c.beginPath(); c.arc(sx + 1, sy + 0, 3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 11, sy + 0, 3, 0, Math.PI * 2); c.fill();

    /* Eyes */
    c.fillStyle = '#000000';
    c.beginPath(); c.arc(sx + 4, sy + 5, 2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 9, sy + 5, 2, 0, Math.PI * 2); c.fill();
    /* Highlights */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 4, sy + 4, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 9, sy + 4, 0.8, 0, Math.PI * 2); c.fill();

    /* Nose */
    c.fillStyle = '#333333';
    c.beginPath(); c.arc(sx + 6, sy + 7, 1.5, 0, Math.PI * 2); c.fill();

    /* Whiskers */
    c.strokeStyle = '#664422';
    c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(sx + 0, sy + 6); c.lineTo(sx - 5, sy + 5);
    c.moveTo(sx + 0, sy + 8); c.lineTo(sx - 5, sy + 9);
    c.moveTo(sx + 12, sy + 6); c.lineTo(sx + 17, sy + 5);
    c.moveTo(sx + 12, sy + 8); c.lineTo(sx + 17, sy + 9);
    c.stroke();

    /* Tail – tapered bezier */
    c.fillStyle = '#885522';
    var tailWag = Math.sin(this.timer * 0.1) * 3;
    c.beginPath();
    c.moveTo(sx + 24, sy + 10);
    c.quadraticCurveTo(sx + 30, sy + 8 + tailWag, sx + 33, sy + 6 + tailWag);
    c.quadraticCurveTo(sx + 31, sy + 12 + tailWag, sx + 28, sy + 13);
    c.closePath();
    c.fill();

    /* Paws – rounded */
    c.fillStyle = '#885522';
    c.beginPath();
    c.ellipse(sx + 6, sy + 20, 3, 2.5, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(sx + 20, sy + 20, 3, 2.5, 0, 0, Math.PI * 2);
    c.fill();

    c.restore();
  };

  /* ========== KITTY CORN (NPC - Cat Mermaid) ========== */
  function KittyCorn(x, y) {
    this.x = x;
    this.y = y;
    this.w = 24;
    this.h = 28;
    this.spawnX = x;
    this.spawnY = y;
    this.timer = 0;
    this.talking = false;
    this.talkTimer = 0;
    this.currentText = '';
    this.interacted = false;
  }

  KittyCorn.prototype.update = function () {
    this.timer++;
    this.x = this.spawnX + Math.sin(this.timer * 0.025) * 30;
    this.y = this.spawnY + Math.cos(this.timer * 0.035) * 15;
    if (this.talking) {
      this.talkTimer--;
      if (this.talkTimer <= 0) this.talking = false;
    }
  };

  KittyCorn.prototype.interact = function () {
    this.talking = true;
    this.talkTimer = 540;
    if (!this.interacted) {
      this.currentText = Game.i18n.t('kittyGreet');
      this.interacted = true;
    } else {
      this.currentText = Game.i18n.t('kittyHint');
    }
  };

  KittyCorn.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);

    c.save();

    /* Mermaid tail – smooth bezier */
    c.fillStyle = '#33ccaa';
    var tailWave = Math.sin(this.timer * 0.08) * 4;
    c.beginPath();
    c.moveTo(sx + 6, sy + 16);
    c.lineTo(sx + 18, sy + 16);
    c.bezierCurveTo(sx + 18, sy + 20, sx + 16 + tailWave, sy + 24, sx + 20, sy + 28);
    c.lineTo(sx + 4, sy + 28);
    c.bezierCurveTo(sx + 8 - tailWave, sy + 24, sx + 6, sy + 20, sx + 6, sy + 16);
    c.closePath();
    c.fill();
    /* Tail fin */
    c.fillStyle = '#22aa88';
    c.beginPath();
    c.moveTo(sx + 12, sy + 27);
    c.quadraticCurveTo(sx + 2, sy + 30, sx + 0, sy + 32);
    c.quadraticCurveTo(sx + 6, sy + 29, sx + 12, sy + 27);
    c.fill();
    c.beginPath();
    c.moveTo(sx + 12, sy + 27);
    c.quadraticCurveTo(sx + 22, sy + 30, sx + 24, sy + 32);
    c.quadraticCurveTo(sx + 18, sy + 29, sx + 12, sy + 27);
    c.fill();

    /* Body – ellipse */
    c.fillStyle = '#ff9944';
    c.beginPath();
    c.ellipse(sx + 12, sy + 14, 7, 5, 0, 0, Math.PI * 2);
    c.fill();

    /* Head */
    c.fillStyle = '#ff9944';
    c.beginPath();
    c.arc(sx + 12, sy + 6, 8, 0, Math.PI * 2);
    c.fill();

    /* Ears */
    c.fillStyle = '#ff8833';
    c.beginPath();
    c.moveTo(sx + 5, sy + 0); c.lineTo(sx + 3, sy - 6); c.lineTo(sx + 9, sy + 0);
    c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(sx + 15, sy + 0); c.lineTo(sx + 21, sy - 6); c.lineTo(sx + 19, sy + 0);
    c.closePath(); c.fill();
    /* Inner ears */
    c.fillStyle = '#ffaacc';
    c.beginPath();
    c.moveTo(sx + 6, sy + 0); c.lineTo(sx + 5, sy - 3); c.lineTo(sx + 8, sy + 0);
    c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(sx + 16, sy + 0); c.lineTo(sx + 19, sy - 3); c.lineTo(sx + 18, sy + 0);
    c.closePath(); c.fill();

    /* Horn – bezier cone with spiral stripe */
    c.fillStyle = '#ff6699';
    c.beginPath();
    c.moveTo(sx + 12, sy - 8);
    c.bezierCurveTo(sx + 10, sy - 4, sx + 9, sy - 2, sx + 10, sy - 1);
    c.lineTo(sx + 14, sy - 1);
    c.bezierCurveTo(sx + 15, sy - 2, sx + 14, sy - 4, sx + 12, sy - 8);
    c.closePath();
    c.fill();
    c.strokeStyle = '#ffcc55';
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(sx + 11.5, sy - 5); c.lineTo(sx + 12.5, sy - 4);
    c.moveTo(sx + 11, sy - 3); c.lineTo(sx + 13, sy - 2);
    c.stroke();

    /* Eyes */
    c.fillStyle = '#000000';
    c.beginPath(); c.arc(sx + 9, sy + 5, 2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 15, sy + 5, 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 9, sy + 4, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 15, sy + 4, 0.8, 0, Math.PI * 2); c.fill();

    /* Mouth – smile arc */
    c.strokeStyle = '#cc5566';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(sx + 12, sy + 7, 3, 0.2, Math.PI - 0.2);
    c.stroke();

    /* Whiskers */
    c.strokeStyle = '#cc7722';
    c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(sx + 5, sy + 6); c.lineTo(sx - 1, sy + 5);
    c.moveTo(sx + 5, sy + 8); c.lineTo(sx - 1, sy + 9);
    c.moveTo(sx + 19, sy + 6); c.lineTo(sx + 25, sy + 5);
    c.moveTo(sx + 19, sy + 8); c.lineTo(sx + 25, sy + 9);
    c.stroke();

    c.restore();
  };

  /* ========== BOB (NPC - Submarine) ========== */
  function Bob(x, y) {
    this.x = x;
    this.y = y;
    this.w = 60;
    this.h = 32;
    this.spawnX = x;
    this.spawnY = y;
    this.timer = 0;
    this.talking = false;
    this.talkTimer = 0;
    this.currentText = '';
    this.propPhase = 0;
  }

  Bob.prototype.update = function () {
    this.timer++;
    this.propPhase += 0.2;
    this.x = this.spawnX + Math.sin(this.timer * 0.01) * 20;
    this.y = this.spawnY + Math.cos(this.timer * 0.015) * 10;
    if (this.talking) {
      this.talkTimer--;
      if (this.talkTimer <= 0) this.talking = false;
    }
  };

  Bob.prototype.interact = function () {
    this.talking = true;
    this.talkTimer = 540;
    this.currentText = Game.i18n.t('bobGreet') + '\n' + Game.i18n.getFact();
  };

  Bob.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);

    c.save();

    /* Hull */
    c.fillStyle = '#ffcc33';
    c.beginPath();
    c.ellipse(sx + 28, sy + 18, 28, 14, 0, 0, Math.PI * 2);
    c.fill();

    /* Red stripe */
    c.fillStyle = '#cc3333';
    c.beginPath();
    c.ellipse(sx + 28, sy + 18, 26, 3, 0, 0, Math.PI * 2);
    c.fill();

    /* Cabin / tower – rounded */
    c.fillStyle = '#ddaa22';
    c.beginPath();
    c.moveTo(sx + 20, sy + 12);
    c.quadraticCurveTo(sx + 20, sy + 2, sx + 28, sy + 2);
    c.quadraticCurveTo(sx + 36, sy + 2, sx + 36, sy + 12);
    c.closePath();
    c.fill();

    /* Periscope – rounded ends */
    c.fillStyle = '#999999';
    c.beginPath();
    c.moveTo(sx + 27, sy - 8);
    c.quadraticCurveTo(sx + 28, sy - 10, sx + 30, sy - 10);
    c.lineTo(sx + 32, sy - 10);
    c.quadraticCurveTo(sx + 34, sy - 10, sx + 32, sy - 8);
    c.lineTo(sx + 30, sy - 8);
    c.lineTo(sx + 30, sy + 0);
    c.lineTo(sx + 27, sy + 0);
    c.closePath();
    c.fill();

    /* Windows */
    c.fillStyle = '#88ddff';
    c.beginPath(); c.arc(sx + 14, sy + 14, 5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 28, sy + 14, 5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 42, sy + 14, 5, 0, Math.PI * 2); c.fill();
    /* Window rims */
    c.strokeStyle = '#aa8822';
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(sx + 14, sy + 14, 5, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(sx + 28, sy + 14, 5, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(sx + 42, sy + 14, 5, 0, Math.PI * 2); c.stroke();

    /* Face in middle window */
    c.fillStyle = '#ffddbb';
    c.beginPath(); c.arc(sx + 28, sy + 14, 3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#333';
    c.beginPath(); c.arc(sx + 27, sy + 13, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 30, sy + 13, 0.8, 0, Math.PI * 2); c.fill();

    /* Propeller */
    c.fillStyle = '#888888';
    c.save();
    c.translate(sx + 56, sy + 18);
    c.rotate(this.propPhase);
    c.beginPath();
    c.ellipse(0, -5, 2, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(0, 5, 2, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    c.fillStyle = '#666666';
    c.beginPath(); c.arc(sx + 56, sy + 18, 3, 0, Math.PI * 2); c.fill();

    c.restore();
  };

  /* ========== WOLFE (NPC - Dog on Beach) ========== */
  function Wolfe(x, y, patrolWidth) {
    this.x = x;
    this.y = y;
    this.w = 30;
    this.h = 22;
    this.patrolX = x;
    this.patrolWidth = patrolWidth || 400;
    this.dir = 1;
    this.speed = 2;
    this.timer = 0;
    this.legPhase = 0;
  }

  Wolfe.prototype.update = function () {
    this.timer++;
    this.legPhase += 0.15;
    this.x += this.speed * this.dir;
    if (this.x > this.patrolX + this.patrolWidth) this.dir = -1;
    if (this.x < this.patrolX) this.dir = 1;
  };

  Wolfe.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    var legOff = Math.sin(this.legPhase) * 4;

    c.save();
    if (this.dir === -1) {
      c.translate(sx + this.w / 2, 0);
      c.scale(-1, 1);
      sx = -this.w / 2;
    }

    /* Body */
    c.fillStyle = '#cc9933';
    c.beginPath();
    c.ellipse(sx + 15, sy + 10, 14, 8, 0, 0, Math.PI * 2);
    c.fill();

    /* Head */
    c.fillStyle = '#cc9933';
    c.beginPath();
    c.arc(sx + 4, sy + 5, 7, 0, Math.PI * 2);
    c.fill();

    /* Ear */
    c.fillStyle = '#aa7722';
    c.beginPath();
    c.moveTo(sx + 0, sy + 0);
    c.quadraticCurveTo(sx - 2, sy - 4, sx - 3, sy - 5);
    c.quadraticCurveTo(sx + 1, sy - 2, sx + 4, sy + 0);
    c.closePath();
    c.fill();

    /* Eye */
    c.fillStyle = '#333';
    c.beginPath(); c.arc(sx + 3, sy + 4, 1.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(sx + 3, sy + 3.5, 0.5, 0, Math.PI * 2); c.fill();

    /* Nose */
    c.fillStyle = '#333';
    c.beginPath(); c.arc(sx - 1, sy + 6, 1.5, 0, Math.PI * 2); c.fill();

    /* Tongue (panting) – rounded end */
    if (Math.sin(this.timer * 0.1) > 0) {
      c.fillStyle = '#ff8899';
      c.beginPath();
      c.moveTo(sx - 1, sy + 7);
      c.lineTo(sx + 2, sy + 7);
      c.quadraticCurveTo(sx + 2, sy + 11, sx + 0.5, sy + 11);
      c.quadraticCurveTo(sx - 1, sy + 11, sx - 1, sy + 7);
      c.closePath();
      c.fill();
    }

    /* Legs – tapered with rounded paws */
    c.fillStyle = '#cc9933';
    var legs = [
      { x: sx + 6, off: legOff },
      { x: sx + 12, off: -legOff },
      { x: sx + 20, off: -legOff },
      { x: sx + 26, off: legOff }
    ];
    for (var li = 0; li < legs.length; li++) {
      var lg = legs[li];
      c.beginPath();
      c.moveTo(lg.x, sy + 16);
      c.lineTo(lg.x + 4, sy + 16);
      c.lineTo(lg.x + 3.5, sy + 21 + lg.off);
      c.quadraticCurveTo(lg.x + 2, sy + 23 + lg.off, lg.x + 0.5, sy + 21 + lg.off);
      c.closePath();
      c.fill();
    }

    /* Tail */
    c.fillStyle = '#cc9933';
    var tailWag = Math.sin(this.timer * 0.15) * 5;
    c.beginPath();
    c.moveTo(sx + 28, sy + 6);
    c.quadraticCurveTo(sx + 34, sy + 2 + tailWag, sx + 32, sy - 2 + tailWag);
    c.lineTo(sx + 30, sy + 0 + tailWag);
    c.quadraticCurveTo(sx + 31, sy + 4, sx + 28, sy + 8);
    c.closePath();
    c.fill();

    /* Collar – curved */
    c.strokeStyle = '#cc3333';
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(sx + 4, sy + 9, 6, 0.2, Math.PI - 0.2);
    c.stroke();

    c.restore();
  };

  /* ========== CRAB (NPC – friendly joke-teller) ========== */
  function Crab(x, y) {
    this.x = x;
    this.y = y;
    this.w = 22;
    this.h = 14;
    this.spawnX = x;
    this.spawnY = y;
    this.timer = Math.random() * 100;
    this.dir = Math.random() > 0.5 ? 1 : -1;
    this.legPhase = 0;
    this.talking = false;
    this.talkTimer = 0;
    this.currentJoke = '';
  }

  Crab.prototype.update = function () {
    this.timer++;
    this.legPhase += 0.18;
    /* Sidestep along a short patrol; flip when you reach the ends so the
       claws lead the walk – feels more crab-like than smooth oscillation. */
    var range = 36;
    var off = this.x - this.spawnX;
    if (off > range) this.dir = -1;
    else if (off < -range) this.dir = 1;
    if (!this.talking) this.x += 0.3 * this.dir;
    /* Tiny sand-bob */
    this.y = this.spawnY + Math.sin(this.timer * 0.06) * 0.6;
    if (this.talking) {
      this.talkTimer--;
      if (this.talkTimer <= 0) this.talking = false;
    }
  };

  Crab.prototype.interact = function () {
    this.talking = true;
    this.talkTimer = 540;
    this.currentJoke = Game.i18n.getCrabJoke();
  };

  Crab.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    var leg = Math.sin(this.legPhase) * 2;

    c.save();
    if (this.dir === -1) {
      c.translate(sx + this.w / 2, 0);
      c.scale(-1, 1);
      sx = -this.w / 2;
    }

    /* Legs (behind body) – three pairs, alternating sway */
    c.strokeStyle = '#9a2418';
    c.lineWidth = 1.5;
    c.lineCap = 'round';
    for (var lg = 0; lg < 3; lg++) {
      var lx = sx + 6 + lg * 4;
      var lOff = (lg % 2 === 0 ? leg : -leg);
      /* Left side leg */
      c.beginPath();
      c.moveTo(lx - 1, sy + 8);
      c.lineTo(lx - 4, sy + 13 + lOff);
      c.stroke();
      /* Right side leg */
      c.beginPath();
      c.moveTo(lx + 1, sy + 8);
      c.lineTo(lx + 4, sy + 13 - lOff);
      c.stroke();
    }

    /* Body shell */
    c.fillStyle = '#d8442f';
    c.beginPath();
    c.ellipse(sx + 11, sy + 7, 10, 6, 0, 0, Math.PI * 2);
    c.fill();
    /* Shell highlight */
    c.fillStyle = '#f1735c';
    c.beginPath();
    c.ellipse(sx + 9, sy + 5, 6, 2.4, 0, 0, Math.PI * 2);
    c.fill();
    /* Shell speckles */
    c.fillStyle = '#7a1a10';
    c.beginPath(); c.arc(sx + 7,  sy + 8, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 13, sy + 9, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 15, sy + 6, 0.7, 0, Math.PI * 2); c.fill();

    /* Claws – pinched ovals on each side */
    var clawWiggle = this.talking ? Math.sin(this.timer * 0.4) * 0.6 : 0;
    c.fillStyle = '#d8442f';
    c.save();
    c.translate(sx + 1, sy + 6);
    c.rotate(-0.4 + clawWiggle);
    c.beginPath(); c.ellipse(0, 0, 4, 2.6, 0, 0, Math.PI * 2); c.fill();
    /* Pincer notch */
    c.fillStyle = '#7a1a10';
    c.beginPath(); c.moveTo(-3.2, 0); c.lineTo(-1.5, -0.6); c.lineTo(-1.5, 0.6); c.closePath(); c.fill();
    c.restore();
    c.fillStyle = '#d8442f';
    c.save();
    c.translate(sx + 21, sy + 6);
    c.rotate(0.4 - clawWiggle);
    c.beginPath(); c.ellipse(0, 0, 4, 2.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7a1a10';
    c.beginPath(); c.moveTo(3.2, 0); c.lineTo(1.5, -0.6); c.lineTo(1.5, 0.6); c.closePath(); c.fill();
    c.restore();

    /* Eye stalks */
    c.strokeStyle = '#7a1a10';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(sx + 8, sy + 3); c.lineTo(sx + 7, sy);
    c.stroke();
    c.beginPath();
    c.moveTo(sx + 14, sy + 3); c.lineTo(sx + 15, sy);
    c.stroke();
    /* Eyes */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 7, sy, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 15, sy, 1.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.arc(sx + 7, sy, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 15, sy, 0.8, 0, Math.PI * 2); c.fill();

    /* Friendly smile */
    c.strokeStyle = '#7a1a10';
    c.lineWidth = 0.8;
    c.beginPath();
    c.arc(sx + 11, sy + 7, 2, 0.2, Math.PI - 0.2);
    c.stroke();

    c.restore();
  };

  /* ========== HEART PICKUP ========== */
  function HeartPickup(x, y) {
    this.x = x;
    this.y = y;
    this.w = 16;
    this.h = 16;
    this.spawnY = y;
    this.timer = 0;
    this.active = true;
  }

  HeartPickup.prototype.update = function () {
    this.timer++;
    this.y = this.spawnY + Math.sin(this.timer * 0.05) * 6;
  };

  /* Re-themed as StarGem — a cut gem with a twinkle core. */
  HeartPickup.prototype.draw = function (c, camX, camY) {
    if (!this.active) return;
    var sx = this.x - camX + 8;
    var sy = this.y - camY + 8;
    var pulse = 1 + Math.sin(this.timer * 0.08) * 0.15;
    var spin = Math.sin(this.timer * 0.04) * 0.3;

    c.save();
    c.translate(sx, sy);
    c.rotate(spin);
    c.scale(pulse, pulse);
    /* Gem body — diamond facets */
    c.fillStyle = '#ff66cc';
    c.beginPath();
    c.moveTo(0, -7);
    c.lineTo(6, -2);
    c.lineTo(4, 7);
    c.lineTo(-4, 7);
    c.lineTo(-6, -2);
    c.closePath();
    c.fill();
    /* Facet highlight */
    c.fillStyle = '#ffaae0';
    c.beginPath();
    c.moveTo(0, -7);
    c.lineTo(6, -2);
    c.lineTo(0, 0);
    c.closePath();
    c.fill();
    /* Bright sparkle center */
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(-1, -3, 1.3, 0, Math.PI * 2);
    c.fill();
    /* Outer glow */
    c.globalAlpha = 0.45;
    c.strokeStyle = '#ff99dd';
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(0, -11);
    c.lineTo(0, 11);
    c.moveTo(-9, 0);
    c.lineTo(9, 0);
    c.stroke();
    c.restore();
  };

  /* ========== PARTICLE ========== */
  function Particle(x, y, vx, vy, color, life, size) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life || 30;
    this.maxLife = this.life;
    this.size = size || 3;
    this.active = true;
  }

  Particle.prototype.update = function () {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.02;
    this.vx *= 0.98;
    this.life--;
    if (this.life <= 0) this.active = false;
  };

  Particle.prototype.draw = function (c, camX, camY) {
    if (!this.active) return;
    var alpha = this.life / this.maxLife;
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = this.color;
    var s = this.size * alpha;
    c.beginPath();
    c.arc(this.x - camX, this.y - camY, s / 2, 0, Math.PI * 2);
    c.fill();
    c.restore();
  };

  /* Spawn a burst of particles */
  function spawnBurst(x, y, count, colors) {
    var particles = [];
    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      var speed = 1 + Math.random() * 2;
      var color = colors[Math.floor(Math.random() * colors.length)];
      particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        color, 30 + Math.random() * 20, 2 + Math.random() * 3
      ));
    }
    return particles;
  }

  /* ========== AMBIENT BUBBLE ========== */
  function AmbientBubble(x, y) {
    this.x = x;
    this.y = y;
    this.r = 1 + Math.random() * 3;
    this.speed = 0.3 + Math.random() * 0.5;
    this.wobbleSpeed = 0.01 + Math.random() * 0.03;
    this.wobbleAmp = 10 + Math.random() * 20;
    this.phase = Math.random() * Math.PI * 2;
    this.alpha = 0.2 + Math.random() * 0.3;
  }

  AmbientBubble.prototype.update = function (levelHeight) {
    this.phase += this.wobbleSpeed;
    this.y -= this.speed;
    if (this.y < -10) this.y = levelHeight + 10;
  };

  /* Re-themed as AmbientSparkle — cosmic dust drifting upward. */
  AmbientBubble.prototype.draw = function (c, camX, camY) {
    var sx = this.x - camX + Math.sin(this.phase) * this.wobbleAmp;
    var sy = this.y - camY;
    c.save();
    c.globalAlpha = this.alpha * 0.85;
    c.fillStyle = this.phase > Math.PI ? '#ff99dd' : '#ccddff';
    c.beginPath();
    c.arc(sx, sy, this.r, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffffff';
    c.globalAlpha = this.alpha;
    c.beginPath();
    c.arc(sx, sy, this.r * 0.4, 0, Math.PI * 2);
    c.fill();
    c.restore();
  };

  /* ========== ROCKET SHIP (interactable — opens travel menu) ========== */
  /* Towering rocket — drawn at 8× the original 90×150 sprite (so 720×1200).
     The visual base stays anchored to the original spawn position so the
     player can still walk up to it; the top now towers off-screen into the
     sky. Internally the draw routine still uses the original 90×150 layout
     coordinates and a canvas transform handles the 8× scale. */
  function RocketShip(x, y) {
    this.x = x;
    this.y = y;
    this.w = 720;
    this.h = 1200;
    this.talking = false;
    this.timer = 0;
  }

  RocketShip.prototype.update = function () {
    this.timer++;
  };

  RocketShip.prototype.interact = function () {
    /* engine.js reads keys.up/jp.up and calls onRocketInteract directly,
       so this stub just ensures the NPC loop doesn't freak out. */
  };

  RocketShip.prototype.draw = function (c, camX, camY) {
    /* Anchor in screen-space matches the original (pre-scale) top-left. */
    var ax = Math.round(this.x - camX);
    var ay = Math.round(this.y - camY);
    c.save();
    /* Translate so the visual base + horizontal center stay where they were
       on the original 90×150 sprite, then scale 8×. The shift is
       (-(8-1)*w/2, -(8-1)*h) = (-315, -1050) for w=90, h=150. */
    c.translate(ax - 315, ay - 1050);
    c.scale(8, 8);
    var sx = 0;
    var sy = 0;
    var cx = sx + 45; /* horizontal centerline */
    /* Outer drop shadow on the pad */
    c.save();
    c.globalAlpha = 0.35;
    c.fillStyle = '#000';
    c.beginPath();
    c.ellipse(cx, sy + 150, 50, 6, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    /* ----- Boosters (left & right strap-on tanks) ----- */
    var bGrad = c.createLinearGradient(sx, sy, sx + this.w, sy);
    bGrad.addColorStop(0, '#7a8896');
    bGrad.addColorStop(0.5, '#cdd8e2');
    bGrad.addColorStop(1, '#7a8896');
    c.fillStyle = bGrad;
    /* Left booster */
    c.beginPath();
    c.moveTo(sx + 8, sy + 60);
    c.lineTo(sx + 4, sy + 70);
    c.lineTo(sx + 4, sy + 130);
    c.lineTo(sx + 16, sy + 130);
    c.lineTo(sx + 16, sy + 60);
    c.closePath();
    c.fill();
    /* Right booster */
    c.beginPath();
    c.moveTo(sx + 74, sy + 60);
    c.lineTo(sx + 74, sy + 130);
    c.lineTo(sx + 86, sy + 130);
    c.lineTo(sx + 86, sy + 70);
    c.lineTo(sx + 82, sy + 60);
    c.closePath();
    c.fill();
    /* Booster nose cones */
    c.fillStyle = '#ff66cc';
    c.beginPath();
    c.moveTo(sx + 4, sy + 70); c.lineTo(sx + 10, sy + 50); c.lineTo(sx + 16, sy + 70);
    c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(sx + 74, sy + 70); c.lineTo(sx + 80, sy + 50); c.lineTo(sx + 86, sy + 70);
    c.closePath(); c.fill();

    /* ----- Main body ----- */
    var mGrad = c.createLinearGradient(sx + 24, sy, sx + 66, sy);
    mGrad.addColorStop(0, '#aab5c2');
    mGrad.addColorStop(0.5, '#ffffff');
    mGrad.addColorStop(1, '#aab5c2');
    c.fillStyle = mGrad;
    c.beginPath();
    c.moveTo(cx, sy + 0);                 /* tip */
    c.lineTo(sx + 66, sy + 40);
    c.lineTo(sx + 66, sy + 130);
    c.lineTo(sx + 24, sy + 130);
    c.lineTo(sx + 24, sy + 40);
    c.closePath();
    c.fill();

    /* Nose cone — pink with stripes */
    c.fillStyle = '#ff4488';
    c.beginPath();
    c.moveTo(cx, sy + 0);
    c.lineTo(sx + 66, sy + 40);
    c.lineTo(sx + 24, sy + 40);
    c.closePath();
    c.fill();
    /* Cone stripe */
    c.fillStyle = '#ffd24a';
    c.beginPath();
    c.moveTo(sx + 30, sy + 26);
    c.lineTo(sx + 60, sy + 26);
    c.lineTo(sx + 58, sy + 32);
    c.lineTo(sx + 32, sy + 32);
    c.closePath();
    c.fill();
    /* Tip beacon */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(cx, sy + 4, 3, 0, Math.PI * 2); c.fill();
    var beacon = (Math.sin(this.timer * 0.18) + 1) * 0.5;
    c.globalAlpha = 0.6 + beacon * 0.4;
    c.fillStyle = '#ff4466';
    c.beginPath(); c.arc(cx, sy + 4, 2, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;

    /* Body horizontal bands (riveted plates) */
    c.strokeStyle = 'rgba(0,0,0,0.18)';
    c.lineWidth = 1;
    var bandYs = [55, 80, 105];
    for (var ib = 0; ib < bandYs.length; ib++) {
      c.beginPath();
      c.moveTo(sx + 24, sy + bandYs[ib]);
      c.lineTo(sx + 66, sy + bandYs[ib]);
      c.stroke();
    }
    /* Rivets */
    c.fillStyle = '#7a8896';
    for (var ir = 0; ir < bandYs.length; ir++) {
      for (var jr = 0; jr < 5; jr++) {
        c.beginPath();
        c.arc(sx + 28 + jr * 9, sy + bandYs[ir], 0.7, 0, Math.PI * 2);
        c.fill();
      }
    }

    /* Big circular cockpit window */
    c.fillStyle = '#001a33';
    c.beginPath(); c.arc(cx, sy + 64, 14, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#44ccff';
    c.beginPath(); c.arc(cx, sy + 64, 11, 0, Math.PI * 2); c.fill();
    /* Window cross frame */
    c.strokeStyle = '#001a33';
    c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(cx - 11, sy + 64); c.lineTo(cx + 11, sy + 64); c.stroke();
    c.beginPath(); c.moveTo(cx, sy + 53); c.lineTo(cx, sy + 75); c.stroke();
    /* Reflection */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(cx - 4, sy + 60, 3, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 0.6;
    c.beginPath(); c.arc(cx + 5, sy + 68, 1.6, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;

    /* Smaller portholes below the cockpit */
    for (var ph = 0; ph < 3; ph++) {
      var phy = sy + 92 + ph * 12;
      c.fillStyle = '#001a33';
      c.beginPath(); c.arc(cx, phy, 4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#44ccff';
      c.beginPath(); c.arc(cx, phy, 3, 0, Math.PI * 2); c.fill();
    }

    /* "MOMOKO" mission badge below the window */
    c.fillStyle = '#ffd24a';
    c.fillRect(sx + 32, sy + 84, 26, 4);
    c.fillStyle = '#ff66cc';
    c.font = 'bold 4.5px monospace';
    c.textAlign = 'center';
    c.fillText('MOMOKO', cx, sy + 87.5);

    /* Side antennae sweeping out */
    c.strokeStyle = '#ddddee';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(sx + 24, sy + 50);
    c.lineTo(sx + 14, sy + 36);
    c.stroke();
    c.beginPath();
    c.moveTo(sx + 66, sy + 50);
    c.lineTo(sx + 76, sy + 36);
    c.stroke();
    c.fillStyle = '#44ffff';
    c.beginPath(); c.arc(sx + 14, sy + 36, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 76, sy + 36, 1.6, 0, Math.PI * 2); c.fill();

    /* Big fins at the base */
    c.fillStyle = '#ff66cc';
    c.beginPath();
    c.moveTo(sx + 24, sy + 110);
    c.lineTo(sx + 6, sy + 144);
    c.lineTo(sx + 24, sy + 144);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(sx + 66, sy + 110);
    c.lineTo(sx + 84, sy + 144);
    c.lineTo(sx + 66, sy + 144);
    c.closePath();
    c.fill();
    /* Fin highlights */
    c.fillStyle = '#ff99dd';
    c.beginPath();
    c.moveTo(sx + 24, sy + 116);
    c.lineTo(sx + 14, sy + 140);
    c.lineTo(sx + 22, sy + 140);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(sx + 66, sy + 116);
    c.lineTo(sx + 76, sy + 140);
    c.lineTo(sx + 68, sy + 140);
    c.closePath();
    c.fill();

    /* ----- Triple thrusters at the very base ----- */
    c.fillStyle = '#3a3a4a';
    c.fillRect(sx + 28, sy + 134, 8, 16);
    c.fillRect(sx + 41, sy + 134, 8, 16);
    c.fillRect(sx + 54, sy + 134, 8, 16);
    /* Booster thrusters */
    c.fillRect(sx + 6, sy + 130, 8, 14);
    c.fillRect(sx + 76, sy + 130, 8, 14);

    /* Exhaust flicker — animated yellow/red puffs from each thruster */
    var flick = Math.sin(this.timer * 0.3) * 2 + 4;
    var flick2 = Math.cos(this.timer * 0.27) * 2 + 4;
    function plume(thx, thy, sz, alt) {
      c.fillStyle = '#fff4a8';
      c.beginPath(); c.arc(thx, thy + sz, sz, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffd24a';
      c.beginPath(); c.arc(thx, thy + sz, sz * 0.7, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff6644';
      c.beginPath(); c.arc(thx, thy + sz - 1, sz * 0.4, 0, Math.PI * 2); c.fill();
    }
    plume(sx + 32, sy + 150, flick * 0.7);
    plume(sx + 45, sy + 150, flick);
    plume(sx + 58, sy + 150, flick2 * 0.7);
    plume(sx + 10, sy + 144, flick2 * 0.6);
    plume(sx + 80, sy + 144, flick * 0.6);
    c.restore();
  };

  /* ========== HOUSE DOOR (interactable — enters house interior) ========== */
  function HouseDoor(x, y, houseId) {
    this.x = x;
    this.y = y;
    this.w = 48;
    this.h = 52;
    this.houseId = houseId || 'heroHome';
    this.talking = false;
    this.timer = 0;
  }

  HouseDoor.prototype.update = function () { this.timer++; };
  HouseDoor.prototype.interact = function () { /* handled by engine */ };

  HouseDoor.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    /* Door frame */
    c.fillStyle = '#3a2412';
    c.fillRect(sx, sy, 48, 52);
    /* Door panel */
    c.fillStyle = '#8a5a32';
    c.fillRect(sx + 4, sy + 4, 40, 46);
    /* Door grain */
    c.strokeStyle = '#5a3a22';
    c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(sx + 24, sy + 6); c.lineTo(sx + 24, sy + 48); c.stroke();
    c.beginPath(); c.moveTo(sx + 8, sy + 26); c.lineTo(sx + 40, sy + 26); c.stroke();
    /* Handle */
    c.fillStyle = '#ffd24a';
    c.beginPath();
    c.arc(sx + 38, sy + 28, 2.6, 0, Math.PI * 2);
    c.fill();
    /* Welcome heart sign above */
    c.fillStyle = '#ff66cc';
    var hcx = sx + 24, hcy = sy - 8;
    c.beginPath();
    c.arc(hcx - 2, hcy - 1, 2, 0, Math.PI * 2);
    c.arc(hcx + 2, hcy - 1, 2, 0, Math.PI * 2);
    c.moveTo(hcx - 3.6, hcy);
    c.lineTo(hcx, hcy + 3.5);
    c.lineTo(hcx + 3.6, hcy);
    c.closePath();
    c.fill();
  };

  /* ========== CAFE DOOR (interactable — opens the comfy cafe cutscene) ==========
     The Cosmic Café storefront is drawn by the cafeBuilding decoration; this
     entity is a small clickable zone in front of the painted door so the
     engine can detect player proximity and trigger the cutscene. We draw a
     soft glow + bobbing heart prompt over the painted door so the player
     can tell it's interactive. */
  function CafeDoor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 48;
    this.h = 52;
    this.talking = false;
    this.timer = 0;
  }

  CafeDoor.prototype.update = function () { this.timer++; };
  CafeDoor.prototype.interact = function () { /* handled by engine */ };

  CafeDoor.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    /* Soft warm glow at the doorway (subtle, since the building art owns
       the door visuals). */
    c.save();
    c.globalAlpha = 0.4 + Math.sin(this.timer * 0.06) * 0.1;
    var glow = c.createRadialGradient(sx + 24, sy + 30, 4, sx + 24, sy + 30, 36);
    glow.addColorStop(0, 'rgba(255,210,138,0.75)');
    glow.addColorStop(1, 'rgba(255,210,138,0)');
    c.fillStyle = glow;
    c.beginPath(); c.arc(sx + 24, sy + 30, 36, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Bobbing heart prompt above */
    var bob = Math.sin(this.timer * 0.08) * 2;
    c.fillStyle = '#ff66cc';
    var hcx = sx + 24, hcy = sy - 12 + bob;
    c.beginPath();
    c.arc(hcx - 2.4, hcy - 1, 2.4, 0, Math.PI * 2);
    c.arc(hcx + 2.4, hcy - 1, 2.4, 0, Math.PI * 2);
    c.moveTo(hcx - 4.4, hcy);
    c.lineTo(hcx, hcy + 4.4);
    c.lineTo(hcx + 4.4, hcy);
    c.closePath();
    c.fill();
    /* Tiny "OPEN" tag */
    c.fillStyle = '#ffd24a';
    c.font = 'bold 8px monospace';
    c.textAlign = 'center';
    c.fillText('OPEN', sx + 24, sy - 22 + bob * 0.5);
    c.textAlign = 'left';
  };

  /* ========== SHOP DOOR (Star Bazaar — opens the shop interior) ==========
     Same pattern as CafeDoor: invisible-but-cued zone in front of the
     painted shop double-doors. */
  function ShopDoor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 48;
    this.h = 52;
    this.talking = false;
    this.timer = 0;
  }
  ShopDoor.prototype.update = function () { this.timer++; };
  ShopDoor.prototype.interact = function () { /* handled by engine */ };
  ShopDoor.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    /* Soft warm glow at the doorway */
    c.save();
    c.globalAlpha = 0.4 + Math.sin(this.timer * 0.06) * 0.1;
    var glow = c.createRadialGradient(sx + 24, sy + 30, 4, sx + 24, sy + 30, 36);
    glow.addColorStop(0, 'rgba(255,232,140,0.75)');
    glow.addColorStop(1, 'rgba(255,232,140,0)');
    c.fillStyle = glow;
    c.beginPath(); c.arc(sx + 24, sy + 30, 36, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Bobbing star prompt above */
    var bob = Math.sin(this.timer * 0.08) * 2;
    c.fillStyle = '#ffd24a';
    var hcx = sx + 24, hcy = sy - 12 + bob;
    c.beginPath();
    c.moveTo(hcx, hcy - 4);
    c.lineTo(hcx + 1.4, hcy - 1.2);
    c.lineTo(hcx + 4.4, hcy - 0.8);
    c.lineTo(hcx + 2, hcy + 1.2);
    c.lineTo(hcx + 3, hcy + 4);
    c.lineTo(hcx, hcy + 2.4);
    c.lineTo(hcx - 3, hcy + 4);
    c.lineTo(hcx - 2, hcy + 1.2);
    c.lineTo(hcx - 4.4, hcy - 0.8);
    c.lineTo(hcx - 1.4, hcy - 1.2);
    c.closePath();
    c.fill();
    /* Tiny "SHOP" tag */
    c.fillStyle = '#44ffff';
    c.font = 'bold 8px monospace';
    c.textAlign = 'center';
    c.fillText('SHOP', sx + 24, sy - 22 + bob * 0.5);
    c.textAlign = 'left';
  };

  /* ========== LILA (friendly neighbor NPC) ========== */
  function Lila(x, y) {
    this.x = x;
    this.y = y;
    this.w = 26;
    this.h = 34;
    this.timer = 0;
    this.talking = false;
    this.talkTimer = 0;
    this.currentText = '';
  }

  Lila.prototype.update = function () {
    this.timer++;
    if (this.talkTimer > 0) {
      this.talkTimer--;
      if (this.talkTimer <= 0) this.talking = false;
    }
  };

  Lila.prototype.interact = function () {
    this.talking = true;
    this.talkTimer = 280;
    /* Pick text based on quest state */
    var q = Game.quests && Game.quests.lila;
    if (q === 'done') {
      this.currentText = Game.i18n.t('lilaThanks');
    } else {
      this.currentText = Game.i18n.t('lilaGreet');
    }
  };

  Lila.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    var bob = Math.sin(this.timer * 0.05) * 1;
    /* Body — space suit in teal */
    c.fillStyle = '#33aaaa';
    c.fillRect(sx + 6, sy + 14 + bob, 14, 16);
    /* Head */
    c.fillStyle = '#ffccaa';
    c.beginPath();
    c.arc(sx + 13, sy + 10 + bob, 7, 0, Math.PI * 2);
    c.fill();
    /* Hair — short bob, purple */
    c.fillStyle = '#8844cc';
    c.beginPath();
    c.arc(sx + 13, sy + 7 + bob, 7, Math.PI, Math.PI * 2);
    c.fill();
    c.fillRect(sx + 6, sy + 7 + bob, 14, 5);
    /* Eyes */
    c.fillStyle = '#000000';
    c.beginPath(); c.arc(sx + 10, sy + 10 + bob, 0.9, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 16, sy + 10 + bob, 0.9, 0, Math.PI * 2); c.fill();
    /* Smile */
    c.strokeStyle = '#993333';
    c.lineWidth = 0.8;
    c.beginPath();
    c.arc(sx + 13, sy + 12 + bob, 1.8, 0.1, Math.PI - 0.1);
    c.stroke();
    /* Helmet ring */
    c.strokeStyle = '#44ffff';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(sx + 13, sy + 10 + bob, 8.5, 0, Math.PI * 2);
    c.stroke();
    /* Legs */
    c.fillStyle = '#225577';
    c.fillRect(sx + 8, sy + 30 + bob, 4, 4);
    c.fillRect(sx + 14, sy + 30 + bob, 4, 4);
  };

  /* ========== MIGWORD (cheese-moon resident NPC) ========== */
  function MigWord(x, y) {
    this.x = x;
    this.y = y;
    this.w = 28;
    this.h = 34;
    this.timer = 0;
    this.talking = false;
    this.talkTimer = 0;
    this.currentText = '';
  }

  MigWord.prototype.update = function () {
    this.timer++;
    if (this.talkTimer > 0) {
      this.talkTimer--;
      if (this.talkTimer <= 0) this.talking = false;
    }
  };

  MigWord.prototype.interact = function () {
    this.talking = true;
    this.talkTimer = 300;
    var q = Game.quests && Game.quests.migword;
    if (q === 'done') {
      this.currentText = Game.i18n.t('migwordThanks');
    } else {
      this.currentText = Game.i18n.t('migwordGreet');
    }
  };

  MigWord.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    var bob = Math.sin(this.timer * 0.04) * 1.3;
    /* Round cheese-y body */
    c.fillStyle = '#ffcc66';
    c.beginPath();
    c.ellipse(sx + 14, sy + 20 + bob, 13, 12, 0, 0, Math.PI * 2);
    c.fill();
    /* Cheese holes */
    c.fillStyle = '#cc9933';
    c.beginPath(); c.arc(sx + 9, sy + 18 + bob, 1.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 18, sy + 22 + bob, 1.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 14, sy + 26 + bob, 1, 0, Math.PI * 2); c.fill();
    /* Eyes */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 10, sy + 15 + bob, 2.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 18, sy + 15 + bob, 2.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#000000';
    c.beginPath(); c.arc(sx + 10, sy + 15 + bob, 1.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 18, sy + 15 + bob, 1.2, 0, Math.PI * 2); c.fill();
    /* Cheerful smile */
    c.strokeStyle = '#663300';
    c.lineWidth = 1.3;
    c.beginPath();
    c.arc(sx + 14, sy + 19 + bob, 3.5, 0.3, Math.PI - 0.3);
    c.stroke();
    /* Tiny antenna */
    c.strokeStyle = '#aa7700';
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(sx + 14, sy + 8 + bob);
    c.lineTo(sx + 14, sy + 4 + bob);
    c.stroke();
    c.fillStyle = '#44ffff';
    c.beginPath();
    c.arc(sx + 14, sy + 3.5 + bob, 1.3, 0, Math.PI * 2);
    c.fill();
  };

  /* ========== MOON MOUSE (greet-the-friend NPC for MigWord's quest) ========== */
  /* `mouseId` and `color` are passed in so each spawn is visually distinct
     and the engine can dedupe quest progress per-mouse. */
  function MoonMouse(x, y, mouseId, color) {
    this.x = x;
    this.y = y;
    this.w = 22;
    this.h = 18;
    this.spawnX = x;
    this.spawnY = y;
    this.mouseId = mouseId || 'pip';
    this.color = color || '#dddddd';
    this.timer = Math.random() * 100;
    this.talking = false;
    this.talkTimer = 0;
    this.currentText = '';
    this.greeted = false;
  }

  MoonMouse.prototype.update = function () {
    this.timer++;
    /* Tiny scurry — drift left/right around spawn */
    this.x = this.spawnX + Math.sin(this.timer * 0.04) * 12;
    if (this.talkTimer > 0) {
      this.talkTimer--;
      if (this.talkTimer <= 0) this.talking = false;
    }
  };

  MoonMouse.prototype.interact = function () {
    this.talking = true;
    this.talkTimer = 240;
    var key = this.greeted ? 'mouseAgain' : 'mouseGreet_' + this.mouseId;
    this.currentText = Game.i18n.t(key);
    /* Fall back to a generic line if the mouse-specific key isn't defined. */
    if (this.currentText === key) this.currentText = Game.i18n.t('mouseGreet');
    this.greeted = true;
    Game.audio.play('pickup');
  };

  MoonMouse.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    var bob = Math.sin(this.timer * 0.06) * 1;
    /* Body */
    c.fillStyle = this.color;
    c.beginPath();
    c.ellipse(sx + 11, sy + 12 + bob, 9, 6, 0, 0, Math.PI * 2);
    c.fill();
    /* Head */
    c.beginPath();
    c.arc(sx + 4, sy + 9 + bob, 5, 0, Math.PI * 2);
    c.fill();
    /* Big round ears */
    c.fillStyle = hexShade(this.color, 30);
    c.beginPath(); c.arc(sx + 1, sy + 4 + bob, 3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 7, sy + 4 + bob, 3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffaacc';
    c.beginPath(); c.arc(sx + 1, sy + 4 + bob, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 7, sy + 4 + bob, 1.6, 0, Math.PI * 2); c.fill();
    /* Eye */
    c.fillStyle = '#1a0c14';
    c.beginPath(); c.arc(sx + 3, sy + 9 + bob, 1, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 2.6, sy + 8.6 + bob, 0.4, 0, Math.PI * 2); c.fill();
    /* Pink nose */
    c.fillStyle = '#ff66aa';
    c.beginPath(); c.arc(sx - 1, sy + 10 + bob, 0.7, 0, Math.PI * 2); c.fill();
    /* Whiskers */
    c.strokeStyle = '#888';
    c.lineWidth = 0.4;
    c.beginPath();
    c.moveTo(sx - 1, sy + 11 + bob); c.lineTo(sx - 5, sy + 10 + bob);
    c.moveTo(sx - 1, sy + 11.5 + bob); c.lineTo(sx - 5, sy + 12 + bob);
    c.stroke();
    /* Tail */
    c.strokeStyle = hexShade(this.color, 40);
    c.lineWidth = 1.4;
    c.lineCap = 'round';
    var wag = Math.sin(this.timer * 0.12) * 2;
    c.beginPath();
    c.moveTo(sx + 19, sy + 12 + bob);
    c.quadraticCurveTo(sx + 24, sy + 10 + wag + bob, sx + 26, sy + 6 + wag + bob);
    c.stroke();
    /* If greeted, show a little heart over their head */
    if (this.greeted) {
      var hcx = sx + 10, hcy = sy - 3 + bob + Math.sin(this.timer * 0.1) * 0.6;
      c.fillStyle = '#ff4488';
      c.beginPath();
      c.arc(hcx - 1.4, hcy - 0.6, 1.4, 0, Math.PI * 2);
      c.arc(hcx + 1.4, hcy - 0.6, 1.4, 0, Math.PI * 2);
      c.moveTo(hcx - 2.6, hcy);
      c.lineTo(hcx, hcy + 2.4);
      c.lineTo(hcx + 2.6, hcy);
      c.closePath();
      c.fill();
    }
  };

  /* ========== EXPORTS ========== */
  /* ============================================================
   *  ANIMAL HOTEL ZOO ENTITIES
   *  Animal, AnimalDoor, Receptionist, ChandelierMonkey, Elevator,
   *  Stairs, BedroomBed, plus per-species sprite painters. Each
   *  follows the existing { x, y, w, h, talking, talkTimer, update(),
   *  interact(), draw(c, camX, camY) } NPC interface used by Oliver,
   *  HouseDoor, RocketShip etc.
   * ============================================================ */

  /* Per-species color palettes used by draw<Species>Sprite painters. */
  var ANIMAL_PALETTES = {
    elephant:  { body: '#9aa6b0', shade: '#6f7c87', accent: '#ffd6e8' },
    lion:      { body: '#e6b15a', shade: '#a47730', accent: '#7a4a18' },
    tiger:     { body: '#e88848', shade: '#a05418', accent: '#1a1a1a' },
    bear:      { body: '#8a5a30', shade: '#5a3a18', accent: '#cba070' },
    wolf:      { body: '#888a96', shade: '#55576a', accent: '#dadce4' },
    giraffe:   { body: '#e9c97a', shade: '#a07830', accent: '#5a3a18' },
    zebra:     { body: '#f0eee6', shade: '#222222', accent: '#222222' },
    eagle:     { body: '#7a5028', shade: '#4a3010', accent: '#ffd24a' },
    fox:       { body: '#cc6f33', shade: '#8a4418', accent: '#fff0e0' },
    owl:       { body: '#7a5a3a', shade: '#4a3a20', accent: '#ffd24a' },
    panda:     { body: '#f0f0f0', shade: '#222222', accent: '#222222' },
    penguin:   { body: '#1a1a2a', shade: '#0a0a18', accent: '#ffd24a' },
    bunny:     { body: '#f8eedd', shade: '#c8b89a', accent: '#ff99bb' },
    cat:       { body: '#e0a06a', shade: '#a06a30', accent: '#ffe6cc' },
    dog:       { body: '#c89060', shade: '#8a5a30', accent: '#1a1a1a' },
    seaOtter:  { body: '#7a4a28', shade: '#4a2810', accent: '#cba070' },
    kangaroo:  { body: '#c08858', shade: '#7a4a28', accent: '#fff0d8' },
    unicorn:   { body: '#ffffff', shade: '#e8d8ee', accent: '#ff99dd' },
    alien:     { body: '#88dd88', shade: '#48a048', accent: '#ff66cc' },
    monkey:    { body: '#7a4a20', shade: '#4a2810', accent: '#fbd8a8' },
    /* Six new species */
    koala:     { body: '#a8a8b8', shade: '#6a6a78', accent: '#fafafa' },
    hippo:     { body: '#7a6a8a', shade: '#4a3a58', accent: '#cfb8d8' },
    rhino:     { body: '#9a9088', shade: '#65605a', accent: '#3a3434' },
    polarBear: { body: '#fafafa', shade: '#bcc8d6', accent: '#1a1a1a' },
    frog:      { body: '#5fc858', shade: '#2c8a30', accent: '#fff8c0' },
    gorilla:   { body: '#3a3a3a', shade: '#1a1a1a', accent: '#aa8866' },
  };

  /* Tiny shared helper – draws eye + highlight at (cx, cy). */
  function eye(c, cx, cy, r) {
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(cx - r * 0.3, cy - r * 0.3, r * 0.4, 0, Math.PI * 2); c.fill();
  }

  /* Richer eye: white sclera + colored iris + black pupil + highlight.
     Used by the upgraded species painters for a more "realistic" look. */
  function realEye(c, cx, cy, r, iris) {
    c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(cx, cy, r * 1.1, r, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = iris || '#3a4a78';
    c.beginPath(); c.arc(cx, cy, r * 0.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0a0a0a';
    c.beginPath(); c.arc(cx, cy, r * 0.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(cx - r * 0.25, cy - r * 0.25, r * 0.25, 0, Math.PI * 2); c.fill();
  }

  /* Curved fur line — short stroke for fur texture. */
  function furLine(c, x1, y1, x2, y2, color, width) {
    c.strokeStyle = color;
    c.lineWidth = width || 0.5;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  }

  /* Body+head silhouette common to most furry animals.
     Layers vertical-gradient shading + a soft belly highlight + a darker
     under-shadow so the silhouette reads as 3D instead of a flat block. */
  function drawCreatureBase(c, sx, sy, body, shade) {
    /* Soft drop shadow under the feet */
    c.save();
    c.globalAlpha = 0.25;
    c.fillStyle = '#000000';
    c.beginPath();
    c.ellipse(sx + 22, sy + 46, 18, 3, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    /* Body — vertical gradient from body color (top) to shade (bottom) */
    var bodyGrad = c.createLinearGradient(sx + 22, sy + 14, sx + 22, sy + 44);
    bodyGrad.addColorStop(0, body);
    bodyGrad.addColorStop(1, shade);
    c.fillStyle = bodyGrad;
    c.beginPath(); c.ellipse(sx + 22, sy + 28, 22, 14, 0, 0, Math.PI * 2); c.fill();

    /* Belly highlight — soft cream ellipse */
    c.save();
    c.globalAlpha = 0.45;
    c.fillStyle = '#fff8e0';
    c.beginPath(); c.ellipse(sx + 22, sy + 33, 14, 5, 0, 0, Math.PI * 2); c.fill();
    c.restore();

    /* Head — same gradient, slightly forward */
    var headGrad = c.createLinearGradient(sx + 10, sy + 8, sx + 10, sy + 28);
    headGrad.addColorStop(0, body);
    headGrad.addColorStop(1, shade);
    c.fillStyle = headGrad;
    c.beginPath(); c.arc(sx + 10, sy + 18, 11, 0, Math.PI * 2); c.fill();

    /* Soft fur stipple along the back (tiny dots for texture) */
    c.save();
    c.globalAlpha = 0.25;
    c.fillStyle = shade;
    for (var fst = 0; fst < 8; fst++) {
      var fsx = sx + 14 + fst * 2;
      c.beginPath(); c.arc(fsx, sy + 18 + (fst % 2), 0.6, 0, Math.PI * 2); c.fill();
    }
    c.restore();

    /* Legs — four short stocky legs (front pair + back pair) so the
       silhouette reads as a real quadruped, not a round body floating
       on two pegs. Each leg has a paw highlight. */
    c.fillStyle = shade;
    /* Front pair */
    c.fillRect(sx + 9,  sy + 38, 3.4, 7);
    c.fillRect(sx + 14, sy + 38, 3.4, 7);
    /* Back pair */
    c.fillRect(sx + 27, sy + 38, 3.4, 7);
    c.fillRect(sx + 32, sy + 38, 3.4, 7);
    /* Paw highlights on top of the feet */
    c.fillStyle = body;
    c.beginPath(); c.ellipse(sx + 10.7, sy + 44.4, 2,  1.1, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 15.7, sy + 44.4, 2,  1.1, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 28.7, sy + 44.4, 2,  1.1, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 33.7, sy + 44.4, 2,  1.1, 0, 0, Math.PI * 2); c.fill();

    /* Tail stub */
    c.fillStyle = shade;
    c.beginPath(); c.ellipse(sx + 42, sy + 26, 4, 3, 0, 0, Math.PI * 2); c.fill();
  }

  /* ========== Per-species painters ========== */
  function drawElephantSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.elephant;
    drawCreatureBase(c, sx, sy, p.body, p.shade);
    /* Large floppy ears with inner pink and shading */
    c.fillStyle = p.shade;
    c.beginPath(); c.ellipse(sx + 3, sy + 14, 8, 11, -0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 17, sy + 14, 8, 11, 0.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(sx + 4, sy + 16, 4, 6, -0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 16, sy + 16, 4, 6, 0.3, 0, Math.PI * 2); c.fill();
    /* Trunk — long, forward-curling, segmented so it reads
       unambiguously as an elephant trunk and not just a snout. */
    var trunkGrad = c.createLinearGradient(sx, sy + 14, sx + 4, sy + 44);
    trunkGrad.addColorStop(0, p.body);
    trunkGrad.addColorStop(1, p.shade);
    c.fillStyle = trunkGrad;
    c.beginPath();
    c.moveTo(sx + 4, sy + 18);
    c.quadraticCurveTo(sx - 10, sy + 28, sx - 8, sy + 42);
    c.quadraticCurveTo(sx - 2, sy + 46, sx + 4, sy + 40);
    c.quadraticCurveTo(sx + 1, sy + 32, sx + 6, sy + 24);
    c.closePath();
    c.fill();
    /* Trunk ring segments — chunkier so the trunk reads as articulated. */
    c.strokeStyle = p.shade; c.lineWidth = 0.9;
    for (var ts = 0; ts < 5; ts++) {
      c.beginPath();
      c.arc(sx - 3, sy + 24 + ts * 3.6, 5 - ts * 0.5, Math.PI * 1.15, Math.PI * 1.85);
      c.stroke();
    }
    /* Trunk tip nostrils */
    c.fillStyle = p.shade;
    c.beginPath(); c.arc(sx - 7, sy + 41, 0.9, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx - 4, sy + 41, 0.9, 0, Math.PI * 2); c.fill();
    /* Tusks — long curved ivory pair flanking the trunk so the species
       reads at a glance. */
    c.fillStyle = '#fff8e0';
    c.beginPath();
    c.moveTo(sx + 4, sy + 24);
    c.quadraticCurveTo(sx + 1, sy + 32, sx + 0, sy + 36);
    c.lineTo(sx + 3, sy + 34);
    c.quadraticCurveTo(sx + 5, sy + 30, sx + 6, sy + 24);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(sx + 12, sy + 24);
    c.quadraticCurveTo(sx + 12, sy + 30, sx + 11, sy + 34);
    c.lineTo(sx + 14, sy + 36);
    c.quadraticCurveTo(sx + 16, sy + 32, sx + 14, sy + 24);
    c.closePath();
    c.fill();
    /* Tusk shading */
    c.fillStyle = '#d8cfba';
    c.beginPath();
    c.moveTo(sx + 4.6, sy + 26);
    c.quadraticCurveTo(sx + 2.4, sy + 32, sx + 1.6, sy + 35);
    c.lineTo(sx + 2.6, sy + 33);
    c.quadraticCurveTo(sx + 4, sy + 30, sx + 5.2, sy + 26);
    c.closePath();
    c.fill();
    /* Eye with lashes */
    eye(c, sx + 8, sy + 16, 1.8);
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(sx + 6.5, sy + 14.5); c.lineTo(sx + 5.5, sy + 13.8);
    c.moveTo(sx + 8, sy + 14); c.lineTo(sx + 7.8, sy + 13.0);
    c.moveTo(sx + 9.5, sy + 14.5); c.lineTo(sx + 10.5, sy + 13.8);
    c.stroke();
    /* Toenails on visible feet */
    c.fillStyle = '#fff8e0';
    for (var tn = 0; tn < 3; tn++) {
      c.fillRect(sx + 10 + tn * 1.4, sy + 43.5, 0.8, 1.2);
      c.fillRect(sx + 30 + tn * 1.4, sy + 43.5, 0.8, 1.2);
    }
    /* Tail with tuft */
    c.fillStyle = p.shade;
    c.fillRect(sx + 42, sy + 24, 1.4, 8);
    c.beginPath(); c.arc(sx + 42.7, sy + 33, 1.4, 0, Math.PI * 2); c.fill();
  }

  function drawLionSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.lion;
    /* Outer mane halo — radial gradient from gold center to dark amber edge */
    c.save();
    var manGrad = c.createRadialGradient(sx + 10, sy + 18, 4, sx + 10, sy + 18, 18);
    manGrad.addColorStop(0, p.accent);
    manGrad.addColorStop(1, p.shade);
    c.fillStyle = manGrad;
    c.beginPath(); c.arc(sx + 10, sy + 18, 17, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Body underneath */
    drawCreatureBase(c, sx, sy, p.body, p.shade);
    /* Mane — built from overlapping flame-shaped lobes around the face,
       so it reads as a continuous mane instead of a circle of polka
       dots. Two layers (shade behind, accent in front) give it depth. */
    function manelobe(cx, cy, ang, len, w, color) {
      c.save();
      c.translate(cx, cy);
      c.rotate(ang);
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(0, 0);
      c.bezierCurveTo(w * 0.6, -len * 0.15, w * 0.6, -len * 0.65, 0, -len);
      c.bezierCurveTo(-w * 0.6, -len * 0.65, -w * 0.6, -len * 0.15, 0, 0);
      c.closePath();
      c.fill();
      c.restore();
    }
    /* Outer (darker) layer — 12 lobes around the face circle */
    for (var i = 0; i < 12; i++) {
      var ang = i * (Math.PI * 2 / 12);
      var lcx = sx + 10 + Math.cos(ang) * 8;
      var lcy = sy + 18 + Math.sin(ang) * 8;
      manelobe(lcx, lcy, ang + Math.PI / 2, 9, 5, p.shade);
    }
    /* Inner (lighter) layer — slightly shorter lobes for fluff */
    for (var i2 = 0; i2 < 12; i2++) {
      var ang2 = i2 * (Math.PI * 2 / 12) + Math.PI / 12;
      var l2cx = sx + 10 + Math.cos(ang2) * 7;
      var l2cy = sy + 18 + Math.sin(ang2) * 7;
      manelobe(l2cx, l2cy, ang2 + Math.PI / 2, 7, 4.4, p.accent);
    }
    /* Forehead tuft over the eyes */
    c.fillStyle = p.accent;
    c.beginPath();
    c.moveTo(sx + 5, sy + 11);
    c.quadraticCurveTo(sx + 10, sy + 6,  sx + 15, sy + 11);
    c.quadraticCurveTo(sx + 14, sy + 13, sx + 6,  sy + 13);
    c.closePath();
    c.fill();
    /* Tufted ears */
    c.fillStyle = p.shade;
    c.beginPath(); c.arc(sx + 3, sy + 9, 2.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 17, sy + 9, 2.8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff0d4';
    c.beginPath(); c.arc(sx + 3, sy + 9, 1.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 17, sy + 9, 1.4, 0, Math.PI * 2); c.fill();
    /* Snout — wider, with chin shadow */
    c.fillStyle = '#fff0d4';
    c.beginPath(); c.ellipse(sx + 7, sy + 22, 5, 4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.shade;
    c.beginPath(); c.ellipse(sx + 7, sy + 24, 4, 1.4, 0, 0, Math.PI * 2); c.fill();
    /* Nose with highlight */
    c.fillStyle = '#1a1a1a';
    c.beginPath();
    c.moveTo(sx + 4, sy + 20);
    c.lineTo(sx + 7, sy + 22);
    c.lineTo(sx + 4, sy + 23);
    c.closePath();
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 5, sy + 21, 0.4, 0, Math.PI * 2); c.fill();
    /* Mouth line */
    c.strokeStyle = p.shade; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx + 5, sy + 23.5);
    c.quadraticCurveTo(sx + 7, sy + 25, sx + 9, sy + 23.5);
    c.stroke();
    /* Eyes (bigger, with eyelid line) */
    eye(c, sx + 8,  sy + 16, 1.8);
    eye(c, sx + 14, sy + 16, 1.6);
    c.strokeStyle = p.shade; c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(sx + 6, sy + 14.5); c.quadraticCurveTo(sx + 8, sy + 14, sx + 10, sy + 14.5);
    c.moveTo(sx + 12, sy + 14.5); c.quadraticCurveTo(sx + 14, sy + 14, sx + 16, sy + 14.5);
    c.stroke();
    /* Tufted tail tip */
    c.fillStyle = p.accent;
    c.beginPath(); c.arc(sx + 44, sy + 24, 3.5, 0, Math.PI * 2); c.fill();
  }

  function drawTigerSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.tiger;
    drawCreatureBase(c, sx, sy, p.body, p.shade);
    /* Bold body stripes — irregular shapes hand-laid for a real-tiger look */
    c.fillStyle = p.accent;
    var stripes = [
      /* [x, y, w, h, rot] */
      [12, 16, 1.6, 8, 0.05], [16, 17, 1.4, 9, -0.05], [20, 16, 1.8, 10, 0.05],
      [24, 17, 1.4, 9, -0.05], [28, 16, 1.6, 10, 0.05], [32, 17, 1.4, 8, -0.05],
      [14, 30, 1.6, 8, 0.0], [22, 32, 1.6, 9, 0.05], [30, 30, 1.6, 8, 0.0],
    ];
    for (var ts = 0; ts < stripes.length; ts++) {
      var st = stripes[ts];
      c.save();
      c.translate(sx + st[0], sy + st[1]);
      c.rotate(st[4] || 0);
      c.fillRect(-st[2] / 2, 0, st[2], st[3]);
      c.restore();
    }
    /* Forehead chevron stripes */
    c.beginPath();
    c.moveTo(sx + 8, sy + 8); c.lineTo(sx + 10, sy + 14); c.lineTo(sx + 12, sy + 8);
    c.lineTo(sx + 11, sy + 8); c.lineTo(sx + 10, sy + 12); c.lineTo(sx + 9, sy + 8);
    c.closePath(); c.fill();
    /* Ears with pink inner */
    c.fillStyle = p.body;
    c.beginPath(); c.arc(sx + 3, sy + 9, 2.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 17, sy + 9, 2.8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff99aa';
    c.beginPath(); c.arc(sx + 3, sy + 9, 1.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 17, sy + 9, 1.4, 0, Math.PI * 2); c.fill();
    /* White cheek tufts */
    c.fillStyle = '#fff0d8';
    c.beginPath(); c.ellipse(sx + 6, sy + 22, 5, 4, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 14, sy + 22, 5, 4, 0, 0, Math.PI * 2); c.fill();
    /* Pink nose with vertical line */
    c.fillStyle = '#ff99aa';
    c.beginPath();
    c.moveTo(sx + 8, sy + 19);
    c.lineTo(sx + 12, sy + 19);
    c.lineTo(sx + 10, sy + 21);
    c.closePath();
    c.fill();
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(sx + 10, sy + 21); c.lineTo(sx + 10, sy + 24); c.stroke();
    /* Mouth */
    c.beginPath();
    c.moveTo(sx + 10, sy + 24);
    c.quadraticCurveTo(sx + 7, sy + 25, sx + 5, sy + 23);
    c.moveTo(sx + 10, sy + 24);
    c.quadraticCurveTo(sx + 13, sy + 25, sx + 15, sy + 23);
    c.stroke();
    /* Whiskers */
    c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(sx + 5, sy + 23); c.lineTo(sx - 3, sy + 22);
    c.moveTo(sx + 5, sy + 24); c.lineTo(sx - 3, sy + 24);
    c.moveTo(sx + 15, sy + 23); c.lineTo(sx + 23, sy + 22);
    c.moveTo(sx + 15, sy + 24); c.lineTo(sx + 23, sy + 24);
    c.stroke();
    /* Amber eyes */
    realEye(c, sx + 8,  sy + 16, 1.8, '#d8881a');
    realEye(c, sx + 14, sy + 16, 1.6, '#d8881a');
    /* Paws with claws */
    c.fillStyle = '#fff0d8';
    c.fillRect(sx + 10, sy + 44, 4, 1);
    c.fillRect(sx + 30, sy + 44, 4, 1);
    /* Tail with stripes */
    c.fillStyle = p.body;
    c.beginPath();
    c.moveTo(sx + 38, sy + 24);
    c.quadraticCurveTo(sx + 56, sy + 18, sx + 52, sy + 36);
    c.quadraticCurveTo(sx + 50, sy + 28, sx + 38, sy + 28);
    c.closePath();
    c.fill();
    c.fillStyle = p.accent;
    for (var tt = 0; tt < 4; tt++) {
      c.fillRect(sx + 42 + tt * 3, sy + 22, 1.4, 4);
    }
  }

  function drawBearSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.bear;
    drawCreatureBase(c, sx, sy, p.body, p.shade);
    /* Fur shading streaks across body */
    c.save();
    c.globalAlpha = 0.3;
    c.strokeStyle = p.shade; c.lineWidth = 0.7;
    for (var bf = 0; bf < 8; bf++) {
      c.beginPath();
      c.moveTo(sx + 8 + bf * 4, sy + 22);
      c.lineTo(sx + 9 + bf * 4, sy + 30);
      c.stroke();
    }
    c.restore();
    /* Round ears with pink inner */
    c.fillStyle = p.shade;
    c.beginPath(); c.arc(sx + 3, sy + 10, 3.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 17, sy + 10, 3.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff99aa';
    c.beginPath(); c.arc(sx + 3, sy + 10, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 17, sy + 10, 1.6, 0, Math.PI * 2); c.fill();
    /* Cream snout */
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(sx + 8, sy + 22, 6, 4, 0, 0, Math.PI * 2); c.fill();
    /* Black nose with highlight */
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.ellipse(sx + 5, sy + 21, 1.6, 1.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fafafa';
    c.beginPath(); c.arc(sx + 4.6, sy + 20.6, 0.5, 0, Math.PI * 2); c.fill();
    /* Mouth */
    c.strokeStyle = p.shade; c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(sx + 5, sy + 22.6); c.lineTo(sx + 5, sy + 24);
    c.moveTo(sx + 5, sy + 24); c.quadraticCurveTo(sx + 3, sy + 25.4, sx + 1, sy + 24);
    c.moveTo(sx + 5, sy + 24); c.quadraticCurveTo(sx + 7, sy + 25.4, sx + 9, sy + 24);
    c.stroke();
    /* Eyes — warm brown */
    realEye(c, sx + 8,  sy + 16, 1.8, '#5a3018');
    realEye(c, sx + 14, sy + 16, 1.6, '#5a3018');
    /* Eyebrow tufts */
    c.fillStyle = p.shade;
    c.fillRect(sx + 6, sy + 13.5, 3, 1);
    c.fillRect(sx + 13, sy + 13.5, 3, 1);
    /* Honey pot prop on the ground */
    c.fillStyle = '#caa040';
    c.beginPath();
    c.moveTo(sx + 30, sy + 38);
    c.lineTo(sx + 28, sy + 46);
    c.lineTo(sx + 38, sy + 46);
    c.lineTo(sx + 36, sy + 38);
    c.closePath();
    c.fill();
    c.fillStyle = '#3a2010';
    c.fillRect(sx + 28, sy + 38, 10, 1.4);
    c.fillStyle = '#fff8c0';
    c.beginPath(); c.arc(sx + 33, sy + 39, 1.4, 0, Math.PI * 2); c.fill();
    /* Paw claws */
    c.fillStyle = '#3a2010';
    for (var bcl = 0; bcl < 3; bcl++) {
      c.fillRect(sx + 11 + bcl * 1.4, sy + 43.5, 0.6, 1.6);
      c.fillRect(sx + 31 + bcl * 1.4, sy + 43.5, 0.6, 1.6);
    }
  }

  function drawWolfSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.wolf;
    drawCreatureBase(c, sx, sy, p.body, p.shade);
    /* Fur shading on back */
    c.save();
    c.globalAlpha = 0.4;
    c.strokeStyle = p.shade; c.lineWidth = 0.8;
    for (var wf = 0; wf < 7; wf++) {
      c.beginPath();
      c.moveTo(sx + 10 + wf * 4, sy + 18);
      c.lineTo(sx + 12 + wf * 4, sy + 24);
      c.stroke();
    }
    c.restore();
    /* Tall pointy ears (triangular) with pink inner */
    c.fillStyle = p.shade;
    c.beginPath(); c.moveTo(sx + 0, sy + 12); c.lineTo(sx + 5, sy + 0); c.lineTo(sx + 8, sy + 12); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(sx + 12, sy + 12); c.lineTo(sx + 17, sy + 0); c.lineTo(sx + 20, sy + 12); c.closePath(); c.fill();
    c.fillStyle = '#ff99aa';
    c.beginPath(); c.moveTo(sx + 3, sy + 11); c.lineTo(sx + 5, sy + 5); c.lineTo(sx + 7, sy + 11); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(sx + 15, sy + 11); c.lineTo(sx + 17, sy + 5); c.lineTo(sx + 19, sy + 11); c.closePath(); c.fill();
    /* Long pointy snout */
    c.fillStyle = p.body;
    c.beginPath();
    c.moveTo(sx + 8, sy + 18);
    c.lineTo(sx - 4, sy + 22);
    c.lineTo(sx + 8, sy + 26);
    c.closePath();
    c.fill();
    /* White muzzle underside */
    c.fillStyle = p.accent;
    c.beginPath();
    c.moveTo(sx + 8, sy + 22);
    c.lineTo(sx - 4, sy + 23);
    c.lineTo(sx + 8, sy + 26);
    c.closePath();
    c.fill();
    /* Nose */
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.ellipse(sx - 3, sy + 22, 1.6, 1.2, 0, 0, Math.PI * 2); c.fill();
    /* Mouth — wolf-like with visible fang */
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx - 3, sy + 22); c.lineTo(sx + 4, sy + 25);
    c.stroke();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(sx + 1, sy + 25); c.lineTo(sx + 2.5, sy + 27); c.lineTo(sx + 4, sy + 25);
    c.closePath();
    c.fill();
    /* Yellow eyes (predator) */
    realEye(c, sx + 8,  sy + 16, 1.6, '#caa030');
    realEye(c, sx + 14, sy + 16, 1.4, '#caa030');
    /* Eyebrow ridges */
    c.fillStyle = p.shade;
    c.fillRect(sx + 6, sy + 13.5, 3, 0.8);
    c.fillRect(sx + 13, sy + 13.5, 3, 0.8);
    /* Bushy tail with white tip */
    c.fillStyle = p.body;
    c.beginPath();
    c.moveTo(sx + 38, sy + 24);
    c.bezierCurveTo(sx + 56, sy + 16, sx + 58, sy + 30, sx + 50, sy + 32);
    c.quadraticCurveTo(sx + 44, sy + 28, sx + 38, sy + 28);
    c.closePath();
    c.fill();
    c.fillStyle = p.accent;
    c.beginPath(); c.arc(sx + 54, sy + 22, 3, 0, Math.PI * 2); c.fill();
  }

  function drawGiraffeSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.giraffe;
    var BODY = p.body;
    var SHADE = p.shade;
    var DARK = '#5a3a14';
    /* Drop shadow */
    c.save(); c.globalAlpha = 0.25; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(sx + 28, sy + 44, 18, 3, 0, 0, Math.PI * 2); c.fill();
    c.restore();

    /* Tail (drawn before body so it tucks behind) */
    c.strokeStyle = SHADE; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(sx + 42, sy + 22); c.quadraticCurveTo(sx + 47, sy + 28, sx + 46, sy + 36); c.stroke();
    c.fillStyle = DARK;
    c.beginPath(); c.arc(sx + 46, sy + 37, 1.8, 0, Math.PI * 2); c.fill();

    /* Four long, slim legs (giraffes are leggy) */
    c.fillStyle = BODY;
    c.fillRect(sx + 14, sy + 26, 3, 18);
    c.fillRect(sx + 20, sy + 26, 3, 18);
    c.fillRect(sx + 32, sy + 26, 3, 18);
    c.fillRect(sx + 38, sy + 26, 3, 18);
    /* Knee joints (slightly darker bands) */
    c.fillStyle = SHADE;
    c.fillRect(sx + 14, sy + 33, 3, 1.4);
    c.fillRect(sx + 20, sy + 33, 3, 1.4);
    c.fillRect(sx + 32, sy + 33, 3, 1.4);
    c.fillRect(sx + 38, sy + 33, 3, 1.4);
    /* Hooves */
    c.fillStyle = DARK;
    c.fillRect(sx + 13.6, sy + 43, 3.8, 1.8);
    c.fillRect(sx + 19.6, sy + 43, 3.8, 1.8);
    c.fillRect(sx + 31.6, sy + 43, 3.8, 1.8);
    c.fillRect(sx + 37.6, sy + 43, 3.8, 1.8);

    /* Body — barrel-shaped (rectangular oval, not round). Slimmer than
       the previous version so the long-legs / long-neck silhouette
       reads clearly. */
    var bg = c.createLinearGradient(0, sy + 16, 0, sy + 30);
    bg.addColorStop(0, BODY); bg.addColorStop(1, SHADE);
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(sx + 28, sy + 22, 16, 8, 0, 0, Math.PI * 2); c.fill();

    /* Long curved neck — thinner at top, wider at body. Sweeps slightly
       forward (left) like a real giraffe at rest. */
    c.fillStyle = BODY;
    c.beginPath();
    c.moveTo(sx + 14, sy + 22);
    c.lineTo(sx + 8,  sy - 16);
    c.lineTo(sx + 14, sy - 18);
    c.lineTo(sx + 20, sy + 18);
    c.closePath();
    c.fill();

    /* Small giraffe head — tilted slightly, with elongated muzzle */
    c.fillStyle = BODY;
    c.beginPath(); c.ellipse(sx + 8, sy - 20, 7, 4, -0.15, 0, Math.PI * 2); c.fill();
    /* Muzzle / snout protrudes left */
    c.fillStyle = SHADE;
    c.beginPath(); c.ellipse(sx + 1.5, sy - 18.5, 3.5, 2.6, -0.15, 0, Math.PI * 2); c.fill();

    /* Ossicones (giraffe horns) — small stalks with fuzzy tips */
    c.fillStyle = SHADE;
    c.fillRect(sx + 7, sy - 28, 1.4, 6);
    c.fillRect(sx + 12, sy - 28, 1.4, 6);
    c.fillStyle = DARK;
    c.beginPath(); c.arc(sx + 7.7,  sy - 29, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 12.7, sy - 29, 1.6, 0, Math.PI * 2); c.fill();

    /* Ears — elongated leaf-shaped, sticking sideways */
    c.fillStyle = BODY;
    c.beginPath(); c.ellipse(sx + 1, sy - 22, 3.2, 1.6, -0.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 15, sy - 22, 3.2, 1.6, 0.6, 0, Math.PI * 2); c.fill();
    /* Inner ear pink */
    c.fillStyle = '#cc9988';
    c.beginPath(); c.ellipse(sx + 1, sy - 22, 1.8, 0.8, -0.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 15, sy - 22, 1.8, 0.8, 0.6, 0, Math.PI * 2); c.fill();

    /* Mane — short bristle stripe along the back of the neck */
    c.fillStyle = DARK;
    for (var gm = 0; gm < 9; gm++) {
      var my = sy - 16 + gm * 4.2;
      c.fillRect(sx + 18 - gm * 0.4, my, 1.6, 2.4);
    }

    /* ---- Spots ---- Irregular giraffe patches as polygonal shapes (not
       circles) so they read as the trademark giraffe pattern.  Clipped
       to the body + neck silhouette so they don't bleed into the empty
       canvas around the animal. */
    c.fillStyle = SHADE;
    function patch(cx, cy, r, sides) {
      c.beginPath();
      for (var i = 0; i < sides; i++) {
        var a = (i / sides) * Math.PI * 2 + (cx * 0.3);
        var rr = r * (0.78 + 0.22 * Math.sin(cx + cy + i));
        var px = cx + Math.cos(a) * rr;
        var py = cy + Math.sin(a) * rr;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
      c.fill();
    }
    /* Body patches */
    c.save();
    c.beginPath(); c.ellipse(sx + 28, sy + 22, 16, 8, 0, 0, Math.PI * 2); c.clip();
    patch(sx + 18, sy + 20, 3.4, 6);
    patch(sx + 25, sy + 17, 3.0, 5);
    patch(sx + 32, sy + 21, 3.4, 6);
    patch(sx + 38, sy + 19, 2.8, 5);
    patch(sx + 22, sy + 26, 2.8, 6);
    patch(sx + 30, sy + 27, 3.0, 5);
    patch(sx + 38, sy + 26, 2.4, 5);
    c.restore();

    /* Neck patches */
    c.save();
    c.beginPath();
    c.moveTo(sx + 14, sy + 22);
    c.lineTo(sx + 8,  sy - 16);
    c.lineTo(sx + 14, sy - 18);
    c.lineTo(sx + 20, sy + 18);
    c.closePath();
    c.clip();
    patch(sx + 13, sy + 14, 2.4, 5);
    patch(sx + 11, sy + 4,  2.2, 5);
    patch(sx + 14, sy - 4,  2.0, 5);
    patch(sx + 12, sy - 12, 1.8, 5);
    c.restore();

    /* Leg patches — small triangle on each upper leg */
    c.fillStyle = SHADE;
    c.fillRect(sx + 14, sy + 28, 3, 2);
    c.fillRect(sx + 20, sy + 28, 3, 2);
    c.fillRect(sx + 32, sy + 28, 3, 2);
    c.fillRect(sx + 38, sy + 28, 3, 2);

    /* Eye + lashes */
    realEye(c, sx + 9, sy - 19, 1.4, '#3a2010');
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(sx + 8.4, sy - 21); c.lineTo(sx + 7.8, sy - 22);
    c.moveTo(sx + 9.2, sy - 21.4); c.lineTo(sx + 9, sy - 22.4);
    c.stroke();

    /* Nostril + mouth on muzzle */
    c.fillStyle = '#3a2010';
    c.beginPath(); c.arc(sx + 0.5, sy - 18, 0.5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#7a3838'; c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(sx, sy - 16);
    c.quadraticCurveTo(sx + 1.4, sy - 15.4, sx + 2.6, sy - 16);
    c.stroke();
  }

  function drawZebraSprite(c, sx, sy) {
    /* Chibi/cartoon zebra. Bigger head, bigger eye, body proportions
       closer to a cute children's-book zebra than to anatomical
       reference. The brief from the player: previous attempts read
       as "stocky pony with bars painted on" — this one leans into
       the cartoon and emphasizes the iconic zebra silhouette: oversized
       round head + mohawk mane + bold curving stripes with real white
       between. */
    var WHITE = '#fafafa';
    var BLACK = '#181818';
    var GRAY  = '#dadada';

    /* Drop shadow */
    c.save(); c.globalAlpha = 0.32; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(sx + 26, sy + 44, 18, 3, 0, 0, Math.PI * 2); c.fill();
    c.restore();

    /* ---- Legs (4 slim, drawn first so body covers tops) ---- */
    c.fillStyle = WHITE;
    c.fillRect(sx + 16, sy + 30, 3, 12);
    c.fillRect(sx + 21, sy + 30, 3, 12);
    c.fillRect(sx + 32, sy + 30, 3, 12);
    c.fillRect(sx + 37, sy + 30, 3, 12);
    c.fillStyle = BLACK;
    c.fillRect(sx + 15.5, sy + 41.5, 4, 2.5);
    c.fillRect(sx + 20.5, sy + 41.5, 4, 2.5);
    c.fillRect(sx + 31.5, sy + 41.5, 4, 2.5);
    c.fillRect(sx + 36.5, sy + 41.5, 4, 2.5);

    /* ---- Tail (drawn behind body) ---- */
    c.strokeStyle = WHITE; c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(sx + 42, sy + 24);
    c.quadraticCurveTo(sx + 48, sy + 32, sx + 45, sy + 40);
    c.stroke();
    c.fillStyle = BLACK;
    c.beginPath(); c.ellipse(sx + 45, sy + 41, 2.4, 3.4, 0, 0, Math.PI * 2); c.fill();

    /* ---- Body ---- rounder than before so it reads as the chunky
       barrel of a stylized zebra, not a flat plank. */
    var bodyCX = sx + 28, bodyCY = sy + 25, bodyRX = 14, bodyRY = 9;
    var bodyG = c.createLinearGradient(0, bodyCY - bodyRY, 0, bodyCY + bodyRY);
    bodyG.addColorStop(0, WHITE); bodyG.addColorStop(1, GRAY);
    c.fillStyle = bodyG;
    c.beginPath(); c.ellipse(bodyCX, bodyCY, bodyRX, bodyRY, 0, 0, Math.PI * 2); c.fill();

    /* ---- Neck ---- chunky tapered trapezoid connecting head to body */
    c.fillStyle = WHITE;
    c.beginPath();
    c.moveTo(sx + 14, sy + 26);   /* lower neck attachment */
    c.lineTo(sx + 12, sy + 14);   /* upper-left back of neck */
    c.lineTo(sx + 19, sy + 12);   /* upper-right top of neck */
    c.lineTo(sx + 19, sy + 24);   /* lower neck front */
    c.closePath();
    c.fill();

    /* ---- Big chibi head ---- a rounded shape with prominent muzzle.
       Significantly bigger than v0.8.1 (~14×12 vs ~12×8) so the face
       reads at the small in-game scale. */
    /* Cheek/jowl */
    c.beginPath(); c.ellipse(sx + 12, sy + 16, 7, 6, 0, 0, Math.PI * 2); c.fill();
    /* Forehead/dome */
    c.beginPath(); c.ellipse(sx + 11, sy + 11, 5.5, 4.5, 0, 0, Math.PI * 2); c.fill();
    /* Long muzzle pushing left */
    c.beginPath(); c.ellipse(sx + 4, sy + 16, 7, 4.5, -0.15, 0, Math.PI * 2); c.fill();

    /* Pink soft muzzle tip */
    c.fillStyle = '#cca8a0';
    c.beginPath(); c.ellipse(sx - 1.5, sy + 15.5, 2.4, 2.0, -0.15, 0, Math.PI * 2); c.fill();

    /* ---- Ears ---- larger rounded triangles, leaning slightly back */
    c.fillStyle = WHITE;
    c.beginPath();
    c.moveTo(sx + 8,  sy + 4);
    c.bezierCurveTo(sx + 6, sy + 9, sx + 8, sy + 11, sx + 11, sy + 9);
    c.lineTo(sx + 10, sy + 5);
    c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(sx + 14, sy + 4);
    c.bezierCurveTo(sx + 12, sy + 9, sx + 14, sy + 11, sx + 17, sy + 9);
    c.lineTo(sx + 16, sy + 5);
    c.closePath(); c.fill();
    /* Pink inner ear */
    c.fillStyle = '#cc8899';
    c.beginPath();
    c.moveTo(sx + 9, sy + 6);
    c.bezierCurveTo(sx + 7.5, sy + 9, sx + 9, sy + 10.5, sx + 10.5, sy + 9);
    c.closePath(); c.fill();

    /* ============================================================
     *                          STRIPES
     * ============================================================ */
    c.fillStyle = BLACK;

    /* Body — bold vertical bands with REAL WHITE between. Each stripe
       is a thin capsule, rotated slightly, clipped to body silhouette.
       5 bands with even gaps so the white actually shows. */
    c.save();
    c.beginPath();
    c.ellipse(bodyCX, bodyCY, bodyRX, bodyRY, 0, 0, Math.PI * 2);
    c.clip();
    var stripeXs = [17, 22, 27, 32, 37];
    var stripeRots = [-0.30, -0.12, 0.04, 0.18, 0.34];
    for (var si = 0; si < stripeXs.length; si++) {
      c.save();
      c.translate(sx + stripeXs[si], bodyCY);
      c.rotate(stripeRots[si]);
      c.fillRect(-1.4, -bodyRY - 2, 2.8, bodyRY * 2 + 4);
      c.restore();
    }
    c.restore();

    /* Neck — 2 diagonal bands clipped to neck shape. Fewer than the
       previous 3 so the chest doesn't fuse to a black blob where the
       neck meets the body. */
    c.save();
    c.beginPath();
    c.moveTo(sx + 14, sy + 26);
    c.lineTo(sx + 12, sy + 14);
    c.lineTo(sx + 19, sy + 12);
    c.lineTo(sx + 19, sy + 24);
    c.closePath();
    c.clip();
    for (var ni = 0; ni < 2; ni++) {
      c.save();
      c.translate(sx + 14 + ni * 3.5, sy + 18);
      c.rotate(-0.18);
      c.fillRect(-1.4, -10, 2.6, 20);
      c.restore();
    }
    c.restore();

    /* Head — 2 face stripes (forehead-to-cheek + jaw) */
    c.save();
    c.beginPath();
    c.ellipse(sx + 12, sy + 16, 7, 6, 0, 0, Math.PI * 2);
    c.ellipse(sx + 11, sy + 11, 5.5, 4.5, 0, 0, Math.PI * 2);
    c.clip();
    c.fillRect(sx + 13.5, sy + 7, 2,   12);
    c.fillRect(sx + 8,    sy + 9, 1.6, 10);
    c.restore();

    /* Muzzle stripes */
    c.save();
    c.beginPath();
    c.ellipse(sx + 4, sy + 16, 7, 4.5, -0.15, 0, Math.PI * 2);
    c.clip();
    c.fillRect(sx + 4, sy + 11, 1.6, 10);
    c.fillRect(sx + 1, sy + 12, 1.4, 8);
    c.restore();

    /* Legs — chunky ladder bands */
    function legB(lx, ly) { c.fillRect(sx + lx, sy + ly, 3, 1.6); }
    [16, 21, 32, 37].forEach(function (lx) {
      legB(lx, 32); legB(lx, 36); legB(lx, 40);
    });

    /* ---- Mohawk mane ---- prominent, standing UP along the back of
       the neck, with each bristle slightly different size for an
       organic feel. */
    var maneSpikes = [
      [13, 11, 4], [14.5, 9, 5], [16, 8, 6], [17.5, 8, 6],
      [19, 9, 5], [20.5, 11, 4],
    ];
    for (var mi = 0; mi < maneSpikes.length; mi++) {
      var ms = maneSpikes[mi];
      c.beginPath();
      c.moveTo(sx + ms[0],     sy + ms[1] + 2);
      c.lineTo(sx + ms[0] + 1, sy + ms[1] - ms[2]);
      c.lineTo(sx + ms[0] + 2, sy + ms[1] + 2);
      c.closePath();
      c.fill();
    }
    /* Forelock — tuft between ears */
    c.beginPath();
    c.moveTo(sx + 12, sy + 6);
    c.lineTo(sx + 12.5, sy + 1.5);
    c.lineTo(sx + 13.5, sy + 6);
    c.closePath(); c.fill();

    /* ============================================================
     *                       BIG CHIBI EYE
     * ============================================================ */
    /* Big white sclera background */
    c.fillStyle = WHITE;
    c.beginPath(); c.ellipse(sx + 9.5, sy + 14, 2.6, 2.8, 0, 0, Math.PI * 2); c.fill();
    /* Iris — dark brown */
    c.fillStyle = '#3a2418';
    c.beginPath(); c.arc(sx + 9.3, sy + 14.2, 1.8, 0, Math.PI * 2); c.fill();
    /* Pupil */
    c.fillStyle = BLACK;
    c.beginPath(); c.arc(sx + 9.3, sy + 14.2, 1.0, 0, Math.PI * 2); c.fill();
    /* Highlight */
    c.fillStyle = WHITE;
    c.beginPath(); c.arc(sx + 9.8, sy + 13.6, 0.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 8.9, sy + 14.6, 0.3, 0, Math.PI * 2); c.fill();

    /* Eyelash flick (top of eye) */
    c.strokeStyle = BLACK; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx + 7.4, sy + 12);
    c.lineTo(sx + 7,   sy + 11);
    c.stroke();

    /* Nostril */
    c.fillStyle = '#3a2018';
    c.beginPath(); c.arc(sx - 1.6, sy + 15, 0.6, 0, Math.PI * 2); c.fill();
    /* Mouth — curved smile under the muzzle */
    c.strokeStyle = '#7a4040'; c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(sx - 2,  sy + 17.5);
    c.quadraticCurveTo(sx, sy + 18.6, sx + 2, sy + 17.4);
    c.stroke();
  }

  function drawEagleSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.eagle;
    /* Drop shadow */
    c.save(); c.globalAlpha = 0.25; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(sx + 22, sy + 46, 18, 3, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Body — gradient brown */
    var bg = c.createLinearGradient(0, sy + 18, 0, sy + 40);
    bg.addColorStop(0, p.body); bg.addColorStop(1, p.shade);
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(sx + 22, sy + 30, 18, 13, 0, 0, Math.PI * 2); c.fill();
    /* Layered feathers across the body */
    c.fillStyle = p.shade;
    for (var ef = 0; ef < 5; ef++) {
      c.beginPath();
      c.ellipse(sx + 12 + ef * 4, sy + 32, 4, 6, 0.2, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = p.body;
    for (var ef2 = 0; ef2 < 5; ef2++) {
      c.beginPath();
      c.ellipse(sx + 14 + ef2 * 4, sy + 34, 3, 5, 0.2, 0, Math.PI * 2);
      c.fill();
    }
    /* White head */
    c.fillStyle = '#fafafa';
    c.beginPath(); c.arc(sx + 10, sy + 14, 11, 0, Math.PI * 2); c.fill();
    /* Soft head shadow */
    c.fillStyle = '#e0e0e0';
    c.beginPath(); c.arc(sx + 10, sy + 18, 8, 0.05, Math.PI - 0.05); c.fill();
    /* Hooked beak */
    c.fillStyle = p.accent;
    c.beginPath();
    c.moveTo(sx - 4, sy + 16);
    c.lineTo(sx + 6, sy + 12);
    c.lineTo(sx + 6, sy + 22);
    c.lineTo(sx, sy + 22);
    c.lineTo(sx + 1, sy + 18);
    c.closePath();
    c.fill();
    c.fillStyle = '#a07820';
    c.beginPath();
    c.moveTo(sx - 4, sy + 16);
    c.lineTo(sx + 0, sy + 18);
    c.lineTo(sx + 1, sy + 16);
    c.closePath();
    c.fill();
    /* Beak nostril */
    c.fillStyle = '#5a4010';
    c.beginPath(); c.arc(sx + 2, sy + 16, 0.4, 0, Math.PI * 2); c.fill();
    /* Fierce yellow eyes with brow */
    realEye(c, sx + 12, sy + 14, 1.8, '#caa030');
    c.strokeStyle = '#3a2010'; c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(sx + 8, sy + 11); c.lineTo(sx + 16, sy + 12);
    c.stroke();
    /* Tucked wing detail */
    c.fillStyle = p.shade;
    c.beginPath();
    c.moveTo(sx + 22, sy + 18);
    c.bezierCurveTo(sx + 36, sy + 18, sx + 42, sy + 32, sx + 36, sy + 36);
    c.lineTo(sx + 22, sy + 30);
    c.closePath();
    c.fill();
    /* Wing primaries */
    c.fillStyle = '#3a2010';
    for (var ew = 0; ew < 5; ew++) {
      var ang = -0.6 + ew * 0.15;
      c.save();
      c.translate(sx + 36, sy + 26);
      c.rotate(ang);
      c.fillRect(0, 0, 1.2, 12);
      c.restore();
    }
    /* Talons + tan legs */
    c.fillStyle = '#caa040';
    c.fillRect(sx + 12, sy + 40, 2, 4);
    c.fillRect(sx + 24, sy + 40, 2, 4);
    c.fillStyle = '#3a2010';
    /* Three claws each */
    for (var et = 0; et < 3; et++) {
      c.fillRect(sx + 11 + et * 1.2, sy + 44, 0.8, 2.4);
      c.fillRect(sx + 23 + et * 1.2, sy + 44, 0.8, 2.4);
    }
    /* Tail feathers */
    c.fillStyle = p.shade;
    c.beginPath();
    c.moveTo(sx + 36, sy + 32);
    c.lineTo(sx + 46, sy + 36);
    c.lineTo(sx + 46, sy + 42);
    c.lineTo(sx + 36, sy + 38);
    c.closePath();
    c.fill();
    c.strokeStyle = p.body; c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(sx + 38, sy + 33); c.lineTo(sx + 46, sy + 38);
    c.moveTo(sx + 38, sy + 35); c.lineTo(sx + 46, sy + 39);
    c.moveTo(sx + 38, sy + 37); c.lineTo(sx + 46, sy + 41);
    c.stroke();
  }

  function drawFoxSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.fox;
    drawCreatureBase(c, sx, sy, p.body, p.shade);
    /* White chest bib */
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(sx + 22, sy + 34, 11, 6, 0, 0, Math.PI * 2); c.fill();
    /* Pointy ears with black tips and pink inner */
    c.fillStyle = p.body;
    c.beginPath(); c.moveTo(sx - 1, sy + 12); c.lineTo(sx + 4, sy - 2); c.lineTo(sx + 9, sy + 12); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(sx + 11, sy + 12); c.lineTo(sx + 16, sy - 2); c.lineTo(sx + 21, sy + 12); c.closePath(); c.fill();
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.moveTo(sx + 2, sy + 12); c.lineTo(sx + 4, sy + 4); c.lineTo(sx + 6, sy + 12); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(sx + 14, sy + 12); c.lineTo(sx + 16, sy + 4); c.lineTo(sx + 18, sy + 12); c.closePath(); c.fill();
    c.fillStyle = '#ff99aa';
    c.beginPath(); c.moveTo(sx + 3, sy + 11); c.lineTo(sx + 4, sy + 7); c.lineTo(sx + 5, sy + 11); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(sx + 15, sy + 11); c.lineTo(sx + 16, sy + 7); c.lineTo(sx + 17, sy + 11); c.closePath(); c.fill();
    /* Pointed snout */
    c.fillStyle = p.body;
    c.beginPath();
    c.moveTo(sx + 8, sy + 18);
    c.lineTo(sx - 2, sy + 22);
    c.lineTo(sx + 8, sy + 26);
    c.closePath();
    c.fill();
    /* White muzzle */
    c.fillStyle = p.accent;
    c.beginPath();
    c.moveTo(sx + 8, sy + 22);
    c.lineTo(sx - 2, sy + 23);
    c.lineTo(sx + 8, sy + 26);
    c.closePath();
    c.fill();
    /* Nose */
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.ellipse(sx - 1, sy + 22, 1.4, 1, 0, 0, Math.PI * 2); c.fill();
    /* Mouth */
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx - 1, sy + 22); c.lineTo(sx + 4, sy + 25);
    c.stroke();
    /* Sly amber eyes */
    realEye(c, sx + 8,  sy + 16, 1.6, '#a04020');
    realEye(c, sx + 14, sy + 16, 1.4, '#a04020');
    /* Whiskers */
    c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(sx, sy + 23); c.lineTo(sx - 6, sy + 22);
    c.moveTo(sx, sy + 24); c.lineTo(sx - 6, sy + 25);
    c.stroke();
    /* Big bushy tail with white tip */
    c.fillStyle = p.body;
    c.beginPath();
    c.moveTo(sx + 38, sy + 24);
    c.bezierCurveTo(sx + 58, sy + 12, sx + 60, sy + 30, sx + 50, sy + 32);
    c.quadraticCurveTo(sx + 44, sy + 28, sx + 38, sy + 28);
    c.closePath();
    c.fill();
    /* Tail fur lines */
    c.strokeStyle = p.shade; c.lineWidth = 0.6;
    for (var ft = 0; ft < 5; ft++) {
      c.beginPath();
      c.moveTo(sx + 42 + ft * 3, sy + 22);
      c.lineTo(sx + 44 + ft * 3, sy + 28);
      c.stroke();
    }
    c.fillStyle = p.accent;
    c.beginPath(); c.arc(sx + 56, sy + 18, 4, 0, Math.PI * 2); c.fill();
    /* Black socks on legs */
    c.fillStyle = '#1a1a1a';
    c.fillRect(sx + 10, sy + 42, 4, 3);
    c.fillRect(sx + 30, sy + 42, 4, 3);
  }

  function drawOwlSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.owl;
    /* Drop shadow */
    c.save(); c.globalAlpha = 0.25; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(sx + 22, sy + 46, 14, 3, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Body — pear shape with gradient */
    var bg = c.createLinearGradient(0, sy + 8, 0, sy + 44);
    bg.addColorStop(0, p.body); bg.addColorStop(1, p.shade);
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(sx + 22, sy + 26, 17, 19, 0, 0, Math.PI * 2); c.fill();
    /* Layered feather scallops down the chest */
    c.fillStyle = p.shade;
    for (var of = 0; of < 4; of++) {
      var ofy = sy + 22 + of * 6;
      for (var oc = 0; oc < 4; oc++) {
        c.beginPath();
        c.arc(sx + 14 + oc * 5, ofy, 2.2, Math.PI, 0);
        c.fill();
      }
    }
    /* Cream belly highlight */
    c.fillStyle = '#fff0c0';
    c.beginPath(); c.ellipse(sx + 22, sy + 34, 7, 6, 0, 0, Math.PI * 2); c.fill();
    /* Big eye discs (cream rings) */
    c.fillStyle = '#fff8e0';
    c.beginPath(); c.arc(sx + 14, sy + 16, 7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 30, sy + 16, 7, 0, Math.PI * 2); c.fill();
    /* Disc rings */
    c.strokeStyle = p.shade; c.lineWidth = 1;
    c.beginPath(); c.arc(sx + 14, sy + 16, 7, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(sx + 30, sy + 16, 7, 0, Math.PI * 2); c.stroke();
    /* Big amber eyes with tiny pupils */
    c.fillStyle = '#caa030';
    c.beginPath(); c.arc(sx + 14, sy + 16, 4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 30, sy + 16, 4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0a0a0a';
    c.beginPath(); c.arc(sx + 14, sy + 16, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 30, sy + 16, 1.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 13.4, sy + 15.4, 0.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 29.4, sy + 15.4, 0.6, 0, Math.PI * 2); c.fill();
    /* Hooked beak */
    c.fillStyle = p.accent;
    c.beginPath();
    c.moveTo(sx + 22, sy + 20);
    c.lineTo(sx + 18, sy + 26);
    c.lineTo(sx + 22, sy + 28);
    c.lineTo(sx + 26, sy + 26);
    c.closePath();
    c.fill();
    c.fillStyle = '#a07820';
    c.beginPath();
    c.moveTo(sx + 22, sy + 20);
    c.lineTo(sx + 22, sy + 23);
    c.lineTo(sx + 26, sy + 26);
    c.closePath();
    c.fill();
    /* Ear tufts (longer + curved) */
    c.fillStyle = p.shade;
    c.beginPath();
    c.moveTo(sx + 10, sy + 12); c.lineTo(sx + 12, sy + 0); c.lineTo(sx + 14, sy + 12); c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(sx + 30, sy + 12); c.lineTo(sx + 32, sy + 0); c.lineTo(sx + 34, sy + 12); c.closePath();
    c.fill();
    /* Wings tucked at sides */
    c.fillStyle = p.shade;
    c.beginPath(); c.ellipse(sx + 8,  sy + 28, 4, 12, 0.1, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 36, sy + 28, 4, 12, -0.1, 0, Math.PI * 2); c.fill();
    /* Talons */
    c.fillStyle = p.accent;
    c.fillRect(sx + 16, sy + 42, 3, 4);
    c.fillRect(sx + 25, sy + 42, 3, 4);
    c.fillStyle = '#3a2010';
    c.fillRect(sx + 16, sy + 46, 1, 2);
    c.fillRect(sx + 18, sy + 46, 1, 2);
    c.fillRect(sx + 25, sy + 46, 1, 2);
    c.fillRect(sx + 27, sy + 46, 1, 2);
  }

  function drawPandaSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.panda;
    drawCreatureBase(c, sx, sy, p.body, '#dddddd');
    /* Big black ears with pink inner */
    c.fillStyle = p.shade;
    c.beginPath(); c.arc(sx + 1, sy + 9, 3.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 19, sy + 9, 3.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff99aa';
    c.beginPath(); c.arc(sx + 1, sy + 9, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 19, sy + 9, 1.6, 0, Math.PI * 2); c.fill();
    /* Iconic black tear-drop eye patches (slanted) */
    c.fillStyle = p.shade;
    c.beginPath();
    c.ellipse(sx + 7, sy + 16, 3.2, 4.5, -0.4, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.ellipse(sx + 15, sy + 16, 3.2, 4.5, 0.4, 0, Math.PI * 2);
    c.fill();
    /* Black arms hanging down */
    c.fillStyle = p.shade;
    c.beginPath(); c.ellipse(sx + 6,  sy + 32, 4, 8, 0.1, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 38, sy + 32, 4, 8, -0.1, 0, Math.PI * 2); c.fill();
    /* Paw highlights */
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.arc(sx + 6, sy + 38, 3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 38, sy + 38, 3, 0, Math.PI * 2); c.fill();
    /* Black saddle / shoulder band — narrow strip just behind the head
       so it reads as the panda's natural black back band, not a thick
       stripe across the body. */
    c.fillStyle = p.shade;
    c.beginPath();
    c.ellipse(sx + 19, sy + 22, 7, 2, 0, 0, Math.PI * 2);
    c.fill();
    /* White muzzle */
    c.fillStyle = '#fafafa';
    c.beginPath(); c.ellipse(sx + 11, sy + 22, 5, 4, 0, 0, Math.PI * 2); c.fill();
    /* Black nose with highlight */
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.ellipse(sx + 11, sy + 21, 1.6, 1.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fafafa';
    c.beginPath(); c.arc(sx + 10.6, sy + 20.6, 0.5, 0, Math.PI * 2); c.fill();
    /* Mouth */
    c.strokeStyle = p.shade; c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(sx + 11, sy + 22.6); c.lineTo(sx + 11, sy + 24);
    c.moveTo(sx + 11, sy + 24); c.quadraticCurveTo(sx + 9, sy + 25.4, sx + 7, sy + 24);
    c.moveTo(sx + 11, sy + 24); c.quadraticCurveTo(sx + 13, sy + 25.4, sx + 15, sy + 24);
    c.stroke();
    /* Eyes peek through patches */
    c.fillStyle = '#0a0a0a';
    c.beginPath(); c.arc(sx + 7,  sy + 16, 1.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 15, sy + 16, 1.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 6.6, sy + 15.6, 0.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 14.6, sy + 15.6, 0.5, 0, Math.PI * 2); c.fill();
    /* Bamboo stalk in hand */
    c.fillStyle = '#5a8a38';
    c.fillRect(sx + 36, sy + 32, 2, 14);
    c.fillStyle = '#7aaa48';
    c.beginPath(); c.ellipse(sx + 40, sy + 33, 4, 1.6, 0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 40, sy + 36, 4, 1.6, -0.3, 0, Math.PI * 2); c.fill();
  }

  function drawPenguinSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.penguin;
    /* Drop shadow */
    c.save(); c.globalAlpha = 0.3; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(sx + 22, sy + 46, 14, 3, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Body — pear shape with gradient */
    var bg = c.createLinearGradient(0, sy + 6, 0, sy + 46);
    bg.addColorStop(0, '#1a1a2a');
    bg.addColorStop(1, '#08081a');
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(sx + 22, sy + 28, 15, 19, 0, 0, Math.PI * 2); c.fill();
    /* White egg-shaped belly */
    c.fillStyle = '#fafafa';
    c.beginPath();
    c.ellipse(sx + 22, sy + 32, 10, 15, 0, 0, Math.PI * 2);
    c.fill();
    /* Belly soft shadow */
    c.fillStyle = '#e0e0e0';
    c.beginPath(); c.ellipse(sx + 26, sy + 36, 4, 10, 0, 0, Math.PI * 2); c.fill();
    /* Head with white face mask */
    c.fillStyle = p.body;
    c.beginPath(); c.arc(sx + 22, sy + 12, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fafafa';
    c.beginPath(); c.ellipse(sx + 22, sy + 14, 6, 5, 0, 0, Math.PI * 2); c.fill();
    /* Orange beak (two-tone) */
    c.fillStyle = p.accent;
    c.beginPath();
    c.moveTo(sx + 16, sy + 13);
    c.lineTo(sx + 10, sy + 15);
    c.lineTo(sx + 16, sy + 17);
    c.closePath();
    c.fill();
    c.fillStyle = '#a07020';
    c.beginPath();
    c.moveTo(sx + 16, sy + 17);
    c.lineTo(sx + 10, sy + 15);
    c.lineTo(sx + 14, sy + 17);
    c.closePath();
    c.fill();
    /* Beak nostril */
    c.fillStyle = '#5a4010';
    c.beginPath(); c.arc(sx + 13, sy + 15, 0.4, 0, Math.PI * 2); c.fill();
    /* Eyes */
    realEye(c, sx + 18, sy + 11, 1.6, '#0a0a0a');
    /* Pink cheek */
    c.fillStyle = 'rgba(255,150,170,0.5)';
    c.beginPath(); c.arc(sx + 22, sy + 16, 1.8, 0, Math.PI * 2); c.fill();
    /* Flipper wings */
    c.fillStyle = '#08081a';
    c.beginPath(); c.ellipse(sx + 9,  sy + 26, 3.4, 12, 0.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 35, sy + 26, 3.4, 12, -0.2, 0, Math.PI * 2); c.fill();
    /* Wing tip white spot */
    c.fillStyle = '#fafafa';
    c.beginPath(); c.arc(sx + 9,  sy + 32, 1.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 35, sy + 32, 1.4, 0, Math.PI * 2); c.fill();
    /* Feet (orange paddles) with toe lines */
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(sx + 17, sy + 45, 5, 2.4, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 27, sy + 45, 5, 2.4, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#a07020'; c.lineWidth = 0.4;
    c.beginPath();
    c.moveTo(sx + 14, sy + 46); c.lineTo(sx + 20, sy + 46);
    c.moveTo(sx + 24, sy + 46); c.lineTo(sx + 30, sy + 46);
    c.stroke();
    /* Bow tie (cute hotel touch) */
    c.fillStyle = '#cc2244';
    c.beginPath();
    c.moveTo(sx + 18, sy + 22); c.lineTo(sx + 22, sy + 24); c.lineTo(sx + 26, sy + 22);
    c.lineTo(sx + 24, sy + 25); c.lineTo(sx + 26, sy + 28); c.lineTo(sx + 22, sy + 26);
    c.lineTo(sx + 18, sy + 28); c.lineTo(sx + 20, sy + 25);
    c.closePath();
    c.fill();
  }

  function drawBunnySprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.bunny;
    drawCreatureBase(c, sx, sy, p.body, p.shade);
    /* Long upright ears with pink inner */
    c.fillStyle = p.body;
    c.beginPath(); c.ellipse(sx + 5,  sy + 2, 2.6, 10, -0.18, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 15, sy + 2, 2.6, 10, 0.18, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff99bb';
    c.beginPath(); c.ellipse(sx + 5,  sy + 3, 1.2, 7, -0.18, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 15, sy + 3, 1.2, 7, 0.18, 0, Math.PI * 2); c.fill();
    /* Soft cheek tufts */
    c.fillStyle = p.body;
    c.beginPath(); c.arc(sx + 4,  sy + 20, 3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 16, sy + 20, 3, 0, Math.PI * 2); c.fill();
    /* Triangle pink nose */
    c.fillStyle = '#ff66aa';
    c.beginPath();
    c.moveTo(sx + 8, sy + 18);
    c.lineTo(sx + 12, sy + 18);
    c.lineTo(sx + 10, sy + 20);
    c.closePath();
    c.fill();
    /* Mouth (Y-shape) */
    c.strokeStyle = p.shade; c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(sx + 10, sy + 20); c.lineTo(sx + 10, sy + 22);
    c.moveTo(sx + 10, sy + 22); c.quadraticCurveTo(sx + 8, sy + 23.5, sx + 6, sy + 22.5);
    c.moveTo(sx + 10, sy + 22); c.quadraticCurveTo(sx + 12, sy + 23.5, sx + 14, sy + 22.5);
    c.stroke();
    /* Two big front teeth */
    c.fillStyle = '#ffffff';
    c.fillRect(sx + 9.2, sy + 22, 0.8, 1.6);
    c.fillRect(sx + 10, sy + 22, 0.8, 1.6);
    /* Big sweet eyes */
    realEye(c, sx + 7,  sy + 16, 1.8, '#5a3018');
    realEye(c, sx + 13, sy + 16, 1.6, '#5a3018');
    /* Eyelashes */
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(sx + 6.4, sy + 14.6); c.lineTo(sx + 5.6, sy + 13.6);
    c.moveTo(sx + 7.4, sy + 14.4); c.lineTo(sx + 7.6, sy + 13.4);
    c.moveTo(sx + 12.4, sy + 14.6); c.lineTo(sx + 11.6, sy + 13.6);
    c.moveTo(sx + 13.4, sy + 14.4); c.lineTo(sx + 13.6, sy + 13.4);
    c.stroke();
    /* Whiskers */
    c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(sx + 4, sy + 22); c.lineTo(sx - 4, sy + 21);
    c.moveTo(sx + 4, sy + 24); c.lineTo(sx - 4, sy + 25);
    c.moveTo(sx + 16, sy + 22); c.lineTo(sx + 24, sy + 21);
    c.moveTo(sx + 16, sy + 24); c.lineTo(sx + 24, sy + 25);
    c.stroke();
    /* Carrot accessory */
    c.fillStyle = '#ff8a30';
    c.beginPath();
    c.moveTo(sx + 28, sy + 32);
    c.lineTo(sx + 26, sy + 42);
    c.lineTo(sx + 30, sy + 42);
    c.closePath();
    c.fill();
    c.fillStyle = '#3a8a30';
    c.fillRect(sx + 27.6, sy + 28, 0.8, 5);
    c.fillRect(sx + 28.4, sy + 28, 0.8, 5);
    /* Fluffy pom tail */
    c.fillStyle = p.body;
    c.beginPath(); c.arc(sx + 46, sy + 26, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff8f0';
    c.beginPath(); c.arc(sx + 45, sy + 25, 2, 0, Math.PI * 2); c.fill();
    /* Pink heart on belly */
    c.fillStyle = 'rgba(255,150,170,0.6)';
    var bhx = sx + 22, bhy = sy + 30;
    c.beginPath();
    c.arc(bhx - 2, bhy - 1, 2, 0, Math.PI * 2);
    c.arc(bhx + 2, bhy - 1, 2, 0, Math.PI * 2);
    c.moveTo(bhx - 3.6, bhy);
    c.lineTo(bhx, bhy + 3.5);
    c.lineTo(bhx + 3.6, bhy);
    c.closePath();
    c.fill();
  }

  function drawCatSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.cat;
    drawCreatureBase(c, sx, sy, p.body, p.shade);
    /* Tabby stripes on the back */
    c.fillStyle = p.shade;
    for (var ci2 = 0; ci2 < 5; ci2++) {
      c.save();
      c.translate(sx + 16 + ci2 * 4, sy + 18);
      c.rotate(0.05);
      c.fillRect(-0.8, 0, 1.4, 14);
      c.restore();
    }
    /* Forehead "M" mark (classic tabby) */
    c.fillStyle = p.shade;
    c.beginPath();
    c.moveTo(sx + 6, sy + 14); c.lineTo(sx + 7, sy + 10); c.lineTo(sx + 8, sy + 13);
    c.lineTo(sx + 9, sy + 10); c.lineTo(sx + 10, sy + 14);
    c.stroke();
    /* Triangle ears with pink inner */
    c.fillStyle = p.body;
    c.beginPath(); c.moveTo(sx, sy + 12); c.lineTo(sx + 4, sy + 0); c.lineTo(sx + 8, sy + 12); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(sx + 12, sy + 12); c.lineTo(sx + 16, sy + 0); c.lineTo(sx + 20, sy + 12); c.closePath(); c.fill();
    c.fillStyle = '#ff99bb';
    c.beginPath(); c.moveTo(sx + 2, sy + 11); c.lineTo(sx + 4, sy + 5); c.lineTo(sx + 6, sy + 11); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(sx + 14, sy + 11); c.lineTo(sx + 16, sy + 5); c.lineTo(sx + 18, sy + 11); c.closePath(); c.fill();
    /* Cheek tufts */
    c.fillStyle = p.accent;
    c.beginPath(); c.arc(sx + 3, sy + 21, 2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 17, sy + 21, 2, 0, Math.PI * 2); c.fill();
    /* Pink heart-shape nose */
    c.fillStyle = '#ff66aa';
    c.beginPath();
    c.moveTo(sx + 10, sy + 20);
    c.lineTo(sx + 8, sy + 19);
    c.lineTo(sx + 8, sy + 20.4);
    c.lineTo(sx + 10, sy + 22);
    c.lineTo(sx + 12, sy + 20.4);
    c.lineTo(sx + 12, sy + 19);
    c.closePath();
    c.fill();
    /* Mouth */
    c.strokeStyle = p.shade; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx + 10, sy + 22); c.lineTo(sx + 10, sy + 23.2);
    c.moveTo(sx + 10, sy + 23.2); c.quadraticCurveTo(sx + 8, sy + 24.4, sx + 6, sy + 23.6);
    c.moveTo(sx + 10, sy + 23.2); c.quadraticCurveTo(sx + 12, sy + 24.4, sx + 14, sy + 23.6);
    c.stroke();
    /* Big green almond eyes with vertical pupils */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(sx + 7,  sy + 16, 2, 1.8, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 13, sy + 16, 2, 1.8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5fa040';
    c.beginPath(); c.arc(sx + 7,  sy + 16, 1.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 13, sy + 16, 1.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0a0a0a';
    c.beginPath(); c.ellipse(sx + 7,  sy + 16, 0.4, 1.4, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 13, sy + 16, 0.4, 1.4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 6.6, sy + 15.6, 0.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 12.6, sy + 15.6, 0.4, 0, Math.PI * 2); c.fill();
    /* Whiskers */
    c.strokeStyle = p.shade; c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(sx + 4, sy + 21); c.lineTo(sx - 6, sy + 20);
    c.moveTo(sx + 4, sy + 23); c.lineTo(sx - 6, sy + 24);
    c.moveTo(sx + 16, sy + 21); c.lineTo(sx + 26, sy + 20);
    c.moveTo(sx + 16, sy + 23); c.lineTo(sx + 26, sy + 24);
    c.stroke();
    /* Curled tail with stripes */
    c.fillStyle = p.body;
    c.beginPath();
    c.moveTo(sx + 38, sy + 24);
    c.bezierCurveTo(sx + 56, sy + 8, sx + 58, sy + 30, sx + 50, sy + 32);
    c.quadraticCurveTo(sx + 44, sy + 26, sx + 38, sy + 28);
    c.closePath();
    c.fill();
    c.fillStyle = p.shade;
    for (var ct2 = 0; ct2 < 5; ct2++) {
      c.save();
      c.translate(sx + 42 + ct2 * 3, sy + 18 + ct2 * 1);
      c.rotate(-0.4 + ct2 * 0.1);
      c.fillRect(-0.6, 0, 1.2, 4);
      c.restore();
    }
    /* Bell collar */
    c.fillStyle = '#ff66aa';
    c.fillRect(sx + 4, sy + 25, 12, 2);
    c.fillStyle = '#ffd24a';
    c.beginPath(); c.arc(sx + 10, sy + 28, 1.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#caa040';
    c.beginPath(); c.arc(sx + 10, sy + 28.6, 0.4, 0, Math.PI * 2); c.fill();
  }

  function drawDogSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.dog;
    drawCreatureBase(c, sx, sy, p.body, p.shade);
    /* Long floppy ears with darker outer */
    c.fillStyle = p.shade;
    c.beginPath(); c.ellipse(sx, sy + 16, 4, 9, -0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 20, sy + 16, 4, 9, 0.3, 0, Math.PI * 2); c.fill();
    /* Inner ear cream */
    c.fillStyle = '#fff0d8';
    c.beginPath(); c.ellipse(sx + 1, sy + 18, 2, 4, -0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 19, sy + 18, 2, 4, 0.3, 0, Math.PI * 2); c.fill();
    /* Pointed snout */
    c.fillStyle = p.body;
    c.beginPath();
    c.moveTo(sx + 8, sy + 18);
    c.lineTo(sx - 2, sy + 22);
    c.lineTo(sx + 8, sy + 26);
    c.closePath();
    c.fill();
    /* Cream snout underside */
    c.fillStyle = '#fff0d8';
    c.beginPath();
    c.moveTo(sx + 8, sy + 22);
    c.lineTo(sx - 2, sy + 24);
    c.lineTo(sx + 8, sy + 26);
    c.closePath();
    c.fill();
    /* Brown spot patches on body */
    c.fillStyle = p.shade;
    c.beginPath(); c.arc(sx + 28, sy + 24, 5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 16, sy + 32, 3.4, 0, Math.PI * 2); c.fill();
    /* Nose with highlight */
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.ellipse(sx - 1, sy + 22, 1.8, 1.4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fafafa';
    c.beginPath(); c.arc(sx - 1.4, sy + 21.6, 0.5, 0, Math.PI * 2); c.fill();
    /* Tongue out (happy panting) */
    c.fillStyle = '#ff6688';
    c.beginPath();
    c.moveTo(sx + 2, sy + 25);
    c.quadraticCurveTo(sx, sy + 28, sx + 4, sy + 28);
    c.lineTo(sx + 5, sy + 25);
    c.closePath();
    c.fill();
    /* Mouth line */
    c.strokeStyle = p.shade; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx - 1, sy + 22); c.lineTo(sx + 4, sy + 25);
    c.stroke();
    /* Sweet brown eyes */
    realEye(c, sx + 8,  sy + 16, 1.6, '#5a3018');
    realEye(c, sx + 14, sy + 16, 1.4, '#5a3018');
    /* Eyebrow tufts */
    c.fillStyle = p.shade;
    c.fillRect(sx + 6, sy + 13.4, 3, 0.8);
    c.fillRect(sx + 13, sy + 13.4, 3, 0.8);
    /* Wagging tail */
    c.save();
    c.translate(sx + 38, sy + 22);
    c.rotate(0.3);
    c.fillStyle = p.body;
    c.beginPath();
    c.moveTo(0, 4);
    c.bezierCurveTo(14, -8, 18, 8, 8, 6);
    c.closePath();
    c.fill();
    c.restore();
    /* Red bandana around neck */
    c.fillStyle = '#cc2244';
    c.beginPath();
    c.moveTo(sx + 4, sy + 24);
    c.lineTo(sx + 16, sy + 24);
    c.lineTo(sx + 14, sy + 28);
    c.lineTo(sx + 6, sy + 28);
    c.closePath();
    c.fill();
    c.fillStyle = '#aa1830';
    c.beginPath();
    c.moveTo(sx + 16, sy + 24); c.lineTo(sx + 20, sy + 26); c.lineTo(sx + 14, sy + 28);
    c.closePath();
    c.fill();
    /* Bandana white dots */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 8,  sy + 26, 0.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 12, sy + 26, 0.6, 0, Math.PI * 2); c.fill();
    /* Bone toy on the floor */
    c.fillStyle = '#fff8e0';
    c.beginPath(); c.ellipse(sx + 24, sy + 46, 6, 1.6, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 19, sy + 46, 1.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 29, sy + 46, 1.8, 0, Math.PI * 2); c.fill();
  }

  function drawSeaOtterSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.seaOtter;
    /* Drop shadow */
    c.save(); c.globalAlpha = 0.3; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(sx + 22, sy + 46, 18, 3, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Body — long, sleek otter shape */
    var bg = c.createLinearGradient(0, sy + 16, 0, sy + 44);
    bg.addColorStop(0, p.body); bg.addColorStop(1, p.shade);
    c.fillStyle = bg;
    c.beginPath();
    c.ellipse(sx + 22, sy + 30, 22, 13, 0, 0, Math.PI * 2);
    c.fill();
    /* Tan belly */
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(sx + 22, sy + 34, 13, 7, 0, 0, Math.PI * 2); c.fill();
    /* Head — round, lighter underside */
    c.fillStyle = p.body;
    c.beginPath(); c.arc(sx + 8, sy + 18, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.accent;
    c.beginPath(); c.arc(sx + 8, sy + 22, 6, 0, Math.PI); c.fill();
    /* Round ears */
    c.fillStyle = p.shade;
    c.beginPath(); c.arc(sx + 1, sy + 14, 2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 15, sy + 14, 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff99aa';
    c.beginPath(); c.arc(sx + 1, sy + 14, 0.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 15, sy + 14, 0.8, 0, Math.PI * 2); c.fill();
    /* Big black nose with highlight */
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.ellipse(sx + 1, sy + 21, 2, 1.4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fafafa';
    c.beginPath(); c.arc(sx + 0.6, sy + 20.6, 0.4, 0, Math.PI * 2); c.fill();
    /* Wide smile */
    c.strokeStyle = p.shade; c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(sx + 1, sy + 22); c.lineTo(sx + 4, sy + 24.4);
    c.moveTo(sx + 4, sy + 24.4); c.quadraticCurveTo(sx + 6, sy + 25.6, sx + 8, sy + 24);
    c.stroke();
    /* Sweet eyes */
    realEye(c, sx + 6,  sy + 17, 1.5, '#3a2010');
    realEye(c, sx + 11, sy + 17, 1.3, '#3a2010');
    /* Whiskers */
    c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(sx + 2, sy + 22); c.lineTo(sx - 6, sy + 21);
    c.moveTo(sx + 2, sy + 23); c.lineTo(sx - 6, sy + 24);
    c.moveTo(sx + 4, sy + 22); c.lineTo(sx - 4, sy + 23);
    c.stroke();
    /* Webbed front paws holding a clam */
    c.fillStyle = p.body;
    c.beginPath(); c.ellipse(sx + 16, sy + 32, 3, 4, -0.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 22, sy + 32, 3, 4, 0.2, 0, Math.PI * 2); c.fill();
    /* Clam */
    c.fillStyle = '#cccccc';
    c.beginPath(); c.ellipse(sx + 19, sy + 30, 4, 2.4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#9a9a9a';
    c.beginPath();
    c.arc(sx + 19, sy + 30, 4, Math.PI * 0.1, Math.PI - 0.1);
    c.stroke ? c.stroke() : null;
    c.strokeStyle = '#5a5a5a'; c.lineWidth = 0.4;
    c.beginPath();
    c.moveTo(sx + 17, sy + 30); c.lineTo(sx + 19, sy + 30.8); c.lineTo(sx + 21, sy + 30);
    c.stroke();
    /* Long tail */
    c.fillStyle = p.body;
    c.beginPath();
    c.moveTo(sx + 42, sy + 30);
    c.bezierCurveTo(sx + 56, sy + 26, sx + 56, sy + 36, sx + 42, sy + 36);
    c.closePath();
    c.fill();
    /* Floating water ripples beneath */
    c.strokeStyle = 'rgba(180,220,255,0.5)'; c.lineWidth = 0.8;
    c.beginPath();
    c.arc(sx + 22, sy + 47, 18, Math.PI * 1.05, Math.PI * 1.95);
    c.stroke();
    c.beginPath();
    c.arc(sx + 22, sy + 47, 13, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
  }

  function drawKangarooSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.kangaroo;
    /* Drop shadow */
    c.save(); c.globalAlpha = 0.3; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(sx + 24, sy + 50, 18, 3, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Body — gradient */
    var bg = c.createLinearGradient(0, sy + 16, 0, sy + 44);
    bg.addColorStop(0, p.body); bg.addColorStop(1, p.shade);
    c.fillStyle = bg;
    c.beginPath();
    c.ellipse(sx + 24, sy + 30, 14, 13, 0, 0, Math.PI * 2);
    c.fill();
    /* Pouch with joey peeking out */
    c.fillStyle = p.shade;
    c.beginPath(); c.ellipse(sx + 22, sy + 34, 7, 6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.body;
    c.beginPath(); c.arc(sx + 22, sy + 32, 3, 0, Math.PI * 2); c.fill();
    /* Joey eyes peeking */
    c.fillStyle = '#0a0a0a';
    c.beginPath(); c.arc(sx + 21, sy + 31, 0.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 23, sy + 31, 0.5, 0, Math.PI * 2); c.fill();
    /* Joey ear */
    c.fillStyle = p.body;
    c.beginPath(); c.ellipse(sx + 21, sy + 29, 1, 2, -0.1, 0, Math.PI * 2); c.fill();
    /* Thick tail (curving down + back) */
    c.fillStyle = p.body;
    c.beginPath();
    c.moveTo(sx + 36, sy + 30);
    c.bezierCurveTo(sx + 56, sy + 24, sx + 60, sy + 50, sx + 44, sy + 50);
    c.quadraticCurveTo(sx + 40, sy + 38, sx + 36, sy + 34);
    c.closePath();
    c.fill();
    /* Head — distinctive cone shape */
    c.fillStyle = p.body;
    c.beginPath(); c.ellipse(sx + 12, sy + 14, 8, 9, 0, 0, Math.PI * 2); c.fill();
    /* Long pointed snout */
    c.beginPath();
    c.moveTo(sx + 6, sy + 14);
    c.lineTo(sx - 4, sy + 18);
    c.lineTo(sx + 6, sy + 20);
    c.closePath();
    c.fill();
    /* Long upright ears with pink inner */
    c.fillStyle = p.body;
    c.beginPath(); c.ellipse(sx + 8, sy + 0, 2, 7, -0.1, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 16, sy + 0, 2, 7, 0.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff99aa';
    c.beginPath(); c.ellipse(sx + 8, sy + 1, 1, 5, -0.1, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 16, sy + 1, 1, 5, 0.1, 0, Math.PI * 2); c.fill();
    /* Big chocolate eye */
    realEye(c, sx + 14, sy + 12, 1.8, '#3a2010');
    /* Eyelashes */
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(sx + 12.6, sy + 10.6); c.lineTo(sx + 11.6, sy + 9.6);
    c.moveTo(sx + 14, sy + 10.2); c.lineTo(sx + 14, sy + 9.2);
    c.moveTo(sx + 15.4, sy + 10.6); c.lineTo(sx + 16.4, sy + 9.6);
    c.stroke();
    /* Black nose */
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.ellipse(sx - 2, sy + 18, 1.4, 1, 0, 0, Math.PI * 2); c.fill();
    /* Mouth */
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(sx - 2, sy + 18); c.lineTo(sx + 2, sy + 20);
    c.stroke();
    /* Powerful hind legs with feet */
    c.fillStyle = p.shade;
    c.fillRect(sx + 14, sy + 38, 5, 10);
    c.fillRect(sx + 28, sy + 38, 5, 10);
    /* Big kangaroo feet */
    c.fillStyle = p.body;
    c.beginPath(); c.ellipse(sx + 16, sy + 49, 6, 1.6, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 30, sy + 49, 6, 1.6, 0, 0, Math.PI * 2); c.fill();
    /* Tiny front arms */
    c.fillStyle = p.body;
    c.beginPath(); c.ellipse(sx + 16, sy + 26, 2, 4, 0.2, 0, Math.PI * 2); c.fill();
  }

  function drawUnicornSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.unicorn;
    drawCreatureBase(c, sx, sy, p.body, p.shade);
    /* Subtle pink iridescence on body */
    c.save();
    c.globalAlpha = 0.25;
    c.fillStyle = '#ffd6f5';
    c.beginPath(); c.ellipse(sx + 22, sy + 26, 18, 8, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Pointy ears */
    c.fillStyle = p.body;
    c.beginPath(); c.moveTo(sx + 3, sy + 12); c.lineTo(sx + 6, sy + 2); c.lineTo(sx + 9, sy + 12); c.closePath(); c.fill();
    c.fillStyle = '#ff99dd';
    c.beginPath(); c.moveTo(sx + 4, sy + 11); c.lineTo(sx + 6, sy + 5); c.lineTo(sx + 8, sy + 11); c.closePath(); c.fill();
    /* Spiraling horn — gold with iridescent stripes */
    var hornGrad = c.createLinearGradient(sx + 12, sy - 8, sx + 14, sy + 12);
    hornGrad.addColorStop(0, '#ffd24a');
    hornGrad.addColorStop(0.5, '#ffe070');
    hornGrad.addColorStop(1, '#caa040');
    c.fillStyle = hornGrad;
    c.beginPath();
    c.moveTo(sx + 11, sy + 12);
    c.lineTo(sx + 13, sy - 10);
    c.lineTo(sx + 15, sy + 12);
    c.closePath();
    c.fill();
    /* Horn spiral lines */
    c.strokeStyle = '#ff99dd'; c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(sx + 11.6, sy + 10); c.lineTo(sx + 14, sy + 8);
    c.moveTo(sx + 12, sy + 6); c.lineTo(sx + 14, sy + 4);
    c.moveTo(sx + 12.5, sy + 2); c.lineTo(sx + 14, sy);
    c.moveTo(sx + 13, sy - 2); c.lineTo(sx + 13.6, sy - 4);
    c.stroke();
    /* Sparkle on horn tip */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 13, sy - 9, 1.4, 0, Math.PI * 2); c.fill();
    /* Flowing rainbow mane (longer wavy strokes) */
    var maneColors = ['#ff66cc', '#ff8a30', '#ffd24a', '#88ff88', '#66ddff', '#bb88ff'];
    for (var um = 0; um < maneColors.length; um++) {
      c.fillStyle = maneColors[um];
      c.beginPath();
      c.moveTo(sx + 14 + um * 1.2, sy + 8);
      c.bezierCurveTo(
        sx + 18 + um * 1.5, sy + 14,
        sx + 14 + um * 2, sy + 22,
        sx + 18 + um * 2.4, sy + 28
      );
      c.lineTo(sx + 20 + um * 2.4, sy + 28);
      c.bezierCurveTo(
        sx + 16 + um * 2, sy + 22,
        sx + 20 + um * 1.5, sy + 14,
        sx + 16 + um * 1.2, sy + 8
      );
      c.closePath();
      c.fill();
    }
    /* Long flowing rainbow tail */
    for (var ut = 0; ut < maneColors.length; ut++) {
      c.fillStyle = maneColors[ut];
      c.beginPath();
      c.moveTo(sx + 42, sy + 22 + ut * 1.4);
      c.bezierCurveTo(
        sx + 56 + ut, sy + 18 + ut * 1.4,
        sx + 60 + ut, sy + 36 + ut * 1.4,
        sx + 50 + ut, sy + 38 + ut * 1.4
      );
      c.lineTo(sx + 48 + ut, sy + 36 + ut * 1.4);
      c.bezierCurveTo(
        sx + 56 + ut, sy + 32 + ut * 1.4,
        sx + 54 + ut, sy + 22 + ut * 1.4,
        sx + 42, sy + 24 + ut * 1.4
      );
      c.closePath();
      c.fill();
    }
    /* Forelock between ears */
    c.fillStyle = '#ff66cc';
    c.beginPath();
    c.moveTo(sx + 8, sy + 8);
    c.bezierCurveTo(sx + 10, sy + 4, sx + 12, sy + 4, sx + 14, sy + 12);
    c.lineTo(sx + 12, sy + 14);
    c.bezierCurveTo(sx + 10, sy + 12, sx + 9, sy + 10, sx + 8, sy + 8);
    c.closePath();
    c.fill();
    /* Snout */
    c.fillStyle = '#ffe6f0';
    c.beginPath(); c.ellipse(sx + 4, sy + 22, 5, 3.6, 0, 0, Math.PI * 2); c.fill();
    /* Small pink nostril */
    c.fillStyle = '#ff99dd';
    c.beginPath(); c.arc(sx + 2, sy + 21, 0.8, 0, Math.PI * 2); c.fill();
    /* Mouth */
    c.strokeStyle = '#cc88aa'; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx + 1, sy + 23); c.quadraticCurveTo(sx + 3, sy + 24.6, sx + 7, sy + 23);
    c.stroke();
    /* Big lavender eye with star pupil */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(sx + 9, sy + 16, 2.2, 2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#aa88ee';
    c.beginPath(); c.arc(sx + 9, sy + 16, 1.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0a0a0a';
    c.beginPath(); c.arc(sx + 9, sy + 16, 0.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 8.6, sy + 15.6, 0.5, 0, Math.PI * 2); c.fill();
    /* Eyelashes */
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 0.4;
    c.beginPath();
    c.moveTo(sx + 8.0, sy + 14.4); c.lineTo(sx + 7.4, sy + 13.4);
    c.moveTo(sx + 9, sy + 14); c.lineTo(sx + 9.0, sy + 13);
    c.moveTo(sx + 10, sy + 14.4); c.lineTo(sx + 10.6, sy + 13.4);
    c.stroke();
    /* Heart cheek */
    c.fillStyle = 'rgba(255,150,200,0.6)';
    c.beginPath(); c.arc(sx + 5, sy + 19, 1.4, 0, Math.PI * 2); c.fill();
    /* Sparkle particles around the body */
    c.fillStyle = '#ffffff';
    var spx = [22, 32, 14, 36, 28, 18];
    var spy = [12, 18, 26, 28, 8, 32];
    for (var sp = 0; sp < spx.length; sp++) {
      var ssize = 0.8 + (sp % 2) * 0.6;
      c.beginPath();
      c.moveTo(sx + spx[sp], sy + spy[sp] - ssize);
      c.lineTo(sx + spx[sp] + ssize, sy + spy[sp]);
      c.lineTo(sx + spx[sp], sy + spy[sp] + ssize);
      c.lineTo(sx + spx[sp] - ssize, sy + spy[sp]);
      c.closePath();
      c.fill();
    }
  }

  function drawAlienSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.alien;
    /* Drop shadow */
    c.save(); c.globalAlpha = 0.3; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(sx + 22, sy + 48, 16, 3, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Body — green gradient */
    var bg = c.createLinearGradient(0, sy + 18, 0, sy + 44);
    bg.addColorStop(0, '#a8e8a0');
    bg.addColorStop(0.5, p.body);
    bg.addColorStop(1, p.shade);
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(sx + 22, sy + 30, 16, 13, 0, 0, Math.PI * 2); c.fill();
    /* Lighter underside highlight */
    c.fillStyle = '#caffba';
    c.beginPath(); c.ellipse(sx + 22, sy + 26, 12, 6, 0, 0, Math.PI * 2); c.fill();
    /* Big bulbous head with gradient */
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(sx + 22, sy + 14, 14, 11, 0, 0, Math.PI * 2); c.fill();
    /* Forehead highlight */
    c.fillStyle = '#caffba';
    c.beginPath(); c.ellipse(sx + 18, sy + 9, 6, 4, -0.3, 0, Math.PI * 2); c.fill();
    /* Antennae with glowing tips */
    c.strokeStyle = p.shade; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(sx + 16, sy + 4); c.lineTo(sx + 12, sy - 6); c.stroke();
    c.beginPath(); c.moveTo(sx + 28, sy + 4); c.lineTo(sx + 32, sy - 6); c.stroke();
    /* Glow halos */
    c.save();
    c.globalAlpha = 0.5;
    var ag = c.createRadialGradient(sx + 12, sy - 6, 1, sx + 12, sy - 6, 6);
    ag.addColorStop(0, 'rgba(255,170,255,0.9)');
    ag.addColorStop(1, 'rgba(255,170,255,0)');
    c.fillStyle = ag;
    c.beginPath(); c.arc(sx + 12, sy - 6, 6, 0, Math.PI * 2); c.fill();
    var ag2 = c.createRadialGradient(sx + 32, sy - 6, 1, sx + 32, sy - 6, 6);
    ag2.addColorStop(0, 'rgba(255,170,255,0.9)');
    ag2.addColorStop(1, 'rgba(255,170,255,0)');
    c.fillStyle = ag2;
    c.beginPath(); c.arc(sx + 32, sy - 6, 6, 0, Math.PI * 2); c.fill();
    c.restore();
    c.fillStyle = '#ff66cc';
    c.beginPath(); c.arc(sx + 12, sy - 6, 2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 32, sy - 6, 2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 11.6, sy - 6.4, 0.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 31.6, sy - 6.4, 0.6, 0, Math.PI * 2); c.fill();
    /* Three big black eyes with magenta highlights */
    c.fillStyle = '#0a0a0a';
    c.beginPath(); c.ellipse(sx + 15, sy + 14, 2.4, 3, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 22, sy + 11, 2.4, 3, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 29, sy + 14, 2.4, 3, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff66cc';
    c.beginPath(); c.arc(sx + 14.4, sy + 13.4, 0.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 21.4, sy + 10.4, 0.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 28.4, sy + 13.4, 0.6, 0, Math.PI * 2); c.fill();
    /* Tiny mouth */
    c.strokeStyle = p.shade; c.lineWidth = 0.6;
    c.beginPath();
    c.arc(sx + 22, sy + 19, 2, 0.2, Math.PI - 0.2);
    c.stroke();
    /* Cheek glow */
    c.fillStyle = 'rgba(255,170,220,0.5)';
    c.beginPath(); c.arc(sx + 12, sy + 17, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 32, sy + 17, 1.6, 0, Math.PI * 2); c.fill();
    /* Pink belly spots */
    c.fillStyle = p.accent;
    c.beginPath(); c.arc(sx + 16, sy + 30, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 22, sy + 34, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 28, sy + 30, 1.6, 0, Math.PI * 2); c.fill();
    /* Magenta belly heart */
    c.fillStyle = '#ff66cc';
    var ahx = sx + 22, ahy = sy + 28;
    c.beginPath();
    c.arc(ahx - 1.6, ahy - 0.6, 1.6, 0, Math.PI * 2);
    c.arc(ahx + 1.6, ahy - 0.6, 1.6, 0, Math.PI * 2);
    c.moveTo(ahx - 3, ahy);
    c.lineTo(ahx, ahy + 3);
    c.lineTo(ahx + 3, ahy);
    c.closePath();
    c.fill();
    /* Tentacle legs (5) */
    c.fillStyle = p.shade;
    for (var at = 0; at < 5; at++) {
      var atx = sx + 12 + at * 5;
      c.beginPath();
      c.ellipse(atx, sy + 42 + (at % 2) * 2, 2.4, 6, 0.05, 0, Math.PI * 2);
      c.fill();
      /* Suction-cup tip */
      c.fillStyle = '#ff99cc';
      c.beginPath(); c.arc(atx, sy + 47 + (at % 2) * 2, 1.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.shade;
    }
    /* Ray gun in tentacle */
    c.fillStyle = '#888';
    c.fillRect(sx + 32, sy + 36, 8, 3);
    c.fillStyle = '#caa040';
    c.fillRect(sx + 32, sy + 36, 1.4, 3);
    c.fillStyle = '#ff66cc';
    c.beginPath(); c.arc(sx + 41, sy + 37.5, 1.2, 0, Math.PI * 2); c.fill();
  }

  function drawMonkeySprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.monkey;
    /* Body — deeper brown egg shape, shaded on the underside */
    var bodyGrad = c.createLinearGradient(sx + 22, sy + 18, sx + 22, sy + 42);
    bodyGrad.addColorStop(0, p.body);
    bodyGrad.addColorStop(1, p.shade);
    c.fillStyle = bodyGrad;
    c.beginPath(); c.ellipse(sx + 22, sy + 30, 14, 13, 0, 0, Math.PI * 2); c.fill();
    /* Belly patch (lighter cream) */
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(sx + 22, sy + 32, 9, 8, 0, 0, Math.PI * 2); c.fill();
    /* Head — slightly rounded, bigger than body to read as primate */
    c.fillStyle = p.body;
    c.beginPath(); c.arc(sx + 12, sy + 16, 11, 0, Math.PI * 2); c.fill();
    /* Distinct face mask — peach/tan oval, classic capuchin look */
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(sx + 12, sy + 18, 8, 7, 0, 0, Math.PI * 2); c.fill();
    /* Brow ridge — darker ring above the mask */
    c.strokeStyle = p.shade;
    c.lineWidth = 1.4;
    c.beginPath(); c.arc(sx + 12, sy + 16, 7, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    /* Cheek tufts */
    c.fillStyle = p.body;
    c.beginPath(); c.arc(sx + 5,  sy + 19, 2.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 19, sy + 19, 2.2, 0, Math.PI * 2); c.fill();
    /* Round side-set ears */
    c.fillStyle = p.body;
    c.beginPath(); c.arc(sx + 1,  sy + 14, 3.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 23, sy + 14, 3.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.accent;
    c.beginPath(); c.arc(sx + 1,  sy + 14, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 23, sy + 14, 1.6, 0, Math.PI * 2); c.fill();
    /* Eyes — closer together, more expressive */
    eye(c, sx + 9,  sy + 17, 1.6);
    eye(c, sx + 15, sy + 17, 1.6);
    /* Small dark snout + nostrils */
    c.fillStyle = p.shade;
    c.beginPath(); c.ellipse(sx + 12, sy + 21, 2.2, 1.4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.arc(sx + 11, sy + 21, 0.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 13, sy + 21, 0.5, 0, Math.PI * 2); c.fill();
    /* Curved smile with visible lower lip */
    c.strokeStyle = p.shade; c.lineWidth = 1;
    c.beginPath();
    c.moveTo(sx + 9, sy + 22.6);
    c.quadraticCurveTo(sx + 12, sy + 24.2, sx + 15, sy + 22.6);
    c.stroke();
    /* Arms with hands */
    c.fillStyle = p.body;
    c.beginPath(); c.ellipse(sx + 6,  sy + 32, 3, 7, 0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 38, sy + 30, 3, 7, -0.3, 0, Math.PI * 2); c.fill();
    /* Hands (paler) */
    c.fillStyle = p.accent;
    c.beginPath(); c.arc(sx + 8,  sy + 38, 2.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 36, sy + 36, 2.4, 0, Math.PI * 2); c.fill();
    /* Stubby legs with feet */
    c.fillStyle = p.shade;
    c.fillRect(sx + 14, sy + 40, 4, 6);
    c.fillRect(sx + 26, sy + 40, 4, 6);
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(sx + 16, sy + 46, 3.6, 1.6, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 28, sy + 46, 3.6, 1.6, 0, 0, Math.PI * 2); c.fill();
    /* Long curly tail with tapering — proper prehensile look */
    c.strokeStyle = p.body;
    c.lineWidth = 4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(sx + 36, sy + 32);
    c.bezierCurveTo(sx + 56, sy + 24, sx + 54, sy + 44, sx + 44, sy + 40);
    c.stroke();
    c.lineCap = 'butt';
  }

  /* ====== Six new species painters ====== */
  function drawKoalaSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.koala;
    drawCreatureBase(c, sx, sy, p.body, p.shade);
    /* Big fluffy round ears with white fluff */
    c.fillStyle = p.shade;
    c.beginPath(); c.arc(sx + 0, sy + 12, 5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 20, sy + 12, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fafafa';
    /* Fluffy fur around ears */
    for (var ke = 0; ke < 8; ke++) {
      var kea = -Math.PI / 2 + ke * (Math.PI / 4);
      c.beginPath(); c.arc(sx + 0 + Math.cos(kea) * 6, sy + 12 + Math.sin(kea) * 6, 1.6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(sx + 20 + Math.cos(kea) * 6, sy + 12 + Math.sin(kea) * 6, 1.6, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#ffeeee';
    c.beginPath(); c.arc(sx + 0, sy + 12, 2.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 20, sy + 12, 2.6, 0, Math.PI * 2); c.fill();
    /* Iconic big black spoon-shaped nose */
    c.fillStyle = '#1a1a1a';
    c.beginPath();
    c.moveTo(sx + 7, sy + 18);
    c.bezierCurveTo(sx + 7, sy + 24, sx + 13, sy + 24, sx + 13, sy + 18);
    c.bezierCurveTo(sx + 13, sy + 16, sx + 7, sy + 16, sx + 7, sy + 18);
    c.closePath();
    c.fill();
    /* Nose highlight */
    c.fillStyle = '#5a5a5a';
    c.beginPath(); c.ellipse(sx + 9, sy + 18, 1.4, 0.8, 0, 0, Math.PI * 2); c.fill();
    /* Big sleepy eyes */
    realEye(c, sx + 5,  sy + 17, 1.6, '#3a2010');
    realEye(c, sx + 15, sy + 17, 1.6, '#3a2010');
    /* Sleepy eyelids halfway down */
    c.fillStyle = p.body;
    c.fillRect(sx + 3.4, sy + 15.8, 3.2, 1);
    c.fillRect(sx + 13.4, sy + 15.8, 3.2, 1);
    /* Soft mouth (Y-shape) */
    c.strokeStyle = p.shade; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx + 10, sy + 23.4); c.lineTo(sx + 10, sy + 24.4);
    c.moveTo(sx + 10, sy + 24.4); c.quadraticCurveTo(sx + 8, sy + 25.6, sx + 6, sy + 25);
    c.moveTo(sx + 10, sy + 24.4); c.quadraticCurveTo(sx + 12, sy + 25.6, sx + 14, sy + 25);
    c.stroke();
    /* Hugging a eucalyptus branch */
    c.strokeStyle = '#5a3018'; c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(sx + 26, sy + 28); c.lineTo(sx + 36, sy + 36);
    c.stroke();
    var leaves = [
      [28, 30, 0.4], [32, 30, -0.3], [30, 34, 0.2], [34, 32, -0.5],
      [36, 34, 0.3], [38, 36, -0.2],
    ];
    for (var kl = 0; kl < leaves.length; kl++) {
      c.fillStyle = '#5a8a38';
      c.beginPath();
      c.ellipse(sx + leaves[kl][0], sy + leaves[kl][1], 3, 1.4, leaves[kl][2], 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#7aaa48';
      c.beginPath();
      c.ellipse(sx + leaves[kl][0] - 0.4, sy + leaves[kl][1] - 0.4, 2.2, 0.8, leaves[kl][2], 0, Math.PI * 2);
      c.fill();
    }
    /* Claws */
    c.fillStyle = '#1a1a1a';
    c.fillRect(sx + 11, sy + 44, 0.6, 1.6);
    c.fillRect(sx + 13, sy + 44, 0.6, 1.6);
    c.fillRect(sx + 31, sy + 44, 0.6, 1.6);
    c.fillRect(sx + 33, sy + 44, 0.6, 1.6);
  }

  function drawHippoSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.hippo;
    /* Drop shadow */
    c.save(); c.globalAlpha = 0.3; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(sx + 24, sy + 48, 22, 3, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Big stocky body with gradient */
    var bg = c.createLinearGradient(0, sy + 18, 0, sy + 46);
    bg.addColorStop(0, p.body); bg.addColorStop(1, p.shade);
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(sx + 24, sy + 32, 24, 14, 0, 0, Math.PI * 2); c.fill();
    /* Pale belly */
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(sx + 24, sy + 38, 18, 6, 0, 0, Math.PI * 2); c.fill();
    /* Head — wide square block */
    c.fillStyle = p.body;
    c.beginPath();
    c.moveTo(sx - 4, sy + 20);
    c.bezierCurveTo(sx - 6, sy + 12, sx + 16, sy + 12, sx + 16, sy + 22);
    c.lineTo(sx + 16, sy + 28);
    c.bezierCurveTo(sx + 16, sy + 32, sx - 4, sy + 32, sx - 6, sy + 26);
    c.closePath();
    c.fill();
    /* Pale snout */
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(sx - 2, sy + 24, 5, 4, 0, 0, Math.PI * 2); c.fill();
    /* Big nostrils */
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.ellipse(sx - 5, sy + 23, 1.4, 1, 0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 1, sy + 23, 1.4, 1, -0.3, 0, Math.PI * 2); c.fill();
    /* Wide closed mouth */
    c.strokeStyle = p.shade; c.lineWidth = 1;
    c.beginPath();
    c.moveTo(sx - 4, sy + 27);
    c.quadraticCurveTo(sx, sy + 30, sx + 8, sy + 27);
    c.stroke();
    /* Two front teeth poking out */
    c.fillStyle = '#ffffff';
    c.fillRect(sx + 1, sy + 28, 1.2, 2);
    c.fillRect(sx + 4, sy + 28, 1.2, 2);
    /* Tiny round ears on top with pink inner */
    c.fillStyle = p.shade;
    c.beginPath(); c.arc(sx + 2, sy + 13, 2.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 14, sy + 13, 2.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff99cc';
    c.beginPath(); c.arc(sx + 2, sy + 13, 1.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 14, sy + 13, 1.2, 0, Math.PI * 2); c.fill();
    /* Eyes — bulged on top of head with eyelids */
    c.fillStyle = p.body;
    c.beginPath(); c.arc(sx + 5, sy + 17, 2.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 12, sy + 17, 2.4, 0, Math.PI * 2); c.fill();
    realEye(c, sx + 5,  sy + 17, 1.4, '#3a2010');
    realEye(c, sx + 12, sy + 17, 1.4, '#3a2010');
    /* Sleepy eyelids */
    c.strokeStyle = p.shade; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx + 3, sy + 16); c.lineTo(sx + 7, sy + 16);
    c.moveTo(sx + 10, sy + 16); c.lineTo(sx + 14, sy + 16);
    c.stroke();
    /* Stubby legs */
    c.fillStyle = p.shade;
    c.fillRect(sx + 10, sy + 40, 6, 8);
    c.fillRect(sx + 22, sy + 40, 6, 8);
    c.fillRect(sx + 34, sy + 40, 6, 8);
    /* Toes */
    c.fillStyle = '#3a2848';
    for (var hf = 0; hf < 3; hf++) {
      c.fillRect(sx + 10 + (hf - 0.5) * 1.6, sy + 47, 1, 1.4);
      c.fillRect(sx + 22 + (hf - 0.5) * 1.6, sy + 47, 1, 1.4);
      c.fillRect(sx + 34 + (hf - 0.5) * 1.6, sy + 47, 1, 1.4);
    }
    /* Tiny tail flick */
    c.fillStyle = p.body;
    c.fillRect(sx + 46, sy + 30, 4, 1.4);
    c.fillStyle = p.shade;
    c.beginPath(); c.arc(sx + 50, sy + 30, 1, 0, Math.PI * 2); c.fill();
  }

  function drawRhinoSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.rhino;
    drawCreatureBase(c, sx, sy, p.body, p.shade);
    /* Tough hide texture lines */
    c.strokeStyle = p.shade; c.lineWidth = 0.6;
    c.save(); c.globalAlpha = 0.5;
    for (var rh = 0; rh < 6; rh++) {
      c.beginPath();
      c.moveTo(sx + 12 + rh * 4, sy + 22);
      c.lineTo(sx + 13 + rh * 4, sy + 36);
      c.stroke();
    }
    c.restore();
    /* Big front horn — bigger and more dramatically forward so the
       species reads at a glance instead of being read as "armored
       bear." */
    var hornG = c.createLinearGradient(sx - 16, sy + 18, sx + 4, sy + 24);
    hornG.addColorStop(0, '#f0e8d8');
    hornG.addColorStop(1, p.accent);
    c.fillStyle = hornG;
    c.beginPath();
    c.moveTo(sx + 4, sy + 24);
    c.quadraticCurveTo(sx - 8, sy + 16, sx - 18, sy + 12);
    c.quadraticCurveTo(sx - 10, sy + 22, sx - 4, sy + 27);
    c.closePath();
    c.fill();
    /* Horn outline so it pops against the gray hide. */
    c.strokeStyle = '#7a6a4a'; c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(sx + 4, sy + 24);
    c.quadraticCurveTo(sx - 8, sy + 16, sx - 18, sy + 12);
    c.stroke();
    c.beginPath();
    c.moveTo(sx - 18, sy + 12);
    c.quadraticCurveTo(sx - 10, sy + 22, sx - 4, sy + 27);
    c.stroke();
    /* Horn highlight stripe */
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(sx + 2, sy + 22);
    c.quadraticCurveTo(sx - 8, sy + 16, sx - 14, sy + 14);
    c.quadraticCurveTo(sx - 8, sy + 18, sx - 2, sy + 22);
    c.closePath();
    c.fill();
    /* Smaller second horn — bumped up so it still reads against the
       enlarged front horn. */
    c.fillStyle = p.accent;
    c.beginPath();
    c.moveTo(sx + 4, sy + 18);
    c.lineTo(sx, sy + 4);
    c.lineTo(sx + 8, sy + 14);
    c.closePath();
    c.fill();
    c.strokeStyle = '#7a6a4a'; c.lineWidth = 0.6;
    c.stroke();
    /* Tough armor plates */
    c.fillStyle = p.shade;
    c.fillRect(sx + 12, sy + 22, 18, 2);
    c.save(); c.globalAlpha = 0.4;
    c.fillRect(sx + 14, sy + 30, 16, 2);
    c.restore();
    /* Long head extending forward */
    c.fillStyle = p.body;
    c.beginPath();
    c.moveTo(sx + 2, sy + 18);
    c.lineTo(sx - 6, sy + 24);
    c.lineTo(sx + 2, sy + 28);
    c.lineTo(sx + 8, sy + 26);
    c.lineTo(sx + 10, sy + 18);
    c.closePath();
    c.fill();
    /* Small tube-shaped rhino ears (rounded ovals on stalks, NOT pointy
       cat-style triangles which read as the wrong species). */
    c.fillStyle = p.shade;
    c.beginPath(); c.ellipse(sx + 5,  sy + 6, 2.4, 4.2, -0.25, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 15, sy + 6, 2.4, 4.2,  0.25, 0, Math.PI * 2); c.fill();
    /* Inner ear (pink/dark) */
    c.fillStyle = '#5a4040';
    c.beginPath(); c.ellipse(sx + 5,  sy + 7, 1.0, 2.6, -0.25, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 15, sy + 7, 1.0, 2.6,  0.25, 0, Math.PI * 2); c.fill();
    /* Mouth */
    c.strokeStyle = p.accent; c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(sx - 4, sy + 26); c.lineTo(sx + 4, sy + 27.4);
    c.stroke();
    /* Tiny eyes */
    realEye(c, sx + 7,  sy + 17, 1.4, '#3a2010');
    realEye(c, sx + 13, sy + 17, 1.2, '#3a2010');
    /* Eyelid lines (wrinkled brow) */
    c.strokeStyle = p.shade; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx + 5, sy + 14); c.lineTo(sx + 9, sy + 14);
    c.moveTo(sx + 11, sy + 14); c.lineTo(sx + 15, sy + 14);
    c.stroke();
    /* Tail with tuft */
    c.fillStyle = p.body;
    c.fillRect(sx + 42, sy + 28, 4, 1.4);
    c.fillStyle = p.shade;
    c.beginPath(); c.arc(sx + 47, sy + 30, 2, 0, Math.PI * 2); c.fill();
  }

  function drawPolarBearSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.polarBear;
    drawCreatureBase(c, sx, sy, p.body, p.shade);
    /* Subtle blue tint on shaded side for icy feel */
    c.save();
    c.globalAlpha = 0.25;
    c.fillStyle = '#cce8ff';
    c.beginPath(); c.ellipse(sx + 22, sy + 32, 16, 7, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Big round ears with pink inner */
    c.fillStyle = p.body;
    c.beginPath(); c.arc(sx + 2, sy + 8, 3.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 18, sy + 8, 3.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffd6e8';
    c.beginPath(); c.arc(sx + 2, sy + 8, 1.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 18, sy + 8, 1.8, 0, Math.PI * 2); c.fill();
    /* Long snout */
    c.fillStyle = p.body;
    c.beginPath(); c.ellipse(sx + 5, sy + 22, 7, 4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.shade;
    c.beginPath(); c.ellipse(sx + 5, sy + 24, 6, 2, 0, 0, Math.PI * 2); c.fill();
    /* Big black nose with highlight */
    c.fillStyle = '#0a0a0a';
    c.beginPath(); c.ellipse(sx + 0, sy + 21, 1.8, 1.4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fafafa';
    c.beginPath(); c.arc(sx - 0.4, sy + 20.6, 0.5, 0, Math.PI * 2); c.fill();
    /* Mouth */
    c.strokeStyle = p.shade; c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(sx, sy + 22); c.lineTo(sx + 4, sy + 25);
    c.moveTo(sx + 4, sy + 25); c.quadraticCurveTo(sx + 2, sy + 26.2, sx, sy + 25);
    c.moveTo(sx + 4, sy + 25); c.quadraticCurveTo(sx + 6, sy + 26.2, sx + 8, sy + 25);
    c.stroke();
    /* Sweet brown eyes */
    realEye(c, sx + 9,  sy + 16, 1.6, '#3a2010');
    realEye(c, sx + 14, sy + 16, 1.4, '#3a2010');
    /* Big paws with claws */
    c.fillStyle = p.shade;
    c.fillRect(sx + 11, sy + 44, 4, 2);
    c.fillRect(sx + 31, sy + 44, 4, 2);
    c.fillStyle = '#3a3030';
    for (var pc = 0; pc < 3; pc++) {
      c.fillRect(sx + 11 + pc * 1.2, sy + 45.6, 0.6, 1.4);
      c.fillRect(sx + 31 + pc * 1.2, sy + 45.6, 0.6, 1.4);
    }
  }

  function drawFrogSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.frog;
    /* Drop shadow */
    c.save(); c.globalAlpha = 0.3; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(sx + 22, sy + 46, 18, 3, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Round body with gradient */
    var bg = c.createLinearGradient(0, sy + 14, 0, sy + 44);
    bg.addColorStop(0, '#88e878');
    bg.addColorStop(0.5, p.body);
    bg.addColorStop(1, p.shade);
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(sx + 22, sy + 30, 19, 14, 0, 0, Math.PI * 2); c.fill();
    /* Pale yellow belly */
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(sx + 22, sy + 34, 13, 7, 0, 0, Math.PI * 2); c.fill();
    /* Spots/warts on the back */
    c.fillStyle = p.shade;
    var warts = [[16, 22, 1.4], [22, 20, 1.6], [28, 22, 1.4], [12, 28, 1.2], [32, 28, 1.2], [22, 30, 1]];
    for (var fw = 0; fw < warts.length; fw++) {
      c.beginPath(); c.arc(sx + warts[fw][0], sy + warts[fw][1], warts[fw][2], 0, Math.PI * 2); c.fill();
    }
    /* Belly stripes */
    c.fillStyle = '#fff8c0';
    for (var fbs = 0; fbs < 3; fbs++) {
      c.fillRect(sx + 16 + fbs * 4, sy + 36, 1.4, 4);
    }
    /* Big bulgy eyes on top — 3D look with shading */
    c.fillStyle = p.shade;
    c.beginPath(); c.arc(sx + 14, sy + 11, 7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 30, sy + 11, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.body;
    c.beginPath(); c.arc(sx + 14, sy + 12, 6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 30, sy + 12, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 14, sy + 13, 4.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 30, sy + 13, 4.4, 0, Math.PI * 2); c.fill();
    /* Yellow iris with horizontal pupil (like a real frog) */
    c.fillStyle = '#caa030';
    c.beginPath(); c.arc(sx + 14, sy + 13, 3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 30, sy + 13, 3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0a0a0a';
    c.beginPath(); c.ellipse(sx + 14, sy + 13, 3, 0.8, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 30, sy + 13, 3, 0.8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 13.4, sy + 12.4, 0.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 29.4, sy + 12.4, 0.6, 0, Math.PI * 2); c.fill();
    /* Wide grinning mouth */
    c.fillStyle = p.shade;
    c.beginPath();
    c.arc(sx + 22, sy + 24, 10, 0.05, Math.PI - 0.05);
    c.fill();
    c.fillStyle = '#3a5a18';
    c.beginPath();
    c.arc(sx + 22, sy + 24, 8.4, 0.1, Math.PI - 0.1);
    c.fill();
    /* Pink tongue tip showing */
    c.fillStyle = '#ff8aaa';
    c.beginPath();
    c.ellipse(sx + 22, sy + 27, 4, 1.2, 0, 0, Math.PI * 2);
    c.fill();
    /* Cheek spots (rosy) */
    c.fillStyle = 'rgba(255,150,150,0.4)';
    c.beginPath(); c.arc(sx + 8, sy + 22, 2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 36, sy + 22, 2, 0, Math.PI * 2); c.fill();
    /* Front legs */
    c.fillStyle = p.body;
    c.beginPath(); c.ellipse(sx + 8, sy + 36, 5, 3, -0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 36, sy + 36, 5, 3, 0.3, 0, Math.PI * 2); c.fill();
    /* Sticky toe pads on front feet */
    c.fillStyle = p.shade;
    for (var ftp = 0; ftp < 3; ftp++) {
      c.beginPath(); c.arc(sx + 4 + ftp * 1.6, sy + 38, 0.8, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(sx + 36 + ftp * 1.6, sy + 38, 0.8, 0, Math.PI * 2); c.fill();
    }
    /* Webbed back feet */
    c.fillStyle = p.body;
    c.beginPath();
    c.moveTo(sx + 0, sy + 44);
    c.lineTo(sx - 4, sy + 42);
    c.lineTo(sx + 6, sy + 44);
    c.lineTo(sx - 2, sy + 46);
    c.lineTo(sx + 6, sy + 46);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(sx + 38, sy + 44);
    c.lineTo(sx + 48, sy + 42);
    c.lineTo(sx + 38, sy + 44);
    c.lineTo(sx + 46, sy + 46);
    c.lineTo(sx + 38, sy + 46);
    c.closePath();
    c.fill();
    /* Lily pad under the frog */
    c.fillStyle = '#3a8a30';
    c.beginPath();
    c.arc(sx + 22, sy + 44, 18, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#5fa040';
    c.beginPath();
    c.arc(sx + 22, sy + 43, 16, 0, Math.PI);
    c.fill();
    /* Lily pad notch */
    c.fillStyle = '#88c8ee';
    c.beginPath();
    c.moveTo(sx + 22, sy + 26);
    c.lineTo(sx + 14, sy + 44);
    c.lineTo(sx + 30, sy + 44);
    c.closePath();
    c.fill();
  }

  function drawGorillaSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.gorilla;
    /* Drop shadow */
    c.save(); c.globalAlpha = 0.3; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(sx + 22, sy + 48, 22, 4, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Bulky body — gradient */
    var bg = c.createLinearGradient(0, sy + 16, 0, sy + 46);
    bg.addColorStop(0, '#5a5a5a');
    bg.addColorStop(1, p.shade);
    c.fillStyle = bg;
    c.beginPath(); c.ellipse(sx + 22, sy + 30, 24, 16, 0, 0, Math.PI * 2); c.fill();
    /* Silver-back chest patch */
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(sx + 22, sy + 32, 13, 8, 0, 0, Math.PI * 2); c.fill();
    /* Soft fur stipple */
    c.save();
    c.globalAlpha = 0.4;
    c.strokeStyle = p.body; c.lineWidth = 0.5;
    for (var gf = 0; gf < 12; gf++) {
      c.beginPath();
      c.moveTo(sx + 6 + gf * 3, sy + 22);
      c.lineTo(sx + 7 + gf * 3, sy + 26);
      c.stroke();
    }
    c.restore();
    /* Big head */
    c.fillStyle = p.body;
    c.beginPath(); c.ellipse(sx + 12, sy + 16, 13, 12, 0, 0, Math.PI * 2); c.fill();
    /* Face mask (pale) */
    c.fillStyle = p.accent;
    c.beginPath(); c.ellipse(sx + 12, sy + 19, 8, 7, 0, 0, Math.PI * 2); c.fill();
    /* Heavy brow ridge */
    c.fillStyle = p.shade;
    c.beginPath();
    c.moveTo(sx + 4, sy + 14);
    c.quadraticCurveTo(sx + 12, sy + 9, sx + 20, sy + 14);
    c.lineTo(sx + 20, sy + 17);
    c.quadraticCurveTo(sx + 12, sy + 13, sx + 4, sy + 17);
    c.closePath();
    c.fill();
    /* Brow hair */
    c.fillStyle = '#0a0a0a';
    for (var gb = 0; gb < 5; gb++) {
      c.fillRect(sx + 6 + gb * 3, sy + 11, 1.6, 2);
    }
    /* Tiny round ears */
    c.fillStyle = p.shade;
    c.beginPath(); c.arc(sx + 0, sy + 16, 2.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 24, sy + 16, 2.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#5a3018';
    c.beginPath(); c.arc(sx + 0, sy + 16, 1, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 24, sy + 16, 1, 0, Math.PI * 2); c.fill();
    /* Eyes */
    realEye(c, sx + 9,  sy + 18, 1.6, '#3a2010');
    realEye(c, sx + 15, sy + 18, 1.6, '#3a2010');
    /* Wide nostril snout */
    c.fillStyle = p.shade;
    c.beginPath(); c.ellipse(sx + 12, sy + 22, 4, 2.4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.arc(sx + 10, sy + 22, 0.7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 14, sy + 22, 0.7, 0, Math.PI * 2); c.fill();
    /* Big mouth with visible teeth */
    c.strokeStyle = p.shade; c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(sx + 6, sy + 25); c.lineTo(sx + 18, sy + 25);
    c.stroke();
    c.fillStyle = '#ffffff';
    c.fillRect(sx + 9, sy + 24, 1, 1.4);
    c.fillRect(sx + 11, sy + 24, 1, 1.4);
    c.fillRect(sx + 13, sy + 24, 1, 1.4);
    c.fillRect(sx + 15, sy + 24, 1, 1.4);
    /* Burly arms with fists */
    c.fillStyle = p.body;
    c.beginPath(); c.ellipse(sx + 2,  sy + 32, 5, 12, 0.1, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 42, sy + 32, 5, 12, -0.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.shade;
    c.beginPath(); c.arc(sx + 2,  sy + 42, 4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 42, sy + 42, 4, 0, Math.PI * 2); c.fill();
    /* Knuckles */
    c.fillStyle = '#0a0a0a';
    for (var gk = 0; gk < 3; gk++) {
      c.beginPath(); c.arc(sx + 0 + gk * 1.6, sy + 44, 0.5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(sx + 40 + gk * 1.6, sy + 44, 0.5, 0, Math.PI * 2); c.fill();
    }
    /* Banana in left hand */
    c.fillStyle = '#ffd24a';
    c.beginPath();
    c.moveTo(sx + 40, sy + 38);
    c.bezierCurveTo(sx + 50, sy + 32, sx + 50, sy + 46, sx + 42, sy + 46);
    c.quadraticCurveTo(sx + 44, sy + 42, sx + 40, sy + 40);
    c.closePath();
    c.fill();
    c.fillStyle = '#3a2010';
    c.beginPath(); c.arc(sx + 50, sy + 32, 1, 0, Math.PI * 2); c.fill();
  }

  /* Map species id → painter. */
  var SPECIES_PAINTERS = {
    elephant: drawElephantSprite,
    lion: drawLionSprite,
    tiger: drawTigerSprite,
    bear: drawBearSprite,
    wolf: drawWolfSprite,
    giraffe: drawGiraffeSprite,
    zebra: drawZebraSprite,
    eagle: drawEagleSprite,
    fox: drawFoxSprite,
    owl: drawOwlSprite,
    panda: drawPandaSprite,
    penguin: drawPenguinSprite,
    bunny: drawBunnySprite,
    cat: drawCatSprite,
    dog: drawDogSprite,
    seaOtter: drawSeaOtterSprite,
    kangaroo: drawKangarooSprite,
    unicorn: drawUnicornSprite,
    alien: drawAlienSprite,
    monkey: drawMonkeySprite,
    /* New species */
    koala: drawKoalaSprite,
    hippo: drawHippoSprite,
    rhino: drawRhinoSprite,
    polarBear: drawPolarBearSprite,
    frog: drawFrogSprite,
    gorilla: drawGorillaSprite,
  };

  function drawAnimalSprite(c, species, sx, sy) {
    var painter = SPECIES_PAINTERS[species];
    if (painter) painter(c, sx, sy);
  }

  /* ========== ANIMAL NPC ========== */
  function Animal(species, x, y) {
    this.species = species;
    this.x = x;
    this.y = y;
    this.w = 48;
    this.h = 44;
    this.spawnX = x;
    this.spawnY = y;
    this.timer = Math.random() * 100;
    this.talking = false;
    this.talkTimer = 0;
    this.currentText = '';
  }

  Animal.prototype.update = function () {
    this.timer++;
    /* Soft idle bob */
    this.y = this.spawnY + Math.sin(this.timer * 0.04) * 1.5;
    if (this.talking) {
      this.talkTimer--;
      if (this.talkTimer <= 0) this.talking = false;
    }
  };

  Animal.prototype.interact = function () {
    this.talking = true;
    this.talkTimer = 360;
    /* Prefer the cozy dialogue line (which already includes the sound
       in its text) and fall back to the bare sound if a translation
       slot is missing for the species. */
    var dialogueKey = 'animalDialogue_' + this.species;
    var dialogue = Game.i18n.t(dialogueKey);
    var fallback = Game.i18n.t(this.species + 'Sound');
    this.currentText = (dialogue && dialogue !== dialogueKey) ? dialogue : fallback;
    if (Game.audio && Game.audio.play) Game.audio.play(this.species);
    /* Stamp the guest ledger (side quest) */
    if (Game.engine && Game.engine.stampGuest) Game.engine.stampGuest(this.species);
  };

  Animal.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    /* Talking animals do an excited wiggle: scale-bounce + side-to-side
       sway so each greeting feels like the animal *reacting* rather than
       just standing there with a text bubble overlay. */
    if (this.talking) {
      var wigT = (360 - this.talkTimer) || 0;
      var bounce = 1 + 0.10 * Math.abs(Math.sin(wigT * 0.32));
      var sway = Math.sin(wigT * 0.22) * 4;
      c.save();
      c.translate(sx + this.w / 2 + sway, sy + this.h);
      c.scale(bounce, bounce);
      c.translate(-(this.w / 2), -this.h);
      drawAnimalSprite(c, this.species, 0, 0);
      c.restore();
    } else {
      drawAnimalSprite(c, this.species, sx, sy);
    }
  };

  /* ========== ANIMAL DOOR (clone of HouseDoor with species-themed accent) ========== */
  function AnimalDoor(x, y, species) {
    this.x = x;
    this.y = y;
    this.w = 48;
    this.h = 52;
    this.species = species || 'lion';
    this.talking = false;
    this.timer = 0;
  }

  AnimalDoor.prototype.update = function () { this.timer++; };
  AnimalDoor.prototype.interact = function () { /* handled by engine */ };

  AnimalDoor.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    var p = ANIMAL_PALETTES[this.species] || ANIMAL_PALETTES.lion;
    /* Door frame painted in species color */
    c.fillStyle = '#3a2412';
    c.fillRect(sx, sy, 48, 52);
    c.fillStyle = p.body;
    c.fillRect(sx + 4, sy + 4, 40, 46);
    /* Wood seam */
    c.strokeStyle = p.shade;
    c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(sx + 24, sy + 6); c.lineTo(sx + 24, sy + 48); c.stroke();
    c.beginPath(); c.moveTo(sx + 8, sy + 26); c.lineTo(sx + 40, sy + 26); c.stroke();
    /* Brass handle */
    c.fillStyle = '#ffd24a';
    c.beginPath(); c.arc(sx + 38, sy + 28, 2.6, 0, Math.PI * 2); c.fill();
    /* Tiny species name plate */
    c.fillStyle = '#fff8e0';
    c.fillRect(sx + 8, sy + 8, 32, 10);
    c.strokeStyle = p.shade;
    c.lineWidth = 1;
    c.strokeRect(sx + 8, sy + 8, 32, 10);
    c.fillStyle = '#1a1a1a';
    c.font = 'bold 7px monospace';
    c.textAlign = 'center';
    var label = (this.species === 'bedroom')
      ? 'MOMOKO'
      : Game.i18n.t('animalName_' + this.species).toUpperCase();
    c.fillText(label, sx + 24, sy + 15);
    c.textAlign = 'left';
    /* Visited indicator: a bold gold "STAMPED" badge floating above the
       door. Tells the player at a glance which doors they've already
       opened, without needing to open the Passport. Replaces the pink
       speech-bubble nudge for greeted guests. */
    var stamped = !!(Game.flags && Game.flags.stamps && Game.flags.stamps[this.species]);
    var bob = Math.sin(this.timer * 0.08) * 2;
    var hcx = sx + 24, hcy = sy - 10 + bob;
    if (stamped && this.species !== 'bedroom') {
      c.save();
      /* Tilted "STAMPED" rosette so it reads as a postage mark, not a
         button. Sized large enough to read across the whole corridor. */
      c.translate(hcx, hcy - 4);
      c.rotate(-0.22);
      /* Soft pink glow so the gold pops against any habitat backdrop. */
      c.shadowColor = '#ff66cc';
      c.shadowBlur = 8;
      c.fillStyle = '#ffd24a';
      c.beginPath();
      c.arc(0, 0, 13, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
      c.strokeStyle = '#fff8e0';
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = '#3a2418';
      c.font = 'bold 11px monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('★', 0, 0);
      c.restore();
    } else if (this.species !== 'bedroom') {
      c.fillStyle = '#ff66cc';
      c.beginPath();
      c.arc(hcx - 2.4, hcy - 1, 2.4, 0, Math.PI * 2);
      c.arc(hcx + 2.4, hcy - 1, 2.4, 0, Math.PI * 2);
      c.moveTo(hcx - 4.4, hcy);
      c.lineTo(hcx, hcy + 4.4);
      c.lineTo(hcx + 4.4, hcy);
      c.closePath();
      c.fill();
    }

    /* Bedtime callout — once Momoko has greeted enough guests, the
       bedroom door pulses with a "Z" badge so it's not just blank
       wallpaper next to the bookshelf. Shows a softer hint at 20+,
       a louder sparkly "ZZZ" when all 26 are stamped (victory route). */
    if (this.species === 'bedroom') {
      var stampCount = (Game.flags && Game.flags.stampCount) || 0;
      if (stampCount >= 20) {
        var allDone = stampCount >= 26;
        var pulse = 0.6 + 0.4 * Math.abs(Math.sin(this.timer * 0.08));
        c.save();
        c.translate(hcx, hcy - 4);
        if (allDone) {
          /* Loud sparkle: rainbow halo + ZZZ */
          c.shadowColor = '#88ddff';
          c.shadowBlur = 14 * pulse;
        } else {
          c.shadowColor = '#ff99cc';
          c.shadowBlur = 8 * pulse;
        }
        c.fillStyle = allDone ? '#fff0a0' : '#ffe8f4';
        c.beginPath();
        c.arc(0, 0, 13, 0, Math.PI * 2);
        c.fill();
        c.shadowBlur = 0;
        c.strokeStyle = allDone ? '#88ddff' : '#ff99cc';
        c.lineWidth = 2;
        c.stroke();
        c.fillStyle = '#3a2418';
        c.font = 'bold 11px monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(allDone ? 'Zzz' : 'Z', 0, 0);
        c.restore();
        /* Trailing sparkles when all done */
        if (allDone) {
          for (var sp = 0; sp < 4; sp++) {
            var sa = (sp / 4) * Math.PI * 2 + this.timer * 0.05;
            var sr = 22 + Math.sin(this.timer * 0.04 + sp) * 6;
            var ssx = hcx + Math.cos(sa) * sr;
            var ssy = hcy - 4 + Math.sin(sa) * sr * 0.5;
            c.fillStyle = ['#ff88cc', '#ffd24a', '#88ddff', '#bb88ff'][sp];
            c.beginPath();
            c.arc(ssx, ssy, 2.4, 0, Math.PI * 2);
            c.fill();
          }
        }
      }
    }
  };

  /* ========== RECEPTIONIST (human NPC at the front desk) ========== */
  function Receptionist(x, y) {
    this.x = x;
    this.y = y;
    this.w = 64;
    this.h = 96;
    this.spawnX = x;
    this.spawnY = y;
    this.timer = 0;
    this.talking = false;
    this.talkTimer = 0;
    this.currentText = '';
    this.visited = false;
  }

  Receptionist.prototype.update = function () {
    this.timer++;
    if (this.talking) {
      this.talkTimer--;
      if (this.talkTimer <= 0) this.talking = false;
    }
  };

  Receptionist.prototype.interact = function () {
    this.talking = true;
    this.talkTimer = 360;
    this.currentText = this.visited
      ? Game.i18n.t('receptionistWelcomeBack')
      : Game.i18n.t('receptionistGreet');
    this.visited = true;
  };

  Receptionist.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY) - 60; /* lift his feet to floor level */
    /* Soft shadow under feet */
    c.save();
    c.globalAlpha = 0.3;
    c.fillStyle = '#000';
    c.beginPath();
    c.ellipse(sx + 32, sy + 96, 26, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    /* Trousers — black with brass-buttoned line */
    c.fillStyle = '#1a1228';
    c.fillRect(sx + 14, sy + 60, 36, 36);
    c.fillStyle = '#0a0816';
    c.fillRect(sx + 31, sy + 60, 2, 36);
    /* Polished black shoes */
    c.fillStyle = '#0a0a0a';
    c.beginPath(); c.ellipse(sx + 21, sy + 96, 8, 3, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 43, sy + 96, 8, 3, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3a3a3a';
    c.beginPath(); c.ellipse(sx + 21, sy + 95, 4, 1, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 43, sy + 95, 4, 1, 0, 0, Math.PI * 2); c.fill();

    /* Belt */
    c.fillStyle = '#0a0a0a';
    c.fillRect(sx + 12, sy + 56, 40, 6);
    c.fillStyle = '#caa040';
    c.fillRect(sx + 30, sy + 57, 4, 4);

    /* Bellhop jacket — burgundy with double row of brass buttons */
    var jacketGrad = c.createLinearGradient(sx, sy + 26, sx, sy + 60);
    jacketGrad.addColorStop(0, '#a02038');
    jacketGrad.addColorStop(1, '#7a1828');
    c.fillStyle = jacketGrad;
    c.fillRect(sx + 10, sy + 26, 44, 32);
    /* Gold trim down both lapels */
    c.fillStyle = '#caa040';
    c.fillRect(sx + 18, sy + 28, 1.6, 28);
    c.fillRect(sx + 44, sy + 28, 1.6, 28);
    /* Brass button rows */
    c.fillStyle = '#fcd870';
    for (var bi = 0; bi < 4; bi++) {
      c.beginPath(); c.arc(sx + 22, sy + 32 + bi * 6, 1.6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(sx + 42, sy + 32 + bi * 6, 1.6, 0, Math.PI * 2); c.fill();
    }
    /* Shoulder epaulets */
    c.fillStyle = '#caa040';
    c.fillRect(sx + 8, sy + 26, 6, 6);
    c.fillRect(sx + 50, sy + 26, 6, 6);
    c.fillStyle = '#fcd870';
    c.fillRect(sx + 9, sy + 27, 4, 4);
    c.fillRect(sx + 51, sy + 27, 4, 4);
    /* Arms hanging at sides */
    c.fillStyle = '#a02038';
    c.fillRect(sx + 4, sy + 32, 8, 24);
    c.fillRect(sx + 52, sy + 32, 8, 24);
    /* White gloves */
    c.fillStyle = '#fafafa';
    c.beginPath(); c.arc(sx + 8, sy + 58, 4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 56, sy + 58, 4, 0, Math.PI * 2); c.fill();
    /* White wing collar + bow tie */
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(sx + 20, sy + 26);
    c.lineTo(sx + 32, sy + 30);
    c.lineTo(sx + 44, sy + 26);
    c.lineTo(sx + 40, sy + 30);
    c.lineTo(sx + 32, sy + 34);
    c.lineTo(sx + 24, sy + 30);
    c.closePath();
    c.fill();
    c.fillStyle = '#3a1010';
    c.beginPath();
    c.moveTo(sx + 26, sy + 30);
    c.lineTo(sx + 32, sy + 32);
    c.lineTo(sx + 38, sy + 30);
    c.lineTo(sx + 34, sy + 33);
    c.lineTo(sx + 30, sy + 33);
    c.closePath();
    c.fill();

    /* Neck */
    c.fillStyle = '#e8c8a8';
    c.fillRect(sx + 28, sy + 22, 8, 6);

    /* Head — round, full face */
    c.fillStyle = '#f0d4b0';
    c.beginPath(); c.arc(sx + 32, sy + 14, 13, 0, Math.PI * 2); c.fill();
    /* Soft jaw shadow */
    c.fillStyle = '#d8b890';
    c.beginPath(); c.arc(sx + 32, sy + 18, 11, 0.1, Math.PI - 0.1); c.fill();
    /* Hair — short brown side-parted */
    c.fillStyle = '#3a2010';
    c.beginPath();
    c.ellipse(sx + 32, sy + 6, 13, 7, 0, Math.PI, 0);
    c.fill();
    /* Hair part highlight */
    c.fillStyle = '#5a3018';
    c.beginPath();
    c.ellipse(sx + 30, sy + 4, 6, 3, -0.2, 0, Math.PI * 2);
    c.fill();
    /* Forehead skin showing under hairline */
    c.fillStyle = '#f0d4b0';
    c.fillRect(sx + 26, sy + 8, 12, 2);
    /* Ears */
    c.fillStyle = '#e8c8a8';
    c.beginPath(); c.arc(sx + 19, sy + 14, 2.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 45, sy + 14, 2.4, 0, Math.PI * 2); c.fill();
    /* Eyebrows */
    c.fillStyle = '#3a2010';
    c.fillRect(sx + 24, sy + 11, 5, 1.4);
    c.fillRect(sx + 35, sy + 11, 5, 1.4);
    /* Eyes — whites + iris + pupil + highlight */
    c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(sx + 27, sy + 14, 2.4, 2, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 37, sy + 14, 2.4, 2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3a4a78';
    c.beginPath(); c.arc(sx + 27, sy + 14, 1.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 37, sy + 14, 1.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0a0a0a';
    c.beginPath(); c.arc(sx + 27, sy + 14, 0.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 37, sy + 14, 0.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 26.5, sy + 13.5, 0.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 36.5, sy + 13.5, 0.4, 0, Math.PI * 2); c.fill();
    /* Nose */
    c.strokeStyle = '#b89870';
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(sx + 32, sy + 15);
    c.lineTo(sx + 31, sy + 18);
    c.lineTo(sx + 33, sy + 18);
    c.stroke();
    /* Mustache */
    c.fillStyle = '#3a2010';
    c.beginPath();
    c.moveTo(sx + 28, sy + 19);
    c.quadraticCurveTo(sx + 32, sy + 21, sx + 36, sy + 19);
    c.lineTo(sx + 35, sy + 20);
    c.quadraticCurveTo(sx + 32, sy + 21.4, sx + 29, sy + 20);
    c.closePath();
    c.fill();
    /* Mouth — friendly smile */
    c.strokeStyle = '#7a3838';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(sx + 32, sy + 21, 2.4, 0.2, Math.PI - 0.2);
    c.stroke();

    /* Bellhop pillbox cap — round, with chin strap and gold tassel */
    c.fillStyle = '#a02038';
    c.beginPath();
    c.ellipse(sx + 32, sy + 4, 13, 6, 0, Math.PI, 0);
    c.fill();
    c.fillRect(sx + 19, sy + 4, 26, 4);
    c.fillStyle = '#caa040';
    c.fillRect(sx + 19, sy + 7, 26, 1.6);
    /* Cap braid + tassel */
    c.strokeStyle = '#caa040';
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(sx + 18, sy + 7); c.lineTo(sx + 14, sy + 14);
    c.stroke();
    c.fillStyle = '#fcd870';
    c.beginPath(); c.arc(sx + 14, sy + 14, 1.4, 0, Math.PI * 2); c.fill();
    /* Cap front emblem */
    c.fillStyle = '#fcd870';
    c.beginPath();
    c.moveTo(sx + 32, sy);
    c.lineTo(sx + 30, sy + 4);
    c.lineTo(sx + 34, sy + 4);
    c.closePath();
    c.fill();

    /* Brass nametag on jacket */
    c.fillStyle = '#caa040';
    c.fillRect(sx + 28, sy + 38, 16, 5);
    c.fillStyle = '#1a1a1a';
    c.font = 'bold 4px monospace';
    c.textAlign = 'center';
    c.fillText('CONCIERGE', sx + 36, sy + 42);
    c.textAlign = 'left';

    /* Subtle face highlight (shading on right cheek) */
    c.save();
    c.globalAlpha = 0.25;
    c.fillStyle = '#ffe6d0';
    c.beginPath(); c.arc(sx + 28, sy + 12, 4, 0, Math.PI * 2); c.fill();
    c.restore();

    /* "Story Time?" callout when Momoko walks within range and the
       receptionist isn't already talking — surfaces the bookshelf cutscene
       so it isn't an undiscoverable easter egg. */
    var player = Game.player;
    if (player && !this.talking) {
      var dxp = player.x - this.x;
      var dyp = player.y - this.y;
      var pdist = Math.sqrt(dxp * dxp + dyp * dyp);
      if (pdist < 120) {
        var bob = Math.sin(this.timer * 0.07) * 2;
        var bx = sx + 32, by = sy - 32 + bob;
        var label = Game.i18n.t('storyTimePrompt') || 'Story Time?';
        c.save();
        c.font = 'bold 11px monospace';
        var tw = c.measureText(label).width + 18;
        var th = 20;
        c.fillStyle = '#fff8e0';
        c.strokeStyle = '#7a1828';
        c.lineWidth = 1.5;
        c.beginPath();
        var rx = bx - tw / 2, ry = by - th / 2;
        c.moveTo(rx + 6, ry);
        c.lineTo(rx + tw - 6, ry);
        c.quadraticCurveTo(rx + tw, ry, rx + tw, ry + 6);
        c.lineTo(rx + tw, ry + th - 6);
        c.quadraticCurveTo(rx + tw, ry + th, rx + tw - 6, ry + th);
        c.lineTo(rx + 6, ry + th);
        c.quadraticCurveTo(rx, ry + th, rx, ry + th - 6);
        c.lineTo(rx, ry + 6);
        c.quadraticCurveTo(rx, ry, rx + 6, ry);
        c.fill();
        c.stroke();
        /* Tail pointing down to the receptionist's hat */
        c.beginPath();
        c.moveTo(bx - 4, ry + th);
        c.lineTo(bx + 4, ry + th);
        c.lineTo(bx, ry + th + 6);
        c.closePath();
        c.fillStyle = '#fff8e0';
        c.fill();
        c.strokeStyle = '#7a1828';
        c.beginPath();
        c.moveTo(bx - 4, ry + th);
        c.lineTo(bx, ry + th + 6);
        c.lineTo(bx + 4, ry + th);
        c.stroke();
        /* Text */
        c.fillStyle = '#7a1828';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(label, bx, by);
        c.textAlign = 'left';
        c.textBaseline = 'alphabetic';
        c.restore();
      }
    }
  };

  /* ========== CHANDELIER MONKEY (decoration NPC dangling from a chandelier) ========== */
  function ChandelierMonkey(x, y, isEscort) {
    this.x = x;
    this.y = y;
    this.spawnX = x;
    this.spawnY = y;
    this.w = 20;
    this.h = 24;
    this.timer = Math.random() * 100;
    this.talking = false;
    this.talkTimer = 0;
    this.currentText = '';
    this.escort = !!isEscort;
  }

  ChandelierMonkey.prototype.update = function () {
    this.timer++;
    /* Gentle swing while hanging */
    this.x = this.spawnX + Math.sin(this.timer * 0.04) * 8;
    this.y = this.spawnY + Math.cos(this.timer * 0.04) * 2;
    if (this.talking) {
      this.talkTimer--;
      if (this.talkTimer <= 0) this.talking = false;
    }
  };

  ChandelierMonkey.prototype.interact = function () {
    this.talking = true;
    this.talkTimer = 240;
    this.currentText = Game.i18n.t('monkeySound');
    if (Game.audio && Game.audio.play) Game.audio.play('monkey');
  };

  ChandelierMonkey.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    /* Drawn upside-down hanging — but for simplicity render right-side-up
       with a tail curl up to the chandelier. */
    drawMonkeySprite(c, sx - 12, sy);
    /* Tail curling up to the chandelier */
    c.strokeStyle = ANIMAL_PALETTES.monkey.body;
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(sx, sy + 10);
    c.quadraticCurveTo(sx + 6, sy - 14, sx, sy - 28);
    c.stroke();
  };

  /* ========== ELEVATOR (interactable that opens the floor menu) ========== */
  function Elevator(x, y) {
    this.x = x;
    this.y = y;
    this.w = 56;
    this.h = 60;
    this.timer = 0;
    this.talking = false;
  }

  Elevator.prototype.update = function () { this.timer++; };
  Elevator.prototype.interact = function () { /* handled by engine */ };

  Elevator.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    /* Shaft frame */
    c.fillStyle = '#2a1810';
    c.fillRect(sx - 4, sy - 4, 64, 68);
    /* Brass surround */
    c.fillStyle = '#caa040';
    c.fillRect(sx - 2, sy - 2, 60, 64);
    /* Doors (split) */
    c.fillStyle = '#5a3a18';
    c.fillRect(sx + 2, sy + 2, 26, 56);
    c.fillRect(sx + 30, sy + 2, 26, 56);
    /* Door panel inlays */
    c.strokeStyle = '#caa040';
    c.lineWidth = 1.2;
    c.strokeRect(sx + 6, sy + 8, 18, 44);
    c.strokeRect(sx + 34, sy + 8, 18, 44);
    /* Up arrow indicator */
    var blink = Math.sin(this.timer * 0.1) > 0;
    c.fillStyle = blink ? '#ffd24a' : '#664422';
    c.beginPath();
    c.moveTo(sx + 28, sy - 8);
    c.lineTo(sx + 23, sy - 2);
    c.lineTo(sx + 33, sy - 2);
    c.closePath();
    c.fill();
    /* Bobbing speech-bubble prompt */
    var bob = Math.sin(this.timer * 0.08) * 2;
    c.fillStyle = '#44ffff';
    var hcx = sx + 28, hcy = sy - 18 + bob;
    c.beginPath();
    c.arc(hcx - 2.4, hcy - 1, 2.4, 0, Math.PI * 2);
    c.arc(hcx + 2.4, hcy - 1, 2.4, 0, Math.PI * 2);
    c.moveTo(hcx - 4.4, hcy);
    c.lineTo(hcx, hcy + 4.4);
    c.lineTo(hcx + 4.4, hcy);
    c.closePath();
    c.fill();
  };

  /* ========== STAIRS (interactable that jumps to next floor) ========== */
  function Stairs(x, y, dir) {
    this.x = x;
    this.y = y;
    this.w = 50;
    this.h = 58;
    this.dir = dir || 'both'; /* 'up' | 'down' | 'both' */
    this.timer = 0;
    this.talking = false;
  }

  Stairs.prototype.update = function () { this.timer++; };
  Stairs.prototype.interact = function () { /* handled by engine */ };

  Stairs.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    /* Doorway */
    c.fillStyle = '#2a1810';
    c.fillRect(sx, sy - 4, 50, 60);
    c.fillStyle = '#3a2418';
    c.fillRect(sx + 4, sy, 42, 52);
    /* Step lines */
    c.fillStyle = '#5a3a22';
    for (var i = 0; i < 5; i++) {
      c.fillRect(sx + 6 + i * 2, sy + 12 + i * 6, 36 - i * 4, 3);
    }
    /* Sign */
    c.fillStyle = '#ffd24a';
    c.fillRect(sx + 8, sy - 14, 34, 12);
    c.strokeStyle = '#5a3a18';
    c.lineWidth = 1.2;
    c.strokeRect(sx + 8, sy - 14, 34, 12);
    c.fillStyle = '#1a1a1a';
    c.font = 'bold 8px monospace';
    c.textAlign = 'center';
    c.fillText('STAIRS', sx + 25, sy - 6);
    c.textAlign = 'left';
  };

  /* ========== BEDROOM BED (placed inside Momoko's room, triggers sleep cutscene) ========== */
  function BedroomBed(x, y) {
    this.x = x;
    this.y = y;
    this.w = 80;
    this.h = 36;
    this.timer = 0;
    this.talking = false;
  }

  BedroomBed.prototype.update = function () { this.timer++; };
  BedroomBed.prototype.interact = function () { /* handled by engine — triggers sleep */ };

  BedroomBed.prototype.draw = function (c, camX, camY) {
    var sx = Math.round(this.x - camX);
    var sy = Math.round(this.y - camY);
    /* Bed frame */
    c.fillStyle = '#5a3a18';
    c.fillRect(sx, sy + 12, 80, 24);
    /* Headboard */
    c.fillRect(sx, sy, 14, 36);
    /* Mattress */
    c.fillStyle = '#fff0d8';
    c.fillRect(sx + 14, sy + 14, 60, 16);
    /* Pillow */
    c.fillStyle = '#ffffff';
    c.fillRect(sx + 16, sy + 16, 18, 10);
    /* Pink quilt with hearts */
    c.fillStyle = '#ff99cc';
    c.fillRect(sx + 36, sy + 16, 36, 14);
    c.fillStyle = '#ffffff';
    for (var i = 0; i < 3; i++) {
      var hcx = sx + 42 + i * 10, hcy = sy + 22;
      c.beginPath();
      c.arc(hcx - 2, hcy - 1, 1.6, 0, Math.PI * 2);
      c.arc(hcx + 2, hcy - 1, 1.6, 0, Math.PI * 2);
      c.moveTo(hcx - 3, hcy);
      c.lineTo(hcx, hcy + 3);
      c.lineTo(hcx + 3, hcy);
      c.closePath();
      c.fill();
    }
    /* Bobbing ZZZ prompt */
    var bob = Math.sin(this.timer * 0.08) * 2;
    c.fillStyle = '#88ddff';
    c.font = 'bold 12px monospace';
    c.fillText('ZZZ', sx + 32, sy - 8 + bob);
  };

  window.Game.entities = {
    Momoko: Momoko,
    Bubble: Bubble,
    Fish: Fish,
    Oliver: Oliver,
    KittyCorn: KittyCorn,
    Bob: Bob,
    Crab: Crab,
    Wolfe: Wolfe,
    Lila: Lila,
    MigWord: MigWord,
    MoonMouse: MoonMouse,
    RocketShip: RocketShip,
    HouseDoor: HouseDoor,
    CafeDoor: CafeDoor,
    ShopDoor: ShopDoor,
    HeartPickup: HeartPickup,
    Particle: Particle,
    AmbientBubble: AmbientBubble,
    spawnBurst: spawnBurst,
    drawMomokoSprite: drawMomokoSprite,
    drawMomokoFloss: drawMomokoFloss,
    drawCrabPet: drawCrabPet,
    /* Hotel zoo entities */
    Animal: Animal,
    AnimalDoor: AnimalDoor,
    Receptionist: Receptionist,
    ChandelierMonkey: ChandelierMonkey,
    Elevator: Elevator,
    Stairs: Stairs,
    BedroomBed: BedroomBed,
    drawAnimalSprite: drawAnimalSprite,
    ANIMAL_PALETTES: ANIMAL_PALETTES,
  };
})();
