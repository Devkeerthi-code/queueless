/** The QueueLess mark: a turmeric token stub with a punched hole. */
export function BrandMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <path d="M3 4h22v6a3 3 0 0 0 0 6v8H3v-8a3 3 0 0 0 0-6z" fill="#e8a317" />
      <circle cx="14" cy="8" r="2" fill="var(--counter)" />
      <text x="14" y="21.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="#1c1a17" fontFamily="var(--font-archivo)">
        Q
      </text>
    </svg>
  );
}
