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

async function debugRules() {
  try {
    const token = getWranglerToken();
    
    // 1. Fetch Zone ID
    const zonesRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const zonesData = await zonesRes.json();
    const zoneId = zonesData.result[0].id;

    // 2. Fetch All Email Routing Rules
    console.log(`Fetching all Email Routing rules for zone: ${zoneId}...`);
    const rulesRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const rulesData = await rulesRes.json();
    
    console.log('\n--- All Email Routing Rules ---');
    if (rulesData.success) {
      rulesData.result.forEach((rule, index) => {
        console.log(`\nRule #${index + 1}: "${rule.name}"`);
        console.log(`  Enabled: ${rule.enabled}`);
        console.log(`  Matchers:`, JSON.stringify(rule.matchers));
        console.log(`  Actions:`, JSON.stringify(rule.actions));
        console.log(`  Priority: ${rule.priority}`);
      });
    } else {
      console.log('Failed to fetch rules:', rulesData.errors);
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

debugRules();
