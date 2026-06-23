import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('admin_session');
    
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully from Admin Panel',
    }, { status: 200 });

  } catch (error) {
    console.error('[API Admin Logout Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
