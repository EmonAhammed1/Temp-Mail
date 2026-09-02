import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Setting from '@/models/Setting';
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

// GET /api/admin/settings - Retrieve system settings (e.g. autoApprove)
export async function GET(req) {
  try {
    if (!verifyAdminSession(req)) {
      console.warn('[API Admin Settings GET Unauthorized] Invalid admin session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const autoApproveSetting = await Setting.findOne({ key: 'auto_approve' }).lean();
    const autoApprove = autoApproveSetting ? Boolean(autoApproveSetting.value) : false;

    console.log(`[API Admin Settings GET] auto_approve: ${autoApprove}`);
    return NextResponse.json({
      success: true,
      settings: {
        autoApprove,
      },
    }, { status: 200 });

  } catch (error) {
    console.error('[API Admin Settings GET Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/admin/settings - Update system settings (e.g. autoApprove)
export async function PUT(req) {
  try {
    if (!verifyAdminSession(req)) {
      console.warn('[API Admin Settings PUT Unauthorized] Invalid admin session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { autoApprove } = body;

    if (typeof autoApprove !== 'boolean') {
      return NextResponse.json({ error: 'autoApprove must be a boolean value' }, { status: 400 });
    }

    await dbConnect();

    const setting = await Setting.findOneAndUpdate(
      { key: 'auto_approve' },
      { value: autoApprove, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    console.log(`[API Admin Settings PUT Success] auto_approve updated to: ${setting.value}`);

    return NextResponse.json({
      success: true,
      autoApprove: Boolean(setting.value),
      message: `Auto-approval has been ${setting.value ? 'enabled' : 'disabled'}.`,
    }, { status: 200 });

  } catch (error) {
    console.error('[API Admin Settings PUT Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
