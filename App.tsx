
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { SynthNode, Position, Connection, NodeType } from './types';
import { Bubble } from './components/Bubble';
import { Sidebar } from './components/Sidebar';
import { audioEngine } from './services/audioEngine';

const MIN_FREQ = 0.05; // Almost 0 for LFO
const MAX_FREQ = 2000;

const xToFreq = (x: number, width: number) => {
  const normX = Math.max(0.001, Math.min(1, x / width));
  // Logarithmic mapping: lower values are more granular
  return MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, normX);
};

const App: React.FC = () => {
  const [nodes, setNodes] = useState<SynthNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBinding, setIsBinding] = useState(false);
  
  // Using a ref for drag state to minimize closures and overhead
  const dragStateRef = useRef<{ id: string, startX: number, startY: number, initialPos: Position } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startAudio = () => {
    audioEngine.init();
    setIsStarted(true);
    const id = uuidv4();
    const freq = xToFreq(400, window.innerWidth);
    const first: SynthNode = { id, type: 'OSC', subType: 'sine', pos: { x: 400, y: 300 }, size: 120, frequency: freq, modulators: [], color: 'purple', isAudible: true };
    setNodes([first]);
    audioEngine.createOscillator(id, first.subType as any, first.frequency, first.size / 300, true);
    setSelectedId(id);
  };

  const addNode = (type: NodeType) => {
    if (!isStarted) { startAudio(); return; }
    const id = uuidv4();
    const x = 100 + Math.random() * 400;
    const freq = xToFreq(x, window.innerWidth);
    const newNode: SynthNode = {
      id,
      type,
      subType: type === 'OSC' ? 'sine' : 'filter',
      pos: { x, y: 100 + Math.random() * 400 },
      size: 100,
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

  const updateNode = useCallback((id: string, updates: Partial<SynthNode>) => {
    setNodes(prev => prev.map(n => {
      if (n.id === id) {
        const updated = { ...n, ...updates };
        if (updates.isAudible !== undefined) audioEngine.updateAudible(id, updates.isAudible);
        if (updates.size !== undefined) {
            const val = updated.size / 300;
            audioEngine.updateParam(id, updated.type === 'OSC' ? 'gain' : 'intensity', val);
        }
        if (updates.frequency !== undefined) audioEngine.updateParam(id, 'frequency', updated.frequency);
        return updated;
      }
      return n;
    }));
  }, []);

  const deleteNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setConnections(prev => {
      prev.filter(c => c.fromId === id || c.toId === id).forEach(c => audioEngine.disconnectNodes(c.fromId, c.toId));
      return prev.filter(c => c.fromId !== id && c.toId !== id);
    });
    audioEngine.removeNode(id);
    setSelectedId(null);
  }, []);

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
        dragStateRef.current = { id, startX: e.clientX, startY: e.clientY, initialPos: { ...node.pos } };
      }
      return prev;
    });
  }, [isConnecting, isBinding, selectedId]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragStateRef.current) return;
    
    const { id, startX, startY, initialPos } = dragStateRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    setNodes(prev => {
        const draggedNodeOrig = prev.find(n => n.id === id);
        if (!draggedNodeOrig) return prev;

        const newX = initialPos.x + dx;
        const newY = initialPos.y + dy;
        const oldX = draggedNodeOrig.pos.x;
        const oldY = draggedNodeOrig.pos.y;
        const shiftX = newX - oldX;
        const shiftY = newY - oldY;

        const w = window.innerWidth;
        const h = window.innerHeight;

        return prev.map(n => {
            const isDragged = n.id === id;
            const isBound = n.boundTo === id;
            
            if (!isDragged && !isBound) return n;

            const updatedPos = isDragged 
              ? { x: newX, y: newY }
              : { x: n.pos.x + shiftX, y: n.pos.y + shiftY };

            // Update Audio parameters immediately
            if (n.type === 'OSC') {
                const freq = xToFreq(updatedPos.x, w);
                audioEngine.updateParam(n.id, 'frequency', freq);
                return { ...n, pos: updatedPos, frequency: freq };
            } else {
                if (n.subType === 'filter') {
                    audioEngine.updateParam(n.id, 'cutoff', xToFreq(updatedPos.x, w) * 5);
                    audioEngine.updateParam(n.id, 'resonance', (h - updatedPos.y) / 40);
                } else if (n.subType === 'delay') {
                    audioEngine.updateParam(n.id, 'time', updatedPos.x / w * 2);
                    audioEngine.updateParam(n.id, 'feedback', (h - updatedPos.y) / h);
                } else if (n.subType === 'distortion') {
                    audioEngine.updateParam(n.id, 'amount', (updatedPos.x / w) * 5);
                    audioEngine.updateParam(n.id, 'distortionCurve', (h - updatedPos.y) / 5);
                }
                return { ...n, pos: updatedPos };
            }
        });
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragStateRef.current = null;
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-white" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[radial-gradient(circle_at_center,_#111_0%,_#000_100%)]">
        <svg className="absolute inset-0 pointer-events-none w-full h-full z-0">
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#818cf8" /><stop offset="100%" stopColor="#34d399" />
            </linearGradient>
            <marker id="arrow" viewBox="0 0 10 10" refX="25" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#fff" />
            </marker>
          </defs>
          {connections.map((conn) => {
            const from = nodes.find(n => n.id === conn.fromId);
            const to = nodes.find(n => n.id === conn.toId);
            if (!from || !to) return null;
            const isSel = selectedConnectionId === conn.id;
            const d = `M ${from.pos.x} ${from.pos.y} L ${to.pos.x} ${to.pos.y}`;
            const isFM = to.type === 'OSC';
            
            return (
              <g key={conn.id} className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedConnectionId(conn.id); setSelectedId(null); }}>
                <path 
                  d={d}
                  stroke={isSel ? "#fff" : "url(#lineGrad)"} 
                  strokeWidth={isSel ? "6" : "2"} 
                  strokeDasharray={isFM ? "2,2" : "8,4"} 
                  markerEnd="url(#arrow)"
                  className="opacity-40 transition-all hover:opacity-100"
                  fill="none"
                />
                {/* Moving Flux Particles */}
                <circle r="3" fill={isFM ? "#fcd34d" : "#fff"}>
                    <animateMotion dur={isFM ? "0.8s" : "1.5s"} repeatCount="indefinite" path={d} />
                </circle>
                <circle r="2" fill={isFM ? "#fcd34d" : "#fff"} opacity="0.5">
                    <animateMotion dur={isFM ? "0.8s" : "1.5s"} repeatCount="indefinite" path={d} begin="0.4s" />
                </circle>
              </g>
            );
          })}
        </svg>

        {nodes.map(node => (
          <Bubble key={node.id} node={node} isSelected={selectedId === node.id} isConnecting={isConnecting || isBinding} onMouseDown={handleMouseDown} onSelect={setSelectedId} />
        ))}

        <div className="absolute top-8 left-8 flex gap-3 z-20">
            <button onClick={() => addNode('OSC')} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-full font-black tracking-widest text-[10px] shadow-lg transition-all active:scale-95 uppercase">Add OSC</button>
            <button onClick={() => addNode('FX')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-full font-black tracking-widest text-[10px] shadow-lg transition-all active:scale-95 uppercase">Add FX</button>
            <button onClick={() => {setIsConnecting(!isConnecting); setIsBinding(false);}} className={`px-4 py-2 ${isConnecting ? 'bg-white text-black' : 'bg-blue-600'} rounded-full font-black tracking-widest text-[10px] shadow-lg uppercase transition-all`}>{isConnecting ? 'Cancel' : 'Link Signal'}</button>
        </div>

        {(isConnecting || isBinding) && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-xl px-8 py-3 rounded-full border border-white/20 text-[10px] font-black uppercase tracking-widest animate-pulse z-50">
                {isConnecting ? 'Select destination bubble...' : 'Select parent bubble to bind to...'}
            </div>
        )}

        {!isStarted && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-2xl">
                <button onClick={startAudio} className="px-16 py-8 border-[3px] border-white text-5xl font-black tracking-[0.3em] hover:bg-white hover:text-black transition-all duration-700 rounded-full uppercase shadow-[0_0_100px_rgba(255,255,255,0.2)]">Engage</button>
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
