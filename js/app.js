// js/app.js

class GifApp {
  constructor(config, initialSketchKey) {
    this.baseConfig = { ...config };
    this.captureManager = null;
    this.canvas = null;

    this.currentSketchKey = initialSketchKey || "default";
    this.sketch = SketchRegistry[this.currentSketchKey] || DefaultSketch;

    this.t = 0;
    this.fontKey = "system";

    // 追加
    this.text = "";
    this.tempo = 1.0;
  }

  applyParamsFromURL() {
    const sp = new URLSearchParams(window.location.search);

    const textParam = sp.get("text");
    const tempoParam = sp.get("tempo");
    const templateParam = sp.get("template");

    if (textParam !== null) {
      this.text = textParam;
    }
    if (tempoParam !== null) {
      const v = parseFloat(tempoParam);
      if (!Number.isNaN(v) && v > 0) {
        this.tempo = v;
      }
    }
    if (templateParam && SketchRegistry[templateParam]) {
      this.currentSketchKey = templateParam;
      this.sketch = SketchRegistry[templateParam];
    }

    // DOM側にも反映
    const inputText = document.getElementById("input-text");
    if (inputText) inputText.value = this.text;

    const inputTempo = document.getElementById("input-tempo");
    const tempoValue = document.getElementById("tempo-value");
    if (inputTempo) {
      inputTempo.value = this.tempo;
      if (tempoValue) tempoValue.textContent = this.tempo.toFixed(1);
    }

    const selectSketch = document.getElementById("select-sketch");
    if (selectSketch && this.currentSketchKey) {
      selectSketch.value = this.currentSketchKey;
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
      durationSec,
    };
  }

  setup() {
    // URLパラメータ先に反映
    this.applyParamsFromURL();

    const cfg = this.getCurrentConfig();
    this.baseConfig = { ...cfg };

    const c = createCanvas(cfg.width, cfg.height);
    this.canvas = c.canvas;

    this.captureManager = new CaptureManager(cfg, this.canvas);
    UI = new UIController(this.captureManager, this);

    if (this.sketch.setup) this.sketch.setup();
  }

  // UIから呼ばれる setter
  setText(text) {
    this.text = text || "";
  }

  setTempo(tempo) {
    if (typeof tempo !== "number" || tempo <= 0) return;
    this.tempo = tempo;
  }

  setFontKey(key) {
    this.fontKey = key || "system";
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
    const family = this.getFontFamily();
    textFont(family);
    const cfg = this.captureManager.config;

    const loopFrames = cfg.fps * cfg.durationSec;              // 1周分のフレーム数
    const repeat = cfg.loopRepeat ?? 1;
    const totalFrames = loopFrames * repeat;                    // 動画全体のフレーム数

    const f = frameCount % totalFrames;

    // t は「1周分」の中で 0〜1 を行き来する
    this.t = (f % loopFrames) / loopFrames;

    // ★ t, text, tempo を渡す
    this.sketch.draw(this.t, this.text, this.tempo);
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
