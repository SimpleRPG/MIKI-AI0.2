# Miki AI - Android APK ビルド手順（Capacitor / Deterministic Non-LLM Core）

本プロジェクトの現行ランタイムは **CORE + 17分類の決定論的Non-LLMアーキテクチャ**です。Android版はCapacitor/WebViewを実行シェルとして利用し、ローカル生成LLM、retired model format、retired local runtime、retired local runtimeは実行しません。

---

### 🌟 現在のAndroidランタイム方針
1. UIとアプリ実行はCapacitor/WebViewを使用します。
2. 通常処理は決定論的Non-LLM Coreと既存の検証済み部品で行います。
3. 外部Gemini等は必要時のみ教師/Evidence境界から利用し、端末内モデル推論は行いません。
4. GPU/ネイティブ高速化が必要な個別処理は、その処理能力が実際に導入・検証されている場合だけ使用します。

---

### 🚀 方法 1: GitHub Actions による完全自動 APK ビルド（スマホ推奨・無料）

PCやAndroid Studioの環境構築なしで、GitHubにコードを push するだけでクラウド上で自動ビルドされます。

1. **GitHub に push する**:
   - `main` または `master` ブランチに push されると、自動的に `.github/workflows/build-apk.yml` が実行されます。
   - または、GitHub リポジトリの **「Actions」タブ** > **「Build Android APK (Native GPU OpenCL / Vulkan Engine)」** > **「Run workflow」** をタップするだけで手動実行できます。
2. **APK のダウンロード**:
   - Actions 完了画面下部の **Artifacts** から `miki-ai-native-gpu-apk` をダウンロード。
   - ZIPを展開して `app-debug.apk` をタップすれば、実機スマホにインストール完了！

---

### 💻 方法 2: PC / Android Studio でのローカルビルド

1. **前提環境**:
   - **Node.js**: v20+
   - **Android Studio**: 最新版 (Android SDK API 36 / Build-Tools 36.0.0)
   - **Java**: JDK 21 (Capacitor 8 系は Java 21 が必須)

2. **ビルド手順**:
```bash
# 1. 依存関係のインストール
npm install

# 2. Capacitor Android プラットフォームを追加
npx cap add android

# 3. Webアセットのビルドと同期
npm run build
npx cap sync android

# 4. Android Studio でプロジェクトを開いてビルド
npx cap open android
```
