import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Inbox from '@/models/Inbox';
import Email from '@/models/Email';
import { verifyToken } from '@/lib/auth';

function verifyAdminSession(req) {
  try {
    const sessionCookie = req.cookies.get('admin_session');
    if (!sessionCookie) return false;

    const payload = verifyToken(sessionCookie.value);
    return payload && payload.role === 'admin';
  } catch (err) {
    console.error('Error verifying admin session:', err);
    return false;
  }
}

// GET /api/admin/users - Get all users
export async function GET(req) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const users = await User.find({}).sort({ createdAt: -1 }).select('-password').lean();

    return NextResponse.json({ success: true, users }, { status: 200 });

  } catch (error) {
    console.error('[API Admin Get Users Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/admin/users - Update user status
export async function PUT(req) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, status } = await req.json();

    if (!userId || !status) {
      return NextResponse.json({ error: 'Missing required fields: userId, status' }, { status: 400 });
    }

    const validStatuses = ['pending', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    await dbConnect();
    const updatedUser = await User.findByIdAndUpdate(
      userId, 
      { status }, 
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log(`[Admin API] Updated user ${updatedUser.email} status to ${status}`);

    return NextResponse.json({ success: true, user: updatedUser }, { status: 200 });

  } catch (error) {
    console.error('[API Admin Update User Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/admin/users?id=userId - Delete user and all their inboxes/emails
export async function DELETE(req) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    await dbConnect();

    // 1. Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 2. Find and delete inboxes & emails
    const inboxes = await Inbox.find({ userId });
    const addresses = inboxes.map(i => i.address);
    
    let deletedEmailsCount = 0;
    if (addresses.length > 0) {
      const emailResult = await Email.deleteMany({ to: { $in: addresses } });
      deletedEmailsCount = emailResult.deletedCount;
    }
    
    await Inbox.deleteMany({ userId });
    await User.findByIdAndDelete(userId);

    console.log(`[Admin API] Deleted user ${user.email}, ${inboxes.length} inboxes, and ${deletedEmailsCount} emails.`);

    return NextResponse.json({ 
      success: true, 
      message: 'User and all associated data deleted successfully' 
    }, { status: 200 });

  } catch (error) {
    console.error('[API Admin Delete User Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
