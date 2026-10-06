import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const timeoutSeconds = Math.max(60, Number(process.env.BUILD_TIMEOUT_SECONDS || process.argv[2] || 600));
const sampleIntervalMs = Math.max(500, Number(process.env.BUILD_SAMPLE_INTERVAL_MS || 2000));
const maxOldSpaceMb = Math.max(1024, Number(process.env.BUILD_MAX_OLD_SPACE_MB || 4096));
const reportPath = process.env.BUILD_DIAGNOSTICS_REPORT || 'BUILD_DIAGNOSTICS_REPORT.json';
const stages = [
  { name: 'prepare-self-code-seed', command: ['node', 'scripts/prepare_self_code_seed.mjs'] },
  { name: 'vite-build', command: ['node', `--max-old-space-size=${maxOldSpaceMb}`, 'node_modules/vite/bin/vite.js', 'build'] },
  { name: 'server-build', command: ['node', 'build-server.mjs'] }
];

function nowIso() { return new Date().toISOString(); }
function readProc(pid) {
  try {
    const status = readFileSync(`/proc/${pid}/status`, 'utf8');
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8').trim().split(' ');
    const value = (key) => Number(status.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'))?.[1] || 0);
    return { at: Date.now(), rssKb: value('VmRSS'), peakRssKb: value('VmHWM'), threads: value('Threads'), userTicks: Number(stat[13] || 0), systemTicks: Number(stat[14] || 0) };
  } catch { return undefined; }
}
function directoryStats(root) {
  if (!existsSync(root)) return { exists: false, files: 0, bytes: 0, largest: [] };
  const files = [];
  const walk = (dir) => { for (const entry of readdirSync(dir, { withFileTypes: true })) { const path = join(dir, entry.name); if (entry.isDirectory()) walk(path); else { const size = statSync(path).size; files.push({ path, size }); } } };
  walk(root);
  files.sort((a, b) => b.size - a.size);
  return { exists: true, files: files.length, bytes: files.reduce((sum, item) => sum + item.size, 0), largest: files.slice(0, 20) };
}
async function runStage(stage) {
  const startedAt = Date.now(); const stdout = []; const stderr = []; const samples = [];
  const child = spawn(stage.command[0], stage.command.slice(1), { cwd: process.cwd(), env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --max-old-space-size=${maxOldSpaceMb}`.trim() }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { const text = chunk.toString(); process.stdout.write(text); stdout.push(text); });
  child.stderr.on('data', chunk => { const text = chunk.toString(); process.stderr.write(text); stderr.push(text); });
  const sampler = setInterval(() => { const sample = readProc(child.pid); if (sample) samples.push(sample); }, sampleIntervalMs);
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); setTimeout(() => child.kill('SIGKILL'), 5000).unref(); }, timeoutSeconds * 1000);
  const exitCode = await new Promise(resolve => child.on('exit', code => resolve(code ?? 1)));
  clearInterval(sampler); clearTimeout(timer);
  const endedAt = Date.now();
  return { name: stage.name, command: stage.command.join(' '), startedAt: new Date(startedAt).toISOString(), endedAt: new Date(endedAt).toISOString(), durationMs: endedAt - startedAt, exitCode, timedOut, sampleCount: samples.length, peakRssKb: Math.max(0, ...samples.map(x => x.peakRssKb || x.rssKb)), lastSample: samples.at(-1), stdoutTail: stdout.join('').split('\n').slice(-80), stderrTail: stderr.join('').split('\n').slice(-80) };
}

const startedAt = Date.now(); const results = [];
for (const stage of stages) { const result = await runStage(stage); results.push(result); if (result.exitCode !== 0 || result.timedOut) break; }
const dist = directoryStats('dist');
const report = { schemaVersion: 1, startedAt: new Date(startedAt).toISOString(), endedAt: nowIso(), durationMs: Date.now() - startedAt, timeoutSeconds, sampleIntervalMs, maxOldSpaceMb, passed: results.length === stages.length && results.every(x => x.exitCode === 0 && !x.timedOut), timeoutStage: results.find(x => x.timedOut)?.name, failedStage: results.find(x => x.exitCode !== 0)?.name, stages: results, dist, environment: { node: process.version, platform: process.platform, arch: process.arch }, reportSha256: '' };
const canonical = JSON.stringify({ ...report, reportSha256: '' });
report.reportSha256 = createHash('sha256').update(canonical).digest('hex');
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(`\n[build-diagnostics] ${report.passed ? 'PASS' : 'FAIL'} report=${reportPath} durationMs=${report.durationMs}`);
if (!report.passed) process.exitCode = 1;
