import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { ArtSettings } from '../types';
import { fbm } from '../utils/noise';

interface ArtCanvasProps {
  settings: ArtSettings;
  onClearDisplacement?: () => void;
}

export interface ArtCanvasRef {
  exportHighRes: (resolutionMultiplier: number, aspect?: '1:1' | '4:5') => string;
  resetGrid: () => void;
}

interface GridPoint {
  x0: number; // Base x
  y0: number; // Base y
  x: number;  // Current actual x
  y: number;  // Current actual y
  vx: number; // Velocity x
  vy: number; // Velocity y
  persistDx: number; // Permanent sculpting displacement
  persistDy: number; // Permanent sculpting displacement
}

export const ArtCanvas = forwardRef<ArtCanvasRef, ArtCanvasProps>(({ settings, onClearDisplacement }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const pointsRef = useRef<GridPoint[][]>([]);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);
  const animationFrameIdRef = useRef<number | null>(null);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    exportHighRes: (multiplier: number, aspect?: '1:1' | '4:5') => {
      return renderHighRes(multiplier, aspect);
    },
    resetGrid: () => {
      initializeGrid(dimensions.width, dimensions.height);
    }
  }));

  // Watch for container resizes using ResizeObserver as requested
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      
      // Keep canvas square or bounded nicely
      const size = Math.max(280, Math.min(width, height, 800));
      setDimensions({ width: size, height: size });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Initialize or re-create grid when dimensions or structural settings change
  const initializeGrid = (width: number, height: number) => {
    const { cols, rows } = settings;
    const padding = 40; // canvas padding
    const gridW = width - padding * 2;
    const gridH = height - padding * 2;
    
    const colStep = cols > 1 ? gridW / (cols - 1) : gridW;
    const rowStep = rows > 1 ? gridH / (rows - 1) : gridH;

    const points: GridPoint[][] = [];
    for (let c = 0; c < cols; c++) {
      points[c] = [];
      for (let r = 0; r < rows; r++) {
        const x0 = padding + c * colStep;
        const y0 = padding + r * rowStep;
        
        points[c][r] = {
          x0,
          y0,
          x: x0,
          y: y0,
          vx: 0,
          vy: 0,
          persistDx: 0,
          persistDy: 0,
        };
      }
    }
    pointsRef.current = points;
  };

  // Re-initialize grid when structural parameters change
  useEffect(() => {
    initializeGrid(dimensions.width, dimensions.height);
  }, [dimensions, settings.cols, settings.rows]);

  // Clean-up animation on unmount
  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  // Sharp triangular folding wave for origami crease styling
  const triWave = (val: number): number => {
    return Math.abs((val % 1) - 0.5) * 4 - 1;
  };

  // Animation & Rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      if (settings.animate) {
        timeRef.current += 0.01 * settings.animationSpeed;
      }

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // 1. Draw Background
      const isDark = settings.darkTheme;
      const isColorInverted = settings.colorInverted;
      
      // Determine final background & stroke colors
      let bgColor = isDark ? '#0A0A0A' : '#FAF9F6';
      let strokeColor = isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(18, 18, 18, 0.85)';
      let pointColor = isDark ? 'rgba(255, 255, 255, 0.95)' : 'rgba(18, 18, 18, 0.95)';

      if (isColorInverted) {
        const tempBg = bgColor;
        bgColor = strokeColor.startsWith('rgba(18') ? '#0A0A0A' : '#FAF9F6';
        strokeColor = tempBg === '#0A0A0A' ? 'rgba(18, 18, 18, 0.85)' : 'rgba(255, 255, 255, 0.85)';
        pointColor = strokeColor;
      }

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Draw subtle noise grain/paper texture if enabled
      if (settings.paperTexture) {
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.02)';
        for (let i = 0; i < dimensions.width; i += 3) {
          for (let j = 0; j < dimensions.height; j += 3) {
            if (Math.random() > 0.5) {
              ctx.fillRect(i, j, 1.5, 1.5);
            }
          }
        }
      }

      const points = pointsRef.current;
      const { cols, rows, distortionType, amplitude, frequency, edgeFalloff, interactionMode, interactionRadius, interactionStrength, persistDisplacement, elasticity } = settings;

      if (points.length === 0 || points.length !== cols || points[0].length !== rows) {
        initializeGrid(dimensions.width, dimensions.height);
        animationFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      const mouseX = mousePosRef.current.x;
      const mouseY = mousePosRef.current.y;
      const lastMouseX = lastMousePosRef.current.x;
      const lastMouseY = lastMousePosRef.current.y;
      
      const mouseSpeedX = mouseX - lastMouseX;
      const mouseSpeedY = mouseY - lastMouseY;

      // Update positions with physics & distortions
      for (let c = 0; c < cols; c++) {
        const colRatio = cols > 1 ? c / (cols - 1) : 0.5;
        
        for (let r = 0; r < rows; r++) {
          const rowRatio = rows > 1 ? r / (rows - 1) : 0.5;
          const p = points[c][r];

          // Calculate Border Anchor/Falloff factor (0 = fixed edge, 1 = maximum warp)
          const distToLeft = colRatio;
          const distToRight = 1 - colRatio;
          const distToTop = rowRatio;
          const distToBottom = 1 - rowRatio;
          
          const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
          
          // boundary scaling: if edgeFalloff is high, the margin anchoring is super tight
          let boundaryFactor = 1;
          if (edgeFalloff > 0) {
            boundaryFactor = Math.min(1, minDist / (0.25 * edgeFalloff));
            // smooth boundary factor transitions
            boundaryFactor = Math.sin(boundaryFactor * Math.PI / 2); 
          }

          // 2. Algorithmic Distortions (sine, noise, fold, mixed)
          let waveDx = 0;
          let waveDy = 0;

          if (amplitude > 0) {
            const time = timeRef.current;
            const fx = p.x0 * frequency * 0.1;
            const fy = p.y0 * frequency * 0.1;

            switch (distortionType) {
              case 'sine':
                waveDx = Math.sin(fy * 15 + time) * amplitude;
                waveDy = Math.cos(fx * 15 + time) * amplitude;
                break;
              case 'noise':
                waveDx = fbm(fx * 8, fy * 8 + time * 0.2, 3) * amplitude * 1.5;
                waveDy = fbm(fx * 8 + 4.5, fy * 8 + time * 0.2 + 3.2, 3) * amplitude * 1.5;
                break;
              case 'fold':
                waveDx = triWave(fy * 6 + time * 0.15) * amplitude;
                waveDy = triWave(fx * 6 - time * 0.15) * amplitude;
                break;
              case 'vortex': {
                const cx = dimensions.width / 2;
                const cy = dimensions.height / 2;
                const dx = p.x0 - cx;
                const dy = p.y0 - cy;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const angle = Math.atan2(dy, dx) + Math.sin(dist * frequency * 0.15 + time) * (amplitude / 100);
                waveDx = cx + Math.cos(angle) * dist - p.x0;
                waveDy = cy + Math.sin(angle) * dist - p.y0;
                break;
              }
              case 'mixed':
                const sX = Math.sin(fy * 12 + time) * amplitude * 0.5;
                const sY = Math.cos(fx * 12 + time) * amplitude * 0.5;
                const nX = fbm(fx * 10, fy * 10 + time * 0.1, 2) * amplitude;
                const nY = fbm(fx * 10 + 2, fy * 10 + time * 0.1 + 2, 2) * amplitude;
                waveDx = sX + nX;
                waveDy = sY + nY;
                break;
            }
          }

          // Apply boundary anchors to structural distortions
          waveDx *= boundaryFactor;
          waveDy *= boundaryFactor;

          // 3. Mouse Interaction (smudge, repel, attract, vortex)
          let mouseDx = 0;
          let mouseDy = 0;

          if (interactionMode !== 'none' && interactionRadius > 0 && interactionStrength > 0) {
            // we calculate distance from the current point to mouse
            const dx = p.x - mouseX;
            const dy = p.y - mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            if (dist < interactionRadius) {
              // Mouse force falloff (strongest at center, 0 at edge of circle)
              const force = (1 - dist / interactionRadius) * interactionStrength * boundaryFactor;
              
              if (interactionMode === 'repel') {
                // Push away
                mouseDx = (dx / dist) * force * 50;
                mouseDy = (dy / dist) * force * 50;
              } else if (interactionMode === 'attract') {
                // Pull close
                mouseDx = -(dx / dist) * force * 50;
                mouseDy = -(dy / dist) * force * 50;
              } else if (interactionMode === 'vortex') {
                // Twist around
                const angle = Math.PI / 2; // perpendicular
                // Spiral twist vector
                const tx = -dy / dist;
                const ty = dx / dist;
                mouseDx = tx * force * 55;
                mouseDy = ty * force * 55;
              } else if (interactionMode === 'smudge' && isDraggingRef.current) {
                // Push in mouse movement direction
                const mSpeed = Math.sqrt(mouseSpeedX * mouseSpeedX + mouseSpeedY * mouseSpeedY);
                if (mSpeed > 0.1) {
                  mouseDx = mouseSpeedX * force * 2.5;
                  mouseDy = mouseSpeedY * force * 2.5;
                }
              }

              // Apply directly to persistent offset if using smudge or click-sculpt
              if (persistDisplacement && isDraggingRef.current) {
                p.persistDx += mouseDx * 0.1;
                p.persistDy += mouseDy * 0.1;
                // clamp permanent displacements to avoid points flying off screen
                const maxDisp = 200;
                p.persistDx = Math.max(-maxDisp, Math.min(maxDisp, p.persistDx));
                p.persistDy = Math.max(-maxDisp, Math.min(maxDisp, p.persistDy));
              }
            }
          }

          // 4. Elastic physical return & spring updates
          const targetX = p.x0 + waveDx + p.persistDx + (persistDisplacement ? 0 : mouseDx);
          const targetY = p.y0 + waveDy + p.persistDy + (persistDisplacement ? 0 : mouseDy);

          // Spring simulation: p.x moves towards targetX
          const diffX = targetX - p.x;
          const diffY = targetY - p.y;

          // Apply elastic factor
          const k = elasticity; // spring stiffness constant
          const damping = 0.82; // energy dissipation to avoid infinite wobble

          p.vx = (p.vx + diffX * k) * damping;
          p.vy = (p.vy + diffY * k) * damping;

          p.x += p.vx;
          p.y += p.vy;

          // If persistent mode is disabled but points still have permanent offsets, gradually decay them
          if (!persistDisplacement && (p.persistDx !== 0 || p.persistDy !== 0)) {
            p.persistDx *= 0.95;
            p.persistDy *= 0.95;
            if (Math.abs(p.persistDx) < 0.05) p.persistDx = 0;
            if (Math.abs(p.persistDy) < 0.05) p.persistDy = 0;
          }
        }
      }

      // 5. Draw lines with high performance paths
      ctx.lineWidth = settings.strokeWidth;
      ctx.strokeStyle = strokeColor;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Horizontal lines
      if (settings.showHorizontalLines) {
        for (let r = 0; r < rows; r++) {
          ctx.beginPath();
          ctx.moveTo(points[0][r].x, points[0][r].y);
          for (let c = 1; c < cols; c++) {
            ctx.lineTo(points[c][r].x, points[c][r].y);
          }
          ctx.stroke();
        }
      }

      // Vertical lines
      if (settings.showVerticalLines) {
        for (let c = 0; c < cols; c++) {
          ctx.beginPath();
          ctx.moveTo(points[c][0].x, points[c][0].y);
          for (let r = 1; r < rows; r++) {
            ctx.lineTo(points[c][r].x, points[c][r].y);
          }
          ctx.stroke();
        }
      }

      // Diagonal lines (triangular mesh looks beautiful)
      if (settings.diagonalLines !== 'none') {
        ctx.beginPath();
        for (let c = 0; c < cols - 1; c++) {
          for (let r = 0; r < rows - 1; r++) {
            const pTL = points[c][r];
            const pTR = points[c + 1][r];
            const pBL = points[c][r + 1];
            const pBR = points[c + 1][r + 1];

            if (settings.diagonalLines === 'left' || settings.diagonalLines === 'both') {
              ctx.moveTo(pTL.x, pTL.y);
              ctx.lineTo(pBR.x, pBR.y);
            }
            if (settings.diagonalLines === 'right' || settings.diagonalLines === 'both') {
              ctx.moveTo(pTR.x, pTR.y);
              ctx.lineTo(pBL.x, pBL.y);
            }
          }
        }
        ctx.stroke();
      }

      // Draw connection intersections as points/nodes
      if (settings.showPoints && settings.pointSize > 0) {
        ctx.fillStyle = pointColor;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            ctx.beginPath();
            ctx.arc(points[c][r].x, points[c][r].y, settings.pointSize, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Minimalist sappy.error signature in bottom-right corner
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(18, 18, 18, 0.4)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('sappy.error', dimensions.width - 15, dimensions.height - 15);

      // Rotate last mouse positions to measure drag speed vectors
      lastMousePosRef.current = { ...mousePosRef.current };

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [settings, dimensions]);

  // Handle Mouse Events for interaction
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Account for styling dimensions vs canvas coordinates
    const canvasWidth = canvasRef.current?.width || dimensions.width;
    const scaleX = dimensions.width / rect.width;
    const scaleY = dimensions.height / rect.height;

    const scaledX = x * scaleX;
    const scaledY = y * scaleY;

    mousePosRef.current = { x: scaledX, y: scaledY };
    lastMousePosRef.current = { x: scaledX, y: scaledY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const scaleX = dimensions.width / rect.width;
    const scaleY = dimensions.height / rect.height;

    mousePosRef.current = { x: x * scaleX, y: y * scaleY };
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  // Touch handlers for responsive tablets / mobile devices
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    if (e.touches.length === 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;

    const scaleX = dimensions.width / rect.width;
    const scaleY = dimensions.height / rect.height;

    const scaledX = x * scaleX;
    const scaledY = y * scaleY;

    mousePosRef.current = { x: scaledX, y: scaledY };
    lastMousePosRef.current = { x: scaledX, y: scaledY };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;

    const scaleX = dimensions.width / rect.width;
    const scaleY = dimensions.height / rect.height;

    mousePosRef.current = { x: x * scaleX, y: y * scaleY };
  };

  // Render High-Resolution static version for crispy, perfect exports
  const renderHighRes = (multiplier: number, aspect: '1:1' | '4:5' = '1:1'): string => {
    const targetW = dimensions.width * multiplier;
    let targetH = dimensions.height * multiplier;
    let offsetY = 0;

    if (aspect === '4:5') {
      targetH = targetW * 1.25;
      offsetY = (targetH - targetW) / 2;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetW;
    tempCanvas.height = targetH;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return '';

    const isDark = settings.darkTheme;
    const isColorInverted = settings.colorInverted;
    
    let bgColor = isDark ? '#0A0A0A' : '#FAF9F6';
    let strokeColor = isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(18, 18, 18, 0.9)';
    let pointColor = isDark ? 'rgba(255, 255, 255, 0.95)' : 'rgba(18, 18, 18, 0.95)';

    if (isColorInverted) {
      const tempBg = bgColor;
      bgColor = strokeColor.startsWith('rgba(18') ? '#0A0A0A' : '#FAF9F6';
      strokeColor = tempBg === '#0A0A0A' ? 'rgba(18, 18, 18, 0.9)' : 'rgba(255, 255, 255, 0.9)';
      pointColor = strokeColor;
    }

    tempCtx.fillStyle = bgColor;
    tempCtx.fillRect(0, 0, targetW, targetH);

    // Subtle paper noise grain at high resolution over the whole canvas
    if (settings.paperTexture) {
      tempCtx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.025)';
      for (let i = 0; i < targetW; i += Math.max(3, multiplier)) {
        for (let j = 0; j < targetH; j += Math.max(3, multiplier)) {
          if (Math.random() > 0.5) {
            tempCtx.fillRect(i, j, multiplier * 0.7, multiplier * 0.7);
          }
        }
      }
    }

    const points = pointsRef.current;
    const { cols, rows } = settings;

    // Line styles scaled up proportionally
    tempCtx.lineWidth = settings.strokeWidth * multiplier;
    tempCtx.strokeStyle = strokeColor;
    tempCtx.lineCap = 'round';
    tempCtx.lineJoin = 'round';

    // Helper to scale points and apply centering offset for taller aspect ratios
    const getP = (c: number, r: number) => {
      const p = points[c][r];
      return {
        x: p.x * multiplier,
        y: p.y * multiplier + offsetY
      };
    };

    // Horizontal
    if (settings.showHorizontalLines) {
      for (let r = 0; r < rows; r++) {
        tempCtx.beginPath();
        const start = getP(0, r);
        tempCtx.moveTo(start.x, start.y);
        for (let c = 1; c < cols; c++) {
          const pt = getP(c, r);
          tempCtx.lineTo(pt.x, pt.y);
        }
        tempCtx.stroke();
      }
    }

    // Vertical
    if (settings.showVerticalLines) {
      for (let c = 0; c < cols; c++) {
        tempCtx.beginPath();
        const start = getP(c, 0);
        tempCtx.moveTo(start.x, start.y);
        for (let r = 1; r < rows; r++) {
          const pt = getP(c, r);
          tempCtx.lineTo(pt.x, pt.y);
        }
        tempCtx.stroke();
      }
    }

    // Diagonals
    if (settings.diagonalLines !== 'none') {
      tempCtx.beginPath();
      for (let c = 0; c < cols - 1; c++) {
        for (let r = 0; r < rows - 1; r++) {
          const pTL = getP(c, r);
          const pTR = getP(c + 1, r);
          const pBL = getP(c, r + 1);
          const pBR = getP(c + 1, r + 1);

          if (settings.diagonalLines === 'left' || settings.diagonalLines === 'both') {
            tempCtx.moveTo(pTL.x, pTL.y);
            tempCtx.lineTo(pBR.x, pBR.y);
          }
          if (settings.diagonalLines === 'right' || settings.diagonalLines === 'both') {
            tempCtx.moveTo(pTR.x, pTR.y);
            tempCtx.lineTo(pBL.x, pBL.y);
          }
        }
      }
      tempCtx.stroke();
    }

    // Points
    if (settings.showPoints && settings.pointSize > 0) {
      tempCtx.fillStyle = pointColor;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const pt = getP(c, r);
          tempCtx.beginPath();
          tempCtx.arc(pt.x, pt.y, settings.pointSize * multiplier, 0, Math.PI * 2);
          tempCtx.fill();
        }
      }
    }

    // Draw minimalist signature "sappy.error" in bottom-right corner
    const sigText = 'sappy.error';
    tempCtx.font = `600 ${Math.max(12, multiplier * 11)}px "JetBrains Mono", monospace`;
    tempCtx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(18, 18, 18, 0.45)';
    tempCtx.textAlign = 'right';
    tempCtx.textBaseline = 'bottom';
    
    const margin = Math.max(15, multiplier * 20);
    tempCtx.fillText(sigText, targetW - margin, targetH - margin);

    return tempCanvas.toDataURL('image/png');
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full flex items-center justify-center p-4 bg-transparent aspect-square max-h-[80vh]"
    >
      <div 
        className={`relative overflow-hidden rounded-2xl shadow-2xl border transition-all duration-300 ${
          settings.darkTheme 
            ? 'border-white/10 bg-[#0c0c0d] shadow-black/80' 
            : 'border-neutral-200/50 bg-[#fafafa] shadow-neutral-200/30'
        }`}
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        <canvas
          id="generative-art-canvas"
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUpOrLeave}
          className="absolute inset-0 cursor-crosshair touch-none select-none block"
        />
        
        {/* Subtle decorative guide label */}
        <div className={`absolute bottom-4 left-4 font-mono text-[10px] tracking-widest pointer-events-none select-none transition-opacity duration-300 ${
          settings.darkTheme ? 'text-white/20' : 'text-neutral-400'
        }`}>
          GRID ART ENGINE · CLICK & DRAG
        </div>
      </div>
    </div>
  );
});

ArtCanvas.displayName = 'ArtCanvas';
