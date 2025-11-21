// js/app.js

class GifApp {
  constructor(config, initialSketchKey) {
    this.baseConfig = { ...config };
    this.captureManager = null;
    this.canvas = null;

    this.currentSketchKey = initialSketchKey || "default";
    this.sketches = SketchRegistry || {};

    // Registry handling
    const entry = this.sketches[this.currentSketchKey] || this.sketches.default;
    this.sketch = entry ? entry.sketch : { setup: () => { }, draw: () => { } };
    this.sketchParamsSchema = entry ? entry.params : {};

    this.t = 0;
    this.currentParams = {};

    // ParamController initialization
    const paramContainer = document.getElementById('params-container');
    if (paramContainer && typeof ParamController !== 'undefined') {
      this.paramController = new ParamController(paramContainer, (newParams) => {
        this.currentParams = { ...newParams };
      });
    }
  }

  getCurrentConfig() {
    const durationInput = document.getElementById("input-duration");
    const sizeSelect = document.getElementById("select-size");

    let durationSec = this.baseConfig.durationSec || 3;
    if (durationInput) {
      const raw = parseFloat(durationInput.value);
      if (!Number.isNaN(raw) && raw > 0) durationSec = raw;
    }

    let size = this.baseConfig.width || 512;
    if (sizeSelect) {
      const raw = parseInt(sizeSelect.value, 10);
      if (!Number.isNaN(raw) && raw > 0) size = raw;
    }

    return {
      ...this.baseConfig,
      width: size,
      height: size,
      durationSec,
      fps: 30
    };
  }

  setup() {
    const cfg = this.getCurrentConfig();
    this.baseConfig = { ...cfg };

    const c = createCanvas(cfg.width, cfg.height);
    this.canvas = c.canvas;

    // Initialize CaptureManager
    if (typeof CaptureManager !== 'undefined') {
      this.captureManager = new CaptureManager(cfg, this.canvas);

      // Initialize UIController
      if (typeof UIController !== 'undefined') {
        UI = new UIController(this.captureManager, this);
        this.captureManager.setUI(UI);
      }
    }

    this.runCurrentSketch();

    // Initial UI build
    if (this.paramController && this.sketchParamsSchema) {
      this.paramController.buildUI(this.sketchParamsSchema);
      this.currentParams = this.paramController.getParams();
    }
  }

  runCurrentSketch() {
    if (this.sketch && this.sketch.setup) {
      this.sketch.setup();
    }
    background(0);
  }

  updateSizeFromUI() {
    if (this.captureManager && this.captureManager.isRecording) {
      if (UI) UI.updateStatus("Cannot change size while recording");
      return;
    }

    const cfg = this.getCurrentConfig();
    this.baseConfig.width = cfg.width;
    this.baseConfig.height = cfg.height;

    resizeCanvas(cfg.width, cfg.height);

    if (this.captureManager) {
      this.captureManager.updateConfig(cfg);
    }

    this.runCurrentSketch();

    if (UI) UI.updateStatus(`Size: ${cfg.width}x${cfg.height}`);
  }

  setSketch(key) {
    const entry = this.sketches[key];
    if (!entry) return;

    this.currentSketchKey = key;
    this.sketch = entry.sketch;
    this.sketchParamsSchema = entry.params;

    this.runCurrentSketch();

    // Rebuild UI
    if (this.paramController) {
      this.paramController.buildUI(this.sketchParamsSchema);
      this.currentParams = this.paramController.getParams();
    }

    // Update Editor if UI exists
    if (UI && UI.editor) {
      UI.editor.setValue(`// Preset: ${key}\n// Switch to 'Custom' or edit code to override.`);
    }
  }

  setDuration(val) {
    this.baseConfig.durationSec = val;
    if (this.captureManager) {
      this.captureManager.updateConfig({ durationSec: val });
    }
  }

  setSize(w, h) {
    this.baseConfig.width = w;
    this.baseConfig.height = h;
    resizeCanvas(w, h);
    if (this.captureManager) {
      this.captureManager.updateConfig({ width: w, height: h });
    }
    this.runCurrentSketch();
  }

  compileSketch(code) {
    try {
      // Create a function from the code string
      const func = new Function("p5", `
        let setup = null;
        let draw = null;
        
        ${code}
        
        return { setup, draw };
      `);

      const result = func(window);

      if (result.setup || result.draw) {
        this.currentSketchKey = "custom";
        this.sketch = {
          setup: result.setup || (() => background(0)),
          draw: result.draw || (() => { }),
          params: {}
        };
        this.sketchParamsSchema = {};
        this.currentParams = {};

        // Clear params UI
        if (this.paramController) {
          document.getElementById('params-container').innerHTML = '<div style="padding:10px; color:#888;">Custom code active</div>';
        }

        // Re-run setup
        this.runCurrentSketch();

        if (UI) UI.updateStatus("Code updated!");
        console.log("Custom sketch compiled successfully");
      } else {
        throw new Error("No setup or draw function found in code.");
      }

    } catch (e) {
      console.error("Compilation error:", e);
      if (UI) UI.updateStatus("Error: " + e.message);
      alert("Code Error:\n" + e.message);
    }
  }

  draw() {
    if (!this.captureManager) return;

    const cfg = this.captureManager.config;
    const durationSec = cfg.durationSec || 3;
    const fps = cfg.fps || 30;

    const loopFrames = fps * durationSec;
    const totalFrames = loopFrames; // Simple loop for now

    const f = frameCount % totalFrames;
    this.t = (f % loopFrames) / loopFrames;

    try {
      if (this.sketch && this.sketch.draw) {
        this.sketch.draw(this.t, this.currentParams);
      }
    } catch (e) {
      console.error("Draw error:", e);
      noLoop();
    }

    // Capture frame if recording
    if (this.captureManager.isRecording) {
      // We might need to pass delta time or frame info if CaptureManager needs it
      // But based on previous implementation, it captures from canvas stream or manually
      // If using MediaRecorder with stream, we don't strictly need to call anything per frame
      // UNLESS we are manually pushing frames (like CCapture).
      // Current CaptureManager seems to use MediaRecorder on stream, so it runs automatically.
      // However, let's check if we need to notify it.
    }
  }
}

let gifApp = null;

function setup() {
  // Ensure config exists
  const defaults = {
    width: 512,
    height: 512,
    fps: 30,
    durationSec: 3,
    format: "webm"
  };

  gifApp = new GifApp(typeof GIF_DEFAULT_CONFIG !== 'undefined' ? GIF_DEFAULT_CONFIG : defaults, "default");
  gifApp.setup();
}

function draw() {
  if (gifApp) gifApp.draw();
}
