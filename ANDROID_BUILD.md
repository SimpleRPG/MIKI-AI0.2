# Miki AI - Android APK ビルド手順 (Capacitor)

本プロジェクトは Capacitor を使用して Android APK としてパッケージング可能です。
APK化することで、ブラウザのストレージ容量上限や自動削除制限から解放され、端末ストレージの限界（60GB以上等）までモデルキャッシュやゲームデータを保存できます。

---

### 🚀 方法 1: GitHub Actions による完全自動 APK ビルド（スマホ推奨・完全無料）

PC や重い環境構築なしで、GitHub にコードを push するだけでクラウド上で自動ビルドされます。

1. **GitHub に push する**:
   - `main` または `master` ブランチに push されると、自動的に `.github/workflows/build-apk.yml` が実行されます。
   - または、GitHub のリポジトリ画面の **「Actions」タブ** > **「Build Android APK」** > **「Run workflow」** を押すだけでいつでも手動実行できます。
2. **APK のダウンロード**:
   - Actions の実行詳細画面の下部にある **Artifacts**（成果物）から `miki-ai-debug-apk` をスマホでダウンロード。
   - ダウンロードした ZIP を展開して `app-debug.apk` をタップすれば、スマホに直接インストールできます！

---

### 💻 方法 2: PC / Android Studio でのローカルビルド

1. **前提環境**:
   - **Node.js**: v18+
   - **Android Studio**: 最新版 (Android SDK / Build-Tools インストール済み)
   - **Java**: JDK 17+

2. **ビルド手順**:
```bash
# 1. 依存関係のインストール
npm install

# 2. Capacitor Android プラットフォームを追加（初回のみ）
npx cap add android

# 3. Webアセットのビルドと同期
npm run build
npx cap sync android

# 4. Android Studio でプロジェクトを開く
npx cap open android
```

3. **APK の出力**:
   - Android Studio のメニューから **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)** を選択。

