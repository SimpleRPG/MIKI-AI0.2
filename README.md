# MIKI-AI Game Studio (v1.0.1)

オンデバイスAI / WebGPU / 自律ゲーム制作アシスタント

## Android APK 自動ビルド
GitHub Actions（`.github/workflows/build-apk.yml`）により、Push時に自動で最適化済みAndroid APK（`miki-ai-update-apk`）がビルドされます。
- `largeHeap="true"`（メモリ制限解放）
- `hardwareAccelerated="true"`（GPUフル活用）
- 固定キーストア署名（上書きインストール対応）
