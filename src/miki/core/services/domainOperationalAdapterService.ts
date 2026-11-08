import type { MikiDomain } from './crossDomainCirculationService';
import { autonomousContinuousEvolutionService } from '../../autonomy/services/autonomousContinuousEvolutionService';
import { capabilityGapService } from '../../capability/services/capabilityGapService';
import { conversationCompositionResearchSchedulerService } from '../../conversation/services/conversationCompositionResearchSchedulerService';
import { getManifestDefaultConfig, getManifestNativeEnv, getModelManifest } from '../../data/services/deterministicModelCatalog';
import { executionRunnerService } from '../../execution/services/executionRunnerService';
import { unifiedMikiExperienceService } from '../../experience/services/unifiedMikiExperienceService';
import { autonomousCurriculumService } from '../../learning/services/autonomousCurriculumService';
import { causalMemoryLedgerService } from '../../memory/services/causalMemoryLedgerService';
import { heuristicGraduationService } from '../../promotion/services/heuristicGraduationService';
import { unifiedWebResearchService } from '../../research/services/unifiedWebResearchService';
import { lexicalRelationService } from '../../memory/services/lexicalRelationService';
import { resourceGovernanceService } from '../../safety/services/resourceGovernanceService';
import { mikiCognitiveVitalsService } from '../../selfAwareness/services/mikiCognitiveVitalsService';
import { autonomousSearchService } from '../../research/services/autonomousSearchService';
import { runtimeLogReviewService } from '../../selfAwareness/services/runtimeLogReviewService';
import { codebaseReflectionService } from '../../selfDevelopment/services/codebaseReflectionService';
import { planOrchestratorService } from '../../strategy/services/planOrchestratorService';
import { unknownResolutionService } from '../../unknown/services/unknownResolutionService';
import { completionJudgeService } from '../../verification/services/completionJudgeService';
import { selfImprovementMetricsService } from '../../improvement/services/selfImprovementMetricsService';
import { improvementIntakeRouterService } from './improvementIntakeRouterService';
import { selfCodeSpaceService } from './selfCodeSpaceService';
import { selfCodeUnderstandingService } from './selfCodeUnderstandingService';
import { contentTermsFromTokens, japaneseAnalysisService } from '../../research/services/japaneseAnalysisService';
import { japaneseDictionaryService } from '../../research/services/japaneseDictionaryService';

export interface DomainOperationalSnapshot {
  domain: MikiDomain;
  serviceId: string;
  available: boolean;
  observedAt: number;
  data?: unknown;
  evidenceIds: string[];
  unresolvedRequirements: string[];
}

const snapshot = (domain:MikiDomain, serviceId:string, data:unknown):DomainOperationalSnapshot => ({
  domain,
  serviceId,
  available:true,
  observedAt:Date.now(),
  data,
  evidenceIds:[],
  unresolvedRequirements:[]
});

class DomainOperationalAdapterService {
  inspect(domain:MikiDomain,context:Record<string,unknown>={}):DomainOperationalSnapshot {
    try {
      switch(domain){
        case 'core':
          return snapshot(domain,'coreOrchestratorService',{authority:'CORE',responsibility:'route-collect-reevaluate-complete'});
        case 'autonomy':
          return snapshot(domain,'autonomousContinuousEvolutionService',{config:autonomousContinuousEvolutionService.getConfig(),historyCount:autonomousContinuousEvolutionService.getHistory().length});
        case 'capability':
          return snapshot(domain,'capabilityGapService',{gaps:capabilityGapService.getAllGaps(),profiles:capabilityGapService.getAllProfiles()});
        case 'conversation':
          return snapshot(domain,'conversationCompositionResearchSchedulerService',{config:conversationCompositionResearchSchedulerService.getConfig(),state:conversationCompositionResearchSchedulerService.getState()});
        case 'data':
          return snapshot(domain,'deterministicModelCatalog',{manifest:getModelManifest(),nativeEnvironment:getManifestNativeEnv(),defaultConfig:getManifestDefaultConfig()});
        case 'execution':
          return snapshot(domain,'executionRunnerService',{requests:executionRunnerService.listRequests()});
        case 'experience':
          return snapshot(domain,'unifiedMikiExperienceService',{state:unifiedMikiExperienceService.getState(),recent:unifiedMikiExperienceService.getRecent(20)});
        case 'improvement':
          return snapshot(domain,'selfImprovementOperationalReadModel',{weaknesses:selfImprovementMetricsService.rankWeaknesses(),runs:improvementIntakeRouterService.list(50)});
        case 'learning':
          return snapshot(domain,'autonomousCurriculumService',{boundaries:autonomousCurriculumService.getAllBoundaries(),curriculums:autonomousCurriculumService.getCurriculums(),skills:autonomousCurriculumService.getCompressedSkills()});
        case 'memory':
          return snapshot(domain,'causalMemoryLedgerService',{stats:causalMemoryLedgerService.stats(),records:causalMemoryLedgerService.list(50)});
        case 'promotion':
          return snapshot(domain,'heuristicGraduationService',{stats:heuristicGraduationService.getGraduationStats()});
        case 'research':
          // P488: 検索の自己診断（P485）と、自分のログの自己レビュー
          // （P488）も同じスナップショットに載せる。記録した結論を
          // 運用の読み手（自己モデル・画面）が実際に読めるように。
          return snapshot(domain,'autonomousSearchService',{config:unifiedWebResearchService.getConfig(),stats:unifiedWebResearchService.getStats(),recent:unifiedWebResearchService.getRecentRecords(20),selfDiagnosis:autonomousSearchService.getSearchSelfDiagnosis(),lastSelfReview:runtimeLogReviewService.latestReview(),lexicalRelations:lexicalRelationService.counts()});
        case 'safety':
          return snapshot(domain,'resourceGovernanceService',{resources:resourceGovernanceService.getSnapshot()});
        case 'selfAwareness':
          return snapshot(domain,'mikiCognitiveVitalsService',{vitals:mikiCognitiveVitalsService.getSnapshot()});
        case 'selfDevelopment': {
          const query=String(context.target||context.goal||context.goal||'').trim().toLowerCase();
          // P402: rank by what the goal is about, not by raw
          // substrings of the whole sentence. Terms are the split
          // tokens (file/service identifiers) plus the Japanese
          // content terms of the shared analysis — the same notion
          // of content the conversation stack uses (P383). A
          // Japanese sentence used to survive tokenization as one
          // unmatchable string, so every goal fell back to the
          // canonical core trio regardless of its subject.
          const splitTokens=query.split(/[\\s/._:-]+/).filter(x=>x.length>=2);
          let contentTerms:string[]=[];
          try{ contentTerms=contentTermsFromTokens(japaneseAnalysisService.analyze(query).tokens).map(term=>term.toLowerCase()); }catch{ contentTerms=[]; }
          // Short hiragana fragments (した, くだ…) are grammatical
          // residue when no dictionary enrichment is available, not
          // content; drop them so they cannot vote.
          const japaneseTerms=[...new Set([...splitTokens,...contentTerms])].filter(term=>!(/^[ぁ-ん]+$/.test(term)&&term.length<=2)).slice(0,12);
          // The code itself is named in English, which Japanese
          // terms can never match. Bridge each content term through
          // the dictionary MIKI already holds: its gloss words
          // (採用 -> adopt, 点検 -> inspection) can hit paths and
          // symbol names. Without an imported dictionary this
          // simply yields nothing and ranking stays Japanese-only.
          const bridgeTerms=new Set<string>();
          for(const term of contentTerms){
            if(bridgeTerms.size>=12)break;
            try{
              const gloss=japaneseDictionaryService.lookup(term)[0]?.gloss||'';
              for(const word of (gloss.toLowerCase().match(/[a-z][a-z-]{3,}/g)||[]).slice(0,5)){
                if(bridgeTerms.size<12)bridgeTerms.add(word.replace(/-/g,''));
              }
            }catch{ /* dictionary unavailable */ }
          }
          const terms=[...japaneseTerms,...bridgeTerms];
          // Improvement targets are source code; data files and
          // ledgers can mention every term without being editable
          // targets.
          const files=selfCodeSpaceService.listSourceFiles().filter(file=>/\.(?:ts|tsx|js|jsx)$/.test(file.path));
          const entriesByPath=new Map((selfCodeUnderstandingService.getSnapshot()?.entries||[]).map(entry=>[entry.path,entry]));
          // A short Latin term (ci, ai…) substring-matches unrelated
          // words everywhere; as content evidence it only counts at
          // a word boundary.
          const termMatchers=terms.map(term=>({term,contentPattern:/^[a-z0-9]+$/.test(term)&&term.length<=3?new RegExp(`\\b${term}\\b`):undefined}));
          const ranked=files.map(file=>{
            const entry=entriesByPath.get(file.path);
            const path=file.path.toLowerCase();
            const role=(entry?.role||'').toLowerCase();
            const symbolNames=(entry?.symbols||[]).map(symbol=>symbol.name.toLowerCase());
            const content=file.content.toLowerCase();
            let score=0;
            for(const {term,contentPattern} of termMatchers){
              if(path.includes(term))score+=5;
              if(role&&role.includes(term))score+=4;
              if(symbolNames.some(name=>name.includes(term)))score+=3;
              if(contentPattern?contentPattern.test(content):content.includes(term))score+=1;
            }
            return {file,score};
          }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.file.path.localeCompare(b.file.path)).slice(0,3).map(x=>x.file.path);
          const repositoryContextAssessment=String(context.requestedAssessment||'')==='REPOSITORY_CONTEXT';
          const canonicalCoreTargets=[
            'src/miki/core/services/coreOrchestratorService.ts',
            'src/miki/core/services/adaptiveRoutePlannerService.ts',
            'src/miki/core/services/domainRouterService.ts'
          ];
          const targetFiles=ranked.length>0?ranked:(repositoryContextAssessment?canonicalCoreTargets:[]);
          return snapshot(domain,'selfDevelopmentOperationalAdapter',{architecture:codebaseReflectionService.getArchitectureOverview(),modules:codebaseReflectionService.getAllModules(),targetFiles,query,requestedAssessment:context.requestedAssessment});
        }
        case 'strategy':
          return snapshot(domain,'planOrchestratorService',{runs:planOrchestratorService.listRuns()});
        case 'unknown':
          return snapshot(domain,'unknownResolutionService',{items:unknownResolutionService.list(100),persistence:unknownResolutionService.getPersistenceStatus()});
        case 'verification':
          return snapshot(domain,'completionJudgeService',{stats:completionJudgeService.getJudgeStats(),history:completionJudgeService.getHistory()});
      }
    } catch(error) {
      return {domain,serviceId:`${domain}.operational-adapter`,available:false,observedAt:Date.now(),evidenceIds:[],unresolvedRequirements:[`DOMAIN_OPERATIONAL_ADAPTER_ERROR:${String(error)}`]};
    }
  }
}

export const domainOperationalAdapterService = new DomainOperationalAdapterService();
