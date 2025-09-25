import { COLORS, FONTS, LAYOUT } from "./constants.js";
import { computeJiLabelRows } from "./layout.js";
import { mapCentsToX } from "./scale.js";

// Tri-color gradient: green at 0c, yellow at 5c, red at 15c; above 15c, use black
const RED_DEV = 15;     // cents → red
const YELLOW_DEV = 5;   // cents → yellow
function getColorForDeviation(diff) {
  const a = Math.abs(diff);
  // Exact/near-exact match: solid green
  if (a < 0.01) return COLORS.perfect;
  // Beyond gradient range: black
  if (a > RED_DEV) return COLORS.far;
  // 0..5c: green (0,128,0) → yellow (255,255,0)
  if (a <= YELLOW_DEV) {
    const t = a / YELLOW_DEV; // 0 at green, 1 at yellow
    const r = Math.round(255 * t);
    const g = Math.round(128 + (255 - 128) * t);
    return `rgb(${r}, ${g}, 0)`;
  }
  // 5..15c: yellow (255,255,0) → red (255,0,0)
  const t = (a - YELLOW_DEV) / (RED_DEV - YELLOW_DEV); // 0 at yellow, 1 at red
  const r = 255;
  const g = Math.round(255 * (1 - t));
  return `rgb(${r}, ${g}, 0)`;
}

/**
 * Draw the EDO and JI rulers onto the canvas.
 * @param {{ctx:CanvasRenderingContext2D,width:number,height:number,jiIntervals:number[],jiData:any[],edoIntervals:number[],edoOriginalIntervals?:number[],showEdoLabels:boolean,showJiLabels:boolean,selectedJiIndex?:number|null}} args
 * @returns {{jiPixelXs:number[],jiRows:number,jiLineH:number}}
 */
export function drawRulers({ ctx, width, height, jiIntervals, jiData, edoIntervals, edoOriginalIntervals = edoIntervals, showEdoLabels, showJiLabels, selectedJiIndex = null }) {
  ctx.clearRect(0, 0, width, height);

  const { rows: jiRows, rowOf, lineH } = computeJiLabelRows({ ctx, width, jiIntervals, jiData, showJiLabels });
  const topPad = showEdoLabels ? LAYOUT.edoTopPad : 0;
  const bottomPad = showJiLabels ? (jiRows * lineH + 2) : 0;
  const barAreaH = Math.max(LAYOUT.minBarAreaH, Math.floor((height - topPad - bottomPad) / 2));
  const topRegionY = topPad;
  const bottomRegionY = topPad + barAreaH;

  // EDO bars (upper band) using two-pointer sweep for nearest JI
  const domainCents = 1200 + LAYOUT.centsRightBuffer;
  // Two-pointer sweep driven by CURRENT (possibly detuned) EDO cents to determine nearest JI for deviation/coloring
  let j = 0;
  for (let i = 0; i < edoIntervals.length; i++) {
    const cDetuned = edoIntervals[i];
    if (cDetuned == null) continue;
    while (j + 1 < jiIntervals.length && Math.abs(jiIntervals[j + 1] - cDetuned) <= Math.abs(jiIntervals[j] - cDetuned)) {
      j++;
    }
    const nearest = jiIntervals.length ? jiIntervals[j] : 0;
  const x = mapCentsToX(cDetuned, width, LAYOUT.hPad, domainCents);
  const diff = cDetuned - nearest;
  ctx.fillStyle = getColorForDeviation(diff);
  const barWidth = 2;
  const xLeft = x - Math.floor(barWidth / 2);
  ctx.fillRect(xLeft, topRegionY, barWidth, barAreaH);
  }

  // JI bars (lower band)
  const jiXs = [];
  jiIntervals.forEach((c, idx) => {
    const x = mapCentsToX(c, width, LAYOUT.hPad, domainCents);
    const isSelected = selectedJiIndex != null && idx === selectedJiIndex;
    ctx.fillStyle = COLORS.jiBar;
    const barWidth = isSelected ? 4 : 2;
    const xLeft = x - Math.floor(barWidth / 2);
    ctx.fillRect(xLeft, bottomRegionY, barWidth, barAreaH);
    jiXs.push(x);
  });

  // Labels
  ctx.font = FONTS.label;
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'center';

  if (showEdoLabels) {
    ctx.textBaseline = 'bottom';
    let lastRight = -Infinity;
    for (let i = 0; i < edoIntervals.length; i++) {
      const x = mapCentsToX(edoIntervals[i], width, LAYOUT.hPad, domainCents);
      const label = String(i);
      const w = ctx.measureText(label).width + 6;
      if (x - w / 2 > lastRight + 2) {
        ctx.fillText(label, x, topRegionY - 2);
        lastRight = x + w / 2;
      }
    }
  }

  if (showJiLabels && jiRows > 0) {
    ctx.textBaseline = 'bottom';
    const labelTopY = bottomRegionY + barAreaH;
    for (let i = 0; i < jiIntervals.length; i++) {
      const jiObj = jiData[i];
      const label = (jiObj && jiObj.n && jiObj.d) ? `${jiObj.n}/${jiObj.d}` : '';
      if (!label) continue;
      const x = mapCentsToX(jiIntervals[i], width, LAYOUT.hPad, domainCents);
      const r = rowOf[i] || 0;
      const y = labelTopY + (r + 1) * lineH - 2;
      ctx.fillText(label, x, y);
    }
  }

  return { jiPixelXs: jiXs, jiRows, jiLineH: lineH };
}
