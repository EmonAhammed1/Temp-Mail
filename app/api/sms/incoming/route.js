import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Sms from '@/models/Sms';

export async function POST(req) {
  try {
    // Twilio sends data as application/x-www-form-urlencoded
    const formData = await req.formData();
    const from = formData.get('From');
    const to = formData.get('To');
    const body = formData.get('Body');

    if (!from || !to || !body) {
      console.warn('[Twilio Webhook Warning]: Missing fields. Got:', { from, to, body });
      return new NextResponse('<Response></Response>', {
        headers: { 'Content-Type': 'application/xml' },
        status: 200,
      });
    }

    await dbConnect();

    // Create SMS record in MongoDB
    const sms = await Sms.create({
      from,
      to,
      body,
    });

    console.log(`[Twilio Webhook Success]: Saved SMS from ${from} to ${to}: "${body.substring(0, 30)}..."`);

    // Return empty TwiML response as expected by Twilio
    return new NextResponse('<Response></Response>', {
      headers: { 'Content-Type': 'application/xml' },
      status: 200,
    });

  } catch (error) {
    console.error('[Twilio Webhook Error]:', error);
    return new NextResponse('<Response><Redirect/></Response>', {
      headers: { 'Content-Type': 'application/xml' },
      status: 500,
    });
  }
}
