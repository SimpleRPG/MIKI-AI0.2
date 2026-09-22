import JSZip from 'jszip';
import { WorkspaceFile } from '../types';

export interface CodeBlock {
  path: string;
  name: string;
  content: string;
  language: string;
}

export interface ZipExtractionResult {
  success: boolean;
  error?: string;
  rootPrefix?: string;
  projectName: string;
  totalExtracted: number;
  folders: string[];
  files: WorkspaceFile[];
}

export function extractCodeBlocks(markdown: string): CodeBlock[] {
  if (!markdown) return [];
  const blocks: CodeBlock[] = [];

  const codeBlockRegex = /```([a-zA-Z0-9_\-.:]+)?(?:\s+([^\n]+))?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let blockIndex = 1;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const rawLang = (match[1] || '').trim();
    const meta = (match[2] || '').trim();
    const content = match[3];

    let filename = '';
    let language = rawLang.toLowerCase() || 'plaintext';

    // Try extracting from meta e.g. filename="App.tsx" or filepath="src/App.tsx"
    const fileAttrMatch = meta.match(/(?:file(?:name|path)?|path)=["']?([^"'\s]+)["']?/i);
    if (fileAttrMatch) {
      filename = fileAttrMatch[1];
    } else if (meta && !meta.includes('=')) {
      filename = meta;
    }

    // Try extracting from language header e.g. ```tsx:src/App.tsx
    if (!filename && rawLang.includes(':')) {
      const parts = rawLang.split(':');
      language = parts[0].toLowerCase();
      filename = parts.slice(1).join(':');
    }

    // Try extracting from first line comments e.g. // src/App.tsx or <!-- index.html -->
    if (!filename) {
      const firstLine = content.split('\n')[0].trim();
      const commentMatch = firstLine.match(/^(?:\/\/|#|\/\*|<!--)\s*([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)/);
      if (commentMatch) {
        filename = commentMatch[1];
      }
    }

    // Default filenames based on language
    if (!filename) {
      if (language === 'html' || language === 'htm') filename = 'index.html';
      else if (language === 'css') filename = 'style.css';
      else if (language === 'javascript' || language === 'js') filename = `script${blockIndex}.js`;
      else if (language === 'typescript' || language === 'ts') filename = `index${blockIndex}.ts`;
      else if (language === 'tsx') filename = `Component${blockIndex}.tsx`;
      else if (language === 'jsx') filename = `Component${blockIndex}.jsx`;
      else if (language === 'json') filename = `data${blockIndex}.json`;
      else if (language === 'python' || language === 'py') filename = `main${blockIndex}.py`;
      else if (language === 'vba') filename = `Module${blockIndex}.bas`;
      else filename = `code${blockIndex}.txt`;
    }

    const name = filename.split('/').pop()?.split('\\').pop() || filename;
    blocks.push({
      path: filename,
      name,
      content,
      language: normalizeLanguage(language, filename),
    });
    blockIndex++;
  }

  return blocks;
}

function normalizeLanguage(lang: string, filename: string): string {
  if (lang) {
    if (['js', 'javascript', 'mjs', 'cjs'].includes(lang)) return 'javascript';
    if (['ts', 'typescript'].includes(lang)) return 'typescript';
    if (['tsx'].includes(lang)) return 'typescript';
    if (['jsx'].includes(lang)) return 'javascript';
    if (['html', 'htm'].includes(lang)) return 'html';
    if (['css', 'scss', 'sass', 'less'].includes(lang)) return 'css';
    if (['json'].includes(lang)) return 'json';
    if (['py', 'python'].includes(lang)) return 'python';
    if (['vba', 'bas'].includes(lang)) return 'vba';
    return lang;
  }
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['ts', 'tsx'].includes(ext)) return 'typescript';
  if (['js', 'jsx', 'mjs'].includes(ext)) return 'javascript';
  if (['html', 'htm'].includes(ext)) return 'html';
  if (['css'].includes(ext)) return 'css';
  if (['json'].includes(ext)) return 'json';
  if (['py'].includes(ext)) return 'python';
  return 'plaintext';
}

export async function extractFilesFromZip(file: File | Blob): Promise<ZipExtractionResult> {
  try {
    const zip = await JSZip.loadAsync(file);
    const files: WorkspaceFile[] = [];
    const folderSet = new Set<string>();

    let projectName = (file as File).name?.replace(/\.zip$/i, '') || 'imported_project';

    const entries = Object.keys(zip.files);
    for (const relativePath of entries) {
      const entry = zip.files[relativePath];
      if (entry.dir) {
        folderSet.add(relativePath.replace(/\/$/, ''));
        continue;
      }

      // Skip macOS metadata / hidden files
      if (relativePath.includes('__MACOSX') || relativePath.startsWith('.') || relativePath.includes('/.')) {
        continue;
      }

      const parts = relativePath.split('/');
      if (parts.length > 1) {
        folderSet.add(parts.slice(0, -1).join('/'));
      }

      const content = await entry.async('text');
      const filename = parts[parts.length - 1];
      const ext = filename.split('.').pop()?.toLowerCase() || '';

      files.push({
        path: relativePath,
        name: filename,
        content,
        language: normalizeLanguage(ext, filename),
      });
    }

    return {
      success: true,
      projectName,
      totalExtracted: files.length,
      folders: Array.from(folderSet),
      files,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to extract ZIP file',
      projectName: '',
      totalExtracted: 0,
      folders: [],
      files: [],
    };
  }
}

/**
 * プレビュー用サンドボックスHTMLを構築
 */
export function buildSandboxHtml(files: WorkspaceFile[]): string {
  if (!files || files.length === 0) {
    return '<!DOCTYPE html><html><body><div style="color:#64748b;padding:24px;text-align:center;">プレビュー対象のファイルがありません</div></body></html>';
  }

  const htmlFile = files.find((f) => f.name.toLowerCase() === 'index.html') || files.find((f) => f.name.endsWith('.html'));
  const cssFiles = files.filter((f) => f.name.endsWith('.css'));
  const jsFiles = files.filter(
    (f) =>
      (f.name.endsWith('.js') || f.name.endsWith('.jsx') || f.name.endsWith('.ts') || f.name.endsWith('.tsx')) &&
      !f.name.endsWith('.d.ts')
  );

  let baseHtml = htmlFile?.content || `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
    <style>body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }</style>
  </head>
  <body>
    <div id="root"></div>
    <div id="app"></div>
  </body>
</html>`;

  // コンソールエラー捕捉スクリプトを先頭に注入
  const consoleInterceptionScript = `<script>
(function() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  window.addEventListener('error', function(e) {
    window.parent.postMessage({ type: 'PREVIEW_CONSOLE_LOG', level: 'error', message: e.message || 'Script error' }, '*');
  });
  console.error = function() {
    const args = Array.from(arguments).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a));
    window.parent.postMessage({ type: 'PREVIEW_CONSOLE_LOG', level: 'error', message: args.join(' ') }, '*');
    originalError.apply(console, arguments);
  };
})();
</script>`;

  if (baseHtml.includes('<head>')) {
    baseHtml = baseHtml.replace('<head>', '<head>\n' + consoleInterceptionScript);
  }

  // CSS の注入
  for (const css of cssFiles) {
    if (!baseHtml.includes(css.content)) {
      if (baseHtml.includes('</head>')) {
        baseHtml = baseHtml.replace('</head>', `<style data-filename="${css.name}">\n${css.content}\n</style>\n</head>`);
      } else {
        baseHtml += `<style data-filename="${css.name}">\n${css.content}\n</style>`;
      }
    }
  }

  // JS の注入
  for (const js of jsFiles) {
    if (!baseHtml.includes(js.content)) {
      const scriptTag = `<script type="module" data-filename="${js.name}">\n${js.content}\n</script>`;
      if (baseHtml.includes('</body>')) {
        baseHtml = baseHtml.replace('</body>', `${scriptTag}\n</body>`);
      } else {
        baseHtml += scriptTag;
      }
    }
  }

  return baseHtml;
}

/**
 * スタンドアロン用単一HTMLの構築
 */
export function buildCleanStandaloneHtml(files: WorkspaceFile[]): string {
  return buildSandboxHtml(files);
}

/**
 * 単一HTMLファイルのダウンロードトリガー
 */
export function downloadSingleHtml(name: string, htmlContent: string): void {
  const cleanName = (name || 'miki-app').replace(/[^a-zA-Z0-9_\-\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g, '_');
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanName}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * プロジェクトZIPファイルの生成とダウンロード
 */
export async function downloadProjectZip(name: string, files: WorkspaceFile[]): Promise<void> {
  const cleanName = (name || 'miki-app').replace(/[^a-zA-Z0-9_\-\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g, '_');
  const zip = new JSZip();

  for (const file of files) {
    const filePath = file.path || file.name;
    zip.file(filePath, file.content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * モバイル共有またはZIP保存
 */
export async function shareOrSaveZipOnMobile(name: string, files: WorkspaceFile[]): Promise<boolean> {
  const cleanName = (name || 'miki-app').replace(/[^a-zA-Z0-9_\-\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g, '_');
  const zip = new JSZip();

  for (const file of files) {
    const filePath = file.path || file.name;
    zip.file(filePath, file.content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });

  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      const file = new File([blob], `${cleanName}.zip`, { type: 'application/zip' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: cleanName,
          text: `${cleanName} のソースコード一式`,
        });
        return true;
      }
    } catch {
      // Fallback to normal download
    }
  }

  await downloadProjectZip(name, files);
  return false;
}

/**
 * サーバー側ZIPのダウンロード (モバイル用)
 */
export async function downloadFullServerZipMobile(name: string, files: WorkspaceFile[]): Promise<void> {
  await downloadProjectZip(name, files);
}

/**
 * 完全作業指示書テキスト形式で全ファイルをダウンロード
 */
export function downloadCompleteInstructionText(name: string, files: WorkspaceFile[]): void {
  const cleanName = (name || 'miki-project').replace(/[^a-zA-Z0-9_\-\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g, '_');
  let output = `# ${name || 'MIKI-AI Project'} 作業指示書 & 全ソースコード\n`;
  output += `出力日時: ${new Date().toISOString()}\n`;
  output += `ファイル総数: ${files.length}\n\n`;

  for (const file of files) {
    output += `================================================\n`;
    output += `FILE: ${file.path || file.name}\n`;
    output += `================================================\n`;
    output += `${file.content}\n\n`;
  }

  const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanName}_instructions.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
