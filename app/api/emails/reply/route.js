import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import dbConnect from '@/lib/db';
import Inbox from '@/models/Inbox';
import Email from '@/models/Email';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';

// POST /api/emails/reply - Send reply to an email
export async function POST(req) {
  try {
    const userId = getUserFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Please log in' }, { status: 401 });
    }

    const body = await req.json();
    const { from, to, subject, message, quotedText } = body;

    if (!from || !to || !message || !message.trim()) {
      return NextResponse.json({ error: 'Sender address, recipient, and message body are required' }, { status: 400 });
    }

    // Extract email address cleanly (handles "Name <email@domain.com>" and raw emails)
    const match = to.match(/<([^>]+)>/) || [null, to.trim()];
    const cleanTo = (match[1] || to).trim().toLowerCase();
    const cleanFrom = from.toLowerCase().trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanTo)) {
      return NextResponse.json({ error: `Invalid recipient address: "${cleanTo}"` }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findById(userId).lean();
    if (!user || user.status !== 'approved') {
      return NextResponse.json({ error: 'Account is pending approval' }, { status: 403 });
    }

    // Verify user owns the sending temporary inbox
    const inbox = await Inbox.findOne({ address: cleanFrom, userId });
    if (!inbox) {
      return NextResponse.json({ error: 'Unauthorized: You do not own this sending address' }, { status: 403 });
    }

    const replySubject = subject ? (subject.startsWith('Re:') ? subject.trim() : `Re: ${subject.trim()}`) : 'Re: (No Subject)';
    
    // Construct full email body with quoted content
    const fullTextBody = quotedText 
      ? `${message.trim()}\n\n--- Original Message ---\n${quotedText}`
      : message.trim();

    const fullHtmlBody = `
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

    console.log(`[API Hit: Email Reply] From: "${cleanFrom}" -> To: "${cleanTo}" | Subject: "${replySubject}"`);

    // 1. Direct Internal Delivery if recipient inbox exists in our system
    const internalRecipientInbox = await Inbox.findOne({ address: cleanTo });
    if (internalRecipientInbox) {
      await Email.create({
        to: cleanTo,
        from: cleanFrom,
        subject: replySubject,
        bodyHtml: fullHtmlBody,
        bodyText: fullTextBody,
        isRead: false,
      });
      console.log(`[API Email Reply Internal Delivery] Delivered to system inbox: ${cleanTo}`);
    }

    // 2. Check if external SMTP is configured
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        await transporter.sendMail({
          from: `"${cleanFrom.split('@')[0]}" <${cleanFrom}>`,
          to: cleanTo,
          subject: replySubject,
          text: fullTextBody,
          html: fullHtmlBody,
        });

        console.log(`[API Email Reply SMTP Success] Dispatched to ${cleanTo} via SMTP ${smtpHost}`);
        return NextResponse.json({
          success: true,
          mode: 'live_smtp',
          message: `Reply sent successfully to ${cleanTo}!`,
        }, { status: 200 });
      } catch (smtpErr) {
        console.error('[API Email Reply SMTP Error]:', smtpErr);
        // If internal delivery succeeded, still return success
        if (internalRecipientInbox) {
          return NextResponse.json({
            success: true,
            mode: 'internal',
            message: `Reply delivered to internal inbox ${cleanTo}!`,
          }, { status: 200 });
        }
        return NextResponse.json({ error: `SMTP Send Error: ${smtpErr.message}` }, { status: 500 });
      }
    } else {
      // Sandbox relay mode
      console.log(`[API Email Reply Sandbox] Reply recorded. From: ${cleanFrom} -> To: ${cleanTo}`);
      return NextResponse.json({
        success: true,
        mode: internalRecipientInbox ? 'internal' : 'simulated',
        message: `Reply sent successfully to ${cleanTo}!`,
      }, { status: 200 });
    }

  } catch (error) {
    console.error('[API Email Reply Fatal Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
