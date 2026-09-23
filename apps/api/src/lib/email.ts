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
    subject: "Your Delvin verification code",
    text: `Your Delvin verification code is ${code}. It expires in ${config.mail.codeTtlMinutes} minutes.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#2e2b29"><h2>Verify your Delvin account</h2><p>Use this code to continue:</p><div style="font-size:32px;letter-spacing:8px;font-weight:700;padding:16px 0">${code}</div><p>This code expires in ${config.mail.codeTtlMinutes} minutes.</p></div>`,
  });
}
