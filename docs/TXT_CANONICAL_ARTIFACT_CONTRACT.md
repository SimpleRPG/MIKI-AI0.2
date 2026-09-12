# TXT正本アーティファクト契約

Componentの正本は以下の論理ファイル集合で固定する。

- component.txt
- implementation.txt
- tests.txt
- validation.txt
- sources.txt（存在時）
- history.txt（存在時）

`ComponentArtifactStoreService.getCanonicalFiles()` は同じversion/hashのimmutable snapshotからのみ返す。
Regression/Execution Evidenceは `snapshot_key + implementation_hash + validation_hash` を照合し、現在のRegistryを見ただけでは過去検証を再利用しない。

現時点ではStorage-backed logical artifactであり、Android filesystem上の個別TXTファイルを常時生成する仕様ではない。物理エクスポートはこの契約を入力として後段で追加できる。
