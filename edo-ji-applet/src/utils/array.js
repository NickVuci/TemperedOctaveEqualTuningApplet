// Array/search helpers

export function nearestValue(arr, target) {
  if (!arr || arr.length === 0) return undefined;
  return arr.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a), arr[0]);
}

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
