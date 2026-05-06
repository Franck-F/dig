import Link from 'next/link';

type Props = {
  tag: string;
  size?: 'sm' | 'md';
};

/**
 * Hashtag pill. Always lowercased, links to /community/tag/[tag].
 */
export default function TagChip({ tag, size = 'sm' }: Props) {
  const cleaned = tag.replace(/^#/, '').toLowerCase();
  return (
    <Link
      href={`/community/tag/${cleaned}`}
      className="dz-chip"
      style={{
        fontSize: size === 'sm' ? 11 : 13,
        textDecoration: 'none',
      }}
    >
      #{cleaned}
    </Link>
  );
}
