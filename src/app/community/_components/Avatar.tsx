/**
 * Member avatar — image if available, else gradient initials.
 * Pure UI; size is in px. Used across PostCard, MemberCard and MemberProfile.
 */

const palettes: Array<[string, string]> = [
  ['#7301FF', '#A34BF5'],
  ['#A34BF5', '#F46FB1'],
  ['#F46FB1', '#7301FF'],
  ['#24325F', '#A34BF5'],
];

function avatarColors(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palettes[h % palettes.length];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

type Props = {
  size?: number;
  src?: string | null;
  seed?: string;
  name?: string | null;
  alt?: string;
};

export default function Avatar({
  size = 40,
  src,
  seed,
  name,
  alt = '',
}: Props) {
  const displayName = name ?? 'Membre';
  const seedKey = seed ?? displayName;
  const [a, b] = avatarColors(seedKey);

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      />
    );
  }

  return (
    <div
      aria-hidden={alt === ''}
      aria-label={alt || undefined}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${a}, ${b})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 700,
        fontSize: Math.max(11, Math.round(size * 0.36)),
        flexShrink: 0,
      }}
    >
      {initials(displayName)}
    </div>
  );
}
