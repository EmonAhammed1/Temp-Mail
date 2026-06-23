import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Email from '@/models/Email';
import Inbox from '@/models/Inbox';

export async function POST(req) {
  try {
    // 1. Verify authorization to prevent unauthorized email injection
    const authHeader = req.headers.get('authorization');
    const secretToken = process.env.WEBHOOK_TOKEN;

    if (secretToken && authHeader !== `Bearer ${secretToken}`) {
      console.warn('Unauthorized web hook request blocked');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse incoming payload
    const body = await req.json();
    const { to, from, subject, bodyHtml, bodyText } = body;

    if (!to || !from) {
      return NextResponse.json({ error: 'Missing required fields: to, from' }, { status: 400 });
    }

    const cleanTo = to.toLowerCase().trim();

    // 3. Connect to Database
    await dbConnect();

    // 4. Verify if the temporary address is currently active/registered
    const inbox = await Inbox.findOne({ address: cleanTo });
    if (!inbox) {
      console.log(`[API Incoming] Ignored email for ${cleanTo} because the inbox is not active/registered.`);
      // Return 202 Accepted so Cloudflare doesn't keep retrying, but explain it was not stored.
      return NextResponse.json({ success: false, message: 'Recipient inbox not active/found' }, { status: 202 });
    }

    // 5. Save incoming email
    const email = await Email.create({
      to: cleanTo,
      from,
      subject: subject || '(No Subject)',
      bodyHtml: bodyHtml || '',
      bodyText: bodyText || '',
      createdAt: new Date(),
    });

    console.log(`[API Incoming] Successfully saved email for active inbox ${cleanTo} from ${from}`);

    return NextResponse.json({ success: true, emailId: email._id }, { status: 201 });
  } catch (error) {
    console.error('[API Incoming ERROR]:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
