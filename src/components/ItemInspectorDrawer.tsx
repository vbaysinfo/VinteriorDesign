import React from 'react';
import { ModularItem, ProjectType, FactoryRates } from '../types';
import { generateCutListForItem } from '../utils/calculator';
import { X, Box, Layers, Scissors, Check, Sliders } from 'lucide-react';

interface ItemInspectorDrawerProps {
  item: ModularItem | null;
  projectType: ProjectType;
  rates: FactoryRates;
  currency: string;
  onClose: () => void;
  onUpdateItem: (updated: ModularItem) => void;
}

export const ItemInspectorDrawer: React.FC<ItemInspectorDrawerProps> = ({
  item,
  projectType,
  rates,
  currency,
  onClose,
  onUpdateItem,
}) => {
  if (!item) return null;

  const cutListParts = generateCutListForItem(item, projectType);

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-2xl z-50 border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono uppercase bg-cyan-800 text-cyan-200 px-2 py-0.5 rounded">
            Item #{item.sNo} • {item.room}
          </span>
          <h3 className="text-base font-bold text-white mt-1">{item.description}</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-700">
        {/* Wall & Dimensions Card */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between font-semibold text-slate-900 pb-2 border-b border-slate-200">
            <span className="flex items-center gap-1.5">
              <Box className="w-4 h-4 text-cyan-600" />
              Structural Dimensions
            </span>
            <span className="text-[11px] font-mono text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
              Wall: {item.wall.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-white rounded-lg border border-slate-200">
              <span className="text-slate-400 text-[10px] block">WIDTH</span>
              <strong className="text-slate-900 text-sm font-mono">{item.widthMm} mm</strong>
              <span className="text-slate-500 text-[10px] block">({item.widthFt} ft)</span>
            </div>
            <div className="p-2 bg-white rounded-lg border border-slate-200">
              <span className="text-slate-400 text-[10px] block">HEIGHT</span>
              <strong className="text-slate-900 text-sm font-mono">{item.heightMm} mm</strong>
              <span className="text-slate-500 text-[10px] block">({item.heightFt} ft)</span>
            </div>
            <div className="p-2 bg-white rounded-lg border border-slate-200">
              <span className="text-slate-400 text-[10px] block">DEPTH</span>
              <strong className="text-slate-900 text-sm font-mono">
                {item.depthMm > 0 ? `${item.depthMm} mm` : '0 (Frame)'}
              </strong>
              <span className="text-slate-500 text-[10px] block">
                {item.depthFt > 0 ? `(${item.depthFt} ft)` : 'Civil niche'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1 text-slate-600">
            <span>Calculation Basis: <strong>{item.calcBasis}</strong></span>
            <span>Total: <strong>{item.calcBasis === 'Area (Sq.ft)' ? `${item.areaSqFt} Sq.ft` : `${item.volumeCuFt} Cu.ft`}</strong></span>
          </div>
        </div>

        {/* Specifications & Hardware Config */}
        <div className="space-y-3">
          <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-emerald-600" />
            Component Hardware & Materials
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Core Board</label>
              <select
                value={item.coreMaterial}
                onChange={(e) => onUpdateItem({ ...item, coreMaterial: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
              >
                <option value="BWP Marine Ply">BWP Marine Ply (IS:710)</option>
                <option value="BWR Commercial Ply">BWR Commercial Ply (IS:303)</option>
                <option value="HDHMR">HDHMR (Moisture Resistant)</option>
                <option value="Prelam MDF">Prelam MDF</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Finish Type</label>
              <select
                value={item.finishType}
                onChange={(e) => onUpdateItem({ ...item, finishType: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
              >
                <option value="Laminate">1.0mm Matte/Gloss Laminate</option>
                <option value="Acrylic">High Gloss Acrylic</option>
                <option value="Profile Glass">Profile Glass / Aluminum Frame</option>
                <option value="PU Paint">PU Matte / Gloss Paint</option>
                <option value="Veneer">Natural Wood Veneer</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Shutters</label>
              <input
                type="number"
                min="0"
                max="8"
                value={item.shutterCount}
                onChange={(e) => onUpdateItem({ ...item, shutterCount: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-2 py-1 border border-slate-300 rounded-lg text-center font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Drawers</label>
              <input
                type="number"
                min="0"
                max="8"
                value={item.drawerCount}
                onChange={(e) => onUpdateItem({ ...item, drawerCount: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-2 py-1 border border-slate-300 rounded-lg text-center font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Shelves</label>
              <input
                type="number"
                min="0"
                max="10"
                value={item.shelfCount}
                onChange={(e) => onUpdateItem({ ...item, shelfCount: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-2 py-1 border border-slate-300 rounded-lg text-center font-bold"
              />
            </div>
          </div>
        </div>

        {/* Real-time Generated Cut List for this cabinet */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Scissors className="w-4 h-4 text-amber-600" />
              Generated Factory Cut List ({cutListParts.length} parts)
            </h4>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {cutListParts.map((part) => (
              <div key={part.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <span className="font-semibold text-slate-900 block">{part.partName}</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {part.lengthMm} × {part.widthMm} × {part.thicknessMm}mm • {part.material}
                  </span>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-slate-800">
                    Qty: {part.qty}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    {part.areaSqMt} m²
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
        >
          Done
        </button>
      </div>
    </div>
  );
};
