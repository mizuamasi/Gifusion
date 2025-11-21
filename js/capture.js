class CaptureManager {
  constructor(config, canvasEl) {
    this.config = { ...config };
    this.canvas = canvasEl;
    this.ui = null; // Store UI instance

    this.stream = null;
    this.format = "webm"; // Fixed to webm
  }

  setUI(ui) {
    this.ui = ui;
  }

  setFormat(fmt) {
    // No-op: always webm
    console.warn("CaptureManager: setFormat is deprecated. Only 'webm' is supported.");
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

  start() {
    if (this.isRecording) return;

    this.chunks = [];
    this.isRecording = true;
    this.startTime = performance.now();

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
      console.log("Capture finished. Blob size:", blob.size);
      if (blob.size === 0) {
        alert("Error: Recorded video is empty (0 bytes).");
      }
      this.finishCapture(blob, "webm");
    };

    this.recorder.start();

    if (this.ui && typeof this.ui.updateStatus === "function") {
      this.ui.updateStatus(`Recording (WebM)...`);
    }
  }

  stop() {
    if (!this.isRecording) return;

    this.isRecording = false;

    if (this.recorder && this.recorder.state !== "inactive") {
      if (this.ui && typeof this.ui.updateStatus === "function") {
        this.ui.updateStatus("Encoding WebM...");
      }
      this.recorder.stop();
    }
  }

  finishCapture(blob, ext) {
    if (this.ui && typeof this.ui.onCaptureDone === "function") {
      this.ui.onCaptureDone(blob, ext);
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
