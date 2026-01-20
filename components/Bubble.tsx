
import React, { useMemo } from 'react';
import { SynthNode } from '../types';

interface BubbleProps {
  node: SynthNode;
  isSelected: boolean;
  isConnecting: boolean;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onSelect: (id: string) => void;
}

export const Bubble: React.FC<BubbleProps> = React.memo(({ 
  node, 
  isSelected, 
  isConnecting,
  onMouseDown, 
  onSelect 
}) => {
  const bubbleStyles = useMemo(() => {
    const base = "absolute rounded-full flex flex-col items-center justify-center cursor-move select-none overflow-hidden";
    const border = isSelected ? "border-[6px] border-white shadow-[0_0_50px_rgba(255,255,255,0.4)]" : "border-2 border-white/10 shadow-xl";
    const bg = node.type === 'OSC' 
        ? (node.isAudible ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : 'bg-gradient-to-br from-slate-700 to-slate-900') 
        : 'bg-gradient-to-br from-emerald-500 to-teal-700';
    return `${base} ${border} ${bg}`;
  }, [isSelected, node.type, node.isAudible]);

  return (
    <div
      className={bubbleStyles}
      style={{
        left: node.pos.x - node.size / 2,
        top: node.pos.y - node.size / 2,
        width: node.size,
        height: node.size,
        opacity: isConnecting && !isSelected ? 0.7 : 1,
        transform: isSelected ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 0.2s ease, border-color 0.2s ease, shadow 0.2s ease', // Removed transition for left/top for performance
        willChange: 'left, top, transform'
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onMouseDown(e, node.id);
        onSelect(node.id);
      }}
    >
      <div className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none" />
      <div className="z-10 text-center text-[9px] font-black uppercase tracking-tighter drop-shadow-md leading-none">
        <div className="opacity-50 mb-1">{node.type}</div>
        <div className="truncate w-full px-2">{node.subType}</div>
      </div>
      
      {node.isAudible && node.type === 'OSC' && (
        <div className="absolute top-1 w-2 h-2 rounded-full bg-white animate-ping" />
      )}

      {node.boundTo && (
        <div className="absolute bottom-2 bg-white/20 text-[7px] px-1 rounded-sm font-black text-white">
          BOUND
        </div>
      )}
    </div>
  );
});
