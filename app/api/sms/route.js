import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Sms from '@/models/Sms';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req) {
  try {
    // 1. Authenticate user session
    const userId = getUserFromRequest(req);
    console.log(`[API SMS GET Hit] Session auth check. userId: ${userId || 'null'}`);
    if (!userId) {
      console.warn('[API SMS GET Unauthorized] No active session cookie found.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const to = searchParams.get('to');
    console.log(`[API SMS GET Fetching] Filter to: ${to || 'all'}`);

    await dbConnect();
    const user = await User.findById(userId).lean();
    if (!user || user.status !== 'approved') {
      return NextResponse.json({ error: 'Account pending approval' }, { status: 403 });
    }

    // Query messages. If 'to' parameter is specified, filter by receiver number
    const query = to ? { to } : {};
    const messages = await Sms.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    console.log(`[API SMS GET Success] Found ${messages.length} messages.`);
    return NextResponse.json({
      success: true,
      messages: messages || [],
    }, { status: 200 });

  } catch (error) {
    console.error('[API SMS Retrieval Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Individual SMS deletion (optional helper for tidiness)
export async function DELETE(req) {
  try {
    const userId = getUserFromRequest(req);
    console.log(`[API SMS DELETE Hit] Session auth check. userId: ${userId || 'null'}`);
    if (!userId) {
      console.warn('[API SMS DELETE Unauthorized] No active session cookie found.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      console.warn('[API SMS DELETE Bad Request] Missing message ID parameter.');
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    console.log(`[API SMS DELETING] messageId: ${id}`);
    await dbConnect();
    const user = await User.findById(userId).lean();
    if (!user || user.status !== 'approved') {
      return NextResponse.json({ error: 'Account pending approval' }, { status: 403 });
    }
    const deleted = await Sms.findByIdAndDelete(id);
    
    if (deleted) {
      console.log(`[API SMS DELETE Success] Successfully deleted message: ${id}`);
    } else {
      console.warn(`[API SMS DELETE Warning] Message not found for deletion: ${id}`);
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('[API SMS Deletion Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

