# Hardening → Regression Candidate Boundary

## 目的

未来質問シミュレーター／自動レッドチームで見つかった弱点を、次回のRegressionで再確認できるTest Case候補へ変換する。

## 境界

- Hardeningの生成・失敗・未実施は、それ自体では検証証拠にならない。
- Componentに紐づく未来質問だけをRegression Candidateへ接続する。
- Candidateは `PROPOSED` のまま登録され、実行前に勝手に成功扱いしない。
- Regression実行時にはCandidateから決定論的なTest Case IDを生成する。
- Execution RunnerのAssertionがPASSし、通常のEvidence/Regression Gateを通過するまでComponentのVERIFIED状態は変更しない。
- Red TeamでComponentが特定できないケースは、コード部品の回帰試験へ直接変換せず、Hardening履歴として保持する。

## 学習ループ

`Hardening FAIL/NOT_RUN`
→ `HardeningRegressionCandidate(PROPOSED)`
→ `ComponentTestCase(HARDENING)`
→ `Execution`
→ `Assertion`
→ `Evidence`
→ `Regression Gate`
→ `Promotion Gate`

この経路は自己改善の安全境界を迂回しない。
