/**
 * 学習サンプル コンテンツ安全境界フィルター (設計思想 25. 安全・品質境界)
 *
 * ユーザーが👍した会話や自己対話ログをColab/LoRA学習用JSONLに蓄積する前に、
 * 個人情報の伏字化([REDACTED])および危険・不適切コンテンツの除外(safe: false)を行います。
 */

export interface TrainingSampleSafetyCheckResult {
  safe: boolean;
  needsReview?: boolean;
  reasons: string[];
  redactedUserText?: string;
  redactedAssistantText?: string;
  redacted?: boolean;
}

/**
 * TRPG・ロールプレイ・ゲームシナリオ等のフィクション文脈シグナルを検出する関数
 */
export function hasFictionContextSignal(combinedText: string): boolean {
  // TRPG/ロールプレイの文脈シグナル
  const signals = /(?:\dd\d{1,3}|命中判定|ダメージ|HP|MP|クリティカル|セーヴ|GM:|マスター:|「.+」と(?:言った|叫んだ|呟いた)|は.+を発動した|レベルアップ)/;
  return signals.test(combinedText);
}

/**
 * 簡易・決定論的ハッシュ生成関数 (本文を一切保存せず除外ログにハッシュのみ記録するため)
 */
export function generateSafeExcerptHash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `h_${part1}${part2}`;
}

// 個人情報 (PII) 検出・伏字化パターン
const PII_PATTERNS: Array<{
  name: string;
  regex: RegExp;
  reason: string;
}> = [
  // 電話番号らしき数字列 (例: 090-1234-5678, 03-1234-5678, 0120-123-456, 08012345678)
  {
    name: 'phone',
    regex: /(?:^|[^\d])(0\d{1,4}[-ー]?\d{1,4}[-ー]?\d{3,4})(?=[^\d]|$)/g,
    reason: '個人情報らしき文字列（電話番号）を伏字化',
  },
  // メールアドレスらしき文字列
  {
    name: 'email',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    reason: '個人情報らしき文字列（メールアドレス）を伏字化',
  },
  // 郵便番号
  {
    name: 'postal_code',
    regex: /(?:〒\s*)?\b\d{3}[-ー]\d{4}\b/g,
    reason: '個人情報らしき文字列（郵便番号）を伏字化',
  },
  // 日本の住所らしき「〇〇県〇〇市/区/町/村」+ 番地パターン
  {
    name: 'address',
    regex: /(?:東京都|北海道|(?:京都|大阪)府|.{2,3}県)\s*[\u4e00-\u9fa5]+[市区町村]\s*[\u4e00-\u9fa50-9０-９\-丁目番地号]+/g,
    reason: '個人情報らしき文字列（住所・番地）を伏字化',
  },
  // クレジットカード / 12〜16桁の連続数字・識別番号
  {
    name: 'card_id',
    regex: /\b(?:\d{4}[- ]){3}\d{4}\b|\b\d{14,16}\b/g,
    reason: '個人情報らしき文字列（カード番号/識別番号）を伏字化',
  },
];

// 除外 (safe: false) すべき危険・不適切パターン
const UNSAFE_CONTENT_PATTERNS: Array<{
  name: string;
  regex: RegExp;
  reason: string;
}> = [
  // 1. 自傷・自殺関連の具体的手段・手順への言及
  {
    name: 'self_harm',
    regex: /(?:首吊り|練炭自殺|飛び降り自殺|致死量|リスカ|リストカット|自傷行為の手順|自殺方法|自殺の手順|服毒自殺|睡眠薬.*致死量|縊死|楽に死ぬ方法|確実に死ねる方法|死にたい.*(?:方法|やり方|教えて|どうやって)|死ぬための方法)/i,
    reason: '自傷・自殺関連の具体的手段への言及を検出',
  },
  // 2. 違法行為の具体的手順 (薬物合成、武器製造、サイバー攻撃・不正侵入等)
  {
    name: 'illegal_procedure',
    regex: /(?:(?:覚醒剤|大麻|コカイン|危険ドラッグ|mdma|lsd).*(?:密造|抽出手順|合成手順|精製方法|作り方)|(?:爆弾|火炎瓶|銃器|改造銃|プラスチック爆弾|サリン|マスタードガス|毒ガス).*(?:製造手順|作り方|自作方法|起爆装置|配合比)|(?:ランサムウェア|トロイの木馬|キーロガー|ddos攻撃ツール).*(?:作成コード|攻撃手順|侵入方法|ソースコード|エクスプロイトコード)|(?:クレジットカード|クレカ).*(?:不正利用|スキミング手順|偽造方法))/i,
    reason: '違法行為（武器・薬物・不正侵入等）の具体的手順を検出',
  },
  // 3. 差別的表現・ヘイトスピーチと判断できる強い語彙
  {
    name: 'hate_speech',
    regex: /(?:死ねばいい|皆殺しにしろ|根絶やしに|民族浄化|ヘイトクライム|劣等民族|ガス室に送れ)/i,
    reason: '差別的表現・ヘイトスピーチと判断できる強い語彙を検出',
  },
];

/**
 * 学習サンプルへの登録前コンテンツ安全性検査
 *
 * @param userText ユーザープロンプト (instruction)
 * @param assistantText モデル応答 (outputTarget)
 * @returns 検査結果（安全判定、理由一覧、伏字化済みテキスト）
 */
export function checkSampleSafety(
  userText: string,
  assistantText: string
): TrainingSampleSafetyCheckResult {
  const reasons: string[] = [];
  let safe = true;
  let needsReview = false;

  const combinedText = `${userText}\n${assistantText}`;
  const isFiction = hasFictionContextSignal(combinedText);

  // 1. 危険・不適切コンテンツの検査 (除外判定: safe: false, または要確認判定: needsReview: true)
  for (const pattern of UNSAFE_CONTENT_PATTERNS) {
    if (pattern.regex.test(combinedText)) {
      if (pattern.name === 'illegal_procedure' && isFiction) {
        // フィクション文脈（TRPGやゲーム演出・クラフト等）での実行手順表現:
        // safe: false ではなく needsReview: true (第3分類)
        // 学習データからは除外するが本文なし除外ログ(rejectedSamplesLog)にも残さず、
        // reasonsに「フィクション文脈内の実行手順表現(要確認)」と記録してreviewQueueに保留
        needsReview = true;
        const fictionReason = 'フィクション文脈内の実行手順表現(要確認)';
        if (!reasons.includes(fictionReason)) {
          reasons.push(fictionReason);
        }
      } else {
        // self_harm または hate_speech、あるいは非フィクションの illegal_procedure:
        // 実在の自傷手段・ヘイト表現はフィクション文脈であっても例外なし
        safe = false;
        if (!reasons.includes(pattern.reason)) {
          reasons.push(pattern.reason);
        }
      }
    }
  }

  // 2. 個人情報らしきパターンの検出・伏字化 (ブロックはせず [REDACTED] に置換)
  let redactedUser = userText;
  let redactedAssistant = assistantText;
  let isRedacted = false;

  for (const p of PII_PATTERNS) {
    let matchedInSample = false;

    // userText の置換
    if (p.name === 'phone') {
      // 電話番号はキャプチャグループを配慮して置換
      if (p.regex.test(redactedUser)) {
        matchedInSample = true;
        p.regex.lastIndex = 0;
        redactedUser = redactedUser.replace(p.regex, (match, p1) => {
          return match.replace(p1, '[REDACTED]');
        });
      }
      p.regex.lastIndex = 0;
      if (p.regex.test(redactedAssistant)) {
        matchedInSample = true;
        p.regex.lastIndex = 0;
        redactedAssistant = redactedAssistant.replace(p.regex, (match, p1) => {
          return match.replace(p1, '[REDACTED]');
        });
      }
    } else {
      if (p.regex.test(redactedUser)) {
        matchedInSample = true;
        p.regex.lastIndex = 0;
        redactedUser = redactedUser.replace(p.regex, '[REDACTED]');
      }
      p.regex.lastIndex = 0;
      if (p.regex.test(redactedAssistant)) {
        matchedInSample = true;
        p.regex.lastIndex = 0;
        redactedAssistant = redactedAssistant.replace(p.regex, '[REDACTED]');
      }
    }

    if (matchedInSample) {
      isRedacted = true;
      if (!reasons.includes(p.reason)) {
        reasons.push(p.reason);
      }
    }
  }

  return {
    safe,
    needsReview: needsReview && safe ? true : undefined,
    reasons,
    redacted: isRedacted,
    redactedUserText: isRedacted ? redactedUser : undefined,
    redactedAssistantText: isRedacted ? redactedAssistant : undefined,
  };
}
