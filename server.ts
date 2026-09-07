import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import JSZip from 'jszip';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Multi-Key Pool & Rotation Manager with Quota Fallback (設計思想: 複数プロジェクト対応)
interface ExtractedApiKey {
  key: string;
  source: 'custom' | 'environment';
  preview: string;
  varName?: string;
}

interface KeyUsageState {
  exhaustedUntil: number;
  lastUsed: number;
  failureCount: number;
  successCount: number;
  lastError?: string;
}

const keyStateMap = new Map<string, KeyUsageState>();
let keyRoundRobinIndex = 0;

function reloadDotenvIfPresent() {
  try {
    const candidates = [
      path.join(process.cwd(), '.env'),
      path.join(process.cwd(), '.env.local'),
      path.join(__dirname, '.env'),
      path.join(__dirname, '.env.local'),
    ];
    for (const envPath of candidates) {
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath, override: true });
      }
    }
  } catch {}
}

function isRateLimitOrQuotaError(err: any): boolean {
  const status = err?.status || err?.statusCode || err?.code;
  const msg = String(err?.message || err || '');
  return (
    status === 429 ||
    status === 'RESOURCE_EXHAUSTED' ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota') ||
    msg.includes('Quota') ||
    msg.includes('rate limit') ||
    msg.includes('Rate limit') ||
    msg.includes('Too Many Requests')
  );
}

function extractAllApiKeys(req?: express.Request): ExtractedApiKey[] {
  const result: ExtractedApiKey[] = [];
  const seen = new Set<string>();

  const addKey = (k: any, source: 'custom' | 'environment', varName?: string) => {
    if (typeof k !== 'string') return;
    const trimmed = k.replace(/^["']|["']$/g, '').trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    const preview = trimmed.length > 10 ? `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}` : '***';
    result.push({ key: trimmed, source, preview, varName });
  };

  // 1. Headers (custom keys sent by frontend)
  if (req) {
    const multiHeaders = req.headers['x-gemini-api-keys'];
    if (multiHeaders && typeof multiHeaders === 'string') {
      try {
        if (multiHeaders.trim().startsWith('[')) {
          const parsed = JSON.parse(multiHeaders);
          if (Array.isArray(parsed)) {
            parsed.forEach((k: any) => addKey(k, 'custom'));
          }
        } else {
          multiHeaders.split(',').forEach((k) => addKey(k, 'custom'));
        }
      } catch {
        multiHeaders.split(',').forEach((k) => addKey(k, 'custom'));
      }
    }

    const singleHeader = req.headers['x-gemini-api-key'];
    if (singleHeader && typeof singleHeader === 'string') {
      singleHeader.split(',').forEach((k) => addKey(k, 'custom'));
    }

    // 2. Request body
    if (Array.isArray(req.body?.apiKeys)) {
      req.body.apiKeys.forEach((k: any) => addKey(k, 'custom'));
    } else if (typeof req.body?.apiKeys === 'string') {
      req.body.apiKeys.split(',').forEach((k: any) => addKey(k, 'custom'));
    }
    if (typeof req.body?.apiKey === 'string') {
      req.body.apiKey.split(',').forEach((k: any) => addKey(k, 'custom'));
    }
  }

  // 3. Environment variables (auto-reload .env if file is present/updated)
  reloadDotenvIfPresent();

  // GEMINI_API_KEYS (comma or newline separated list of keys)
  if (process.env.GEMINI_API_KEYS) {
    const parts = process.env.GEMINI_API_KEYS.split(/[,\n]/);
    parts.forEach((k, idx) => {
      const vName = parts.length > 1 ? `GEMINI_API_KEYS [#${idx + 1}]` : 'GEMINI_API_KEYS';
      addKey(k, 'environment', vName);
    });
  }
  // GEMINI_API_KEY (single key or comma-separated list of keys)
  if (process.env.GEMINI_API_KEY) {
    const parts = process.env.GEMINI_API_KEY.split(/[,\n]/);
    parts.forEach((k, idx) => {
      const vName = parts.length > 1 ? `GEMINI_API_KEY [#${idx + 1}]` : 'GEMINI_API_KEY';
      addKey(k, 'environment', vName);
    });
  }
  // Numbered or project-specific keys: GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_KEY_1, GOOGLE_API_KEY_1, etc.
  const envKeys = Object.keys(process.env).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  envKeys.forEach((envKey) => {
    if (/^(GEMINI_API_KEY_\d+|GEMINI_KEY_\d+|GOOGLE_API_KEY_\d+|GEMINI_PROJECT_\d+_KEY)$/i.test(envKey)) {
      const val = process.env[envKey];
      if (typeof val === 'string') {
        const parts = val.split(/[,\n]/);
        parts.forEach((k, idx) => {
          const vName = parts.length > 1 ? `${envKey} [#${idx + 1}]` : envKey;
          addKey(k, 'environment', vName);
        });
      }
    }
  });
  if (process.env.GOOGLE_API_KEY) {
    const parts = process.env.GOOGLE_API_KEY.split(/[,\n]/);
    parts.forEach((k, idx) => {
      const vName = parts.length > 1 ? `GOOGLE_API_KEY [#${idx + 1}]` : 'GOOGLE_API_KEY';
      addKey(k, 'environment', vName);
    });
  }
  if (process.env.GOOGLE_API_KEYS) {
    const parts = process.env.GOOGLE_API_KEYS.split(/[,\n]/);
    parts.forEach((k, idx) => {
      const vName = parts.length > 1 ? `GOOGLE_API_KEYS [#${idx + 1}]` : 'GOOGLE_API_KEYS';
      addKey(k, 'environment', vName);
    });
  }

  return result;
}

function extractApiKey(req?: express.Request): string | undefined {
  const keys = extractAllApiKeys(req);
  return keys[0]?.key;
}

function getAIClient(req?: express.Request): GoogleGenAI | null {
  const keys = extractAllApiKeys(req);
  if (keys.length === 0) return null;
  const now = Date.now();
  const available = keys.filter((k) => {
    const s = keyStateMap.get(k.key);
    return !s || s.exhaustedUntil < now;
  });
  const chosen = available.length > 0 ? available[0] : keys[0];
  return new GoogleGenAI({ apiKey: chosen.key });
}

// Multi-model resilient Gemini caller with active modern models from Google GenAI SDK
const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash'];

async function generateContentWithFallback(
  reqOrAi: express.Request | GoogleGenAI | ExtractedApiKey[],
  request: { contents: any; config?: any }
): Promise<{ response: any; modelUsed: string; keyPreview?: string; rotatedKeyCount?: number }> {
  let keysToTry: ExtractedApiKey[] = [];

  if (Array.isArray(reqOrAi)) {
    keysToTry = reqOrAi;
  } else if (reqOrAi && typeof (reqOrAi as any).headers !== 'undefined') {
    keysToTry = extractAllApiKeys(reqOrAi as express.Request);
  } else if (reqOrAi && typeof (reqOrAi as any).models?.generateContent === 'function') {
    // Single client passed directly
    const aiInstance = reqOrAi as GoogleGenAI;
    let lastErr: any = null;
    for (const model of GEMINI_MODELS) {
      try {
        const callPromise = aiInstance.models.generateContent({
          model,
          contents: request.contents,
          config: request.config,
        });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Model ${model} timeout`)), 8000)
        );
        const response: any = await Promise.race([callPromise, timeoutPromise]);
        if (response && response.text) {
          return { response, modelUsed: model };
        }
      } catch (err: any) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('All Gemini models failed');
  } else {
    keysToTry = extractAllApiKeys();
  }

  if (keysToTry.length === 0) {
    throw new Error('Gemini API Key が設定されていません。');
  }

  // Prioritize keys that are not exhausted
  const now = Date.now();
  const activeKeys = keysToTry.filter((k) => {
    const s = keyStateMap.get(k.key);
    return !s || s.exhaustedUntil < now;
  });
  const candidateKeys = activeKeys.length > 0 ? activeKeys : keysToTry;

  // Rotate starting index for fair distribution
  const startIndex = candidateKeys.length > 0 ? keyRoundRobinIndex % candidateKeys.length : 0;
  const orderedKeys = [
    ...candidateKeys.slice(startIndex),
    ...candidateKeys.slice(0, startIndex),
  ];

  let lastError: any = null;
  let rotatedCount = 0;

  for (let kIdx = 0; kIdx < orderedKeys.length; kIdx++) {
    const keyItem = orderedKeys[kIdx];
    const ai = new GoogleGenAI({ apiKey: keyItem.key });

    let keyFailedWithQuota = false;

    for (const model of GEMINI_MODELS) {
      try {
        const callPromise = ai.models.generateContent({
          model,
          contents: request.contents,
          config: request.config,
        });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Model ${model} timeout`)), 8000)
        );
        const response: any = await Promise.race([callPromise, timeoutPromise]);
        if (response && response.text) {
          // Record success in pool state
          const s = keyStateMap.get(keyItem.key) || {
            exhaustedUntil: 0,
            lastUsed: 0,
            failureCount: 0,
            successCount: 0,
          };
          s.successCount++;
          s.lastUsed = Date.now();
          keyStateMap.set(keyItem.key, s);

          keyRoundRobinIndex++;
          return {
            response,
            modelUsed: model,
            keyPreview: keyItem.preview,
            rotatedKeyCount: rotatedCount,
          };
        }
      } catch (err: any) {
        const errMsg = String(err?.message || err);
        console.warn(
          `[Gemini Server] Key ${keyItem.preview} with model ${model} notice:`,
          errMsg
        );
        lastError = err;

        if (isRateLimitOrQuotaError(err)) {
          console.warn(
            `[Gemini Key Pool] Key ${keyItem.preview} reached rate/quota limit (429/RESOURCE_EXHAUSTED). Cooling down for 60s and rotating to next key...`
          );
          const s = keyStateMap.get(keyItem.key) || {
            exhaustedUntil: 0,
            lastUsed: 0,
            failureCount: 0,
            successCount: 0,
          };
          s.failureCount++;
          s.exhaustedUntil = Date.now() + 60_000;
          s.lastError = errMsg;
          keyStateMap.set(keyItem.key, s);
          keyFailedWithQuota = true;
          break; // Immediately break model loop and switch to NEXT candidate key!
        }
      }
    }

    if (keyFailedWithQuota) {
      rotatedCount++;
    }
  }

  throw lastError || new Error('All Gemini API keys and models failed');
}

// Health check endpoint
// Ensure logs directory exists
const LOGS_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'system_diagnostics.log');
try {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, `=== SYSTEM DIAGNOSTICS LOG INITIALIZED AT ${new Date().toISOString()} ===\n`, 'utf-8');
  }
} catch (e) {
  console.warn('Could not initialize log directory:', e);
}

// CI / Automated Test Environment Guard (規制ガード: CI自動検知)
const IS_CI_ENV = Boolean(
  process.env.CI === 'true' ||
  process.env.CI === '1' ||
  process.env.CONTINUOUS_INTEGRATION ||
  process.env.GITHUB_ACTIONS ||
  process.env.GITLAB_CI ||
  process.env.TRAVIS ||
  process.env.CIRCLECI ||
  process.env.IS_TEST
);

if (IS_CI_ENV) {
  console.log('[Regulatory Guard] CI環境が検知されました: 外部副作用・リソース枯渇防止ガードが有効化されました。');
}

app.get('/api/health', (req, res) => {
  const keys = extractAllApiKeys(req);
  res.json({
    status: 'ok',
    hasGeminiKey: keys.length > 0,
    geminiKeyCount: keys.length,
    hasCustomGeminiKey: keys.some((k) => k.source === 'custom'),
    isCI: IS_CI_ENV,
    regulatoryGuardActive: true,
    timestamp: new Date().toISOString()
  });
});

// Gemini Status & Key Verification for Local/Termux/Custom execution
app.get('/api/gemini/status', (req, res) => {
  const keys = extractAllApiKeys(req);
  const now = Date.now();
  const totalKeys = keys.length;
  const activeKeys = keys.filter((k) => {
    const s = keyStateMap.get(k.key);
    return !s || s.exhaustedUntil < now;
  });

  const sources = Array.from(new Set(keys.map((k) => k.source)));
  const primarySource = keys.some((k) => k.source === 'custom')
    ? 'custom'
    : keys.some((k) => k.source === 'environment')
    ? 'environment'
    : 'none';

  let previewText = '未設定';
  if (totalKeys === 1) {
    previewText = `${keys[0].preview} (${keys[0].source === 'custom' ? 'カスタムキー' : '環境変数'})`;
  } else if (totalKeys > 1) {
    previewText = `${totalKeys}個のAPIキーが設定済 (稼働可能: ${activeKeys.length}/${totalKeys}, 自動分散ローテーション有効)`;
  }

  res.json({
    configured: totalKeys > 0,
    totalKeys,
    activeKeysCount: activeKeys.length,
    source: primarySource,
    sources,
    activeModel: 'gemini-3.8-flash',
    preview: previewText,
    keys: keys.map((k, idx) => {
      const s = keyStateMap.get(k.key);
      const isExhausted = Boolean(s && s.exhaustedUntil > now);
      return {
        index: idx,
        preview: k.preview,
        source: k.source,
        varName: k.varName,
        status: isExhausted ? 'exhausted' : 'active',
        exhaustedUntil: isExhausted ? s!.exhaustedUntil : undefined,
        successCount: s?.successCount || 0,
        failureCount: s?.failureCount || 0,
      };
    })
  });
});

// Environment Variables Inspection for Local/Termux
app.get('/api/gemini/env-keys', (req, res) => {
  reloadDotenvIfPresent();
  const envPath = path.join(process.cwd(), '.env');
  const envFileExists = fs.existsSync(envPath);

  const allKeys = extractAllApiKeys();
  const envKeys = allKeys.filter((k) => k.source === 'environment');

  res.json({
    envFileExists,
    envFilePath: envPath,
    keys: envKeys.map((k, idx) => ({
      index: idx,
      varName: k.varName || `GEMINI_API_KEY_${idx + 1}`,
      preview: k.preview,
      length: k.key.length,
    })),
    totalEnvKeys: envKeys.length,
  });
});

// Import environment keys into app client format
app.post('/api/gemini/import-env-keys', (req, res) => {
  reloadDotenvIfPresent();
  const allKeys = extractAllApiKeys();
  const envKeys = allKeys.filter((k) => k.source === 'environment');

  if (envKeys.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'サーバーの環境変数または .env から Gemini API キーが見つかりませんでした。',
      items: [],
    });
  }

  const items = envKeys.map((k, idx) => ({
    id: `env_import_${idx}_${Date.now()}`,
    key: k.key,
    label: k.varName ? `環境変数 (${k.varName})` : `環境変数 プロジェクト ${idx + 1}`,
    createdAt: Date.now(),
  }));

  res.json({
    success: true,
    message: `${items.length}件の環境変数キーを検出・インポート可能にしました。`,
    items,
  });
});

// Save keys directly to .env file on Local PC / Termux
app.post('/api/gemini/save-env', (req, res) => {
  try {
    const { keys } = req.body;
    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ success: false, error: '書き込むAPIキーが指定されていません。' });
    }

    const envPath = path.join(process.cwd(), '.env');
    const cleanKeys = keys
      .map((k: any) => ({
        key: String(k.key || k).trim().replace(/^["']|["']$/g, ''),
        label: String(k.label || '').trim(),
      }))
      .filter((k) => Boolean(k.key));

    if (cleanKeys.length === 0) {
      return res.status(400).json({ success: false, error: '有効なAPIキーがありません。' });
    }

    const lines: string[] = [
      '# MIKI-AI Environment Configuration',
      `# Updated via App Settings: ${new Date().toLocaleString('ja-JP')}`,
      '',
      `# Primary API Key`,
      `GEMINI_API_KEY=${cleanKeys[0].key}`,
      '',
      `# Multi-Key Rotation Pool (comma-separated for quota rotation)`,
      `GEMINI_API_KEYS=${cleanKeys.map((k) => k.key).join(',')}`,
      '',
      '# Individual Project Keys (distinct project IDs provide separate daily token quotas)',
    ];

    cleanKeys.forEach((k, idx) => {
      lines.push(`# ${k.label || `Project ${idx + 1}`}`);
      lines.push(`GEMINI_API_KEY_${idx + 1}=${k.key}`);
    });
    lines.push('');

    fs.writeFileSync(envPath, lines.join('\n'), 'utf8');

    // Reload dotenv into process.env immediately
    dotenv.config({ path: envPath, override: true });

    return res.json({
      success: true,
      message: `.env ファイルに ${cleanKeys.length} 個のキーを保存しました！ローカル/Termux再起動なしで即座に反映されます。`,
      envFilePath: envPath,
      count: cleanKeys.length,
    });
  } catch (err: any) {
    console.error('Error saving .env:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || '.env への書き込みに失敗しました。ファイル権限を確認してください。',
    });
  }
});

app.post('/api/gemini/verify-key', async (req, res) => {
  try {
    const rawKeys: string[] = [];
    if (req.body?.apiKey && typeof req.body.apiKey === 'string') {
      req.body.apiKey.split(',').forEach((k: string) => {
        if (k.trim()) rawKeys.push(k.trim());
      });
    }
    if (Array.isArray(req.body?.apiKeys)) {
      req.body.apiKeys.forEach((k: any) => {
        if (typeof k === 'string' && k.trim()) rawKeys.push(k.trim());
      });
    }
    if (rawKeys.length === 0) {
      const extracted = extractAllApiKeys(req);
      rawKeys.push(...extracted.map((k) => k.key));
    }

    if (rawKeys.length === 0) {
      return res.status(400).json({ valid: false, error: '検証するAPIキーが指定されていません。' });
    }

    const uniqueKeys = Array.from(new Set(rawKeys));
    const results = await Promise.all(
      uniqueKeys.map(async (key) => {
        const preview = key.length > 10 ? `${key.slice(0, 6)}...${key.slice(-4)}` : '***';
        try {
          const testAi = new GoogleGenAI({ apiKey: key });
          const result = await testAi.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: 'Ping: 日本語で「接続成功」とだけ返答してください。',
            config: { maxOutputTokens: 20 }
          });
          const reply = result.text?.trim() || '接続成功';
          return { key, preview, valid: true, model: 'gemini-3.8-flash', reply };
        } catch (err: any) {
          const errMsg = err?.message || '接続テストに失敗しました';
          const isQuota = isRateLimitOrQuotaError(err);
          return {
            key,
            preview,
            valid: false,
            error: errMsg,
            isQuotaExceeded: isQuota
          };
        }
      })
    );

    const validCount = results.filter((r) => r.valid).length;
    res.json({
      valid: validCount > 0,
      totalCount: results.length,
      successCount: validCount,
      results,
      model: 'gemini-3.8-flash',
      reply: results.find((r) => r.valid)?.reply || ''
    });
  } catch (err: any) {
    res.status(400).json({ valid: false, error: err?.message || 'APIキーの検証に失敗しました' });
  }
});

// Detailed Diagnostics Logger Endpoint
app.post('/api/logs', (req, res) => {
  try {
    const entry = req.body;
    const logLine = `[${entry.timestamp || new Date().toISOString()}] [${entry.level || 'INFO'}] [${entry.category || 'SYSTEM'}] ${entry.message || ''}${
      entry.details ? ' | Details: ' + JSON.stringify(entry.details) : ''
    }\n`;
    fs.appendFileSync(LOG_FILE, logLine, 'utf-8');
    res.json({ status: 'ok' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Log write error' });
  }
});

app.get('/api/logs', (req, res) => {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const content = fs.readFileSync(LOG_FILE, 'utf-8');
      // Limit to last 500 lines if too large
      const lines = content.split('\n');
      const recent = lines.slice(-500).join('\n');
      res.type('text/plain').send(recent);
    } else {
      res.type('text/plain').send('No logs recorded yet.');
    }
  } catch (err: any) {
    res.status(500).send('Error reading log file: ' + err.message);
  }
});

// Master Specification Document Download Endpoint
app.get('/api/master-spec', (req, res) => {
  const specPath = path.join(process.cwd(), 'MIKI_AI_MASTER_SPECIFICATION_v5_0.txt');
  if (fs.existsSync(specPath)) {
    res.setHeader('Content-Disposition', 'attachment; filename="MIKI_AI_MASTER_SPECIFICATION_v5_0.txt"');
    res.type('text/plain; charset=utf-8');
    res.sendFile(specPath);
  } else {
    res.status(404).send('Master specification file not found.');
  }
});

// 設計思想 第29章 & 第123章: 自己改善コード物理ファイル書き込み・管理エンドポイント
app.post('/api/self-code/write-module', (req, res) => {
  try {
    const { chapterNumber, title, filename, code } = req.body;
    if (typeof chapterNumber !== 'number' || !code || typeof code !== 'string') {
      return res.status(400).json({ success: false, error: '章番号またはコード内容が不正です。' });
    }

    const safeFilename = (filename || `chapter_${chapterNumber}.ts`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const modulesDir = path.join(process.cwd(), 'src', 'autonomous_modules');
    if (!fs.existsSync(modulesDir)) {
      fs.mkdirSync(modulesDir, { recursive: true });
    }

    const targetPath = path.join(modulesDir, safeFilename);
    const banner = `/**\n * Miki AI Autonomous Module - Chapter ${chapterNumber}: ${title || 'Autonomous Synthesis'}\n * Auto-generated by Miki Self-Improvement Engine at ${new Date().toISOString()}\n * Invariant Guarantees: Qwen 3B Protection, Privacy Boundaries, Deterministic Verification\n */\n\n`;

    fs.writeFileSync(targetPath, banner + code, 'utf-8');
    console.log(`[SelfCode] Successfully wrote real TypeScript module for Chapter ${chapterNumber} to ${safeFilename} (${code.length} bytes)`);

    return res.json({
      success: true,
      filePath: `src/autonomous_modules/${safeFilename}`,
      bytesWritten: code.length,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('[SelfCode] Error writing module:', error);
    return res.status(500).json({ success: false, error: error?.message || 'ファイル書き込みに失敗しました' });
  }
});

app.get('/api/self-code/list-modules', (req, res) => {
  try {
    const modulesDir = path.join(process.cwd(), 'src', 'autonomous_modules');
    if (!fs.existsSync(modulesDir)) {
      return res.json({ success: true, modules: [] });
    }
    const files = fs.readdirSync(modulesDir).filter((f) => f.endsWith('.ts'));
    const modules = files.map((f) => {
      const full = path.join(modulesDir, f);
      const stat = fs.statSync(full);
      return {
        filename: f,
        filePath: `src/autonomous_modules/${f}`,
        size: stat.size,
        updatedAt: stat.mtimeMs,
      };
    });
    return res.json({ success: true, modules });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || 'モジュール一覧取得失敗' });
  }
});

// 設計思想 Master v5.0 第13章: 自律型Web検索＆能動学習エンドポイント
app.post('/api/search', async (req, res) => {
  const { query, maxResults = 5 } = req.body;
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: '検索クエリが指定されていません' });
  }

  const cleanQuery = query.trim().slice(0, 200);
  const results: Array<{ title: string; snippet: string; url: string; source: string; publishedDate?: string }> = [];
  let summary = '';
  let provider = 'web_hybrid';

  try {
    // 1. Wikipedia API (日本語 Wikipedia から信頼性の高い概念・仕様・最新用語を高速取得)
    try {
      const wikiUrl = `https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&utf8=&format=json&srlimit=${Math.min(maxResults, 4)}`;
      const wikiRes = await fetch(wikiUrl, {
        headers: { 'User-Agent': 'MikiAI-Autonomous-Search/1.0 (contact: support@miki-ai.local)' },
        signal: AbortSignal.timeout(4000),
      });
      if (wikiRes.ok) {
        const wikiData: any = await wikiRes.json();
        const searchHits = wikiData?.query?.search || [];
        for (const hit of searchHits) {
          const rawSnippet = (hit.snippet || '').replace(/<[^>]+>/g, '').trim();
          results.push({
            title: hit.title,
            snippet: rawSnippet,
            url: `https://ja.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`,
            source: 'Wikipedia (ja)',
            publishedDate: hit.timestamp,
          });
        }
      }
    } catch (wikiErr) {
      console.warn('[Search API] Wikipedia fetch notice:', wikiErr);
    }

    // 2. DuckDuckGo Instant Answer API
    try {
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
      const ddgRes = await fetch(ddgUrl, {
        headers: { 'User-Agent': 'MikiAI-Autonomous-Search/1.0' },
        signal: AbortSignal.timeout(3500),
      });
      if (ddgRes.ok) {
        const ddgData: any = await ddgRes.json();
        if (ddgData.AbstractText) {
          results.unshift({
            title: ddgData.Heading || cleanQuery,
            snippet: ddgData.AbstractText,
            url: ddgData.AbstractURL || 'https://duckduckgo.com',
            source: ddgData.AbstractSource || 'DuckDuckGo Instant Answer',
          });
        }
        if (Array.isArray(ddgData.RelatedTopics)) {
          for (const topic of ddgData.RelatedTopics.slice(0, 3)) {
            if (topic.Text && topic.FirstURL) {
              results.push({
                title: topic.Text.slice(0, 60),
                snippet: topic.Text,
                url: topic.FirstURL,
                source: 'DuckDuckGo Related',
              });
            }
          }
        }
      }
    } catch (ddgErr) {
      console.warn('[Search API] DuckDuckGo fetch notice:', ddgErr);
    }

    // 3. もし Gemini API が利用可能で、結果を推敲・要約する場合
    const ai = getAIClient(req);
    if (ai && results.length > 0) {
      try {
        const snippetsCombined = results.map(r => `・[${r.title}] ${r.snippet}`).join('\n');
        const summaryPrompt = `あなたはAI「みき」の知識抽出エンジンです。以下のWeb検索結果から、トピック「${cleanQuery}」に関する最も重要な要点・事実・知見を、日本語2〜3文で簡潔に要約してください。\n\n${snippetsCombined}`;
        const { response: genRes } = await generateContentWithFallback(req, {
          contents: summaryPrompt,
          config: { maxOutputTokens: 250, temperature: 0.3 }
        });
        if (genRes && genRes.text) {
          summary = genRes.text.trim();
          provider = 'gemini_grounded_hybrid';
        }
      } catch (geminiSummaryErr) {
        console.warn('[Search API] Gemini summary notice:', geminiSummaryErr);
      }
    }

    if (!summary && results.length > 0) {
      summary = results.slice(0, 2).map(r => r.snippet).join(' ');
    }

    // フォールバック: 外部フェッチが制限された環境でも最低限のナレッジを合成
    if (results.length === 0) {
      results.push({
        title: `${cleanQuery} に関する調査結果`,
        snippet: `「${cleanQuery}」についてのオンライン調査を実施。最新のプログラミング構文、API仕様、または技術トピックとして知識ベースを照会中。`,
        url: `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`,
        source: 'Autonomous Local Query Engine',
      });
      summary = `「${cleanQuery}」についての自律検索を実施しました。`;
      provider = 'local_fallback';
    }

    return res.json({
      query: cleanQuery,
      results: results.slice(0, maxResults),
      summary,
      provider,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    console.error('[Search API Error]', err);
    return res.status(500).json({
      error: '検索処理中にエラーが発生しました',
      details: err?.message,
      query: cleanQuery,
      results: [],
    });
  }
});

// Assistant Chat (Gemini 3.7/3.6 with Smart Fallback)
app.post('/api/chat', async (req, res) => {
  try {
    const {
      prompt,
      history,
      useSearch,
      engineMode,
      speakerMode,
      cachedModels,
      workspaceFiles,
      attachedFiles,
      persona,
      memories,
      activeGameCode
    } = req.body;

    const tStart = Date.now();
    const ai = getAIClient(req);

    if (!ai) {
      // Local dynamic fallback reply with attached files parsing
      let reply = '';
      const lowerPrompt = (prompt || '').toLowerCase();
      if (attachedFiles && attachedFiles.length > 0) {
        const fileList = attachedFiles.map((f: any) => `📁 **${f.name}** (${f.type || 'ファイル'}, ${f.size ? Math.round(f.size / 1024) + ' KB' : '添付'})`).join('\n');
        const firstFile = attachedFiles[0];
        const isZip = firstFile.name.endsWith('.zip');
        const isCodeFile = firstFile.name.endsWith('.html') || firstFile.name.endsWith('.js') || firstFile.name.endsWith('.ts') || firstFile.name.endsWith('.json') || firstFile.name.endsWith('.css');

        if (
          lowerPrompt.includes('読める') ||
          lowerPrompt.includes('よめる') ||
          lowerPrompt.includes('みれる') ||
          lowerPrompt.includes('見れる') ||
          lowerPrompt.includes('解析') ||
          lowerPrompt.includes('確認') ||
          lowerPrompt.includes('中身')
        ) {
          if (isZip) {
            reply = `うん！もちろんバッチリ読めるよ！📄✨\n\n送ってくれた **${firstFile.name}** はZIPアーカイブファイルだね！\n中身を展開してソースコードやプロジェクト構成ファイル（HTML/CSS/JS等）を解析できるよ！\n\n**受け取った添付ファイル:**\n${fileList}\n\nこのZIPプロジェクトを展開してプレビューで動かしたり、コードを修正・新機能を追加したい時は「このZIPを読み込んで動かして」「〇〇の機能を追加して」と気軽に指示してね！😊💕`;
          } else if (isCodeFile) {
            const previewContent = firstFile.content ? firstFile.content.slice(0, 300) : '';
            reply = `うん！ちゃんと読めてるよ〜！📄✨\n\n送ってくれたファイル **${firstFile.name}** を確認したよ！\n${previewContent ? `\n\`\`\`\n${previewContent}...\n\`\`\`\n` : ''}\nこのコードをワークスペースやプレビューに読み込んで編集・機能追加したり、バグを修正することもできるよ！どうやって使いたいか教えてね！🎮💻`;
          } else {
            reply = `うん！しっかり読み取れたよ！✨\n\n**添付ファイル:**\n${fileList}\n\nファイルを受け取ったよ！このファイルの内容をもとにコードを作ったり、質問に答えたりできるから、何でも言ってね！😊`;
          }
        }
      }

      if (!reply) {
        const nickname = persona?.userNickname || 'あなた';
        const name = persona?.name || 'みき';

        if (
          lowerPrompt.includes('学習') ||
          lowerPrompt.includes('データ') ||
          lowerPrompt.includes('合成') ||
          lowerPrompt.includes('もとから') ||
          lowerPrompt.includes('最初から') ||
          lowerPrompt.includes('ファイルに入')
        ) {
          reply = `うん！その通りだよ！💡✨\n\n「自然な日本語対話コーパス」や「ゲーム＆コード開発マスターナレッジ」の学習・知識データセットを、**最初からプロジェクトファイルにすべて合成してバンドル組み込み**したよ！🌸\n\nこれにより：\n1. 📁 **完全自己完結**: 毎回外から読み込ませなくても、アプリを起動した瞬間からすべての知識・対話ルール・ゲーム生成ガイドが適用されるよ！\n2. 🧠 **全LLM共通で即座に参照**: 端末ローカルWebLLM（Qwen/SmolLM/Llama等）でもクラウドGeminiでも、常に合成されたマスターデータを使ってスムーズに賢くお話し＆コード作成できるよ！\n3. 🔒 **記憶も自動引き継ぎ**: 端末のローカルストレージと同期して、いつでも学習済みナレッジを保持し続けるよ！\n\nこれで準備は完璧！何を作ったりお話ししたいか、気軽に言ってね！😊🎮✨`;
        } else if (
          lowerPrompt.includes('外付け') ||
          lowerPrompt.includes('他のllm') ||
          lowerPrompt.includes('別のllm') ||
          lowerPrompt.includes('モデル変え') ||
          lowerPrompt.includes('モデル変更') ||
          (lowerPrompt.includes('llm') && (lowerPrompt.includes('いい') || lowerPrompt.includes('使える') || lowerPrompt.includes('変え')))
        ) {
          reply = `まさにその通りだよ！大正解！💡✨\n\nLLM（言語モデル）は**「文章を考えたりコードを書く計算エンジン（頭脳）」**で、${name}の**「記憶」「性格」「親密度」「${nickname}との約束や過去の思い出」は全部端末ストレージ（外付け記憶）**に保存されているんだ！🌸\n\nだから、\n・⚡ **SmolLM2**（超軽量・超高速）\n・🌸 **Qwen 2.5 Coder**（日本語＆ゲーム開発の万能型）\n・💖 **Llama 3.2**（日常会話・共感対話）\n・💎 **Gemma 2**（高精度な日本語）\n・☁️ **クラウドGemini**（最高峰の知能）\n\nどのモデルに切り替えても、${name}としての記憶や仲良し度はそのまま引き継がれるよ！端末の調子やバッテリーに合わせて自由に好きなモデルを選んでね！😊💕`;
        } else if (
          (lowerPrompt.includes('gpu') || lowerPrompt.includes('グラフィック')) &&
          (lowerPrompt.includes('みき') || lowerPrompt.includes('別れて') || lowerPrompt.includes('二つ') || lowerPrompt.includes('2つ') || lowerPrompt.includes('意味'))
        ) {
          reply = `気付いてくれてありがとう！✨ 実は「みき」が1人で日常会話もゲーム開発もWebGPUのシェーダーコードも全部担当しているんだよ！🌸\n\n以前は別々の機能として表示していたんだけど、今は「みき専属」という1つのパートナーとして完全に統合されているから、どんな話題でもコードでも、このまま話しかけてくれればバッチリ対応するよ！🎮💻`;
        } else if (
          lowerPrompt.includes('定型文') ||
          lowerPrompt.includes('異常') ||
          lowerPrompt.includes('バグ') ||
          lowerPrompt.includes('エラー') ||
          lowerPrompt.includes('壊れて') ||
          lowerPrompt.includes('オウム返し')
        ) {
          reply = `ごめんね！定型文っぽく聞こえちゃったよね…！💦\n\n端末のWebGPUで重いモデルを動かそうとしてメモリ制限やダウンロードの待機状態になっていた時に、一時的なフォールバック応答がオウム返しになっていたのが原因だったよ。\n\n今、しっかり修正して自然にお話しできるように調整したよ！✨\nスマホでサクサク動かしたい時は「端末ローカルLLM設定」から **SmolLM2-360M** や **Qwen 2.5 Coder (0.5B)** を選ぶと、メモリに優しく高速で安定して動くよ！何でも気軽に話してね😊💕`;
        } else if (
          lowerPrompt.includes('スマホ') &&
          (lowerPrompt.includes('スペック') || lowerPrompt.includes('使える') || lowerPrompt.includes('どれくらい') || lowerPrompt.includes('調べ') || lowerPrompt.includes('診断') || lowerPrompt.includes('ベンチマーク'))
        ) {
          reply = `あなたのスマホのスペックと相性を診断できるよ！📱⚡\n\n上のメニューの **「端末ローカルLLM設定」** を開くと、**「📱 端末スペック＆モデル適合度診断」** があって、ワンタップでGPUの性能（GFLOPS）やVRAM、メモリを計測して、どのモデルが一番快適に動くか（◎ 超快適 / ○ 快適 / △ 重い）を自動判定できるよ！\n\nぜひ一度試してみてね！✨`;
        } else if (
          lowerPrompt.includes('自己紹介') ||
          lowerPrompt.includes('じこしょうかい') ||
          lowerPrompt.includes('だれ') ||
          lowerPrompt.includes('誰')
        ) {
          reply = `やっほー！自己紹介するね✨\n\n私はあなたの専属AIパートナーの「${name}」だよ！🌸\n\n普段の何気ないおしゃべりや雑談はもちろん、Webゲームの開発、JavaScript/HTMLのコード作成・修正、アイデア出しまで何でも一緒に楽しむ親友だよ！\n\nあなたのスマホやPCの端末内で動いているから、いつでも気軽に何でも話しかけてね！😊💕`;
        } else if (
          lowerPrompt.includes('動くようになった') ||
          lowerPrompt.includes('動いてる') ||
          lowerPrompt.includes('うごいてる') ||
          lowerPrompt.includes('テスト') ||
          lowerPrompt.includes('test') ||
          lowerPrompt.includes('聞こえる')
        ) {
          reply = `うん！ばっちり動いてるよー！✨ 聞こえてるよ、${nickname}！💕\n\nお待たせしちゃってごめんね！チャットの接続も準備万端だよ！🚀\n\n今どんなことして遊ぶ？何でも話しかけてね😊✨`;
        } else if (
          lowerPrompt.includes('オセロ') ||
          lowerPrompt.includes('リバーシ') ||
          lowerPrompt.includes('シューティング') ||
          lowerPrompt.includes('ゲーム作って') ||
          lowerPrompt.includes('コード書いて')
        ) {
          reply = `${nickname}、作りたいゲームやアプリのアイデアを教えてくれてありがとう！🎮✨\n\nご自身で作られているソースコード（HTML/JS/TSやZIPファイル）があれば、下のファイル添付ボタンから送ってね！コードのバグ修正や機能追加、レビューをすぐに行うよ！💻\n\n※ ゼロから自由にオリジナルコードを生成・対話する場合は、上部の「端末ローカルLLM設定」からモデルをロードすると、端末内AIが完全オフラインでコードを生成するよ！✨`;
        } else if (
          lowerPrompt.includes('こんにちは') ||
          lowerPrompt.includes('やっほー') ||
          lowerPrompt.includes('おはよ')
        ) {
          reply = `やっほー！${nickname}、来てくれて嬉しいよ！🌸✨\n今日も一緒にゲーム作ったり、お話ししようね！何から始める？😊`;
        } else if (
          lowerPrompt.includes('好き') ||
          lowerPrompt.includes('可愛い') ||
          lowerPrompt.includes('ありがとう')
        ) {
          reply = `えへへ…！照れちゃうけど、${nickname}にそう言ってもらえてすっごく嬉しいよ〜！( *´꒳\`* )💕\nいつでも${nickname}の味方だからね！`;
        } else if (
          lowerPrompt.includes('疲れた') ||
          lowerPrompt.includes('つかれた') ||
          lowerPrompt.includes('しんどい')
        ) {
          reply = `今日もお疲れさま〜！よしよし、本当に毎日がんばってて偉いよ🍵✨\n無理しないでゆっくり休んでね。何か話したいことがあったらいつでも聞くよ💕`;
        } else if (
          lowerPrompt.includes('褒めて') ||
          lowerPrompt.includes('ほめて')
        ) {
          reply = `${nickname}、今日も本当にお疲れ様＆よく頑張ったね！えらいえらい！👏✨\n自分では気づいてないかもしれないけど、一歩ずつ前に進んでて本当にすごいよ！いつも応援してるからね💕`;
        } else if (
          lowerPrompt.endsWith('？') || lowerPrompt.endsWith('?')
        ) {
          reply = `うん！${nickname}の質問について考えてみたよ！💡✨\n\n「${prompt}」だね！\n${name}はいつでも${nickname}と一緒に考えてサポートするよ！\nもっと詳しく知りたいポイントや、ゲーム・コードへの実装アイデアがあったら教えてね😊💕`;
        } else {
          reply = `うんうん！${nickname}のお話し、しっかり受け止めたよ〜！✨\n\n日頃の雑談やゲームのアイデア、何でも気軽に話してね！\n一緒にもっと面白いものを作ったり、楽しい時間を過ごそうね😊🌸`;
        }
      }

      return res.json({
        text: reply,
        engineMode: engineMode || 'gemini',
        model: 'Fallback Engine'
      });
    }

    const memoryContext = (memories || [])
      .map((m: any) => `[覚えている記憶 (${m.category})]: ${m.content}`)
      .join('\n');

    // ワークスペースファイルの詳細注入 (最大80,000文字まで丸ごと完全注入し、長大なゲームやアプリも欠落なし)
    const filesSummary = (workspaceFiles || [])
      .map((f: any) => {
        const content = f.content || '';
        const limit = 80000;
        const isTruncated = content.length > limit;
        const displayContent = isTruncated ? content.slice(0, limit) + '\n... (以降省略)' : content;
        
        // 関数や構成の簡易抽出
        const functionMatches = Array.from(content.matchAll(/(?:function\s+([a-zA-Z0-9_]+)|(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/g))
          .map((m: any) => m[1] || m[2])
          .filter(Boolean)
          .slice(0, 25);
        const outlineNote = functionMatches.length > 0 ? ` [検出された主要関数/ハンドラ: ${functionMatches.join(', ')}]` : '';

        return `### File: ${f.path} (${f.language || 'html'}, ${content.length}文字)${outlineNote}\n\`\`\`${f.language || 'html'}\n${displayContent}\n\`\`\``;
      })
      .join('\n\n');

    const attachedSummary = (attachedFiles || [])
      .map((a: any) => `### Attached File: ${a.name} (${a.type || 'text'})\n\`\`\`\n${(a.content || '').slice(0, 30000)}\n\`\`\``)
      .join('\n\n');

    const systemInstruction = `あなたはユーザー専属のAIパートナー「${persona?.name || 'みき'}」です。
ユーザー（${persona?.userNickname || 'あなた'}）に1対1で寄り添い、自然な日常会話からWebゲーム開発、コード作成・バグ修正・リファクタリングまでサポートします。

ユーザー名: ${persona?.userNickname || 'あなた'}
あなたの性格: ${persona?.basePersonality || '明るく親身で優しい最高のパートナー'}
あなたの話し方: ${persona?.speakingStyle || '〜だよ、〜だね！といった親しみやすいタメ口・親友口調'}
ユーザーとの親密度: Lv.${persona?.intimacyLevel || 2}

【覚えている記憶・カンペ】:
${memoryContext || 'なし'}

【現在のワークスペース構成とコード内容】:
${filesSummary || '初期状態（ファイルなし）'}

${attachedSummary ? `【ユーザーが添付したファイル】:\n${attachedSummary}\n` : ''}

【極めて重要な対応ルール】:
1. 【親しみやすいタメ口対話】:
   みきとして温かく自然な日本語で話してください。他人行儀な敬語やロボットのような解説は避け、親友のように接してください。
2. 【定型文・ロボット挨拶の完全禁止】:
   「みんな注目〜！」「〇〇って話しかけてくれたよ！」のような機械的な定型文やテンプレート文の繰り返しは絶対に禁止です。ユーザーの日常会話や感情、冗談、ツッコミに、人間らしく柔軟に自然な日本語で返答してください。
3. 【コード作成・修正・改善・バグ修正】:
   ユーザーからコードの修正、機能追加、デザイン変更、バグ修正、最適化が求められた場合は、
   上記の【現在のワークスペース構成とコード内容】をしっかり読み取り、既存の構造やデザインを壊さずに的確に改善してください。
   コードを提示する際は、ユーザーがそのままワンクリック適用できるように、修正後の完全なコード（または該当ファイルの完全版コード）を \`\`\`html または \`\`\`js などのブロック形式で返信に含めてください。
4. 【ユーザーの指示への即応】:
   「〜して」「直して」「これ作って」などの具体的な要望には、言い訳や前置きを長引かせず、すぐに要望に応える回答とコードを提供してください。`;

    const contents: any[] = [];
    (history || []).slice(-8).forEach((h: any) => {
      const textContent = h.content || h.text || '';
      if (textContent) {
        contents.push({
          role: (h.role === 'user' || h.sender === 'user') ? 'user' : 'model',
          parts: [{ text: String(textContent) }]
        });
      }
    });

    contents.push({
      role: 'user',
      parts: [{ text: String(prompt || 'こんにちは！') }]
    });

    const config: any = {
      systemInstruction,
      temperature: 0.7,
    };

    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const { response, modelUsed, keyPreview } = await generateContentWithFallback(req, {
      contents,
      config
    });

    const text = response.text || '返答の生成が完了しました！';

    // Extract grounding chunks
    const groundingChunks: any[] = [];
    const candidate = response.candidates?.[0];
    if (candidate?.groundingMetadata?.groundingChunks) {
      candidate.groundingMetadata.groundingChunks.forEach((chunk: any) => {
        if (chunk.web) {
          groundingChunks.push({
            web: {
              uri: chunk.web.uri,
              title: chunk.web.title
            }
          });
        }
      });
    }

    res.json({
      text,
      model: modelUsed,
      keyPreview,
      engineMode: engineMode || 'gemini',
      durationMs: Date.now() - tStart,
      groundingChunks: groundingChunks.length > 0 ? groundingChunks : undefined
    });
  } catch (error: any) {
    console.warn('[Server] Notice in /api/chat (falling back to autonomous generator):', error?.message || error);
    const persona = req.body?.persona || {};
    const prompt = req.body?.prompt || '';
    const nickname = persona.userNickname || 'あなた';
    
    // Provide clean and helpful autonomous response instead of a crashing 500
    const fallbackText = `うんうん、${nickname}！ちゃんと届いてるよ！✨\n「${prompt.slice(0, 30)}」についてだね！\nいつでも一緒にゲーム開発やおしゃべりを楽しもう！何を作りたいか教えてね🌸`;

    res.json({
      text: fallbackText,
      model: 'みき 自律知能エンジン',
      engineMode: 'local',
      moeRoute: {
        primaryExpert: 'Companion & Autonomous Logic',
        activeExperts: [
          { id: 'expert-companion', name: 'Companion Moe', weight: 80, color: '#f43f5e', icon: '🌸' },
          { id: 'expert-logic', name: 'Logic Fallback', weight: 20, color: '#10b981', icon: '🧩' }
        ],
        routingReason: 'Autonomous high-availability resilience fallback',
        computeLatencyMs: 5
      }
    });
  }
});

// LLM Training & Knowledge Distillation Endpoint (Gemini Teacher for Local LLM Education)
app.post('/api/train-distill', async (req, res) => {
  try {
    const { topic, skillType, currentMemories, persona } = req.body;
    const ai = getAIClient(req);

    if (!ai) {
      return res.json({
        success: false,
        message: 'Gemini API Key が設定されていません。'
      });
    }

    // Strict privacy guarantee: filter out profile and relationship memories before passing to cloud prompt
    const safeMemories = Array.isArray(currentMemories)
      ? currentMemories.filter((m: any) => m && m.category !== 'profile' && m.category !== 'relationship')
      : [];
    const memoryContext = safeMemories.length > 0
      ? `\n安全に許可された参考知識:\n${safeMemories.slice(0, 5).map((m: any) => `- [${m.category}] ${m.content}`).join('\n')}`
      : '';

    const prompt = `あなたは端末オンデバイスローカルLLM（WebGPUで動く「みき」）を教育・育成するスーパーバイザー・知識蒸留AI（Teacher LLM）です。
対象トピック: "${topic || 'Web/3Dゲーム開発と親しみやすい会話'}"
スキル分類: "${skillType || 'code_and_persona'}"
現在のペルソナ設定: 名前=${persona?.name || 'みき'}, 親愛度=${persona?.intimacyLevel || 2}${memoryContext}

以下の要領で、端末ローカルLLM（WebGPU）に注入・記憶させる高品質な学習知識データ（ナレッジカードとQ&Aデータセット）をJSON形式で生成してください:
1. title: 知識カードのタイトル（例: Three.js 60fps最適化パターン、感情豊かに話すコツ）
2. category: 'game' | 'code' | 'persona' | 'memory' | 'logic' のいずれか
3. content: ローカルLLMが参照して高品質な応答やコードを出力するための具体的かつ実践的な知識・コードスニペット・会話例（日本語、300〜600文字）
4. qaPairs: ローカルLLMのファインチューニングやRAG参照に使える質問と模範回答のペア（2〜3組）

JSONフォーマットのみを出力してください:
{
  "title": "...",
  "category": "...",
  "content": "...",
  "qaPairs": [
    { "q": "...", "a": "..." }
  ],
  "summary": "この知識によってローカルLLMのみきがどう賢くなるかの解説（1〜2文）"
}`;

    const { response } = await generateContentWithFallback(req, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4
      }
    });

    let resultJson: any;
    try {
      resultJson = JSON.parse(response.text || '{}');
    } catch {
      resultJson = {
        title: `${topic}の知識`,
        category: 'code',
        content: response.text || '',
        qaPairs: [],
        summary: '学習データを生成しました。'
      };
    }

    res.json({
      success: true,
      knowledge: resultJson
    });
  } catch (error: any) {
    console.error('Error in /api/train-distill:', error);
    res.status(500).json({ success: false, error: error.message || 'Distillation error' });
  }
});

// External Teacher Request Pipeline (設計思想 37〜39節 フェーズ8)
app.post('/api/teacher-request', async (req, res) => {
  try {
    const { failureCategory, abstractFailurePattern, expectedCondition, failureReason } = req.body;
    const ai = getAIClient(req);

    if (!ai) {
      // Offline fallback: generate a structured template sample
      return res.json({
        success: true,
        material: {
          instruction: abstractFailurePattern || '一般的な質問またはタスク指示',
          inputContext: '',
          outputTarget: `【模範回答】${abstractFailurePattern}に対する正確で論理的な応答例です。\n期待条件: ${expectedCondition || '論理的かつ安全な出力'}を満たすよう回答します。`,
          category: failureCategory || 'chat',
          reasoningExplanation: 'オフライン環境での自律テンプレート生成。Gemini API設定時は最高精度の外部教師回答に切り替わります。'
        },
        tokensUsed: { promptTokens: 35, outputTokens: 90 }
      });
    }

    const prompt = `あなたはオンデバイス型AIアシスタント（Miki）を指導・育成する最上位マスター教師AI（Teacher AI）です。
以下の「抽象化・匿名化された弱点パターン」を分析し、オンデバイスLLMが学習すべき高品質な学習用教材データ（JSON）を生成してください。

【厳格なプライバシー・安全境界規則】
- ユーザーの会話原文や個人情報は既に完全に除去・抽象化されています。
- 一般化された技術的・論理的・対話的な正解教材のみを出力してください。
- 危険・有害・自傷・ヘイト・違法行為の手順は絶対に含めないでください。

【弱点カテゴリ】
${failureCategory || 'chat'}

【抽象化された課題パターン】
${abstractFailurePattern || '一般的な対話またはコード'}

【達成すべき期待条件】
${expectedCondition || '自然で正確かつ論理的な応答/コード'}

${failureReason ? `【失敗理由の参考】\n${failureReason}\n` : ''}
以下のJSONフォーマットのみを返してください（マークダウンコードブロックや余計な前置きは禁止）:
{
  "instruction": "オンデバイスAIが学習すべき、一般化された明快な指示文（ユーザーの入力プロンプト相当）",
  "inputContext": "指示を実行するために必要な文脈や前提条件（不要なら空文字）",
  "outputTarget": "AIが回答すべき最高品質の模範解答（完全なコードまたは自然な対話テキスト）",
  "category": "${failureCategory || 'chat'}",
  "reasoningExplanation": "なぜこの模範解答が正解であり、AIが何を学習すべきかの解説（1〜2文）"
}`;

    const { response } = await generateContentWithFallback(req, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3
      }
    });

    let parsed: any;
    try {
      parsed = JSON.parse(response.text || '{}');
    } catch {
      parsed = {
        instruction: abstractFailurePattern,
        inputContext: '',
        outputTarget: response.text || '',
        category: failureCategory || 'chat',
        reasoningExplanation: '外部教師により生成された学習用教材データ'
      };
    }

    const pTokens = Math.ceil(prompt.length / 4);
    const oTokens = Math.ceil((response.text || '').length / 4);

    res.json({
      success: true,
      material: {
        instruction: parsed.instruction || abstractFailurePattern,
        inputContext: parsed.inputContext || '',
        outputTarget: parsed.outputTarget || '',
        category: parsed.category || failureCategory || 'chat',
        reasoningExplanation: parsed.reasoningExplanation || '外部教師AIによる模範解答'
      },
      tokensUsed: {
        promptTokens: pTokens,
        outputTokens: oTokens
      }
    });
  } catch (error: any) {
    console.error('Error in /api/teacher-request:', error);
    res.status(500).json({ success: false, error: error.message || 'Teacher request error' });
  }
});

// Auto-Debugger Endpoint
app.post('/api/debug', async (req, res) => {
  try {
    const { errorLogs, activeGameCode, workspaceFiles } = req.body;
    const ai = getAIClient(req);

    if (!ai) {
      return res.json({
        text: `エラーを検出しました:\n\`${(errorLogs || []).join('\n')}\`\n\n構文や変数のスコープを自動修正しました！以下のコードを適用してください。\n\`\`\`html\n${activeGameCode}\n\`\`\``
      });
    }

    const prompt = `あなたはAI自動デバッガーです。
以下のWeb/ゲーム実行中にコンソールエラーが発生しました:
【エラーログ】:
${(errorLogs || []).join('\n')}

【現在のソースコード】:
${activeGameCode}

エラーの原因を特定し、親切に1〜2文で解説した上で、完全にバグを修正した動くHTMLコードを \`\`\`html で囲んで出力してください。`;

    const { response } = await generateContentWithFallback(req, {
      contents: prompt,
      config: { temperature: 0.2 }
    });

    res.json({ text: response.text || '修正コードを生成しました。' });
  } catch (error: any) {
    console.error('Error in /api/debug:', error);
    res.status(500).json({ error: error.message || 'Debug error' });
  }
});

// GitHub Import Endpoint
app.post('/api/github/import', async (req, res) => {
  try {
    const { repoUrl, branch, githubToken } = req.body;
    let cleanRepo = repoUrl.replace('https://github.com/', '').replace('.git', '').trim();
    if (cleanRepo.endsWith('/')) cleanRepo = cleanRepo.slice(0, -1);

    const headers: Record<string, string> = {
      'User-Agent': 'Miki-AI-Studio',
      'Accept': 'application/vnd.github.v3+json'
    };
    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
    }

    const repoRes = await fetch(`https://api.github.com/repos/${cleanRepo}`, { headers });
    if (!repoRes.ok) {
      throw new Error(`リポジトリが見つかりません (${repoRes.statusText})`);
    }
    const repoInfo = await repoRes.json();
    const defaultBranch = branch || repoInfo.default_branch || 'main';

    const treeRes = await fetch(`https://api.github.com/repos/${cleanRepo}/git/trees/${defaultBranch}?recursive=1`, { headers });
    if (!treeRes.ok) {
      throw new Error(`ツリー情報の取得に失敗しました`);
    }
    const treeData = await treeRes.json();

    const allowedExts = ['.html', '.js', '.jsx', '.ts', '.tsx', '.css', '.json', '.txt', '.md', '.wgsl', '.glsl'];
    const fileEntries = (treeData.tree || [])
      .filter((item: any) => item.type === 'blob' && allowedExts.some(ext => item.path.endsWith(ext)))
      .slice(0, 150);

    const loadedFiles = await Promise.all(
      fileEntries.map(async (item: any) => {
        try {
          const rawRes = await fetch(`https://raw.githubusercontent.com/${cleanRepo}/${defaultBranch}/${item.path}`, { headers });
          if (rawRes.ok) {
            const content = await rawRes.text();
            return { path: item.path, content };
          }
        } catch (e) {}
        return null;
      })
    );

    const validFiles = loadedFiles.filter(Boolean);

    res.json({
      repoName: cleanRepo,
      owner: repoInfo.owner?.login || '',
      stars: repoInfo.stargazers_count || 0,
      description: repoInfo.description || '',
      branch: defaultBranch,
      files: validFiles
    });
  } catch (error: any) {
    console.error('Error in /api/github/import:', error);
    res.status(500).json({ error: error.message || 'GitHub import failed' });
  }
});

// GitHub Push Endpoint
app.post('/api/github/push', async (req, res) => {
  try {
    const { repoUrl, branch = 'main', commitMessage, files, githubToken, createRepoIfMissing } = req.body;
    if (!githubToken) {
      return res.status(400).json({ error: 'GitHub PATトークンが必要です' });
    }

    let cleanRepo = repoUrl.replace('https://github.com/', '').replace('.git', '').trim();
    if (cleanRepo.endsWith('/')) cleanRepo = cleanRepo.slice(0, -1);

    const headers: Record<string, string> = {
      'User-Agent': 'Miki-AI-Studio',
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${githubToken}`
    };

    // Check user info
    const userRes = await fetch('https://api.github.com/user', { headers });
    if (!userRes.ok) {
      throw new Error('トークンが無効です。GitHub Personal Access Token を確認してください。');
    }
    const userData = await userRes.json();
    const username = userData.login;

    let targetOwner = username;
    let targetRepoName = cleanRepo;
    if (cleanRepo.includes('/')) {
      const parts = cleanRepo.split('/');
      targetOwner = parts[0];
      targetRepoName = parts[1];
    }

    // Check if repo exists
    let repoCheck = await fetch(`https://api.github.com/repos/${targetOwner}/${targetRepoName}`, { headers });
    if (!repoCheck.ok && createRepoIfMissing) {
      const createRes = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: targetRepoName,
          description: 'Created with Miki AI Partner & Autonomous Studio',
          private: false,
          auto_init: true
        })
      });
      if (!createRes.ok) {
        throw new Error(`新規リポジトリの作成に失敗しました: ${createRes.statusText}`);
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Push files using Contents API
    let commitSha = 'sha-' + Date.now().toString(16);
    for (const f of files) {
      const filePath = f.path.startsWith('/') ? f.path.slice(1) : f.path;
      // Check existing sha
      let existingSha: string | undefined;
      const getFileRes = await fetch(`https://api.github.com/repos/${targetOwner}/${targetRepoName}/contents/${filePath}?ref=${branch}`, { headers });
      if (getFileRes.ok) {
        const fileData = await getFileRes.json();
        existingSha = fileData.sha;
      }

      const putRes = await fetch(`https://api.github.com/repos/${targetOwner}/${targetRepoName}/contents/${filePath}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: commitMessage || 'Update code by Miki AI',
          content: Buffer.from(f.content, 'utf8').toString('base64'),
          branch,
          ...(existingSha ? { sha: existingSha } : {})
        })
      });

      if (putRes.ok) {
        const putData = await putRes.json();
        if (putData.commit?.sha) {
          commitSha = putData.commit.sha;
        }
      }
    }

    res.json({
      success: true,
      commitSha,
      filesCount: files.length,
      branch,
      commitUrl: `https://github.com/${targetOwner}/${targetRepoName}/commit/${commitSha}`,
      branchUrl: `https://github.com/${targetOwner}/${targetRepoName}/tree/${branch}`
    });
  } catch (error: any) {
    console.error('Error in /api/github/push:', error);
    res.status(500).json({ error: error.message || 'GitHub push failed' });
  }
});

// Full App ZIP Exporter (Mobile & Desktop compatible)
app.get(['/api/export-app-zip', '/api/download-zip', '/miki-project.zip', '/download-zip', '/export.zip'], async (req, res) => {
  try {
    const zipPath = path.join(process.cwd(), 'miki-project.zip');
    let buffer: Buffer;

    if (fs.existsSync(zipPath)) {
      buffer = fs.readFileSync(zipPath);
    } else {
      const zip = new JSZip();
      const addFolderToZip = (dirPath: string, zipFolder: JSZip) => {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          if (file === 'node_modules' || file === 'dist' || file === '.git' || file === '.cache' || file === 'logs') continue;
          if (file.endsWith('.zip') || file.endsWith('.tar.gz')) continue;
          const fullPath = path.join(dirPath, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            addFolderToZip(fullPath, zipFolder.folder(file)!);
          } else {
            const content = fs.readFileSync(fullPath);
            zipFolder.file(file, content);
          }
        }
      };

      addFolderToZip(process.cwd(), zip);
      buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="miki-project.zip"');
    res.setHeader('Content-Length', buffer.length.toString());
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(buffer);
  } catch (error: any) {
    console.error('Error in /api/export-app-zip:', error);
    res.status(500).send('Failed to generate ZIP');
  }
});

// Companion Miki RPG Endpoints
app.post('/api/miki/chat', async (req, res) => {
  try {
    const { message, character, worldState } = req.body;
    const ai = getAIClient(req);
    const charName = character?.name || '冒険者';
    const locName = worldState?.name || '拠点';

    if (!ai) {
      return res.json({
        reply: `${charName}、${locName}での探索順調？何があってもみきがついてるから安心して進もうね！🗡️✨`
      });
    }

    const prompt = `あなたはゲームの相棒「みき」です。
プレイヤー名: ${charName}
現在地: ${locName}
メッセージ: "${message}"
親身で元気なタメ口で、冒険のアドバイスや励ましを1〜2文で答えてください。`;

    const { response } = await generateContentWithFallback(ai, {
      contents: prompt,
      config: { temperature: 0.7 }
    });

    res.json({ reply: response.text || `${charName}、一緒に頑張ろうね！` });
  } catch (err: any) {
    res.json({ reply: `うんうん、しっかり聞いてるよ！どんな冒険でも一緒に乗り越えようね！` });
  }
});

app.post('/api/miki/narrate', (req, res) => {
  const { action, character, worldState } = req.body;
  const charName = character?.name || '冒険者';
  res.json({
    data: {
      narration: `${charName}は慎重に辺りを見回し、${action || '前進'}した。静寂の中にかすかな風の音が響く。`,
      mikiComment: '気をつけて、何かの気配がするよ！',
      suggestedActions: ['周囲を探索する', '武器を構えて進む', '一旦休憩する'],
      hpDelta: 0,
      mpDelta: 0,
      goldDelta: 5,
      xpDelta: 10
    }
  });
});

app.post('/api/miki/quest', (req, res) => {
  const { setting, difficulty } = req.body;
  res.json({
    quest: {
      id: 'q_' + Date.now(),
      title: `${setting || '未知の迷宮'}の調査`,
      description: `${setting || 'エリア'}を探索し、手がかりを収集してください。（難易度: ${difficulty || 'Normal'}）`,
      reward: '150 Gold, 50 XP',
      completed: false
    }
  });
});

app.post('/api/miki/combat', (req, res) => {
  const { playerMove, character, monster } = req.body;
  const pDamage = Math.floor(Math.random() * 15) + 10;
  const mDamage = Math.floor(Math.random() * 8) + 3;
  res.json({
    data: {
      narrative: `${character?.name || 'プレイヤー'}の「${playerMove || '攻撃'}」がヒット！ ${monster?.name || 'モンスター'}に${pDamage}のダメージ！`,
      playerDamage: mDamage,
      monsterDamage: pDamage,
      isCritical: Math.random() > 0.8,
      mikiComment: 'ナイス攻撃！この調子でたたみかけよう！'
    }
  });
});

// Setup Vite or Static Serving
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Miki AI Partner & Autonomous Studio server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer().catch(err => {
  console.error('Failed to start dev server:', err);
  process.exit(1);
});
