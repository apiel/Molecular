import React from 'react';
import { SynthNode, Theme } from '../types';

interface SidebarProps {
  selectedNode: SynthNode | null;
  theme: Theme;
  onUpdate: (id: string, updates: Partial<SynthNode>) => void;
  onDelete: (id: string) => void;
  onBind: () => void;
  onUnbind: (id: string) => void;
  selectedConnectionId: string | null;
  onDeleteConnection: (id: string) => void;
}

const COLOR_PRESETS = [
  '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#ffffff'
];

export const Sidebar: React.FC<SidebarProps> = ({ 
    selectedNode, 
    theme,
    onUpdate, 
    onDelete,
    onBind,
    onUnbind,
    selectedConnectionId,
    onDeleteConnection
}) => {
  if (selectedConnectionId) {
    return (
      <div className="w-80 glass-panel h-screen p-8 flex flex-col gap-8 border-l border-white/5">
        <h2 className="text-3xl font-black tracking-tighter uppercase leading-none">Connection</h2>
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <p className="text-[10px] opacity-50 uppercase font-black tracking-widest mb-4 leading-relaxed">
              Active flux transmitting signal between bubbles.
            </p>
            <button 
              onClick={() => onDeleteConnection(selectedConnectionId)}
              className="w-full py-4 bg-red-600/20 text-red-500 border border-red-500/50 hover:bg-red-600/30 rounded-lg text-xs font-black uppercase tracking-widest transition-all"
            >
              Sever Link
            </button>
        </div>
      </div>
    );
  }

  if (!selectedNode) {
    return (
      <div className="w-80 glass-panel h-screen p-8 flex flex-col justify-center items-center text-gray-400 border-l border-white/5">
        <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 mb-4 animate-spin duration-[10s]" />
        <p className="text-center font-black uppercase tracking-[0.2em] text-[10px] opacity-30">Selection Required</p>
      </div>
    );
  }

  const isOsc = selectedNode.type === 'OSC';

  const getMappingInfo = () => {
    const w = window.innerWidth - 320;
    const h = window.innerHeight;
    const x = selectedNode.pos.x;
    const y = selectedNode.pos.y;

    if (isOsc) {
      if (selectedNode.subType === 'noise') {
        return { 
          x: 'Density', 
          xVal: 'Wideband', 
          y: 'Unused', 
          yVal: 'N/A',
          xPercent: 100,
          yPercent: 0
        };
      }
      return { 
        x: 'Frequency', 
        xVal: `${selectedNode.frequency.toFixed(3)} Hz`, 
        y: 'Unused', 
        yVal: 'N/A',
        xPercent: (x / w) * 100,
        yPercent: 0
      };
    }

    switch (selectedNode.subType) {
        case 'filter-lp': 
        case 'filter-hp':
        case 'filter-bp':
          return { 
            x: 'Cutoff', 
            xVal: `${(Math.max(0.1, x / w) * 5000).toFixed(0)} Hz`, 
            y: 'Resonance', 
            yVal: ((h - y) / 40).toFixed(2),
            xPercent: (x / w) * 100,
            yPercent: ((h - y) / h) * 100
          };
        case 'delay': 
          return { 
            x: 'Time', 
            xVal: `${(x / w * 2).toFixed(2)}s`, 
            y: 'Feedback', 
            yVal: ((h - y) / h).toFixed(2),
            xPercent: (x / w) * 100,
            yPercent: ((h - y) / h) * 100
          };
        case 'distortion': 
          return { 
            x: 'Amount', 
            xVal: ((x / w) * 5).toFixed(2), 
            y: 'Shape (Curve)', 
            yVal: ((h - y) / 5).toFixed(0),
            xPercent: (x / w) * 100,
            yPercent: ((h - y) / h) * 100
          };
        case 'phaser':
          return {
            x: 'Speed',
            xVal: `${((x / w) * 10).toFixed(2)} Hz`,
            y: 'Depth',
            yVal: ((h - y) / h * 2000).toFixed(0),
            xPercent: (x / w) * 100,
            yPercent: ((h - y) / h) * 100
          };
        case 'tremolo':
          return {
            x: 'Rate',
            xVal: `${((x / w) * 20).toFixed(2)} Hz`,
            y: 'Intensity',
            yVal: ((h - y) / h).toFixed(2),
            xPercent: (x / w) * 100,
            yPercent: ((h - y) / h) * 100
          };
        case 'bitcrusher':
          return {
            x: 'X-Unused',
            xVal: '---',
            y: 'Bit Depth',
            yVal: (Math.max(1, (h - y) / h * 16)).toFixed(1),
            xPercent: 0,
            yPercent: ((h - y) / h) * 100
          };
        case 'chorus':
          return {
            x: 'Mod Rate',
            xVal: `${((x / w) * 5).toFixed(2)} Hz`,
            y: 'Intensity',
            yVal: ((h - y) / h * 100).toFixed(1) + '%',
            xPercent: (x / w) * 100,
            yPercent: ((h - y) / h) * 100
          };
        case 'reverb':
            return {
                x: 'Position X',
                xVal: 'Room Ref',
                y: 'Diffusion',
                yVal: ((h - y) / h).toFixed(2),
                xPercent: (x/w) * 100,
                yPercent: ((h - y) / h) * 100
            };
        default: 
          return { x: 'Primary', xVal: '...', y: 'Secondary', yVal: '...', xPercent: 50, yPercent: 50 };
    }
  };

  const map = getMappingInfo();

  return (
    <div className="w-80 glass-panel h-screen p-8 flex flex-col gap-6 border-l border-white/5 animate-in slide-in-from-right duration-500 overflow-y-auto z-30">
      <header className="border-b border-white/10 pb-4">
        <h2 className="text-4xl font-black tracking-tighter uppercase leading-none">{selectedNode.type}</h2>
        <span className="text-[10px] opacity-30 font-mono block mt-2 tracking-widest">{selectedNode.id.slice(0, 12)}</span>
      </header>

      <section className="space-y-6 flex-1">
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
          <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Audio</span>
          <div className="flex gap-4">
              <button 
                onClick={() => onUpdate(selectedNode.id, { isAudible: !selectedNode.isAudible })}
                className={`w-12 h-6 rounded-full transition-all relative ${selectedNode.isAudible ? 'shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'opacity-40'}`}
                style={{ background: selectedNode.isAudible ? theme.colors.accent : '#333' }}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${selectedNode.isAudible ? 'left-[26px]' : 'left-0.5'}`} />
              </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase opacity-40 tracking-[0.2em] block">Atmospheric Hue</label>
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="flex flex-wrap gap-2 mb-4">
                  {COLOR_PRESETS.map(c => (
                      <button 
                          key={c}
                          onClick={() => onUpdate(selectedNode.id, { color: c })}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${selectedNode.color === c ? 'border-white scale-125' : 'border-transparent opacity-60 hover:opacity-100'}`}
                          style={{ backgroundColor: c }}
                      />
                  ))}
              </div>
              <div className="flex items-center gap-3">
                  <input 
                      type="color" 
                      value={selectedNode.color}
                      onChange={(e) => onUpdate(selectedNode.id, { color: e.target.value })}
                      className="w-10 h-8 bg-transparent border-none cursor-pointer"
                  />
                  <span className="text-[10px] font-mono opacity-50 uppercase">{selectedNode.color}</span>
              </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase opacity-40 tracking-[0.2em] block">Profile</label>
          <div className="relative">
            <select 
                className="w-full bg-black border border-white/20 rounded-xl p-4 text-xs focus:outline-none focus:ring-2 appearance-none font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors text-white"
                style={{ borderColor: theme.colors.accent }}
                value={selectedNode.subType}
                onChange={(e) => onUpdate(selectedNode.id, { subType: e.target.value as any })}
            >
                {isOsc ? (
                <>
                    <option value="sine">Sine Wave</option>
                    <option value="square">Square Wave</option>
                    <option value="sawtooth">Sawtooth Wave</option>
                    <option value="triangle">Triangle Wave</option>
                    <option value="noise">White Noise</option>
                    <option value="sample-hold">Sample & Hold</option>
                </>
                ) : (
                <>
                    <option value="filter-lp">Low-Pass Filter</option>
                    <option value="filter-hp">High-Pass Filter</option>
                    <option value="filter-bp">Band-Pass Filter</option>
                    <option value="delay">Echo Delay</option>
                    <option value="distortion">Hard Distortion</option>
                    <option value="bitcrusher">Bitcrusher</option>
                    <option value="phaser">Liquid Phaser</option>
                    <option value="chorus">Deep Chorus</option>
                    <option value="tremolo">Wave Tremolo</option>
                    <option value="reverb">Space Reverb</option>
                </>
                )}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 text-[8px] font-black">▼</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2 shadow-inner">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-40">
              <span>X: {map.x}</span>
              <span className="opacity-100 tabular-nums">{map.xVal}</span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full transition-all duration-75 shadow-lg" style={{ width: `${map.xPercent}%`, background: selectedNode.color || theme.colors.accent }} />
            </div>
          </div>

          <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2 shadow-inner">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-40">
              <span>Y: {map.y}</span>
              <span className="opacity-100 tabular-nums">{map.yVal}</span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full transition-all duration-75 shadow-lg" style={{ width: `${map.yPercent}%`, background: theme.colors.connEnd }} />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase opacity-40 tracking-[0.2em] block">AMPLITUDE</label>
          <input 
            type="range" min="40" max="400" value={selectedNode.size}
            onChange={(e) => onUpdate(selectedNode.id, { size: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
          />
        </div>

        <div className="pt-2 flex flex-col gap-3">
            <button 
                onClick={() => selectedNode.boundTo ? onUnbind(selectedNode.id) : onBind()}
                className={`w-full py-4 rounded-xl text-[10px] font-black tracking-widest transition-all uppercase shadow-lg ${selectedNode.boundTo ? 'bg-amber-600/20 text-amber-500 border border-amber-500/50 hover:bg-amber-600/30' : 'bg-white/5 hover:bg-white/10 border border-white/10'}`}
            >
                {selectedNode.boundTo ? 'Release Binding' : 'Bind to Parent'}
            </button>
            <button 
                onClick={() => onDelete(selectedNode.id)}
                className="w-full py-4 bg-red-600/20 text-red-500 border border-red-500/50 hover:bg-red-600/40 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
            >
                DELETE MOLECULE
            </button>
        </div>
      </section>

      <footer className="p-5 bg-white/5 rounded-2xl border border-white/5 text-[9px] opacity-30 uppercase tracking-[0.2em] font-black mt-auto text-center leading-relaxed">
        Spatial coordinates mapped to spectral flux.
      </footer>
    </div>
  );
};