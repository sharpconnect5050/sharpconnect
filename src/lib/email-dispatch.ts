import type { AppNotification } from "./notifications";
import type { DispatchResult } from "./notification-dispatch";
import nodemailer from "nodemailer";

/* ─── TRANSPORTER (cached) ──────────────────────────────── */

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass || pass.startsWith("your-") || pass.startsWith("change-me")) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_PORT === "465",
    auth: { user, pass },
  });

  return transporter;
}

/* ─── HTML TEMPLATE ─────────────────────────────────────── */

function buildHtml(notification: AppNotification): string {
  const priorityColors: Record<string, string> = {
    urgent: "#ef4444", high: "#f97316", medium: "#3b82f6", low: "#71717a",
  };
  const color = priorityColors[notification.priority] || "#3b82f6";

  const items: string[] = [
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px">',
    '<tr><td align="center">',
    '<table width="480" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px;border:1px solid rgba(255,255,255,0.08)">',
    '<tr><td style="padding:24px">',
    `<div style="border-left:3px solid ${color};padding-left:16px">`,
    `<h2 style="color:#ffffff;margin:0 0 8px;font-size:18px">${escapeHtml(notification.title)}</h2>`,
    `<p style="color:#a1a1aa;margin:0 0 16px;font-size:14px;line-height:1.5">${escapeHtml(notification.message)}</p>`,
    "</div>",
  ];

  if (notification.campaignId) {
    items.push(
      '<div style="margin-top:16px;padding:12px;background:rgba(255,255,255,0.04);border-radius:8px;border:1px solid rgba(255,255,255,0.06)">',
      '<p style="color:#71717a;margin:0;font-size:12px">Campaign</p>',
      `<p style="color:#ef4444;margin:4px 0 0;font-size:13px;font-family:monospace">${escapeHtml(notification.campaignId)}</p>`,
      "</div>",
    );
  }

  if (notification.triggeredBy) {
    items.push(`<p style="color:#71717a;margin:12px 0 0;font-size:11px">Triggered by: ${escapeHtml(notification.triggeredBy)}</p>`);
  }

  const ts = new Date(notification.createdAt).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  items.push(
    `<p style="color:#52525b;margin:16px 0 0;font-size:10px;border-top:1px solid rgba(255,255,255,0.06);padding-top:12px">`,
    `SharpConnect · ${escapeHtml(ts)}`,
    "</p>",
    "</td></tr></table></td></tr></table>",
  );

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${items.join("\n")}</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ─── SEND EMAIL ─────────────────────────────────────────── */

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const t = await getTransporter();
    if (!t) return { ok: false, error: "SMTP not configured (set SMTP_PASS in .env.local)" };

    const from = process.env.SMTP_FROM || "sharpconnectinfo@gmail.com";
    await t.sendMail({
      from: `"SharpConnect" <${from}>`,
      to,
      subject: `[SharpConnect] ${subject}`,
      html,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/* ─── DISPATCH TO EMAIL ──────────────────────────────────── */

export async function dispatchToEmail(
  notification: AppNotification,
  to: string,
): Promise<DispatchResult> {
  if (!to) {
    return {
      channel: "email", recipient: to, status: "skipped",
      error: "No recipient", timestamp: new Date().toISOString(),
    };
  }

  const transporter = await getTransporter();
  if (!transporter) {
    return {
      channel: "email", recipient: to, status: "skipped",
      error: "SMTP not configured (set SMTP_PASS in .env.local)",
      timestamp: new Date().toISOString(),
    };
  }

  const result = await sendEmail(to, notification.title, buildHtml(notification));

  return {
    channel: "email",
    recipient: to,
    status: result.ok ? "sent" : "failed",
    error: result.error,
    timestamp: new Date().toISOString(),
  };
}