import forgotHandler from './forgot-password.js';
import resetHandler  from './reset-password.js';

export default async function handler(req, res) {
    const action = req.body?.action ?? req.query?.action;
    if (action === 'forgot') return forgotHandler(req, res);
    if (action === 'reset')  return resetHandler(req, res);
    return res.status(400).json({ error: 'Invalid action. Use action: "forgot" or "reset"' });
}
