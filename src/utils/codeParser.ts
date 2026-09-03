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
