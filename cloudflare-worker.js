/**
 * Cloudflare Worker for Temporary Email Routing
 * 
 * Instructions:
 * 1. Create a new Cloudflare Worker in your Cloudflare dashboard.
 * 2. Copy and paste this code into the Worker editor.
 * 3. Set the following environment variables (Settings -> Variables):
 *    - VERCEL_API_URL: Your Vercel app domain (e.g., https://your-app.vercel.app)
 *    - WEBHOOK_TOKEN: A secure random string (must match the WEBHOOK_TOKEN in Vercel's env variables)
 * 4. Go to your Domain -> Email -> Email Routing -> Routes -> Add Catch-All.
 * 5. Route the catch-all destination to this Worker.
 */

import PostalMime from 'postal-mime';

export default {
  async email(message, env, ctx) {
    try {
      // 1. Convert the raw email message stream to an ArrayBuffer
      const rawEmail = await new Response(message.raw).arrayBuffer();
      
      // 2. Parse the raw email body (MIME) using postal-mime
      const parser = new PostalMime();
      const parsed = await parser.parse(rawEmail);
      
      // 3. Prepare payload for the Next.js API
      const payload = {
        to: message.to,
        from: message.from,
        subject: parsed.subject || '(No Subject)',
        bodyHtml: parsed.html || '',
        bodyText: parsed.text || '',
      };
      
      // 4. Send the parsed email payload to the Next.js backend on Vercel
      const apiUrl = `${env.VERCEL_API_URL.replace(/\/$/, '')}/api/incoming`;
      
      console.log(`Forwarding email to Vercel endpoint: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.WEBHOOK_TOKEN}`
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Vercel Webhook returned error (${response.status}): ${errorText}`);
        throw new Error(`Webhook failed: ${response.statusText}`);
      }
      
      console.log(`Successfully forwarded email for ${message.to} to Vercel.`);
      
    } catch (error) {
      console.error(`Error in Email Worker routing: ${error.message}`);
      // Cloudflare will retry or fail if an error is thrown. 
      // If we don't want to throw, we can log it here.
      throw error;
    }
  }
};
