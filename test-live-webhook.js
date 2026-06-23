/**
 * Test Live Webhook Diagnostic Script
 * 
 * This script POSTs directly to the live Vercel API to test if the API and DB connection are working.
 */

async function testLive() {
  const url = "https://temp-mail-system-six.vercel.app/api/incoming";
  const token = "tmp_webhook_7c3aed9b2f15a9";
  const toAddress = "info@emonahammed.shop";

  console.log(`Sending diagnostic webhook POST to: ${url}`);
  console.log(`Target temporary email address: ${toAddress}`);

  const payload = {
    to: toAddress,
    from: "Diagnostic Test <diagnostic@example.com>",
    subject: "Diagnostic Live Webhook Test 🛠️",
    bodyHtml: "<p>This is a diagnostic test to verify the live Vercel API and MongoDB database connection.</p>",
    bodyText: "This is a diagnostic test to verify the live Vercel API and MongoDB database connection."
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const status = res.status;
    const data = await res.json();

    console.log(`\n--- Response from Live Vercel API ---`);
    console.log(`HTTP Status: ${status}`);
    console.log(`Payload:`, JSON.stringify(data, null, 2));

  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

testLive();
