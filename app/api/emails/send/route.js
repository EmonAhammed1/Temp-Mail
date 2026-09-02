import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import dbConnect from '@/lib/db';
import Inbox from '@/models/Inbox';
import Email from '@/models/Email';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';

// POST /api/emails/send - Send a new outgoing email
export async function POST(req) {
  try {
    const userId = getUserFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Please log in' }, { status: 401 });
    }

    const body = await req.json();
    const { from, to, subject, message, bodyHtml } = body;

    if (!from || !to || !message || !message.trim()) {
      return NextResponse.json({ error: 'Sender address, recipient, and message body are required' }, { status: 400 });
    }

    // Extract email address cleanly (handles "Name <email@domain.com>" and raw emails)
    const match = to.match(/<([^>]+)>/) || [null, to.trim()];
    const cleanTo = (match[1] || to).trim().toLowerCase();
    const cleanFrom = from.toLowerCase().trim();
    const cleanSubject = subject ? subject.trim() : '(No Subject)';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanTo)) {
      return NextResponse.json({ error: `Invalid recipient email address: "${cleanTo}"` }, { status: 400 });
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

    const fullHtmlBody = bodyHtml || `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #222; padding: 16px;">
        <div style="white-space: pre-wrap;">${message.trim()}</div>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0 12px 0;" />
        <span style="color: #888; font-size: 12px;">Sent via Emons Temp Mail (${cleanFrom})</span>
      </div>
    `;

    console.log(`[API Hit: Send New Email] From: "${cleanFrom}" -> To: "${cleanTo}" | Subject: "${cleanSubject}"`);

    // 1. Direct Internal Delivery if recipient inbox exists in our system
    const internalRecipientInbox = await Inbox.findOne({ address: cleanTo });
    if (internalRecipientInbox) {
      await Email.create({
        to: cleanTo,
        from: cleanFrom,
        subject: cleanSubject,
        bodyHtml: fullHtmlBody,
        bodyText: message.trim(),
        isRead: false,
      });
      console.log(`[API Send New Email Internal Delivery] Delivered to system inbox: ${cleanTo}`);
    }

    // 2. Check if SMTP environment variables are configured
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
          subject: cleanSubject,
          text: message.trim(),
          html: fullHtmlBody,
        });

        console.log(`[API Send New Email Live Success] Dispatched to ${cleanTo} via SMTP ${smtpHost}`);
        return NextResponse.json({
          success: true,
          mode: 'live_smtp',
          message: `Email sent successfully to ${cleanTo}!`,
        }, { status: 200 });
      } catch (smtpErr) {
        console.error('[API Send New Email SMTP Error]:', smtpErr);
        if (internalRecipientInbox) {
          return NextResponse.json({
            success: true,
            mode: 'internal',
            message: `Email delivered to internal inbox ${cleanTo}!`,
          }, { status: 200 });
        }
        return NextResponse.json({ error: `SMTP Send Error: ${smtpErr.message}` }, { status: 500 });
      }
    } else {
      // Simulation sandbox mode
      console.log(`\n========================================`);
      console.log(`[API Send New Email (Sandbox Mode)]`);
      console.log(`From:    ${cleanFrom}`);
      console.log(`To:      ${cleanTo}`);
      console.log(`Subject: ${cleanSubject}`);
      console.log(`Body:\n${message.trim()}`);
      console.log(`========================================\n`);

      return NextResponse.json({
        success: true,
        mode: internalRecipientInbox ? 'internal' : 'simulated',
        message: `Email sent successfully to ${cleanTo}!`,
      }, { status: 200 });
    }

  } catch (error) {
    console.error('[API Send New Email Fatal Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
