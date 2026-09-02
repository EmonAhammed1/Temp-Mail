import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import dbConnect from '@/lib/db';
import User from '@/models/User';
import Setting from '@/models/Setting';
import { hashPassword, signToken } from '@/lib/auth';

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
    }

    await dbConnect();

    // Check if user already exists
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists with this email' }, { status: 400 });
    }

    // Check system auto-approval setting
    const autoApproveSetting = await Setting.findOne({ key: 'auto_approve' }).lean();
    const isAutoApprove = autoApproveSetting ? Boolean(autoApproveSetting.value) : false;
    const initialStatus = isAutoApprove ? 'approved' : 'pending';

    console.log(`[API Signup] Registering "${normalizedEmail}" with initial status: "${initialStatus}" (Auto-Approve: ${isAutoApprove})`);

    // Create user with determined status
    const hashedPassword = await hashPassword(password);
    const user = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      status: initialStatus,
    });

    // Sign session token
    const token = signToken({ userId: user._id.toString(), email: user.email });

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    console.log(`[API Signup Success] User "${user.email}" registered successfully. Status: ${user.status}`);

    return NextResponse.json({
      success: true,
      user: { id: user._id, email: user.email, status: user.status },
    }, { status: 201 });

  } catch (error) {
    console.error('[API Signup Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
