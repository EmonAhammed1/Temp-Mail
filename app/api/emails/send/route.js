import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Inbox from '@/models/Inbox';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';
import { dispatchEmail } from '@/lib/email-sender';

// POST /api/emails/send - Send a new outgoing email
export async function POST(req) {
  try {
    const userId = getUserFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Please log in' }, { status: 401 });
    }

    const body = await req.json();
    const { from, to, subject, message, bodyHtml, isPlainText } = body;

    if (!from || !to || !message || !message.trim()) {
      return NextResponse.json({ error: 'Sender address, recipient, and message body are required' }, { status: 400 });
    }

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

    const result = await dispatchEmail({
      userId,
      from: cleanFrom,
      to: cleanTo,
      subject,
      message,
      html: bodyHtml,
      isPlainText: Boolean(isPlainText),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error, needsSmtp: result.needsSmtp }, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('[API Send New Email Fatal Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
