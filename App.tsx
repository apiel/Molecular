import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { SynthNode, Position, Connection, NodeType, Theme } from './types';
import { Bubble } from './components/Bubble';
import { Sidebar } from './components/Sidebar';
import { audioEngine } from './services/audioEngine';

const STORAGE_KEY = 'molecular_synth_v1';
const MIN_FREQ = 0;
const MID_FREQ = 20;
const MAX_FREQ = 2000;

const THEMES: Theme[] = [
  {
    id: 'deep-space',
    name: 'Deep Space',
    colors: {
      oscStart: '#4f46e5',
      oscEnd: '#312e81',
      fxStart: '#10b981',
      fxEnd: '#134e4a',
      connStart: '#818cf8',
      connEnd: '#34d399',
      bgGlow: 'radial-gradient(circle at 30% 30%, #0a0a1a 0%, #020205 100%)',
      sidebarBg: 'rgba(10, 10, 20, 0.95)',
      accent: '#4f46e5',
      buttonBg: 'rgba(255, 255, 255, 0.05)',
      buttonText: '#ffffff',
      fontFamily: "'Inter', sans-serif"
    }
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    colors: {
      oscStart: '#ff00ff',
      oscEnd: '#660066',
      fxStart: '#00ffff',
      fxEnd: '#004444',
      connStart: '#ff00ff',
      connEnd: '#00ffff',
      bgGlow: 'radial-gradient(circle at 50% 50%, #1a001a 0%, #000000 100%)',
      sidebarBg: 'rgba(0, 0, 0, 0.98)',
      accent: '#ff00ff',
      buttonBg: 'rgba(0, 255, 255, 0.1)',
      buttonText: '#00ffff',
      fontFamily: "'Courier New', monospace"
    }
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    colors: {
      oscStart: '#ffffff',
      oscEnd: '#333333',
      fxStart: '#aaaaaa',
      fxEnd: '#111111',
      connStart: '#ffffff',
      connEnd: '#555555',
      bgGlow: 'linear-gradient(180deg, #111 0%, #000 100%)',
      sidebarBg: 'rgba(5, 5, 5, 1)',
      accent: '#ffffff',
      buttonBg: 'rgba(255, 255, 255, 0.1)',
      buttonText: '#ffffff',
      fontFamily: "'Inter', sans-serif"
    }
  },
  {
    id: 'heatwave',
    name: 'Heatwave',
    colors: {
      oscStart: '#f97316',
      oscEnd: '#7c2d12',
      fxStart: '#e11d48',
      fxEnd: '#4c0519',
      connStart: '#fb923c',
      connEnd: '#f43f5e',
      bgGlow: 'radial-gradient(circle at 70% 20%, #2e0505 0%, #050505 100%)',
      sidebarBg: 'rgba(20, 5, 5, 0.95)',
      accent: '#f97316',
      buttonBg: 'rgba(249, 115, 22, 0.1)',
      buttonText: '#fdba74',
      fontFamily: "'Inter', sans-serif"
    }
  }
];

const xToFreq = (x: number, width: number) => {
  const oneThird = width / 3;
  if (x <= oneThird) {
    const t = Math.max(0, x / oneThird);
    return t * MID_FREQ;
  } else {
    const t = Math.max(0, (x - oneThird) / (2 * oneThird));
    return MID_FREQ + t * (MAX_FREQ - MID_FREQ);
  }
};

const App: React.FC = () => {
  const [nodes, setNodes] = useState<SynthNode[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.nodes || [];
      } catch (e) { return []; }
    }
    return [];
  });

  const [connections, setConnections] = useState<Connection[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.connections || [];
      } catch (e) { return []; }
    }
    return [];
  });

  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const theme = THEMES.find(t => t.id === parsed.themeId);
        return theme || THEMES[0];
      } catch (e) { return THEMES[0]; }
    }
    return THEMES[0];
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBinding, setIsBinding] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);
  
  // Workspace navigation (Panning)
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const panStateRef = useRef<{ active: boolean, startX: number, startY: number, initialX: number, initialY: number }>({
    active: false, startX: 0, startY: 0, initialX: 0, initialY: 0
  });

  const dragStateRef = useRef<{ id: string, offsetX: number, offsetY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getCanvasWidth = useCallback(() => {
    if (!containerRef.current) return window.innerWidth;
    const isMobile = window.innerWidth < 1024;
    // For calculation of frequency bounds, we use the visual width minus sidebar if docked
    return (isMobile || !isSidebarOpen) ? window.innerWidth : window.innerWidth - 320;
  }, [isSidebarOpen]);

  useEffect(() => {
    if (nodes.length === 0) {
      const w = getCanvasWidth();
      const h = window.innerHeight;
      const id1 = uuidv4();
      const id2 = uuidv4();
      const defaults: SynthNode[] = [
        {
          id: id1,
          type: 'OSC',
          subType: 'sine',
          pos: { x: w * 0.4, y: h / 2 - 50 },
          size: 140,
          frequency: xToFreq(w * 0.4, w),
          modulators: [],
          color: currentTheme.colors.oscStart,
          isAudible: true
        },
        {
          id: id2,
          type: 'OSC',
          subType: 'sine',
          pos: { x: w * 0.1, y: h / 2 + 100 },
          size: 100,
          frequency: xToFreq(w * 0.1, w),
          modulators: [],
          color: currentTheme.colors.oscStart,
          isAudible: false
        }
      ];
      setNodes(defaults);
      setConnections([{
        id: uuidv4(),
        fromId: defaults[1].id,
        toId: defaults[0].id
      }]);
    }
  }, []);

  useEffect(() => {
    const state = { nodes, connections, themeId: currentTheme.id };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [nodes, connections, currentTheme]);

  const applyFxParams = useCallback((node: SynthNode, w: number, h: number) => {
    const id = node.id;
    const x = node.pos.x;
    const y = node.pos.y;
    if (node.subType.startsWith('filter')) {
        audioEngine.updateParam(id, 'cutoff', xToFreq(x, w) * 5);
        audioEngine.updateParam(id, 'resonance', (h - y) / 40);
    } else if (node.subType === 'delay') {
        audioEngine.updateParam(id, 'time', x / w * 2);
        audioEngine.updateParam(id, 'feedback', (h - y) / h);
    } else if (node.subType === 'distortion') {
        audioEngine.updateParam(id, 'amount', (x / w) * 5);
        audioEngine.updateParam(id, 'distortionCurve', (h - y) / 5);
    } else if (node.subType === 'reverb') {
        audioEngine.updateParam(id, 'diffusion', (h - y) / h);
    } else if (node.subType === 'phaser') {
        audioEngine.updateParam(id, 'speed', (x / w) * 10);
        audioEngine.updateParam(id, 'depth', (h - y) / h * 2000);
    } else if (node.subType === 'tremolo') {
        audioEngine.updateParam(id, 'rate', (x / w) * 20);
        audioEngine.updateParam(id, 'intensity', (h - y) / h);
    } else if (node.subType === 'bitcrusher') {
        audioEngine.updateParam(id, 'bitCurve', Math.max(1, (h - y) / h * 16));
    } else if (node.subType === 'chorus') {
        audioEngine.updateParam(id, 'speed', (x / w) * 5);
        audioEngine.updateParam(id, 'intensity', (h - y) / h * 0.01);
    }
  }, []);

  const rebuildAudioEngine = useCallback((nodesToBuild: SynthNode[], connsToBuild: Connection[]) => {
    audioEngine.init();
    nodesToBuild.forEach(node => {
      if (node.type === 'OSC') {
        audioEngine.createOscillator(node.id, node.subType as any, node.frequency, node.size / 300, node.isAudible);
      } else {
        audioEngine.createEffect(node.id, node.subType as any);
        audioEngine.updateAudible(node.id, node.isAudible);
      }
    });

    const w = getCanvasWidth();
    const h = window.innerHeight;
    nodesToBuild.forEach(node => {
      if (node.type === 'FX') applyFxParams(node, w, h);
    });

    connsToBuild.forEach(conn => {
      audioEngine.connectNodes(conn.fromId, conn.toId);
    });
  }, [applyFxParams, getCanvasWidth]);

  const startAudio = useCallback(() => {
    if (!isStarted) {
      audioEngine.init();
      setIsStarted(true);
      rebuildAudioEngine(nodes, connections);
    } else {
      audioEngine.init(); // Re-trigger resume on every gesture
    }
  }, [isStarted, nodes, connections, rebuildAudioEngine]);

  const addNode = (type: NodeType) => {
    startAudio();
    const id = uuidv4();
    const w = getCanvasWidth();
    const h = window.innerHeight;
    // New nodes appear relative to the current view offset
    const worldX = 100 + Math.random() * (w - 200) - viewOffset.x;
    const worldY = 100 + Math.random() * (h - 200) - viewOffset.y;
    const freq = xToFreq(worldX, w);
    
    const newNode: SynthNode = {
      id,
      type,
      subType: type === 'OSC' ? 'sine' : 'filter-lp',
      pos: { x: worldX, y: worldY },
      size: 110,
      frequency: freq,
      modulators: [],
      color: type === 'OSC' ? currentTheme.colors.oscStart : currentTheme.colors.fxStart,
      isAudible: true
    };
    
    setNodes(prev => [...prev, newNode]);
    if (type === 'OSC') {
        audioEngine.createOscillator(id, newNode.subType as any, newNode.frequency, newNode.size / 300, true);
    } else {
        audioEngine.createEffect(id, newNode.subType as any);
        audioEngine.updateAudible(id, true);
    }
    setSelectedId(id);
    // Removed auto-open sidebar here
  };

  const toggleTransport = () => {
    startAudio();
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);
    audioEngine.setMasterMute(!nextPlaying);
  };

  const resetAll = () => {
    if (!confirm('This will wipe all molecules and connections. Proceed?')) return;
    nodes.forEach(n => audioEngine.removeNode(n.id));
    setNodes([]);
    setConnections([]);
    setSelectedId(null);
    setSelectedConnectionId(null);
    localStorage.removeItem(STORAGE_KEY);
    setTimeout(() => window.location.reload(), 10);
  };

  const handleExport = () => {
    const state = { nodes, connections, themeId: currentTheme.id, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `molecular-patch-${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIsMenuOpen(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
    setIsMenuOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.nodes || !parsed.connections) throw new Error('Invalid format');
        nodes.forEach(n => audioEngine.removeNode(n.id));
        setNodes(parsed.nodes);
        setConnections(parsed.connections);
        const theme = THEMES.find(t => t.id === parsed.themeId) || THEMES[0];
        setCurrentTheme(theme);
        if (isStarted) rebuildAudioEngine(parsed.nodes, parsed.connections);
        setSelectedId(null);
        setSelectedConnectionId(null);
      } catch (err) { alert('Failed to import patch: Invalid file format'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const updateNode = useCallback((id: string, updates: Partial<SynthNode>) => {
    setNodes(prev => prev.map(n => {
      if (n.id === id) {
        const updated = { ...n, ...updates };
        if (updates.subType !== undefined && updated.type === 'OSC') {
            audioEngine.updateOscType(id, updates.subType as any);
        }
        if (updates.subType !== undefined && updated.type === 'FX') {
            audioEngine.updateEffectType(id, updates.subType as any);
            connections.forEach(conn => {
                if (conn.fromId === id || conn.toId === id) {
                    audioEngine.connectNodes(conn.fromId, conn.toId);
                }
            });
            const w = getCanvasWidth();
            const h = window.innerHeight;
            applyFxParams(updated, w, h);
        }
        if (updates.isAudible !== undefined) audioEngine.updateAudible(id, updates.isAudible);
        if (updates.size !== undefined) {
            const val = updated.size / 300;
            audioEngine.updateParam(id, updated.type === 'OSC' ? 'gain' : 'intensity', val);
        }
        if (updates.frequency !== undefined) {
            audioEngine.updateParam(id, 'frequency', updated.frequency);
        }
        return updated;
      }
      return n;
    }));
  }, [connections, applyFxParams, getCanvasWidth]);

  const deleteNode = useCallback((id: string) => {
    const connectionsToRemove = connections.filter(c => c.fromId === id || c.toId === id);
    connectionsToRemove.forEach(c => {
      audioEngine.disconnectNodes(c.fromId, c.toId);
    });
    setConnections(prev => prev.filter(c => c.fromId !== id && c.toId !== id));
    setNodes(prev => prev.filter(n => n.id !== id));
    audioEngine.removeNode(id);
    setSelectedId(null);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, [connections]);

  const deleteConnection = useCallback((id: string) => {
    setConnections(prev => {
        const conn = prev.find(c => c.id === id);
        if (conn) audioEngine.disconnectNodes(conn.fromId, conn.toId);
        return prev.filter(c => c.id !== id);
    });
    setSelectedConnectionId(null);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) deleteNode(selectedId);
        if (selectedConnectionId) deleteConnection(selectedConnectionId);
      }
      if (e.key === 'Escape') {
        setIsConnecting(false);
        setIsBinding(false);
        setSelectedId(null);
        setSelectedConnectionId(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedId, selectedConnectionId, deleteNode, deleteConnection]);

  const handlePointerDownContainer = (e: React.PointerEvent) => {
    startAudio();
    if (e.target === containerRef.current || (e.target as any).tagName === 'svg') {
        setSelectedId(null);
        setSelectedConnectionId(null);
        setIsMenuOpen(false);
        if (window.innerWidth < 1024) setIsSidebarOpen(false);
        
        // Start background panning
        panStateRef.current = {
          active: true,
          startX: e.clientX,
          startY: e.clientY,
          initialX: viewOffset.x,
          initialY: viewOffset.y
        };
    }
  };

  const handlePointerDownBubble = useCallback((e: React.PointerEvent, id: string) => {
    startAudio();
    setSelectedConnectionId(null);
    if (isConnecting && selectedId && selectedId !== id) {
        audioEngine.connectNodes(selectedId, id);
        setConnections(prev => [...prev, { id: uuidv4(), fromId: selectedId, toId: id }]);
        setIsConnecting(false);
        return;
    }
    if (isBinding && selectedId && selectedId !== id) {
        setNodes(prev => prev.map(n => n.id === selectedId ? { ...n, boundTo: id } : n));
        setIsBinding(false);
        return;
    }
    setNodes(prev => {
      const node = prev.find(n => n.id === id);
      if (node) {
        // Offset drag to account for panning
        dragStateRef.current = { 
          id, 
          offsetX: e.clientX - (node.pos.x + viewOffset.x), 
          offsetY: e.clientY - (node.pos.y + viewOffset.y) 
        };
      }
      return prev;
    });
    // @ts-ignore
    e.target.setPointerCapture(e.pointerId);
    setSelectedId(id);
  }, [isConnecting, isBinding, selectedId, startAudio, viewOffset]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Handling Pan
    if (panStateRef.current.active) {
      const dx = e.clientX - panStateRef.current.startX;
      const dy = e.clientY - panStateRef.current.startY;
      setViewOffset({
        x: panStateRef.current.initialX + dx,
        y: panStateRef.current.initialY + dy
      });
      return;
    }

    // Handling Molecule Drag
    if (!dragStateRef.current) return;
    const { id, offsetX, offsetY } = dragStateRef.current;
    setNodes(prev => {
        const draggedNodeOrig = prev.find(n => n.id === id);
        if (!draggedNodeOrig) return prev;
        
        const canvasW = getCanvasWidth();
        const h = window.innerHeight;
        
        let newScreenX = e.clientX - offsetX;
        let newScreenY = e.clientY - offsetY;
        
        // World coordinates are Screen - Offset
        let newWorldX = newScreenX - viewOffset.x;
        let newWorldY = newScreenY - viewOffset.y;
        
        const shiftX = newWorldX - draggedNodeOrig.pos.x;
        const shiftY = newWorldY - draggedNodeOrig.pos.y;
        
        return prev.map(n => {
            const isDragged = n.id === id;
            const isBound = n.boundTo === id;
            if (!isDragged && !isBound) return n;
            
            let updatedPos = isDragged 
              ? { x: newWorldX, y: newWorldY }
              : { x: n.pos.x + shiftX, y: n.pos.y + shiftY };
            
            const updatedNode = { ...n, pos: updatedPos };
            if (n.type === 'OSC') {
                const freq = xToFreq(updatedPos.x, canvasW);
                audioEngine.updateParam(n.id, 'frequency', freq);
                updatedNode.frequency = freq;
            } else {
                applyFxParams(updatedNode, canvasW, h);
            }
            return updatedNode;
        });
    });
  }, [applyFxParams, getCanvasWidth, viewOffset]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragStateRef.current = null;
    panStateRef.current.active = false;
    // @ts-ignore
    try { e.target.releasePointerCapture(e.pointerId); } catch(e) {}
  }, []);

  const themeStyle = useMemo(() => ({
    background: currentTheme.colors.bgGlow,
    fontFamily: currentTheme.colors.fontFamily,
    color: currentTheme.colors.buttonText
  }), [currentTheme]);

  return (
    <div 
      className="flex h-screen w-screen overflow-hidden relative" 
      style={themeStyle} 
      onPointerMove={handlePointerMove} 
      onPointerDown={handlePointerDownContainer}
      onPointerUp={handlePointerUp}
    >
      <style>{`
        body { font-family: ${currentTheme.colors.fontFamily}; }
        .glass-panel { background: ${currentTheme.colors.sidebarBg}; }
        button { border-color: ${currentTheme.colors.accent}44; color: ${currentTheme.colors.buttonText}; }
      `}</style>
      
      <div className="fixed inset-0 pointer-events-none" style={{ background: currentTheme.colors.bgGlow, zIndex: -1 }} />
      
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />

      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <svg className="absolute inset-0 pointer-events-none w-full h-full z-0">
          <defs>
            <linearGradient id="signalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={currentTheme.colors.connStart} stopOpacity="0.4" />
                <stop offset="100%" stopColor={currentTheme.colors.connEnd} stopOpacity="0.4" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <g style={{ transform: `translate(${viewOffset.x}px, ${viewOffset.y}px)` }}>
            {connections.map((conn) => {
              const from = nodes.find(n => n.id === conn.fromId);
              const to = nodes.find(n => n.id === conn.toId);
              if (!from || !to) return null;
              const isSel = selectedConnectionId === conn.id;
              const isHov = hoveredConnectionId === conn.id;
              const d = `M ${from.pos.x} ${from.pos.y} L ${to.pos.x} ${to.pos.y}`;
              const isFM = to.type === 'OSC';
              return (
                <g key={conn.id} className="pointer-events-auto cursor-pointer" 
                   onClick={(e) => { e.stopPropagation(); setSelectedConnectionId(conn.id); setSelectedId(null); }}
                   onMouseEnter={() => setHoveredConnectionId(conn.id)}
                   onMouseLeave={() => setHoveredConnectionId(null)}>
                  <path d={d} stroke="transparent" strokeWidth="30" className="cursor-pointer" fill="none" />
                  {(isSel || isHov) && <path d={d} stroke={currentTheme.colors.accent} strokeWidth={isSel ? "8" : "6"} strokeOpacity="0.3" filter="url(#glow)" fill="none" />}
                  {/* Fixed 'W' error by replacing it with 'isFM' */}
                  <path d={d} stroke={isSel ? currentTheme.colors.accent : "url(#signalGrad)"} strokeWidth={isSel ? "5" : "2"} strokeDasharray={isFM?"2,2":"10,5"} className={`transition-all ${hoveredConnectionId === conn.id ? 'opacity-100' : 'opacity-60'}`} fill="none" />
                  {/* Fixed 'W' error by replacing it with 'isFM' */}
                  <circle r="3" fill="#fff" filter="blur(1px)"><animateMotion dur={isFM?"0.8s":"2s"} repeatCount="indefinite" path={d} /></circle>
                </g>
              );
            })}
          </g>
        </svg>

        <div style={{ transform: `translate(${viewOffset.x}px, ${viewOffset.y}px)` }}>
          {nodes.map(node => (
            <Bubble key={node.id} node={node} isSelected={selectedId === node.id} isConnecting={isConnecting || isBinding} hasIncoming={connections.some(c => c.toId === node.id)} theme={currentTheme} onMouseDown={handlePointerDownBubble} onSelect={(id) => { setSelectedId(id); }} />
          ))}
        </div>

        {/* Top Controls */}
        <div className="absolute top-4 sm:top-8 left-4 sm:left-8 flex flex-wrap gap-2 sm:gap-4 z-20 items-center max-w-[calc(100%-120px)]">
            <button onClick={() => addNode('OSC')} style={{ background: currentTheme.colors.buttonBg }} className="px-3 sm:px-6 py-2 sm:py-2.5 rounded-full font-black tracking-widest text-[9px] sm:text-[11px] shadow-2xl transition-all active:scale-95 uppercase border backdrop-blur-md">Osc</button>
            <button onClick={() => addNode('FX')} style={{ background: currentTheme.colors.buttonBg }} className="px-3 sm:px-6 py-2 sm:py-2.5 rounded-full font-black tracking-widest text-[9px] sm:text-[11px] shadow-2xl transition-all active:scale-95 uppercase border backdrop-blur-md">Fx</button>
            <button onClick={() => {setIsConnecting(!isConnecting); setIsBinding(false);}} style={{ background: isConnecting ? currentTheme.colors.accent : currentTheme.colors.buttonBg, color: isConnecting ? '#000' : currentTheme.colors.buttonText }} className="px-3 sm:px-6 py-2 sm:py-2.5 rounded-full font-black tracking-widest text-[9px] sm:text-[11px] shadow-2xl uppercase transition-all border backdrop-blur-md">{isConnecting ? 'Cancel' : 'Route'}</button>
            <button onClick={() => {setIsBinding(!isBinding); setIsConnecting(false);}} style={{ background: isBinding ? '#f59e0b' : currentTheme.colors.buttonBg, color: isBinding ? '#000' : currentTheme.colors.buttonText }} className="px-3 sm:px-6 py-2 sm:py-2.5 rounded-full font-black tracking-widest text-[9px] sm:text-[11px] shadow-2xl uppercase transition-all border backdrop-blur-md">{isBinding ? 'Cancel' : 'Bind'}</button>
            <button onClick={toggleTransport} style={{ background: isPlaying ? 'rgba(16, 185, 129, 0.2)' : '#dc2626' }} className={`px-3 sm:px-6 py-2 sm:py-2.5 rounded-full font-black tracking-[0.1em] sm:tracking-[0.2em] text-[9px] sm:text-[11px] shadow-2xl uppercase transition-all border backdrop-blur-md flex items-center justify-center gap-1 sm:gap-3 ${isPlaying ? 'text-emerald-400 border-emerald-500/50' : 'text-white border-white/40'}`}>
                {isPlaying ? <svg className="w-3 h-3 sm:w-4 sm:h-4 fill-current" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2" /></svg> : <svg className="w-3 h-3 sm:w-4 sm:h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}
                <span>{isPlaying ? 'Stop' : 'Play'}</span>
            </button>
        </div>

        {/* Right Corner Menu - Burger Button Fixed Positioning */}
        <div className="absolute top-4 sm:top-8 right-4 sm:right-8 z-30">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ background: currentTheme.colors.buttonBg }} className="w-10 h-10 flex items-center justify-center rounded-full border border-white/20 backdrop-blur-md hover:bg-white/10 transition-all active:scale-90 shadow-2xl">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            {isMenuOpen && (
                <div className="absolute top-12 right-0 w-56 bg-black/95 backdrop-blur-3xl border border-white/10 rounded-2xl p-2 flex flex-col gap-1 shadow-[0_20px_50px_rgba(0,0,0,1)] z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-white/5 mb-1">
                        <label className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-2 block">Atmosphere</label>
                        {/* Fixed 'R' error by replacing it with 'setCurrentTheme' */}
                        <select value={currentTheme.id} onChange={(e) => { const theme = THEMES.find(t => t.id === e.target.value); if (theme) setCurrentTheme(theme); }} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white outline-none cursor-pointer">
                            {THEMES.map(t => <option key={t.id} value={t.id} className="bg-black text-white">{t.name}</option>)}
                        </select>
                    </div>
                    <button onClick={handleExport} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest hover:bg-white/10 rounded-xl transition-colors">Export Patch</button>
                    <button onClick={handleImportClick} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest hover:bg-white/10 rounded-xl transition-colors">Import Patch</button>
                    <div className="mt-1 pt-1 border-t border-white/5">
                        <button onClick={resetAll} className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 rounded-xl transition-colors">Clear Space</button>
                    </div>
                </div>
            )}
        </div>

        <div className="absolute inset-y-0 left-0 w-1/3 border-r border-white/5 pointer-events-none z-10 flex flex-col justify-end p-8">
          <div className="text-[10px] font-black uppercase text-white/5 tracking-[0.4em] rotate-180 [writing-mode:vertical-lr]">World Depth Spectrum (0-20Hz)</div>
        </div>

        {(isConnecting || isBinding) && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-2xl px-6 sm:px-12 py-3 sm:py-4 rounded-full border border-white/20 text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] animate-pulse z-50 shadow-2xl text-center">
                {isConnecting ? 'Select Signal Sink (Esc to cancel)' : 'Select Binding Parent (Esc to cancel)'}
            </div>
        )}

        {/* Sidebar Toggle Tab */}
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} style={{ background: isSidebarOpen ? currentTheme.colors.accent : 'rgba(0,0,0,0.4)', color: isSidebarOpen ? '#000' : '#fff' }} className="absolute top-1/2 -translate-y-1/2 right-0 w-8 h-32 flex items-center justify-center rounded-l-2xl border-l border-t border-b border-white/20 backdrop-blur-md z-30 transition-all hover:w-10 active:scale-95 group">
            <div className={`transition-transform duration-300 ${isSidebarOpen ? 'rotate-180' : 'rotate-0'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg></div>
        </button>
      </div>

      <Sidebar selectedNode={nodes.find(n => n.id === selectedId) || null} theme={currentTheme} isOpen={isSidebarOpen} onUpdate={updateNode} onDelete={deleteNode} onUnbind={(id) => updateNode(id, { boundTo: undefined })} onClose={() => setIsSidebarOpen(false)} selectedConnectionId={selectedConnectionId} onDeleteConnection={deleteConnection} />
    </div>
  );
};

export default App;