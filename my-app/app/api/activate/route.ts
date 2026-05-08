import { NextRequest, NextResponse } from 'next/server';

function getBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const host = request.headers.get('host') || '';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  try {
    const { amountInCents, tier } = await request.json();

    if (!amountInCents) {
      return NextResponse.json({ error: 'Missing amount' }, { status: 400 });
    }

    const secret = process.env.YOCO_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: 'Payment service not configured' }, { status: 500 });
    }

    const base = getBaseUrl(request);

    const response = await fetch('https://payments.yoco.com/api/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInCents,
        currency: 'ZAR',
        successUrl: `${base}/dashboard?payment=success`,
        cancelUrl: `${base}/dashboard?payment=cancelled`,
        metadata: { tier: tier || 'unknown' },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[activate] Yoco error:', JSON.stringify(data));
      return NextResponse.json(
        { error: data.message || data.displayMessage || 'Failed to create checkout' },
        { status: 400 }
      );
    }

    return NextResponse.json({ redirectUrl: data.redirectUrl, checkoutId: data.id });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
