// Optimization strategies for detuning the octave to best align EDO with JI

// Helpers
function oddPart(n) {
  n = Math.trunc(Math.abs(n || 0));
  if (n === 0) return 1;
  while (n % 2 === 0) n = Math.floor(n / 2);
  return n;
}
function largestPrimeFactor(n) {
  n = Math.trunc(Math.abs(n || 0));
  if (n < 2) return 1;
  let maxP = 1;
  while (n % 2 === 0) { maxP = 2; n = Math.floor(n / 2); }
  for (let p = 3; p * p <= n; p += 2) {
    while (n % p === 0) { maxP = p; n = Math.floor(n / p); }
  }
  if (n > 1) maxP = n;
  return maxP;
}

function proximityScore(d, params = {}) {
  const within = (params.within ?? 15);
  const bonus5 = (params.bonus5 ?? 0.5);
  const bonus1 = (params.bonus1 ?? 0.5);
  const base = Math.max(0, within - d) / within;
  const bonus = (d <= 5 ? bonus5 : 0) + (d <= 1 ? bonus1 : 0);
  return base + bonus;
}

function makeWeights(jiData, scheme, params = {}) {
  const n = Array.isArray(jiData) ? jiData.length : 0;
  const weights = new Array(n).fill(1);
  const getND = (j) => {
    const o = jiData[j] || {};
    const N = Number.isFinite(o.n) ? Math.trunc(o.n) : null;
    const D = Number.isFinite(o.d) ? Math.trunc(o.d) : null;
    return [N, D];
  };

  switch (scheme) {
    case 'oddLimit': {
      const p = params.power ?? 1;
      for (let j = 0; j < n; j++) {
        const [N, D] = getND(j);
        if (!N || !D) continue;
        const ol = Math.max(oddPart(N), oddPart(D));
        weights[j] = 1 / Math.max(1, Math.pow(ol, p));
      }
      break;
    }
    case 'primeLimit': {
      const p = params.power ?? 1;
      for (let j = 0; j < n; j++) {
        const [N, D] = getND(j);
        if (!N || !D) continue;
        const pl = Math.max(largestPrimeFactor(N), largestPrimeFactor(D));
        weights[j] = 1 / Math.max(1, Math.pow(pl, p));
      }
      break;
    }
    case 'tenney': {
      const p = params.power ?? 1;
      for (let j = 0; j < n; j++) {
        const [N, D] = getND(j);
        if (!N || !D) continue;
        const th = (Math.log2(Math.abs(N)) + Math.log2(Math.abs(D))) || 1;
        weights[j] = 1 / Math.max(1, Math.pow(th, p));
      }
      break;
    }
    case 'mixed': {
      const a = params.oddPower ?? 0.6;
      const b = params.primePower ?? 0.8;
      for (let j = 0; j < n; j++) {
        const [N, D] = getND(j);
        if (!N || !D) continue;
        const ol = Math.max(oddPart(N), oddPart(D));
        const pl = Math.max(largestPrimeFactor(N), largestPrimeFactor(D));
        const wOdd = 1 / Math.max(1, Math.pow(ol, a));
        const wPrime = 1 / Math.max(1, Math.pow(pl, b));
        weights[j] = wOdd * wPrime;
      }
      break;
    }
    case 'uniform':
    default:
      // already ones
      break;
  }
  return weights;
}

export function optimizeDetune({
  edo,
  jiIntervals,
  jiData,
  generateEDOIntervals,
  basePeriodCents = 1200,
  scheme = 'uniform',
  params = {},
  bounds = { min: -50, max: 50 },
  steps = { coarse: 0.5, refineSpan: 1.0, refineStep: 0.05, fineSpan: 0.25, fineStep: 0.01 },
}) {
  if (!Array.isArray(jiIntervals) || jiIntervals.length === 0) {
    return { detune: 0, score: -Infinity };
  }
  const weights = makeWeights(jiData || [], scheme, params);

  function scoreForDetune(detune) {
  const stepsCents = generateEDOIntervals(edo, basePeriodCents + detune);
    let score = 0;
    // Pass 1: EDO -> JI
    {
      let j = 0; // nearest JI via two-pointer
      for (let i = 0; i < stepsCents.length; i++) {
        const c = stepsCents[i];
        while (j + 1 < jiIntervals.length && Math.abs(jiIntervals[j + 1] - c) <= Math.abs(jiIntervals[j] - c)) j++;
        const d = Math.abs(c - jiIntervals[j]);
        const w = weights[j] ?? 1;
        score += w * proximityScore(d, params.proximity);
      }
    }
    // Optional Pass 2: JI -> EDO (symmetric)
    if (params.symmetric) {
      let i = 0;
      for (let j = 0; j < jiIntervals.length; j++) {
        const c = jiIntervals[j];
        while (i + 1 < stepsCents.length && Math.abs(stepsCents[i + 1] - c) <= Math.abs(stepsCents[i] - c)) i++;
        const d = Math.abs(c - stepsCents[i]);
        const w = weights[j] ?? 1;
        score += w * proximityScore(d, params.proximity);
      }
      score /= 2; // average both directions
    }
    return score;
  }

  let bestDetune = 0, bestScore = -Infinity;
  const tryRange = (start, end, step) => {
    for (let v = start; v <= end + 1e-9; v += step) {
      const s = scoreForDetune(v);
      if (s > bestScore) { bestScore = s; bestDetune = v; }
    }
  };

  const { min, max } = bounds;
  tryRange(min, max, steps.coarse);
  tryRange(Math.max(min, bestDetune - steps.refineSpan), Math.min(max, bestDetune + steps.refineSpan), steps.refineStep);
  tryRange(Math.max(min, bestDetune - steps.fineSpan), Math.min(max, bestDetune + steps.fineSpan), steps.fineStep);

  const detune = Math.max(min, Math.min(max, Math.round(bestDetune * 100) / 100));
  return { detune, score: bestScore };
}

export const OPTIMIZE_SCHEMES = ['uniform', 'oddLimit', 'primeLimit', 'tenney', 'mixed'];
