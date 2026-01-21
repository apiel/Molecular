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
    const count = Math.floor(density * 1.5);
    const newCatalysts: Catalyst[] = [];
    const colors = ['#ffffff', '#818cf8', '#34d399', '#f472b6'];
    
    for (let i = 0; i < count; i++) {
      newCatalysts.push({
        x: Math.random() * 5000 - 2500, // Large world bounds
        y: Math.random() * 5000 - 2500,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 8,
        size: Math.random() * 2 + 1,
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
    
    // Catalysts live in "World Space" but we draw them in "Screen Space"
    const catalysts = catalystsRef.current;
    
    ctx.save();
    // No need to translate ctx because we are calculating screen coords manually for performance
    
    for (let i = 0; i < catalysts.length; i++) {
      const c = catalysts[i];
      
      // Update pos
      c.x += c.vx;
      c.y += c.vy;

      // Wrap around world bounds (arbitrary large box)
      if (c.x > 3000) c.x = -3000;
      if (c.x < -3000) c.x = 3000;
      if (c.y > 3000) c.y = -3000;
      if (c.y < -3000) c.y = 3000;

      // Screen coords
      const sx = c.x + viewOffset.x;
      const sy = c.y + viewOffset.y;

      // Only draw if on screen
      if (sx > -50 && sx < canvas.width + 50 && sy > -50 && sy < canvas.height + 50) {
        // Draw trail
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - c.vx * 3, sy - c.vy * 3);
        ctx.strokeStyle = c.color;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = c.size;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sx, sy, c.size, 0, Math.PI * 2);
        ctx.fillStyle = c.color;
        ctx.globalAlpha = 0.8;
        ctx.fill();

        // Collision Check
        for (let j = 0; j < nodes.length; j++) {
            const node = nodes[j];
            const dx = c.x - node.pos.x;
            const dy = c.y - node.pos.y;
            const distSq = dx * dx + dy * dy;
            const radius = node.size / 2;
            
            if (distSq < radius * radius) {
                // Collision! 
                audioEngine.triggerDisturbance(node.id, c.vy);
                // Deflect catalyst slightly so it doesn't multi-trigger instantly
                c.vx *= -1.05;
                c.vy *= -1.05;
                c.x += c.vx * 2;
                c.y += c.vy * 2;
            }
        }
      }
    }
    
    ctx.restore();
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