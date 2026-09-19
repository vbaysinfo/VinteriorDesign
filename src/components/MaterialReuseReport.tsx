import React, { useMemo } from 'react';
import { CutListPart } from '../types';
import { generateSheetNestingLayouts, summarizeMaterialReuse } from '../utils/calculator';
import { Recycle, Layers, AlertTriangle, Info } from 'lucide-react';

interface MaterialReuseReportProps {
  cutList: CutListPart[];
}

export const MaterialReuseReport: React.FC<MaterialReuseReportProps> = ({ cutList }) => {
  const { layouts } = useMemo(() => generateSheetNestingLayouts(cutList), [cutList]);
  const summary = useMemo(() => summarizeMaterialReuse(layouts), [layouts]);

  const totalPieces = summary.reusedPiecesCount + summary.freshPiecesCount;
  const reusedPercent = totalPieces > 0 ? Math.round((summary.reusedPiecesCount / totalPieces) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Recycle className="w-5 h-5 text-emerald-600" />
          Material Reuse
        </h2>
        <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">
          No usable material waste: before opening a new sheet, the cutting engine already searches every
          rectangle left over on every sheet opened so far for this material/thickness/color, and uses whichever
          fits best. This page reports what it actually did - which pieces reused leftover space, and what usable
          offcut remains once every piece has had its chance to claim one.
        </p>
        <div className="mt-3 flex items-start gap-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
          <span>
            Scoped to this project only - matching is by exact material, color/finish, and thickness, across every
            room's sheets. There is no cross-project Remnant Inventory here: nothing persists once you start a new
            project or clear this one.
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
            <Recycle className="w-3.5 h-3.5 text-emerald-500" />
            Pieces From Reused Leftover
          </div>
          <div className="text-3xl font-bold text-emerald-700 mt-1">
            {summary.reusedPiecesCount} <span className="text-sm font-medium text-slate-400">/ {totalPieces}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {reusedPercent}% of all cut pieces landed on space freed by an earlier piece, not a fresh sheet
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
            <Layers className="w-3.5 h-3.5 text-cyan-500" />
            Usable Leftover Remaining
          </div>
          <div className="text-3xl font-bold text-cyan-700 mt-1">{summary.totalUsableLeftoverAreaSqFt} sq.ft</div>
          <div className="text-xs text-slate-500 mt-1">
            {summary.leftoverInventory.length} piece(s) large enough to reuse, unclaimed by this project's own cut
            list
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            True Scrap
          </div>
          <div className="text-3xl font-bold text-amber-700 mt-1">{summary.totalScrapAreaSqFt} sq.ft</div>
          <div className="text-xs text-slate-500 mt-1">{summary.scrapPercent}% of board bought - kerf and slivers too small to reuse</div>
        </div>
      </div>

      {/* Leftover Inventory */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
          <Layers className="w-4 h-4 text-cyan-600" />
          <h3 className="text-sm font-bold text-slate-900">
            Leftover Inventory ({summary.leftoverInventory.length} pieces)
          </h3>
        </div>
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="text-left text-slate-500 uppercase text-[10px]">
                <th className="py-1.5 pr-3">Sheet</th>
                <th className="py-1.5 pr-3">Material</th>
                <th className="py-1.5 pr-3 text-right">Thickness</th>
                <th className="py-1.5 pr-3 text-right">Length × Width (mm)</th>
                <th className="py-1.5 pr-3 text-right">Area (sq.ft)</th>
                <th className="py-1.5 pr-3">Recommended Use</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {summary.leftoverInventory.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No usable leftover pieces remain - either nothing's been cut yet, or every offcut large enough
                    to reuse already got claimed.
                  </td>
                </tr>
              )}
              {summary.leftoverInventory.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="py-1.5 pr-3 font-mono text-slate-600">{row.sheetId}</td>
                  <td className="py-1.5 pr-3 font-medium text-slate-800">{row.materialName}</td>
                  <td className="py-1.5 pr-3 text-right text-slate-500">{row.thicknessMm}mm</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-slate-800">
                    {row.lengthMm} × {row.widthMm}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono font-bold text-slate-900">{row.areaSqFt}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{row.recommendedUse}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
