// ui.js

class UIController {
  constructor(captureManager, app) {
    this.captureManager = captureManager;
    this.app = app;
    this.editor = null;

    // Elements
    this.btnStart = document.getElementById("btn-start");
    this.btnStop = document.getElementById("btn-stop");
    this.statusEl = document.getElementById("status");
    this.btnUpload = document.getElementById("btn-upload");
    this.uploadResult = document.getElementById("upload-result");
    this.selectSketch = document.getElementById("select-sketch");
    this.inputDuration = document.getElementById("input-duration");
    this.selectSize = document.getElementById("select-size");
    this.previewArea = document.getElementById("preview-area");
    this.previewVideo = document.getElementById("preview-video");
    this.latestList = document.getElementById("latest-list");

    // Tabs
    this.tabs = document.querySelectorAll(".tab-btn");
    this.tabContents = document.querySelectorAll(".tab-content");
    this.btnRunCode = document.getElementById("btn-run-code");

    this.currentBlob = null;

    this.init();
  }

  init() {
    this.bindEvents();
    this.initEditor();
    this.loadLatest();
  }

  initEditor() {
    const textArea = document.getElementById("code-editor");
    if (!textArea) return;

    this.editor = CodeMirror.fromTextArea(textArea, {
      mode: "javascript",
      theme: "dracula",
      lineNumbers: true,
      indentUnit: 2,
      tabSize: 2,
    });

    // Set default code
    const defaultCode = `// Custom Sketch
// setup() and draw(t) are required

setup = function() {
  createCanvas(512, 512);
  colorMode(HSB, 360, 100, 100);
  noStroke();
};

draw = function(t) {
  background(0);
  
  // t goes from 0 to 1
  let angle = t * TWO_PI;
  let x = width / 2 + cos(angle) * 100;
  let y = height / 2 + sin(angle) * 100;
  
  fill(200, 80, 100);
  circle(x, y, 50);
  
  fill(255);
  textAlign(CENTER);
  text("t: " + nf(t, 1, 2), width/2, height - 20);
};
`;
    this.editor.setValue(defaultCode);
  }

  bindEvents() {
    // Recording Controls
    if (this.btnStart) {
      this.btnStart.addEventListener("click", () => {
        this.captureManager.start();
        this.updateStatus("Recording...");
        this.btnStart.disabled = true;
        this.btnStop.disabled = false;
        if (this.previewArea) this.previewArea.classList.add("hidden");
      });
    }

    if (this.btnStop) {
      this.btnStop.addEventListener("click", () => {
        this.captureManager.stop();
        this.btnStart.disabled = false;
        this.btnStop.disabled = true;
      });
    }

    // Upload
    if (this.btnUpload) {
      this.btnUpload.addEventListener("click", () => {
        if (this.currentBlob) {
          this.performUpload(this.currentBlob);
        }
      });
    }

    // Sketch Selection
    if (this.selectSketch) {
      this.selectSketch.addEventListener("change", (e) => {
        this.app.setSketch(e.target.value);
      });
    }

    // Config Changes
    if (this.inputDuration) {
      this.inputDuration.addEventListener("change", (e) => {
        const val = parseFloat(e.target.value);
        if (val > 0) this.app.setDuration(val);
      });
    }

    if (this.selectSize) {
      this.selectSize.addEventListener("change", (e) => {
        const val = parseInt(e.target.value, 10);
        this.app.setSize(val, val);
      });
    }

    // Tabs
    this.tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        this.tabs.forEach(t => t.classList.remove("active"));
        this.tabContents.forEach(c => c.classList.remove("active"));

        tab.classList.add("active");
        const targetId = tab.getAttribute("data-tab");
        document.getElementById(`tab-${targetId}`).classList.add("active");

        // Refresh editor if visible
        if (targetId === "editor" && this.editor) {
          setTimeout(() => this.editor.refresh(), 10);
        }
      });
    });

    // Run Code
    if (this.btnRunCode) {
      this.btnRunCode.addEventListener("click", () => {
        const code = this.editor.getValue();
        this.app.compileSketch(code);
      });
    }
  }

  updateStatus(msg) {
    if (this.statusEl) this.statusEl.textContent = msg;
  }

  onCaptureDone(blob, ext = "webm") {
    this.updateStatus("Recording done. Ready to upload.");
    this.currentBlob = blob;

    const localUrl = URL.createObjectURL(blob);
    this.updatePreview(localUrl);
  }

  updatePreview(url) {
    if (this.previewVideo) {
      this.previewVideo.src = url;
      if (this.previewArea) this.previewArea.classList.remove("hidden");
    }
  }

  async performUpload(blob) {
    this.updateStatus("Uploading...");
    if (this.btnUpload) this.btnUpload.disabled = true;

    try {
      const metadata = {
        sketchKey: this.app.currentSketchKey || "custom",
        params: this.app.currentParams || {},
        config: this.app.getCurrentConfig()
      };

      const headers = {
        "Content-Type": "video/webm",
        "X-Gifuto-Sketch-Key": metadata.sketchKey,
        "X-Gifuto-Params": JSON.stringify(metadata.params),
        "X-Gifuto-Config": JSON.stringify(metadata.config)
      };

      const res = await fetch(`${BACKEND_BASE_URL}/api/upload`, {
        method: "POST",
        headers: headers,
        body: blob,
      });

      if (!res.ok) {
        const errText = await res.text();
        this.updateStatus("Upload failed: " + res.status);
        console.error("Upload failed:", res.status, res.statusText, errText);
        alert("Upload failed!\nStatus: " + res.status + "\nError: " + errText);
        if (this.btnUpload) this.btnUpload.disabled = false;
        return;
      }

      const data = await res.json();
      console.log("Upload success:", data);
      this.updateStatus("Uploaded!");
      this.showUploadResult(data.url);
      alert("Upload successful!\nURL: " + data.url);

    } catch (err) {
      console.error(err);
      this.updateStatus("Upload error");
      if (this.btnUpload) this.btnUpload.disabled = false;
    }
  }

  showUploadResult(url) {
    if (this.uploadResult) {
      this.uploadResult.innerHTML = `
        <a href="${url}" target="_blank" style="color: var(--accent)">View Uploaded Video</a>
      `;
    }
  }

  async loadLatest() {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/items/latest?limit=6`);
      if (!res.ok) return;
      const items = await res.json();

      if (this.latestList) {
        this.latestList.innerHTML = "";
        items.forEach(item => {
          if (!item.url) return; // Skip invalid items

          const div = document.createElement("div");
          div.className = "latest-item";
          div.innerHTML = `
            <a href="${item.url}" target="_blank">
              <video src="${item.url}" muted loop onmouseover="this.play()" onmouseout="this.pause()"></video>
            </a>
          `;
          this.latestList.appendChild(div);
        });
      }
    } catch (e) {
      console.error("Failed to load latest:", e);
    }
  }
}

let UI = null;
