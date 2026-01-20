# Molecular

Molecular is a high-performance, spatial multi-voice drone synthesizer. It uses interactive bubble physics to represent oscillators and effects, allowing you to sculpt complex soundscapes through physical placement and modular routing.

Try it out: https://apiel.github.io/Molecular/

<img src='https://github.com/apiel/Molecular/blob/main/demo.png?raw=true' width='500'>

## Key Features

- **Spatial Control**: Drag bubbles across the screen. 
  - **X-axis**: Primarily controls frequency for Oscillators or the main parameter for Effects.
  - **Y-axis**: Controls secondary parameters like resonance, feedback, or intensity.
- **Amplitude**: The size of a bubble directly correlates to its gain (Oscillators) or intensity (Effects).
- **Modular Flux Routing**: Use the **Route Flux** tool to create signal chains.
  - **OSC → FX**: Chains the oscillator's signal into the effect processor.
  - **OSC → OSC**: Creates frequency modulation (FM) for metallic, evolving textures.
- **Physical Binding**: "Bind" bubbles together in the sidebar to move them as a single rigid group, perfect for creating harmonic chords or fixed frequency offsets.
- **Visual Feedback**: Real-time ripple animations indicate active signal flow and frequency depth.
- **Theming**: Four distinct aesthetic profiles (Deep Space, Cyberpunk, Monochrome, Heatwave) to match your sound design mood.
- **Persistence**: Auto-saves your session locally. You can also **Export** and **Import** patches as JSON files.

## How to Play

1. **Engage**: Click the center button to start the audio engine.
2. **Add Nodes**: Use the top menu to create new Oscillators or Effects.
3. **Route**: Click "Route Flux", then click a source bubble and a destination bubble.
4. **Tune**: Select a bubble to adjust its waveform (Sine, Square, Saw, Triangle) or effect type in the sidebar.
5. **Color**: Customize individual bubbles via the "Atmospheric Hue" section in the sidebar.
6. **Save/Load**: Use Export/Import to share your patches or save them for later.

## Audio Mapping Reference

- **Oscillators**: Left-most third of the screen maps to 0-20Hz (Low-frequency modulation). The rest maps up to 2000Hz.
- **Filters**: X = Cutoff (0-5000Hz), Y = Resonance.
- **Delay**: X = Delay Time, Y = Feedback.
- **Distortion**: X = Drive, Y = Waveform Shaper.
- **Reverb**: Y = Diffusion.

---
Designed for immersive drone synthesis and modular sound exploration.
