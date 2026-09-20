export type ButtonVariant = "digit" | "function" | "operator" | "equals";

interface ButtonProps {
  label: string;
  /** Spoken name: a screen reader cannot do much with "⌫" or "xʸ". */
  ariaLabel: string;
  onClick: () => void;
  variant?: ButtonVariant;
  /** Extra class for keys that span more than one grid cell. */
  className?: string;
  disabled?: boolean;
  /** Set on operator keys only: whether this is the pending operation. */
  pressed?: boolean;
}

export function Button({
  label,
  ariaLabel,
  onClick,
  variant = "digit",
  className = "",
  disabled = false,
  pressed,
}: ButtonProps) {
  const classNames = ["button", variant, pressed ? "active" : "", className].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={classNames}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
