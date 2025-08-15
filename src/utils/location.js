export const LOCATION = Object.freeze({
  C_STORE: 'C-Store',
  RESTAURANT: 'Restaurant',
});

/**
 * Normalize any free-text location to one of the canonical values.
 * Examples that map to C-Store: "cstore", "c-store", "c store", "c", "store"
 * Examples that map to Restaurant: "restaurant", "resto", "r"
 * Returns "" if no confident match.
 */
export function normalizeLocation(value) {
  if (value == null) return '';

  const v = String(value).trim().toLowerCase();

  // C-Store patterns
  if (
    v === 'c' ||
    v === 'cstore' ||
    v === 'c-store' ||
    v === 'c store' ||
    v === 'store' ||
    /^c[\W_]*store/.test(v)
  ) {
    return LOCATION.C_STORE;
  }

  // Restaurant patterns
  if (
    v === 'r' ||
    v === 'restaurant' ||
    v === 'resto' ||
    /^rest(aurant)?/.test(v)
  ) {
    return LOCATION.RESTAURANT;
  }

  return '';
}

/**
 * Ensure a canonical location string, falling back if needed.
 */
export function ensureLocation(value, fallback = LOCATION.C_STORE) {
  return normalizeLocation(value) || fallback;
}

/**
 * Type guard / matcher.
 */
export function isLocation(value, target) {
  return normalizeLocation(value) === target;
}
