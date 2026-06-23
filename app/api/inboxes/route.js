import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Inbox from '@/models/Inbox';
import Email from '@/models/Email';
import { getUserFromRequest } from '@/lib/auth';

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || 'lumina-mail.my';

// GET /api/inboxes - Fetch all inboxes of the logged-in user
export async function GET(req) {
  try {
    const userId = getUserFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const inboxes = await Inbox.find({ userId }).sort({ createdAt: -1 }).lean();

    return NextResponse.json({ success: true, inboxes }, { status: 200 });
  } catch (error) {
    console.error('[API GET Inboxes Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/inboxes - Create a new temporary inbox (random or custom)
export async function POST(req) {
  try {
    const userId = getUserFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prefix, type } = await req.json(); // type: 'random' or 'custom'
    let finalPrefix = '';

    if (type === 'random') {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      for (let i = 0; i < 8; i++) {
        finalPrefix += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } else {
      if (!prefix) {
        return NextResponse.json({ error: 'Custom prefix is required' }, { status: 400 });
      }
      finalPrefix = prefix.toLowerCase().replace(/[^a-z0-9._-]/g, '').trim();
      if (!finalPrefix) {
        return NextResponse.json({ error: 'Invalid custom prefix name' }, { status: 400 });
      }
    }

    const fullEmail = `${finalPrefix}@${DOMAIN}`.toLowerCase().trim();

    await dbConnect();

    // Enforce uniqueness across all users
    const existingInbox = await Inbox.findOne({ address: fullEmail });
    if (existingInbox) {
      return NextResponse.json({ error: 'This temporary email address is already in use' }, { status: 400 });
    }

    const newInbox = await Inbox.create({
      address: fullEmail,
      userId,
      createdAt: new Date(),
    });

    console.log(`[API Inbox] Created inbox ${fullEmail} for user ${userId}`);

    return NextResponse.json({ success: true, inbox: newInbox }, { status: 201 });

  } catch (error) {
    console.error('[API POST Inbox Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

// DELETE /api/inboxes?address=example@yourdomain.com - Discard inbox & delete all associated emails
export async function DELETE(req) {
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

    // Verify ownership
    const inbox = await Inbox.findOne({ address: cleanAddress, userId });
    if (!inbox) {
      return NextResponse.json({ error: 'Inbox not found or you do not have permission' }, { status: 403 });
    }

    // 1. Delete the inbox record
    await Inbox.deleteOne({ _id: inbox._id });

    // 2. Delete all emails sent to this address
    const emailResult = await Email.deleteMany({ to: cleanAddress });

    console.log(`[API Inbox] Deleted inbox ${cleanAddress} and ${emailResult.deletedCount} emails`);

    return NextResponse.json({ 
      success: true, 
      message: 'Inbox and all received emails discarded successfully',
      deletedEmailsCount: emailResult.deletedCount
    }, { status: 200 });

  } catch (error) {
    console.error('[API DELETE Inbox Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
