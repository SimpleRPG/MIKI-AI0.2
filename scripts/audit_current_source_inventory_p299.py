#!/usr/bin/env python3
"""Generate/check a deterministic inventory of currently tracked source files.

This is a lexical source inventory, not a runtime call graph or authority proof.
The three report/control paths are excluded so the report is stable before and
after its own files are committed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import posixpath
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
JSON_OUT = ROOT / "CURRENT_SOURCE_INVENTORY_P299.json"
MD_OUT = ROOT / "CURRENT_SOURCE_INVENTORY_P299.md"
CONTROL_PATHS = {
    "scripts/audit_current_source_inventory_p299.py",
    "CURRENT_SOURCE_INVENTORY_P299.json",
    "CURRENT_SOURCE_INVENTORY_P299.md",
}
SOURCE_EXTS = {
    ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs",
    ".java", ".kt", ".rs", ".py", ".sh", ".c", ".h", ".cpp", ".go",
    ".swift", ".xml", ".gradle", ".kts",
}
ECMASCRIPT_EXTS = {".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"}
IMPORT_PATTERN = re.compile(
    r"(?:\bfrom\s*|\bimport\s*\(|\bimport\s*|\brequire\s*\()\s*"
    r"(['\"])(\.\.?/[^'\"]+)\1"
)


def sha256(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def count_lines(raw: bytes) -> int:
    return len(raw.decode("utf-8", errors="replace").splitlines())


def tracked_paths() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "--cached", "-z"],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
    )
    paths = result.stdout.split(b"\0")
    decoded = []
    for raw_path in paths:
        if not raw_path:
            continue
        try:
            path = raw_path.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise SystemExit("ERROR: tracked path is not valid UTF-8; inventory aborted") from exc
        if path in CONTROL_PATHS:
            continue
        if (ROOT / path).is_file():
            decoded.append(path)
    if len(decoded) != len(set(decoded)):
        raise SystemExit("ERROR: duplicate tracked paths; inventory aborted")
    return sorted(decoded)


def candidate_targets(source_path: str, specifier: str) -> list[str]:
    specifier = specifier.split("?", 1)[0].split("#", 1)[0]
    base = posixpath.normpath(posixpath.join(posixpath.dirname(source_path), specifier))
    candidates = [base]
    suffix = PurePosixPath(base).suffix.lower()
    replacement_suffixes = {
        ".js": [".ts", ".tsx", ".js"],
        ".jsx": [".tsx", ".ts", ".jsx"],
        ".mjs": [".mts", ".ts", ".mjs"],
        ".cjs": [".cts", ".ts", ".cjs"],
    }
    if suffix in replacement_suffixes:
        stem = base[: -len(suffix)]
        candidates.extend(stem + ext for ext in replacement_suffixes[suffix])
    elif not suffix:
        candidates.extend(base + ext for ext in sorted(ECMASCRIPT_EXTS))
        candidates.extend(base + "/index" + ext for ext in sorted(ECMASCRIPT_EXTS))
    unique = []
    seen = set()
    for candidate in candidates:
        normalized = posixpath.normpath(candidate)
        if normalized not in seen:
            seen.add(normalized)
            unique.append(normalized)
    return unique


def resolve_relative_import(source_path: str, specifier: str, all_paths: set[str]) -> str | None:
    for candidate in candidate_targets(source_path, specifier):
        if candidate in all_paths:
            return candidate
    return None


def build_inventory() -> dict:
    paths = tracked_paths()
    all_paths = set(paths)
    source_paths = [
        path for path in paths
        if PurePosixPath(path).suffix.lower() in SOURCE_EXTS
    ]
    records = []
    total_imports = 0
    resolved_imports = 0
    unresolved_imports = 0
    ecmascript_files = 0

    for rel_path in source_paths:
        raw = (ROOT / rel_path).read_bytes()
        suffix = PurePosixPath(rel_path).suffix.lower()
        candidates = []
        if suffix in ECMASCRIPT_EXTS:
            ecmascript_files += 1
            source = raw.decode("utf-8", errors="replace")
            for match in IMPORT_PATTERN.finditer(source):
                specifier = match.group(2)
                resolved = resolve_relative_import(rel_path, specifier, all_paths)
                row = {
                    "line": source.count("\n", 0, match.start()) + 1,
                    "specifier": specifier,
                    "resolution": "RESOLVED" if resolved else "UNRESOLVED_CANDIDATE",
                }
                if resolved:
                    row["resolvedPath"] = resolved
                    resolved_imports += 1
                else:
                    unresolved_imports += 1
                candidates.append(row)
        total_imports += len(candidates)
        records.append({
            "path": rel_path,
            "bytes": len(raw),
            "lines": count_lines(raw),
            "sha256": sha256(raw),
            "relativeImportCandidates": candidates,
            "relativeImportCandidateCount": len(candidates),
            "resolvedRelativeImportCount": sum(1 for item in candidates if item["resolution"] == "RESOLVED"),
            "unresolvedRelativeImportCount": sum(1 for item in candidates if item["resolution"] != "RESOLVED"),
        })

    return {
        "schemaVersion": 1,
        "inventoryRevision": "2026-10-21-P299",
        "scope": {
            "pathSource": "git ls-files --cached",
            "sourceExtensions": sorted(SOURCE_EXTS),
            "excludedControlPaths": sorted(CONTROL_PATHS),
            "relativeImportMethod": "lexical ECMAScript import/from/require candidate scan with tracked-path resolution",
            "runtimeCallGraphProof": False,
            "semanticAuthorityProof": False,
        },
        "counts": {
            "trackedPathCountExcludingControlPaths": len(paths),
            "sourceFileCount": len(records),
            "ecmascriptSourceFileCountScannedForRelativeImports": ecmascript_files,
            "relativeImportCandidateCount": total_imports,
            "resolvedRelativeImportCandidateCount": resolved_imports,
            "unresolvedRelativeImportCandidateCount": unresolved_imports,
        },
        "records": records,
    }


def render_markdown(data: dict) -> str:
    counts = data["counts"]
    out = [
        "# MIKI-AI0.2 現行追跡ソースインベントリ（P299）",
        "",
        "- 対象は `git ls-files --cached` に記録されたパスのうち、定義済みソース拡張子に該当するファイルです。",
        "- この一覧はバイト数・行数・SHA-256と、ECMAScriptの相対import候補を記録します。",
        "- 相対import解析は字句的な候補検出です。未解決候補は自動的に不具合を意味せず、コメント・動的構築・alias・実行時呼出し・意味上のAuthorityを証明しません。",
        "- P287～P293の履歴台帳は改変せず、authority/重複監査の歴史的根拠として保持します。",
        "",
        "## 集計",
        "",
        "| 指標 | 件数 |",
        "|---|---:|",
        f"| 対象追跡パス（監査制御ファイルを除く） | {counts['trackedPathCountExcludingControlPaths']} |",
        f"| ソースファイル | {counts['sourceFileCount']} |",
        f"| 相対import候補を字句走査したECMAScriptファイル | {counts['ecmascriptSourceFileCountScannedForRelativeImports']} |",
        f"| 相対import候補 | {counts['relativeImportCandidateCount']} |",
        f"| 追跡パスへ解決できた候補 | {counts['resolvedRelativeImportCandidateCount']} |",
        f"| 未解決候補（即不具合判定ではない） | {counts['unresolvedRelativeImportCandidateCount']} |",
        "",
        "## ファイル一覧",
        "",
        "| パス | bytes | lines | SHA-256 | import候補 | resolved | unresolved |",
        "|---|---:|---:|---|---:|---:|---:|",
    ]
    for record in data["records"]:
        path = record["path"].replace("|", "\\|")
        out.append(
            f"| `{path}` | {record['bytes']} | {record['lines']} | `{record['sha256']}` | "
            f"{record['relativeImportCandidateCount']} | {record['resolvedRelativeImportCount']} | "
            f"{record['unresolvedRelativeImportCount']} |"
        )
    out.extend([
        "",
        "## 解釈上の境界",
        "",
        "このインベントリは追跡対象ファイルの現行スナップショットです。P97/P222基準の分類・到達性集計とは対象範囲が異なり、過去台帳の判定や完全なruntime呼出しグラフを置き換えません。",
        "",
    ])
    return "\n".join(out)


def expected_outputs() -> tuple[str, str, dict]:
    data = build_inventory()
    json_text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    markdown_text = render_markdown(data)
    return json_text, markdown_text, data


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true", help="regenerate both inventory reports")
    mode.add_argument("--check", action="store_true", help="verify committed reports match current tracked files")
    args = parser.parse_args()
    json_text, markdown_text, data = expected_outputs()
    expected = ((JSON_OUT, json_text), (MD_OUT, markdown_text))
    if args.write:
        for path, content in expected:
            path.write_text(content, encoding="utf-8", newline="\n")
    else:
        for path, content in expected:
            if not path.is_file():
                print(f"ERROR: missing inventory report: {path.relative_to(ROOT)}", file=sys.stderr)
                return 1
            actual = path.read_text(encoding="utf-8")
            if actual != content:
                print(f"ERROR: inventory report is stale: {path.relative_to(ROOT)}", file=sys.stderr)
                return 1
    print(json.dumps({"revision": data["inventoryRevision"], "status": "WRITTEN" if args.write else "PASS", **data["counts"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
