/**
 * Convert cents (0..1200) to canvas x coordinate (0..width).
 * @param {number} cents
 * @param {number} width
 */
export function mapCentsToX(cents, width) {
  return (cents / 1200) * width;
}

/**
 * Convert canvas x coordinate to cents (0..1200).
 * @param {number} x
 * @param {number} width
 */
export function mapXToCents(x, width) {
  return (x / width) * 1200;
}
