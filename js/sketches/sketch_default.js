const DefaultSketch = {
  setup() {
    textAlign(CENTER, CENTER);
    textSize(48);
    noStroke();
  },
  draw(t) {
    background(0);
    fill(255);
    const y = height / 2 + Math.sin(t * TWO_PI) * 50;
    text(`t=${nf(t, 1, 2)}`, width / 2, y);
  }
};
