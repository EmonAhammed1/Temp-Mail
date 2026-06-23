const fs = require('fs');
const path = require('path');

const DOMAIN = 'emonahammed.shop';

function getWranglerToken() {
  const defaultPath = path.join(
    process.env.APPDATA || (process.platform === 'darwin' ? `${process.env.HOME}/Library/Application Support` : `${process.env.HOME}/.config`),
    'xdg.config',
    '.wrangler',
    'config',
    'default.toml'
  );

  if (!fs.existsSync(defaultPath)) {
    throw new Error('Wrangler default.toml not found');
  }

  const content = fs.readFileSync(defaultPath, 'utf-8');
  const match = content.match(/oauth_token\s*=\s*"([^"]+)"/);
  return match[1];
}

async function debugCloudflare() {
  try {
    const token = getWranglerToken();
    
    // 1. Fetch Zone ID
    const zonesRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const zonesData = await zonesRes.json();
    const zoneId = zonesData.result[0].id;
    console.log(`Zone ID: ${zoneId}`);

    // 2. Fetch Email Routing Settings
    const routingRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const routingData = await routingRes.json();
    console.log('\n--- Email Routing Settings ---');
    console.log(JSON.stringify(routingData.result, null, 2));

    // 3. Fetch Catch-All Rule
    const ruleRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules/catch_all`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const ruleData = await ruleRes.json();
    console.log('\n--- Catch-All Rule Settings ---');
    console.log(JSON.stringify(ruleData.result, null, 2));

    // 4. Fetch DNS MX Records
    console.log('\nChecking MX Records on Cloudflare DNS...');
    const dnsRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=MX`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dnsData = await dnsRes.json();
    console.log('\n--- MX Records found ---');
    dnsData.result.forEach(rec => {
      console.log(`${rec.name} | MX | Priority: ${rec.priority} | Content: ${rec.content}`);
    });

  } catch (err) {
    console.error('Error debugging Cloudflare:', err.message);
  }
}

debugCloudflare();
