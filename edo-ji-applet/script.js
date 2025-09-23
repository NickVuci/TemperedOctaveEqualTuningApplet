// --- Core helpers ---
function ratioToCents(ratio) { return 1200 * Math.log2(ratio); }
function generateEDOIntervals(edo, octaveCents) {
  const e = Number.isFinite(edo) && edo > 0 ? Math.floor(edo) : 12;
  const oct = Number.isFinite(octaveCents) ? octaveCents : 1200;
  const step = oct / e;
  return Array.from({ length: e + 1 }, (_, i) => i * step);
}
function getColorForDeviation(diff) {
  const absDiff = Math.abs(diff);
  // Treat tiny deviations as zero for color purposes
  if (absDiff < 0.01) return "green";
  if (absDiff <= 1) return "yellow";
  if (absDiff <= 5) return "orange";
  if (absDiff <= 10) return "red";
  return "black";
}

// Parsing & JI generation
// Normalize a rational n/d into the [1, 2) octave band as integers, with reduction
function normalizeOctaveFraction(n, d) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return { n: n || 1, d: d || 1 };
  n = Math.trunc(n); d = Math.trunc(d);
  // Ensure positive (phase/negatives not supported in this context)
  if (n < 0) n = Math.abs(n);
  if (d < 0) d = Math.abs(d);
  // Scale by powers of 2 to land in [1,2)
  // multiply numerator by 2 when <1, multiply denominator by 2 when >=2
  // (keeps integers regardless of parity)
  while (n * 1.0 / d < 1) n *= 2;
  while (n * 1.0 / d >= 2) d *= 2;
  // Reduce
  function gcd(a,b){ return b ? gcd(b, a % b) : Math.abs(a); }
  const g = gcd(n, d) || 1;
  return { n: Math.trunc(n / g), d: Math.trunc(d / g) };
}
function parseManualIntervalsDetailed(text) {
  if (!text) return [];
  const out = [];
  const parts = text.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
  for (const token of parts) {
    if (/^\d+\s*\/\s*\d+$/.test(token)) {
      const [rawN, rawD] = token.split("/").map(v => parseFloat(v));
      if (rawD !== 0 && Number.isFinite(rawN) && Number.isFinite(rawD)) {
        const { n, d } = normalizeOctaveFraction(rawN, rawD);
        const r = n / d;
        out.push({ cents: ratioToCents(r), n, d, source: 'manual' });
      }
      continue;
    }
    if (/^[-+]?\d+(?:\.\d+)?\s*(?:c|cent|cents|¢)$/i.test(token)) {
      const num = parseFloat(token);
      if (Number.isFinite(num)) out.push({ cents: num, source: 'manual' });
      continue;
    }
    const num = parseFloat(token);
    if (Number.isFinite(num)) out.push({ cents: num, source: 'manual' });
  }
  return out;
}
function generateOddLimitFractions(oddLimit = 7) {
  let lim = Math.max(1, Math.floor(oddLimit));
  if (lim % 2 === 0) lim -= 1;
  const fracs = [];
  function gcd(a, b) { return b ? gcd(b, a % b) : Math.abs(a); }
  for (let n = 1; n <= lim; n += 2) {
    for (let d = 1; d <= lim; d += 2) {
      if (gcd(n, d) !== 1) continue; fracs.push([n, d]);
    }
  }
  return fracs;
}
function maxPrimeFactor(n) {
  if (n <= 1) return 1; let num = n; let maxP = 1;
  while (num % 2 === 0) { maxP = 2; num = Math.floor(num / 2); }
  for (let p = 3; p * p <= num; p += 2) {
    while (num % p === 0) { maxP = p; num = Math.floor(num / p); }
  }
  if (num > 1) maxP = num; return maxP;
}
function filterFractionsByPrimeLimit(fracs, primeLimit) {
  if (!Number.isFinite(primeLimit) || primeLimit <= 0) return fracs;
  const lim = Math.floor(primeLimit);
  return fracs.filter(([n, d]) => maxPrimeFactor(n) <= lim && maxPrimeFactor(d) <= lim);
}
function fractionsToCents(fracs) {
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
function uniqSortedJiData(items, epsilon = 0.5) {
  const sorted = [...items].sort((a, b) => a.cents - b.cents);
  const out = [];
  for (const it of sorted) {
    if (out.length === 0 || Math.abs(it.cents - out[out.length - 1].cents) > epsilon) out.push(it);
    else {
      const last = out[out.length - 1];
      const lastHasFrac = last.n && last.d; const curHasFrac = it.n && it.d;
      if (!lastHasFrac && curHasFrac) out[out.length - 1] = it;
    }
  }
  return out;
}

// Drawing
let lastDraw = { jiPixelXs: [] };
function drawRulers(ctx, jiIntervals, edoIntervals, width, height) {
  ctx.clearRect(0, 0, width, height);
  const half = height / 2;
  const jiXs = [];
  jiIntervals.forEach(c => { const x = (c / 1200) * width; ctx.fillStyle = "blue"; ctx.fillRect(x, half, 2, half); jiXs.push(x); });
  lastDraw.jiPixelXs = jiXs;
  edoIntervals.forEach(c => { const x = (c / 1200) * width; const nearest = jiIntervals.reduce((a, b) => Math.abs(b - c) < Math.abs(a - c) ? b : a, jiIntervals[0] ?? 0); const diff = c - nearest; ctx.fillStyle = getColorForDeviation(diff); ctx.fillRect(x, 0, 2, half); });
}

// Wiring
const canvas = document.getElementById("visualizer");
const ctx = canvas.getContext("2d");
const tooltip = document.getElementById("tooltip");
const octaveTotalDisplay = document.getElementById("octaveTotalDisplay");
const selectionPanel = document.getElementById("selectionPanel");
const selectedJiLabel = document.getElementById("selectedJiLabel");
const matchEdoBtn = document.getElementById("matchEdoBtn");

let lastState = { ji: [], jiData: [], edo: [], octave: 1200, edoCount: 12 };

function buildJI() {
  let oddLimit = parseInt(document.getElementById("oddLimitInput").value);
  if (Number.isFinite(oddLimit) && oddLimit % 2 === 0) oddLimit = oddLimit - 1;
  const primeLimit = parseInt(document.getElementById("primeLimitInput").value);
  const manualDetailed = parseManualIntervalsDetailed(document.getElementById("manualIntervals").value);
  let jiData = [];
  if (Number.isFinite(oddLimit) && oddLimit > 0) {
    let fracs = generateOddLimitFractions(oddLimit); fracs = filterFractionsByPrimeLimit(fracs, primeLimit); jiData = fractionsToCents(fracs);
  } else {
    jiData = [ { cents: 0, n: 1, d: 1 }, { cents: ratioToCents(5/4), n: 5, d: 4 }, { cents: ratioToCents(3/2), n: 3, d: 2 } ];
  }
  jiData = jiData.concat(manualDetailed);
  if (jiData.length === 0) jiData = [ { cents: ratioToCents(3/2), n: 3, d: 2 }, { cents: ratioToCents(5/4), n: 5, d: 4 }, { cents: ratioToCents(7/4), n: 7, d: 4 } ];
  jiData = jiData.filter(o => Number.isFinite(o.cents) && o.cents >= 0 && o.cents <= 1200);
  jiData = uniqSortedJiData(jiData);
  return jiData;
}

function update() {
  const edo = parseInt(document.getElementById("edoInput").value);
  const detune = parseFloat(document.getElementById("octaveDetuneInput").value) || 0;
  const octaveCents = 1200 + detune; if (octaveTotalDisplay) octaveTotalDisplay.textContent = `Octave: ${octaveCents.toFixed(2)} c`;
  const jiData = buildJI(); const jiIntervals = jiData.map(o => o.cents); const edoIntervals = generateEDOIntervals(edo, octaveCents);
  drawRulers(ctx, jiIntervals, edoIntervals, canvas.width, canvas.height);
  lastState = { ji: jiIntervals, jiData, edo: edoIntervals, octave: octaveCents, edoCount: edo };
}

let updateTimer = null; function queuedUpdate() { if (updateTimer) clearTimeout(updateTimer); updateTimer = setTimeout(() => { update(); updateTimer = null; }, 80); }
document.querySelectorAll("input, textarea").forEach(el => el.addEventListener("input", queuedUpdate));
update();

// Tooltip
function nearestValue(arr, target) { if (!arr || arr.length === 0) return undefined; return arr.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a), arr[0]); }
function nearestIndex(arr, target) { if (!arr || arr.length === 0) return -1; let idx = 0; let best = Math.abs(arr[0] - target); for (let i = 1; i < arr.length; i++) { const d = Math.abs(arr[i] - target); if (d < best) { best = d; idx = i; } } return idx; }
canvas.addEventListener("mousemove", (ev) => {
  const rect = canvas.getBoundingClientRect(); const x = ev.clientX - rect.left; const cents = (x / canvas.width) * 1200;
  const nearestEDO = nearestValue(lastState.edo, cents); const nearestJI = nearestValue(lastState.ji, cents); const diff = nearestEDO !== undefined && nearestJI !== undefined ? (nearestEDO - nearestJI) : undefined;
  if (nearestEDO === undefined) { tooltip.style.display = "none"; return; }
  let html = `Cents: ${cents.toFixed(2)}`;
  if (nearestEDO !== undefined) { const k = nearestIndex(lastState.edo, nearestEDO); const n = (k >= 0) ? k : 0; const edoCount = lastState.edoCount || (lastState.edo.length - 1); html += `<br/>Nearest EDO: ${nearestEDO.toFixed(2)}c (step ${n}/${edoCount})`; }
  if (nearestJI !== undefined) { const jIdx = nearestIndex(lastState.ji, nearestJI); const jiObj = jIdx >= 0 ? lastState.jiData[jIdx] : undefined; const frac = jiObj && jiObj.n && jiObj.d ? `${jiObj.n}/${jiObj.d}` : (function(){ const [an, ad] = centsToNearestSimpleFraction(nearestJI); return `${an}/${ad}`; })(); html += `<br/>Nearest JI: ${nearestJI.toFixed(2)}c (${frac})`; }
  if (diff !== undefined) html += `<br/>Deviation: ${(diff).toFixed(2)}c`;
  tooltip.innerHTML = html; tooltip.style.left = `${ev.clientX}px`; tooltip.style.top = `${ev.clientY}px`; tooltip.style.display = "block";
});
canvas.addEventListener("mouseleave", () => { tooltip.style.display = "none"; });

// Fraction helpers & selection
function approximateFraction(x, maxDen = 512) { let h1 = 1, k1 = 0, h0 = 0, k0 = 1; let a = Math.floor(x); let x1 = x; let h = a*h1 + h0, k = a*k1 + k0; let iter = 0; while (k <= maxDen && Math.abs(x - h/k) > 1e-12 && iter < 64) { x1 = 1/(x1 - a); a = Math.floor(x1); h0 = h1; k0 = k1; h1 = h; k1 = k; h = a*h1 + h0; k = a*k1 + k0; iter++; } if (k > maxDen) { h = h1; k = k1; } return [h, k]; }
function centsToNearestSimpleFraction(cents) { const r = Math.pow(2, cents/1200); const [n0, d0] = approximateFraction(r, 512); function gcd(a,b){return b?gcd(b,a%b):Math.abs(a);} const g=gcd(n0,d0); const n1 = Math.round(n0/g), d1 = Math.round(d0/g); const norm = normalizeOctaveFraction(n1, d1); return [norm.n, norm.d]; }
let selectedJi = null;
canvas.addEventListener("click", (ev) => { const rect = canvas.getBoundingClientRect(); const x = ev.clientX - rect.left; const y = ev.clientY - rect.top; if (y < canvas.height / 2 || y > canvas.height) return; const jiXs = lastDraw.jiPixelXs || []; if (!jiXs.length || !lastState.ji.length) return; let bestIdx = 0, bestDx = Infinity; for (let i = 0; i < jiXs.length; i++) { const dx = Math.abs(jiXs[i] - x); if (dx < bestDx) { bestDx = dx; bestIdx = i; } } if (bestDx > 6) return; selectedJi = lastState.ji[bestIdx]; const jiObj = lastState.jiData[bestIdx]; const [an, ad] = jiObj && jiObj.n && jiObj.d ? [jiObj.n, jiObj.d] : centsToNearestSimpleFraction(selectedJi); if (selectedJiLabel) { selectedJiLabel.textContent = `Selected JI: ${an}/${ad} (${selectedJi.toFixed(2)} c)`; } if (selectionPanel) selectionPanel.style.display = "inline-block"; });
if (matchEdoBtn) { matchEdoBtn.addEventListener("click", () => { if (selectedJi == null) return; const edo = parseInt(document.getElementById("edoInput").value) || 12; const currentOct = lastState.octave || 1200; const step = currentOct / edo; let k = Math.round(selectedJi / step); if (k <= 0) k = 1; const targetOctave = (selectedJi * edo) / k; const detune = targetOctave - 1200; const detuneInput = document.getElementById("octaveDetuneInput"); if (detuneInput) { detuneInput.value = detune.toFixed(3); detuneInput.dispatchEvent(new Event("input", { bubbles: true })); } }); }
