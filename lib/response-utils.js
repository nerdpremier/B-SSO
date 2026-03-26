export function setSecurityHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

export function auditLog(event, fields) {
    console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...fields }));
}

export const USER_REGEX = /^[a-zA-Z0-9]+$/;
export const SAFE_STRING_REGEX = /^[\x20-\x7E]+$/;
export const LOGID_STRING_REGEX = /^\d+$/;
export const PASS_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const TOKEN_REGEX = /^[0-9a-f]{64}$/i;

export function isJsonContentType(req) {
    return !!req.headers['content-type']?.includes('application/json');
}

export function isValidBody(body) {
    return !!body && typeof body === 'object' && !Array.isArray(body);
}
