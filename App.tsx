
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { SynthNode, Position, Connection, NodeType } from './types';
import { Bubble } from './components/Bubble';
import { Sidebar } from './components/Sidebar';
import { audioEngine } from './services/audioEngine';

const MIN_FREQ = 0;
const MID_FREQ = 20;
const MAX_FREQ = 2000;

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
  const [nodes, setNodes] = useState<SynthNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBinding, setIsBinding] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);
  
  const dragStateRef = useRef<{ id: string, offsetX: number, offsetY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startAudio = () => {
    audioEngine.init();
    setIsStarted(true);
    const id = uuidv4();
    const x = 400;
    const freq = xToFreq(x, window.innerWidth - 320);
    const first: SynthNode = { id, type: 'OSC', subType: 'sine', pos: { x: 400, y: 300 }, size: 120, frequency: freq, modulators: [], color: 'purple', isAudible: true };
    setNodes([first]);
    audioEngine.createOscillator(id, first.subType as any, first.frequency, first.size / 300, true);
    setSelectedId(id);
  };

  const addNode = (type: NodeType) => {
    if (!isStarted) { startAudio(); return; }
    const id = uuidv4();
    const w = window.innerWidth - 320;
    const h = window.innerHeight;
    const x = 100 + Math.random() * (w - 200);
    const y = 100 + Math.random() * (h - 200);
    const freq = xToFreq(x, w);
    const newNode: SynthNode = {
      id,
      type,
      subType: type === 'OSC' ? 'sine' : 'filter-lp',
      pos: { x, y },
      size: 110,
      frequency: freq,
      modulators: [],
      color: type === 'OSC' ? 'purple' : 'emerald',
      isAudible: type === 'OSC'
    };
    
    setNodes(prev => [...prev, newNode]);
    if (type === 'OSC') {
        audioEngine.createOscillator(id, newNode.subType as any, newNode.frequency, newNode.size / 300, true);
    } else {
        audioEngine.createEffect(id, newNode.subType as any);
    }
    setSelectedId(id);
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioEngine.setMasterMute(nextMuted);
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
            // Re-connect all existing connections involving this node
            connections.forEach(conn => {
                if (conn.fromId === id || conn.toId === id) {
                    audioEngine.connectNodes(conn.fromId, conn.toId);
                }
            });
            const w = window.innerWidth - 320;
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
  }, [connections]);

  const applyFxParams = (node: SynthNode, w: number, h: number) => {
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
  };

  const deleteNode = useCallback((id: string) => {
    // Sever all audio connections first
    connections.forEach(c => {
      if (c.fromId === id || c.toId === id) {
        audioEngine.disconnectNodes(c.fromId, c.toId);
      }
    });

    setConnections(prev => prev.filter(c => c.fromId !== id && c.toId !== id));
    setNodes(prev => prev.filter(n => n.id !== id));
    
    audioEngine.removeNode(id);
    setSelectedId(null);
  }, [connections]);

  const deleteConnection = useCallback((id: string) => {
    setConnections(prev => {
        const conn = prev.find(c => c.id === id);
        if (conn) audioEngine.disconnectNodes(conn.fromId, conn.toId);
        return prev.filter(c => c.id !== id);
    });
    setSelectedConnectionId(null);
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
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedId, selectedConnectionId, deleteNode, deleteConnection]);

  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
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
        dragStateRef.current = { 
          id, 
          offsetX: e.clientX - node.pos.x, 
          offsetY: e.clientY - node.pos.y 
        };
      }
      return prev;
    });
  }, [isConnecting, isBinding, selectedId]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragStateRef.current) return;
    
    const { id, offsetX, offsetY } = dragStateRef.current;
    
    setNodes(prev => {
        const draggedNodeOrig = prev.find(n => n.id === id);
        if (!draggedNodeOrig) return prev;

        const w = window.innerWidth;
        const h = window.innerHeight;
        const halfSize = draggedNodeOrig.size / 2;

        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;

        newX = Math.max(halfSize, Math.min(w - 320 - halfSize, newX));
        newY = Math.max(halfSize, Math.min(h - halfSize, newY));

        const shiftX = newX - draggedNodeOrig.pos.x;
        const shiftY = newY - draggedNodeOrig.pos.y;

        return prev.map(n => {
            const isDragged = n.id === id;
            const isBound = n.boundTo === id;
            
            if (!isDragged && !isBound) return n;

            let updatedPos = isDragged 
              ? { x: newX, y: newY }
              : { x: n.pos.x + shiftX, y: n.pos.y + shiftY };

            const nHalfSize = n.size / 2;
            updatedPos.x = Math.max(nHalfSize, Math.min(w - 320 - nHalfSize, updatedPos.x));
            updatedPos.y = Math.max(nHalfSize, Math.min(h - nHalfSize, updatedPos.y));

            const updatedNode = { ...n, pos: updatedPos };
            if (n.type === 'OSC') {
                const freq = xToFreq(updatedPos.x, w - 320);
                audioEngine.updateParam(n.id, 'frequency', freq);
                updatedNode.frequency = freq;
            } else {
                applyFxParams(updatedNode, w - 320, h);
            }
            return updatedNode;
        });
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragStateRef.current = null;
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden text-white" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        
        {/* Signal Lines / Flux connections */}
        <svg className="absolute inset-0 pointer-events-none w-full h-full z-0">
          <defs>
            <linearGradient id="signalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0.4" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          {connections.map((conn) => {
            const from = nodes.find(n => n.id === conn.fromId);
            const to = nodes.find(n => n.id === conn.toId);
            if (!from || !to) return null;
            const isSel = selectedConnectionId === conn.id;
            const isHov = hoveredConnectionId === conn.id;
            const d = `M ${from.pos.x} ${from.pos.y} L ${to.pos.x} ${to.pos.y}`;
            const isFM = to.type === 'OSC';
            
            return (
              <g 
                key={conn.id} 
                className="pointer-events-auto cursor-pointer" 
                onClick={(e) => { e.stopPropagation(); setSelectedConnectionId(conn.id); setSelectedId(null); }}
                onMouseEnter={() => setHoveredConnectionId(conn.id)}
                onMouseLeave={() => setHoveredConnectionId(null)}
              >
                {/* Invisible hit area for easier selection */}
                <path 
                  d={d}
                  stroke="transparent" 
                  strokeWidth="30" 
                  className="cursor-pointer"
                  fill="none"
                />
                {/* Secondary glow on hover/select */}
                {(isSel || isHov) && (
                  <path 
                    d={d}
                    stroke="#fff" 
                    strokeWidth={isSel ? "8" : "6"} 
                    strokeOpacity="0.2"
                    filter="url(#glow)"
                    fill="none"
                  />
                )}
                <path 
                  d={d}
                  stroke={isSel ? "#fff" : "url(#signalGrad)"} 
                  strokeWidth={isSel ? "5" : "2"} 
                  strokeDasharray={isFM ? "2,2" : "10,5"} 
                  className={`transition-all ${isHov ? 'opacity-100' : 'opacity-60'}`}
                  fill="none"
                />
                <circle r="3" fill="#fff" filter="blur(1px)">
                    <animateMotion dur={isFM ? "0.8s" : "2s"} repeatCount="indefinite" path={d} />
                </circle>
              </g>
            );
          })}
        </svg>

        {nodes.map(node => {
          const hasIncoming = connections.some(c => c.toId === node.id);
          return (
            <Bubble 
                key={node.id} 
                node={node} 
                isSelected={selectedId === node.id} 
                isConnecting={isConnecting || isBinding} 
                hasIncoming={hasIncoming}
                onMouseDown={handleMouseDown} 
                onSelect={setSelectedId} 
            />
          );
        })}

        <div className="absolute top-8 left-8 flex gap-4 z-20">
            <button onClick={() => addNode('OSC')} className="px-6 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/40 rounded-full font-black tracking-widest text-[11px] shadow-2xl transition-all active:scale-95 uppercase border border-white/10 backdrop-blur-md">Oscillator</button>
            <button onClick={() => addNode('FX')} className="px-6 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/40 rounded-full font-black tracking-widest text-[11px] shadow-2xl transition-all active:scale-95 uppercase border border-white/10 backdrop-blur-md">Effect</button>
            <button onClick={() => {setIsConnecting(!isConnecting); setIsBinding(false);}} className={`px-6 py-2.5 ${isConnecting ? 'bg-white text-black' : 'bg-blue-600/20'} rounded-full font-black tracking-widest text-[11px] shadow-2xl uppercase transition-all border border-white/10 backdrop-blur-md`}>{isConnecting ? 'Cancel Route' : 'Route Flux'}</button>
            <button onClick={toggleMute} className={`px-4 py-2.5 rounded-full font-black tracking-widest text-[11px] shadow-2xl uppercase transition-all border border-white/10 backdrop-blur-md ${isMuted ? 'bg-red-600/40 text-red-100' : 'bg-white/5 text-white/60'}`}>
                {isMuted ? 'Unmute' : 'Mute All'}
            </button>
        </div>

        {/* frequency zones markers */}
        <div className="absolute inset-y-0 left-0 w-1/3 border-r border-white/5 pointer-events-none z-10 flex flex-col justify-end p-8">
          <div className="text-[10px] font-black uppercase text-white/5 tracking-[0.4em] rotate-180 [writing-mode:vertical-lr]">
            Granular Depth (0-20Hz)
          </div>
        </div>

        {(isConnecting || isBinding) && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-2xl px-12 py-4 rounded-full border border-white/20 text-[11px] font-black uppercase tracking-[0.3em] animate-pulse z-50">
                {isConnecting ? 'Link Signal Destination (Esc to cancel)' : 'Bind Mass Parent (Esc to cancel)'}
            </div>
        )}

        {!isStarted && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-3xl">
                <div className="flex flex-col items-center gap-12">
                  <button onClick={startAudio} className="px-24 py-10 border border-white/20 text-5xl font-black tracking-[0.5em] hover:bg-white hover:text-black transition-all duration-700 rounded-full uppercase shadow-[0_0_150px_rgba(255,255,255,0.1)] bg-white/5 group">
                    <span className="group-hover:scale-110 block transition-transform">Engage</span>
                  </button>
                  <p className="text-white/20 uppercase tracking-[0.4em] text-[10px] font-bold">Multi-voice drone synthesis engine</p>
                </div>
            </div>
        )}
      </div>

      <Sidebar 
        selectedNode={nodes.find(n => n.id === selectedId) || null}
        onUpdate={updateNode}
        onDelete={deleteNode}
        onBind={() => {setIsBinding(true); setIsConnecting(false);}}
        onUnbind={(id) => updateNode(id, { boundTo: undefined })}
        selectedConnectionId={selectedConnectionId}
        onDeleteConnection={deleteConnection}
      />
    </div>
  );
};

export default App;
