const DefaultSketch = {
  setup() {
    background(0);
    noStroke();
    fill(255);
  },
  draw(t, params) {
    // params は完全に無視
    background(0);
    const r = 50;
    const cx = width / 2 + Math.cos(t * TWO_PI) * 80;
    const cy = height / 2 + Math.sin(t * TWO_PI) * 80;
    circle(cx, cy, r);
  }
};
