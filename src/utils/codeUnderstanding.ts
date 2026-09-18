/**
 * スマート・コードコンテキスト抽出エンジン (Smart Code Context Engine)
 * 
 * 巨大なソースコード（数万〜15万文字超）であっても、
 * Qwen/Llamaなどのモデルカタログで定義されたコンテキスト長枠内で、
 * AIパートナー「みき」がファイル構造を正確に把握し、ピンポイントでコード改善できるように
 * 目次アウトライン、関連ロジック、骨格を自動抽出・構造化します。
 */

export interface SmartCodeExtractionResult {
  codeSlice: string;
  isSmartExtracted: boolean;
  outlineText: string;
  matchedFunctions: string[];
}

export function extractSmartCodeForImprovement(
  content: string,
  userInstruction: string,
  charLimit: number,
  language: string = 'html'
): SmartCodeExtractionResult {
  if (!content) {
    return {
      codeSlice: '',
      isSmartExtracted: false,
      outlineText: '',
      matchedFunctions: [],
    };
  }

  // 1. 全体文字数が上限内に収まる場合は、そのままノーカットで返却
  if (content.length <= charLimit) {
    // 主要関数のアウトラインのみ検出
    const functionMatches = Array.from(
      content.matchAll(/(?:function\s+([a-zA-Z0-9_]+)|(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/g)
    )
      .map((m) => m[1] || m[2])
      .filter(Boolean)
      .slice(0, 25);

    const outlineText = functionMatches.length > 0
      ? `【主要関数・ハンドラ一覧】: ${functionMatches.join(', ')}`
      : '';

    return {
      codeSlice: content,
      isSmartExtracted: false,
      outlineText,
      matchedFunctions: functionMatches,
    };
  }

  // 2. 超巨大ファイルの場合: スマート構造化抽出
  const lines = content.split('\n');
  const totalLines = lines.length;

  // A. 行マップ・アウトライン（関数、クラス、型、主要定義の検出）
  interface CodeSymbol {
    lineNum: number;
    name: string;
    signature: string;
    type: 'function' | 'class' | 'type' | 'hook';
  }
  const symbols: CodeSymbol[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 関数・ハンドラ
    const fnMatch = trimmed.match(/(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/);
    if (fnMatch) {
      symbols.push({
        lineNum: i + 1,
        name: fnMatch[1],
        signature: `L${i + 1}: function ${fnMatch[1]}(${fnMatch[2].slice(0, 40)})`,
        type: 'function',
      });
      continue;
    }

    const arrowMatch = trimmed.match(/(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/);
    if (arrowMatch) {
      symbols.push({
        lineNum: i + 1,
        name: arrowMatch[1],
        signature: `L${i + 1}: const ${arrowMatch[1]} = (${arrowMatch[2].slice(0, 40)}) =>`,
        type: 'function',
      });
      continue;
    }

    // クラス・インターフェース・型
    const classMatch = trimmed.match(/(?:export\s+)?class\s+([a-zA-Z0-9_]+)/);
    if (classMatch) {
      symbols.push({
        lineNum: i + 1,
        name: classMatch[1],
        signature: `L${i + 1}: class ${classMatch[1]}`,
        type: 'class',
      });
      continue;
    }

    const typeMatch = trimmed.match(/(?:export\s+)?(?:interface|type)\s+([a-zA-Z0-9_]+)/);
    if (typeMatch) {
      symbols.push({
        lineNum: i + 1,
        name: typeMatch[1],
        signature: `L${i + 1}: type/interface ${typeMatch[1]}`,
        type: 'type',
      });
    }
  }

  // B. ユーザー指示から関連キーワード・シンボルの照合
  const instructionWords = userInstruction
    .toLowerCase()
    .split(/[\s,、。！？!?:;()\[\]{}'"]+/)
    .filter((w) => w.length >= 2);

  const matchedSymbols = symbols.filter((s) =>
    instructionWords.some((w) => s.name.toLowerCase().includes(w) || w.includes(s.name.toLowerCase()))
  );

  // C. 予算枠に応じたスマート抽出の組み立て
  // 枠の配分:
  // - アウトラインマップ: 約1,500文字
  // - ファイル先頭（Import, 型定義, State）: 約3,000文字
  // - ユーザー要望に合致する注目関数・ブロック: 約8,000〜15,000文字
  // - HTMLなら<script>タグ内ロジック、TSXならメインコンポーネント周辺: 残り予算

  const outlineList = symbols.slice(0, 40).map((s) => s.signature).join('\n');
  const outlineHeader = `【ファイル全体マップ (全${totalLines}行・計${content.length}文字)】\n${outlineList}${symbols.length > 40 ? '\n...他多数' : ''}`;

  // 先頭骨格（Imports / Types / 初期変数）
  const headerSliceLines = lines.slice(0, Math.min(80, totalLines));
  const headerCode = `// --- [1. ファイル先頭骨格 (L1〜L${headerSliceLines.length})] ---\n${headerSliceLines.join('\n')}`;

  // 関連シンボルの前後コード抽出
  const relevantSections: string[] = [];
  const extractedLineRanges: [number, number][] = [];

  for (const sym of matchedSymbols.slice(0, 5)) {
    const startLine = Math.max(0, sym.lineNum - 5);
    const endLine = Math.min(totalLines - 1, sym.lineNum + 45);

    // 重複チェック
    const isOverlapping = extractedLineRanges.some(
      ([s, e]) => (startLine >= s && startLine <= e) || (endLine >= s && endLine <= e)
    );
    if (!isOverlapping) {
      extractedLineRanges.push([startLine, endLine]);
      const sectionLines = lines.slice(startLine, endLine + 1);
      relevantSections.push(
        `// --- [要望関連コード: ${sym.name} (L${startLine + 1}〜L${endLine + 1})] ---\n${sectionLines.join('\n')}`
      );
    }
  }

  // HTMLの<script>タグ抽出（HTML/JSゲームの場合）
  let scriptSection = '';
  if (language === 'html' || content.includes('<script')) {
    const scriptMatch = content.match(/<script[\s\S]*?<\/script>/i);
    if (scriptMatch) {
      const scriptContent = scriptMatch[0];
      const maxScriptLen = Math.max(3000, charLimit - 6000);
      const scriptSlice = scriptContent.length > maxScriptLen
        ? scriptContent.slice(0, maxScriptLen) + '\n// ... (scriptタグ後半省略)'
        : scriptContent;
      scriptSection = `\n// --- [主要スクリプトロジック (<script>)] ---\n${scriptSlice}`;
    }
  }

  // 組み立て
  const parts: string[] = [
    `/* 📌 巨大ファイル (${totalLines}行 / ${content.length}文字) のスマート要約コードコンテキスト */`,
    headerCode,
  ];

  if (relevantSections.length > 0) {
    parts.push(...relevantSections);
  }

  if (scriptSection) {
    parts.push(scriptSection);
  } else if (relevantSections.length === 0) {
    // 関連シンボルが見つからなかった場合は、先頭以降の主要ロジックを予算いっぱいまで追加
    const remainingBudget = charLimit - headerCode.length - outlineHeader.length - 500;
    if (remainingBudget > 1000) {
      const middleSlice = lines.slice(80, 200).join('\n');
      parts.push(`// --- [主要ロジック部 (L81〜L200)] ---\n${middleSlice.slice(0, remainingBudget)}\n// ... (以降省略)`);
    }
  }

  const finalCodeSlice = parts.join('\n\n');

  return {
    codeSlice: finalCodeSlice,
    isSmartExtracted: true,
    outlineText: outlineHeader,
    matchedFunctions: matchedSymbols.map((s) => s.name),
  };
}
