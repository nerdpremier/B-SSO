import crypto from 'crypto';

const OTP_PATTERN = /^\d{6}$/;

export function hashMfaCode(code, logId) {

    const pepper = process.env.MFA_PEPPER;
    if (!pepper) {
        throw new Error('[CONFIG] ไม่ได้ตั้งค่าตัวแปรสภาพแวดล้อม MFA_PEPPER');
    }

    if (code == null) {
        throw new Error('[INPUT] code ไม่สามารถเป็น null หรือ undefined ได้');
    }
    if (logId == null) {
        throw new Error('[INPUT] logId ไม่สามารถเป็น null หรือ undefined ได้');
    }

    const codeStr  = String(code);
    const logIdStr = String(logId);

    if (!OTP_PATTERN.test(codeStr)) {
        throw new Error('[INPUT] code ต้องเป็นตัวเลข 6 หลักพอดี');
    }

    if (!logIdStr.trim()) {
        throw new Error('[INPUT] logId ไม่สามารถเป็นค่าว่างได้');
    }

    return crypto
        .createHmac('sha256', pepper)
        .update(`${logIdStr}:${codeStr}`)
        .digest('hex');
}
