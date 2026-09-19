import React, { useState, useMemo, useEffect } from 'react';
import { ModularItem, ProjectInfo, ProjectType, FactoryRates, CutListPart, HardwareRules } from './types';
import { INITIAL_ITEMS, DEFAULT_PROJECT_INFO, DEFAULT_FACTORY_RATES } from './data/initialData';
import {
  generateAllCutLists,
  calculateMaterialUsage,
  calculateProjectCost,
  calculateHardwareBOM,
  DEFAULT_HARDWARE_RULES,
} from './utils/calculator';
import { generateBOMProposalPDF } from './utils/pdfGenerator';
import { Header } from './components/Header';
import { Cad2DViewer } from './components/Cad2DViewer';
import { SpreadsheetEditor } from './components/SpreadsheetEditor';
import { CuttingListViewer } from './components/CuttingListViewer';
import { PricingReport } from './components/PricingReport';
import { HardwareBOMReport } from './components/HardwareBOMReport';
import { RoomBoxSchedule } from './components/RoomBoxSchedule';
import { AnalyticsReport } from './components/AnalyticsReport';
import { AIAnalysisPage } from './components/AIAnalysisPage';
import { ItemInspectorDrawer } from './components/ItemInspectorDrawer';
import { ProjectSettingsModal } from './components/ProjectSettingsModal';
import { PrintableCadLayout } from './components/PrintableCadLayout';
import { PrintableCuttingList } from './components/PrintableCuttingList';
import { Layers, FileSpreadsheet, Scissors, Calculator, Info, UploadCloud, Maximize2, Minimize2, Boxes, BarChart3, Sparkles, Wrench } from 'lucide-react';

export default function App() {
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>(DEFAULT_PROJECT_INFO);
  const [projectType, setProjectType] = useState<ProjectType>('semi');
  // Fresh start: the app opens with no items so nobody mistakes the built-in
  // sample dataset for their own project data. Use "Load Sample Data" in the
  // header (onResetSampleData) to bring in INITIAL_ITEMS on demand.
  const [items, setItems] = useState<ModularItem[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'cad_layout' | 'spreadsheet' | 'cut_list' | 'box_schedule' | 'analytics' | 'ai_analysis' | 'pricing_bom' | 'hardware_bom'>('cad_layout');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [rates, setRates] = useState<FactoryRates>(DEFAULT_FACTORY_RATES);
  // Factory-configurable hardware quantity rules (hinge counts, shelf pins,
  // box joining system, etc.) - separate from `rates` above, which only
  // prices hardware, not counts it. Defaults match the app's own prior
  // hardcoded hardware behavior exactly.
  const [hardwareRules, setHardwareRules] = useState<HardwareRules>(DEFAULT_HARDWARE_RULES);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Full width is the default layout for every tab, not just the CAD
  // canvas - "Standard" just narrows the content column for whoever
  // prefers reading a table/report at a fixed, centered width.
  const [isFullWidth, setIsFullWidth] = useState<boolean>(true);
  // Per-panel overrides, keyed by CutListPart.id (stable across regeneration
  // since it's derived from the item id + part type). Lets a user hand-edit
  // any field of an individual panel in the Cutting List tab - dimensions,
  // quantity, material, edge banding, notes - without it being overwritten
  // the next time items/projectType change. Every downstream calculation
  // (materials, cost, sheet nesting, exports) reads from `cutList` below, so
  // an edit here automatically recalculates the whole project.
  const [partOverrides, setPartOverrides] = useState<Record<string, Partial<CutListPart>>>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Generate Cut List
  const cutList = useMemo(() => {
    const generated = generateAllCutLists(items, projectType);
    if (Object.keys(partOverrides).length === 0) return generated;
    return generated.map((part) =>
      partOverrides[part.id] ? { ...part, ...partOverrides[part.id] } : part
    );
  }, [items, projectType, partOverrides]);

  const handleUpdatePart = (partId: string, updates: Partial<CutListPart>) => {
    setPartOverrides((prev) => ({ ...prev, [partId]: { ...prev[partId], ...updates } }));
  };

  // Calculate Materials
  const materials = useMemo(() => {
    return calculateMaterialUsage(cutList, hardwareRules);
  }, [cutList, hardwareRules]);

  // Calculate Costs
  const costs = useMemo(() => {
    return calculateProjectCost(materials, items, rates);
  }, [materials, items, rates]);

  // Detailed, per-component Hardware BOM - the authoritative source for
  // the Hardware BOM report/export, always reflecting the live factory
  // hardware rules (unlike `materials` above, which only keeps its own
  // rough aggregate totals in sync).
  const hardwareBOM = useMemo(() => {
    return calculateHardwareBOM(cutList, hardwareRules, projectInfo.projectName);
  }, [cutList, hardwareRules, projectInfo.projectName]);

  // Currently inspected item
  const inspectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return items.find((i) => i.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  // Project Type Switch
  const handleUpdateProjectType = (type: ProjectType) => {
    setProjectType(type);
    showToast(`Switched project mode to ${type === 'semi' ? 'Semi Modular (Civil based)' : 'Full Modular (Factory prefab)'}`);
  };

  // Replace one item in place - shared by the Item Inspector Drawer and the
  // 2D CAD layout's own inline editors (dimensions, per-shutter widths), so
  // an edit from either place flows through the same items state and
  // recalculates cutList/materials/costs the same way.
  const handleUpdateItem = (updated: ModularItem) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  // Upload Excel items
  const handleUploadItems = (newItems: ModularItem[]) => {
    setItems(newItems);
    setSelectedItemId(null);
    setPartOverrides({});
    // Auto select first room from uploaded items
    if (newItems.length > 0 && newItems[0].room) {
      setSelectedRoom(newItems[0].room);
    }
    // Jump straight to the CAD 2D layout so the freshly uploaded sheet is
    // immediately visible as a drawing, not left sitting on whatever tab
    // the user happened to be on.
    setActiveTab('cad_layout');
    showToast(`Successfully uploaded ${newItems.length} modular items from Excel sheet! Converted to CAD layout.`);
  };

  // Reset to original uploaded template
  const handleResetSampleData = () => {
    setItems(INITIAL_ITEMS);
    setProjectType('semi');
    setSelectedRoom('MBR');
    setSelectedItemId(null);
    setPartOverrides({});
    showToast('Reset to factory master dataset');
  };

  // Full clear: wipe every item so the project starts empty, ready for a
  // fresh Excel upload. Distinct from "Reset" above, which reloads the
  // built-in sample dataset rather than emptying the project.
  const handleClearProject = () => {
    setItems([]);
    setSelectedItemId(null);
    setSelectedRoom('ALL');
    setPartOverrides({});
    showToast('Project cleared. Upload an Excel sheet to start fresh.');
  };

  // Export PDF
  const handleExportPdf = () => {
    generateBOMProposalPDF(projectInfo, items, materials, costs, rates);
    showToast('BOM Proposal PDF generated and downloaded!');
  };

  // Two separate print outputs (the 2D CAD layout, and the factory cutting
  // list's sheets) share one print stylesheet, so only one can be visible
  // at a time - printTarget picks which of PrintableCadLayout /
  // PrintableCuttingList gets the "active" (print:block) class below.
  // window.print() has to wait for that class change to actually reach the
  // DOM first (setState is async), so it fires from an effect keyed off
  // pendingPrint rather than right after setPrintTarget.
  const [printTarget, setPrintTarget] = useState<'cad' | 'cutlist'>('cad');
  const [printRoomFilter, setPrintRoomFilter] = useState<string>('ALL');
  const [pendingPrint, setPendingPrint] = useState(false);

  useEffect(() => {
    if (pendingPrint) {
      window.print();
      setPendingPrint(false);
    }
  }, [pendingPrint]);

  // Print only the 2D CAD layout, all rooms, forced to a light theme -
  // independent of whatever theme/room/zoom the interactive canvas is
  // currently showing.
  const handlePrintCadLayout = () => {
    setPrintTarget('cad');
    setPendingPrint(true);
  };

  // Print the factory cutting list's sheets, in black & white. With no room
  // (or 'ALL') this is every sheet the project needs, grouped by whichever
  // room contributes most to each one; passing a specific room instead
  // prints only the sheets that room actually touches - nesting shares
  // sheets across rooms, so this is "every sheet with a piece for this
  // room," the same set the sidebar's own per-room sheet count uses.
  const handlePrintCuttingList = (room: string = 'ALL') => {
    setPrintRoomFilter(room);
    setPrintTarget('cutlist');
    setPendingPrint(true);
  };

  return (
    <>
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased text-slate-800 print:hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2 animate-in slide-in-from-bottom-5">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Top Header */}
      <Header
        projectInfo={projectInfo}
        projectType={projectType}
        items={items}
        onUpdateProjectType={handleUpdateProjectType}
        onUpdateProjectInfo={setProjectInfo}
        onUploadItems={handleUploadItems}
        onExportPdf={handleExportPdf}
        onPrintCadLayout={handlePrintCadLayout}
        onResetSampleData={handleResetSampleData}
        onClearProject={handleClearProject}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <main
        className={`flex-1 w-full mx-auto py-5 space-y-5 transition-all duration-200 ${
          isFullWidth ? 'max-w-[99%] px-2 sm:px-3 lg:px-4' : 'max-w-7xl px-4 sm:px-6'
        }`}
      >
        {/* Navigation Tabs Bar & Room Filter Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
          {/* Primary View Mode Tabs */}
          <nav className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveTab('cad_layout')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
                activeTab === 'cad_layout'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>CAD 2D / 3D Layout</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-700 font-mono font-bold">
                2D • 3D
              </span>
            </button>

            <button
              onClick={() => setActiveTab('spreadsheet')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
                activeTab === 'spreadsheet'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              <span>Excel Format Editor</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono">
                {items.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('cut_list')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
                activeTab === 'cut_list'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Scissors className="w-4 h-4 text-amber-500" />
              <span>Cutting List & Sheets</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono">
                {materials.totalSheets} Sheets • {materials.totalPieces} Pcs
              </span>
            </button>

            <button
              onClick={() => setActiveTab('box_schedule')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
                activeTab === 'box_schedule'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Boxes className="w-4 h-4 text-fuchsia-500" />
              <span>Room Box Schedule</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono">
                Semi vs Full
              </span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
                activeTab === 'analytics'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-cyan-500" />
              <span>Analytics Report</span>
            </button>

            <button
              onClick={() => setActiveTab('ai_analysis')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
                activeTab === 'ai_analysis'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span>AI Analysis</span>
            </button>

            <button
              onClick={() => setActiveTab('pricing_bom')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
                activeTab === 'pricing_bom'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Calculator className="w-4 h-4 text-indigo-400" />
              <span>Pricing & BOM Proposal</span>
            </button>

            <button
              onClick={() => setActiveTab('hardware_bom')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
                activeTab === 'hardware_bom'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Wrench className="w-4 h-4 text-orange-500" />
              <span>Hardware BOM</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono">
                {hardwareBOM.length} lines
              </span>
            </button>
          </nav>

          {/* Right Controls: Full Width Toggle & Room Selector Dropdown */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsFullWidth(!isFullWidth)}
              className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition ${
                isFullWidth
                  ? 'bg-cyan-600 text-white border-cyan-700 shadow-2xs'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
              title={isFullWidth ? 'Switch to Standard Boxed Width' : 'Expand to 100% Full Width'}
            >
              {isFullWidth ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isFullWidth ? 'Full Width (100%)' : 'Full Width'}</span>
            </button>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-semibold hidden md:inline">Active Room:</span>
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="text-xs font-bold bg-slate-100 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
              >
                <option value="ALL">All Rooms ({items.length} units)</option>
                {Array.from(new Set(items.map((i) => i.room))).map((r) => (
                  <option key={r} value={r}>
                    {r} ({items.filter((i) => i.room === r).length} units)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tab 1: AutoCAD 2D Layout Canvas */}
        {activeTab === 'cad_layout' && (
          <div className="space-y-4">
            <Cad2DViewer
              items={items}
              selectedRoom={selectedRoom}
              projectType={projectType}
              selectedItemId={selectedItemId || undefined}
              onSelectItem={(item) => setSelectedItemId(item.id)}
              isFullWidth={isFullWidth}
              onToggleFullWidth={() => setIsFullWidth(!isFullWidth)}
              onUpdateItem={handleUpdateItem}
            />
          </div>
        )}

        {/* Tab 2: Excel Format Editor Table */}
        {activeTab === 'spreadsheet' && (
          <div className="space-y-4">
            <SpreadsheetEditor
              items={items}
              cutList={cutList}
              projectType={projectType}
              selectedRoom={selectedRoom}
              onSelectRoom={setSelectedRoom}
              onUpdateItems={setItems}
              selectedItemId={selectedItemId || undefined}
              onSelectItem={(item) => setSelectedItemId(item.id)}
            />
          </div>
        )}

        {/* Tab 3: Real-Time Cutting List */}
        {activeTab === 'cut_list' && (
          <div className="space-y-4">
            <CuttingListViewer
              cutList={cutList}
              materials={materials}
              hardwareBOM={hardwareBOM}
              projectType={projectType}
              selectedRoom={selectedRoom}
              onUpdatePart={handleUpdatePart}
              onPrintCuttingList={handlePrintCuttingList}
            />
          </div>
        )}

        {/* Tab 4: Room-Wise Box Schedule (Semi vs Full comparison) */}
        {activeTab === 'box_schedule' && (
          <div className="space-y-4">
            <RoomBoxSchedule items={items} selectedRoom={selectedRoom} />
          </div>
        )}

        {/* Tab 5: Analytics Report (Sq.ft, sheets, laminate colors, wardrobes, edge binding - all rooms + per-room) */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <AnalyticsReport items={items} cutList={cutList} projectType={projectType} selectedRoom={selectedRoom} />
          </div>
        )}

        {/* Tab 6: AI Analysis (rules-based Excel/CAD understanding, error
            detection, cutting/material optimization, production info, and
            factory quality checks - all computed from this project's own
            data, no external AI call) */}
        {activeTab === 'ai_analysis' && (
          <div className="space-y-4">
            <AIAnalysisPage items={items} cutList={cutList} projectType={projectType} />
          </div>
        )}

        {/* Tab 7: Pricing Report & BOM */}
        {activeTab === 'pricing_bom' && (
          <div className="space-y-4">
            <PricingReport
              items={items}
              materials={materials}
              costs={costs}
              rates={rates}
              projectType={projectType}
              projectInfo={projectInfo}
              onUpdateRates={setRates}
              onExportPdf={handleExportPdf}
              onToggleProjectType={() =>
                handleUpdateProjectType(projectType === 'semi' ? 'full' : 'semi')
              }
            />
          </div>
        )}

        {activeTab === 'hardware_bom' && (
          <HardwareBOMReport
            hardwareBOM={hardwareBOM}
            hardwareRules={hardwareRules}
            onUpdateRules={setHardwareRules}
            selectedRoom={selectedRoom}
          />
        )}
      </main>

      {/* Cabinet Inspector Drawer */}
      {inspectedItem && (
        <ItemInspectorDrawer
          item={inspectedItem}
          projectType={projectType}
          rates={rates}
          currency={projectInfo.currency}
          onClose={() => setSelectedItemId(null)}
          onUpdateItem={handleUpdateItem}
        />
      )}

      {/* Project Settings Modal */}
      <ProjectSettingsModal
        projectInfo={projectInfo}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={(newInfo) => {
          setProjectInfo(newInfo);
          showToast('Project proposal details saved');
        }}
      />
    </div>

    {/* Print-only output: the interactive app above is hidden via
        print:hidden, and this light-theme, room-by-room CAD layout is the
        only thing that appears in the printed/PDF output. */}
    <PrintableCadLayout items={items} projectName={projectInfo.projectName} projectType={projectType} active={printTarget === 'cad'} />
    <PrintableCuttingList
      cutList={cutList}
      projectName={projectInfo.projectName}
      active={printTarget === 'cutlist'}
      roomFilter={printRoomFilter}
    />
    </>
  );
}
