// --- Core helpers ---
function ratioToCents(ratio) {
  return 1200 * Math.log2(ratio);
}

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

// --- JI generators & parsing ---
function parseManualIntervals(text) {
  if (!text) return [];
  const out = [];
  const parts = text
    .split(/[\s,;]+/)
    .map(s => s.trim())
    .filter(Boolean);
  for (const token of parts) {
    // fraction e.g. 3/2
    if (/^\d+\s*\/\s*\d+$/.test(token)) {
      const [n, d] = token.split("/").map(v => parseFloat(v));
      if (d !== 0 && Number.isFinite(n) && Number.isFinite(d)) {
        out.push(ratioToCents(n / d));
      }
      continue;
    }
    // explicit cents with suffix
    if (/^[-+]?\d+(?:\.\d+)?\s*(?:c|cent|cents|¢)$/i.test(token)) {
      const num = parseFloat(token);
      if (Number.isFinite(num)) out.push(num);
      continue;
    }
    // plain number -> assume cents
    const num = parseFloat(token);
    if (Number.isFinite(num)) out.push(num);
  }
  return out;
}

function uniqSortedCents(centsArray, epsilon = 0.5) {
  const sorted = [...centsArray].sort((a, b) => a - b);
  const out = [];
  for (const c of sorted) {
    if (out.length === 0 || Math.abs(c - out[out.length - 1]) > epsilon) {
      out.push(c);
    }
  }
  return out;
}

function generateOddLimitFractions(oddLimit = 7) {
  // Only accept odd numbers; if even, decrement by 1
  let lim = Math.max(1, Math.floor(oddLimit));
  if (lim % 2 === 0) lim -= 1;
  const fracs = [];
  function gcd(a, b) { return b ? gcd(b, a % b) : Math.abs(a); }
  for (let n = 1; n <= lim; n += 2) {
    for (let d = 1; d <= lim; d += 2) {
      if (gcd(n, d) !== 1) continue;
      fracs.push([n, d]);
    }
  }
  return fracs;
}

function maxPrimeFactor(n) {
  if (n <= 1) return 1;
  let num = n;
  let maxP = 1;
  while (num % 2 === 0) { maxP = 2; num = Math.floor(num / 2); }
  for (let p = 3; p * p <= num; p += 2) {
    while (num % p === 0) { maxP = p; num = Math.floor(num / p); }
  }
  if (num > 1) maxP = num;
  return maxP;
}

function filterFractionsByPrimeLimit(fracs, primeLimit) {
  if (!Number.isFinite(primeLimit) || primeLimit <= 0) return fracs;
  const lim = Math.floor(primeLimit);
  return fracs.filter(([n, d]) => maxPrimeFactor(n) <= lim && maxPrimeFactor(d) <= lim);
}

function fractionsToCents(fracs) {
  const vals = new Set();
  for (const [n, d] of fracs) {
    let r = n / d;
    if (r <= 0) continue;
    // Map to [1, 2)
    while (r < 1) r *= 2;
    while (r >= 2) r /= 2;
    const c = ratioToCents(r);
    if (c >= 0 && c <= 1200) vals.add(Math.round(c * 1000) / 1000);
  }
  // Always include 0 (1/1)
  vals.add(0);
  return Array.from(vals).sort((a, b) => a - b);
}

// --- Drawing ---
let lastDraw = { jiPixelXs: [] };
function drawRulers(ctx, jiIntervals, edoIntervals, width, height) {
  ctx.clearRect(0, 0, width, height);
  const half = height / 2;

  // JI intervals: bottom half
  const jiXs = [];
  jiIntervals.forEach(c => {
    const x = (c / 1200) * width;
    ctx.fillStyle = "blue";
    ctx.fillRect(x, half, 2, half);
    jiXs.push(x);
  });
  lastDraw.jiPixelXs = jiXs;

  // EDO intervals: top half
  edoIntervals.forEach(c => {
    const x = (c / 1200) * width;
    const nearest = jiIntervals.reduce((a, b) => Math.abs(b - c) < Math.abs(a - c) ? b : a, jiIntervals[0] ?? 0);
    const diff = c - nearest;
    ctx.fillStyle = getColorForDeviation(diff);
    ctx.fillRect(x, 0, 2, half);
  });
}

// --- Wiring ---
const canvas = document.getElementById("visualizer");
const ctx = canvas.getContext("2d");
const tooltip = document.getElementById("tooltip");
const octaveTotalDisplay = document.getElementById("octaveTotalDisplay");
const selectionPanel = document.getElementById("selectionPanel");
const selectedJiLabel = document.getElementById("selectedJiLabel");
const matchEdoBtn = document.getElementById("matchEdoBtn");

let lastState = {
  ji: [],
  edo: [],
  octave: 1200,
};

function buildJI() {
  // Enforce odd-only for odd-limit (even inputs become previous odd)
  let oddLimit = parseInt(document.getElementById("oddLimitInput").value);
  if (Number.isFinite(oddLimit) && oddLimit % 2 === 0) oddLimit = oddLimit - 1;
  const primeLimit = parseInt(document.getElementById("primeLimitInput").value);
  const manual = parseManualIntervals(document.getElementById("manualIntervals").value);

  let ji = [];
  // Generate odd-limit fractions first
  if (Number.isFinite(oddLimit) && oddLimit > 0) {
    let fracs = generateOddLimitFractions(oddLimit);
    // Apply prime-limit as a filter if > 0
    fracs = filterFractionsByPrimeLimit(fracs, primeLimit);
    ji = fractionsToCents(fracs);
  } else {
    // Fallback to a minimal set if odd-limit not specified
    ji = [0, ratioToCents(5/4), ratioToCents(3/2)];
  }
  // Manual entries
  ji = ji.concat(manual);

  // Fallback defaults if empty
  if (ji.length === 0) {
    ji = [ratioToCents(3/2), ratioToCents(5/4), ratioToCents(7/4)];
  }

  // Keep within [0,1200], unique and sorted
  ji = ji.filter(c => Number.isFinite(c) && c >= 0 && c <= 1200);
  ji = uniqSortedCents(ji);
  return ji;
}

function update() {
  const edo = parseInt(document.getElementById("edoInput").value);
  const detune = parseFloat(document.getElementById("octaveDetuneInput").value) || 0;
  const octaveCents = 1200 + detune;
  if (octaveTotalDisplay) {
    octaveTotalDisplay.textContent = `Octave: ${octaveCents.toFixed(2)} c`;
  }

  const jiIntervals = buildJI();
  const edoIntervals = generateEDOIntervals(edo, octaveCents);
  drawRulers(ctx, jiIntervals, edoIntervals, canvas.width, canvas.height);

  lastState = { ji: jiIntervals, edo: edoIntervals, octave: octaveCents };
}

// Debounce updates to stay responsive when inputs change rapidly
let updateTimer = null;
function queuedUpdate() {
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(() => {
    update();
    updateTimer = null;
  }, 80);
}

document.querySelectorAll("input, textarea").forEach(el => el.addEventListener("input", queuedUpdate));

update();

// --- Hover tooltip ---
function nearestValue(arr, target) {
  if (!arr || arr.length === 0) return undefined;
  return arr.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a), arr[0]);
}

canvas.addEventListener("mousemove", (ev) => {
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  const cents = (x / canvas.width) * 1200;

  const nearestEDO = nearestValue(lastState.edo, cents);
  const nearestJI = nearestValue(lastState.ji, cents);
  const diff = nearestEDO !== undefined && nearestJI !== undefined ? (nearestEDO - nearestJI) : undefined;

  if (nearestEDO === undefined) {
    tooltip.style.display = "none";
    return;
  }

  let html = `Cents: ${cents.toFixed(2)}`;
  html += `<br/>Nearest EDO: ${nearestEDO.toFixed(2)}c`;
  if (nearestJI !== undefined) {
    html += `<br/>Nearest JI: ${nearestJI.toFixed(2)}c`;
    html += `<br/>Deviation: ${(diff).toFixed(2)}c`;
  }

  tooltip.innerHTML = html;
  tooltip.style.left = `${ev.clientX}px`;
  tooltip.style.top = `${ev.clientY}px`;
  tooltip.style.display = "block";
});

canvas.addEventListener("mouseleave", () => {
  tooltip.style.display = "none";
});

// --- Fraction helpers ---
function approximateFraction(x, maxDen = 512) {
  // Continued fraction approximation for x
  let h1 = 1, k1 = 0, h0 = 0, k0 = 1;
  let a = Math.floor(x);
  let x1 = x;
  let h = a*h1 + h0, k = a*k1 + k0;
  let iter = 0;
  while (k <= maxDen && Math.abs(x - h/k) > 1e-12 && iter < 64) {
    x1 = 1/(x1 - a);
    a = Math.floor(x1);
    h0 = h1; k0 = k1; h1 = h; k1 = k;
    h = a*h1 + h0; k = a*k1 + k0;
    iter++;
  }
  if (k > maxDen) { h = h1; k = k1; }
  return [h, k];
}

function centsToNearestSimpleFraction(cents) {
  const r = Math.pow(2, cents/1200);
  const [n, d] = approximateFraction(r, 512);
  function gcd(a,b){return b?gcd(b,a%b):Math.abs(a);} const g=gcd(n,d);
  return [Math.round(n/g), Math.round(d/g)];
}

let selectedJi = null; // cents value

canvas.addEventListener("click", (ev) => {
  const rect = canvas.getBoundingClientRect();
  const x = ev.clientX - rect.left;
  const y = ev.clientY - rect.top;
  // Only consider clicks in the bottom half for JI selection
  if (y < canvas.height / 2 || y > canvas.height) return;
  const jiXs = lastDraw.jiPixelXs || [];
  if (!jiXs.length || !lastState.ji.length) return;
  let bestIdx = 0, bestDx = Infinity;
  for (let i = 0; i < jiXs.length; i++) {
    const dx = Math.abs(jiXs[i] - x);
    if (dx < bestDx) { bestDx = dx; bestIdx = i; }
  }
  if (bestDx > 6) return; // tolerance in pixels
  selectedJi = lastState.ji[bestIdx];
  const [n, d] = centsToNearestSimpleFraction(selectedJi);
  if (selectedJiLabel) {
    selectedJiLabel.textContent = `Selected JI: ${n}/${d} (${selectedJi.toFixed(2)} c)`;
  }
  if (selectionPanel) selectionPanel.style.display = "inline-block";
});

// Match nearest EDO step by adjusting detuning
if (matchEdoBtn) {
  matchEdoBtn.addEventListener("click", () => {
    if (selectedJi == null) return;
    const edo = parseInt(document.getElementById("edoInput").value) || 12;
    const currentOct = lastState.octave || 1200;
    const step = currentOct / edo;
    let k = Math.round(selectedJi / step);
    if (k <= 0) k = 1; // avoid division by zero and negative
    const targetOctave = (selectedJi * edo) / k;
    const detune = targetOctave - 1200;
    const detuneInput = document.getElementById("octaveDetuneInput");
    if (detuneInput) {
      detuneInput.value = detune.toFixed(3);
      detuneInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
}
