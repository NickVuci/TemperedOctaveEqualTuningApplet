/**
 * Convert cents (0..1200) to canvas x coordinate (0..width).
 * @param {number} cents
 * @param {number} width
 */
/**
 * Map cents to x with padding and a variable domain (default 1200 cents).
 */
export function mapCentsToX(cents, width, pad = 0, domainCents = 1200) {
  const innerW = Math.max(1, width - 2 * pad);
  const d = Math.max(1, domainCents);
  return pad + (cents / d) * innerW;
}

/**
 * Convert canvas x coordinate to cents (0..1200).
 * @param {number} x
 * @param {number} width
 */
/**
 * Inverse of mapCentsToX with the same padding and domain.
 */
export function mapXToCents(x, width, pad = 0, domainCents = 1200) {
  const innerW = Math.max(1, width - 2 * pad);
  const d = Math.max(1, domainCents);
  const t = (x - pad) / innerW;
  const cents = t * d;
  return Math.min(d, Math.max(0, cents));
}
