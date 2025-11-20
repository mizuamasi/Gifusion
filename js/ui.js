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

    this.selectFormat = document.getElementById("select-format");

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

    if (this.selectFormat) {
      this.selectFormat.addEventListener("change", () => {
        const fmt = this.selectFormat.value;
        this.captureManager.setFormat(fmt);

        if (fmt === "gif") {
          // Light Mode UI反映
          this.inputDuration.value = 2;
          this.inputDuration.disabled = true;

          // Sizeも強制的に小さいものにするが、select-sizeに256がない場合はどうする？
          // いったん既存のselect-sizeを無視して内部的に256にするが、UI上もわかりやすくしたい。
          // 簡易的に disabled にする
          this.selectSize.disabled = true;

          this.updateStatus("GIF Mode: Fixed 2s / 256px");

          // App側にサイズ変更を通知してCanvasをリサイズさせる
          // ここでは直接Appを叩く
          if (this.app.forceSize) this.app.forceSize(256, 256);

        } else {
          // WebM Mode
          this.inputDuration.disabled = false;
          this.selectSize.disabled = false;
          this.updateStatus("WebM Mode: High Quality");

          // サイズを元に戻す（select-sizeの値）
          this.app.updateSizeFromUI();
        }
      });
    }
  }

  setCaptureManager(cm) {
    this.captureManager = cm;
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
        navigator.clipboard.writeText(url).catch(() => { });
      };
    }
  }

  updatePreview(url) {
    const video = document.getElementById("preview-video");
    if (!video) return;
    video.src = url;
    // play() は Promise を返すので、エラーハンドリングをしっかり行う
    // また、直後に pause() される可能性もあるので、その場合は無視する
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        // Auto-play was prevented or interrupted
        console.log("Video playback interrupted or failed:", error);
      });
    }
  }

  updateStatus(msg) {
    const el = document.getElementById("status");
    if (el) el.textContent = `status: ${msg}`;
    console.log("[UI]", msg);
  }

  async onCaptureDone(blob, ext = "webm") {
    this.updateStatus("preparing preview…");

    const localUrl = URL.createObjectURL(blob);
    // GIFの場合、videoタグで再生できるかはブラウザによるが、imgタグの方が確実かも。
    // いったんvideoタグに入れてみる（ChromeならGIFも再生できることが多い）
    // 念のため img タグも用意して切り替えるのが丁寧だが、MVPなのでvideoのままいく。
    this.updatePreview(localUrl);

    this.updateStatus("uploading…");

    try {
      // メタデータの準備
      const metadata = {
        sketchKey: this.app.currentSketchKey,
        params: this.app.currentParams,
        config: this.app.getCurrentConfig()
      };

      // ヘッダーにJSON文字列として乗せる
      const headers = {
        "Content-Type": ext === "gif" ? "image/gif" : "video/webm",
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
            onmouseover="let p = this.play(); if(p) p.catch(e=>{})" 
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
