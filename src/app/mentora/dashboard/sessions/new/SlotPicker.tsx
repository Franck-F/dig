'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { scheduleSession } from '@/lib/actions/mentora/sessions';

type Slot = { startsAt: string; endsAt: string };

/**
 * Slot picker — renders the server-fetched availability windows as
 * clickable buttons. When the mentor has no availability rules set, the
 * mentor side gets a direct datetime picker (so they can propose any slot
 * manually) — the mentee side sees a message + link to ask the mentor to
 * set availability.
 *
 * The duration selector lives here rather than in the parent so the user can
 * iterate without losing the selected mentorship.
 */
export default function SlotPicker({
  mentorshipId,
  durationMinutes,
  slots,
  iAmMentor,
}: {
  mentorshipId: string;
  durationMinutes: number;
  slots: Slot[];
  iAmMentor: boolean;
}) {
  const t = useTranslations('mentora.sessions.new');
  const tFormat = useTranslations('mentora.sessions.formatLabels');
  const router = useRouter();

  const [picked, setPicked] = useState<Slot | null>(null);
  const [manualDateTime, setManualDateTime] = useState<string>('');
  const [agenda, setAgenda] = useState('');
  const [format, setFormat] = useState<'REMOTE_VIDEO' | 'IN_PERSON' | 'PHONE'>('REMOTE_VIDEO');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [location, setLocation] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function changeDuration(d: number) {
    router.push(
      `/mentora/dashboard/sessions/new?mentorshipId=${mentorshipId}&duration=${d}`,
    );
  }

  function handleSubmit() {
    if (!picked) return;
    setError(null);
    startTransition(async () => {
      try {
        await scheduleSession({
          mentorshipId,
          scheduledAtIso: picked.startsAt,
          durationMinutes,
          format,
          location: format === 'IN_PERSON' ? location || undefined : undefined,
          meetingUrl: format === 'REMOTE_VIDEO' ? meetingUrl || undefined : undefined,
          agenda: agenda || undefined,
        });
        router.push('/mentora/dashboard/sessions?tab=upcoming');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur');
      }
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Duration selector */}
      <div>
        <label className="dz-label">{t('durationLabel')}</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[30, 45, 60, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => changeDuration(d)}
              className={`dz-btn dz-btn-sm ${durationMinutes === d ? 'dz-btn-primary' : 'dz-btn-ghost'}`}
            >
              {d} min
            </button>
          ))}
        </div>
      </div>

      {/* Slots */}
      <div>
        <label className="dz-label">{t('slotsTitle')}</label>
        {slots.length === 0 ? (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: 'rgba(115,1,255,0.04)',
              border: '1px solid rgba(115,1,255,0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {iAmMentor ? (
              <>
                <p style={{ margin: 0, fontSize: 13, color: '#1a1f3a' }}>
                  Aucun créneau récurrent ouvert pour les 14 prochains jours.
                  En tant que mentor, vous pouvez proposer un créneau manuellement
                  ci-dessous, ou définir vos disponibilités récurrentes pour que
                  vos mentorées puissent réserver toutes seules.
                </p>
                <Link
                  href="/mentora/dashboard/availability"
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#7301FF',
                    textDecoration: 'none',
                  }}
                >
                  → Configurer mes disponibilités récurrentes
                </Link>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: '#1a1f3a' }}>
                {t('slotsEmpty')}
              </p>
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 8,
            }}
          >
            {slots.map((s) => {
              const active = picked?.startsAt === s.startsAt;
              return (
                <button
                  key={s.startsAt}
                  type="button"
                  onClick={() => setPicked(s)}
                  className={`dz-btn dz-btn-sm ${active ? 'dz-btn-primary' : 'dz-btn-ghost'}`}
                >
                  {fmtSlot(s.startsAt)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual datetime picker — surfaced for mentors so they can propose
          a custom slot even without recurring rules in place. Mentees only
          see this if no slots came back, as a fallback to flag a preferred
          time to the mentor (still scheduled when submitted). */}
      {iAmMentor && (
        <div>
          <label className="dz-label" htmlFor="manual-datetime">
            Ou proposer un créneau précis
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              id="manual-datetime"
              type="datetime-local"
              className="dz-input"
              value={manualDateTime}
              onChange={(e) => {
                setManualDateTime(e.target.value);
                if (e.target.value) {
                  const start = new Date(e.target.value);
                  if (!Number.isNaN(start.getTime())) {
                    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
                    setPicked({
                      startsAt: start.toISOString(),
                      endsAt: end.toISOString(),
                    });
                  }
                } else {
                  setPicked(null);
                }
              }}
              min={new Date().toISOString().slice(0, 16)}
              style={{ maxWidth: 280 }}
            />
            {manualDateTime && (
              <span style={{ fontSize: 12, color: '#7301FF', fontWeight: 600 }}>
                ✓ {fmtSlot(new Date(manualDateTime).toISOString())} ({durationMinutes} min)
              </span>
            )}
          </div>
          <p
            className="dz-small"
            style={{ marginTop: 6, fontSize: 11, color: '#8b91ad' }}
          >
            Choisissez n&apos;importe quelle date / heure dans le futur.
          </p>
        </div>
      )}

      {/* Once a slot is picked → details form */}
      {picked && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <div>
            <label className="dz-label" htmlFor="session-format">{t('formatLabel')}</label>
            <select
              id="session-format"
              className="dz-input"
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
            >
              <option value="REMOTE_VIDEO">{tFormat('remoteVideo')}</option>
              <option value="IN_PERSON">{tFormat('inPerson')}</option>
              <option value="PHONE">{tFormat('phone')}</option>
            </select>
          </div>

          {format === 'REMOTE_VIDEO' && (
            <div>
              <label className="dz-label" htmlFor="session-meet">{t('meetingUrlLabel')}</label>
              <input
                id="session-meet"
                className="dz-input"
                type="url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://"
              />
            </div>
          )}

          {format === 'IN_PERSON' && (
            <div>
              <label className="dz-label" htmlFor="session-loc">{t('locationLabel')}</label>
              <input
                id="session-loc"
                className="dz-input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
              />
            </div>
          )}

          <div>
            <label className="dz-label" htmlFor="session-agenda">{t('agendaLabel')}</label>
            <textarea
              id="session-agenda"
              className="dz-input"
              rows={3}
              maxLength={2000}
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder={t('agendaPlaceholder')}
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className="dz-btn dz-btn-primary"
          >
            {pending ? t('submitting') : t('submit')}
          </button>

          {error && (
            <div
              role="alert"
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(217,78,146,0.10)',
                color: '#a8235e',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fmtSlot(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
