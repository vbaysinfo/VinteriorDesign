import React, { useState, useMemo, useRef } from 'react';
import { ModularItem, WallType, ProjectType } from '../types';
import { Layers, ZoomIn, ZoomOut, Maximize2, Minimize2, Download, Eye, Grid, Box, Sliders, Type, RotateCcw, Move } from 'lucide-react';
import { Isometric3DViewer } from './Isometric3DViewer';
import { getEffectiveDepthMm, getShutterLayout, redistributeShutterWidths, mmToFt, recalculateItemMetrics } from '../utils/calculator';
import { NumberField } from './NumberField';

interface Cad2DViewerProps {
  items: ModularItem[];
  selectedRoom: string;
  projectType: ProjectType;
  onSelectItem?: (item: ModularItem) => void;
  selectedItemId?: string;
  isFullWidth?: boolean;
  onToggleFullWidth?: () => void;
  onUpdateItem?: (updated: ModularItem) => void;
}

type CadTheme = 'dark_cad' | 'blueprint' | 'light_draft';

export const Cad2DViewer: React.FC<Cad2DViewerProps> = ({
  items,
  selectedRoom,
  projectType,
  onSelectItem,
  selectedItemId,
  isFullWidth = false,
  onToggleFullWidth,
  onUpdateItem,
}) => {
  const [activeWall, setActiveWall] = useState<WallType | 'all'>('front');
  const [viewMode, setViewMode] = useState<'elevation' | 'floor_plan' | 'isometric_3d'>('elevation');
  const [cadTheme, setCadTheme] = useState<CadTheme>('dark_cad');
  const [fontSizeLevel, setFontSizeLevel] = useState<'normal' | 'large' | 'xl'>('large'); // default 'large' (1.7x) - bigger than before, but 'xl' (2.2x) can clip labels off the left edge on narrower rooms
  const [showDimensions, setShowDimensions] = useState(true);
  const [showDatums, setShowDatums] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [selectedShutter, setSelectedShutter] = useState<{ itemId: string; index: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number }>({
    startX: 0,
    startY: 0,
    initialPanX: 0,
    initialPanY: 0,
  });
  const hasMovedRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const fontScale = fontSizeLevel === 'normal' ? 1.25 : fontSizeLevel === 'large' ? 1.7 : 2.2;

  // Zoom and Pan Handlers
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(Number((prev + 0.2).toFixed(2)), 3.0));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(Number((prev - 0.2).toFixed(2)), 0.5));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  const handleSetPresetZoom = (lvl: number) => {
    setZoomLevel(lvl);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      hasMovedRef.current = false;
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialPanX: pan.x,
        initialPanY: pan.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.startX;
    const dy = e.clientY - panStartRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      hasMovedRef.current = true;
    }
    setPan({
      x: panStartRef.current.initialPanX + dx,
      y: panStartRef.current.initialPanY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
    setZoomLevel((prev) => Math.min(Math.max(Number((prev * zoomFactor).toFixed(2)), 0.4), 3.0));
  };

  // Filter items by room
  const roomItems = useMemo(() => {
    if (selectedRoom === 'ALL') return items;
    return items.filter((item) => item.room === selectedRoom);
  }, [items, selectedRoom]);

  // With "All Rooms" active, one wall elevation can mix cabinets from every
  // room together - the room name has to ride along on each cabinet's own
  // label, or there's no way to tell which room a given box belongs to.
  // Redundant (and dropped) once a single room is already selected.
  const showRoomInLabels = selectedRoom === 'ALL';

  // Filter items by wall
  const wallItems = useMemo(() => {
    if (activeWall === 'all') return roomItems;
    return roomItems.filter((item) => item.wall === activeWall);
  }, [roomItems, activeWall]);

  // Theme palettes
  const themeStyles = {
    dark_cad: {
      bg: '#090d16',
      grid: '#1e293b',
      wallLine: '#38bdf8', // Cyan
      cabinetStroke: '#22c55e', // Green
      cabinetFill: 'rgba(34, 197, 94, 0.08)',
      selectedStroke: '#f59e0b', // Amber
      selectedFill: 'rgba(245, 158, 11, 0.25)',
      dimLine: '#e2e8f0',
      text: '#f8fafc',
      datumLine: '#ef4444',
      datumText: '#f87171',
      hatchStroke: '#334155',
    },
    blueprint: {
      bg: '#0b2545',
      grid: '#134074',
      wallLine: '#ffffff',
      cabinetStroke: '#8da9c4',
      cabinetFill: 'rgba(141, 169, 196, 0.15)',
      selectedStroke: '#eef4f8',
      selectedFill: 'rgba(238, 244, 248, 0.35)',
      dimLine: '#eef4f8',
      text: '#ffffff',
      datumLine: '#64dfdf',
      datumText: '#64dfdf',
      hatchStroke: '#1b4965',
    },
    light_draft: {
      bg: '#f8fafc',
      grid: '#e2e8f0',
      wallLine: '#0f172a',
      cabinetStroke: '#2563eb',
      cabinetFill: 'rgba(37, 99, 235, 0.06)',
      selectedStroke: '#d97706',
      selectedFill: 'rgba(217, 119, 6, 0.15)',
      dimLine: '#475569',
      text: '#0f172a',
      datumLine: '#dc2626',
      datumText: '#dc2626',
      hatchStroke: '#cbd5e1',
    },
  }[cadTheme];

  // Helper to place cabinets along the elevation in strict non-overlapping architectural order:
  // - Floor units sit on skirting at y = 100mm.
  // - Ceiling slab is calculated to cleanly accommodate floor units + lintel + loft height.
  // - Loft units mount flush to the top ceiling slab at y = wallHeight - loft.h (guaranteed loft.y >= floorUnit.top).
  // - Overhead units sit at y = 1450mm (below lintel).
  const { positionedElevationItems, wallWidth, wallHeight, datums, maxFloorTop } = useMemo(() => {
    const floorItems = wallItems.filter(
      (item) => item.category !== 'loft' && item.category !== 'kitchen_loft' && item.category !== 'kitchen_overhead'
    );
    const overheadItems = wallItems.filter((item) => item.category === 'kitchen_overhead');
    const loftItems = wallItems.filter((item) => item.category === 'loft' || item.category === 'kitchen_loft');

    // 1. Position floor units
    let floorX = 140;
    const positionedFloor = floorItems.map((item) => {
      const w = item.widthMm;
      const h = item.heightMm;
      const pos = {
        item,
        x: floorX,
        y: 100, // sits on 100mm skirting
        w,
        h,
        zone: 'floor' as const,
      };
      floorX += w + 40; // 40mm clear gap between adjacent floor units
      return pos;
    });

    const computedMaxFloorTop = positionedFloor.length > 0
      ? Math.max(...positionedFloor.map((p) => p.y + p.h))
      : 2234;

    const maxLoftH = loftItems.length > 0
      ? Math.max(...loftItems.map((l) => l.heightMm))
      : 650;

    // Room ceiling height: guarantees loft sits completely ABOVE wardrobe with zero overlap
    const computedCeilingHeight = Math.max(2850, Math.ceil((computedMaxFloorTop + maxLoftH + 60) / 50) * 50);

    // 2. Position loft units flush with top ceiling slab
    let loftX = 140;
    const positionedLofts = loftItems.map((item) => {
      const w = item.widthMm;
      const h = item.heightMm;
      const y = computedCeilingHeight - h; // sits flush at top slab ceiling
      const pos = {
        item,
        x: loftX,
        y,
        w,
        h,
        zone: 'loft' as const,
      };
      loftX += w + 20;
      return pos;
    });

    // 3. Position overhead units
    let overheadX = 140;
    const positionedOverheads = overheadItems.map((item) => {
      const w = item.widthMm;
      const h = item.heightMm;
      const y = 1450;
      const pos = {
        item,
        x: overheadX,
        y,
        w,
        h,
        zone: 'overhead' as const,
      };
      overheadX += w + 20;
      return pos;
    });

    const maxContentWidth = Math.max(floorX, overheadX, loftX);
    const computedWallWidth = Math.max(3800, maxContentWidth + 200);

    const computedDatums = [
      { name: '±0.00 FFL', y: 0 },
      { name: '+100 SKIRTING', y: 100 },
      { name: '+850 COUNTER/BASE', y: 850 },
      { name: '+1450 OVERHEAD SILL', y: 1450 },
      { name: `+${Math.round(computedMaxFloorTop)} LINTEL`, y: Math.round(computedMaxFloorTop) },
      { name: `+${computedCeilingHeight} SLAB CEILING`, y: computedCeilingHeight },
    ];

    return {
      positionedElevationItems: [...positionedFloor, ...positionedOverheads, ...positionedLofts],
      wallWidth: computedWallWidth,
      wallHeight: computedCeilingHeight,
      datums: computedDatums,
      maxFloorTop: computedMaxFloorTop,
    };
  }, [wallItems]);

  // Padding around elevation drawing to guarantee datums and dimension strings never clip
  const paddingLeft = 520;
  const paddingRight = 400;
  const paddingTop = 150;
  const paddingBottom = 170;
  const viewBoxW = wallWidth + paddingLeft + paddingRight;
  const viewBoxH = wallHeight + paddingTop + paddingBottom;

  // Floor plan geometry calculation
  const floorPlanRoomWidth = 4200; // mm
  const floorPlanRoomDepth = 3600; // mm

  // Download SVG
  const handleExportSvg = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedRoom}_${activeWall}_CAD_Layout.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fresh project with nothing uploaded yet: show a guided empty state
  // instead of a blank/confusing drawing canvas with no walls or units.
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="flex flex-col items-center justify-center text-center py-24 px-6">
          <div className="p-4 bg-cyan-50 text-cyan-600 rounded-full mb-4">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="font-semibold text-slate-800 text-base mb-1.5">No Project Data Yet</h3>
          <p className="text-sm text-slate-500 max-w-sm">
            Upload an Excel quotation sheet using "Upload Excel" in the header to generate the 2D
            AutoCAD layout, cutting list, and pricing for your project.
          </p>
        </div>
      </div>
    );
  }

  // If 3D Isometric view is active, render full 3D interactive visualizer
  if (viewMode === 'isometric_3d') {
    return (
      <Isometric3DViewer
        items={items}
        selectedRoom={selectedRoom}
        projectType={projectType}
        selectedItemId={selectedItemId}
        onSelectItem={onSelectItem}
        activeWall={activeWall}
        onSelectWall={setActiveWall}
        onSwitchViewMode={setViewMode}
        isFullWidth={isFullWidth}
        onToggleFullWidth={onToggleFullWidth}
      />
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Top Toolbar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-cyan-600 text-white rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-sm md:text-base flex items-center gap-2">
              AutoCAD 2D Architectural Layout
              <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
                {selectedRoom} Room
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              {viewMode === 'elevation'
                ? `Wall Elevation Drawing: ${activeWall.toUpperCase()} WALL • Precision mm Datum Scales`
                : '2D Floor Plan (Top-Down Carcass Clearances & Spacing)'}
            </p>
          </div>
        </div>

        {/* View Mode & Controls */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Elevation vs Plan vs 3D switcher */}
          <div className="inline-flex bg-slate-200 p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => setViewMode('elevation')}
              className={`px-3 py-1.5 rounded-md transition font-semibold ${
                viewMode === 'elevation' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Wall Elevation (2D)
            </button>
            <button
              onClick={() => setViewMode('floor_plan')}
              className={`px-3 py-1.5 rounded-md transition font-semibold ${
                viewMode === 'floor_plan' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2D Floor Plan
            </button>
            <button
              onClick={() => setViewMode('isometric_3d')}
              className="px-3 py-1.5 rounded-md transition flex items-center gap-1.5 font-bold text-cyan-700 hover:text-cyan-900 hover:bg-slate-100"
            >
              <Box className="w-3.5 h-3.5 text-cyan-600" />
              <span>3D Isometric</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-cyan-600 text-white font-extrabold uppercase">
                3D
              </span>
            </button>
          </div>

          {/* Wall Tabs (For Elevation) */}
          {viewMode === 'elevation' && (
            <div className="inline-flex bg-slate-200 p-1 rounded-lg text-xs font-medium">
              {(['front', 'left', 'right', 'back', 'all'] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setActiveWall(w)}
                  className={`px-2.5 py-1.5 rounded-md capitalize transition ${
                    activeWall === w ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {w} {w !== 'all' ? 'Wall' : 'Units'}
                </button>
              ))}
            </div>
          )}

          {/* Theme switcher */}
          <select
            value={cadTheme}
            onChange={(e) => setCadTheme(e.target.value as CadTheme)}
            className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden"
          >
            <option value="dark_cad">AutoCAD Dark</option>
            <option value="blueprint">Blueprint Blue</option>
            <option value="light_draft">Drafting White</option>
          </select>

          {/* Text / Font Size Selector */}
          <div className="inline-flex bg-white border border-slate-200 rounded-lg p-0.5 items-center shadow-2xs">
            <span className="px-1.5 text-slate-500 flex items-center gap-0.5 text-xs font-semibold" title="Text / Font Size">
              <Type className="w-3.5 h-3.5 text-cyan-600" />
              <span className="text-[10px] hidden md:inline">Font</span>
            </span>
            {(['normal', 'large', 'xl'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFontSizeLevel(lvl)}
                className={`px-2 py-1 rounded text-xs font-bold transition ${
                  fontSizeLevel === lvl
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title={`Text Scale: ${lvl === 'normal' ? 'Standard 1.25x' : lvl === 'large' ? 'Large 1.7x' : 'Extra Large 2.2x'}`}
              >
                {lvl === 'normal' ? '1.25x' : lvl === 'large' ? '1.7x' : '2.2x'}
              </button>
            ))}
          </div>

          {/* Toggles */}
          <button
            onClick={() => setShowDimensions(!showDimensions)}
            title="Toggle Dimensions"
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 ${
              showDimensions ? 'bg-cyan-50 border-cyan-300 text-cyan-700' : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dim</span>
          </button>

          <button
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle Grid"
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 ${
              showGrid ? 'bg-cyan-50 border-cyan-300 text-cyan-700' : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* Zoom controls */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
            <button
              onClick={handleZoomOut}
              className="p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
              title="Zoom Out (Wheel Down)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2 py-0.5 text-xs font-mono font-bold text-slate-700 hover:text-cyan-600 transition"
              title="Click to Reset View / 100%"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
              title="Zoom In (Wheel Up)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1.5 text-slate-600 hover:bg-slate-100 border-l border-slate-200"
              title="Reset Zoom & Center Canvas"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Full Width Screen Toggle */}
          {onToggleFullWidth && (
            <button
              onClick={onToggleFullWidth}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition ${
                isFullWidth
                  ? 'bg-cyan-600 text-white border-cyan-700 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title={isFullWidth ? 'Switch to Standard Container Width' : 'Expand to 100% Full Width'}
            >
              {isFullWidth ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isFullWidth ? 'Boxed' : 'Full Width'}</span>
            </button>
          )}

          {/* Export CAD */}
          <button
            onClick={handleExportSvg}
            className="p-1.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 text-xs flex items-center gap-1.5 px-3"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export SVG</span>
          </button>
        </div>
      </div>

      {/* CAD Canvas Area with Smooth Pan, Wheel Zoom, and No Clipping */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full relative select-none overflow-hidden p-3 sm:p-5 md:p-6 flex items-center justify-center"
        style={{
          backgroundColor: themeStyles.bg,
          minHeight: '620px',
          height: isFullWidth ? '85vh' : '72vh',
          cursor: isPanning ? 'grabbing' : zoomLevel > 1 ? 'grab' : 'default',
        }}
      >
        {/* Floating Interactive CAD Zoom & Pan HUD */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2 pointer-events-auto select-none">
          {/* Quick Zoom Pill */}
          <div className="flex items-center bg-slate-900/90 backdrop-blur-md text-white px-2 py-1 rounded-xl shadow-lg border border-slate-700/80 text-xs">
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2.5 py-1 font-mono font-bold text-cyan-400 hover:text-cyan-300 transition text-xs"
              title="Click to Reset 100% Zoom & Pan"
            >
              {Math.round(zoomLevel * 100)}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-4 bg-slate-700 mx-1" />
            <button
              onClick={handleResetZoom}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition"
              title="Fit to Screen (Reset View)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Preset levels and Drag Hint */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm text-[11px] text-slate-300 px-3 py-1 rounded-full border border-slate-800 shadow-md">
            <span className="text-slate-400 flex items-center gap-1">
              <Move className="w-3 h-3 text-cyan-400" />
              Drag to pan • Wheel to zoom
            </span>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => handleSetPresetZoom(1)}
              className={`px-1.5 py-0.5 rounded font-mono ${zoomLevel === 1 ? 'bg-cyan-600 text-white font-bold' : 'hover:text-white'}`}
            >
              Fit
            </button>
            <button
              onClick={() => handleSetPresetZoom(1.5)}
              className={`px-1.5 py-0.5 rounded font-mono ${zoomLevel === 1.5 ? 'bg-cyan-600 text-white font-bold' : 'hover:text-white'}`}
            >
              1.5x
            </button>
            <button
              onClick={() => handleSetPresetZoom(2.0)}
              className={`px-1.5 py-0.5 rounded font-mono ${zoomLevel === 2.0 ? 'bg-cyan-600 text-white font-bold' : 'hover:text-white'}`}
            >
              2.0x
            </button>
          </div>
        </div>

        {/* Scaled and Panned Workspace View */}
        <div
          className="w-full h-full flex items-center justify-center transition-transform duration-75 origin-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center',
          }}
        >
          {viewMode === 'elevation' ? (
            /* ================= ELEVATION VIEW ================= */
            <svg
              ref={svgRef}
              viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-auto drop-shadow-2xl transition-all"
              style={{
                width: '100%',
                maxHeight: isFullWidth ? '84vh' : '72vh',
                minHeight: '520px',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              <defs>
                {/* Diagonal hatch pattern for profile doors / glass */}
                <pattern id="cadHatch" width="20" height="20" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="20" stroke={themeStyles.hatchStroke} strokeWidth="1" />
                </pattern>
                {/* Wood core grain hatch */}
                <pattern id="woodGrain" width="40" height="10" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="5" x2="40" y2="5" stroke={themeStyles.hatchStroke} strokeWidth="0.75" strokeDasharray="3,3" />
                </pattern>
                {/* CAD Dimension Arrow Marker */}
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="5"
                  refY="5"
                  markerWidth={12 * fontScale}
                  markerHeight={12 * fontScale}
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill={themeStyles.dimLine} />
                </marker>
              </defs>

              {/* Architectural Grid */}
              {showGrid && (
                <g opacity="0.35">
                  {Array.from({ length: Math.ceil(viewBoxW / 200) }).map((_, i) => (
                    <line
                      key={`grid-x-${i}`}
                      x1={i * 200}
                      y1="0"
                      x2={i * 200}
                      y2={viewBoxH}
                      stroke={themeStyles.grid}
                      strokeWidth="1"
                      strokeDasharray="2,4"
                    />
                  ))}
                  {Array.from({ length: Math.ceil(viewBoxH / 200) }).map((_, i) => (
                    <line
                      key={`grid-y-${i}`}
                      x1="0"
                      y1={i * 200}
                      x2={viewBoxW}
                      y2={i * 200}
                      stroke={themeStyles.grid}
                      strokeWidth="1"
                      strokeDasharray="2,4"
                    />
                  ))}
                </g>
              )}

              {/* Main Structural Wall Boundaries */}
              <g transform={`translate(${paddingLeft}, ${paddingTop})`}>
                {/* Slab Ceiling line */}
                <line x1="0" y1="0" x2={wallWidth} y2="0" stroke={themeStyles.wallLine} strokeWidth="3" />
                {/* Floor line (y = wallHeight) */}
                <line x1="0" y1={wallHeight} x2={wallWidth} y2={wallHeight} stroke={themeStyles.wallLine} strokeWidth="4" />
                {/* Left Wall Boundary */}
                <line x1="0" y1="0" x2="0" y2={wallHeight} stroke={themeStyles.wallLine} strokeWidth="3" />
                {/* Right Wall Boundary */}
                <line x1={wallWidth} y1="0" x2={wallWidth} y2={wallHeight} stroke={themeStyles.wallLine} strokeWidth="3" />

                {/* 100mm Skirting line */}
                <line
                  x1="0"
                  y1={wallHeight - 100}
                  x2={wallWidth}
                  y2={wallHeight - 100}
                  stroke={themeStyles.grid}
                  strokeWidth="1.5"
                  strokeDasharray="4,4"
                />

                {/* Datum Level Lines across the wall */}
                {showDatums &&
                  datums.map((datum) => {
                    const lineY = wallHeight - datum.y;
                    const flagW = 28 * fontScale;
                    const flagH = 10 * fontScale;
                    return (
                      <g key={datum.name}>
                        <line
                          x1="-50"
                          y1={lineY}
                          x2={wallWidth + 30}
                          y2={lineY}
                          stroke={themeStyles.datumLine}
                          strokeWidth={1.5 * fontScale}
                          strokeDasharray="6,4"
                          opacity="0.65"
                        />
                        {/* Datum Indicator Flag */}
                        <polygon
                          points={`-50,${lineY} -${50 + flagW},${lineY - flagH} -${50 + flagW},${lineY + flagH}`}
                          fill={themeStyles.datumLine}
                        />
                        <text
                          x={-(50 + flagW + 10)}
                          y={lineY + 12 * fontScale}
                          fill={themeStyles.datumText}
                          fontSize={Math.round(40 * fontScale)}
                          fontWeight="bold"
                          textAnchor="end"
                          style={{ letterSpacing: '0.5px' }}
                        >
                          {datum.name}
                        </text>
                      </g>
                    );
                  })}

                {/* Architectural Vertical Dimension Ladder on the Right Wall Boundary (Non-overlapping) */}
                {showDimensions && (
                  <g opacity="0.95">
                    {/* Skirting vertical dim (0 to 100mm) */}
                    <line
                      x1={wallWidth + 70 * fontScale}
                      y1={wallHeight}
                      x2={wallWidth + 70 * fontScale}
                      y2={wallHeight - 100}
                      stroke={themeStyles.dimLine}
                      strokeWidth={2 * fontScale}
                      markerStart="url(#arrow)"
                      markerEnd="url(#arrow)"
                    />
                    <line
                      x1={wallWidth + 30}
                      y1={wallHeight - 100}
                      x2={wallWidth + 95 * fontScale}
                      y2={wallHeight - 100}
                      stroke={themeStyles.dimLine}
                      strokeWidth={1.5 * fontScale}
                    />
                    <text
                      x={wallWidth + 90 * fontScale}
                      y={wallHeight - 45}
                      fill={themeStyles.dimLine}
                      fontSize={Math.round(36 * fontScale)}
                      fontWeight="bold"
                    >
                      100 SKIRTING
                    </text>

                    {/* Floor unit vertical clear height (100 to maxFloorTop) */}
                    <line
                      x1={wallWidth + 70 * fontScale}
                      y1={wallHeight - 100}
                      x2={wallWidth + 70 * fontScale}
                      y2={wallHeight - maxFloorTop}
                      stroke={themeStyles.dimLine}
                      strokeWidth={2 * fontScale}
                      markerStart="url(#arrow)"
                      markerEnd="url(#arrow)"
                    />
                    <line
                      x1={wallWidth + 30}
                      y1={wallHeight - maxFloorTop}
                      x2={wallWidth + 95 * fontScale}
                      y2={wallHeight - maxFloorTop}
                      stroke={themeStyles.dimLine}
                      strokeWidth={1.5 * fontScale}
                    />
                    <text
                      x={wallWidth + 90 * fontScale}
                      y={wallHeight - 100 - (maxFloorTop - 100) / 2 + 12 * fontScale}
                      fill={themeStyles.dimLine}
                      fontSize={Math.round(38 * fontScale)}
                      fontWeight="bold"
                    >
                      H: {Math.round(maxFloorTop - 100)}mm CARCASS
                    </text>

                    {/* Lintel to Ceiling clear height (maxFloorTop to wallHeight) */}
                    {wallHeight > maxFloorTop && (
                      <>
                        <line
                          x1={wallWidth + 70 * fontScale}
                          y1={wallHeight - maxFloorTop}
                          x2={wallWidth + 70 * fontScale}
                          y2={0}
                          stroke={themeStyles.dimLine}
                          strokeWidth={2 * fontScale}
                          markerStart="url(#arrow)"
                          markerEnd="url(#arrow)"
                        />
                        <text
                          x={wallWidth + 90 * fontScale}
                          y={(wallHeight - maxFloorTop) / 2 + 12 * fontScale}
                          fill={themeStyles.dimLine}
                          fontSize={Math.round(38 * fontScale)}
                          fontWeight="bold"
                        >
                          H: {Math.round(wallHeight - maxFloorTop)}mm LOFT / LINTEL
                        </text>
                      </>
                    )}

                    {/* Overall Wall Clear Height Line */}
                    <line
                      x1={wallWidth + 240 * fontScale}
                      y1={0}
                      x2={wallWidth + 240 * fontScale}
                      y2={wallHeight}
                      stroke={themeStyles.wallLine}
                      strokeWidth={2.5 * fontScale}
                      markerStart="url(#arrow)"
                      markerEnd="url(#arrow)"
                    />
                    <line
                      x1={wallWidth + 10}
                      y1={0}
                      x2={wallWidth + 265 * fontScale}
                      y2={0}
                      stroke={themeStyles.wallLine}
                      strokeWidth={1.5 * fontScale}
                    />
                    <line
                      x1={wallWidth + 10}
                      y1={wallHeight}
                      x2={wallWidth + 265 * fontScale}
                      y2={wallHeight}
                      stroke={themeStyles.wallLine}
                      strokeWidth={1.5 * fontScale}
                    />
                    <text
                      x={wallWidth + 260 * fontScale}
                      y={wallHeight / 2 + 12 * fontScale}
                      fill={themeStyles.wallLine}
                      fontSize={Math.round(40 * fontScale)}
                      fontWeight="bold"
                    >
                      {wallHeight}mm SLAB CLEAR
                    </text>
                  </g>
                )}

                {/* Render Each Positioned Cabinet with Strict Non-Overlapping Dimensions and Labels */}
                {positionedElevationItems.map((pos) => {
                  const isSelected = selectedItemId === pos.item.id;
                  const itemY = wallHeight - pos.y - pos.h; // convert from bottom datum to top-left SVG coords
                  // Match the real cut list exactly (calculator.ts): a 3mm
                  // reveal between adjacent shutters, floored so sCount
                  // identical shutter widths can never combine to exceed
                  // pos.w - i.e. what's drawn here is what actually gets cut,
                  // and the doors are shown with real clearance, not touching.
                  const { count: sCount, widths: shutterWidths, gapMm: shutterGapMm } = getShutterLayout(pos.item);
                  // Cumulative left edge (in mm, relative to pos.x) of each
                  // shutter - a plain array walk instead of a fixed pitch so
                  // shutters can have independent, unequal widths once a
                  // per-shutter override is set from the editor below.
                  const shutterOffsets: number[] = [];
                  {
                    let acc = 0;
                    for (let i = 0; i < sCount; i++) {
                      shutterOffsets.push(acc);
                      acc += shutterWidths[i] + shutterGapMm;
                    }
                  }
                  // Same box-clearance rule as the real cut list (calculator.ts):
                  // a box unit's shutter is 20mm shorter than the carcass to clear
                  // the top/bottom decks; a civil-built frame's shutter is full height.
                  const shutterPType = pos.item.projectType || projectType;
                  const shutterIsBoxUnit = getEffectiveDepthMm(pos.item, shutterPType) > 0;
                  const isShutterSelected = (sIdx: number) =>
                    selectedShutter?.itemId === pos.item.id && selectedShutter.index === sIdx;
                  const selectedShutterIndex =
                    selectedShutter?.itemId === pos.item.id && selectedShutter.index < sCount ? selectedShutter.index : -1;
                  const selectedShutterX = selectedShutterIndex >= 0 ? pos.x + shutterOffsets[selectedShutterIndex] : 0;
                  const selectedShutterW = selectedShutterIndex >= 0 ? shutterWidths[selectedShutterIndex] : 0;

                  const handleShutterWidthChange = (sIdx: number, newWidthMm: number) => {
                    if (!onUpdateItem || sCount < 2) return;
                    onUpdateItem({ ...pos.item, shutterWidthOverrides: redistributeShutterWidths(pos.item, sIdx, newWidthMm) });
                  };
                  const handleShutterWidthReset = () => {
                    if (!onUpdateItem) return;
                    const { shutterWidthOverrides, ...rest } = pos.item;
                    onUpdateItem(rest);
                  };
                  // Length and Depth aren't per-shutter properties - all doors
                  // in one row share the carcass's own length/depth - so these
                  // just edit the item itself, same as the Structural
                  // Dimensions fields in the Item Inspector Drawer.
                  const handleShutterHeightChange = (newHeightMm: number) => {
                    if (!onUpdateItem) return;
                    onUpdateItem(recalculateItemMetrics({ ...pos.item, heightMm: newHeightMm, heightFt: mmToFt(newHeightMm) }));
                  };
                  const handleShutterDepthChange = (newDepthMm: number) => {
                    if (!onUpdateItem) return;
                    onUpdateItem(
                      recalculateItemMetrics({
                        ...pos.item,
                        depthMm: newDepthMm,
                        depthFt: newDepthMm > 0 ? mmToFt(newDepthMm) : 0,
                      })
                    );
                  };

                  // Dynamic compact badge inside cabinet. Sized to the actual
                  // label text (the name from the uploaded Excel row, never
                  // truncated) instead of a fixed 160px floor - a fixed floor
                  // either clipped long names or, on a narrow cabinet, forced
                  // the label to disappear entirely once the badge no longer
                  // fit, leaving an unlabeled box the user can't identify.
                  const badgeTitleLine = `#${pos.item.sNo} ${pos.item.description}`;
                  const badgeSubLine = `${showRoomInLabels ? `${pos.item.room} • ` : ''}${pos.w} × ${pos.h}${
                    pos.item.depthMm > 0 ? ` × ${pos.item.depthMm}mm` : ''
                  }`;
                  // Font size is decided FIRST, from fontScale alone, so the
                  // default text is always full-size on any normal-width
                  // cabinet - not derived back out of however wide the badge
                  // happened to end up (that circular approach was quietly
                  // shrinking every badge, since a badge sized just big
                  // enough for its own text at a modest guess then re-capped
                  // the font to that same modest width). The badge is then
                  // sized to fit text at this full size, and only a cabinet
                  // too narrow to hold that at all scales the font back down.
                  const TITLE_CHAR_W = 0.56; // bold sans-serif average advance, as a fraction of font size
                  const SUB_CHAR_W = 0.5;
                  const nominalTitleFont = 26 * fontScale;
                  const nominalSubFont = 20 * fontScale;
                  const estBadgeW =
                    Math.max(badgeTitleLine.length * TITLE_CHAR_W * nominalTitleFont, badgeSubLine.length * SUB_CHAR_W * nominalSubFont) + 20;
                  const badgeW = Math.min(pos.w - 12, Math.max(90, estBadgeW));
                  const fontShrink = Math.min(1, (badgeW - 16) / (estBadgeW - 20));
                  const badgeTitleFontSize = Math.round(nominalTitleFont * fontShrink);
                  const badgeSubFontSize = Math.round(nominalSubFont * fontShrink);
                  const badgeH = Math.min(pos.h - 10, Math.round(66 * fontScale));
                  const badgeX = pos.x + (pos.w - badgeW) / 2;
                  const badgeY = itemY + (pos.h > 350 ? 20 : (pos.h - badgeH) / 2);

                  return (
                    <g
                      key={pos.item.id}
                      onClick={() => {
                        if (!hasMovedRef.current && onSelectItem) {
                          onSelectItem(pos.item);
                        }
                      }}
                      className="cursor-pointer transition-all duration-150 group"
                    >
                      {/* Cabinet Outer Box */}
                      <rect
                        x={pos.x}
                        y={itemY}
                        width={pos.w}
                        height={pos.h}
                        fill={
                          isSelected
                            ? themeStyles.selectedFill
                            : pos.item.category === 'profile_door'
                            ? 'url(#cadHatch)'
                            : themeStyles.cabinetFill
                        }
                        stroke={isSelected ? themeStyles.selectedStroke : themeStyles.cabinetStroke}
                        strokeWidth={isSelected ? '4' : '2'}
                      />

                      {/* Internal Shelves / Drawers visual representations */}
                      {pos.item.drawerCount > 0 ? (
                        // Drawers Tier lines
                        Array.from({ length: pos.item.drawerCount }).map((_, dIdx) => {
                          const drawerH = pos.h / pos.item.drawerCount;
                          const dY = itemY + dIdx * drawerH;
                          return (
                            <g key={`d-${dIdx}`}>
                              <line
                                x1={pos.x}
                                y1={dY}
                                x2={pos.x + pos.w}
                                y2={dY}
                                stroke={themeStyles.cabinetStroke}
                                strokeWidth="1.5"
                              />
                              {/* Drawer pull handle */}
                              <rect
                                x={pos.x + pos.w / 2 - 30}
                                y={dY + drawerH / 2 - 4}
                                width="60"
                                height="8"
                                rx="2"
                                fill={themeStyles.text}
                                opacity="0.85"
                              />
                            </g>
                          );
                        })
                      ) : pos.item.category === 'tv_panel' ? (
                        // Fluted louvre vertical panel slates
                        Array.from({ length: Math.floor(pos.w / 60) }).map((_, slateIdx) => (
                          <line
                            key={`slate-${slateIdx}`}
                            x1={pos.x + slateIdx * 60}
                            y1={itemY}
                            x2={pos.x + slateIdx * 60}
                            y2={itemY + pos.h}
                            stroke={themeStyles.cabinetStroke}
                            strokeWidth="1"
                            opacity="0.4"
                          />
                        ))
                      ) : (
                        // Shutters and Swing Dashed Arcs
                        Array.from({ length: sCount }).map((_, sIdx) => {
                          const sx = pos.x + shutterOffsets[sIdx];
                          const sw = shutterWidths[sIdx];
                          const isHingeLeft = sIdx % 2 === 0;
                          const shutterSelected = isShutterSelected(sIdx);
                          return (
                            <g key={`shutter-${sIdx}`}>
                              {/* Real reveal gap between adjacent shutters (matches cut list exactly).
                                  Non-interactive so a click that happens to land in this sliver falls
                                  through to the shutter/cabinet underneath instead of hitting a dead zone -
                                  this strip can otherwise line up exactly with the cabinet's own label,
                                  which is centered on the whole box and so on an even shutter count. */}
                              {sIdx > 0 && (
                                <rect
                                  x={sx - shutterGapMm}
                                  y={itemY}
                                  width={shutterGapMm}
                                  height={pos.h}
                                  fill={themeStyles.bg}
                                  pointerEvents="none"
                                />
                              )}

                              {/* Individual shutter hit-area + selection highlight - click to inspect THIS shutter's own cut size */}
                              <rect
                                x={sx}
                                y={itemY}
                                width={sw}
                                height={pos.h}
                                fill={shutterSelected ? themeStyles.selectedFill : 'transparent'}
                                stroke={shutterSelected ? themeStyles.selectedStroke : 'transparent'}
                                strokeWidth={shutterSelected ? 3 : 0}
                                className="cursor-pointer hover:opacity-80"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  hasMovedRef.current = false;
                                  setSelectedShutter((prev) =>
                                    prev && prev.itemId === pos.item.id && prev.index === sIdx
                                      ? null
                                      : { itemId: pos.item.id, index: sIdx }
                                  );
                                  if (onSelectItem) onSelectItem(pos.item);
                                }}
                              />

                              {/* Architectural Door Swing Dashed Lines */}
                              {pos.h > 400 && pos.w > 200 && (
                                <g opacity="0.35">
                                  {isHingeLeft ? (
                                    <polyline
                                      points={`${sx},${itemY} ${sx + sw},${itemY + pos.h / 2} ${sx},${itemY + pos.h}`}
                                      fill="none"
                                      stroke={themeStyles.text}
                                      strokeWidth="1"
                                      strokeDasharray="4,4"
                                    />
                                  ) : (
                                    <polyline
                                      points={`${sx + sw},${itemY} ${sx},${itemY + pos.h / 2} ${sx + sw},${itemY + pos.h}`}
                                      fill="none"
                                      stroke={themeStyles.text}
                                      strokeWidth="1"
                                      strokeDasharray="4,4"
                                    />
                                  )}
                                </g>
                              )}

                              {/* Shutter Vertical Handle */}
                              {pos.item.category !== 'expo' && (
                                <rect
                                  x={isHingeLeft ? sx + sw - 14 : sx + 10}
                                  y={itemY + pos.h / 2 - 35}
                                  width="5"
                                  height="70"
                                  rx="2"
                                  fill={themeStyles.text}
                                  opacity="0.9"
                                />
                              )}
                            </g>
                          );
                        })
                      )}

                      {/* Selected Shutter Measurement + Edit Callout. A real
                          HTML form embedded via <foreignObject> so it scales
                          and pans together with the SVG (the zoom/pan is a
                          CSS transform on the SVG's wrapper, so this content
                          inherits it exactly like any other shape here). */}
                      {selectedShutterIndex >= 0 && (() => {
                        const calloutW = Math.max(selectedShutterW, Math.round(230 * fontScale));
                        const calloutH = Math.round((shutterIsBoxUnit ? 150 : 118) * fontScale);
                        const calloutY = Math.max(0, itemY - calloutH - 6);
                        const hasOverride = !!pos.item.shutterWidthOverrides;
                        const fieldStyle: React.CSSProperties = { fontSize: `${11 * fontScale}px`, color: 'inherit' };
                        const fieldClass =
                          'w-16 text-center font-mono font-bold rounded border border-current/40 bg-white/10 disabled:opacity-60';
                        return (
                          <foreignObject x={selectedShutterX} y={calloutY} width={calloutW} height={calloutH} style={{ overflow: 'visible' }}>
                            <div
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              style={{
                                fontSize: `${11 * fontScale}px`,
                                backgroundColor: themeStyles.selectedFill,
                                borderColor: themeStyles.selectedStroke,
                                color: themeStyles.text,
                              }}
                              className="h-full rounded-md border-2 flex flex-col items-center justify-center gap-1 px-2 py-1.5"
                            >
                              <span className="font-bold whitespace-nowrap">
                                Shutter {selectedShutterIndex + 1} of {sCount}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-[0.8em] opacity-70">Width</span>
                                  <NumberField
                                    min={20}
                                    value={selectedShutterW}
                                    onCommit={(num) => handleShutterWidthChange(selectedShutterIndex, num)}
                                    disabled={!onUpdateItem || sCount < 2}
                                    title={sCount < 2 ? "Single-shutter items are edited via the item's own Width field" : undefined}
                                    className={fieldClass}
                                    style={fieldStyle}
                                  />
                                </div>
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-[0.8em] opacity-70">Length</span>
                                  <NumberField
                                    min={0}
                                    value={pos.item.heightMm}
                                    onCommit={handleShutterHeightChange}
                                    disabled={!onUpdateItem}
                                    title="Shared by every door in this row, same as the item's own Length field"
                                    className={fieldClass}
                                    style={fieldStyle}
                                  />
                                </div>
                              </div>
                              {shutterIsBoxUnit && (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-[0.8em] opacity-70">Depth</span>
                                  <NumberField
                                    min={0}
                                    zeroAsEmpty
                                    placeholder="0"
                                    value={pos.item.depthMm}
                                    onCommit={handleShutterDepthChange}
                                    disabled={!onUpdateItem}
                                    title="Shared by every door in this row, same as the item's own Depth field"
                                    className={fieldClass}
                                    style={fieldStyle}
                                  />
                                </div>
                              )}
                              {onUpdateItem && sCount > 1 && hasOverride && (
                                <button
                                  onClick={handleShutterWidthReset}
                                  className="text-[0.85em] underline opacity-80 hover:opacity-100"
                                >
                                  Reset widths to auto split
                                </button>
                              )}
                            </div>
                          </foreignObject>
                        );
                      })()}

                      {/* Cabinet Annotation Label (Bounded inside box). Non-
                          interactive: it sits on top of the individual
                          shutter click zones underneath, and without this it
                          would silently swallow clicks meant for whichever
                          shutter/door happens to be behind the label instead
                          of letting them reach it. */}
                      {pos.w >= 46 && pos.h >= 36 && (
                        <g pointerEvents="none">
                          <rect
                            x={badgeX}
                            y={badgeY}
                            width={badgeW}
                            height={badgeH}
                            rx="6"
                            fill={themeStyles.bg}
                            stroke={isSelected ? themeStyles.selectedStroke : themeStyles.cabinetStroke}
                            strokeWidth={isSelected ? '2' : '1.5'}
                            opacity="0.95"
                          />
                          <text
                            x={badgeX + badgeW / 2}
                            y={badgeY + Math.round(28 * fontScale)}
                            fill={themeStyles.text}
                            fontSize={badgeTitleFontSize}
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {badgeTitleLine}
                          </text>
                          <text
                            x={badgeX + badgeW / 2}
                            y={badgeY + Math.round(54 * fontScale)}
                            fill={themeStyles.dimLine}
                            fontSize={badgeSubFontSize}
                            fontWeight="600"
                            textAnchor="middle"
                          >
                            {badgeSubLine}
                          </text>

                          {/* Edit affordance: reveals on hover, but the whole cabinet
                              is already clickable (see the <g onClick> above) - this is
                              just a visible hint that clicking opens the editable
                              width/height/depth panel, not a separate handler. */}
                          <g className="opacity-0 group-hover:opacity-100 transition-opacity" pointerEvents="none">
                            <circle
                              cx={badgeX + badgeW - 14 * fontScale}
                              cy={badgeY - 2 * fontScale}
                              r={13 * fontScale}
                              fill={themeStyles.selectedStroke}
                              stroke={themeStyles.bg}
                              strokeWidth="1.5"
                            />
                            <text
                              x={badgeX + badgeW - 14 * fontScale}
                              y={badgeY - 2 * fontScale}
                              fill={themeStyles.bg}
                              fontSize={Math.round(16 * fontScale)}
                              textAnchor="middle"
                              dominantBaseline="central"
                            >
                              ✎
                            </text>
                          </g>
                        </g>
                      )}

                      {/* Non-Overlapping Horizontal Width Dimensions */}
                      {showDimensions && (
                        <g>
                          {pos.zone === 'floor' ? (
                            /* Floor units: Dimension string placed BELOW floor line */
                            (() => {
                              const dimY = wallHeight + 45 * fontScale;
                              return (
                                <>
                                  <line
                                    x1={pos.x}
                                    y1={dimY}
                                    x2={pos.x + pos.w}
                                    y2={dimY}
                                    stroke={themeStyles.dimLine}
                                    strokeWidth={2 * fontScale}
                                    markerStart="url(#arrow)"
                                    markerEnd="url(#arrow)"
                                  />
                                  {/* Extension lines */}
                                  <line
                                    x1={pos.x}
                                    y1={wallHeight + 8}
                                    x2={pos.x}
                                    y2={dimY + 16 * fontScale}
                                    stroke={themeStyles.dimLine}
                                    strokeWidth={1.5 * fontScale}
                                    strokeDasharray="2,2"
                                  />
                                  <line
                                    x1={pos.x + pos.w}
                                    y1={wallHeight + 8}
                                    x2={pos.x + pos.w}
                                    y2={dimY + 16 * fontScale}
                                    stroke={themeStyles.dimLine}
                                    strokeWidth={1.5 * fontScale}
                                    strokeDasharray="2,2"
                                  />
                                  <text
                                    x={pos.x + pos.w / 2}
                                    y={dimY + 22 * fontScale}
                                    fill={themeStyles.dimLine}
                                    fontSize={Math.round(38 * fontScale)}
                                    fontWeight="bold"
                                    textAnchor="middle"
                                  >
                                    W: {pos.w}mm ({pos.item.widthFt}′)
                                  </text>
                                </>
                              );
                            })()
                          ) : pos.zone === 'loft' ? (
                            /* Loft units: Dimension string placed ABOVE ceiling line */
                            (() => {
                              const dimY = -35 * fontScale;
                              return (
                                <>
                                  <line
                                    x1={pos.x}
                                    y1={dimY}
                                    x2={pos.x + pos.w}
                                    y2={dimY}
                                    stroke={themeStyles.dimLine}
                                    strokeWidth={2 * fontScale}
                                    markerStart="url(#arrow)"
                                    markerEnd="url(#arrow)"
                                  />
                                  {/* Extension lines */}
                                  <line
                                    x1={pos.x}
                                    y1={-8}
                                    x2={pos.x}
                                    y2={dimY - 14 * fontScale}
                                    stroke={themeStyles.dimLine}
                                    strokeWidth={1.5 * fontScale}
                                    strokeDasharray="2,2"
                                  />
                                  <line
                                    x1={pos.x + pos.w}
                                    y1={-8}
                                    x2={pos.x + pos.w}
                                    y2={dimY - 14 * fontScale}
                                    stroke={themeStyles.dimLine}
                                    strokeWidth={1.5 * fontScale}
                                    strokeDasharray="2,2"
                                  />
                                  <text
                                    x={pos.x + pos.w / 2}
                                    y={dimY - 12 * fontScale}
                                    fill={themeStyles.dimLine}
                                    fontSize={Math.round(38 * fontScale)}
                                    fontWeight="bold"
                                    textAnchor="middle"
                                  >
                                    W: {pos.w}mm ({pos.item.widthFt}′)
                                  </text>
                                </>
                              );
                            })()
                          ) : (
                            /* Overhead units: Dimension placed above overhead */
                            (() => {
                              const dimY = itemY - 25 * fontScale;
                              return (
                                <>
                                  <line
                                    x1={pos.x}
                                    y1={dimY}
                                    x2={pos.x + pos.w}
                                    y2={dimY}
                                    stroke={themeStyles.dimLine}
                                    strokeWidth={2 * fontScale}
                                    markerStart="url(#arrow)"
                                    markerEnd="url(#arrow)"
                                  />
                                  <text
                                    x={pos.x + pos.w / 2}
                                    y={dimY - 10 * fontScale}
                                    fill={themeStyles.dimLine}
                                    fontSize={Math.round(36 * fontScale)}
                                    fontWeight="bold"
                                    textAnchor="middle"
                                  >
                                    W: {pos.w}mm
                                  </text>
                                </>
                              );
                            })()
                          )}
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          ) : (
            /* ================= 2D FLOOR PLAN (TOP-DOWN) ================= */
            <svg
              ref={svgRef}
              viewBox="0 0 1000 850"
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-auto drop-shadow-2xl transition-all"
              style={{
                width: '100%',
                maxWidth: '1200px',
                maxHeight: isFullWidth ? '84vh' : '72vh',
                minHeight: '520px',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              <defs>
                <pattern id="planHatch" width="15" height="15" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="15" stroke={themeStyles.hatchStroke} strokeWidth="1" />
                </pattern>
              </defs>

              {/* Room perimeter walls */}
              <g transform="translate(100, 100)">
                {/* 4 Boundary Walls: Front (bottom), Back (top), Left, Right */}
                <rect
                  x="0"
                  y="0"
                  width="800"
                  height="650"
                  fill={cadTheme === 'blueprint' ? 'rgba(255,255,255,0.03)' : 'transparent'}
                  stroke={themeStyles.wallLine}
                  strokeWidth="8"
                />

                {/* Wall Orientation Labels */}
                <text x="400" y="-22" fill={themeStyles.text} fontSize={Math.round(20 * fontScale)} fontWeight="bold" textAnchor="middle">
                  BACK WALL (NORTH)
                </text>
                <text x="400" y={650 + Math.round(36 * fontScale)} fill={themeStyles.text} fontSize={Math.round(20 * fontScale)} fontWeight="bold" textAnchor="middle">
                  FRONT WALL (SOUTH)
                </text>
                <text x={-Math.round(28 * fontScale)} y="325" fill={themeStyles.text} fontSize={Math.round(20 * fontScale)} fontWeight="bold" textAnchor="middle" transform={`rotate(-90 ${-Math.round(28 * fontScale)} 325)`}>
                  LEFT WALL (WEST)
                </text>
                <text x={800 + Math.round(28 * fontScale)} y="325" fill={themeStyles.text} fontSize={Math.round(20 * fontScale)} fontWeight="bold" textAnchor="middle" transform={`rotate(90 ${800 + Math.round(28 * fontScale)} 325)`}>
                  RIGHT WALL (EAST)
                </text>

                {/* Room Center Title */}
                <text x="400" y="305" fill={themeStyles.text} fontSize={Math.round(28 * fontScale)} fontWeight="bold" textAnchor="middle">
                  {selectedRoom} PLAN
                </text>
                <text x="400" y="338" fill={themeStyles.dimLine} fontSize={Math.round(18 * fontScale)} fontWeight="600" textAnchor="middle">
                  Clear Internal Dimension: 4200mm × 3600mm
                </text>

                {/* Draw Cabinets along their respective assigned walls without ANY overlap */}
                {(() => {
                  let frontX = 40;
                  let backX = 40;
                  let leftY = 40;
                  let rightY = 40;

                  return roomItems.map((item) => {
                    const isSelected = selectedItemId === item.id;
                    const isLoftOrOverhead =
                      item.category === 'loft' || item.category === 'kitchen_loft' || item.category === 'kitchen_overhead';

                    // Depth and width scaling
                    const depth = item.depthMm > 0 ? Math.min(Math.max((item.depthMm / 3600) * 500, 36), 65) : 42;
                    const width = Math.min(Math.max((item.widthMm / 4200) * 680, 80), 220);

                    let rectX = 40;
                    let rectY = 40;
                    let rectW = width;
                    let rectH = depth;

                    if (item.wall === 'front') {
                      rectX = frontX;
                      rectY = 650 - depth;
                      rectW = width;
                      rectH = depth;
                      frontX += width + 12;
                    } else if (item.wall === 'back') {
                      rectX = backX;
                      rectY = 0;
                      rectW = width;
                      rectH = depth;
                      backX += width + 12;
                    } else if (item.wall === 'left') {
                      rectX = 0;
                      rectY = leftY;
                      rectW = depth;
                      rectH = width;
                      leftY += width + 12;
                    } else if (item.wall === 'right') {
                      rectX = 800 - depth;
                      rectY = rightY;
                      rectW = depth;
                      rectH = width;
                      rightY += width + 12;
                    }

                    return (
                      <g
                        key={`plan-${item.id}`}
                        onClick={() => {
                          if (!hasMovedRef.current && onSelectItem) {
                            onSelectItem(item);
                          }
                        }}
                        className="cursor-pointer group"
                      >
                        <rect
                          x={rectX}
                          y={rectY}
                          width={rectW}
                          height={rectH}
                          fill={
                            isSelected
                              ? themeStyles.selectedFill
                              : isLoftOrOverhead
                              ? 'rgba(56, 189, 248, 0.12)'
                              : themeStyles.cabinetFill
                          }
                          stroke={
                            isSelected
                              ? themeStyles.selectedStroke
                              : isLoftOrOverhead
                              ? '#0284c7'
                              : themeStyles.cabinetStroke
                          }
                          strokeWidth={isSelected ? '3.5' : '1.8'}
                          strokeDasharray={isLoftOrOverhead ? '4,3' : 'none'}
                        />
                        {/* Shutter / module indicators */}
                        {rectW > 34 && rectH > 16 && (
                          <text
                            x={rectX + rectW / 2}
                            y={rectY + rectH / 2 + 4}
                            fill={themeStyles.text}
                            fontSize={Math.round(Math.min(rectW / 9, rectH * 0.45, 14 * fontScale))}
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            #{item.sNo} {isLoftOrOverhead ? '[LOFT] ' : ''}
                            {showRoomInLabels ? `${item.room} • ` : ''}
                            {item.description.slice(0, 22)}
                          </text>
                        )}
                      </g>
                    );
                  });
                })()}

                {/* Entry Door Clearance Arc on Floor Plan */}
                <g transform="translate(680, 650)">
                  <path d="M 0,0 A 90,90 0 0,1 -90,-90 L 0,-90 Z" fill="none" stroke={themeStyles.dimLine} strokeWidth="1.5" strokeDasharray="3,3" />
                  <line x1="0" y1="0" x2="-90" y2="-90" stroke={themeStyles.wallLine} strokeWidth="3" />
                </g>
              </g>
            </svg>
          )}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center flex-wrap gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Active Wall: <strong className="text-slate-800 capitalize">{activeWall}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" />
            Units on Wall: <strong className="text-slate-800">{wallItems.length} items</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
            Wall Span: <strong className="text-slate-800">{wallWidth} mm</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            Project Mode: <strong className="text-slate-800">{projectType === 'semi' ? 'Semi-Modular (Civil Frame)' : 'Full Modular (Factory Prefab)'}</strong>
          </span>
        </div>
        <div className="text-slate-500 text-[11px] flex items-center gap-2">
          <span>Click any cabinet on the drawing to inspect component details</span>
          {isFullWidth && (
            <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 font-semibold font-mono">
              100% Full Width
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
