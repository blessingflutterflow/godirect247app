import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { checkoutId } = await request.json();
    if (!checkoutId) {
      return NextResponse.json({ error: 'Missing checkoutId' }, { status: 400 });
    }

    const secret = process.env.YOCO_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: 'Payment service not configured' }, { status: 500 });
    }

    const response = await fetch(`https://payments.yoco.com/api/checkouts/${checkoutId}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data.message || 'Could not verify payment' }, { status: 400 });
    }

    const paid = data.status === 'paid' || data.status === 'complete' || !!data.paymentId;
    return NextResponse.json({ paid, paymentId: data.paymentId || data.id });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
