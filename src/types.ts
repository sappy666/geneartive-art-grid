export type InteractionMode = 'repel' | 'attract' | 'vortex' | 'smudge' | 'none';
export type DistortionType = 'sine' | 'noise' | 'vortex' | 'fold' | 'mixed';
export type ExportResolution = '1x' | '2x' | '4x' | '8x';

export interface ArtSettings {
  // Grid Setup
  cols: number;
  rows: number;
  strokeWidth: number;
  showPoints: boolean;
  pointSize: number;
  showVerticalLines: boolean;
  showHorizontalLines: boolean;
  diagonalLines: 'none' | 'left' | 'right' | 'both';
  
  // Distortion Settings
  distortionType: DistortionType;
  amplitude: number;
  frequency: number;
  edgeFalloff: number; // 0 = edges flow, 1 = edges perfectly anchored
  
  // Interaction Settings
  interactionMode: InteractionMode;
  interactionRadius: number;
  interactionStrength: number;
  persistDisplacement: boolean; // if true, dragging permanently deforms the grid
  elasticity: number; // speed at which grid returns to base (0.01 to 0.2)
  
  // Dynamic Settings
  animate: boolean;
  animationSpeed: number;
  
  // Aesthetic Styles
  darkTheme: boolean;
  paperTexture: boolean; // subtle grain overlay on the canvas
  colorInverted: boolean; // invert drawing colors
}

export interface Preset {
  id: string;
  name: string;
  settings: Omit<ArtSettings, 'darkTheme'>; // theme kept separate so user can toggle theme on any preset
  description: string;
}

export interface SavedConfig {
  id: string;
  name: string;
  createdAt: string;
  settings: ArtSettings;
}
