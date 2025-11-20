const SketchRegistry = {
  default: {
    sketch: DefaultSketch,
    params: {
      speed: { type: 'number', min: 0.1, max: 5.0, default: 1.0, step: 0.1 },
      text: { type: 'string', default: 'HELLO' },
      hue: { type: 'number', min: 0, max: 360, default: 200, step: 10 },
    }
  },
  alt: {
    sketch: AltSketch,
    params: {}
  }
};
