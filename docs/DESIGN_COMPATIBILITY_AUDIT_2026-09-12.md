# MIKI-AI0.2 設計互換性監査 2026-09-12

## 目的

初期 `MIKI-AI0.2-main` と、`非LLM中心_自己成長型AIコンパニオン_設計思想指示書_統合版.md` を基準に、現在の累積版へ後続機能を安全に追加できる構造か確認した。

## 結論

**追加可能。ただし「Android Native Runnerが既に完成している」とは判定しない。**

現在の累積版には、元ソースの主要なUI/サービス群を保持したまま、非LLM中核の新しいサービス層を追加できている。元ZIPは101サービス、今回の累積版は137サービスで、追加層は既存機能を丸ごと置換するのではなくサービス境界として積み上がっている。

一方、`capacitor.config.ts` とJS側の `MIKINativeRunner` 境界は存在するものの、`android/` プラットフォーム本体とKotlin Pluginはこれまで存在しなかった。したがって前版の「Native Runnerへ接続済み」という表現は、**JS契約まで**と読み替える必要がある。

今回、Kotlin側の安全なPlugin実装とセットアップ経路を追加したが、実機APKでのコンパイル・登録・実行確認はまだ未実施である。

## 設計思想との整合

### 整合している点

- 非LLM中核を標準経路にする。`autonomous_rule` が既定経路。
- Request Compiler → Capability Graph → Component Composition → Verification/Regression の責務分離。
- Claim/Evidenceを分離し、保存=真実としない。
- CandidateをBase Componentから隔離する。
- Static Guard → Regression → DEVICE_TESTED → Promotion Gate の順序を維持。
- Cloud AIは候補を作る臨時開発担当として扱い、直接VERIFIEDにしない。
- 実行結果は `request_id` / `implementation_hash` / `environment` を照合する。
- Android側も任意コード実行ではなく、明示登録したNative Adapterだけを許可する。
- Termuxは本番Android経路から外し、過去データ互換として型を残す。

これらは設計書の「仕様・実装・試験定義・検証結果を混在させない」「CANDIDATEから状態を飛ばしてVERIFIEDにしない」「クラウド出力を無検証で正式利用しない」という原則と一致する。

## 要注意点

1. **SQLite/FTS5はStorageService側に実装されているが、全サービスがSQLiteの正規テーブルを直接使う構造ではなく、既存の同期KVファサードを経由する。** これは追加可能性を損なわないが、長期的にはClaim/Case/Component/Executionを構造化テーブルへ移す余地がある。
2. **ローカルLLMコードはまだ大量に残っている。** 設計書のロードマップでは責務移管後に `LLM_FALLBACK_ONLY` / `LLM_REMOVED` へ進むため、現段階で残存自体は矛盾ではない。ただし最終目標では縮退・削除対象。
3. **実Android Platformは前版まで未生成だった。** 今回は生成後に組み込めるKotlin Pluginと自動パッチを追加した。
4. **Native Adapterの具体的な実装は空のallow-listが安全な既定値。** 未登録ComponentはFAILとして戻す。これによりCloudから渡されたコードをそのままNativeで実行する経路を作らない。
5. **既存の古いMaster仕様にはTermux/ローカルLLM前提の記述が残る。** 今後の実装判断では、2026-09-11の統合設計思想を優先する。

## 次の実装境界

1. CapacitorでAndroid platformを生成。
2. `MIKINativeRunnerPlugin` を登録。
3. `health()` の実機疎通。
4. 安全なSmoke Test Adapterを1個だけ登録。
5. ExecutionRequest → Native Plugin → submitResult の実機往復。
6. Regression 1件 → 次の1件という順次実行を実測。
7. その後、実際に価値のあるAndroid Component Adapterを個別追加。

## 未確認事項

- Android Studio/Gradleでの実ビルド成功。
- Galaxy S25実機でのPluginロード成功。
- Native Adapterの実行時間/電力/温度。
- SQLite FTS5の実機性能。
- Regression全件PASSからPromotionまでの実機E2E。

「未確認」を成功扱いにしないこと自体が、この設計の完成条件である。


## 依存関係の追加確認

現行のCapacitor系は8.xで統一されているため、SQLite pluginもCapacitor 8対応系へ合わせる必要がある。今回 `@capacitor-community/sqlite` を `^8.1.0` に更新した。公式リポジトリの現行変更履歴ではCapacitor 8対応が明記され、Capacitor 8向けのminimum Android SDKは24とされている。 citeturn0search0

## v39 P0-5実装進捗

- `android.native_echo` をANALYZED状態の安全なSmoke Componentとして追加。
- Native側allow-listに同Componentを明示登録。
- JS Native Runner契約に `artifact_snapshot_key` 入力を明示し、Native側のartifact照合と対称化。
- `scripts/verify_android_native_contract.ts` を追加。これは静的契約検査であり、実機検証ではない。
- `android:prepare` を追加し、Capacitor Android生成→Native Runner組込→Sudachi組込→syncの手順を一つにした。
- TypeScript全体は依存未導入のため完全コンパイル不能だが、今回変更したJSサービスについて新規の型エラーは確認されていない。`@capacitor/core`等の既存依存解決エラーは残る。
- 実機での `ExecutionRequest -> Native Plugin -> android.native_echo -> submitResult()` は未実施。したがってDEVICE_TESTED/VERIFIEDへの昇格は行わない。
