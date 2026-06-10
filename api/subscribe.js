// Vercel serverless function — proxies lead data to Mailchimp
// Environment variables required: MAILCHIMP_API_KEY, MAILCHIMP_AUDIENCE_ID

export default async function handler(req, res) {
  // Allow CORS from same origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { first, last, email, dept, isoClass } = req.body;

  if (!first || !last || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const API_KEY = process.env.MAILCHIMP_API_KEY;
  const AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID;
  const SERVER = API_KEY.split('-').pop(); // e.g. "us1"

  const url = `https://${SERVER}.api.mailchimp.com/3.0/lists/${AUDIENCE_ID}/members`;

  const payload = {
    email_address: email,
    status: 'subscribed',
    merge_fields: {
      FNAME: first,
      LNAME: last,
    },
    tags: [
      'iso-assessment',
      dept ? `dept:${dept}` : null,
      isoClass ? `iso-class:${isoClass}` : null,
    ].filter(Boolean),
  };

  try {
    const mcRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await mcRes.json();

    // 200 = new subscriber, 400 with "Member Exists" = already subscribed (still OK)
    if (mcRes.ok || data.title === 'Member Exists') {
      return res.status(200).json({ success: true });
    }

    console.error('[subscribe] Mailchimp error:', data);
    return res.status(500).json({ error: data.detail || 'Mailchimp error' });

  } catch (err) {
    console.error('[subscribe] Fetch error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
