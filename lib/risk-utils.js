// ============================================================
// 🧠 lib/risk-utils.js — Behavioral Risk Scoring Helper
// ============================================================

const RISK_ENGINE_URL        = process.env.RISK_ENGINE_URL;
const RISK_API_SECRET        = process.env.RISK_API_SECRET;
const RISK_ENGINE_TIMEOUT_MS = 3000;

function isValidBehavior(b) {
    if (!b || typeof b !== 'object') return false;
    const statsOk = (s) =>
        s && typeof s === 'object' &&
        typeof s.m === 'number' && s.m >= 0 && s.m <= 1 &&
        typeof s.s === 'number' && s.s >= 0 && s.s <= 1;
    const featOk = (f) =>
        f && typeof f === 'object' &&
        typeof f.density    === 'number' && f.density    >= 0 && f.density    <= 1 &&
        typeof f.idle_ratio === 'number' && f.idle_ratio >= 0 && f.idle_ratio <= 1;
    return statsOk(b.mouse) && statsOk(b.click) &&
           statsOk(b.key)   && statsOk(b.idle)  && featOk(b.features);
}

// ── Normalization ─────────────────────────────────────────────
// main.py ส่ง normalized มาแล้ว (sigmoid + min-max [0,1])
// ใช้ค่าตรง ๆ ได้เลย ไม่ต้องแปลงอีก
export function rawScoreToBehaviorScore(normalizedScore) {
    return Math.max(0, Math.min(1, normalizedScore));
}

// ── เรียก Risk Engine ─────────────────────────────────────────
export async function fetchBehaviorScore(behavior) {
    if (!RISK_ENGINE_URL || !RISK_API_SECRET) return null;
    if (!isValidBehavior(behavior)) return null;

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), RISK_ENGINE_TIMEOUT_MS);
    try {
        const res = await fetch(`${RISK_ENGINE_URL}/score`, {
            method:  'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key':    RISK_API_SECRET,
            },
            body:   JSON.stringify(behavior),
            signal: controller.signal,
        });
        if (!res.ok) {
            console.error(`[WARN] risk-utils: engine returned ${res.status}`);
            return null;
        }
        const data = await res.json();
        // รับ normalized จาก main.py โดยตรง
        if (typeof data.normalized !== 'number') return null;
        return rawScoreToBehaviorScore(data.normalized);
    } catch (err) {
        if (err.name === 'AbortError') console.error('[WARN] risk-utils: engine timeout');
        else console.error('[WARN] risk-utils: engine error:', err.message);
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

// ── mergeScores ───────────────────────────────────────────────
// กรณี 1 — assess.js (pre-login):
//   mergeScores(ruleScore, behaviorScore)  default: A=0.6, B=0.4
//
// กรณี 2 — session-risk.js (post-login):
//   mergeScores(preScore, postScore, { preWeight: 0.3, postWeight: 0.7 })
export function mergeScores(scoreA, scoreB, options = {}) {
    const { preWeight = 0.6, postWeight = 0.4 } = options;
    if (scoreB === null || scoreB === undefined) return scoreA;
    const weighted = scoreA * preWeight + scoreB * postWeight;
    return Math.max(weighted, scoreA * 0.9);
}
