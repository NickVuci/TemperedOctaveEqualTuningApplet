import { centsToNearestSimpleFraction } from "../utils/math.js";
import { nearestIndex, nearestValue } from "../utils/array.js";
import { mapXToCents } from "../render/scale.js";
import { LAYOUT } from "../render/constants.js";
import { setState } from "../state/store.js";

/**
 * Query and return all required DOM elements and the canvas context.
 */
export function getElements() {
  const canvas = document.getElementById("visualizer");
  const ctx = canvas.getContext("2d");
  return {
    canvas,
    ctx,
    canvasContainer: document.getElementById("canvasContainer"),
    tooltip: document.getElementById("tooltip"),
    octaveTotalDisplay: document.getElementById("octaveTotalDisplay"),
  periodInput: document.getElementById("periodInput"),
    selectionPanel: document.getElementById("selectionPanel"),
    selectedJiLabel: document.getElementById("selectedJiLabel"),
    matchEdoBtn: document.getElementById("matchEdoBtn"),
  optimizeDetuneBtn: document.getElementById("optimizeDetuneBtn"),
    optimizeSchemeSelect: document.getElementById("optimizeSchemeSelect"),
    symmetricOptimize: document.getElementById("symmetricOptimize"),
    optWithin: document.getElementById("optWithin"),
    optBonus5: document.getElementById("optBonus5"),
    optBonus1: document.getElementById("optBonus1"),
    optPower: document.getElementById("optPower"),
    optOddPower: document.getElementById("optOddPower"),
    optPrimePower: document.getElementById("optPrimePower"),
    showEdoLabelsEl: document.getElementById("showEdoLabels"),
    showJiLabelsEl: document.getElementById("showJiLabels"),
    edoInput: document.getElementById("edoInput"),
    oddLimitInput: document.getElementById("oddLimitInput"),
    primeLimitInput: document.getElementById("primeLimitInput"),
    manualIntervals: document.getElementById("manualIntervals"),
    octaveDetuneInput: document.getElementById("octaveDetuneInput"),
    octaveDetuneSlider: document.getElementById("octaveDetuneSlider"),
    detuneRangeMax: document.getElementById("detuneRangeMax"),
  };
}

/**
 * Read UI control values into a typed object.
 */
export function readControls(els) {
  const edo = parseInt(els.edoInput.value);
  const detune = parseFloat(els.octaveDetuneInput.value) || 0;
  let periodRaw = (els.periodInput?.value || '2/1').trim();
  let periodNum = 2, periodDen = 1, baseCents = 1200;
  if (/^\d+\s*\/\s*\d+$/.test(periodRaw)) {
    const [nStr, dStr] = periodRaw.split('/');
    const n = parseInt(nStr.trim());
    const d = parseInt(dStr.trim());
    if (n > 0 && d > 0) {
      periodNum = n; periodDen = d;
      baseCents = 1200 * Math.log2(n / d);
    }
  } else if (/^[-+]?\d+(?:\.\d+)?$/.test(periodRaw)) {
    const v = parseFloat(periodRaw);
    if (Number.isFinite(v) && v > 0) {
      baseCents = v; // treat as direct cents
      // derive approximate ratio? keep 2/1 placeholder if not ratio
      periodNum = 0; periodDen = 0; // indicates "no ratio"
    }
  }
  const oddLimit = parseInt(els.oddLimitInput.value);
  const primeLimit = parseInt(els.primeLimitInput.value);
  const manualText = els.manualIntervals.value;
  return {
    edo,
    periodNum,
    periodDen,
    basePeriodCents: baseCents,
    octaveCents: baseCents + detune,
    detune,
    oddLimit,
    primeLimit,
    manualText,
    showEdoLabels: !!(els.showEdoLabelsEl && els.showEdoLabelsEl.checked),
    showJiLabels: !!(els.showJiLabelsEl && els.showJiLabelsEl.checked),
  };
}

/**
 * Attach input listeners.
 * - Numeric and range inputs trigger immediate updates for real-time feedback.
 * - Textareas and other inputs use queued (debounced) updates.
 * Skips attaching a generic handler to the octave slider; it's managed explicitly in main.js.
 */
export function wireControls(onChangeQueued, onChangeImmediate) {
  const els = Array.from(document.querySelectorAll("input, textarea"));
  els.forEach(el => {
    if (!(el instanceof HTMLElement)) return;
    // Skip the detune slider; it's wired manually for fine control in main.js
    if (el.id === 'octaveDetuneSlider') return;
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    const isImmediate = (tag === 'input' && (type === 'number' || type === 'range' || type === 'checkbox'));
    el.addEventListener('input', isImmediate && onChangeImmediate ? onChangeImmediate : onChangeQueued);
  });
}

/**
 * Update the "Octave: ... c" label.
 */
export function updateOctaveDisplay(els, octaveCents) {
  if (els.octaveTotalDisplay) {
    const raw = (els.periodInput?.value || '').trim();
    let labelRatio = '';
    if (/^\d+\s*\/\s*\d+$/.test(raw)) labelRatio = raw.replace(/\s+/g,'');
    els.octaveTotalDisplay.textContent = `Period: ${labelRatio || '(cents)'} = ${octaveCents.toFixed(2)} c`;
  }
}

/**
 * Wire up mousemove/leave events to show a tooltip with nearest EDO/JI info.
 */
export function wireTooltip(els, getState) {
  const { canvas, tooltip } = els;
  let lastClientX = 0;
  let lastClientY = 0;
  let isInside = false;

  function renderAt(clientX, clientY) {
    const state = getState();
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width;
    const x = clientX - rect.left;
      const period = state.basePeriod || 1200;
      const cents = mapXToCents(x, cssW, LAYOUT.hPad, period + LAYOUT.centsRightBuffer);
    // Use CURRENT (possibly detuned) EDO positions for matching/tooltip
    const edoDetuned = state.edo && state.edo.length
      ? state.edo
      : (state.edoCount && state.octave
          ? Array.from({ length: (state.edoCount + 1) }, (_, i) => i * (state.octave / state.edoCount))
          : []);
    const nearestEDO = nearestValue(edoDetuned, cents);
    if (nearestEDO === undefined) { tooltip.style.display = "none"; return; }
    const nearestJI = nearestValue(state.ji, cents);
    const diff = (nearestEDO !== undefined && nearestJI !== undefined) ? (nearestEDO - nearestJI) : undefined;

    let html = `Cents: ${cents.toFixed(2)}`;
    if (nearestEDO !== undefined) {
      const k = nearestIndex(edoDetuned, nearestEDO);
      const n = (k >= 0) ? k : 0;
      const edoCount = state.edoCount || (edoDetuned.length - 1);
      html += `<br/>Nearest EDO: ${nearestEDO.toFixed(2)}c (step ${n}/${edoCount})`;
    }
    if (nearestJI !== undefined) {
      const jIdx = nearestIndex(state.ji, nearestJI);
      const jiObj = jIdx >= 0 ? state.jiData[jIdx] : undefined;
      const frac = jiObj && jiObj.n && jiObj.d
        ? `${jiObj.n}/${jiObj.d}`
        : (function(){ const [an, ad] = centsToNearestSimpleFraction(nearestJI); return `${an}/${ad}`; })();
      html += `<br/>Nearest JI: ${nearestJI.toFixed(2)}c (${frac})`;
    }
    if (diff !== undefined) html += `<br/>Deviation: ${(diff).toFixed(2)}c`;
    tooltip.innerHTML = html;
    tooltip.style.left = `${clientX}px`;
    tooltip.style.top = `${clientY}px`;
    tooltip.style.display = "block";
  }

  canvas.addEventListener("mousemove", (ev) => {
    lastClientX = ev.clientX;
    lastClientY = ev.clientY;
    isInside = true;
    renderAt(ev.clientX, ev.clientY);
  });
  canvas.addEventListener("mouseleave", () => {
    isInside = false;
    tooltip.style.display = "none";
  });

  // Return a refresh function to update tooltip at last position when state changes
  return function refreshTooltip() {
    if (!isInside) return;
    renderAt(lastClientX, lastClientY);
  };
}

/**
 * Wire click selection to pick a JI tick and the match-EDO button to retune octave.
 */
export function wireSelection(els, getState, setDetune) {
  const { canvas, showEdoLabelsEl, showJiLabelsEl, selectionPanel, selectedJiLabel, matchEdoBtn, edoInput } = els;
  let selectedJi = null;
  canvas.addEventListener("click", (ev) => {
    const state = getState();
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width;
    const cssH = rect.height;
    const x = ev.clientX - rect.left; const y = ev.clientY - rect.top;
    const showJiLabels = !!(showJiLabelsEl && showJiLabelsEl.checked);
    // Approximate the same layout as drawRulers uses for picking
    const showEdoLabels = !!(showEdoLabelsEl && showEdoLabelsEl.checked);
    const topPad = showEdoLabels ? 18 : 0;
    const jiRows = state.jiRows || 0;
    const lineH = state.jiLineH || 14;
    const bottomPad = showJiLabels ? (jiRows * lineH + 2) : 0;
    const barAreaH = Math.max(10, Math.floor((cssH - topPad - bottomPad) / 2));
    const bottomRegionY = topPad + barAreaH;
    const bottomRegionY2 = bottomRegionY + barAreaH;
    if (y < bottomRegionY || y > bottomRegionY2) return;
    const jiXs = state.jiPixelXs || [];
    if (!jiXs.length || !state.ji.length) return;
    let bestIdx = 0, bestDx = Infinity;
    for (let i = 0; i < jiXs.length; i++) {
      const dx = Math.abs(jiXs[i] - x);
      if (dx < bestDx) { bestDx = dx; bestIdx = i; }
    }
    if (bestDx > 6) return;
    selectedJi = state.ji[bestIdx];
    // Persist selection index so renderer can bold it
    setState({ selectedJiIndex: bestIdx });
    // Trigger a repaint via input event on a hidden control isn't ideal; rely on the selection panel show for now
    // The main loop will repaint on next queuedUpdate or any input; to ensure immediate feedback, force a small async paint
    requestAnimationFrame(() => {
      const ev = new Event('resize');
      window.dispatchEvent(ev);
    });
    const jiObj = state.jiData[bestIdx];
    const [an, ad] = jiObj && jiObj.n && jiObj.d ? [jiObj.n, jiObj.d] : centsToNearestSimpleFraction(selectedJi);
    if (selectedJiLabel) {
      selectedJiLabel.textContent = `Selected JI: ${an}/${ad} (${selectedJi.toFixed(2)} c)`;
    }
    if (selectionPanel) selectionPanel.style.display = "inline-block";
  });

  if (matchEdoBtn) {
    matchEdoBtn.addEventListener("click", () => {
      const state = getState();
      if (selectedJi == null) return;
      const edo = parseInt(edoInput.value) || 12;
      // Use original step size for matching
  const basePeriod = state.basePeriod || 1200;
  const step = basePeriod / edo;
      let k = Math.round(selectedJi / step);
      if (k <= 0) k = 1;
  const targetPeriod = (selectedJi * edo) / k;
  const detune = targetPeriod - basePeriod;
      setDetune(detune);
    });
  }
}
