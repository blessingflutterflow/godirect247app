import { NextRequest, NextResponse } from 'next/server';

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

    const origin = request.headers.get('origin') || 'https://godirect247.co.za';

    const response = await fetch('https://payments.yoco.com/api/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInCents,
        currency: 'ZAR',
        successUrl: `${origin}/dashboard?payment=success`,
        cancelUrl: `${origin}/dashboard?payment=cancelled`,
        metadata: { tier: tier || 'unknown' },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data.message || 'Failed to create checkout' }, { status: 400 });
    }

    return NextResponse.json({ redirectUrl: data.redirectUrl, checkoutId: data.id });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
