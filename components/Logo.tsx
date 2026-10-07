export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0E7C86" />
      <rect x="14" y="11" width="36" height="42" rx="6" fill="#fff" />
      <circle cx="32" cy="29" r="9.5" fill="none" stroke="#0E7C86" strokeWidth="4" />
      <circle cx="32" cy="29" r="3" fill="#0E7C86" />
      <rect x="24" y="44" width="16" height="3.5" rx="1.75" fill="#D92D20" />
    </svg>
  );
}
