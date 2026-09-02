import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SentEmail from '@/models/SentEmail';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/emails/sent - Fetch sent emails history and analytics
export async function GET(req) {
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
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const query = { userId };
    if (status && status !== 'all') {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { to: { $regex: search, $options: 'i' } },
        { from: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
      ];
    }

    const sentEmails = await SentEmail.find(query).sort({ createdAt: -1 }).lean();

    // Calculate live analytics stats for all emails of this user
    const allUserSent = await SentEmail.find({ userId }).lean();
    const stats = {
      total: allUserSent.length,
      delivered: allUserSent.filter((e) => e.status === 'delivered' || e.status === 'sent').length,
      opened: allUserSent.filter((e) => e.isOpened || e.status === 'opened').length,
      failed: allUserSent.filter((e) => e.status === 'failed').length,
    };

    return NextResponse.json({
      success: true,
      sentEmails,
      stats,
    }, { status: 200 });

  } catch (error) {
    console.error('[API Sent Emails GET Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/emails/sent - Delete sent email records
export async function DELETE(req) {
  try {
    const userId = getUserFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    await dbConnect();

    if (id) {
      const deleted = await SentEmail.findOneAndDelete({ _id: id, userId });
      if (!deleted) {
        return NextResponse.json({ error: 'Record not found or unauthorized' }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'Sent email record deleted' }, { status: 200 });
    }

    // Bulk delete if JSON body contains ids
    const body = await req.json().catch(() => ({}));
    if (body.ids && Array.isArray(body.ids)) {
      const result = await SentEmail.deleteMany({ _id: { $in: body.ids }, userId });
      return NextResponse.json({
        success: true,
        deletedCount: result.deletedCount,
        message: `${result.deletedCount} sent email(s) deleted`,
      }, { status: 200 });
    }

    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });

  } catch (error) {
    console.error('[API Sent Emails DELETE Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
