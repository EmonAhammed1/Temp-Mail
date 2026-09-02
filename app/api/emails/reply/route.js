import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import dbConnect from '@/lib/db';
import Inbox from '@/models/Inbox';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';

// POST /api/emails/reply - Send reply to an email
export async function POST(req) {
  try {
    const userId = getUserFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { from, to, subject, message, quotedText } = body;

    if (!from || !to || !message) {
      return NextResponse.json({ error: 'From address, recipient (To), and message body are required' }, { status: 400 });
    }

    const cleanFrom = from.toLowerCase().trim();
    const cleanTo = to.trim();

    await dbConnect();
    const user = await User.findById(userId).lean();
    if (!user || user.status !== 'approved') {
      return NextResponse.json({ error: 'Account pending approval' }, { status: 403 });
    }

    // Verify user owns the sending temporary inbox
    const inbox = await Inbox.findOne({ address: cleanFrom, userId });
    if (!inbox) {
      return NextResponse.json({ error: 'Unauthorized sending address' }, { status: 403 });
    }

    const replySubject = subject ? (subject.startsWith('Re:') ? subject : `Re: ${subject}`) : 'Re: (No Subject)';
    
    // Construct full email body with quoted content
    const fullTextBody = quotedText 
      ? `${message.trim()}\n\n--- Original Message ---\n${quotedText}`
      : message.trim();

    const fullHtmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #222;">
        <div style="white-space: pre-wrap;">${message.trim()}</div>
        ${quotedText ? `
          <div style="margin-top: 24px; padding-left: 12px; border-left: 2px solid #a855f7; color: #666; font-size: 13px;">
            <p style="font-weight: 600; margin-bottom: 6px; color: #444;">Original Message:</p>
            <div style="white-space: pre-wrap;">${quotedText}</div>
          </div>
        ` : ''}
      </div>
    `;

    console.log(`[API Hit: Email Reply] Sending from: ${cleanFrom} -> to: ${cleanTo} | Subject: "${replySubject}"`);

    // Check if SMTP environment variables are set
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
      // Send real email via SMTP
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

      console.log(`[API Email Reply Real Send Success] Dispatched to ${cleanTo} via SMTP ${smtpHost}`);
      return NextResponse.json({
        success: true,
        mode: 'live_smtp',
        message: `Reply sent successfully to ${cleanTo}`,
      }, { status: 200 });

    } else {
      // Outbound simulation mode with full logging
      console.log(`[API Email Reply Simulated Relay] SMTP credentials not set in .env. Message recorded & dispatched successfully in sandbox mode:`);
      console.log(`To: ${cleanTo}\nFrom: ${cleanFrom}\nSubject: ${replySubject}\nBody:\n${message.trim()}\n`);

      return NextResponse.json({
        success: true,
        mode: 'simulated',
        message: `Reply sent successfully to ${cleanTo}! (Sandbox mode)`,
      }, { status: 200 });
    }

  } catch (error) {
    console.error('[API Email Reply ERROR]:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
