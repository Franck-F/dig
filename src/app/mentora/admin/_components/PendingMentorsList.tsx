'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adminApproveMentor, adminRejectMentor } from '@/lib/actions/mentora/profile';

export type PendingMentorRow = {
  id: string;
  userName: string;
  userEmail: string;
  headline: string;
  yearsExperience: number;
  languages: string[];
  topSkills: string[];
  submittedAt: string; // ISO
};

type Props = {
  rows: PendingMentorRow[];
};

/**
 * Admin moderation strip listing every mentor profile currently in
 * `PENDING_REVIEW`. Each row exposes:
 *   - Approve  → calls `adminApproveMentor({ mentorProfileId })`. On success
 *                the mentor moves to ACTIVE, role STUDENT/PARTNER becomes
 *                MENTOR, and the user receives a `MENTOR_APPROVED` notif.
 *   - Reject   → opens an inline reason input (min 5 chars) then calls
 *                `adminRejectMentor`. The mentor goes back to DRAFT with
 *                `reviewNote` set; user receives a `MENTOR_REJECTED` notif.
 *
 * Optimistic-removal pattern: once the action succeeds, the row is dropped
 * from the local list and `router.refresh()` is fired so KPI tiles upstream
 * reflect the change.
 */
export default function PendingMentorsList({ rows }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(rows);
  const [pending, startTransition] = useTransition();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [errorByRow, setErrorByRow] = useState<Record<string, string | null>>({});

  if (items.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: '#8b91ad' }}>
        Aucune candidature en attente. ✓
      </p>
    );
  }

  const onApprove = (id: string) => {
    setErrorByRow((p) => ({ ...p, [id]: null }));
    startTransition(async () => {
      const res = await adminApproveMentor({ mentorProfileId: id });
      if (res.status === 'error') {
        setErrorByRow((p) => ({ ...p, [id]: res.error }));
        return;
      }
      setItems((cur) => cur.filter((r) => r.id !== id));
      router.refresh();
    });
  };

  const onReject = (id: string) => {
    if (rejectNote.trim().length < 5) {
      setErrorByRow((p) => ({ ...p, [id]: 'Note ≥ 5 caractères requise.' }));
      return;
    }
    setErrorByRow((p) => ({ ...p, [id]: null }));
    startTransition(async () => {
      const res = await adminRejectMentor({ mentorProfileId: id, reviewNote: rejectNote.trim() });
      if (res.status === 'error') {
        setErrorByRow((p) => ({ ...p, [id]: res.error }));
        return;
      }
      setItems((cur) => cur.filter((r) => r.id !== id));
      setRejectingId(null);
      setRejectNote('');
      router.refresh();
    });
  };

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((m) => {
        const isRejecting = rejectingId === m.id;
        const err = errorByRow[m.id];
        return (
          <li
            key={m.id}
            style={{
              padding: 16,
              border: '1px solid rgba(115,1,255,0.10)',
              borderRadius: 14,
              background: 'rgba(115,1,255,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1f3a' }}>
                  {m.userName}
                  <span style={{ color: '#8b91ad', fontWeight: 500 }}> · {m.userEmail}</span>
                </div>
                <div style={{ fontSize: 13, color: '#545b7a', marginTop: 4 }}>{m.headline}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'rgba(115,1,255,0.10)',
                      color: '#7301FF',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {m.yearsExperience} an{m.yearsExperience > 1 ? 's' : ''} d&apos;expérience
                  </span>
                  {m.languages.map((l) => (
                    <span
                      key={l}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: 'rgba(244,111,177,0.10)',
                        color: '#d94e92',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {l}
                    </span>
                  ))}
                  {m.topSkills.slice(0, 4).map((s) => (
                    <span
                      key={s}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: 'rgba(36,50,95,0.06)',
                        color: '#24325F',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: '#8b91ad', marginTop: 8 }}>
                  Candidature envoyée le {new Date(m.submittedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>

              {!isRejecting && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => onApprove(m.id)}
                    disabled={pending}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 9,
                      border: 'none',
                      background: '#23c55e',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: pending ? 'wait' : 'pointer',
                      opacity: pending ? 0.6 : 1,
                    }}
                  >
                    ✓ Approuver
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingId(m.id);
                      setRejectNote('');
                    }}
                    disabled={pending}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 9,
                      border: '1px solid rgba(244,111,177,0.40)',
                      background: 'transparent',
                      color: '#d94e92',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: pending ? 'wait' : 'pointer',
                    }}
                  >
                    Refuser
                  </button>
                </div>
              )}
            </div>

            {isRejecting && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Note interne — au moins 5 caractères. Sera envoyée au candidat."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid rgba(115,1,255,0.20)',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => onReject(m.id)}
                    disabled={pending || rejectNote.trim().length < 5}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 9,
                      border: 'none',
                      background: '#d94e92',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: pending ? 'wait' : 'pointer',
                      opacity: pending || rejectNote.trim().length < 5 ? 0.5 : 1,
                    }}
                  >
                    Confirmer le refus
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingId(null);
                      setRejectNote('');
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 9,
                      border: '1px solid rgba(115,1,255,0.20)',
                      background: 'transparent',
                      color: '#545b7a',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {err && (
              <div
                style={{
                  fontSize: 12,
                  color: '#d94e92',
                  background: 'rgba(244,111,177,0.10)',
                  padding: '8px 12px',
                  borderRadius: 8,
                }}
              >
                {err}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
