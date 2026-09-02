import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import dbConnect from '@/lib/db';
import Inbox from '@/models/Inbox';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';

// POST /api/emails/send - Send a new outgoing email from a temporary address
export async function POST(req) {
  try {
    const userId = getUserFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { from, to, subject, message, bodyHtml } = body;

    if (!from || !to || !message) {
      return NextResponse.json({ error: 'Sender (From), recipient (To), and message body are required' }, { status: 400 });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanTo = to.trim();
    if (!emailRegex.test(cleanTo)) {
      return NextResponse.json({ error: 'Please enter a valid recipient email address' }, { status: 400 });
    }

    const cleanFrom = from.toLowerCase().trim();
    const cleanSubject = subject ? subject.trim() : '(No Subject)';

    await dbConnect();
    const user = await User.findById(userId).lean();
    if (!user || user.status !== 'approved') {
      return NextResponse.json({ error: 'Account pending approval' }, { status: 403 });
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

    // Check if SMTP environment variables are configured
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
      // Send live email via SMTP
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

      console.log(`[API Send New Email Live Success] Dispatched email to ${cleanTo} via SMTP ${smtpHost}`);

      return NextResponse.json({
        success: true,
        mode: 'live_smtp',
        message: `Email sent successfully to ${cleanTo}!`,
      }, { status: 200 });

    } else {
      // Simulation / Sandbox relay mode with detailed terminal logging
      console.log(`\n========================================`);
      console.log(`[API Send New Email (Sandbox Mode)]`);
      console.log(`From:    ${cleanFrom}`);
      console.log(`To:      ${cleanTo}`);
      console.log(`Subject: ${cleanSubject}`);
      console.log(`Body:\n${message.trim()}`);
      console.log(`========================================\n`);

      return NextResponse.json({
        success: true,
        mode: 'simulated',
        message: `Email sent successfully to ${cleanTo}! (Sandbox mode)`,
      }, { status: 200 });
    }

  } catch (error) {
    console.error('[API Send New Email ERROR]:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
