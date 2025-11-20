// js/capture.js

class CaptureManager {
  constructor(config, canvasEl) {
    this.config = { ...config };
    this.canvas = canvasEl;

    this.stream = null;
    this.ccapturer = null;
    this.format = "webm"; // "webm" or "gif"
  }

  setFormat(fmt) {
    this.format = fmt;
  }

  setDuration(sec) {
    if (typeof sec !== "number" || sec <= 0) return;
    this.config.durationSec = sec;
    this.updateMaxMs();
  }

  setSize(w, h) {
    this.config.width = w;
    this.config.height = h;
  }

  updateMaxMs() {
    const repeat = this.config.loopRepeat ?? 1;
    this.maxMs = this.config.durationSec * repeat * 1000;
  }

  // GIFモード時の強制制約
  forceGifConstraints() {
    if (this.format !== "gif") return;

    // Light Mode: 256x256, 2s, 15fps
    this.config.width = 256;
    this.config.height = 256;
    this.config.durationSec = 0.5;
    this.config.fps = 15;
    this.config.loopRepeat = 1; // GIFは1周だけ録画してファイル自体をループさせる

    this.updateMaxMs();

    // Canvasサイズも強制変更が必要だが、それはApp/UI側でやるべきか？
    // いったんここで resizeCanvas を呼ぶのは責務違反気味だが、
    // 簡易実装として resizeCanvas がグローバルにある前提で呼んでしまう手もある。
    // ただし今回は App 側で updateSizeFromUI が呼ばれる流れを作るのが綺麗。
    // ここでは config を書き換えるだけにする。
  }

  start() {
    if (this.isRecording) return;

    // GIFモードなら制約を適用
    if (this.format === "gif") {
      this.forceGifConstraints();
      this.capturedFrames = 0;
      this.lastCapTime = 0;
    }

    this.chunks = [];
    this.isRecording = true;
    this.startTime = performance.now();

    if (this.format === "gif") {
      // CCapture setup
      // quality: 10 (default) -> lower is better quality but slower. 
      // User asked for "lighter", so maybe quality=20? 
      // workersPath: 'js/libs/' needed for gif.worker.js
      this.ccapturer = new CCapture({
        format: 'gif',
        workersPath: 'js/libs/',
        framerate: this.config.fps,
        quality: 20, // 多少画質落として軽くする
        width: this.config.width,
        height: this.config.height,
        onProgress: (p) => {
          // p is 0.0 to 1.0
          const percent = Math.round(p * 100);
          if (typeof UI !== "undefined" && UI && typeof UI.updateStatus === "function") {
            UI.updateStatus(`Encoding GIF... ${percent}%`);
          }
        }
      });
      this.ccapturer.start();
      console.log("Started GIF recording", this.config);

    } else {
      // WebM setup
      this.stream = this.canvas.captureStream(this.config.fps);
      this.recorder = new MediaRecorder(this.stream, {
        mimeType: "video/webm",
      });

      this.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.chunks.push(e.data);
      };

      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: "video/webm" });
        this.finishCapture(blob, "webm");
      };

      this.recorder.start();
    }

    if (typeof UI !== "undefined" && UI && typeof UI.updateStatus === "function") {
      UI.updateStatus(`Recording (${this.format})...`);
    }
  }

  stop() {
    if (!this.isRecording) return;

    this.isRecording = false;

    if (this.format === "gif") {
      if (this.ccapturer) {
        this.ccapturer.stop();
        if (typeof UI !== "undefined" && UI && typeof UI.updateStatus === "function") {
          UI.updateStatus("Encoding GIF...");
        }
        this.ccapturer.save((blob) => {
          this.finishCapture(blob, "gif");
        });
      }
    } else {
      if (this.recorder && this.recorder.state !== "inactive") {
        if (typeof UI !== "undefined" && UI && typeof UI.updateStatus === "function") {
          UI.updateStatus("Encoding WebM...");
        }
        this.recorder.stop();
      }
    }
  }

  finishCapture(blob, ext) {
    if (typeof UI !== "undefined" && UI && typeof UI.onCaptureDone === "function") {
      UI.onCaptureDone(blob, ext);
    }
    if (typeof UI !== "undefined" && UI && typeof UI.updateStatus === "function") {
      UI.updateStatus("Done");
    }
  }

  onFrame() {
    if (!this.isRecording) return;

    const elapsed = performance.now() - this.startTime;

    // GIFの場合はフレームをキャプチャ (簡易間引き)
    if (this.format === "gif" && this.ccapturer) {
      const interval = 1000 / this.config.fps;
      if (!this.lastCapTime) this.lastCapTime = 0;

      if (elapsed - this.lastCapTime >= interval) {
        this.ccapturer.capture(this.canvas);
        this.lastCapTime = elapsed;
        this.capturedFrames = (this.capturedFrames || 0) + 1;

        if (typeof UI !== "undefined" && UI && typeof UI.updateStatus === "function") {
          UI.updateStatus(`Recording GIF... ${this.capturedFrames} frames`);
        }
      }
    }

    if (elapsed >= this.maxMs) {
      this.stop();
    }
  }
}
