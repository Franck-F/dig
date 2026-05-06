'use server';

import { z } from 'zod';
import { ContactSubject } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type ContactState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; error: string };

const schema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email().max(200),
  subject: z.nativeEnum(ContactSubject),
  message: z.string().min(10).max(4000),
  consent: z.literal('on'),
});

export async function submitContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
  const parsed = schema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    subject: formData.get('subject'),
    message: formData.get('message'),
    consent: formData.get('consent'),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { status: 'error', error: issue?.message ?? 'Formulaire invalide' };
  }

  const { firstName, lastName, email, subject, message } = parsed.data;

  try {
    await prisma.contactMessage.create({
      data: { firstName, lastName, email, subject, message },
    });
  } catch {
    return { status: 'error', error: "Erreur d'enregistrement. Réessayez plus tard." };
  }

  // Optional: forward to Resend if configured. DB write is the source of truth —
  // a Resend failure must NOT fail the user submission.
  if (process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Digizelle <noreply@digizelle.fr>',
          to: process.env.CONTACT_TO_EMAIL,
          replyTo: email,
          subject: `[${subject}] ${firstName} ${lastName}`,
          text: `De: ${firstName} ${lastName} <${email}>\nSujet: ${subject}\n\n${message}`,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.error('[contact] Resend non-OK response', res.status, detail);
      }
    } catch (err) {
      console.error('[contact] Resend request failed', err);
    }
  }

  return { status: 'success' };
}
