// js/app.js

class GifApp {
  constructor(config, initialSketchKey) {
    // ベース設定（fps, durationSec など）
    this.baseConfig = { ...config };

    this.captureManager = null;
    this.canvas = null;

    // 現在のスケッチ
    this.currentSketchKey = initialSketchKey || "default";
    this.sketch =
      (window.SketchRegistry && window.SketchRegistry[this.currentSketchKey]) ||
      null;

    // 時間・状態
    this.t = 0; // 0〜1 のループ位置
    this.localFrame = 0; // 独自フレームカウンタ

    // 表現パラメータ
    this.fontKey = "system";
    this.text = "";
    this.tempo = 1.0;
  }

  resetLoop() {
    this.localFrame = 0;
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

    if (
      templateParam &&
      window.SketchRegistry &&
      window.SketchRegistry[templateParam]
    ) {
      this.currentSketchKey = templateParam;
      this.sketch = window.SketchRegistry[templateParam];
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
    const sizeSelect = document.getElementById("select-size");

    let size = this.baseConfig.width;
    if (sizeSelect) {
      const raw = parseInt(sizeSelect.value, 10);
      if (!Number.isNaN(raw) && raw > 0) size = raw;
    }

    // durationSec は MVP では固定（baseConfig をそのまま使う）
    return {
      ...this.baseConfig,
      width: size,
      height: size,
    };
  }

  setup() {
    // URLパラメータ反映（text / tempo / template）
    this.applyParamsFromURL();

    const cfg = this.getCurrentConfig();
    this.baseConfig = { ...cfg };

    // p5 canvas を既存の #p5-canvas と差し替え
    const c = createCanvas(cfg.width, cfg.height);
    const placeholder = document.getElementById("p5-canvas");
    if (placeholder) {
      placeholder.replaceWith(c.canvas);
    }
    this.canvas = c.canvas;

    // キャプチャ管理
    this.captureManager = new CaptureManager(cfg, this.canvas);

    // UIコントローラ
    // UI は ui.js 側で let UI = null; → window.UI にしてある想定
    UI = new UIController(this.captureManager, this);

    // スケッチ初期化
    if (this.sketch && typeof this.sketch.setup === "function") {
      this.sketch.setup();
    }
  }

  // ========== UI から呼ばれる setter ==========

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

  getFontFamily() {
    switch (this.fontKey) {
      case "gothic":
        return `'Noto Sans JP', system-ui, sans-serif`;
      case "serif":
        return `'Yu Mincho', 'Noto Serif JP', serif`;
      default:
        return `system-ui, -apple-system, 'Segoe UI', sans-serif`;
    }
  }

  // Size 変更（UIの select-size から呼ぶ）
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

    // p5キャンバスのサイズ変更
    resizeCanvas(size, size);

    // CaptureManager にサイズを伝える（次回録画に反映）
    if (
      this.captureManager &&
      typeof this.captureManager.setSize === "function"
    ) {
      this.captureManager.setSize(size, size);
    } else if (this.captureManager) {
      this.captureManager.config.width = size;
      this.captureManager.config.height = size;
    }

    // ---- ★ ここからプレビューまわりのサイズ同期 ----
    const wrapper = document.querySelector(".canvas-wrapper");
    const videoEl = document.getElementById("preview-video");

    if (wrapper) {
      wrapper.style.width = `${size}px`;
      wrapper.style.height = `${size}px`;
    }

    if (videoEl) {
      // 属性値も変えておくとデバッグしやすい
      videoEl.width = size;
      videoEl.height = size;
      // CSSは wrapperに対して100%でOK
      videoEl.style.width = "100%";
      videoEl.style.height = "100%";
    }
    // ---- ★ ここまで ----

    // スケッチ再setup
    if (this.sketch && this.sketch.setup) this.sketch.setup();

    UI.updateStatus(`size: ${size}x${size}`);
  }

  setSketch(key) {
    pixelDensity(1);
    if (!window.SketchRegistry) return;
    const next = window.SketchRegistry[key];
    if (!next) return;

    this.currentSketchKey = key;
    this.sketch = next;

    // リセットして頭から
    this.resetLoop();

    if (this.sketch && typeof this.sketch.setup === "function") {
      this.sketch.setup();
    }
  }

  // ========== メインループ ==========

  draw() {
    if (!this.captureManager) return;
    if (!this.sketch || typeof this.sketch.draw !== "function") return;

    // 状態リセット
    resetMatrix();
    imageMode(CORNER);
    rectMode(CORNER);
    textAlign(CENTER, CENTER);

    const cfg = this.captureManager.config;
    const loopFrames = cfg.fps * cfg.durationSec;
    const repeat = cfg.loopRepeat ?? 1;
    const totalFrames = loopFrames * repeat;
    const f = this.localFrame % totalFrames;

    this.t = (f % loopFrames) / loopFrames;

    this.sketch.draw(this.t, this.text, this.tempo);
    this.captureManager.onFrame();

    this.localFrame++;
  }
}

// p5 entry point
let gifApp = null;

function setup() {
  pixelDensity(1);
  gifApp = new GifApp(GIF_DEFAULT_CONFIG, "default");
  gifApp.setup();
}

function draw() {
  if (gifApp) {
    gifApp.draw();
  }
}
