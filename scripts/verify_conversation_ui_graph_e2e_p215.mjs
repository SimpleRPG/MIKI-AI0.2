import assert from 'node:assert/strict';
import fs from 'node:fs';

class MemoryStorage {
  #m = new Map();
  get length(){ return this.#m.size; }
  clear(){ this.#m.clear(); }
  getItem(k){ return this.#m.has(String(k)) ? this.#m.get(String(k)) : null; }
  key(i){ return [...this.#m.keys()][i] ?? null; }
  removeItem(k){ this.#m.delete(String(k)); }
  setItem(k,v){ this.#m.set(String(k),String(v)); }
}
globalThis.localStorage = new MemoryStorage();

const { coreOrchestratorService } = await import('../src/miki/core/services/coreOrchestratorService.ts');
let e2eSequence = 0;
coreOrchestratorService.run = async (goal, source) => ({
  task:{taskId:`p215-ui-${++e2eSequence}`,goal,source,status:'COMPLETED',entries:[],createdAt:Date.now(),updatedAt:Date.now(),cycleCount:1,maxCycles:10},
  cycles:[], stoppedBy:'COMPLETED'
});
coreOrchestratorService.finalizeConversationResponse = taskId => ({
  task:{taskId,goal:'p215',source:'conversation',status:'COMPLETED',entries:[],createdAt:Date.now(),updatedAt:Date.now(),cycleCount:1,maxCycles:10},
  cycles:[], stoppedBy:'CONVERSATION_COMPLETED'
});
const { typedCoreUiGatewayService } = await import('../src/miki/core/ui/typedCoreUiGatewayService.ts');
const { conversationGraphRuntimeP212Service } = await import('../src/miki/conversation/services/conversationGraphRuntimeP212Service.ts');
const { conversationGraphCompletionP214Service } = await import('../src/miki/conversation/services/conversationGraphCompletionP214Service.ts');
const { conversationLanguageComponentGraphP213Service } = await import('../src/miki/conversation/services/conversationLanguageComponentGraphP213Service.ts');

conversationGraphRuntimeP212Service.reset();
const input = '全部実装して、既存機能は失わないようにして';
const submitted = await typedCoreUiGatewayService.submitConversation(input, false);
assert.ok(submitted?.task?.taskId, 'UI submission must create a Core task');
const taskId = submitted.task.taskId;
const afterInput = conversationGraphRuntimeP212Service.snapshot();
assert.ok(afterInput.nodes.length > 0, 'UI input must create graph nodes');
assert.ok(afterInput.nodes.some(n => JSON.stringify(n.payload).includes(input)), 'graph must retain the user input surface');
assert.ok(localStorage.getItem('miki:p214:conversation-graph'), 'input checkpoint must exist');

const goodResponse = '全部を省略せず実装し、既存機能を維持して失わないようにしました。';
const finalized = typedCoreUiGatewayService.finalizeConversationResponse(taskId, goodResponse);
assert.ok(finalized, 'UI response finalization must succeed');
const completed = conversationGraphRuntimeP212Service.snapshot();
assert.ok(completed.nodes.length > afterInput.nodes.length, 'output, validation, experience and learning nodes must be added');
const payloads = completed.nodes.map(n => JSON.stringify(n.payload));
assert.ok(payloads.some(p => p.includes('POSITIVE_EXAMPLE')), 'successful response must create a positive example');
assert.ok(payloads.some(p => p.includes(input)), 'learned surface must be the user input, not only the response');

const persistedRaw = localStorage.getItem('miki:p214:conversation-graph');
const persisted = JSON.parse(persistedRaw);
assert.equal(persisted.graphSha256, completed.graphSha256, 'checkpoint SHA must equal final graph SHA');

conversationGraphRuntimeP212Service.reset();
assert.equal(conversationGraphRuntimeP212Service.snapshot().nodes.length, 0, 'reset must simulate empty process memory');
const loaded = conversationGraphCompletionP214Service.load();
assert.ok(loaded, 'saved graph must load after restart simulation');
conversationGraphRuntimeP212Service.restore(loaded.graph);
const restored = conversationGraphRuntimeP212Service.snapshot();
assert.equal(restored.graphSha256, completed.graphSha256, 'restored graph SHA must equal pre-restart SHA');
assert.equal(restored.nodes.length, completed.nodes.length, 'restored node count must match');

const analysis = conversationLanguageComponentGraphP213Service.analyze(input, restored, {activeGoalIds:[],openGoalIds:[]});
assert.ok(analysis.reusedLearnedComponentIds.length > 0, 'next conversation must reuse a learned graph component');

const badTask = conversationGraphRuntimeP212Service.ingestInput('p215-bad-task', input);
assert.ok(badTask.turnId, 'bad-response scenario must ingest');
conversationGraphRuntimeP212Service.ingestOutput('p215-bad-task', '実装しました。', {passed:true});
const afterBad = conversationGraphRuntimeP212Service.snapshot();
assert.ok(afterBad.nodes.map(n=>JSON.stringify(n.payload)).some(p => p.includes('COUNTEREXAMPLE') && p.includes(input)), 'constraint omission must create counterexample tied to input');

const envelopeBackup = localStorage.getItem('miki:p214:conversation-graph');
const corrupt = JSON.parse(envelopeBackup);
corrupt.graphSha256 = '0'.repeat(64);
localStorage.setItem('miki:p214:conversation-graph', JSON.stringify(corrupt));
assert.equal(conversationGraphCompletionP214Service.load(), undefined, 'corrupt persisted SHA must fail closed');
localStorage.setItem('miki:p214:conversation-graph', envelopeBackup);

const report = {
  phase:'P215', status:'PASS', testLevel:'NODE_E2E_WITH_UI_GATEWAY_AND_BROWSER_STORAGE_POLYFILL',
  uiSubmission:true, coreIngress:true, inputGraphCommit:true, outputGraphCommit:true,
  validationExperienceLearning:true, positiveExample:true, constraintCounterexample:true,
  userInputSurfaceLearning:true, checkpoint:true, restartRestore:true,
  nextConversationLearnedReuse:true, corruptShaFailClosed:true,
  graphBeforeRestartSha256:completed.graphSha256,
  restoredGraphSha256:restored.graphSha256,
  nodesAfterInput:afterInput.nodes.length, nodesAfterCompletion:completed.nodes.length,
  learnedComponentsReused:analysis.reusedLearnedComponentIds.length,
  limitation:'Physical Galaxy S25 UI automation and OS process-kill were not available in this container.'
};
fs.writeFileSync('P215_CONVERSATION_UI_GRAPH_E2E_REPORT.json', JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
