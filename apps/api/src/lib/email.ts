import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { config } from "./config.js";

const transporter = nodemailer.createTransport({
  host: config.mail.host,
  port: config.mail.port,
  secure: config.mail.secure,
  auth: config.mail.user && config.mail.pass ? { user: config.mail.user, pass: config.mail.pass } : undefined,
});

export function createVerificationCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashVerificationCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function sendVerificationCode(email: string, code: string) {
  if (!config.mail.user || !config.mail.pass || !config.mail.from) {
    throw new Error("Email verification is not configured");
  }
  await transporter.sendMail({
    from: config.mail.from,
    to: email,
    subject: `${code} is your Delvin verification code`,
    text: `Your Delvin verification code is ${code}. It expires in ${config.mail.codeTtlMinutes} minutes. If you did not request this, you can ignore this email.`,
    html: `<!doctype html>
<html lang="en">
    <body style="margin:0;padding:0;background:#f7f7f5;color:#2e2b29;font-family:Arial,Helvetica,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f5;padding:36px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e1dedb;border-radius:18px;overflow:hidden">
          <tr><td style="height:6px;background:#2e2b29;font-size:0;line-height:0">&nbsp;</td></tr>
          <tr><td style="padding:34px 36px 12px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td><img src="${config.publicAppUrl}/assets/logo.png" width="42" height="42" alt="Delvin" style="display:block;border-radius:50%;object-fit:cover" /></td>
              <td align="right" style="font-size:13px;letter-spacing:2px;color:#6f6862;text-transform:uppercase">Delvin Agent</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:18px 36px 34px">
            <h1 style="margin:0;color:#2e2b29;font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;letter-spacing:-.6px;line-height:1.2">Verify your email</h1>
            <p style="margin:14px 0 0;color:#6f6862;font-size:15px;line-height:1.6">Use the code below to continue to your Delvin workspace.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:26px 0 22px;background:#f1f1ef;border:1px solid #e1dedb;border-radius:12px"><tr><td align="center" style="padding:22px 14px">
              <div style="color:#2e2b29;font-family:Arial,Helvetica,sans-serif;font-size:34px;font-weight:700;letter-spacing:10px;line-height:1">${code}</div>
            </td></tr></table>
            <p style="margin:0;color:#6f6862;font-size:13px;line-height:1.6">This code expires in <strong style="color:#2e2b29">${config.mail.codeTtlMinutes} minutes</strong>.</p>
            <p style="margin:22px 0 0;padding-top:18px;border-top:1px solid #e5e7eb;color:#98918b;font-size:12px;line-height:1.6">If you did not request this code, you can safely ignore this email. For your security, never share this code with anyone.</p>
          </td></tr>
        </table>
        <p style="margin:18px 0 0;color:#98918b;font-size:11px;line-height:1.5">© Delvin Agent · Secure workspace access</p>
      </td></tr>
    </table>
  </body>
</html>`,
  });
}
