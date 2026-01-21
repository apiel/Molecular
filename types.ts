export type NodeType = 'OSC' | 'FX';
export type OscType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise' | 'sample-hold';
export type FxType = 
  | 'filter-lp' 
  | 'filter-hp' 
  | 'filter-bp' 
  | 'delay' 
  | 'reverb' 
  | 'distortion' 
  | 'phaser' 
  | 'tremolo'
  | 'bitcrusher'
  | 'chorus';

export interface Position {
  x: number;
  y: number;
}

export interface ThemeColors {
  oscStart: string;
  oscEnd: string;
  fxStart: string;
  fxEnd: string;
  connStart: string;
  connEnd: string;
  bgGlow: string;
  sidebarBg: string;
  accent: string;
  buttonBg: string;
  buttonText: string;
  fontFamily: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
}

export interface ImpactSettings {
  toneSpike: boolean;
  sparkTransients: boolean;
  paramFlutter: boolean;
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