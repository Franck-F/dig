import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { actAs, createMentee, createMentor, createMentorship, createSkill, prisma, resetData, slotInDays } from '@/test-setup/db';
import { sendMentorshipRequest } from '@/lib/actions/mentora/requests';
import { scheduleSession } from '@/lib/actions/mentora/sessions';

// B1 end to end: notify() renders the email and posts it to Resend. The
// network is replaced by a stub that records the payload; the key is a
// dummy, so even a missed stub could not send anything.
type Sent = { to: string; subject: string; text: string };
let sent: Sent[] = [];
const realFetch = globalThis.fetch;

beforeEach(async () => {
  await resetData();
  sent = [];
  process.env.RESEND_API_KEY = 're_integration_dummy';
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).startsWith('https://api.resend.com/')) {
      sent.push(JSON.parse(String(init?.body)));
      return new Response('{"id":"stub"}', { status: 200 });
    }
    throw new Error(`unexpected network call in integration test: ${String(url)}`);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  process.env.RESEND_API_KEY = '';
});

async function namedPair(mentorTimezone = 'Europe/Paris') {
  const mentor = await createMentor();
  await prisma.mentorProfile.update({ where: { id: mentor.profile.id }, data: { timezone: mentorTimezone } });
  await prisma.user.update({ where: { id: mentor.user.id }, data: { firstName: 'Bob', lastName: 'Durand' } });
  const mentee = await createMentee();
  await prisma.user.update({ where: { id: mentee.user.id }, data: { firstName: 'Alice', lastName: 'Martin' } });
  return { mentor, mentee };
}

function assertReadable(mail: Sent) {
  assert.doesNotMatch(mail.subject + mail.text, /[{}]|REQUEST_|SESSION_|mentora\./, 'clé ou JSON brut');
}

test('B1 : email de nouvelle demande, lisible, au mentor, avec nom de la mentoré·e', async () => {
  const { mentor, mentee } = await namedPair();
  const skill = await createSkill();
  actAs(mentee.user.id);
  const res = await sendMentorshipRequest({
    toMentorId: mentor.profile.id,
    message: 'Bonjour, je voudrais progresser en data.',
    topicSkillIds: [skill.id],
  });
  assert.equal(res.status, 'success');
  assert.equal(sent.length, 1);
  const [mail] = sent;
  assertReadable(mail);
  assert.equal(mail.to, mentor.user.email);
  assert.equal(mail.subject, '[Mentorat] Nouvelle demande de mentorat');
  assert.match(mail.text, /Bonjour Bob,/);
  assert.match(mail.text, /de la part de Alice Martin/);
  assert.match(mail.text, /progresser en data/);
  assert.match(mail.text, /\/mentora\/dashboard\/requests\?tab=received/);
});

for (const tz of ['Europe/Paris', 'Europe/London']) {
  test(`B1 : email de séance planifiée à l'heure du destinataire (${tz})`, async () => {
    const { mentor, mentee } = await namedPair(tz);
    const mentorship = await createMentorship(mentor.profile.id, mentee.profile.id);
    const at = slotInDays(3);
    actAs(mentee.user.id);
    const res = await scheduleSession({ mentorshipId: mentorship.id, scheduledAtIso: at.toISOString(), durationMinutes: 45 });
    assert.equal(res.status, 'success');
    const mail = sent.find((m) => m.to === mentor.user.email);
    assert.ok(mail, 'email au mentor');
    assertReadable(mail);
    const localTime = new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(at);
    assert.match(mail.subject, new RegExp(`${localTime} \\(${tz.replace('/', '\\/')}\\)`));
    assert.match(mail.text, /\(45 min\) avec Alice Martin/);
  });
}
