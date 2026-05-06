'use client';

import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

type WizardStep = {
  id: string;
  title: string;
  /** Optional subtitle rendered below the title */
  subtitle?: string;
  content: ReactNode;
};

type Props = {
  steps: WizardStep[];
  current: number;
  onBack?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  pending?: boolean;
  /** key for the namespace whose `actions.next/back/submit/finish` are used */
  actionsNamespace: 'mentora.onboarding.actions' | 'mentora.becomeAMentor.actions';
  /** Override label for the final-step submit button (e.g. "Mettre à jour"). */
  submitLabel?: string;
  error?: string | null;
  /** When true, renders a Next button that submits the form (final step). */
  isFinalStep?: boolean;
};

/**
 * Shared wizard primitive: renders a step indicator, the active step content
 * and Back / Next (or Submit on the final step) buttons. Step state is held
 * by the caller — this component is a presentational shell only so each
 * wizard can own its own form state, validation, and server-action wiring.
 */
export default function Wizard({
  steps,
  current,
  onBack,
  onNext,
  onSubmit,
  pending = false,
  actionsNamespace,
  submitLabel,
  error,
  isFinalStep,
}: Props) {
  const tActions = useTranslations(actionsNamespace);
  const tIndicator = useTranslations(
    actionsNamespace === 'mentora.onboarding.actions'
      ? 'mentora.onboarding'
      : 'mentora.becomeAMentor',
  );
  const total = steps.length;
  const step = steps[current];
  if (!step) return null;
  const final = isFinalStep ?? current === total - 1;

  return (
    <div className="dz-glass-strong" style={{ padding: 32, borderRadius: 24 }}>
      <div
        className="dz-small"
        style={{ marginBottom: 8, color: '#7301FF', fontWeight: 600 }}
      >
        {tIndicator('stepIndicator', { current: current + 1, total })}
      </div>
      <div
        aria-hidden
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 20,
        }}
      >
        {steps.map((s, i) => (
          <div
            key={s.id}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 99,
              background:
                i <= current ? 'linear-gradient(90deg,#7301FF,#A34BF5)' : 'rgba(115,1,255,0.12)',
            }}
          />
        ))}
      </div>

      <h2 className="dz-h2" style={{ fontSize: 28 }}>{step.title}</h2>
      {step.subtitle && (
        <p className="dz-small" style={{ marginTop: 8, fontSize: 14 }}>{step.subtitle}</p>
      )}

      <div style={{ marginTop: 24 }}>{step.content}</div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 20,
            padding: 12,
            borderRadius: 12,
            background: 'rgba(217,78,146,0.10)',
            color: '#a8235e',
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 28,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          disabled={current === 0 || pending}
          className="dz-btn dz-btn-ghost"
          style={{ visibility: current === 0 ? 'hidden' : 'visible' }}
        >
          {tActions('back')}
        </button>
        {final ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending}
            className="dz-btn dz-btn-primary"
            style={{ minWidth: 200, opacity: pending ? 0.7 : 1 }}
          >
            {pending
              ? tActions('submitting')
              : submitLabel ??
                (actionsNamespace === 'mentora.onboarding.actions'
                  ? tActions('finish')
                  : tActions('submit'))}
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={pending}
            className="dz-btn dz-btn-primary"
          >
            {tActions('next')}
          </button>
        )}
      </div>
    </div>
  );
}
