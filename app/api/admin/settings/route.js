import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import dbConnect from '@/lib/db';
import Setting from '@/models/Setting';
import { verifyToken } from '@/lib/auth';
import { getEffectiveSmtpConfig } from '@/lib/email-sender';

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

// GET /api/admin/settings - Retrieve system settings (autoApprove, smtpConfig)
export async function GET(req) {
  try {
    if (!verifyAdminSession(req)) {
      console.warn('[API Admin Settings GET Unauthorized] Invalid admin session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const autoApproveSetting = await Setting.findOne({ key: 'auto_approve' }).lean();
    const autoApprove = autoApproveSetting ? Boolean(autoApproveSetting.value) : false;

    const smtpSetting = await Setting.findOne({ key: 'smtp_config' }).lean();
    const smtpConfig = smtpSetting && smtpSetting.value ? {
      host: smtpSetting.value.host || '',
      port: smtpSetting.value.port || 587,
      user: smtpSetting.value.user || '',
      pass: smtpSetting.value.pass ? '••••••••' : '',
      secure: Boolean(smtpSetting.value.secure),
      isConfigured: !!(smtpSetting.value.host && smtpSetting.value.user && smtpSetting.value.pass),
    } : {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS ? '••••••••' : '',
      secure: false,
      isConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    };

    return NextResponse.json({
      success: true,
      settings: {
        autoApprove,
        smtpConfig,
      },
    }, { status: 200 });

  } catch (error) {
    console.error('[API Admin Settings GET Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/admin/settings - Update system settings (autoApprove or smtpConfig)
export async function PUT(req) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { autoApprove, smtpConfig } = body;

    await dbConnect();

    // 1. Update autoApprove if provided
    if (typeof autoApprove === 'boolean') {
      await Setting.findOneAndUpdate(
        { key: 'auto_approve' },
        { value: autoApprove, updatedAt: new Date() },
        { upsert: true, new: true }
      );
    }

    // 2. Update smtpConfig if provided
    if (smtpConfig && typeof smtpConfig === 'object') {
      const existing = await Setting.findOne({ key: 'smtp_config' }).lean();
      const currentPass = existing?.value?.pass || '';

      const updatedSmtp = {
        host: (smtpConfig.host || '').trim(),
        port: parseInt(smtpConfig.port || '587', 10),
        user: (smtpConfig.user || '').trim(),
        pass: (smtpConfig.pass && smtpConfig.pass !== '••••••••') ? smtpConfig.pass.trim() : currentPass,
        secure: Boolean(smtpConfig.secure || parseInt(smtpConfig.port || '587', 10) === 465),
      };

      await Setting.findOneAndUpdate(
        { key: 'smtp_config' },
        { value: updatedSmtp, updatedAt: new Date() },
        { upsert: true, new: true }
      );
      console.log(`[API Admin Settings] SMTP Config updated: ${updatedSmtp.host}:${updatedSmtp.port} (user: ${updatedSmtp.user})`);
    }

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully!',
    }, { status: 200 });

  } catch (error) {
    console.error('[API Admin Settings PUT Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/admin/settings - Test SMTP connection
export async function POST(req) {
  try {
    if (!verifyAdminSession(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { testEmail, smtpConfig } = body;

    const recipient = (testEmail || '').trim();
    if (!recipient) {
      return NextResponse.json({ error: 'Test recipient email is required' }, { status: 400 });
    }

    // Determine SMTP configuration to test
    let host = smtpConfig?.host;
    let port = parseInt(smtpConfig?.port || '587', 10);
    let user = smtpConfig?.user;
    let pass = smtpConfig?.pass;
    let secure = smtpConfig?.secure || port === 465;

    // If password was placeholder, read real pass from DB
    if (!pass || pass === '••••••••') {
      const effective = await getEffectiveSmtpConfig();
      if (effective) {
        host = host || effective.host;
        port = port || effective.port;
        user = user || effective.user;
        pass = effective.pass;
        secure = effective.secure;
      }
    }

    if (!host || !user || !pass) {
      return NextResponse.json({ error: 'Please provide complete SMTP host, user, and password' }, { status: 400 });
    }

    console.log(`[Admin Test SMTP] Connecting to ${host}:${port} with user ${user}...`);

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });

    // Verify connection first
    await transporter.verify();

    // Send test email
    await transporter.sendMail({
      from: `"Emons Temp Mail Test" <${user}>`,
      to: recipient,
      subject: '✅ SMTP Configuration Test Successful!',
      text: 'Congratulations! Your SMTP Mail Server configuration is working perfectly. Outbound emails will now be delivered live to external addresses.',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #9333ea;">🎉 SMTP Connection Successful!</h2>
          <p>Your SMTP mail configuration on <strong>Emons Temp Mail</strong> is working properly.</p>
          <p>Host: <code>${host}:${port}</code><br/>User: <code>${user}</code></p>
          <hr style="border: 0; border-top: 1px solid #eee;" />
          <span style="font-size: 12px; color: #888;">Test dispatched on ${new Date().toLocaleString()}</span>
        </div>
      `,
    });

    console.log(`[Admin Test SMTP Success] Test email dispatched to ${recipient}`);

    return NextResponse.json({
      success: true,
      message: `Test email sent successfully to ${recipient}! Check your inbox.`,
    }, { status: 200 });

  } catch (err) {
    console.error('[Admin Test SMTP Failed]:', err);
    return NextResponse.json({
      error: `SMTP Test Failed: ${err.message}`,
    }, { status: 500 });
  }
}
