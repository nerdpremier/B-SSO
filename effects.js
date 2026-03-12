/**
 * effects.js — CARS SSO "Meridian"
 * Space / nebula animated background:
 *   – Layered twinkling stars (3 sizes)
 *   – Occasional shooting stars
 *   – Soft nebula glow clouds
 *   – Faint constellation lines between nearby stars
 * Also: page transitions (CarsNav), toast system (CarsToast), button ripple
 */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     1. SPACE CANVAS BACKGROUND
     ══════════════════════════════════════════════════════════ */
  (function initCanvas() {
    var canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    if (document.body.firstChild) document.body.insertBefore(canvas, document.body.firstChild);
    else document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0;
    var stars = [], shooters = [], nebulae = [];
    var mouse = { x: -9999, y: -9999 };
    var tick = 0;

    /* ── Nebula clouds ─────────────────────────────────────── */
    var NEBULA_DEFS = [
      { rx: .15, ry: .18, r: 340, c: [80, 60, 180], a: .13 },   // purple top-left
      { rx: .82, ry: .25, r: 280, c: [20, 100, 200], a: .10 },  // blue top-right
      { rx: .55, ry: .75, r: 320, c: [60, 20, 140], a: .09 },   // deep violet bottom
      { rx: .25, ry: .65, r: 200, c: [0,  60, 120], a: .07 },   // teal left
    ];

    function buildNebulae() {
      nebulae = NEBULA_DEFS.map(function (d) {
        return { x: d.rx * W, y: d.ry * H, r: d.r, c: d.c, a: d.a };
      });
    }

    function drawNebulae() {
      nebulae.forEach(function (n) {
        var g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        var col = 'rgba(' + n.c[0] + ',' + n.c[1] + ',' + n.c[2] + ',';
        g.addColorStop(0,   col + n.a + ')');
        g.addColorStop(.5,  col + (n.a * .5) + ')');
        g.addColorStop(1,   col + '0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    /* ── Stars ─────────────────────────────────────────────── */
    function Star() {
      this.x     = Math.random() * W;
      this.y     = Math.random() * H;
      this.size  = Math.random() < .65 ? .6 + Math.random() * .7   // tiny
                 : Math.random() < .8  ? 1.1 + Math.random() * .8  // small
                 : 1.8 + Math.random() * 1.0;                       // medium
      this.baseA = .25 + Math.random() * .65;
      this.alpha = this.baseA;
      this.phase = Math.random() * Math.PI * 2;
      this.speed = .004 + Math.random() * .012;
      // slight warm/cool tint
      var t = Math.random();
      this.r = t < .3 ? 200 : t < .6 ? 230 : 255;
      this.g = t < .3 ? 210 : t < .6 ? 235 : 255;
      this.b = t < .3 ? 255 : t < .6 ? 255 : 220;
    }
    Star.prototype.update = function () {
      this.phase += this.speed;
      this.alpha = this.baseA + Math.sin(this.phase) * this.baseA * .45;
    };
    Star.prototype.draw = function () {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + this.r + ',' + this.g + ',' + this.b + ',' + this.alpha + ')';
      ctx.fill();
      // soft glow halo on bigger stars
      if (this.size > 1.5) {
        var g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 4);
        g.addColorStop(0, 'rgba(' + this.r + ',' + this.g + ',' + this.b + ',' + (this.alpha * .3) + ')');
        g.addColorStop(1, 'rgba(' + this.r + ',' + this.g + ',' + this.b + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    function spawnStars() {
      stars = [];
      var n = Math.min(220, Math.floor(W * H / 5500));
      for (var i = 0; i < n; i++) stars.push(new Star());
    }

    /* ── Constellation lines ───────────────────────────────── */
    // Connect stars that are close enough with a faint line
    var CONST_DIST = 90;
    function drawConstellations() {
      var big = stars.filter(function (s) { return s.size > 1.3; });
      ctx.lineWidth = .4;
      for (var i = 0; i < big.length; i++) {
        for (var j = i + 1; j < big.length; j++) {
          var dx = big[i].x - big[j].x, dy = big[i].y - big[j].y;
          var d = Math.sqrt(dx*dx + dy*dy);
          if (d < CONST_DIST) {
            var a = .07 * (1 - d / CONST_DIST) * Math.min(big[i].alpha, big[j].alpha);
            ctx.strokeStyle = 'rgba(160,180,255,' + a + ')';
            ctx.beginPath();
            ctx.moveTo(big[i].x, big[i].y);
            ctx.lineTo(big[j].x, big[j].y);
            ctx.stroke();
          }
        }
      }
    }

    /* ── Shooting stars ────────────────────────────────────── */
    function Shooter() {
      // start from random top/right edge
      this.x    = Math.random() * W * 1.2;
      this.y    = Math.random() * H * .4;
      var angle = .4 + Math.random() * .35;       // downward-right angle
      var spd   = 8 + Math.random() * 10;
      this.vx   = Math.cos(angle) * spd;
      this.vy   = Math.sin(angle) * spd;
      this.len  = 60 + Math.random() * 100;
      this.life = 1.0;
      this.fade = .025 + Math.random() * .018;
      this.w    = .8 + Math.random() * 1.0;
    }
    Shooter.prototype.update = function () {
      this.x += this.vx;
      this.y += this.vy;
      this.life -= this.fade;
    };
    Shooter.prototype.draw = function () {
      if (this.life <= 0) return;
      var tx = this.x - (this.vx / Math.hypot(this.vx, this.vy)) * this.len;
      var ty = this.y - (this.vy / Math.hypot(this.vx, this.vy)) * this.len;
      var g  = ctx.createLinearGradient(tx, ty, this.x, this.y);
      g.addColorStop(0,   'rgba(255,255,255,0)');
      g.addColorStop(.6,  'rgba(200,220,255,' + (this.life * .5) + ')');
      g.addColorStop(1,   'rgba(255,255,255,' + (this.life * .95) + ')');
      ctx.strokeStyle = g;
      ctx.lineWidth   = this.w;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
    };

    /* ── Mouse parallax highlight ──────────────────────────── */
    function drawMouseGlow() {
      if (mouse.x < 0) return;
      var g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 180);
      g.addColorStop(0,   'rgba(100,130,255,.06)');
      g.addColorStop(1,   'rgba(100,130,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 180, 0, Math.PI * 2);
      ctx.fill();
    }

    /* ── Main loop ─────────────────────────────────────────── */
    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
      buildNebulae();
      spawnStars();
    }

    function loop() {
      tick++;
      ctx.clearRect(0, 0, W, H);

      drawNebulae();
      drawMouseGlow();
      drawConstellations();

      // Update + draw stars
      for (var i = 0; i < stars.length; i++) {
        stars[i].update();
        stars[i].draw();
      }

      // Spawn shooting star ~every 3s on average
      if (Math.random() < .0055) shooters.push(new Shooter());

      // Update + draw shooters, cull dead ones
      shooters = shooters.filter(function (s) {
        s.update();
        if (s.life > 0) { s.draw(); return true; }
        return false;
      });

      requestAnimationFrame(loop);
    }

    window.addEventListener('resize', function () { resize(); });
    document.addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; });
    document.addEventListener('mouseleave', function () { mouse.x = -9999; mouse.y = -9999; });

    resize();
    loop();
  })();


  /* ══════════════════════════════════════════════════════════
     2. PAGE TRANSITION SYSTEM
     ══════════════════════════════════════════════════════════ */
  window.CarsNav = {
    go: function (url, replace) {
      document.body.classList.add('page-exit');
      setTimeout(function () {
        if (replace) window.location.replace(url);
        else         window.location.href = url;
      }, 260);
    }
  };

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    CarsNav.go(href);
  });


  /* ══════════════════════════════════════════════════════════
     3. TOAST NOTIFICATION SYSTEM
     ══════════════════════════════════════════════════════════ */
  var _toastContainer = null;
  function getToastContainer() {
    if (!_toastContainer) {
      _toastContainer = document.createElement('div');
      _toastContainer.className = 'toast-container';
      _toastContainer.setAttribute('aria-live', 'polite');
      _toastContainer.setAttribute('aria-atomic', 'false');
      document.body.appendChild(_toastContainer);
    }
    return _toastContainer;
  }

  var ICONS = { success:'✅', danger:'⚠️', warning:'🔔', info:'ℹ️' };

  window.CarsToast = function (opts) {
    var container = getToastContainer();
    var type      = opts.type || 'info';
    var duration  = opts.duration != null ? opts.duration : 4000;

    var toast = document.createElement('div');
    toast.className = 'toast toast--' + type;
    toast.setAttribute('role', 'alert');

    var iconEl = document.createElement('span');
    iconEl.className = 'toast-icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.textContent = ICONS[type] || 'ℹ️';

    var bodyEl = document.createElement('div');
    bodyEl.className = 'toast-body';
    if (opts.title) {
      var t = document.createElement('div'); t.className = 'toast-title'; t.textContent = opts.title;
      bodyEl.appendChild(t);
    }
    var m = document.createElement('div'); m.className = 'toast-msg'; m.textContent = opts.msg;
    bodyEl.appendChild(m);

    var closeEl = document.createElement('button');
    closeEl.className = 'toast-close'; closeEl.setAttribute('aria-label', 'Dismiss'); closeEl.textContent = '×';

    var prog = document.createElement('div'); prog.className = 'toast-progress';

    toast.appendChild(iconEl); toast.appendChild(bodyEl); toast.appendChild(closeEl); toast.appendChild(prog);
    container.appendChild(toast);

    var timer = null;
    function dismiss() {
      clearTimeout(timer);
      toast.classList.add('toast--exit');
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 260);
    }
    closeEl.addEventListener('click', dismiss);
    if (duration > 0) {
      timer = setTimeout(dismiss, duration);
      toast.addEventListener('mouseenter', function () { clearTimeout(timer); prog.getAnimations && prog.getAnimations().forEach(function(a){ a.pause(); }); });
      toast.addEventListener('mouseleave', function () { timer = setTimeout(dismiss, 1500); prog.getAnimations && prog.getAnimations().forEach(function(a){ a.play(); }); });
    }
    return { dismiss: dismiss };
  };


  /* ══════════════════════════════════════════════════════════
     4. BUTTON RIPPLE
     ══════════════════════════════════════════════════════════ */
  function rippleOn(btn, e) {
    var rect = btn.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 2.6;
    var cx   = e && e.clientX != null ? e.clientX - rect.left : rect.width  / 2;
    var cy   = e && e.clientY != null ? e.clientY - rect.top  : rect.height / 2;
    var el   = document.createElement('span');
    el.setAttribute('aria-hidden', 'true');
    btn.appendChild(el);
    var anim = el.animate([
      { position:'absolute', width:size+'px', height:size+'px', left:(cx-size/2)+'px', top:(cy-size/2)+'px', borderRadius:'50%', background:'rgba(255,255,255,0.18)', transform:'scale(0)', opacity:'1', pointerEvents:'none' },
      { transform:'scale(1)', opacity:'0' }
    ], { duration:560, easing:'ease-out', fill:'forwards' });
    anim.onfinish = function () { el.remove(); };
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-primary,.btn-portal,.btn-signout,.btn-create');
    if (btn) rippleOn(btn, e);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var el = document.activeElement;
      if (el && el.matches('.btn-primary,.btn-portal,.btn-signout,.btn-create')) rippleOn(el, null);
    }
  });

}());
