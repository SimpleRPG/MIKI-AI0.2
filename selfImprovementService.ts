import {
  SelfImprovementRecord,
  TrainingSampleJSONL,
  ModelGeneration,
  MemoryItem,
  ChatMessage,
  SkillItem,
} from '../types';

const RECORDS_STORAGE_KEY = 'miki_ai_self_improvement_records';
const TRAINING_DATA_STORAGE_KEY = 'miki_ai_training_samples';
const MODEL_GENERATIONS_KEY = 'miki_ai_model_generations';

/**
 * 初期モデル世代リスト (設計思想 18. 系統樹 & 25. 安全・品質境界)
 * フェイク数値を排し、基準ベースモデルのみの初期状態からスタートします。
 */
export const INITIAL_GENERATIONS: ModelGeneration[] = [
  {
    generationId: 'gen_v1_0_base',
    modelName: 'Qwen 2.5 Coder 1.5B (Base Stable)',
    baseModel: 'Qwen/Qwen2.5-Coder-1.5B-Instruct',
    version: 'v1.0.0',
    branch: 'stable',
    loraRank: 0,
    trainingSamplesCount: 0,
    status: 'active',
    benchmarkScore: undefined, // 実測未実施
    notes: '基準安定版（初期ベースモデル）。Colab等でLoRA学習・量子化した新世代モデルをインポートすると系統樹に追加されます。',
    createdAt: Date.now(),
  },
];

class SelfImprovementService {
  private records: SelfImprovementRecord[] = [];
  private trainingSamples: TrainingSampleJSONL[] = [];
  private generations: ModelGeneration[] = [];

  constructor() {
    this.loadAll();
  }

  private loadAll(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const rawRec = localStorage.getItem(RECORDS_STORAGE_KEY);
        if (rawRec) this.records = JSON.parse(rawRec);

        const rawTrain = localStorage.getItem(TRAINING_DATA_STORAGE_KEY);
        if (rawTrain) this.trainingSamples = JSON.parse(rawTrain);

        const rawGen = localStorage.getItem(MODEL_GENERATIONS_KEY);
        if (rawGen) {
          this.generations = JSON.parse(rawGen);
        } else {
          this.generations = [...INITIAL_GENERATIONS];
          this.saveGenerations();
        }
      } catch (e) {
        console.warn('Failed to load self-improvement data:', e);
      }
    }
  }

  public saveRecords(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(this.records));
      } catch (e) {}
    }
  }

  public saveTrainingSamples(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(TRAINING_DATA_STORAGE_KEY, JSON.stringify(this.trainingSamples));
      } catch (e) {}
    }
  }

  public saveGenerations(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(MODEL_GENERATIONS_KEY, JSON.stringify(this.generations));
      } catch (e) {}
    }
  }

  public getRecords(): SelfImprovementRecord[] {
    return this.records;
  }

  public getTrainingSamples(): TrainingSampleJSONL[] {
    return this.trainingSamples;
  }

  public getGenerations(): ModelGeneration[] {
    if (this.generations.length === 0) {
      this.generations = [...INITIAL_GENERATIONS];
    }
    return this.generations;
  }

  /**
   * 失敗原因の自動診断 & 改善先ルーター
   * 設計思想 9. メタ学習 & 14. タスク計画
   */
  public diagnoseFailure(
    userMessage: string,
    assistantResponse: string,
    errorDetails?: string,
    contextInfo?: {
      memoriesUsedCount: number;
      promptLengthChars: number;
      engineMode: string;
      modelId?: string;
    }
  ): {
    category: string;
    rootCause: string;
    suggestedFixArea: 'memory' | 'retrieval' | 'prompt' | 'skill' | 'tool' | 'model' | 'no_change';
    recommendation: string;
  } {
    const err = (errorDetails || '').toLowerCase();
    const resp = assistantResponse.toLowerCase();
    const promptLen = contextInfo?.promptLengthChars || 0;

    // 1. コンテキスト長オーバーフロー
    if (err.includes('context') || err.includes('overflow') || err.includes('decode') || promptLen > 3500) {
      return {
        category: 'コンテキスト長超過 (Context Overflow)',
        rootCause: '会話履歴・添付コード・記憶の合算がモデルのコンテキスト予算を超過しました。',
        suggestedFixArea: 'retrieval',
        recommendation: '記憶検索の取得件数を絞り込むか、古い会話履歴を要約してプロンプト予算を圧縮してください。',
      };
    }

    // 2. 記憶不足・事実の食い違い
    if (
      userMessage.includes('覚えてる') ||
      userMessage.includes('前の話') ||
      userMessage.includes('約束') ||
      userMessage.includes('名前は') ||
      userMessage.includes('設定した')
    ) {
      if (contextInfo?.memoriesUsedCount === 0) {
        return {
          category: '記憶検索の不一致 (Retrieval Miss)',
          rootCause: '関連する記憶が端末ストレージに存在するものの、検索クエリに合致せず取得されませんでした。',
          suggestedFixArea: 'retrieval',
          recommendation: '記憶にタグや同義語を追加するか、バイグラム検索の重みを調整してください。',
        };
      }
      return {
        category: '記憶の未登録 (Memory Missing)',
        rootCause: 'ユーザーの過去の意図や事実が記憶に登録されていませんでした。',
        suggestedFixArea: 'memory',
        recommendation: '「かんたんAI教育」または会話から確定事実を記憶として登録してください。',
      };
    }

    // 3. コード文法エラーや複雑なゲームロジックの破綻
    if (
      resp.includes('syntaxerror') ||
      resp.includes('uncaught') ||
      resp.includes('not defined') ||
      userMessage.includes('動かない') ||
      userMessage.includes('エラーが出る') ||
      userMessage.includes('バグ')
    ) {
      return {
        category: 'コード生成・修復の論理破綻 (Code Logic Bug)',
        rootCause: '小型モデル単体の推論力だけでは、依存関係の長い構文やCanvas座標系を正しく処理できませんでした。',
        suggestedFixArea: 'skill',
        recommendation: '「Canvasデバッグスキル」や「構文検証パーサー」の手続きをプロンプトにインジェクトするか、Colabでのコード修復教材でモデルを専門化してください。',
      };
    }

    // 4. 口調やキャラ崩れ
    if (resp.includes('承知いたしました') || resp.includes('申し訳ございません') || resp.includes('人工知能')) {
      return {
        category: '口調・ペルソナ崩れ (Robotic Regression)',
        rootCause: '小型モデルの事前学習重みが強く出て、ロボット的な敬語や定型文に逆戻りしました。',
        suggestedFixArea: 'prompt',
        recommendation: 'プロンプト内の「脱ロボット辞書」の優先順位を上げ、システム指示の末尾にタメ口制約を再バインドしてください。',
      };
    }

    // 5. モデルの表現力上限
    return {
      category: '小型モデル表現力の限界 (Model Capacity Limit)',
      rootCause: '現在の1.5B/0.5Bモデルでは、高度な文脈追従や複雑な複数条件の同時処理が困難でした。',
      suggestedFixArea: 'model',
      recommendation: 'この失敗ケースをJSONL学習データとして保存し、Colab環境でのLoRA学習データセットに含めてください。',
    };
  }

  /**
   * ユーザーからの👎フィードバックや会話の成功を学習用JSONLに追加
   * 設計思想 7. 学習データの改善
   */
  public addTrainingSample(sample: {
    instruction: string;
    inputContext?: string;
    outputTarget: string;
    category?: TrainingSampleJSONL['category'];
    reliability?: TrainingSampleJSONL['reliability'];
    approved?: boolean;
    originalFailureOutput?: string;
    failureReason?: string;
  }): TrainingSampleJSONL {
    const newSample: TrainingSampleJSONL = {
      id: 'train_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      instruction: sample.instruction,
      inputContext: sample.inputContext,
      outputTarget: sample.outputTarget,
      category: sample.category || 'chat',
      reliability: sample.reliability || 'high',
      approved: sample.approved ?? true,
      originalFailureOutput: sample.originalFailureOutput,
      failureReason: sample.failureReason,
      createdAt: Date.now(),
    };

    this.trainingSamples.unshift(newSample);
    this.saveTrainingSamples();
    return newSample;
  }

  public deleteTrainingSample(id: string): void {
    this.trainingSamples = this.trainingSamples.filter((s) => s.id !== id);
    this.saveTrainingSamples();
  }

  /**
   * Colab / LoRA学習用のJSONLファイル出力
   */
  public exportTrainingJSONL(filterOnlyApproved: boolean = true): string {
    const pool = filterOnlyApproved
      ? this.trainingSamples.filter((s) => s.approved)
      : this.trainingSamples;

    const jsonlRows = pool.map((item) => {
      const messages = [
        {
          role: 'system',
          content: 'あなたはユーザー専属のAIパートナー「みき」です。自然な日本語のタメ口で、温かく親身に、高い開発能力を発揮して回答してください。',
        },
      ];

      if (item.inputContext) {
        messages.push({
          role: 'user',
          content: `【参照資料・記憶】\n${item.inputContext}\n\n【依頼】\n${item.instruction}`,
        });
      } else {
        messages.push({
          role: 'user',
          content: item.instruction,
        });
      }

      messages.push({
        role: 'assistant',
        content: item.outputTarget,
      });

      return JSON.stringify({
        id: item.id,
        category: item.category,
        reliability: item.reliability,
        messages,
      });
    });

    return jsonlRows.join('\n');
  }

  /**
   * Google Colab用のLoRA学習Pythonスクリプト(Unsloth / PEFT)を生成
   * 設計思想 1. Colab、学習、量子化、GGUF変換
   */
  public generateColabTrainingScript(modelName: string = 'Qwen/Qwen2.5-Coder-1.5B-Instruct'): string {
    return `# ==============================================================================
# MIKI-AI 自己進化 Colab LoRA Fine-Tuning & GGUF 量子化スクリプト
# 設計思想 1. Colab、学習、量子化、GGUF変換 に基づく完全自動パイプライン
# ==============================================================================

# 1. 依存ライブラリのインストール (高速LoRA Unsloth / PEFT / llama.cpp)
!pip install --no-deps unsloth
!pip install --no-deps "xformers<0.0.29" "trl<0.9.0" peft accelerate bitsandbytes
!pip install datasets torch

import torch
from unsloth import FastLanguageModel
from trl import SFTTrainer
from transformers import TrainingArguments
from datasets import load_dataset

# 2. ベースモデルの設定 (Galaxy S25推奨: 1.5B Q4_K_M)
max_seq_length = 2048
dtype = None # Auto detection
load_in_4bit = True # 4bit 量子化ベース

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = "${modelName}",
    max_seq_length = max_seq_length,
    dtype = dtype,
    load_in_4bit = load_in_4bit,
)

# 3. LoRA アダプターの設定 (Rank 16-32)
model = FastLanguageModel.get_peft_model(
    model,
    r = 16,
    target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_alpha = 16,
    lora_dropout = 0,
    bias = "none",
    use_gradient_checkpointing = "unsloth",
    random_state = 3407,
)

# 4. データセットの読み込み (アプリからエクスポートした dataset.jsonl をアップロード)
dataset = load_dataset("json", data_files={"train": "miki_dataset.jsonl"}, split="train")

def formatting_prompts_func(examples):
    convs = examples["messages"]
    texts = []
    for conv in convs:
        text = tokenizer.apply_chat_template(conv, tokenize=False, add_generation_prompt=False)
        texts.append(text)
    return { "text" : texts }

dataset = dataset.map(formatting_prompts_func, batched = True)

# 5. 学習実行 (SFTTrainer)
trainer = SFTTrainer(
    model = model,
    tokenizer = tokenizer,
    train_dataset = dataset,
    dataset_text_field = "text",
    max_seq_length = max_seq_length,
    dataset_num_proc = 2,
    packing = False,
    args = TrainingArguments(
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4,
        warmup_steps = 5,
        max_steps = 60,
        learning_rate = 2e-4,
        fp16 = not torch.cuda.is_bf16_supported(),
        bf16 = torch.cuda.is_bf16_supported(),
        logging_steps = 1,
        optim = "adamw_8bit",
        weight_decay = 0.01,
        lr_scheduler_type = "linear",
        seed = 3407,
        output_dir = "outputs",
    ),
)

trainer.train()

# 6. GGUF形式 (Q4_K_M) への直接変換 & 保存
# 生成された GGUF ファイルを Galaxy S25 の internal/models/ へ配置すれば完了！
model.save_pretrained_gguf("miki_model_candidate_q4", tokenizer, quantization_method = "q4_k_m")
print("🎉 学習とGGUF変換が完了しました！ 'miki_model_candidate_q4-unsloth.Q4_K_M.gguf' をダウンロードして端末に転送してください。")
`;
  }

  public addGeneration(gen: Omit<ModelGeneration, 'generationId' | 'createdAt'>): ModelGeneration {
    const newGen: ModelGeneration = {
      ...gen,
      generationId: 'gen_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: Date.now(),
    };
    this.generations.push(newGen);
    this.saveGenerations();
    return newGen;
  }

  public deleteGeneration(generationId: string): void {
    // 基準安定版は削除禁止 (設計思想 25. 安全・品質境界)
    this.generations = this.generations.filter((g) => g.generationId !== generationId || g.branch === 'stable');
    this.saveGenerations();
  }

  public resetGenerationsToDefault(): void {
    this.generations = [...INITIAL_GENERATIONS];
    this.saveGenerations();
  }

  /**
   * プロンプト構成規則の静的シミュレーション評価 (ルールベース簡易採点)
   * 設計思想 16. 複数候補、反証、テスト
   * ※実モデル推論のA/Bテストではなく、プロンプト内のタメ口制約・脱ロボット文言・安全境界の含有度を静的評価するシミュレーションです。
   */
  public runPromptABBenchmark(
    testPrompt: string,
    variantA: { name: string; systemPrompt: string },
    variantB: { name: string; systemPrompt: string }
  ): {
    winner: 'A' | 'B' | 'TIE';
    scoreA: number;
    scoreB: number;
    analysis: string;
    isSimulation: true;
  } {
    // 静的ルール評価基準: 自然な日本語表現指定、脱ロボット度、タメ口維持制約、指示追従境界
    const evaluate = (p: string) => {
      let s = 50;
      if (p.includes('タメ口') || p.includes('親友')) s += 15;
      if (p.includes('ロボット') || p.includes('自然な日本語')) s += 15;
      if (p.includes('でっち上げ') || p.includes('安全') || p.includes('制約')) s += 10;
      return Math.min(100, s);
    };

    const scoreA = evaluate(variantA.systemPrompt);
    const scoreB = evaluate(variantB.systemPrompt);

    const winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'TIE';

    return {
      winner,
      scoreA,
      scoreB,
      analysis:
        winner === 'A'
          ? `【静的シミュレーション】候補A「${variantA.name}」が脱ロボット規則とペルソナ親和性ルールで優勢です。（※実推論評価ではありません）`
          : winner === 'B'
          ? `【静的シミュレーション】候補B「${variantB.name}」が制約遵守と日本語自然度ルールで優勢です。（※実推論評価ではありません）`
          : '【静的シミュレーション】両候補ともに同等の静的ルール適合度を示しています。',
      isSimulation: true,
    };
  }
}

export const selfImprovementService = new SelfImprovementService();
