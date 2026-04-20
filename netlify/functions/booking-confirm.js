/**
 * Netlify Function: booking-confirm
 * Stripe webhook — fires on payment_intent.succeeded
 * Sends confirmation emails via Resend API.
 *
 * Required env vars:
 *   STRIPE_WEBHOOK_SECRET  — from Stripe dashboard
 *   RESEND_API_KEY         — from resend.com
 *   HOTEL_EMAIL            — email to notify the hotel owner
 */

const crypto = require('crypto');

function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;

  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');

  if (aBuf.length === 0 || bBuf.length === 0 || aBuf.length !== bBuf.length) return false;

  return crypto.timingSafeEqual(aBuf, bBuf);
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const RESEND_KEY     = process.env.RESEND_API_KEY;
  const HOTEL_EMAIL    = process.env.HOTEL_EMAIL || 'info@hoteldemo.com';
  const FROM_EMAIL     = process.env.FROM_EMAIL || 'bookings@hoteldemo.com';

  // ── Verify Stripe signature ───────────────────────────────
  const sig       = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  const rawBody   = event.body;

  if (!WEBHOOK_SECRET) {
    return { statusCode: 500, body: 'Missing STRIPE_WEBHOOK_SECRET' };
  }

  if (!sig) {
    return { statusCode: 400, body: 'Missing stripe-signature header' };
  }

  try {
    const parts = sig.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      if (!acc[key]) acc[key] = [];
      acc[key].push(value);
      return acc;
    }, {});
    const timestamp = parts.t && parts.t[0];
    const signatures = parts.v1 || [];

    if (!timestamp || signatures.length === 0) {
      return { statusCode: 400, body: 'Invalid signature header' };
    }

    const expected = crypto.createHmac('sha256', WEBHOOK_SECRET)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const isValid = signatures.some((value) => safeEqualHex(expected, value));
    if (!isValid) {
      return { statusCode: 400, body: 'Invalid signature' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
      return { statusCode: 400, body: 'Request too old' };
    }
  } catch (e) {
    return { statusCode: 400, body: 'Signature verification failed' };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  if (stripeEvent.type !== 'payment_intent.succeeded') {
    return { statusCode: 200, body: 'Event type ignored' };
  }

  const pi  = stripeEvent.data.object;
  const m   = pi.metadata || {};
  const ref = m.bookingRef   || 'CDR-UNKNOWN';
  const guestName  = m.guestName  || 'Guest';
  const guestEmail = m.guestEmail || pi.receipt_email;
  const roomName   = m.roomName   || 'Room';
  const checkin    = m.checkin    || '—';
  const checkout   = m.checkout   || '—';
  const nights     = m.nights     || '—';
  const guests     = m.guests     || '—';
  const totalEur   = (pi.amount / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

  if (!RESEND_KEY) {
    console.warn('No RESEND_API_KEY set. Skipping email send.');
    return { statusCode: 200, body: 'OK (no email sent)' };
  }

  const guestHtml = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F1E8;font-family:'Georgia',serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:4px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07)">
    <div style="background:#2D3B2C;padding:40px 40px 32px;text-align:center">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C9846E">BOOKING CONFIRMED</p>
      <h1 style="margin:0;font-size:28px;font-weight:300;font-style:italic;color:#F7F1E8">Hotel Boutique</h1>
    </div>
    <div style="background:#C9846E;height:4px"></div>
    <div style="padding:40px">
      <p style="font-size:16px;color:#4A5240;line-height:1.7">Dear ${guestName},</p>
      <p style="color:#4A5240;line-height:1.7">Your reservation has been confirmed. We look forward to welcoming you to Hotel Boutique.</p>
      <div style="background:#F7F1E8;border-radius:4px;padding:24px;margin:28px 0">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#9A9186;letter-spacing:1px;font-size:11px;text-transform:uppercase">Booking Ref</td><td style="padding:8px 0;color:#1C1E19;font-weight:bold;text-align:right">${ref}</td></tr>
          <tr><td style="padding:8px 0;color:#9A9186;letter-spacing:1px;font-size:11px;text-transform:uppercase;border-top:1px solid #EDE4D4">Room</td><td style="padding:8px 0;color:#1C1E19;text-align:right;border-top:1px solid #EDE4D4">${roomName}</td></tr>
          <tr><td style="padding:8px 0;color:#9A9186;letter-spacing:1px;font-size:11px;text-transform:uppercase;border-top:1px solid #EDE4D4">Check-in</td><td style="padding:8px 0;color:#1C1E19;text-align:right;border-top:1px solid #EDE4D4">${checkin} from 15:00</td></tr>
          <tr><td style="padding:8px 0;color:#9A9186;letter-spacing:1px;font-size:11px;text-transform:uppercase;border-top:1px solid #EDE4D4">Check-out</td><td style="padding:8px 0;color:#1C1E19;text-align:right;border-top:1px solid #EDE4D4">${checkout} by 11:00</td></tr>
          <tr><td style="padding:8px 0;color:#9A9186;letter-spacing:1px;font-size:11px;text-transform:uppercase;border-top:1px solid #EDE4D4">Nights / Guests</td><td style="padding:8px 0;color:#1C1E19;text-align:right;border-top:1px solid #EDE4D4">${nights} nights · ${guests} guest(s)</td></tr>
          <tr style="background:#2D3B2C"><td style="padding:14px;color:#C9846E;letter-spacing:1px;font-size:11px;text-transform:uppercase;border-radius:2px 0 0 2px">Total Paid</td><td style="padding:14px;color:#F7F1E8;font-size:20px;font-style:italic;text-align:right;border-radius:0 2px 2px 0">${totalEur}</td></tr>
        </table>
      </div>
      <p style="color:#9A9186;font-size:13px;line-height:1.8">Via delle Rose 12, 25030 Castrezzato (BS), Lombardia<br>+39 030 123 4567 · info@hoteldemo.com</p>
      <p style="font-family:'Georgia',serif;font-style:italic;color:#C9846E;font-size:18px;margin-top:32px">Ci vediamo presto — see you soon.</p>
    </div>
  </div>
</body>
</html>`;

  const hotelHtml = `
<h2>New Booking — ${ref}</h2>
<p><strong>Guest:</strong> ${guestName} (${guestEmail})</p>
<p><strong>Room:</strong> ${roomName}</p>
<p><strong>Check-in:</strong> ${checkin}</p>
<p><strong>Check-out:</strong> ${checkout}</p>
<p><strong>Nights:</strong> ${nights} · <strong>Guests:</strong> ${guests}</p>
<p><strong>Total:</strong> ${totalEur}</p>`;

  const emails = [
    { to: guestEmail, subject: `Booking confirmed — ${ref} — Hotel Boutique`, html: guestHtml },
    { to: HOTEL_EMAIL, subject: `New booking ${ref}: ${guestName} · ${roomName} · ${checkin}`, html: hotelHtml }
  ];

  const results = await Promise.allSettled(emails.map(mail =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `Hotel Boutique <${FROM_EMAIL}>`,
        to:   mail.to,
        subject: mail.subject,
        html:    mail.html
      })
    }).then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`Resend ${response.status}: ${JSON.stringify(payload)}`);
      }
      return payload;
    })
  ));

  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`Email ${i} failed:`, r.reason);
    else console.log(`Email ${i} sent:`, r.value);
  });

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
