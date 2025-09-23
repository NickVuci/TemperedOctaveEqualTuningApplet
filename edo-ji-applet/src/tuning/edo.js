/**
 * Generate equally spaced EDO intervals in cents for a given octave size.
 * @param {number} edo
 * @param {number} octaveCents
 * @returns {number[]}
 */
export function generateEDOIntervals(edo, octaveCents) {
  const e = Number.isFinite(edo) && edo > 0 ? Math.floor(edo) : 12;
  const oct = Number.isFinite(octaveCents) ? octaveCents : 1200;
  const step = oct / e;
  return Array.from({ length: e + 1 }, (_, i) => i * step);
}
