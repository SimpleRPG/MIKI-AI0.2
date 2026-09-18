/**
 * MIKI-AI autonomous runner for Termux.
 *
 * Purpose:
 * - Run the existing SelfImprovementControllerService repeatedly.
 * - Accept a work-directive file without changing the web UI.
 * - Support bounded durations (e.g. 1h, 30m) or forever.
 * - Discover service capabilities that are not yet represented by the
 *   known strategy vocabulary and persist a machine-readable inventory.
 *
 * Safety:
 * - This runner does not execute arbitrary shell commands from the directive.
 * - It delegates actual improvement decisions to the existing canonical
 *   self-improvement controller and its evidence/lock gates.
 * - Ctrl+C stops the runner cleanly.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { selfImprovementControllerService } from '../src/miki/improvement/services/selfImprovementControllerService';
import { workDirectiveIngestionService } from '../src/miki/execution/services/workDirectiveIngestionService';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const DEFAULT_INTERVAL_MS = 15_000;
const CAPABILITY_FILE = path.join(ROOT, 'runtime', 'miki_discovered_capabilities.json');

interface Options {
  durationMs: number | null;
  intervalMs: number;
  instructionFile?: string;
  title?: string;
  dryRun: boolean;
}

interface DiscoveredCapability {
  id: string;
  sourceFile: string;
  symbol: string;
  methods: string[];
  category: string;
  knownStrategy: boolean;
  discoveredAt: string;
}

function usage(): never {
  console.log(`\nMIKI autonomous runner\n\nUsage:\n  npx tsx scripts/miki-autonomous-runner.ts --duration 1h --instruction docs/work-directive.md\n  npx tsx scripts/miki-autonomous-runner.ts --duration 30m\n  npx tsx scripts/miki-autonomous-runner.ts --duration forever --instruction docs/work-directive.md\n\nOptions:\n  --duration <10m|1h|90s|forever>  Stop after the given time. Default: 1h\n  --interval <5s|30s>              Delay between cycles. Default: 15s\n  --instruction <file>              Work-directive text/markdown file\n  --title <title>                   Override directive title\n  --dry-run                         Discover/parse only; do not execute a cycle\n`);
  process.exit(2);
}

function parseDuration(value: string): number | null {
  if (value.toLowerCase() === 'forever') return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)(s|m|h|d)$/i);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  const factor = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return Math.max(1000, Math.round(n * factor));
}

function parseArgs(argv: string[]): Options {
  let durationMs: number | null = 3_600_000;
  let intervalMs = DEFAULT_INTERVAL_MS;
  let instructionFile: string | undefined;
  let title: string | undefined;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--duration') {
      durationMs = parseDuration(argv[++i] ?? '');
    } else if (arg === '--interval') {
      intervalMs = parseDuration(argv[++i] ?? '');
      if (intervalMs === null) throw new Error('--interval cannot be forever');
    } else if (arg === '--instruction') {
      instructionFile = argv[++i];
    } else if (arg === '--title') {
      title = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      usage();
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return { durationMs, intervalMs, instructionFile, title, dryRun };
}

function classify(file: string): string {
  const n = file.toLowerCase();
  if (/research|search|web/.test(n)) return 'research';
  if (/test|regression|benchmark|verify/.test(n)) return 'verification';
  if (/memory|knowledge|learning|promotion/.test(n)) return 'learning';
  if (/autonomous|evolution|improvement|remediation/.test(n)) return 'self_improvement';
  if (/capability|skill|tool|execution|runner/.test(n)) return 'capability';
  if (/security|guard|safety|invariant/.test(n)) return 'safety';
  return 'other';
}

async function discoverCapabilities(): Promise<DiscoveredCapability[]> {
  const servicesDir = path.join(ROOT, 'src', 'services');
  const entries = await fs.readdir(servicesDir, { withFileTypes: true });
  const knownTerms = [
    'autonomous', 'improvement', 'research', 'memory', 'regression', 'benchmark',
    'directive', 'skill', 'capability', 'execution', 'healing', 'evolution',
  ];
  const result: DiscoveredCapability[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
    const rel = path.posix.join('src/services', entry.name);
    const full = path.join(servicesDir, entry.name);
    const text = await fs.readFile(full, 'utf8');
    const symbols = new Set<string>();
    for (const m of text.matchAll(/export\s+(?:default\s+)?class\s+([A-Za-z0-9_]+)/g)) symbols.add(m[1]);
    for (const m of text.matchAll(/export\s+const\s+([A-Za-z0-9_]+)\s*=/g)) symbols.add(m[1]);
    if (symbols.size === 0) continue;

    const methods = [...text.matchAll(/(?:public\s+)?(?:async\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)]
      .map((m) => m[1])
      .filter((m) => !['if', 'for', 'while', 'switch', 'catch'].includes(m));
    const uniqueMethods = [...new Set(methods)].slice(0, 80);
    const lower = `${entry.name} ${uniqueMethods.join(' ')}`.toLowerCase();
    const knownStrategy = knownTerms.some((term) => lower.includes(term));

    for (const symbol of symbols) {
      result.push({
        id: `cap:${entry.name}:${symbol}`,
        sourceFile: rel,
        symbol,
        methods: uniqueMethods,
        category: classify(entry.name),
        knownStrategy,
        discoveredAt: new Date().toISOString(),
      });
    }
  }
  return result;
}

async function saveCapabilityInventory(items: DiscoveredCapability[]): Promise<void> {
  await fs.mkdir(path.dirname(CAPABILITY_FILE), { recursive: true });
  const unknown = items.filter((x) => !x.knownStrategy);
  await fs.writeFile(
    CAPABILITY_FILE,
    JSON.stringify({ generatedAt: new Date().toISOString(), total: items.length, unknownCount: unknown.length, capabilities: items }, null, 2),
    'utf8'
  );
  console.log(`[CAPABILITY] discovered=${items.length} unknown-strategy=${unknown.length}`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const capabilities = await discoverCapabilities();
  await saveCapabilityInventory(capabilities);

  if (options.instructionFile) {
    const file = path.resolve(process.cwd(), options.instructionFile);
    const raw = await fs.readFile(file, 'utf8');
    const directive = workDirectiveIngestionService.ingestDirectiveText(raw, options.title);
    console.log(`[DIRECTIVE] ${directive.directiveId} ${directive.title}`);
    console.log(`[DIRECTIVE] requirements=${directive.requirements.length} targets=${directive.targets.length}`);
  }

  selfImprovementControllerService.initialize();
  const started = Date.now();
  let cycles = 0;
  let stopping = false;
  const stop = () => { stopping = true; };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  console.log(`[RUNNER] duration=${options.durationMs === null ? 'forever' : `${Math.round(options.durationMs / 1000)}s`} interval=${Math.round(options.intervalMs / 1000)}s dryRun=${options.dryRun}`);

  try {
    while (!stopping && (options.durationMs === null || Date.now() - started < options.durationMs)) {
      const decision = selfImprovementControllerService.decide();
      console.log(`[DECIDE] ${decision.action}: ${decision.reason}`);
      if (!options.dryRun) {
        const result = await selfImprovementControllerService.runOnce('termux-autonomous-runner');
        cycles++;
        console.log(`[CYCLE ${cycles}] ${result.decision.action} -> ${result.result ?? 'no-result'}${result.verdict ? ` verdict=${result.verdict}` : ''}`);
      }
      if (stopping) break;
      const remaining = options.durationMs === null ? options.intervalMs : Math.min(options.intervalMs, Math.max(0, options.durationMs - (Date.now() - started)));
      if (remaining <= 0) break;
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  } finally {
    selfImprovementControllerService.dispose();
    console.log(`[RUNNER] stopped. cycles=${cycles} elapsed=${Math.round((Date.now() - started) / 1000)}s`);
  }
}

main().catch((error) => {
  console.error(`[RUNNER] fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
