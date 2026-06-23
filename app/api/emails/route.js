import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Email from '@/models/Email';
import Inbox from '@/models/Inbox';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/emails?address=example@yourdomain.com
export async function GET(req) {
  try {
    const userId = getUserFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Address query parameter is required' }, { status: 400 });
    }

    const cleanAddress = address.toLowerCase().trim();

    await dbConnect();
    const user = await User.findById(userId).lean();
    if (!user || user.status !== 'approved') {
      return NextResponse.json({ error: 'Account pending approval' }, { status: 403 });
    }

    // Verify user owns this inbox
    const inbox = await Inbox.findOne({ address: cleanAddress, userId });
    if (!inbox) {
      return NextResponse.json({ error: 'Unauthorized access to this inbox' }, { status: 403 });
    }

    // Fetch emails for this address sorted by latest
    const emails = await Email.find({ to: cleanAddress })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, emails }, { status: 200 });
  } catch (error) {
    console.error('[API GET Emails ERROR]:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

// DELETE /api/emails?id=emailId
export async function DELETE(req) {
  try {
    const userId = getUserFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Email ID parameter is required' }, { status: 400 });
    }

    await dbConnect();
    const user = await User.findById(userId).lean();
    if (!user || user.status !== 'approved') {
      return NextResponse.json({ error: 'Account pending approval' }, { status: 403 });
    }

    // 1. Fetch the email to check the recipient address
    const email = await Email.findById(id);
    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    // 2. Verify user owns the inbox receiving this email
    const inbox = await Inbox.findOne({ address: email.to, userId });
    if (!inbox) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    // 3. Delete the email
    await Email.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: 'Email deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('[API DELETE Emails ERROR]:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
