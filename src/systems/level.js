// src/level.js — 레벨/경험치 시스템

import { LEVEL } from '../core/constants.js';

export class LevelManager {
  constructor() {
    this.level = 1;
    this.exp   = 0;
    this._onLevelUp = null;
  }

  reset() {
    this.level = 1;
    this.exp   = 0;
  }

  // 레벨업 콜백 등록 (level, bonus) 를 인수로 받음
  onLevelUp(fn) {
    this._onLevelUp = fn;
  }

  addExp(amount) {
    if (this.level >= LEVEL.MAX) return;
    this.exp += amount;

    // 여러 레벨을 한 번에 넘을 수 있으므로 while 사용
    while (this.level < LEVEL.MAX && this.exp >= LEVEL.EXP_TABLE[this.level + 1]) {
      this.level++;
      const bonus = LEVEL.BONUSES[this.level] ?? {};
      if (this._onLevelUp) this._onLevelUp(this.level, bonus);
    }
  }

  // 현재 레벨 내 EXP 진행률 (0~1)
  getExpProgress() {
    if (this.level >= LEVEL.MAX) return 1;
    const cur  = LEVEL.EXP_TABLE[this.level];
    const next = LEVEL.EXP_TABLE[this.level + 1];
    return (this.exp - cur) / (next - cur);
  }
}
