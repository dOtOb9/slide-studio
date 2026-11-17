import type { ReactNode } from 'react';

export function IconButton({
  label,
  onClick,
  disabled,
  type = 'button',
  expanded,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  expanded?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      className="icon-button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-expanded={expanded}
    >
      {children}
    </button>
  );
}
