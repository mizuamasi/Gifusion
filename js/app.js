// js/app.js

class GifApp {
  constructor(config, initialSketchKey) {
    this.baseConfig = { ...config };
    this.captureManager = null;
    this.canvas = null;

    this.currentSketchKey = initialSketchKey || "default";
    // Registry構造変更に対応: .sketch と .params を取得
    const entry = SketchRegistry[this.currentSketchKey] || SketchRegistry.default;
    this.sketch = entry.sketch;
    this.sketchParamsSchema = entry.params;

    this.t = 0;
    this.currentParams = {}; // 現在のパラメータ値

    // ParamControllerの初期化
    const paramContainer = document.getElementById('params-container');
    if (paramContainer) {
      this.paramController = new ParamController(paramContainer, (newParams) => {
        this.currentParams = { ...newParams };
      });
    }
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

    UI = new UIController(this.captureManager, this);

    if (this.sketch.setup) this.sketch.setup();

    // 初回UI構築
    if (this.paramController) {
      this.paramController.buildUI(this.sketchParamsSchema);
      this.currentParams = this.paramController.getParams();
    }
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

  // ★ GIFモードなどで強制的にサイズ変更する場合
  forceSize(w, h) {
    if (this.captureManager && this.captureManager.isRecording) return;

    this.baseConfig.width = w;
    this.baseConfig.height = h;

    resizeCanvas(w, h);
    this.captureManager.setSize(w, h);

    if (this.sketch.setup) this.sketch.setup();

    UI.updateStatus(`Forced size: ${w}x${h}`);
  }

  setSketch(key) {
    const entry = SketchRegistry[key];
    if (!entry) return;

    this.currentSketchKey = key;
    this.sketch = entry.sketch;
    this.sketchParamsSchema = entry.params;

    if (this.sketch.setup) this.sketch.setup();

    // UI再構築
    if (this.paramController) {
      this.paramController.buildUI(this.sketchParamsSchema);
      // 初期値を反映
      this.currentParams = this.paramController.getParams();
    }
  }

  draw() {
    const cfg = this.captureManager.config;

    const loopFrames = cfg.fps * cfg.durationSec;              // 1周分のフレーム数
    const repeat = cfg.loopRepeat ?? 1;
    const totalFrames = loopFrames * repeat;                    // 動画全体のフレーム数

    const f = frameCount % totalFrames;

    // t は「1周分」の中で 0〜1 を行き来する
    this.t = (f % loopFrames) / loopFrames;

    this.t = (f % loopFrames) / loopFrames;

    this.sketch.draw(this.t, this.currentParams);
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
