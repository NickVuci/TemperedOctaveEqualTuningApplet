import { ratioToCents, maxPrimeFactor, normalizeOctaveFraction } from "../utils/math.js";
import { uniqSortedByCents } from "../utils/array.js";

/**
 * Generate reduced odd/odd fractions n/d <= oddLimit within [1,2) domain intent.
 * @param {number} [oddLimit=7]
 * @returns {Array<[number,number]>}
 */
export function generateOddLimitFractions(oddLimit = 7) {
  let lim = Math.max(1, Math.floor(oddLimit));
  if (lim % 2 === 0) lim -= 1;
  const fracs = [];
  // simple gcd inline to avoid circular import
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  for (let n = 1; n <= lim; n += 2) {
    for (let d = 1; d <= lim; d += 2) {
      if (gcd(n, d) !== 1) continue;
      fracs.push([n, d]);
    }
  }
  return fracs;
}

/**
 * Filter fractions by prime limit such that max prime factor of n and d <= limit.
 * @param {Array<[number,number]>} fracs
 * @param {number} primeLimit
 */
export function filterFractionsByPrimeLimit(fracs, primeLimit) {
  if (!Number.isFinite(primeLimit) || primeLimit <= 0) return fracs;
  const lim = Math.floor(primeLimit);
  return fracs.filter(([n, d]) => maxPrimeFactor(n) <= lim && maxPrimeFactor(d) <= lim);
}

/**
 * Convert list of fractions to cents with normalized n/d in [1,2).
 * @param {Array<[number,number]>} fracs
 * @returns {{cents:number,n:number,d:number,source:string}[]}
 */
export function fractionsToCents(fracs) {
  const out = [];
  for (const [rawN, rawD] of fracs) {
    const { n, d } = normalizeOctaveFraction(rawN, rawD);
    const r = n / d;
    const c = ratioToCents(r);
    if (c >= 0 && c <= 1200) out.push({ cents: Math.round(c * 1000) / 1000, n, d, source: 'odd-limit' });
  }
  out.push({ cents: 0, n: 1, d: 1, source: 'odd-limit' });
  return out;
}

/**
 * Deduplicate and sort JI data by cents.
 * @param {{cents:number,n?:number,d?:number,source?:string}[]} items
 * @param {number} [epsilon=0.5]
 */
export function uniqSortedJiData(items, epsilon = 0.5) {
  return uniqSortedByCents(items, epsilon);
}

/**
 * Build the final JI dataset from odd/prime limits and manual entries.
 * @param {{oddLimit:number, primeLimit:number, manualDetailed:Array<{cents:number,n?:number,d?:number}>}} params
 * @returns {{cents:number,n?:number,d?:number,source?:string}[]}
 */
export function buildJI({ oddLimit, primeLimit, manualDetailed }) {
  let jiData = [];
  if (Number.isFinite(oddLimit) && oddLimit > 0) {
    let fracs = generateOddLimitFractions(oddLimit);
    fracs = filterFractionsByPrimeLimit(fracs, primeLimit);
    jiData = fractionsToCents(fracs);
  } else {
    jiData = [
      { cents: 0, n: 1, d: 1 },
      { cents: ratioToCents(5 / 4), n: 5, d: 4 },
      { cents: ratioToCents(3 / 2), n: 3, d: 2 },
    ];
  }
  if (Array.isArray(manualDetailed) && manualDetailed.length) {
    jiData = jiData.concat(manualDetailed);
  }
  // Always include the octave 2/1 (1200 cents) so the end tick/label is visible
  jiData.push({ cents: 1200, n: 2, d: 1, source: 'auto' });
  jiData = jiData.filter(o => Number.isFinite(o.cents) && o.cents >= 0 && o.cents <= 1200);
  jiData = uniqSortedJiData(jiData);
  if (jiData.length === 0) {
    jiData = [
      { cents: ratioToCents(3 / 2), n: 3, d: 2 },
      { cents: ratioToCents(5 / 4), n: 5, d: 4 },
      { cents: ratioToCents(7 / 4), n: 7, d: 4 },
    ];
  }
  return jiData;
}
