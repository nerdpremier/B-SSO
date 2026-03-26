import nodemailer from 'nodemailer';

const emailFrom = process.env.EMAIL_FROM || process.env.EMAIL_USER;

export const mailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export function getFromAddress(displayName = 'B-SSO') {
    return `"${displayName}" <${emailFrom}>`;
}
