const { getBookingQuote } = require('./_booking-utils');

/**
 * Netlify Function: create-payment-intent
 * Creates a Stripe PaymentIntent and returns the client secret.
 * Set STRIPE_SECRET_KEY in Netlify environment variables.
 */
exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET) {
    console.error('Missing STRIPE_SECRET_KEY environment variable');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { roomId, roomName, checkin, checkout, guests, email, firstName, lastName, lang } = body;

  // Basic validation
  if (!roomId || !checkin || !checkout || !email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required booking fields' }) };
  }

  let quote;
  try {
    quote = getBookingQuote({ roomId, checkin, checkout, guests });
  } catch (err) {
    return {
      statusCode: err.statusCode || 400,
      body: JSON.stringify({ error: err.message || 'Invalid booking request' })
    };
  }

  const safeRoomName = typeof roomName === 'string' && roomName.trim() ? roomName.trim() : quote.room.id;
  const totalCents = Math.round(quote.total * 100);
  if (totalCents < 50) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Amount too small' }) };
  }

  // Generate booking reference
  const bookingRef = 'CDR-' + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).slice(2,5).toUpperCase();

  try {
    // Call Stripe API via raw fetch (no SDK)
    const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        amount:            String(totalCents),
        currency:          'eur',
        receipt_email:     email,
        description:       `Corte delle Rose — ${safeRoomName} (${checkin} → ${checkout})`,
        'metadata[bookingRef]':   bookingRef,
        'metadata[roomId]':       roomId,
        'metadata[roomName]':     safeRoomName,
        'metadata[checkin]':      checkin,
        'metadata[checkout]':     checkout,
        'metadata[nights]':       String(quote.nights),
        'metadata[guests]':       String(quote.guests),
        'metadata[guestName]':    `${firstName} ${lastName}`,
        'metadata[guestEmail]':   email,
        'metadata[lang]':         lang || 'en'
      }).toString()
    });

    const pi = await stripeRes.json();

    if (pi.error) {
      console.error('Stripe error:', pi.error);
      return { statusCode: 402, body: JSON.stringify({ error: pi.error.message }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientSecret: pi.client_secret,
        bookingRef
      })
    };

  } catch (err) {
    console.error('Payment intent error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create payment intent' }) };
  }
};
