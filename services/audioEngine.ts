
import { OscType, FxType } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private nodes: Map<string, { 
    main: AudioNode, 
    input?: AudioNode, 
    output: AudioNode,
    params: { [key: string]: AudioParam },
    modGains: Map<string, GainNode>,
    extraNodes?: { [key: string]: AudioNode }
  }> = new Map();

  constructor() {}

  public init() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public createOscillator(id: string, type: OscType, freq: number, gain: number, isAudible: boolean) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    
    osc.connect(g);
    osc.start();

    if (isAudible) {
      g.connect(this.masterGain);
    }

    this.nodes.set(id, {
      main: osc,
      output: g,
      params: {
        frequency: osc.frequency,
        gain: g.gain,
        detune: osc.detune
      },
      modGains: new Map()
    });
  }

  public createEffect(id: string, type: FxType) {
    if (!this.ctx || !this.masterGain) return;

    let input: AudioNode;
    let output: AudioNode;
    let params: { [key: string]: AudioParam } = {};
    let extraNodes: { [key: string]: AudioNode } = {};

    switch (type) {
      case 'filter':
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        input = filter;
        output = filter;
        params = { cutoff: filter.frequency, resonance: filter.Q };
        break;
      case 'delay':
        const delay = this.ctx.createDelay(5.0);
        const feedback = this.ctx.createGain();
        const wet = this.ctx.createGain();
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(wet);
        input = delay;
        output = wet;
        params = { time: delay.delayTime, feedback: feedback.gain };
        break;
      case 'distortion':
        const shaper = this.ctx.createWaveShaper();
        const distOutputGain = this.ctx.createGain();
        shaper.connect(distOutputGain);
        input = shaper;
        output = distOutputGain;
        shaper.curve = this.makeDistortionCurve(100);
        // We simulate "shape" by modifying the curve or using the gain parameter
        params = { amount: distOutputGain.gain }; 
        extraNodes = { shaper };
        break;
      case 'reverb':
      default:
        const reverb = this.ctx.createConvolver();
        const revMix = this.ctx.createGain();
        reverb.buffer = this.createReverbBuffer(2.0);
        reverb.connect(revMix);
        input = reverb;
        output = revMix;
        params = { diffusion: revMix.gain }; 
        break;
    }

    this.nodes.set(id, {
      main: input,
      input,
      output,
      params,
      modGains: new Map(),
      extraNodes
    });
  }

  private createReverbBuffer(duration: number) {
    if (!this.ctx) return null;
    const len = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let i = 0; i < 2; i++) {
      const channel = buffer.getChannelData(i);
      for (let j = 0; j < len; j++) {
        channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / len, 2);
      }
    }
    return buffer;
  }

  public makeDistortionCurve(amount: number) {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  public updateAudible(id: string, isAudible: boolean) {
    const node = this.nodes.get(id);
    if (!node || !this.masterGain) return;
    try { node.output.disconnect(this.masterGain); } catch(e) {}
    if (isAudible) node.output.connect(this.masterGain);
  }

  public updateParam(id: string, paramName: string, value: number) {
    const node = this.nodes.get(id);
    if (!node) return;
    
    if (paramName === 'distortionCurve') {
        const shaper = node.extraNodes?.shaper as WaveShaperNode;
        if (shaper) shaper.curve = this.makeDistortionCurve(value);
        return;
    }

    const param = node.params[paramName];
    if (param) {
        param.setTargetAtTime(value, this.ctx!.currentTime, 0.05);
    }
  }

  public connectNodes(fromId: string, toId: string) {
    const from = this.nodes.get(fromId);
    const to = this.nodes.get(toId);
    if (!from || !to || !this.ctx) return;

    if (to.input) {
      from.output.connect(to.input);
      to.output.connect(this.masterGain!);
    } else if (to.params.frequency) {
      const modGain = this.ctx.createGain();
      modGain.gain.setValueAtTime(400, this.ctx.currentTime);
      from.output.connect(modGain);
      modGain.connect(to.params.frequency);
      from.modGains.set(toId, modGain);
    }
  }

  public disconnectNodes(fromId: string, toId: string) {
    const from = this.nodes.get(fromId);
    const to = this.nodes.get(toId);
    if (!from || !to) return;

    if (to.input) {
      try { from.output.disconnect(to.input); } catch(e) {}
    } else {
      const modGain = from.modGains.get(toId);
      if (modGain) {
        try { from.output.disconnect(modGain); modGain.disconnect(); } catch(e) {}
        from.modGains.delete(toId);
      }
    }
  }

  public removeNode(id: string) {
    const node = this.nodes.get(id);
    if (!node) return;
    try { node.output.disconnect(); } catch(e) {}
    if ('stop' in node.main) (node.main as OscillatorNode).stop();
    this.nodes.delete(id);
  }
}

export const audioEngine = new AudioEngine();
