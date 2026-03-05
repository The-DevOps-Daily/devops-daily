import { NextRequest, NextResponse } from 'next/server';
import { BREVO_FORM_URL } from '@/lib/newsletter';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }

    const body = new URLSearchParams({
      EMAIL: email.trim(),
      email_address_check: '',
      locale: 'en',
    });

    const brevoRes = await fetch(BREVO_FORM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'follow',
    });

    if (!brevoRes.ok) {
      console.error('[newsletter] Brevo returned', brevoRes.status);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[newsletter] Subscription error:', err);
    return NextResponse.json({ error: 'Failed to subscribe. Please try again.' }, { status: 500 });
  }
}
