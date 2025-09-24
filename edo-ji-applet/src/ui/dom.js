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
    selectionPanel: document.getElementById("selectionPanel"),
    selectedJiLabel: document.getElementById("selectedJiLabel"),
    matchEdoBtn: document.getElementById("matchEdoBtn"),
    showEdoLabelsEl: document.getElementById("showEdoLabels"),
    showJiLabelsEl: document.getElementById("showJiLabels"),
    edoInput: document.getElementById("edoInput"),
    oddLimitInput: document.getElementById("oddLimitInput"),
    primeLimitInput: document.getElementById("primeLimitInput"),
    manualIntervals: document.getElementById("manualIntervals"),
    octaveDetuneInput: document.getElementById("octaveDetuneInput"),
  };
}

/**
 * Read UI control values into a typed object.
 */
export function readControls(els) {
  const edo = parseInt(els.edoInput.value);
  const detune = parseFloat(els.octaveDetuneInput.value) || 0;
  const oddLimit = parseInt(els.oddLimitInput.value);
  const primeLimit = parseInt(els.primeLimitInput.value);
  const manualText = els.manualIntervals.value;
  return {
    edo,
    octaveCents: 1200 + detune,
    detune,
    oddLimit,
    primeLimit,
    manualText,
    showEdoLabels: !!(els.showEdoLabelsEl && els.showEdoLabelsEl.checked),
    showJiLabels: !!(els.showJiLabelsEl && els.showJiLabelsEl.checked),
  };
}

/**
 * Attach input listeners to trigger debounced updates.
 */
export function wireControls(onChange) {
  document.querySelectorAll("input, textarea").forEach(el => el.addEventListener("input", onChange));
}

/**
 * Update the "Octave: ... c" label.
 */
export function updateOctaveDisplay(els, octaveCents) {
  if (els.octaveTotalDisplay) {
    els.octaveTotalDisplay.textContent = `Octave: ${octaveCents.toFixed(2)} c`;
  }
}

/**
 * Wire up mousemove/leave events to show a tooltip with nearest EDO/JI info.
 */
export function wireTooltip(els, getState) {
  const { canvas, tooltip } = els;
  canvas.addEventListener("mousemove", (ev) => {
    const state = getState();
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width;
    const x = ev.clientX - rect.left;
  const cents = mapXToCents(x, cssW, LAYOUT.hPad, 1200 + LAYOUT.centsRightBuffer);
    // For matching, use ORIGINAL EDO positions (1200c based)
    const edoOriginal = state.edoOriginal && state.edoOriginal.length ? state.edoOriginal : (state.edoCount ? Array.from({length: (state.edoCount + 1)}, (_, i) => i * (1200 / state.edoCount)) : []);
    const nearestEDO = nearestValue(edoOriginal, cents);
    const nearestJI = nearestValue(state.ji, cents);
    const diff = (nearestEDO !== undefined && nearestJI !== undefined) ? (nearestEDO - nearestJI) : undefined;
    if (nearestEDO === undefined) { tooltip.style.display = "none"; return; }
    let html = `Cents: ${cents.toFixed(2)}`;
    if (nearestEDO !== undefined) {
      const k = nearestIndex(edoOriginal, nearestEDO);
      const n = (k >= 0) ? k : 0;
      const edoCount = state.edoCount || (edoOriginal.length - 1);
      html += `<br/>Nearest EDO: ${nearestEDO.toFixed(2)}c (step ${n}/${edoCount})`;
    }
    if (nearestJI !== undefined) {
      const jIdx = nearestIndex(state.ji, nearestJI);
      const jiObj = jIdx >= 0 ? state.jiData[jIdx] : undefined;
      const frac = jiObj && jiObj.n && jiObj.d ? `${jiObj.n}/${jiObj.d}` : (function(){ const [an, ad] = centsToNearestSimpleFraction(nearestJI); return `${an}/${ad}`; })();
      html += `<br/>Nearest JI: ${nearestJI.toFixed(2)}c (${frac})`;
    }
    if (diff !== undefined) html += `<br/>Deviation: ${(diff).toFixed(2)}c`;
    tooltip.innerHTML = html;
    tooltip.style.left = `${ev.clientX}px`;
    tooltip.style.top = `${ev.clientY}px`;
    tooltip.style.display = "block";
  });
  canvas.addEventListener("mouseleave", () => { tooltip.style.display = "none"; });
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
      const step = 1200 / edo;
      let k = Math.round(selectedJi / step);
      if (k <= 0) k = 1;
      const targetOctave = (selectedJi * edo) / k;
      const detune = targetOctave - 1200;
      setDetune(detune);
    });
  }
}
