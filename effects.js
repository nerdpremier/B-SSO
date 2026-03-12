/**
 * effects.js — CARS SSO "Vault"
 * Button ripple + label focus color + stagger reveal
 */
(function () {
  'use strict';

  /* ── Button Ripple ──────────────────────────────────────── */
  function rippleOn(btn, e) {
    var rect = btn.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 2.6;
    var cx   = e && e.clientX != null ? e.clientX : rect.left + rect.width  / 2;
    var cy   = e && e.clientY != null ? e.clientY : rect.top  + rect.height / 2;
    var el   = document.createElement('span');
    el.className = 'ripple-wave';
    el.style.setProperty('--ripple-size', size + 'px');
    el.style.setProperty('--ripple-x',    (cx - rect.left - size / 2) + 'px');
    el.style.setProperty('--ripple-y',    (cy - rect.top  - size / 2) + 'px');
    btn.appendChild(el);
    setTimeout(function () { el.remove(); }, 600);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-primary, .btn-secondary');
    if (btn) rippleOn(btn, e);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var el = document.activeElement;
      if (el && (el.classList.contains('btn-primary') || el.classList.contains('btn-secondary'))) {
        rippleOn(el, null);
      }
    }
  });

  /* ── Stagger Reveal ─────────────────────────────────────── */
  function initStagger() {
    document.querySelectorAll('[data-stagger]').forEach(function (el, i) {
      el.style.animationDelay = (60 + i * 55) + 'ms';
    });
  }

  /* ── Boot ───────────────────────────────────────────────── */
  function boot() { initStagger(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}());
