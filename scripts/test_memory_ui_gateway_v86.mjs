import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const modalPath = path.join(root, 'src/components/MemoryModal.tsx');
const gatewayPath = path.join(root, 'src/miki/core/ui/typedMemoryUiGatewayService.ts');
const modal = fs.readFileSync(modalPath, 'utf8');
const gateway = fs.readFileSync(gatewayPath, 'utf8');
const requiredMethods = [
  'getMemories', 'setMemories', 'saveMemoryItem', 'deleteMemoryItem',
  'batchDeleteMemories', 'getApprovedMemories', 'getUnapprovedMemories',
  'getConflictedMemories', 'getQuarantinedMemories', 'getDiscardCandidateMemories',
  'applyRoutingToMemory', 'exportToRegressionBenchmark', 'exportToSkill',
  'markForDiscard', 'promoteFromQuarantine', 'unmarkDiscard',
  'getSubstitutionChain', 'searchPipeline', 'supersedeMemory',
  'getEmbeddingStats', 'ensureMemoryEmbedding', 'syncMemoryEmbeddings',
  'runMemoryAudit', 'getTrainingSamples'
];
const checks = [
  ['MemoryModal uses typed gateway', modal.includes('typedMemoryUiGatewayService')],
  ['Storage direct import removed', !modal.includes("from '../services/storageService'")],
  ['Experience direct import removed', !modal.includes('experienceRouterService\'') && !modal.includes('experienceRouterService"')],
  ['Long-term memory direct import removed', !modal.includes('longTermMemoryService\'') && !modal.includes('longTermMemoryService"')],
  ['Embedding direct import removed', !modal.includes("from '../miki/research/services/embeddingService'")],
  ['Audit direct import removed', !modal.includes('memoryAuditService\'') && !modal.includes('memoryAuditService"')],
  ['Improvement direct import removed', !modal.includes('selfImprovementService\'') && !modal.includes('selfImprovementService"')],
  ['Gateway exposes all required methods', requiredMethods.every((name) => gateway.includes(`${name}(`))],
  ['GitHub Actions preserved', fs.existsSync(path.join(root, '.github/workflows/build-apk.yml'))],
  ['Gradle wrapper preserved', fs.existsSync(path.join(root, 'android/gradle/wrapper/gradle-wrapper.jar'))]
];
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed += 1;
}
if (failed) process.exit(1);
