import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('session');

    console.log('[Admin Impersonation] Exited user account.');

    return NextResponse.json({
      success: true,
      message: 'Exited user account impersonation',
    }, { status: 200 });

  } catch (error) {
    console.error('[API Exit Impersonate Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
