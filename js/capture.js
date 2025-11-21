class CaptureManager {
  constructor(config, canvasEl) {
    this.config = { ...config };
    this.canvas = canvasEl;

    this.format = "webm"; // or "gif"
    this.isRecording = false;
    this.startTime = 0;
    this.maxMs = 0;

    this.stream = null;
    this.recorder = null;
    this.chunks = [];

    this.ccapturer = null;

    this.updateMaxMs();
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
    this.maxMs = (this.config.durationSec ?? 1) * repeat * 1000;
  }

  forceGifConstraints() {
    if (this.format !== "gif") return;
    this.config.width = 256;
    this.config.height = 256;
    this.config.durationSec = 2;
    this.config.fps = 15;
    this.config.loopRepeat = 1;
    this.updateMaxMs();
  }

  start() {
    if (this.isRecording) return;

    if (this.format === "gif") {
      if (typeof CCapture === "undefined") {
        console.error("CCapture is not loaded");
        return;
      }

      this.forceGifConstraints();
      this.ccapturer = new CCapture({
        format: "gif",
        workersPath: "js/libs/",
        framerate: this.config.fps,
        quality: 20,
        width: this.config.width,
        height: this.config.height,
      });
      this.ccapturer.start();
    } else {
      this.stream = this.canvas.captureStream(this.config.fps);
      this.chunks = [];
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

    this.isRecording = true;
    this.startTime = performance.now();
    if (UI?.updateStatus) UI.updateStatus(`Recording (${this.format})...`);
  }

  stop() {
    if (!this.isRecording) return;
    this.isRecording = false;

    if (this.format === "gif") {
      if (this.ccapturer) {
        const cap = this.ccapturer;
        this.ccapturer = null;
        cap.stop();
        cap.save((blob) => {
          this.finishCapture(blob, "gif");
        });
      }
    } else {
      if (this.recorder && this.recorder.state !== "inactive") {
        if (UI?.updateStatus) UI.updateStatus("Encoding WebM...");
        this.recorder.stop();
      }
    }
  }

  finishCapture(blob, ext) {
    if (UI?.onCaptureDone) UI.onCaptureDone(blob, ext);
    if (UI?.updateStatus) UI.updateStatus("Done");
  }

  onFrame() {
    if (!this.isRecording) return;

    const elapsed = performance.now() - this.startTime;

    if (this.format === "gif" && this.ccapturer) {
      // 単純に毎フレームキャプチャ（とりあえず）
      try {
        this.ccapturer.capture(this.canvas);
      } catch (e) {
        console.error("CCapture capture error:", e);
        this.stop();
        return;
      }
    }

    if (elapsed >= this.maxMs) {
      this.stop();
    }
  }
}
