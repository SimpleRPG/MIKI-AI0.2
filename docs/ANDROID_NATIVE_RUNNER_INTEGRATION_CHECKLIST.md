# Android Native Runner Integration Checklist

このチェックリストは「コードが存在する」と「実機で検証済み」を混同しないためのもの。

- [ ] `npx cap add android` で `android/` platform を生成
- [ ] `npm run android:native-runner` で `MIKINativeRunnerPlugin.kt` を配置・MainActivityへ登録
- [ ] `npx cap sync android`
- [ ] Android Studio/GradleでDebug APKをビルド
- [ ] Galaxy S25実機へインストール
- [ ] `MIKINativeRunner.health()` が `ready=true`
- [ ] allow-list外ComponentがFAILになる
- [ ] 登録済みSmoke AdapterがPASSになる
- [ ] `ExecutionRunnerService.submitResult()`まで戻る
- [ ] implementation_hash不一致が拒否される
- [ ] environment不一致が拒否される
- [ ] Regression Coordinatorが次の1件へ進む
- [ ] 全件PASS後だけPromotion Gateへ到達
- [ ] Base Componentのhashが採用Candidateと一致

最後の項目まで実機で確認できるまでは、ComponentをDEVICE_TESTED/VERIFIEDとは扱わない。
