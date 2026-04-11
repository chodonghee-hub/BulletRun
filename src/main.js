// src/main.js — 진입점

import { Game }          from './game.js';
import { initSupabase, getTopScores } from './supabase-client.js';

async function main() {
  // Supabase 초기화 (config.js 없으면 조용히 건너뜀)
  await initSupabase();

  // 시작 화면 랭킹 표시 (Supabase 연결 시)
  const topScores = await getTopScores(5);
  if (topScores.length > 0) {
    const rankEl = document.getElementById('screen-start-ranking');
    rankEl.innerHTML =
      '<div style="margin-bottom:6px;letter-spacing:.08em;color:#64b5f6">TOP SCORES</div>' +
      topScores
        .map((s, i) => `<div>${i + 1}. ${s.badges || ''} ${s.player_name}  ${s.score}pt  LV${s.level}</div>`)
        .join('');
  }

  // 게임 인스턴스 생성
  const canvas        = document.getElementById('game-canvas');
  const minimapCanvas = document.getElementById('minimap-canvas');

  const game = new Game(canvas, minimapCanvas);

  // 첫 시작은 Start 스크린 표시 (game.start()는 버튼 클릭 시 호출)
  document.getElementById('screen-start').classList.remove('hidden');
}

main();
