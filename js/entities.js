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
    c.font = 'bold 4.5px "M PLUS Rounded 1c", sans-serif';
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
    c.font = 'bold 8px "M PLUS Rounded 1c", sans-serif';
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
    c.font = 'bold 8px "M PLUS Rounded 1c", sans-serif';
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

  /* ---- Shared helpers for the species painters ---- */
  /* Soft ground shadow under an animal's feet. */
  function groundShadow(c, cx, cy, rx, ry) {
    c.save(); c.globalAlpha = 0.22; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(cx, cy, rx, ry || 3, 0, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  /* Vertical gradient: `top` colour at y0 fading to `bottom` at y1. */
  function vGrad(c, y0, y1, top, bottom) {
    var g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    return g;
  }
  /* Filled ellipse. */
  function blob(c, x, y, rx, ry, rot, fill) {
    c.fillStyle = fill;
    c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); c.fill();
  }
  /* Round-capped straight stroke: legs, arms, necks, tails. */
  function limb(c, x0, y0, x1, y1, w, color) {
    c.save(); c.strokeStyle = color; c.lineWidth = w; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.restore();
  }
  /* Round-capped quadratic curve through control point (cx, cy). */
  function curve(c, x0, y0, cx, cy, x1, y1, w, color) {
    c.save(); c.strokeStyle = color; c.lineWidth = w; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1); c.stroke(); c.restore();
  }

  /* ========== Per-species painters ========== */
  /* ========== Per-species painters: elephant, lion, tiger, bear, wolf, fox, cat ========== */

  function drawElephantSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.elephant;
    var DARK = '#55616c';
    groundShadow(c, sx + 22, sy + 45, 23, 3.4);
    /* Tail with tuft (behind body) */
    limb(c, sx + 44, sy + 20, sx + 47, sy + 34, 1.6, p.shade);
    blob(c, sx + 47.5, sy + 35, 2, 2.6, 0, DARK);
    /* Far-side legs — thick columns */
    c.fillStyle = p.shade;
    c.fillRect(sx + 19, sy + 28, 7, 16);
    c.fillRect(sx + 39, sy + 28, 7, 16);
    /* Massive barrel body */
    c.fillStyle = vGrad(c, sy + 8, sy + 40, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 27, sy + 24, 19, 15, 0, 0, Math.PI * 2); c.fill();
    /* Back highlight */
    c.save(); c.globalAlpha = 0.28;
    blob(c, sx + 27, sy + 14, 12, 4, 0, '#ffffff');
    c.restore();
    /* Near-side legs */
    c.fillStyle = vGrad(c, sy + 28, sy + 44, p.body, p.shade);
    c.fillRect(sx + 11, sy + 28, 7.5, 16);
    c.fillRect(sx + 31, sy + 28, 7.5, 16);
    /* Knee wrinkles */
    c.strokeStyle = DARK; c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(sx + 12, sy + 35); c.lineTo(sx + 18, sy + 35);
    c.moveTo(sx + 12.5, sy + 37); c.lineTo(sx + 17.5, sy + 37);
    c.moveTo(sx + 32, sy + 35); c.lineTo(sx + 38, sy + 35);
    c.moveTo(sx + 32.5, sy + 37); c.lineTo(sx + 37.5, sy + 37);
    c.stroke();
    /* Toenails */
    c.fillStyle = '#f4f0e4';
    var tn;
    for (tn = 0; tn < 3; tn++) {
      blob(c, sx + 12.5 + tn * 2.3, sy + 43.2, 1, 1.2, 0, '#f4f0e4');
      blob(c, sx + 32.5 + tn * 2.3, sy + 43.2, 1, 1.2, 0, '#f4f0e4');
      blob(c, sx + 20.5 + tn * 2.3, sy + 43.2, 0.9, 1, 0, '#d8d4c8');
      blob(c, sx + 40.5 + tn * 2.3, sy + 43.2, 0.9, 1, 0, '#d8d4c8');
    }
    /* Head */
    c.fillStyle = vGrad(c, sy + 6, sy + 28, p.body, p.shade);
    c.beginPath(); c.arc(sx + 9, sy + 16, 10.5, 0, Math.PI * 2); c.fill();
    /* Big fan ear over the back half of the head */
    blob(c, sx + 16, sy + 16, 7.5, 11, 0.15, p.shade);
    blob(c, sx + 16.5, sy + 16.5, 5, 8, 0.15, p.accent);
    /* Trunk — long, curling down and forward */
    c.fillStyle = vGrad(c, sy + 16, sy + 42, p.body, p.shade);
    c.beginPath();
    c.moveTo(sx + 2, sy + 14);
    c.quadraticCurveTo(sx - 7, sy + 22, sx - 8, sy + 34);
    c.quadraticCurveTo(sx - 8.5, sy + 41, sx - 3, sy + 42);
    c.quadraticCurveTo(sx + 0.5, sy + 42, sx - 1.5, sy + 38);
    c.quadraticCurveTo(sx - 3.5, sy + 33, sx - 1.5, sy + 26);
    c.quadraticCurveTo(sx + 1, sy + 20, sx + 6, sy + 22);
    c.closePath();
    c.fill();
    /* Trunk ring creases */
    c.strokeStyle = DARK; c.lineWidth = 0.7;
    var ts;
    for (ts = 0; ts < 5; ts++) {
      c.beginPath();
      c.moveTo(sx - 6.8 + ts * 0.1, sy + 24 + ts * 3.2);
      c.lineTo(sx - 1.6 - ts * 0.3, sy + 23 + ts * 3.2);
      c.stroke();
    }
    /* Tusk — small ivory curve beside the trunk root */
    c.fillStyle = '#fbf6e6';
    c.beginPath();
    c.moveTo(sx + 2.5, sy + 22);
    c.quadraticCurveTo(sx + 0.5, sy + 27, sx - 2.5, sy + 30);
    c.lineTo(sx - 1, sy + 31);
    c.quadraticCurveTo(sx + 2.5, sy + 28, sx + 5, sy + 23);
    c.closePath();
    c.fill();
    /* Eye with lashes */
    eye(c, sx + 5.5, sy + 14, 1.7);
    c.strokeStyle = '#2a2a2a'; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx + 4, sy + 11.8); c.lineTo(sx + 3.2, sy + 10.8);
    c.moveTo(sx + 5.5, sy + 11.4); c.lineTo(sx + 5.4, sy + 10.3);
    c.stroke();
  }

  function drawLionSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.lion;
    var MANE = '#b5742c';
    groundShadow(c, sx + 24, sy + 45, 22, 3.2);
    /* Tail with dark tuft */
    curve(c, sx + 43, sy + 23, sx + 51, sy + 27, sx + 49, sy + 37, 1.8, p.shade);
    blob(c, sx + 49, sy + 38.5, 2.6, 3, 0, p.accent);
    /* Far legs */
    limb(c, sx + 20, sy + 30, sx + 20, sy + 42, 4.5, p.shade);
    limb(c, sx + 40, sy + 30, sx + 40, sy + 42, 4.5, p.shade);
    /* Body — long, muscular */
    c.fillStyle = vGrad(c, sy + 14, sy + 38, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 29, sy + 26, 16, 10.5, 0, 0, Math.PI * 2); c.fill();
    /* Belly highlight */
    c.save(); c.globalAlpha = 0.4;
    blob(c, sx + 30, sy + 31, 10, 4, 0, '#fff0c8');
    c.restore();
    /* Near legs with big paws */
    limb(c, sx + 15, sy + 30, sx + 15, sy + 42, 5, p.body);
    limb(c, sx + 35, sy + 30, sx + 35, sy + 42, 5, p.body);
    blob(c, sx + 14.5, sy + 42.6, 3.6, 1.8, 0, p.body);
    blob(c, sx + 34.5, sy + 42.6, 3.6, 1.8, 0, p.body);
    blob(c, sx + 20, sy + 42.6, 3, 1.5, 0, p.shade);
    blob(c, sx + 40, sy + 42.6, 3, 1.5, 0, p.shade);
    /* Mane — round halo of overlapping lobes, darker at the rim */
    var i, a, mx, my;
    for (i = 0; i < 12; i++) {
      a = i * Math.PI / 6 + 0.26;
      mx = sx + 11 + Math.cos(a) * 11.5;
      my = sy + 18 + Math.sin(a) * 11.5;
      blob(c, mx, my, 4.2, 4.2, 0, p.accent);
    }
    var mg = c.createRadialGradient(sx + 11, sy + 17, 3, sx + 11, sy + 18, 14);
    mg.addColorStop(0, MANE); mg.addColorStop(1, p.accent);
    c.fillStyle = mg;
    c.beginPath(); c.arc(sx + 11, sy + 18, 13, 0, Math.PI * 2); c.fill();
    /* Mane spilling onto chest */
    blob(c, sx + 16, sy + 30, 6, 4.5, -0.4, p.accent);
    /* Ears peeking from the mane */
    blob(c, sx + 3.5, sy + 9.5, 2.6, 2.6, 0, p.body);
    blob(c, sx + 17, sy + 9.5, 2.6, 2.6, 0, p.body);
    blob(c, sx + 3.5, sy + 9.8, 1.3, 1.3, 0, p.shade);
    blob(c, sx + 17, sy + 9.8, 1.3, 1.3, 0, p.shade);
    /* Face */
    c.fillStyle = vGrad(c, sy + 9, sy + 27, p.body, '#d9a24e');
    c.beginPath(); c.arc(sx + 10, sy + 18, 8.5, 0, Math.PI * 2); c.fill();
    /* Square muzzle */
    blob(c, sx + 5, sy + 22.5, 5.5, 3.8, 0, '#f6dcae');
    c.fillStyle = '#5a3418';
    c.beginPath();
    c.moveTo(sx + 1.5, sy + 20.5); c.lineTo(sx + 6.5, sy + 20.5); c.lineTo(sx + 4, sy + 23.2); c.closePath(); c.fill();
    c.strokeStyle = '#5a3418'; c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(sx + 4, sy + 23.2); c.lineTo(sx + 4, sy + 24.6);
    c.moveTo(sx + 1.5, sy + 25.6); c.quadraticCurveTo(sx + 4, sy + 26.8, sx + 6.5, sy + 25.6);
    c.stroke();
    /* Eyes */
    realEye(c, sx + 7, sy + 16.5, 1.6, '#7a4a18');
    realEye(c, sx + 13, sy + 16.5, 1.6, '#7a4a18');
    /* Brow */
    c.strokeStyle = '#8a5a28'; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx + 5.5, sy + 14); c.lineTo(sx + 8.5, sy + 13.6);
    c.moveTo(sx + 11.5, sy + 13.6); c.lineTo(sx + 14.5, sy + 14);
    c.stroke();
  }

  function drawTigerSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.tiger;
    var WHITE = '#fff4e6';
    groundShadow(c, sx + 25, sy + 45, 23, 3.2);
    /* Long striped tail curling up behind */
    curve(c, sx + 45, sy + 25, sx + 54, sy + 28, sx + 51, sy + 14, 2.6, p.body);
    var t, tx, ty;
    for (t = 0; t < 4; t++) {
      tx = sx + 49 + Math.cos(0.9 - t * 0.5) * 2.3;
      ty = sy + 26 - t * 3.3;
      blob(c, tx, ty, 1.5, 1.1, 0.4, p.accent);
    }
    blob(c, sx + 51, sy + 13.5, 1.4, 1.4, 0, p.accent);
    /* Far legs */
    limb(c, sx + 19, sy + 30, sx + 19, sy + 42, 4.2, p.shade);
    limb(c, sx + 41, sy + 30, sx + 41, sy + 42, 4.2, p.shade);
    /* Body — longer and leaner than the lion */
    c.fillStyle = vGrad(c, sy + 16, sy + 38, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 29, sy + 27, 18, 9.5, 0, 0, Math.PI * 2); c.fill();
    /* White belly */
    blob(c, sx + 30, sy + 33, 12, 3.8, 0, WHITE);
    /* Near legs */
    limb(c, sx + 13, sy + 30, sx + 13, sy + 42, 4.6, p.body);
    limb(c, sx + 36, sy + 30, sx + 36, sy + 42, 4.6, p.body);
    blob(c, sx + 12.8, sy + 42.6, 3.3, 1.7, 0, WHITE);
    blob(c, sx + 35.8, sy + 42.6, 3.3, 1.7, 0, WHITE);
    blob(c, sx + 19, sy + 42.6, 2.8, 1.4, 0, '#e8d8c8');
    blob(c, sx + 41, sy + 42.6, 2.8, 1.4, 0, '#e8d8c8');
    /* Body stripes — bold tapered black arcs */
    c.fillStyle = p.accent;
    var s, bx;
    for (s = 0; s < 5; s++) {
      bx = sx + 20 + s * 5.2;
      c.beginPath();
      c.moveTo(bx, sy + 18.5 + (s === 0 || s === 4 ? 1 : 0));
      c.quadraticCurveTo(bx - 2.2, sy + 24, bx - 0.4, sy + 30);
      c.quadraticCurveTo(bx + 0.4, sy + 24, bx + 1.8, sy + 18.5 + (s === 0 || s === 4 ? 1 : 0));
      c.closePath();
      c.fill();
    }
    /* Leg stripes */
    c.strokeStyle = p.accent; c.lineWidth = 1.1;
    c.beginPath();
    c.moveTo(sx + 11, sy + 34); c.lineTo(sx + 15, sy + 34);
    c.moveTo(sx + 11, sy + 37.5); c.lineTo(sx + 15, sy + 37.5);
    c.moveTo(sx + 34, sy + 34); c.lineTo(sx + 38, sy + 34);
    c.moveTo(sx + 34, sy + 37.5); c.lineTo(sx + 38, sy + 37.5);
    c.stroke();
    /* Head */
    c.fillStyle = vGrad(c, sy + 9, sy + 28, p.body, '#d9743a');
    c.beginPath(); c.arc(sx + 10, sy + 19, 9, 0, Math.PI * 2); c.fill();
    /* Round ears with white inner */
    blob(c, sx + 3.5, sy + 11.5, 3, 3, 0, p.body);
    blob(c, sx + 16.5, sy + 11.5, 3, 3, 0, p.body);
    blob(c, sx + 3.5, sy + 11.8, 1.6, 1.6, 0, WHITE);
    blob(c, sx + 16.5, sy + 11.8, 1.6, 1.6, 0, WHITE);
    /* Forehead stripes */
    c.strokeStyle = p.accent; c.lineWidth = 1;
    c.beginPath();
    c.moveTo(sx + 10, sy + 10.5); c.lineTo(sx + 10, sy + 13.5);
    c.moveTo(sx + 7.3, sy + 11.3); c.lineTo(sx + 7.8, sy + 13.8);
    c.moveTo(sx + 12.7, sy + 11.3); c.lineTo(sx + 12.2, sy + 13.8);
    c.stroke();
    /* Cheek stripes */
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(sx + 2, sy + 17); c.lineTo(sx + 4.5, sy + 18.2);
    c.moveTo(sx + 18, sy + 17); c.lineTo(sx + 15.5, sy + 18.2);
    c.stroke();
    /* White eye patches + muzzle */
    blob(c, sx + 6.5, sy + 17.5, 2.6, 2.1, 0, WHITE);
    blob(c, sx + 13.5, sy + 17.5, 2.6, 2.1, 0, WHITE);
    blob(c, sx + 10, sy + 23, 5.6, 3.8, 0, WHITE);
    /* Pink nose + mouth */
    c.fillStyle = '#e88aa0';
    c.beginPath();
    c.moveTo(sx + 8, sy + 21.3); c.lineTo(sx + 12, sy + 21.3); c.lineTo(sx + 10, sy + 23.4); c.closePath(); c.fill();
    c.strokeStyle = '#6a3a20'; c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(sx + 10, sy + 23.4); c.lineTo(sx + 10, sy + 24.6);
    c.moveTo(sx + 7.5, sy + 25.4); c.quadraticCurveTo(sx + 10, sy + 26.8, sx + 12.5, sy + 25.4);
    c.stroke();
    /* Whiskers attached to the muzzle */
    c.strokeStyle = '#3a2a20'; c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(sx + 6, sy + 23); c.lineTo(sx + 1, sy + 22);
    c.moveTo(sx + 6, sy + 24.2); c.lineTo(sx + 1.2, sy + 25);
    c.moveTo(sx + 14, sy + 23); c.lineTo(sx + 19, sy + 22);
    c.moveTo(sx + 14, sy + 24.2); c.lineTo(sx + 18.8, sy + 25);
    c.stroke();
    /* Eyes */
    realEye(c, sx + 6.8, sy + 17.6, 1.5, '#c8a030');
    realEye(c, sx + 13.2, sy + 17.6, 1.5, '#c8a030');
  }

  function drawBearSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.bear;
    groundShadow(c, sx + 23, sy + 45, 22, 3.4);
    /* Stubby tail */
    blob(c, sx + 44, sy + 24, 2.8, 2.4, 0, p.shade);
    /* Far legs — thick */
    c.fillStyle = p.shade;
    c.beginPath(); c.roundRect ? c.roundRect(sx + 18, sy + 28, 7, 16, 2.5) : c.rect(sx + 18, sy + 28, 7, 16); c.fill();
    c.beginPath(); c.roundRect ? c.roundRect(sx + 38, sy + 28, 7, 16, 2.5) : c.rect(sx + 38, sy + 28, 7, 16); c.fill();
    /* Body with a heavy shoulder hump */
    c.fillStyle = vGrad(c, sy + 8, sy + 40, p.body, p.shade);
    c.beginPath();
    c.moveTo(sx + 10, sy + 36);
    c.quadraticCurveTo(sx + 8, sy + 20, sx + 15, sy + 12);
    c.quadraticCurveTo(sx + 21, sy + 7, sx + 28, sy + 11);
    c.quadraticCurveTo(sx + 40, sy + 12, sx + 45, sy + 24);
    c.quadraticCurveTo(sx + 47, sy + 34, sx + 38, sy + 38);
    c.lineTo(sx + 14, sy + 38);
    c.closePath();
    c.fill();
    /* Fur highlight along the hump */
    c.save(); c.globalAlpha = 0.22;
    blob(c, sx + 22, sy + 13, 8, 3, 0.2, '#ffe0b0');
    c.restore();
    /* Near legs with big paws and claws */
    c.fillStyle = vGrad(c, sy + 28, sy + 44, p.body, p.shade);
    c.beginPath(); c.roundRect ? c.roundRect(sx + 10, sy + 28, 8, 16, 3) : c.rect(sx + 10, sy + 28, 8, 16); c.fill();
    c.beginPath(); c.roundRect ? c.roundRect(sx + 30, sy + 28, 8, 16, 3) : c.rect(sx + 30, sy + 28, 8, 16); c.fill();
    blob(c, sx + 13, sy + 43, 5, 1.8, 0, p.shade);
    blob(c, sx + 33, sy + 43, 5, 1.8, 0, p.shade);
    c.fillStyle = '#f0e6d0';
    var cl;
    for (cl = 0; cl < 3; cl++) {
      c.fillRect(sx + 9.5 + cl * 2.4, sy + 42.6, 1, 1.6);
      c.fillRect(sx + 29.5 + cl * 2.4, sy + 42.6, 1, 1.6);
    }
    /* Head — carried low, in front of the hump */
    c.fillStyle = vGrad(c, sy + 12, sy + 32, p.body, p.shade);
    c.beginPath(); c.arc(sx + 9, sy + 23, 9, 0, Math.PI * 2); c.fill();
    /* Small round ears */
    blob(c, sx + 4, sy + 15, 3, 3, 0, p.body);
    blob(c, sx + 14.5, sy + 14.5, 3, 3, 0, p.body);
    blob(c, sx + 4, sy + 15.3, 1.5, 1.5, 0, p.accent);
    blob(c, sx + 14.5, sy + 14.8, 1.5, 1.5, 0, p.accent);
    /* Long straight muzzle */
    blob(c, sx + 1.5, sy + 26, 6, 4.2, 0.1, p.accent);
    /* Big black nose */
    blob(c, sx - 3, sy + 24.5, 2.6, 2, 0, '#1a1410');
    blob(c, sx - 3.8, sy + 23.9, 0.7, 0.5, 0, '#6a6060');
    /* Mouth */
    c.strokeStyle = '#4a2a10'; c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(sx - 2, sy + 26.6); c.lineTo(sx - 1.5, sy + 28);
    c.moveTo(sx - 4, sy + 28.6); c.quadraticCurveTo(sx - 1.5, sy + 30, sx + 1.5, sy + 28.4);
    c.stroke();
    /* Eyes — small and kind */
    eye(c, sx + 5.5, sy + 20.5, 1.5);
    eye(c, sx + 11.5, sy + 20, 1.5);
    /* Honey pot by the front paw */
    c.fillStyle = '#e2b866';
    c.beginPath(); c.roundRect ? c.roundRect(sx + 18, sy + 37, 6, 6.5, 1.5) : c.rect(sx + 18, sy + 37, 6, 6.5); c.fill();
    c.fillStyle = '#b8882c';
    c.fillRect(sx + 17.5, sy + 36.5, 7, 1.6);
    blob(c, sx + 21, sy + 40.5, 1.8, 1.2, 0, '#f6c84a');
  }

  function drawWolfSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.wolf;
    var PALE = p.accent;
    var DARK = '#3e4050';
    groundShadow(c, sx + 24, sy + 45, 20, 2.8);
    /* Bushy tail hanging down and out */
    blob(c, sx + 45, sy + 32, 4.2, 8.5, -0.25, p.shade);
    blob(c, sx + 44.5, sy + 31, 2.8, 6, -0.25, p.body);
    blob(c, sx + 47.5, sy + 39.5, 2.2, 2.6, -0.25, PALE);
    /* Far legs — long and thin */
    limb(c, sx + 18, sy + 29, sx + 20, sy + 42.5, 3.2, p.shade);
    limb(c, sx + 38, sy + 29, sx + 40, sy + 42.5, 3.2, p.shade);
    /* Body — deep chest, narrow waist, lean hips */
    c.fillStyle = vGrad(c, sy + 14, sy + 36, p.body, p.shade);
    c.beginPath();
    c.moveTo(sx + 12, sy + 16);
    c.quadraticCurveTo(sx + 26, sy + 13, sx + 40, sy + 18);
    c.quadraticCurveTo(sx + 46, sy + 22, sx + 42, sy + 31);
    c.quadraticCurveTo(sx + 36, sy + 33, sx + 30, sy + 30);
    c.quadraticCurveTo(sx + 24, sy + 30, sx + 20, sy + 34);
    c.quadraticCurveTo(sx + 9, sy + 32, sx + 10, sy + 22);
    c.closePath();
    c.fill();
    /* Pale underside running from chest to belly */
    c.save(); c.globalAlpha = 0.7;
    c.fillStyle = PALE;
    c.beginPath();
    c.moveTo(sx + 11, sy + 27);
    c.quadraticCurveTo(sx + 16, sy + 34.5, sx + 22, sy + 31.5);
    c.quadraticCurveTo(sx + 28, sy + 29.5, sx + 36, sy + 31.5);
    c.quadraticCurveTo(sx + 28, sy + 33.5, sx + 20, sy + 34);
    c.quadraticCurveTo(sx + 12, sy + 33, sx + 11, sy + 27);
    c.closePath();
    c.fill();
    c.restore();
    /* Near legs */
    limb(c, sx + 14, sy + 29, sx + 13, sy + 42.5, 3.6, p.body);
    limb(c, sx + 34, sy + 29, sx + 35, sy + 42.5, 3.6, p.body);
    blob(c, sx + 12.8, sy + 43, 2.6, 1.3, 0, PALE);
    blob(c, sx + 35.2, sy + 43, 2.6, 1.3, 0, PALE);
    blob(c, sx + 20, sy + 43, 2.2, 1.1, 0, '#b8bac4');
    blob(c, sx + 40, sy + 43, 2.2, 1.1, 0, '#b8bac4');
    /* Neck ruff joining head to chest */
    blob(c, sx + 13, sy + 20, 7, 6, -0.5, p.body);
    /* Pointed upright ears */
    c.fillStyle = p.body;
    c.beginPath(); c.moveTo(sx + 5.5, sy + 13); c.lineTo(sx + 7, sy + 3.5); c.lineTo(sx + 11, sy + 11.5); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(sx + 11.5, sy + 12); c.lineTo(sx + 14.5, sy + 3.5); c.lineTo(sx + 17, sy + 13); c.closePath(); c.fill();
    c.fillStyle = '#c8a0a8';
    c.beginPath(); c.moveTo(sx + 7, sy + 12); c.lineTo(sx + 7.6, sy + 6.5); c.lineTo(sx + 10, sy + 11.5); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(sx + 12.8, sy + 11.8); c.lineTo(sx + 14.3, sy + 6.5); c.lineTo(sx + 15.6, sy + 12); c.closePath(); c.fill();
    /* Head — skull plus long pointed muzzle */
    c.fillStyle = vGrad(c, sy + 9, sy + 24, p.body, p.shade);
    c.beginPath(); c.arc(sx + 11, sy + 16, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.body;
    c.beginPath();
    c.moveTo(sx + 8, sy + 11.5);
    c.quadraticCurveTo(sx + 1, sy + 14, sx - 4, sy + 19.5);
    c.quadraticCurveTo(sx + 1, sy + 23, sx + 8, sy + 22);
    c.closePath();
    c.fill();
    /* Pale cheek and lower jaw */
    c.fillStyle = PALE;
    c.beginPath();
    c.moveTo(sx + 7, sy + 19);
    c.quadraticCurveTo(sx + 1.5, sy + 19.5, sx - 3.2, sy + 20);
    c.quadraticCurveTo(sx + 1, sy + 23, sx + 8, sy + 22.5);
    c.closePath();
    c.fill();
    blob(c, sx + 12, sy + 21, 4.5, 3, 0, PALE);
    /* Nose + mouth */
    blob(c, sx - 3.6, sy + 18.8, 1.7, 1.3, 0, DARK);
    c.strokeStyle = DARK; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(sx - 2.5, sy + 20.2); c.quadraticCurveTo(sx + 0.5, sy + 21.4, sx + 3, sy + 20.6); c.stroke();
    /* Dark brow / forehead marking */
    c.save(); c.globalAlpha = 0.5;
    blob(c, sx + 11, sy + 12.5, 4.5, 2.2, 0, DARK);
    c.restore();
    /* Amber eye */
    realEye(c, sx + 7.8, sy + 15.2, 1.4, '#d8a030');
    realEye(c, sx + 13.4, sy + 14.8, 1.3, '#d8a030');
  }

  function drawFoxSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.fox;
    var WHITE = p.accent;
    var BLACK = '#2a1a14';
    groundShadow(c, sx + 26, sy + 45, 20, 2.8);
    /* Big brush tail carried out behind, white tip */
    blob(c, sx + 40, sy + 31, 12, 6.2, -0.28, p.body);
    blob(c, sx + 40, sy + 33.5, 10, 3, -0.28, p.shade);
    blob(c, sx + 49.5, sy + 28.2, 3.8, 3.4, -0.28, WHITE);
    /* Far legs — black stockings */
    limb(c, sx + 19, sy + 31, sx + 20, sy + 42.5, 2.6, p.shade);
    limb(c, sx + 29, sy + 31, sx + 30, sy + 42.5, 2.6, p.shade);
    limb(c, sx + 19.6, sy + 37, sx + 20, sy + 42.5, 2.6, BLACK);
    limb(c, sx + 29.6, sy + 37, sx + 30, sy + 42.5, 2.6, BLACK);
    /* Slim body */
    c.fillStyle = vGrad(c, sy + 21, sy + 37, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 23, sy + 29.5, 11.5, 7, 0.05, 0, Math.PI * 2); c.fill();
    /* White chest / throat */
    blob(c, sx + 15, sy + 29, 5, 5.5, 0.3, WHITE);
    /* Near legs */
    limb(c, sx + 15, sy + 31, sx + 14, sy + 42.5, 3, p.body);
    limb(c, sx + 26, sy + 31, sx + 26, sy + 42.5, 3, p.body);
    limb(c, sx + 14.4, sy + 36.5, sx + 14, sy + 42.5, 3, BLACK);
    limb(c, sx + 26, sy + 36.5, sx + 26, sy + 42.5, 3, BLACK);
    /* Head — small, with a narrow pointed muzzle */
    c.fillStyle = vGrad(c, sy + 14, sy + 27, p.body, '#c0622c');
    c.beginPath(); c.arc(sx + 9, sy + 20.5, 6.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.body;
    c.beginPath();
    c.moveTo(sx + 6, sy + 16.5);
    c.quadraticCurveTo(sx + 0.5, sy + 19, sx - 3, sy + 24);
    c.quadraticCurveTo(sx + 2, sy + 26.5, sx + 8, sy + 26);
    c.closePath();
    c.fill();
    /* White muzzle underside and cheeks */
    c.fillStyle = WHITE;
    c.beginPath();
    c.moveTo(sx + 5, sy + 22.5);
    c.quadraticCurveTo(sx + 1, sy + 23.5, sx - 2.4, sy + 24.2);
    c.quadraticCurveTo(sx + 2, sy + 26.6, sx + 8, sy + 26.2);
    c.quadraticCurveTo(sx + 9, sy + 24, sx + 5, sy + 22.5);
    c.closePath();
    c.fill();
    blob(c, sx + 12, sy + 24, 3.6, 2.6, 0, WHITE);
    /* Large pointed ears with dark tips */
    c.fillStyle = p.body;
    c.beginPath(); c.moveTo(sx + 3.5, sy + 17); c.lineTo(sx + 4.5, sy + 7); c.lineTo(sx + 9.5, sy + 15); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(sx + 10, sy + 15); c.lineTo(sx + 13.5, sy + 7); c.lineTo(sx + 15.5, sy + 17); c.closePath(); c.fill();
    c.fillStyle = BLACK;
    c.beginPath(); c.moveTo(sx + 4.1, sy + 11); c.lineTo(sx + 4.5, sy + 7); c.lineTo(sx + 7, sy + 11); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(sx + 11.6, sy + 11); c.lineTo(sx + 13.5, sy + 7); c.lineTo(sx + 14.3, sy + 11); c.closePath(); c.fill();
    c.fillStyle = '#f2c8c0';
    c.beginPath(); c.moveTo(sx + 5.2, sy + 16); c.lineTo(sx + 5.6, sy + 11.5); c.lineTo(sx + 8.2, sy + 15); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(sx + 11.2, sy + 15); c.lineTo(sx + 13.2, sy + 11.5); c.lineTo(sx + 14, sy + 16); c.closePath(); c.fill();
    /* Nose, mouth, eye */
    blob(c, sx - 2.6, sy + 23.6, 1.4, 1.1, 0, BLACK);
    c.strokeStyle = BLACK; c.lineWidth = 0.5;
    c.beginPath(); c.moveTo(sx - 1.6, sy + 24.8); c.quadraticCurveTo(sx + 1, sy + 25.6, sx + 3, sy + 24.8); c.stroke();
    realEye(c, sx + 6.2, sy + 19.6, 1.3, '#c88a20');
    realEye(c, sx + 11.6, sy + 19.2, 1.2, '#c88a20');
  }

  function drawCatSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.cat;
    var CREAM = p.accent;
    var STRIPE = '#b87838';
    groundShadow(c, sx + 22, sy + 45, 15, 2.4);
    /* Tail curled up high behind */
    curve(c, sx + 32, sy + 35, sx + 42, sy + 34, sx + 40, sy + 18, 3, p.body);
    blob(c, sx + 40.2, sy + 17.5, 1.7, 1.7, 0, p.shade);
    /* Tabby rings on the tail */
    c.strokeStyle = STRIPE; c.lineWidth = 1;
    c.beginPath();
    c.moveTo(sx + 39.6, sy + 23); c.lineTo(sx + 42.6, sy + 23.4);
    c.moveTo(sx + 39.2, sy + 27); c.lineTo(sx + 42.4, sy + 28);
    c.stroke();
    /* Far legs */
    limb(c, sx + 20, sy + 36, sx + 20, sy + 42.5, 2.6, p.shade);
    limb(c, sx + 31, sy + 36, sx + 31, sy + 42.5, 2.6, p.shade);
    /* Compact body */
    c.fillStyle = vGrad(c, sy + 25, sy + 40, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 23, sy + 33, 10.5, 6.8, 0, 0, Math.PI * 2); c.fill();
    /* Cream belly */
    blob(c, sx + 23, sy + 37, 7, 2.6, 0, CREAM);
    /* Near legs */
    limb(c, sx + 16, sy + 36, sx + 16, sy + 42.5, 3, p.body);
    limb(c, sx + 27, sy + 36, sx + 27, sy + 42.5, 3, p.body);
    blob(c, sx + 16, sy + 43, 2.2, 1.2, 0, CREAM);
    blob(c, sx + 27, sy + 43, 2.2, 1.2, 0, CREAM);
    /* Tabby stripes — short arcs over the back */
    c.strokeStyle = STRIPE; c.lineWidth = 1.1; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(sx + 21, sy + 27); c.quadraticCurveTo(sx + 20, sy + 29.5, sx + 21, sy + 32);
    c.moveTo(sx + 26, sy + 26.6); c.quadraticCurveTo(sx + 25, sy + 29, sx + 26, sy + 31.5);
    c.moveTo(sx + 31, sy + 27.6); c.quadraticCurveTo(sx + 30.2, sy + 29.6, sx + 31, sy + 32);
    c.stroke();
    /* Round head */
    c.fillStyle = vGrad(c, sy + 17, sy + 33, p.body, '#cf8e58');
    c.beginPath(); c.arc(sx + 12, sy + 25, 7.8, 0, Math.PI * 2); c.fill();
    /* Triangular ears with pink inner */
    c.fillStyle = p.body;
    c.beginPath(); c.moveTo(sx + 5.2, sy + 22); c.lineTo(sx + 6, sy + 13.5); c.lineTo(sx + 11.5, sy + 18); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(sx + 12.5, sy + 18); c.lineTo(sx + 18, sy + 13.5); c.lineTo(sx + 18.8, sy + 22); c.closePath(); c.fill();
    c.fillStyle = '#f4a8b8';
    c.beginPath(); c.moveTo(sx + 6.6, sy + 20.6); c.lineTo(sx + 7, sy + 15.8); c.lineTo(sx + 10.4, sy + 18.6); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(sx + 13.6, sy + 18.6); c.lineTo(sx + 17, sy + 15.8); c.lineTo(sx + 17.4, sy + 20.6); c.closePath(); c.fill();
    /* Forehead "M" tabby marks */
    c.strokeStyle = STRIPE; c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(sx + 10, sy + 18.5); c.lineTo(sx + 10.4, sy + 21);
    c.moveTo(sx + 12, sy + 18); c.lineTo(sx + 12, sy + 20.8);
    c.moveTo(sx + 14, sy + 18.5); c.lineTo(sx + 13.6, sy + 21);
    c.stroke();
    /* Cream muzzle */
    blob(c, sx + 10.5, sy + 28, 4.8, 3, 0, CREAM);
    /* Pink nose, mouth, whiskers */
    c.fillStyle = '#f08098';
    c.beginPath(); c.moveTo(sx + 9.2, sy + 26.6); c.lineTo(sx + 11.8, sy + 26.6); c.lineTo(sx + 10.5, sy + 28.2); c.closePath(); c.fill();
    c.strokeStyle = '#6a4030'; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx + 10.5, sy + 28.2); c.lineTo(sx + 10.5, sy + 29.2);
    c.moveTo(sx + 8.6, sy + 29.8); c.quadraticCurveTo(sx + 10.5, sy + 31, sx + 12.4, sy + 29.8);
    c.stroke();
    c.strokeStyle = '#3a2a20'; c.lineWidth = 0.45;
    c.beginPath();
    c.moveTo(sx + 7.5, sy + 27.6); c.lineTo(sx + 1.5, sy + 26.6);
    c.moveTo(sx + 7.5, sy + 28.8); c.lineTo(sx + 1.8, sy + 29.8);
    c.moveTo(sx + 13.5, sy + 27.6); c.lineTo(sx + 19.5, sy + 26.6);
    c.moveTo(sx + 13.5, sy + 28.8); c.lineTo(sx + 19.2, sy + 29.8);
    c.stroke();
    /* Big green eyes */
    realEye(c, sx + 9, sy + 23.6, 1.6, '#4caa58');
    realEye(c, sx + 15, sy + 23.6, 1.6, '#4caa58');
    /* Collar with bell */
    c.strokeStyle = '#e04870'; c.lineWidth = 1.4;
    c.beginPath(); c.arc(sx + 13, sy + 29.5, 6.2, Math.PI * 0.2, Math.PI * 0.8); c.stroke();
    blob(c, sx + 13, sy + 36, 1.5, 1.5, 0, '#ffd24a');
    blob(c, sx + 13.4, sy + 35.6, 0.5, 0.5, 0, '#fff8d0');
  }

  /* ---- Dog: friendly tan dog, floppy ears, tail up, collar ---- */
  function drawDogSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.dog;
    var CREAM = '#f0d8b0';
    groundShadow(c, sx + 22, sy + 45, 18);
    /* Tail wagging up */
    curve(c, sx + 38, sy + 24, sx + 44, sy + 18, sx + 45, sy + 9, 3.6, p.body);
    blob(c, sx + 45, sy + 9, 2.2, 2.2, 0, CREAM);
    /* Far legs */
    limb(c, sx + 15, sy + 32, sx + 14, sy + 42, 4.2, p.shade);
    limb(c, sx + 34, sy + 32, sx + 35, sy + 42, 4.2, p.shade);
    /* Body */
    c.fillStyle = vGrad(c, sy + 18, sy + 38, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 24, sy + 28, 16, 10, 0, 0, Math.PI * 2); c.fill();
    /* Belly highlight */
    c.save(); c.globalAlpha = 0.55; blob(c, sx + 23, sy + 33, 10, 4.2, 0, CREAM); c.restore();
    /* Near legs */
    limb(c, sx + 10, sy + 32, sx + 9, sy + 42, 4.6, p.body);
    limb(c, sx + 30, sy + 32, sx + 31, sy + 42, 4.6, p.body);
    blob(c, sx + 9, sy + 43, 3.2, 1.6, 0, p.body);
    blob(c, sx + 31, sy + 43, 3.2, 1.6, 0, p.body);
    blob(c, sx + 14, sy + 43, 2.8, 1.4, 0, p.shade);
    blob(c, sx + 35, sy + 43, 2.8, 1.4, 0, p.shade);
    /* Neck + collar */
    limb(c, sx + 12, sy + 20, sx + 18, sy + 26, 9, p.body);
    limb(c, sx + 10, sy + 25, sx + 17, sy + 21, 2.6, '#e04050');
    blob(c, sx + 13, sy + 26.5, 1.7, 1.7, 0, '#ffd24a');
    /* Head (round) */
    c.fillStyle = vGrad(c, sy + 7, sy + 25, p.body, p.shade);
    c.beginPath(); c.arc(sx + 10, sy + 15, 9, 0, Math.PI * 2); c.fill();
    /* Muzzle */
    blob(c, sx + 3.5, sy + 19, 5.2, 4.2, 0, CREAM);
    /* Open mouth + tongue */
    c.fillStyle = p.shade;
    c.beginPath(); c.ellipse(sx + 2.5, sy + 22, 2.6, 1.6, 0, 0, Math.PI); c.fill();
    blob(c, sx + 3, sy + 23.4, 1.4, 2.0, 0, '#ff7fa0');
    /* Nose */
    blob(c, sx - 0.5, sy + 17.8, 2.2, 1.7, 0, p.accent);
    blob(c, sx - 1.2, sy + 17.2, 0.6, 0.5, 0, '#ffffff');
    /* Floppy ears (far then near) */
    blob(c, sx + 17, sy + 17, 3.2, 6.8, -0.15, p.shade);
    blob(c, sx + 13, sy + 15, 3.4, 7.2, 0.18, p.shade);
    blob(c, sx + 13.2, sy + 15.5, 1.8, 5.0, 0.18, '#a06a38');
    /* Eye + brow */
    realEye(c, sx + 5.5, sy + 14, 1.7, '#4a2c10');
    furLine(c, sx + 3.5, sy + 11.2, sx + 7.5, sy + 10.6, p.shade, 0.8);
  }

  /* ---- Bunny: sitting upright, tall ears, cotton tail, carrot ---- */
  function drawBunnySprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.bunny;
    groundShadow(c, sx + 22, sy + 45, 15);
    /* Ears (far, then near) */
    blob(c, sx + 22, sy + 2, 3.2, 9.5, 0.12, p.shade);
    blob(c, sx + 22, sy + 2.5, 1.5, 6.5, 0.12, p.accent);
    blob(c, sx + 15, sy + 1, 3.4, 10, -0.14, p.body);
    blob(c, sx + 15, sy + 1.8, 1.7, 7, -0.14, p.accent);
    /* Cotton tail (behind body) */
    blob(c, sx + 34, sy + 35, 4.4, 4.4, 0, '#ffffff');
    blob(c, sx + 33, sy + 34, 2, 2, 0, '#fff8f0');
    /* Body: upright egg */
    c.fillStyle = vGrad(c, sy + 18, sy + 44, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 23, sy + 31, 12, 13, 0, 0, Math.PI * 2); c.fill();
    /* Belly */
    c.save(); c.globalAlpha = 0.7; blob(c, sx + 20, sy + 33, 7, 8.5, 0, '#fffaf2'); c.restore();
    /* Big back foot */
    blob(c, sx + 15, sy + 42.2, 8.5, 2.6, 0, p.body);
    furLine(c, sx + 9, sy + 42.6, sx + 9, sy + 44, p.shade, 0.7);
    furLine(c, sx + 12, sy + 42.8, sx + 12, sy + 44.2, p.shade, 0.7);
    /* Head */
    c.fillStyle = vGrad(c, sy + 6, sy + 24, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 17, sy + 15, 9.5, 8.5, 0, 0, Math.PI * 2); c.fill();
    /* Cheek */
    c.save(); c.globalAlpha = 0.5; blob(c, sx + 12, sy + 19, 4, 3, 0, '#ffffff'); c.restore();
    /* Eye (to the side, prey) */
    realEye(c, sx + 12.5, sy + 14, 1.8, '#5a3a60');
    /* Nose + mouth + teeth */
    blob(c, sx + 8.3, sy + 17.8, 1.6, 1.2, 0, p.accent);
    furLine(c, sx + 8.3, sy + 19, sx + 8.3, sy + 20.6, p.shade, 0.7);
    c.fillStyle = '#ffffff';
    c.fillRect(sx + 7.3, sy + 20.4, 1.0, 2.2);
    c.fillRect(sx + 8.5, sy + 20.4, 1.0, 2.2);
    /* Whiskers */
    furLine(c, sx + 7, sy + 18.5, sx + 1, sy + 17, p.shade, 0.5);
    furLine(c, sx + 7, sy + 19.5, sx + 1, sy + 20.5, p.shade, 0.5);
    /* Carrot held in front paws */
    c.fillStyle = '#ff8c2a';
    c.beginPath(); c.moveTo(sx + 11, sy + 31); c.lineTo(sx + 16, sy + 29); c.lineTo(sx + 4, sy + 40); c.closePath(); c.fill();
    furLine(c, sx + 8, sy + 34, sx + 10, sy + 35.5, '#d86a10', 0.6);
    blob(c, sx + 16, sy + 28.5, 2.4, 1.4, -0.6, '#4caf50');
    blob(c, sx + 14.5, sy + 27.6, 2.4, 1.4, 0.6, '#4caf50');
    /* Front paws */
    blob(c, sx + 12, sy + 31.5, 2.6, 2.1, 0, p.body);
    blob(c, sx + 16, sy + 32, 2.6, 2.1, 0, p.body);
  }

  /* ---- Koala: sitting, hugging a eucalyptus branch ---- */
  function drawKoalaSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.koala;
    var BARK = '#7a5230', BARK2 = '#5a3a1c', LEAF = '#5c9e63';
    groundShadow(c, sx + 24, sy + 45, 17);
    /* Branch (behind the koala) */
    c.fillStyle = vGrad(c, sy - 6, sy + 44, BARK, BARK2);
    c.fillRect(sx + 35, sy - 6, 5.5, 50);
    furLine(c, sx + 36.5, sy + 4, sx + 36.5, sy + 40, BARK2, 0.7);
    blob(c, sx + 33, sy - 4, 4.5, 1.9, -0.7, LEAF);
    blob(c, sx + 42, sy - 3, 4.5, 1.9, 0.6, LEAF);
    blob(c, sx + 38, sy - 7, 4.2, 1.8, -0.1, '#6fae73');
    /* Far ear */
    blob(c, sx + 27, sy + 10, 6, 6, 0, p.shade);
    blob(c, sx + 27, sy + 10, 3.6, 3.6, 0, p.accent);
    /* Body */
    c.fillStyle = vGrad(c, sy + 20, sy + 44, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 23, sy + 31, 11.5, 12, 0, 0, Math.PI * 2); c.fill();
    /* White chest */
    c.save(); c.globalAlpha = 0.85; blob(c, sx + 20, sy + 32, 6, 8, 0, p.accent); c.restore();
    /* Legs: thigh + foot gripping floor and branch */
    blob(c, sx + 20, sy + 39, 6.5, 4.2, 0, p.body);
    limb(c, sx + 17, sy + 42, sx + 11, sy + 42.5, 3.6, p.shade);
    limb(c, sx + 27, sy + 40, sx + 36, sy + 41.5, 3.8, p.body);
    /* Arms hugging the branch (far arm then near arm) */
    limb(c, sx + 24, sy + 24, sx + 37, sy + 22, 4.2, p.shade);
    limb(c, sx + 20, sy + 26, sx + 37, sy + 27, 4.6, p.body);
    blob(c, sx + 38, sy + 27, 2.2, 2.6, 0, p.shade);
    /* Head: big and round */
    c.fillStyle = vGrad(c, sy + 5, sy + 25, p.body, p.shade);
    c.beginPath(); c.arc(sx + 17, sy + 15, 10.5, 0, Math.PI * 2); c.fill();
    /* Near ear: fluffy */
    blob(c, sx + 7, sy + 10, 6.5, 6.5, 0, p.shade);
    blob(c, sx + 4.5, sy + 6.5, 2.2, 2.2, 0, p.shade);
    blob(c, sx + 2, sy + 11, 2.2, 2.2, 0, p.shade);
    blob(c, sx + 5, sy + 15, 2.2, 2.2, 0, p.shade);
    blob(c, sx + 7, sy + 10, 4, 4, 0, p.accent);
    blob(c, sx + 5, sy + 8, 1.6, 1.6, 0, p.accent);
    /* Big black nose */
    blob(c, sx + 12, sy + 18, 3.2, 4.6, 0, '#1a1a1a');
    blob(c, sx + 11, sy + 16.5, 0.9, 1.3, 0, '#5a5a5a');
    /* Sleepy eyes: iris then lid */
    realEye(c, sx + 10, sy + 12.5, 1.5, '#3a2a20');
    realEye(c, sx + 19, sy + 13, 1.5, '#3a2a20');
    c.fillStyle = p.body;
    c.beginPath(); c.ellipse(sx + 10, sy + 11.8, 2.2, 1.6, 0, Math.PI, 0); c.fill();
    c.beginPath(); c.ellipse(sx + 19, sy + 12.3, 2.2, 1.6, 0, Math.PI, 0); c.fill();
    /* Little smile */
    curve(c, sx + 10, sy + 23, sx + 12, sy + 24.5, sx + 14, sy + 23, 0.7, p.shade);
  }

  /* ---- Polar bear: long body, long low neck, small head ---- */
  function drawPolarBearSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.polarBear;
    var ICE = '#e4ecf4';
    groundShadow(c, sx + 24, sy + 45, 21);
    /* Far legs */
    limb(c, sx + 17, sy + 33, sx + 16, sy + 42, 5, p.shade);
    limb(c, sx + 38, sy + 33, sx + 39, sy + 42, 5, p.shade);
    /* Body: long, with a shoulder hump */
    c.fillStyle = vGrad(c, sy + 16, sy + 42, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 27, sy + 29, 18, 11, 0, 0, Math.PI * 2); c.fill();
    blob(c, sx + 30, sy + 21, 10, 6, 0, p.body);
    /* Tail stub */
    blob(c, sx + 45, sy + 27, 2.6, 2.2, 0, ICE);
    /* Neck: long, forward and down */
    c.fillStyle = vGrad(c, sy + 18, sy + 32, p.body, ICE);
    c.beginPath();
    c.moveTo(sx + 16, sy + 19); c.quadraticCurveTo(sx + 8, sy + 20, sx + 4, sy + 24);
    c.lineTo(sx + 6, sy + 32); c.quadraticCurveTo(sx + 14, sy + 34, sx + 22, sy + 34);
    c.lineTo(sx + 22, sy + 20); c.closePath(); c.fill();
    /* Head: small, carried low */
    c.fillStyle = vGrad(c, sy + 21, sy + 33, p.body, ICE);
    c.beginPath(); c.ellipse(sx + 5, sy + 27, 7.2, 5.6, 0.1, 0, Math.PI * 2); c.fill();
    blob(c, sx - 0.5, sy + 28.5, 3.6, 3, 0, '#f4f2ee');
    blob(c, sx - 3.2, sy + 28, 1.9, 1.5, 0, p.accent);
    furLine(c, sx - 2.5, sy + 30, sx + 0.5, sy + 31, p.shade, 0.7);
    /* Small round ear */
    blob(c, sx + 9.5, sy + 22, 2.3, 2.3, 0, p.body);
    blob(c, sx + 9.5, sy + 22, 1.2, 1.2, 0, p.shade);
    /* Eye */
    eye(c, sx + 4, sy + 25.2, 1.25);
    /* Near legs: big paws */
    limb(c, sx + 11, sy + 33, sx + 10, sy + 42, 5.6, p.body);
    limb(c, sx + 33, sy + 33, sx + 34, sy + 42, 5.6, p.body);
    blob(c, sx + 9.5, sy + 43, 4.2, 1.9, 0, ICE);
    blob(c, sx + 34.5, sy + 43, 4.2, 1.9, 0, ICE);
    blob(c, sx + 15.5, sy + 43, 3.4, 1.6, 0, p.shade);
    blob(c, sx + 39.5, sy + 43, 3.4, 1.6, 0, p.shade);
    /* Claws */
    c.fillStyle = '#6a7684';
    c.fillRect(sx + 6.2, sy + 43.2, 0.9, 1.3); c.fillRect(sx + 8.4, sy + 43.5, 0.9, 1.3); c.fillRect(sx + 10.6, sy + 43.5, 0.9, 1.3);
    c.fillRect(sx + 31.2, sy + 43.2, 0.9, 1.3); c.fillRect(sx + 33.4, sy + 43.5, 0.9, 1.3); c.fillRect(sx + 35.6, sy + 43.5, 0.9, 1.3);
  }

  /* ---- Rhino: armour-plated barrel, nose horn ---- */
  function drawRhinoSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.rhino;
    var HORN = '#d8d0c0', HORN2 = '#a89c8c';
    groundShadow(c, sx + 24, sy + 45, 21);
    /* Tail */
    curve(c, sx + 44, sy + 24, sx + 47, sy + 30, sx + 46, sy + 36, 1.6, p.shade);
    blob(c, sx + 46, sy + 36.5, 1.6, 2, 0, p.accent);
    /* Far legs */
    limb(c, sx + 16, sy + 34, sx + 15, sy + 42, 5.2, p.shade);
    limb(c, sx + 37, sy + 34, sx + 38, sy + 42, 5.2, p.shade);
    /* Body */
    c.fillStyle = vGrad(c, sy + 12, sy + 42, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 27, sy + 27, 19, 13, 0, 0, Math.PI * 2); c.fill();
    blob(c, sx + 24, sy + 16, 11, 6, 0, p.body);
    /* Armour folds */
    curve(c, sx + 18, sy + 16, sx + 15, sy + 27, sx + 18, sy + 38, 1.1, p.shade);
    curve(c, sx + 36, sy + 15, sx + 39, sy + 26, sx + 37, sy + 38, 1.1, p.shade);
    curve(c, sx + 20, sy + 33, sx + 27, sy + 36, sx + 35, sy + 33, 0.9, p.shade);
    /* Near legs with three toes */
    limb(c, sx + 11, sy + 34, sx + 10, sy + 42, 6, p.body);
    limb(c, sx + 32, sy + 34, sx + 33, sy + 42, 6, p.body);
    c.fillStyle = p.accent;
    var tx;
    for (tx = 0; tx < 3; tx++) {
      c.fillRect(sx + 7.4 + tx * 2, sy + 43, 1.3, 1.5);
      c.fillRect(sx + 30.4 + tx * 2, sy + 43, 1.3, 1.5);
    }
    /* Head: large, carried low */
    c.fillStyle = vGrad(c, sy + 17, sy + 37, p.body, p.shade);
    c.beginPath();
    c.moveTo(sx + 14, sy + 18); c.quadraticCurveTo(sx + 4, sy + 17, sx - 1, sy + 24);
    c.quadraticCurveTo(sx - 5, sy + 30, sx - 1, sy + 35); c.quadraticCurveTo(sx + 6, sy + 38, sx + 14, sy + 33);
    c.closePath(); c.fill();
    /* Mouth */
    curve(c, sx - 3.5, sy + 32, sx + 1, sy + 34.5, sx + 6, sy + 33.5, 0.8, p.shade);
    /* Nose horn: big, pointing up and forward */
    c.fillStyle = HORN;
    c.beginPath(); c.moveTo(sx - 4.5, sy + 25); c.lineTo(sx + 3, sy + 23); c.lineTo(sx - 5.5, sy + 9); c.closePath(); c.fill();
    c.fillStyle = HORN2;
    c.beginPath(); c.moveTo(sx - 4.5, sy + 25); c.lineTo(sx - 1, sy + 24); c.lineTo(sx - 5.5, sy + 9); c.closePath(); c.fill();
    /* Second small horn */
    c.fillStyle = HORN;
    c.beginPath(); c.moveTo(sx + 4, sy + 22.5); c.lineTo(sx + 9, sy + 21); c.lineTo(sx + 5.5, sy + 15); c.closePath(); c.fill();
    /* Tiny ear */
    blob(c, sx + 13, sy + 18, 2.2, 3.2, 0.3, p.body);
    blob(c, sx + 13, sy + 18.4, 1.1, 2, 0.3, p.shade);
    /* Small eye */
    eye(c, sx + 7.5, sy + 24.5, 1.25);
    /* Skin wrinkles on the neck */
    furLine(c, sx + 12, sy + 22, sx + 12.5, sy + 30, p.shade, 0.6);
  }

  /* ---- Hippo: enormous muzzle, eyes and ears high on the head ---- */
  function drawHippoSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.hippo;
    groundShadow(c, sx + 24, sy + 45, 21);
    /* Tail */
    limb(c, sx + 45, sy + 26, sx + 46.5, sy + 32, 1.8, p.shade);
    /* Far legs */
    limb(c, sx + 18, sy + 36, sx + 17, sy + 42, 5.4, p.shade);
    limb(c, sx + 38, sy + 36, sx + 39, sy + 42, 5.4, p.shade);
    /* Body */
    c.fillStyle = vGrad(c, sy + 16, sy + 42, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 28, sy + 29, 18, 12.5, 0, 0, Math.PI * 2); c.fill();
    /* Pink underside */
    c.save(); c.globalAlpha = 0.5; blob(c, sx + 28, sy + 37, 12, 4.5, 0, p.accent); c.restore();
    /* Near legs */
    limb(c, sx + 13, sy + 36, sx + 12, sy + 42, 6.2, p.body);
    limb(c, sx + 33, sy + 36, sx + 34, sy + 42, 6.2, p.body);
    c.fillStyle = '#e8d8e8';
    c.fillRect(sx + 9.4, sy + 43, 1.4, 1.4); c.fillRect(sx + 11.6, sy + 43.3, 1.4, 1.4); c.fillRect(sx + 13.8, sy + 43, 1.4, 1.4);
    c.fillRect(sx + 31.4, sy + 43, 1.4, 1.4); c.fillRect(sx + 33.6, sy + 43.3, 1.4, 1.4); c.fillRect(sx + 35.8, sy + 43, 1.4, 1.4);
    /* Skull */
    c.fillStyle = vGrad(c, sy + 12, sy + 30, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 11, sy + 21, 9, 7.5, 0, 0, Math.PI * 2); c.fill();
    /* Huge muzzle */
    c.fillStyle = vGrad(c, sy + 20, sy + 37, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 3, sy + 29, 10, 7.5, 0.05, 0, Math.PI * 2); c.fill();
    /* Lower jaw / lip in pink */
    c.save(); c.globalAlpha = 0.75; blob(c, sx + 2.5, sy + 33.5, 8, 3.2, 0, p.accent); c.restore();
    /* Mouth line */
    curve(c, sx - 6, sy + 31, sx + 1, sy + 33.5, sx + 9, sy + 32, 0.9, p.shade);
    /* Tusks poking up from the lower jaw */
    c.fillStyle = '#fff8e8';
    c.fillRect(sx - 3.6, sy + 29.5, 1.5, 3.2);
    c.fillRect(sx + 2.4, sy + 30.2, 1.5, 3.2);
    /* Nostrils */
    blob(c, sx - 4.5, sy + 25, 1.3, 0.9, 0.3, p.shade);
    blob(c, sx - 1, sy + 23.8, 1.3, 0.9, 0.3, p.shade);
    /* Eyes high on bumps */
    blob(c, sx + 6, sy + 16, 2.6, 2.4, 0, p.body);
    blob(c, sx + 15, sy + 15.5, 2.6, 2.4, 0, p.body);
    eye(c, sx + 6, sy + 16.2, 1.3);
    eye(c, sx + 14.5, sy + 15.6, 1.1);
    /* Tiny round ears */
    blob(c, sx + 9, sy + 13.5, 2.2, 2.2, 0, p.body);
    blob(c, sx + 9, sy + 13.7, 1.1, 1.1, 0, p.accent);
    blob(c, sx + 17.5, sy + 13.5, 2.2, 2.2, 0, p.body);
    blob(c, sx + 17.5, sy + 13.7, 1.1, 1.1, 0, p.accent);
  }

  /* ---- Gorilla: knuckle-walking, huge arms, silver back ---- */
  function drawGorillaSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.gorilla;
    var SILVER = '#8c8c94', SKIN2 = '#7a5a44';
    groundShadow(c, sx + 22, sy + 45, 20);
    /* Far arm + far leg */
    limb(c, sx + 17, sy + 22, sx + 11, sy + 42, 6.5, p.shade);
    blob(c, sx + 11, sy + 42.5, 4, 2, 0, p.shade);
    limb(c, sx + 37, sy + 33, sx + 41, sy + 42, 5, p.shade);
    blob(c, sx + 41.5, sy + 43, 3.6, 1.6, 0, p.shade);
    /* Body: slopes down from the shoulders to the rump */
    c.fillStyle = vGrad(c, sy + 12, sy + 40, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 27, sy + 28, 17, 11.5, 0.22, 0, Math.PI * 2); c.fill();
    /* Shoulder mass */
    blob(c, sx + 17, sy + 21, 11.5, 9.5, 0, p.body);
    /* Silver saddle on the back */
    c.save(); c.globalAlpha = 0.75; blob(c, sx + 31, sy + 24, 10, 5.5, 0.25, SILVER); c.restore();
    /* Near leg */
    limb(c, sx + 32, sy + 34, sx + 36, sy + 42, 5.6, p.body);
    blob(c, sx + 36.5, sy + 43, 4, 1.7, 0, p.shade);
    /* Near arm: long, down to the knuckles */
    limb(c, sx + 13, sy + 23, sx + 5, sy + 42, 7.4, p.body);
    blob(c, sx + 5, sy + 42.6, 4.6, 2.1, 0, p.shade);
    furLine(c, sx + 3, sy + 41.5, sx + 3, sy + 43.5, '#000', 0.6);
    furLine(c, sx + 5.5, sy + 41.3, sx + 5.5, sy + 43.5, '#000', 0.6);
    /* Head with a crest */
    c.fillStyle = vGrad(c, sy + 3, sy + 22, p.body, p.shade);
    c.beginPath(); c.arc(sx + 10, sy + 13, 8.4, 0, Math.PI * 2); c.fill();
    blob(c, sx + 11, sy + 6, 5.5, 3.5, -0.2, p.body);
    /* Ear */
    blob(c, sx + 17, sy + 14, 2, 2.3, 0, SKIN2);
    /* Bare face */
    c.fillStyle = vGrad(c, sy + 9, sy + 21, p.accent, SKIN2);
    c.beginPath(); c.ellipse(sx + 6.5, sy + 15.5, 5.6, 6.2, 0, 0, Math.PI * 2); c.fill();
    /* Heavy brow ridge */
    blob(c, sx + 6.5, sy + 11.6, 6, 2.2, 0, p.shade);
    /* Eyes under the brow */
    eye(c, sx + 4, sy + 13.6, 1.15);
    eye(c, sx + 8.5, sy + 13.6, 1.15);
    /* Broad flat nose */
    blob(c, sx + 5.8, sy + 17.2, 3.2, 1.8, 0, SKIN2);
    blob(c, sx + 4.4, sy + 17.5, 1.1, 0.8, 0, p.shade);
    blob(c, sx + 7.2, sy + 17.5, 1.1, 0.8, 0, p.shade);
    /* Mouth */
    curve(c, sx + 3.5, sy + 20, sx + 6, sy + 21.3, sx + 8.8, sy + 20, 0.8, p.shade);
  }

  /* ---- Giraffe: long neck, ossicones, sloping barrel body, leggy ---- */
  function drawGiraffeSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.giraffe;
    var BODY = p.body, SHADE = p.shade, DARK = p.accent;
    var FAR = '#cfae66';
    groundShadow(c, sx + 28, sy + 45, 17);

    /* Tail with tuft (behind body) */
    curve(c, sx + 42, sy + 22, sx + 48, sy + 28, sx + 46, sy + 37, 1.4, SHADE);
    blob(c, sx + 46, sy + 38, 2, 2.4, 0, DARK);

    /* Legs: far pair darker, near pair body colour; knee bands + hooves */
    var legs = [[18, FAR], [38, FAR], [14, BODY], [33, BODY]];
    for (var li = 0; li < legs.length; li++) {
      var lx = sx + legs[li][0];
      limb(c, lx, sy + 26, lx, sy + 42, 3.2, legs[li][1]);
      c.fillStyle = SHADE; c.fillRect(lx - 1.6, sy + 33, 3.2, 1.4);
      c.fillStyle = DARK;
      c.beginPath(); c.ellipse(lx, sy + 43, 2.2, 1.6, 0, 0, Math.PI * 2); c.fill();
    }

    /* Body: barrel that slopes down from the shoulders to the hips */
    c.fillStyle = vGrad(c, sy + 14, sy + 31, BODY, SHADE);
    c.beginPath(); c.ellipse(sx + 28, sy + 23, 15.5, 8.5, 0.16, 0, Math.PI * 2); c.fill();

    /* Neck: tapers upward, leans slightly forward */
    c.fillStyle = vGrad(c, sy - 18, sy + 24, BODY, '#d9b764');
    c.beginPath();
    c.moveTo(sx + 13, sy + 24);
    c.lineTo(sx + 7,  sy - 16);
    c.lineTo(sx + 14, sy - 18);
    c.lineTo(sx + 22, sy + 18);
    c.closePath(); c.fill();

    /* Mane: dark bristles along the back of the neck */
    for (var gm = 0; gm < 10; gm++) {
      var mx = sx + 14.6 + gm * 0.82, my = sy - 17 + gm * 3.9;
      limb(c, mx, my, mx + 2.4, my - 1.2, 1.5, DARK);
    }

    /* Head + long muzzle */
    blob(c, sx + 8, sy - 20, 7, 4.6, -0.15, BODY);
    blob(c, sx + 1.5, sy - 18.5, 3.8, 2.8, -0.15, SHADE);
    /* Ossicones */
    limb(c, sx + 7, sy - 23, sx + 6.5, sy - 29, 1.5, SHADE);
    limb(c, sx + 12, sy - 23, sx + 12.5, sy - 29, 1.5, SHADE);
    blob(c, sx + 6.4, sy - 29.5, 1.8, 1.8, 0, DARK);
    blob(c, sx + 12.6, sy - 29.5, 1.8, 1.8, 0, DARK);
    /* Leaf ears */
    blob(c, sx + 1, sy - 22, 3.4, 1.7, -0.6, BODY);
    blob(c, sx + 15.5, sy - 22, 3.4, 1.7, 0.6, BODY);
    blob(c, sx + 1, sy - 22, 1.9, 0.8, -0.6, '#cc9988');
    blob(c, sx + 15.5, sy - 22, 1.9, 0.8, 0.6, '#cc9988');

    /* Patches: irregular polygons clipped to body and neck */
    c.fillStyle = SHADE;
    function patch(cx, cy, r, sides) {
      c.beginPath();
      for (var i = 0; i < sides; i++) {
        var a = (i / sides) * Math.PI * 2 + (cx * 0.3);
        var rr = r * (0.78 + 0.22 * Math.sin(cx + cy + i));
        var px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath(); c.fill();
    }
    c.save();
    c.beginPath(); c.ellipse(sx + 28, sy + 23, 15.5, 8.5, 0.16, 0, Math.PI * 2); c.clip();
    patch(sx + 17, sy + 19, 3.4, 6); patch(sx + 24, sy + 16, 3.1, 5);
    patch(sx + 31, sy + 20, 3.5, 6); patch(sx + 38, sy + 21, 3.0, 5);
    patch(sx + 21, sy + 26, 2.9, 6); patch(sx + 29, sy + 28, 3.1, 5);
    patch(sx + 38, sy + 28, 2.4, 5); patch(sx + 42, sy + 24, 2.2, 5);
    c.restore();
    c.save();
    c.beginPath();
    c.moveTo(sx + 13, sy + 24); c.lineTo(sx + 7, sy - 16);
    c.lineTo(sx + 14, sy - 18); c.lineTo(sx + 22, sy + 18);
    c.closePath(); c.clip();
    patch(sx + 14, sy + 14, 2.6, 5); patch(sx + 11, sy + 4, 2.3, 5);
    patch(sx + 13, sy - 5, 2.1, 5); patch(sx + 10, sy - 12, 1.9, 5);
    patch(sx + 17, sy + 8, 1.6, 5);
    c.restore();
    /* Upper-leg patches */
    for (var lp = 0; lp < legs.length; lp++) {
      c.fillStyle = SHADE; c.fillRect(sx + legs[lp][0] - 1.5, sy + 28, 3, 2);
    }

    /* Face */
    realEye(c, sx + 9, sy - 19.5, 1.5, '#3a2010');
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx + 8.2, sy - 21.3); c.lineTo(sx + 7.5, sy - 22.4);
    c.moveTo(sx + 9.4, sy - 21.6); c.lineTo(sx + 9.3, sy - 22.8);
    c.stroke();
    c.fillStyle = '#3a2010';
    c.beginPath(); c.arc(sx + 0.4, sy - 18.4, 0.6, 0, Math.PI * 2); c.fill();
    curve(c, sx - 0.2, sy - 16.4, sx + 1.4, sy - 15.4, sx + 3, sy - 16.2, 0.6, '#7a3838');
  }

  /* ---- Zebra: horse body, upright striped mane, contour-following stripes ---- */
  function drawZebraSprite(c, sx, sy) {
    var WHITE = '#fafafa', GRAY = '#d4d4d4', FAR = '#c4c4c4';
    var BLACK = ANIMAL_PALETTES.zebra.shade;
    groundShadow(c, sx + 26, sy + 45, 18);

    /* Tail: white cord with a black tuft */
    curve(c, sx + 42, sy + 22, sx + 48, sy + 30, sx + 45, sy + 38, 2, WHITE);
    blob(c, sx + 45, sy + 40, 2.3, 3.2, 0, BLACK);

    /* Legs: far pair grey, near pair white; black rings + hooves */
    var legs = [[20, FAR], [38, FAR], [16, WHITE], [34, WHITE]];
    for (var li = 0; li < legs.length; li++) {
      var lx = sx + legs[li][0];
      limb(c, lx, sy + 28, lx, sy + 42, 3.4, legs[li][1]);
      c.fillStyle = BLACK;
      c.fillRect(lx - 1.7, sy + 31.5, 3.4, 1.3);
      c.fillRect(lx - 1.7, sy + 35, 3.4, 1.3);
      c.fillRect(lx - 1.7, sy + 38.5, 3.4, 1.3);
      c.beginPath(); c.ellipse(lx, sy + 43, 2.3, 1.6, 0, 0, Math.PI * 2); c.fill();
    }

    /* Body */
    c.fillStyle = vGrad(c, sy + 15, sy + 33, WHITE, GRAY);
    c.beginPath(); c.ellipse(sx + 28, sy + 24, 15, 9, 0, 0, Math.PI * 2); c.fill();

    /* Neck: wide and strong, rising to a big head */
    function neckPath() {
      c.beginPath();
      c.moveTo(sx + 13, sy + 29); c.lineTo(sx + 8, sy + 10);
      c.lineTo(sx + 20, sy + 6); c.lineTo(sx + 25, sy + 22);
      c.closePath();
    }
    c.fillStyle = WHITE; neckPath(); c.fill();

    /* Upright brush mane along the back of the neck: black with white bars */
    for (var mi = 0; mi < 7; mi++) {
      blob(c, sx + 18.5 + mi * 1.2, sy + 5 + mi * 2.5, 2.3, 3.6, -0.85, BLACK);
    }
    for (var wb = 0; wb < 3; wb++) {
      limb(c, sx + 19.5 + wb * 2.5, sy + 8 + wb * 5.2, sx + 22.5 + wb * 2.5, sy + 6.6 + wb * 5.2, 0.9, WHITE);
    }

    /* Head: big dome + cheek + long muzzle angled down */
    function headPath() { c.beginPath(); c.ellipse(sx + 11, sy + 11, 7.5, 6.5, 0, 0, Math.PI * 2); }
    function muzzlePath() { c.beginPath(); c.ellipse(sx + 3.5, sy + 15.5, 7, 4.6, 0.3, 0, Math.PI * 2); }
    c.fillStyle = WHITE; headPath(); c.fill(); muzzlePath(); c.fill();
    /* Dark grey muzzle tip with nostril */
    blob(c, sx - 1.5, sy + 17.6, 3.2, 2.6, 0.3, '#4a4648');
    c.fillStyle = '#111';
    c.beginPath(); c.arc(sx - 2.4, sy + 16.6, 0.65, 0, Math.PI * 2); c.fill();
    curve(c, sx - 0.5, sy + 19.6, sx + 1.5, sy + 20.8, sx + 3.6, sy + 20.2, 0.6, '#2a2a2a');

    /* Ears: tall, rounded tips, black rims */
    function ear(x, y, lean) {
      c.fillStyle = BLACK;
      c.beginPath(); c.moveTo(x - 2.6, y + 4.5); c.quadraticCurveTo(x + lean, y - 6.5, x + 3, y + 4.5); c.closePath(); c.fill();
      c.fillStyle = WHITE;
      c.beginPath(); c.moveTo(x - 1.7, y + 4); c.quadraticCurveTo(x + lean * 0.8, y - 4.6, x + 2.1, y + 4); c.closePath(); c.fill();
      c.fillStyle = '#c99';
      c.beginPath(); c.moveTo(x - 0.8, y + 3.6); c.quadraticCurveTo(x + lean * 0.5, y - 1.8, x + 1.2, y + 3.6); c.closePath(); c.fill();
    }
    ear(sx + 8.5, sy + 5, -0.6); ear(sx + 15, sy + 4, 0.9);

    /* Stripes: body (curving over the rump), neck (diagonal), head, muzzle */
    c.save();
    c.beginPath(); c.ellipse(sx + 28, sy + 24, 15, 9, 0, 0, Math.PI * 2); c.clip();
    var bx = [17, 22, 27, 32, 37, 41];
    for (var bi = 0; bi < bx.length; bi++) {
      var t = bi / (bx.length - 1);
      curve(c, sx + bx[bi] - 1, sy + 13, sx + bx[bi] - 3 + t * 6, sy + 24, sx + bx[bi] + 1 + t * 3, sy + 35, 2.6, BLACK);
    }
    c.restore();
    c.save(); neckPath(); c.clip();
    for (var ni = 0; ni < 5; ni++) {
      var ny = sy + 9 + ni * 4;
      limb(c, sx + 6, ny + 1.6, sx + 26, ny - 2.4, 1.8, BLACK);
    }
    c.restore();
    c.save(); headPath(); c.clip();
    curve(c, sx + 13, sy + 4, sx + 17, sy + 8, sx + 17.5, sy + 14, 1.8, BLACK);
    curve(c, sx + 10, sy + 4.5, sx + 14, sy + 9, sx + 14.5, sy + 16, 1.5, BLACK);
    curve(c, sx + 5, sy + 7, sx + 7, sy + 10, sx + 7.5, sy + 15, 1.2, BLACK);
    c.restore();
    c.save(); muzzlePath(); c.clip();
    limb(c, sx + 7.5, sy + 11, sx + 6.5, sy + 20, 1.3, BLACK);
    limb(c, sx + 4.5, sy + 11.5, sx + 3.6, sy + 20, 1.2, BLACK);
    limb(c, sx + 1.6, sy + 12.5, sx + 1, sy + 20, 1.0, BLACK);
    c.restore();

    /* Eye + lashes */
    realEye(c, sx + 9.5, sy + 12, 1.8, '#2a1a10');
    c.strokeStyle = '#111'; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx + 8.4, sy + 9.9); c.lineTo(sx + 7.6, sy + 8.8);
    c.moveTo(sx + 9.8, sy + 9.6); c.lineTo(sx + 9.8, sy + 8.4);
    c.stroke();
  }

  /* ---- Kangaroo: upright tripod on big feet and heavy tail, joey in pouch ---- */
  function drawKangarooSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.kangaroo;
    var BODY = p.body, SHADE = p.shade, CREAM = p.accent;
    groundShadow(c, sx + 26, sy + 45, 20);

    /* Heavy tail resting on the ground behind */
    curve(c, sx + 29, sy + 31, sx + 40, sy + 34, sx + 48, sy + 42, 7, SHADE);
    curve(c, sx + 29, sy + 30, sx + 40, sy + 32, sx + 48, sy + 41, 5, BODY);

    /* Far leg + foot */
    blob(c, sx + 27, sy + 33, 6, 5.5, 0, SHADE);
    blob(c, sx + 21, sy + 42, 10, 2.2, 0, SHADE);

    /* Body: upright oval leaning back a little */
    c.fillStyle = vGrad(c, sy + 10, sy + 40, BODY, SHADE);
    c.beginPath(); c.ellipse(sx + 22, sy + 25, 9.5, 13, 0.22, 0, Math.PI * 2); c.fill();
    /* Cream chest & belly */
    blob(c, sx + 18.5, sy + 26, 5.5, 9.5, 0.22, CREAM);

    /* Near thigh + lower leg + big long foot */
    blob(c, sx + 23, sy + 34, 7, 5.6, 0, BODY);
    limb(c, sx + 20, sy + 37, sx + 14, sy + 42, 3.6, BODY);
    blob(c, sx + 17, sy + 42.6, 10.5, 2.3, 0, BODY);
    c.fillStyle = SHADE;
    c.beginPath(); c.arc(sx + 7, sy + 42.6, 1.1, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 9.6, sy + 43.6, 1.0, 0, Math.PI * 2); c.fill();

    /* Pouch with joey */
    c.fillStyle = BODY;
    c.beginPath(); c.ellipse(sx + 18.5, sy + 33, 6, 3.6, 0.1, 0, Math.PI); c.fill();
    blob(c, sx + 18, sy + 30.5, 3, 2.8, 0, '#d9a673');
    blob(c, sx + 16.4, sy + 27.6, 1, 1.9, -0.2, '#d9a673');
    blob(c, sx + 19.8, sy + 27.6, 1, 1.9, 0.2, '#d9a673');
    c.fillStyle = BODY;
    c.beginPath(); c.ellipse(sx + 18.5, sy + 33.4, 6.2, 3.4, 0.1, 0, Math.PI); c.fill();
    c.fillStyle = '#1a1a1a';
    c.beginPath(); c.arc(sx + 16.8, sy + 30.4, 0.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 19.2, sy + 30.4, 0.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 18, sy + 31.8, 0.5, 0, Math.PI * 2); c.fill();
    curve(c, sx + 13, sy + 32.4, sx + 18.5, sy + 34.2, sx + 24, sy + 32.4, 0.9, SHADE);

    /* Small arms held in front */
    limb(c, sx + 17, sy + 20, sx + 11.5, sy + 24, 2.8, BODY);
    limb(c, sx + 11.5, sy + 24, sx + 10, sy + 27, 2.8, BODY);
    limb(c, sx + 19, sy + 22, sx + 13.5, sy + 26, 2.6, SHADE);
    limb(c, sx + 13.5, sy + 26, sx + 12.5, sy + 29, 2.6, SHADE);

    /* Neck + head with long muzzle */
    limb(c, sx + 19, sy + 14, sx + 13, sy + 7.5, 6, BODY);
    blob(c, sx + 11, sy + 7, 6.2, 5.2, 0.1, BODY);
    blob(c, sx + 4, sy + 9.5, 5.2, 3.3, 0.3, BODY);
    blob(c, sx + 4.5, sy + 10.8, 3.4, 1.6, 0.3, CREAM);
    blob(c, sx - 0.4, sy + 10.4, 1.9, 1.5, 0.3, '#2a1a10');
    /* Tall ears */
    blob(c, sx + 10.5, sy - 0.5, 2.2, 6, -0.15, BODY);
    blob(c, sx + 15.5, sy + 0.5, 2.2, 6, 0.3, BODY);
    blob(c, sx + 10.5, sy - 0.2, 1.1, 4, -0.15, '#e8b8a8');
    blob(c, sx + 15.5, sy + 0.8, 1.1, 4, 0.3, '#e8b8a8');
    /* Eye */
    realEye(c, sx + 9, sy + 6.5, 1.5, '#3a2010');
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(sx + 8.2, sy + 4.7); c.lineTo(sx + 7.5, sy + 3.7); c.stroke();
    curve(c, sx + 1, sy + 12.4, sx + 3, sy + 13.6, sx + 5, sy + 12.6, 0.6, SHADE);
  }

  /* ---- Unicorn: white horse, spiral horn, rainbow mane and tail ---- */
  function drawUnicornSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.unicorn;
    var WHITE = p.body, LILAC = p.shade, PINK = p.accent;
    var FAR = '#d8c8e0', GOLD = '#f0c860', GOLD2 = '#c89a30';
    var RAINBOW = ['#ff7eb6', '#ffb060', '#ffe66a', '#7fe08a', '#6fb8ff', '#c08cff'];
    groundShadow(c, sx + 26, sy + 45, 18);

    /* Rainbow tail */
    for (var ti = 0; ti < RAINBOW.length; ti++) {
      curve(c, sx + 41, sy + 20 + ti * 1.1, sx + 49 + ti * 0.4, sy + 27 + ti * 1.2, sx + 44 + ti * 0.5, sy + 40 - ti * 0.6, 1.7, RAINBOW[ti]);
    }

    /* Legs with gold hooves */
    var legs = [[20, FAR], [38, FAR], [16, WHITE], [34, WHITE]];
    for (var li = 0; li < legs.length; li++) {
      var lx = sx + legs[li][0];
      limb(c, lx, sy + 28, lx, sy + 42, 3.4, legs[li][1]);
      blob(c, lx, sy + 43, 2.3, 1.6, 0, GOLD2);
    }

    /* Body */
    c.fillStyle = vGrad(c, sy + 15, sy + 33, WHITE, LILAC);
    c.beginPath(); c.ellipse(sx + 28, sy + 24, 15, 9, 0, 0, Math.PI * 2); c.fill();

    /* Neck */
    c.fillStyle = vGrad(c, sy + 8, sy + 28, WHITE, LILAC);
    c.beginPath();
    c.moveTo(sx + 14, sy + 28); c.lineTo(sx + 9, sy + 12);
    c.lineTo(sx + 19, sy + 9); c.lineTo(sx + 23, sy + 22);
    c.closePath(); c.fill();

    /* Rainbow mane flowing down the back of the neck */
    for (var mi = 0; mi < RAINBOW.length; mi++) {
      curve(c, sx + 13 + mi * 1.1, sy + 5.5 + mi * 0.5, sx + 22 + mi * 1.2, sy + 7 + mi * 1.6, sx + 24 + mi * 1.1, sy + 20 + mi * 0.4, 1.9, RAINBOW[mi]);
    }

    /* Head + muzzle */
    blob(c, sx + 11, sy + 12, 6.5, 5.5, 0, WHITE);
    blob(c, sx + 4.5, sy + 15.5, 6.3, 4, 0.3, WHITE);
    blob(c, sx - 0.5, sy + 17.5, 2.4, 2, 0.3, '#f4c8e4');
    c.fillStyle = '#b06090';
    c.beginPath(); c.arc(sx - 1.3, sy + 16.8, 0.5, 0, Math.PI * 2); c.fill();
    curve(c, sx + 0.5, sy + 19.2, sx + 2.4, sy + 20.4, sx + 4.4, sy + 19.6, 0.6, '#b06090');
    /* Forelock */
    curve(c, sx + 12, sy + 6, sx + 6, sy + 6, sx + 5, sy + 11, 2, RAINBOW[0]);
    curve(c, sx + 12.5, sy + 7.5, sx + 7, sy + 8, sx + 6, sy + 12.5, 1.6, RAINBOW[2]);
    /* Ears */
    function ear(x, y, lean) {
      c.fillStyle = WHITE;
      c.beginPath(); c.moveTo(x - 2, y + 4); c.quadraticCurveTo(x + lean, y - 5, x + 2.4, y + 4); c.closePath(); c.fill();
      c.fillStyle = PINK;
      c.beginPath(); c.moveTo(x - 0.8, y + 3.6); c.quadraticCurveTo(x + lean * 0.6, y - 1.5, x + 1.4, y + 3.6); c.closePath(); c.fill();
    }
    ear(sx + 15.5, sy + 5.5, 0.8);
    /* Spiral horn */
    c.fillStyle = vGrad(c, sy - 7, sy + 8, '#fff2c0', GOLD);
    c.beginPath(); c.moveTo(sx + 7.5, sy + 8.5); c.lineTo(sx + 5, sy - 7); c.lineTo(sx + 11.5, sy + 7.5); c.closePath(); c.fill();
    c.strokeStyle = GOLD2; c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(sx + 7.6, sy + 5.5); c.lineTo(sx + 10.6, sy + 4.4);
    c.moveTo(sx + 6.9, sy + 2.2); c.lineTo(sx + 9.6, sy + 1.2);
    c.moveTo(sx + 6.3, sy - 1); c.lineTo(sx + 8.6, sy - 1.8);
    c.moveTo(sx + 5.7, sy - 4); c.lineTo(sx + 7.4, sy - 4.7);
    c.stroke();
    /* Eye with lashes */
    realEye(c, sx + 9.5, sy + 12.5, 1.7, '#7a4aa8');
    c.strokeStyle = '#2a1a30'; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx + 8.4, sy + 10.5); c.lineTo(sx + 7.6, sy + 9.3);
    c.moveTo(sx + 9.8, sy + 10.3); c.lineTo(sx + 9.8, sy + 9);
    c.moveTo(sx + 11.1, sy + 10.6); c.lineTo(sx + 11.8, sy + 9.6);
    c.stroke();
    /* Sparkles */
    function sparkle(x, y, r) {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(x, y - r); c.lineTo(x + r * 0.3, y - r * 0.3); c.lineTo(x + r, y);
      c.lineTo(x + r * 0.3, y + r * 0.3); c.lineTo(x, y + r); c.lineTo(x - r * 0.3, y + r * 0.3);
      c.lineTo(x - r, y); c.lineTo(x - r * 0.3, y - r * 0.3); c.closePath(); c.fill();
    }
    sparkle(sx + 1.5, sy - 2, 2); sparkle(sx + 13, sy - 4, 1.4); sparkle(sx + 44, sy + 17, 1.5);
  }

  /* ---- Sea otter: floating on its back, clam on its chest ---- */
  function drawSeaOtterSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.seaOtter;
    var BODY = p.body, SHADE = p.shade, TAN = p.accent;
    /* Water: pale pool + ripples instead of a hard ground shadow */
    c.save(); c.globalAlpha = 0.55;
    blob(c, sx + 24, sy + 41, 26, 4.5, 0, '#8ecbe6');
    c.restore();
    c.save(); c.globalAlpha = 0.8;
    curve(c, sx - 2, sy + 44, sx + 10, sy + 42.4, sx + 20, sy + 44, 1, '#d8f0fa');
    curve(c, sx + 26, sy + 44.4, sx + 36, sy + 42.8, sx + 50, sy + 44.4, 1, '#d8f0fa');
    c.restore();

    /* Tail: flat paddle at the far right, half under the surface */
    blob(c, sx + 45, sy + 36, 4.5, 2.2, 0.2, SHADE);

    /* Body: long horizontal, belly up */
    c.fillStyle = vGrad(c, sy + 24, sy + 42, BODY, SHADE);
    c.beginPath(); c.ellipse(sx + 25, sy + 33, 19, 8.5, -0.06, 0, Math.PI * 2); c.fill();
    blob(c, sx + 25, sy + 30.5, 13.5, 5, -0.06, TAN);

    /* Hind feet sticking up at the right end (webbed flippers) */
    blob(c, sx + 38.5, sy + 26, 3, 6.5, 0.45, SHADE);
    blob(c, sx + 43, sy + 28.5, 2.8, 6, 0.7, BODY);
    c.strokeStyle = SHADE; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx + 41.6, sy + 24.6); c.lineTo(sx + 44.6, sy + 23.4);
    c.moveTo(sx + 42.6, sy + 25.6); c.lineTo(sx + 45.6, sy + 24.8);
    c.stroke();

    /* Head at the left end, raised */
    blob(c, sx + 7, sy + 24, 8, 7.5, 0, BODY);
    blob(c, sx + 5.5, sy + 26.5, 6, 4.4, 0, TAN);
    /* Small round ears */
    blob(c, sx + 1, sy + 19, 2.1, 2.1, 0, SHADE);
    blob(c, sx + 13.5, sy + 18.5, 2.1, 2.1, 0, SHADE);
    blob(c, sx + 1, sy + 19, 0.9, 0.9, 0, '#d9a0a0');
    blob(c, sx + 13.5, sy + 18.5, 0.9, 0.9, 0, '#d9a0a0');
    /* Nose, mouth, whiskers */
    blob(c, sx + 0.8, sy + 25, 2.2, 1.6, 0, '#1a1a1a');
    c.fillStyle = '#fff'; c.beginPath(); c.arc(sx + 0.3, sy + 24.5, 0.5, 0, Math.PI * 2); c.fill();
    curve(c, sx + 1.5, sy + 26.8, sx + 4, sy + 29.2, sx + 7, sy + 27.2, 0.8, SHADE);
    c.strokeStyle = '#f0e8d8'; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx + 2, sy + 25.5); c.lineTo(sx - 6, sy + 24);
    c.moveTo(sx + 2, sy + 26.5); c.lineTo(sx - 6, sy + 27.5);
    c.moveTo(sx + 11, sy + 26); c.lineTo(sx + 18, sy + 24.5);
    c.stroke();
    realEye(c, sx + 4.8, sy + 22.6, 1.5, '#3a2010');
    realEye(c, sx + 10.4, sy + 22.4, 1.4, '#3a2010');

    /* Front paws holding a clam on the chest */
    blob(c, sx + 14.5, sy + 27.5, 3, 3.2, -0.4, BODY);
    blob(c, sx + 22, sy + 27.5, 3, 3.2, 0.4, BODY);
    blob(c, sx + 18.3, sy + 25.8, 4.6, 3.1, 0, '#e4dccc');
    c.strokeStyle = '#a89a86'; c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(sx + 18.3, sy + 23); c.lineTo(sx + 18.3, sy + 28.6);
    c.moveTo(sx + 16.2, sy + 23.6); c.lineTo(sx + 17, sy + 28.4);
    c.moveTo(sx + 20.4, sy + 23.6); c.lineTo(sx + 19.6, sy + 28.4);
    c.stroke();
    blob(c, sx + 14.5, sy + 27.5, 1.6, 1.8, -0.4, SHADE);
    blob(c, sx + 22, sy + 27.5, 1.6, 1.8, 0.4, SHADE);
  }

  /* ---- Frog: squat on a lily pad, bulging eyes on top, folded hind legs ---- */
  function drawFrogSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.frog;
    var BODY = p.body, SHADE = p.shade, CREAM = p.accent;
    var PAD = '#3f9a52', PAD2 = '#2f7a40';
    /* Lily pad */
    c.fillStyle = PAD;
    c.beginPath(); c.ellipse(sx + 23, sy + 42.5, 24, 4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = PAD2;
    c.beginPath(); c.moveTo(sx + 23, sy + 42.5); c.lineTo(sx + 2, sy + 44.8); c.lineTo(sx + 6, sy + 46.5); c.closePath(); c.fill();
    c.save(); c.globalAlpha = 0.25; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(sx + 23, sy + 42, 16, 2.6, 0, 0, Math.PI * 2); c.fill();
    c.restore();

    /* Folded hind legs: thigh blobs either side + webbed feet forward */
    function foot(x, y, dir) {
      for (var t = -1; t <= 1; t++) {
        limb(c, x, y, x + dir * 5.5, y + 1.6 + t * 1.9, 1.7, BODY);
        blob(c, x + dir * 5.8, y + 1.6 + t * 1.9, 1.2, 1.2, 0, SHADE);
      }
    }
    blob(c, sx + 7, sy + 36, 7.5, 5.5, 0.2, SHADE);
    blob(c, sx + 39, sy + 36, 7.5, 5.5, -0.2, SHADE);
    blob(c, sx + 7.5, sy + 35.5, 6, 4.3, 0.2, BODY);
    blob(c, sx + 38.5, sy + 35.5, 6, 4.3, -0.2, BODY);
    foot(sx + 4, sy + 40, -1); foot(sx + 42, sy + 40, 1);

    /* Body + head: one wide squat mass */
    c.fillStyle = vGrad(c, sy + 18, sy + 43, BODY, SHADE);
    c.beginPath(); c.ellipse(sx + 23, sy + 33, 15.5, 10, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 23, sy + 24, 14, 7.5, 0, 0, Math.PI * 2); c.fill();
    blob(c, sx + 23, sy + 37, 10.5, 5, 0, CREAM);

    /* Front legs resting on the pad */
    limb(c, sx + 15, sy + 35, sx + 13, sy + 42, 2.6, BODY);
    limb(c, sx + 31, sy + 35, sx + 33, sy + 42, 2.6, BODY);
    for (var f = -1; f <= 1; f++) {
      blob(c, sx + 13 + f * 1.8, sy + 42.8, 1, 1, 0, SHADE);
      blob(c, sx + 33 + f * 1.8, sy + 42.8, 1, 1, 0, SHADE);
    }

    /* Back spots */
    c.save(); c.globalAlpha = 0.6;
    blob(c, sx + 17, sy + 28, 1.9, 1.4, 0.3, SHADE); blob(c, sx + 29, sy + 29, 1.6, 1.2, -0.3, SHADE);
    blob(c, sx + 23, sy + 25, 1.3, 1, 0, SHADE); blob(c, sx + 35, sy + 33, 1.3, 1, 0, SHADE);
    c.restore();

    /* Wide mouth + nostrils */
    curve(c, sx + 11, sy + 27, sx + 23, sy + 32.5, sx + 35, sy + 27, 1.1, SHADE);
    c.fillStyle = SHADE;
    c.beginPath(); c.arc(sx + 20.5, sy + 21.5, 0.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 25.5, sy + 21.5, 0.6, 0, Math.PI * 2); c.fill();
    /* Rosy cheeks */
    c.save(); c.globalAlpha = 0.45;
    blob(c, sx + 12, sy + 25, 2.2, 1.3, 0, '#ff9a9a'); blob(c, sx + 34, sy + 25, 2.2, 1.3, 0, '#ff9a9a');
    c.restore();

    /* Bulging eyes on top of the head */
    function frogEye(x, y) {
      blob(c, x, y, 5.2, 5.2, 0, BODY);
      blob(c, x, y + 0.3, 3.6, 3.6, 0, '#f2c232');
      blob(c, x, y + 0.6, 2.4, 1.1, 0, '#111');
      blob(c, x - 1.2, y - 1.2, 0.9, 0.9, 0, '#fff');
      curve(c, x - 4.6, y - 1.2, x, y - 6.2, x + 4.6, y - 1.2, 1.2, SHADE);
    }
    frogEye(sx + 14.5, sy + 18); frogEye(sx + 31.5, sy + 18);
  }

  /* ---------- Group D: eagle, owl, panda, penguin, monkey, alien ---------- */

  /* Bald eagle perched on a short branch, facing left. White head and
     neck, big yellow hooked beak, dark folded wing, white tail fan. */
  function drawEagleSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.eagle;
    var WHITE = '#f6f2ea', WHITE_SH = '#d6cfc0', BEAK = p.accent, BEAK_SH = '#d89a1a';
    groundShadow(c, sx + 22, sy + 45, 20);
    /* Branch */
    limb(c, sx + 2, sy + 42, sx + 46, sy + 41, 4.5, '#6a4a2a');
    limb(c, sx + 2, sy + 42, sx + 46, sy + 41, 2, '#8a6a3a');
    blob(c, sx + 44, sy + 41, 2.4, 2.2, 0, '#4a3018');
    /* White tail fan sweeping back-right */
    c.fillStyle = WHITE;
    c.beginPath();
    c.moveTo(sx + 30, sy + 28);
    c.lineTo(sx + 47, sy + 34);
    c.lineTo(sx + 46, sy + 39);
    c.lineTo(sx + 31, sy + 36);
    c.closePath(); c.fill();
    c.strokeStyle = WHITE_SH; c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(sx + 34, sy + 31); c.lineTo(sx + 45, sy + 35);
    c.moveTo(sx + 33, sy + 34); c.lineTo(sx + 44, sy + 38);
    c.stroke();
    /* Body: dark brown egg leaning forward */
    c.fillStyle = vGrad(c, sy + 14, sy + 40, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 23, sy + 27, 12, 13, -0.3, 0, Math.PI * 2); c.fill();
    /* Folded near wing with feather tips at the trailing edge */
    c.fillStyle = p.shade;
    c.beginPath(); c.ellipse(sx + 27, sy + 25, 8.5, 12.5, -0.45, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3a2408';
    var ft;
    for (ft = 0; ft < 3; ft++) {
      c.beginPath();
      c.moveTo(sx + 30 + ft * 3.4, sy + 32 - ft * 1.2);
      c.lineTo(sx + 35 + ft * 3.4, sy + 36 - ft * 1.6);
      c.lineTo(sx + 32 + ft * 3.4, sy + 35.6 - ft * 1.2);
      c.closePath(); c.fill();
    }
    /* Wing highlight */
    c.save(); c.globalAlpha = 0.18; c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(sx + 24, sy + 19, 4, 7, -0.45, 0, Math.PI * 2); c.fill();
    c.restore();
    /* White neck + head */
    c.fillStyle = WHITE;
    c.beginPath();
    c.moveTo(sx + 6, sy + 10);
    c.quadraticCurveTo(sx + 8, sy + 24, sx + 22, sy + 26);
    c.lineTo(sx + 24, sy + 16);
    c.quadraticCurveTo(sx + 20, sy + 6, sx + 10, sy + 5);
    c.closePath(); c.fill();
    c.fillStyle = vGrad(c, sy + 4, sy + 20, '#ffffff', WHITE_SH);
    c.beginPath(); c.arc(sx + 12, sy + 12, 8, 0, Math.PI * 2); c.fill();
    /* Neck feather ruffle where white meets brown */
    c.fillStyle = WHITE_SH;
    c.beginPath(); c.ellipse(sx + 17, sy + 22, 5, 2.4, 0.5, 0, Math.PI * 2); c.fill();
    /* Big hooked beak */
    c.fillStyle = BEAK;
    c.beginPath();
    c.moveTo(sx + 6, sy + 9);
    c.quadraticCurveTo(sx - 2, sy + 9.5, sx - 3, sy + 14);
    c.quadraticCurveTo(sx - 3.4, sy + 17.5, sx - 1, sy + 18);
    c.lineTo(sx + 1, sy + 15.5);
    c.lineTo(sx + 6, sy + 16);
    c.closePath(); c.fill();
    c.fillStyle = BEAK_SH;
    c.beginPath();
    c.moveTo(sx + 6, sy + 14.4);
    c.lineTo(sx + 1, sy + 15.5);
    c.lineTo(sx - 1, sy + 18);
    c.quadraticCurveTo(sx + 2, sy + 17, sx + 6, sy + 16);
    c.closePath(); c.fill();
    c.fillStyle = '#9a6a10';
    c.beginPath(); c.ellipse(sx + 2.5, sy + 11.5, 0.9, 0.6, 0, 0, Math.PI * 2); c.fill();
    /* Fierce eye with heavy brow */
    realEye(c, sx + 8.5, sy + 11, 1.8, '#e8b020');
    c.strokeStyle = '#2a1a08'; c.lineWidth = 1.3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(sx + 5, sy + 8.4); c.lineTo(sx + 12, sy + 9.2); c.stroke();
    /* Yellow legs and talons gripping the branch */
    limb(c, sx + 19, sy + 35, sx + 17, sy + 40, 2.4, BEAK);
    limb(c, sx + 27, sy + 36, sx + 26, sy + 40, 2.4, BEAK);
    var tl;
    for (tl = -1; tl <= 1; tl++) {
      curve(c, sx + 17, sy + 40, sx + 17 + tl * 3, sy + 41, sx + 17 + tl * 3.4, sy + 44.5, 1.4, BEAK);
      curve(c, sx + 26, sy + 40, sx + 26 + tl * 3, sy + 41, sx + 26 + tl * 3.4, sy + 44.5, 1.4, BEAK);
    }
    c.fillStyle = '#2a1a08';
    for (tl = -1; tl <= 1; tl++) {
      c.beginPath(); c.arc(sx + 17 + tl * 3.4, sy + 44.8, 0.6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(sx + 26 + tl * 3.4, sy + 44.8, 0.6, 0, Math.PI * 2); c.fill();
    }
  }

  /* Upright owl on a branch: huge forward eyes in a pale facial disc,
     ear tufts, speckled chest, folded wings, yellow talons. */
  function drawOwlSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.owl;
    var PALE = '#e8d4b0', PALE_SH = '#c8b088', BEAK = '#e0a040';
    groundShadow(c, sx + 22, sy + 45, 18);
    /* Branch */
    limb(c, sx + 4, sy + 42, sx + 42, sy + 42, 4.5, '#6a4a2a');
    limb(c, sx + 4, sy + 42, sx + 42, sy + 42, 2, '#8a6a3a');
    /* Body egg */
    c.fillStyle = vGrad(c, sy + 12, sy + 42, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 22, sy + 27, 13, 15, 0, 0, Math.PI * 2); c.fill();
    /* Folded wings */
    c.fillStyle = p.shade;
    c.beginPath(); c.ellipse(sx + 10.5, sy + 28, 4.6, 12, 0.12, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 33.5, sy + 28, 4.6, 12, -0.12, 0, Math.PI * 2); c.fill();
    /* Wing feather scallops */
    c.strokeStyle = '#3a2a14'; c.lineWidth = 0.8; c.lineCap = 'round';
    var wf;
    for (wf = 0; wf < 3; wf++) {
      c.beginPath(); c.arc(sx + 10.5, sy + 30 + wf * 3.4, 3.2, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
      c.beginPath(); c.arc(sx + 33.5, sy + 30 + wf * 3.4, 3.2, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
    }
    /* Pale chest with chevron speckles */
    c.fillStyle = vGrad(c, sy + 20, sy + 40, PALE, PALE_SH);
    c.beginPath(); c.ellipse(sx + 22, sy + 30, 8.5, 10.5, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = p.body; c.lineWidth = 0.9;
    var row, col;
    for (row = 0; row < 3; row++) {
      for (col = 0; col < 3; col++) {
        var vx = sx + 17 + col * 5 + (row % 2) * 2.5, vy = sy + 25 + row * 4.5;
        if (col === 2 && row % 2) continue;
        c.beginPath(); c.moveTo(vx - 1.6, vy); c.lineTo(vx, vy + 1.8); c.lineTo(vx + 1.6, vy); c.stroke();
      }
    }
    /* Ear tufts */
    c.fillStyle = p.shade;
    c.beginPath(); c.moveTo(sx + 11, sy + 10); c.lineTo(sx + 8, sy - 1); c.lineTo(sx + 18, sy + 5); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(sx + 33, sy + 10); c.lineTo(sx + 36, sy - 1); c.lineTo(sx + 26, sy + 5); c.closePath(); c.fill();
    /* Head */
    c.fillStyle = vGrad(c, sy + 2, sy + 26, p.body, p.shade);
    c.beginPath(); c.arc(sx + 22, sy + 14, 12, 0, Math.PI * 2); c.fill();
    /* Facial disc: two pale circles with a darker rim */
    c.fillStyle = PALE_SH;
    c.beginPath(); c.arc(sx + 16.5, sy + 15, 7.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 27.5, sy + 15, 7.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = PALE;
    c.beginPath(); c.arc(sx + 16.5, sy + 15, 6.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 27.5, sy + 15, 6.4, 0, Math.PI * 2); c.fill();
    /* Huge golden eyes */
    realEye(c, sx + 16.5, sy + 15, 3.6, p.accent);
    realEye(c, sx + 27.5, sy + 15, 3.6, p.accent);
    /* Small hooked beak */
    c.fillStyle = BEAK;
    c.beginPath(); c.moveTo(sx + 20.2, sy + 18); c.lineTo(sx + 23.8, sy + 18); c.lineTo(sx + 22, sy + 23); c.closePath(); c.fill();
    /* Talons */
    var tl;
    for (tl = -1; tl <= 1; tl++) {
      curve(c, sx + 16, sy + 39, sx + 16 + tl * 2.6, sy + 41, sx + 16 + tl * 3, sy + 44.5, 1.5, '#e8c050');
      curve(c, sx + 28, sy + 39, sx + 28 + tl * 2.6, sy + 41, sx + 28 + tl * 3, sy + 44.5, 1.5, '#e8c050');
    }
  }

  /* Chubby sitting panda, slightly turned toward the viewer, with a
     bamboo stalk: black ears, eye patches, shoulder band, arms and legs. */
  function drawPandaSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.panda;
    var BLACK = p.shade, WHITE = p.body, WHITE_SH = '#cfcfd4';
    groundShadow(c, sx + 23, sy + 45, 20);
    /* Bamboo stalk held in the far (right) paw, drawn behind */
    limb(c, sx + 41, sy + 38, sx + 44, sy + 10, 2.4, '#5fb050');
    c.fillStyle = '#3f8a38';
    var bn;
    for (bn = 0; bn < 3; bn++) c.fillRect(sx + 40 + bn * 0.3, sy + 32 - bn * 7, 3.4, 1);
    blob(c, sx + 46, sy + 9, 4, 1.6, -0.7, '#6fc060');
    blob(c, sx + 41, sy + 8, 4, 1.6, 0.6, '#6fc060');
    /* Body */
    c.fillStyle = vGrad(c, sy + 18, sy + 44, WHITE, WHITE_SH);
    c.beginPath(); c.ellipse(sx + 24, sy + 31, 15, 13, 0, 0, Math.PI * 2); c.fill();
    /* Shoulder band */
    c.fillStyle = BLACK;
    c.beginPath(); c.ellipse(sx + 24, sy + 21.5, 14.5, 5.5, 0, 0, Math.PI * 2); c.fill();
    /* Arms from the band */
    limb(c, sx + 11, sy + 23, sx + 8, sy + 36, 6.4, BLACK);
    limb(c, sx + 37, sy + 23, sx + 40, sy + 36, 6.4, BLACK);
    /* Belly (over the lower band) */
    c.fillStyle = vGrad(c, sy + 22, sy + 42, '#ffffff', WHITE_SH);
    c.beginPath(); c.ellipse(sx + 24, sy + 32, 10.5, 9.5, 0, 0, Math.PI * 2); c.fill();
    /* Legs stuck out in front */
    c.fillStyle = BLACK;
    c.beginPath(); c.ellipse(sx + 15, sy + 40.5, 6.5, 4.4, 0.1, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 33, sy + 40.5, 6.5, 4.4, -0.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#4a4a4a';
    c.beginPath(); c.ellipse(sx + 13, sy + 41.5, 2.6, 1.8, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 35, sy + 41.5, 2.6, 1.8, 0, 0, Math.PI * 2); c.fill();
    /* Ears */
    c.fillStyle = BLACK;
    c.beginPath(); c.arc(sx + 12, sy + 7, 4.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 31, sy + 7, 4.2, 0, Math.PI * 2); c.fill();
    /* Head */
    c.fillStyle = vGrad(c, sy + 4, sy + 26, '#ffffff', WHITE_SH);
    c.beginPath(); c.arc(sx + 21.5, sy + 15, 11.5, 0, Math.PI * 2); c.fill();
    /* Eye patches (teardrops tilted outward) */
    c.fillStyle = BLACK;
    c.beginPath(); c.ellipse(sx + 16.5, sy + 15.5, 3.4, 4.4, 0.45, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 26.5, sy + 15.5, 3.4, 4.4, -0.45, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(sx + 17, sy + 15.5, 1.7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 26, sy + 15.5, 1.7, 0, Math.PI * 2); c.fill();
    eye(c, sx + 17, sy + 15.6, 1.1);
    eye(c, sx + 26, sy + 15.6, 1.1);
    /* Nose + mouth */
    c.fillStyle = BLACK;
    c.beginPath(); c.ellipse(sx + 21.5, sy + 20.5, 2.1, 1.4, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#444'; c.lineWidth = 0.9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(sx + 21.5, sy + 21.8); c.lineTo(sx + 21.5, sy + 23);
    c.moveTo(sx + 19, sy + 23); c.quadraticCurveTo(sx + 21.5, sy + 25, sx + 24, sy + 23); c.stroke();
  }

  /* Upright penguin leaning slightly forward: black back and head,
     white belly, orange beak and webbed feet, flippers, snug scarf. */
  function drawPenguinSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.penguin;
    var WHITE = '#f6f6fa', ORANGE = '#f0a030', ORANGE_SH = '#c87818', SCARF = '#d83a4a';
    groundShadow(c, sx + 22, sy + 45, 16);
    /* Far flipper */
    c.fillStyle = p.shade;
    c.beginPath(); c.ellipse(sx + 11, sy + 29, 3.2, 9.5, 0.3, 0, Math.PI * 2); c.fill();
    /* Feet (behind body bottom) */
    c.fillStyle = ORANGE;
    c.beginPath(); c.ellipse(sx + 15, sy + 43, 5.5, 2, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 26, sy + 43, 5.5, 2, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = ORANGE_SH; c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(sx + 13, sy + 42); c.lineTo(sx + 11, sy + 44.5);
    c.moveTo(sx + 15, sy + 42); c.lineTo(sx + 15, sy + 44.8);
    c.moveTo(sx + 24, sy + 42); c.lineTo(sx + 22, sy + 44.5);
    c.moveTo(sx + 26, sy + 42); c.lineTo(sx + 26, sy + 44.8);
    c.stroke();
    /* Body + head as one leaning egg */
    c.fillStyle = vGrad(c, sy + 4, sy + 44, '#2a2a40', p.shade);
    c.beginPath(); c.ellipse(sx + 22, sy + 26, 13, 17, -0.12, 0, Math.PI * 2); c.fill();
    /* White belly */
    c.fillStyle = vGrad(c, sy + 14, sy + 42, '#ffffff', '#dcdce6');
    c.beginPath(); c.ellipse(sx + 18.5, sy + 30, 8.5, 12, -0.12, 0, Math.PI * 2); c.fill();
    /* Face patch */
    c.fillStyle = WHITE;
    c.beginPath(); c.ellipse(sx + 15, sy + 13.5, 5.2, 4.6, -0.2, 0, Math.PI * 2); c.fill();
    /* Beak */
    c.fillStyle = ORANGE;
    c.beginPath(); c.moveTo(sx + 11, sy + 12.5); c.lineTo(sx + 2.5, sy + 15); c.lineTo(sx + 11, sy + 17); c.closePath(); c.fill();
    c.fillStyle = ORANGE_SH;
    c.beginPath(); c.moveTo(sx + 11, sy + 15.2); c.lineTo(sx + 2.5, sy + 15); c.lineTo(sx + 11, sy + 17); c.closePath(); c.fill();
    /* Eye */
    eye(c, sx + 13.5, sy + 12.6, 1.7);
    /* Blush */
    c.save(); c.globalAlpha = 0.35; c.fillStyle = '#ff8aa0';
    c.beginPath(); c.ellipse(sx + 16.5, sy + 16.5, 1.8, 1.1, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Near flipper */
    c.fillStyle = vGrad(c, sy + 18, sy + 38, '#2a2a40', p.shade);
    c.beginPath(); c.ellipse(sx + 31, sy + 28, 3.6, 10, -0.38, 0, Math.PI * 2); c.fill();
    /* Scarf: wrapped band + hanging tail */
    c.fillStyle = SCARF;
    c.beginPath(); c.ellipse(sx + 20, sy + 20, 10.5, 3.2, -0.14, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f05a68';
    c.beginPath(); c.ellipse(sx + 20, sy + 19.3, 9.5, 1.6, -0.14, 0, Math.PI * 2); c.fill();
    limb(c, sx + 28.5, sy + 21, sx + 32, sy + 30, 3.6, SCARF);
    c.strokeStyle = '#f0c040'; c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(sx + 30.6, sy + 31.5); c.lineTo(sx + 30.6, sy + 33.5);
    c.moveTo(sx + 32.4, sy + 31.5); c.lineTo(sx + 32.4, sy + 33.5);
    c.moveTo(sx + 33.8, sy + 30.5); c.lineTo(sx + 34.2, sy + 32.5);
    c.stroke();
  }

  /* Sitting brown monkey with a tan face mask and belly, long arms and
     a prehensile tail curling up to the right. Bounding box matches the
     old sprite (ChandelierMonkey and ui.js rely on it). */
  function drawMonkeySprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.monkey;
    var TAN = p.accent, TAN_SH = '#dcb888';
    groundShadow(c, sx + 22, sy + 45, 18);
    /* Tail */
    c.save(); c.strokeStyle = p.body; c.lineWidth = 3.4; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(sx + 33, sy + 34);
    c.bezierCurveTo(sx + 50, sy + 34, sx + 54, sy + 18, sx + 44, sy + 14);
    c.bezierCurveTo(sx + 39, sy + 12, sx + 38, sy + 18, sx + 42, sy + 19);
    c.stroke();
    c.restore();
    /* Far arm + hand */
    limb(c, sx + 31, sy + 27, sx + 38, sy + 38, 4.4, p.shade);
    blob(c, sx + 39, sy + 39.5, 2.8, 2.2, 0, TAN_SH);
    /* Body */
    c.fillStyle = vGrad(c, sy + 18, sy + 44, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 23, sy + 31, 12, 12, 0, 0, Math.PI * 2); c.fill();
    /* Belly */
    c.fillStyle = vGrad(c, sy + 24, sy + 42, TAN, TAN_SH);
    c.beginPath(); c.ellipse(sx + 22, sy + 33, 7.5, 8, 0, 0, Math.PI * 2); c.fill();
    /* Legs folded in front, feet on the baseline */
    c.fillStyle = p.body;
    c.beginPath(); c.ellipse(sx + 15, sy + 38.5, 6, 4.5, 0.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 30, sy + 38.5, 6, 4.5, -0.2, 0, Math.PI * 2); c.fill();
    blob(c, sx + 12, sy + 43, 4.2, 2, 0, TAN);
    blob(c, sx + 32, sy + 43, 4.2, 2, 0, TAN);
    /* Near arm + hand */
    limb(c, sx + 15, sy + 27, sx + 8, sy + 39, 4.4, p.body);
    blob(c, sx + 7, sy + 41, 2.9, 2.3, 0, TAN);
    /* Ears */
    blob(c, sx + 2.5, sy + 14, 3.4, 3.4, 0, p.body);
    blob(c, sx + 22, sy + 14, 3.4, 3.4, 0, p.body);
    blob(c, sx + 2.5, sy + 14, 1.8, 1.8, 0, TAN);
    blob(c, sx + 22, sy + 14, 1.8, 1.8, 0, TAN);
    /* Head */
    c.fillStyle = vGrad(c, sy + 4, sy + 26, p.body, p.shade);
    c.beginPath(); c.arc(sx + 12, sy + 15, 10.2, 0, Math.PI * 2); c.fill();
    /* Hair tuft */
    c.fillStyle = p.shade;
    c.beginPath(); c.moveTo(sx + 10, sy + 6); c.quadraticCurveTo(sx + 12, sy + 1, sx + 14, sy + 5.5); c.closePath(); c.fill();
    /* Face mask: two cheek lobes + muzzle */
    c.fillStyle = TAN;
    c.beginPath(); c.arc(sx + 8.5, sy + 14.5, 4.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 15.5, sy + 14.5, 4.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 12, sy + 19.5, 5.8, 4.2, 0, 0, Math.PI * 2); c.fill();
    /* Eyes */
    realEye(c, sx + 9, sy + 14.5, 1.8, '#3a2010');
    realEye(c, sx + 15, sy + 14.5, 1.8, '#3a2010');
    /* Nostrils + smile */
    c.fillStyle = '#5a3818';
    c.beginPath(); c.arc(sx + 10.8, sy + 19.2, 0.7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(sx + 13.2, sy + 19.2, 0.7, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#5a3818'; c.lineWidth = 0.9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(sx + 9, sy + 21.4); c.quadraticCurveTo(sx + 12, sy + 23.6, sx + 15, sy + 21.4); c.stroke();
  }

  /* Friendly green alien: big domed head with two pink-tipped antennae,
     large dark almond eyes, small body, three-fingered hands. */
  function drawAlienSprite(c, sx, sy) {
    var p = ANIMAL_PALETTES.alien;
    var LIGHT = '#b8f0b8';
    groundShadow(c, sx + 22, sy + 45, 14);
    /* Soft glow */
    c.save(); c.globalAlpha = 0.18; c.fillStyle = p.body;
    c.beginPath(); c.ellipse(sx + 22, sy + 22, 20, 20, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Antennae */
    curve(c, sx + 16, sy + 7, sx + 11, sy - 2, sx + 9, sy - 2, 1.7, p.shade);
    curve(c, sx + 28, sy + 7, sx + 33, sy - 2, sx + 35, sy - 2, 1.7, p.shade);
    blob(c, sx + 8.5, sy - 2.5, 2.4, 2.4, 0, p.accent);
    blob(c, sx + 35.5, sy - 2.5, 2.4, 2.4, 0, p.accent);
    blob(c, sx + 7.8, sy - 3.2, 0.8, 0.8, 0, '#ffd6f0');
    blob(c, sx + 34.8, sy - 3.2, 0.8, 0.8, 0, '#ffd6f0');
    /* Feet */
    blob(c, sx + 16, sy + 43, 4.6, 2, 0, p.shade);
    blob(c, sx + 28, sy + 43, 4.6, 2, 0, p.shade);
    /* Arms + three-fingered hands */
    limb(c, sx + 14, sy + 29, sx + 6, sy + 37, 3, p.body);
    limb(c, sx + 30, sy + 29, sx + 38, sy + 37, 3, p.body);
    var f;
    for (f = -1; f <= 1; f++) {
      limb(c, sx + 6, sy + 37, sx + 4 + f * 2.2, sy + 40.5, 1.6, p.body);
      limb(c, sx + 38, sy + 37, sx + 40 + f * 2.2, sy + 40.5, 1.6, p.body);
    }
    /* Body */
    c.fillStyle = vGrad(c, sy + 22, sy + 44, p.body, p.shade);
    c.beginPath(); c.ellipse(sx + 22, sy + 33, 10, 10, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = LIGHT;
    c.beginPath(); c.ellipse(sx + 22, sy + 34.5, 5.5, 6, 0, 0, Math.PI * 2); c.fill();
    /* Head: wide dome, narrow chin */
    c.fillStyle = vGrad(c, sy + 4, sy + 28, p.body, p.shade);
    c.beginPath();
    c.moveTo(sx + 9, sy + 16);
    c.bezierCurveTo(sx + 8, sy + 2, sx + 36, sy + 2, sx + 35, sy + 16);
    c.bezierCurveTo(sx + 34, sy + 24, sx + 26, sy + 28, sx + 22, sy + 28);
    c.bezierCurveTo(sx + 18, sy + 28, sx + 10, sy + 24, sx + 9, sy + 16);
    c.closePath(); c.fill();
    /* Dome highlight */
    c.save(); c.globalAlpha = 0.35; c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(sx + 16, sy + 9, 4.5, 2.6, -0.3, 0, Math.PI * 2); c.fill();
    c.restore();
    /* Big almond eyes */
    c.fillStyle = '#141428';
    c.beginPath(); c.ellipse(sx + 16, sy + 16, 3.4, 5, 0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 28, sy + 16, 3.4, 5, -0.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(sx + 15, sy + 14, 1.1, 1.6, 0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(sx + 27, sy + 14, 1.1, 1.6, -0.3, 0, Math.PI * 2); c.fill();
    /* Smile */
    c.strokeStyle = p.shade; c.lineWidth = 1; c.lineCap = 'round';
    c.beginPath(); c.moveTo(sx + 19, sy + 23); c.quadraticCurveTo(sx + 22, sy + 25.5, sx + 25, sy + 23); c.stroke();
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
    /* Species name plate — the door's only label. Text shrinks to fit
       the plate; names too long even at the minimum size widen it. */
    var label = (this.species === 'bedroom')
      ? 'MOMOKO'
      : Game.i18n.t('animalName_' + this.species).toUpperCase();
    var plSize = 8;
    do {
      c.font = 'bold ' + plSize + 'px "M PLUS Rounded 1c", sans-serif';
    } while (c.measureText(label).width > 34 && --plSize > 6);
    var plW = Math.max(38, Math.ceil(c.measureText(label).width) + 4);
    c.fillStyle = '#fff8e0';
    c.fillRect(sx + 24 - plW / 2, sy + 7, plW, 12);
    c.strokeStyle = p.shade;
    c.lineWidth = 1;
    c.strokeRect(sx + 24 - plW / 2, sy + 7, plW, 12);
    c.fillStyle = '#1a1a1a';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(label, sx + 24, sy + 13.5);
    c.textBaseline = 'alphabetic';
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
      c.font = 'bold 11px "M PLUS Rounded 1c", sans-serif';
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
        c.font = 'bold 11px "M PLUS Rounded 1c", sans-serif';
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
    c.font = 'bold 4px "M PLUS Rounded 1c", sans-serif';
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
        c.font = 'bold 11px "M PLUS Rounded 1c", sans-serif';
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
    var stLabel = Game.i18n.t('signStairs');
    var stSize = 8;
    do {
      c.font = 'bold ' + stSize + 'px "M PLUS Rounded 1c", sans-serif';
    } while (c.measureText(stLabel).width > 32 && --stSize > 6);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(stLabel, sx + 25, sy - 8);
    c.textBaseline = 'alphabetic';
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
    c.font = 'bold 12px "M PLUS Rounded 1c", sans-serif';
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
