import React, { forwardRef } from 'react';
import { WardrobeDesign } from '../utils/wardrobeVisualizer';

interface WardrobePreviewSvgProps {
  design: WardrobeDesign;
  widthPx?: number;
}

// A customer-facing "product visualization" render of a wardrobe design -
// deliberately richer-looking than the technical black/white Print CAD
// elevation (PrintableCadLayout.tsx), since this is what a customer actually
// picks colors/styles/handles against and sees update live. It never touches
// cut-list math: shutterStyle/textureStyle/handleStyle are purely cosmetic,
// same contract as everywhere else those fields are read.
export const WardrobePreviewSvg = forwardRef<SVGSVGElement, WardrobePreviewSvgProps>(({ design, widthPx = 360 }, ref) => {
  const { widthFt, heightFt, shutterCount, doorType, shutterStyle, textureStyle, handleStyle, primaryColor, secondaryColor } = design;

  const aspect = heightFt / Math.max(0.5, widthFt);
  const boxW = widthPx;
  const boxH = Math.max(220, Math.min(560, boxW * aspect));
  const margin = 24;
  const cabW = boxW - margin * 2;
  const cabH = boxH - margin * 2;
  const cabX = margin;
  const cabY = margin;

  const isSliding = doorType === 'sliding';
  const isLiftTop = doorType === 'lift_top';
  const isArch = shutterStyle === 'arch';
  const isTwoColor = shutterStyle === 'two_color';
  const isMirror = shutterStyle === 'mirror';
  const isGlass = shutterStyle === 'glass_profile';
  const isFluted = shutterStyle === 'fluted';
  const isFramed = shutterStyle === 'framed';
  const isShaker = shutterStyle === 'shaker';

  const gapPx = isSliding ? 0 : 1.5;
  const count = Math.max(1, shutterCount);
  const shutterW = (cabW - gapPx * (count - 1)) / count;

  const shutterFill = isGlass ? 'url(#glassFill)' : isMirror ? 'url(#mirrorFill)' : primaryColor;

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

      {Array.from({ length: count }).map((_, i) => {
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
