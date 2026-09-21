import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white border-brand-600 hover:bg-brand-700 hover:border-brand-700 disabled:bg-brand-600/50 disabled:border-transparent',
  secondary:
    'bg-surface text-ink border-line-strong hover:bg-canvas disabled:text-ink-subtle disabled:bg-canvas',
  ghost:
    'bg-transparent text-ink-muted border-transparent hover:bg-canvas hover:text-ink disabled:text-ink-subtle',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Renders a spinner and blocks input while a mutation is in flight. */
  pending?: boolean;
}

export function Button({
  variant = 'secondary',
  pending = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {pending && (
        <svg
          className="size-3.5 animate-spin"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <circle
            cx="8"
            cy="8"
            r="6.5"
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeWidth="2"
          />
          <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" />
        </svg>
      )}
      {children}
    </button>
  );
}
