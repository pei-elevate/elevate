import type { ButtonHTMLAttributes } from 'react';

export function Button({
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`button ${className}`} {...props}>
      {children}
    </button>
  );
}
