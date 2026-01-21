import React, { useEffect, useRef } from 'react';
import { SynthNode } from '../types';
import { audioEngine } from '../services/audioEngine';

interface Catalyst {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

interface CatalystFieldProps {
  density: number;
  nodes: SynthNode[];
  viewOffset: { x: number, y: number };
}

export const CatalystField: React.FC<CatalystFieldProps> = ({ density, nodes, viewOffset }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const catalystsRef = useRef<Catalyst[]>([]);
  const requestRef = useRef<number>(null);

  useEffect(() => {
    // Re-seed catalysts when density changes
    const count = Math.floor(density * 3.0);
    const newCatalysts: Catalyst[] = [];
    const colors = ['#ffffff', '#818cf8', '#34d399', '#f472b6', '#fbbf24'];
    
    for (let i = 0; i < count; i++) {
      newCatalysts.push({
        x: Math.random() * 6000 - 3000, 
        y: Math.random() * 6000 - 3000,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 10,
        size: Math.random() * 1.5 + 0.5,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    catalystsRef.current = newCatalysts;
  }, [density]);

  const animate = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const catalysts = catalystsRef.current;
    const nodeCount = nodes.length;
    const canvasWidth = canvas.width;
    
    for (let i = 0; i < catalysts.length; i++) {
      const c = catalysts[i];
      
      c.x += c.vx;
      c.y += c.vy;

      // Wrap around world bounds
      if (c.x > 3500) c.x = -3500;
      if (c.x < -3500) c.x = 3500;
      if (c.y > 3500) c.y = -3500;
      if (c.y < -3500) c.y = 3500;

      const sx = c.x + viewOffset.x;
      const sy = c.y + viewOffset.y;

      // Render check
      if (sx > -100 && sx < canvasWidth + 100 && sy > -100 && sy < canvas.height + 100) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - c.vx * 2, sy - c.vy * 2);
        ctx.strokeStyle = c.color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = c.size;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sx, sy, c.size, 0, Math.PI * 2);
        ctx.fillStyle = c.color;
        ctx.globalAlpha = 0.6;
        ctx.fill();

        // Collision Check
        for (let j = 0; j < nodeCount; j++) {
            const node = nodes[j];
            const dx = c.x - node.pos.x;
            const dy = c.y - node.pos.y;
            const distSq = dx * dx + dy * dy;
            const radius = node.size / 2;
            
            if (distSq < radius * radius) {
                // Calculate normalized panning (-1 to 1) based on screen position
                const pan = (sx / canvasWidth) * 2 - 1;
                audioEngine.triggerDisturbance(node.id, c.vy, pan);
                
                // Elastic bounce
                c.vx *= -1.1;
                c.vy *= -1.1;
                c.x += c.vx * 3;
                c.y += c.vy * 3;
            }
        }
      }
    }
    
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [nodes, viewOffset]);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none z-10"
      style={{ mixBlendMode: 'screen' }}
    />
  );
};