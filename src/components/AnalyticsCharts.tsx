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
  const barH = 18;
  const rowH = 28;
  const labelW = 118;
  const chartW = 480;
  const tipReserve = 64;
  const plotW = chartW - labelW - tipReserve;
  const max = Math.max(...data.map((d) => d.value), 1);
  const svgH = data.length * rowH;

  if (data.length === 0) return null;

  return (
    <svg width="100%" viewBox={`0 0 ${chartW} ${svgH}`} className="overflow-visible" role="img" aria-label={`Bar chart: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}>
      {data.map((d, i) => {
        const y = i * rowH + (rowH - barH) / 2;
        const w = Math.max(2, (d.value / max) * plotW);
        const isHovered = hoverIdx === i;
        // A label that won't fit doesn't get clipped mid-character - truncate
        // with an ellipsis and keep the full text reachable via the native
        // <title> tooltip on hover/focus, same "never gate a value" rule the
        // hover layer follows.
        const maxChars = 18;
        const displayLabel = d.label.length > maxChars ? `${d.label.slice(0, maxChars - 1)}…` : d.label;
        return (
          <g key={d.label}>
            <text
              x={labelW - 8}
              y={y + barH / 2}
              textAnchor="end"
              dominantBaseline="central"
              fontSize="11"
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
            <path d={hBarPath(labelW, y, w, barH, 3)} fill={color} opacity={isHovered ? 1 : 0.85} />
            <text
              x={labelW + w + 6}
              y={y + barH / 2}
              dominantBaseline="central"
              fontSize="11"
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
    <div>
      <div className="flex w-full rounded-md overflow-hidden gap-0.5" style={{ height: 26 }}>
        {bars.map((b) => (
          <div
            key={b.label}
            title={`${b.label}: ${b.value.toLocaleString()} ${unit} (${b.pct.toFixed(1)}%)`}
            onMouseEnter={() => setHoverIdx(b.i)}
            onMouseLeave={() => setHoverIdx(null)}
            className="h-full flex items-center justify-center transition-opacity cursor-default"
            style={{ width: `${b.pct}%`, backgroundColor: b.color, opacity: hoverIdx === null || hoverIdx === b.i ? 1 : 0.4 }}
          >
            {b.pct >= 10 && <span className="text-white text-[10px] font-extrabold select-none">{b.pct.toFixed(0)}%</span>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
        {bars.map((b) => (
          <div
            key={b.label}
            className="flex items-center gap-1.5 text-[11px] cursor-default"
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
}) => {
  const [hover, setHover] = useState<{ row: number; seg: number } | null>(null);
  const barH = 18;
  const rowH = 30;
  const labelW = 118;
  const chartW = 480;
  const tipReserve = 70;
  const plotW = chartW - labelW - tipReserve;
  const gap = 0.6;
  const totals = data.map((d) => d.values.reduce((s, v) => s + v, 0));
  const max = Math.max(...totals, 1);
  const svgH = data.length * rowH;

  if (data.length === 0) return null;

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${chartW} ${svgH}`} className="overflow-visible" role="img">
        {data.map((row, ri) => {
          const y = ri * rowH + (rowH - barH) / 2;
          const total = totals[ri];
          let acc = 0;
          return (
            <g key={row.label}>
              <text
                x={labelW - 8}
                y={y + barH / 2}
                textAnchor="end"
                dominantBaseline="central"
                fontSize="11"
                fontWeight="600"
                fill="#475569"
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
                const segStart = acc;
                acc += v;
                const x = labelW + (segStart / max) * plotW;
                const w = Math.max(0, (v / max) * plotW - (si < row.values.length - 1 ? gap : 0));
                const isDimmed = hover !== null && hover.row === ri && hover.seg !== -1 && hover.seg !== si;
                return (
                  <rect
                    key={si}
                    x={x}
                    y={y}
                    width={w}
                    height={barH}
                    fill={seriesColors[si]}
                    opacity={isDimmed ? 0.4 : 1}
                    onMouseEnter={() => setHover({ row: ri, seg: si })}
                    onMouseLeave={() => setHover(null)}
                  >
                    <title>
                      {row.label} — {seriesLabels[si]}: {v.toLocaleString()}
                      {unit}
                    </title>
                  </rect>
                );
              })}
              <text
                x={labelW + (total / max) * plotW + 6}
                y={y + barH / 2}
                dominantBaseline="central"
                fontSize="11"
                fontWeight="700"
                fill="#0f172a"
                fontFamily="ui-monospace, monospace"
              >
                {total.toLocaleString()}
                {unit}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
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
