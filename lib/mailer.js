import nodemailer from 'nodemailer';

const emailFrom = process.env.EMAIL_FROM || process.env.EMAIL_USER;

export function getFromAddress(displayName = 'B-SSO') {
    return `"${displayName}" <${emailFrom}>`;
}
