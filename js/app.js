// js/app.js

class GifApp {
  constructor(config, initialSketchKey) {
    this.baseConfig = { ...config };
    this.captureManager = null;
    this.canvas = null;

    this.currentSketchKey = initialSketchKey || "default";
    this.sketch = SketchRegistry[this.currentSketchKey] || DefaultSketch;

    this.t = 0;
  }

  getCurrentConfig() {
    const durationInput = document.getElementById("input-duration");
    const sizeSelect = document.getElementById("select-size");

    let durationSec = this.baseConfig.durationSec;
    if (durationInput) {
      const raw = parseFloat(durationInput.value);
      if (!Number.isNaN(raw) && raw > 0) durationSec = raw;
    }

    let size = this.baseConfig.width;
    if (sizeSelect) {
      const raw = parseInt(sizeSelect.value, 10);
      if (!Number.isNaN(raw) && raw > 0) size = raw;
    }

    return {
      ...this.baseConfig,
      width: size,
      height: size,
      durationSec
    };
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

  // ★ UIのsize変更イベントが呼ぶ関数
  updateSizeFromUI() {
    if (this.captureManager && this.captureManager.isRecording) {
      UI.updateStatus("Recording中はサイズ変更できません");
      return;
    }

    const sizeSelect = document.getElementById("select-size");
    if (!sizeSelect) return;

    const raw = parseInt(sizeSelect.value, 10);
    if (Number.isNaN(raw) || raw <= 0) return;

    const size = raw;

    // configを更新
    this.baseConfig.width = size;
    this.baseConfig.height = size;

    // canvasサイズ変更
    resizeCanvas(size, size);

    // CaptureManager にサイズを伝える（次回録画に反映）
    this.captureManager.setSize(size, size);

    // スケッチ再setup
    if (this.sketch.setup) this.sketch.setup();

    UI.updateStatus(`size: ${size}x${size}`);
  }

  setSketch(key) {
    const next = SketchRegistry[key];
    if (!next) return;

    this.currentSketchKey = key;
    this.sketch = next;

    if (this.sketch.setup) this.sketch.setup();
  }

  draw() {
    const cfg = this.captureManager.config;

    const loopFrames = cfg.fps * cfg.durationSec;              // 1周分のフレーム数
    const repeat = cfg.loopRepeat ?? 1;
    const totalFrames = loopFrames * repeat;                    // 動画全体のフレーム数

    const f = frameCount % totalFrames;

    // t は「1周分」の中で 0〜1 を行き来する
    this.t = (f % loopFrames) / loopFrames;

    this.sketch.draw(this.t);
    this.captureManager.onFrame();
  }
}

let gifApp = null;

function setup() {
  gifApp = new GifApp(GIF_DEFAULT_CONFIG, "default");
  gifApp.setup();
}

function draw() {
  gifApp.draw();
}
