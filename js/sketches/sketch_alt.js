// js/sketches/sketch_alt.js
const AltSketch = {
  setup() {
    noStroke();
  },
  draw(t) {
    background(10, 10, 30);
    fill(200, 200, 255);
    const r = 50;
    const cx = width / 2 + Math.cos(t * TWO_PI) * 80;
    const cy = height / 2 + Math.sin(t * TWO_PI) * 80;
    circle(cx, cy, r);
  }
};
