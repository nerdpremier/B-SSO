export const LOGID_TTL_MINUTES = 15;
export const MFA_MAX_ATTEMPTS = 5;
export const TOTAL_MFA_MAX = 15;
export const RESEND_COOLDOWN_SEC = 60;
export const SESSION_DURATION_SECONDS = 7200;

const _checks = [
    [Number.isInteger(LOGID_TTL_MINUTES) && LOGID_TTL_MINUTES > 0, 'LOGID_TTL_MINUTES must be a positive integer'],
    [Number.isInteger(MFA_MAX_ATTEMPTS) && MFA_MAX_ATTEMPTS > 0, 'MFA_MAX_ATTEMPTS must be a positive integer'],
    [Number.isInteger(TOTAL_MFA_MAX) && TOTAL_MFA_MAX > 0, 'TOTAL_MFA_MAX must be a positive integer'],
    [Number.isInteger(RESEND_COOLDOWN_SEC) && RESEND_COOLDOWN_SEC > 0, 'RESEND_COOLDOWN_SEC must be a positive integer'],
    [Number.isInteger(SESSION_DURATION_SECONDS) && SESSION_DURATION_SECONDS > 0, 'SESSION_DURATION_SECONDS must be a positive integer'],
    [TOTAL_MFA_MAX > MFA_MAX_ATTEMPTS, 'TOTAL_MFA_MAX must be greater than MFA_MAX_ATTEMPTS'],
    [SESSION_DURATION_SECONDS === 7200, 'SESSION_DURATION_SECONDS must equal 7200'],
];

for (const [ok, msg] of _checks) {
    if (!ok) throw new Error(`[constants.js] Invalid constant: ${msg}`);
}
