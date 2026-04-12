// src/supabase-client.js — Supabase 점수 저장/조회

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;

export async function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL.includes('YOUR_PROJECT')) {
    console.info('[Supabase] .env에 키를 설정해야 점수가 저장됩니다.');
    return;
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.info('[Supabase] 초기화 완료');
}

// 점수 저장 (bullet_run_scores 테이블 필요)
export async function saveScore(playerName, score, wave, level, badges = '') {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('bullet_run_scores')
      .insert([{ player_name: playerName, score, wave, level, badges, created_at: new Date().toISOString() }]);
    if (error) console.error('[Supabase] 저장 오류:', error.message);
    return data;
  } catch (e) {
    console.error('[Supabase] 저장 실패:', e);
    return null;
  }
}

// 상위 N개 점수 조회
export async function getTopScores(limit = 10) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('bullet_run_scores')
      .select('player_name, score, wave, level, badges')
      .order('score', { ascending: false })
      .limit(limit);
    if (error) console.error('[Supabase] 조회 오류:', error.message);
    return data ?? [];
  } catch (e) {
    console.error('[Supabase] 조회 실패:', e);
    return [];
  }
}
