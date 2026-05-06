'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import {
  archiveChannel,
  createChannel,
  updateChannel,
} from '@/lib/actions/community/admin/channels';

const TYPES = ['PUBLIC', 'RESTRICTED', 'PRIVATE', 'ANNOUNCEMENT'] as const;
type ChannelType = (typeof TYPES)[number];

export type ChannelRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  emoji: string | null;
  coverColor: string;
  type: ChannelType;
  isDefault: boolean;
  position: number;
  /** ISO date string when archived (null when live). */
  archivedAt: string | null;
  memberCount: number;
};

type Props = {
  initialChannels: ChannelRow[];
};

const SLUG_RE = /^[a-z0-9-]{2,40}$/;

/**
 * Inline channel CRUD. The form acts as both a create and an edit form: when
 * `editingId` is null it sends `createChannel`, otherwise `updateChannel`.
 */
export default function ChannelEditor({ initialChannels }: Props) {
  const t = useTranslations('community.admin.channels');
  const tForm = useTranslations('community.admin.channels.form');
  const tList = useTranslations('community.admin.channels.list');
  const tTypeOpts = useTranslations('community.admin.channels.form.typeOptions');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('');
  const [coverColor, setCoverColor] = useState('#7301FF');
  const [type, setType] = useState<ChannelType>('PUBLIC');
  const [isDefault, setIsDefault] = useState(false);
  const [position, setPosition] = useState(0);

  const reset = () => {
    setEditingId(null);
    setSlug('');
    setName('');
    setDescription('');
    setEmoji('');
    setCoverColor('#7301FF');
    setType('PUBLIC');
    setIsDefault(false);
    setPosition(0);
  };

  const startEdit = (c: ChannelRow) => {
    setEditingId(c.id);
    setSlug(c.slug);
    setName(c.name);
    setDescription(c.description ?? '');
    setEmoji(c.emoji ?? '');
    setCoverColor(c.coverColor);
    setType(c.type);
    setIsDefault(c.isDefault);
    setPosition(c.position);
    setError(null);
    setSuccess(null);
  };

  const fire = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!SLUG_RE.test(slug)) {
      setError(tForm('slugHelp'));
      return;
    }
    if (name.trim().length === 0) {
      setError('Nom requis.');
      return;
    }
    startTransition(async () => {
      try {
        const payload = {
          slug,
          name: name.trim(),
          description: description.trim() || undefined,
          emoji: emoji.trim() || undefined,
          coverColor,
          type,
          isDefault,
          position,
        };
        const res = editingId
          ? await updateChannel({ id: editingId, ...payload })
          : await createChannel(payload);
        if (res.status === 'error') {
          setError(res.error);
          return;
        }
        setSuccess(editingId ? t('successUpdated') : t('successCreated'));
        reset();
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const archive = (id: string) => {
    if (!confirm(t('confirmArchive'))) return;
    startTransition(async () => {
      try {
        const res = await archiveChannel({ id });
        if (res.status === 'error') {
          setError(res.error);
          return;
        }
        setSuccess(t('successArchived'));
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <form onSubmit={fire} className="dz-card" style={{ padding: 18, display: 'grid', gap: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {editingId ? tForm('editTitle') : tForm('createTitle')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label htmlFor="slug" className="dz-label">{tForm('slugLabel')}</label>
            <input id="slug" className="dz-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={tForm('slugPlaceholder')} maxLength={40} required />
          </div>
          <div>
            <label htmlFor="name" className="dz-label">{tForm('nameLabel')}</label>
            <input id="name" className="dz-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={tForm('namePlaceholder')} maxLength={60} required />
          </div>
        </div>
        <div>
          <label htmlFor="description" className="dz-label">{tForm('descriptionLabel')}</label>
          <input id="description" className="dz-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={tForm('descriptionPlaceholder')} maxLength={500} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div>
            <label htmlFor="emoji" className="dz-label">{tForm('emojiLabel')}</label>
            <input id="emoji" className="dz-input" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} />
          </div>
          <div>
            <label htmlFor="color" className="dz-label">{tForm('coverColorLabel')}</label>
            <input id="color" type="color" className="dz-input" value={coverColor} onChange={(e) => setCoverColor(e.target.value)} />
          </div>
          <div>
            <label htmlFor="position" className="dz-label">{tForm('positionLabel')}</label>
            <input id="position" type="number" className="dz-input" min={0} max={1000} value={position} onChange={(e) => setPosition(Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label htmlFor="type" className="dz-label">{tForm('typeLabel')}</label>
          <select id="type" className="dz-input" value={type} onChange={(e) => setType(e.target.value as ChannelType)}>
            {TYPES.map((tt) => (
              <option key={tt} value={tt}>
                {tTypeOpts(tt)}
              </option>
            ))}
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
          {tForm('isDefaultLabel')}
        </label>

        {error ? <div role="alert" style={{ fontSize: 13, color: '#a8235e' }}>{error}</div> : null}
        {success ? <div role="status" style={{ fontSize: 13, color: '#177245' }}>{success}</div> : null}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {editingId ? (
            <button type="button" className="dz-btn dz-btn-sm dz-btn-ghost" onClick={reset} disabled={pending}>
              {tForm('cancel')}
            </button>
          ) : null}
          <button type="submit" className="dz-btn dz-btn-sm dz-btn-primary" disabled={pending}>
            {pending ? '...' : tForm('submit')}
          </button>
        </div>
      </form>

      <div className="dz-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: 'rgba(115,1,255,0.06)' }}>
            <tr>
              <th style={th}>{tList('columnSlug')}</th>
              <th style={th}>{tList('columnName')}</th>
              <th style={th}>{tList('columnType')}</th>
              <th style={th}>{tList('columnMembers')}</th>
              <th style={th}>{tList('columnActions')}</th>
            </tr>
          </thead>
          <tbody>
            {initialChannels.map((c) => (
              <tr key={c.id} style={{ borderTop: '1px solid rgba(0,0,0,0.06)', opacity: c.archivedAt ? 0.55 : 1 }}>
                <td style={td}>
                  {c.emoji ? `${c.emoji} ` : ''}#{c.slug}
                  {c.archivedAt ? <span className="dz-small" style={{ marginLeft: 6, fontSize: 11 }}>({t('archivedLabel')})</span> : null}
                </td>
                <td style={td}>{c.name}</td>
                <td style={td}>{tTypeOpts(c.type).split(' — ')[0]}</td>
                <td style={td}>{c.memberCount}</td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" className="dz-btn dz-btn-sm dz-btn-ghost" onClick={() => startEdit(c)}>
                      {t('editCta')}
                    </button>
                    {!c.archivedAt ? (
                      <button type="button" className="dz-btn dz-btn-sm dz-btn-ghost" onClick={() => archive(c.id)} disabled={pending}>
                        {t('archiveCta')}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '12px 14px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const td: React.CSSProperties = {
  padding: '12px 14px',
  verticalAlign: 'top',
};
