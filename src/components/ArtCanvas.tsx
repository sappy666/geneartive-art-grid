import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { ArtSettings } from '../types';
import { fbm } from '../utils/noise';

interface ArtCanvasProps {
  settings: ArtSettings;
  onClearDisplacement?: () => void;
  aspectRatio?: '1:1' | '4:5';
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

export const ArtCanvas = forwardRef<ArtCanvasRef, ArtCanvasProps>(({ settings, onClearDisplacement, aspectRatio = '1:1' }, ref) => {
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
    },
    getCanvas: () => {
      return canvasRef.current;
    }
  }));

  // Watch for container resizes using ResizeObserver as requested
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      
      // Keep canvas square or bounded nicely based on selected aspect ratio
      const size = Math.max(280, Math.min(width, 800));
      const h = aspectRatio === '4:5' ? size * 1.25 : size;
      setDimensions({ width: size, height: h });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [aspectRatio]);

  // Adjust immediately when aspectRatio prop changes
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const size = Math.max(280, Math.min(width, 800));
    const h = aspectRatio === '4:5' ? size * 1.25 : size;
    setDimensions({ width: size, height: h });
  }, [aspectRatio]);

  // Initialize or re-create grid when dimensions or structural settings change
  const initializeGrid = (width: number, height: number) => {
    const { cols, rows } = settings;
    const padding = 40; // canvas padding
    const gridW = width - padding * 2;
    const gridH = width - padding * 2; // Always keep grid square based on width!
    
    const colStep = cols > 1 ? gridW / (cols - 1) : gridW;
    const rowStep = rows > 1 ? gridH / (rows - 1) : gridH;

    const offsetY = (height - width) / 2; // Center the square grid vertically inside the 4:5 rectangle

    const points: GridPoint[][] = [];
    for (let c = 0; c < cols; c++) {
      points[c] = [];
      for (let r = 0; r < rows; r++) {
        const x0 = padding + c * colStep;
        const y0 = padding + r * rowStep + offsetY;
        
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
              case 'neural': {
                const cx = dimensions.width / 2;
                const cy = dimensions.height / 2;
                const dist1 = Math.sqrt((p.x0 - cx * 0.6) ** 2 + (p.y0 - cy * 0.8) ** 2) || 1;
                const dist2 = Math.sqrt((p.x0 - cx * 1.4) ** 2 + (p.y0 - cy * 1.2) ** 2) || 1;
                waveDx = (Math.sin(dist1 * frequency * 0.25 - time * 2) / (1 + dist1 * 0.003) + Math.cos(dist2 * frequency * 0.35 + time) / (1 + dist2 * 0.003)) * amplitude * 1.3;
                waveDy = (Math.cos(dist1 * frequency * 0.25 - time * 1.5) / (1 + dist1 * 0.003) + Math.sin(dist2 * frequency * 0.45 - time) / (1 + dist2 * 0.003)) * amplitude * 1.3;
                break;
              }
              case 'bird': {
                const flightPath = Math.sin(p.x0 * frequency * 0.05 + time * 1.5);
                const wingFlap = Math.sin(time * 4 + p.x0 * 0.08) * Math.cos(p.y0 * 0.08);
                waveDx = (flightPath * 0.6 + wingFlap * 0.4) * amplitude * 1.4;
                waveDy = (Math.cos(p.x0 * frequency * 0.05 + time * 1.2) * 0.6 + Math.sin(time * 4.5 + p.y0 * 0.1) * 0.4) * amplitude * 1.4;
                break;
              }
              case 'escher_stairs': {
                // Step-like transformation creating interlocking stair grids reminiscent of M.C. Escher
                waveDx = (Math.floor(fx * 5 + fy * 5) % 2 === 0 ? amplitude : -amplitude) * 0.4 + Math.sin(fy * 10 + time) * amplitude * 0.2;
                waveDy = (Math.floor(fx * 5 - fy * 5) % 2 === 0 ? amplitude : -amplitude) * 0.4 + Math.cos(fx * 10 + time) * amplitude * 0.2;
                waveDx = Math.round(waveDx / 5) * 5;
                waveDy = Math.round(waveDy / 5) * 5;
                break;
              }
              case 'growing_mountains': {
                // Simulate rising and growing mountain range silhouettes
                const peak = Math.exp(-Math.pow((p.x0 / dimensions.width - 0.5) * 2.2, 2) * 2.5); // centered mountain envelope
                const noiseFactor = Math.sin(fx * 3 + time * 0.3) * 0.4 + Math.sin(fx * 8 + time * 1.2) * 0.15;
                // Deform points vertically proportional to distance to create ridges
                waveDy = -peak * amplitude * 3.5 * (1.0 + noiseFactor) * (p.y0 / dimensions.height);
                waveDx = Math.sin(fy * 6 + time) * amplitude * 0.25;
                break;
              }
              case 'cross_stitch': {
                // Force coordinates onto regular quantized diagonal positions to form x-shaped stitches
                const cellX = Math.floor(p.x0 / (dimensions.width / cols));
                const cellY = Math.floor(p.y0 / (dimensions.height / rows));
                const stitchDir = (cellX + cellY) % 2 === 0 ? 1 : -1;
                waveDx = stitchDir * amplitude * 0.6 + Math.sin(time + cellY) * (amplitude * 0.1);
                waveDy = -stitchDir * amplitude * 0.6 + Math.cos(time + cellX) * (amplitude * 0.1);
                break;
              }
              case 'composition_marble': {
                // Domain warped noise that replicates liquid marbled swirls and composition notebook covers
                const qx = fbm(fx * 4 + time * 0.1, fy * 4, 2);
                const qy = fbm(fx * 4 + 1.2, fy * 4 + time * 0.1 + 2.4, 2);
                const rx = fbm(fx * 4 + qx * 3.5 + time * 0.05, fy * 4 + qy * 3.5, 3);
                const ry = fbm(fx * 4 + qx * 3.5 + 2.0, fy * 4 + qy * 3.5 + time * 0.05 + 1.5, 3);
                waveDx = rx * amplitude * 1.8;
                waveDy = ry * amplitude * 1.8;
                break;
              }
              case 'wind_currents': {
                const windSpeed = time * 2.0;
                const eddy = Math.sin(p.x0 * frequency * 0.05 - windSpeed) * Math.cos(p.y0 * frequency * 0.05 + windSpeed * 0.5);
                waveDx = (1.5 + eddy) * amplitude * 0.7;
                waveDy = Math.sin(p.x0 * frequency * 0.03 + windSpeed) * amplitude * 0.5;
                break;
              }
              case 'river_flow': {
                const flowSpeed = time * 2.5;
                const ripple = Math.sin(p.y0 * frequency * 0.08 - flowSpeed) * Math.cos(p.x0 * frequency * 0.04);
                waveDx = ripple * amplitude * 0.8;
                waveDy = (1.2 + Math.sin(flowSpeed + p.x0 * 0.01)) * amplitude * 0.6;
                break;
              }
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

      // 5. Draw lines/points/text with high performance paths
      ctx.lineWidth = settings.strokeWidth;
      ctx.strokeStyle = strokeColor;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (settings.renderMode === 'lines') {
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
      } else if (settings.renderMode === 'points') {
        // Pure points rendering (clean, modern dots)
        ctx.fillStyle = pointColor;
        const radius = Math.max(2, settings.pointSize);
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            ctx.beginPath();
            ctx.arc(points[c][r].x, points[c][r].y, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (settings.renderMode === 'text') {
        // Generative text typographic rendering
        ctx.fillStyle = strokeColor;
        const fSize = settings.textSize || 12;
        ctx.font = `bold ${fSize}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const txt = settings.customText || 'sappy.error';
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const charIndex = (c + r * cols) % txt.length;
            const char = txt.charAt(charIndex);
            ctx.fillText(char, points[c][r].x, points[c][r].y);
          }
        }
      } else if (settings.renderMode === 'ascii') {
        // High-tech ASCII code/matrix rendering
        ctx.fillStyle = strokeColor;
        const fSize = settings.textSize || 10;
        ctx.font = `500 ${fSize}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const asciiSymbols = ['0', '1', '[', ']', '{', '}', ';', '=>', '+', '-', '*', '/', '%', '#', '$', '@', '&', '!', '?', '<', '>', '~'];
        const asciiWords = ['sap', 'err', 'grid', 'var', 'let', 'set', 'get', 'run', 'val', 'nil', 'map', 'vec', 'sin', 'cos', 'dx', 'dy'];

        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const p = points[c][r];
            const dx = p.x - p.x0;
            const dy = p.y - p.y0;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            const index = (c * 7 + r * 13) % (asciiSymbols.length + asciiWords.length);
            let char = '';
            if (index < asciiSymbols.length) {
              char = asciiSymbols[index];
            } else {
              char = asciiWords[index - asciiSymbols.length];
            }

            if (dist > 15 && (c + r) % 2 === 0) {
              char = '1';
            } else if (dist > 30) {
              char = '0';
            }

            if (dist > 2) {
              ctx.save();
              ctx.translate(p.x, p.y);
              ctx.rotate(Math.atan2(dy, dx));
              ctx.fillText(char, 0, 0);
              ctx.restore();
            } else {
              ctx.fillText(char, p.x, p.y);
            }
          }
        }
      } else if (settings.renderMode === 'cad-people') {
        // Vector AutoCAD-style plan architectural human figures
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const p = points[c][r];
            const dx = p.x - p.x0;
            const dy = p.y - p.y0;
            let angle = Math.atan2(dy, dx);
            if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
              angle = ((c * 17 + r * 23) % 360) * Math.PI / 180;
            }

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(angle);
            ctx.lineWidth = Math.max(1, settings.strokeWidth * 0.85);
            ctx.strokeStyle = strokeColor;
            ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(18, 18, 18, 0.03)';

            const baseSize = Math.max(10, settings.pointSize * 2.4);
            const variant = (c + r) % 3;

            if (variant === 0) {
              // Variant A: Standing standard CAD plan figure
              // Torso
              ctx.beginPath();
              ctx.ellipse(0, 0, baseSize * 0.9, baseSize * 0.45, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              // Head
              ctx.beginPath();
              ctx.arc(0, 0, baseSize * 0.28, 0, Math.PI * 2);
              ctx.fillStyle = isDark ? '#1a1a1a' : '#ffffff';
              ctx.fill();
              ctx.stroke();
            } else if (variant === 1) {
              // Variant B: Walking plan figure (skewed shoulders, holding small dynamic item)
              ctx.beginPath();
              ctx.ellipse(0, 0, baseSize * 0.95, baseSize * 0.4, 0.15, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              // Head
              ctx.beginPath();
              ctx.arc(baseSize * 0.08, 0, baseSize * 0.26, 0, Math.PI * 2);
              ctx.fillStyle = isDark ? '#1a1a1a' : '#ffffff';
              ctx.fill();
              ctx.stroke();
              // Arm attachment / shoulder line
              ctx.beginPath();
              ctx.arc(-baseSize * 0.6, baseSize * 0.25, baseSize * 0.1, 0, Math.PI * 2);
              ctx.stroke();
            } else {
              // Variant C: Figure with backpack / hat
              // Backpack
              ctx.beginPath();
              ctx.rect(-baseSize * 0.5, -baseSize * 0.35, baseSize * 0.4, baseSize * 0.7);
              ctx.fill();
              ctx.stroke();
              // Shoulders
              ctx.beginPath();
              ctx.ellipse(0, 0, baseSize * 0.85, baseSize * 0.42, 0, 0, Math.PI * 2);
              ctx.stroke();
              // Head / Hat
              ctx.beginPath();
              ctx.arc(baseSize * 0.05, 0, baseSize * 0.3, 0, Math.PI * 2);
              ctx.fillStyle = isDark ? '#1a1a1a' : '#ffffff';
              ctx.fill();
              ctx.stroke();
            }
            ctx.restore();
          }
        }
      }

      if (settings.includeSignature) {
        // Minimalist sappy.error signature in bottom-right corner
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(18, 18, 18, 0.4)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText('sappy.error', dimensions.width - 15, dimensions.height - 15);
      }

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

    const isPreview45 = (dimensions.height > dimensions.width);
    if (aspect === '4:5' && !isPreview45) {
      targetH = targetW * 1.25;
      offsetY = (targetH - targetW) / 2;
    } else if (aspect === '1:1' && isPreview45) {
      targetH = targetW;
      const previewOffsetY = (dimensions.height - dimensions.width) / 2;
      offsetY = -previewOffsetY * multiplier;
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

    if (settings.renderMode === 'lines') {
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
    } else if (settings.renderMode === 'points') {
      tempCtx.fillStyle = pointColor;
      const radius = Math.max(2, settings.pointSize) * multiplier;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const pt = getP(c, r);
          tempCtx.beginPath();
          tempCtx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
          tempCtx.fill();
        }
      }
    } else if (settings.renderMode === 'text') {
      tempCtx.fillStyle = strokeColor;
      const fSize = (settings.textSize || 12) * multiplier;
      tempCtx.font = `bold ${fSize}px "JetBrains Mono", monospace`;
      tempCtx.textAlign = 'center';
      tempCtx.textBaseline = 'middle';
      
      const txt = settings.customText || 'sappy.error';
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const pt = getP(c, r);
          const charIndex = (c + r * cols) % txt.length;
          const char = txt.charAt(charIndex);
          tempCtx.fillText(char, pt.x, pt.y);
        }
      }
    } else if (settings.renderMode === 'ascii') {
      tempCtx.fillStyle = strokeColor;
      const fSize = (settings.textSize || 10) * multiplier;
      tempCtx.font = `500 ${fSize}px "JetBrains Mono", monospace`;
      tempCtx.textAlign = 'center';
      tempCtx.textBaseline = 'middle';

      const asciiSymbols = ['0', '1', '[', ']', '{', '}', ';', '=>', '+', '-', '*', '/', '%', '#', '$', '@', '&', '!', '?', '<', '>', '~'];
      const asciiWords = ['sap', 'err', 'grid', 'var', 'let', 'set', 'get', 'run', 'val', 'nil', 'map', 'vec', 'sin', 'cos', 'dx', 'dy'];

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const pt = getP(c, r);
          const p = points[c][r];
          const dx = p.x - p.x0;
          const dy = p.y - p.y0;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          const index = (c * 7 + r * 13) % (asciiSymbols.length + asciiWords.length);
          let char = '';
          if (index < asciiSymbols.length) {
            char = asciiSymbols[index];
          } else {
            char = asciiWords[index - asciiSymbols.length];
          }

          if (dist > 15 && (c + r) % 2 === 0) {
            char = '1';
          } else if (dist > 30) {
            char = '0';
          }

          if (dist > 2) {
            tempCtx.save();
            tempCtx.translate(pt.x, pt.y);
            tempCtx.rotate(Math.atan2(dy, dx));
            tempCtx.fillText(char, 0, 0);
            tempCtx.restore();
          } else {
            tempCtx.fillText(char, pt.x, pt.y);
          }
        }
      }
    } else if (settings.renderMode === 'cad-people') {
      // High-resolution CAD plan people
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const pt = getP(c, r);
          const p = points[c][r];
          const dx = p.x - p.x0;
          const dy = p.y - p.y0;
          let angle = Math.atan2(dy, dx);
          if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
            angle = ((c * 17 + r * 23) % 360) * Math.PI / 180;
          }

          tempCtx.save();
          tempCtx.translate(pt.x, pt.y);
          tempCtx.rotate(angle);
          tempCtx.lineWidth = Math.max(1, settings.strokeWidth * multiplier * 0.85);
          tempCtx.strokeStyle = strokeColor;
          tempCtx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(18, 18, 18, 0.03)';

          const baseSize = Math.max(10, settings.pointSize * 2.4) * multiplier;
          const variant = (c + r) % 3;

          if (variant === 0) {
            tempCtx.beginPath();
            tempCtx.ellipse(0, 0, baseSize * 0.9, baseSize * 0.45, 0, 0, Math.PI * 2);
            tempCtx.fill();
            tempCtx.stroke();
            tempCtx.beginPath();
            tempCtx.arc(0, 0, baseSize * 0.28, 0, Math.PI * 2);
            tempCtx.fillStyle = isDark ? '#1a1a1a' : '#ffffff';
            tempCtx.fill();
            tempCtx.stroke();
          } else if (variant === 1) {
            tempCtx.beginPath();
            tempCtx.ellipse(0, 0, baseSize * 0.95, baseSize * 0.4, 0.15, 0, Math.PI * 2);
            tempCtx.fill();
            tempCtx.stroke();
            tempCtx.beginPath();
            tempCtx.arc(baseSize * 0.08, 0, baseSize * 0.26, 0, Math.PI * 2);
            tempCtx.fillStyle = isDark ? '#1a1a1a' : '#ffffff';
            tempCtx.fill();
            tempCtx.stroke();
            tempCtx.beginPath();
            tempCtx.arc(-baseSize * 0.6, baseSize * 0.25, baseSize * 0.1, 0, Math.PI * 2);
            tempCtx.stroke();
          } else {
            tempCtx.beginPath();
            tempCtx.rect(-baseSize * 0.5, -baseSize * 0.35, baseSize * 0.4, baseSize * 0.7);
            tempCtx.fill();
            tempCtx.stroke();
            tempCtx.beginPath();
            tempCtx.ellipse(0, 0, baseSize * 0.85, baseSize * 0.42, 0, 0, Math.PI * 2);
            tempCtx.stroke();
            tempCtx.beginPath();
            tempCtx.arc(baseSize * 0.05, 0, baseSize * 0.3, 0, Math.PI * 2);
            tempCtx.fillStyle = isDark ? '#1a1a1a' : '#ffffff';
            tempCtx.fill();
            tempCtx.stroke();
          }
          tempCtx.restore();
        }
      }
    }

    // Draw minimalist signature "sappy.error" in bottom-right corner if enabled
    if (settings.includeSignature) {
      const sigText = 'sappy.error';
      tempCtx.font = `600 ${Math.max(12, multiplier * 11)}px "JetBrains Mono", monospace`;
      tempCtx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(18, 18, 18, 0.45)';
      tempCtx.textAlign = 'right';
      tempCtx.textBaseline = 'bottom';
      
      const margin = Math.max(15, multiplier * 20);
      tempCtx.fillText(sigText, targetW - margin, targetH - margin);
    }

    return tempCanvas.toDataURL('image/png');
  };

  return (
    <div 
      ref={containerRef} 
      className={`w-full flex items-center justify-center p-4 bg-transparent max-h-[80vh] relative z-0 ${
        aspectRatio === '4:5' ? 'aspect-[4/5]' : 'aspect-square'
      }`}
    >
      <div 
        className={`relative overflow-hidden rounded-2xl shadow-2xl border transition-all duration-300 max-w-full max-h-full ${
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
      </div>
    </div>
  );
});

ArtCanvas.displayName = 'ArtCanvas';
