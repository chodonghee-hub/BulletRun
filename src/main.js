// src/main.js — 진입점

import { Game }          from './game.js';
import { initSupabase, getTopScores } from './services/supabase-client.js';

async function main() {
  // Supabase 초기화 (config.js 없으면 조용히 건너뜀)
  await initSupabase();

  // 시작 화면 랭킹 표시 (Supabase 연결 시)
  const topScores = await getTopScores(5);
  if (topScores.length > 0) {
    const rankEl = document.getElementById('screen-start-ranking');
    rankEl.innerHTML =
      '<div style="margin-bottom:8px;letter-spacing:.08em;color:#64b5f6;font-size:14px">TOP SCORES</div>' +
      topScores.map((s, i) => {
        const rank = i + 1;
        const rankClass = rank === 1 ? 'rank-gold' : rank === 2 ? 'rank-silver' : rank === 3 ? 'rank-bronze' : '';
        return `<div class="rank-row ${rankClass}">
          <div class="rank-line1">
            <span class="rank-num">#${rank}</span>
            <span class="rank-name">${s.player_name}</span>
            <span class="rank-score">${s.score}pt</span>
          </div>
          <div class="rank-line2"><span class="rank-badges">${s.badges || ''}</span></div>
        </div>`;
      }).join('');
  }

  // 게임 인스턴스 생성
  const canvas        = document.getElementById('game-canvas');
  const minimapCanvas = document.getElementById('minimap-canvas');

  const game = new Game(canvas, minimapCanvas);

  // 첫 시작은 Start 스크린 표시 (game.start()는 버튼 클릭 시 호출)
  document.getElementById('screen-start').classList.remove('hidden');
}

main();
