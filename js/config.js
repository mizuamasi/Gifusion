const PRESETS = {
  webm_default: {
    width: 512,
    height: 512,
    fps: 30,
    durationSec: 2,
    loopRepeat: 3,
    format: 'webm',
  },
  gif_light: {
    width: 256,
    height: 256,
    fps: 15,
    durationSec: 2,
    loopRepeat: 1,
    format: 'gif',
  }
};

const GIF_DEFAULT_CONFIG = PRESETS.webm_default;

// config.js
//const BACKEND_BASE_URL = "http://127.0.0.1:8787";
// const BACKEND_BASE_URL =
//   location.hostname === "127.0.0.1" || location.hostname === "localhost"
//     ? "http://127.0.0.1:8787"   // Local Worker
//     : "https://gifuto-worker.rekahsnnig.workers.dev";  // Production Worker

const BACKEND_BASE_URL = "https://gifuto-worker.rekahsnnig.workers.dev";