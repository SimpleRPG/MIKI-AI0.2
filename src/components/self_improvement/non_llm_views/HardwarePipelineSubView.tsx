import React, { useState } from 'react';
import {
  Cpu,
  Zap,
  Activity,
  Layers,
  ShieldCheck,
  Play,
  CheckCircle2,
  Lock,
  Boxes,
  Terminal,
  Server,
  Workflow,
} from 'lucide-react';
import {
  nonLlmHardwarePipelineService,
  NonLlmPipelineExecutionResult,
} from '../../../services/nonLlmHardwarePipelineService';

export const HardwarePipelineSubView: React.FC = () => {
  const [testPrompt, setTestPrompt] = useState('Excelの社員番号列で重複を排除して新規シートに出力する安全なマクロを作って');
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<NonLlmPipelineExecutionResult | null>(null);

  const handleRunPipeline = async () => {
    if (!testPrompt.trim()) return;
    setIsExecuting(true);
    try {
      const res = await nonLlmHardwarePipelineService.executePipeline({
        prompt: testPrompt,
        persona: 'ミキ',
      });
      setLastResult(res);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="p-3.5 bg-slate-900/90 border border-slate-700/80 rounded-xl space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Cpu className="w-4 h-4" />
            </span>
            <h4 className="text-sm font-bold text-emerald-300">
              第14章: ハードウェア・資源の使い分け (CPU / NPU / GPU 全機協調駆動)
            </h4>
          </div>
          <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-mono font-bold">
            外部送信: 0 BYTES
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          LLMに頼らず、端末内の <strong>CPU (構文/DB/CSP)</strong>、<strong>NPU (意図/感情)</strong>、<strong>GPU (並列類似度照合)</strong> を完全協調させて超高速・決定論的に回答およびVBAコードを合成します。
        </p>
      </div>

      {/* 3 Hardware Roles Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* CPU Card */}
        <div className="p-3.5 bg-slate-900/80 border border-sky-500/30 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-sky-400" />
              <span>1. CPU (論理・構文・制約)</span>
            </span>
            <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-500/40 font-mono">
              Core Engine
            </span>
          </div>
          <ul className="text-[10.5px] text-slate-300 space-y-1">
            <li className="flex items-start gap-1.5">
              <span className="text-sky-400 font-bold">•</span>
              <span>Sudachi形態素解析・文字列正規化</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-sky-400 font-bold">•</span>
              <span>SQLite / FTS5 主張全文検索</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-sky-400 font-bold">•</span>
              <span>第10.1節 要求型コンパイラ</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-sky-400 font-bold">•</span>
              <span>第59章 CSP形式制約充足ソルバー</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-sky-400 font-bold">•</span>
              <span>第9.9節 VBA部品合成 & SHA-256検証</span>
            </li>
          </ul>
        </div>

        {/* NPU Card */}
        <div className="p-3.5 bg-slate-900/80 border border-purple-500/30 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-purple-400" />
              <span>2. NPU (意味・意図・感情)</span>
            </span>
            <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-500/40 font-mono">
              Neural Unit
            </span>
          </div>
          <ul className="text-[10.5px] text-slate-300 space-y-1">
            <li className="flex items-start gap-1.5">
              <span className="text-purple-400 font-bold">•</span>
              <span>128次元 意味埋め込みベクトル生成</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-purple-400 font-bold">•</span>
              <span>発言意図分類 (Intent Classification)</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-purple-400 font-bold">•</span>
              <span>第39章 親愛トランスファー & 感情力動</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-purple-400 font-bold">•</span>
              <span>候補部品のTop-Kニューラル順位付け</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-purple-400 font-bold">•</span>
              <span>多値曖昧性の高速スコアリング</span>
            </li>
          </ul>
        </div>

        {/* GPU Card */}
        <div className="p-3.5 bg-slate-900/80 border border-emerald-500/30 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>3. GPU (並列類似度照合)</span>
            </span>
            <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono">
              WebGPU
            </span>
          </div>
          <ul className="text-[10.5px] text-slate-300 space-y-1">
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-400 font-bold">•</span>
              <span>WebGPU 並列コサイン類似度マトリクス</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-400 font-bold">•</span>
              <span>第32章 潜在意図トポロジー幾何計算</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-400 font-bold">•</span>
              <span>部品・主張DBの並列一括スキャン</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-400 font-bold">•</span>
              <span>Galaxy S25 Adreno GPU シェーダー支援</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-400 font-bold">•</span>
              <span>超低遅延テンソルマトリクス演算</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Interactive Pipeline Simulator */}
      <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Workflow className="w-4 h-4 text-emerald-400" />
            <span>全機協調パイプライン テストベンチ (CPU ➔ NPU ➔ GPU ➔ CPU)</span>
          </span>
          <button
            onClick={handleRunPipeline}
            disabled={isExecuting}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>{isExecuting ? '協調処理中...' : '全機協調処理を実行'}</span>
          </button>
        </div>

        <div>
          <input
            type="text"
            value={testPrompt}
            onChange={(e) => setTestPrompt(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:border-emerald-500 outline-none"
            placeholder="プロンプトを入力..."
          />
        </div>

        {lastResult && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            {/* Latency Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 bg-slate-900/80 border border-sky-500/30 rounded-lg text-center">
                <span className="text-[10px] text-sky-400 block font-semibold">CPU 所要時間</span>
                <span className="text-base font-bold text-sky-300 font-mono">
                  {lastResult.telemetry.cpuMs} ms
                </span>
                <span className="text-[9px] text-slate-500 block">構文/CSP/部品合成</span>
              </div>
              <div className="p-2.5 bg-slate-900/80 border border-purple-500/30 rounded-lg text-center">
                <span className="text-[10px] text-purple-400 block font-semibold">NPU 所要時間</span>
                <span className="text-base font-bold text-purple-300 font-mono">
                  {lastResult.telemetry.npuMs} ms
                </span>
                <span className="text-[9px] text-slate-500 block">意図/感情/意味ベクトル</span>
              </div>
              <div className="p-2.5 bg-slate-900/80 border border-emerald-500/30 rounded-lg text-center">
                <span className="text-[10px] text-emerald-400 block font-semibold">GPU 所要時間</span>
                <span className="text-base font-bold text-emerald-300 font-mono">
                  {lastResult.telemetry.gpuMs} ms
                </span>
                <span className="text-[9px] text-slate-500 block">並列類似度マトリクス</span>
              </div>
              <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/50 rounded-lg text-center">
                <span className="text-[10px] text-emerald-300 block font-bold">総処理時間 (Total)</span>
                <span className="text-base font-bold text-emerald-400 font-mono">
                  {lastResult.telemetry.totalMs} ms
                </span>
                <span className="text-[9px] text-emerald-300/80 block">外部通信: 0 bytes</span>
              </div>
            </div>

            {/* Task Breakdown Pipeline */}
            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2 text-xs">
              <span className="font-bold text-slate-300 block text-[11px]">実行タスク詳細ログ (ハードウェア別):</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px]">
                <div className="p-2 bg-slate-950 rounded border border-sky-900/40 space-y-1">
                  <span className="font-bold text-sky-300">CPU タスク:</span>
                  {lastResult.telemetry.cpuTasks.map((t, idx) => (
                    <div key={idx} className="text-slate-400 truncate">✓ {t}</div>
                  ))}
                </div>
                <div className="p-2 bg-slate-950 rounded border border-purple-900/40 space-y-1">
                  <span className="font-bold text-purple-300">NPU タスク:</span>
                  {lastResult.telemetry.npuTasks.map((t, idx) => (
                    <div key={idx} className="text-slate-400 truncate">✓ {t}</div>
                  ))}
                </div>
                <div className="p-2 bg-slate-950 rounded border border-emerald-900/40 space-y-1">
                  <span className="font-bold text-emerald-300">GPU タスク:</span>
                  {lastResult.telemetry.gpuTasks.map((t, idx) => (
                    <div key={idx} className="text-slate-400 truncate">✓ {t}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Assembled Code Result */}
            {lastResult.assembledCode && (
              <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>合成されたVBAコード (第9章 検証済み部品結合):</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    決定論的ハッシュ: {lastResult.telemetry.deterministicHash}
                  </span>
                </div>
                <pre className="p-2.5 bg-slate-950 rounded border border-slate-800 text-[10.5px] font-mono text-emerald-300 overflow-x-auto max-h-56">
                  {lastResult.assembledCode}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
