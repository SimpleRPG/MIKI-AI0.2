import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  idleWorkQueueService,
  selectIdleWork,
  idleWorkTier,
  IDLE_WORK_LIMITS,
} from '../src/miki/execution/services/idleWorkQueueService.ts';

const results = [];
function check(name, fn) { fn(); results.push(name); }

function job(overrides = {}) {
  return {
    kind: 'HOMEWORK',
    topic: 'topic',
    origin: 'homework',
    priority: 0.5,
    suppressed: false,
    ...overrides,
  };
}

check('CRITICAL capability gap interrupts desire jobs', () => {
  const selected = selectIdleWork([
    job({ kind: 'RESEARCH_GAP', topic: 'desire-term', origin: 'desire', priority: 1.0 }),
    job({ kind: 'CAPABILITY_GAP', topic: 'cap_x', origin: 'capability_gap', priority: 1.0, impact: 'CRITICAL' }),
    job({ kind: 'RESEARCH_GAP', topic: 'desire-term-2', origin: 'desire', priority: 0.9 }),
  ]);
  assert.equal(selected[0].kind, 'CAPABILITY_GAP');
  assert.equal(selected[0].topic, 'cap_x');
});

check('desire first, then homework, then non-critical gap, then distill/reflect/drill', () => {
  const selected = selectIdleWork([
    job({ kind: 'DRILL', topic: 'drill', origin: 'weakness', priority: 0.2 }),
    job({ kind: 'CAPABILITY_GAP', topic: 'cap_y', origin: 'capability_gap', priority: 1.0, impact: 'HIGH' }),
    job({ kind: 'DISTILL', topic: 'distill', origin: 'episode', priority: 0.2 }),
    job({ kind: 'HOMEWORK', topic: 'hw', origin: 'homework', priority: 0.5 }),
    job({ kind: 'REFLECT', topic: 'reflect', origin: 'prediction_error', priority: 0.9 }),
    job({ kind: 'RESEARCH_GAP', topic: 'desire-term', origin: 'desire', priority: 0.3 }),
  ]);
  // 同じ段の中では優先度順。REFLECT 0.9 が先で、DISTILL と DRILL は
  // 同じ 0.2 のため入力順（DRILL が先）を保つ。
  assert.deepEqual(
    selected.map((j) => j.kind),
    ['RESEARCH_GAP', 'HOMEWORK', 'CAPABILITY_GAP', 'REFLECT', 'DRILL', 'DISTILL'],
  );
});

check('per-kind caps are enforced (homework 2, gaps 3, research 2)', () => {
  assert.equal(IDLE_WORK_LIMITS.HOMEWORK, 2);
  assert.equal(IDLE_WORK_LIMITS.CAPABILITY_GAP, 3);
  assert.equal(IDLE_WORK_LIMITS.RESEARCH_GAP, 2);
  assert.equal(IDLE_WORK_LIMITS.DISTILL, 1);
  const selected = selectIdleWork([
    job({ kind: 'HOMEWORK', topic: 'hw1' }),
    job({ kind: 'HOMEWORK', topic: 'hw2' }),
    job({ kind: 'HOMEWORK', topic: 'hw3' }),
    job({ kind: 'HOMEWORK', topic: 'hw4' }),
  ]);
  assert.deepEqual(selected.map((j) => j.topic), ['hw1', 'hw2']);
});

check('suppressed jobs are excluded before selection', () => {
  const selected = selectIdleWork([
    job({ kind: 'RESEARCH_GAP', topic: 'suppressed-term', origin: 'desire', priority: 1.0, suppressed: true }),
    job({ kind: 'HOMEWORK', topic: 'hw', origin: 'homework', priority: 0.1 }),
  ]);
  assert.deepEqual(selected.map((j) => j.topic), ['hw']);
});

check('ties keep collection order (stable sort)', () => {
  const selected = selectIdleWork([
    job({ kind: 'HOMEWORK', topic: 'hw-a', priority: 0.5 }),
    job({ kind: 'HOMEWORK', topic: 'hw-b', priority: 0.5 }),
  ]);
  assert.deepEqual(selected.map((j) => j.topic), ['hw-a', 'hw-b']);
});

check('tier order is critical-gap, desire, homework, gap, evolution', () => {
  assert.ok(idleWorkTier(job({ kind: 'CAPABILITY_GAP', impact: 'CRITICAL' })) < idleWorkTier(job({ kind: 'RESEARCH_GAP', origin: 'desire' })));
  assert.ok(idleWorkTier(job({ kind: 'RESEARCH_GAP', origin: 'desire' })) < idleWorkTier(job({ kind: 'HOMEWORK' })));
  assert.ok(idleWorkTier(job({ kind: 'HOMEWORK' })) < idleWorkTier(job({ kind: 'CAPABILITY_GAP', impact: 'HIGH' })));
  assert.ok(idleWorkTier(job({ kind: 'CAPABILITY_GAP', impact: 'HIGH' })) < idleWorkTier(job({ kind: 'DRILL' })));
});

check('buildIdleWorkQueue works on empty storage and always offers distill/drill', () => {
  const queue = idleWorkQueueService.buildIdleWorkQueue('test-persona');
  assert.deepEqual(queue.map((j) => j.kind), ['DISTILL', 'DRILL']);
  const selected = selectIdleWork(queue);
  assert.deepEqual(selected.map((j) => j.kind), ['DISTILL', 'DRILL']);
});

check('background worker drives deep sleep from the queue', () => {
  const bg = fs.readFileSync('src/miki/execution/services/backgroundWorkerService.ts', 'utf8');
  assert.match(bg, /idleWorkQueueService\.buildIdleWorkQueue/);
  assert.match(bg, /selectedWork = selectIdleWork\(queuedWork\)/);
  assert.match(bg, /performIdleAutonomousLearning\(\{ jobs: searchJobs, signal: abortSignal \}\)/);
  assert.match(bg, /runIdleEvolutionSubsystems\(evolutionKinds, abortSignal\)/);
  assert.doesNotMatch(bg, /runIdleEvolutionCycle\(abortSignal\)/);
});

check('queued learning path reuses search body and suppression', () => {
  const search = fs.readFileSync('src/miki/research/services/autonomousSearchService.ts', 'utf8');
  assert.match(search, /performQueuedIdleLearning/);
  assert.match(search, /if \(options\?\.jobs\) \{\s*return this\.performQueuedIdleLearning/);
  assert.match(search, /isSuppressedForIdleResearch/);
  assert.match(search, /'research_gap'/);
});

check('evolution cycle exposes a selective entry point and keeps the full cycle', () => {
  const evo = fs.readFileSync('src/miki/autonomy/services/autonomousEvolutionService.ts', 'utf8');
  assert.match(evo, /public async runIdleEvolutionSubsystems/);
  assert.match(evo, /public async runIdleEvolutionCycle/);
});

check('startup phase scheduler is deleted (decision #7) with no remaining references in src', () => {
  assert.equal(fs.existsSync('src/app/startupPhaseSchedulerService.ts'), false);
  const hits = [];
  for (const file of ['src/miki/execution/services/backgroundWorkerService.ts', 'src/App.tsx']) {
    if (fs.readFileSync(file, 'utf8').includes('startupPhaseSchedulerService')) hits.push(file);
  }
  assert.deepEqual(hits, []);
});

console.log(JSON.stringify({ passed: true, bundle: 'P3001', checks: results }, null, 2));
