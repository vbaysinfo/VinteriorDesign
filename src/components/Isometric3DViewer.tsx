import React, { useState, useMemo, useRef } from 'react';
import { ModularItem, WallType, ProjectType } from '../types';
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Download,
  Eye,
  Box,
  Layers,
  Sliders,
  Compass,
  Sparkles,
  Check,
  Info,
  Maximize,
  Sun,
  Grid,
  Type,
  Tag
} from 'lucide-react';

interface Isometric3DViewerProps {
  items: ModularItem[];
  selectedRoom: string;
  projectType: ProjectType;
  selectedItemId?: string;
  onSelectItem?: (item: ModularItem) => void;
  activeWall: WallType | 'all';
  onSelectWall?: (wall: WallType | 'all') => void;
  onSwitchViewMode?: (mode: 'elevation' | 'floor_plan' | 'isometric_3d') => void;
  isFullWidth?: boolean;
  onToggleFullWidth?: () => void;
}

type RenderStyle = 'solid_wood' | 'acrylic_modern' | 'cad_wireframe' | 'blueprint_3d' | 'xray_translucent';

// Projection 3D Point
interface Point3D {
  x: number;
  y: number;
  z: number;
}

// Projected 2D Point with camera depth
interface Point2D {
  u: number;
  v: number;
  depth: number;
}

// 3D Polygon face to render with painter's algorithm
interface PolyFace {
  id: string;
  itemId?: string;
  partName: string;
  points: Point2D[];
  avgDepth: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  strokeDash?: string;
  opacity?: number;
  isClickable?: boolean;
}

export const Isometric3DViewer: React.FC<Isometric3DViewerProps> = ({
  items,
  selectedRoom,
  projectType,
  selectedItemId,
  onSelectItem,
  activeWall,
  onSelectWall,
  onSwitchViewMode,
  isFullWidth,
  onToggleFullWidth,
}) => {
  // Camera angles (degrees)
  // Azimuth (yaw): 0° to 360°, default 45° (Classic Isometric NE)
  const [azimuth, setAzimuth] = useState<number>(45);
  // Pitch (tilt): 15° to 65°, default 32°
  const [pitch, setPitch] = useState<number>(32);
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);

  // View style options
  const [renderStyle, setRenderStyle] = useState<RenderStyle>('solid_wood');
  const [fontSizeLevel, setFontSizeLevel] = useState<'normal' | 'large' | 'xl'>('large');
  const [showModuleTags, setShowModuleTags] = useState<boolean>(true);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [showFloorGrid, setShowFloorGrid] = useState<boolean>(true);
  const [doorOpenPercent, setDoorOpenPercent] = useState<number>(0); // 0 to 100%
  const [drawerSlidePercent, setDrawerSlidePercent] = useState<number>(0); // 0 to 100%
  const [explodedView, setExplodedView] = useState<boolean>(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  const fontScale = fontSizeLevel === 'normal' ? 1.0 : fontSizeLevel === 'large' ? 1.35 : 1.75;

  // Mouse drag orbit controls
  const isDraggingRef = useRef<boolean>(false);
  const dragModeRef = useRef<'orbit' | 'pan'>('orbit');
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgContainerRef = useRef<SVGSVGElement>(null);

  // Filter items by room and wall
  const roomItems = useMemo(() => {
    if (selectedRoom === 'ALL') return items;
    return items.filter((item) => item.room === selectedRoom);
  }, [items, selectedRoom]);

  const displayItems = useMemo(() => {
    if (activeWall === 'all') return roomItems;
    return roomItems.filter((item) => item.wall === activeWall);
  }, [roomItems, activeWall]);

  // Quick preset angles
  const setPresetAngle = (preset: 'ne' | 'nw' | 'se' | 'sw' | 'front' | 'top') => {
    switch (preset) {
      case 'ne':
        setAzimuth(45);
        setPitch(32);
        break;
      case 'nw':
        setAzimuth(135);
        setPitch(32);
        break;
      case 'sw':
        setAzimuth(225);
        setPitch(32);
        break;
      case 'se':
        setAzimuth(315);
        setPitch(32);
        break;
      case 'front':
        setAzimuth(0);
        setPitch(12);
        break;
      case 'top':
        setAzimuth(45);
        setPitch(75);
        break;
    }
  };

  // Drag handlers for orbiting
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.shiftKey) {
      dragModeRef.current = 'pan';
    } else {
      dragModeRef.current = 'orbit';
    }
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    if (dragModeRef.current === 'orbit') {
      setAzimuth((prev) => (prev - dx * 0.5 + 360) % 360);
      setPitch((prev) => Math.max(10, Math.min(80, prev + dy * 0.4)));
    } else {
      setPanX((prev) => prev + dx);
      setPanY((prev) => prev + dy);
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((prev) => Math.max(0.4, Math.min(2.8, prev + delta)));
  };

  // Palette settings per render style
  const styleConfig = useMemo(() => {
    switch (renderStyle) {
      case 'cad_wireframe':
        return {
          bg: '#090d16',
          grid: '#1e293b',
          gridAxis: '#38bdf8',
          carcassTop: '#064e3b',
          carcassSide: '#022c22',
          carcassFront: '#065f46',
          shutter: '#10b981',
          countertop: '#f59e0b',
          highlight: '#38bdf8',
          edgeStroke: '#34d399',
          dimColor: '#38bdf8',
          text: '#f8fafc',
          opacity: 0.85,
        };
      case 'blueprint_3d':
        return {
          bg: '#0c2340',
          grid: '#1e3a5f',
          gridAxis: '#60a5fa',
          carcassTop: '#1d4ed8',
          carcassSide: '#1e3a8a',
          carcassFront: '#2563eb',
          shutter: '#60a5fa',
          countertop: '#93c5fd',
          highlight: '#38bdf8',
          edgeStroke: '#ffffff',
          dimColor: '#e0f2fe',
          text: '#ffffff',
          opacity: 0.88,
        };
      case 'xray_translucent':
        return {
          bg: '#0f172a',
          grid: '#334155',
          gridAxis: '#94a3b8',
          carcassTop: 'rgba(56, 189, 248, 0.25)',
          carcassSide: 'rgba(14, 165, 233, 0.20)',
          carcassFront: 'rgba(2, 132, 199, 0.22)',
          shutter: 'rgba(56, 189, 248, 0.35)',
          countertop: 'rgba(245, 158, 11, 0.40)',
          highlight: '#fbbf24',
          edgeStroke: '#38bdf8',
          dimColor: '#f1f5f9',
          text: '#f8fafc',
          opacity: 0.6,
        };
      case 'acrylic_modern':
        return {
          bg: '#f1f5f9',
          grid: '#cbd5e1',
          gridAxis: '#64748b',
          carcassTop: '#ffffff',
          carcassSide: '#e2e8f0',
          carcassFront: '#f8fafc',
          shutter: '#0284c7', // High Gloss Azure Blue
          countertop: '#1e293b', // Black Quartz
          highlight: '#f59e0b',
          edgeStroke: '#0369a1',
          dimColor: '#0f172a',
          text: '#0f172a',
          opacity: 1,
        };
      case 'solid_wood':
      default:
        return {
          bg: '#1e293b',
          grid: '#334155',
          gridAxis: '#64748b',
          carcassTop: '#e2d5c3', // Birch plywood core
          carcassSide: '#c8b69e',
          carcassFront: '#d7c7b0',
          shutter: '#9c6644', // Warm Teak / Walnut laminate
          countertop: '#2b2d42', // Dark granite
          highlight: '#fbbf24',
          edgeStroke: '#5a3e2b',
          dimColor: '#fbbf24',
          text: '#f8fafc',
          opacity: 1,
        };
    }
  }, [renderStyle]);

  // Depth helper per category
  const getTypicalDepth = (item: ModularItem): number => {
    if (item.depthMm && item.depthMm > 0) return item.depthMm;
    switch (item.category) {
      case 'wardrobe_shutter':
      case 'single_wardrobe':
        return 600;
      case 'loft':
        return item.room.toLowerCase().includes('kitchen') ? 350 : 600;
      case 'kitchen_base':
        return 580;
      case 'kitchen_overhead':
      case 'kitchen_loft':
        return 350;
      case 'sitting_box':
        return 450;
      case 'tv_panel':
        return 280;
      case 'dressing_unit':
        return 400;
      case 'shelves':
        return 350;
      case 'partition':
        return 150;
      default:
        return 550;
    }
  };

  // Calculate 3D layout bounds & positions
  // We align cabinets along wall boundaries with correct offsets
  const layout3D = useMemo(() => {
    const positioned: Array<{
      item: ModularItem;
      x: number; // mm
      y: number; // mm from floor
      z: number; // mm
      w: number; // mm
      h: number; // mm
      d: number; // mm
      facing: 'south' | 'north' | 'east' | 'west'; // orientation
    }> = [];

    // Room boundaries
    const roomWidth = 4200;
    const roomDepth = 3600;

    if (activeWall === 'all') {
      // Position around perimeter walls
      let frontX = 150;
      let leftZ = 150;
      let rightZ = 150;
      let backX = 150;

      displayItems.forEach((item) => {
        const w = item.widthMm;
        const h = item.heightMm;
        const d = getTypicalDepth(item);
        let y = 100; // Skirting offset

        if (item.category === 'loft' || item.category === 'kitchen_loft') {
          y = Math.min(2800 - h, 2100);
        } else if (item.category === 'kitchen_overhead') {
          y = 1500;
        } else if (item.category === 'tv_panel') {
          y = 200;
        }

        if (item.wall === 'front') {
          positioned.push({
            item,
            x: frontX,
            y,
            z: 0,
            w,
            h,
            d,
            facing: 'south',
          });
          frontX += w + 60;
        } else if (item.wall === 'left') {
          positioned.push({
            item,
            x: 0,
            y,
            z: leftZ,
            w: d,
            h,
            d: w,
            facing: 'east',
          });
          leftZ += w + 60;
        } else if (item.wall === 'right') {
          positioned.push({
            item,
            x: roomWidth - d,
            y,
            z: rightZ,
            w: d,
            h,
            d: w,
            facing: 'west',
          });
          rightZ += w + 60;
        } else if (item.wall === 'back') {
          positioned.push({
            item,
            x: backX,
            y,
            z: roomDepth - d,
            w,
            h,
            d,
            facing: 'north',
          });
          backX += w + 60;
        }
      });
    } else {
      // Single Wall Extrusion: clean continuous linear alignment
      let currentX = 200;
      displayItems.forEach((item) => {
        const w = item.widthMm;
        const h = item.heightMm;
        const d = getTypicalDepth(item);
        let y = 100;

        if (item.category === 'loft' || item.category === 'kitchen_loft') {
          y = Math.min(2800 - h, 2100);
        } else if (item.category === 'kitchen_overhead') {
          y = 1500;
        } else if (item.category === 'tv_panel') {
          y = 200;
        }

        positioned.push({
          item,
          x: currentX,
          y,
          z: 100,
          w,
          h,
          d,
          facing: 'south',
        });

        currentX += w + 70; // 70mm gap
      });
    }

    // Compute scene bounding box
    let minX = 0;
    let maxX = 4200;
    let minY = 0;
    let maxY = 2800;
    let minZ = 0;
    let maxZ = 3600;

    if (positioned.length > 0) {
      minX = Math.min(...positioned.map((p) => p.x));
      maxX = Math.max(...positioned.map((p) => p.x + p.w));
      minY = 0;
      maxY = Math.max(...positioned.map((p) => p.y + p.h), 2800);
      minZ = Math.min(...positioned.map((p) => p.z));
      maxZ = Math.max(...positioned.map((p) => p.z + p.d));
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    return {
      modules: positioned,
      bounds: { minX, maxX, minY, maxY, minZ, maxZ, centerX, centerY, centerZ },
    };
  }, [displayItems, activeWall]);

  // Projection math: 3D point (x, y, z) -> 2D point (u, v) with depth sorting
  const projectPoint = (p: Point3D): Point2D => {
    const { centerX, centerY, centerZ } = layout3D.bounds;

    // Shift to center
    const x0 = p.x - centerX;
    const y0 = p.y - centerY;
    const z0 = p.z - centerZ;

    // Convert angles to radians
    const radAz = (azimuth * Math.PI) / 180;
    const radPi = (pitch * Math.PI) / 180;

    // Yaw rotation around Y axis
    const cosAz = Math.cos(radAz);
    const sinAz = Math.sin(radAz);
    const x1 = x0 * cosAz - z0 * sinAz;
    const z1 = x0 * sinAz + z0 * cosAz;

    // Pitch tilt
    const cosPi = Math.cos(radPi);
    const sinPi = Math.sin(radPi);
    const y1 = y0 * cosPi - z1 * sinPi;
    const z2 = y0 * sinPi + z1 * cosPi;

    // Isometric isometric scaling factor (0.17 to fit svg comfortably)
    const scale = 0.18 * zoom;

    const u = x1 * scale;
    const v = -y1 * scale; // Invert SVG Y

    return {
      u: u + panX,
      v: v + panY,
      depth: z2,
    };
  };

  // Generate 3D Polygons for each cabinet module
  const polygons = useMemo(() => {
    const polys: PolyFace[] = [];

    // Helper to calculate face average depth
    const getAvgDepth = (pts: Point2D[]) => {
      return pts.reduce((sum, p) => sum + p.depth, 0) / pts.length;
    };

    // Helper to add a quad face
    const addQuad = (
      id: string,
      p1: Point3D,
      p2: Point3D,
      p3: Point3D,
      p4: Point3D,
      fillColor: string,
      strokeColor: string,
      strokeWidth = 1.2,
      itemId?: string,
      partName = '',
      opacity?: number
    ) => {
      const proj = [projectPoint(p1), projectPoint(p2), projectPoint(p3), projectPoint(p4)];
      polys.push({
        id,
        itemId,
        partName,
        points: proj,
        avgDepth: getAvgDepth(proj),
        fillColor,
        strokeColor,
        strokeWidth,
        opacity,
        isClickable: !!itemId,
      });
    };

    // 1. FLOOR BASE GRID & WALL REFERENCE
    if (showFloorGrid) {
      const gridSpan = 4000;
      const step = 500;
      for (let gx = 0; gx <= gridSpan; gx += step) {
        const pA = projectPoint({ x: gx, y: 0, z: 0 });
        const pB = projectPoint({ x: gx, y: 0, z: gridSpan });
        polys.push({
          id: `grid-x-${gx}`,
          partName: 'Floor Grid',
          points: [pA, pB, pB, pA],
          avgDepth: (pA.depth + pB.depth) / 2 - 5000,
          fillColor: 'none',
          strokeColor: styleConfig.grid,
          strokeWidth: gx % 1000 === 0 ? 1.5 : 0.6,
          strokeDash: gx % 1000 === 0 ? undefined : '4 4',
        });
      }
      for (let gz = 0; gz <= gridSpan; gz += step) {
        const pA = projectPoint({ x: 0, y: 0, z: gz });
        const pB = projectPoint({ x: gridSpan, y: 0, z: gz });
        polys.push({
          id: `grid-z-${gz}`,
          partName: 'Floor Grid',
          points: [pA, pB, pB, pA],
          avgDepth: (pA.depth + pB.depth) / 2 - 5000,
          fillColor: 'none',
          strokeColor: styleConfig.grid,
          strokeWidth: gz % 1000 === 0 ? 1.5 : 0.6,
          strokeDash: gz % 1000 === 0 ? undefined : '4 4',
        });
      }
    }

    // 2. CABINET MODULES EXTRUSION
    layout3D.modules.forEach((mod, idx) => {
      const { item, x, y, z, w, h, d } = mod;
      const isSelected = selectedItemId === item.id;
      const isHovered = hoveredItemId === item.id;

      // Exploded offset
      const exp = explodedView ? 50 : 0;
      const xExp = x;
      const yExp = y;
      const zExp = z;

      // Determine face colors
      let topFill = styleConfig.carcassTop;
      let sideFill = styleConfig.carcassSide;
      let frontFill = styleConfig.carcassFront;
      let shutterFill = styleConfig.shutter;
      let strokeColor = styleConfig.edgeStroke;

      if (isSelected) {
        shutterFill = '#f59e0b'; // Vibrant Amber selected
        topFill = '#fbbf24';
        sideFill = '#d97706';
        strokeColor = '#ffffff';
      } else if (isHovered) {
        shutterFill = '#38bdf8'; // Cyan hover
        strokeColor = '#38bdf8';
      }

      // 8 corners of main carcass box
      // p0: (x, y, z)           - bottom-back-left
      // p1: (x+w, y, z)         - bottom-back-right
      // p2: (x+w, y+h, z)       - top-back-right
      // p3: (x, y+h, z)         - top-back-left
      // p4: (x, y, z+d)         - bottom-front-left
      // p5: (x+w, y, z+d)       - bottom-front-right
      // p6: (x+w, y+h, z+d)     - top-front-right
      // p7: (x, y+h, z+d)       - top-front-left

      const p0 = { x: xExp, y: yExp, z: zExp };
      const p1 = { x: xExp + w, y: yExp, z: zExp };
      const p2 = { x: xExp + w, y: yExp + h, z: zExp };
      const p3 = { x: xExp, y: yExp + h, z: zExp };

      const p4 = { x: xExp, y: yExp, z: zExp + d };
      const p5 = { x: xExp + w, y: yExp, z: zExp + d };
      const p6 = { x: xExp + w, y: yExp + h, z: zExp + d };
      const p7 = { x: xExp, y: yExp + h, z: zExp + d };

      // Bottom Plinth Skirting (if sits on floor at y=100)
      if (y === 100) {
        const plinthH = 100;
        const plinthInset = 35;
        const pl0 = { x: xExp + plinthInset, y: 0, z: zExp + plinthInset };
        const pl1 = { x: xExp + w - plinthInset, y: 0, z: zExp + plinthInset };
        const pl2 = { x: xExp + w - plinthInset, y: plinthH, z: zExp + plinthInset };
        const pl3 = { x: xExp + plinthInset, y: plinthH, z: zExp + plinthInset };
        const pl4 = { x: xExp + plinthInset, y: 0, z: zExp + d - plinthInset };
        const pl5 = { x: xExp + w - plinthInset, y: 0, z: zExp + d - plinthInset };
        const pl6 = { x: xExp + w - plinthInset, y: plinthH, z: zExp + d - plinthInset };
        const pl7 = { x: xExp + plinthInset, y: plinthH, z: zExp + d - plinthInset };

        addQuad(`plinth-front-${item.id}`, pl4, pl5, pl6, pl7, '#1e293b', '#0f172a', 1, item.id, 'Plinth Skirting');
        addQuad(`plinth-side-${item.id}`, pl0, pl4, pl7, pl3, '#0f172a', '#0f172a', 1, item.id, 'Plinth Skirting');
      }

      // Carcass 6 Box Faces
      // Top face (p3, p2, p6, p7)
      addQuad(
        `box-top-${item.id}`,
        { x: p7.x, y: p7.y + exp, z: p7.z },
        { x: p6.x, y: p6.y + exp, z: p6.z },
        { x: p2.x, y: p2.y + exp, z: p2.z },
        { x: p3.x, y: p3.y + exp, z: p3.z },
        topFill,
        strokeColor,
        isSelected ? 2 : 1.2,
        item.id,
        'Top Deck',
        styleConfig.opacity
      );

      // Left Gable face (p0, p4, p7, p3)
      addQuad(
        `box-left-${item.id}`,
        { x: p0.x - exp, y: p0.y, z: p0.z },
        { x: p4.x - exp, y: p4.y, z: p4.z },
        { x: p7.x - exp, y: p7.y, z: p7.z },
        { x: p3.x - exp, y: p3.y, z: p3.z },
        sideFill,
        strokeColor,
        isSelected ? 2 : 1.2,
        item.id,
        'Left Gable',
        styleConfig.opacity
      );

      // Right Gable face (p1, p2, p6, p5)
      addQuad(
        `box-right-${item.id}`,
        { x: p5.x + exp, y: p5.y, z: p5.z },
        { x: p1.x + exp, y: p1.y, z: p1.z },
        { x: p2.x + exp, y: p2.y, z: p2.z },
        { x: p6.x + exp, y: p6.y, z: p6.z },
        sideFill,
        strokeColor,
        isSelected ? 2 : 1.2,
        item.id,
        'Right Gable',
        styleConfig.opacity
      );

      // Bottom Deck face (p0, p1, p5, p4)
      addQuad(
        `box-bottom-${item.id}`,
        p0,
        p1,
        p5,
        p4,
        sideFill,
        strokeColor,
        1,
        item.id,
        'Bottom Deck',
        styleConfig.opacity
      );

      // Back Panel (p0, p1, p2, p3)
      addQuad(
        `box-back-${item.id}`,
        p0,
        p1,
        p2,
        p3,
        sideFill,
        strokeColor,
        0.8,
        item.id,
        'Back Panel',
        styleConfig.opacity
      );

      // INTERNAL SHELVES (If in X-Ray mode or doors opened)
      if (doorOpenPercent > 20 || renderStyle === 'xray_translucent') {
        const shelfCount = item.shelfCount || 2;
        for (let s = 1; s <= shelfCount; s++) {
          const sY = yExp + (h / (shelfCount + 1)) * s;
          const sThickness = 18;
          const sP0 = { x: xExp + 18, y: sY, z: zExp + 18 };
          const sP1 = { x: xExp + w - 18, y: sY, z: zExp + 18 };
          const sP2 = { x: xExp + w - 18, y: sY, z: zExp + d - 25 };
          const sP3 = { x: xExp + 18, y: sY, z: zExp + d - 25 };

          addQuad(
            `shelf-${item.id}-${s}`,
            sP3,
            sP2,
            sP1,
            sP0,
            '#e2d5c3',
            '#94a3b8',
            0.8,
            item.id,
            `Internal Shelf ${s}`
          );
        }
      }

      // KITCHEN COUNTERTOP SLAB (for base units or sitting boxes)
      if (item.category === 'kitchen_base' || item.category === 'sitting_box') {
        const slabOverhang = 25; // 25mm nosing
        const slabH = 38; // 38mm quartz / granite thickness
        const slabY = yExp + h;

        const c0 = { x: xExp - slabOverhang, y: slabY, z: zExp };
        const c1 = { x: xExp + w + slabOverhang, y: slabY, z: zExp };
        const c2 = { x: xExp + w + slabOverhang, y: slabY + slabH, z: zExp };
        const c3 = { x: xExp - slabOverhang, y: slabY + slabH, z: zExp };
        const c4 = { x: xExp - slabOverhang, y: slabY, z: zExp + d + slabOverhang };
        const c5 = { x: xExp + w + slabOverhang, y: slabY, z: zExp + d + slabOverhang };
        const c6 = { x: xExp + w + slabOverhang, y: slabY + slabH, z: zExp + d + slabOverhang };
        const c7 = { x: xExp - slabOverhang, y: slabY + slabH, z: zExp + d + slabOverhang };

        // Slab Top
        addQuad(
          `counter-top-${item.id}`,
          c7,
          c6,
          c2,
          c3,
          styleConfig.countertop,
          '#ffffff',
          1.5,
          item.id,
          'Granite Countertop'
        );
        // Slab Front Edge
        addQuad(
          `counter-front-${item.id}`,
          c4,
          c5,
          c6,
          c7,
          styleConfig.countertop,
          '#ffffff',
          1.2,
          item.id,
          'Countertop Bullnose Edge'
        );
        // Slab Left/Right Edge
        addQuad(
          `counter-left-${item.id}`,
          c0,
          c4,
          c7,
          c3,
          styleConfig.countertop,
          '#ffffff',
          1,
          item.id,
          'Countertop Profile Edge'
        );
        addQuad(
          `counter-right-${item.id}`,
          c5,
          c1,
          c2,
          c6,
          styleConfig.countertop,
          '#ffffff',
          1,
          item.id,
          'Countertop Profile Edge'
        );
      }

      // 3. FRONT SHUTTERS & DRAWERS EXTRUSION
      // Drawers: slide out in 3D along depth
      const drawerCount = item.drawerCount || 0;
      const shutterCount = item.shutterCount || (drawerCount > 0 ? 0 : 2);
      const slideOutDist = (drawerSlidePercent / 100) * 350; // up to 350mm pull-out

      if (drawerCount > 0) {
        const drawerH = (h - 20) / drawerCount;
        for (let dIdx = 0; dIdx < drawerCount; dIdx++) {
          const dY = yExp + 10 + dIdx * drawerH;
          const dZ = zExp + d + 2 + slideOutDist;

          // Drawer Front Facia
          const df0 = { x: xExp + 4, y: dY + 4, z: dZ };
          const df1 = { x: xExp + w - 4, y: dY + 4, z: dZ };
          const df2 = { x: xExp + w - 4, y: dY + drawerH - 4, z: dZ };
          const df3 = { x: xExp + 4, y: dY + drawerH - 4, z: dZ };
          const dfThickness = 18;
          const df4 = { x: xExp + 4, y: dY + 4, z: dZ + dfThickness };
          const df5 = { x: xExp + w - 4, y: dY + 4, z: dZ + dfThickness };
          const df6 = { x: xExp + w - 4, y: dY + drawerH - 4, z: dZ + dfThickness };
          const df7 = { x: xExp + 4, y: dY + drawerH - 4, z: dZ + dfThickness };

          // Drawer front face
          addQuad(
            `drawer-front-${item.id}-${dIdx}`,
            df4,
            df5,
            df6,
            df7,
            shutterFill,
            strokeColor,
            1.5,
            item.id,
            `Drawer ${dIdx + 1} Facia`
          );
          // Drawer front top edge
          addQuad(
            `drawer-top-${item.id}-${dIdx}`,
            df7,
            df6,
            df2,
            df3,
            topFill,
            strokeColor,
            1,
            item.id,
            `Drawer ${dIdx + 1} Bevel`
          );

          // Handle Bar on drawer facia
          const hW = Math.min(220, w * 0.4);
          const hX1 = xExp + w / 2 - hW / 2;
          const hX2 = xExp + w / 2 + hW / 2;
          const hY = dY + drawerH / 2;
          const hZ = dZ + dfThickness + 14;
          addQuad(
            `handle-drw-${item.id}-${dIdx}`,
            { x: hX1, y: hY - 6, z: hZ },
            { x: hX2, y: hY - 6, z: hZ },
            { x: hX2, y: hY + 6, z: hZ },
            { x: hX1, y: hY + 6, z: hZ },
            '#475569',
            '#94a3b8',
            1.5,
            item.id,
            'Concealed Drawer Handle'
          );

          // If drawer is pulled out, render drawer side box in 3D!
          if (slideOutDist > 30) {
            const boxZStart = zExp + d;
            const boxZEnd = dZ;
            const boxL0 = { x: xExp + 20, y: dY + 10, z: boxZStart };
            const boxL1 = { x: xExp + 20, y: dY + 10, z: boxZEnd };
            const boxL2 = { x: xExp + 20, y: dY + drawerH - 15, z: boxZEnd };
            const boxL3 = { x: xExp + 20, y: dY + drawerH - 15, z: boxZStart };

            addQuad(
              `drw-box-left-${item.id}-${dIdx}`,
              boxL0,
              boxL1,
              boxL2,
              boxL3,
              '#cbd5e1',
              '#64748b',
              1,
              item.id,
              'Tandem Runner Side Box'
            );
          }
        }
      } else if (shutterCount > 0) {
        // Swing Shutters in 3D
        const shutterW = (w - 6) / shutterCount;
        const radOpen = (doorOpenPercent / 100) * (Math.PI / 2.5); // up to 72° swing
        const sThick = 18;

        for (let sIdx = 0; sIdx < shutterCount; sIdx++) {
          const sXStart = xExp + 3 + sIdx * shutterW;
          const sXEnd = sXStart + shutterW - 3;
          const sZ = zExp + d + 3;

          // If door open angle > 0, rotate door around hinge
          const isLeftHinged = sIdx % 2 === 0;
          let pFrontLeft: Point3D;
          let pFrontRight: Point3D;

          if (doorOpenPercent > 0) {
            if (isLeftHinged) {
              // Hinge at sXStart
              pFrontLeft = { x: sXStart, y: yExp + 4, z: sZ };
              // Swung end
              pFrontRight = {
                x: sXStart + Math.cos(radOpen) * (shutterW - 3),
                y: yExp + 4,
                z: sZ + Math.sin(radOpen) * (shutterW - 3),
              };
            } else {
              // Hinge at sXEnd
              pFrontRight = { x: sXEnd, y: yExp + 4, z: sZ };
              pFrontLeft = {
                x: sXEnd - Math.cos(radOpen) * (shutterW - 3),
                y: yExp + 4,
                z: sZ + Math.sin(radOpen) * (shutterW - 3),
              };
            }
          } else {
            pFrontLeft = { x: sXStart, y: yExp + 4, z: sZ };
            pFrontRight = { x: sXEnd, y: yExp + 4, z: sZ };
          }

          const sP0 = pFrontLeft;
          const sP1 = pFrontRight;
          const sP2 = { ...pFrontRight, y: yExp + h - 4 };
          const sP3 = { ...pFrontLeft, y: yExp + h - 4 };

          // Shutter Front Face
          addQuad(
            `shutter-front-${item.id}-${sIdx}`,
            sP0,
            sP1,
            sP2,
            sP3,
            shutterFill,
            strokeColor,
            isSelected ? 2.2 : 1.4,
            item.id,
            `Shutter ${sIdx + 1} Facia`
          );

          // Handle Bar / Profile J-Pull
          const handleH = Math.min(300, h * 0.35);
          const handleOffset = isLeftHinged ? shutterW - 35 : 35;
          const hX = isLeftHinged
            ? pFrontLeft.x + (pFrontRight.x - pFrontLeft.x) * 0.85
            : pFrontLeft.x + (pFrontRight.x - pFrontLeft.x) * 0.15;
          const hZ = pFrontLeft.z + (pFrontRight.z - pFrontLeft.z) * (isLeftHinged ? 0.85 : 0.15) + 12;
          const hY = yExp + h / 2 - handleH / 2;

          addQuad(
            `handle-${item.id}-${sIdx}`,
            { x: hX - 4, y: hY, z: hZ },
            { x: hX + 4, y: hY, z: hZ },
            { x: hX + 4, y: hY + handleH, z: hZ },
            { x: hX - 4, y: hY + handleH, z: hZ },
            '#0f172a',
            '#e2e8f0',
            1.5,
            item.id,
            '3D Metal Handle'
          );
        }
      }
    });

    // 4. Sort polygons using Painter's Algorithm: deepest camera depth rendered FIRST
    polys.sort((a, b) => a.avgDepth - b.avgDepth);

    return polys;
  }, [
    layout3D,
    azimuth,
    pitch,
    zoom,
    panX,
    panY,
    renderStyle,
    styleConfig,
    showFloorGrid,
    doorOpenPercent,
    drawerSlidePercent,
    explodedView,
    selectedItemId,
    hoveredItemId,
  ]);

  // Dimension callouts in 3D
  const dimensionCallouts = useMemo(() => {
    if (!showDimensions || layout3D.modules.length === 0) return [];

    const callouts: Array<{
      id: string;
      label: string;
      p1: Point2D;
      p2: Point2D;
      textPos: Point2D;
      color: string;
    }> = [];

    // Add 3D dimension lines for selected item or first 2 items
    const targetModules = selectedItemId
      ? layout3D.modules.filter((m) => m.item.id === selectedItemId)
      : layout3D.modules.slice(0, 3);

    targetModules.forEach((mod) => {
      const { item, x, y, z, w, h, d } = mod;

      // 1. Width dimension along front top
      const wA = projectPoint({ x, y: y + h + 60, z: z + d });
      const wB = projectPoint({ x: x + w, y: y + h + 60, z: z + d });
      callouts.push({
        id: `dim-w-${item.id}`,
        label: `W: ${w}mm`,
        p1: wA,
        p2: wB,
        textPos: { u: (wA.u + wB.u) / 2, v: (wA.v + wB.v) / 2 - 12, depth: (wA.depth + wB.depth) / 2 },
        color: styleConfig.dimColor,
      });

      // 2. Height dimension along left edge
      const hA = projectPoint({ x: x - 60, y, z: z + d });
      const hB = projectPoint({ x: x - 60, y: y + h, z: z + d });
      callouts.push({
        id: `dim-h-${item.id}`,
        label: `H: ${h}mm`,
        p1: hA,
        p2: hB,
        textPos: { u: (hA.u + hB.u) / 2 - 18, v: (hA.v + hB.v) / 2, depth: (hA.depth + hB.depth) / 2 },
        color: styleConfig.dimColor,
      });

      // 3. Depth dimension along left gable
      const dA = projectPoint({ x: x - 60, y: y + 20, z });
      const dB = projectPoint({ x: x - 60, y: y + 20, z: z + d });
      callouts.push({
        id: `dim-d-${item.id}`,
        label: `D: ${d}mm`,
        p1: dA,
        p2: dB,
        textPos: { u: (dA.u + dB.u) / 2, v: (dA.v + dB.v) / 2 + 14, depth: (dA.depth + dB.depth) / 2 },
        color: styleConfig.dimColor,
      });
    });

    return callouts;
  }, [showDimensions, layout3D, selectedItemId, azimuth, pitch, zoom, panX, panY, styleConfig]);

  // Selected item object
  const selectedItem = useMemo(() => {
    return items.find((i) => i.id === selectedItemId);
  }, [items, selectedItemId]);

  // Export 3D View as SVG
  const handleExportSvg = () => {
    if (!svgContainerRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgContainerRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedRoom}_3D_Isometric_View.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
      {/* 3D Toolbar Controls */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-tr from-cyan-600 to-emerald-500 text-white rounded-lg shadow-xs">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm sm:text-base text-white flex items-center gap-1.5">
                3D Isometric Architectural Visualizer
              </h4>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                Axonometric 3D
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Extruded cabinet modules, real millimeter depths, 3D door swing angles, and drawer pullouts.
            </p>
          </div>
        </div>

        {/* Orbit & Preset Angle Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 2D / 3D Mode Switcher (if onSwitchViewMode provided) */}
          {onSwitchViewMode && (
            <div className="inline-flex bg-slate-800 p-1 rounded-lg text-xs font-semibold border border-slate-700">
              <button
                onClick={() => onSwitchViewMode('elevation')}
                className="px-2.5 py-1 rounded-md text-slate-300 hover:text-white transition"
              >
                Wall Elevation (2D)
              </button>
              <button
                onClick={() => onSwitchViewMode('floor_plan')}
                className="px-2.5 py-1 rounded-md text-slate-300 hover:text-white transition"
              >
                Floor Plan (2D)
              </button>
              <button
                onClick={() => onSwitchViewMode('isometric_3d')}
                className="px-2.5 py-1 rounded-md bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-bold shadow-xs flex items-center gap-1"
              >
                <Box className="w-3.5 h-3.5" />
                <span>3D Isometric</span>
              </button>
            </div>
          )}

          {/* Wall Tabs */}
          <div className="inline-flex bg-slate-800 p-1 rounded-lg text-xs font-semibold">
            {(['front', 'left', 'right', 'back', 'all'] as const).map((w) => (
              <button
                key={w}
                onClick={() => onSelectWall && onSelectWall(w)}
                className={`px-2.5 py-1 rounded-md capitalize transition ${
                  activeWall === w ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                {w === 'all' ? 'All Walls (Room 3D)' : `${w} Wall`}
              </button>
            ))}
          </div>

          {/* Quick ISO Presets */}
          <div className="inline-flex bg-slate-800 p-1 rounded-lg text-xs font-medium border border-slate-700">
            <button
              onClick={() => setPresetAngle('ne')}
              title="Isometric North-East (45°)"
              className={`px-2 py-1 rounded transition ${
                azimuth === 45 && pitch === 32 ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              ISO NE
            </button>
            <button
              onClick={() => setPresetAngle('nw')}
              title="Isometric North-West (135°)"
              className={`px-2 py-1 rounded transition ${
                azimuth === 135 && pitch === 32 ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              ISO NW
            </button>
            <button
              onClick={() => setPresetAngle('se')}
              title="Isometric South-East (315°)"
              className={`px-2 py-1 rounded transition ${
                azimuth === 315 && pitch === 32 ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              ISO SE
            </button>
            <button
              onClick={() => setPresetAngle('front')}
              title="Front Elevation"
              className={`px-2 py-1 rounded transition ${
                azimuth === 0 ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              Front
            </button>
            <button
              onClick={() => setPresetAngle('top')}
              title="Top 3D Axonometric"
              className={`px-2 py-1 rounded transition ${
                pitch === 75 ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              Top
            </button>
          </div>

          {/* Render Style Selector */}
          <select
            value={renderStyle}
            onChange={(e) => setRenderStyle(e.target.value as RenderStyle)}
            className="text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden"
          >
            <option value="solid_wood">Warm Wood Teak</option>
            <option value="acrylic_modern">High-Gloss Modern</option>
            <option value="blueprint_3d">Architectural Blueprint 3D</option>
            <option value="cad_wireframe">AutoCAD 3D Dark</option>
            <option value="xray_translucent">X-Ray Translucent</option>
          </select>

          {/* Export 3D SVG */}
          <button
            onClick={handleExportSvg}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export 3D SVG</span>
          </button>
        </div>
      </div>

      {/* Secondary Controls: Sliders for Doors, Drawers, Dimensions & Camera */}
      <div className="px-4 py-2 bg-slate-800/90 border-b border-slate-700 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-4">
        {/* Sliders Group */}
        <div className="flex flex-wrap items-center gap-5">
          {/* Orbit Angle Azimuth Slider */}
          <div className="flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] text-slate-400">Orbit:</span>
            <input
              type="range"
              min="0"
              max="360"
              value={azimuth}
              onChange={(e) => setAzimuth(Number(e.target.value))}
              className="w-20 accent-cyan-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
            />
            <span className="font-mono text-[10px] w-8 text-cyan-300">{Math.round(azimuth)}°</span>
          </div>

          {/* Pitch Tilt Slider */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Tilt:</span>
            <input
              type="range"
              min="15"
              max="75"
              value={pitch}
              onChange={(e) => setPitch(Number(e.target.value))}
              className="w-16 accent-cyan-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
            />
            <span className="font-mono text-[10px] w-8 text-cyan-300">{Math.round(pitch)}°</span>
          </div>

          {/* Door Opening Slider */}
          <div className="flex items-center gap-2 pl-3 border-l border-slate-700">
            <span className="text-[11px] text-slate-300 font-semibold flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              Open Doors:
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={doorOpenPercent}
              onChange={(e) => setDoorOpenPercent(Number(e.target.value))}
              className="w-20 accent-amber-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
            />
            <span className="font-mono text-[10px] w-8 text-amber-300">{doorOpenPercent}%</span>
          </div>

          {/* Drawer Pullout Slider */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-300 font-semibold">Pull Drawers:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={drawerSlidePercent}
              onChange={(e) => setDrawerSlidePercent(Number(e.target.value))}
              className="w-20 accent-emerald-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
            />
            <span className="font-mono text-[10px] w-8 text-emerald-300">{drawerSlidePercent}%</span>
          </div>

          {/* Exploded View Toggle */}
          <button
            onClick={() => setExplodedView(!explodedView)}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition ${
              explodedView
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <Sparkles className="w-3 h-3 text-purple-300" />
            <span>Explode Parts</span>
          </button>
        </div>

        {/* View Toggles & Zoom */}
        <div className="flex items-center gap-2.5">
          {/* Text / Font Size Selector */}
          <div className="inline-flex bg-slate-900 border border-slate-700 rounded-lg p-0.5 items-center">
            <span className="px-1.5 text-slate-400 flex items-center gap-1 text-xs font-semibold" title="Text / Font Size">
              <Type className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] hidden lg:inline">Font</span>
            </span>
            {(['normal', 'large', 'xl'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFontSizeLevel(lvl)}
                className={`px-1.5 py-0.5 rounded text-xs font-bold transition ${
                  fontSizeLevel === lvl
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
                title={`Text Scale: ${lvl === 'normal' ? 'Standard 1x' : lvl === 'large' ? 'Large 1.4x' : 'Extra Large 1.8x'}`}
              >
                {lvl === 'normal' ? '1x' : lvl === 'large' ? '1.4x' : '1.8x'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowModuleTags(!showModuleTags)}
            className={`px-2 py-1 rounded-md text-xs font-semibold border flex items-center gap-1 transition ${
              showModuleTags
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Toggle 3D Module Name & Dimension Tags"
          >
            <Tag className="w-3 h-3" />
            <span>Tags</span>
          </button>

          <button
            onClick={() => setShowDimensions(!showDimensions)}
            className={`px-2 py-1 rounded-md text-xs font-semibold border flex items-center gap-1 ${
              showDimensions
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3 h-3" />
            <span>3D Dims</span>
          </button>

          <button
            onClick={() => setShowFloorGrid(!showFloorGrid)}
            className={`px-2 py-1 rounded-md text-xs font-semibold border flex items-center gap-1 ${
              showFloorGrid
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                : 'border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Grid className="w-3 h-3" />
            <span>Grid</span>
          </button>

          {/* Zoom Buttons */}
          <div className="flex items-center bg-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
              className="p-1 text-slate-300 hover:bg-slate-600"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[10px] font-mono text-slate-200">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2.8, z + 0.15))}
              className="p-1 text-slate-300 hover:bg-slate-600"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPanX(0);
                setPanY(0);
              }}
              className="p-1 text-slate-300 hover:bg-slate-600 border-l border-slate-600"
              title="Reset View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {onToggleFullWidth && (
            <button
              onClick={onToggleFullWidth}
              className={`px-2 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 transition ${
                isFullWidth
                  ? 'bg-cyan-600 text-white border-cyan-500'
                  : 'bg-slate-700 text-slate-200 border-slate-600 hover:bg-slate-600'
              }`}
              title={isFullWidth ? 'Standard Boxed Width' : 'Expand to 100% Full Width'}
            >
              {isFullWidth ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline text-[11px]">{isFullWidth ? 'Boxed' : 'Full Width'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 3D Canvas Area */}
      <div
        className="relative w-full overflow-hidden select-none cursor-grab active:cursor-grabbing flex items-center justify-center"
        style={{
          backgroundColor: styleConfig.bg,
          minHeight: '560px',
          height: isFullWidth ? '720px' : '620px',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Floating Instructions Badge */}
        <div className="absolute top-3 left-3 z-10 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-2.5 shadow-lg pointer-events-none">
          <Compass className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '10s' }} />
          <span>Click & Drag to Orbit • Shift+Drag to Pan • Scroll to Zoom</span>
        </div>

        {/* Selected Module Info Floating Card */}
        {selectedItem && (
          <div className="absolute top-3 right-3 z-10 bg-slate-900/95 backdrop-blur-md p-4 rounded-xl border-2 border-amber-500/60 shadow-2xl text-sm text-white max-w-sm space-y-2">
            <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-2">
              <span className="font-bold text-amber-400 text-sm">
                #{selectedItem.sNo} {selectedItem.description}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                {selectedItem.room}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono text-slate-200 pt-1">
              <div className="bg-slate-800/80 p-1.5 rounded text-center">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Width</span>
                <strong className="text-white text-xs">{selectedItem.widthMm} mm</strong>
              </div>
              <div className="bg-slate-800/80 p-1.5 rounded text-center">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Height</span>
                <strong className="text-white text-xs">{selectedItem.heightMm} mm</strong>
              </div>
              <div className="bg-slate-800/80 p-1.5 rounded text-center">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Depth</span>
                <strong className="text-white text-xs">{getTypicalDepth(selectedItem)} mm</strong>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-300 pt-1.5 border-t border-slate-800">
              <span className="font-medium">{selectedItem.coreMaterial}</span>
              <span className="text-emerald-400 font-bold">{selectedItem.finishType}</span>
            </div>
          </div>
        )}

        {/* SVG 3D Isometric View */}
        <svg
          ref={svgContainerRef}
          width="100%"
          height="100%"
          viewBox="-600 -400 1200 800"
          className="w-full h-full"
          style={{ fontFamily: 'ui-monospace, monospace' }}
        >
          <defs>
            {/* Ambient Occlusion radial gradient */}
            <radialGradient id="ao-ground" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Ground Soft Shadow Ellipse */}
          <ellipse cx={panX} cy={panY + 140} rx={360 * zoom} ry={140 * zoom} fill="url(#ao-ground)" />

          {/* RENDER 3D POLYGON FACES (Sorted by painter's algorithm depth) */}
          <g>
            {polygons.map((poly) => {
              const ptsStr = poly.points.map((p) => `${p.u.toFixed(1)},${p.v.toFixed(1)}`).join(' ');

              return (
                <polygon
                  key={poly.id}
                  points={ptsStr}
                  fill={poly.fillColor}
                  fillOpacity={poly.opacity !== undefined ? poly.opacity : 1}
                  stroke={poly.strokeColor}
                  strokeWidth={poly.strokeWidth}
                  strokeDasharray={poly.strokeDash}
                  className={`transition-colors duration-75 ${
                    poly.isClickable ? 'cursor-pointer hover:brightness-110' : ''
                  }`}
                  onClick={(e) => {
                    if (poly.itemId && onSelectItem) {
                      e.stopPropagation();
                      const itm = items.find((i) => i.id === poly.itemId);
                      if (itm) onSelectItem(itm);
                    }
                  }}
                  onMouseEnter={() => {
                    if (poly.itemId) setHoveredItemId(poly.itemId);
                  }}
                  onMouseLeave={() => {
                    if (poly.itemId) setHoveredItemId(null);
                  }}
                >
                  {poly.partName && <title>{poly.partName}</title>}
                </polygon>
              );
            })}
          </g>

          {/* 3D MODULE FLOATING TAGS */}
          {showModuleTags && (
            <g className="pointer-events-none">
              {layout3D.modules.map((box) => {
                const tagPoint = projectPoint({
                  x: box.x + box.w / 2,
                  y: box.y + box.h + 50,
                  z: box.z + box.d / 2,
                });
                const isSelected = selectedItemId === box.item.id;
                const isHovered = hoveredItemId === box.item.id;
                const tagW = Math.max(90, 80 * fontScale);
                const tagH = 24 * fontScale;

                return (
                  <g key={`module-tag-${box.item.id}`}>
                    <rect
                      x={tagPoint.u - tagW / 2}
                      y={tagPoint.v - tagH / 2}
                      width={tagW}
                      height={tagH}
                      rx={5 * fontScale}
                      fill={isSelected ? '#d97706' : isHovered ? '#0284c7' : '#090d16'}
                      fillOpacity="0.92"
                      stroke={isSelected ? '#fde68a' : isHovered ? '#7dd3fc' : '#475569'}
                      strokeWidth={isSelected || isHovered ? 1.8 : 1}
                    />
                    <text
                      x={tagPoint.u}
                      y={tagPoint.v + 4 * fontScale}
                      textAnchor="middle"
                      fontSize={Math.round(11 * fontScale)}
                      fontWeight="bold"
                      fill="#ffffff"
                    >
                      #{box.item.sNo} {box.w}×{box.h}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* 3D DIMENSION CALLOUTS */}
          {dimensionCallouts.map((dim) => {
            const tagW = Math.max(70, 60 * fontScale);
            const tagH = 22 * fontScale;
            return (
              <g key={dim.id} className="pointer-events-none">
                {/* Leader Line */}
                <line
                  x1={dim.p1.u}
                  y1={dim.p1.v}
                  x2={dim.p2.u}
                  y2={dim.p2.v}
                  stroke={dim.color}
                  strokeWidth={1.8 * fontScale}
                  strokeDasharray="4 4"
                />
                {/* End Ticks */}
                <circle cx={dim.p1.u} cy={dim.p1.v} r={3.5 * fontScale} fill={dim.color} />
                <circle cx={dim.p2.u} cy={dim.p2.v} r={3.5 * fontScale} fill={dim.color} />
                {/* Dimension Label Tag */}
                <rect
                  x={dim.textPos.u - tagW / 2}
                  y={dim.textPos.v - tagH / 2}
                  width={tagW}
                  height={tagH}
                  rx={4 * fontScale}
                  fill="#030712"
                  fillOpacity="0.95"
                  stroke={dim.color}
                  strokeWidth={1.4 * fontScale}
                />
                <text
                  x={dim.textPos.u}
                  y={dim.textPos.v + 4 * fontScale}
                  textAnchor="middle"
                  fontSize={Math.round(13 * fontScale)}
                  fontWeight="bold"
                  fill="#ffffff"
                >
                  {dim.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Bottom Status Bar */}
      <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" />
            Active Extrusion: <strong className="text-slate-800 capitalize">{activeWall}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Modules Extruded: <strong className="text-slate-800">{displayItems.length} cabinets</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            Azimuth: <strong className="text-slate-800">{Math.round(azimuth)}°</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
            Pitch: <strong className="text-slate-800">{Math.round(pitch)}°</strong>
          </span>
        </div>
        <div className="text-slate-500 text-[11px]">
          Hover or click any 3D cabinet module to inspect millimeter cut specifications & hardware.
        </div>
      </div>
    </div>
  );
};
