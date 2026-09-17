import React, { useState } from 'react';
import { CutListPart } from '../types';
import { X, Save, Ruler, Layers } from 'lucide-react';

interface PartEditModalProps {
  part: CutListPart;
  onClose: () => void;
  onSave: (updates: Partial<CutListPart>) => void;
}

// Full editable popup for a single cut panel. Every field here feeds
// straight back into the shared cutList state in App.tsx, so saving
// recalculates sheet nesting, material totals, hardware counts, cost, and
// every export automatically - there's no separate "apply" step.
export const PartEditModal: React.FC<PartEditModalProps> = ({ part, onClose, onSave }) => {
  const [lengthMm, setLengthMm] = useState(part.lengthMm);
  const [widthMm, setWidthMm] = useState(part.widthMm);
  const [thicknessMm, setThicknessMm] = useState(part.thicknessMm);
  const [qty, setQty] = useState(part.qty);
  const [material, setMaterial] = useState(part.material);
  const [edgeL1, setEdgeL1] = useState(part.edgeL1);
  const [edgeL2, setEdgeL2] = useState(part.edgeL2);
  const [edgeW1, setEdgeW1] = useState(part.edgeW1);
  const [edgeW2, setEdgeW2] = useState(part.edgeW2);
  const [edgeThicknessMm, setEdgeThicknessMm] = useState(part.edgeThicknessMm);
  const [notes, setNotes] = useState(part.notes || '');

  const handleSave = () => {
    const safeLength = Math.max(1, lengthMm);
    const safeWidth = Math.max(1, widthMm);
    const safeQty = Math.max(1, Math.round(qty));
    onSave({
      lengthMm: safeLength,
      widthMm: safeWidth,
      thicknessMm: Math.max(1, thicknessMm),
      qty: safeQty,
      material,
      edgeL1,
      edgeL2,
      edgeW1,
      edgeW2,
      edgeThicknessMm,
      notes: notes.trim() || undefined,
      areaSqMt: Number(((safeLength * safeWidth * safeQty) / 1_000_000).toFixed(3)),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase bg-cyan-800 text-cyan-200 px-2 py-0.5 rounded">
              {part.room} • {part.itemName}
            </span>
            <h3 className="text-base font-bold text-white mt-1 flex items-center gap-1.5">
              <Ruler className="w-4 h-4 text-cyan-300" />
              Edit {part.partName}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs text-slate-700 max-h-[70vh] overflow-y-auto">
          {/* Dimensions */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Length (mm)</label>
              <input
                type="number"
                value={lengthMm}
                onChange={(e) => setLengthMm(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Width (mm)</label>
              <input
                type="number"
                value={widthMm}
                onChange={(e) => setWidthMm(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Thickness (mm)</label>
              <input
                type="number"
                value={thicknessMm}
                onChange={(e) => setThicknessMm(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Qty + Material */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Qty</label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Material</label>
              <input
                type="text"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Edge Banding */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> Edge Banding
            </label>
            <div className="flex flex-wrap items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              {([
                ['edgeL1', 'Length Side 1', edgeL1, setEdgeL1],
                ['edgeL2', 'Length Side 2', edgeL2, setEdgeL2],
                ['edgeW1', 'Width Side 1', edgeW1, setEdgeW1],
                ['edgeW2', 'Width Side 2', edgeW2, setEdgeW2],
              ] as const).map(([key, label, value, setter]) => (
                <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setter(e.target.checked)}
                    className="w-3.5 h-3.5 accent-cyan-600"
                  />
                  <span className="text-slate-700 font-medium">{label}</span>
                </label>
              ))}
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-slate-500">Thickness:</span>
                <select
                  value={edgeThicknessMm}
                  onChange={(e) => setEdgeThicknessMm(parseFloat(e.target.value))}
                  className="border border-slate-300 rounded px-1.5 py-1 font-mono font-bold text-slate-900 focus:outline-hidden"
                >
                  <option value={0}>None</option>
                  <option value={0.8}>0.8mm</option>
                  <option value={2.0}>2.0mm</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <p className="text-[11px] text-slate-400">
            Saving updates this panel everywhere it's used: sheet nesting, material totals, hardware counts, the BOM/cost report, and every export.
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 shadow-sm transition"
          >
            <Save className="w-3.5 h-3.5" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
