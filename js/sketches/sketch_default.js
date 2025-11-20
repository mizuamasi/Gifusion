const DefaultSketch = {
  setup() {
    textAlign(CENTER, CENTER);
    textSize(48);
    noStroke();
    colorMode(HSB, 360, 100, 100);
  },
  draw(t, params) {
    const speed = params.speed ?? 1.0;
    const txt = params.text ?? 'HELLO';
    const baseHue = params.hue ?? 200;

    background(0);

    // t (0~1) を speed 倍して、sin波に使う
    // ループさせるために TWO_PI * t * speed だと、speedが整数じゃないとループが切れる可能性がある
    // が、仕様上「t=0~1」でループする前提なら、内部でうまく処理するか、
    // ユーザーが「ループするパラメータ」を選ぶ遊びになる。
    // いったん単純に反映する。

    const y = height / 2 + Math.sin(t * TWO_PI * speed) * (height * 0.2);

    fill(baseHue, 80, 100);
    text(txt, width / 2, y);

    fill(255);
    textSize(16);
    text(`t=${nf(t, 1, 2)}`, width / 2, height - 30);
    textSize(48); // reset
  }
};
