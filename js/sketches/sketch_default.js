// js/sketches/sketch_default.js

const DefaultSketch = {
  setup() {
    textAlign(CENTER, CENTER);
    textSize(48);
    noStroke();
  },

  // t: 0〜1, text: 入力文字列, tempo: 速度倍率
  draw(t, message, tempo) {
    background(0);
    fill(255);

    const speed = tempo || 1.0;

    // y位置をテンポに応じて揺らす
    const y = height / 2 + Math.sin(t * TWO_PI * speed) * 40;

    // テキストが空ならフォールバック表示
    const msg = (message && message.trim().length > 0) ? text : "Hello!";

    text(msg, width / 2, y);
  }
};
