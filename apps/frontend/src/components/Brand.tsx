type LogoProps = { size?: number };

/** A floor tile with a player on it: the whole product in one mark. */
export function LogoMark({ size = 32 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#2f8f84" />
      <path d="M0 16h16v16H7a7 7 0 0 1-7-7zM16 0h9a7 7 0 0 1 7 7v9H16z" fill="#2b857a" />
      <circle cx="16" cy="17" r="9" fill="#e9bf45" stroke="#a98219" strokeWidth="2" />
      <circle cx="13" cy="18" r="1.6" fill="#0d2321" />
      <circle cx="19" cy="18" r="1.6" fill="#0d2321" />
    </svg>
  );
}

export function Wordmark({ size = 32 }: LogoProps) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="font-display text-xl font-bold tracking-tight">MetaVerse</span>
    </span>
  );
}

type AvatarProps = {
  color: string;
  size?: number;
  className?: string;
};

/** The same round character the canvas draws, as an inline element. */
export function AvatarBean({ color, size = 28, className = "" }: AvatarProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      className={className}
      aria-hidden="true"
    >
      <circle cx="14" cy="14" r="12" fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="2" />
      <circle cx="9.5" cy="9" r="2.6" fill="rgba(255,255,255,0.3)" />
      <circle cx="11" cy="15.5" r="1.7" fill="#0d2321" />
      <circle cx="17" cy="15.5" r="1.7" fill="#0d2321" />
    </svg>
  );
}
