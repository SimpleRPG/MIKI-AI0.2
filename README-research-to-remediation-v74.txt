# MIKI v74 — Research → Remediation Closed Loop

## 追加実装

Web研究で検証済みになったClaimを、単なる知識保存で終わらせず、既存の安全なVERIFIED Componentの再検証候補へ接続する `researchToRemediationService` を追加。

Flow:

failure / stale capability
→ Knowledge Gap
→ Web Evidence
→ UNVERIFIED Claim
→ Verifier
→ SUPPORTED / DEVICE_VERIFIED
→ Verified Knowledge / Verified Capability
→ 既存VERIFIED Componentとの保守的マッチング
→ Confidence再確認
→ Regression Suiteを計画
→ Execution Evidence待ち
→ PASSなら現行能力の再利用根拠、FAIL/BLOCKEDなら再学習・再調査対象

## 安全境界

- Web検索結果だけでは実行能力を昇格しない
- ClaimがVerifierを通過しない限りRemediationへ接続しない
- 再検証要求中のComponentは自動でRegression候補にしない
- 新しいコードを生成・eval・new Function・任意実行しない
- Componentを直接VERIFIED化しない
- 同一Gapで異なる検証済みClaimが競合した場合はQUARANTINED
- Regression PASSは実行証拠が揃うまで確定扱いしない

## API

GET /api/miki/research-remediation
GET /api/miki/research-remediation/:id

## 検証

scripts/test_research_to_remediation_v74.mjs: 13/13 PASS
