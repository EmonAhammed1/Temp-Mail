import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import { verifyToken, signToken } from '@/lib/auth';

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

export async function POST(req) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    await dbConnect();

    // Verify the target user exists
    const user = await User.findById(userId).lean();
    if (!user) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    // Sign session token for target user
    const token = signToken({ userId: user._id.toString(), email: user.email });

    // Set user session cookie
    const cookieStore = await cookies();
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1 * 60 * 60, // Impersonation session: 1 hour max
      path: '/',
    });

    console.log(`[Admin Impersonation] Admin logged into account: ${user.email}`);

    return NextResponse.json({
      success: true,
      message: `Impersonating user ${user.email}`,
    }, { status: 200 });

  } catch (error) {
    console.error('[API Admin Impersonate Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
