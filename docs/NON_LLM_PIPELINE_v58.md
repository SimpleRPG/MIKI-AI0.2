# MIKI-AI v58 — Deterministic Execution Pipeline

## 目的

v57までに検証済み能力パッチを回答骨格へコンパイルできるようになった。v58では、その骨格を実際のNon-LLM Core実行経路へ接続し、要求コンパイル後に能力計画と形式制約検証を必ず通す。

## 固定パイプライン

```text
入力
  ↓
Conversation / 参照解決
  ↓
RequestTypeCompiler
  ↓
Deterministic Capability / AnswerPlan
  ↓
Formal Constraint Solver
  ↓
既存Claim / Memory / Component
  ↓
Answer IR
  ↓
Semantic Preservation
  ↓
表層回答
```

## 不変条件

1. 検証済み能力だけを `SKILL_COMPOSITION` として再利用する。
2. 形式制約が破れた場合は確定実行せず `NEEDS_CONFIRMATION` とする。
3. 未知を推測で埋めない。
4. ローカル生成ランタイムへフォールバックしない。
5. 能力パッチは保存データではなく、現在の要求にマッチした実行計画として消費する。

## v58の意味

自己改善はモデル重みの更新ではなく、以下の決定論的資産の更新として扱う。

- Request Type規則
- Skill / Capability Patch
- Answer Plan
- Component Registry
- Claim / Evidence
- Formal Constraints
- Regression Evidence

これにより「改善した結果が次の実行で使われる」閉ループをNon-LLM Core内に固定する。
