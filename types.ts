
export type NodeType = 'OSC' | 'FX';
export type OscType = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type FxType = 
  | 'filter-lp' 
  | 'filter-hp' 
  | 'filter-bp' 
  | 'delay' 
  | 'reverb' 
  | 'distortion' 
  | 'phaser' 
  | 'tremolo';

export interface Position {
  x: number;
  y: number;
}

export interface SynthNode {
  id: string;
  type: NodeType;
  subType: OscType | FxType;
  pos: Position;
  size: number; // Amplitude/Intensity
  frequency: number; // Only for OSC
  modulators: string[]; 
  boundTo?: string; // ID of node it is physically bound to
  color: string;
  isAudible: boolean; // Toggles whether the OSC is directly connected to master
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
}
