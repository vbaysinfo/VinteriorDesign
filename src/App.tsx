import React, { useState, useMemo } from 'react';
import { ModularItem, ProjectInfo, ProjectType, FactoryRates } from './types';
import { INITIAL_ITEMS, DEFAULT_PROJECT_INFO, DEFAULT_FACTORY_RATES } from './data/initialData';
import { generateAllCutLists, calculateMaterialUsage, calculateProjectCost } from './utils/calculator';
import { generateBOMProposalPDF } from './utils/pdfGenerator';
import { Header } from './components/Header';
import { Cad2DViewer } from './components/Cad2DViewer';
import { SpreadsheetEditor } from './components/SpreadsheetEditor';
import { CuttingListViewer } from './components/CuttingListViewer';
import { PricingReport } from './components/PricingReport';
import { ItemInspectorDrawer } from './components/ItemInspectorDrawer';
import { ProjectSettingsModal } from './components/ProjectSettingsModal';
import { Layers, FileSpreadsheet, Scissors, Calculator, Info, UploadCloud, Maximize2, Minimize2 } from 'lucide-react';

export default function App() {
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>(DEFAULT_PROJECT_INFO);
  const [projectType, setProjectType] = useState<ProjectType>('semi');
  const [items, setItems] = useState<ModularItem[]>(INITIAL_ITEMS);
  const [selectedRoom, setSelectedRoom] = useState<string>('MBR');
  const [activeTab, setActiveTab] = useState<'cad_layout' | 'spreadsheet' | 'cut_list' | 'pricing_bom'>('cad_layout');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [rates, setRates] = useState<FactoryRates>(DEFAULT_FACTORY_RATES);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCadFullWidth, setIsCadFullWidth] = useState<boolean>(true);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Generate Cut List
  const cutList = useMemo(() => {
    return generateAllCutLists(items, projectType);
  }, [items, projectType]);

  // Calculate Materials
  const materials = useMemo(() => {
    return calculateMaterialUsage(cutList);
  }, [cutList]);

  // Calculate Costs
  const costs = useMemo(() => {
    return calculateProjectCost(materials, items, rates);
  }, [materials, items, rates]);

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

  // Upload Excel items
  const handleUploadItems = (newItems: ModularItem[]) => {
    setItems(newItems);
    // Auto select first room from uploaded items
    if (newItems.length > 0 && newItems[0].room) {
      setSelectedRoom(newItems[0].room);
    }
    showToast(`Successfully uploaded ${newItems.length} modular items from Excel sheet!`);
  };

  // Reset to original uploaded template
  const handleResetSampleData = () => {
    setItems(INITIAL_ITEMS);
    setProjectType('semi');
    setSelectedRoom('MBR');
    showToast('Reset to factory master dataset');
  };

  // Export PDF
  const handleExportPdf = () => {
    generateBOMProposalPDF(projectInfo, items, materials, costs, rates);
    showToast('BOM Proposal PDF generated and downloaded!');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased text-slate-800">
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
        onResetSampleData={handleResetSampleData}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <main
        className={`flex-1 w-full mx-auto py-5 space-y-5 transition-all duration-200 ${
          isCadFullWidth && activeTab === 'cad_layout'
            ? 'max-w-[99%] px-2 sm:px-3 lg:px-4'
            : 'max-w-7xl px-4 sm:px-6'
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
          </nav>

          {/* Right Controls: Full Width Toggle & Room Selector Dropdown */}
          <div className="flex items-center gap-2.5">
            {activeTab === 'cad_layout' && (
              <button
                onClick={() => setIsCadFullWidth(!isCadFullWidth)}
                className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition ${
                  isCadFullWidth
                    ? 'bg-cyan-600 text-white border-cyan-700 shadow-2xs'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
                title={isCadFullWidth ? 'Switch to Standard Boxed Width' : 'Expand to 100% Full Width'}
              >
                {isCadFullWidth ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isCadFullWidth ? 'Full Width (100%)' : 'Full Width'}</span>
              </button>
            )}

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
              isFullWidth={isCadFullWidth}
              onToggleFullWidth={() => setIsCadFullWidth(!isCadFullWidth)}
            />
          </div>
        )}

        {/* Tab 2: Excel Format Editor Table */}
        {activeTab === 'spreadsheet' && (
          <div className="space-y-4">
            <SpreadsheetEditor
              items={items}
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
              projectType={projectType}
              selectedRoom={selectedRoom}
            />
          </div>
        )}

        {/* Tab 4: Pricing Report & BOM */}
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
      </main>

      {/* Cabinet Inspector Drawer */}
      {inspectedItem && (
        <ItemInspectorDrawer
          item={inspectedItem}
          projectType={projectType}
          rates={rates}
          currency={projectInfo.currency}
          onClose={() => setSelectedItemId(null)}
          onUpdateItem={(updated) => {
            setItems(items.map((i) => (i.id === updated.id ? updated : i)));
          }}
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
  );
}
