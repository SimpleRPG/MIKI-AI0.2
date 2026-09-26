import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targetDirs = ['src', 'scripts'];
const targetRootFiles = ['server.ts'];

const EXTENSIONS_TO_CHECK = ['.ts', '.tsx', '.js', '.mjs'];
const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.d.ts', '.js', '.mjs', '.json', '.css'];

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
        getAllFiles(fullPath, fileList);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (EXTENSIONS_TO_CHECK.includes(ext)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

function resolveImportPath(dir, importPath) {
  // テンプレート変数を含む動的パスは静的検査対象外
  if (importPath.includes('${')) {
    return true;
  }

  const absoluteTarget = path.resolve(dir, importPath);

  // 1. 直接一致
  if (fs.existsSync(absoluteTarget) && fs.statSync(absoluteTarget).isFile()) {
    return true;
  }

  // 2. 拡張子補完
  for (const ext of RESOLVE_EXTENSIONS) {
    const withExt = absoluteTarget + ext;
    if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
      return true;
    }
  }

  // 3. ディレクトリ内の index ファイル補完
  for (const ext of RESOLVE_EXTENSIONS) {
    const indexFile = path.join(absoluteTarget, `index${ext}`);
    if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
      return true;
    }
  }

  // 4. .js 拡張子が .ts / .tsx を指すケース (TypeScript ESM)
  if (importPath.endsWith('.js')) {
    const baseWithoutJs = absoluteTarget.slice(0, -3);
    for (const ext of ['.ts', '.tsx', '.d.ts']) {
      const candidate = baseWithoutJs + ext;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return true;
      }
    }
  }

  return false;
}

function checkFileImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const errors = [];
  let importCount = 0;

  // 静的 import / export
  // 1. import ... from './...' or export ... from './...'
  // 2. import './...'
  // 3. await import('./...') / import('./...')
  const staticImportExportRegex = /^\s*(?:import(?:\s+type)?(?:\s+[\s\S]*?)?\s+from\s+['"](\.[^'"]+)['"]|export(?:\s+type)?(?:\s+[\s\S]*?)?\s+from\s+['"](\.[^'"]+)['"]|import\s+['"](\.[^'"]+)['"])/;
  const dynamicImportRegex = /\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;

  let inBlockComment = false;
  let inTemplateLiteral = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // ブロックコメントの追跡
    if (inBlockComment) {
      if (line.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }
    if (trimmed.startsWith('/*') && !trimmed.includes('*/')) {
      inBlockComment = true;
      continue;
    }

    // 1行コメント
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
      continue;
    }

    // 静的インポート/エクスポート判定
    const staticMatch = line.match(staticImportExportRegex);
    if (staticMatch) {
      const relPath = staticMatch[1] || staticMatch[2] || staticMatch[3];
      if (relPath && !relPath.includes('${')) {
        importCount++;
        const resolved = resolveImportPath(path.dirname(filePath), relPath);
        if (!resolved) {
          errors.push({
            lineNum: i + 1,
            importPath: relPath,
            lineText: line.trim(),
          });
        }
      }
    }

    // 動的インポート判定 (import('./...'))
    let dynMatch;
    dynamicImportRegex.lastIndex = 0;
    while ((dynMatch = dynamicImportRegex.exec(line)) !== null) {
      const relPath = dynMatch[1];
      if (relPath && !relPath.includes('${')) {
        importCount++;
        const resolved = resolveImportPath(path.dirname(filePath), relPath);
        if (!resolved) {
          errors.push({
            lineNum: i + 1,
            importPath: relPath,
            lineText: line.trim(),
          });
        }
      }
    }
  }

  return { errors, importCount };
}

function main() {
  console.log('🔍 [check:imports] 全相対importの解決機械検査を開始します...\n');

  let filesToCheck = [];
  for (const dir of targetDirs) {
    getAllFiles(path.join(root, dir), filesToCheck);
  }
  for (const file of targetRootFiles) {
    const full = path.join(root, file);
    if (fs.existsSync(full)) {
      filesToCheck.push(full);
    }
  }

  let totalImports = 0;
  let totalErrors = 0;
  const failedFiles = [];

  for (const file of filesToCheck) {
    const relFilePath = path.relative(root, file);
    const { errors, importCount } = checkFileImports(file);
    totalImports += importCount;

    if (errors.length > 0) {
      totalErrors += errors.length;
      failedFiles.push({ file: relFilePath, errors });
    }
  }

  if (totalErrors > 0) {
    console.error(`❌ 未解決の相対importが ${totalErrors} 件検出されました:\n`);
    for (const { file, errors } of failedFiles) {
      console.error(`  📁 ${file}:`);
      for (const err of errors) {
        console.error(`    行 ${err.lineNum}: "${err.importPath}" が見つかりません`);
        console.error(`      -> ${err.lineText}`);
      }
    }
    console.error(`\n総検査ファイル数: ${filesToCheck.length}, 総相対import数: ${totalImports}, 未解決エラー数: ${totalErrors}`);
    process.exit(1);
  }

  console.log(`✅ PASS: 全ての相対importが正常に解決されました！`);
  console.log(`総検査ファイル数: ${filesToCheck.length}, 総相対import数: ${totalImports}, 未解決エラー数: 0\n`);
  process.exit(0);
}

main();
