/**
 * effects.js — CARS SSO (Light Theme, Interactive)
 * 1. SSO node network — nodes attracted to mouse, repel on click
 * 2. Soft parallax gradient orbs
 * 3. Dot grid that ripples outward from mouse
 * 4. CarsNav page transitions
 * 5. CarsToast notifications
 * 6. Button ripple
 */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     1. INTERACTIVE CANVAS
     ══════════════════════════════════════════════════════════ */
  (function initCanvas() {
    var canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);

    var ctx    = canvas.getContext('2d');
    var W = 0, H = 0, tick = 0;

    /* ── Mouse state ─────────────────────────────────────── */
    var mouse   = { x: -9999, y: -9999, px: -9999, py: -9999 }; // px/py = smoothed
    var clicks  = [];   // ripple bursts on click

    /* ── Color palette ───────────────────────────────────── */
    var C = {
      blue:   [79,  110, 247],
      indigo: [109,  68, 234],
      teal:   [ 14, 164, 114],
      violet: [155,  48, 220],
    };

    /* ═══════════════════════════════════════════════════════
       SOFT BACKGROUND ORBS (parallax with mouse)
       ═══════════════════════════════════════════════════════ */
    var ORB_DEFS = [
      { rx:.10, ry:.15, r:460, c:C.blue,   a:.07, spd:.00016, ang:1.2, orR:32, px:.025 },
      { rx:.88, ry:.18, r:380, c:C.indigo, a:.06, spd:.00012, ang:3.0, orR:26, px:.018 },
      { rx:.50, ry:.90, r:420, c:C.teal,   a:.06, spd:.00019, ang:5.1, orR:30, px:.020 },
      { rx:.20, ry:.72, r:290, c:C.violet, a:.05, spd:.00014, ang:2.4, orR:22, px:.012 },
      { rx:.80, ry:.58, r:250, c:C.blue,   a:.04, spd:.00021, ang:4.0, orR:20, px:.010 },
    ];
    var orbs = [];
    function buildOrbs() {
      orbs = ORB_DEFS.map(function(d) {
        return { bx:d.rx*W, by:d.ry*H, x:d.rx*W, y:d.ry*H,
                 r:d.r, c:d.c, a:d.a, spd:d.spd, ang:d.ang, orR:d.orR, px:d.px };
      });
    }
    function updateOrbs() {
      var mx = (mouse.px - W*.5) / W;
      var my = (mouse.py - H*.5) / H;
      orbs.forEach(function(o) {
        o.ang += o.spd;
        o.x = o.bx + Math.cos(o.ang)*o.orR - mx*W*o.px;
        o.y = o.by + Math.sin(o.ang)*o.orR*.7 - my*H*o.px*.5;
      });
    }
    function drawOrbs() {
      orbs.forEach(function(o) {
        var g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        var col = o.c.join(',');
        g.addColorStop(0,  'rgba('+col+','+o.a+')');
        g.addColorStop(.5, 'rgba('+col+','+(o.a*.4)+')');
        g.addColorStop(1,  'rgba('+col+',0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI*2); ctx.fill();
      });
    }

    /* ═══════════════════════════════════════════════════════
       DOT GRID — ripples outward from mouse
       ═══════════════════════════════════════════════════════ */
    var DOT_GAP   = 36;
    var dotRipple = 0; // 0–1, driven by mouse velocity
    var prevMouseX = 0, prevMouseY = 0;
    function drawDotGrid() {
      // mouse speed → ripple intensity
      var spd = Math.hypot(mouse.px - prevMouseX, mouse.py - prevMouseY);
      dotRipple = Math.min(1, dotRipple * .88 + spd * .004);
      prevMouseX = mouse.px; prevMouseY = mouse.py;

      var cols = Math.ceil(W / DOT_GAP) + 2;
      var rows = Math.ceil(H / DOT_GAP) + 2;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var x = c * DOT_GAP, y = r * DOT_GAP;
          var dx = x - mouse.px, dy = y - mouse.py;
          var dist = Math.sqrt(dx*dx + dy*dy);
          // proximity glow
          var prox  = dist < 140 ? (1 - dist/140) : 0;
          // ripple wave emanating from mouse
          var wave  = dotRipple > .01
            ? Math.max(0, Math.sin((dist - tick*2.4) * .065) * .5 + .5) * dotRipple * .35
            : 0;
          var alpha = .055 + prox * .18 + wave;
          ctx.fillStyle = 'rgba(79,110,247,' + alpha + ')';
          // scale dot with proximity
          var size = 1.1 + prox * 1.6;
          ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI*2); ctx.fill();
        }
      }
    }

    /* ═══════════════════════════════════════════════════════
       SSO NODES — attracted to mouse, repelled on click
       ═══════════════════════════════════════════════════════ */
    function Node() { this.reset(true); }
    Node.prototype.reset = function(anywhere) {
      this.x     = Math.random() * W;
      this.y     = anywhere ? Math.random() * H : -20;
      this.vx    = (Math.random() - .5) * .4;
      this.vy    = anywhere ? (Math.random() - .5) * .4 : .28 + Math.random() * .36;
      this.r     = 3 + Math.random() * 5;
      this.baseA = .25 + Math.random() * .42;
      this.alpha = this.baseA;
      this.phase = Math.random() * Math.PI * 2;
      this.spd   = .006 + Math.random() * .012;
      var t = Math.random();
      this.c = t < .45 ? C.blue : t < .72 ? C.indigo : C.teal;
      this.col = this.c.join(',');
    };
    Node.prototype.update = function() {
      this.phase += this.spd;
      this.alpha  = this.baseA + Math.sin(this.phase) * this.baseA * .25;

      // attraction toward mouse (within 200px)
      var dx = mouse.px - this.x, dy = mouse.py - this.y;
      var d  = Math.sqrt(dx*dx + dy*dy);
      if (d < 200 && d > 1) {
        var force = (200 - d) / 200 * .012;
        this.vx += (dx/d) * force;
        this.vy += (dy/d) * force;
      }

      // check click ripples for repulsion
      for (var i = 0; i < clicks.length; i++) {
        var cx = clicks[i], cdx = this.x - cx.x, cdy = this.y - cx.y;
        var cd = Math.sqrt(cdx*cdx + cdy*cdy);
        var wave = cx.r; // expanding radius
        var bandwidth = 60;
        if (Math.abs(cd - wave) < bandwidth && cd > 1) {
          var repel = (1 - Math.abs(cd - wave)/bandwidth) * 2.8 * (1 - cx.age/1);
          this.vx += (cdx/cd) * repel;
          this.vy += (cdy/cd) * repel;
        }
      }

      // natural drift
      this.vx += (Math.random() - .5) * .04;
      this.vy += (Math.random() - .5) * .04;

      // dampen
      this.vx *= .96;
      this.vy *= .96;

      // clamp speed
      var spd = Math.hypot(this.vx, this.vy);
      if (spd > 3.5) { this.vx = this.vx/spd*3.5; this.vy = this.vy/spd*3.5; }

      this.x += this.vx;
      this.y += this.vy;

      // wrap edges (except near-mouse nodes drift back gently)
      if (this.x < -30) this.x = W + 10;
      if (this.x > W+30) this.x = -10;
      if (this.y < -30) this.y = H + 10;
      if (this.y > H+30) this.y = -10;
    };
    Node.prototype.draw = function() {
      var g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 4);
      g.addColorStop(0, 'rgba('+this.col+','+(this.alpha*.2)+')');
      g.addColorStop(1, 'rgba('+this.col+',0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r*4, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba('+this.col+','+this.alpha+')';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI*2); ctx.fill();
    };

    var CONNECT_DIST = 130;
    function drawConnections(nodes) {
      for (var i = 0; i < nodes.length; i++) {
        for (var j = i+1; j < nodes.length; j++) {
          var dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          var d  = Math.sqrt(dx*dx + dy*dy);
          if (d < CONNECT_DIST) {
            // brighten connection when close to mouse
            var midX = (nodes[i].x + nodes[j].x)*.5;
            var midY = (nodes[i].y + nodes[j].y)*.5;
            var mdist = Math.hypot(midX - mouse.px, midY - mouse.py);
            var mBoost = mdist < 160 ? (1 - mdist/160) * .28 : 0;
            var a = (.14 + mBoost) * (1 - d/CONNECT_DIST) * Math.min(nodes[i].alpha, nodes[j].alpha);
            ctx.strokeStyle = 'rgba(79,110,247,'+a+')';
            ctx.lineWidth   = .8 + mBoost * 1.2;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }
    }

    /* ═══════════════════════════════════════════════════════
       CLICK RIPPLES
       ═══════════════════════════════════════════════════════ */
    function updateClicks() {
      for (var i = clicks.length-1; i >= 0; i--) {
        clicks[i].r   += 7;
        clicks[i].age += .028;
        if (clicks[i].age >= 1) clicks.splice(i, 1);
      }
    }
    function drawClicks() {
      clicks.forEach(function(c) {
        var a = (1 - c.age) * .35;
        ctx.strokeStyle = 'rgba(79,110,247,' + a + ')';
        ctx.lineWidth   = 1.5;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.stroke();
        // inner ring
        if (c.r > 20) {
          ctx.strokeStyle = 'rgba(109,68,234,' + a*.5 + ')';
          ctx.lineWidth   = .8;
          ctx.beginPath(); ctx.arc(c.x, c.y, c.r*.55, 0, Math.PI*2); ctx.stroke();
        }
      });
    }

    /* ═══════════════════════════════════════════════════════
       MOUSE GLOW
       ═══════════════════════════════════════════════════════ */
    function drawMouseGlow() {
      if (mouse.px < 0) return;
      var g = ctx.createRadialGradient(mouse.px, mouse.py, 0, mouse.px, mouse.py, 200);
      g.addColorStop(0, 'rgba(79,110,247,.055)');
      g.addColorStop(.5,'rgba(109,68,234,.025)');
      g.addColorStop(1, 'rgba(79,110,247,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(mouse.px, mouse.py, 200, 0, Math.PI*2); ctx.fill();
    }

    /* ═══════════════════════════════════════════════════════
       INIT & LOOP
       ═══════════════════════════════════════════════════════ */
    var nodes = [];
    function spawnNodes() {
      nodes = [];
      var count = Math.min(60, Math.floor(W * H / 14000));
      for (var i = 0; i < count; i++) nodes.push(new Node());
    }

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
      mouse.px = W*.5; mouse.py = H*.5;
      buildOrbs(); spawnNodes();
    }

    function loop() {
      tick++;

      // Smooth mouse
      mouse.px += (mouse.x - mouse.px) * .1;
      mouse.py += (mouse.y - mouse.py) * .1;

      // Background gradient
      ctx.clearRect(0, 0, W, H);
      var bg = ctx.createLinearGradient(0, 0, W*.7, H);
      bg.addColorStop(0,  '#F6F8FD');
      bg.addColorStop(.5, '#EFF3FF');
      bg.addColorStop(1,  '#F3F7FC');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      updateOrbs();
      drawOrbs();
      drawDotGrid();
      drawMouseGlow();
      drawConnections(nodes);
      for (var i = 0; i < nodes.length; i++) nodes[i].update(), nodes[i].draw();
      updateClicks();
      drawClicks();

      requestAnimationFrame(loop);
    }

    window.addEventListener('resize', resize);
    document.addEventListener('mousemove', function(e) {
      mouse.x = e.clientX; mouse.y = e.clientY;
    });
    document.addEventListener('mouseleave', function() {
      mouse.x = W*.5; mouse.y = H*.5;
    });
    document.addEventListener('click', function(e) {
      // Don't fire on interactive elements
      if (e.target.closest('a,button,input,select,textarea')) return;
      clicks.push({ x: e.clientX, y: e.clientY, r: 4, age: 0 });
    });

    resize(); loop();
  })();


  /* ══════════════════════════════════════════════════════════
     2. PAGE TRANSITIONS
     ══════════════════════════════════════════════════════════ */
  window.CarsNav = {
    go: function(url, replace) {
      document.body.classList.add('page-exit');
      setTimeout(function(){ if(replace) window.location.replace(url); else window.location.href=url; }, 260);
    }
  };
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a[href]'); if(!a) return;
    var href = a.getAttribute('href');
    if(!href||href.startsWith('#')||href.startsWith('http')||href.startsWith('mailto:')||href.startsWith('tel:')) return;
    if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey) return;
    e.preventDefault(); CarsNav.go(href);
  });


  /* ══════════════════════════════════════════════════════════
     3. TOAST SYSTEM
     ══════════════════════════════════════════════════════════ */
  var _tc = null;
  function getTC() {
    if(!_tc){ _tc=document.createElement('div'); _tc.className='toast-container'; _tc.setAttribute('aria-live','polite'); document.body.appendChild(_tc); }
    return _tc;
  }
  var ICONS = { success:'✅', danger:'⚠️', warning:'🔔', info:'ℹ️' };
  window.CarsToast = function(opts) {
    var type=opts.type||'info', dur=opts.duration!=null?opts.duration:4000;
    var t=document.createElement('div'); t.className='toast toast--'+type; t.setAttribute('role','alert');
    var ic=document.createElement('span'); ic.className='toast-icon'; ic.setAttribute('aria-hidden','true'); ic.textContent=ICONS[type]||'ℹ️';
    var bd=document.createElement('div'); bd.className='toast-body';
    if(opts.title){var tt=document.createElement('div');tt.className='toast-title';tt.textContent=opts.title;bd.appendChild(tt);}
    var mm=document.createElement('div'); mm.className='toast-msg'; mm.textContent=opts.msg; bd.appendChild(mm);
    var cl=document.createElement('button'); cl.className='toast-close'; cl.setAttribute('aria-label','Dismiss'); cl.textContent='×';
    var pr=document.createElement('div'); pr.className='toast-progress';
    t.appendChild(ic); t.appendChild(bd); t.appendChild(cl); t.appendChild(pr); getTC().appendChild(t);
    var timer=null;
    function dismiss(){ clearTimeout(timer); t.classList.add('toast--exit'); setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},260); }
    cl.addEventListener('click',dismiss);
    if(dur>0){ timer=setTimeout(dismiss,dur); t.addEventListener('mouseenter',function(){clearTimeout(timer);}); t.addEventListener('mouseleave',function(){timer=setTimeout(dismiss,1500);}); }
    return {dismiss:dismiss};
  };


  /* ══════════════════════════════════════════════════════════
     4. BUTTON RIPPLE
     ══════════════════════════════════════════════════════════ */
  function ripple(btn, e) {
    var rect=btn.getBoundingClientRect(), size=Math.max(rect.width,rect.height)*2.6;
    var cx=e&&e.clientX!=null?e.clientX-rect.left:rect.width/2, cy=e&&e.clientY!=null?e.clientY-rect.top:rect.height/2;
    var el=document.createElement('span'); el.setAttribute('aria-hidden','true'); btn.appendChild(el);
    var anim=el.animate([
      {position:'absolute',width:size+'px',height:size+'px',left:(cx-size/2)+'px',top:(cy-size/2)+'px',borderRadius:'50%',background:'rgba(255,255,255,0.3)',transform:'scale(0)',opacity:'1',pointerEvents:'none'},
      {transform:'scale(1)',opacity:'0'}
    ],{duration:560,easing:'ease-out',fill:'forwards'});
    anim.onfinish=function(){el.remove();};
  }
  document.addEventListener('click',function(e){var b=e.target.closest('.btn-primary,.btn-portal,.btn-signout,.btn-create');if(b)ripple(b,e);});
  document.addEventListener('keydown',function(e){if(e.key==='Enter'){var el=document.activeElement;if(el&&el.matches('.btn-primary,.btn-portal,.btn-signout,.btn-create'))ripple(el,null);}});

}());
