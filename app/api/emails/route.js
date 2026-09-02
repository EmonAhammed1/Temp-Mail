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

    console.log(`[API GET Emails] Found ${emails.length} emails for "${cleanAddress}"`);

    return NextResponse.json({ success: true, emails }, { status: 200 });
  } catch (error) {
    console.error('[API GET Emails ERROR]:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

// DELETE /api/emails - Single (?id=...) or Bulk deletion (body: { ids: [...] } or ?ids=id1,id2)
export async function DELETE(req) {
  try {
    const userId = getUserFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findById(userId).lean();
    if (!user || user.status !== 'approved') {
      return NextResponse.json({ error: 'Account pending approval' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    let idsToDelete = [];

    const singleId = searchParams.get('id');
    const queryIds = searchParams.get('ids');

    if (singleId) {
      idsToDelete = [singleId];
    } else if (queryIds) {
      idsToDelete = queryIds.split(',').map((id) => id.trim()).filter(Boolean);
    } else {
      // Try to read json body if available
      try {
        const body = await req.json();
        if (Array.isArray(body?.ids)) {
          idsToDelete = body.ids;
        } else if (body?.id) {
          idsToDelete = [body.id];
        }
      } catch (e) {
        // No body provided
      }
    }

    if (!idsToDelete || idsToDelete.length === 0) {
      return NextResponse.json({ error: 'At least one Email ID is required for deletion' }, { status: 400 });
    }

    // Find all target emails
    const targetEmails = await Email.find({ _id: { $in: idsToDelete } }).lean();
    if (!targetEmails || targetEmails.length === 0) {
      return NextResponse.json({ error: 'No matching emails found to delete' }, { status: 404 });
    }

    // Find unique recipient addresses
    const targetAddresses = [...new Set(targetEmails.map((em) => em.to))];

    // Verify user owns all target inboxes
    const userInboxes = await Inbox.find({
      userId,
      address: { $in: targetAddresses },
    }).lean();

    const ownedAddresses = new Set(userInboxes.map((ib) => ib.address));
    const authorizedEmailIds = targetEmails
      .filter((em) => ownedAddresses.has(em.to))
      .map((em) => em._id);

    if (authorizedEmailIds.length === 0) {
      return NextResponse.json({ error: 'Unauthorized access to these emails' }, { status: 403 });
    }

    // Execute deletion
    const result = await Email.deleteMany({ _id: { $in: authorizedEmailIds } });

    console.log(`[API DELETE Emails Success] Deleted ${result.deletedCount} emails.`);

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      deletedIds: authorizedEmailIds,
      message: `${result.deletedCount} email(s) deleted successfully`,
    }, { status: 200 });

  } catch (error) {
    console.error('[API DELETE Emails ERROR]:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

// PATCH /api/emails - Mark single or multiple emails as Read / Unread
export async function PATCH(req) {
  try {
    const userId = getUserFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findById(userId).lean();
    if (!user || user.status !== 'approved') {
      return NextResponse.json({ error: 'Account pending approval' }, { status: 403 });
    }

    const body = await req.json();
    const { id, ids, isRead } = body;

    const targetIds = Array.isArray(ids) ? ids : (id ? [id] : []);
    const readStatus = typeof isRead === 'boolean' ? isRead : true;

    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'Email ID(s) required' }, { status: 400 });
    }

    // Verify user owns the inbox of these emails
    const targetEmails = await Email.find({ _id: { $in: targetIds } }).lean();
    if (!targetEmails || targetEmails.length === 0) {
      return NextResponse.json({ error: 'No matching emails found' }, { status: 404 });
    }

    const targetAddresses = [...new Set(targetEmails.map((em) => em.to))];
    const userInboxes = await Inbox.find({
      userId,
      address: { $in: targetAddresses },
    }).lean();

    const ownedAddresses = new Set(userInboxes.map((ib) => ib.address));
    const authorizedEmailIds = targetEmails
      .filter((em) => ownedAddresses.has(em.to))
      .map((em) => em._id);

    if (authorizedEmailIds.length === 0) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    // Update read status
    await Email.updateMany(
      { _id: { $in: authorizedEmailIds } },
      { $set: { isRead: readStatus } }
    );

    console.log(`[API PATCH Emails] Updated isRead=${readStatus} for ${authorizedEmailIds.length} emails`);

    return NextResponse.json({
      success: true,
      updatedCount: authorizedEmailIds.length,
      isRead: readStatus,
      updatedIds: authorizedEmailIds,
    }, { status: 200 });

  } catch (error) {
    console.error('[API PATCH Emails ERROR]:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
