import { knowledgeOperatingSystemService } from '../src/services/knowledgeOperatingSystemService';
import { counterfactualWorkSimulatorService } from '../src/services/counterfactualWorkSimulatorService';
import { personalApiGatewayService } from '../src/services/personalApiGatewayService';

const source=knowledgeOperatingSystemService.register({type:'SOURCE',title:'test source',content:'source',sourceIds:[],evidenceIds:[],dependsOn:[],replaces:[],conditions:[],confidence:1,freshness:1,metadata:{test:true}});
const evidence=knowledgeOperatingSystemService.register({type:'EVIDENCE',title:'test evidence',content:'execution evidence',sourceIds:[source.id],evidenceIds:[],dependsOn:[],replaces:[],conditions:[],confidence:.9,freshness:1,metadata:{test:true}});
const claim=knowledgeOperatingSystemService.register({type:'CLAIM',title:'test claim',content:'claim',sourceIds:[source.id],evidenceIds:[evidence.id],dependsOn:[],replaces:[],conditions:['test'],confidence:.8,freshness:1,metadata:{test:true}});
if(!knowledgeOperatingSystemService.provenanceAudit(claim.id).valid) throw new Error('KOS provenance audit failed');
const cf=counterfactualWorkSimulatorService.simulate('test-task',{id:'a',label:'selected',steps:['a'],estimatedCost:100,risk:.5},[{id:'b',label:'alternative',steps:['b'],estimatedCost:80,risk:.3}], 'FAILURE');
if(!cf || cf.status!=='VIRTUAL_ONLY') throw new Error('counterfactual contract failed');
const blocked=personalApiGatewayService.receive({kind:'REST',payload:'hello'});
if(blocked.accepted) throw new Error('REST auth boundary failed');
const nl=personalApiGatewayService.receive({kind:'NATURAL_LANGUAGE',payload:'こんにちは'});
if(!nl.accepted) throw new Error('natural language gateway failed');
console.log('PASS chapter 62/63/67 deterministic contracts');
