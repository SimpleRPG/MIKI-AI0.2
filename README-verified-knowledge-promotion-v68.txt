MIKI-AI0.2 v68 — Verified Knowledge Promotion

目的:
Knowledge Gap -> research -> verifier -> verified claim -> reusable knowledge metadata -> shared learning continuum / capability ranking
を一本の決定論的ループとして接続する。

重要な安全境界:
- 検証済みClaimだけをpromotion対象とする。
- PromotionはComponentのVERIFIED化を行わない。
- Promotionは任意コード生成・eval/new Functionを行わない。
- ClaimのscopeKeyを保持し、知識を無制限に一般化しない。
- Capability Graphへの反映はランキングboostのみ。
- LearningContinuumへは検証済み経験として記録する。

API:
GET /api/miki/verified-knowledge
GET /api/miki/verified-knowledge/relevant?q=...

接続先:
- nonLlmCoreService: research verifier成功時にpromotion
- capabilityGraphService: verified knowledgeによる候補ランキング
- mikiUnifiedLearningContinuumService: promotionを共通経験へ記録
