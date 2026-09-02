import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import SentEmail from '@/models/SentEmail';

// 1x1 Transparent GIF Base64
const TRANSPARENT_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// GET /api/emails/track?id=<trackingId> - Open tracking pixel
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const trackingId = searchParams.get('id');

    if (trackingId) {
      await dbConnect();
      const sentEmail = await SentEmail.findOne({ trackingId });
      if (sentEmail) {
        sentEmail.isOpened = true;
        if (!sentEmail.openedAt) {
          sentEmail.openedAt = new Date();
        }
        sentEmail.openCount = (sentEmail.openCount || 0) + 1;
        sentEmail.status = 'opened';
        await sentEmail.save();
        console.log(`[Email Open Tracked] Email ${sentEmail._id} to ${sentEmail.to} was opened! (Total opens: ${sentEmail.openCount})`);
      }
    }
  } catch (err) {
    console.error('[Open Tracking Error]:', err);
  }

  // Always return transparent 1x1 GIF
  return new Response(TRANSPARENT_PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': TRANSPARENT_PIXEL.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
