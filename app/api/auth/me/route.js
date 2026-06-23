import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req) {
  try {
    const userId = getUserFromRequest(req);
    if (!userId) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findById(userId).select('-password').lean();

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 404 });
    }

    const hasAdminSession = !!req.cookies.get('admin_session');

    return NextResponse.json({
      authenticated: true,
      user: { id: user._id, email: user.email, status: user.status || 'pending' },
      isImpersonated: hasAdminSession,
    }, { status: 200 });

  } catch (error) {
    console.error('[API Auth Me Error]:', error);
    return NextResponse.json({ authenticated: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
