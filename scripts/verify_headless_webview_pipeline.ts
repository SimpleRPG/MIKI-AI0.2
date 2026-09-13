import http from 'http';
import {
  isRealDataProvider,
  VALID_WEB_REAL_DATA_PROVIDERS,
  WebMaterialPatternExtractor,
} from '../src/services/webMaterialPatternExtractor';
import { nativeWorkManagerService } from '../src/services/nativeWorkManagerService';
import { autonomousSearchService } from '../src/services/autonomousSearchService';
import { answerPlanService } from '../src/services/answerPlanService';

async function runTest() {
  console.log('=== Headless WebView レンダリング＆自律学習パイプライン 検証開始 ===\n');

  // TEST 1: isRealDataProvider の検証
  console.log('[TEST 1] isRealDataProvider の headless_webview 対応検証');
  if (!VALID_WEB_REAL_DATA_PROVIDERS.includes('headless_webview' as any)) {
    throw new Error('FAIL: VALID_WEB_REAL_DATA_PROVIDERS に headless_webview が含まれていません');
  }
  if (!isRealDataProvider('headless_webview')) {
    throw new Error('FAIL: isRealDataProvider("headless_webview") が false を返しました');
  }
  if (isRealDataProvider('headless_webview_mock')) {
    throw new Error('FAIL: isRealDataProvider("headless_webview_mock") が true を返しました');
  }
  console.log('  ✓ VALID_WEB_REAL_DATA_PROVIDERS に headless_webview が存在');
  console.log('  ✓ isRealDataProvider("headless_webview") === true');

  // TEST 2: ローカルHTTPサーバーを立てて nativeWorkManagerService.fetchRenderedPage を検証
  console.log('\n[TEST 2] nativeWorkManagerService.fetchRenderedPage のテキスト抽出検証');
  const mockHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>React 19 Server Components トラブルシューティング手順</title>
        <style>body { font-family: sans-serif; }</style>
        <script>console.log("script content should be removed");</script>
      </head>
      <body>
        <h1>React 19 Server Components トラブルシューティング手順</h1>
        <p>結論として、Server Actionsで発生するエラーの主要因を整理し、以下の手順で対応します。</p>
        <ol>
          <li>ディレクティブの宣言漏れがないか確認する。</li>
          <li>シリアライズ可能なデータのみを渡しているか点検する。</li>
          <li>エラーハンドリングをtry-catchで囲みクライアントへ通知する。</li>
        </ol>
      </body>
    </html>
  `;

  let mockPort = 0;
  const mockServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(mockHtml);
  });

  await new Promise<void>((resolve) => {
    mockServer.listen(0, '127.0.0.1', () => {
      const addr = mockServer.address() as any;
      mockPort = addr.port;
      resolve();
    });
  });

  const testPageUrl = `http://127.0.0.1:${mockPort}/test-react-article`;
  console.log(`  ローカルモックサーバー起動: ${testPageUrl}`);

  try {
    const pageResult = await nativeWorkManagerService.fetchRenderedPage(testPageUrl, {
      timeoutMs: 5000,
      renderWaitMs: 500,
    });

    if (!pageResult.success) {
      throw new Error(`FAIL: fetchRenderedPage が失敗しました: ${pageResult.error}`);
    }
    if (!pageResult.text.includes('React 19 Server Components')) {
      throw new Error(`FAIL: 抽出テキストにタイトルが含まれていません: "${pageResult.text}"`);
    }
    if (pageResult.text.includes('script content should be removed')) {
      throw new Error('FAIL: <script> タグのテキストが除外されていません');
    }
    if (pageResult.text.includes('<style>')) {
      throw new Error('FAIL: <style> タグが除外されていません');
    }
    console.log(`  ✓ テキスト抽出成功 (${pageResult.length} 文字)`);

    // TEST 3: WebMaterialPatternExtractor での fetchMethod 保持検証
    console.log('\n[TEST 3] WebMaterialPatternExtractor による fetchMethod 伝播検証');
    const skeletonCand = WebMaterialPatternExtractor.extractSkeletonStructuresFromWebText({
      title: 'React 19 Server Components トラブルシューティング手順',
      snippet: pageResult.text.slice(0, 200),
      sourceQuery: 'React 19 Server Components トラブルシューティング手順',
      sourceUrl: testPageUrl,
      provider: 'headless_webview',
      fetchMethod: 'headless_webview',
    });

    if (!skeletonCand) {
      throw new Error('FAIL: 骨格候補の抽出に失敗しました');
    }
    if (skeletonCand.fetchMethod !== 'headless_webview') {
      throw new Error(`FAIL: skeletonCand.fetchMethod が一致しません: ${skeletonCand.fetchMethod}`);
    }
    if (skeletonCand.provider !== 'headless_webview') {
      throw new Error(`FAIL: skeletonCand.provider が一致しません: ${skeletonCand.provider}`);
    }
    console.log('  ✓ WebMaterialPatternExtractor が fetchMethod: "headless_webview" を正しく保持');

    // TEST 4: answerPlanService への登録と sourceProvenance 検証
    console.log('\n[TEST 4] answerPlanService.registerSkeletonFromWebObservation の sourceProvenance 検証');
    const registered = answerPlanService.registerSkeletonFromWebObservation(skeletonCand);
    if (!registered) {
      throw new Error('FAIL: answerPlanService への骨格登録が拒否されました');
    }
    if (registered.sourceProvenance?.fetchMethod !== 'headless_webview') {
      throw new Error(`FAIL: registered.sourceProvenance.fetchMethod が一致しません: ${registered.sourceProvenance?.fetchMethod}`);
    }
    if (registered.sourceProvenance?.provider !== 'headless_webview') {
      throw new Error(`FAIL: registered.sourceProvenance.provider が一致しません: ${registered.sourceProvenance?.provider}`);
    }
    if (registered.status !== 'CANDIDATE') {
      throw new Error(`FAIL: 初回登録時の status が CANDIDATE ではありません: ${registered.status}`);
    }
    console.log('  ✓ 回答骨格候補として正常に登録完了');
    console.log(`  ✓ sourceProvenance.fetchMethod: "${registered.sourceProvenance.fetchMethod}"`);
    console.log(`  ✓ sourceProvenance.provider: "${registered.sourceProvenance.provider}"`);

    // TEST 5: autonomousSearchService.fetchRenderedPage のエンドツーエンド連携検証
    console.log('\n[TEST 5] autonomousSearchService.fetchRenderedPage の総合検証');
    const e2eResult = await autonomousSearchService.fetchRenderedPage(testPageUrl, {
      timeoutMs: 5000,
      renderWaitMs: 500,
      query: 'React 19 Server Components トラブルシューティング手順',
    });

    if (!e2eResult.success) {
      throw new Error(`FAIL: autonomousSearchService.fetchRenderedPage が失敗しました: ${e2eResult.error}`);
    }
    if (e2eResult.patternsCount < 1) {
      throw new Error(`FAIL: パターン抽出数が 0 です: ${e2eResult.patternsCount}`);
    }
    console.log(`  ✓ E2E ページ取得・レンダリング・抽出成功 (${e2eResult.length}文字, ${e2eResult.patternsCount}パターン抽出)`);

  } finally {
    mockServer.close();
  }

  console.log('\n=== 全てのヘッドレスWebView検証テストに合格しました！ ===');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('\n❌ テスト失敗:', err);
  process.exit(1);
});
