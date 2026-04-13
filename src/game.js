// src/game.js — 메인 게임 클래스 (게임 루프 / 시스템 통합)

import { Camera }               from './systems/camera.js';
import { GameMap }              from './systems/map.js';
import { Player }               from './entities/player.js';
import { BulletManager }        from './entities/bullet.js';
import { ItemManager }          from './entities/item.js';
import { WaveManager }          from './systems/wave.js';
import { LevelManager }         from './systems/level.js';
import { ScoreManager }         from './systems/score.js';
import { Minimap }              from './systems/minimap.js';
import { UIManager }            from './ui/ui.js';
import { InputManager }         from './systems/input.js';
import { saveScore, getRankingContext } from './services/supabase-client.js';
import { BombNecklaceManager }  from './systems/bomb-necklace.js';
import { MissionSystem }        from './systems/mission.js';
import { VillainManager }       from './entities/villain.js';
import { SKILLS, FEVER, VILLAIN } from './core/constants.js';

const PANEL_W = 260;

function renderRankRow(entry, currentPlayerScore = null) {
  const isCurrent = currentPlayerScore !== null && entry.score === currentPlayerScore;
  const rankClass = entry.rank === 1 ? 'rank-gold'
                  : entry.rank === 2 ? 'rank-silver'
                  : entry.rank === 3 ? 'rank-bronze' : '';
  return `
    <div class="rank-row ${rankClass} ${isCurrent ? 'rank-highlight' : ''}">
      <div class="rank-line1">
        <span class="rank-num">#${entry.rank}</span>
        <span class="rank-name">${entry.player_name}</span>
        <span class="rank-score">${entry.score}pt</span>
      </div>
      <div class="rank-line2">
        <span class="rank-badges">${entry.badges}</span>
      </div>
    </div>`;
}

export class Game {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');

    this._resize();
    window.addEventListener('resize', () => this._resize());

    // ─ 시스템 초기화
    this.camera  = new Camera(canvas.width, canvas.height);
    this.map     = new GameMap();
    this.player  = new Player();
    this.bullets = new BulletManager();
    this.items   = new ItemManager();
    this.waves   = new WaveManager();
    this.levels  = new LevelManager();
    this.scores  = new ScoreManager();
    this.minimap = new Minimap(minimapCanvas);
    this.ui      = new UIManager();
    this.input   = new InputManager();
    this.bomb    = new BombNecklaceManager();
    this.villain = new VillainManager();
    this.mission = new MissionSystem(this.player, this.scores, this.levels);

    // 레벨업 콜백 등록
    this.levels.onLevelUp((level, bonus) => {
      this.player.applyLevelBonus(bonus);
      this.player.showLevelUp(bonus);
      this.bomb.onLevelReached(level);
      this.villain.onLevelReached(level);
      this.mission.notify('level', level);
    });

    // ─ 상태
    this.state        = 'start';
    this._rafId       = null;
    this._lastTime    = 0;

    // ─ 미션 보조 상태
    this._missionHintTimer     = 0;
    this._prevSkillSlowActive  = false;
    this._currentZoneId        = null;

    // 아이템으로 인한 슬로우
    this._itemSlowActive = false;
    this._itemSlowTimer  = 0;

    // 스킬: 슬로우 모드 (W hold) — 스택 기반
    this._skillSlowActive = false;
    this._skillSlowStack  = SKILLS.SLOW_MODE.MAX_STACK;

    // 스킬: 스피드 부스트 (Q hold)
    this._skillSpeedActive   = false;
    this._skillSpeedCooldown = 0;

    // 피버타임
    this._starCount   = 0;
    this._feverActive = false;
    this._feverTimer  = 0;

    this._loop = this._loop.bind(this);
    this._setupButtons();
  }

  _resize() {
    this.canvas.width  = window.innerWidth - PANEL_W;
    this.canvas.height = window.innerHeight;
    if (this.camera) {
      this.camera.viewW = this.canvas.width;
      this.camera.viewH = this.canvas.height;
    }
  }

  _setupButtons() {
    document.getElementById('btn-start').addEventListener('click',         () => this.start());
    document.getElementById('btn-restart').addEventListener('click',       () => this.start());
    document.getElementById('btn-clear-restart').addEventListener('click', () => this.start());

    // 점수 저장 버튼 (게임오버)
    document.getElementById('btn-save-gameover').addEventListener('click', async () => {
      const name   = document.getElementById('gameover-name').value.trim() || 'PLAYER';
      const badges = this.mission.getEarnedBadges().join('');
      const btn    = document.getElementById('btn-save-gameover');
      btn.disabled    = true;
      btn.textContent = '저장 완료 ✓';
      await saveScore(name, this.scores.score, this.waves.wave, this.levels.level, badges);
    });

    // 점수 저장 버튼 (게임 클리어)
    document.getElementById('btn-save-clear').addEventListener('click', async () => {
      const name   = document.getElementById('clear-name').value.trim() || 'PLAYER';
      const badges = this.mission.getEarnedBadges().join('');
      const btn    = document.getElementById('btn-save-clear');
      btn.disabled    = true;
      btn.textContent = '저장 완료 ✓';
      await saveScore(name, this.scores.score, this.waves.wave, this.levels.level, badges);
    });
  }

  start() {
    // 모든 시스템 리셋
    this.player.reset();
    this.bullets.reset();
    this.items.reset();
    this.waves.reset();
    this.levels.reset();
    this.scores.reset();
    this._itemSlowActive     = false;
    this._itemSlowTimer      = 0;
    this._skillSlowActive    = false;
    this._skillSlowStack     = SKILLS.SLOW_MODE.MAX_STACK;
    this._skillSpeedActive   = false;
    this._skillSpeedCooldown = 0;
    this.player.speedMult    = 1.0;
    this._nextDashMilestoneIdx = 0;
    this._starCount          = 0;
    this._feverActive        = false;
    this._feverTimer         = 0;
    this.bomb.reset();
    this.villain.reset();
    this.mission.reset();
    this._missionHintTimer    = 0;
    this._prevSkillSlowActive = false;
    this._currentZoneId       = null;

    // UI 초기화 — 모든 스크린 숨김, HUD + 왼쪽 패널 표시
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('hud-overlay').style.display = '';
    document.getElementById('left-panel').style.display = '';

    this.state     = 'playing';
    this._lastTime = performance.now();

    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = requestAnimationFrame(this._loop);
  }

  // ─── 게임 루프 ───────────────────────────────────────────────
  _loop(ts) {
    const dt = Math.min((ts - this._lastTime) / 1000, 0.05); // 최대 50ms 캡
    this._lastTime = ts;

    if (this.state === 'playing') {
      this._update(dt);
      this._render();
    }

    // just-pressed 플래그 초기화 (매 프레임 끝)
    this.input.flushJustPressed();
    this._rafId = requestAnimationFrame(this._loop);
  }

  // ─── Update ─────────────────────────────────────────────────
  _update(dt) {
    // 1. 대시 (E 키, input에서 원샷 처리)
    if (this.input.isDashPressed()) {
      const { dx, dy } = this.input.getMovementDir();
      const dashed = this.player.tryDash(dx, dy);
      if (dashed) {
        const seg   = this.player.getDashSegment();
        const count = this.bullets.handleDash(seg.x1, seg.y1, seg.x2, seg.y2, this.player.radius + 6);
        this.mission.notify('use_dash');
        if (count > 0) this.mission.notify('dash_destroy_bullet', count);
        // 빌런 대시 피격 판정
        const villainResult = this.villain.checkDashHit(seg.x1, seg.y1, seg.x2, seg.y2, this.player.radius + 6);
        if (villainResult === 'dead') {
          this.scores.score += VILLAIN.REWARD_SCORE;
          this.levels.addExp(VILLAIN.REWARD_EXP);
        }
      }
    }

    // 2. 스킬: 슬로우 모드 (W hold) — 스택 소모/충전 방식
    const wHeld = this.input.isSlowModeHeld() && !this._skillSpeedActive;
    if (wHeld && this._skillSlowStack > 0) {
      this._skillSlowActive = true;
      this._skillSlowStack  = Math.max(0, this._skillSlowStack - dt);
      if (this._skillSlowStack <= 0) this._skillSlowActive = false;
    } else {
      this._skillSlowActive = false;
      if (this._skillSlowStack < SKILLS.SLOW_MODE.MAX_STACK) {
        this._skillSlowStack = Math.min(
          SKILLS.SLOW_MODE.MAX_STACK,
          this._skillSlowStack + SKILLS.SLOW_MODE.REGEN_RATE * dt
        );
      }
    }

    // 슬로우 스킬 최초 활성화 감지 (false → true 전환 시 1회 카운트)
    if (!this._prevSkillSlowActive && this._skillSlowActive) {
      this.mission.notify('use_slow');
    }
    this._prevSkillSlowActive = this._skillSlowActive;

    // 3. 스킬: 스피드 부스트 (Q hold) — 슬로우 스킬 활성 중이면 사용 불가 (아이템 슬로우는 허용)
    const qHeld = this.input.isSpeedBoostHeld() && !this._skillSlowActive;
    if (this._skillSpeedCooldown > 0) {
      this._skillSpeedCooldown -= dt;
      if (this._skillSpeedCooldown < 0) this._skillSpeedCooldown = 0;
      this._skillSpeedActive = false;
      this.player.speedMult  = 1.0;
    } else if (qHeld) {
      this._skillSpeedActive = true;
      this.player.speedMult  = SKILLS.SPEED_BOOST.SPEED_MULT;
    } else {
      if (this._skillSpeedActive) {
        this._skillSpeedCooldown = SKILLS.SPEED_BOOST.COOLDOWN;
      }
      this._skillSpeedActive = false;
      this.player.speedMult  = 1.0;
    }
    this.player.speedBoostActive = this._skillSpeedActive;

    // 스킬: 속도 부스트 사용 시간 누적
    if (this._skillSpeedActive) {
      this.mission.notify('speed_boost_time', dt);
    }

    // 피격 없이 생존 시간 누적 (S1, S2 미션)
    this.mission.notify('nohit_time', dt);

    // 4. 플레이어 이동
    this.player.update(dt, this.input);

    // 5. 웨이브 진행
    const waveChanged = this.waves.update(dt);
    if (waveChanged) this.mission.notify('wave', this.waves.wave);

    // 6. 아이템 슬로우 타이머
    if (this._itemSlowActive) {
      this._itemSlowTimer -= dt;
      if (this._itemSlowTimer <= 0) this._itemSlowActive = false;
    }

    // 슬로우 효과: 아이템 OR 스킬
    const slowActive = this._itemSlowActive || this._skillSlowActive;

    // 7. 탄막 업데이트
    this.bullets.update(dt, this.waves.wave, this.player.x, this.player.y, slowActive);

    // 8. 아이템 업데이트
    this.items.update(dt);

    // 9. 아이템 획득 판정
    const picked = this.items.checkPickup(this.player.x, this.player.y, this.player.radius + 5);
    if (picked.length > 0) {
      const zone = this.map.getZoneAt(this.player.x, this.player.y);
      const mult = zone?.rewardMult ?? 1.0;

      for (const item of picked) {
        this.scores.addItemScore(item.config.score, mult);
        this.levels.addExp(item.config.exp);

        if (item.type === 'health') this.player.heal(1);
        if (item.type === 'shield') {
          this.player.addShield();
          this.mission.notify('collect_shield');
        }
        if (item.type === 'slow') {
          this._itemSlowActive = true;
          this._itemSlowTimer  = item.config.slowDuration;
        }
        if (item.type === 'exp') {
          this._starCount++;
          this.mission.notify('collect_star');
          this.mission.notify('star_nohit_streak');
          const prevFever = this._feverActive;
          if (this._starCount % FEVER.STAR_COUNT === 0) {
            this._feverActive = true;
            this._feverTimer  = FEVER.DURATION;
            this.player.setFever(true);
          }
          if (!prevFever && this._feverActive) {
            this.mission.notify('fever');
          }
        }
        // 이벤트 구역 아이템 수집 (Z2)
        if (zone?.id === 4) {
          this.mission.notify('collect_event_zone');
        }
      }
    }

    // 9-1. 피버타임 업데이트
    if (this._feverActive) {
      this._feverTimer -= dt;
      this.player.speedMult = 2.5;  // 피버 중 이동속도 2.5×
      this.items.magnetToward(this.player.x, this.player.y, FEVER.MAGNET_RADIUS, FEVER.MAGNET_SPEED, dt);
      if (this._feverTimer <= 0) {
        this._feverActive = false;
        this._feverTimer  = 0;
        this.player.setFever(false);
        // speedMult는 다음 프레임 step 3에서 자동 복원
      }
    }

    // 9-2. 폭탄 목걸이 업데이트
    const bombResult = this.bomb.update(dt);
    if (bombResult === 'explode') { this._bombExplode(); return; }
    const bombPickup = this.bomb.checkKeyPickup(this.player.x, this.player.y, this.player.radius);
    if (bombPickup === 'cleared') {
      this.mission.notify('bomb_complete');
    }

    // 9-3. 빌런 업데이트 및 접촉 판정
    this.villain.update(dt, this.waves.wave, this.player.x, this.player.y);
    this.villain.absorbItems(this.items.items, dt);
    if (this.villain.checkPlayerContact(this.player.x, this.player.y, this.player.hitboxRadius)) {
      const damaged = this.player.takeDamage();
      if (damaged) this.scores.onHit();
    }

    // 9-4. 구역 방문 추적 + 고위험 구역 체류 (미션 Z1, Z3)
    {
      const curZone = this.map.getZoneAt(this.player.x, this.player.y);
      if (curZone) {
        // 구역 변경 시 방문 기록
        if (curZone.id !== this._currentZoneId) {
          this._currentZoneId = curZone.id;
          if (curZone.id !== 0) this.mission.notify('visit_zone', curZone.id);
        }
        // 고위험 구역 체류 (rewardMult >= 2.0 = high-risk)
        if (curZone.rewardMult >= 2.0) {
          this.mission.notify('zone_highrise', dt);
        }
      }
    }

    // 10. 탄막 충돌 판정 (히트박스 기준)
    // 피버 중: 접촉 탄막 파괴 (데미지 없음, break 없이 전부 처리)
    // 일반: 프레임당 1회 피격
    {
      const hbr = this.player.hitboxRadius;
      for (const b of this.bullets.bullets) {
        if (!b.alive) continue;
        const dx = this.player.x - b.x;
        const dy = this.player.y - b.y;
        if (dx * dx + dy * dy < (hbr + b.radius) * (hbr + b.radius)) {
          if (this.player.feverActive) {
            b.alive = false;
          } else if (!this.player.invincible && !this.player.isDashing) {
            const damaged = this.player.takeDamage();
            if (damaged) {
              this.scores.onHit();
              this.mission.notify('hit');
            }
            b.alive = false;
            break;
          }
        }
      }
    }

    // 11. 점수 업데이트
    this.scores.update(dt);
    this.mission.notify('score', this.scores.score);

    // 11-1. 대시 스택 마일스톤 (2000, 4000, 6000, 8000, 10000)
    const DASH_MILESTONES = [2000, 4000, 6000, 8000, 10000];
    while (
      this._nextDashMilestoneIdx < DASH_MILESTONES.length &&
      this.scores.score >= DASH_MILESTONES[this._nextDashMilestoneIdx]
    ) {
      this.player.dashStacksMax++;
      this.player.dashStacks = Math.min(this.player.dashStacks + 1, this.player.dashStacksMax);
      this._nextDashMilestoneIdx++;
    }

    // 11-2. 미션 💡 힌트 타이머 + 캐릭터 위 수집 표시 주입
    if (this.mission.consumeNewMissionFlag()) {
      this._missionHintTimer = 1.0;
    }
    if (this._missionHintTimer > 0) this._missionHintTimer -= dt;
    this.player._missionDisplayItems = this.mission.getDisplayItems();

    // 12. 카메라 추적
    this.camera.follow(this.player.x, this.player.y);

    // 13. HUD 업데이트
    this.ui.update(
      dt,
      this.scores.score,
      this.waves.wave,
      this.levels.level,
      this.player.life,
      this.player.maxLife,
      this.levels.getExpProgress(),
      this.player.dashStacks,
      this.player.dashStacksMax,
      this.player.shield,
      // 스킬 상태
      this._skillSlowActive,
      this._skillSlowStack,
      this._skillSpeedActive,
      Math.max(0, this._skillSpeedCooldown)
    );

    // 13-1. 미션 패널 UI 업데이트
    this.ui.renderMissions(this.mission.active, this.mission._progress);

    // 14. 미니맵 렌더링
    this.minimap.render(this.player, this.items.items);

    // 15. 종료 조건 체크
    if (this.player.life <= 0) { this._gameOver(); return; }
    if (this.scores.isCleared()) { this._gameClear(); return; }
  }

  // ─── Render ─────────────────────────────────────────────────
  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 월드 공간 렌더링
    this.camera.apply(ctx);

    this.map.render(ctx);
    this.items.render(ctx, this.camera);
    this.bullets.render(ctx, this.camera);
    this.player.render(ctx);

    // 슬로우 필드 이펙트
    if (this._itemSlowActive || this._skillSlowActive) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, 130, 0, Math.PI * 2);
      ctx.fillStyle   = 'rgba(41,182,246,0.07)';
      ctx.strokeStyle = 'rgba(41,182,246,0.3)';
      ctx.lineWidth   = 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 슬로우 잔량 링 (플레이어 외곽, 월드 공간)
    {
      const slowStack = this._skillSlowStack;
      const SLOW_MAX  = SKILLS.SLOW_MODE.MAX_STACK;
      if (this._skillSlowActive || slowStack < SLOW_MAX) {
        const sr       = this.player.radius + 22;
        const progress = slowStack / SLOW_MAX;
        const endAngle = -Math.PI / 2 + Math.PI * 2 * progress;
        ctx.save();
        // 배경 전체 링
        ctx.beginPath();
        ctx.arc(this.player.x, this.player.y, sr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(41,182,246,0.15)';
        ctx.lineWidth   = 2.5;
        ctx.stroke();
        // 잔량 호
        ctx.beginPath();
        ctx.arc(this.player.x, this.player.y, sr, -Math.PI / 2, endAngle);
        ctx.strokeStyle = this._skillSlowActive
          ? 'rgba(41,182,246,0.90)'
          : `rgba(41,182,246,${0.3 + progress * 0.5})`;
        ctx.lineWidth   = 2.5;
        ctx.shadowColor = '#29b6f6';
        ctx.shadowBlur  = this._skillSlowActive ? 10 : 4;
        ctx.lineCap     = 'round';
        ctx.stroke();
        ctx.restore();
      }
    }

    // 폭탄 목걸이 열쇠 (월드 공간)
    this.bomb.renderWorld(ctx);

    // 빌런 (월드 공간)
    this.villain.renderWorld(ctx);

    this.camera.restore(ctx);

    // ── 스크린 공간 오버레이 ──────────────────────────────
    // 피버타임 맵 테두리 효과
    if (this._feverActive) {
      const W = this.canvas.width, H = this.canvas.height;
      const progress  = this._feverTimer / FEVER.DURATION;
      const perimeter = 2 * (W + H);
      const dashLen   = perimeter * progress;
      ctx.save();
      ctx.strokeStyle = `rgba(255,50,50,0.85)`;
      ctx.lineWidth   = 8;
      ctx.shadowColor = '#ff3232';
      ctx.shadowBlur  = 20;
      ctx.setLineDash([dashLen, perimeter]);
      ctx.strokeRect(4, 4, W - 8, H - 8);
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 폭탄 목걸이 HUD (스크린 공간)
    this.bomb.renderHUD(ctx, this.canvas.width, this.canvas.height, this.player, this.camera);

    // 빌런 HUD (스크린 공간)
    this.villain.renderHUD(ctx, this.canvas.width, this.canvas.height, this.player, this.camera);

    // 💡 새 미션 알림 이모지 (스크린 공간)
    if (this._missionHintTimer > 0) {
      const elapsed = 1.0 - this._missionHintTimer;
      let alpha;
      if (elapsed < 0.3)      alpha = elapsed / 0.3;
      else if (elapsed < 0.7) alpha = 1.0;
      else                    alpha = 1.0 - (elapsed - 0.7) / 0.3;

      const sx = this.player.x - this.camera.x;
      const sy = this.player.y - this.camera.y;
      ctx.save();
      ctx.globalAlpha  = Math.max(0, alpha);
      ctx.font         = '28px sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('💡', sx, sy - this.player.radius - 60);
      ctx.restore();
    }
  }

  // ─── 게임 종료 처리 ─────────────────────────────────────────
  _gameOver() {
    this.state = 'gameover';
    document.getElementById('gameover-score').textContent = this.scores.score;
    const btn = document.getElementById('btn-save-gameover');
    btn.disabled    = false;
    btn.textContent = '저장하기';
    document.getElementById('gameover-name').value = '';
    document.getElementById('screen-gameover').classList.remove('hidden');
    this._showEndScreen('gameover', this.scores.score);
  }

  _bombExplode() {
    this.state = 'gameover';
    document.getElementById('gameover-score').textContent = this.scores.score;
    const btn = document.getElementById('btn-save-gameover');
    btn.disabled    = false;
    btn.textContent = '저장하기';
    document.getElementById('gameover-name').value = '';
    document.getElementById('screen-gameover').classList.remove('hidden');
    this._showEndScreen('gameover', this.scores.score);
  }

  _gameClear() {
    this.state = 'clear';
    document.getElementById('clear-score').textContent = this.scores.score;
    const btn = document.getElementById('btn-save-clear');
    btn.disabled    = false;
    btn.textContent = '저장하기';
    document.getElementById('clear-name').value = '';
    document.getElementById('screen-clear').classList.remove('hidden');
    this._showEndScreen('clear', this.scores.score);
  }

  async _showEndScreen(prefix, score) {
    const badges = this.mission.getEarnedBadges();
    const badgeEl  = document.getElementById(`${prefix}-badges`);
    const rankEl   = document.getElementById(`${prefix}-rank`);
    const nearbyEl = document.getElementById(`${prefix}-nearby`);

    if (badgeEl)  badgeEl.textContent = badges.length > 0 ? badges.join('') : '—';
    if (rankEl)   rankEl.textContent  = '랭킹 조회 중…';
    if (nearbyEl) nearbyEl.innerHTML  = '';

    const { rank, nearby } = await getRankingContext(score);
    if (rankEl)   rankEl.textContent = rank ? `예상 순위: #${rank}` : '';
    if (nearbyEl && nearby.length > 0)
      nearbyEl.innerHTML = nearby.map(e => renderRankRow(e, score)).join('');
  }
}
