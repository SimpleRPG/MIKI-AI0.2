/**
 * スマート・コードマージ ＆ 差分解析サービス (Smart Code Merge & Diff Service)
 * 
 * みきが「ファイル全体」ではなく「修正した特定の関数やブロック」を出力した場合でも、
 * 既存ファイル内の該当関数を自動検出して安全に部分置換（Patch / Merge）します。
 * また、適用前の差分（追加行・削除行・変更行）を計算して安全な適用を可能にします。
 */

export interface CodeDiffSummary {
  addedLines: number;
  removedLines: number;
  isPartialFunctionMerge: boolean;
  targetFunctionName?: string;
  mergedContent: string;
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/**
 * コードブロックが「ファイル全体のコード」か「特定の関数・ブロック」かを判定し、
 * 必要に応じて安全に既存コードへマージ（部分置換）します。
 */
export function smartMergeCodeBlock(
  originalContent: string,
  incomingCode: string,
  filePath: string = ''
): CodeDiffSummary {
  const trimmedIncoming = incomingCode.trim();
  const trimmedOriginal = originalContent.trim();

  // 1. 既存ファイルが空、または新コードがファイル全体の骨格（HTML骨格や多数のimport文）を含む場合は全体置換
  const isHtmlEntry = filePath.endsWith('.html') || filePath === 'index.html';
  const hasHtmlSkeleton = trimmedIncoming.includes('<!DOCTYPE') || (trimmedIncoming.includes('<html') && trimmedIncoming.includes('</html>'));
  const hasFullEntryImports = (trimmedIncoming.match(/import\s+/g) || []).length >= 5;

  if (!trimmedOriginal || (isHtmlEntry && hasHtmlSkeleton) || hasFullEntryImports) {
    const diff = computeLineDiffs(originalContent, incomingCode);
    return {
      addedLines: diff.filter((d) => d.type === 'added').length,
      removedLines: diff.filter((d) => d.type === 'removed').length,
      isPartialFunctionMerge: false,
      mergedContent: incomingCode,
    };
  }

  // 2. 関数の部分置換を試みる
  // 例: function updateGame(...) { ... } または const updateGame = (...) => { ... }
  const fnMatch = trimmedIncoming.match(/^(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/m) ||
    trimmedIncoming.match(/^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/m);

  if (fnMatch) {
    const fnName = fnMatch[1];
    
    // 既存コード内に対象関数が存在するか確認
    // パターン1: function fnName(...)
    const origFnRegex = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${fnName}\\s*\\([\\s\\S]*?^\\}`, 'm');
    // パターン2: const fnName = (...) => { ... }
    const origArrowRegex = new RegExp(`(?:export\\s+)?(?:const|let|var)\\s+${fnName}\\s*=\\s*(?:async\\s*)?\\([\\s\\S]*?^\\};?`, 'm');

    let replaced = false;
    let newFullContent = originalContent;

    if (origFnRegex.test(originalContent)) {
      newFullContent = originalContent.replace(origFnRegex, trimmedIncoming);
      replaced = true;
    } else if (origArrowRegex.test(originalContent)) {
      newFullContent = originalContent.replace(origArrowRegex, trimmedIncoming);
      replaced = true;
    }

    if (replaced && newFullContent !== originalContent) {
      const diff = computeLineDiffs(originalContent, newFullContent);
      return {
        addedLines: diff.filter((d) => d.type === 'added').length,
        removedLines: diff.filter((d) => d.type === 'removed').length,
        isPartialFunctionMerge: true,
        targetFunctionName: fnName,
        mergedContent: newFullContent,
      };
    }
  }

  // 3. HTML内の <script> タグの置換を試みる
  if (isHtmlEntry && trimmedIncoming.startsWith('<script') && trimmedIncoming.endsWith('</script>')) {
    const origScriptRegex = /<script[\s\S]*?<\/script>/i;
    if (origScriptRegex.test(originalContent)) {
      const newFullContent = originalContent.replace(origScriptRegex, trimmedIncoming);
      const diff = computeLineDiffs(originalContent, newFullContent);
      return {
        addedLines: diff.filter((d) => d.type === 'added').length,
        removedLines: diff.filter((d) => d.type === 'removed').length,
        isPartialFunctionMerge: true,
        targetFunctionName: '<script> タグ全体',
        mergedContent: newFullContent,
      };
    }
  }

  // 4. マージ対象が特定できない場合は通常の全体置換
  const diff = computeLineDiffs(originalContent, incomingCode);
  return {
    addedLines: diff.filter((d) => d.type === 'added').length,
    removedLines: diff.filter((d) => d.type === 'removed').length,
    isPartialFunctionMerge: false,
    mergedContent: incomingCode,
  };
}

/**
 * 2つのテキスト間の簡易行差分を算出
 */
export function computeLineDiffs(oldText: string, newText: string, maxLines: number = 200): DiffLine[] {
  const oldLines = oldText ? oldText.split('\n') : [];
  const newLines = newText ? newText.split('\n') : [];
  const diffLines: DiffLine[] = [];

  let oldIdx = 0;
  let newIdx = 0;

  while ((oldIdx < oldLines.length || newIdx < newLines.length) && diffLines.length < maxLines) {
    if (oldIdx < oldLines.length && newIdx < newLines.length) {
      if (oldLines[oldIdx] === newLines[newIdx]) {
        diffLines.push({
          type: 'unchanged',
          content: oldLines[oldIdx],
          oldLineNumber: oldIdx + 1,
          newLineNumber: newIdx + 1,
        });
        oldIdx++;
        newIdx++;
      } else {
        // 簡易先読みチェック (追加か削除か判定)
        const nextMatchInNew = newLines.indexOf(oldLines[oldIdx], newIdx);
        const nextMatchInOld = oldLines.indexOf(newLines[newIdx], oldIdx);

        if (nextMatchInNew !== -1 && (nextMatchInOld === -1 || nextMatchInNew - newIdx < nextMatchInOld - oldIdx)) {
          // newLines に追加された行
          diffLines.push({
            type: 'added',
            content: newLines[newIdx],
            newLineNumber: newIdx + 1,
          });
          newIdx++;
        } else if (nextMatchInOld !== -1) {
          // oldLines から削除された行
          diffLines.push({
            type: 'removed',
            content: oldLines[oldIdx],
            oldLineNumber: oldIdx + 1,
          });
          oldIdx++;
        } else {
          // 変更
          diffLines.push({
            type: 'removed',
            content: oldLines[oldIdx],
            oldLineNumber: oldIdx + 1,
          });
          diffLines.push({
            type: 'added',
            content: newLines[newIdx],
            newLineNumber: newIdx + 1,
          });
          oldIdx++;
          newIdx++;
        }
      }
    } else if (newIdx < newLines.length) {
      diffLines.push({
        type: 'added',
        content: newLines[newIdx],
        newLineNumber: newIdx + 1,
      });
      newIdx++;
    } else {
      diffLines.push({
        type: 'removed',
        content: oldLines[oldIdx],
        oldLineNumber: oldIdx + 1,
      });
      oldIdx++;
    }
  }

  return diffLines;
}
