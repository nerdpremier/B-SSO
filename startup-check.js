// ============================================================
// ตรวจสอบความพร้อมของระบบก่อนเริ่มทำงาน
// ทำหน้าที่ตรวจสอบ environment variables ที่จำเป็นต้องมี
// ถ้าขาดหรือไม่ถูกต้องจะหยุดระบบทันทีเพื่อความปลอดภัย
//
// วิธีใช้: import ไฟล์นี้เป็นอันดับแรกในทุก entry point
// ============================================================

// รูปแบบการตรวจสอบความถูกต้องของข้อมูล

// DATABASE_URL ต้องเป็น postgres:// หรือ postgresql://
const DATABASE_URL_PATTERN = /^postgres(?:ql)?:\/\/.+/;

// EMAIL_USER ต้องมี @ คั่นระหว่าง local และ domain ที่มี dot อย่างน้อยหนึ่งตัว
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ฟังก์ชันสำหรับแจ้งข้อผิดพลาดและหยุดการทำงาน
function fail(error) {
    console.error(JSON.stringify({
        event: 'STARTUP_INVALID_ENV',
        error,
        ts: new Date().toISOString(),
    }));
    process.exit(1);
}

// ตรวจสอบว่า environment variables ที่จำเป็นมีครบถ้วนและไม่ใช่ค่าว่าง
// .trim() จับกรณี value เป็น " " (space) ซึ่ง truthy แต่ไม่มีความหมาย
// เช่น MFA_PEPPER=" " → truthy → ผ่าน falsy check ปกติ
//                      → trimmed = "" → missing ถูก catch ที่นี่
const REQUIRED_ENV = [
    'JWT_SECRET',
    'CSRF_SECRET',
    'MFA_PEPPER',
    'EMAIL_USER',
    'EMAIL_PASS',
    'BASE_URL',
    'DATABASE_URL',
    // เพิ่ม CRON_SECRET: cleanup.js ใช้ใน Authorization header check
    //   เดิม: ไม่ตรวจ → cleanup endpoint ไม่มี auth → ใครก็เรียก trigger cleanup ได้
    'CRON_SECRET',
    // เพิ่ม OAUTH_SECRET_PEPPER: oauth.js ใช้ hash client secret
    //   เดิม: ไม่ตรวจ → oauth.js fallback ไปใช้ JWT_SECRET
    //   ปัญหา: JWT_SECRET shared กับ signing token → semantic ผิด
    //          ถ้า JWT_SECRET รั่ว → client secrets ทุกตัวถูก compute ใหม่ได้ทันที
    'OAUTH_SECRET_PEPPER',
];

const missing = REQUIRED_ENV.filter(key => !process.env[key]?.trim());
if (missing.length > 0) {
    console.error(JSON.stringify({
        event: 'STARTUP_MISSING_ENV',
        missing,
        ts: new Date().toISOString(),
    }));
    process.exit(1);
}

// กฎการตรวจสอบความถูกต้องของแต่ละค่า
// แต่ละ rule: { check() → true = ผิด, error message }
//
// หมายเหตุเรื่อง .trim() ในการตรวจ length:
//   ตรวจ trimmed length เพื่อให้แน่ใจว่า meaningful content ยาวพอ
//   เช่น JWT_SECRET = "a" + 31 spaces → trimmed length = 1 → fail ถูกต้อง
//   แต่ application ใช้ raw value (ไม่มี trim) → secrets ไม่ควรมี leading/trailing spaces
//
// minimum length ของ secrets:
//   JWT_SECRET, CSRF_SECRET, MFA_PEPPER, OAUTH_SECRET_PEPPER = 32 chars (256 bits)
//   ให้ครบ full strength ของ HMAC-SHA256 (key ควรยาวเท่า hash output = 32 bytes)
//
//   CRON_SECRET: ไม่ต้องการ cryptographic strength เต็มที่ (เป็น Bearer token)
//   แต่ต้องยาวพอที่จะ brute-force ไม่ได้ → กำหนด 32 chars เหมือนกัน
const VALIDATIONS = [
    {
        check: () => !process.env.BASE_URL.trim().startsWith('https://'),
        error: 'BASE_URL ต้องขึ้นต้นด้วย https://',
    },
    {
        check: () => !DATABASE_URL_PATTERN.test(process.env.DATABASE_URL.trim()),
        error: 'DATABASE_URL ต้องขึ้นต้นด้วย postgres:// หรือ postgresql://',
    },
    {
        check: () => !EMAIL_PATTERN.test(process.env.EMAIL_USER.trim()),
        error: 'EMAIL_USER ต้องเป็นอีเมลที่ถูกต้อง',
    },
    {
        check: () => process.env.JWT_SECRET.trim().length < 32,
        error: 'JWT_SECRET ต้องมีอย่างน้อย 32 ตัวอักษร (256 bits)',
    },
    {
        check: () => process.env.CSRF_SECRET.trim().length < 32,
        error: 'CSRF_SECRET ต้องมีอย่างน้อย 32 ตัวอักษร (256 bits)',
    },
    {
        // 32 chars (ไม่ใช่ 16) เพื่อให้ HMAC-SHA256 ได้ full 256-bit security
        check: () => process.env.MFA_PEPPER.trim().length < 32,
        error: 'MFA_PEPPER ต้องมีอย่างน้อย 32 ตัวอักษร (256 bits)',
    },
    {
        check: () => process.env.CRON_SECRET.trim().length < 32,
        error: 'CRON_SECRET ต้องมีอย่างน้อย 32 ตัวอักษร',
    },
    {
        check: () => process.env.OAUTH_SECRET_PEPPER.trim().length < 32,
        error: 'OAUTH_SECRET_PEPPER ต้องมีอย่างน้อย 32 ตัวอักษร (256 bits)',
    },
    // ป้องกัน secret ซ้ำกัน: ถ้าใช้ secret เดียวกันหลาย context → compromise หนึ่ง = compromise ทั้งหมด
    {
        check: () => process.env.JWT_SECRET.trim() === process.env.CSRF_SECRET.trim(),
        error: 'JWT_SECRET และ CSRF_SECRET ต้องเป็นค่าที่แตกต่างกัน',
    },
    {
        check: () => process.env.JWT_SECRET.trim() === process.env.OAUTH_SECRET_PEPPER.trim(),
        error: 'JWT_SECRET และ OAUTH_SECRET_PEPPER ต้องเป็นค่าที่แตกต่างกัน',
    },
];

for (const { check, error } of VALIDATIONS) {
    if (check()) fail(error);
}

// แจ้งว่าระบบพร้อมทำงานแล้ว
console.log(JSON.stringify({ event: 'STARTUP_ENV_OK', ts: new Date().toISOString() }));
