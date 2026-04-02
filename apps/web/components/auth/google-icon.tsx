type GoogleIconProps = {
  className?: string;
};

export function GoogleIcon({ className }: GoogleIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.63v3.01h3.87c2.26-2.08 3.56-5.15 3.56-8.67z"
        fill="#4285F4"
      />
      <path
        d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.87-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.76-2.11-6.7-4.94H1.3v3.1A12 12 0 0 0 12 24z"
        fill="#34A853"
      />
      <path
        d="M5.3 14.3A7.2 7.2 0 0 1 4.93 12c0-.8.14-1.57.37-2.3V6.6H1.3A12 12 0 0 0 0 12c0 1.94.46 3.78 1.3 5.4l4-3.1z"
        fill="#FBBC05"
      />
      <path
        d="M12 4.77c1.76 0 3.35.61 4.59 1.8l3.44-3.44C17.94 1.16 15.23 0 12 0A12 12 0 0 0 1.3 6.6l4 3.1c.94-2.84 3.58-4.93 6.7-4.93z"
        fill="#EA4335"
      />
    </svg>
  );
}
