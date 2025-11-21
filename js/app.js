// js/app.js

class GifApp {
  constructor() {
    window.app = this; // Debug access
    this.sketch = null;
    this.p5Instance = null;
    this.canvas = document.getElementById("p5-canvas");

    this.currentParams = {};
    this.currentSketchId = null;
    this.currentSchema = {};

    // Config for recording
    this.baseDuration = 2; // seconds
    this.loopCount = 5;
    this.totalDuration = 10; // Fixed 10s

    this.captureManager = null;
    this.ui = null;
    this.paramController = null;
  }

  setup() {
    this.captureManager = new CaptureManager({
      fps: 30,
      duration: this.totalDuration
    }, this.canvas);

    this.ui = new UIController(this.captureManager, this);
    this.captureManager.setUI(this.ui);
    this.paramController = new ParamController("params-container", this);

    // Initial sketch
    this.loadDefaultSketch();
  }

  loadDefaultSketch() {
    const defaultCode = `
export const gifuParams = {
  message: { type: 'string', default: 'Hello World', label: 'Message' },
  bg: { type: 'color', default: '#222222', label: 'Background' },
  speed: { type: 'number', default: 1, min: 0.1, max: 5, step: 0.1, label: 'Speed' }
};

export function createSketch(p) {
  let params = {};

  p.setup = function() {
    p.createCanvas(512, 512);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(32);
    p.noStroke();
  };

  p.draw = function() {
    let t = (p.millis() / 1000) % 2; // 2 sec loop base
    if (params.speed) t *= params.speed;
    
    p.background(params.bg || 0);
    p.fill(255);
    
    let y = p.height / 2 + p.sin(t * p.TWO_PI) * 50;
    p.text(params.message || "", p.width / 2, y);
  };

  p.updateParams = function(newParams) {
    params = newParams;
  };
}
`;
    this.compileSketch(defaultCode);
    if (this.ui.editor) this.ui.editor.setValue(defaultCode);
  }

  compileSketch(code) {
    try {
      // Create a module-like environment
      const mockExports = {};

      // Check if the user is using the "Gifusion Module Mode" (export function createSketch)
      const isModuleMode = /export\s+function\s+createSketch/.test(code);

      let safeCode;

      if (isModuleMode) {
        // --- Module Mode (Existing Logic) ---
        safeCode = code
          .replace(/export\s+const\s+/g, "mockExports.")
          .replace(/export\s+function\s+(\w+)/g, "mockExports.$1 = function $1");
      } else {
        // --- Global Mode Adapter (New Logic) ---
        // Wrap user code in a function that uses 'with(p)' to expose p5 methods globally
        // and captures setup/draw functions.

        // We need to escape backticks in user code if we use template literals, 
        // but here we construct the string directly.

        safeCode = `
          mockExports.createSketch = function(p) {
            // p5 Global Mode Adapter
            // We use 'with(p)' to make p5 methods available as globals (e.g. rect(), fill())
            with(p) {
              // Execute user code
              ${code}

              // Bind setup/draw if defined in this scope
              // Note: function declarations inside 'with' are tricky.
              // If the user wrote 'function setup() {}', it should be visible here.
              
              if (typeof setup === 'function') {
                p.setup = setup;
              }
              
              if (typeof draw === 'function') {
                p.draw = draw;
              }
              
              // Also bind other common p5 events if needed (mousePressed, etc.)
              const events = ['mousePressed', 'mouseReleased', 'mouseClicked', 'mouseMoved', 'mouseDragged', 'keyPressed', 'keyReleased', 'keyTyped', 'windowResized'];
              events.forEach(evt => {
                if (typeof eval(evt) === 'function') {
                   p[evt] = eval(evt);
                }
              });
            }
          };
        `;
      }

      // Log the compiled code for debugging
      console.log("=== COMPILED CODE ===\n", safeCode);

      const runCode = new Function("mockExports", "p5", safeCode);
      runCode(mockExports, this.p5Instance ? this.p5Instance : p5);

      if (!mockExports.createSketch) {
        throw new Error("createSketch function not found. Did you export it?");
      }

      this.currentSchema = mockExports.gifuParams || {};

      // Re-initialize p5
      if (this.p5Instance) {
        this.p5Instance.remove();
      }

      this.p5Instance = new p5((p) => {
        mockExports.createSketch(p);

        // Inject internal updateParams if not present (safety)
        if (!p.updateParams) {
          p.updateParams = () => { };
        }

        // Hook into draw for recording
        const originalDraw = p.draw || (() => { });
        p.draw = () => {
          originalDraw();
        };
      }, "canvas-wrapper");

      // Update CaptureManager with the real canvas element
      setTimeout(() => {
        const realCanvas = document.querySelector("#canvas-wrapper canvas");
        if (realCanvas && this.captureManager) {
          this.captureManager.canvas = realCanvas;
        }
      }, 100);

      // Build UI
      this.paramController.buildUI(this.currentSchema);

      console.log("Sketch compiled successfully");

    } catch (e) {
      console.error("Compilation Error:", e);
      alert("Error compiling sketch: " + e.message);
      this.loadErrorSketch();
    }
  }

  loadErrorSketch() {
    if (this.p5Instance) this.p5Instance.remove();
    this.p5Instance = new p5((p) => {
      p.setup = () => {
        p.createCanvas(512, 512);
        p.background(255, 0, 0);
        p.fill(255);
        p.textAlign(p.CENTER);
        p.text("Error Loading Sketch", p.width / 2, p.height / 2);
      };
    }, "canvas-wrapper");
  }

  updateParams(newParams) {
    console.log("GifApp: updateParams called with", newParams);
    this.currentParams = { ...this.currentParams, ...newParams };
    if (this.p5Instance && typeof this.p5Instance.updateParams === "function") {
      this.p5Instance.updateParams(this.currentParams);
    }
  }

  loadImageParam(key, dataUrl) {
    if (this.p5Instance) {
      this.p5Instance.loadImage(dataUrl, (img) => {
        const updates = {};
        updates[key] = img;
        this.updateParams(updates);
      });
    }
  }

  setDuration(sec) {
    this.baseDuration = sec;
    this.totalDuration = this.baseDuration * this.loopCount;
  }

  setLoopCount(count) {
    this.loopCount = count;
    this.totalDuration = this.baseDuration * this.loopCount;
  }
}

const app = new GifApp();
window.onload = () => app.setup();
