import { persistentPersonalityService, integratedCognitionControllerService, failureToleranceKernelService, autonomousQaService, semanticCacheService, softwareFactoryService, dataFactoryService, digitalTwinService } from '../src/services/chapter69_90PlatformServices';

persistentPersonalityService.initialize();
const a=persistentPersonalityService.upsert('top_level_purpose','safe self-improvement','test');
if(!a || !persistentPersonalityService.validate().valid) throw new Error('chapter69 anchor contract failed');
const d=integratedCognitionControllerService.decide({importance:.9,uncertainty:.8,irreversible:true,needsFresh:true});
if(d.budget.retries<1 || !d.route.includes('WEB_RESEARCH')) throw new Error('chapter71 budget contract failed');
if(failureToleranceKernelService.classify(new Error('permission denied'))!=='PERMISSION_DENIED') throw new Error('chapter73 classification failed');
if(autonomousQaService.inspect({requirement:'r',claim:'c'}).completionAllowed) throw new Error('chapter76 evidence gate failed');
const sf=softwareFactoryService.start('build feature'); if(sf.stages.length<8) throw new Error('chapter80 pipeline incomplete');
if(!dataFactoryService.plan('CSV').preserveOriginal) throw new Error('chapter81 preservation failed');
const t=digitalTwinService.capture({fidelity:'APPROXIMATE',model:'local'}); if(!t.id) throw new Error('chapter82 twin failed');
const c=semanticCacheService.put({premises:['p'],rule:'r',branches:['b'],conclusion:'c',conditions:['x'],exclusions:['y'],evidenceIds:['e'],environmentHash:'env1',ttlMs:1000});
if(!semanticCacheService.get(c.id,'env2')) { /* expected invalidation */ } else throw new Error('chapter88 environment isolation failed');
console.log('CHAPTER_69_90_CONTRACT_PASS');
