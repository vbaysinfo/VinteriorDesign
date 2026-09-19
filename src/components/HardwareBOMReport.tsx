import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { HardwareBOMLine, HardwareRules, BoxJoiningSystem, BackPanelFixing } from '../types';
import { aggregateHardwareBOM } from '../utils/calculator';
import { Settings, Wrench, Download, Package } from 'lucide-react';
import { NumberField } from './NumberField';

interface HardwareBOMReportProps {
  hardwareBOM: HardwareBOMLine[];
  hardwareRules: HardwareRules;
  onUpdateRules: (rules: HardwareRules) => void;
  selectedRoom: string;
}

export const HardwareBOMReport: React.FC<HardwareBOMReportProps> = ({
  hardwareBOM,
  hardwareRules,
  onUpdateRules,
  selectedRoom,
}) => {
  const [showRulesEditor, setShowRulesEditor] = useState(false);

  const scopedLines =
    selectedRoom === 'ALL' ? hardwareBOM : hardwareBOM.filter((l) => l.room === selectedRoom);
  const purchaseBOM = aggregateHardwareBOM(scopedLines);

  const [tier1, tier2] = hardwareRules.hingeRules;
  const tier3 = hardwareRules.hingeRules[hardwareRules.hingeRules.length - 1];

  const updateHingeRule = (index: number, field: 'maxHeightMm' | 'hinges', num: number) => {
    const next = hardwareRules.hingeRules.map((r, i) => (i === index ? { ...r, [field]: num } : r));
    onUpdateRules({ ...hardwareRules, hingeRules: next });
  };

  const handleExport = () => {
    const detailRows = scopedLines.map((l) => ({
      'Project ID': l.projectId,
      'Module ID': l.moduleId,
      'Component ID': l.componentId,
      'Component Type': l.componentType,
      'Hardware Code': l.hardwareCode,
      'Hardware Name': l.hardwareName,
      Brand: l.brand ?? '',
      Model: l.model ?? '',
      Specification: l.specification ?? '',
      Unit: l.unit,
      Quantity: l.quantity,
      'Calculation Rule': l.calculationRule,
      Source: l.source,
      Remarks: l.remarks ?? `${l.moduleName} (${l.room})`,
    }));
    const purchaseRows = purchaseBOM.map((p) => ({
      Hardware: p.hardwareName,
      'Hardware Code': p.hardwareCode,
      'Total Qty': p.totalQuantity,
      Unit: p.unit,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), 'Hardware_BOM');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(purchaseRows), 'Purchase_BOM');
    XLSX.writeFile(wb, `${selectedRoom}_Hardware_BOM.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-500" />
              Hardware BOM
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Per-component hardware requirements, calculated from the factory's own configured rules - never a
              single hardcoded quantity for every shutter, drawer, or box.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowRulesEditor(!showRulesEditor)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-2 transition"
            >
              <Settings className="w-4 h-4" />
              <span>{showRulesEditor ? 'Hide Hardware Rules' : 'Hardware Rules Config'}</span>
            </button>
            <button
              onClick={handleExport}
              className="px-3.5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Export Hardware BOM</span>
            </button>
          </div>
        </div>
      </div>

      {/* Editable Hardware Rules Panel (Expandable) */}
      {showRulesEditor && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-cyan-600" />
              <h3 className="text-sm font-bold text-slate-900">Factory-Approved Hardware Rules</h3>
            </div>
            <span className="text-xs text-slate-500">
              Edit rules below; the Hardware BOM recalculates automatically
            </span>
          </div>

          <div className="space-y-5 text-xs">
            <div>
              <div className="font-bold text-slate-700 mb-2">Shutter Hinges - by shutter height</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Up to (mm)</label>
                  <NumberField
                    value={tier1.maxHeightMm}
                    onCommit={(num) => updateHingeRule(0, 'maxHeightMm', num)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Hinges</label>
                  <NumberField
                    value={tier1.hinges}
                    onCommit={(num) => updateHingeRule(0, 'hinges', num)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Up to (mm)</label>
                  <NumberField
                    value={tier2.maxHeightMm}
                    onCommit={(num) => updateHingeRule(1, 'maxHeightMm', num)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Hinges</label>
                  <NumberField
                    value={tier2.hinges}
                    onCommit={(num) => updateHingeRule(1, 'hinges', num)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Above that (mm)</label>
                  <input
                    disabled
                    value="Taller"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-400 font-bold bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Hinges</label>
                  <NumberField
                    value={tier3.hinges}
                    onCommit={(num) => updateHingeRule(hardwareRules.hingeRules.length - 1, 'hinges', num)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Handles / Shutter</label>
                <NumberField
                  value={hardwareRules.handlesPerShutter}
                  onCommit={(num) => onUpdateRules({ ...hardwareRules, handlesPerShutter: num })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Handles / Drawer</label>
                <NumberField
                  value={hardwareRules.handlesPerDrawer}
                  onCommit={(num) => onUpdateRules({ ...hardwareRules, handlesPerDrawer: num })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Shelf Pins / Shelf</label>
                <NumberField
                  value={hardwareRules.shelfPinsPerShelf}
                  onCommit={(num) => onUpdateRules({ ...hardwareRules, shelfPinsPerShelf: num })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Skirting Clip Spacing (mm)</label>
                <NumberField
                  value={hardwareRules.skirtingClipSpacingMm}
                  onCommit={(num) => onUpdateRules({ ...hardwareRules, skirtingClipSpacingMm: num })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Box Joining System</label>
                <select
                  value={hardwareRules.boxJoiningSystem}
                  onChange={(e) =>
                    onUpdateRules({ ...hardwareRules, boxJoiningSystem: e.target.value as BoxJoiningSystem })
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold bg-white"
                >
                  <option value="confirmat">Confirmat</option>
                  <option value="minifix_dowel">Minifix + Dowel</option>
                  <option value="screw_bracket">Screw + Bracket</option>
                </select>
              </div>
              {hardwareRules.boxJoiningSystem === 'minifix_dowel' && (
                <>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Minifix Sets / Box</label>
                    <NumberField
                      value={hardwareRules.minifixSetsPerBox}
                      onCommit={(num) => onUpdateRules({ ...hardwareRules, minifixSetsPerBox: num })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Dowels / Box</label>
                    <NumberField
                      value={hardwareRules.dowelsPerBox}
                      onCommit={(num) => onUpdateRules({ ...hardwareRules, dowelsPerBox: num })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
                    />
                  </div>
                </>
              )}
              {hardwareRules.boxJoiningSystem === 'confirmat' && (
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Confirmat Screws / Box</label>
                  <NumberField
                    value={hardwareRules.confirmatScrewsPerBox}
                    onCommit={(num) => onUpdateRules({ ...hardwareRules, confirmatScrewsPerBox: num })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
                  />
                </div>
              )}
              {hardwareRules.boxJoiningSystem === 'screw_bracket' && (
                <>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Brackets / Box</label>
                    <NumberField
                      value={hardwareRules.bracketsPerBox}
                      onCommit={(num) => onUpdateRules({ ...hardwareRules, bracketsPerBox: num })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Screws / Bracket</label>
                    <NumberField
                      value={hardwareRules.bracketScrewsPerBracket}
                      onCommit={(num) => onUpdateRules({ ...hardwareRules, bracketScrewsPerBracket: num })}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Back Panel Fixing</label>
                <select
                  value={hardwareRules.backPanelFixing}
                  onChange={(e) =>
                    onUpdateRules({ ...hardwareRules, backPanelFixing: e.target.value as BackPanelFixing })
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold bg-white"
                >
                  <option value="staples">Staples</option>
                  <option value="screws">Screws</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Fixing Spacing (mm)</label>
                <NumberField
                  value={hardwareRules.backPanelFixingSpacingMm}
                  onCommit={(num) => onUpdateRules({ ...hardwareRules, backPanelFixingSpacingMm: num })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Aggregated Purchase BOM */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <Package className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-bold text-slate-900">Purchase BOM (Aggregated)</h3>
          </div>
          <div className="space-y-1 max-h-[420px] overflow-y-auto">
            {purchaseBOM.length === 0 && (
              <div className="text-xs text-slate-400 py-4 text-center">No hardware in this scope yet.</div>
            )}
            {purchaseBOM.map((p) => (
              <div
                key={`${p.hardwareCode}-${p.unit}`}
                className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0"
              >
                <div>
                  <span className="font-semibold text-slate-800 block">{p.hardwareName}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{p.hardwareCode}</span>
                </div>
                <span className="font-mono font-bold text-slate-900">
                  {p.totalQuantity} {p.unit}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed per-component BOM */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 lg:col-span-2">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
            <Wrench className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-bold text-slate-900">Hardware BOM ({scopedLines.length} lines)</h3>
          </div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-left text-slate-500 uppercase text-[10px]">
                  <th className="py-1.5 pr-3">Module</th>
                  <th className="py-1.5 pr-3">Component</th>
                  <th className="py-1.5 pr-3">Hardware</th>
                  <th className="py-1.5 pr-3 text-right">Qty</th>
                  <th className="py-1.5 pr-3">Unit</th>
                  <th className="py-1.5 pr-3">Rule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {scopedLines.map((l, idx) => (
                  <tr key={`${l.componentId}-${l.hardwareCode}-${idx}`} className="hover:bg-slate-50">
                    <td className="py-1.5 pr-3 font-semibold text-slate-800">
                      {l.moduleName}
                      <span className="block text-[10px] text-slate-400 font-normal">{l.room}</span>
                    </td>
                    <td className="py-1.5 pr-3 text-slate-600">{l.componentType}</td>
                    <td className="py-1.5 pr-3 text-slate-800 font-medium">{l.hardwareName}</td>
                    <td className="py-1.5 pr-3 text-right font-mono font-bold text-slate-900">{l.quantity}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{l.unit}</td>
                    <td className="py-1.5 pr-3 text-slate-400">{l.calculationRule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
