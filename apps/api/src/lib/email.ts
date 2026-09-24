import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { config } from "./config.js";

const transporter = nodemailer.createTransport({
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
  host: config.mail.host,
  port: config.mail.port,
  secure: config.mail.secure,
  requireTLS: !config.mail.secure,
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
  const startedAt = Date.now();
  await transporter.sendMail({
    from: config.mail.from,
    to: email,
    subject: `${code} is your delvin verification code`,
    text: `Your delvin verification code is ${code}. It expires in ${config.mail.codeTtlMinutes} minutes. If you did not request this, you can ignore this email.`,
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f8f6ee;color:#2e3a2f;font-family:Arial,Helvetica,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f6ee;padding:40px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dedbd0;border-radius:20px;overflow:hidden">
          <tr><td style="height:5px;background:#2e3a2f;font-size:0;line-height:0">&nbsp;</td></tr>
          <tr><td style="padding:34px 36px 10px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td style="font-family:Georgia,'Times New Roman',serif;font-size:29px;font-weight:700;letter-spacing:-1.2px;color:#2e3a2f">delvin</td>
              <td align="right" style="font-size:10px;font-weight:700;letter-spacing:1.8px;color:#6b7f5b;text-transform:uppercase">Secure access</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:18px 36px 36px">
            <h1 style="margin:0;color:#2e3a2f;font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:400;letter-spacing:-.7px;line-height:1.16">Verify your email</h1>
            <p style="margin:14px 0 0;color:#657064;font-size:15px;line-height:1.65">Use this one-time code to continue to your delvin workspace.</p>
            <table role="presentation" width="100%" cellspacing="0" cellspacing="0" style="margin:28px 0 22px;background:#2e3a2f;border-radius:14px"><tr><td align="center" style="padding:24px 14px">
              <div style="color:#f8f6ee;font-family:Arial,Helvetica,sans-serif;font-size:34px;font-weight:700;letter-spacing:10px;line-height:1">${code}</div>
            </td></tr></table>
            <p style="margin:0;color:#657064;font-size:13px;line-height:1.6">This code expires in <strong style="color:#2e3a2f">${config.mail.codeTtlMinutes} minutes</strong>.</p>
            <p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #e7e3d8;color:#8a8c83;font-size:12px;line-height:1.65">If you did not request this code, you can safely ignore this email. Never share this code with anyone.</p>
          </td></tr>
        </table>
        <p style="margin:18px 0 0;color:#8a8c83;font-size:11px;line-height:1.5">© delvin · Secure workspace access</p>
      </td></tr>
    </table>
  </body>
</html>`,
  });
  console.info("[mail] Verification email accepted by SMTP", {
    durationMs: Date.now() - startedAt,
  });
}
