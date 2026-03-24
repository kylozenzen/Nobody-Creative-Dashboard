const https = require('https');

// ---------------------------------------------------------------------------
// GA4 Data API proxy
// Env vars required (set in Netlify dashboard):
//   GA_CLIENT_EMAIL   — service account email
//   GA_PRIVATE_KEY    — service account private key (with literal \n)
// ---------------------------------------------------------------------------

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getAccessToken(clientEmail, privateKey) {
  const crypto = require('crypto');
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = base64url(Buffer.from(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })));
  const sigInput = `${header}.${payload}`;
  const key = privateKey.replace(/\\n/g, '\n');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(sigInput);
  const sig = base64url(sign.sign(key));
  const jwt = `${sigInput}.${sig}`;

  return new Promise((resolve, reject) => {
    const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d).access_token); } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function gaRequest(token, propertyId, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: 'analyticsdata.googleapis.com',
      path: `/v1beta/properties/${propertyId}:runReport`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const { propertyId, dateRange = '28daysAgo' } = JSON.parse(event.body || '{}');
    if (!propertyId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'propertyId required' }) };

    const clientEmail = process.env.GA_CLIENT_EMAIL;
    const privateKey = process.env.GA_PRIVATE_KEY;
    if (!clientEmail || !privateKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'GA credentials not configured' }) };
    }

    const token = await getAccessToken(clientEmail, privateKey);

    // Run 3 reports in parallel
    const [sessions, topPages, events] = await Promise.all([
      gaRequest(token, propertyId, {
        dateRanges: [{ startDate: dateRange, endDate: 'today' }],
        metrics: [
          { name: 'sessions' },
          { name: 'activeUsers' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' }
        ]
      }),
      gaRequest(token, propertyId, {
        dateRanges: [{ startDate: dateRange, endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 5
      }),
      gaRequest(token, propertyId, {
        dateRanges: [{ startDate: dateRange, endDate: 'today' }],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 5
      })
    ]);

    const metricVal = (report, idx) =>
      report.rows?.[0]?.metricValues?.[idx]?.value ?? '0';

    const rows = (report) =>
      (report.rows || []).map(r => ({
        dim: r.dimensionValues?.[0]?.value ?? '',
        val: parseInt(r.metricValues?.[0]?.value ?? '0', 10)
      }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        sessions: parseInt(metricVal(sessions, 0), 10),
        activeUsers: parseInt(metricVal(sessions, 1), 10),
        avgDuration: parseFloat(metricVal(sessions, 2)).toFixed(0),
        bounceRate: (parseFloat(metricVal(sessions, 3)) * 100).toFixed(1),
        topPages: rows(topPages),
        topEvents: rows(events),
      })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
