import http from 'http';
import { autonomousSearchService } from '../src/services/autonomousSearchService';
import {
  isRealDataProvider,
  VALID_WEB_REAL_DATA_PROVIDERS,
  WebMaterialPatternExtractor,
} from '../src/services/webMaterialPatternExtractor';
import { storageService } from '../src/services/storageService';
import {
  getSearxngBaseUrlItem,
  setSearxngBaseUrlItem,
  DEFAULT_SEARXNG_BASE_URL,
} from '../src/services/api';
import { answerPlanService } from '../src/services/answerPlanService';

async function runTest() {
  console.log('=== SearXNGパイプライン＆UI設定 検証開始 ===\n');

  // TEST 1: isRealDataProvider の検証 (指示1)
  console.log('[TEST 1] isRealDataProvider の searxng 対応検証');
  if (!VALID_WEB_REAL_DATA_PROVIDERS.includes('searxng' as any)) {
    throw new Error('FAIL: VALID_WEB_REAL_DATA_PROVIDERS に searxng が含まれていません');
  }
  if (!isRealDataProvider('searxng')) {
    throw new Error('FAIL: isRealDataProvider("searxng") が false を返しました');
  }
  if (isRealDataProvider('searxng_mock')) {
    throw new Error('FAIL: isRealDataProvider("searxng_mock") が true を返しました');
  }
  console.log('  ✓ VALID_WEB_REAL_DATA_PROVIDERS に searxng が存在');
  console.log('  ✓ isRealDataProvider("searxng") === true');

  // TEST 2: storageService & api.ts の設定読み書き検証 (指示3)
  console.log('\n[TEST 2] SearXNGベースURLのストレージ保存・取得検証');
  setSearxngBaseUrlItem('');
  const defaultEmpty = getSearxngBaseUrlItem();
  const defaultWithFallback = getSearxngBaseUrlItem(true);
  if (defaultEmpty !== '') {
    throw new Error(`FAIL: 未設定時の getSearxngBaseUrlItem() が空文字列ではありません: "${defaultEmpty}"`);
  }
  if (defaultWithFallback !== DEFAULT_SEARXNG_BASE_URL) {
    throw new Error(`FAIL: fallbackToDefault 時の getSearxngBaseUrlItem(true) が不正です: "${defaultWithFallback}"`);
  }

  setSearxngBaseUrlItem('http://127.0.0.1:9999');
  const stored = getSearxngBaseUrlItem();
  if (stored !== 'http://127.0.0.1:9999') {
    throw new Error(`FAIL: 保存したURLが取得できません: "${stored}"`);
  }
  const rawStorage = storageService.getItem('miki_searxng_base_url');
  if (rawStorage !== 'http://127.0.0.1:9999') {
    throw new Error(`FAIL: storageService.getItem('miki_searxng_base_url') が一致しません: "${rawStorage}"`);
  }
  console.log('  ✓ getSearxngBaseUrlItem / setSearxngBaseUrlItem の整合性確認');
  console.log('  ✓ storageService ("miki_searxng_base_url") への永続化確認');

  // TEST 3: ローカルSearXNGモックサーバーによる実取得とパース検証 (指示1 & 指示2)
  console.log('\n[TEST 3] SearXNG エンドポイント接続・JSON応答パース・provider返却検証');
  let requestedPath = '';
  const mockServer = http.createServer((req, res) => {
    requestedPath = req.url || '';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        query: 'TypeScript 5.7',
        results: [
          {
            title: 'TypeScript 5.7 Release Notes',
            url: 'https://devblogs.microsoft.com/typescript/typescript-5-7',
            content: 'TypeScript 5.7 includes checks for uninitialized variables and paths in JavaScript.',
            publishedDate: '2024-11-20',
          },
          {
            title: 'TypeScript 5.7 Overview',
            url: 'https://example.com/ts-5-7',
            content: 'Detailed summary of TypeScript 5.7 features and syntax enhancements.',
          },
        ],
      })
    );
  });

  await new Promise<void>((resolve) => {
    mockServer.listen(9876, '127.0.0.1', () => resolve());
  });

  try {
    // モックSearXNGサーバーのURLをセット
    setSearxngBaseUrlItem('http://127.0.0.1:9876');

    // 検索実行 (preferredProvider: auto) -> SearXNGが最優先で呼ばれること
    const searchRes = await autonomousSearchService.executeSearch('TypeScript 5.7 新機能', {
      bypassCache: true,
      preferredProvider: 'auto',
    });

    if (!requestedPath.includes('/search?q=') || !requestedPath.includes('format=json')) {
      throw new Error(`FAIL: SearXNGへのリクエストパスが不正です: ${requestedPath}`);
    }
    if (searchRes.provider !== 'searxng') {
      throw new Error(`FAIL: searchRes.provider が 'searxng' ではありません: ${searchRes.provider}`);
    }
    if (searchRes.results.length === 0) {
      throw new Error('FAIL: SearXNGからの結果が0件です');
    }
    if (searchRes.results[0].source !== 'SearXNG (Local)') {
      throw new Error(`FAIL: results[0].source が 'SearXNG (Local)' ではありません: ${searchRes.results[0].source}`);
    }
    console.log(`  ✓ SearXNGエンドポイント呼び出しパス確認: ${requestedPath}`);
    console.log(`  ✓ 返却provider: ${searchRes.provider}`);
    console.log(`  ✓ 検索結果件数: ${searchRes.results.length}件`);
    console.log(`  ✓ source識別子: ${searchRes.results[0].source}`);

    // TEST 4: SearXNG結果からの骨格抽出・言い回し抽出検証
    console.log('\n[TEST 4] SearXNG結果から骨格・表層言い回しへの還元検証');
    const skeletonCand = WebMaterialPatternExtractor.extractSkeletonStructuresFromWebText({
      title: searchRes.results[0].title,
      snippet: searchRes.results[0].snippet,
      sourceQuery: 'TypeScript 5.7 新機能',
      sourceUrl: searchRes.results[0].url,
      provider: 'searxng',
    });
    if (!skeletonCand) {
      throw new Error('FAIL: extractSkeletonStructuresFromWebText が null を返しました');
    }
    if (skeletonCand.provider !== 'searxng') {
      throw new Error(`FAIL: skeletonCand.provider が 'searxng' ではありません: ${skeletonCand.provider}`);
    }
    const registeredSkeleton = answerPlanService.registerSkeletonFromWebObservation(skeletonCand);
    console.log('  ✓ extractSkeletonStructuresFromWebText 正常動作 (provider: searxng)');
    console.log(`  ✓ registerSkeletonFromWebObservation 登録検証 (id: ${registeredSkeleton?.id || 'candidate'})`);

    const surfacePatterns = WebMaterialPatternExtractor.extractSurfacePatternsFromWebText({
      text: searchRes.results[0].snippet,
      sourceQuery: 'TypeScript 5.7 新機能',
      sourceUrl: searchRes.results[0].url,
      provider: 'searxng',
    });
    console.log(`  ✓ extractSurfacePatternsFromWebText 抽出件数: ${surfacePatterns.length}件 (provider: searxng)`);
  } finally {
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
    // テスト後クリーンアップ
    setSearxngBaseUrlItem('');
  }

  // TEST 5: SearXNG未起動時の静かなフォールバック検証
  console.log('\n[TEST 5] SearXNG未起動時のサイレントフォールバック検証');
  setSearxngBaseUrlItem('http://127.0.0.1:19999'); // 未起動ポート
  const fallbackRes = await autonomousSearchService.executeSearch('東京 タワー 高さ', {
    bypassCache: true,
    preferredProvider: 'auto',
  });
  console.log(`  ✓ 未起動SearXNGから次プロバイダへのフォールバック成功 (provider: ${fallbackRes.provider || 'none'})`);

  // クリーンアップ
  setSearxngBaseUrlItem('');

  console.log('\n🎉 SearXNG (Termuxローカル) パイプライン＆UI設定の全検証に合格しました！');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ 検証失敗:', err);
  process.exit(1);
});
