/**
 * Convert cents (0..1200) to canvas x coordinate (0..width).
 * @param {number} cents
 * @param {number} width
 */
export function mapCentsToX(cents, width, pad = 0) {
  const innerW = Math.max(1, width - 2 * pad);
  return pad + (cents / 1200) * innerW;
}

/**
 * Convert canvas x coordinate to cents (0..1200).
 * @param {number} x
 * @param {number} width
 */
export function mapXToCents(x, width, pad = 0) {
  const innerW = Math.max(1, width - 2 * pad);
  const t = (x - pad) / innerW;
  const cents = t * 1200;
  return Math.min(1200, Math.max(0, cents));
}
