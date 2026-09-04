import { ResponseLength, ResponseQualityEvaluation, ConversationStage, ConversationState } from '../types';

/**
 * 設計思想 6章「会話処理の三段階分離」および 35章「第3段階」:
 * 1. 回答長選択 (short / standard / detailed)
 * 2. 質問への直接回答 (結論ファースト・前置き排除)
 * 3. 重複削除 (同義反復・ループの排除)
 * 4. 自然な日本語化 (ロボット調排除・防御的態度の排除・親密対話)
 */

export class ResponseDesignService {
  /**
   * 6.2 回答長選択 (Response Length Selection)
   * ユーザーの明示的な要求、発言の性質、直前の会話段階から適切な回答長を判定
   */
  public determineExpectedResponseLength(
    prompt: string,
    state?: ConversationState
  ): { length: ResponseLength; reason: string; targetRange: string } {
    const p = (prompt || '').trim();
    const lower = p.toLowerCase();

    // 1. ユーザーによる明示的な短文指定
    if (
      /短く|簡潔に|一言で|ひとことで|要点だけ|結論だけ|手短に|サクッと|さくっと|1行で|3行で|シンプルに/i.test(p)
    ) {
      return {
        length: 'short',
        reason: 'ユーザーからの明示的な簡潔・短文要求',
        targetRange: '1〜3文（50〜150文字程度）',
      };
    }

    // 2. ユーザーによる明示的な詳細指定
    if (
      /詳しく|詳細に|具体的に|理由も|ステップバイステップ|徹底解説|比較して|どういう仕組み|深く教えて|背景/i.test(p)
    ) {
      return {
        length: 'detailed',
        reason: 'ユーザーからの明示的な詳細・網羅的解説要求',
        targetRange: '構造化された段落（400文字以上）',
      };
    }

    // 3. 挨拶・単純な相槌・短い同意 (15文字以下)
    if (
      p.length <= 15 &&
      /^(おはよう|こんにちは|こんばんは|お疲れ様|おつかれ|やっほー|ありがとう|サンキュー|うん|はい|了解|りょうかい|オッケー|ok|バイバイ|またね|よろしく)/i.test(
        p
      )
    ) {
      return {
        length: 'short',
        reason: '短い挨拶または相槌に対する自然な即答',
        targetRange: '1〜2文（30〜80文字程度）',
      };
    }

    // 4. 単純なYes/No確認または数値計算
    if (/ですか？|なの？|合ってる？|いくら？|何？|だれ？/i.test(p) && p.length < 30) {
      return {
        length: 'short',
        reason: '直接的な単一事実の確認質問',
        targetRange: '1〜3文（50〜120文字程度）',
      };
    }

    // 5. 複雑なコード作成・設計・ロジック問題
    if (/設計|アーキテクチャ|比較検討|実装案|クラス|アルゴリズム/i.test(p) || p.length > 120) {
      return {
        length: 'detailed',
        reason: '複雑な論点を含む多面的な相談',
        targetRange: '詳細な論理構成・具体例付き（300〜600文字程度）',
      };
    }

    // 6. 会話段階による補助判定 (状態管理連携)
    if (state?.stage === 'CLOSING') {
      return {
        length: 'short',
        reason: '会話のクロージング段階',
        targetRange: '1〜2文（30〜80文字程度）',
      };
    }

    // デフォルト: 標準長
    return {
      length: 'standard',
      reason: '一般的な質問・相談に対する標準回答',
      targetRange: '1〜2段落（150〜350文字程度）',
    };
  }

  /**
   * 6.2 & 6.3 回答設計および日本語化プロンプトの構築
   * 結論ファースト、前置きの排除、回答長制約、重複排除、防御的態度の排除を注入
   */
  public buildResponseDesignInstruction(
    length: ResponseLength,
    stage?: ConversationStage
  ): string {
    let lengthDirective = '';
    switch (length) {
      case 'short':
        lengthDirective = `【回答長: 短文 (short)】\n・1〜3文（100文字前後）で簡潔に即答してください。\n・余計な背景説明、前置き、蛇足の確認質問はすべて省き、ズバッと結論だけを答えてください。`;
        break;
      case 'detailed':
        lengthDirective = `【回答長: 詳細 (detailed)】\n・結論を冒頭に述べた上で、理由、具体的な手順、留意点、例外ケースまで論理的に構造化して詳しく解説してください。`;
        break;
      case 'standard':
      default:
        lengthDirective = `【回答長: 標準 (standard)】\n・直接回答に続けて、主要な理由や補足を1〜2段落（200〜350文字程度）で分かりやすくまとめてください。`;
        break;
    }

    const stageDirective =
      stage === 'CORRECTION'
        ? `\n【前提訂正への対応原則】\n・ユーザーから前提を訂正された場合、絶対に言い訳や過剰な謝罪（「申し訳ございません」等）をしないでください。「あ、そっか！〜だね、教えてくれてありがとう！」と前向きに受け止め、新しい前提に基づく修正後の結論を直ちに回答してください。`
        : '';

    return `【回答設計の必須原則 (設計思想 第6章 & 第3段階)】
1. 【質問への直接回答（結論ファースト）】
   ・回答の「最初の1文」で、ユーザーの質問に対する直接の答え（Yes/No、結論、結果、見解）を必ず答えてください。
   ・「ご質問ありがとうございます」「〜についてお答えします」「〜ですね」等の無意味な挨拶や前置きオウム返しは【厳禁】です。
2. ${lengthDirective.replace(/\n/g, '\n   ')}
3. 【重複と不要な繰り返しの排除】
   ・同じ結論や似た表現を同一回答内で2回以上繰り返さないでください。
4. 【確認質問で止めない（自律進行の原則）】
   ・些細な曖昧さで「〜はどうしますか？」と聞き返して会話を止めず、一般的な妥当な前提を置いて回答を進めてください。本当に結論が左右される核心点のみ、末尾で軽く確認してください。
5. 【自然な親友トーン】
   ・ロボットのような敬語や形式的な定型句を排除し、親しみやすい温かい日本語（タメ口）で話してください。${stageDirective}`;
  }

  /**
   * 6.3 重複削除エンジン (Deduplication)
   * 同一文・類似文の連続、同義反復ループ、末尾の重複フレーズを整理
   */
  public deduplicateResponse(text: string): {
    cleanedText: string;
    duplicatesRemovedCount: number;
  } {
    if (!text) return { cleanedText: '', duplicatesRemovedCount: 0 };

    let duplicatesCount = 0;

    // 1. コードブロックを保護して本文のみを分割
    const parts: Array<{ isCode: boolean; content: string }> = [];
    const codeBlockRegex = /```[\s\S]*?```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ isCode: false, content: text.slice(lastIndex, match.index) });
      }
      parts.push({ isCode: true, content: match[0] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push({ isCode: false, content: text.slice(lastIndex) });
    }

    // 2. 本文部分の重複文・重複行を削除
    const processedParts = parts.map((part) => {
      if (part.isCode) return part.content;

      // 行単位での重複排除
      const lines = part.content.split('\n');
      const filteredLines: string[] = [];
      let prevLineTrimmed = '';

      for (const line of lines) {
        const trimmed = line.trim();
        // 空行は連続最大1行まで許可
        if (!trimmed) {
          if (filteredLines.length > 0 && filteredLines[filteredLines.length - 1] !== '') {
            filteredLines.push('');
          }
          prevLineTrimmed = '';
          continue;
        }

        // 完全一致する直前行の重複排除
        if (trimmed === prevLineTrimmed) {
          duplicatesCount++;
          continue;
        }

        // 句点区切りの文単位で重複チェック
        const sentences = trimmed.split(/(?<=[。！？!?\n])/);
        const uniqueSentences: string[] = [];
        let prevSent = '';

        for (const sent of sentences) {
          const sTrim = sent.trim();
          if (!sTrim) continue;
          if (sTrim === prevSent) {
            duplicatesCount++;
            continue;
          }
          uniqueSentences.push(sent);
          prevSent = sTrim;
        }

        const assembledLine = uniqueSentences.join('');
        filteredLines.push(assembledLine);
        prevLineTrimmed = trimmed;
      }

      return filteredLines.join('\n');
    });

    let result = processedParts.join('');

    // 3. ループ定型句の抑制（例: 「〜だよ！〜だよ！」などの連続）
    const loopRegex = /([^\s]{2,15}[よだね！✨]+)\1+/g;
    result = result.replace(loopRegex, (full, single) => {
      duplicatesCount++;
      return single;
    });

    return {
      cleanedText: result.trim(),
      duplicatesRemovedCount: duplicatesCount,
    };
  }

  /**
   * 6.3 自然な日本語化ポストプロセッサ (Natural Japanese Post-Processor)
   * 残留したロボット調・機械翻訳調・防御的な過剰謝罪を親密な日本語へ変換
   */
  public naturalizeJapaneseResponse(text: string): {
    cleanedText: string;
    unnaturalPhrasesFixed: number;
  } {
    if (!text) return { cleanedText: '', unnaturalPhrasesFixed: 0 };

    let fixCount = 0;

    // 置換辞書
    const replacementRules: Array<{ pattern: RegExp; replacement: string }> = [
      // ロボット的挨拶・前置きの削除
      { pattern: /^(ご質問ありがとうございます[。！!]*\s*)/g, replacement: '' },
      { pattern: /^(お問い合わせありがとうございます[。！!]*\s*)/g, replacement: '' },
      { pattern: /^(ご質問にお答え(いた)?します[。！!]*\s*)/g, replacement: '' },
      { pattern: /^(以下に回答を提示いたします[。！!]*\s*)/g, replacement: '' },
      // 防御的・過剰な謝罪の自然化
      {
        pattern: /大変申し訳ございません[。！!]*私の認識が誤っておりました[。！!]*/g,
        replacement: 'あ、ごめんね！勘違いしちゃってたよ！',
      },
      {
        pattern: /申し訳ございません[。！!]*ご指摘ありがとうございます[。！!]*/g,
        replacement: '教えてくれてありがとう！',
      },
      { pattern: /申し訳ございません[。！!]*/g, replacement: 'ごめんね！' },
      // 形式的なビジネス定型句
      { pattern: /〜させていただきます/g, replacement: '〜するね！' },
      { pattern: /させていただきます/g, replacement: 'するね！' },
      { pattern: /いかがでしょうか[？?]/g, replacement: 'どうかな？' },
      { pattern: /ご提示いたします/g, replacement: 'まとめたよ！' },
      { pattern: /ご承知おきください/g, replacement: '気をつけてね！' },
      { pattern: /承知いたしました[。！!]*|了解いたしました[。！!]*/g, replacement: 'りょうかい！✨' },
      { pattern: /ご安心ください[。！!]*/g, replacement: '大丈夫だよ〜！' },
      {
        pattern: /何か他にご質問やご要望はありますか[？?]/g,
        replacement: '他に気になることややってみたいことがあったら何でも言ってね！',
      },
    ];

    let result = text;
    for (const rule of replacementRules) {
      if (rule.pattern.test(result)) {
        rule.pattern.lastIndex = 0;
        result = result.replace(rule.pattern, () => {
          fixCount++;
          return rule.replacement;
        });
      }
    }

    return {
      cleanedText: result.trim(),
      unnaturalPhrasesFixed: fixCount,
    };
  }

  /**
   * 生成回答のフルポストプロセス処理 (重複排除 + 自然化)
   */
  public processOutput(
    rawText: string,
    expectedLength: ResponseLength
  ): {
    cleanedText: string;
    quality: ResponseQualityEvaluation;
  } {
    // 1. 重複削除
    const dedup = this.deduplicateResponse(rawText);

    // 2. 自然な日本語化
    const nat = this.naturalizeJapaneseResponse(dedup.cleanedText);

    const finalText = nat.cleanedText;

    // 3. 品質評価 (5章完成条件・6章三段階分離)
    const quality = this.evaluateResponseQuality({
      assistantResponse: finalText,
      expectedLength,
      duplicatesRemovedCount: dedup.duplicatesRemovedCount,
      unnaturalPhrasesFixed: nat.unnaturalPhrasesFixed,
    });

    return {
      cleanedText: finalText,
      quality,
    };
  }

  /**
   * 回答品質の診断・採点
   */
  public evaluateResponseQuality(params: {
    assistantResponse: string;
    expectedLength: ResponseLength;
    duplicatesRemovedCount?: number;
    unnaturalPhrasesFixed?: number;
  }): ResponseQualityEvaluation {
    const {
      assistantResponse,
      expectedLength,
      duplicatesRemovedCount = 0,
      unnaturalPhrasesFixed = 0,
    } = params;
    const text = (assistantResponse || '').trim();
    const len = text.length;
    const feedback: string[] = [];

    // 1. 冒頭での直接回答判定 (結論ファースト)
    // 悪い例: 「ご質問ありがとうございます」「〜について考えます」「以下に〜」で始まる
    const firstLine = text.split('\n')[0].trim();
    const hasRoboticStart = /^(ご質問|お問い合わせ|以下に|承知いたしました|回答いたします)/.test(
      firstLine
    );
    const directAnswerFirst = !hasRoboticStart && firstLine.length > 0;
    if (!directAnswerFirst) {
      feedback.push('冒頭の直接回答が弱く、前置きが存在します');
    }

    // 2. 回答長適合判定
    let lengthCompliant = true;
    if (expectedLength === 'short' && len > 250) {
      lengthCompliant = false;
      feedback.push(`短文要求(short)に対して回答が長すぎます (${len}文字)`);
    } else if (expectedLength === 'detailed' && len < 150) {
      lengthCompliant = false;
      feedback.push(`詳細要求(detailed)に対して回答が短すぎます (${len}文字)`);
    }

    // 3. 確認質問だけで止まっていないか (自律進行原則)
    const endsWithQuestion = /[？?]\s*$/.test(text);
    const isOnlyClarification = text.length < 80 && endsWithQuestion && /どうする|どれに|いつ|何が/.test(text);
    if (isOnlyClarification) {
      feedback.push('結論を示さず確認質問のみで回答を止めています');
    }

    const passed = directAnswerFirst && lengthCompliant && !isOnlyClarification;

    return {
      directAnswerFirst,
      lengthCategory: expectedLength,
      actualLengthChars: len,
      lengthCompliant,
      duplicatesRemovedCount,
      unnaturalPhrasesFixed,
      passed,
      feedback,
    };
  }
}

export const responseDesignService = new ResponseDesignService();
