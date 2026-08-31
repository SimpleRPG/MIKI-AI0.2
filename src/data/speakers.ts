export interface SpeakerProfile {
  id: string;
  name: string;
  avatar: string;
  roleName: string;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  description: string;
  recommendedFor: string;
}

export const SPEAKER_PROFILES: Record<string, SpeakerProfile> = {
  council: {
    id: 'council',
    name: 'みき & エキスパート合議',
    avatar: '🌸',
    roleName: 'みき × Qwen × DeepSeek × WebGPU 統合知能',
    color: '#f43f5e',
    badgeBg: 'bg-gradient-to-r from-rose-950/80 via-sky-950/80 to-purple-950/80',
    badgeBorder: 'border-pink-500/50',
    badgeText: 'text-pink-200',
    description: '全専門モデルの知見を1つに集約・統合した最高精度の回答',
    recommendedFor: 'ゲーム制作、バグ修正、おしゃべり、アイデア相談'
  },
  miki: {
    id: 'miki',
    name: 'みき',
    avatar: '🌸',
    roleName: '専属パートナー & 総合進行',
    color: '#f43f5e',
    badgeBg: 'bg-rose-950/70',
    badgeBorder: 'border-rose-500/40',
    badgeText: 'text-rose-300',
    description: '親身な会話・全体統合・ゲームとアイデアのまとめ',
    recommendedFor: '日常の雑談、相談、完成コードの受取'
  },
  qwen_coder: {
    id: 'qwen_coder',
    name: 'Qwen 2.5 Coder',
    avatar: '💻',
    roleName: 'コード・アーキテクト',
    color: '#38bdf8',
    badgeBg: 'bg-sky-950/70',
    badgeBorder: 'border-sky-500/40',
    badgeText: 'text-sky-300',
    description: 'HTML5/JS/Canvas/CSS 実装・関数設計・API連携',
    recommendedFor: 'プログラム作成、UIコンポーネント、新機能追加'
  },
  deepseek_logic: {
    id: 'deepseek_logic',
    name: 'DeepSeek R1 Logic',
    avatar: '🧩',
    roleName: '論理・アルゴリズム検証',
    color: '#10b981',
    badgeBg: 'bg-emerald-950/70',
    badgeBorder: 'border-emerald-500/40',
    badgeText: 'text-emerald-300',
    description: 'バグ原因診断・勝敗判定・物理演算・エッジケース検証',
    recommendedFor: 'バグ修正、ゲームルールの論理検証、計算'
  },
  gpu_shader: {
    id: 'gpu_shader',
    name: 'WebGPU Shader Master',
    avatar: '⚡',
    roleName: 'GPU描画 & 60FPS最適化',
    color: '#a855f7',
    badgeBg: 'bg-purple-950/70',
    badgeBorder: 'border-purple-500/40',
    badgeText: 'text-purple-300',
    description: 'WGSL/WebGPU/Canvas/WebGL・流体・パーティクル・描画負荷軽減',
    recommendedFor: 'グラフィック、エフェクト、60FPS描画改善'
  },
  smollm_fast: {
    id: 'smollm_fast',
    name: 'SmolLM2-360M',
    avatar: '⚡',
    roleName: '超軽量・瞬速レスポンス',
    color: '#f59e0b',
    badgeBg: 'bg-amber-950/70',
    badgeBorder: 'border-amber-500/40',
    badgeText: 'text-amber-300',
    description: 'わずか220MBでスマホでも即座に超低遅延で回答',
    recommendedFor: '低スペック端末、メモリ節約、即答'
  },
  llama_creative: {
    id: 'llama_creative',
    name: 'Llama 3.2 Creative',
    avatar: '🔮',
    roleName: '世界観 & UI演出デザイン',
    color: '#ec4899',
    badgeBg: 'bg-pink-950/70',
    badgeBorder: 'border-pink-500/40',
    badgeText: 'text-pink-300',
    description: 'ゲームのストーリー・フレーバーテキスト・テーマ配色・UX演出',
    recommendedFor: '世界観構築、セリフ作成、テーマデザイン'
  }
};
