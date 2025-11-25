// js/sketches/registry.js

// 1) まずローカル変数として作る
const SketchRegistry = {};

// 2) window にもぶら下げておく（他の場所から参照したい用）
window.SketchRegistry = SketchRegistry;

// 3) 自己登録用の関数
window.registerSketch = function (key, sketch) {
  if (!key || !sketch || typeof sketch.draw !== "function") {
    console.warn("registerSketch invalid:", key, sketch);
    return;
  }
  SketchRegistry[key] = sketch;
};
