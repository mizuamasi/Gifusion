class GifApp {
  constructor(config, initialSketchKey) {
    this.baseConfig = { ...config };
    this.captureManager = null;
    this.canvas = null;

    this.currentSketchKey = initialSketchKey || "default";
    const entry = SketchRegistry[this.currentSketchKey] || SketchRegistry.default;
    this.sketch = entry.sketch;

    this.t = 0;
    this.currentParams = {};
  }

  getCurrentConfig() {
    return { ...this.baseConfig };
  }

  setup() {
    const cfg = this.getCurrentConfig();
    this.baseConfig = { ...cfg };

    const c = createCanvas(cfg.width, cfg.height);
    this.canvas = c.canvas;

    this.captureManager = new CaptureManager(cfg, this.canvas);
    UI = new UIController(this.captureManager, this);

    if (this.sketch.setup) this.sketch.setup();
  }

  draw() {
    const cfg = this.captureManager.config;

    const loopFrames = cfg.fps * cfg.durationSec;
    const repeat = cfg.loopRepeat ?? 1;
    const totalFrames = loopFrames * repeat;
    const f = frameCount % totalFrames;

    this.t = (f % loopFrames) / loopFrames;

    const safeParams = this.currentParams || {};

    console.log("GifApp.draw", {
      frame: f,
      t: this.t,
      format: this.captureManager.format,
      isRecording: this.captureManager.isRecording,
    });

    this.sketch.draw(this.t, safeParams);
    // CaptureManagerは一旦無効にしたままでいい
    // this.captureManager.onFrame();
  }

}

let gifApp = null;

function setup() {
  gifApp = new GifApp(GIF_DEFAULT_CONFIG, "default");
  gifApp.setup();
}

function draw() {
  try {
    console.log("draw tick", frameCount);
    gifApp.draw();
  } catch (e) {
    console.error("FATAL in draw:", e);
    noLoop();
  }
}
