import React from 'react';
import { ModularItem, ProjectType, FactoryRates } from '../types';
import {
  generateCutListForItem,
  mmToFt,
  recalculateItemMetrics,
  getShutterLayout,
  hasShutterDoors,
  redistributeShutterWidths,
  getEffectiveDepthMm,
} from '../utils/calculator';
import { X, Box, Layers, Scissors, Check, Sliders, DoorOpen } from 'lucide-react';
import { NumberField } from './NumberField';

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

  // Editing width/height/depth here always goes through the ft fields
  // (recalculateItemMetrics derives mm from ft), matching the same
  // bidirectional sync rule the Excel Format Editor grid uses, so a value
  // typed here and a value typed there never disagree on how it's stored.
  const handleDimensionChange = (field: 'widthMm' | 'heightMm' | 'depthMm', num: number) => {
    const updated: ModularItem = { ...item };
    if (field === 'widthMm') {
      updated.widthMm = num;
      updated.widthFt = mmToFt(num);
    } else if (field === 'heightMm') {
      updated.heightMm = num;
      updated.heightFt = mmToFt(num);
    } else {
      updated.depthMm = num;
      updated.depthFt = num > 0 ? mmToFt(num) : 0;
    }
    onUpdateItem(recalculateItemMetrics(updated));
  };

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
              <span className="text-slate-400 text-[10px] block mb-0.5">WIDTH (mm)</span>
              <NumberField
                min={0}
                value={item.widthMm}
                onCommit={(num) => handleDimensionChange('widthMm', num)}
                className="w-full text-center bg-slate-50 border border-slate-200 rounded font-mono font-bold text-sm text-slate-900 py-1 focus:bg-white focus:ring-1 focus:ring-cyan-500"
              />
              <span className="text-slate-500 text-[10px] block mt-0.5">({item.widthFt} ft)</span>
            </div>
            <div className="p-2 bg-white rounded-lg border border-slate-200">
              <span className="text-slate-400 text-[10px] block mb-0.5">HEIGHT (mm)</span>
              <NumberField
                min={0}
                value={item.heightMm}
                onCommit={(num) => handleDimensionChange('heightMm', num)}
                className="w-full text-center bg-slate-50 border border-slate-200 rounded font-mono font-bold text-sm text-slate-900 py-1 focus:bg-white focus:ring-1 focus:ring-cyan-500"
              />
              <span className="text-slate-500 text-[10px] block mt-0.5">({item.heightFt} ft)</span>
            </div>
            <div className="p-2 bg-white rounded-lg border border-slate-200">
              <span className="text-slate-400 text-[10px] block mb-0.5">DEPTH (mm)</span>
              <NumberField
                min={0}
                zeroAsEmpty
                placeholder="0 (Frame)"
                value={item.depthMm}
                onCommit={(num) => handleDimensionChange('depthMm', num)}
                className="w-full text-center bg-slate-50 border border-slate-200 rounded font-mono font-bold text-sm text-slate-900 py-1 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-cyan-500"
              />
              <span className="text-slate-500 text-[10px] block mt-0.5">
                {item.depthFt > 0 ? `(${item.depthFt} ft)` : 'Civil niche'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1 text-slate-600">
            <span>Calculation Basis: <strong>{item.calcBasis}</strong></span>
            <span>Total: <strong>{item.calcBasis === 'Area (Sq.ft)' ? `${item.areaSqFt} Sq.ft` : `${item.volumeCuFt} Cu.ft`}</strong></span>
          </div>
        </div>

        {/* Per-Shutter Width Editor - the individual dividers in the 2D CAD
            drawing are clickable too, but hitting the exact pixel for one
            door in a zoomed/panned SVG is fiddly, so every door is also
            listed here with a plain number input as a reliable fallback. */}
        {hasShutterDoors(item) &&
          (() => {
            const { count, widths } = getShutterLayout(item);
            const pType = item.projectType || projectType;
            const isBoxUnit = getEffectiveDepthMm(item, pType) > 0;
            const shutterHeight = isBoxUnit ? item.heightMm - 20 : item.heightMm;
            const hasOverride = !!item.shutterWidthOverrides;
            return (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between font-semibold text-slate-900 pb-2 border-b border-slate-200">
                  <span className="flex items-center gap-1.5">
                    <DoorOpen className="w-4 h-4 text-cyan-600" />
                    Shutter Widths ({count})
                  </span>
                  {hasOverride && (
                    <button
                      onClick={() => {
                        const { shutterWidthOverrides, ...rest } = item;
                        onUpdateItem(rest);
                      }}
                      className="text-[11px] text-cyan-700 underline hover:text-cyan-900"
                    >
                      Reset to auto split
                    </button>
                  )}
                </div>

                {count > 1 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {widths.map((w, i) => (
                      <div key={i} className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-2">
                        <span className="text-slate-500 font-semibold shrink-0">Door {i + 1}</span>
                        <NumberField
                          min={50}
                          value={w}
                          onCommit={(num) =>
                            onUpdateItem({ ...item, shutterWidthOverrides: redistributeShutterWidths(item, i, num) })
                          }
                          className="w-20 text-center bg-slate-50 border border-slate-200 rounded font-mono font-bold py-1 focus:bg-white focus:ring-1 focus:ring-cyan-500"
                        />
                        <span className="text-slate-400 shrink-0">mm</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500">Single door - its width always matches the item's own Width above.</p>
                )}
                <p className="text-[10px] text-slate-400">
                  Height per door: {shutterHeight}mm. Widening one door narrows the others so they always add up to
                  the item's total width.
                </p>
              </div>
            );
          })()}

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
              <NumberField
                min={0}
                value={item.shutterCount}
                onCommit={(num) => onUpdateItem({ ...item, shutterCount: num })}
                className="w-full px-2 py-1 border border-slate-300 rounded-lg text-center font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Drawers</label>
              <NumberField
                min={0}
                value={item.drawerCount}
                onCommit={(num) => onUpdateItem({ ...item, drawerCount: num })}
                className="w-full px-2 py-1 border border-slate-300 rounded-lg text-center font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Shelves</label>
              <NumberField
                min={0}
                value={item.shelfCount}
                onCommit={(num) => onUpdateItem({ ...item, shelfCount: num })}
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
