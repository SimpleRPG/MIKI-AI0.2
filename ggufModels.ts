/**
 * GGUF Model Registry & Metadata
 * Lists official GGUF quantization models compatible with llama.cpp native engine,
 * local llama-server, Ollama, and Web-based GGUF runners.
 */

export interface GgufModelDefinition {
  id: string;
  name: string;
  expertName: string;
  icon: string;
  fileName: string;
  sizeMB: number;
  parameters: string;
  quantization: string;
  vramMB: number;
  description: string;
  downloadUrl: string;
  huggingFaceRepo: string;
  recommendedFor: 'mobile_light' | 'mobile_balanced' | 'mobile_flagship' | 'desktop' | 'code';
}

export const OFFICIAL_GGUF_MODELS: GgufModelDefinition[] = [
  {
    id: 'qwen2.5-coder-0.5b-instruct-q4_k_m',
    name: 'Qwen 2.5 Coder 0.5B (GGUF Q4_K_M)',
    expertName: '🌸 日本語×開発 軽量GGUF (スマホ最速)',
    icon: '🌸',
    fileName: 'qwen2.5-coder-0.5b-instruct-q4_k_m.gguf',
    sizeMB: 395,
    parameters: '0.49B',
    quantization: 'Q4_K_M (4-bit GGUF)',
    vramMB: 650,
    description: '【スマホ推奨GGUF】わずか395MBで日本語会話・HTML/JSゲーム作成が可能な超軽量GGUFモデル。端末RAM/VRAMをほとんど圧迫しません。',
    downloadUrl: 'https://huggingFace.co/Qwen/Qwen2.5-Coder-0.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-0.5b-instruct-q4_k_m.gguf',
    huggingFaceRepo: 'Qwen/Qwen2.5-Coder-0.5B-Instruct-GGUF',
    recommendedFor: 'mobile_light',
  },
  {
    id: 'qwen2.5-coder-1.5b-instruct-q4_k_m',
    name: 'Qwen 2.5 Coder 1.5B (GGUF Q4_K_M)',
    expertName: '⚡ 高精度 日本語＆コードGGUF (バランス型)',
    icon: '⚡',
    fileName: 'qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
    sizeMB: 980,
    parameters: '1.54B',
    quantization: 'Q4_K_M (4-bit GGUF)',
    vramMB: 1350,
    description: '1.5Bパラメータの高性能GGUF。自然な日本語の対話と高度なアルゴリズム・ゲームロジック作成を両立します。',
    downloadUrl: 'https://huggingFace.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
    huggingFaceRepo: 'Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF',
    recommendedFor: 'mobile_balanced',
  },
  {
    id: 'llama-3.2-1b-instruct-q4_k_m',
    name: 'Llama 3.2 1B Instruct (GGUF Q4_K_M)',
    expertName: '💖 Llama 3.2 1B (親密対話・感情共感 GGUF)',
    icon: '💖',
    fileName: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    sizeMB: 820,
    parameters: '1.23B',
    quantization: 'Q4_K_M (4-bit GGUF)',
    vramMB: 1150,
    description: 'Meta開発の軽量Llama 3.2。キャラクター会話や柔軟なアシスタント対話をローカルGGUFで高速実行。',
    downloadUrl: 'https://huggingFace.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    huggingFaceRepo: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
    recommendedFor: 'mobile_balanced',
  },
  {
    id: 'qwen2.5-3b-instruct-q4_k_m',
    name: 'Qwen 2.5 3B Instruct (GGUF Q4_K_M)',
    expertName: '🏆 Qwen 2.5 3B (S25/ハイエンド機フラッグシップGGUF)',
    icon: '🏆',
    fileName: 'qwen2.5-3b-instruct-q4_k_m.gguf',
    sizeMB: 1930,
    parameters: '3.09B',
    quantization: 'Q4_K_M (4-bit GGUF)',
    vramMB: 2500,
    description: 'Snapdragon 8 Elite搭載機（Galaxy S25等）クラスの余裕あるRAM/GPUを最大限活用する高精度モデル。日本語の自然さ・コード生成・論理推論すべてで最上位クラスの応答品質。',
    downloadUrl: 'https://huggingFace.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
    huggingFaceRepo: 'Qwen/Qwen2.5-3B-Instruct-GGUF',
    recommendedFor: 'mobile_flagship',
  },
  {
    id: 'gemma-2-2b-it-q4_k_m',
    name: 'Gemma 2 2B Instruct (GGUF Q4_K_M)',
    expertName: '💎 Google Gemma 2 2B (Google公式・日本語論理 GGUF)',
    icon: '💎',
    fileName: 'gemma-2-2b-it-Q4_K_M.gguf',
    sizeMB: 1750,
    parameters: '2.61B',
    quantization: 'Q4_K_M (4-bit GGUF)',
    vramMB: 2200,
    description: 'Google開発の次世代Gemma 2のGGUF形式。高い日本語文脈理解力と論理推論力を提供。ハイエンド機なら快適に動作します。',
    downloadUrl: 'https://huggingFace.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
    huggingFaceRepo: 'bartowski/gemma-2-2b-it-GGUF',
    recommendedFor: 'mobile_flagship',
  },
  {
    id: 'smollm2-360m-instruct-q4_k_m',
    name: 'SmolLM2 360M Instruct (GGUF Q4_K_M)',
    expertName: '⚡ SmolLM2 360M (超軽量210MB・最高速 GGUF)',
    icon: '⚡',
    fileName: 'SmolLM2-360M-Instruct-Q4_K_M.gguf',
    sizeMB: 229,
    parameters: '360M',
    quantization: 'Q4_K_M (4-bit GGUF)',
    vramMB: 500,
    description: '超軽量229MB。低スペック端末やメモリ制約が厳しい環境で瞬時にロード・動作します。',
    downloadUrl: 'https://huggingFace.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/resolve/main/smollm2-360m-instruct-q4_k_m.gguf',
    huggingFaceRepo: 'HuggingFaceTB/SmolLM2-360M-Instruct-GGUF',
    recommendedFor: 'mobile_light',
  },
  {
    id: 'deepseek-r1-distill-qwen-1.5b-q4_k_m',
    name: 'DeepSeek R1 Distill Qwen 1.5B (GGUF Q4_K_M)',
    expertName: '🧩 DeepSeek R1 (推論・思考・デバッグ GGUF)',
    icon: '🧩',
    fileName: 'DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
    sizeMB: 1120,
    parameters: '1.78B',
    quantization: 'Q4_K_M (4-bit GGUF)',
    vramMB: 1500,
    description: '思考チェーン（Chain-of-Thought）を備えたDeepSeek R1軽量版。バグ修正や難問解決に強みを発揮します。',
    downloadUrl: 'https://huggingFace.co/bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
    huggingFaceRepo: 'bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF',
    recommendedFor: 'code',
  },
];

/**
 * Determine which GGUF model best fits the detected device hardware.
 * - Flagship phones (Snapdragon 8 Gen3/Elite, Apple A17/A18/M-series, 8GB+ RAM):
 *   pick the largest 'mobile_flagship' model that fits comfortably in RAM.
 * - Mid-range phones (4-8GB RAM or Adreno 6xx/Mali-G7x class): 'mobile_balanced'.
 * - Everything else / unknown: 'mobile_light' (safest, always works).
 */
export function pickBestGgufModelForDevice(
  totalMemoryMB: number | undefined,
  gpuRenderer: string | undefined
): GgufModelDefinition {
  const renderer = (gpuRenderer || '').toLowerCase();
  const isFlagshipGpu =
    renderer.includes('apple') ||
    /\bm[1-4]\b/.test(renderer) ||
    /adreno[\s-]?8\d\d/.test(renderer) ||
    renderer.includes('elite') ||
    /adreno[\s-]?7[5-9]\d/.test(renderer);

  const ram = totalMemoryMB || 0;

  let tier: GgufModelDefinition['recommendedFor'] = 'mobile_light';
  if (ram >= 7000 || isFlagshipGpu) {
    tier = 'mobile_flagship';
  } else if (ram >= 3500) {
    tier = 'mobile_balanced';
  }

  const candidates = OFFICIAL_GGUF_MODELS.filter((m) => m.recommendedFor === tier);
  const pool = candidates.length > 0 ? candidates : OFFICIAL_GGUF_MODELS.filter((m) => m.recommendedFor === 'mobile_light');

  // Within the chosen tier, prefer the largest (highest quality) model that still
  // leaves headroom under the device's total RAM (rough 2x safety margin for OS + app).
  const safeMaxVram = ram > 0 ? ram / 2 : Infinity;
  const fitting = pool.filter((m) => m.vramMB <= safeMaxVram);
  const finalPool = fitting.length > 0 ? fitting : pool;

  return finalPool.reduce((best, m) => (m.vramMB > best.vramMB ? m : best), finalPool[0]);
}
