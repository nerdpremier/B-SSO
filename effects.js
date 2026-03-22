/**
 * effects.js — B-SSO (Behavioral Risk-Based Single Sign-On)
 * Dark navy background + interactive grid tiles that glow & flip to white near mouse
 */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     1.  INTERACTIVE CANVAS (Google Antigravity Soft Blurred Aura)
     ══════════════════════════════════════════════════════════ */
  (function initCanvas() {
    var canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    // Ensure the canvas sits behind everything but doesn't block clicks
    canvas.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; pointer-events: none; mix-blend-mode: multiply;';
    document.body.insertBefore(canvas, document.body.firstChild);

    var ctx = canvas.getContext('2d', { alpha: false });
    var W = 0, H = 0, cx = 0, cy = 0;

    /* ── Mouse ────────────────────────── */
    var mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    var targetMouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    /* ── Blobs ────────────────────── */
    var blobs = [
      { color: 'rgba(56, 189, 248, 0.4)', size: 600, x: 0, y: 0, vx: 0.5, vy: 0.3, phaseX: 0, phaseY: 0, speed: 0.001, followWeight: 0.05 }, // Aqua/Blue
      { color: 'rgba(167, 139, 250, 0.4)', size: 500, x: 0, y: 0, vx: -0.4, vy: 0.6, phaseX: 1, phaseY: 2, speed: 0.0015, followWeight: 0.03 }, // Purple
      { color: 'rgba(244, 114, 182, 0.3)', size: 400, x: 0, y: 0, vx: 0.6, vy: -0.4, phaseX: 2, phaseY: 1, speed: 0.002, followWeight: 0.08 }  // Pink
    ];

    /* ── Init & Resize ───────────────────────────────────── */
    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      cx = W / 2;
      cy = H / 2;
      
      // Initialize blob positions
      blobs.forEach(blob => {
        blob.x = cx;
        blob.y = cy;
      });
    }

    /* ── Main loop ───────────────────────────────────────── */
    function loop(time) {
      // 1. Draw solid white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // Smoothly interpolate mouse position for a "fluid" dragging effect
      mouse.x += (targetMouse.x - mouse.x) * 0.05;
      mouse.y += (targetMouse.y - mouse.y) * 0.05;

      // Composite mode for soft color blending
      ctx.globalCompositeOperation = 'multiply';

      // 2. Draw Blobs
      blobs.forEach(blob => {
        // Natural drifting ( Lissajous curve )
        blob.phaseX += blob.speed;
        blob.phaseY += blob.speed;
        
        var driftX = Math.sin(blob.phaseX) * W * 0.2;
        var driftY = Math.cos(blob.phaseY) * H * 0.2;

        // Combine base drift with gentle mouse following
        var targetX = mouse.x + driftX;
        var targetY = mouse.y + driftY;

        blob.x += (targetX - blob.x) * blob.followWeight;
        blob.y += (targetY - blob.y) * blob.followWeight;

        // Draw radial gradient (soft blur)
        var grd = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.size);
        grd.addColorStop(0, blob.color);
        
        // Extract base color, set alpha to 0 for the edge
        var edgeColor = blob.color.replace(/[\d.]+\)$/g, '0)'); 
        grd.addColorStop(1, edgeColor);

        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);
      });

      // Restore normal composite operation to draw vignette
      ctx.globalCompositeOperation = 'source-over';

      // 3. Draw soft noise / texture overlay if desired, or just vignette
      var vignette = ctx.createRadialGradient(cx, cy, H * 0.3, cx, cy, H * 1.5);
      vignette.addColorStop(0, 'rgba(240, 249, 255, 0)');
      vignette.addColorStop(1, 'rgba(224, 242, 254, 0.6)'); // Soft light blue at edges
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);

      requestAnimationFrame(loop);
    }

    /* ── Events ──────────────────────────────────────────── */
    window.addEventListener('resize', resize);
    document.addEventListener('mousemove', function(e) { 
      targetMouse.x = e.clientX; 
      targetMouse.y = e.clientY; 
    });
    
    // When mouse leaves, return blobs to center slowly
    document.addEventListener('mouseleave', function() { 
      targetMouse.x = cx;
      targetMouse.y = cy;
    });

    resize();
    requestAnimationFrame(loop);
  })();

  /* ══════════════════════════════════════════════════════════
     2.  PAGE TRANSITIONS
     ══════════════════════════════════════════════════════════ */
  window.CarsNav = {
    go: function(url, replace) {
      document.body.classList.add('page-exit');
      setTimeout(function() {
        if (replace) window.location.replace(url);
        else window.location.href = url;
      }, 260);
    }
  };
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a[href]'); if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') ||
        href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); CarsNav.go(href);
  });

  /* ══════════════════════════════════════════════════════════
     3.  TOAST SYSTEM
     ══════════════════════════════════════════════════════════ */
  var _tc = null;
  function getTC() {
    if (!_tc) {
      _tc = document.createElement('div');
      _tc.className = 'toast-container';
      _tc.setAttribute('aria-live', 'polite');
      document.body.appendChild(_tc);
    }
    return _tc;
  }
  var ICONS = { success: 'fas fa-check', danger: 'fas fa-exclamation-triangle', warning: 'fas fa-bell', info: 'fas fa-info-circle' };
  window.CarsToast = function(opts) {
    var type = opts.type || 'info';
    var dur  = opts.duration != null ? opts.duration : 4000;
    var t  = document.createElement('div'); t.className = 'toast toast--' + type; t.setAttribute('role', 'alert');
    var ic = document.createElement('i'); ic.className = 'toast-icon ' + (ICONS[type] || 'fas fa-info-circle'); ic.setAttribute('aria-hidden', 'true');
    var bd = document.createElement('div'); bd.className = 'toast-body';
    if (opts.title) {
      var tt = document.createElement('div'); tt.className = 'toast-title'; tt.textContent = opts.title; bd.appendChild(tt);
    }
    var mm = document.createElement('div'); mm.className = 'toast-msg'; mm.textContent = opts.msg; bd.appendChild(mm);
    var cl = document.createElement('button'); cl.className = 'toast-close'; cl.setAttribute('aria-label', 'Dismiss'); cl.textContent = '×';
    var pr = document.createElement('div'); pr.className = 'toast-progress';
    t.appendChild(ic); t.appendChild(bd); t.appendChild(cl); t.appendChild(pr);
    getTC().appendChild(t);
    var timer = null;
    function dismiss() {
      clearTimeout(timer);
      t.classList.add('toast--exit');
      setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
    }
    cl.addEventListener('click', dismiss);
    if (dur > 0) {
      timer = setTimeout(dismiss, dur);
      t.addEventListener('mouseenter', function() { clearTimeout(timer); });
      t.addEventListener('mouseleave', function() { timer = setTimeout(dismiss, 1500); });
    }
    return { dismiss: dismiss };
  };

  /* ══════════════════════════════════════════════════════════
     4.  BUTTON RIPPLE
     ══════════════════════════════════════════════════════════ */
  function ripple(btn, e) {
    var rect = btn.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 2.6;
    var cx   = e && e.clientX != null ? e.clientX - rect.left : rect.width  / 2;
    var cy   = e && e.clientY != null ? e.clientY - rect.top  : rect.height / 2;
    var el   = document.createElement('span'); el.setAttribute('aria-hidden', 'true'); btn.appendChild(el);
    var anim = el.animate([
      { position: 'absolute', width: size + 'px', height: size + 'px',
        left: (cx - size / 2) + 'px', top: (cy - size / 2) + 'px',
        borderRadius: '50%', background: 'rgba(255,255,255,0.25)',
        transform: 'scale(0)', opacity: '1', pointerEvents: 'none' },
      { transform: 'scale(1)', opacity: '0' }
    ], { duration: 560, easing: 'ease-out', fill: 'forwards' });
    anim.onfinish = function() { el.remove(); };
  }
  document.addEventListener('click', function(e) {
    var b = e.target.closest('.btn-primary,.btn-portal,.btn-signout,.btn-create');
    if (b) ripple(b, e);
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var el = document.activeElement;
      if (el && el.matches('.btn-primary,.btn-portal,.btn-signout,.btn-create')) ripple(el, null);
    }
  });

}());
