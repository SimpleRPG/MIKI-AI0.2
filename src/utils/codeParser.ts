import { WorkspaceFile } from '../types';
import JSZip from 'jszip';

export interface ExtractedCodeBlock {
  path: string;
  name: string;
  content: string;
  language: string;
}

export function extractCodeBlocks(markdown: string): ExtractedCodeBlock[] {
  const codeBlockRegex = /```(?:([a-zA-Z0-9_\-./]+))?\n([\s\S]*?)```/g;
  const files: ExtractedCodeBlock[] = [];
  let match;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    const rawLangOrPath = (match[1] || '').trim();
    const content = match[2] || '';

    let path = 'index.html';
    let name = 'index.html';
    let language = 'html';

    if (rawLangOrPath.includes('.')) {
      name = rawLangOrPath.split('/').pop() || rawLangOrPath;
      path = rawLangOrPath;
    } else if (rawLangOrPath === 'html' || rawLangOrPath === 'htm') {
      name = 'index.html';
      path = 'index.html';
      language = 'html';
    } else if (rawLangOrPath === 'javascript' || rawLangOrPath === 'js') {
      name = 'game.js';
      path = 'game.js';
      language = 'javascript';
    } else if (rawLangOrPath === 'css') {
      name = 'style.css';
      path = 'style.css';
      language = 'css';
    } else if (rawLangOrPath === 'wgsl' || rawLangOrPath === 'glsl') {
      name = 'shader.wgsl';
      path = 'shader.wgsl';
      language = 'wgsl';
    } else if (rawLangOrPath === 'json') {
      name = 'data.json';
      path = 'data.json';
      language = 'json';
    } else {
      if (content.includes('<!DOCTYPE') || content.includes('<html') || content.includes('<canvas') || content.includes('<body>')) {
        name = 'index.html';
        path = 'index.html';
        language = 'html';
      } else {
        name = 'game.js';
        path = 'game.js';
        language = 'javascript';
      }
    }

    files.push({
      path,
      name,
      content: content.trim(),
      language
    });
  }

  return files;
}

export function buildSandboxHtml(files: WorkspaceFile[]): string {
  const htmlFile = files.find((f) => f.path === 'index.html' || f.name.endsWith('.html'));
  const cssFiles = files.filter((f) => f.path.endsWith('.css'));
  const jsFiles = files.filter((f) => (f.path.endsWith('.js') || f.path.endsWith('.ts')) && f.path !== 'index.html');

  let baseHtml = htmlFile
    ? htmlFile.content
    : `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Sandbox</title></head><body><canvas id="gameCanvas"></canvas></body></html>`;

  // 画像・音声アセットの相対パス解決 (例: src="./assets/player.png" -> data:image/png;base64,...)
  const assetFiles = files.filter((f) => f.language === 'image' || f.language === 'audio');
  if (assetFiles.length > 0) {
    for (const asset of assetFiles) {
      const cleanPath = asset.path.replace(/^\/+/, '');
      const patterns = [cleanPath, `./${cleanPath}`, `/${cleanPath}`];
      for (const p of patterns) {
        baseHtml = baseHtml.split(`"${p}"`).join(`"${asset.content}"`);
        baseHtml = baseHtml.split(`'${p}'`).join(`'${asset.content}'`);
      }
    }
  }

  // Inject CSS
  if (cssFiles.length > 0) {
    const combinedCss = cssFiles.map((c) => `<style>\n/* ${c.name} */\n${c.content}\n</style>`).join('\n');
    if (baseHtml.includes('</head>')) {
      baseHtml = baseHtml.replace('</head>', `${combinedCss}\n</head>`);
    } else {
      baseHtml = combinedCss + '\n' + baseHtml;
    }
  }

  // Inject JS
  if (jsFiles.length > 0) {
    const combinedJs = jsFiles.map((j) => `<script>\n// ${j.name}\n${j.content}\n</script>`).join('\n');
    if (baseHtml.includes('</body>')) {
      baseHtml = baseHtml.replace('</body>', `${combinedJs}\n</body>`);
    } else {
      baseHtml = baseHtml + '\n' + combinedJs;
    }
  }

  // Inject Console & FPS Bridge
  const bridgeScript = `
<script>
(function() {
  const _send = (level, msg) => {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          source: 'MIKI_GAME_SANDBOX',
          type: 'GAME_CONSOLE',
          level: level,
          message: typeof msg === 'object' ? JSON.stringify(msg) : String(msg),
          timestamp: Date.now()
        }, '*');
      }
    } catch(e) {}
  };

  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  console.log = function(...args) {
    origLog.apply(console, args);
    _send('log', args.join(' '));
  };
  console.warn = function(...args) {
    origWarn.apply(console, args);
    _send('warn', args.join(' '));
  };
  console.error = function(...args) {
    origError.apply(console, args);
    _send('error', args.join(' '));
  };

  window.addEventListener('error', function(e) {
    _send('error', (e.message || 'Error') + ' at ' + (e.filename || '') + ':' + (e.lineno || 0));
  });

  // FPS Counter
  let frameCount = 0;
  let fpsTimer = 0;

  function countFps(now) {
    frameCount++;
    if (now - fpsTimer >= 1000) {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            source: 'MIKI_GAME_SANDBOX',
            type: 'GAME_FPS',
            fps: frameCount
          }, '*');
        }
      } catch(e) {}
      frameCount = 0;
      fpsTimer = now;
    }
    requestAnimationFrame(countFps);
  }
  requestAnimationFrame(countFps);
})();
</script>
`;

  if (baseHtml.includes('</head>')) {
    baseHtml = baseHtml.replace('</head>', `${bridgeScript}\n</head>`);
  } else {
    baseHtml = bridgeScript + '\n' + baseHtml;
  }

  return baseHtml;
}

export function buildCleanStandaloneHtml(files: WorkspaceFile[]): string {
  const htmlFile = files.find((f) => f.path === 'index.html' || f.name.endsWith('.html'));
  const cssFiles = files.filter((f) => f.path.endsWith('.css'));
  const jsFiles = files.filter((f) => (f.path.endsWith('.js') || f.path.endsWith('.ts')) && f.path !== 'index.html');

  let baseHtml = htmlFile
    ? htmlFile.content
    : `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Game</title></head><body></body></html>`;

  if (cssFiles.length > 0) {
    const combinedCss = cssFiles.map((c) => `<style>\n${c.content}\n</style>`).join('\n');
    if (baseHtml.includes('</head>')) {
      baseHtml = baseHtml.replace('</head>', `${combinedCss}\n</head>`);
    } else {
      baseHtml = combinedCss + '\n' + baseHtml;
    }
  }

  if (jsFiles.length > 0) {
    const combinedJs = jsFiles.map((j) => `<script>\n${j.content}\n</script>`).join('\n');
    if (baseHtml.includes('</body>')) {
      baseHtml = baseHtml.replace('</body>', `${combinedJs}\n</body>`);
    } else {
      baseHtml = baseHtml + '\n' + combinedJs;
    }
  }

  return baseHtml;
}

export async function downloadProjectZip(projectName: string, files: WorkspaceFile[]) {
  const zip = new JSZip();
  files.forEach((f) => {
    zip.file(f.path, f.content);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const filename = `${projectName || 'game_project'}.zip`;

  // Standard Blob Download
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 1000);
  } catch (err) {
    console.warn('Direct blob download fallback:', err);
    window.location.href = '/api/export-app-zip';
  }
}

export async function shareOrSaveZipOnMobile(projectName: string, files: WorkspaceFile[]): Promise<boolean> {
  try {
    const zip = new JSZip();
    files.forEach((f) => {
      zip.file(f.path, f.content);
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const filename = `${projectName || 'miki-project'}.zip`;
    const file = new File([blob], filename, { type: 'application/zip' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'Miki AI Project ZIP',
        text: 'Miki AIで生成したゲーム・コード一式です。',
        files: [file],
      });
      return true;
    }
  } catch (err) {
    console.warn('Native Web Share failed or was cancelled:', err);
  }

  // Fallback to standard download
  await downloadProjectZip(projectName, files);
  return false;
}

export function downloadFullServerZipMobile() {
  const downloadUrl = '/api/export-app-zip';
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = 'miki-project.zip';
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
  }, 1000);
}

export function downloadSingleHtml(projectName: string, htmlContent: string) {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const filename = `${projectName || 'game'}.html`;
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 1000);
  } catch (err) {
    console.warn('Fallback HTML download:', err);
  }
}

export interface ZipExtractionResult {
  success: boolean;
  files: WorkspaceFile[];
  folders: string[];
  totalExtracted: number;
  rootPrefix?: string;
  projectName?: string;
  error?: string;
}

/**
 * アプリのZIPファイルを解凍し、ネストされたフォルダ階層や各種アセットを完全保持して WorkspaceFile[] を復元する
 */
export async function extractFilesFromZip(
  fileOrBlob: File | Blob,
  options?: { stripCommonRoot?: boolean }
): Promise<ZipExtractionResult> {
  try {
    const zip = await JSZip.loadAsync(fileOrBlob);
    const rawEntries: { path: string; isDir: boolean; entry: JSZip.JSZipObject }[] = [];

    // 1. 全エントリの走査と無効ファイル（Macメタデータや隠しファイル）のフィルタリング
    zip.forEach((relativePath, entry) => {
      // Macの不要なメタデータやWindowsのシステムファイルを排除
      if (
        relativePath.startsWith('__MACOSX/') ||
        relativePath.includes('/.DS_Store') ||
        relativePath === '.DS_Store' ||
        relativePath.includes('/Thumbs.db') ||
        relativePath === 'Thumbs.db'
      ) {
        return;
      }

      const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
      if (!normalized) return;

      rawEntries.push({
        path: normalized,
        isDir: entry.dir,
        entry,
      });
    });

    if (rawEntries.length === 0) {
      return {
        success: false,
        files: [],
        folders: [],
        totalExtracted: 0,
        error: 'ZIPアーカイブ内に有効なファイルが見つかりませんでした。',
      };
    }

    // 2. 単一の親ルートフォルダに全ファイルが包まれているかを自動検出 (例: "my-app/index.html", "my-app/src/...")
    let rootPrefix = '';
    const shouldStripRoot = options?.stripCommonRoot !== false;

    if (shouldStripRoot) {
      const topLevelSegments = new Set<string>();
      rawEntries.forEach((e) => {
        const seg = e.path.split('/')[0];
        if (seg) topLevelSegments.add(seg);
      });

      // 単一の共通フォルダで、かつそれがファイルではなくフォルダである場合
      if (topLevelSegments.size === 1) {
        const candidate = Array.from(topLevelSegments)[0];
        const hasDeeperFiles = rawEntries.some((e) => e.path.startsWith(`${candidate}/`) && e.path.length > candidate.length + 1);
        if (hasDeeperFiles) {
          rootPrefix = `${candidate}/`;
        }
      }
    }

    const files: WorkspaceFile[] = [];
    const foldersSet = new Set<string>();

    for (const item of rawEntries) {
      // 共通ルートの除去
      let finalPath = item.path;
      if (rootPrefix && finalPath.startsWith(rootPrefix)) {
        finalPath = finalPath.slice(rootPrefix.length);
      }

      if (!finalPath) continue;

      // フォルダ構造の記録
      if (item.isDir) {
        const cleanFolder = finalPath.replace(/\/+$/, '');
        if (cleanFolder) foldersSet.add(cleanFolder);
        continue;
      }

      // ファイルの親フォルダを自動登録
      const parts = finalPath.split('/');
      if (parts.length > 1) {
        for (let i = 1; i < parts.length; i++) {
          foldersSet.add(parts.slice(0, i).join('/'));
        }
      }

      const fileName = parts[parts.length - 1];
      const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';

      // 言語判定
      let language = 'text';
      if (ext === 'html' || ext === 'htm') language = 'html';
      else if (ext === 'js' || ext === 'mjs' || ext === 'cjs') language = 'javascript';
      else if (ext === 'ts' || ext === 'tsx') language = 'typescript';
      else if (ext === 'jsx') language = 'javascript';
      else if (ext === 'css' || ext === 'scss') language = 'css';
      else if (ext === 'json') language = 'json';
      else if (ext === 'svg') language = 'svg';
      else if (ext === 'wgsl' || ext === 'glsl') language = 'wgsl';
      else if (ext === 'md') language = 'markdown';

      let content = '';

      // 画像・バイナリアセットの処理 (Base64 Data URI)
      const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp'].includes(ext);
      const isAudio = ['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(ext);

      if (isImage) {
        const base64 = await item.entry.async('base64');
        const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'ico' ? 'image/x-icon' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        content = `data:${mime};base64,${base64}`;
        language = 'image';
      } else if (isAudio) {
        const base64 = await item.entry.async('base64');
        content = `data:audio/${ext};base64,${base64}`;
        language = 'audio';
      } else {
        // テキストファイルの読み込み
        try {
          content = await item.entry.async('text');
        } catch (readErr) {
          // テキスト読み込みに失敗した場合はBase64フォールバック
          const b64 = await item.entry.async('base64');
          content = `data:application/octet-stream;base64,${b64}`;
        }
      }

      files.push({
        path: finalPath,
        name: fileName,
        content,
        language,
      });
    }

    // index.html またはメインのエントリポイントを優先順にソート
    files.sort((a, b) => {
      if (a.path === 'index.html') return -1;
      if (b.path === 'index.html') return 1;
      return a.path.localeCompare(b.path);
    });

    const projectName = rootPrefix
      ? rootPrefix.replace(/\/$/, '')
      : fileOrBlob instanceof File
      ? fileOrBlob.name.replace(/\.zip$/i, '')
      : 'imported-app';

    return {
      success: true,
      files,
      folders: Array.from(foldersSet).sort(),
      totalExtracted: files.length,
      rootPrefix: rootPrefix || undefined,
      projectName,
    };
  } catch (err: any) {
    console.error('ZIP extraction failed:', err);
    return {
      success: false,
      files: [],
      folders: [],
      totalExtracted: 0,
      error: err?.message || 'ZIPの解凍処理に失敗しました。ファイルが破損していないかご確認ください。',
    };
  }
}

