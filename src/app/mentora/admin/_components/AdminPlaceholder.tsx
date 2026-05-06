import Link from 'next/link';

type Props = {
  title: string;
  subtitle: string;
  description: string;
  /** Bullet list of features to ship later. Empty array hides the list. */
  upcomingFeatures?: string[];
  /** Optional CTA back to a working surface. */
  backHref?: string;
  backLabel?: string;
};

/**
 * Sober "feature in progress" placeholder for admin sub-routes whose UI is
 * not yet built. Avoids 404s on the admin nav while making it explicit to
 * the operator that the section is intentionally empty.
 */
export default function AdminPlaceholder({
  title,
  subtitle,
  description,
  upcomingFeatures = [],
  backHref = '/mentora/admin',
  backLabel = 'Retour au pilotage',
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          background: 'white',
          border: '1px solid rgba(115,1,255,0.10)',
          borderRadius: 20,
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(244,111,177,0.12)',
              color: '#d94e92',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            ◌ En construction
          </span>
          <span style={{ fontSize: 12, color: '#8b91ad', fontWeight: 600 }}>{subtitle}</span>
        </div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#1a1f3a' }}>{title}</h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: '#545b7a', maxWidth: 720 }}>
          {description}
        </p>
        {upcomingFeatures.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '8px 0 0',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 10,
            }}
          >
            {upcomingFeatures.map((f) => (
              <li
                key={f}
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'rgba(115,1,255,0.04)',
                  border: '1px solid rgba(115,1,255,0.10)',
                  fontSize: 13,
                  color: '#1a1f3a',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <span aria-hidden style={{ color: '#7301FF', fontWeight: 700 }}>→</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}
        <div>
          <Link
            href={backHref}
            style={{
              display: 'inline-block',
              padding: '8px 14px',
              borderRadius: 9,
              background: 'transparent',
              border: '1px solid rgba(115,1,255,0.25)',
              color: '#7301FF',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            ← {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
