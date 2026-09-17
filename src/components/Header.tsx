import React, { useRef } from 'react';
import { ProjectInfo, ProjectType } from '../types';
import { Upload, Download, FileSpreadsheet, FileText, Layers, RefreshCw, Settings2, Trash2, Printer } from 'lucide-react';
import { parseExcelFile, exportToExcel } from '../utils/excelParser';
import { ModularItem } from '../types';
import { INITIAL_ITEMS } from '../data/initialData';

interface HeaderProps {
  projectInfo: ProjectInfo;
  projectType: ProjectType;
  items: ModularItem[];
  onUpdateProjectType: (type: ProjectType) => void;
  onUpdateProjectInfo: (info: ProjectInfo) => void;
  onUploadItems: (items: ModularItem[]) => void;
  onExportPdf: () => void;
  onPrintCadLayout: () => void;
  onResetSampleData: () => void;
  onClearProject: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projectInfo,
  projectType,
  items,
  onUpdateProjectType,
  onUpdateProjectInfo,
  onUploadItems,
  onExportPdf,
  onPrintCadLayout,
  onResetSampleData,
  onClearProject,
  onOpenSettings,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await parseExcelFile(file);
      if (parsed.length > 0) {
        onUploadItems(parsed);
      } else {
        // Previously failed silently: 0 rows parsed left the project
        // completely unchanged with no feedback, looking exactly like
        // "nothing happened" - most commonly because the sheet has no
        // column the parser recognizes as the item description (it needs
        // one containing "item", "furniture", "description", or
        // "particular"), so every row is skipped as empty.
        alert(
          `No items could be read from "${file.name}".\n\n` +
          `Every row was skipped because no "Item / Furniture Description" column was found - a row with nothing in that column is treated as blank and ignored.\n\n` +
          `Required: a Description column, plus Width and Height/Length columns.\n` +
          `Click "Sample Excel" to download a template with the exact headers this app recognizes.`
        );
      }
    } catch (err: any) {
      console.error('Failed to parse Excel file', err);
      alert(`Excel Parse Error: ${err.message || 'Please check the file format'}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadSampleExcel = () => {
    exportToExcel(INITIAL_ITEMS, 'Modular_Estimation_Sample_Template.xlsx');
  };

  const handleClearClick = () => {
    if (items.length === 0) return;
    const confirmed = window.confirm(
      `Clear the entire project? This removes all ${items.length} items so you can upload a fresh Excel sheet. This cannot be undone.`
    );
    if (confirmed) onClearProject();
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Branding & Project Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center text-white font-black text-xl shadow-md">
            M
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                Modular Factory Estimation & 2D CAD
              </h1>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  projectType === 'semi' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {projectType === 'semi' ? 'Semi Modular' : 'Full Modular'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {projectInfo.projectName} • {items.length} Items Configured
            </p>
          </div>
        </div>

        {/* Center: Semi vs Full Modular Switcher */}
        <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => onUpdateProjectType('semi')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              projectType === 'semi'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Civil based, shutters & shelves, fixed W/H, customizable depth (or 0 for frames)"
          >
            Semi Modular
          </button>
          <button
            onClick={() => onUpdateProjectType('full')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              projectType === 'full'
                ? 'bg-emerald-500 text-slate-950 shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Factory prefabricated 100% carcass boxes and back panels"
          >
            Full Modular
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />

          {/* Upload Excel Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            title="Upload your Excel sheet (.xlsx, .xls, .csv)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Excel</span>
          </button>

          {/* Download Sample Template */}
          <button
            onClick={handleDownloadSampleExcel}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition"
            title="Download blank sample Excel template"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Sample Excel</span>
          </button>

          {/* Export PDF Button */}
          <button
            onClick={onExportPdf}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export Proposal</span>
          </button>

          {/* Print CAD Layout (all rooms, forced light theme, app chrome hidden) */}
          <button
            onClick={onPrintCadLayout}
            className="px-3 py-1.5 bg-slate-100 hover:bg-white text-slate-800 rounded-lg text-xs font-semibold border border-slate-300 flex items-center gap-1.5 shadow-sm transition"
            title="Print the 2D AutoCAD layout for every room, on a clean light background - no dark theme, no app menus"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print CAD (All Rooms)</span>
          </button>

          {/* Project Settings Modal Trigger */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Project & Client Settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>

          {/* Reset / Reload Sample */}
          <button
            onClick={onResetSampleData}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition"
            title="Reload Original Factory Dataset"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Clear Project (full wipe, ready for a fresh Excel upload) */}
          <button
            onClick={handleClearClick}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 rounded-lg border border-slate-700 hover:border-rose-800 flex items-center gap-1.5 transition"
            title="Clear Project: remove all items so you can upload a fresh Excel sheet from scratch"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden md:inline text-xs font-semibold">Clear Project</span>
          </button>
        </div>
      </div>
    </header>
  );
};
