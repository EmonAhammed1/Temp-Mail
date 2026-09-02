import nodemailer from 'nodemailer';
import dbConnect from '@/lib/db';
import Setting from '@/models/Setting';
import Inbox from '@/models/Inbox';
import Email from '@/models/Email';

/**
 * Retrieves the effective SMTP configuration from Environment or Database Setting
 */
export async function getEffectiveSmtpConfig() {
  // 1. First check environment variables
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      secure: process.env.SMTP_SECURE === 'true' || parseInt(process.env.SMTP_PORT || '587', 10) === 465,
      source: 'environment',
    };
  }

  // 2. Fall back to MongoDB Setting
  try {
    await dbConnect();
    const setting = await Setting.findOne({ key: 'smtp_config' }).lean();
    if (setting && setting.value && setting.value.host && setting.value.user && setting.value.pass) {
      const port = parseInt(setting.value.port || '587', 10);
      return {
        host: setting.value.host.trim(),
        port: port,
        user: setting.value.user.trim(),
        pass: setting.value.pass.trim(),
        secure: setting.value.secure || port === 465,
        source: 'database',
      };
    }
  } catch (err) {
    console.error('[getEffectiveSmtpConfig Error]:', err);
  }

  return null;
}

/**
 * Sends an email via Internal DB Delivery and/or Outbound SMTP
 */
export async function dispatchEmail({ from, to, subject, message, html, quotedText }) {
  const match = to.match(/<([^>]+)>/) || [null, to.trim()];
  const cleanTo = (match[1] || to).trim().toLowerCase();
  const cleanFrom = from.toLowerCase().trim();
  const cleanSubject = subject ? subject.trim() : '(No Subject)';

  const fullText = quotedText
    ? `${message.trim()}\n\n--- Original Message ---\n${quotedText}`
    : message.trim();

  const fullHtml = html || `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #222; padding: 16px;">
      <div style="white-space: pre-wrap;">${message.trim()}</div>
      ${quotedText ? `
        <div style="margin-top: 24px; padding-left: 12px; border-left: 2px solid #a855f7; color: #666; font-size: 13px;">
          <p style="font-weight: 600; margin-bottom: 6px; color: #444;">Original Message:</p>
          <div style="white-space: pre-wrap;">${quotedText}</div>
        </div>
      ` : ''}
      <hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0 12px 0;" />
      <span style="color: #888; font-size: 12px;">Sent via Emons Temp Mail (${cleanFrom})</span>
    </div>
  `;

  await dbConnect();

  // 1. Direct Internal Delivery (if recipient is an inbox in our database)
  let deliveredInternally = false;
  const targetInbox = await Inbox.findOne({ address: cleanTo });
  if (targetInbox) {
    await Email.create({
      to: cleanTo,
      from: cleanFrom,
      subject: cleanSubject,
      bodyHtml: fullHtml,
      bodyText: fullText,
      isRead: false,
    });
    deliveredInternally = true;
    console.log(`[Email Dispatch] Delivered internally to inbox: ${cleanTo}`);
  }

  // 2. Outbound SMTP Delivery for external addresses (e.g. Gmail, Yahoo, etc.)
  const smtp = await getEffectiveSmtpConfig();

  if (smtp) {
    try {
      console.log(`[Email Dispatch] Connecting to SMTP ${smtp.host}:${smtp.port} (source: ${smtp.source})...`);
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      const info = await transporter.sendMail({
        from: `"${cleanFrom.split('@')[0]}" <${cleanFrom}>`,
        to: cleanTo,
        subject: cleanSubject,
        text: fullText,
        html: fullHtml,
      });

      console.log(`[Email Dispatch Live Success] MessageId: ${info.messageId} to ${cleanTo}`);
      return {
        success: true,
        mode: 'live_smtp',
        message: `Email successfully sent to ${cleanTo}! 🚀`,
      };
    } catch (smtpErr) {
      console.error('[Email Dispatch SMTP Error]:', smtpErr);
      if (deliveredInternally) {
        return {
          success: true,
          mode: 'internal',
          message: `Delivered to internal inbox ${cleanTo}!`,
        };
      }
      return {
        success: false,
        error: `Failed to send email via SMTP (${smtp.host}): ${smtpErr.message}. Please verify your SMTP credentials in Admin Panel.`,
      };
    }
  }

  // If no SMTP configured
  if (deliveredInternally) {
    return {
      success: true,
      mode: 'internal',
      message: `Delivered to internal inbox ${cleanTo}!`,
    };
  }

  // Not delivered externally because SMTP is missing
  console.warn(`[Email Dispatch Warning] SMTP not configured. Cannot send to external recipient: ${cleanTo}`);
  return {
    success: false,
    needsSmtp: true,
    error: `SMTP server is not configured yet! To send emails to real external addresses (like Gmail/Yahoo), please configure SMTP in Admin Panel (/admin) or .env.local.`,
  };
}
