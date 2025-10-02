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
function normalizeToPeriodFraction(rawN, rawD, periodNum, periodDen) {
  if (!(periodNum > 0 && periodDen > 0)) {
    return normalizeOctaveFraction(rawN, rawD); // fallback
  }
  // Work with integers
  let n = Math.trunc(Math.abs(rawN));
  let d = Math.trunc(Math.abs(rawD));
  if (n === 0) n = 1;
  if (d === 0) d = 1;
  const pN = Math.trunc(Math.abs(periodNum));
  const pD = Math.trunc(Math.abs(periodDen));
  if (!(pN > 0 && pD > 0)) return normalizeOctaveFraction(n, d);
  const ratioP = pN / pD;
  // Scale into [1, ratioP)
  // Use multiplicative integer transforms to keep exact rational form.
  let iter = 0;
  while (n / d < 1 && iter < 32) { n *= pN; d *= pD; iter++; }
  while (n / d >= ratioP && iter < 64) { n *= pD; d *= pN; iter++; }
  // Reduce
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const g = gcd(n, d) || 1;
  n = Math.trunc(n / g); d = Math.trunc(d / g);
  return { n, d };
}

export function fractionsToCents(fracs, { periodCents = 1200, periodNum = 0, periodDen = 0 } = {}) {
  const out = [];
  for (const [rawN, rawD] of fracs) {
    const { n, d } = normalizeToPeriodFraction(rawN, rawD, periodNum, periodDen);
    const r = n / d;
    const c = ratioToCents(r);
    if (c >= 0 && c <= periodCents) out.push({ cents: Math.round(c * 1000) / 1000, n, d, source: 'odd-limit' });
  }
  // Always include 1/1 root
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
export function buildJI({ oddLimit, primeLimit, manualDetailed, periodCents = 1200, periodNum = 0, periodDen = 0 }) {
  let jiData = [];
  if (Number.isFinite(oddLimit) && oddLimit > 0) {
  let fracs = generateOddLimitFractions(oddLimit);
  fracs = filterFractionsByPrimeLimit(fracs, primeLimit);
    // For periods larger than an octave, first enumerate the classic octave band [1,2) then extend.
    const baseEnumCents = periodCents > 1200 ? 1200 : periodCents;
    const usePeriodNum = periodCents > 1200 ? 0 : periodNum;
    const usePeriodDen = periodCents > 1200 ? 0 : periodDen;
    jiData = fractionsToCents(fracs, { periodCents: baseEnumCents, periodNum: usePeriodNum, periodDen: usePeriodDen });
    // If period spans multiple octaves (ratio > 2), add octave-multiplied versions within domain
    const ratioP = (periodNum > 0 && periodDen > 0) ? (periodNum / periodDen) : Math.pow(2, periodCents / 1200);
    if (ratioP > 2 + 1e-9) {
      const added = [];
      for (const it of jiData) {
        if (!(it.n && it.d)) continue; // need fraction form
        const baseRatio = it.n / it.d;
        if (baseRatio < 1 - 1e-9) continue; // skip anything not in [1,2)
        // Multiply by powers of two to fill successive octaves up to period
        let k = 1;
        while (true) {
          const mul = 1 << k; // 2^k
          const newRatio = baseRatio * mul;
          if (newRatio >= ratioP - 1e-9) break; // stop before hitting or exceeding period (endpoint handled separately)
          const newCents = ratioToCents(newRatio);
          if (newCents <= periodCents + 1e-6) {
            added.push({ cents: Math.round(newCents * 1000) / 1000, n: it.n * mul, d: it.d, source: 'octave-extension' });
          }
          k++;
          if (k > 12) break; // safety cap
        }
      }
      jiData = jiData.concat(added);
    }
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
  // Always include the period endpoint. If a ratio was provided (periodNum/periodDen >0) use it; else only show cents.
  if (periodNum > 0 && periodDen > 0) {
    jiData.push({ cents: periodCents, n: periodNum, d: periodDen, source: 'period-end' });
  } else if (Math.abs(periodCents - 1200) < 1e-6) {
    jiData.push({ cents: periodCents, n: 2, d: 1, source: 'auto' });
  } else {
    jiData.push({ cents: periodCents, source: 'period-end' });
  }
  jiData = jiData.filter(o => Number.isFinite(o.cents) && o.cents >= 0 && o.cents <= periodCents + 1e-6);
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
