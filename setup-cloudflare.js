/**
 * Cloudflare Email Routing Setup Automation Script
 * 
 * This script uses your local authenticated Wrangler session to automatically:
 *   1. Resolve the Zone ID for your domain 'emonahammed.shop'.
 *   2. Check if Email Routing is enabled for the domain.
 *   3. Create/Update the Catch-All Email Routing rule to route to 'temp-mail-router'.
 */

const fs = require('fs');
const path = require('path');

const DOMAIN = 'emonahammed.shop';
const WORKER_NAME = 'temp-mail-router';

// Helper to extract wrangler oauth token
function getWranglerToken() {
  const defaultPath = path.join(
    process.env.APPDATA || (process.platform === 'darwin' ? `${process.env.HOME}/Library/Application Support` : `${process.env.HOME}/.config`),
    'xdg.config',
    '.wrangler',
    'config',
    'default.toml'
  );

  if (!fs.existsSync(defaultPath)) {
    throw new Error(`Wrangler default.toml not found at: ${defaultPath}. Please run: npx wrangler login`);
  }

  const content = fs.readFileSync(defaultPath, 'utf-8');
  const match = content.match(/oauth_token\s*=\s*"([^"]+)"/);
  if (!match) {
    throw new Error('Could not parse oauth_token from wrangler default.toml');
  }

  return match[1];
}

async function runSetup() {
  try {
    console.log('Reading local Wrangler configuration...');
    const token = getWranglerToken();
    console.log('Wrangler token successfully retrieved.');

    // 1. Fetch Zone ID for the domain
    console.log(`Fetching Zone ID for ${DOMAIN}...`);
    const zonesRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const zonesData = await zonesRes.json();
    if (!zonesData.success || zonesData.result.length === 0) {
      throw new Error(`Failed to find Cloudflare Zone for domain ${DOMAIN}. Ensure the domain is added to this Cloudflare account.`);
    }

    const zoneId = zonesData.result[0].id;
    console.log(`Found Zone ID: ${zoneId}`);

    // 2. Check if Email Routing is active
    console.log('Checking Email Routing status...');
    const routingRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const routingData = await routingRes.json();
    if (routingData.success) {
      const status = routingData.result;
      console.log(`Email Routing status: Enabled=${status.enabled}, Status=${status.status}`);
      if (!status.enabled) {
        console.log('Attempting to enable Email Routing on this zone...');
        const enableRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/enable`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        const enableData = await enableRes.json();
        if (enableData.success) {
          console.log('Email Routing has been successfully enabled.');
        } else {
          console.warn('Note: Could not automatically enable Email Routing. You may need to activate it in the Cloudflare dashboard manually and verify MX records.');
        }
      }
    }

    // 3. Configure the Catch-All rule
    console.log(`Configuring Catch-All Email Routing rule to route to Worker: ${WORKER_NAME}...`);
    const payload = {
      name: 'Catch-All to Temp Mail Worker',
      enabled: true,
      matcher: {
        type: 'all'
      },
      actions: [
        {
          type: 'worker',
          value: [WORKER_NAME]
        }
      ]
    };

    const updateRuleRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules/catch_all`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const updateRuleData = await updateRuleRes.json();
    if (updateRuleData.success) {
      console.log('Success! Catch-All Email Routing rule has been set up successfully.');
      console.log(`All unmatched emails sent to @${DOMAIN} will now route to worker '${WORKER_NAME}'.`);
    } else {
      console.error('Failed to configure Catch-All rule:', updateRuleData.errors);
      throw new Error('API update failed.');
    }

  } catch (error) {
    console.error('Error during Cloudflare configuration:', error.message);
    process.exit(1);
  }
}

runSetup();
