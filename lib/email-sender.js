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
 * Generates a clean, spam-resistant, beautifully branded HTML email
 */
export function buildColorfulEmailHtml({ from, to, subject, message, quotedText, trackingId, baseUrl }) {
  const dateStr = new Date().toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Convert markdown-style formatting if present
  let formattedMessage = message.trim()
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background: #f3e8ff; color: #6d28d9; padding: 2px 5px; border-radius: 4px; font-family: monospace;">$1</code>');

  // Only include tracking pixel if URL is a live HTTPS endpoint (avoid localhost spam flags)
  const isHttps = baseUrl && baseUrl.startsWith('https://') && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1');
  const trackingPixel = isHttps && trackingId
    ? `<img src="${baseUrl}/api/emails/track?id=${trackingId}" width="1" height="1" alt="" border="0" style="width:1px;height:1px;" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #6d28d9; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 22px 24px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <div style="font-size: 18px; font-weight: 700; color: #ffffff;">
                      ⚡ Emons Temp Mail
                    </div>
                    <div style="font-size: 12px; color: #ddd6fe; margin-top: 2px;">
                      Secure Disposable Temporary Mail Service
                    </div>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 99px;">
                      Message
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Metadata Bar -->
          <tr>
            <td style="background-color: #faf5ff; border-bottom: 1px solid #ede9fe; padding: 14px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px; color: #4b5563;">
                <tr>
                  <td style="padding-bottom: 4px;">
                    <strong>From:</strong> <span style="color: #6d28d9; font-weight: 700;">${from}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 4px;">
                    <strong>To:</strong> ${to}
                  </td>
                </tr>
                <tr>
                  <td style="font-size: 12px; color: #9ca3af;">
                    Date: ${dateStr}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content Area -->
          <tr>
            <td style="padding: 24px;">
              
              <!-- Subject -->
              <div style="margin-bottom: 16px;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #111827;">${subject}</h2>
              </div>

              <!-- Main Message -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; font-size: 14px; line-height: 1.6; color: #1f2937; white-space: pre-wrap; word-break: break-word;">${formattedMessage}</div>

              <!-- Quoted Thread (if reply) -->
              ${quotedText ? `
                <div style="margin-top: 18px; background-color: #faf5ff; border-left: 3px solid #7c3aed; border-radius: 0 6px 6px 0; padding: 12px 16px;">
                  <div style="font-size: 12px; font-weight: 700; color: #6d28d9; margin-bottom: 4px;">
                    In reference to original message:
                  </div>
                  <div style="font-size: 13px; color: #4b5563; line-height: 1.5; white-space: pre-wrap; word-break: break-word;">${quotedText}</div>
                </div>
              ` : ''}

              <!-- Reply Hint -->
              <div style="margin-top: 20px; padding: 12px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; font-size: 12px; color: #166534;">
                💡 <strong>Reply note:</strong> You can click <strong>Reply</strong> in your email client to send a response directly to <strong>${from}</strong>.
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #18181b; padding: 18px 24px; text-align: center; color: #a1a1aa; font-size: 11px;">
              <p style="margin: 0 0 4px 0; color: #e4e4e7; font-weight: 600;">
                Sent via Emons Temp Mail
              </p>
              <p style="margin: 0; color: #71717a;">
                Disposable temporary email address service
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  ${trackingPixel}
</body>
</html>`;
}

/**
 * Sends an email via Internal DB Delivery and/or Outbound SMTP with Anti-Spam headers
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
  
  // Resolve base URL for tracking pixel
  let baseUrl = '';
  if (reqUrl) {
    try {
      const parsed = new URL(reqUrl);
      baseUrl = `${parsed.protocol}//${parsed.host}`;
    } catch {
      baseUrl = '';
    }
  }

  // Generate clean, spam-optimized HTML
  const fullHtml = html || buildColorfulEmailHtml({
    from: cleanFrom,
    to: cleanTo,
    subject: cleanSubject,
    message: message.trim(),
    quotedText: quotedText ? quotedText.trim() : '',
    trackingId,
    baseUrl,
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

      // Format clean display name (Avoid putting full email address in display name quotes to prevent Gmail spoofing penalty)
      const usernamePart = cleanFrom.split('@')[0];
      const senderDisplayName = `${usernamePart} via Emons Mail`;

      const info = await transporter.sendMail({
        from: `"${senderDisplayName}" <${smtp.user}>`,
        replyTo: cleanFrom,
        to: cleanTo,
        subject: cleanSubject,
        text: fullText,
        html: fullHtml,
        headers: {
          'X-Mailer': 'Emons Temp Mail v1.0',
          'X-Auto-Response-Suppress': 'OOF, AutoReply',
        },
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
