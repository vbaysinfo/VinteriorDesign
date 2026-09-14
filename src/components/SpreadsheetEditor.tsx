import React, { useState, useMemo } from 'react';
import { ModularItem, CutListPart, WallType, ProjectType } from '../types';
import { ftToMm, mmToFt, recalculateItemMetrics } from '../utils/calculator';
import { exportCutListFactoryFormat } from '../utils/excelParser';
import { Plus, Trash2, Copy, Search, Filter, ArrowUpDown, FileSpreadsheet, Download } from 'lucide-react';

interface SpreadsheetEditorProps {
  items: ModularItem[];
  cutList: CutListPart[];
  projectType: ProjectType;
  selectedRoom: string;
  onSelectRoom: (room: string) => void;
  onUpdateItems: (newItems: ModularItem[]) => void;
  onSelectItem?: (item: ModularItem) => void;
  selectedItemId?: string;
}

export const SpreadsheetEditor: React.FC<SpreadsheetEditorProps> = ({
  items,
  cutList,
  projectType,
  selectedRoom,
  onSelectRoom,
  onUpdateItems,
  onSelectItem,
  selectedItemId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWallFilter, setSelectedWallFilter] = useState<'all' | WallType>('all');
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);

  // Unique rooms list
  const uniqueRooms = useMemo(() => {
    const set = new Set(items.map((i) => i.room));
    return ['ALL', ...Array.from(set)];
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchRoom = selectedRoom === 'ALL' || item.room === selectedRoom;
      const matchWall = selectedWallFilter === 'all' || item.wall === selectedWallFilter;
      const matchSearch =
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.sNo).includes(searchQuery);
      return matchRoom && matchWall && matchSearch;
    });
  }, [items, selectedRoom, selectedWallFilter, searchQuery]);

  // Handle cell edit
  const handleCellChange = (id: string, field: keyof ModularItem, value: any) => {
    const updated = items.map((item) => {
      if (item.id !== id) return item;

      let newItem = { ...item, [field]: value };

      // Synchronize bidirectional dimensions
      if (field === 'widthFt') {
        const num = parseFloat(value) || 0;
        newItem.widthFt = num;
        newItem.widthMm = ftToMm(num);
      } else if (field === 'widthMm') {
        const num = parseInt(value, 10) || 0;
        newItem.widthMm = num;
        newItem.widthFt = mmToFt(num);
      } else if (field === 'heightFt') {
        const num = parseFloat(value) || 0;
        newItem.heightFt = num;
        newItem.heightMm = ftToMm(num);
      } else if (field === 'heightMm') {
        const num = parseInt(value, 10) || 0;
        newItem.heightMm = num;
        newItem.heightFt = mmToFt(num);
      } else if (field === 'depthFt') {
        const num = parseFloat(value) || 0;
        newItem.depthFt = num;
        newItem.depthMm = num > 0 ? ftToMm(num) : 0;
      } else if (field === 'depthMm') {
        const num = parseInt(value, 10) || 0;
        newItem.depthMm = num;
        newItem.depthFt = num > 0 ? mmToFt(num) : 0;
      } else if (field === 'quantity') {
        newItem.quantity = Math.max(1, parseInt(value, 10) || 1);
      }

      return recalculateItemMetrics(newItem);
    });

    onUpdateItems(updated);
  };

  // Add new item row
  const handleAddNewRow = () => {
    const newSNo = items.length > 0 ? Math.max(...items.map((i) => i.sNo)) + 1 : 1;
    const defaultRoom = selectedRoom !== 'ALL' ? selectedRoom : 'Living Room';
    const newItem: ModularItem = {
      id: `item-${Date.now()}`,
      sNo: newSNo,
      room: defaultRoom,
      description: 'New Modular Cabinet',
      wall: 'front',
      category: 'wardrobe_shutter',
      widthFt: 4,
      heightFt: 7,
      depthFt: projectType === 'semi' ? 0 : 1.8,
      widthMm: ftToMm(4),
      heightMm: ftToMm(7),
      depthMm: projectType === 'semi' ? 0 : ftToMm(1.8),
      calcBasis: projectType === 'semi' ? 'Area (Sq.ft)' : 'Volume (Cu.ft)',
      areaSqFt: 28,
      volumeCuFt: projectType === 'semi' ? 0 : 50.4,
      projectType,
      shutterCount: 2,
      drawerCount: 0,
      shelfCount: 3,
      finishType: 'Laminate',
      coreMaterial: 'BWR Commercial Ply',
      quantity: 1,
    };
    onUpdateItems([...items, recalculateItemMetrics(newItem)]);
  };

  // Duplicate item
  const handleDuplicate = (item: ModularItem) => {
    const newItem: ModularItem = {
      ...item,
      id: `item-${Date.now()}`,
      sNo: Math.max(...items.map((i) => i.sNo)) + 1,
      description: `${item.description} (Copy)`,
    };
    onUpdateItems([...items, newItem]);
  };

  // Delete item
  const handleDelete = (id: string) => {
    if (items.length <= 1) return;
    onUpdateItems(items.filter((i) => i.id !== id));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Top Filter and Search Bar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        {/* Room Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
          <span className="text-xs font-semibold text-slate-500 uppercase mr-1">Rooms:</span>
          {uniqueRooms.map((room) => (
            <button
              key={room}
              onClick={() => onSelectRoom(room)}
              className={`px-3 py-1 text-xs rounded-lg font-medium whitespace-nowrap transition ${
                selectedRoom === room
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {room}
              {room !== 'ALL' && (
                <span className="ml-1.5 opacity-60 text-[10px]">
                  ({items.filter((i) => i.room === room).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Controls & Actions */}
        <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
          {/* Wall Filter */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
            <span className="text-xs text-slate-500">Wall:</span>
            <select
              value={selectedWallFilter}
              onChange={(e) => setSelectedWallFilter(e.target.value as any)}
              className="text-xs text-slate-700 bg-transparent focus:outline-hidden font-medium"
            >
              <option value="all">All Walls</option>
              <option value="front">Front Wall</option>
              <option value="left">Left Wall</option>
              <option value="right">Right Wall</option>
              <option value="back">Back Wall</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 w-36 focus:w-48 transition-all focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          {/* Add Row Button */}
          <button
            onClick={handleAddNewRow}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </button>

          {/* Export Factory Cut List (matches the user's CUT_LEST template headers exactly) */}
          <button
            onClick={() =>
              exportCutListFactoryFormat(
                cutList,
                `Cut_List_Factory_Format_${projectType === 'semi' ? 'Semi_Modular' : 'Full_Modular'}.xlsx`
              )
            }
            title="Export the current Semi/Full Modular cut list using your factory's exact CUT_LEST column headers (NAME, LENGTH, WIDTH, QUANTITY, NOTE, MATERIAL, EDGING..., TYPE)"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Factory Cut List ({projectType === 'semi' ? 'Semi' : 'Full'} Modular)</span>
          </button>
        </div>
      </div>

      {/* Spreadsheet Table */}
      <div className="overflow-x-auto max-h-[540px]">
        <table className="w-full text-left text-xs text-slate-700 border-collapse">
          <thead className="bg-[#1e293b] text-white sticky top-0 z-10 select-none text-[11px] uppercase tracking-wider font-semibold">
            <tr>
              <th className="py-2.5 px-2 border-r border-slate-600 text-center w-12">S.No</th>
              <th className="py-2.5 px-3 border-r border-slate-600 w-28">Room</th>
              <th className="py-2.5 px-2 border-r border-slate-600 text-center w-20">Wall</th>
              <th className="py-2.5 px-3 border-r border-slate-600 min-w-[180px]">Item / Furniture Description</th>
              <th className="py-2.5 px-2 border-r border-slate-600 text-center bg-cyan-950/80 w-18">
                Width (ft) <span className="text-[9px] font-normal block lowercase opacity-80">semi + full</span>
              </th>
              <th className="py-2.5 px-2 border-r border-slate-600 text-center bg-cyan-950/80 w-18">
                Length (ft) <span className="text-[9px] font-normal block lowercase opacity-80">semi + full</span>
              </th>
              <th className="py-2.5 px-2 border-r border-slate-600 text-center bg-cyan-950/80 min-w-[120px]">
                Depth (ft) <span className="text-[9px] font-normal block lowercase opacity-80">[full modular only, 0=Frame/Shutter]</span>
              </th>
              <th className="py-2.5 px-2 border-r border-slate-600 text-center bg-slate-800 text-emerald-300 w-20">Width (mm)</th>
              <th className="py-2.5 px-2 border-r border-slate-600 text-center bg-slate-800 text-emerald-300 w-20">Length (mm)</th>
              <th className="py-2.5 px-2 border-r border-slate-600 text-center bg-slate-800 text-emerald-300 w-20">Depth (mm)</th>
              <th className="py-2.5 px-2 border-r border-slate-600 text-center w-28">Calc. Basis</th>
              <th className="py-2.5 px-3 border-r border-slate-600 text-right bg-amber-950/70 text-amber-200 min-w-[110px]">
                Area / Volume
              </th>
              <th className="py-2.5 px-2 border-r border-slate-600 text-center w-16">Qty</th>
              <th className="py-2.5 px-3 border-r border-slate-600 min-w-[140px] bg-fuchsia-950/60">Laminate Color Code</th>
              <th className="py-2.5 px-3 border-r border-slate-600 min-w-[140px] bg-fuchsia-950/60">Material</th>
              <th className="py-2.5 px-3 border-r border-slate-600 min-w-[140px] bg-fuchsia-950/60">Edge Binding</th>
              <th className="py-2.5 px-3 border-r border-slate-600 min-w-[140px]">Note</th>
              <th className="py-2.5 px-2 text-center w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white font-mono text-[11px]">
            {filteredItems.map((item, index) => {
              const isSelected = selectedItemId === item.id;
              return (
                <tr
                  key={item.id}
                  onClick={() => onSelectItem && onSelectItem(item)}
                  className={`hover:bg-cyan-50/70 transition-colors cursor-pointer ${
                    isSelected ? 'bg-amber-50 font-semibold ring-1 ring-amber-400' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  {/* S.No */}
                  <td className="py-1.5 px-2 border-r border-slate-200 text-center font-sans font-bold text-slate-500">
                    {item.sNo}
                  </td>

                  {/* Room */}
                  <td className="py-1.5 px-3 border-r border-slate-200">
                    <input
                      type="text"
                      value={item.room}
                      onChange={(e) => handleCellChange(item.id, 'room', e.target.value)}
                      className="w-full bg-transparent font-sans font-semibold text-cyan-900 focus:bg-white focus:ring-1 focus:ring-cyan-500 rounded px-1"
                    />
                  </td>

                  {/* Wall */}
                  <td className="py-1.5 px-2 border-r border-slate-200 text-center">
                    <select
                      value={item.wall}
                      onChange={(e) => handleCellChange(item.id, 'wall', e.target.value as WallType)}
                      className="text-[10px] font-sans font-bold uppercase bg-slate-100 hover:bg-slate-200 px-1 py-0.5 rounded text-slate-700 focus:outline-hidden"
                    >
                      <option value="front">Front</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                      <option value="back">Back</option>
                    </select>
                  </td>

                  {/* Item Description */}
                  <td className="py-1.5 px-3 border-r border-slate-200 font-sans">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleCellChange(item.id, 'description', e.target.value)}
                      className="w-full bg-transparent text-slate-900 font-medium focus:bg-white focus:ring-1 focus:ring-cyan-500 rounded px-1"
                    />
                  </td>

                  {/* Width ft */}
                  <td className="py-1.5 px-2 border-r border-slate-200 text-center bg-cyan-50/30">
                    <input
                      type="number"
                      step="0.1"
                      value={item.widthFt}
                      onChange={(e) => handleCellChange(item.id, 'widthFt', e.target.value)}
                      className="w-full text-center bg-transparent text-blue-700 font-bold focus:bg-white focus:ring-1 focus:ring-cyan-500 rounded"
                    />
                  </td>

                  {/* Height ft */}
                  <td className="py-1.5 px-2 border-r border-slate-200 text-center bg-cyan-50/30">
                    <input
                      type="number"
                      step="0.1"
                      value={item.heightFt}
                      onChange={(e) => handleCellChange(item.id, 'heightFt', e.target.value)}
                      className="w-full text-center bg-transparent text-blue-700 font-bold focus:bg-white focus:ring-1 focus:ring-cyan-500 rounded"
                    />
                  </td>

                  {/* Depth ft (customizable for boxes, 0 for frames in semi-modular) */}
                  <td className="py-1.5 px-2 border-r border-slate-200 text-center bg-cyan-50/30">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0 (Frame)"
                      value={item.depthFt === 0 ? '' : item.depthFt}
                      onChange={(e) => handleCellChange(item.id, 'depthFt', e.target.value === '' ? 0 : e.target.value)}
                      className="w-full text-center bg-transparent text-blue-700 font-bold placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-cyan-500 rounded"
                    />
                  </td>

                  {/* Width mm (auto-calculated) */}
                  <td className="py-1.5 px-2 border-r border-slate-200 text-center text-emerald-700 font-semibold bg-emerald-50/20">
                    {item.widthMm}
                  </td>

                  {/* Height mm (auto-calculated) */}
                  <td className="py-1.5 px-2 border-r border-slate-200 text-center text-emerald-700 font-semibold bg-emerald-50/20">
                    {item.heightMm}
                  </td>

                  {/* Depth mm (auto-calculated) */}
                  <td className="py-1.5 px-2 border-r border-slate-200 text-center text-emerald-700 font-semibold bg-emerald-50/20">
                    {item.depthMm > 0 ? item.depthMm : '-'}
                  </td>

                  {/* Calc Basis */}
                  <td className="py-1.5 px-2 border-r border-slate-200 text-center font-sans">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        item.calcBasis === 'Volume (Cu.ft)'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {item.calcBasis}
                    </span>
                  </td>

                  {/* Area / Volume Result */}
                  <td className="py-1.5 px-3 border-r border-slate-200 text-right font-bold text-slate-800 bg-amber-50/40">
                    {item.calcBasis === 'Area (Sq.ft)' ? `${item.areaSqFt} Sq.ft` : `${item.volumeCuFt} Cu.ft`}
                  </td>

                  {/* Quantity (multiplies cut list & cost) */}
                  <td className="py-1.5 px-2 border-r border-slate-200 text-center">
                    <input
                      type="number"
                      min={1}
                      step="1"
                      value={item.quantity ?? 1}
                      onChange={(e) => handleCellChange(item.id, 'quantity', e.target.value)}
                      className="w-full text-center bg-transparent text-slate-800 font-bold focus:bg-white focus:ring-1 focus:ring-cyan-500 rounded"
                    />
                  </td>

                  {/* Laminate Color Code */}
                  <td className="py-1.5 px-3 border-r border-slate-200 font-sans">
                    <input
                      type="text"
                      placeholder="e.g. Ivory - IV102"
                      value={item.laminateColorCode || ''}
                      onChange={(e) => handleCellChange(item.id, 'laminateColorCode', e.target.value)}
                      className="w-full bg-transparent text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-cyan-500 rounded px-1"
                    />
                  </td>

                  {/* Material (free-text override for the exported Material label; blank = auto from Core Material + Finish) */}
                  <td className="py-1.5 px-3 border-r border-slate-200 font-sans">
                    <input
                      type="text"
                      placeholder={`${item.coreMaterial} (${item.finishType})`}
                      value={item.materialCode || ''}
                      onChange={(e) => handleCellChange(item.id, 'materialCode', e.target.value)}
                      className="w-full bg-transparent text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-cyan-500 rounded px-1"
                    />
                  </td>

                  {/* Edge Binding note */}
                  <td className="py-1.5 px-3 border-r border-slate-200 font-sans">
                    <input
                      type="text"
                      placeholder="e.g. 2mm PVC all sides"
                      value={item.edgeBindingNote || ''}
                      onChange={(e) => handleCellChange(item.id, 'edgeBindingNote', e.target.value)}
                      className="w-full bg-transparent text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-cyan-500 rounded px-1"
                    />
                  </td>

                  {/* Note */}
                  <td className="py-1.5 px-3 border-r border-slate-200 font-sans">
                    <input
                      type="text"
                      value={item.notes || ''}
                      onChange={(e) => handleCellChange(item.id, 'notes', e.target.value)}
                      className="w-full bg-transparent text-slate-800 focus:bg-white focus:ring-1 focus:ring-cyan-500 rounded px-1"
                    />
                  </td>

                  {/* Actions */}
                  <td className="py-1.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleDuplicate(item)}
                        title="Duplicate Row"
                        className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200 transition"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        title="Delete Row"
                        className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer totals bar */}
      <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 text-xs font-medium text-slate-700 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span>
            Total Items: <strong className="text-slate-900">{filteredItems.length}</strong>
          </span>
          <span>
            Total Area Basis: <strong className="text-cyan-700">{filteredItems.filter((i) => i.calcBasis === 'Area (Sq.ft)').reduce((s, i) => s + i.areaSqFt, 0).toFixed(2)} Sq.ft</strong>
          </span>
          <span>
            Total Volume Basis: <strong className="text-amber-700">{filteredItems.filter((i) => i.calcBasis === 'Volume (Cu.ft)').reduce((s, i) => s + i.volumeCuFt, 0).toFixed(2)} Cu.ft</strong>
          </span>
        </div>
        <div className="text-slate-500 text-[11px]">
          Editing dimensions in ft automatically synchronizes millimeter metrics and cut list geometry.
        </div>
      </div>
    </div>
  );
};
