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
 * Generates a colorful, beautifully branded HTML email template with open tracking
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
    .replace(/`([^`]+)`/g, '<code style="background: rgba(147,51,234,0.1); color: #7e22ce; padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>');

  const trackingPixel = trackingId && baseUrl
    ? `<img src="${baseUrl}/api/emails/track?id=${trackingId}" width="1" height="1" style="display:none !important; width:1px; height:1px; border:0;" alt="" />`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f1f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f1f6; padding: 28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 620px; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08); border: 1px solid #e5e7eb;">
          
          <!-- Colorful Gradient Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #9333ea 50%, #4f46e5 100%); padding: 26px 28px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <div style="font-size: 20px; font-weight: 850; color: #ffffff; letter-spacing: -0.02em; display: flex; align-items: center; gap: 8px;">
                      ⚡ Emons <span style="color: #f3e8ff;">Temp Mail</span>
                    </div>
                    <div style="font-size: 12px; color: #e9d5ff; margin-top: 4px; font-weight: 500;">
                      Anonymous & Disposable Temporary Mail Service
                    </div>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; background: rgba(255, 255, 255, 0.2); border: 1px solid rgba(255, 255, 255, 0.35); color: #ffffff; font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.05em;">
                      Direct Message
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Sender & Routing Details Bar -->
          <tr>
            <td style="background-color: #fbfbfe; border-bottom: 1px solid #ede9fe; padding: 16px 28px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px;">
                <tr>
                  <td style="padding-bottom: 6px; color: #6b7280; font-weight: 600;">
                    From: <span style="display: inline-block; background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; font-family: 'Courier New', Courier, monospace; font-weight: 700; padding: 2px 10px; border-radius: 6px; font-size: 13px;">${from}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 6px; color: #6b7280;">
                    To: <strong style="color: #111827;">${to}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="color: #9ca3af; font-size: 12px;">
                    Sent at: ${dateStr}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Email Body Area -->
          <tr>
            <td style="padding: 28px;">
              
              <!-- Subject Header -->
              <div style="margin-bottom: 20px;">
                <span style="font-size: 11px; font-weight: 800; color: #9333ea; text-transform: uppercase; letter-spacing: 0.08em; display: block; margin-bottom: 4px;">Subject</span>
                <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #111827; line-height: 1.35;">${subject}</h1>
              </div>

              <!-- Message Card -->
              <div style="background: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%); border: 1px solid #e5e7eb; border-radius: 14px; padding: 22px; font-size: 15px; line-height: 1.7; color: #1f2937; box-shadow: inset 0 1px 3px rgba(0,0,0,0.02);">
                <div style="white-space: pre-wrap; word-break: break-word;">${formattedMessage}</div>
              </div>

              <!-- Quoted Reply Section (if present) -->
              ${quotedText ? `
                <div style="margin-top: 24px; background: #faf5ff; border: 1px solid #e9d5ff; border-left: 4px solid #9333ea; border-radius: 0 12px 12px 0; padding: 16px 20px;">
                  <div style="font-size: 12px; font-weight: 750; color: #7e22ce; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
                    💬 In Reference To Original Message:
                  </div>
                  <div style="font-size: 13.5px; color: #4b5563; line-height: 1.6; white-space: pre-wrap; word-break: break-word;">${quotedText}</div>
                </div>
              ` : ''}

              <!-- Interactive Reply Hint -->
              <div style="margin-top: 24px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; gap: 10px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="28" valign="top">
                      <span style="font-size: 18px;">↩️</span>
                    </td>
                    <td style="font-size: 13px; color: #166534; line-height: 1.45;">
                      <strong>Want to reply?</strong> Simply click <strong>Reply</strong> in your email app. Your response will arrive directly into <strong>${from}</strong>'s live inbox!
                    </td>
                  </tr>
                </table>
              </div>

            </td>
          </tr>

          <!-- Modern Footer -->
          <tr>
            <td style="background-color: #0f0f15; padding: 22px 28px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #27272a;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #e4e4e7;">
                Sent via <span style="color: #c084fc;">Emons Temp Mail</span>
              </p>
              <p style="margin: 0; font-size: 11px; color: #71717a;">
                Fast, secure & anonymous temporary mail system • Domain: <strong>${from.split('@')[1] || 'emonahammed.shop'}</strong>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  ${trackingPixel}
</body>
</html>
  `;
}

/**
 * Sends an email via Internal DB Delivery and/or Outbound SMTP, with persistent SentEmail tracking
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

  // Generate colorful HTML template with tracking pixel
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

    // Create SentEmail log record
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
      console.log(`[Email Dispatch] Connecting to SMTP ${smtp.host}:${smtp.port} (source: ${smtp.source}, user: ${smtp.user})...`);
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
        from: `"${cleanFrom}" <${smtp.user}>`,
        replyTo: cleanFrom,
        to: cleanTo,
        subject: cleanSubject,
        text: fullText,
        html: fullHtml,
      });

      console.log(`[Email Dispatch Live Success] MessageId: ${info.messageId} to ${cleanTo}`);

      // Save to SentEmail collection as delivered
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

      // Save failed delivery log to SentEmail collection so user sees exact reason
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

  // Not delivered externally because SMTP is missing
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
