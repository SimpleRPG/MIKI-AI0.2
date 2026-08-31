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
  miki: {
    id: 'miki',
    name: 'みき',
    avatar: '🌸',
    roleName: '専属AIパートナー (対話・育成・開発)',
    color: '#f43f5e',
    badgeBg: 'bg-rose-950/70',
    badgeBorder: 'border-rose-500/40',
    badgeText: 'text-rose-300',
    description: 'あなた専属のAI相棒。日常会話からゲーム開発・コード作成まで1対1で寄り添います。',
    recommendedFor: '日常の雑談、相談、ゲーム・アプリ制作、コード診断'
  },
  qwen_coder: {
    id: 'qwen_coder',
    name: 'みき (Code開発モード)',
    avatar: '💻',
    roleName: 'コード・アーキテクト',
    color: '#38bdf8',
    badgeBg: 'bg-sky-950/70',
    badgeBorder: 'border-sky-500/40',
    badgeText: 'text-sky-300',
    description: 'HTML5/JS/Canvas/CSS 実装・アルゴリズム設計・API連携',
    recommendedFor: 'プログラム作成、UIコンポーネント、新機能追加'
  },
  deepseek_logic: {
    id: 'deepseek_logic',
    name: 'みき (Logic・バグ診断モード)',
    avatar: '🧩',
    roleName: '論理・アルゴリズム検証',
    color: '#10b981',
    badgeBg: 'bg-emerald-950/70',
    badgeBorder: 'border-emerald-500/40',
    badgeText: 'text-emerald-300',
    description: 'バグ原因診断・物理演算・勝敗判定・エッジケース検証',
    recommendedFor: 'バグ修正、ゲームルールの論理検証、計算'
  },
  gpu_shader: {
    id: 'gpu_shader',
    name: 'みき (WebGPU Shaderモード)',
    avatar: '⚡',
    roleName: 'GPU描画 & 60FPS最適化',
    color: '#a855f7',
    badgeBg: 'bg-purple-950/70',
    badgeBorder: 'border-purple-500/40',
    badgeText: 'text-purple-300',
    description: 'WGSL/WebGPU/Canvas/WebGL・流体・パーティクル・描画負荷軽減',
    recommendedFor: '3D表現、シェーダー、パーティクル演出'
  }
};
