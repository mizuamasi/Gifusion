// js/sketches/sketch_neon.js （今のNEON定義を全部これに）

registerSketch("NEON", {
  label: "NEON",

  pg: null,
  shaderEdge: null,
  textG: null,
  lastMsg: null,

  vertSrc: `
    precision mediump float;
    attribute vec3 aPosition;
    attribute vec2 aTexCoord;
    varying vec2 vTexCoord;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    void main() {
      vTexCoord = aTexCoord;
      gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
    }
  `,

  fragSrc: `
    precision mediump float;
    varying vec2 vTexCoord;

    uniform vec2  u_resolution;
    uniform float u_time;
    uniform float u_progress;
    uniform sampler2D u_textTex;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) +
             (c - a) * u.y * (1.0 - u.x) +
             (d - b) * u.x * u.y;
    }

    void main() {
      vec2 uv = vTexCoord;
      vec2 uvText = vec2(uv.x, uv.y);

      vec2 texel = 1.0 / u_resolution;

      float tl = texture2D(u_textTex, uvText + texel * vec2(-1.0, -1.0)).r;
      float  l = texture2D(u_textTex, uvText + texel * vec2(-1.0,  0.0)).r;
      float bl = texture2D(u_textTex, uvText + texel * vec2(-1.0,  1.0)).r;

      float  t = texture2D(u_textTex, uvText + texel * vec2( 0.0, -1.0)).r;
      float  c = texture2D(u_textTex, uvText + texel * vec2( 0.0,  0.0)).r;
      float  b = texture2D(u_textTex, uvText + texel * vec2( 0.0,  1.0)).r;

      float tr = texture2D(u_textTex, uvText + texel * vec2( 1.0, -1.0)).r;
      float  r = texture2D(u_textTex, uvText + texel * vec2( 1.0,  0.0)).r;
      float br = texture2D(u_textTex, uvText + texel * vec2( 1.0,  1.0)).r;

      float gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
      float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;

      float edge = length(vec2(gx, gy));
      edge = smoothstep(0.15, 0.5, edge);

      float baseFront = u_progress;
      float n = noise(vec2(uv.x * 36.0, u_time * 10.7* uv.x*.3));
      float offset = (n - 0.5) * 0.25;
      float front = baseFront + offset;
      front *= 1.3;
      float reveal = smoothstep(-0.02, 0.02, front - uv.y);
      reveal = 1.;
      float edgeBright = edge * reveal;

      float bloom = 0.0;
      float weightSum = 0.0;
      for (int ix = -35; ix <= 35; ix+=5) {
        for (int iy = -35; iy <= 35; iy+=5) {
          float w = 0.41;
          vec2 offsetUV = uvText + texel * vec2(float(ix), float(iy));
          float m = texture2D(u_textTex, offsetUV).r * reveal;
          bloom += m * w;
          weightSum += w;
        }
      }
      bloom /= max(weightSum, 0.0001);

      vec3 bg = vec3(.02, 0.02, 0.04);
      float pulse = 0.5 + 0.5 * sin(u_time * 32.5);

      vec3 edgeCol = mix(
        vec3(1.0, 0.4, 0.2),
        vec3(0.8, 0.7, 0.6),
        pulse
      );

      vec3 col = bg;
      col += edgeCol * bloom * 1.7;
      col += edgeCol * edgeBright * 1.5;

      gl_FragColor = vec4(col, 1.0);
    }
  `,

  setup() {
    this.initPG();
    this.updateTextGraphic("_TEXT");
  },

  initPG() {
    this.pg = createGraphics(width, height, WEBGL);
    this.pg.pixelDensity(1);
    this.pg.noStroke();
    if (this.pg.canvas) this.pg.canvas.style.display = "none";

    this.shaderEdge = this.pg.createShader(this.vertSrc, this.fragSrc);
  },
  updateTextGraphic(msg) {
    this.lastMsg = msg;
    const lines = msg.split(/\n/);

    this.textG = createGraphics(width, height);
    this.textG.pixelDensity(1);
    this.textG.hide();
    this.textG.background(0);
    this.textG.textAlign(CENTER, CENTER);

    const fontSize = width / 5;
    this.textG.textSize(fontSize);
    this.textG.fill(255);
    this.textG.noStroke();

    const lineH = fontSize * 1.2;
    const total = lines.length;
    const startY = height / 2 - (total - 1) * lineH * 0.5;

    for (let i = 0; i < total; i++) {
      this.textG.text(lines[i], width / 2, startY + i * lineH);
    }
  },

  draw(_t, _text, _tempo) {
    // メインキャンバスクリア（前のテンプレの残像消し）
    background(0);

    if (!this.pg || this.pg.width !== width || this.pg.height !== height) {
      this.initPG();
    }

    const tempo = _tempo || 1.0;
    const rawMsg = _text && _text.trim().length > 0 ? _text : "YEAH";

    if (!this.textG || this.textG.width !== width || rawMsg !== this.lastMsg) {
      this.updateTextGraphic(rawMsg);
    }

    const t = constrain(_t * tempo, 0.0, 1.0);

    // --- Offscreen WEBGL ---
    this.pg.shader(this.shaderEdge);
    this.shaderEdge.setUniform("u_resolution", [
      this.textG.width,
      this.textG.height,
    ]);
    this.shaderEdge.setUniform("u_time", millis() / 1000.0);
    this.shaderEdge.setUniform("u_progress", t);
    this.shaderEdge.setUniform("u_textTex", this.textG);

    this.pg.push();
    this.pg.noStroke();
    this.pg.rectMode(this.pg.CENTER);
    // ★ 行列は p5 が uModelViewMatrix/uProjectionMatrix に入れるので
    //    普通に rect(0,0,w,h) でOK
    this.pg.rect(0, 0, this.pg.width, this.pg.height);
    this.pg.pop();

    // --- main 2D キャンバスに貼る ---
    image(this.pg, 0, 0, width, height);
  },
});
