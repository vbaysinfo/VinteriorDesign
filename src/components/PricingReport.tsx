import React, { useState } from 'react';
import { ModularItem, MaterialBreakdown, CostBreakdown, FactoryRates, ProjectType, ProjectInfo } from '../types';
import { IndianRupee, DollarSign, Calculator, Settings, CheckCircle2, TrendingDown, ArrowRight, ShieldCheck, FileText } from 'lucide-react';

interface PricingReportProps {
  items: ModularItem[];
  materials: MaterialBreakdown;
  costs: CostBreakdown;
  rates: FactoryRates;
  projectType: ProjectType;
  projectInfo: ProjectInfo;
  onUpdateRates: (rates: FactoryRates) => void;
  onExportPdf: () => void;
  onToggleProjectType: () => void;
}

export const PricingReport: React.FC<PricingReportProps> = ({
  items,
  materials,
  costs,
  rates,
  projectType,
  projectInfo,
  onUpdateRates,
  onExportPdf,
  onToggleProjectType,
}) => {
  const [showRatesEditor, setShowRatesEditor] = useState(false);
  const currency = projectInfo.currency;

  // Calculate approximate full modular cost if currently semi, or semi if currently full
  const comparisonMultiplier = projectType === 'semi' ? 1.34 : 0.75;
  const comparisonGrandTotal = Math.round(costs.grandTotal * comparisonMultiplier);
  const differenceAmount = Math.abs(comparisonGrandTotal - costs.grandTotal);

  // Group items cost by room
  const totalProjectArea = items.reduce((s, i) => s + i.areaSqFt, 0);
  const roomMap: Record<string, { count: number; areaSqFt: number; volumeCuFt: number; items: ModularItem[] }> = {};
  for (const item of items) {
    if (!roomMap[item.room]) {
      roomMap[item.room] = { count: 0, areaSqFt: 0, volumeCuFt: 0, items: [] };
    }
    roomMap[item.room].count += 1;
    roomMap[item.room].areaSqFt += item.areaSqFt;
    roomMap[item.room].volumeCuFt += item.volumeCuFt;
    roomMap[item.room].items.push(item);
  }

  const roomSummaries = Object.keys(roomMap).map((room) => {
    const data = roomMap[room];
    const roomCostShare = Math.round((data.areaSqFt / (totalProjectArea || 1)) * costs.grandTotal);
    return {
      room,
      count: data.count,
      areaSqFt: Number(data.areaSqFt.toFixed(2)),
      volumeCuFt: Number(data.volumeCuFt.toFixed(2)),
      estimatedCost: roomCostShare,
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  projectType === 'semi'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {projectType === 'semi' ? 'Semi-Modular Mode (Civil Framework)' : 'Full-Modular Mode (Factory Prefab)'}
              </span>
              <button
                onClick={onToggleProjectType}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline underline-offset-2 ml-2"
              >
                Switch to {projectType === 'semi' ? 'Full Modular' : 'Semi Modular'}
              </button>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Project Budget & Material Estimation</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive Bill of Materials (BOM), Hardware Specifications, Factory CNC & Labor Costing
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowRatesEditor(!showRatesEditor)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-2 transition"
            >
              <Settings className="w-4 h-4" />
              <span>{showRatesEditor ? 'Hide Rates Config' : 'Factory Rates Config'}</span>
            </button>
            <button
              onClick={onExportPdf}
              className="px-4 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition"
            >
              <FileText className="w-4 h-4" />
              <span>Export BOM Proposal (PDF)</span>
            </button>
          </div>
        </div>

        {/* Primary Budget Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-slate-900 text-white shadow-sm">
            <span className="text-xs uppercase font-medium text-slate-400">Total Project Budget</span>
            <div className="text-3xl font-extrabold text-cyan-400 mt-1 font-mono">
              {currency} {costs.grandTotal.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Includes {rates.taxPercent}% GST ({currency} {costs.taxAmount.toLocaleString()})
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-xs uppercase font-bold text-emerald-800">Direct Material Cost</span>
            <div className="text-2xl font-bold text-emerald-900 mt-1 font-mono">
              {currency}{' '}
              {(
                costs.carcassBoardCost +
                costs.shutterBoardCost +
                costs.backPanelCost +
                costs.innerLaminateCost +
                costs.outerLaminateCost +
                costs.edgeBandCost
              ).toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-700 mt-1">
              {materials.ply18mmSheets + materials.ply9mmSheets + materials.ply6mmSheets} Total Wood Sheets
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
            <span className="text-xs uppercase font-bold text-blue-800">Hardware & Fittings</span>
            <div className="text-2xl font-bold text-blue-900 mt-1 font-mono">
              {currency} {costs.hardwareCost.toLocaleString()}
            </div>
            <div className="text-[11px] text-blue-700 mt-1">
              {materials.softCloseHingesPairs} Pairs Hinges • {materials.tandemBoxChannels + materials.drawerChannels} Runners
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-xs uppercase font-bold text-amber-800">Factory Labor & Assembly</span>
            <div className="text-2xl font-bold text-amber-900 mt-1 font-mono">
              {currency}{' '}
              {(costs.factoryLaborCost + costs.installationCost + costs.packingTransportCost).toLocaleString()}
            </div>
            <div className="text-[11px] text-amber-700 mt-1">
              CNC Machining + Site Carpenter Fitting
            </div>
          </div>
        </div>

        {/* Semi vs Full Modular Comparative Banner */}
        <div className="mt-5 p-4 rounded-xl border border-dashed border-cyan-300 bg-cyan-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-600 text-white rounded-lg">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                {projectType === 'semi'
                  ? `Semi-Modular Cost Benefit: You save approx ${currency} ${differenceAmount.toLocaleString()} vs Full Modular`
                  : `Full Modular Quality Advantage: Prefabricated carcasses provide maximum durability & precision alignment`}
              </h4>
              <p className="text-xs text-slate-600">
                {projectType === 'semi'
                  ? 'Civil masonry wall niches eliminate carcass back panels & side gables, utilizing width & height fixed civil apertures.'
                  : 'Includes 100% 18mm sealed carcases with full 6mm moisture barrier backings, factory dowels & adjustable shelves.'}
              </p>
            </div>
          </div>
          <button
            onClick={onToggleProjectType}
            className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
          >
            <span>Switch to {projectType === 'semi' ? 'Full Modular' : 'Semi Modular'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Editable Factory Rates Panel (Expandable) */}
      {showRatesEditor && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-cyan-600" />
              <h3 className="text-sm font-bold text-slate-900">Custom Factory Pricing Parameters & Unit Rates</h3>
            </div>
            <span className="text-xs text-slate-500">Edit rates below; estimates recalculate automatically</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">18mm Plywood ({currency}/sq.ft)</label>
              <input
                type="number"
                value={rates.plywood18mmPerSqFt}
                onChange={(e) => onUpdateRates({ ...rates, plywood18mmPerSqFt: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">6mm Backing Ply ({currency}/sq.ft)</label>
              <input
                type="number"
                value={rates.plywood6mmPerSqFt}
                onChange={(e) => onUpdateRates({ ...rates, plywood6mmPerSqFt: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Inner Liner Sheet ({currency}/sheet)</label>
              <input
                type="number"
                value={rates.innerLaminatePerSheet}
                onChange={(e) => onUpdateRates({ ...rates, innerLaminatePerSheet: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Outer Laminate ({currency}/sheet)</label>
              <input
                type="number"
                value={rates.outerLaminatePerSheet}
                onChange={(e) => onUpdateRates({ ...rates, outerLaminatePerSheet: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Edge Band Tape ({currency}/meter)</label>
              <input
                type="number"
                value={rates.edgeBandPerMeter}
                onChange={(e) => onUpdateRates({ ...rates, edgeBandPerMeter: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Soft-Close Hinges ({currency}/pair)</label>
              <input
                type="number"
                value={rates.hingesPairRate}
                onChange={(e) => onUpdateRates({ ...rates, hingesPairRate: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Tandem Box Channel ({currency}/set)</label>
              <input
                type="number"
                value={rates.tandemChannelRate}
                onChange={(e) => onUpdateRates({ ...rates, tandemChannelRate: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Drawer Runner ({currency}/pair)</label>
              <input
                type="number"
                value={rates.drawerChannelRate}
                onChange={(e) => onUpdateRates({ ...rates, drawerChannelRate: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Factory Labor ({currency}/sq.ft)</label>
              <input
                type="number"
                value={rates.factoryLaborPerSqFt}
                onChange={(e) => onUpdateRates({ ...rates, factoryLaborPerSqFt: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Carpenter Fitting ({currency}/sq.ft)</label>
              <input
                type="number"
                value={rates.installationPerSqFt}
                onChange={(e) => onUpdateRates({ ...rates, installationPerSqFt: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Profit Margin (%)</label>
              <input
                type="number"
                value={rates.profitMarginPercent}
                onChange={(e) => onUpdateRates({ ...rates, profitMarginPercent: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Tax / GST (%)</label>
              <input
                type="number"
                value={rates.taxPercent}
                onChange={(e) => onUpdateRates({ ...rates, taxPercent: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-bold"
              />
            </div>
          </div>
        </div>
      )}

      {/* Itemized Cost Breakdown Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Sheet */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span>Itemized Cost Schedule</span>
              <span className="text-xs font-normal text-slate-500">Factory BOQ Rate Base</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">18mm Plywood Carcass & Shelving</span>
                <span className="font-mono font-bold text-slate-900">{currency} {costs.carcassBoardCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">18mm Plywood Shutters & Facias</span>
                <span className="font-mono font-bold text-slate-900">{currency} {costs.shutterBoardCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">6mm Backing Ply Enclosures</span>
                <span className="font-mono font-bold text-slate-900">{currency} {costs.backPanelCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Inner Liner Laminate (0.8mm)</span>
                <span className="font-mono font-bold text-slate-900">{currency} {costs.innerLaminateCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Outer Aesthetic Laminate / Acrylic</span>
                <span className="font-mono font-bold text-slate-900">{currency} {costs.outerLaminateCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">PVC 2mm Edge Band Tape & Adhesive</span>
                <span className="font-mono font-bold text-slate-900">{currency} {costs.edgeBandCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Hardware (Hinges, Tandem, Runners, Handles)</span>
                <span className="font-mono font-bold text-slate-900">{currency} {costs.hardwareCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Factory CNC Beam Saw, Edging & Pressing Labor</span>
                <span className="font-mono font-bold text-slate-900">{currency} {costs.factoryLaborCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">On-Site Carpenter Fitting & Installation</span>
                <span className="font-mono font-bold text-slate-900">{currency} {costs.installationCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Protective Bubble Packing & Transportation</span>
                <span className="font-mono font-bold text-slate-900">{currency} {costs.packingTransportCost.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t-2 border-slate-900 space-y-2">
            <div className="flex justify-between text-sm font-semibold text-slate-700">
              <span>Subtotal (Direct + Overheads)</span>
              <span className="font-mono">{currency} {costs.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-slate-700">
              <span>GST / Tax ({rates.taxPercent}%)</span>
              <span className="font-mono">{currency} {costs.taxAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-slate-950 bg-slate-100 p-2.5 rounded-lg">
              <span>Grand Total Estimated Budget</span>
              <span className="font-mono text-cyan-800">{currency} {costs.grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Room-Wise Cost Allocation */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span>Room-Wise Cost Allocation</span>
              <span className="text-xs font-normal text-slate-500">Proportional Area Distribution</span>
            </h3>

            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
              {roomSummaries.map((room) => (
                <div key={room.room} className="py-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{room.room}</h4>
                    <span className="text-[11px] text-slate-500">
                      {room.count} units • {room.areaSqFt} Sq.ft
                      {room.volumeCuFt > 0 ? ` • ${room.volumeCuFt} Cu.ft` : ''}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold text-slate-900">
                      {currency} {room.estimatedCost.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {Math.round((room.estimatedCost / costs.grandTotal) * 100)}% of project
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <strong className="text-slate-800">10-Year Factory Warranty Guarantee:</strong> All core boards adhere to IS:710 Marine or IS:303 Commercial specifications with 2mm PVC hot-melt sealed edge bands.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
