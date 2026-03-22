// ============================================================
//
// Lightweight behavior collector สำหรับให้เว็บลูกค้า embed
// ทำหน้าที่:
//   - เก็บ interaction พื้นฐาน (mousemove, click, keypress count, visibility)
//   - Aggregate ข้อมูลทุก 15 วินาที
//   - ส่งไปที่ SSO endpoint `/api/behavior`
//
// การใช้งาน (ในเว็บลูกค้า):
//
//   <script src="https://YOUR_SSO_DOMAIN/collector_behavior/collector.js" defer></script>
//   <script>
//     window.BSSOBehaviorCollector && window.BSSOBehaviorCollector.start({
//       intervalMs: 15000
//     });
//   </script>
//
// ข้อกำหนด:
//   - ต้องโหลดหลังจาก user login SSO สำเร็จแล้ว (มี session_token cookie)
//   - ใช้ fetch() → browser สมัยใหม่
// ============================================================

(function () {
  if (window.BSSOBehaviorCollector) return;

  const DEFAULT_INTERVAL = 15000;

  function createCollector() {
    let events = [];
    let timer  = null;

    // state สำหรับคำนวณ aggregate metrics ต่อ window
    let lastFlushTs    = null;
    let lastEventTs    = null;
    let activeTimeMs   = 0;
    let eventCount     = 0;

    // state สำหรับ feature extraction แบบไม่เก็บ PII
    let lastMouse = null; // {x,y,t}
    let mouseTotalDist = 0;
    let mouseSamples = 0;
    let mouseDirChanges = 0;
    let lastMouseVec = null; // {dx,dy}

    let lastClickTs = null;
    let clickIntervals = []; // ms

    let lastKeyTs = null;
    let keyIntervals = []; // ms

    let scrollSamples = 0;
    let scrollTotalAbsDy = 0;
    let scrollDirChanges = 0;
    let lastScrollSign = 0;

    function record(type, payload) {
      events.push({
        type,
        ts:   Date.now(),
        data: payload || {}
      });

      const now = Date.now();
      if (lastEventTs != null) {
        // นับ active time แบบคร่าว ๆ: จำกัด gap สูงสุดต่อ event เพื่อไม่ให้ activeTime พุ่งเกินจริง
        const delta = now - lastEventTs;
        const capped = delta > 5000 ? 5000 : delta;
        activeTimeMs += capped;
      }
      lastEventTs = now;
      eventCount += 1;
    }

    function setupListeners() {
      window.addEventListener('click', function (e) {
        const now = Date.now();
        if (lastClickTs != null) {
          const dt = now - lastClickTs;
          if (dt > 0 && dt < 60_000) {
            clickIntervals.push(dt);
            if (clickIntervals.length > 120) clickIntervals.shift();
          }
        }
        lastClickTs = now;
        record('click', {
          x: e.clientX,
          y: e.clientY,
          tag: e.target && e.target.tagName,
        });
      }, { passive: true });

      window.addEventListener('mousemove', (function () {
        let last = 0;
        return function (e) {
          const now = Date.now();
          if (now - last < 500) return;
          last = now;

          // mouse speed + direction change (ไม่ส่งตำแหน่งดิบเป็น features)
          if (lastMouse) {
            const dt = now - lastMouse.t;
            const dx = e.clientX - lastMouse.x;
            const dy = e.clientY - lastMouse.y;
            if (dt > 0 && dt < 10_000) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              mouseTotalDist += dist;
              mouseSamples += 1;

              if (lastMouseVec) {
                const dot = dx * lastMouseVec.dx + dy * lastMouseVec.dy;
                // dot < 0 = ทิศกลับด้านโดยประมาณ
                if (dot < 0) mouseDirChanges += 1;
              }
              lastMouseVec = { dx, dy };
            }
          }
          lastMouse = { x: e.clientX, y: e.clientY, t: now };

          record('mousemove', { x: e.clientX, y: e.clientY });
        };
      })(), { passive: true });

      window.addEventListener('keydown', (function () {
        let count = 0;
        return function () {
          count += 1;
          const now = Date.now();
          if (lastKeyTs != null) {
            const dt = now - lastKeyTs;
            if (dt > 0 && dt < 60_000) {
              keyIntervals.push(dt);
              if (keyIntervals.length > 120) keyIntervals.shift();
            }
          }
          lastKeyTs = now;
          record('keydown_summary', { count });
        };
      })());

      window.addEventListener('scroll', (function () {
        let lastY = window.scrollY;
        return function () {
          const y = window.scrollY;
          const dy = y - lastY;
          lastY = y;

          const absDy = Math.abs(dy);
          if (absDy > 0) {
            scrollSamples += 1;
            scrollTotalAbsDy += absDy;
            const sign = dy > 0 ? 1 : -1;
            if (lastScrollSign !== 0 && sign !== lastScrollSign) scrollDirChanges += 1;
            lastScrollSign = sign;
          }
        };
      })(), { passive: true });

      document.addEventListener('visibilitychange', function () {
        record('visibility', { state: document.visibilityState });
      });
    }

    async function flush() {
      if (!events.length) return;

      const batch = events;
      events      = [];

       const now = Date.now();
       if (lastFlushTs == null) lastFlushTs = now;
       const windowMs = now - lastFlushTs;
       const safeWindowMs = windowMs > 0 ? windowMs : DEFAULT_INTERVAL;

       const idleMs = safeWindowMs - activeTimeMs;
       const idleRatio = safeWindowMs > 0 ? Math.max(0, Math.min(1, idleMs / safeWindowMs)) : 0;
       const interactionDensity = safeWindowMs > 0
         ? eventCount / (safeWindowMs / 1000)
         : 0;

       function mean(arr) {
         if (!arr || arr.length === 0) return 0;
         let s = 0;
         for (let i = 0; i < arr.length; i++) s += arr[i];
         return s / arr.length;
       }
       function std(arr) {
         if (!arr || arr.length < 2) return 0;
         const m = mean(arr);
         let v = 0;
         for (let i = 0; i < arr.length; i++) {
           const d = arr[i] - m;
           v += d * d;
         }
         return Math.sqrt(v / (arr.length - 1));
       }

       const avgMouseSpeed = safeWindowMs > 0
         ? (mouseTotalDist / (safeWindowMs / 1000))
         : 0;
       const mouseDirChangeRate = mouseSamples > 0
         ? mouseDirChanges / mouseSamples
         : 0;

       const avgClickIntervalMs = mean(clickIntervals);
       const stdClickIntervalMs = std(clickIntervals);
       const avgKeyIntervalMs   = mean(keyIntervals);
       const stdKeyIntervalMs   = std(keyIntervals);

       const avgScrollAbsDy = scrollSamples > 0 ? (scrollTotalAbsDy / scrollSamples) : 0;
       const scrollDirChangeRate = scrollSamples > 0 ? (scrollDirChanges / scrollSamples) : 0;

       const features = {
         idle_ratio: idleRatio,
         interaction_density: interactionDensity,
         event_count: eventCount,
         window_ms: safeWindowMs,

         // behavioral aggregates (ไม่มี PII)
         avg_mouse_speed: avgMouseSpeed,
         mouse_dir_change_rate: mouseDirChangeRate,
         avg_click_interval_ms: avgClickIntervalMs,
         std_click_interval_ms: stdClickIntervalMs,
         avg_key_interval_ms: avgKeyIntervalMs,
         std_key_interval_ms: stdKeyIntervalMs,
         avg_scroll_abs_dy: avgScrollAbsDy,
         scroll_dir_change_rate: scrollDirChangeRate
       };

       // reset metrics สำหรับ window ถัดไป
       lastFlushTs  = now;
       lastEventTs  = null;
       activeTimeMs = 0;
       eventCount   = 0;

       lastMouse = null;
       mouseTotalDist = 0;
       mouseSamples = 0;
       mouseDirChanges = 0;
       lastMouseVec = null;

       lastClickTs = null;
       clickIntervals = [];

       lastKeyTs = null;
       keyIntervals = [];

       scrollSamples = 0;
       scrollTotalAbsDy = 0;
       scrollDirChanges = 0;
       lastScrollSign = 0;

      try {
        const payload = {
          events: batch,
          page:   window.location.pathname,
          meta: {
            userAgent: navigator.userAgent,
          },
          features
        };

        const controller = new AbortController();
        const timeoutId  = setTimeout(function () { controller.abort(); }, 8000);

        try {
          const res = await fetch('/api/behavior', {
            method:      'POST',
            credentials: 'include',
            headers:     { 'Content-Type': 'application/json' },
            body:        JSON.stringify(payload),
            signal:      controller.signal,
          });

          clearTimeout(timeoutId);

          if (!res.ok) return;
          const data = await res.json().catch(function () { return {}; });
          const action = (data.action || 'low').toLowerCase();

          if (action === 'medium') {
            // บังคับให้ลูกค้าแสดง step-up MFA เอง
            window.dispatchEvent(new CustomEvent('bsso-behavior-medium', { detail: data }));
          } else if (action === 'revoke') {
            // บังคับ logout ปัจจุบัน
            window.dispatchEvent(new CustomEvent('bsso-behavior-revoke', { detail: data }));
          }
        } catch (err) {
          // fail-quiet
          console && console.debug && console.debug('[BSSOBehaviorCollector] flush error', err.message || err);
        }
      } catch (outer) {
        // swallow
      }
    }

    function start(options) {
      if (timer) return;
      const interval = (options && typeof options.intervalMs === 'number' && options.intervalMs > 0)
        ? options.intervalMs
        : DEFAULT_INTERVAL;

      setupListeners();
      timer = setInterval(flush, interval);
    }

    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      events = [];
    }

    return { start, stop };
  }

  window.BSSOBehaviorCollector = createCollector();
})();

