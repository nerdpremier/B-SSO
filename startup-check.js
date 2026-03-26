const DATABASE_URL_PATTERN = /^postgres(?:ql)?:\/\/.+/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(error) {
    console.error(JSON.stringify({
        event: 'STARTUP_INVALID_ENV',
        error,
        ts: new Date().toISOString(),
    }));
    process.exit(1);
}

const REQUIRED_ENV = [
    'JWT_SECRET',
    'CSRF_SECRET',
    'MFA_PEPPER',
    'EMAIL_USER',
    'EMAIL_PASS',
    'BASE_URL',
    'DATABASE_URL',
    'CRON_SECRET',
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

const VALIDATIONS = [
    {
        check: () => !process.env.BASE_URL.trim().startsWith('https://'),
        error: 'BASE_URL must start with https://',
    },
    {
        check: () => !DATABASE_URL_PATTERN.test(process.env.DATABASE_URL.trim()),
        error: 'DATABASE_URL must start with postgres:// or postgresql://',
    },
    {
        check: () => !EMAIL_PATTERN.test(process.env.EMAIL_USER.trim()),
        error: 'EMAIL_USER must be a valid email',
    },
    {
        check: () => process.env.JWT_SECRET.trim().length < 32,
        error: 'JWT_SECRET must be at least 32 characters (256 bits)',
    },
    {
        check: () => process.env.CSRF_SECRET.trim().length < 32,
        error: 'CSRF_SECRET must be at least 32 characters (256 bits)',
    },
    {
        check: () => process.env.MFA_PEPPER.trim().length < 32,
        error: 'MFA_PEPPER must be at least 32 characters (256 bits)',
    },
    {
        check: () => process.env.CRON_SECRET.trim().length < 32,
        error: 'CRON_SECRET must be at least 32 characters',
    },
    {
        check: () => process.env.OAUTH_SECRET_PEPPER.trim().length < 32,
        error: 'OAUTH_SECRET_PEPPER must be at least 32 characters (256 bits)',
    },
    {
        check: () => process.env.JWT_SECRET.trim() === process.env.CSRF_SECRET.trim(),
        error: 'JWT_SECRET and CSRF_SECRET must be different',
    },
    {
        check: () => process.env.JWT_SECRET.trim() === process.env.OAUTH_SECRET_PEPPER.trim(),
        error: 'JWT_SECRET and OAUTH_SECRET_PEPPER must be different',
    },
];

for (const { check, error } of VALIDATIONS) {
    if (check()) fail(error);
}

if (!process.env.EMAIL_FROM?.trim()) {
    process.env.EMAIL_FROM = process.env.EMAIL_USER;
}
