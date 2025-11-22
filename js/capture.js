// js/capture.js

class CaptureManager {
  constructor(config, canvasEl) {
    this.config = { ...config };
    this.canvas = canvasEl;

    this.stream = null;
    this.recorder = null;
    this.chunks = [];

    this.isRecording = false;
    this.startTime = 0;
    const repeat = this.config.loopRepeat ?? 1;
    this.maxMs = this.config.durationSec * repeat * 1000;

  }

  setDuration(sec) {
    if (typeof sec !== "number" || sec <= 0) return;
    this.config.durationSec = sec;
    const repeat = this.config.loopRepeat ?? 1;
    this.maxMs = sec * repeat * 1000;
  }

  setSize(w, h) {
    this.config.width = w;
    this.config.height = h;
  }

  setDuration(sec) {
    this.config.durationSec = sec;
  }

  start() {
    if (this.isRecording) return;

    this.chunks = [];
    this.isRecording = true;
    this.startTime = performance.now();

    this.stream = this.canvas.captureStream(this.config.fps);

    this.recorder = new MediaRecorder(this.stream, {
      mimeType: "video/webm",
    });

    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };

    this.recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: "video/webm" });

      if (typeof UI !== "undefined" && UI && typeof UI.onCaptureDone === "function") {
        UI.onCaptureDone(blob);
      } else {
        console.warn("UI.onCaptureDone が無いので blob を捨てた");
      }

      if (typeof UI !== "undefined" && UI && typeof UI.updateStatus === "function") {
        UI.updateStatus("Done");
      }
    };

    this.recorder.start();

    if (typeof UI !== "undefined" && UI && typeof UI.updateStatus === "function") {
      UI.updateStatus("Recording...");
    }
  }

  stop() {
    if (!this.isRecording) return;

    this.isRecording = false;

    if (this.recorder && this.recorder.state !== "inactive") {
      if (typeof UI !== "undefined" && UI && typeof UI.updateStatus === "function") {
        UI.updateStatus("Encoding...");
      }
      this.recorder.stop();
    }
  }

  onFrame() {
    if (!this.isRecording) return;

    const elapsed = performance.now() - this.startTime;
    if (elapsed >= this.maxMs) {
      this.stop();
    }
  }
}
