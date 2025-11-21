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

    // Safety check: if this.canvas is a DIV (wrapper), try to find the canvas inside
    if (this.canvas.tagName !== "CANVAS") {
      const realCanvas = this.canvas.querySelector("canvas");
      if (realCanvas) {
        console.log("CaptureManager: Found real canvas inside wrapper.");
        this.canvas = realCanvas;
      } else {
        console.error("CaptureManager: Could not find canvas element.");
        alert("Error: Canvas not found. Please wait for sketch to load.");
        return;
      }
    }

    this.chunks = [];
    this.isRecording = true;
    this.startTime = performance.now();

    try {
      // WebM setup
      this.stream = this.canvas.captureStream(this.config.fps);
      this.recorder = new MediaRecorder(this.stream, {
        mimeType: "video/webm",
        videoBitsPerSecond: 2500000 // 2.5 Mbps
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
      console.log("CaptureManager: Recorder started");

      if (this.ui && typeof this.ui.updateStatus === "function") {
        this.ui.updateStatus(`Recording (WebM)...`);
      }
    } catch (e) {
      console.error("CaptureManager Error:", e);
      alert("Recording failed: " + e.message);
      this.isRecording = false;
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
    console.log("CaptureManager: finishCapture called. UI present:", !!this.ui);
    if (this.ui && typeof this.ui.onCaptureDone === "function") {
      this.ui.onCaptureDone(blob, ext);
    } else {
      console.error("CaptureManager: UI instance not found or onCaptureDone missing.");
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
