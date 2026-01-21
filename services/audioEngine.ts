import { OscType, FxType, ImpactSettings } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private impactGain: GainNode | null = null;
  private nodes: Map<string, { 
    main: AudioNode, 
    input?: AudioNode, 
    output: AudioNode,
    params: { [key: string]: AudioParam | { value: number } },
    modGains: Map<string, GainNode>,
    extraNodes?: { [key: string]: AudioNode },
    outgoingSignalConnections: Set<string>,
    isAudiblePreference: boolean
  }> = new Map();
  private isMuted: boolean = true; 

  constructor() {}

  public init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      
      // Dedicated gain for impact transients
      this.impactGain = this.ctx.createGain();
      this.impactGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      this.impactGain.connect(this.masterGain);

      this.createNoiseBuffer();
    }
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(e => console.error("Context resume failed", e));
    }
  }

  private createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  public setMasterMute(muted: boolean) {
    this.isMuted = muted;
    if (!this.masterGain || !this.ctx) return;
    const target = muted ? 0 : 0.3;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
  }

  public createOscillator(id: string, type: OscType, freq: number, gain: number, isAudible: boolean) {
    this.init();
    if (!this.ctx || !this.masterGain) return;

    let mainNode: AudioNode;
    let params: { [key: string]: AudioParam | { value: number } } = {};
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, this.ctx.currentTime);

    if (type === 'noise') {
      const source = this.ctx.createBufferSource();
      source.buffer = this.noiseBuffer;
      source.loop = true;
      source.start();
      mainNode = source;
      params = { frequency: { value: 0 }, gain: g.gain }; 
    } else if (type === 'sample-hold') {
      const scriptNode = this.ctx.createScriptProcessor(256, 1, 1);
      let lastStepTime = 0;
      let currentValue = 0;
      const freqObj = { value: freq };

      scriptNode.onaudioprocess = (e) => {
        const output = e.outputBuffer.getChannelData(0);
        const stepDuration = 1 / Math.max(0.1, freqObj.value);
        for (let i = 0; i < output.length; i++) {
          const currentTime = this.ctx!.currentTime + (i / this.ctx!.sampleRate);
          if (currentTime - lastStepTime > stepDuration) {
            currentValue = Math.random() * 2 - 1;
            lastStepTime = currentTime;
          }
          output[i] = currentValue;
        }
      };
      mainNode = scriptNode;
      params = { frequency: freqObj, gain: g.gain };
    } else {
      const osc = this.ctx.createOscillator();
      osc.type = type as OscillatorType;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.start();
      mainNode = osc;
      params = { frequency: osc.frequency, gain: g.gain, detune: osc.detune };
    }
    
    mainNode.connect(g);

    this.nodes.set(id, {
      main: mainNode,
      output: g,
      params,
      modGains: new Map(),
      outgoingSignalConnections: new Set(),
      isAudiblePreference: isAudible
    });

    this.updateAudible(id, isAudible);
  }

  /**
   * Triggers a spatialized high-energy impact sound and disturbs the molecule's harmonics.
   */
  public triggerDisturbance(id: string, velocityY: number, pan: number, settings: ImpactSettings) {
    const node = this.nodes.get(id);
    if (!node || !this.ctx || !this.impactGain) return;

    const now = this.ctx.currentTime;
    const isFalling = velocityY > 0;
    const intensity = Math.min(1, Math.abs(velocityY) / 10);

    // --- 1. SPATIAL TRANSIENT SOUND (SPARKS) ---
    if (settings.sparkTransients) {
      const panner = this.ctx.createPanner();
      panner.panningModel = 'equalpower';
      panner.setPosition(pan, 0, 1 - Math.abs(pan));
      panner.connect(this.impactGain);

      // The "Spark" (Noise burst)
      if (this.noiseBuffer) {
        const noiseSource = this.ctx.createBufferSource();
        const noiseFilter = this.ctx.createBiquadFilter();
        const noiseEnv = this.ctx.createGain();

        noiseSource.buffer = this.noiseBuffer;
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(isFalling ? 2000 : 5000, now);
        
        noiseEnv.gain.setValueAtTime(0, now);
        noiseEnv.gain.linearRampToValueAtTime(0.3 * intensity, now + 0.005);
        noiseEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseEnv);
        noiseEnv.connect(panner);
        noiseSource.start(now);
        noiseSource.stop(now + 0.1);
      }

      // The "Ping" (Chirp)
      const ping = this.ctx.createOscillator();
      const pingEnv = this.ctx.createGain();
      ping.type = 'sine';
      const startFreq = isFalling ? 800 : 2500;
      ping.frequency.setValueAtTime(startFreq, now);
      ping.frequency.exponentialRampToValueAtTime(startFreq * 0.1, now + 0.04);
      
      pingEnv.gain.setValueAtTime(0, now);
      pingEnv.gain.linearRampToValueAtTime(0.2 * intensity, now + 0.002);
      pingEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      ping.connect(pingEnv);
      pingEnv.connect(panner);
      ping.start(now);
      ping.stop(now + 0.1);
    }

    // --- 2. MOLECULE DISTURBANCE (TONE/PARAMS) ---
    if (settings.toneSpike && node.params.detune instanceof AudioParam) {
      const p = node.params.detune;
      const centsShift = -velocityY * 200; 
      p.cancelScheduledValues(now);
      p.setTargetAtTime(centsShift, now, 0.01);
      p.setTargetAtTime(0, now + 0.05, 0.2);
    } 
    
    if (settings.paramFlutter && node.params.cutoff instanceof AudioParam) {
      const p = node.params.cutoff;
      const base = p.value;
      const shift = isFalling ? -base * 0.4 : base * 0.6;
      p.cancelScheduledValues(now);
      p.setTargetAtTime(base + shift, now, 0.01);
      p.setTargetAtTime(base, now + 0.04, 0.15);
    }
  }

  public updateOscType(id: string, type: OscType) {
    const node = this.nodes.get(id);
    if (!node || !this.ctx) return;
    const currentParams = node.params;
    const currentFreq = typeof currentParams.frequency?.value === 'number' ? currentParams.frequency.value : 440;
    const currentGain = typeof currentParams.gain?.value === 'number' ? currentParams.gain.value : 0.1;
    const currentAudible = node.isAudiblePreference;
    try { node.main.disconnect(); } catch (e) {}
    if ('stop' in node.main) (node.main as any).stop();
    this.createOscillator(id, type, currentFreq, currentGain, currentAudible);
    const newNode = this.nodes.get(id)!;
    node.modGains.forEach((gain, targetId) => {
        newNode.modGains.set(targetId, gain);
        newNode.output.connect(gain);
    });
    node.outgoingSignalConnections.forEach(targetId => {
        newNode.outgoingSignalConnections.add(targetId);
        const target = this.nodes.get(targetId);
        if (target?.input) newNode.output.connect(target.input);
    });
  }

  public createEffect(id: string, type: FxType) {
    this.init();
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
        params = { bits: bitOutput.gain }; 
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
        
        chorusIn.connect(chorusOut); 
        chorusIn.connect(delay);
        delay.connect(chorusOut); 
        
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
      outgoingSignalConnections: new Set(),
      isAudiblePreference: true
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
    
    node.isAudiblePreference = isAudible;
    try { node.output.disconnect(this.masterGain); } catch(e) {}
    
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
      if (param instanceof AudioParam) {
        param.setTargetAtTime(value, this.ctx!.currentTime, 0.05);
      } else {
        param.value = value;
      }
    }
  }

  public connectNodes(fromId: string, toId: string) {
    const from = this.nodes.get(fromId);
    const to = this.nodes.get(toId);
    if (!from || !to || !this.ctx) return;

    if (to.input) {
      from.outgoingSignalConnections.add(toId);
      try { from.output.disconnect(this.masterGain!); } catch(e) {}
      
      from.output.connect(to.input);
      this.updateAudible(toId, to.isAudiblePreference);
    } else if (to.params.frequency && to.params.frequency instanceof AudioParam) {
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
      this.updateAudible(fromId, from.isAudiblePreference);
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
    if (node.input) try { node.input.disconnect(); } catch(e) {}
    
    if (node.extraNodes?.lfo) {
        try { (node.extraNodes.lfo as OscillatorNode).stop(); } catch(e) {}
    }
    if ('stop' in node.main) (node.main as any).stop();
    
    this.nodes.delete(id);
  }
}

export const audioEngine = new AudioEngine();