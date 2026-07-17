import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Download, 
  RotateCcw, 
  Sparkles, 
  Layers, 
  Sun, 
  Moon, 
  Maximize2, 
  Minimize2, 
  Save, 
  FolderOpen, 
  Trash2, 
  Copy, 
  Clipboard, 
  Sliders, 
  MousePointer, 
  Grid, 
  Eye, 
  Info,
  Check,
  Settings2,
  SlidersHorizontal,
  ChevronDown,
  FileDown,
  Pencil,
  Video,
  FileJson
} from 'lucide-react';
import { ArtSettings, SavedConfig, SavedCreation, ExportResolution, InteractionMode, DistortionType } from './types';
import { ArtCanvas, ArtCanvasRef } from './components/ArtCanvas';
import { DEFAULT_PRESETS } from './utils/presets';

export default function App() {
  const canvasRef = useRef<ArtCanvasRef>(null);

  // Initial Art State
  const [settings, setSettings] = useState<ArtSettings>({
    ...DEFAULT_PRESETS[0].settings,
    darkTheme: false,
  });

  // UI Control states
  const [zenMode, setZenMode] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState(DEFAULT_PRESETS[0].id);
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [savedCreations, setSavedCreations] = useState<SavedCreation[]>([]);
  const [newConfigName, setNewConfigName] = useState('');
  const [newCreationName, setNewCreationName] = useState('');
  const [loadedConfigId, setLoadedConfigId] = useState<string | null>(null);
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [activeTab, setActiveTab] = useState<'presets' | 'grid' | 'warp' | 'mouse' | 'saves'>('presets');
  
  // High-Res Export choices
  const [exportRes, setExportRes] = useState<ExportResolution>('4x');
  const [exportAspect, setExportAspect] = useState<'1:1' | '4:5'>('1:1');
  const [isExporting, setIsExporting] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  
  // Custom JSON sharing state
  const [showJsonShare, setShowJsonShare] = useState(false);
  const [jsonString, setJsonString] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Show a temporary message
  const triggerToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Synchronize body styles with dark/light themes
  useEffect(() => {
    const root = document.documentElement;
    if (settings.darkTheme) {
      root.classList.add('dark');
      root.style.backgroundColor = '#0A0A0A';
    } else {
      root.classList.remove('dark');
      root.style.backgroundColor = '#FAF9F6';
    }
  }, [settings.darkTheme]);

  // Load custom configs & creations from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('generative_grid_custom_configs');
      if (stored) {
        setSavedConfigs(JSON.parse(stored));
      }
      const storedCreations = localStorage.getItem('generative_grid_saved_creations');
      if (storedCreations) {
        setSavedCreations(JSON.parse(storedCreations));
      }
    } catch (e) {
      console.error('Error loading custom configurations or creations from localStorage', e);
    }
  }, []);

  // Update a single setting
  const updateSetting = <K extends keyof ArtSettings>(key: K, value: ArtSettings[K]) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    // If we manually change settings, we break away from preset highlighted state
    if (key !== 'darkTheme') {
      setSelectedPresetId('custom');
    }
  };

  // Load Preset
  const handleSelectPreset = (presetId: string) => {
    const preset = DEFAULT_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setSelectedPresetId(presetId);
      setLoadedConfigId(null); // Clear loaded configuration
      setSettings(prev => ({
        ...prev,
        ...preset.settings,
      }));
      triggerToast(`Cargado preset: ${preset.name}`, 'info');
    }
  };

  // Reset Grid positions/displacement back to default
  const handleResetGrid = () => {
    canvasRef.current?.resetGrid();
    triggerToast('Estructura de la cuadrícula restablecida', 'success');
  };

  // Save Custom configuration
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newConfigName.trim();
    if (!name) {
      triggerToast('Por favor introduce un nombre para la configuración', 'error');
      return;
    }

    const newConfig: SavedConfig = {
      id: 'custom_' + Date.now(),
      name,
      createdAt: new Date().toLocaleDateString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short'
      }),
      settings: { ...settings }
    };

    const updated = [newConfig, ...savedConfigs];
    setSavedConfigs(updated);
    localStorage.setItem('generative_grid_custom_configs', JSON.stringify(updated));
    setNewConfigName('');
    setLoadedConfigId(newConfig.id); // Set active to the newly created one!
    triggerToast(`Ajuste "${name}" guardado correctamente`, 'success');
  };

  // Update existing custom config
  const handleUpdateConfig = () => {
    if (!loadedConfigId) return;
    const configToUpdate = savedConfigs.find(c => c.id === loadedConfigId);
    if (!configToUpdate) return;

    const updated = savedConfigs.map(c => {
      if (c.id === loadedConfigId) {
        return {
          ...c,
          settings: { ...settings },
          createdAt: new Date().toLocaleDateString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
            day: 'numeric',
            month: 'short'
          }) + ' (actualizado)'
        };
      }
      return c;
    });

    setSavedConfigs(updated);
    localStorage.setItem('generative_grid_custom_configs', JSON.stringify(updated));
    triggerToast(`Ajuste "${configToUpdate.name}" actualizado con tus cambios`, 'success');
  };

  // Rename Saved Configuration
  const handleRenameConfig = (id: string) => {
    const name = editingName.trim();
    if (!name) {
      triggerToast('El nombre no puede estar vacío', 'error');
      return;
    }

    const updated = savedConfigs.map(c => {
      if (c.id === id) {
        return { ...c, name };
      }
      return c;
    });

    setSavedConfigs(updated);
    localStorage.setItem('generative_grid_custom_configs', JSON.stringify(updated));
    setEditingConfigId(null);
    setEditingName('');
    triggerToast('Nombre de ajuste actualizado', 'success');
  };

  // Load Saved Configuration
  const handleLoadConfig = (config: SavedConfig) => {
    setSettings({ ...config.settings });
    setSelectedPresetId('custom');
    setLoadedConfigId(config.id);
    setNewConfigName('');
    triggerToast(`Configuración cargada: ${config.name}`, 'info');
  };

  // Delete Saved Configuration
  const handleDeleteConfig = (id: string, name: string) => {
    const updated = savedConfigs.filter(item => item.id !== id);
    setSavedConfigs(updated);
    localStorage.setItem('generative_grid_custom_configs', JSON.stringify(updated));
    if (loadedConfigId === id) {
      setLoadedConfigId(null);
    }
    triggerToast(`Ajuste "${name}" eliminado`, 'info');
  };

  // High-resolution image export with custom padded index filename format requested: sappy.error.01, 02...
  const handleExport = () => {
    setIsExporting(true);
    triggerToast('Generando render de alta resolución...', 'info');

    setTimeout(() => {
      try {
        let multiplier = 1;
        if (exportRes === '2x') multiplier = 2;
        else if (exportRes === '4x') multiplier = 4;
        else if (exportRes === '8x') multiplier = 8;

        const dataUrl = canvasRef.current?.exportHighRes(multiplier, exportAspect);
        if (dataUrl) {
          // Retrieve and increment export index
          const counterStr = localStorage.getItem('sappy_error_export_counter') || '1';
          const counterVal = parseInt(counterStr) || 1;
          localStorage.setItem('sappy_error_export_counter', (counterVal + 1).toString());

          const paddedNum = String(counterVal).padStart(2, '0');
          const fileName = `sappy.error.${paddedNum}.png`;

          const link = document.createElement('a');
          link.download = fileName;
          link.href = dataUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          triggerToast(`¡Imagen ${fileName} descargada con éxito!`, 'success');
        } else {
          triggerToast('Error al exportar el lienzo', 'error');
        }
      } catch (err) {
        console.error(err);
        triggerToast('Error durante la generación de imagen', 'error');
      } finally {
        setIsExporting(false);
      }
    }, 400); // short timeout to let state update & UI react
  };

  // Grabar 5 segundos de video del Canvas
  const handleRecordVideo = () => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) {
      triggerToast('No se encontró el lienzo para grabar', 'error');
      return;
    }

    try {
      // Find supported mimeType
      const types = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4'
      ];
      let selectedType = '';
      for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) {
          selectedType = t;
          break;
        }
      }

      if (!selectedType) {
        triggerToast('Tu navegador no soporta grabación de video Canvas', 'error');
        return;
      }

      setIsRecordingVideo(true);
      setRecordingSeconds(5);
      triggerToast('Grabando 5 segundos de video...', 'info');

      const stream = canvas.captureStream(30); // 30 FPS
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: selectedType,
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: selectedType });
        const url = URL.createObjectURL(blob);
        const ext = selectedType.includes('mp4') ? 'mp4' : 'webm';
        
        const counterStr = localStorage.getItem('sappy_error_export_counter') || '1';
        const counterVal = parseInt(counterStr) || 1;
        localStorage.setItem('sappy_error_export_counter', (counterVal + 1).toString());
        const paddedNum = String(counterVal).padStart(2, '0');
        const fileName = `sappy.error.${paddedNum}.${ext}`;

        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        setIsRecordingVideo(false);
        triggerToast(`¡Video ${fileName} descargado con éxito!`, 'success');
      };

      // Start recording
      mediaRecorder.start();

      // Countdown interval
      let count = 5;
      const interval = setInterval(() => {
        count--;
        setRecordingSeconds(count);
        if (count <= 0) {
          clearInterval(interval);
          try {
            mediaRecorder.stop();
          } catch (e) {
            console.error('Error stopping recorder:', e);
          }
        }
      }, 1000);

    } catch (err) {
      console.error('Error starting video recording:', err);
      triggerToast('Error al iniciar la grabación de video', 'error');
      setIsRecordingVideo(false);
    }
  };

  // Descargar configuración actual como archivo JSON directo
  const handleDownloadJson = () => {
    try {
      const jsonStr = JSON.stringify(settings, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const counterStr = localStorage.getItem('sappy_error_export_counter') || '1';
      const counterVal = parseInt(counterStr) || 1;
      localStorage.setItem('sappy_error_export_counter', (counterVal + 1).toString());
      const paddedNum = String(counterVal).padStart(2, '0');
      const fileName = `sappy.error.${paddedNum}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      triggerToast(`¡Ajustes descargados como ${fileName}!`, 'success');
    } catch (err) {
      console.error(err);
      triggerToast('Error al exportar configuración JSON', 'error');
    }
  };

  // Record/Grab the current creation with snapshot & restore capability
  const handleSaveCreation = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newCreationName.trim() || `Creación ${String(savedCreations.length + 1).padStart(2, '0')}`;
    
    try {
      // Capture at 1.5x for reasonable thumbnail file-size in LocalStorage
      const thumbnailDataUrl = canvasRef.current?.exportHighRes(1.5, exportAspect);
      if (!thumbnailDataUrl) {
        triggerToast('Error al capturar la vista previa', 'error');
        return;
      }
      
      const newCreation: SavedCreation = {
        id: 'creation_' + Date.now(),
        name,
        dataUrl: thumbnailDataUrl,
        createdAt: new Date().toLocaleDateString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          day: 'numeric',
          month: 'short'
        }),
        settings: { ...settings }
      };

      const updated = [newCreation, ...savedCreations];
      setSavedCreations(updated);
      localStorage.setItem('generative_grid_saved_creations', JSON.stringify(updated));
      setNewCreationName('');
      triggerToast('¡Obra guardada en tu galería local!', 'success');
    } catch (err) {
      console.error(err);
      triggerToast('No se pudo grabar la creación', 'error');
    }
  };

  const handleDeleteCreation = (id: string, name: string) => {
    const updated = savedCreations.filter(c => c.id !== id);
    setSavedCreations(updated);
    localStorage.setItem('generative_grid_saved_creations', JSON.stringify(updated));
    triggerToast(`Eliminada de galería: ${name}`, 'success');
  };

  const handleLoadCreation = (creation: SavedCreation) => {
    setSettings({ ...creation.settings });
    setSelectedPresetId('custom');
    triggerToast(`Restaurada obra: ${creation.name}`, 'info');
  };

  // Export JSON string
  const handleExportJson = () => {
    const jsonStr = JSON.stringify(settings, null, 2);
    setJsonString(jsonStr);
    setShowJsonShare(true);
    setImportError(null);
  };

  // Import JSON string
  const handleImportJson = (val: string) => {
    setJsonString(val);
    try {
      const parsed = JSON.parse(val);
      // Validate structure roughly
      if (typeof parsed.cols === 'number' && typeof parsed.rows === 'number') {
        setSettings({
          ...parsed,
          // Keep current theme preference unless specified
          darkTheme: parsed.darkTheme !== undefined ? parsed.darkTheme : settings.darkTheme
        });
        setSelectedPresetId('custom');
        setImportError(null);
        setShowJsonShare(false);
        triggerToast('Ajustes JSON importados con éxito', 'success');
      } else {
        setImportError('La estructura JSON no contiene los parámetros de la cuadrícula válidos.');
      }
    } catch (e) {
      setImportError('JSON inválido. Por favor revisa la sintaxis.');
    }
  };

  // Copy JSON to clipboard
  const handleCopyClipboard = () => {
    navigator.clipboard.writeText(jsonString);
    setCopySuccess(true);
    triggerToast('Copiado al portapapeles', 'success');
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className={`min-h-screen font-sans flex flex-col justify-between transition-all duration-500 selection:bg-neutral-800 selection:text-white ${
      settings.darkTheme ? 'bg-[#0A0A0A] text-zinc-100' : 'bg-[#FAF9F6] text-zinc-900'
    }`}>
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border backdrop-blur-md animate-fade-in ${
          settings.darkTheme
            ? 'bg-black/90 border-white/10 text-zinc-200 shadow-black/80'
            : 'bg-white/95 border-neutral-200 text-neutral-800 shadow-neutral-200/40'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
            toast.type === 'success' ? 'bg-emerald-400' : toast.type === 'error' ? 'bg-rose-500' : 'bg-blue-400'
          }`} />
          <span className="font-mono text-[10px] uppercase tracking-widest font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <header className={`px-6 py-4.5 border-b flex items-center justify-between transition-all duration-300 ${
        settings.darkTheme 
          ? 'border-white/5 bg-[#0A0A0A]/85 backdrop-blur-md' 
          : 'border-neutral-200/50 bg-[#FAF9F6]/80 backdrop-blur-md'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className={`w-9.5 h-9.5 rounded-xl flex items-center justify-center border transition-all duration-500 rotate-45 ${
            settings.darkTheme ? 'border-white/10 hover:border-white/35 bg-white/[0.02]' : 'border-neutral-800 hover:border-neutral-900 bg-neutral-900/[0.02]'
          }`}>
            <Grid className="w-3.5 h-3.5 -rotate-45" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xs tracking-widest uppercase">
              sappy.error
            </h1>
            <p className="font-mono text-[9px] tracking-widest text-zinc-500 uppercase">
              Estudio Creativo Monocromo v1.2
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Real-time Indicator */}
          <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border ${
            settings.darkTheme 
              ? 'border-white/5 bg-white/[0.02]' 
              : 'border-neutral-200/50 bg-neutral-900/[0.02]'
          }`}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
              Tiempo Real Activo
            </span>
          </div>

          {/* Theme switcher */}
          <button
            onClick={() => updateSetting('darkTheme', !settings.darkTheme)}
            className={`p-2.5 rounded-xl border transition-all duration-300 ${
              settings.darkTheme 
                ? 'bg-zinc-950 border-white/5 text-amber-300 hover:text-amber-200 hover:bg-zinc-900 hover:border-white/20' 
                : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 shadow-sm'
            }`}
            title={settings.darkTheme ? 'Cambiar a Tema Claro' : 'Cambiar a Tema Oscuro'}
            id="theme-toggle-btn"
          >
            {settings.darkTheme ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Zen Mode */}
          <button
            onClick={() => {
              setZenMode(!zenMode);
              triggerToast(zenMode ? 'Panel de control visible' : 'Modo Zen: Controles ocultos', 'info');
            }}
            className={`p-2.5 rounded-xl border transition-all duration-300 ${
              zenMode 
                ? settings.darkTheme
                  ? 'bg-zinc-900 border-white/20 text-emerald-400' 
                  : 'bg-neutral-900 border-neutral-800 text-emerald-400'
                : settings.darkTheme
                ? 'bg-zinc-950 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-900 hover:border-white/20'
                : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 shadow-sm'
            }`}
            title={zenMode ? 'Mostrar Controles' : 'Modo Zen (Pantalla Completa)'}
            id="zen-toggle-btn"
          >
            {zenMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 flex flex-col lg:flex-row relative overflow-hidden">
        
        {/* Left Side: Canvas Preview Stage */}
        <div className={`flex-1 flex flex-col justify-center items-center p-6 lg:p-12 transition-all duration-500 ${
          zenMode ? 'w-full max-w-5xl mx-auto' : 'lg:w-3/5 xl:w-2/3'
        }`}>
          
          <div className="w-full max-w-2xl flex flex-col gap-4">
            {/* Action Bar Above Canvas */}
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <span className={`font-display text-[10px] font-bold uppercase tracking-widest ${
                  settings.darkTheme ? 'text-zinc-400' : 'text-zinc-600'
                }`}>
                  {DEFAULT_PRESETS.find(p => p.id === selectedPresetId)?.name || 'Obra Personalizada'}
                </span>
                {selectedPresetId === 'custom' && (
                  <span className="font-mono text-[8px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full uppercase tracking-wider border border-amber-500/20 font-semibold animate-pulse">
                    Editado
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-1.5">
                {/* Reset Grid */}
                <button
                  onClick={handleResetGrid}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-[9px] uppercase tracking-wider transition-all duration-300 ${
                    settings.darkTheme 
                      ? 'border-white/5 bg-white/[0.02] text-zinc-400 hover:bg-white/[0.05] hover:text-white' 
                      : 'border-neutral-200/60 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 shadow-sm'
                  }`}
                  title="Restablecer cuadrícula a su forma base"
                  id="reset-grid-btn"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpiar</span>
                </button>
                
                {/* Play / Pause waves animation */}
                <button
                  onClick={() => updateSetting('animate', !settings.animate)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-[9px] uppercase tracking-wider transition-all duration-300 ${
                    settings.animate
                      ? settings.darkTheme
                        ? 'bg-white border-white text-black font-semibold shadow-lg shadow-black/30 hover:bg-zinc-200'
                        : 'bg-neutral-900 border-neutral-800 text-white hover:bg-neutral-800'
                      : settings.darkTheme
                      ? 'border-white/5 bg-white/[0.02] text-zinc-400 hover:bg-white/[0.05]'
                      : 'border-neutral-200/60 text-neutral-600 hover:bg-neutral-50 shadow-sm'
                  }`}
                  id="animate-play-btn"
                >
                  {settings.animate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{settings.animate ? 'Pausar' : 'Animar'}</span>
                </button>
              </div>
            </div>

            {/* Canvas Container */}
            <ArtCanvas 
              ref={canvasRef} 
              settings={settings} 
              aspectRatio={exportAspect}
            />
          </div>
        </div>

        {/* Right Side: Interactive Editor sidebar dock */}
        <div className={`w-full lg:w-2/5 xl:w-1/3 border-t lg:border-t-0 lg:border-l flex flex-col overflow-y-auto max-h-[100vh] transition-all duration-500 ${
          zenMode ? 'opacity-0 pointer-events-none translate-x-full absolute w-0' : 'opacity-100 translate-x-0 bg-transparent'
        } ${
          settings.darkTheme ? 'border-white/5 bg-[#0D0D0E]' : 'border-neutral-200/50 bg-[#FAF9F6]'
        }`}>
          
          {/* Tab Navigation */}
          <div className={`flex border-b sticky top-0 z-10 backdrop-blur-md ${
            settings.darkTheme ? 'border-white/5 bg-[#0D0D0E]/90' : 'border-neutral-200/50 bg-[#FAF9F6]/95'
          }`}>
            {[
              { id: 'presets', label: 'Presets', icon: Sparkles },
              { id: 'grid', label: 'Estructura', icon: Grid },
              { id: 'warp', label: 'Ondas', icon: SlidersHorizontal },
              { id: 'mouse', label: 'Cursor', icon: MousePointer },
              { id: 'saves', label: 'Guardado', icon: FolderOpen }
            ].map(tab => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-3 px-1 flex flex-col items-center gap-1 font-mono text-[9px] uppercase tracking-widest font-semibold border-b-2 transition-all duration-300 ${
                    isActive
                      ? settings.darkTheme
                        ? 'border-white text-white bg-white/[0.02]'
                        : 'border-neutral-900 text-neutral-900 bg-neutral-900/[0.01]'
                      : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                  id={`tab-btn-${tab.id}`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Panels */}
          <div className="p-6 flex-1 flex flex-col gap-6">
            
            {/* TAB 1: PRESETS */}
            {activeTab === 'presets' && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-1 bg-transparent">
                  <h3 className="font-display font-semibold text-xs uppercase tracking-widest text-zinc-500">
                    Ajustes de Fábrica
                  </h3>
                  <p className={`text-xs leading-relaxed ${settings.darkTheme ? 'text-zinc-400' : 'text-neutral-500'}`}>
                    Comienza eligiendo uno de nuestros diseños algorítmicos. Cada preset modifica las ondas, densidad y comportamiento.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {DEFAULT_PRESETS.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset.id)}
                        className={`w-full p-4.5 rounded-xl border text-left transition-all duration-300 group relative overflow-hidden ${
                          isSelected
                            ? settings.darkTheme
                              ? 'bg-[#151516] border-white/20 text-white shadow-xl shadow-black/30'
                              : 'bg-white border-neutral-900 text-neutral-900 shadow-md'
                            : settings.darkTheme
                            ? 'bg-zinc-950/30 border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-200 hover:bg-[#121213]/30'
                            : 'bg-white border-neutral-200/50 text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50/50 shadow-sm'
                        }`}
                        id={`preset-card-${preset.id}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-display font-bold text-xs uppercase tracking-widest group-hover:translate-x-0.5 transition-transform duration-300">
                            {preset.name}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                        </div>
                        <p className={`text-[11px] leading-relaxed transition-colors ${
                          settings.darkTheme ? 'text-zinc-400 group-hover:text-zinc-300' : 'text-neutral-500 group-hover:text-neutral-700'
                        }`}>
                          {preset.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: GRID STRUCTURE */}
            {activeTab === 'grid' && (
              <div className="space-y-5 animate-fade-in">
                <div className="space-y-1">
                  <h3 className="font-display font-semibold text-xs uppercase tracking-widest text-zinc-500">
                    Estructura de Cuadrícula
                  </h3>
                  <p className={`text-xs leading-relaxed ${settings.darkTheme ? 'text-zinc-400' : 'text-neutral-500'}`}>
                    Determina la densidad, grosor y estilo geométrico de las líneas de tu obra.
                  </p>
                </div>

                {/* Render Mode Selection */}
                <div className="space-y-2">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 block">
                    Modo de Representación (Estilo)
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'lines', label: 'Líneas', desc: 'Cuadrícula tradicional' },
                      { id: 'points', label: 'Puntos', desc: 'Nodos flotantes puros' },
                      { id: 'text', label: 'Texto', desc: 'Patrón tipográfico' },
                      { id: 'ascii', label: 'Código ASCII', desc: 'Símbolos de consola y matriz' },
                      { id: 'cad-people', label: 'Personas CAD', desc: 'Siluetas arquitectónicas en planta' }
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => updateSetting('renderMode', mode.id as any)}
                        className={`py-2 text-center rounded-lg border text-[10px] font-mono transition-all duration-300 cursor-pointer ${
                          settings.renderMode === mode.id
                            ? settings.darkTheme
                              ? 'bg-white border-white text-black font-bold shadow-sm'
                              : 'bg-neutral-900 border-neutral-850 text-white font-bold'
                            : settings.darkTheme
                            ? 'border-white/5 text-zinc-400 hover:border-white/10 hover:text-white bg-transparent'
                            : 'border-neutral-200 text-neutral-400 hover:border-neutral-300 bg-transparent'
                        }`}
                        title={mode.desc}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conditional Text Settings */}
                {settings.renderMode === 'text' && (
                  <div className="space-y-3.5 p-3.5 rounded-xl border border-dashed animate-fade-in bg-zinc-500/5 border-zinc-500/20">
                    <div>
                      <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest mb-1.5 text-zinc-500">
                        <span>Texto Personalizado</span>
                        <span className="text-[9px] text-zinc-400">({(settings.customText || '').length} carac.)</span>
                      </div>
                      <input
                        type="text"
                        maxLength={500}
                        value={settings.customText || ''}
                        onChange={(e) => updateSetting('customText', e.target.value)}
                        placeholder="Escribe tu texto..."
                        className={`w-full text-xs font-mono px-3 py-2 rounded-lg border outline-none bg-transparent transition-all ${
                          settings.darkTheme 
                            ? 'border-white/10 text-white focus:border-white/20 focus:bg-zinc-950' 
                            : 'border-neutral-200 text-neutral-800 focus:border-neutral-400 focus:bg-white shadow-sm'
                        }`}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest mb-1.5 text-zinc-500">
                        <span>Tamaño de la Fuente</span>
                        <span className={`font-bold ${settings.darkTheme ? 'text-zinc-300' : 'text-zinc-800'}`}>{settings.textSize || 12} px</span>
                      </div>
                      <input
                        type="range"
                        min="6"
                        max="24"
                        step="1"
                        value={settings.textSize || 12}
                        onChange={(e) => updateSetting('textSize', parseInt(e.target.value))}
                        className="w-full h-1 rounded-lg appearance-none cursor-ew-resize bg-neutral-200 dark:bg-zinc-800 accent-neutral-900 dark:accent-white transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Grid Density Rows & Columns */}
                <div className="space-y-3.5">
                  <div>
                    <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest mb-1.5 text-zinc-500">
                      <span>Líneas Verticales (Columnas)</span>
                      <span className={`font-bold ${settings.darkTheme ? 'text-zinc-300' : 'text-zinc-800'}`}>{settings.cols}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={settings.cols}
                      onChange={(e) => updateSetting('cols', parseInt(e.target.value))}
                      className="w-full h-1 rounded-lg appearance-none cursor-ew-resize bg-neutral-200 dark:bg-zinc-800 accent-neutral-900 dark:accent-white transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest mb-1.5 text-zinc-500">
                      <span>Líneas Horizontales (Filas)</span>
                      <span className={`font-bold ${settings.darkTheme ? 'text-zinc-300' : 'text-zinc-800'}`}>{settings.rows}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={settings.rows}
                      onChange={(e) => updateSetting('rows', parseInt(e.target.value))}
                      className="w-full h-1 rounded-lg appearance-none cursor-ew-resize bg-neutral-200 dark:bg-zinc-800 accent-neutral-900 dark:accent-white transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest mb-1.5 text-zinc-500">
                      <span>Grosor de Línea</span>
                      <span className={`font-bold ${settings.darkTheme ? 'text-zinc-300' : 'text-zinc-800'}`}>{settings.strokeWidth.toFixed(1)} px</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="10.0"
                      step="0.1"
                      value={settings.strokeWidth}
                      onChange={(e) => updateSetting('strokeWidth', parseFloat(e.target.value))}
                      className="w-full h-1 rounded-lg appearance-none cursor-ew-resize bg-neutral-200 dark:bg-zinc-800 accent-neutral-900 dark:accent-white transition-all"
                    />
                  </div>
                </div>

                <hr className={settings.darkTheme ? 'border-white/5' : 'border-neutral-200/50'} />

                {/* Line toggles */}
                <div className="space-y-3">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 block">
                    Visibilidad de Ejes
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => updateSetting('showVerticalLines', !settings.showVerticalLines)}
                      className={`py-2 px-3 rounded-lg border text-[10px] font-mono uppercase tracking-wider transition-all duration-300 ${
                        settings.showVerticalLines
                          ? settings.darkTheme
                            ? 'bg-white border-white text-black font-semibold'
                            : 'bg-neutral-900 border-neutral-800 text-white'
                          : settings.darkTheme
                          ? 'border-white/5 bg-white/[0.01] text-zinc-400 hover:bg-white/[0.04]'
                          : 'border-neutral-200/50 text-neutral-400 bg-transparent'
                      }`}
                    >
                      Verticales
                    </button>
                    
                    <button
                      onClick={() => updateSetting('showHorizontalLines', !settings.showHorizontalLines)}
                      className={`py-2 px-3 rounded-lg border text-[10px] font-mono uppercase tracking-wider transition-all duration-300 ${
                        settings.showHorizontalLines
                          ? settings.darkTheme
                            ? 'bg-white border-white text-black font-semibold'
                            : 'bg-neutral-900 border-neutral-800 text-white'
                          : settings.darkTheme
                          ? 'border-white/5 bg-white/[0.01] text-zinc-400 hover:bg-white/[0.04]'
                          : 'border-neutral-200/50 text-neutral-400 bg-transparent'
                      }`}
                    >
                      Horizontales
                    </button>
                  </div>

                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 block mb-1.5">
                      Líneas Diagonales (Estructura Triangular)
                    </span>
                    <select
                      value={settings.diagonalLines}
                      onChange={(e) => updateSetting('diagonalLines', e.target.value as any)}
                      className={`w-full text-xs font-mono p-2.5 rounded-lg border outline-none bg-transparent transition-all cursor-pointer ${
                        settings.darkTheme 
                          ? 'border-white/5 text-zinc-300 focus:border-white/20 bg-zinc-950' 
                          : 'border-neutral-200 text-neutral-800 focus:border-neutral-400 bg-white shadow-sm'
                      }`}
                    >
                      <option value="none" className="dark:bg-zinc-950 dark:text-zinc-200">Ninguna</option>
                      <option value="left" className="dark:bg-zinc-950 dark:text-zinc-200">Diagonal Izquierda (\)</option>
                      <option value="right" className="dark:bg-zinc-950 dark:text-zinc-200">Diagonal Derecha (/)</option>
                      <option value="both" className="dark:bg-zinc-950 dark:text-zinc-200">Ambas Diagonales (Cruzado)</option>
                    </select>
                  </div>
                </div>

                <hr className={settings.darkTheme ? 'border-white/5' : 'border-neutral-200/50'} />

                {/* Show Nodes/Points */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 block font-semibold">
                        Dibujar Nodos / Vértices
                      </span>
                      <span className={`text-[10px] ${settings.darkTheme ? 'text-zinc-400' : 'text-neutral-500'}`}>Dibuja círculos en los puntos de intersección.</span>
                    </div>
                    <button
                      onClick={() => updateSetting('showPoints', !settings.showPoints)}
                      className={`w-11 h-6 rounded-full transition-all duration-300 relative cursor-pointer ${
                        settings.showPoints 
                          ? 'bg-neutral-900 dark:bg-white' 
                          : 'bg-neutral-200 dark:bg-zinc-800'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full absolute top-1 transition-all duration-300 ${
                        settings.showPoints 
                          ? 'left-6 bg-white dark:bg-black' 
                          : 'left-1 bg-neutral-500'
                      }`} />
                    </button>
                  </div>

                  {settings.showPoints && (
                    <div className="animate-fade-in">
                      <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest mb-1.5 text-zinc-500">
                        <span>Tamaño de Nodo</span>
                        <span className={`font-bold ${settings.darkTheme ? 'text-zinc-300' : 'text-zinc-800'}`}>{settings.pointSize.toFixed(1)} px</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="12.0"
                        step="0.5"
                        value={settings.pointSize}
                        onChange={(e) => updateSetting('pointSize', parseFloat(e.target.value))}
                        className="w-full h-1 rounded-lg appearance-none cursor-ew-resize bg-neutral-200 dark:bg-zinc-800 accent-neutral-900 dark:accent-white transition-all"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: WARP / DISTORTIONS */}
            {activeTab === 'warp' && (
              <div className="space-y-5 animate-fade-in">
                <div className="space-y-1">
                  <h3 className="font-display font-semibold text-xs uppercase tracking-widest text-zinc-500">
                    Ondas y Modelado Algorítmico
                  </h3>
                  <p className={`text-xs leading-relaxed ${settings.darkTheme ? 'text-zinc-400' : 'text-neutral-500'}`}>
                    Aplica fórmulas matemáticas de ondas de gravedad y ruido matemático para deformar el patrón.
                  </p>
                </div>

                {/* Distortion Type Selector */}
                <div className="space-y-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 block">
                    Algoritmo de Deformación
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'sine', label: 'Ondas' },
                      { id: 'noise', label: 'Ruido FBM' },
                      { id: 'fold', label: 'Pliegues' },
                      { id: 'vortex', label: 'Vórtice' },
                      { id: 'mixed', label: 'Mixto' },
                      { id: 'neural', label: 'Ondas Neuronales' },
                      { id: 'bird', label: 'Vuelo de Pájaro' },
                      { id: 'butterfly', label: 'Aleteo Mariposa' },
                      { id: 'wind_currents', label: 'C. Viento 🍃' },
                      { id: 'river_flow', label: 'Flujo Río 🌊' },
                      { id: 'leaves_fall', label: 'Hojas Caídas 🍁' }
                    ].map(type => (
                      <button
                        key={type.id}
                        onClick={() => updateSetting('distortionType', type.id as any)}
                        className={`py-2 px-1 text-center rounded-lg border text-[10px] font-mono uppercase tracking-wider transition-all duration-300 ${
                          settings.distortionType === type.id
                            ? settings.darkTheme
                              ? 'bg-white border-white text-black font-semibold'
                              : 'bg-neutral-900 border-neutral-850 text-white font-bold'
                            : settings.darkTheme
                            ? 'border-white/5 bg-white/[0.01] text-zinc-400 hover:border-white/10 hover:text-zinc-200'
                            : 'border-neutral-200/60 text-neutral-400 hover:border-neutral-300'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                <hr className={settings.darkTheme ? 'border-white/5' : 'border-neutral-200/50'} />

                {/* Amplitude, Frequency, Falloff sliders */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest mb-1.5 text-zinc-500">
                      <span>Amplitud (Fuerza)</span>
                      <span className={`font-bold ${settings.darkTheme ? 'text-zinc-300' : 'text-zinc-800'}`}>{settings.amplitude}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="150"
                      value={settings.amplitude}
                      onChange={(e) => updateSetting('amplitude', parseInt(e.target.value))}
                      className="w-full h-1 rounded-lg appearance-none cursor-ew-resize bg-neutral-200 dark:bg-zinc-800 accent-neutral-900 dark:accent-white transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest mb-1.5 text-zinc-500">
                      <span>Frecuencia (Escala)</span>
                      <span className={`font-bold ${settings.darkTheme ? 'text-zinc-300' : 'text-zinc-800'}`}>{((settings.frequency || 0.05) * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.005"
                      max="0.450"
                      step="0.005"
                      value={settings.frequency}
                      onChange={(e) => updateSetting('frequency', parseFloat(e.target.value))}
                      className="w-full h-1 rounded-lg appearance-none cursor-ew-resize bg-neutral-200 dark:bg-zinc-800 accent-neutral-900 dark:accent-white transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest mb-1.5 text-zinc-500">
                      <span>Anclaje de Bordes</span>
                      <span className={`font-bold ${settings.darkTheme ? 'text-zinc-300' : 'text-zinc-800'}`}>{settings.edgeFalloff === 0 ? 'Libre' : `${((settings.edgeFalloff || 0) * 100).toFixed(0)}%`}</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={settings.edgeFalloff}
                      onChange={(e) => updateSetting('edgeFalloff', parseFloat(e.target.value))}
                      className="w-full h-1 rounded-lg appearance-none cursor-ew-resize bg-neutral-200 dark:bg-zinc-800 accent-neutral-900 dark:accent-white transition-all"
                    />
                    <span className={`text-[10px] leading-relaxed mt-1.5 block ${settings.darkTheme ? 'text-zinc-400' : 'text-neutral-500'}`}>
                      Fija las fronteras de la cuadrícula para imitar un marco o papel sujetado.
                    </span>
                  </div>
                </div>

                <hr className={settings.darkTheme ? 'border-white/5' : 'border-neutral-200/50'} />

                {/* Animation controls */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 block font-semibold">
                        Animar Ondas en Tiempo Real
                      </span>
                      <span className={`text-[10px] ${settings.darkTheme ? 'text-zinc-400' : 'text-neutral-500'}`}>Hace que el oleaje fluya constantemente.</span>
                    </div>
                    <button
                      onClick={() => updateSetting('animate', !settings.animate)}
                      className={`w-11 h-6 rounded-full transition-all duration-300 relative cursor-pointer ${
                        settings.animate 
                          ? 'bg-neutral-900 dark:bg-white' 
                          : 'bg-neutral-200 dark:bg-zinc-800'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full absolute top-1 transition-all duration-300 ${
                        settings.animate 
                          ? 'left-6 bg-white dark:bg-black' 
                          : 'left-1 bg-neutral-500'
                      }`} />
                    </button>
                  </div>

                  {settings.animate && (
                    <div className="animate-fade-in">
                      <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest mb-1.5 text-zinc-500">
                        <span>Velocidad de Animación</span>
                        <span className={`font-bold ${settings.darkTheme ? 'text-zinc-300' : 'text-zinc-800'}`}>{settings.animationSpeed.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="5.0"
                        step="0.1"
                        value={settings.animationSpeed}
                        onChange={(e) => updateSetting('animationSpeed', parseFloat(e.target.value))}
                        className="w-full h-1 rounded-lg appearance-none cursor-ew-resize bg-neutral-200 dark:bg-zinc-800 accent-neutral-900 dark:accent-white transition-all"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: MOUSE / INTERACTION */}
            {activeTab === 'mouse' && (
              <div className="space-y-5 animate-fade-in">
                <div className="space-y-1">
                  <h3 className="font-display font-semibold text-xs uppercase tracking-widest text-zinc-500">
                    Interacción del Cursor
                  </h3>
                  <p className={`text-xs leading-relaxed ${settings.darkTheme ? 'text-zinc-400' : 'text-neutral-500'}`}>
                    Controla qué sucede cuando pasas o arrastras el dedo o ratón sobre la tela elástica de la cuadrícula.
                  </p>
                </div>

                {/* Interaction Mode Selection */}
                <div className="space-y-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 block">
                    Efecto al Tocar
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'repel', label: 'Repeler' },
                      { id: 'attract', label: 'Atraer' },
                      { id: 'vortex', label: 'Girar' },
                      { id: 'smudge', label: 'Arrastrar' },
                      { id: 'none', label: 'Desactivado' }
                    ].map(mode => (
                      <button
                        key={mode.id}
                        onClick={() => updateSetting('interactionMode', mode.id as any)}
                        className={`py-2 px-1 text-center rounded-lg border text-[10px] font-mono uppercase tracking-wider transition-all duration-300 ${
                          settings.interactionMode === mode.id
                            ? settings.darkTheme
                              ? 'bg-white border-white text-black font-semibold'
                              : 'bg-neutral-900 border-neutral-850 text-white'
                            : settings.darkTheme
                            ? 'border-white/5 bg-white/[0.01] text-zinc-400 hover:border-white/10 hover:text-zinc-200'
                            : 'border-neutral-200/60 text-neutral-400 hover:border-neutral-300'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                <hr className={settings.darkTheme ? 'border-white/5' : 'border-neutral-200/50'} />

                {/* Interaction Parameters */}
                {settings.interactionMode !== 'none' && (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest mb-1.5 text-zinc-500">
                        <span>Radio de Influencia</span>
                        <span className={`font-bold ${settings.darkTheme ? 'text-zinc-300' : 'text-zinc-800'}`}>{settings.interactionRadius} px</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="400"
                        step="10"
                        value={settings.interactionRadius}
                        onChange={(e) => updateSetting('interactionRadius', parseInt(e.target.value))}
                        className="w-full h-1 rounded-lg appearance-none cursor-ew-resize bg-neutral-200 dark:bg-zinc-800 accent-neutral-900 dark:accent-white transition-all"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest mb-1.5 text-zinc-500">
                        <span>Fuerza de Deformación</span>
                        <span className={`font-bold ${settings.darkTheme ? 'text-zinc-300' : 'text-zinc-800'}`}>{settings.interactionStrength.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="3.0"
                        step="0.1"
                        value={settings.interactionStrength}
                        onChange={(e) => updateSetting('interactionStrength', parseFloat(e.target.value))}
                        className="w-full h-1 rounded-lg appearance-none cursor-ew-resize bg-neutral-200 dark:bg-zinc-800 accent-neutral-900 dark:accent-white transition-all"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest mb-1.5 text-zinc-500">
                        <span>Elasticidad de Retorno</span>
                        <span className={`font-bold ${settings.darkTheme ? 'text-zinc-300' : 'text-zinc-800'}`}>{(((settings.elasticity || 0.05) * 500)).toFixed(0)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.01"
                        max="0.20"
                        step="0.01"
                        value={settings.elasticity}
                        onChange={(e) => updateSetting('elasticity', parseFloat(e.target.value))}
                        className="w-full h-1 rounded-lg appearance-none cursor-ew-resize bg-neutral-200 dark:bg-zinc-800 accent-neutral-900 dark:accent-white transition-all"
                      />
                      <span className={`text-[10px] leading-relaxed mt-1.5 block ${settings.darkTheme ? 'text-zinc-400' : 'text-neutral-500'}`}>
                        Qué tan rápido vuelve la cuadrícula a su posición original al soltarla.
                      </span>
                    </div>

                    <hr className={settings.darkTheme ? 'border-white/5' : 'border-neutral-200/50'} />

                    {/* Clay Sculpting Toggle */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 block font-semibold">
                            Persistir Moldeado (Modo Arcilla)
                          </span>
                          <span className={`text-[10px] ${settings.darkTheme ? 'text-zinc-400' : 'text-neutral-500'}`}>Si se activa, el esculpido queda permanente.</span>
                        </div>
                        <button
                          onClick={() => updateSetting('persistDisplacement', !settings.persistDisplacement)}
                          className={`w-11 h-6 rounded-full transition-all duration-300 relative cursor-pointer ${
                            settings.persistDisplacement 
                              ? 'bg-neutral-900 dark:bg-white' 
                              : 'bg-neutral-200 dark:bg-zinc-800'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full absolute top-1 transition-all duration-300 ${
                            settings.persistDisplacement 
                              ? 'left-6 bg-white dark:bg-black' 
                              : 'left-1 bg-neutral-500'
                          }`} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: SAVED CREATIONS, CONFIGS & SHARING */}
            {activeTab === 'saves' && (
              <div className="space-y-6 animate-fade-in pb-12">
                {/* SECTION 1: GALERÍA DE OBRAS GRABADAS (SNAPSHOTS) */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-display font-semibold text-xs uppercase tracking-widest text-zinc-500">
                      Galería de Obras Grabadas
                    </h3>
                    <p className={`text-[11px] leading-relaxed ${settings.darkTheme ? 'text-zinc-400' : 'text-neutral-500'}`}>
                      Graba una foto de tu creación actual con sus respectivos parámetros para poder reconstruirla en el futuro. Se guarda localmente.
                    </p>
                  </div>

                  {/* Form to record/grab creation */}
                  <form onSubmit={handleSaveCreation} className="space-y-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 block">
                      Grabar Obra Actual
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Nombre de la obra (ej. Estalactitas)"
                        value={newCreationName}
                        onChange={(e) => setNewCreationName(e.target.value)}
                        className={`flex-1 text-xs px-3.5 py-2.5 rounded-lg border outline-none bg-transparent transition-all ${
                          settings.darkTheme 
                            ? 'border-white/5 text-zinc-200 focus:border-white/20 bg-zinc-950' 
                            : 'border-neutral-200 text-neutral-800 focus:border-neutral-400 bg-white shadow-sm'
                        }`}
                      />
                      <button
                        type="submit"
                        className={`px-4 py-2.5 rounded-lg flex items-center justify-center font-mono text-[10px] uppercase tracking-wider font-semibold gap-1.5 transition-all cursor-pointer ${
                          settings.darkTheme
                            ? 'bg-white text-black hover:bg-zinc-200 shadow-lg shadow-black/20'
                            : 'bg-neutral-900 text-white hover:bg-neutral-800'
                        }`}
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Grabar</span>
                      </button>
                    </div>
                  </form>

                  {/* Gallery Grid */}
                  {savedCreations.length === 0 ? (
                    <div className={`p-6 text-center border border-dashed rounded-xl ${
                      settings.darkTheme ? 'border-white/5 text-zinc-600 bg-white/[0.01]' : 'border-neutral-200 text-neutral-400 bg-neutral-50/25'
                    }`}>
                      <Eye className="w-5 h-5 mx-auto mb-2 opacity-50 text-zinc-500" />
                      <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">No hay obras grabadas en tu galería</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                      {savedCreations.map((creation) => (
                        <div
                          key={creation.id}
                          className={`group relative rounded-xl border overflow-hidden flex flex-col transition-all duration-300 ${
                            settings.darkTheme
                              ? 'border-white/5 bg-zinc-950/40 hover:border-white/10'
                              : 'border-neutral-200 bg-white hover:border-neutral-300 shadow-sm'
                          }`}
                        >
                          {/* Image preview with aspect-square */}
                          <div className="relative aspect-square overflow-hidden bg-neutral-900/10 dark:bg-black/40 flex items-center justify-center">
                            <img
                              src={creation.dataUrl}
                              alt={creation.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            {/* Overlay Controls */}
                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleLoadCreation(creation)}
                                className="p-2 bg-white text-black rounded-lg hover:scale-105 transition-transform cursor-pointer"
                                title="Cargar diseño"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <a
                                href={creation.dataUrl}
                                download={`${creation.name}.png`}
                                className="p-2 bg-zinc-900 text-white rounded-lg hover:scale-105 transition-transform cursor-pointer flex items-center justify-center"
                                title="Descargar imagen"
                              >
                                <FileDown className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => handleDeleteCreation(creation.id, creation.name)}
                                className="p-2 bg-rose-600 text-white rounded-lg hover:scale-105 transition-transform cursor-pointer"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          
                          {/* Label info */}
                          <div className="p-2 flex flex-col gap-0.5 border-t border-zinc-500/10">
                            <span className="font-sans font-semibold text-[10px] uppercase tracking-wide truncate">
                              {creation.name}
                            </span>
                            <span className="font-mono text-[8px] text-zinc-500 block">
                              {creation.createdAt}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <hr className={settings.darkTheme ? 'border-white/5' : 'border-neutral-200/50'} />

                {/* SECTION 2: AJUSTES GUARDADOS DE PARÁMETROS */}
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-display font-semibold text-xs uppercase tracking-widest text-zinc-500">
                      Perfiles de Ajustes Técnicos
                    </h3>
                    <p className={`text-[11px] leading-relaxed ${settings.darkTheme ? 'text-zinc-400' : 'text-neutral-500'}`}>
                      Guarda únicamente los deslizadores, ondas, y parámetros de interacción para replicar el movimiento exacto en otras redes.
                    </p>
                  </div>

                  {/* Edit Active Design Banner */}
                  {loadedConfigId && (() => {
                    const activeConfig = savedConfigs.find(c => c.id === loadedConfigId);
                    if (!activeConfig) return null;
                    return (
                      <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        settings.darkTheme 
                          ? 'bg-emerald-950/10 border-emerald-500/20 text-emerald-300' 
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      }`}>
                        <div className="space-y-0.5">
                          <span className="font-display font-bold text-[10px] uppercase tracking-wider block">
                            Editando Ajuste Activo
                          </span>
                          <p className="text-[11px] opacity-90 leading-relaxed">
                            Estás modificando: <span className="font-bold">"{activeConfig.name}"</span>. Puedes actualizar este diseño o crear uno nuevo.
                          </p>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0 w-full sm:w-auto justify-end">
                          <button
                            onClick={handleUpdateConfig}
                            className={`px-3 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-widest font-bold flex items-center gap-1 transition-all cursor-pointer ${
                              settings.darkTheme
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-950/30'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                            }`}
                            title="Actualizar este ajuste con los parámetros actuales"
                          >
                            <Save className="w-3 h-3" />
                            <span>Actualizar</span>
                          </button>
                          <button
                            onClick={() => setLoadedConfigId(null)}
                            className={`px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${
                              settings.darkTheme
                                ? 'border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 bg-transparent'
                                : 'border-neutral-200 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 bg-transparent'
                            }`}
                            title="Dejar de editar y permitir crear una copia nueva"
                          >
                            <span className="font-mono text-[9px] uppercase font-bold block">Nueva Copia</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Save configuration form */}
                  <form onSubmit={handleSaveConfig} className="space-y-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 block">
                      {loadedConfigId ? 'Guardar como nueva configuración' : 'Guardar Configuración Actual'}
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ej. Olas del Pacífico"
                        value={newConfigName}
                        onChange={(e) => setNewConfigName(e.target.value)}
                        className={`flex-1 text-xs px-3.5 py-2.5 rounded-lg border outline-none bg-transparent transition-all ${
                          settings.darkTheme 
                            ? 'border-white/5 text-zinc-200 focus:border-white/20 bg-zinc-950' 
                            : 'border-neutral-200 text-neutral-800 focus:border-neutral-400 bg-white shadow-sm'
                        }`}
                      />
                      <button
                        type="submit"
                        className={`px-4 py-2.5 rounded-lg flex items-center justify-center font-mono text-[10px] uppercase tracking-wider font-semibold gap-1.5 transition-all cursor-pointer ${
                          settings.darkTheme
                            ? 'bg-white text-black hover:bg-zinc-200 shadow-lg shadow-black/20'
                            : 'bg-neutral-900 text-white hover:bg-neutral-800'
                        }`}
                        id="save-config-submit-btn"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{loadedConfigId ? 'Copiar' : 'Guardar'}</span>
                      </button>
                    </div>
                  </form>

                  <hr className={settings.darkTheme ? 'border-white/5' : 'border-neutral-200/50'} />

                  {/* Custom Saved List */}
                  <div className="space-y-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 block">
                      Tus Perfiles Técnicos ({savedConfigs.length})
                    </span>

                    {savedConfigs.length === 0 ? (
                      <div className={`p-6 text-center border border-dashed rounded-xl ${
                        settings.darkTheme ? 'border-white/5 text-zinc-600 bg-white/[0.01]' : 'border-neutral-200 text-neutral-400 bg-neutral-50/25'
                      }`}>
                        <FolderOpen className="w-5 h-5 mx-auto mb-2 opacity-50 text-zinc-500" />
                        <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">No hay perfiles personalizados guardados</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                        {savedConfigs.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between p-3.5 rounded-lg border transition-all ${
                              loadedConfigId === item.id
                                ? settings.darkTheme
                                  ? 'border-emerald-500/30 bg-emerald-950/5 text-zinc-100'
                                  : 'border-emerald-300 bg-emerald-50/30 text-neutral-800'
                                : settings.darkTheme 
                                  ? 'border-white/5 bg-zinc-950/30 text-zinc-300 hover:border-white/10' 
                                  : 'border-neutral-200 bg-white shadow-sm text-neutral-700 hover:border-neutral-300'
                            }`}
                          >
                            {editingConfigId === item.id ? (
                              <div className="flex-1 flex items-center gap-2 mr-2">
                                <input
                                  type="text"
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  className={`flex-1 text-xs px-2.5 py-1.5 rounded-lg border outline-none bg-transparent transition-all ${
                                    settings.darkTheme 
                                      ? 'border-white/20 text-zinc-200 focus:border-white/40 bg-zinc-950' 
                                      : 'border-neutral-300 text-neutral-800 focus:border-neutral-400 bg-white shadow-sm'
                                  }`}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleRenameConfig(item.id);
                                    } else if (e.key === 'Escape') {
                                      setEditingConfigId(null);
                                      setEditingName('');
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => handleRenameConfig(item.id)}
                                  className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded transition-colors cursor-pointer"
                                  title="Guardar nombre"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingConfigId(null);
                                    setEditingName('');
                                  }}
                                  className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                                  title="Cancelar"
                                >
                                  <span className="font-mono text-[10px] font-bold px-1">X</span>
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`font-sans font-semibold text-xs uppercase tracking-wide ${
                                      loadedConfigId === item.id ? 'text-emerald-500 dark:text-emerald-400' : ''
                                    }`}>
                                      {item.name}
                                    </span>
                                    <button
                                      onClick={() => {
                                        setEditingConfigId(item.id);
                                        setEditingName(item.name);
                                      }}
                                      className="p-1 rounded opacity-50 hover:opacity-100 hover:bg-neutral-200 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                                      title="Renombrar ajuste"
                                    >
                                      <Pencil className="w-2.5 h-2.5 text-zinc-400" />
                                    </button>
                                  </div>
                                  <span className="font-mono text-[9px] text-zinc-500 block">
                                    Guardado: {item.createdAt}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleLoadConfig(item)}
                                    className={`px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider rounded border transition-all cursor-pointer ${
                                      loadedConfigId === item.id
                                        ? settings.darkTheme
                                          ? 'bg-emerald-500 border-emerald-500 text-black font-bold'
                                          : 'bg-emerald-600 border-emerald-600 text-white font-bold shadow-sm'
                                        : settings.darkTheme
                                        ? 'border-white/10 hover:border-white text-zinc-300 hover:text-white bg-white/[0.02]'
                                        : 'border-neutral-300 hover:border-neutral-800 text-neutral-600 hover:text-neutral-900 bg-neutral-50'
                                    }`}
                                  >
                                    {loadedConfigId === item.id ? 'Activo' : 'Cargar'}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteConfig(item.id, item.name)}
                                    className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                                    title="Eliminar perfiles"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <hr className={settings.darkTheme ? 'border-white/5' : 'border-neutral-200/50'} />

                {/* Import / Export via JSON (Sharing code!) */}
                <div className="space-y-2.5">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 block">
                    Compartir e Importar Ajustes
                  </span>
                  <button
                    onClick={handleExportJson}
                    className={`w-full py-2.5 px-3 rounded-lg border flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest transition-all cursor-pointer ${
                      settings.darkTheme 
                        ? 'border-white/5 text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.01] hover:border-white/10' 
                        : 'border-neutral-200 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 shadow-sm'
                    }`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Abrir Consola JSON para Compartir</span>
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Canvas Draw & Download Controls footer dock */}
          <div className={`p-6 border-t sticky bottom-0 z-10 backdrop-blur-md ${
            settings.darkTheme ? 'border-white/5 bg-[#0D0D0E]/95' : 'border-neutral-200/50 bg-[#FAF9F6]/95'
          }`}>
            <div className="space-y-4">
              {/* Extra styling controls: inversion and grain */}
              <div className="flex gap-2">
                <button
                  onClick={() => updateSetting('paperTexture', !settings.paperTexture)}
                  className={`flex-1 py-1.5 px-2 rounded-lg border text-[9px] font-mono uppercase tracking-widest transition-all duration-300 cursor-pointer ${
                    settings.paperTexture
                      ? settings.darkTheme
                        ? 'bg-white border-white text-black font-semibold'
                        : 'bg-neutral-900 border-neutral-800 text-white'
                      : settings.darkTheme
                      ? 'border-white/5 text-zinc-400 hover:bg-white/[0.04] bg-transparent'
                      : 'border-neutral-200 text-neutral-400 bg-transparent'
                  }`}
                  title="Añade un granulado de papel texturizado sutil al fondo"
                >
                  Textura Papel
                </button>
                
                <button
                  onClick={() => updateSetting('colorInverted', !settings.colorInverted)}
                  className={`flex-1 py-1.5 px-2 rounded-lg border text-[9px] font-mono uppercase tracking-widest transition-all duration-300 cursor-pointer ${
                    settings.colorInverted
                      ? settings.darkTheme
                        ? 'bg-white border-white text-black font-semibold'
                        : 'bg-neutral-900 border-neutral-800 text-white'
                      : settings.darkTheme
                      ? 'border-white/5 text-zinc-400 hover:bg-white/[0.04] bg-transparent'
                      : 'border-neutral-200 text-neutral-400 bg-transparent'
                  }`}
                  title="Invierte los colores de dibujo de la cuadrícula y fondo"
                >
                  Invertir Contraste
                </button>
              </div>

              {/* Export Panel */}
              <div className="space-y-3">
                {/* Resolution Select */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-zinc-500">
                    <span>Resolución de Descarga</span>
                    <span className="font-bold text-zinc-400">PNG</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { id: '1x', label: '1x', title: 'Medida real del lienzo' },
                      { id: '2x', label: '2x', title: 'HD - 1200px' },
                      { id: '4x', label: '4x', title: '4K nítido - 2400px' },
                      { id: '8x', label: '8x', title: 'Impresión Ultra - 4800px' }
                    ].map((res) => (
                      <button
                        key={res.id}
                        onClick={() => setExportRes(res.id as ExportResolution)}
                        className={`py-2 text-center rounded-lg border text-[10px] font-mono transition-all duration-300 cursor-pointer ${
                          exportRes === res.id
                            ? settings.darkTheme
                              ? 'bg-white border-white text-black font-bold shadow-md'
                              : 'bg-neutral-900 border-neutral-800 text-white font-bold'
                            : settings.darkTheme
                            ? 'border-white/5 text-zinc-400 hover:border-white/10 hover:text-white bg-transparent'
                            : 'border-neutral-200 text-neutral-400 hover:border-neutral-300 bg-transparent'
                        }`}
                        title={res.title}
                      >
                        {res.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aspect Ratio Select */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-zinc-500">
                    <span>Proporción de Aspecto</span>
                    <span className="font-bold text-zinc-400">{exportAspect}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setExportAspect('1:1')}
                      className={`py-2 text-center rounded-lg border text-[10px] font-mono transition-all duration-300 cursor-pointer ${
                        exportAspect === '1:1'
                          ? settings.darkTheme
                            ? 'bg-white border-white text-black font-bold shadow-sm'
                            : 'bg-neutral-900 border-neutral-800 text-white font-bold'
                          : settings.darkTheme
                          ? 'border-white/5 text-zinc-400 hover:border-white/10 hover:text-white bg-transparent'
                          : 'border-neutral-200 text-neutral-400 hover:border-neutral-300 bg-transparent'
                      }`}
                      title="Diseño cuadrado completo"
                    >
                      1:1 (CUADRADO)
                    </button>
                    <button
                      onClick={() => setExportAspect('4:5')}
                      className={`py-2 text-center rounded-lg border text-[10px] font-mono transition-all duration-300 cursor-pointer ${
                        exportAspect === '4:5'
                          ? settings.darkTheme
                            ? 'bg-white border-white text-black font-bold shadow-sm'
                            : 'bg-neutral-900 border-neutral-800 text-white font-bold'
                          : settings.darkTheme
                          ? 'border-white/5 text-zinc-400 hover:border-white/10 hover:text-white bg-transparent'
                          : 'border-neutral-200 text-neutral-400 hover:border-neutral-300 bg-transparent'
                      }`}
                      title="Marco de retrato 4:5 con el diseño cuadrado centrado"
                    >
                      4:5 (RETRATO MARCO)
                    </button>
                  </div>
                </div>

                {/* Signature Toggle */}
                <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                  settings.darkTheme ? 'border-white/5 bg-white/[0.01]' : 'border-neutral-200 bg-neutral-50/30'
                }`}>
                  <div className="space-y-0.5">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 block font-semibold">
                      Firma sappy.error
                    </span>
                    <span className={`text-[10px] block leading-tight ${settings.darkTheme ? 'text-zinc-400' : 'text-neutral-500'}`}>
                      Colocar firma en esquina inferior derecha.
                    </span>
                  </div>
                  <button
                    onClick={() => updateSetting('includeSignature', !settings.includeSignature)}
                    className={`w-10 h-5 rounded-full transition-all duration-300 relative flex-shrink-0 cursor-pointer ${
                      settings.includeSignature 
                        ? 'bg-neutral-900 dark:bg-white' 
                        : 'bg-neutral-200 dark:bg-zinc-800'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full absolute top-0.5 transition-all duration-300 ${
                      settings.includeSignature 
                        ? 'left-5.5 bg-white dark:bg-black' 
                        : 'left-1 bg-neutral-500'
                    }`} />
                  </button>
                </div>

                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className={`w-full py-3 rounded-xl flex items-center justify-center font-mono text-[10px] uppercase tracking-widest font-bold gap-2 transition-all shadow-md mt-1 cursor-pointer ${
                    settings.darkTheme
                      ? 'bg-white text-black hover:bg-zinc-200 disabled:opacity-40 shadow-black/25'
                      : 'bg-neutral-950 text-white hover:bg-neutral-800 disabled:opacity-55'
                  }`}
                  id="export-png-action-btn"
                >
                  {isExporting ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4" />
                  )}
                  <span>{isExporting ? 'Procesando Render...' : 'Exportar en Alta Calidad'}</span>
                </button>

                {/* Alternativas de exportación: Video & JSON */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    onClick={handleRecordVideo}
                    disabled={isRecordingVideo}
                    className={`py-2.5 px-3 rounded-xl flex items-center justify-center font-mono text-[9px] uppercase tracking-widest font-bold gap-1.5 transition-all shadow border cursor-pointer ${
                      settings.darkTheme
                        ? 'bg-zinc-900 border-white/5 text-zinc-300 hover:text-white hover:bg-zinc-800/80 disabled:opacity-40'
                        : 'bg-white border-neutral-200 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50 disabled:opacity-55'
                    }`}
                    title="Graba 5 segundos de animación de tu lienzo como archivo de video"
                  >
                    {isRecordingVideo ? (
                      <span className="flex items-center gap-1 text-rose-500 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-rose-500 inline-block mr-0.5" />
                        <span>Rec {recordingSeconds}s</span>
                      </span>
                    ) : (
                      <>
                        <Video className="w-3.5 h-3.5 text-rose-500/80" />
                        <span>Guardar Video</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleDownloadJson}
                    className={`py-2.5 px-3 rounded-xl flex items-center justify-center font-mono text-[9px] uppercase tracking-widest font-bold gap-1.5 transition-all shadow border cursor-pointer ${
                      settings.darkTheme
                        ? 'bg-zinc-900 border-white/5 text-zinc-300 hover:text-white hover:bg-zinc-800/80'
                        : 'bg-white border-neutral-200 text-neutral-700 hover:text-neutral-900 hover:bg-neutral-50'
                    }`}
                    title="Descarga la configuración técnica actual como archivo JSON"
                  >
                    <FileJson className="w-3.5 h-3.5 text-indigo-500/80" />
                    <span>Exportar JSON</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* JSON Sharing Drawer Overlay */}
      {showJsonShare && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-xl rounded-2xl border p-6 flex flex-col gap-4 shadow-2xl transition-all ${
            settings.darkTheme ? 'bg-[#0D0D0E] border-white/5 text-zinc-100 shadow-2xl shadow-black/40' : 'bg-white border-neutral-200 text-neutral-900'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-display font-bold text-sm uppercase tracking-widest">Consola de Parámetros JSON</h4>
                <p className={`text-[11px] leading-relaxed mt-0.5 ${settings.darkTheme ? 'text-zinc-400' : 'text-neutral-500'}`}>Copia este código para compartirlo, o pega uno existente para recrear un diseño.</p>
              </div>
              <button
                onClick={() => {
                  setShowJsonShare(false);
                  setImportError(null);
                }}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  settings.darkTheme ? 'border-white/5 hover:bg-white/[0.02] text-zinc-400' : 'border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                }`}
              >
                <span className="font-mono text-xs font-semibold block px-1 cursor-pointer">X</span>
              </button>
            </div>

            <textarea
              value={jsonString}
              onChange={(e) => setJsonString(e.target.value)}
              placeholder="Pega el código JSON de una configuración aquí..."
              className={`w-full h-48 font-mono text-xs p-3.5 rounded-lg border outline-none bg-transparent resize-none leading-relaxed ${
                settings.darkTheme 
                  ? 'border-white/5 text-zinc-200 focus:border-white/20 bg-zinc-950' 
                  : 'border-neutral-200 text-neutral-800 focus:border-neutral-400 bg-neutral-50/50'
              }`}
            />

            {importError && (
              <p className="text-xs text-rose-500 font-mono tracking-wide">{importError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleCopyClipboard}
                className={`flex-1 py-2.5 rounded-lg flex items-center justify-center font-mono text-[10px] uppercase tracking-wider font-semibold gap-1.5 transition-all cursor-pointer ${
                  settings.darkTheme
                    ? 'bg-zinc-900 border border-white/5 text-zinc-300 hover:text-white hover:bg-zinc-850'
                    : 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'
                }`}
              >
                {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copySuccess ? '¡Copiado!' : 'Copiar al Portapapeles'}</span>
              </button>
              
              <button
                onClick={() => handleImportJson(jsonString)}
                className={`flex-1 py-2.5 rounded-lg flex items-center justify-center font-mono text-[10px] uppercase tracking-wider font-semibold gap-1.5 transition-all cursor-pointer ${
                  settings.darkTheme
                    ? 'bg-white text-black hover:bg-zinc-200 shadow-lg shadow-black/20'
                    : 'bg-neutral-950 text-white hover:bg-neutral-850'
                }`}
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Aplicar e Importar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subtle Bottom Footer */}
      <footer className={`px-6 py-4 border-t text-center font-mono text-[9px] uppercase tracking-widest transition-all ${
        settings.darkTheme ? 'border-white/5 bg-[#0A0A0A] text-zinc-500' : 'border-neutral-200/50 bg-neutral-50/20 text-neutral-400'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Soporte Multi-táctil Completo · Diseñado para Escritorio y Móvil</span>
          <div className="flex items-center justify-center gap-1">
            <span>Creador:</span>
            <a 
              href="https://www.instagram.com/sappy.error" 
              target="_blank" 
              rel="noopener noreferrer" 
              className={`font-bold transition-all hover:underline ${
                settings.darkTheme ? 'text-zinc-300 hover:text-white' : 'text-neutral-800 hover:text-black'
              }`}
            >
              @sappy.error
            </a>
          </div>
          <span>© {new Date().getFullYear()} Generative Grid Art</span>
        </div>
      </footer>

    </div>
  );
}
