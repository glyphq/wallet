export function normalizedGlobalHttpsOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname || isNonGlobalLiteral(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isGlobalHttpsUrl(value: string): boolean {
  return normalizedGlobalHttpsOrigin(value) !== null;
}

function isNonGlobalLiteral(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost") return true;
  if (host.includes(":")) return isNonGlobalIpv6(host);
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const [a, b, c, d] = match.slice(1).map(Number);
  if ([a, b, c, d].some((part) => part > 255)) return true;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && (c === 0 || c === 2))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    || (a === 203 && b === 0 && c === 113);
}

function isNonGlobalIpv6(host: string): boolean {
  if (host === "::" || host === "::1") return true;
  const first = Number.parseInt(host.split(":", 1)[0] || "0", 16);
  if (!Number.isFinite(first)) return false;
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (host.startsWith("2001:db8:")) return true; // documentation prefix
  if (host.startsWith("::ffff:")) {
    const mapped = host.slice("::ffff:".length);
    const dotted = mapped.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (dotted) return isNonGlobalLiteral(dotted[1]);
    const parts = mapped.split(":");
    if (parts.length === 2) {
      const high = Number.parseInt(parts[0], 16);
      const low = Number.parseInt(parts[1], 16);
      if (Number.isFinite(high) && Number.isFinite(low)) {
        return isNonGlobalLiteral(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
      }
    }
    return true;
  }
  return false;
}
