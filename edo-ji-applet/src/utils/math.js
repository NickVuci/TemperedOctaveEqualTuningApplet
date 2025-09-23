// Math and ratio helpers

/**
 * Convert a frequency ratio to cents (assuming 1200 cents per octave).
 * @param {number} ratio
 * @returns {number} cents
 */
export function ratioToCents(ratio) {
  return 1200 * Math.log2(ratio);
}

/**
 * Greatest common divisor of two integers (non-negative).
 * @param {number} a
 * @param {number} b
 */
export function gcd(a, b) {
  let x = Math.trunc(Math.abs(a || 0));
  let y = Math.trunc(Math.abs(b || 0));
  if (x === 0) return y || 1;
  if (y === 0) return x || 1;
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return Math.abs(x) || 1;
}

/**
 * Maximum prime factor of a positive integer.
 * @param {number} n
 * @returns {number}
 */
export function maxPrimeFactor(n) {
  if (n <= 1) return 1;
  let num = Math.trunc(Math.abs(n));
  let maxP = 1;
  while (num % 2 === 0) { maxP = 2; num = Math.floor(num / 2); }
  for (let p = 3; p * p <= num; p += 2) {
    while (num % p === 0) { maxP = p; num = Math.floor(num / p); }
  }
  if (num > 1) maxP = num;
  return maxP;
}

// Normalize a rational n/d into the [1, 2) octave band as integers, with reduction
/**
 * Normalize rational n/d into [1,2) by powers of 2 and reduce to lowest terms.
 * @param {number} n
 * @param {number} d
 * @returns {{n:number,d:number}}
 */
export function normalizeOctaveFraction(n, d) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return { n: n || 1, d: d || 1 };
  n = Math.trunc(n);
  d = Math.trunc(d);
  if (n < 0) n = Math.abs(n);
  if (d < 0) d = Math.abs(d);
  while (n / d < 1) n *= 2;
  while (n / d >= 2) d *= 2;
  const g = gcd(n, d) || 1;
  return { n: Math.trunc(n / g), d: Math.trunc(d / g) };
}

// Continued fraction approximation for real numbers
/**
 * Approximate a real number with a fraction using continued fractions.
 * @param {number} x
 * @param {number} [maxDen=512]
 * @returns {[number, number]} numerator, denominator
 */
export function approximateFraction(x, maxDen = 512) {
  let h1 = 1, k1 = 0, h0 = 0, k0 = 1;
  let a = Math.floor(x);
  let x1 = x;
  let h = a * h1 + h0, k = a * k1 + k0;
  let iter = 0;
  while (k <= maxDen && Math.abs(x - h / k) > 1e-12 && iter < 64) {
    x1 = 1 / (x1 - a);
    a = Math.floor(x1);
    h0 = h1; k0 = k1; h1 = h; k1 = k;
    h = a * h1 + h0; k = a * k1 + k0;
    iter++;
  }
  if (k > maxDen) { h = h1; k = k1; }
  return [h, k];
}

/**
 * Given cents within an octave, return a simple normalized fraction [n,d].
 * @param {number} cents
 * @returns {[number, number]}
 */
export function centsToNearestSimpleFraction(cents) {
  const r = Math.pow(2, cents / 1200);
  const [n0, d0] = approximateFraction(r, 512);
  const g = gcd(n0, d0);
  const n1 = Math.round(n0 / g), d1 = Math.round(d0 / g);
  const norm = normalizeOctaveFraction(n1, d1);
  return [norm.n, norm.d];
}
