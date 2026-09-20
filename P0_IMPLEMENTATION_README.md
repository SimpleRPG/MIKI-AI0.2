# MIKI-AI P0 実装ファイル

このZIPはパッチではなく、MIKI-AI0.2の統合済みソース一式にP0実装検証を組み込んだファイル版です。

## 追加・更新

- `scripts/test_p0_runtime_e2e.ts`
  - 18分類の起動登録確認
  - CORE Task Ingress → Blackboard → Domain Route → Domain Result の実動作確認
  - Blackboard revision stale-write 拒否確認
  - conversation completion のCORE確定確認
  - `CORE_PROMOTION`なしの自己コード物理適用拒否確認
  - 結果を `artifacts/p0_runtime_e2e_report.json` に保存
- `scripts/run_p0_gate.sh`
  - `npm ci`
  - `npm run lint`
  - `npm run build`
  - P0 runtime E2E
  を順番に実行する正規ゲート
- `package.json`
  - `test:p0-runtime-e2e`
  - `verify:p0-gate`
- `P0_IMPLEMENTATION_README.md`
- `docs/MIKI_AI_18_DOMAIN_DESIGN_PHILOSOPHY.txt`
  - 完了済み領域を未完了リストから整理
  - P0/P1/P2/P3を再優先付け
  - Runtime E2Eを完了条件へ追加
- `knowledgeGapService.ts` の既知trailing whitespaceを除去

## Termux

```bash
cd ~/MIKI-AI0.2
unzip -o /sdcard/Download/MIKI-AI0.2_P0_IMPLEMENTED.zip
# ZIPのルートディレクトリ内容を ~/MIKI-AI0.2/ へ配置した後
npm run verify:p0-gate
```

このゲートは実機環境で初めて本当の完了判定になります。監査スクリプトがPASSしても `npm ci` / `lint` / `build` / runtime E2E のどれかが失敗した場合はP0未完了です。
