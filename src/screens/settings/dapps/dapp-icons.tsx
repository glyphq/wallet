import type { ReactNode } from "react";

function OutlineIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

export function GlobeIcon() {
  return (
    <OutlineIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a13 13 0 0 1 0 18" />
      <path d="M12 3a13 13 0 0 0 0 18" />
    </OutlineIcon>
  );
}

export function UserIcon() {
  return (
    <OutlineIcon>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </OutlineIcon>
  );
}

export function ShieldIcon() {
  return (
    <OutlineIcon>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    </OutlineIcon>
  );
}

export function SlashIcon() {
  return (
    <OutlineIcon>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6 18.4 18.4" />
    </OutlineIcon>
  );
}

export function ChevronIcon() {
  return (
    <OutlineIcon>
      <path d="m8 10 4 4 4-4" />
    </OutlineIcon>
  );
}
