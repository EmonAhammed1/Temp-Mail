/**
 * Test Webhook Simulation Script
 * 
 * Run this script locally to simulate an email arriving from Cloudflare.
 * Usage:
 *   1. Make sure your local Next.js server is running (npm run dev).
 *   2. Ensure you have a .env.local file with:
 *      MONGODB_URI=your_mongodb_connection_string
 *      WEBHOOK_TOKEN=your_secret_token
 *   3. Run: node test-webhook.js
 */

const fs = require('fs');
const path = require('path');

// Basic parser for .env.local to load keys
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.warn('.env.local not found. Using default/empty environment values.');
    return {};
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/(^"|"$)/g, ''); // strip quotes
    env[key] = value;
  });
  return env;
}

async function runTest() {
  const env = loadEnv();
  const token = env.WEBHOOK_TOKEN || 'test_token_123';
  const localEmail = env.NEXT_PUBLIC_DOMAIN ? `john.doe@${env.NEXT_PUBLIC_DOMAIN}` : 'john.doe@lumina-mail.my';

  // Read destination email from local storage or set default
  const toAddress = process.argv[2] || localEmail;

  console.log(`Simulating incoming email to: ${toAddress}`);

  const payload = {
    to: toAddress,
    from: 'Sender Person <sender@example.com>',
    subject: 'Welcome to your premium Temp Mail! 🎉',
    bodyHtml: `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
        <h2 style="color: #8b5cf6;">Congratulations!</h2>
        <p>Your temporary email system is working perfectly.</p>
        <p>This email was parsed by your Cloudflare Worker simulation and sent to your Next.js webhook on localhost.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <span style="color: #71717a; font-size: 0.8rem;">Sent via Lumina Mail webhook simulator.</span>
      </div>
    `,
    bodyText: 'Congratulations! Your temporary email system is working perfectly. This email was parsed by your Cloudflare Worker simulation.',
  };

  try {
    const response = await fetch('http://localhost:3000/api/incoming', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (response.ok) {
      console.log('Success! Webhook responded with:', result);
      console.log(`Check your local dashboard (http://localhost:3000) for inbox address: ${toAddress}`);
    } else {
      console.error(`Error (${response.status}):`, result);
    }
  } catch (err) {
    console.error('Fetch request failed. Make sure Next.js is running (npm run dev):', err.message);
  }
}

runTest();
