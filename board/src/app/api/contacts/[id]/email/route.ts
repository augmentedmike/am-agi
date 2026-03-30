import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { getContact, listContactEmails, createContactEmail } from '@/db/contacts';
import { getAllSettings } from '@/db/settings';
import nodemailer from 'nodemailer';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sendSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { db, sqlite } = getDb();
  const contact = getContact({ sqlite }, id);
  if (!contact) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const emails = listContactEmails({ sqlite }, id);
  return NextResponse.json(emails);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { db, sqlite } = getDb();

  const contact = getContact({ sqlite }, id);
  if (!contact) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!contact.email) return NextResponse.json({ error: 'contact has no email address' }, { status: 422 });

  const body = await req.json().catch(() => ({}));
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const settings = getAllSettings(db);
  if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass || !settings.smtp_from) {
    return NextResponse.json({ error: 'smtp not configured' }, { status: 422 });
  }

  let sendError: string | null = null;
  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: Number(settings.smtp_port) || 587,
      secure: settings.smtp_secure === 'true',
      auth: { user: settings.smtp_user, pass: settings.smtp_pass },
    });
    await transporter.sendMail({
      from: settings.smtp_from,
      to: contact.email,
      subject: parsed.data.subject,
      text: parsed.data.body,
    });
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err);
  }

  const email = createContactEmail({ sqlite }, {
    contactId: id,
    subject: parsed.data.subject,
    body: parsed.data.body,
    fromAddr: settings.smtp_from,
    toAddr: contact.email,
    error: sendError,
  });

  return NextResponse.json(email, { status: 201 });
}
