
import React from 'react';
import { SynthNode } from '../types';

interface SidebarProps {
  selectedNode: SynthNode | null;
  onUpdate: (id: string, updates: Partial<SynthNode>) => void;
  onDelete: (id: string) => void;
  onBind: () => void;
  onUnbind: (id: string) => void;
  selectedConnectionId: string | null;
  onDeleteConnection: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
    selectedNode, 
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
            <p className="text-[10px] text-white/50 uppercase font-black tracking-widest mb-4 leading-relaxed">
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
    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = selectedNode.pos.x;
    const y = selectedNode.pos.y;

    if (isOsc) {
      return { 
        x: 'Frequency', 
        xVal: `${selectedNode.frequency.toFixed(2)} Hz`, 
        y: 'Unused', 
        yVal: 'N/A' 
      };
    }

    switch (selectedNode.subType) {
        case 'filter': 
          return { 
            x: 'Cutoff', 
            xVal: `${(Math.max(0.1, x / w) * 10000).toFixed(0)} Hz`, 
            y: 'Resonance', 
            yVal: ((h - y) / 40).toFixed(2) 
          };
        case 'delay': 
          return { 
            x: 'Time', 
            xVal: `${(x / w * 2).toFixed(2)}s`, 
            y: 'Feedback', 
            yVal: ((h - y) / h).toFixed(2) 
          };
        case 'distortion': 
          return { 
            x: 'Amount', 
            xVal: ((x / w) * 5).toFixed(2), 
            y: 'Shape', 
            yVal: ((h - y) / 5).toFixed(0) 
          };
        default: 
          return { x: 'Primary', xVal: '...', y: 'Secondary', yVal: '...' };
    }
  };

  const map = getMappingInfo();

  return (
    <div className="w-80 glass-panel h-screen p-8 flex flex-col gap-8 border-l border-white/5 animate-in slide-in-from-right duration-500 overflow-y-auto">
      <header className="border-b border-white/10 pb-6">
        <h2 className="text-4xl font-black tracking-tighter uppercase leading-none">{selectedNode.type}</h2>
        <span className="text-[10px] text-white/30 font-mono block mt-2 tracking-widest">{selectedNode.id.slice(0, 12)}</span>
      </header>

      <section className="space-y-6 flex-1">
        {isOsc && (
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
            <span className="text-[10px] font-black uppercase tracking-widest">Master Out</span>
            <button 
              onClick={() => onUpdate(selectedNode.id, { isAudible: !selectedNode.isAudible })}
              className={`w-14 h-7 rounded-full transition-all relative ${selectedNode.isAudible ? 'bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.5)]' : 'bg-gray-800'}`}
            >
              <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${selectedNode.isAudible ? 'left-8' : 'left-1'}`} />
            </button>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] block">Waveform Profile</label>
          <select 
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none font-black uppercase tracking-widest cursor-pointer hover:bg-white/10 transition-colors text-white"
            value={selectedNode.subType}
            onChange={(e) => onUpdate(selectedNode.id, { subType: e.target.value as any })}
          >
            {isOsc ? (
              <>
                <option value="sine" className="bg-[#1a1a1a]">Pure Sine</option>
                <option value="square" className="bg-[#1a1a1a]">Hard Square</option>
                <option value="sawtooth" className="bg-[#1a1a1a]">Aggro Saw</option>
                <option value="triangle" className="bg-[#1a1a1a]">Soft Triangle</option>
              </>
            ) : (
              <>
                <option value="filter" className="bg-[#1a1a1a]">Spectral Filter</option>
                <option value="delay" className="bg-[#1a1a1a]">Time Warp Delay</option>
                <option value="distortion" className="bg-[#1a1a1a]">Grit Distortion</option>
                <option value="reverb" className="bg-[#1a1a1a]">Deep Space Reverb</option>
              </>
            )}
          </select>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] block">Bubble Magnitude</label>
          <input 
            type="range" min="40" max="400" value={selectedNode.size}
            onChange={(e) => onUpdate(selectedNode.id, { size: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
          />
          <div className="text-[9px] font-bold text-white/30 text-right uppercase">Volume/Presence</div>
        </div>

        {/* Real-time Parameter View */}
        <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-4">
            <div className="text-center">
                <label className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] block mb-1">X-Axis ({map.x})</label>
                <div className="text-xl font-black text-white tabular-nums tracking-tighter">{map.xVal}</div>
            </div>
            {!isOsc && (
                <div className="text-center border-t border-white/10 pt-4">
                    <label className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] block mb-1">Y-Axis ({map.y})</label>
                    <div className="text-xl font-black text-white tabular-nums tracking-tighter">{map.yVal}</div>
                </div>
            )}
        </div>

        <div className="pt-2 flex flex-col gap-3">
            <button 
                onClick={() => selectedNode.boundTo ? onUnbind(selectedNode.id) : onBind()}
                className={`w-full py-4 rounded-xl text-[10px] font-black tracking-widest transition-all uppercase ${selectedNode.boundTo ? 'bg-amber-600/20 text-amber-500 border border-amber-500/50' : 'bg-white/5 hover:bg-white/10 border border-white/10'}`}
            >
                {selectedNode.boundTo ? 'Release Binding' : 'Bind to Parent'}
            </button>
            <button 
                onClick={() => onDelete(selectedNode.id)}
                className="w-full py-4 bg-red-600/20 text-red-500 border border-red-500/50 hover:bg-red-600/40 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
                Destroy Bubble
            </button>
        </div>
      </section>

      <footer className="p-5 bg-white/5 rounded-2xl border border-white/5 text-[9px] text-white/30 uppercase tracking-[0.2em] font-black mt-auto">
        <p className="mb-2 text-white/50 text-center uppercase tracking-widest">Help</p>
        <div className="text-[8px] leading-relaxed text-center opacity-80">
            Drag bubbles horizontally to sweep the first parameter. Drag vertically for the second. Bind bubbles to move them in unison.
        </div>
      </footer>
    </div>
  );
};
