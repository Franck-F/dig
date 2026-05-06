/**
 * Status pill — covers MentorshipRequestStatus, MentorshipStatus and SessionStatus.
 * Caller passes the literal string + a pre-translated label so this component
 * stays synchronously renderable in both client & server contexts.
 */
const PALETTE = {
  // MentorshipRequest
  PENDING: { bg: 'rgba(255,184,0,0.14)', fg: '#8A5A00' },
  ACCEPTED: { bg: 'rgba(35,197,94,0.14)', fg: '#108A48' },
  DECLINED: { bg: 'rgba(217,78,146,0.14)', fg: '#A8235E' },
  WITHDRAWN: { bg: 'rgba(36,50,95,0.10)', fg: '#24325F' },
  EXPIRED: { bg: 'rgba(36,50,95,0.10)', fg: '#646A82' },
  // Mentorship
  ACTIVE: { bg: 'rgba(35,197,94,0.14)', fg: '#108A48' },
  PAUSED: { bg: 'rgba(255,184,0,0.14)', fg: '#8A5A00' },
  COMPLETED: { bg: 'rgba(115,1,255,0.10)', fg: '#7301FF' },
  TERMINATED: { bg: 'rgba(36,50,95,0.10)', fg: '#646A82' },
  // Session
  SCHEDULED: { bg: 'rgba(115,1,255,0.10)', fg: '#7301FF' },
  IN_PROGRESS: { bg: 'rgba(35,197,94,0.14)', fg: '#108A48' },
  CANCELLED: { bg: 'rgba(217,78,146,0.14)', fg: '#A8235E' },
  NO_SHOW: { bg: 'rgba(36,50,95,0.10)', fg: '#646A82' },
} as const;

type StatusKey = keyof typeof PALETTE;

export default function StatusPill({ status, label }: { status: StatusKey | string; label: string }) {
  const palette = (PALETTE as Record<string, { bg: string; fg: string }>)[status] ?? {
    bg: 'rgba(36,50,95,0.10)',
    fg: '#24325F',
  };
  return (
    <span
      className="dz-chip"
      style={{
        background: palette.bg,
        color: palette.fg,
        fontSize: 12,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </span>
  );
}
