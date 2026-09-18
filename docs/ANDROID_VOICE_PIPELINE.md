# MIKI Android Voice Pipeline

## Scope

設計思想の「テキスト・音声コンパニオン化」のうち、まずユーザー操作で開始する音声入力を実装する。
常時マイク・ウェイクワードはこの段階では実装しない。

## Pipeline

```text
ユーザーがマイク操作
  ↓
Android Speech Recognition
  ↓
候補テキスト
  ↓
MIKI conversation pipeline
  ↓
Sudachi / dictionary / dialogue state
```

音声認識結果は観測値であり、事実・Claimの根拠として自動的にVERIFIEDへ昇格させない。
`verified=false` を固定し、必要ならユーザー確認・独立Evidenceを通す。

## Safety boundary

- continuous microphone capture: OFF
- wake word: 未実装
- user-triggered recognition: ON
- raw audio persistence: しない
- recognized text: 通常の会話入力として扱う

## Verification

`npm run android:verify-voice-contract` は静的契約検査であり、実機成功を意味しない。
実機では Android 権限、Speech Service、認識結果、Conversation Pipeline への投入を別々に確認する。
