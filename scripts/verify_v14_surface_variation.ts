/**
 * 設計思想 19.2節「同じ定型文の反復を抑える」
 * 作業指示書 v14 検証スクリプト
 * 
 * 検証内容:
 * 1. 各部品のバリエーション数が 30種類以上 存在すること
 * 2. 直近重複抑制キャッシュが機能し、連続取得時に同一変種が連続しないこと
 * 3. 生成された全バリエーションに対して意味保持・確信度過多・文法破綻の検証
 * 4. 表層サービスおよび回答骨格テンプレートとの統合検証
 */

import {
  SCENE_CONNECTORS_DATA,
  PRUDENCE_NOTES_DATA,
  PROACTIVE_SUGGESTIONS_DATA,
  WARMTH_AND_HUMOR_DATA,
  SECTION_HEADINGS_DEFAULT_DATA,
} from '../src/services/surfaceVariationData';
import { SKELETON_VARIATIONS_DATA } from '../src/services/skeletonVariationData';
import {
  surfaceVariationService,
  RecentUsageCache,
} from '../src/services/surfaceVariationService';
import { surfaceGrammarAndStyleService } from '../src/services/surfaceGrammarAndStyleService';
import { answerPlanService } from '../src/services/answerPlanService';

async function runVerification() {
  console.log('=== [v14 Verification] 設計思想 19.2節 表層部品バリエーション検証 ===\n');
  let passCount = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      process.exitCode = 1;
    }
  }

  // =========================================================================
  // 1. 部品数・バリエーション数チェック (各30種以上)
  // =========================================================================
  console.log('--- 1. バリエーション数チェック (各30種類以上) ---');

  // 1.1 getSceneConnector (7分岐)
  const connectorKeys = [
    'DISASTER_RECOVERY',
    'ERROR_REPORT',
    'TECHNICAL_RESEARCH',
    'CODE_DELIVERY',
    'HIGH_DIRECTNESS',
    'LOW_DIRECTNESS',
    'DEFAULT',
  ];
  for (const key of connectorKeys) {
    const items = SCENE_CONNECTORS_DATA[key];
    assert(items && items.length >= 30, `SCENE_CONNECTORS [${key}] has >= 30 variations (actual: ${items?.length})`);
  }

  // 1.2 applyPrudenceNote (2分岐)
  assert(PRUDENCE_NOTES_DATA.VERY_HIGH.length >= 30, `PRUDENCE_NOTES [VERY_HIGH] has >= 30 variations (actual: ${PRUDENCE_NOTES_DATA.VERY_HIGH.length})`);
  assert(PRUDENCE_NOTES_DATA.HIGH.length >= 30, `PRUDENCE_NOTES [HIGH] has >= 30 variations (actual: ${PRUDENCE_NOTES_DATA.HIGH.length})`);

  // 1.3 applyProactiveSuggestion (2分岐)
  assert(PROACTIVE_SUGGESTIONS_DATA.ACTIVE.length >= 30, `PROACTIVE_SUGGESTIONS [ACTIVE] has >= 30 variations (actual: ${PROACTIVE_SUGGESTIONS_DATA.ACTIVE.length})`);
  assert(PROACTIVE_SUGGESTIONS_DATA.MODERATE.length >= 30, `PROACTIVE_SUGGESTIONS [MODERATE] has >= 30 variations (actual: ${PROACTIVE_SUGGESTIONS_DATA.MODERATE.length})`);

  // 1.4 applyWarmthAndHumor (4分岐)
  assert(WARMTH_AND_HUMOR_DATA.HUMOR_MODERATE.length >= 30, `WARMTH_AND_HUMOR [HUMOR_MODERATE] has >= 30 variations (actual: ${WARMTH_AND_HUMOR_DATA.HUMOR_MODERATE.length})`);
  assert(WARMTH_AND_HUMOR_DATA.HUMOR_LIGHT.length >= 30, `WARMTH_AND_HUMOR [HUMOR_LIGHT] has >= 30 variations (actual: ${WARMTH_AND_HUMOR_DATA.HUMOR_LIGHT.length})`);
  assert(WARMTH_AND_HUMOR_DATA.WARMTH_HIGH_CASUAL.length >= 30, `WARMTH_AND_HUMOR [WARMTH_HIGH_CASUAL] has >= 30 variations (actual: ${WARMTH_AND_HUMOR_DATA.WARMTH_HIGH_CASUAL.length})`);
  assert(WARMTH_AND_HUMOR_DATA.WARMTH_HIGH_POLITE.length >= 30, `WARMTH_AND_HUMOR [WARMTH_HIGH_POLITE] has >= 30 variations (actual: ${WARMTH_AND_HUMOR_DATA.WARMTH_HIGH_POLITE.length})`);

  // 1.5 getSectionHeadings デフォルト (5キー)
  assert(SECTION_HEADINGS_DEFAULT_DATA.conclusion.length >= 30, `SECTION_HEADINGS [conclusion] has >= 30 variations (actual: ${SECTION_HEADINGS_DEFAULT_DATA.conclusion.length})`);
  assert(SECTION_HEADINGS_DEFAULT_DATA.reasons.length >= 30, `SECTION_HEADINGS [reasons] has >= 30 variations (actual: ${SECTION_HEADINGS_DEFAULT_DATA.reasons.length})`);
  assert(SECTION_HEADINGS_DEFAULT_DATA.conditions.length >= 30, `SECTION_HEADINGS [conditions] has >= 30 variations (actual: ${SECTION_HEADINGS_DEFAULT_DATA.conditions.length})`);
  assert(SECTION_HEADINGS_DEFAULT_DATA.exceptions.length >= 30, `SECTION_HEADINGS [exceptions] has >= 30 variations (actual: ${SECTION_HEADINGS_DEFAULT_DATA.exceptions.length})`);
  assert(SECTION_HEADINGS_DEFAULT_DATA.nextActions.length >= 30, `SECTION_HEADINGS [nextActions] has >= 30 variations (actual: ${SECTION_HEADINGS_DEFAULT_DATA.nextActions.length})`);

  // 1.6 INITIAL_SKELETONS (7パターン)
  const skeletonPatterns = [
    'PATTERN-CORRECTION-01',
    'PATTERN-LOGICAL-PRIORITY-01',
    'PATTERN-CONTRADICTION-01',
    'PATTERN-DIRECT-SHORT-01',
    'PATTERN-CLARIFICATION-01',
    'PATTERN-COMPARISON-01',
    'PATTERN-TOPIC-RESUME-01',
  ];
  for (const patternId of skeletonPatterns) {
    const items = SKELETON_VARIATIONS_DATA[patternId];
    assert(items && items.length >= 30, `SKELETON_VARIATIONS [${patternId}] has >= 30 variations (actual: ${items?.length})`);
  }

  // =========================================================================
  // 2. 連続呼び出しと直近重複抑制テスト
  // =========================================================================
  console.log('\n--- 2. 連続呼び出しと非重複選択テスト ---');
  const cache = RecentUsageCache.getInstance();
  cache.clearHistory();

  // 2.1 接続詞の10回連続取得テスト
  const connectorSamples: string[] = [];
  for (let i = 0; i < 10; i++) {
    const c = surfaceVariationService.getConnector('TECHNICAL_RESEARCH', 'HIGH');
    connectorSamples.push(c.id);
  }
  const uniqueConnectors = new Set(connectorSamples);
  assert(uniqueConnectors.size >= 8, `10 consecutive calls of getConnector yield high variety (unique: ${uniqueConnectors.size} >= 8)`);
  
  // 直前と同一のものが連続していないこと
  let hasImmediateRepeat = false;
  for (let i = 1; i < connectorSamples.length; i++) {
    if (connectorSamples[i] === connectorSamples[i - 1]) {
      hasImmediateRepeat = true;
      break;
    }
  }
  assert(!hasImmediateRepeat, 'No immediate repeat in 10 consecutive connector calls');

  // 2.2 慎重さ注記の10回連続取得テスト
  const prudenceSamples: string[] = [];
  for (let i = 0; i < 10; i++) {
    const p = surfaceVariationService.getPrudenceNote('VERY_HIGH', 'NORMAL');
    if (p) prudenceSamples.push(p.id);
  }
  const uniquePrudence = new Set(prudenceSamples);
  assert(uniquePrudence.size >= 8, `10 consecutive calls of getPrudenceNote yield high variety (unique: ${uniquePrudence.size} >= 8)`);

  // 2.3 積極的提案の10回連続取得テスト
  const suggestionSamples: string[] = [];
  for (let i = 0; i < 10; i++) {
    const s = surfaceVariationService.getProactiveSuggestion('ACTIVE', 'NORMAL');
    if (s) suggestionSamples.push(s.id);
  }
  const uniqueSuggestions = new Set(suggestionSamples);
  assert(uniqueSuggestions.size >= 8, `10 consecutive calls of getProactiveSuggestion yield high variety (unique: ${uniqueSuggestions.size} >= 8)`);

  // 2.4 骨格テンプレートの10回連続取得テスト (answerPlanService 経由)
  const templateSamples: string[] = [];
  for (let i = 0; i < 10; i++) {
    const t = answerPlanService.getSkeletonTemplateVariation('PATTERN-DIRECT-SHORT-01');
    templateSamples.push(t);
  }
  const uniqueTemplates = new Set(templateSamples);
  assert(uniqueTemplates.size >= 8, `10 consecutive calls of getSkeletonTemplateVariation yield high variety (unique: ${uniqueTemplates.size} >= 8)`);

  // =========================================================================
  // 3. 意味保持・文法整合・破綻検証
  // =========================================================================
  console.log('\n--- 3. 全バリエーションの意味保持・文法破綻チェック ---');

  const overConfidentMarkers = ['絶対に', '確実に', '100%', '完全保証', '間違いなく'];
  let overConfidentCount = 0;
  let grammarDisruptionCount = 0;
  let totalVariationTexts = 0;

  // 全リストを集約して検証
  const allVariationLists: Array<{ category: string; items: Array<{ id: string; text: string }> }> = [
    ...Object.entries(SCENE_CONNECTORS_DATA).map(([k, v]) => ({ category: `connector:${k}`, items: v })),
    ...Object.entries(PRUDENCE_NOTES_DATA).map(([k, v]) => ({ category: `prudence:${k}`, items: v })),
    ...Object.entries(PROACTIVE_SUGGESTIONS_DATA).map(([k, v]) => ({ category: `proactive:${k}`, items: v })),
    ...Object.entries(WARMTH_AND_HUMOR_DATA).map(([k, v]) => ({ category: `warmth_humor:${k}`, items: v })),
    ...Object.entries(SECTION_HEADINGS_DEFAULT_DATA).map(([k, v]) => ({ category: `heading:${k}`, items: v })),
    ...Object.entries(SKELETON_VARIATIONS_DATA).map(([k, v]) => ({ category: `skeleton:${k}`, items: v })),
  ];

  for (const group of allVariationLists) {
    for (const item of group.items) {
      totalVariationTexts++;
      
      // 確信度過多の検査
      for (const m of overConfidentMarkers) {
        if (item.text.includes(m)) {
          console.error(`Overconfident marker [${m}] found in ${group.category} id: ${item.id}: "${item.text}"`);
          overConfidentCount++;
        }
      }

      // 表層文法・助詞破綻の検査
      const valResult = surfaceGrammarAndStyleService.validateGrammarAndParticles(item.text);
      if (valResult.hasConjugationError || valResult.hasParticleError) {
        const issues = [...valResult.conjugationIssues, ...valResult.particleIssues];
        console.error(`Grammar disruption found in ${group.category} id: ${item.id}: "${item.text}" (${issues.join(', ')})`);
        grammarDisruptionCount++;
      }
    }
  }

  assert(overConfidentCount === 0, `All ${totalVariationTexts} variation texts have 0 overconfident markers (actual: ${overConfidentCount})`);
  assert(grammarDisruptionCount === 0, `All ${totalVariationTexts} variation texts have 0 grammar disruptions (actual: ${grammarDisruptionCount})`);
  assert(totalVariationTexts >= 800, `Total variation pool size >= 800 (actual: ${totalVariationTexts})`);

  // =========================================================================
  // 4. 表層サービス統合チェック
  // =========================================================================
  console.log('\n--- 4. 表層文法サービスとの統合動作テスト ---');

  // 4.1 シーン見出し
  const disasterHeadings = surfaceGrammarAndStyleService.getSectionHeadings('GENERAL_ANSWER', 'DISASTER_RECOVERY');
  assert(disasterHeadings.conclusion === '【緊急対処手順】', 'Disaster recovery headings preserved correctly');

  const defaultHeadings1 = surfaceGrammarAndStyleService.getSectionHeadings('GENERAL_ANSWER', 'NORMAL');
  assert(defaultHeadings1.conclusion.startsWith('【') && defaultHeadings1.conclusion.endsWith('】'), `Default headings conclusion formatted properly: ${defaultHeadings1.conclusion}`);

  // 4.2 慎重さ注記
  const prudenceHigh = surfaceGrammarAndStyleService.applyPrudenceNote('HIGH', 'NORMAL');
  assert(typeof prudenceHigh === 'string' && prudenceHigh.startsWith('※'), `Prudence note returned valid formatted string: ${prudenceHigh}`);

  // 4.3 積極的提案
  const proactiveActive = surfaceGrammarAndStyleService.applyProactiveSuggestion('ACTIVE', 'NORMAL');
  assert(typeof proactiveActive === 'string' && proactiveActive.includes('【次のアクション提案】'), `Proactive suggestion formatted properly: ${proactiveActive}`);

  // 4.4 温かみとユーモア
  const textWithWarmthAndHumor = surfaceGrammarAndStyleService.applyWarmthAndHumor('回答の本文です。', {
    warmth: 'HIGH',
    technicalTerminology: 'STANDARD',
    proactiveSuggestion: 'NONE',
    prudence: 'STANDARD',
    humor: 'MODERATE',
    currentScene: 'NORMAL',
    politeness: 'CASUAL',
    directness: 'STANDARD',
  });
  assert(textWithWarmthAndHumor.includes('回答の本文です。'), 'Base text is preserved');
  assert(textWithWarmthAndHumor.length > '回答の本文です。'.length, 'Warmth and humor added cleanly');
  const checkedDisruptions = surfaceGrammarAndStyleService.validateGrammarAndParticles(textWithWarmthAndHumor);
  assert(!checkedDisruptions.hasConjugationError && !checkedDisruptions.hasParticleError, 'No disruptions in assembled warmth/humor text');

  console.log(`\n=== Verification Summary: ${passCount} / ${totalTests} tests passed ===`);
  if (passCount === totalTests) {
    console.log('🎉 All v14 variation tests passed successfully!');
  } else {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
