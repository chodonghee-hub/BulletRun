// src/mission.js — 미션 시스템

const MISSION_POOL = [
  // 생존 (Survive)
  { id: 'S1',  type: 'nohit_time',          target: 15,    resetOnHit: true,  badge: '🏃', desc: '피격 없이 15초 버티기',      reward: { score: 200 } },
  { id: 'S2',  type: 'nohit_time',          target: 60,    resetOnHit: true,  badge: '🐢', desc: '피격 없이 60초 버티기',      reward: { score: 1000, exp: 50 } },
  { id: 'S3',  type: 'wave',                target: 5,     resetOnHit: false, badge: '🌊', desc: '웨이브 5 도달',              reward: { speed: 5 } },
  { id: 'S4',  type: 'wave',                target: 10,    resetOnHit: false, badge: '🌪️', desc: '웨이브 10 도달',             reward: { dashStack: 1 } },
  // 수집 (Collect)
  { id: 'C1',  type: 'collect_star',        target: 10,    resetOnHit: false, badge: '⭐', desc: '별 10개 수집',               reward: { score: 300 },  displayEmoji: '⭐' },
  { id: 'C2',  type: 'collect_shield',      target: 5,     resetOnHit: false, badge: '🛡️', desc: '방패 5개 수집',              reward: { shield: 1 },   displayEmoji: '🛡️' },
  { id: 'C3',  type: 'fever',               target: 3,     resetOnHit: false, badge: '🔥', desc: '피버 타임 3회 발동',         reward: { exp: 100 } },
  { id: 'C4',  type: 'bomb_complete',       target: 1,     resetOnHit: false, badge: '💣', desc: '폭탄 목걸이 1세트 완료',     reward: { score: 2000 } },
  // 구역 탐험 (Zone)
  { id: 'Z1',  type: 'zone_highrise',       target: 30,    resetOnHit: false, badge: '⚠️', desc: '고위험 구역에서 30초 생존',  reward: { score: 800 } },
  { id: 'Z2',  type: 'collect_event_zone',  target: 5,     resetOnHit: false, badge: '🗺️', desc: '이벤트 구역에서 아이템 5개', reward: { exp: 80 } },
  { id: 'Z3',  type: 'visit_zones',         target: 3,     resetOnHit: false, badge: '🧭', desc: '3개 구역 방문',              reward: { speed: 10 } },
  // 스킬 활용 (Skill)
  { id: 'SK1', type: 'use_dash',            target: 10,    resetOnHit: false, badge: '⚡', desc: '대시 10회 사용',             reward: { dashRecharge: -0.2 } },
  { id: 'SK2', type: 'use_slow',            target: 5,     resetOnHit: false, badge: '🧊', desc: '슬로우 스킬 5회 사용',       reward: { exp: 60 } },
  { id: 'SK3', type: 'speed_boost_time',    target: 20,    resetOnHit: false, badge: '💨', desc: '속도 부스트 누적 20초',       reward: { score: 500 } },
  { id: 'SK4', type: 'dash_destroy_bullet', target: 50,    resetOnHit: false, badge: '🎯', desc: '대시로 총알 50개 파괴',      reward: { score: 1000 } },
  // 복합 달성 (Challenge)
  { id: 'CH1', type: 'level',              target: 5,     resetOnHit: false, badge: '💪', desc: '레벨 5 달성',                reward: { maxLife: 1 } },
  { id: 'CH2', type: 'star_nohit_streak',  target: 20,    resetOnHit: true,  badge: '🌟', desc: '피격 없이 별 20개 수집',     reward: { score: 1500 } },
  { id: 'CH3', type: 'score',              target: 50000, resetOnHit: false, badge: '💰', desc: '점수 50,000 달성',           reward: { dashStack: 1 } },
];

// wave / score / level 은 최대값 갱신 방식 (누적 아님)
const SET_TYPES = new Set(['wave', 'score', 'level']);

export class MissionSystem {
  constructor(player, scores, levels) {
    this._player = player;
    this._scores = scores;
    this._levels = levels;
    this.reset();
  }

  reset() {
    // 풀 복사 후 셔플
    this._pool = [...MISSION_POOL];
    this._shuffle(this._pool);

    // 앞에서 3개 꺼내 활성화
    this.active    = this._pool.splice(0, 3);
    this._progress = {};
    this.completed = [];
    this.newMissionFlag  = false;
    this._visitedZones   = new Set();

    for (const m of this.active) {
      this._progress[m.id] = 0;
    }
  }

  // ─── 이벤트 알림 ────────────────────────────────────────────
  notify(type, value = 1) {
    // 피격 — resetOnHit 미션 진행도 초기화
    if (type === 'hit') {
      for (const m of this.active) {
        if (m.resetOnHit) this._progress[m.id] = 0;
      }
      return;
    }

    // 구역 방문 (Z3)
    if (type === 'visit_zone') {
      this._visitedZones.add(value);
      for (const m of this.active) {
        if (m.type !== 'visit_zones') continue;
        const count = this._visitedZones.size;
        this._progress[m.id] = count;
        if (count >= m.target) this._completeMission(m);
      }
      return;
    }

    // 일반 이벤트
    for (let i = this.active.length - 1; i >= 0; i--) {
      const m = this.active[i];
      if (m.type !== type) continue;

      if (SET_TYPES.has(type)) {
        this._progress[m.id] = value;
      } else {
        this._progress[m.id] = (this._progress[m.id] ?? 0) + value;
      }

      if (this._progress[m.id] >= m.target) {
        this._completeMission(m);
      }
    }
  }

  // ─── 미션 완료 처리 ─────────────────────────────────────────
  _completeMission(m) {
    // active에서 제거
    const idx = this.active.indexOf(m);
    if (idx === -1) return;
    this.active.splice(idx, 1);

    this.completed.push({ id: m.id, badge: m.badge });
    this._applyReward(m.reward);

    // 풀에서 다음 미션 활성화
    if (this._pool.length > 0) {
      const next = this._pool.shift();
      this._progress[next.id] = 0;
      this.active.push(next);
    }

    this.newMissionFlag = true;
  }

  _applyReward(reward) {
    if (reward.score) {
      this._scores.score += reward.score;
    }
    if (reward.exp) {
      this._levels.addExp(reward.exp);
    }
    if (reward.speed) {
      this._player.speed = Math.min(this._player.speed + reward.speed, 500);
    }
    if (reward.maxLife) {
      this._player.maxLife = Math.min(this._player.maxLife + reward.maxLife, 10);
    }
    if (reward.shield) {
      this._player.addShield();
    }
    if (reward.dashStack) {
      this._player.dashStacksMax += reward.dashStack;
      this._player.dashStacks = Math.min(
        this._player.dashStacks + reward.dashStack,
        this._player.dashStacksMax
      );
    }
    if (reward.dashRecharge) {
      this._player.dashRecharge = Math.max(0.5, this._player.dashRecharge + reward.dashRecharge);
    }
  }

  // ─── 외부 인터페이스 ────────────────────────────────────────
  // 💡 플래그 소비 (호출 후 false로 리셋)
  consumeNewMissionFlag() {
    const v = this.newMissionFlag;
    this.newMissionFlag = false;
    return v;
  }

  // 게임 종료 시 획득 뱃지 배열
  getEarnedBadges() {
    return this.completed.map(c => c.badge);
  }

  // 수집형 미션 진행 현황 (캐릭터 위 표시용)
  getDisplayItems() {
    const items = [];
    for (const m of this.active) {
      if (!m.displayEmoji) continue;
      items.push({
        emoji:   m.displayEmoji,
        current: Math.min(Math.floor(this._progress[m.id] ?? 0), m.target),
      });
    }
    return items;
  }

  // ─── 내부 유틸 ──────────────────────────────────────────────
  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
