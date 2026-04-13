// src/wave.js — 웨이브(난이도) 관리

import { WAVE } from '../core/constants.js';

export class WaveManager {
  constructor() {
    this.wave  = 1;
    this.timer = 0;
  }

  reset() {
    this.wave  = 1;
    this.timer = 0;
  }

  // dt마다 타이머를 증가 → 웨이브 증가 시 true 반환
  update(dt) {
    if (this.wave >= WAVE.MAX) return false;
    this.timer += dt;
    if (this.timer >= WAVE.INTERVAL) {
      this.timer -= WAVE.INTERVAL;
      this.wave++;
      return true; // 웨이브 증가 이벤트
    }
    return false;
  }

  // 다음 웨이브까지 진행률 (0~1)
  getProgress() {
    if (this.wave >= WAVE.MAX) return 1;
    return this.timer / WAVE.INTERVAL;
  }
}
