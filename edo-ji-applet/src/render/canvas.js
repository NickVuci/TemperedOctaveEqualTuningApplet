import { COLORS, FONTS, LAYOUT } from "./constants.js";
import { computeJiLabelRows } from "./layout.js";

function getColorForDeviation(diff) {
  const absDiff = Math.abs(diff);
  if (absDiff < 0.01) return COLORS.perfect;
  if (absDiff <= 1) return COLORS.near1;
  if (absDiff <= 5) return COLORS.near5;
  if (absDiff <= 10) return COLORS.near10;
  return COLORS.far;
}

export function drawRulers({ ctx, width, height, jiIntervals, jiData, edoIntervals, showEdoLabels, showJiLabels }) {
  ctx.clearRect(0, 0, width, height);

  const { rows: jiRows, rowOf, lineH } = computeJiLabelRows({ ctx, width, jiIntervals, jiData, showJiLabels });
  const topPad = showEdoLabels ? LAYOUT.edoTopPad : 0;
  const bottomPad = showJiLabels ? (jiRows * lineH + 2) : 0;
  const barAreaH = Math.max(LAYOUT.minBarAreaH, Math.floor((height - topPad - bottomPad) / 2));
  const topRegionY = topPad;
  const bottomRegionY = topPad + barAreaH;

  // EDO bars (upper band)
  edoIntervals.forEach((c) => {
    const x = (c / 1200) * width;
    const nearest = jiIntervals.reduce((a, b) => Math.abs(b - c) < Math.abs(a - c) ? b : a, jiIntervals[0] ?? 0);
    const diff = c - nearest;
    ctx.fillStyle = getColorForDeviation(diff);
    ctx.fillRect(x, topRegionY, 2, barAreaH);
  });

  // JI bars (lower band)
  const jiXs = [];
  jiIntervals.forEach((c) => {
    const x = (c / 1200) * width;
    ctx.fillStyle = COLORS.jiBar;
    ctx.fillRect(x, bottomRegionY, 2, barAreaH);
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
      const x = (edoIntervals[i] / 1200) * width;
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
      const x = (jiIntervals[i] / 1200) * width;
      const r = rowOf[i] || 0;
      const y = labelTopY + (r + 1) * lineH - 2;
      ctx.fillText(label, x, y);
    }
  }

  return { jiPixelXs: jiXs, jiRows, jiLineH: lineH };
}
