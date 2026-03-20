// ============================================================
// Combined Password Handler
//
// รวม 2 password endpoints
// Route ด้วย action field ใน request body:
//   action: 'forgot' → forgot-password.js
//   action: 'reset'  → reset-password.js
//
// vercel.json:
//   { "source": "/api/password", "destination": "/api/password.js" }
// ============================================================

import forgotHandler from './forgot-password.js';
import resetHandler  from './reset-password.js';

/**
 * API Handler สำหรับจัดการ Routing ของระบบรหัสผ่าน
 * แยกการทำงานไปยัง Endpoint ที่ถูกต้องตามประเภท Action (forgot หรือ reset)
 * @param {import('http').IncomingMessage} req - HTTP Request object
 * @param {import('http').ServerResponse} res - HTTP Response object
 * @returns {Promise<void>}
 */
export default async function handler(req, res) {
    const action = req.body?.action ?? req.query?.action;
    if (action === 'forgot') return forgotHandler(req, res);
    if (action === 'reset')  return resetHandler(req, res);
    return res.status(400).json({ error: 'Invalid action. Use action: "forgot" or "reset"' });
}
