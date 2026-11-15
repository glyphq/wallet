export function cspModeLabel() {
  return import.meta.env.DEV ? "Development" : "Strict";
}

export function cspModeDetail() {
  return import.meta.env.DEV
    ? "Vite dev server active. Packaged CSP is not enforced by the development host."
    : "Packaged connections are limited to self, IPC, and HTTPS endpoints.";
}
