// Array/search helpers

/**
 * Return the value in arr with minimum absolute difference from target.
 * @template T extends number
 * @param {T[]} arr
 * @param {number} target
 * @returns {T|undefined}
 */
export function nearestValue(arr, target) {
  if (!arr || arr.length === 0) return undefined;
  return arr.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a), arr[0]);
}

/**
 * Return the index of the value in arr nearest to target.
 * @param {number[]} arr
 * @param {number} target
 * @returns {number}
 */
export function nearestIndex(arr, target) {
  if (!arr || arr.length === 0) return -1;
  let idx = 0;
  let best = Math.abs(arr[0] - target);
  for (let i = 1; i < arr.length; i++) {
    const d = Math.abs(arr[i] - target);
    if (d < best) { best = d; idx = i; }
  }
  return idx;
}

/**
 * Deduplicate items sorted by .cents with a threshold epsilon.
 * Prefers items that contain n/d over those without.
 * @param {{cents:number,n?:number,d?:number}[]} items
 * @param {number} [epsilon=0.5]
 */
export function uniqSortedByCents(items, epsilon = 0.5) {
  const sorted = [...items].sort((a, b) => a.cents - b.cents);
  const out = [];
  for (const it of sorted) {
    if (out.length === 0 || Math.abs(it.cents - out[out.length - 1].cents) > epsilon) out.push(it);
    else {
      const last = out[out.length - 1];
      const lastHasFrac = last.n && last.d;
      const curHasFrac = it.n && it.d;
      if (!lastHasFrac && curHasFrac) out[out.length - 1] = it;
    }
  }
  return out;
}
