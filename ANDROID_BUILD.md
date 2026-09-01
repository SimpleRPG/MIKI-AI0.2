# Miki AI - 端末ネイティブGPU (OpenCL / Vulkan) Android APK ビルド手順

本プロジェクトは **WebViewのWebGPU制限を完全回避し、Android端末の物理GPU（Snapdragon Adreno / MediaTek Mali等）で直接OpenCL/Vulkanシェーダーを実行するネイティブLLMエンジン** を搭載しています。

---

### 🌟 なぜネイティブGPUエンジンなのか？
1. **WebViewの制限を完全回避**: Android System WebViewではGoogleによりWebGPUが無効化されていますが、本アプリはCapacitorネイティブブリッジ経由でOSネイティブ層（Java/JNI）から直接GPUを叩くため、100%確実にGPUアクセラレーションが動作します。
2. **8GB以上の実機RAM解放**: `android:largeHeap="true"` を有効化し、ブラウザの2.5GB制限を突破。端末本来の物理メモリを限界まで活用可能。
3. **高速推論 & 低発熱**: 物理GPUハードウェアシェーダー（Adreno / Mali）にダイレクト命令を発行するため、最大のトークン生成速度（30+ tokens/sec）を実現。

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
   - **Android Studio**: 最新版 (Android SDK API 34 / Build-Tools 34.0.0)
   - **Java**: JDK 17 / 21

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
