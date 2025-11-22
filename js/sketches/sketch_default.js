// js/sketches/sketch_default.js

registerSketch("default", {
  label: "Default",

  setup() {
    textAlign(CENTER, CENTER);
    textSize(48);
    noStroke();
  },

  draw(t, message, tempo) {
    background(0);
    fill(255);

    const speed = tempo || 1.0;
    const y = height / 2 + Math.sin(t * TWO_PI * speed) * 40;

    const msg =
      message && message.trim().length > 0
        ? message
        : `t=${nf(t, 1, 2)}`;

    text(msg, width / 2, y);
  },
});
