// src/score.js — 점수 시스템

import { SCORE } from '../core/constants.js';

export class ScoreManager {
  constructor() {
    this.score = 0;
    this._secTimer   = 0;
    this._noHitTimer = 0;
  }

  reset() {
    this.score       = 0;
    this._secTimer   = 0;
    this._noHitTimer = 0;
  }

  // dt마다 호출 — 초당 점수 및 무피격 보너스 적용
  // 반환: { noHitBonus: true } 또는 null
  update(dt) {
    // 초당 생존 점수
    this._secTimer += dt;
    if (this._secTimer >= 1) {
      this._secTimer -= 1;
      this.score += SCORE.PER_SECOND;
    }

    // 무피격 보너스
    this._noHitTimer += dt;
    if (this._noHitTimer >= SCORE.NOHIT_INTERVAL) {
      this._noHitTimer -= SCORE.NOHIT_INTERVAL;
      this.score += SCORE.NOHIT_BONUS;
      return { noHitBonus: true };
    }
    return null;
  }

  // 피격 시 무피격 타이머 리셋
  onHit() {
    this._noHitTimer = 0;
  }

  // 아이템 획득 점수 (존 배율 적용)
  addItemScore(base, zoneMult = 1.0) {
    const gained = Math.floor(base * zoneMult);
    this.score  += gained;
    return gained;
  }

  isCleared() {
    return this.score >= SCORE.CLEAR_TARGET;
  }
}
