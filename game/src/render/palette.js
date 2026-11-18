// Colour helpers: every palette entry is a hex string, and the art code asks these for a
// darker wall, a lighter highlight or the same colour with an alpha.

const cache = new Map();

function parse(hex) {
  let entry = cache.get(hex);
  if (entry) return entry;
  if (typeof hex !== 'string' || hex[0] !== '#') {
    // Already an rgb() string or something odd: keep the art running with a neutral grey.
    entry = { r: 128, g: 128, b: 128 };
    cache.set(hex, entry);
    return entry;
  }
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  entry = {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
  cache.set(hex, entry);
  return entry;
}

export function rgba(hex, alpha) {
  const { r, g, b } = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** amount < 0 darkens toward black, > 0 lightens toward white. */
export function shade(hex, amount) {
  const { r, g, b } = parse(hex);
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const channel = (value) => Math.round(value + (target - value) * t);
  return `rgb(${channel(r)}, ${channel(g)}, ${channel(b)})`;
}

export function mix(hexA, hexB, amount) {
  const a = parse(hexA);
  const b = parse(hexB);
  const channel = (x, y) => Math.round(x + (y - x) * amount);
  return `rgb(${channel(a.r, b.r)}, ${channel(a.g, b.g)}, ${channel(a.b, b.b)})`;
}

/** Warm a colour toward the hour's light: sunsets push everything amber, night pulls it blue. */
export function tint(hex, r, g, b, amount) {
  const base = parse(hex);
  return `rgb(${Math.round(base.r + (r - base.r) * amount)}, ${Math.round(base.g + (g - base.g) * amount)}, ${Math.round(base.b + (b - base.b) * amount)})`;
}
