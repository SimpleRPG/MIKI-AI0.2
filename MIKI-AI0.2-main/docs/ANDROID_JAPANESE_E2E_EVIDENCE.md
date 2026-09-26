# Android日本語解析 E2E Evidence Protocol

設計思想書の「検証結果を推測で埋めない」「自己評価と外部検証を分離する」方針に従い、v39ではNative Sudachiに決定論的な `selfTest` 境界を追加した。

## 実機での検証順序

1. GitHub ActionsでAPKを生成する。
2. Galaxy S25へAPKをインストールする。
3. `MIKIJapaneseMorphology.status()` が `available=true`、辞書 `20260723-core` を返すことを確認する。
4. `MIKIJapaneseMorphology.selfTest()` を実行する。
5. 3つの固定日本語サンプルについて `nonEmpty=true`、少なくとも1件で `hasReading=true` を確認する。
6. 結果をExecution Evidenceとして登録する。
7. Assertion EngineがPASSした場合のみ `DEVICE_TESTED` の証拠として利用する。

## 重要な境界

- このリポジトリ内の静的チェックは「実機検証」ではない。
- `selfTest` のコード存在だけではPASSにしない。
- APK生成成功だけでもPASSにしない。
- Galaxy S25上で実際に取得した結果だけが外部実行Evidenceになる。
- Evidenceの `assertion_status=PASS` と `passed=true` が揃わない限り、能力昇格には利用しない。

## 固定辞書

- Sudachi Java: `0.8.1`
- SudachiDict core: `20260723`
- PyPI wheel SHA-256: `b3869ce6b12b4bfa09575dc19030703bb669ab41bac12a74cafcbb28c6be2498`

Sudachi 0.8.1は2026-09-07公開のリリースで、0.8.xはv1前の中間系列のため、利用時は正確なバージョン固定が推奨されている。SudachiDict core 20260723は2026-07-24公開。実データはAPKソースへ直接コミットせず、Actionsで固定SHA-256を検証して取得する。
