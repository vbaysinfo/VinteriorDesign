import React, { useMemo, useState } from 'react';
import { ModularItem, CutListPart, ProjectType } from '../types';
import { runAIAnalysis, Finding, FindingSeverity, QualityCheckResult } from '../utils/aiAnalysis';
import {
  Sparkles,
  FileSpreadsheet,
  LayoutGrid,
  AlertTriangle,
  Scissors,
  Layers,
  Factory,
  ShieldCheck,
  AlertOctagon,
  Info,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from 'lucide-react';

interface AIAnalysisPageProps {
  items: ModularItem[];
  cutList: CutListPart[];
  projectType: ProjectType;
}

const SectionHeading: React.FC<{ icon: React.ReactNode; step: number; title: string; subtitle?: string }> = ({
  icon,
  step,
  title,
  subtitle,
}) => (
  <div className="flex flex-wrap items-center gap-2.5 mb-3">
    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-black shrink-0">
      {step}
    </span>
    <span className="text-cyan-600">{icon}</span>
    <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">{title}</h3>
    {subtitle && <span className="text-sm text-slate-400">{subtitle}</span>}
  </div>
);

const SEVERITY_STYLES: Record<FindingSeverity, { badge: string; icon: React.ReactNode; label: string }> = {
  critical: { badge: 'bg-red-50 border-red-200 text-red-800', icon: <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />, label: 'Critical' },
  warning: { badge: 'bg-amber-50 border-amber-200 text-amber-800', icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />, label: 'Warning' },
  info: { badge: 'bg-slate-50 border-slate-200 text-slate-700', icon: <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />, label: 'Info' },
};

const QUALITY_STYLES: Record<QualityCheckResult['status'], { badge: string; icon: React.ReactNode; label: string }> = {
  pass: { badge: 'bg-emerald-50 border-emerald-200 text-emerald-800', icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, label: 'Pass' },
  warn: { badge: 'bg-amber-50 border-amber-200 text-amber-800', icon: <MinusCircle className="w-4 h-4 text-amber-600" />, label: 'Warn' },
  fail: { badge: 'bg-red-50 border-red-200 text-red-800', icon: <XCircle className="w-4 h-4 text-red-600" />, label: 'Fail' },
};

const scoreTone = (score: number) =>
  score >= 85 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600';

export const AIAnalysisPage: React.FC<AIAnalysisPageProps> = ({ items, cutList, projectType }) => {
  const result = useMemo(() => runAIAnalysis(items, cutList, projectType), [items, cutList, projectType]);
  const [severityFilter, setSeverityFilter] = useState<'all' | FindingSeverity>('all');

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
        No project data yet. Upload an Excel quotation sheet to run the AI Analysis.
      </div>
    );
  }

  const criticalCount = result.findings.filter((f) => f.severity === 'critical').length;
  const warningCount = result.findings.filter((f) => f.severity === 'warning').length;
  const infoCount = result.findings.filter((f) => f.severity === 'info').length;
  const failedChecks = result.qualityChecks.filter((q) => q.status === 'fail').length;
  const warnChecks = result.qualityChecks.filter((q) => q.status === 'warn').length;

  const visibleFindings = severityFilter === 'all' ? result.findings : result.findings.filter((f) => f.severity === severityFilter);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-cyan-600" />
              AI Analysis
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              A rules-based readiness check computed entirely from this project's own Excel data, 2D CAD layout, and cut
              list - no external AI call, so every number below is a real, reproducible result of this exact project.
            </p>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-black ${scoreTone(result.overallScore)}`}>{result.overallScore}</div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Readiness Score</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
          <div className="rounded-xl p-5 bg-slate-900 text-white">
            <div className="text-xs font-bold uppercase tracking-wider opacity-80">Items Analyzed</div>
            <div className="text-3xl font-black mt-1.5">{result.itemCount}</div>
          </div>
          <div className="rounded-xl p-5 bg-red-50 border border-red-200 text-red-900">
            <div className="text-xs font-bold uppercase tracking-wider opacity-80">Critical Findings</div>
            <div className="text-3xl font-black mt-1.5">{criticalCount}</div>
          </div>
          <div className="rounded-xl p-5 bg-amber-50 border border-amber-200 text-amber-900">
            <div className="text-xs font-bold uppercase tracking-wider opacity-80">Warnings</div>
            <div className="text-3xl font-black mt-1.5">{warningCount}</div>
          </div>
          <div className="rounded-xl p-5 bg-slate-50 border border-slate-200 text-slate-700">
            <div className="text-xs font-bold uppercase tracking-wider opacity-80">Info Notes</div>
            <div className="text-3xl font-black mt-1.5">{infoCount}</div>
          </div>
          <div className="rounded-xl p-5 bg-indigo-50 border border-indigo-200 text-indigo-900">
            <div className="text-xs font-bold uppercase tracking-wider opacity-80">Quality Checks</div>
            <div className="text-3xl font-black mt-1.5">
              {result.qualityChecks.length - failedChecks - warnChecks}/{result.qualityChecks.length}
            </div>
            <div className="text-xs mt-1 opacity-80">passed clean</div>
          </div>
        </div>
      </div>

      {/* 1. Excel -> Room Understanding */}
      <section>
        <SectionHeading icon={<FileSpreadsheet className="w-4 h-4" />} step={1} title="Excel → Room Understanding" subtitle="Rooms, dimensions, cabinets, materials, hardware & quantities read from the uploaded sheet" />
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 uppercase tracking-wide text-xs border-b border-slate-200">
                <th className="text-left py-2.5 px-4">Room</th>
                <th className="text-right py-2.5 px-3">Items</th>
                <th className="text-right py-2.5 px-3">Area (sq.ft)</th>
                <th className="text-left py-2.5 px-3">Width Range</th>
                <th className="text-left py-2.5 px-3">Height Range</th>
                <th className="text-right py-2.5 px-3">Shutters</th>
                <th className="text-right py-2.5 px-3">Drawers</th>
                <th className="text-right py-2.5 px-3">Shelves</th>
                <th className="text-left py-2.5 px-4">Materials Used</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.roomUnderstanding.map((r) => (
                <tr key={r.room}>
                  <td className="py-2.5 px-4 font-bold text-slate-900">{r.room}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{r.itemCount}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{r.totalAreaSqFt.toLocaleString()}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{r.widthRangeMm[0]}–{r.widthRangeMm[1]}mm</td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{r.heightRangeMm[0]}–{r.heightRangeMm[1]}mm</td>
                  <td className="py-2.5 px-3 text-right font-mono">{r.totalShutters}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{r.totalDrawers}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{r.totalShelves}</td>
                  <td className="py-2.5 px-4 text-slate-600">
                    {r.materialCounts.map((m) => `${m.material} (${m.count})`).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. 2D CAD Analysis */}
      <section>
        <SectionHeading icon={<LayoutGrid className="w-4 h-4" />} step={2} title="2D CAD Analysis" subtitle="Per-wall composition read from the CAD elevation, and cross-wall geometry checks" />
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 uppercase tracking-wide text-xs border-b border-slate-200">
                  <th className="text-left py-2.5 px-4">Room</th>
                  <th className="text-left py-2.5 px-3">Wall</th>
                  <th className="text-right py-2.5 px-3">Cabinets</th>
                  <th className="text-right py-2.5 px-3">Total Width</th>
                  <th className="text-left py-2.5 px-4">Height Range</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.wallSummaries.map((w) => (
                  <tr key={`${w.room}-${w.wall}`}>
                    <td className="py-2 px-4 font-semibold text-slate-800">{w.room}</td>
                    <td className="py-2 px-3 capitalize text-slate-600">{w.wall}</td>
                    <td className="py-2 px-3 text-right font-mono">{w.itemCount}</td>
                    <td className="py-2 px-3 text-right font-mono">{w.totalWidthMm.toLocaleString()}mm</td>
                    <td className="py-2 px-4 font-mono text-slate-600">{w.heightRangeMm[0]}–{w.heightRangeMm[1]}mm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.cadNotes.length > 0 && (
            <div className="space-y-2">
              {result.cadNotes.map((n, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <Info className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                  <span className="text-slate-600"><strong className="text-slate-800">{n.room}:</strong> {n.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 3. Error Detection */}
      <section>
        <SectionHeading icon={<AlertTriangle className="w-4 h-4" />} step={3} title="Error Detection" subtitle="Missing dimensions, impossible sizes, insufficient clearance, duplicates & inconsistent data" />
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <div className="flex flex-wrap gap-1.5 mb-4">
            {(['all', 'critical', 'warning', 'info'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border transition capitalize ${
                  severityFilter === s
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-cyan-300 hover:text-cyan-700'
                }`}
              >
                {s === 'all' ? `All (${result.findings.length})` : `${s} (${result.findings.filter((f) => f.severity === s).length})`}
              </button>
            ))}
          </div>

          {visibleFindings.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> No findings in this category - the data looks clean.
            </div>
          ) : (
            <div className="space-y-2">
              {visibleFindings.map((f: Finding) => (
                <div key={f.id} className={`flex items-start gap-2.5 text-sm border rounded-lg p-3 ${SEVERITY_STYLES[f.severity].badge}`}>
                  {SEVERITY_STYLES[f.severity].icon}
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-black uppercase tracking-wide">{SEVERITY_STYLES[f.severity].label}</span>
                      <span className="text-xs font-semibold opacity-70">· {f.category} · {f.room}</span>
                    </div>
                    <p>{f.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. Cutting Optimization */}
      <section>
        <SectionHeading icon={<Scissors className="w-4 h-4" />} step={4} title="Cutting Optimization" subtitle="Real nesting comparison: each room cut independently vs. the whole project together" />
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="rounded-xl p-5 bg-white border border-slate-200 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Per-Room Sheets</div>
              <div className="text-3xl font-black mt-1.5 text-slate-800">{result.cuttingOptimization.perRoomSheets}</div>
              <div className="text-xs mt-1 text-slate-400">if nested room by room</div>
            </div>
            <div className="rounded-xl p-5 bg-white border border-slate-200 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Combined Sheets</div>
              <div className="text-3xl font-black mt-1.5 text-slate-800">{result.cuttingOptimization.combinedSheets}</div>
              <div className="text-xs mt-1 text-slate-400">whole project nested together</div>
            </div>
            <div className="rounded-xl p-5 bg-emerald-50 border border-emerald-200 text-emerald-900">
              <div className="text-xs font-bold uppercase tracking-wider opacity-80">Sheets Saved</div>
              <div className="text-3xl font-black mt-1.5">{result.cuttingOptimization.sheetsSaved}</div>
              <div className="text-xs mt-1 opacity-80">≈ {result.cuttingOptimization.areaSavedSqFt} sq.ft of board</div>
            </div>
          </div>

          {result.cuttingOptimization.lowYieldSheets.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
              <div className="px-4 pt-3 text-sm font-bold text-slate-900">
                Worst {result.cuttingOptimization.lowYieldSheets.length} of {result.cuttingOptimization.lowYieldCount} Sheets Below 60% Utilization
              </div>
              <p className="px-4 pb-1 text-xs text-slate-400">
                A simple strip-nesting pass naturally leaves plenty of sheets under 60% on any real project with lots of
                odd-sized shelves/battens - these are the lowest, not necessarily each a fixable mistake.
              </p>
              <table className="w-full text-sm mt-1">
                <thead>
                  <tr className="text-slate-400 uppercase tracking-wide text-xs border-b border-slate-200">
                    <th className="text-left py-2 px-4">Sheet</th>
                    <th className="text-left py-2 px-3">Room</th>
                    <th className="text-right py-2 px-3">Thickness</th>
                    <th className="text-right py-2 px-4">Utilization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.cuttingOptimization.lowYieldSheets.map((s) => (
                    <tr key={s.sheetId}>
                      <td className="py-2 px-4 font-mono font-semibold text-slate-800">{s.sheetId}</td>
                      <td className="py-2 px-3 text-slate-600">{s.room}</td>
                      <td className="py-2 px-3 text-right font-mono">{s.thicknessMm}mm</td>
                      <td className="py-2 px-4 text-right font-mono font-bold text-amber-700">{s.utilizationPercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* 5. Material Optimization */}
      <section>
        <SectionHeading icon={<Layers className="w-4 h-4" />} step={5} title="Material Optimization" subtitle="Board/sheet requirement and opportunities to reduce wastage" />
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 text-sm">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide font-bold">Board Bought</div>
              <div className="font-mono font-black text-lg text-slate-800">{result.materialOptimization.materials.grossBoardAreaSqFt.toLocaleString()} sq.ft</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide font-bold">Net Used</div>
              <div className="font-mono font-black text-lg text-slate-800">{result.materialOptimization.materials.netPartsAreaSqFt.toLocaleString()} sq.ft</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide font-bold">Usable Offcut</div>
              <div className="font-mono font-black text-lg text-slate-800">{result.materialOptimization.materials.usableOffcutAreaSqFt.toLocaleString()} sq.ft</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide font-bold">Scrap Waste</div>
              <div className="font-mono font-black text-lg text-red-700">{result.materialOptimization.materials.wastePercent}%</div>
            </div>
          </div>
          <div className="space-y-2">
            {result.materialOptimization.suggestions.map((s, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-cyan-900">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-cyan-600" />
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Production Analysis */}
      <section>
        <SectionHeading icon={<Factory className="w-4 h-4" />} step={6} title="Production Analysis" subtitle="Panel dimensions, edge-banding, drilling/hardware & label quantities for the factory floor" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
            <div className="px-4 pt-3 pb-1 text-sm font-bold text-slate-900">Panel Summary by Type</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 uppercase tracking-wide text-xs border-b border-slate-200">
                  <th className="text-left py-2 px-4">Part</th>
                  <th className="text-right py-2 px-3">Pieces</th>
                  <th className="text-right py-2 px-3">Area (sq.ft)</th>
                  <th className="text-left py-2 px-4">Size Range</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.production.panelSummary.map((p) => (
                  <tr key={p.partName}>
                    <td className="py-2 px-4 font-semibold text-slate-800">{p.partName}</td>
                    <td className="py-2 px-3 text-right font-mono">{p.pieceCount}</td>
                    <td className="py-2 px-3 text-right font-mono">{p.totalAreaSqFt.toLocaleString()}</td>
                    <td className="py-2 px-4 font-mono text-slate-600">{p.minDimMm}–{p.maxDimMm}mm</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 font-bold text-slate-800">
                  <td className="py-2 px-4">Total Labels Needed</td>
                  <td className="py-2 px-3 text-right font-mono" colSpan={3}>{result.production.totalLabelsNeeded} pcs</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <div className="text-sm font-bold text-slate-900 mb-3">Edge Banding & Hardware / Drilling</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Edge Band 2.0mm (Shutters)</span><span className="font-mono font-bold text-slate-800">{result.production.edgeBand2mmMeters}m</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Edge Band 0.8mm (Carcass)</span><span className="font-mono font-bold text-slate-800">{result.production.edgeBand08mmMeters}m</span></div>
              <div className="flex justify-between pt-2 border-t border-slate-100"><span className="text-slate-500">Soft-Close Hinge Pairs</span><span className="font-mono font-bold text-slate-800">{result.production.hingePairs}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Handles</span><span className="font-mono font-bold text-slate-800">{result.production.handles}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Drawer Channels</span><span className="font-mono font-bold text-slate-800">{result.production.drawerChannels}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tandem Box Channels</span><span className="font-mono font-bold text-slate-800">{result.production.tandemBoxChannels}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Shelf Support Studs</span><span className="font-mono font-bold text-slate-800">{result.production.shelfSupports}</span></div>
              <div className="flex justify-between pt-2 border-t border-slate-100"><span className="text-slate-500">Minifix Drilling Sets</span><span className="font-mono font-bold text-slate-800">{result.production.minifixSets}</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Quality Check */}
      <section>
        <SectionHeading icon={<ShieldCheck className="w-4 h-4" />} step={7} title="Quality Check" subtitle="Predefined factory rules run against the real cut list before production" />
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
          {result.qualityChecks.map((q, idx) => (
            <div key={idx} className="flex items-start gap-3 p-4">
              {QUALITY_STYLES[q.status].icon}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{q.rule}</span>
                  <span className={`text-xs font-black uppercase tracking-wide px-2 py-0.5 rounded-full border ${QUALITY_STYLES[q.status].badge}`}>
                    {QUALITY_STYLES[q.status].label}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{q.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
