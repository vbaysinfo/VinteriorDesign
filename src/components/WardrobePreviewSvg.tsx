import React, { forwardRef } from 'react';
import { WardrobeDesign } from '../utils/wardrobeVisualizer';
import { ftToMm, getAutoClosetLayout, CLOSET_DIVIDER_THICKNESS_MM } from '../utils/calculator';

interface WardrobePreviewSvgProps {
  design: WardrobeDesign;
  widthPx?: number;
  // "Doors open" view - ghosts the shutters out to the side/top and fills
  // the cabinet with the same auto-generated closet interior (shelves, rod,
  // drawers) the Closet Interior Design editor would start from for this
  // width/height. Purely a view toggle, never persisted on the design or
  // the cut list - the real interior is still whatever the item's own
  // Closet Interior Design editor has (or its own auto-layout) once/if this
  // design is added to the project.
  showInterior?: boolean;
}

const GHOST = 14; // px width/height of a "door pushed open" ghost strip
const GHOST_GAP = 6;

// A customer-facing "product visualization" render of a wardrobe design -
// deliberately richer-looking than the technical black/white Print CAD
// elevation (PrintableCadLayout.tsx), since this is what a customer actually
// picks colors/styles/handles against and sees update live. It never touches
// cut-list math: shutterStyle/textureStyle/handleStyle are purely cosmetic,
// same contract as everywhere else those fields are read.
export const WardrobePreviewSvg = forwardRef<SVGSVGElement, WardrobePreviewSvgProps>(({ design, widthPx = 360, showInterior = false }, ref) => {
  const {
    widthFt,
    heightFt,
    shutterCount,
    doorType,
    shutterStyle,
    textureStyle,
    handleStyle,
    primaryColor,
    secondaryColor,
    customTextureUrl,
  } = design;

  const isSliding = doorType === 'sliding';
  const isLiftTop = doorType === 'lift_top';
  const isArch = shutterStyle === 'arch';
  const isTwoColor = shutterStyle === 'two_color';
  const isMirror = shutterStyle === 'mirror';
  const isGlass = shutterStyle === 'glass_profile';
  const isFluted = shutterStyle === 'fluted';
  const isFramed = shutterStyle === 'framed';
  const isShaker = shutterStyle === 'shaker';

  const aspect = heightFt / Math.max(0.5, widthFt);
  const baseW = widthPx;
  const baseH = Math.max(220, Math.min(560, baseW * aspect));
  const margin = 24;
  const cabW = baseW - margin * 2;
  const cabH = baseH - margin * 2;

  const extraTop = showInterior && isLiftTop ? GHOST + GHOST_GAP : 0;
  const extraRight = showInterior && (isSliding || !isLiftTop) ? GHOST + GHOST_GAP : 0;
  const extraLeft = showInterior && !isSliding && !isLiftTop ? GHOST + GHOST_GAP : 0;

  const boxW = baseW + extraLeft + extraRight;
  const boxH = baseH + extraTop;
  const cabX = margin + extraLeft;
  const cabY = margin + extraTop;

  const gapPx = isSliding ? 0 : 1.5;
  const count = Math.max(1, shutterCount);
  const shutterW = (cabW - gapPx * (count - 1)) / count;

  const shutterFill = customTextureUrl ? 'url(#customTexture)' : isGlass ? 'url(#glassFill)' : isMirror ? 'url(#mirrorFill)' : primaryColor;

  // ---- "Doors open" interior layout (shelves / rod / drawers) ----
  let interiorContent: React.ReactNode = null;
  if (showInterior) {
    const widthMm = ftToMm(widthFt);
    const heightMm = ftToMm(heightFt);
    const innerHeightMm = Math.max(100, heightMm - 2 * CLOSET_DIVIDER_THICKNESS_MM);
    const layout = getAutoClosetLayout(widthMm, heightMm);
    const totalColWidthMm = layout.columns.reduce((s, c) => s + c.widthMm, 0) || 1;

    let accX = cabX;
    interiorContent = (
      <g>
        <rect x={cabX} y={cabY} width={cabW} height={cabH} fill="#fffdf8" />
        {layout.columns.map((col, ci) => {
          const colWpx = (col.widthMm / totalColWidthMm) * cabW;
          const colX = accX;
          accX += colWpx;
          const bounds = [0, ...col.shelvesMm, innerHeightMm];
          const rodSet = new Set(col.rodCompartments);
          const drawerSet = new Set(col.drawerCompartments);

          const compartments = bounds.slice(0, -1).map((top, idx) => {
            const bottom = bounds[idx + 1];
            const topPx = cabY + (top / innerHeightMm) * cabH;
            const botPx = cabY + (bottom / innerHeightMm) * cabH;
            const hPx = botPx - topPx;

            if (rodSet.has(idx)) {
              const midY = topPx + hPx * 0.3;
              return (
                <g key={idx}>
                  <line x1={colX + 6} y1={midY} x2={colX + colWpx - 6} y2={midY} stroke="#64748b" strokeWidth={2} />
                  <circle cx={colX + 6} cy={midY} r={2.5} fill="#64748b" />
                  <circle cx={colX + colWpx - 6} cy={midY} r={2.5} fill="#64748b" />
                </g>
              );
            }
            if (drawerSet.has(idx)) {
              return (
                <g key={idx}>
                  <rect x={colX + 3} y={topPx + 3} width={Math.max(0, colWpx - 6)} height={Math.max(0, hPx - 6)} fill="#fde68a" stroke="#92400e" strokeWidth={1} />
                  <rect x={colX + colWpx / 2 - 10} y={topPx + hPx / 2 - 1.5} width={20} height={3} rx={1.5} fill="#92400e" />
                </g>
              );
            }
            return null;
          });

          const shelfLines = col.shelvesMm.map((sMm, si) => {
            const y = cabY + (sMm / innerHeightMm) * cabH;
            return <line key={si} x1={colX} y1={y} x2={colX + colWpx} y2={y} stroke="#94a3b8" strokeWidth={1.2} />;
          });

          return (
            <g key={col.id}>
              {compartments}
              {shelfLines}
              {ci > 0 && <line x1={colX} y1={cabY} x2={colX} y2={cabY + cabH} stroke="#94a3b8" strokeWidth={1.5} />}
            </g>
          );
        })}
      </g>
    );
  }

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${boxW} ${boxH}`}
      width={boxW}
      height={boxH}
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: '#f8fafc' }}
    >
      <defs>
        {customTextureUrl && (
          <pattern id="customTexture" patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" width="1" height="1">
            <image href={customTextureUrl} x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice" />
          </pattern>
        )}
        <linearGradient id="mirrorFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dbe9f3" />
          <stop offset="45%" stopColor="#f3f8fb" />
          <stop offset="55%" stopColor="#c7dbe8" />
          <stop offset="100%" stopColor="#dbe9f3" />
        </linearGradient>
        <linearGradient id="glassFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bcd4e0" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#8fb3c4" stopOpacity={0.55} />
        </linearGradient>
        <linearGradient id="glossSheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="35%" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="48%" stopColor="#ffffff" stopOpacity={0.35} />
          <stop offset="60%" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
        <pattern id="woodGrain" width="18" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 5 Q 4.5 1 9 5 T 18 5" fill="none" stroke="#000000" strokeOpacity={0.08} strokeWidth={1} />
        </pattern>
        <pattern id="suedeNap" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.5" fill="#000000" fillOpacity={0.1} />
          <circle cx="4.2" cy="3.8" r="0.5" fill="#000000" fillOpacity={0.1} />
        </pattern>
      </defs>

      {/* Carcass frame */}
      <rect x={0} y={0} width={boxW} height={boxH} fill="#f8fafc" />
      <rect x={cabX - 3} y={cabY - 3} width={cabW + 6} height={cabH + 6} rx={3} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1} />

      {showInterior && interiorContent}

      {showInterior && isLiftTop && (
        <rect x={cabX} y={margin} width={cabW} height={GHOST} rx={2} fill={shutterFill} opacity={0.6} stroke="#1f2937" strokeWidth={1} />
      )}
      {showInterior && isSliding && (
        <rect x={cabX + cabW + GHOST_GAP} y={cabY} width={GHOST} height={cabH} fill={shutterFill} opacity={0.6} stroke="#1f2937" strokeWidth={1} />
      )}
      {showInterior && !isSliding && !isLiftTop && (
        <>
          <rect x={margin} y={cabY} width={GHOST} height={cabH} fill={shutterFill} opacity={0.6} stroke="#1f2937" strokeWidth={1} />
          <rect x={cabX + cabW + GHOST_GAP} y={cabY} width={GHOST} height={cabH} fill={shutterFill} opacity={0.6} stroke="#1f2937" strokeWidth={1} />
        </>
      )}

      {!showInterior &&
        Array.from({ length: count }).map((_, i) => {
          const sx = cabX + i * (shutterW + gapPx);
          const isHingeLeft = i % 2 === 0;
          const archDip = Math.min(26, cabH * 0.12);

          const secondaryFill = isTwoColor ? secondaryColor : shutterFill;

          return (
            <g key={i}>
              {/* Base shutter panel */}
              <rect x={sx} y={cabY} width={shutterW} height={cabH} fill={shutterFill} stroke="#1f2937" strokeWidth={1} />

              {/* Two-color split: left portion stays primary, right portion (40%) becomes the accent */}
              {isTwoColor && (
                <rect x={sx + shutterW * 0.58} y={cabY} width={shutterW * 0.42} height={cabH} fill={secondaryFill} stroke="#1f2937" strokeWidth={0.75} />
              )}

              {/* Framed style: raised outer frame around a recessed center panel */}
              {isFramed && (
                <rect
                  x={sx + shutterW * 0.12}
                  y={cabY + cabH * 0.05}
                  width={shutterW * 0.76}
                  height={cabH * 0.9}
                  fill="none"
                  stroke="#1f2937"
                  strokeOpacity={0.55}
                  strokeWidth={2.5}
                />
              )}

              {/* Shaker style: a single, flatter recessed panel line */}
              {isShaker && (
                <rect
                  x={sx + shutterW * 0.08}
                  y={cabY + cabH * 0.035}
                  width={shutterW * 0.84}
                  height={cabH * 0.93}
                  fill="none"
                  stroke="#1f2937"
                  strokeOpacity={0.4}
                  strokeWidth={1.2}
                />
              )}

              {/* Fluted style: repeating vertical grooves */}
              {isFluted &&
                Array.from({ length: Math.max(3, Math.round(shutterW / 14)) }).map((_, g) => {
                  const gx = sx + ((g + 0.5) * shutterW) / Math.max(3, Math.round(shutterW / 14));
                  return <line key={g} x1={gx} y1={cabY + 4} x2={gx} y2={cabY + cabH - 4} stroke="#1f2937" strokeOpacity={0.22} strokeWidth={1} />;
                })}

              {/* Arch style: elliptical arch routed across the top */}
              {isArch && (
                <path
                  d={`M ${sx + 4} ${cabY + archDip} A ${shutterW / 2 - 4} ${archDip} 0 0 1 ${sx + shutterW - 4} ${cabY + archDip}`}
                  fill="none"
                  stroke="#1f2937"
                  strokeOpacity={0.6}
                  strokeWidth={1.4}
                />
              )}

              {/* Lift-top flap line */}
              {isLiftTop && <line x1={sx} y1={cabY} x2={sx + shutterW} y2={cabY} stroke="#1f2937" strokeWidth={2.5} />}

              {/* Texture overlays - purely cosmetic surface finish */}
              {textureStyle === 'gloss' && <rect x={sx} y={cabY} width={shutterW} height={cabH} fill="url(#glossSheen)" />}
              {textureStyle === 'wood_grain' && <rect x={sx} y={cabY} width={shutterW} height={cabH} fill="url(#woodGrain)" />}
              {textureStyle === 'suede' && <rect x={sx} y={cabY} width={shutterW} height={cabH} fill="url(#suedeNap)" />}

              {/* Handle */}
              {handleStyle === 'bar' && !isLiftTop && (
                <rect
                  x={isHingeLeft ? sx + shutterW - 10 : sx + 4}
                  y={cabY + cabH * 0.42}
                  width={4}
                  height={cabH * 0.16}
                  rx={2}
                  fill="#374151"
                />
              )}
              {handleStyle === 'knob' && !isLiftTop && (
                <circle cx={isHingeLeft ? sx + shutterW - 9 : sx + 9} cy={cabY + cabH * 0.5} r={4.5} fill="#374151" />
              )}
              {handleStyle === 'profile' && !isLiftTop && (
                <line
                  x1={isHingeLeft ? sx + shutterW - 3 : sx + 3}
                  y1={cabY + cabH * 0.3}
                  x2={isHingeLeft ? sx + shutterW - 3 : sx + 3}
                  y2={cabY + cabH * 0.7}
                  stroke="#0f172a"
                  strokeOpacity={0.5}
                  strokeWidth={3}
                />
              )}

              {/* Divider between adjacent shutters */}
              {i > 0 && <line x1={sx} y1={cabY} x2={sx} y2={cabY + cabH} stroke="#1f2937" strokeOpacity={0.5} strokeWidth={0.75} />}
            </g>
          );
        })}
    </svg>
  );
});

WardrobePreviewSvg.displayName = 'WardrobePreviewSvg';
