import { capabilityImplementationRegistryService } from '../src/services/capabilityImplementationRegistryService';
import { implementationSelectionService } from '../src/services/implementationSelectionService';
import { requestTypeCompilerService } from '../src/services/requestTypeCompilerService';
import { hybridConversationEngineService } from '../src/services/hybridConversationEngineService';

function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }

const request = requestTypeCompilerService.compile('VBAで重複行を削除するマクロを作って');
const selected = implementationSelectionService.select(request);
assert(selected.mode !== 'LOCAL_LLM', '既知のコード要求をLLM単独へ送ってはいけない');
assert(capabilityImplementationRegistryService.list().some(r => r.mode === 'NO_LLM'), 'NO_LLM capability implementation missing');

const state: any = { stage: 'GENERAL', currentTopic: '', recentEntities: [], topLevelGoal: '', updatedAt: 0 };
const interpretation = hybridConversationEngineService.interpret('ありがとう', state);
assert(interpretation.deterministic === true, '既知の短い会話を未知扱いしてはいけない');
assert(interpretation.llmFallbackNeeded === false, '既知の会話でLLM fallbackを必須にしてはいけない');

console.log('PASS: v48 non-LLM architecture contracts');
