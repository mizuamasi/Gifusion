// js/ui.js

class UIController {
  constructor(captureManager, app) {
    this.captureManager = captureManager;
    this.app = app;
    this.editor = null;
    this.mode = "player"; // 'player' or 'creator'

    // Elements
    this.btnStart = document.getElementById("btn-start");
    this.btnStop = document.getElementById("btn-stop");
    this.statusEl = document.getElementById("status");
    this.btnUpload = document.getElementById("btn-upload"); // Now "Record & Upload"
    this.uploadResult = document.getElementById("upload-result");

    this.btnModeCreator = document.getElementById("btn-mode-creator");
    this.btnModePlayer = document.getElementById("btn-mode-player");
    this.btnModeGallery = document.getElementById("btn-mode-gallery");

    this.creatorControls = document.getElementById("creator-controls");
    this.mainPanel = document.getElementById("main-panel");
    this.galleryPanel = document.getElementById("gallery-panel");
    this.galleryGrid = document.getElementById("gallery-grid");

    this.paramsContainer = document.getElementById("params-container");
    this.paramsHeader = document.querySelector(".panel-section h3"); // "Parameters" header

    this.btnSaveSketch = document.getElementById("btn-save-sketch");
    this.btnRunCode = document.getElementById("btn-run-code");

    this.previewArea = document.getElementById("preview-area");
    this.previewVideo = document.getElementById("preview-video");

    this.currentBlob = null;

    this.init();
  }

  init() {
    this.bindEvents();
    this.initEditor();
    this.loadGallery();
    this.setMode("gallery"); // Default to Gallery for v2.1
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
  }

  setMode(mode) {
    this.mode = mode;
    const editorContainer = document.querySelector(".CodeMirror");

    // Reset Tabs
    [this.btnModeCreator, this.btnModePlayer, this.btnModeGallery].forEach(btn => {
      if (btn) btn.classList.remove("active");
    });

    // Hide all panels first
    if (this.mainPanel) this.mainPanel.classList.add("hidden");
    if (this.galleryPanel) this.galleryPanel.classList.add("hidden");
    if (this.creatorControls) this.creatorControls.style.display = "none";
    if (editorContainer) editorContainer.style.display = "none";
    if (this.paramsContainer) this.paramsContainer.style.display = "none";
    if (this.paramsHeader) this.paramsHeader.style.display = "none";

    if (mode === "creator") {
      if (this.btnModeCreator) this.btnModeCreator.classList.add("active");
      if (this.mainPanel) this.mainPanel.classList.remove("hidden");
      if (editorContainer) editorContainer.style.display = "block";
      if (this.creatorControls) this.creatorControls.style.display = "flex";
      if (this.paramsContainer) this.paramsContainer.style.display = "flex";
      if (this.paramsHeader) this.paramsHeader.style.display = "block";
      if (this.editor) this.editor.refresh();
    } else if (mode === "player") {
      if (this.btnModePlayer) this.btnModePlayer.classList.add("active");
      if (this.mainPanel) this.mainPanel.classList.remove("hidden");
      // Editor hidden, params visible
      if (this.paramsContainer) this.paramsContainer.style.display = "flex";
      if (this.paramsHeader) this.paramsHeader.style.display = "block";
    } else if (mode === "gallery") {
      if (this.btnModeGallery) this.btnModeGallery.classList.add("active");
      if (this.galleryPanel) this.galleryPanel.classList.remove("hidden");
      this.loadGallery(); // Refresh
      // Params hidden in gallery
    }
  }

  bindEvents() {
    // Mode Switchers
    if (this.btnModeCreator) this.btnModeCreator.onclick = () => this.setMode("creator");
    if (this.btnModePlayer) this.btnModePlayer.onclick = () => this.setMode("player");
    if (this.btnModeGallery) this.btnModeGallery.onclick = () => this.setMode("gallery");

    // Recording Controls
    if (this.btnStart) {
      this.btnStart.addEventListener("click", () => {
        this.captureManager.start();
        this.updateStatus(`Recording (${this.app.totalDuration}s)...`);
        this.btnStart.disabled = true;
        this.btnStop.disabled = false;
        if (this.previewArea) this.previewArea.classList.add("hidden");

        // Auto stop
        setTimeout(() => {
          if (this.captureManager.isRecording) {
            this.captureManager.stop();
            this.btnStart.disabled = false;
            this.btnStop.disabled = true;
          }
        }, this.app.totalDuration * 1000 + 500); // Buffer
      });
    }

    if (this.btnStop) {
      this.btnStop.addEventListener("click", () => {
        this.captureManager.stop();
        this.btnStart.disabled = false;
        this.btnStop.disabled = true;
      });
    }

    // Upload Render
    if (this.btnUpload) {
      this.btnUpload.addEventListener("click", () => {
        if (this.currentBlob) {
          this.performRenderUpload(this.currentBlob);
        }
      });
    }

    // Save Sketch (Creator)
    if (this.btnSaveSketch) {
      this.btnSaveSketch.addEventListener("click", () => {
        this.saveCurrentSketch();
      });
    }

    // Run Code
    if (this.btnRunCode) {
      this.btnRunCode.addEventListener("click", () => {
        const code = this.editor.getValue();
        this.app.compileSketch(code);
      });
    }

    // Loop Config
    const loopConfig = document.getElementById("loop-config");
    if (loopConfig) {
      loopConfig.addEventListener("change", (e) => {
        const base = parseInt(e.target.value);
        const loops = 10 / base;
        this.app.baseDuration = base;
        this.app.loopCount = loops;
        this.app.totalDuration = 10; // Enforce 10s limit
        console.log(`Loop Config Changed: Base=${base}s, Loops=${loops}, Total=${this.app.totalDuration}s`);
      });
    }
  }

  updateStatus(msg) {
    if (this.statusEl) this.statusEl.textContent = msg;
  }

  onCaptureDone(blob, ext = "webm") {
    console.log("UIController: onCaptureDone called. Blob size:", blob.size);
    this.updateStatus("Recording done. Ready to upload.");
    this.currentBlob = blob;

    const localUrl = URL.createObjectURL(blob);
    console.log("UIController: Preview URL created:", localUrl);
    this.updatePreview(localUrl);

    // Enable upload button
    if (this.btnUpload) {
      this.btnUpload.disabled = false;
      this.btnUpload.textContent = "Upload Render";
      this.btnUpload.classList.remove("hidden");
      console.log("UIController: Upload button enabled and shown.");
    } else {
      console.error("UIController: btnUpload not found!");
    }
  }

  updatePreview(url) {
    if (this.previewVideo) {
      this.previewVideo.src = url;
      if (this.previewArea) this.previewArea.classList.remove("hidden");
    }
  }

  async performRenderUpload(blob) {
    this.updateStatus("Uploading Render...");
    if (this.btnUpload) this.btnUpload.disabled = true;

    try {
      const metadata = {
        sketchId: this.app.currentSketchId || "custom",
        params: this.app.currentParams || {},
        duration: this.app.totalDuration
      };

      const data = await RenderAPI.upload(blob, metadata);

      console.log("Upload success:", data);
      this.updateStatus("Uploaded!");
      this.showUploadResult(data.url);
      alert("Upload successful!\nURL: " + data.url);

    } catch (err) {
      console.error(err);
      this.updateStatus("Upload error");
      alert("Upload failed: " + err.message);
      if (this.btnUpload) this.btnUpload.disabled = false;
    }
  }

  async saveCurrentSketch() {
    const code = this.editor.getValue();
    const title = prompt("Enter sketch title:", "My Sketch");
    if (!title) return;

    try {
      const sketch = {
        title,
        code,
        paramsSchema: this.app.currentSchema,
        ownerId: "anon" // Placeholder
      };

      const res = await SketchAPI.save(sketch);
      alert("Sketch saved! ID: " + res.id);
      this.app.currentSketchId = res.id;
      this.loadGallery(); // Refresh list
    } catch (e) {
      alert("Save failed: " + e.message);
    }
  }

  showUploadResult(url) {
    if (this.uploadResult) {
      this.uploadResult.innerHTML = `
        <a href="${url}" target="_blank" style="color: var(--accent)">View Uploaded Video</a>
      `;
    }
  }

  async loadGallery() {
    try {
      const sketches = await SketchAPI.listLatest(20);

      if (this.galleryGrid) {
        this.galleryGrid.innerHTML = "";

        if (sketches.length === 0) {
          this.galleryGrid.innerHTML = "<p style='padding:20px; color:#888;'>No sketches found. Create one!</p>";
          return;
        }

        sketches.forEach(item => {
          const div = document.createElement("div");
          div.className = "gallery-item";

          // Placeholder thumbnail (random color or pattern)
          const hue = Math.floor(Math.random() * 360);

          div.innerHTML = `
            <div class="thumb" style="background: hsl(${hue}, 50%, 20%); display:flex; align-items:center; justify-content:center; color:#555;">
               <span>Preview</span>
            </div>
            <div class="info">
                <div class="title">${item.title}</div>
                <div class="author">by Anon</div>
            </div>
          `;

          div.onclick = async () => {
            const fullSketch = await SketchAPI.get(item.id);
            this.app.currentSketchId = fullSketch.id;
            this.app.compileSketch(fullSketch.code);
            if (this.editor) this.editor.setValue(fullSketch.code);

            // Switch to Player Mode
            this.setMode("player");
          };

          this.galleryGrid.appendChild(div);
        });
      }
    } catch (e) {
      console.error("Failed to load gallery:", e);
    }
  }
}
