
import React, { useMemo } from 'react';
import { SynthNode, Theme } from '../types';

interface BubbleProps {
  node: SynthNode;
  isSelected: boolean;
  isConnecting: boolean;
  hasIncoming: boolean;
  theme: Theme;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onSelect: (id: string) => void;
}

export const Bubble: React.FC<BubbleProps> = React.memo(({ 
  node, 
  isSelected, 
  isConnecting,
  hasIncoming,
  theme,
  onMouseDown, 
  onSelect 
}) => {
  const bubbleStyles = useMemo(() => {
    const base = "absolute flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none overflow-hidden liquid-surface";
    const border = isSelected ? "border-[3px] border-white shadow-[0_0_60px_rgba(255,255,255,0.3)]" : "border border-white/10 shadow-2xl";
    return `${base} ${border}`;
  }, [isSelected]);

  const backgroundStyle = useMemo(() => {
    if (!node.isAudible && node.type === 'OSC') {
      return { background: '#18181b', opacity: 0.6 }; 
    }

    // Use the node's custom color if available, otherwise fallback to theme defaults
    const baseColor = node.color || (node.type === 'OSC' ? theme.colors.oscStart : theme.colors.fxStart);
    
    // Create a deep gradient from the custom color
    return { 
      background: `linear-gradient(135deg, ${baseColor} 0%, rgba(0,0,0,0.6) 150%)`,
      boxShadow: `inset 0 0 20px ${baseColor}44, 0 10px 30px rgba(0,0,0,0.5)`
    };
  }, [node.type, node.isAudible, node.color, theme]);

  const rippleDuration = node.type === 'OSC' 
    ? Math.max(0.5, Math.min(4, 15 / (Math.log10(node.frequency + 1) * 5 + 1))) 
    : 3;

  const showRipples = (node.type === 'OSC' && node.isAudible) || (node.type === 'FX' && hasIncoming);

  return (
    <div
      className={bubbleStyles}
      style={{
        left: node.pos.x - node.size / 2,
        top: node.pos.y - node.size / 2,
        width: node.size,
        height: node.size,
        opacity: isConnecting && !isSelected ? 0.4 : 1,
        transform: isSelected ? 'scale(1.1)' : 'scale(1)',
        willChange: 'left, top, transform',
        zIndex: isSelected ? 40 : 20,
        transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        ...backgroundStyle
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onMouseDown(e, node.id);
        onSelect(node.id);
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 pointer-events-none" />

      {showRipples && (
        <>
          <div 
            className="ripple" 
            style={{ 
                animationDuration: `${rippleDuration}s`,
                width: node.size * 0.2,
                height: node.size * 0.2,
                borderColor: `${node.color}66`
            }} 
          />
          <div 
            className="ripple ripple-delayed" 
            style={{ 
                animationDuration: `${rippleDuration}s`,
                animationDelay: `${rippleDuration / 2}s`,
                width: node.size * 0.2,
                height: node.size * 0.2,
                borderColor: `${node.color}44`
            }} 
          />
        </>
      )}

      <div className="z-10 text-center pointer-events-none px-2">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-0.5 leading-none">
          {node.type}
        </div>
        <div className="text-[11px] font-black text-white uppercase tracking-tight truncate drop-shadow-lg">
          {node.subType.replace('filter-', '')}
        </div>
      </div>
      
      {node.boundTo && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-sm text-[7px] px-1.5 py-0.5 rounded-full font-black text-white uppercase tracking-tighter">
          Linked
        </div>
      )}
    </div>
  );
});
