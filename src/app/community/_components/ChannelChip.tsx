import Link from 'next/link';

type Props = {
  slug: string;
  name: string;
  emoji?: string | null; // accepted for backwards-compat; intentionally ignored
  color?: string | null;
  size?: 'sm' | 'md';
};

/**
 * Channel pill. Brand-tinted pill linking to /community/c/[slug].
 * A small dot in the channel's cover color stands in for an emoji,
 * keeping the surface visually distinct without the cliché look.
 */
export default function ChannelChip({ slug, name, color, size = 'sm' }: Props) {
  const dot = color ?? '#7301FF';
  return (
    <Link
      href={`/community/c/${slug}`}
      className="dz-chip"
      style={{
        fontSize: size === 'sm' ? 11 : 13,
        textDecoration: 'none',
        background: color ? `${color}14` : undefined,
        borderColor: color ? `${color}40` : undefined,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: dot,
          flex: '0 0 auto',
        }}
      />
      <span>{name}</span>
    </Link>
  );
}
