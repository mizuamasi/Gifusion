// ui.js

class UIController {
  constructor(captureManager, app) {
    this.captureManager = captureManager;
    this.app = app;

    this.btnStart = document.getElementById("btn-start");
    this.btnStop = document.getElementById("btn-stop");
    this.statusEl = document.getElementById("status");
    this.downloadArea = document.getElementById("download-area");

    this.inputDuration = document.getElementById("input-duration");
    this.selectSketch = document.getElementById("select-sketch");
    this.selectSize = document.getElementById("select-size");

    this.bindEvents();
    this.loadLatest();
  }

  bindEvents() {
    this.btnStart.addEventListener("click", () => {
      const raw = parseFloat(this.inputDuration.value);
      if (!Number.isNaN(raw) && raw > 0) {
        this.captureManager.setDuration(raw);
      }
      this.captureManager.start();
    });

    this.btnStop.addEventListener("click", () => {
      this.captureManager.stop();
    });

    if (this.selectSketch) {
      this.selectSketch.addEventListener("change", () => {
        this.app.setSketch(this.selectSketch.value);
      });
    }

    if (this.selectSize) {
      this.selectSize.addEventListener("change", () => {
        this.app.updateSizeFromUI();
      });
    }
  }

  setCaptureManager(cm) {
    this.captureManager = cm;
  }

  updatePreview(url) {
    const video = document.getElementById("preview-video");
    if (!video) return;
    video.src = url;
    video.play().catch(() => {});
  }

  updateStatus(msg) {
    const el = document.getElementById("status");
    if (el) el.textContent = `status: ${msg}`;
    console.log("[UI]", msg);
  }

  showUploadResult(url) {
    const div = document.getElementById("upload-result");
    if (!div) return;

    div.innerHTML = `
    <p>Uploaded!</p>
    <a href="${url}" target="_blank">${url}</a>
    <button id="copy-upload-url">copy</button>
  `;

    const btn = document.getElementById("copy-upload-url");
    if (btn) {
      btn.onclick = () => {
        navigator.clipboard.writeText(url).catch(() => {});
      };
    }
  }

  async onCaptureDone(blob) {
    this.updateStatus("preparing preview…");

    const localUrl = URL.createObjectURL(blob);
    this.updatePreview(localUrl);

    this.updateStatus("uploading…");

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "video/webm",
        },
        body: blob,
      });

      if (!res.ok) {
        this.updateStatus("upload failed");
        console.error(await res.text());
        return;
      }

      const data = await res.json();
      this.updateStatus("uploaded");
      this.showUploadResult(data.url);

      // ★ ここで一覧を更新
      await this.loadLatest();
    } catch (err) {
      console.error(err);
      this.updateStatus("upload error");
    }
  }

  async loadLatest() {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/items/latest?limit=10`);
      if (!res.ok) {
        console.error("loadLatest failed:", res.status, res.statusText);
        return;
      }

      const list = await res.json();
      const container = document.getElementById("latest-list");
      if (!container) return;

      if (!Array.isArray(list) || list.length === 0) {
        container.innerHTML = "<p>No items yet.</p>";
        return;
      }

      container.innerHTML = list
        .map(
          (item) => `
        <div class="latest-item">
          <video 
            src="${item.url}" 
            muted 
            loop 
            playsinline 
            width="160" 
            height="160"
            onmouseover="this.play()" 
            onmouseout="this.pause()"
          ></video>
        </div>
      `
        )
        .join("");
    } catch (e) {
      console.error("loadLatest error:", e);
    }
  }
}

let UI = null;
