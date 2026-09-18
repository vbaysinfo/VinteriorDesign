import React, { useState } from 'react';

// Builds an SVG path for a horizontal bar rounded only on the far (tip) end
// and square where it meets the baseline - rounding both ends of a magnitude
// bar reads as a pill/progress-track rather than a bar.
function hBarPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w, h / 2));
  if (w <= 0) return '';
  if (rr === 0) return `M${x},${y} h${w} v${h} h${-w} Z`;
  return `M${x},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} H${x} Z`;
}

export interface BarDatum {
  label: string;
  value: number;
}

interface HorizontalBarChartProps {
  data: BarDatum[];
  color: string;
  unit?: string;
  valueFormatter?: (v: number) => string;
}

// A single-hue horizontal bar chart for comparing one magnitude across a
// handful of categories (rooms, sheet thicknesses, laminate colors). Value
// labels sit at the tip of every bar - with this few categories that's the
// direct-label default, not the "never label every point" density problem
// that rule is aimed at (dense lines/scatter).
export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({
  data,
  color,
  unit = '',
  valueFormatter = (v) => v.toLocaleString(),
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const barH = 14;
  const rowH = 24;
  const labelW = 112;
  const chartW = 460;
  const tipReserve = 92;
  const plotW = chartW - labelW - tipReserve;
  const max = Math.max(...data.map((d) => d.value), 1);
  const svgH = data.length * rowH;

  if (data.length === 0) return null;

  return (
    // Capped at a fixed max width instead of scaling to fill whatever card
    // it sits in - full-width cards would otherwise blow the viewBox up 3x+
    // (giant bars, oversized text), which reads as unpolished, not "modern".
    <div className="max-w-[520px]">
      <svg width="100%" viewBox={`0 0 ${chartW} ${svgH}`} className="overflow-visible" role="img" aria-label={`Bar chart: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}>
        {data.map((d, i) => {
          const y = i * rowH + (rowH - barH) / 2;
          const w = Math.max(2, (d.value / max) * plotW);
          const isHovered = hoverIdx === i;
          // A label that won't fit doesn't get clipped mid-character - truncate
          // with an ellipsis and keep the full text reachable via the native
          // <title> tooltip on hover/focus, same "never gate a value" rule the
          // hover layer follows.
          const maxChars = 16;
          const displayLabel = d.label.length > maxChars ? `${d.label.slice(0, maxChars - 1)}…` : d.label;
          return (
            <g key={d.label}>
              <text
                x={labelW - 8}
                y={y + barH / 2}
                textAnchor="end"
                dominantBaseline="central"
                fontSize="10"
                fontWeight={isHovered ? 800 : 600}
                fill="#475569"
              >
                {displayLabel !== d.label && <title>{d.label}</title>}
                {displayLabel}
              </text>
              {/* Hit target spans the full row, not just the painted bar, so hover is easy to land */}
              <rect
                x={labelW}
                y={i * rowH}
                width={plotW + tipReserve}
                height={rowH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                <title>
                  {d.label}: {valueFormatter(d.value)}
                  {unit}
                </title>
              </rect>
              <path d={hBarPath(labelW, y, w, barH, 2.5)} fill={color} opacity={isHovered ? 1 : 0.85} />
              <text
                x={labelW + w + 6}
                y={y + barH / 2}
                dominantBaseline="central"
                fontSize="10"
                fontWeight="700"
                fill="#0f172a"
                fontFamily="ui-monospace, monospace"
              >
                {valueFormatter(d.value)}
                {unit}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export interface CompositionSegment {
  label: string;
  value: number;
  color: string;
}

// A single stacked bar for part-to-whole composition (used / offcut / waste
// as fractions of total board area bought) - the recommended form for
// part-to-whole over a donut. Plain HTML/CSS flex segments rather than SVG:
// a percentage-unit SVG viewBox stretched non-uniformly to fill the card's
// actual pixel width distorts any text drawn inside it, so the in-bar
// percentage label is ordinary HTML text instead. Segments too narrow for
// their own label skip it rather than clip; the legend below always carries
// the exact value and percentage so nothing is gated behind hover.
export const MaterialCompositionBar: React.FC<{ segments: CompositionSegment[]; unit?: string }> = ({
  segments,
  unit = 'sq.ft',
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const bars = segments.map((seg, i) => ({ ...seg, pct: (seg.value / total) * 100, i }));

  return (
    // No max-width here, unlike the SVG bar charts below - this bar is plain
    // HTML/CSS with percentage widths, so it fills its card cleanly at any
    // width instead of leaving the rest of a full-width card empty.
    <div>
      <div className="flex w-full rounded-md overflow-hidden gap-0.5" style={{ height: 28 }}>
        {bars.map((b) => (
          <div
            key={b.label}
            title={`${b.label}: ${b.value.toLocaleString()} ${unit} (${b.pct.toFixed(1)}%)`}
            onMouseEnter={() => setHoverIdx(b.i)}
            onMouseLeave={() => setHoverIdx(null)}
            className="h-full flex items-center justify-center transition-opacity cursor-default"
            style={{ width: `${b.pct}%`, backgroundColor: b.color, opacity: hoverIdx === null || hoverIdx === b.i ? 1 : 0.4 }}
          >
            {b.pct >= 6 && <span className="text-white text-xs font-extrabold select-none">{b.pct.toFixed(0)}%</span>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3">
        {bars.map((b) => (
          <div
            key={b.label}
            className="flex items-center gap-1.5 text-sm cursor-default"
            onMouseEnter={() => setHoverIdx(b.i)}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: b.color }} />
            <span className="text-slate-600">{b.label}:</span>
            <span className="font-mono font-bold text-slate-900">
              {b.value.toLocaleString()} {unit} ({b.pct.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export interface StackedBarRow {
  label: string;
  // One value per series, same order/length as `seriesLabels`/`seriesColors`.
  values: number[];
}

interface StackedHorizontalBarChartProps {
  data: StackedBarRow[];
  seriesLabels: string[];
  seriesColors: string[];
  unit?: string;
  // When set, every row except the one matching this label dims - the
  // "emphasis" form: one row is the point (e.g. the app's currently active
  // room), the rest stay as context rather than competing for attention.
  highlightLabel?: string;
}

// A grouped set of horizontal stacked bars - one bar per category (room),
// each split into the same N series (e.g. Used vs Waste) - so both how much
// material a room needs AND how much of that is wasted read off one shared
// scale, sorted by whichever order the caller passes in. All bars share one
// x-scale (the largest row's total) so magnitudes stay comparable across
// rows, the same way HorizontalBarChart's single-series bars do.
export const StackedHorizontalBarChart: React.FC<StackedHorizontalBarChartProps> = ({
  data,
  seriesLabels,
  seriesColors,
  unit = '',
  highlightLabel,
}) => {
  const [hover, setHover] = useState<{ row: number; seg: number } | null>(null);
  const barH = 15;
  const rowH = 26;
  const labelW = 108;
  const chartW = 460;
  const tipReserve = 82;
  const plotW = chartW - labelW - tipReserve;
  const gap = 0.6;
  const totals = data.map((d) => d.values.reduce((s, v) => s + v, 0));
  const max = Math.max(...totals, 1);
  const svgH = data.length * rowH;

  if (data.length === 0) return null;

  return (
    // Same fixed max width as the single-series chart - keeps every chart on
    // this page reading at the same scale instead of some blowing up to fill
    // whichever card happens to be widest.
    <div className="max-w-[560px]">
      <svg width="100%" viewBox={`0 0 ${chartW} ${svgH}`} className="overflow-visible" role="img">
        {data.map((row, ri) => {
          const y = ri * rowH + (rowH - barH) / 2;
          const total = totals[ri];

          // Every nonzero series gets a floor on its rendered width so a
          // small-but-real value (a low-waste room's Waste segment) never
          // shrinks to an invisible sliver next to a much larger one - a bar
          // that visually reads as "just one color" is a bar that's hiding
          // data. Segments are laid out from these rendered widths (not the
          // raw proportional ones) so they still tile edge to edge with no
          // gaps or overlap; the trade-off is the total can run slightly
          // past its "true" proportional length when a floor kicks in.
          const MIN_SEG_W = 6;
          const rawWidths = row.values.map((v) => (v / max) * plotW);
          const renderedWidths = rawWidths.map((rw, si) =>
            row.values[si] > 0 ? Math.max(rw, MIN_SEG_W) : 0
          );

          // Lay segments out edge-to-edge from the floored widths (not the
          // raw proportional ones), so the floor never creates a gap or an
          // overlap between segments.
          let runningX = labelW;
          const segmentPositions = renderedWidths.map((fullW) => {
            const segX = runningX;
            runningX += fullW;
            return segX;
          });
          const renderedTotalW = runningX - labelW;
          const isRowHighlighted = highlightLabel === row.label;
          const isRowDimmed = highlightLabel !== undefined && !isRowHighlighted;

          return (
            <g key={row.label}>
              <text
                x={labelW - 8}
                y={y + barH / 2}
                textAnchor="end"
                dominantBaseline="central"
                fontSize="10"
                fontWeight={isRowHighlighted ? 800 : 600}
                fill={isRowDimmed ? '#b6bcc7' : '#475569'}
              >
                {row.label}
              </text>
              <rect
                x={labelW}
                y={ri * rowH}
                width={plotW + tipReserve}
                height={rowH}
                fill="transparent"
                onMouseEnter={() => setHover({ row: ri, seg: -1 })}
                onMouseLeave={() => setHover(null)}
              >
                <title>
                  {row.label}: {total.toLocaleString()}
                  {unit} total
                </title>
              </rect>
              {row.values.map((v, si) => {
                const fullW = renderedWidths[si];
                if (fullW <= 0) return null;
                const w = Math.max(0, fullW - (si < row.values.length - 1 ? gap : 0));
                const isHoverDimmed = hover !== null && hover.row === ri && hover.seg !== -1 && hover.seg !== si;
                // Both series' actual numbers belong ON the bar, not just in
                // the hover tooltip - a stacked bar is exactly for reading
                // "how much of each" off the accumulated whole. White reads
                // on both series colors (already contrast-checked against
                // the chart surface); the value is skipped only when a
                // segment is too narrow to hold it without clipping, per the
                // "never overflow a label" rule - the tooltip still carries
                // it in that rare case.
                const label = v.toLocaleString();
                const estTextW = label.length * 5.6 + 8;
                const canFitLabel = w >= estTextW;
                return (
                  <g key={si}>
                    <rect
                      x={segmentPositions[si]}
                      y={y}
                      width={w}
                      height={barH}
                      fill={seriesColors[si]}
                      opacity={isRowDimmed ? 0.3 : isHoverDimmed ? 0.4 : 1}
                      onMouseEnter={() => setHover({ row: ri, seg: si })}
                      onMouseLeave={() => setHover(null)}
                    >
                      <title>
                        {row.label} — {seriesLabels[si]}: {v.toLocaleString()}
                        {unit}
                      </title>
                    </rect>
                    {canFitLabel && (
                      <text
                        x={segmentPositions[si] + w / 2}
                        y={y + barH / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="9"
                        fontWeight="700"
                        fill="#ffffff"
                        fontFamily="ui-monospace, monospace"
                        opacity={isRowDimmed ? 0.7 : 1}
                        className="pointer-events-none"
                      >
                        {label}
                      </text>
                    )}
                  </g>
                );
              })}
              <text
                x={labelW + renderedTotalW + 6}
                y={y + barH / 2}
                dominantBaseline="central"
                fontSize="10"
                fontWeight="700"
                fill={isRowDimmed ? '#b6bcc7' : '#0f172a'}
                fontFamily="ui-monospace, monospace"
              >
                {total.toLocaleString()}
                {unit}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2.5">
        {seriesLabels.map((label, i) => (
          <div key={label} className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: seriesColors[i] }} />
            <span className="text-slate-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
