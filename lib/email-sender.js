import nodemailer from 'nodemailer';
import crypto from 'crypto';
import dbConnect from '@/lib/db';
import Setting from '@/models/Setting';
import Inbox from '@/models/Inbox';
import Email from '@/models/Email';
import SentEmail from '@/models/SentEmail';

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
 * Generates a clean, 100% link-free, high-deliverability styled HTML email
 */
export function buildColorfulEmailHtml({ from, to, subject, message, quotedText }) {
  const dateStr = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Convert markdown-style formatting if present
  let formattedMessage = message.trim()
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background-color: #f3e8ff; color: #7e22ce; padding: 2px 4px; border-radius: 4px; font-family: monospace;">$1</code>');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 20px 10px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
          
          <!-- Header Bar -->
          <tr>
            <td style="background-color: #7c3aed; padding: 20px 24px; color: #ffffff;">
              <div style="font-size: 18px; font-weight: 700; letter-spacing: -0.01em;">
                Emons Temp Mail
              </div>
              <div style="font-size: 12px; color: #e9d5ff; margin-top: 2px;">
                Temporary Email Service • Sender: ${from}
              </div>
            </td>
          </tr>

          <!-- Sender Info Bar -->
          <tr>
            <td style="background-color: #f5f3ff; border-bottom: 1px solid #ede9fe; padding: 12px 24px; font-size: 13px; color: #4b5563;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <strong>From:</strong> <span style="color: #6d28d9; font-weight: 700;">${from}</span>
                  </td>
                  <td align="right" style="font-size: 12px; color: #9ca3af;">
                    ${dateStr}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Email Content Body -->
          <tr>
            <td style="padding: 24px;">
              <h2 style="margin: 0 0 16px 0; font-size: 17px; font-weight: 700; color: #0f172a;">
                ${subject}
              </h2>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap; word-break: break-word;">
                ${formattedMessage}
              </div>

              ${quotedText ? `
                <div style="margin-top: 16px; background-color: #faf5ff; border-left: 3px solid #8b5cf6; padding: 10px 14px; font-size: 13px; color: #64748b; white-space: pre-wrap; word-break: break-word;">
                  <strong>Original Message:</strong><br />
                  ${quotedText}
                </div>
              ` : ''}

              <div style="margin-top: 20px; font-size: 12px; color: #64748b; background-color: #f1f5f9; padding: 10px 14px; border-radius: 6px;">
                To reply to this email, simply click Reply in your mail client.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 16px 24px; text-align: center; color: #94a3b8; font-size: 11px;">
              Sent securely via Emons Temp Mail (${from})
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends an email via Internal DB Delivery and/or Outbound SMTP
 */
export async function dispatchEmail({ userId, from, to, subject, message, html, quotedText, reqUrl }) {
  const match = to.match(/<([^>]+)>/) || [null, to.trim()];
  const cleanTo = (match[1] || to).trim().toLowerCase();
  const cleanFrom = from.toLowerCase().trim();
  const cleanSubject = subject ? subject.trim() : '(No Subject)';

  const fullText = quotedText
    ? `${message.trim()}\n\n--- Original Message ---\n${quotedText}`
    : message.trim();

  // Generate unique tracking token
  const trackingId = crypto.randomBytes(16).toString('hex');

  // Generate 100% link-free, spam-safe HTML
  const fullHtml = html || buildColorfulEmailHtml({
    from: cleanFrom,
    to: cleanTo,
    subject: cleanSubject,
    message: message.trim(),
    quotedText: quotedText ? quotedText.trim() : '',
  });

  await dbConnect();

  // 1. Direct Internal Delivery (if recipient is an inbox in our database)
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
    console.log(`[Email Dispatch] Delivered internally to inbox: ${cleanTo}`);

    if (userId) {
      await SentEmail.create({
        userId,
        from: cleanFrom,
        to: cleanTo,
        subject: cleanSubject,
        bodyText: fullText,
        bodyHtml: fullHtml,
        status: 'delivered',
        deliveryMode: 'internal',
        trackingId,
      });
    }

    return {
      success: true,
      mode: 'internal',
      message: `Delivered instantly to internal temporary inbox ${cleanTo}! 📬`,
    };
  }

  // 2. Outbound SMTP Delivery for external addresses (e.g. Gmail, Yahoo, etc.)
  const smtp = await getEffectiveSmtpConfig();

  if (smtp) {
    try {
      console.log(`[Email Dispatch] Connecting to SMTP ${smtp.host}:${smtp.port} (user: ${smtp.user})...`);
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
        connectionTimeout: 12000,
        greetingTimeout: 12000,
        socketTimeout: 15000,
      });

      const info = await transporter.sendMail({
        from: `"Emons Mail" <${smtp.user}>`,
        replyTo: cleanFrom,
        to: cleanTo,
        subject: cleanSubject,
        text: fullText,
        html: fullHtml,
      });

      console.log(`[Email Dispatch Live Success] MessageId: ${info.messageId} to ${cleanTo}`);

      if (userId) {
        await SentEmail.create({
          userId,
          from: cleanFrom,
          to: cleanTo,
          subject: cleanSubject,
          bodyText: fullText,
          bodyHtml: fullHtml,
          status: 'delivered',
          deliveryMode: 'live_smtp',
          trackingId,
        });
      }

      return {
        success: true,
        mode: 'live_smtp',
        message: `Email successfully delivered to ${cleanTo}! 🚀`,
      };
    } catch (smtpErr) {
      console.error('[Email Dispatch SMTP Error]:', smtpErr);

      if (userId) {
        await SentEmail.create({
          userId,
          from: cleanFrom,
          to: cleanTo,
          subject: cleanSubject,
          bodyText: fullText,
          bodyHtml: fullHtml,
          status: 'failed',
          deliveryMode: 'failed',
          errorMessage: `SMTP error (${smtp.host}:${smtp.port}): ${smtpErr.message}`,
          trackingId,
        });
      }

      return {
        success: false,
        error: `Failed to send email via SMTP (${smtp.host}): ${smtpErr.message}. Please verify SMTP credentials in Admin Panel.`,
      };
    }
  }

  // If no SMTP configured
  console.warn(`[Email Dispatch Warning] SMTP not configured. Cannot send to external recipient: ${cleanTo}`);
  
  if (userId) {
    await SentEmail.create({
      userId,
      from: cleanFrom,
      to: cleanTo,
      subject: cleanSubject,
      bodyText: fullText,
      bodyHtml: fullHtml,
      status: 'failed',
      deliveryMode: 'failed',
      errorMessage: 'SMTP server is not configured in Admin Panel (/admin)',
      trackingId,
    });
  }

  return {
    success: false,
    needsSmtp: true,
    error: `SMTP server is not configured yet! To send emails to real external addresses (like Gmail/Yahoo), please configure SMTP in Admin Panel (/admin) or .env.local.`,
  };
}
