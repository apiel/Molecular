import { OscType, FxType, ImpactSettings } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private impactGain: GainNode | null = null;
  
  // Spectral Buffers
  private whiteBuffer: AudioBuffer | null = null;
  private pinkBuffer: AudioBuffer | null = null;
  private brownBuffer: AudioBuffer | null = null;

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
      
      this.impactGain = this.ctx.createGain();
      this.impactGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      this.impactGain.connect(this.masterGain);

      this.createNoiseBuffers();
    }
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(e => console.error("Context resume failed", e));
    }
  }

  private createNoiseBuffers() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    
    this.whiteBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    this.pinkBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    this.brownBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);

    const wOut = this.whiteBuffer.getChannelData(0);
    const pOut = this.pinkBuffer.getChannelData(0);
    const bOut = this.brownBuffer.getChannelData(0);

    let b0, b1, b2, b3, b4, b5, b6;
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      wOut[i] = white;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pOut[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      bOut[i] = lastOut * 3.5;
    }
  }

  private makeMorphCurve(type: 'B' | 'P' | 'W') {
    const size = 4096;
    const curve = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const t = i / (size - 1); 
      if (type === 'B') curve[i] = t < 0.5 ? 1 - (t * 2) : 0;
      if (type === 'P') curve[i] = t < 0.5 ? t * 2 : 1 - ((t - 0.5) * 2);
      if (type === 'W') curve[i] = t > 0.5 ? (t - 0.5) * 2 : 0;
    }
    return curve;
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
      const brownSrc = this.ctx.createBufferSource();
      const pinkSrc = this.ctx.createBufferSource();
      const whiteSrc = this.ctx.createBufferSource();
      brownSrc.buffer = this.brownBuffer;
      pinkSrc.buffer = this.pinkBuffer;
      whiteSrc.buffer = this.whiteBuffer;

      const gb = this.ctx.createGain();
      const gp = this.ctx.createGain();
      const gw = this.ctx.createGain();
      
      [brownSrc, pinkSrc, whiteSrc].forEach(s => { s.loop = true; s.start(); });

      const morphControl = this.ctx.createConstantSource();
      morphControl.offset.setValueAtTime(Math.min(1, Math.max(0, freq / 2000)), this.ctx.currentTime);
      morphControl.start();

      const shaperB = this.ctx.createWaveShaper();
      const shaperP = this.ctx.createWaveShaper();
      const shaperW = this.ctx.createWaveShaper();
      shaperB.curve = this.makeMorphCurve('B');
      shaperP.curve = this.makeMorphCurve('P');
      shaperW.curve = this.makeMorphCurve('W');

      morphControl.connect(shaperB);
      morphControl.connect(shaperP);
      morphControl.connect(shaperW);

      shaperB.connect(gb.gain);
      shaperP.connect(gp.gain);
      shaperW.connect(gw.gain);

      brownSrc.connect(gb);
      pinkSrc.connect(gp);
      whiteSrc.connect(gw);
      gb.connect(g);
      gp.connect(g);
      gw.connect(g);

      mainNode = g;
      params = { frequency: morphControl.offset, gain: g.gain };
    } else if (type === 'sample-hold') {
      const freqCtrl = this.ctx.createConstantSource();
      freqCtrl.offset.setValueAtTime(freq, this.ctx.currentTime);
      freqCtrl.start();

      const scriptNode = this.ctx.createScriptProcessor(256, 1, 1);
      let lastStepTime = 0;
      let currentValue = 0;
      
      scriptNode.onaudioprocess = (e) => {
        const output = e.outputBuffer.getChannelData(0);
        const currentFreq = freqCtrl.offset.value;
        const stepDuration = 1 / Math.max(0.1, currentFreq);
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
      params = { frequency: freqCtrl.offset, gain: g.gain };
      mainNode.connect(g);
    } else {
      const osc = this.ctx.createOscillator();
      osc.type = type as OscillatorType;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.start();
      mainNode = osc;
      params = { frequency: osc.frequency, gain: g.gain, detune: osc.detune };
      mainNode.connect(g);
    }

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

  public triggerDisturbance(id: string, velocityY: number, pan: number, settings: ImpactSettings) {
    const node = this.nodes.get(id);
    if (!node || !this.ctx || !this.impactGain) return;
    const now = this.ctx.currentTime;
    const intensity = Math.min(1, Math.abs(velocityY) / 10);
    const panner = this.ctx.createPanner();
    panner.panningModel = 'equalpower';
    panner.setPosition(pan, 0, 1 - Math.abs(pan));
    panner.connect(this.impactGain);

    if (settings.sparkTransients && this.whiteBuffer) {
      const noiseSource = this.ctx.createBufferSource();
      const noiseFilter = this.ctx.createBiquadFilter();
      const noiseEnv = this.ctx.createGain();
      noiseSource.buffer = this.whiteBuffer;
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(velocityY > 0 ? 2000 : 5000, now);
      noiseEnv.gain.setValueAtTime(0, now);
      noiseEnv.gain.linearRampToValueAtTime(0.3 * intensity, now + 0.005);
      noiseEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseEnv);
      noiseEnv.connect(panner);
      noiseSource.start(now);
      noiseSource.stop(now + 0.1);
    }
    
    if (settings.toneSpike && node.params.detune instanceof AudioParam) {
      const p = node.params.detune;
      p.cancelScheduledValues(now);
      p.setTargetAtTime(-velocityY * 200, now, 0.01);
      p.setTargetAtTime(0, now + 0.05, 0.2);
    }
  }

  public updateOscType(id: string, type: OscType) {
    const node = this.nodes.get(id);
    if (!node || !this.ctx) return;
    const currentParams = node.params;
    let currentFreq = 440;
    if (currentParams.frequency instanceof AudioParam) currentFreq = currentParams.frequency.value;
    else if (typeof (currentParams.frequency as any)?.value === 'number') currentFreq = (currentParams.frequency as any).value;
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
        this.connectNodes(id, targetId); 
    });
  }

  public createEffect(id: string, type: FxType) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    let input: AudioNode, output: AudioNode, params: { [key: string]: AudioParam } = {}, extraNodes: { [key: string]: AudioNode } = {};

    switch (type) {
      case 'filter-lp': case 'filter-hp': case 'filter-bp': {
        const filter = this.ctx.createBiquadFilter();
        filter.type = type === 'filter-lp' ? 'lowpass' : type === 'filter-hp' ? 'highpass' : 'bandpass';
        input = output = filter;
        params = { cutoff: filter.frequency, resonance: filter.Q };
        break;
      }
      case 'delay': {
        const delay = this.ctx.createDelay(5.0);
        const feedback = this.ctx.createGain(), wet = this.ctx.createGain();
        delay.delayTime.value = 0.5; feedback.gain.value = 0.4; wet.gain.value = 0.8;
        delay.connect(feedback); feedback.connect(delay); delay.connect(wet);
        input = delay; output = wet;
        params = { time: delay.delayTime, feedback: feedback.gain };
        break;
      }
      case 'distortion': {
        const shaper = this.ctx.createWaveShaper(), distGain = this.ctx.createGain();
        shaper.connect(distGain); input = shaper; output = distGain;
        shaper.curve = this.makeDistortionCurve(100); distGain.gain.value = 0.8;
        params = { amount: distGain.gain }; extraNodes = { shaper };
        break;
      }
      case 'phaser': {
        const filter = this.ctx.createBiquadFilter(); filter.type = 'allpass';
        const lfo = this.ctx.createOscillator(), lfoG = this.ctx.createGain();
        lfo.frequency.value = 0.5; lfoG.gain.value = 500;
        lfo.connect(lfoG); lfoG.connect(filter.frequency); lfo.start();
        input = output = filter; params = { speed: lfo.frequency, depth: lfoG.gain }; extraNodes = { lfo, lfoG };
        break;
      }
      case 'tremolo': {
        const gainNode = this.ctx.createGain();
        const lfo = this.ctx.createOscillator(), lfoG = this.ctx.createGain();
        lfo.frequency.value = 4; lfoG.gain.value = 0.5;
        lfo.connect(lfoG); lfoG.connect(gainNode.gain); lfo.start();
        input = output = gainNode; params = { rate: lfo.frequency, intensity: lfoG.gain }; extraNodes = { lfo, lfoG };
        break;
      }
      case 'bitcrusher': {
        const shaper = this.ctx.createWaveShaper(), gainNode = this.ctx.createGain();
        shaper.curve = this.makeBitcrushCurve(8); shaper.connect(gainNode);
        input = shaper; output = gainNode; params = { bits: gainNode.gain }; extraNodes = { shaper };
        break;
      }
      case 'chorus': {
        const cin = this.ctx.createGain(), cout = this.ctx.createGain(), del = this.ctx.createDelay();
        const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
        del.delayTime.value = 0.03; lfo.frequency.value = 1.5; lg.gain.value = 0.002;
        lfo.connect(lg); lg.connect(del.delayTime); lfo.start();
        cin.connect(cout); cin.connect(del); del.connect(cout);
        input = cin; output = cout; params = { speed: lfo.frequency, intensity: lg.gain }; extraNodes = { lfo, lg, del };
        break;
      }
      case 'reverb': {
        const reverb = this.ctx.createConvolver(), revMix = this.ctx.createGain();
        reverb.buffer = this.createReverbBuffer(2.0); reverb.connect(revMix);
        revMix.gain.value = 0.8; input = reverb; output = revMix;
        params = { diffusion: revMix.gain };
        break;
      }
      default: { const b = this.ctx.createGain(); input = output = b; break; }
    }

    this.nodes.set(id, {
      main: input, input, output, params, modGains: new Map(), extraNodes, outgoingSignalConnections: new Set(), isAudiblePreference: true
    });
  }

  public updateEffectType(id: string, type: FxType) {
    const old = this.nodes.get(id);
    if (!old) return;
    try { old.output.disconnect(); } catch(e) {}
    if (old.input) try { old.input.disconnect(); } catch(e) {}
    if (old.extraNodes?.lfo) { try { (old.extraNodes.lfo as OscillatorNode).stop(); } catch(e) {} }
    this.createEffect(id, type);
  }

  private createReverbBuffer(duration: number) {
    if (!this.ctx) return null;
    const len = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let i = 0; i < 2; i++) {
      const channel = buffer.getChannelData(i);
      for (let j = 0; j < len; j++) channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / len, 2);
    }
    return buffer;
  }

  public makeDistortionCurve(amount: number) {
    const n = 44100; const c = new Float32Array(n); const d = Math.PI / 180;
    for (let i = 0; i < n; ++i) {
      const x = (i * 2) / n - 1;
      c[i] = ((3 + amount) * x * 20 * d) / (Math.PI + amount * Math.abs(x));
    }
    return c;
  }

  public makeBitcrushCurve(bits: number) {
    const n = 44100; const c = new Float32Array(n); const s = Math.pow(2, bits);
    for (let i = 0; i < n; ++i) {
      const x = (i * 2) / n - 1;
      c[i] = Math.round(x * s) / s;
    }
    return c;
  }

  public updateAudible(id: string, isAudible: boolean) {
    const node = this.nodes.get(id);
    if (!node || !this.masterGain) return;
    
    const wasAudible = node.isAudiblePreference;
    node.isAudiblePreference = isAudible;

    // Snapshot connections to avoid iteration issues
    const currentTargets = Array.from(node.outgoingSignalConnections);
    
    // Toggle all existing connections to use the new "audible" logic 
    // (switch between standard routing and modulation)
    if (wasAudible !== isAudible) {
      currentTargets.forEach(targetId => {
        this.disconnectNodes(id, targetId);
        this.connectNodes(id, targetId);
      });
    }

    // Handle master output routing
    try { node.output.disconnect(this.masterGain); } catch(e) {}
    if (node.isAudiblePreference && node.outgoingSignalConnections.size === 0) {
      node.output.connect(this.masterGain);
    }
  }

  public updateParam(id: string, paramName: string, value: number) {
    const node = this.nodes.get(id);
    if (!node) return;
    const param = node.params[paramName];
    if (param) {
      if (param instanceof AudioParam) {
        const finalVal = (node.main instanceof GainNode && paramName === 'frequency') ? value / 2000 : value;
        param.setTargetAtTime(finalVal, this.ctx!.currentTime, 0.05);
      } else if (typeof param === 'object' && 'value' in param) {
        param.value = value;
      }
    }
  }

  public connectNodes(fromId: string, toId: string) {
    const from = this.nodes.get(fromId), to = this.nodes.get(toId);
    if (!from || !to || !this.ctx) return;
    
    from.outgoingSignalConnections.add(toId);
    
    // Sever master link if we now have an outgoing connection
    try { from.output.disconnect(this.masterGain!); } catch (e) {}

    // Routing logic
    if (!from.isAudiblePreference) {
        // MODULATION MODE
        let targetParam: AudioParam | null = this.getPrimaryFXParam(to);
        if (!targetParam && to.params.frequency instanceof AudioParam) {
          targetParam = to.params.frequency;
        }
        
        if (targetParam instanceof AudioParam) {
            const modGain = this.ctx.createGain();
            const isNoise = to.params.frequency instanceof AudioParam && to.params.gain instanceof AudioParam && !(to.main instanceof OscillatorNode);
            const depth = isNoise ? 0.3 : 400; 
            modGain.gain.setValueAtTime(depth, this.ctx.currentTime);
            from.output.connect(modGain);
            modGain.connect(targetParam);
            from.modGains.set(toId, modGain);
        }
    } else {
        // STANDARD AUDIO MODE
        if (to.input) {
          from.output.connect(to.input);
          // Downstream node must ensure it connects to master if it's the last in chain
          this.refreshMasterLink(toId);
        } else if (to.params.frequency instanceof AudioParam) {
          const modGain = this.ctx.createGain();
          modGain.gain.setValueAtTime(400, this.ctx.currentTime);
          from.output.connect(modGain);
          modGain.connect(to.params.frequency);
          from.modGains.set(toId, modGain);
        }
    }
  }

  private refreshMasterLink(id: string) {
    const node = this.nodes.get(id);
    if (!node || !this.masterGain) return;
    try { node.output.disconnect(this.masterGain); } catch(e) {}
    if (node.isAudiblePreference && node.outgoingSignalConnections.size === 0) {
      node.output.connect(this.masterGain);
    }
  }

  private getPrimaryFXParam(node: any): AudioParam | null {
    const p = node.params;
    if (!p) return null;
    const param = p.cutoff || p.time || p.amount || p.speed || p.rate || p.bits || p.diffusion;
    return (param instanceof AudioParam) ? param : null;
  }

  public disconnectNodes(fromId: string, toId: string) {
    const from = this.nodes.get(fromId), to = this.nodes.get(toId);
    if (!from || !to) return;
    
    from.outgoingSignalConnections.delete(toId);
    
    const modGain = from.modGains.get(toId);
    if (modGain) {
      try { from.output.disconnect(modGain); modGain.disconnect(); } catch (e) {}
      from.modGains.delete(toId);
    } else if (to.input) {
      try { from.output.disconnect(to.input); } catch (e) {}
    }

    // Restore master link if it was the last connection
    this.refreshMasterLink(fromId);
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