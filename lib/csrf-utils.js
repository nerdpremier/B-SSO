import crypto from 'crypto';
import { parse } from 'cookie';

const CSRF_SECRET = process.env.CSRF_SECRET;
const EXPECTED_TOKEN_PART_LENGTH = 64;
const HEX_REGEX = /^[0-9a-f]+$/i;

export function generateCsrfToken() {
    if (!CSRF_SECRET) throw new Error('[CONFIG] CSRF_SECRET environment variable is not set');
    const nonce = crypto.randomBytes(32).toString('hex');
    const sig = crypto.createHmac('sha256', CSRF_SECRET).update(nonce).digest('hex');
    return `${nonce}.${sig}`;
}

export function validateCsrfToken(req) {
    if (!CSRF_SECRET) {
        console.error('[CONFIG] CSRF_SECRET environment variable is not set');
        return false;
    }
    const cookies = parse(req.headers.cookie || '');
    const cookieToken = cookies.csrf_token;
    const headerToken = req.headers['x-csrf-token'];
    if (!cookieToken || !headerToken) return false;
    if (typeof cookieToken !== 'string' || typeof headerToken !== 'string') return false;
    if (cookieToken !== headerToken) return false;
    const parts = cookieToken.split('.');
    if (parts.length !== 2) return false;
    const [nonce, sig] = parts;
    if (nonce.length !== EXPECTED_TOKEN_PART_LENGTH || sig.length !== EXPECTED_TOKEN_PART_LENGTH) {
        return false;
    }
    if (!HEX_REGEX.test(nonce) || !HEX_REGEX.test(sig)) return false;
    const expectedSig = crypto.createHmac('sha256', CSRF_SECRET).update(nonce).digest('hex');
    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
}
