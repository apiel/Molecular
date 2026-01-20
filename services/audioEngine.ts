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
    extraNodes?: { [key: string]: AudioNode },
    outgoingSignalConnections: Set<string>
  }> = new Map();
  private isMuted: boolean = false;

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

  public setMasterMute(muted: boolean) {
    this.isMuted = muted;
    if (!this.masterGain || !this.ctx) return;
    this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.3, this.ctx.currentTime, 0.1);
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

    this.nodes.set(id, {
      main: osc,
      output: g,
      params: {
        frequency: osc.frequency,
        gain: g.gain,
        detune: osc.detune
      },
      modGains: new Map(),
      outgoingSignalConnections: new Set()
    });

    if (isAudible) {
      this.updateAudible(id, true);
    }
  }

  public updateOscType(id: string, type: OscType) {
    const node = this.nodes.get(id);
    if (node && node.main instanceof OscillatorNode) {
      node.main.type = type;
    }
  }

  public createEffect(id: string, type: FxType) {
    if (!this.ctx || !this.masterGain) return;

    let input: AudioNode;
    let output: AudioNode;
    let params: { [key: string]: AudioParam } = {};
    let extraNodes: { [key: string]: AudioNode } = {};

    switch (type) {
      case 'filter-lp':
      case 'filter-hp':
      case 'filter-bp': {
        const filter = this.ctx.createBiquadFilter();
        filter.type = type === 'filter-lp' ? 'lowpass' : type === 'filter-hp' ? 'highpass' : 'bandpass';
        filter.frequency.value = 1000;
        filter.Q.value = 1;
        input = filter;
        output = filter;
        params = { cutoff: filter.frequency, resonance: filter.Q };
        break;
      }
      case 'delay': {
        const delay = this.ctx.createDelay(5.0);
        const feedback = this.ctx.createGain();
        const wet = this.ctx.createGain();
        delay.delayTime.value = 0.5;
        feedback.gain.value = 0.4;
        wet.gain.value = 0.8;
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(wet);
        input = delay;
        output = wet;
        params = { time: delay.delayTime, feedback: feedback.gain };
        break;
      }
      case 'distortion': {
        const shaper = this.ctx.createWaveShaper();
        const distOutputGain = this.ctx.createGain();
        shaper.connect(distOutputGain);
        input = shaper;
        output = distOutputGain;
        shaper.curve = this.makeDistortionCurve(100);
        distOutputGain.gain.value = 0.8;
        params = { amount: distOutputGain.gain }; 
        extraNodes = { shaper };
        break;
      }
      case 'bitcrusher': {
        const bitShaper = this.ctx.createWaveShaper();
        const bitOutput = this.ctx.createGain();
        bitShaper.curve = this.makeBitcrushCurve(8);
        bitShaper.connect(bitOutput);
        input = bitShaper;
        output = bitOutput;
        params = { bits: bitOutput.gain }; // Hack to use generic gain as bits param in UI
        extraNodes = { shaper: bitShaper };
        break;
      }
      case 'phaser': {
        const phaserFilter = this.ctx.createBiquadFilter();
        phaserFilter.type = 'allpass';
        const phaserLfo = this.ctx.createOscillator();
        const phaserLfoGain = this.ctx.createGain();
        phaserLfo.type = 'sine';
        phaserLfo.frequency.value = 0.5;
        phaserLfoGain.gain.value = 500;
        phaserLfo.connect(phaserLfoGain);
        phaserLfoGain.connect(phaserFilter.frequency);
        phaserLfo.start();
        input = phaserFilter;
        output = phaserFilter;
        params = { speed: phaserLfo.frequency, depth: phaserLfoGain.gain };
        extraNodes = { lfo: phaserLfo, lfoGain: phaserLfoGain };
        break;
      }
      case 'chorus': {
        const chorusIn = this.ctx.createGain();
        const chorusOut = this.ctx.createGain();
        const delay = this.ctx.createDelay();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        
        delay.delayTime.value = 0.03;
        lfo.frequency.value = 1.5;
        lfoGain.gain.value = 0.002;
        
        lfo.connect(lfoGain);
        lfoGain.connect(delay.delayTime);
        lfo.start();
        
        chorusIn.connect(chorusOut); // dry
        chorusIn.connect(delay);
        delay.connect(chorusOut); // wet
        
        input = chorusIn;
        output = chorusOut;
        params = { speed: lfo.frequency, intensity: lfoGain.gain };
        extraNodes = { lfo, lfoGain, delay };
        break;
      }
      case 'tremolo': {
        const tremoloGain = this.ctx.createGain();
        const tremoloLfo = this.ctx.createOscillator();
        tremoloLfo.type = 'sine';
        tremoloLfo.frequency.value = 4;
        const tremoloLfoGain = this.ctx.createGain();
        tremoloLfoGain.gain.value = 0.5;
        tremoloLfo.connect(tremoloLfoGain);
        tremoloLfoGain.connect(tremoloGain.gain);
        tremoloLfo.start();
        input = tremoloGain;
        output = tremoloGain;
        params = { rate: tremoloLfo.frequency, intensity: tremoloLfoGain.gain };
        extraNodes = { lfo: tremoloLfo, lfoGain: tremoloLfoGain };
        break;
      }
      case 'reverb': {
        const reverb = this.ctx.createConvolver();
        const revMix = this.ctx.createGain();
        reverb.buffer = this.createReverbBuffer(2.0);
        reverb.connect(revMix);
        revMix.gain.value = 0.8;
        input = reverb;
        output = revMix;
        params = { diffusion: revMix.gain }; 
        break;
      }
      default: {
        const bypass = this.ctx.createGain();
        input = bypass;
        output = bypass;
        break;
      }
    }

    this.nodes.set(id, {
      main: input,
      input,
      output,
      params,
      modGains: new Map(),
      extraNodes,
      outgoingSignalConnections: new Set()
    });
  }

  public updateEffectType(id: string, type: FxType) {
    const old = this.nodes.get(id);
    if (!old) return;
    
    try { old.output.disconnect(); } catch(e) {}
    if (old.input) try { old.input.disconnect(); } catch(e) {}
    if (old.extraNodes?.lfo) {
        try { (old.extraNodes.lfo as OscillatorNode).stop(); } catch(e) {}
    }
    
    this.createEffect(id, type);
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

  public makeBitcrushCurve(bits: number) {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const steps = Math.pow(2, bits);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = Math.round(x * steps) / steps;
    }
    return curve;
  }

  public updateAudible(id: string, isAudible: boolean) {
    const node = this.nodes.get(id);
    if (!node || !this.masterGain) return;
    
    try { node.output.disconnect(this.masterGain); } catch(e) {}
    
    // Only connect to master if it is flagged audible AND has no other signal outputs.
    if (isAudible && node.outgoingSignalConnections.size === 0) {
      node.output.connect(this.masterGain);
    }
  }

  public updateParam(id: string, paramName: string, value: number) {
    const node = this.nodes.get(id);
    if (!node) return;
    
    if (paramName === 'distortionCurve') {
        const shaper = node.extraNodes?.shaper as WaveShaperNode;
        if (shaper) shaper.curve = this.makeDistortionCurve(value);
        return;
    }

    if (paramName === 'bitCurve') {
        const shaper = node.extraNodes?.shaper as WaveShaperNode;
        if (shaper) shaper.curve = this.makeBitcrushCurve(value);
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
      // Signal connection (Chain)
      from.outgoingSignalConnections.add(toId);
      // Disconnect from master since we are now going into an effect
      try { from.output.disconnect(this.masterGain!); } catch(e) {}
      
      from.output.connect(to.input);
      // Ensure the end of the chain is connected to master if it wasn't already
      this.updateAudible(toId, true);
    } else if (to.params.frequency) {
      // Modulation connection (FM)
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
      from.outgoingSignalConnections.delete(toId);
      try { from.output.disconnect(to.input); } catch(e) {}
      // If "from" is no longer chaining to anything, it should go back to master (if audible)
      this.updateAudible(fromId, true);
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
    
    // Disconnect outputs
    try { node.output.disconnect(); } catch(e) {}
    // Disconnect inputs
    if (node.input) try { node.input.disconnect(); } catch(e) {}
    
    // Stop extra processing
    if (node.extraNodes?.lfo) {
        try { (node.extraNodes.lfo as OscillatorNode).stop(); } catch(e) {}
    }
    if ('stop' in node.main) (node.main as OscillatorNode).stop();
    
    this.nodes.delete(id);
  }
}

export const audioEngine = new AudioEngine();
