import React, { useMemo } from 'react';
import { SynthNode, Theme } from '../types';

interface BubbleProps {
  node: SynthNode;
  isSelected: boolean;
  isConnecting: boolean;
  hasIncoming: boolean;
  theme: Theme;
  onMouseDown: (e: React.PointerEvent, id: string) => void;
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

  const isLFOMode = !node.isAudible && node.type === 'OSC';

  const backgroundStyle = useMemo(() => {
    if (isLFOMode) {
      return { 
        background: 'rgba(24, 24, 27, 0.8)', 
        borderStyle: 'dashed',
        borderColor: `${node.color}33`
      }; 
    }

    const baseColor = node.color || (node.type === 'OSC' ? theme.colors.oscStart : theme.colors.fxStart);
    
    return { 
      background: `linear-gradient(135deg, ${baseColor} 0%, rgba(0,0,0,0.6) 150%)`,
      boxShadow: `inset 0 0 20px ${baseColor}44, 0 10px 30px rgba(0,0,0,0.5)`
    };
  }, [node.type, node.isAudible, node.color, theme, isLFOMode]);

  const rippleDuration = node.type === 'OSC' 
    ? Math.max(0.5, Math.min(4, 15 / (Math.log10(node.frequency + 1) * 5 + 1))) 
    : 3;

  // Ripples show if: 
  // 1. It's an audible OSC
  // 2. It's an FX processing audio (hasIncoming)
  // 3. NEW: It's an OSC in LFO mode (modulating something)
  const showRipples = (node.type === 'OSC' && node.isAudible) || (node.type === 'FX' && hasIncoming) || isLFOMode;
  const baseColor = node.color || (node.type === 'OSC' ? theme.colors.oscStart : theme.colors.fxStart);

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
        touchAction: 'none',
        ...backgroundStyle
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onMouseDown(e, node.id);
        onSelect(node.id);
      }}
    >
      <div 
        className="bubble-halo-effect" 
        style={{ 
            width: node.size * 1.5, 
            height: node.size * 1.5, 
            backgroundColor: isLFOMode ? 'transparent' : baseColor,
            border: isLFOMode ? `1px solid ${baseColor}22` : 'none',
            animationDuration: showRipples ? '3s' : '8s'
        }} 
      />

      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 pointer-events-none" />

      {showRipples && (
        <>
          <div 
            className="ripple" 
            style={{ 
                animationDuration: isLFOMode ? `${rippleDuration * 2}s` : `${rippleDuration}s`,
                width: node.size * 0.3,
                height: node.size * 0.3,
                borderColor: isLFOMode ? `${node.color}22` : node.color || '#fff',
                color: node.color || '#fff',
                borderStyle: isLFOMode ? 'dashed' : 'solid'
            }} 
          />
          <div 
            className="ripple ripple-delayed" 
            style={{ 
                animationDuration: isLFOMode ? `${rippleDuration * 2}s` : `${rippleDuration}s`,
                animationDelay: isLFOMode ? `${rippleDuration}s` : `${rippleDuration / 2}s`,
                width: node.size * 0.3,
                height: node.size * 0.3,
                borderColor: isLFOMode ? `${node.color}11` : node.color || '#fff',
                color: node.color || '#fff',
                borderStyle: isLFOMode ? 'dashed' : 'solid'
            }} 
          />
        </>
      )}

      <div className="z-10 text-center pointer-events-none px-2">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-0.5 leading-none">
          {node.type === 'OSC' && isLFOMode ? 'LFO' : node.type}
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