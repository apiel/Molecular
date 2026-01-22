import React from 'react';
import { SynthNode, Theme } from '../types';

interface SidebarProps {
  selectedNode: SynthNode | null;
  theme: Theme;
  isOpen: boolean;
  onUpdate: (id: string, updates: Partial<SynthNode>) => void;
  onDelete: (id: string) => void;
  onUnbind: (id: string) => void;
  onClose: () => void;
  selectedConnectionId: string | null;
  onDeleteConnection: (id: string) => void;
}

const COLOR_PRESETS = [
  '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#ffffff'
];

export const Sidebar: React.FC<SidebarProps> = ({ 
    selectedNode, 
    theme,
    isOpen,
    onUpdate, 
    onDelete,
    onUnbind,
    onClose,
    selectedConnectionId,
    onDeleteConnection
}) => {
  const sidebarClasses = `
    fixed lg:relative top-0 right-0 h-screen w-full lg:w-80 glass-panel p-8 flex flex-col gap-6 
    border-l border-white/5 z-40 transition-transform duration-300 overflow-y-auto
    ${isOpen ? 'translate-x-0' : 'translate-x-full lg:hidden'}
  `;

  if (!isOpen) return null;

  const renderContent = () => {
    if (selectedConnectionId) {
      return (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-black tracking-tighter uppercase leading-none">Flux Link</h2>
            <button onClick={onClose} className="p-2 text-white/50 font-black text-xs border border-white/10 rounded-lg hover:bg-white/5 transition-colors">CLOSE</button>
          </div>
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-[10px] opacity-50 uppercase font-black tracking-widest mb-4 leading-relaxed">
                Active flux transmitting signal between molecules.
              </p>
              <button 
                onClick={() => { onDeleteConnection(selectedConnectionId); }}
                className="w-full py-4 bg-red-600/20 text-red-500 border border-red-500/50 hover:bg-red-600/30 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
              >
                Sever Link
              </button>
          </div>
        </>
      );
    }

    if (!selectedNode) {
      return (
        <>
          <div className="flex justify-end">
            <button onClick={onClose} className="p-2 text-white/50 font-black text-xs border border-white/10 rounded-lg hover:bg-white/5 transition-colors">CLOSE</button>
          </div>
          <div className="flex-1 flex flex-col justify-center items-center text-gray-400">
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-white/10 mb-8 flex items-center justify-center animate-pulse">
               <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <p className="text-center font-black uppercase tracking-[0.2em] text-[10px] opacity-30 px-8 leading-loose">
              Select a molecule or flux link to modify structure
            </p>
          </div>
        </>
      );
    }

    const isOsc = selectedNode.type === 'OSC';
    const isLFO = isOsc && !selectedNode.isAudible;

    const getMappingInfo = () => {
        const w = window.innerWidth < 1024 ? window.innerWidth : window.innerWidth - 320;
        const h = window.innerHeight;
        const x = selectedNode.pos.x;
        const y = selectedNode.pos.y;

        if (isOsc) {
            return { 
                x: selectedNode.subType === 'noise' ? 'Morph' : 'Freq (World)', 
                xVal: selectedNode.subType === 'noise' ? (x/w).toFixed(2) : `${selectedNode.frequency.toFixed(1)} Hz`, 
                y: 'Depth', yVal: 'N/A',
                xPercent: (x / w) * 100, yPercent: 0
            };
        }
        return { 
            x: 'Param A', xVal: (x/w).toFixed(2), 
            y: 'Param B', yVal: ((h-y)/h).toFixed(2),
            xPercent: (x/w)*100, yPercent: ((h-y)/h)*100
        };
    };
    const map = getMappingInfo();

    return (
        <>
          <header className="border-b border-white/10 pb-4 flex justify-between items-start">
            <div>
                <h2 className="text-4xl font-black tracking-tighter uppercase leading-none">{isLFO ? 'LFO' : selectedNode.type}</h2>
                <span className="text-[10px] opacity-30 font-mono block mt-2 tracking-widest">{selectedNode.id.slice(0, 12)}</span>
            </div>
            <button onClick={onClose} className="p-2 text-white/50 font-black text-xs border border-white/10 rounded-lg hover:bg-white/5 transition-colors">CLOSE</button>
          </header>

          <section className="space-y-6 flex-1">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Master Feed</span>
              <button 
                onClick={() => onUpdate(selectedNode.id, { isAudible: !selectedNode.isAudible })}
                className={`w-12 h-6 rounded-full transition-all relative ${selectedNode.isAudible ? 'shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'opacity-40'}`}
                style={{ background: selectedNode.isAudible ? theme.colors.accent : '#333' }}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${selectedNode.isAudible ? 'left-[26px]' : 'left-0.5'}`} />
              </button>
            </div>

            {isLFO && (
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl">
                 <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Status: Modulation Mode</p>
                 <p className="text-[8px] opacity-50 uppercase mt-1 leading-tight">Molecule is silent but vibrates its connections.</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase opacity-40 tracking-[0.2em] block">Molecule Hue</label>
              <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex flex-wrap gap-2">
                  {COLOR_PRESETS.map(c => (
                      <button 
                          key={c}
                          onClick={() => onUpdate(selectedNode.id, { color: c })}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${selectedNode.color === c ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                          style={{ backgroundColor: c }}
                      />
                  ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase opacity-40 tracking-[0.2em] block">Sound Profile</label>
              <div className="relative">
                <select 
                    className="w-full bg-black border border-white/20 rounded-xl p-4 text-xs font-black uppercase tracking-widest cursor-pointer text-white appearance-none hover:bg-white/5 transition-colors"
                    value={selectedNode.subType}
                    onChange={(e) => onUpdate(selectedNode.id, { subType: e.target.value as any })}
                >
                    {isOsc ? (
                    <>
                        <option className="bg-zinc-900" value="sine">Sine</option>
                        <option className="bg-zinc-900" value="square">Square</option>
                        <option className="bg-zinc-900" value="sawtooth">Saw</option>
                        <option className="bg-zinc-900" value="triangle">Triangle</option>
                        <option className="bg-zinc-900" value="noise">Noise</option>
                        <option className="bg-zinc-900" value="sample-hold">Sample & Hold</option>
                    </>
                    ) : (
                    <>
                        <option className="bg-zinc-900" value="filter-lp">LP Filter</option>
                        <option className="bg-zinc-900" value="filter-hp">HP Filter</option>
                        <option className="bg-zinc-900" value="delay">Echo Delay</option>
                        <option className="bg-zinc-900" value="distortion">Hard Distortion</option>
                        <option className="bg-zinc-900" value="reverb">Space Reverb</option>
                        <option className="bg-zinc-900" value="phaser">Liquid Phaser</option>
                        <option className="bg-zinc-900" value="chorus">Deep Chorus</option>
                        <option className="bg-zinc-900" value="tremolo">Wave Tremolo</option>
                        <option className="bg-zinc-900" value="bitcrusher">Degrade</option>
                    </>
                    )}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 text-[8px]">▼</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-40">
                  <span>X: {map.x}</span>
                  <span className="opacity-100 font-mono">{map.xVal}</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-75" style={{ width: `${map.xPercent}%`, background: selectedNode.color || theme.colors.accent }} />
                </div>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-40">
                  <span>Y: {map.y}</span>
                  <span className="opacity-100 font-mono">{map.yVal}</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-75" style={{ width: `${map.yPercent}%`, background: theme.colors.connEnd }} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase opacity-40 tracking-[0.2em] block">Intensity / Gain</label>
              <input 
                type="range" min="40" max="400" value={selectedNode.size}
                onChange={(e) => onUpdate(selectedNode.id, { size: parseInt(e.target.value) })}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
              />
            </div>

            <div className="pt-2 flex flex-col gap-3">
                {selectedNode.boundTo && (
                    <button 
                        onClick={() => onUnbind(selectedNode.id)}
                        className="w-full py-4 rounded-xl text-[10px] font-black tracking-widest uppercase border bg-amber-600/20 border-amber-500/50 hover:bg-amber-600/30 text-amber-500 transition-all"
                    >
                        Release Parent Link
                    </button>
                )}
                <button 
                    onClick={() => { onDelete(selectedNode.id); }}
                    className="w-full py-4 bg-red-600/20 text-red-500 border border-red-500/50 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all"
                >
                    Deconstruct Molecule
                </button>
            </div>
          </section>
        </>
    );
  };

  return (
    <div className={sidebarClasses}>
      {renderContent()}
    </div>
  );
};