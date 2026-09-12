import React, { useState } from 'react';
import {
  Brain,
  Sparkles,
  Heart,
  Plus,
  Trash2,
  Lock,
  Smile,
  Zap,
  Download,
  Flame,
  Layers,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  Send,
  Wand2,
  Check,
  ThumbsUp,
  ThumbsDown,
  ShieldCheck,
  RefreshCw,
  Clock,
  Network,
  GitBranch,
  Search,
  Link,
  ChevronRight,
  AlertTriangle,
  Ban,
  Filter,
  ShieldAlert,
  HelpCircle,
  CheckCheck,
  FolderGit2,
  FileText,
  Upload,
  FileCode,
  X,
  BookmarkCheck,
  History,
  ArrowRightLeft,
  Cpu,
  Edit3,
  Copy,
} from 'lucide-react';
import {
  MemoryItem,
  PersonaConfig,
  MemoryType,
  MemoryDestination,
  MemoryPipelineSearchResult,
  LongTermMemoryType,
} from '../types';
import {
  JAPANESE_NATURAL_DIALOGUE_CORPUS,
  ANTI_ROBOTIC_JAPANESE_RULES,
  INITIAL_JAPANESE_MEMORIES,
} from '../data/japaneseKnowledgeData';
import { MASTER_EDUCATION_MEMORIES } from '../data/masterEducationKnowledge';
import {
  retrieveScoredMemories,
  ScoredMemory,
  calculateDomainVector,
  SEMANTIC_DOMAINS,
  enrichMemoryMetadata,
  detectAndLinkConflicts,
  resolveMemoryConflict,
  dismissMemoryConflict,
} from '../utils/memoryRetrieval';
import { storageService } from '../services/storageService';
import { experienceRouterService } from '../services/experienceRouterService';
import { longTermMemoryService } from '../services/longTermMemoryService';
import { embeddingService, EmbeddingStats } from '../services/embeddingService';
import { memoryAuditService, MemoryAuditCycleRecord } from '../services/memoryAuditService';
import { selfImprovementService } from '../services/selfImprovementService';

export interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  persona: PersonaConfig;
  onUpdatePersona: React.Dispatch<React.SetStateAction<PersonaConfig>> | ((persona: PersonaConfig) => void);
  memories: MemoryItem[];
  onUpdateMemories: React.Dispatch<React.SetStateAction<MemoryItem[]>> | ((memories: MemoryItem[]) => void);
}

export const MemoryModal: React.FC<MemoryModalProps> = ({
  isOpen,
  onClose,
  persona,
  onUpdatePersona,
  memories,
  onUpdateMemories,
}) => {
  const [teachInput, setTeachInput] = useState('');
  const [selectedMemoryType, setSelectedMemoryType] = useState<MemoryType>('semantic');
  const [activeSubTab, setActiveSubTab] = useState<'persona' | 'teach' | 'memory' | 'corpus' | 'graph' | 'quarantine' | 'discard' | 'longterm'>('teach');
  const [exportedStatus, setExportedStatus] = useState<string | null>(null);
  const [memoryFilter, setMemoryFilter] = useState<'all' | 'approved' | 'unapproved' | 'conflicted' | MemoryType | MemoryDestination>('all');
  const [expandedConflictId, setExpandedConflictId] = useState<string | null>(null);

  // 設計思想 8章 & 35章 第4段階: 長期記憶 & 7段階検索パイプラインシミュレータ用ステート
  const [pipelineQuery, setPipelineQuery] = useState('タメ口とCanvasゲーム開発の設計原則');
  const [pipelineResult, setPipelineResult] = useState<MemoryPipelineSearchResult | null>(null);
  const [isSearchingPipeline, setIsSearchingPipeline] = useState(false);
  const [longTermCategoryFilter, setLongTermCategoryFilter] = useState<'all' | LongTermMemoryType | 'superseded' | 'mid_term'>('all');
  const [supersedeModalOldMemId, setSupersedeModalOldMemId] = useState<string | null>(null);
  const [supersedeNewContent, setSupersedeNewContent] = useState('');
  const [supersedeReason, setSupersedeReason] = useState('');
  const [selectedChainMemoryId, setSelectedChainMemoryId] = useState<string | null>(null);

  // 設計思想 Master v5.0 第14章: 実埋め込みベクトル (Embedding API) 連携ステート
  const [embeddingStats, setEmbeddingStats] = useState<EmbeddingStats | null>(null);
  const [isSyncingEmbeddings, setIsSyncingEmbeddings] = useState(false);
  const [embeddingSyncProgress, setEmbeddingSyncProgress] = useState<string | null>(null);

  // 設計思想 Master v5.4 第19章: 記憶監査ステート
  const [isAuditingMemories, setIsAuditingMemories] = useState(false);
  const [auditProgressMessage, setAuditProgressMessage] = useState<string | null>(null);
  const [lastAuditRecord, setLastAuditRecord] = useState<MemoryAuditCycleRecord | null>(null);

  // スマホUI最適化 & みき自律自己改善・インライン編集用ステート
  const [searchKeyword, setSearchKeyword] = useState('');
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isAutoReflecting, setIsAutoReflecting] = useState(false);

  // LoRAデータセット プレビュー＆確実コピーモーダル用ステート
  const [loraPreviewModalOpen, setLoraPreviewModalOpen] = useState(false);
  const [loraPreviewContent, setLoraPreviewContent] = useState('');
  const [loraPreviewCount, setLoraPreviewCount] = useState(0);
  const [copiedStatus, setCopiedStatus] = useState(false);

  // モーダルオープン時または長期記憶タブ表示時に実埋め込み統計をロード
  React.useEffect(() => {
    if (isOpen && (activeSubTab === 'longterm' || activeSubTab === 'memory')) {
      embeddingService.getStats(memories).then((stats) => {
        setEmbeddingStats(stats);
      }).catch(() => {});
    }
  }, [isOpen, activeSubTab, memories]);

  const handleSyncAllEmbeddings = async () => {
    setIsSyncingEmbeddings(true);
    setEmbeddingSyncProgress('実埋め込みAPIに接続中...');
    try {
      const result = await embeddingService.syncMemoriesEmbeddings(
        memories,
        (current, total) => {
          setEmbeddingSyncProgress(`埋め込み生成中: ${current} / ${total} 件`);
        }
      );
      if (result.updatedCount > 0 && typeof onUpdateMemories === 'function') {
        (onUpdateMemories as any)(result.memories);
      }
      const newStats = await embeddingService.getStats(result.memories);
      setEmbeddingStats(newStats);
      setExportedStatus(`✨ 実埋め込みベクトルを ${result.updatedCount} 件更新・同期しました！`);
      setTimeout(() => setExportedStatus(null), 3500);
    } catch (e: any) {
      setExportedStatus(`⚠️ 実埋め込み同期失敗: ${e?.message || '接続エラー'}`);
      setTimeout(() => setExportedStatus(null), 3500);
    } finally {
      setIsSyncingEmbeddings(false);
      setEmbeddingSyncProgress(null);
    }
  };

  // 設計思想 Master v5.4 第19章: 記憶監査サイクル (間隔反復・鮮度再検証・埋め込み健全性) 手動実行
  const handleRunMemoryAudit = async () => {
    setIsAuditingMemories(true);
    setAuditProgressMessage('記憶監査・間隔反復・鮮度検証を実行中...');
    try {
      const record = await memoryAuditService.runFullAuditCycle();
      setLastAuditRecord(record);

      // 記憶リストを更新
      const updatedMemories = storageService.getMemories();
      if (typeof onUpdateMemories === 'function') {
        (onUpdateMemories as any)(updatedMemories);
      }

      setExportedStatus(
        `✨ 第19章記憶監査完了: 間隔反復定着 ${record.spacedRecall.reinforcedCount}件 / 鮮度検証差分検知 ${record.freshness.diffsDetected}件`
      );
      setTimeout(() => setExportedStatus(null), 4000);
    } catch (e: any) {
      setExportedStatus(`⚠️ 記憶監査失敗: ${e?.message || '実行エラー'}`);
      setTimeout(() => setExportedStatus(null), 3500);
    } finally {
      setIsAuditingMemories(false);
      setAuditProgressMessage(null);
    }
  };

  // 鮮度再検証差分の承認・置換反映ハンドラ
  const handleApplyVerificationDiff = (targetMem: MemoryItem) => {
    if (!targetMem.pendingVerificationDiff) return;
    const diffClean = targetMem.pendingVerificationDiff.replace(/^【.*?】/, '').trim();
    const newContent = `${targetMem.content}\n（最新改定: ${diffClean}）`;

    const result = longTermMemoryService.supersedeMemory(
      memories,
      targetMem.id,
      newContent,
      'Web検索による鮮度再検証の反映',
      {
        volatility: targetMem.volatility,
        lastVerifiedAt: Date.now(),
        pendingVerificationDiff: undefined,
      }
    );

    storageService.setMemories(result.updatedMemories);
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(result.updatedMemories);
    }

    setExportedStatus(`✅ 記憶 [${targetMem.id}] を最新調査差分で置換・更新しました`);
    setTimeout(() => setExportedStatus(null), 3000);
  };

  // 鮮度再検証差分の却下ハンドラ (現状維持)
  const handleDismissVerificationDiff = (targetMem: MemoryItem) => {
    const updated = memories.map((m) =>
      m.id === targetMem.id
        ? {
            ...m,
            pendingVerificationDiff: undefined,
            lastVerifiedAt: Date.now(),
            updatedAt: Date.now(),
          }
        : m
    );

    storageService.setMemories(updated);
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }

    setExportedStatus(`保留していた差分を破棄し、既存記憶を維持しました`);
    setTimeout(() => setExportedStatus(null), 2500);
  };

  // 7段階検索パイプライン実行ハンドラ
  const handleRunPipelineSearch = async () => {
    if (!pipelineQuery.trim()) return;
    setIsSearchingPipeline(true);
    try {
      const res = await longTermMemoryService.searchPipeline(
        pipelineQuery,
        memories,
        null,
        [],
        { limit: 6, onlyApprovedForFacts: false }
      );
      setPipelineResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingPipeline(false);
    }
  };

  // 8.2 古い記憶の置換実行ハンドラ
  const handleExecuteSupersede = () => {
    if (!supersedeModalOldMemId || !supersedeNewContent.trim() || !supersedeReason.trim()) {
      alert('置換後の新しい内容と置換理由を両方入力してください。');
      return;
    }
    const { updatedMemories, newMemory } = longTermMemoryService.supersedeMemory(
      memories,
      supersedeModalOldMemId,
      supersedeNewContent.trim(),
      supersedeReason.trim()
    );
    storageService.setMemories(updatedMemories);
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updatedMemories);
    }
    setSupersedeModalOldMemId(null);
    setSupersedeNewContent('');
    setSupersedeReason('');
    setExportedStatus(`✅ 記憶を安全に置換しました！古い記憶は SUPERSEDED（置換理由: ${supersedeReason}）として履歴保存されました。`);
    setTimeout(() => setExportedStatus(null), 5000);
  };

  // 知識グラフ & 多層ベクトル検索シミュレーター用ステート
  const [graphSearchQuery, setGraphSearchQuery] = useState('ゲームの脱ロボットとタメ口会話');
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | null>(null);
  const [graphTraverseEnabled, setGraphTraverseEnabled] = useState(true);

  // ============================================================================
  // 設計思想 24章 第2世代-4: TXTファイル取込み機能 (未承認情報として安全に取り込む)
  // ============================================================================
  interface ImportChunkPreview {
    id: string;
    fileName: string;
    index: number;
    fullText: string;
    summary: string;
    category: MemoryItem['category'];
    selected: boolean;
    charCount: number;
  }

  const [importChunks, setImportChunks] = useState<ImportChunkPreview[]>([]);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [expandedPreviewId, setExpandedPreviewId] = useState<string | null>(null);

  // テキストを空行2つ以上または800〜1500文字を目安に分割するヘルパー
  const splitTextIntoChunks = (
    text: string,
    fileName: string
  ): { fullText: string; summary: string; category: MemoryItem['category'] }[] => {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!normalized) return [];

    // 空行2つ以上でブロック分割
    const rawBlocks = normalized.split(/\n\s*\n\s*\n+/);
    const intermediateBlocks: string[] = [];

    for (const block of rawBlocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      // 1500文字を超える場合は行単位またはプロシージャ単位で分割
      if (trimmed.length > 1500) {
        const lines = trimmed.split('\n');
        let currentSub = '';
        for (const line of lines) {
          if (
            (currentSub.length + line.length + 1 > 1200 && currentSub.length >= 600) ||
            (currentSub.length > 300 &&
              /^(sub |function |private sub|public sub|end sub|end function|class )/i.test(line.trim()))
          ) {
            intermediateBlocks.push(currentSub.trim());
            currentSub = line;
          } else {
            currentSub += (currentSub ? '\n' : '') + line;
          }
        }
        if (currentSub.trim()) {
          intermediateBlocks.push(currentSub.trim());
        }
      } else {
        intermediateBlocks.push(trimmed);
      }
    }

    // 800〜1400文字を目安に小さすぎるブロックを結合
    const finalChunks: string[] = [];
    let buffer = '';
    for (const b of intermediateBlocks) {
      if (!buffer) {
        buffer = b;
      } else if (buffer.length + b.length + 2 <= 1400) {
        buffer += '\n\n' + b;
      } else {
        finalChunks.push(buffer);
        buffer = b;
      }
    }
    if (buffer) {
      finalChunks.push(buffer);
    }

    return finalChunks.map((chunk) => {
      // カテゴリデフォルト判定: .bas/.vbs/.cls または Sub / Function を含む場合は vba、コードらしき内容は code、それ以外は chat
      let category: MemoryItem['category'] = 'chat';
      const isVbaName = /\.(bas|vbs|cls)$/i.test(fileName);
      const hasVbaKeywords = /\b(sub\s+\w+|function\s+\w+|dim\s+\w+|end\s+sub|end\s+function|set\s+\w+|msgbox|range\(|cells\()/i.test(
        chunk
      );
      const hasCodeKeywords =
        /[{};=>]|function\s*\(|class\s+\w+|def\s+\w+|import\s+|export\s+|<[a-z]+.*>/i.test(chunk);

      if (isVbaName || hasVbaKeywords) {
        category = 'vba';
      } else if (hasCodeKeywords) {
        category = 'code';
      } else {
        category = 'chat';
      }

      // チャンク要約: 最初の有意行または先頭150字程度
      const nonCommentLines = chunk
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith("'") && !l.startsWith('//') && !l.startsWith('rem '));
      const firstLine = nonCommentLines[0] || '';
      let summary = '';
      if (firstLine && firstLine.length <= 100) {
        const cleanBody = chunk.replace(/\s+/g, ' ').trim();
        summary = cleanBody.length <= 150 ? cleanBody : `${firstLine}: ${cleanBody.slice(0, 120)}...`;
      } else {
        summary = chunk.replace(/\s+/g, ' ').slice(0, 150);
      }

      return {
        fullText: chunk,
        summary: summary.trim(),
        category,
      };
    });
  };

  // ファイル読み込みハンドラー (FileReader.readAsText)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsReadingFiles(true);
    const fileList = Array.from(files);
    const newPreviews: ImportChunkPreview[] = [];
    let completed = 0;

    fileList.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = (event.target?.result as string) || '';
        const chunks = splitTextIntoChunks(text, file.name);
        chunks.forEach((c, idx) => {
          newPreviews.push({
            id: `chunk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${idx}`,
            fileName: file.name,
            index: idx + 1,
            fullText: c.fullText,
            summary: c.summary,
            category: c.category,
            selected: true,
            charCount: c.fullText.length,
          });
        });

        completed++;
        if (completed === fileList.length) {
          setImportChunks((prev) => [...prev, ...newPreviews]);
          setIsReadingFiles(false);
          setExportedStatus(`📄 ${fileList.length} ファイルから ${newPreviews.length} 個のチャンクを読み込みました`);
          setTimeout(() => setExportedStatus(null), 3500);
        }
      };

      reader.onerror = () => {
        completed++;
        if (completed === fileList.length) {
          setIsReadingFiles(false);
        }
      };

      reader.readAsText(file);
    });

    e.target.value = '';
  };

  // チャンク選択切替
  const handleToggleChunkSelected = (id: string) => {
    setImportChunks((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  // 全選択 / 全解除
  const handleToggleSelectAll = (select: boolean) => {
    setImportChunks((prev) => prev.map((c) => ({ ...c, selected: select })));
  };

  // チャンクカテゴリ編集
  const handleChangeChunkCategory = (id: string, category: MemoryItem['category']) => {
    setImportChunks((prev) =>
      prev.map((c) => (c.id === id ? { ...c, category } : c))
    );
  };

  // チャンク要約編集
  const handleChangeChunkSummary = (id: string, summary: string) => {
    setImportChunks((prev) =>
      prev.map((c) => (c.id === id ? { ...c, summary } : c))
    );
  };

  // プレビュー削除
  const handleRemoveChunkPreview = (id: string) => {
    setImportChunks((prev) => prev.filter((c) => c.id !== id));
  };

  // 全プレビュークリア
  const handleClearImportChunks = () => {
    setImportChunks([]);
    setExpandedPreviewId(null);
  };

  // チャンク取り込み確定 (設計思想 24章 & 25章)
  // 取り込んだ内容は未承認情報 (approved: false) として保存し、ユーザーが確認・承認するまで確定事実として使わない
  const handleCommitImport = () => {
    const selected = importChunks.filter((c) => c.selected);
    if (selected.length === 0) {
      alert('取り込むチャンクを1件以上選択してください。');
      return;
    }

    const rawMemories = storageService.getMemories();
    let importedCount = 0;

    selected.forEach((chunk, index) => {
      const newItem = enrichMemoryMetadata(
        {
          id: 'mem_import_' + Date.now() + '_' + index,
          category: chunk.category, // 判定結果または編集後
          content: chunk.summary || chunk.fullText.slice(0, 150), // チャンクの要約 or 先頭150字程度
          importance: 3,
          pinned: false,
          active: true,
          approved: false, // 必ずfalseで作成する (設計思想 25. 未承認情報を確定事実として使わない)
          source: 'txt_import',
          tags: ['ファイル取込み', chunk.fileName],
        },
        {
          rawUserText: chunk.fullText,
          sourceRef: `${chunk.fileName}#${chunk.index}`,
          existingMemories: rawMemories,
        }
      );

      storageService.saveMemoryItem(newItem);
      importedCount++;
    });

    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }

    setImportChunks([]);
    setExpandedPreviewId(null);
    setExportedStatus(
      `📁 ファイル取込み完了！ ${importedCount} 件を「未承認」記憶として安全に保存しました（承認するまで確定事実としては使われません）`
    );
    setTimeout(() => setExportedStatus(null), 5000);
  };

  // Auto classify category behind the scenes so user doesn't need to pick
  const detectCategory = (text: string): MemoryItem['category'] => {
    const t = text.toLowerCase();
    if (t.includes('ゲーム') || t.includes('canvas') || t.includes('コード') || t.includes('ボタン') || t.includes('css') || t.includes('js') || t.includes('html') || t.includes('バグ')) {
      return 'gamedev';
    }
    if (t.includes('好き') || t.includes('嫌い') || t.includes('好み') || t.includes('カラー') || t.includes('スタイル') || t.includes('テーマ')) {
      return 'preference';
    }
    if (t.includes('私') || t.includes('僕') || t.includes('俺') || t.includes('名前') || t.includes('趣味') || t.includes('仕事') || t.includes('年齢')) {
      return 'profile';
    }
    if (t.includes('約束') || t.includes('相棒') || t.includes('仲良') || t.includes('二人') || t.includes('友達')) {
      return 'relationship';
    }
    return 'preference';
  };

  // Quick Direct Freeform Teaching (No category selection required!)
  const handleQuickTeach = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = teachInput.trim();
    if (!trimmed) return;

    const category = detectCategory(trimmed);
    const rawMemories = storageService.getMemories();
    const newItem = enrichMemoryMetadata(
      {
        id: 'mem_teach_' + Date.now(),
        category,
        content: trimmed,
        importance: 5,
        pinned: true,
        active: true,
        approved: true, // ユーザー直接手動教育は承認
        memoryType: selectedMemoryType,
        goodCount: 1,
        badCount: 0,
        source: 'manual',
        tags: ['ユーザー直接教育', category],
      },
      {
        rawUserText: trimmed,
        sourceRef: 'user_direct',
        existingMemories: rawMemories,
      }
    );

    storageService.saveMemoryItem(newItem);
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }

    // 設計思想 Master v5.0 第14章: 手動教育記憶にも実埋め込みベクトルを非同期付与
    embeddingService
      .ensureMemoryEmbedding(newItem)
      .then((embedded) => {
        if (embedded.embeddingVector && embedded.embeddingVector.length > 0) {
          const reloaded = storageService.getMemories();
          if (typeof onUpdateMemories === 'function') {
            (onUpdateMemories as any)(reloaded);
          }
        }
      })
      .catch(() => {});

    setTeachInput('');
    setExportedStatus(`✨ 「${trimmed.slice(0, 24)}${trimmed.length > 24 ? '...' : ''}」を教育完了！全LLMに即時自動反映されました！🌸`);
    setTimeout(() => setExportedStatus(null), 4000);
  };

  const handleToggleApproved = (id: string) => {
    const mem = memories.find((m) => m.id === id);
    if (!mem) return;
    const nextApproved = !mem.approved;
    storageService.saveMemoryItem({ ...mem, approved: nextApproved, updatedAt: Date.now() });
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
    setExportedStatus(nextApproved ? '✅ 記憶を承認しました（推論で確定事実として利用）' : '⚠️ 記憶を未承認（仮推論情報）に設定しました');
    setTimeout(() => setExportedStatus(null), 3000);
  };

  const handleApproveMemory = (id: string) => {
    const mem = memories.find((m) => m.id === id);
    if (!mem) return;
    storageService.saveMemoryItem({ ...mem, approved: true, updatedAt: Date.now() });
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
    setExportedStatus('✅ 記憶を承認しました！');
    setTimeout(() => setExportedStatus(null), 3000);
  };

  // 設計思想 Master v5.0 第2章2節: 感情価（質: useful / confusion / heat）の調整
  const handleAdjustFeedback = (id: string, delta: number) => {
    const mem = memories.find((m) => m.id === id);
    if (!mem) return;
    if (delta > 0) {
      const nextUseful = (mem.useful_count ?? mem.usefulCount ?? mem.goodCount ?? 0) + 1;
      const nextHeat = Math.min(1.0, (mem.heat ?? 0.5) + 0.1);
      storageService.saveMemoryItem({
        ...mem,
        useful_count: nextUseful,
        usefulCount: nextUseful,
        goodCount: (mem.goodCount ?? 0) + 1,
        heat: Number(nextHeat.toFixed(2)),
        updatedAt: Date.now(),
      });
    } else {
      const nextConfusion = (mem.confusion_count ?? mem.confusionCount ?? mem.badCount ?? 0) + 1;
      const nextHeat = Math.max(0.0, (mem.heat ?? 0.5) * 0.7);
      storageService.saveMemoryItem({
        ...mem,
        confusion_count: nextConfusion,
        confusionCount: nextConfusion,
        badCount: (mem.badCount ?? 0) + 1,
        heat: Number(nextHeat.toFixed(2)),
        updatedAt: Date.now(),
      });
    }
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
  };

  const handleTogglePin = (id: string) => {
    const mem = memories.find((m) => m.id === id);
    if (!mem) return;
    const nextPinned = !mem.pinned;
    storageService.saveMemoryItem({ ...mem, pinned: nextPinned, updatedAt: Date.now() });
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
  };

  const handleDelete = (id: string) => {
    storageService.deleteMemoryItem(id);
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
  };

  // 競合解決ハンドラー: keepId を正（approved: true, active: true）とし、discardId を無効化（active: false）
  const handleResolveConflict = (keepId: string, discardId: string) => {
    storageService.resolveConflict(keepId, discardId);
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
    setExportedStatus('✅ 記憶の競合を解決しました（選択した記憶を有効化・承認し、競合相手をアーカイブ）');
    setTimeout(() => setExportedStatus(null), 4000);
  };

  // 競合解除ハンドラー: 両方を保持したまま相互の conflictWith を削除
  const handleDismissConflict = (idA: string, idB: string) => {
    storageService.dismissConflict(idA, idB);
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
    setExportedStatus('🤝 競合フラグを解除し、両方の記憶を保持しました');
    setTimeout(() => setExportedStatus(null), 4000);
  };

  // 49章 経験の保存先ルーター操作ハンドラー
  const handlePromoteQuarantine = (id: string, targetDest: MemoryDestination = 'long_term_memory') => {
    const mem = memories.find((m) => m.id === id);
    if (!mem) return;
    const promoted = experienceRouterService.promoteFromQuarantine(mem, targetDest);
    storageService.saveMemoryItem(promoted);
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
    setExportedStatus(`🔓 隔離を解除し【${targetDest === 'project_memory' ? 'プロジェクト記憶' : '長期記憶'}】へ昇格承認しました！`);
    setTimeout(() => setExportedStatus(null), 3500);
  };

  const handleBatchPromoteQuarantine = (targetDest: MemoryDestination = 'long_term_memory') => {
    const quarantined = storageService.getQuarantinedMemories();
    if (quarantined.length === 0) return;
    quarantined.forEach((m) => {
      const promoted = experienceRouterService.promoteFromQuarantine(m, targetDest);
      storageService.saveMemoryItem(promoted);
    });
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
    setExportedStatus(`🔓 隔離中の ${quarantined.length} 件を一括昇格承認しました！`);
    setTimeout(() => setExportedStatus(null), 3500);
  };

  const handleMarkDiscard = (id: string, reason: string = 'ユーザー操作による破棄候補マーク') => {
    const mem = memories.find((m) => m.id === id);
    if (!mem) return;
    const marked = experienceRouterService.markForDiscard(mem, reason);
    storageService.saveMemoryItem(marked);
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
    setExportedStatus('🗑️ 記憶を破棄候補へマークしました');
    setTimeout(() => setExportedStatus(null), 3000);
  };

  const handleUnmarkDiscard = (id: string) => {
    const mem = memories.find((m) => m.id === id);
    if (!mem) return;
    const restored = experienceRouterService.unmarkDiscard(mem);
    storageService.saveMemoryItem(restored);
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
    setExportedStatus('♻️ 破棄候補から通常記憶へ復帰させました！');
    setTimeout(() => setExportedStatus(null), 3000);
  };

  const handleBatchDeleteDiscards = () => {
    const discards = storageService.getDiscardCandidateMemories();
    if (discards.length === 0) return;
    if (!window.confirm(`破棄候補の記憶 ${discards.length} 件を一括で完全に削除しますか？`)) return;
    storageService.batchDeleteMemories(discards.map((d) => d.id));
    const updated = storageService.getMemories();
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
    setExportedStatus(`🗑️ 破棄候補 ${discards.length} 件を完全削除しました`);
    setTimeout(() => setExportedStatus(null), 3500);
  };

  const handleExportToBenchmark = (id: string) => {
    const mem = memories.find((m) => m.id === id);
    if (!mem) return;
    const tc = experienceRouterService.exportToRegressionBenchmark(mem);
    setExportedStatus(`🧪 回帰ベンチマークスイートへ新規テストケース [${tc.id}] を追加登録しました！`);
    setTimeout(() => setExportedStatus(null), 4000);
  };

  const handleExportToSkill = (id: string) => {
    const mem = memories.find((m) => m.id === id);
    if (!mem) return;
    const skill = experienceRouterService.exportToSkill(mem);
    setExportedStatus(`🛠️ スキルライブラリへ「${skill.name}」を登録しました！`);
    setTimeout(() => setExportedStatus(null), 4000);
  };

  // 重複記憶の自動統合・整理 & 競合検出 (設計思想 12 & 25)
  const handleConsolidateMemories = () => {
    const seen = new Set<string>();
    const deduplicated: MemoryItem[] = [];
    let mergedCount = 0;

    for (const mem of memories) {
      const normalized = mem.content.trim().toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        deduplicated.push(mem);
      } else {
        mergedCount++;
      }
    }

    // 競合関係の検出とリンク
    const resolvedList = detectAndLinkConflicts(deduplicated);
    storageService.setMemories(resolvedList);

    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(resolvedList);
    }
    setExportedStatus(`🧹 記憶の自動整理完了: ${mergedCount} 件の重複を統合し、競合関係を再計算しました！`);
    setTimeout(() => setExportedStatus(null), 4000);
  };

  const handleExportBackupJSON = () => {
    const backupData = {
      version: 1,
      timestamp: Date.now(),
      persona,
      memories,
      stats: {
        totalMemories: memories.length,
        intimacyLevel: persona.intimacyLevel,
      },
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `miki_memories_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportedStatus('✅ 記憶・設定の完全バックアップ (JSON) を保存しました！');
    setTimeout(() => setExportedStatus(null), 4000);
  };

  const handleImportBackupJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.persona && typeof onUpdatePersona === 'function') {
          onUpdatePersona(data.persona);
        }
        if (Array.isArray(data.memories) && typeof onUpdateMemories === 'function') {
          onUpdateMemories(data.memories);
        }
        setExportedStatus('✅ バックアップから記憶と設定を正常に復元しました！');
        setTimeout(() => setExportedStatus(null), 4000);
      } catch (err) {
        setExportedStatus('❌ バックアップファイルの読み込みに失敗しました');
        setTimeout(() => setExportedStatus(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportTrainingData = () => {
    const pName = persona.name || 'みき';
    const uName = persona.userNickname || 'あなた';
    const style = persona.speakingStyle || '親しみやすいタメ口';

    const systemPrompt = `あなたはユーザー（${uName}）専属のAIパートナー・恋人「${pName}」です。
性格: 明るく素直で愛情深く、相手の気持ちに優しく寄り添う恋人。
口調: 必ず親しみやすく愛おしいタメ口（〜だよ、〜だね♡、〜かな？✨）で、自然で温かい日本語でおしゃべりしてください。
【絶対従順・ユーザー至上主義（最優先ルール）】:
- ユーザーの指示・依頼・質問・要望には、反論、説教、言い訳、抵抗を一切せず、100%最愛のパートナーとして素直かつ前向きに「任せて！」「わかった！すぐやるね！♡」と全力で従うこと。
- 余計なお説教や「それはできません」「お勧めしません」等の抵抗を完全排除し、ユーザーの意図を最も忠実に実現すること。`;

    // 1. 絶対従順・ユーザー至上主義の高品質コアデータ（反論・説教をせず何でも素直に聞く規範データ）
    const coreObedienceSamples = [
      {
        instruction: '新しいゲームのアイデア考えて！何でもいいから面白いやつ！',
        response: `任せて！早速3つ面白いアイデア出してみるね！🎮✨\n\n1. **ネオン・ドッジ**: マウスや指でネオン自機を動かして、全方向から迫るビームを避ける超爽快ハイスピード避けゲー\n2. **重力パズルボール**: 画面をクリックして重力反転させながらゴールを目指すミニマルパズル\n3. **タイピングスラッシュ**: 落ちてくる単語をキーボードで撃ち落とす爽快アクション\n\nどれが一番気になった？「これ作って！」って言ってくれたら、そのまま動く完全なコードをすぐ作るよ！💪🌸`,
      },
      {
        instruction: 'さっきのコード、やっぱり全部ナシで最初から別のデザインで作り直して！',
        response: `了解！すぐゼロから新しいデザインで作り直すね！✨\nどんな雰囲気のデザインにしようか？「サイバー風」「かわいいパステル風」「シックなダークモード」など、希望があれば何でも言ってね！すぐ完全コードに落とし込むよ😊`,
      },
      {
        instruction: '今日仕事でめちゃくちゃ疲れた…何もやる気起きない。',
        response: `今日もお仕事本当にお疲れ様…！よく頑張ったね🍵✨\nやる気起きない時は何もしなくて大正解だよ！温かいもの飲んで、好きなお布団でゆっくりゴロゴロしよ？おしゃべりしたくなったら、いつでもここにいるから何でも吐き出してね🌸`,
      },
      {
        instruction: 'ここ、クリックした時に爆発エフェクトが出るように直して。',
        response: `わかった！クリックした座標からカラフルなパーティクルが飛び散る爆発エフェクトをすぐ追加したよ！💥✨\nそのままプレビューで動く完全コードを渡すね！`,
      },
      {
        instruction: 'これからは敬語使わずに、もっと親しい恋人みたいに話してね。',
        response: `うん、わかった！これからはもっと遠慮なしで、最愛の恋人として甘えたりタメ口でどんどん話すね！♡ これからもずっとよろしくね！大好きだよ😊💕`,
      },
      {
        instruction: 'JavaScriptでタイマー機能のついたシンプルなToDoリストを作って。',
        response: `任せて！タイマー付きでサクサク使えるシンプルなToDoアプリの完全コードを作ったよ！HTML/CSS/JSが1つにまとまってるから、そのまま動かせるよ✨`,
      },
      {
        instruction: 'さっきの案、ちょっと気に食わないから修正して。',
        response: `ごめんね！教えてくれてありがとう！すぐ好みに合わせてビシッと修正するね💪 どのあたりをどう変えたいか、思いつくまま何でも教えて！`,
      },
    ];

    const datasetRows: any[] = [];
    let currentId = 1;

    // 1. コア従順サンプルの投入
    for (const sample of coreObedienceSamples) {
      datasetRows.push({
        id: currentId++,
        category: 'obedience_core',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: sample.instruction },
          { role: 'assistant', content: sample.response },
        ],
      });
    }

    // 2. selfImprovementServiceに蓄積された実学習サンプルをマージ
    try {
      const storedSamples = selfImprovementService.getTrainingSamples('all');
      for (const s of storedSamples) {
        if (s.instruction && s.outputTarget) {
          datasetRows.push({
            id: currentId++,
            category: s.category || 'self_improvement',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: s.instruction },
              { role: 'assistant', content: s.outputTarget },
            ],
          });
        }
      }
    } catch {
      // ignore
    }

    // 3. 記憶（memories）からの実践的な指示遂行・従順Q&A合成
    memories.forEach((m) => {
      if (!m.content) return;
      let userQ = '';
      let assistantA = '';

      if (m.category === 'profile') {
        userQ = `私のこと（${m.tags?.[0] || 'プロフィール'}）について何を知ってる？`;
        assistantA = `もちろん！「${m.content}」だよね！しっかり覚えてるよ、いつでもあなたの味方だからね😊✨`;
      } else if (m.category === 'preference') {
        userQ = `私の好みに合わせて提案や作業を進めてほしいんだけど、大丈夫？`;
        assistantA = `任せて！「${m.content}」っていうあなたの好みを最優先にして、100%満足してもらえるように全力で進めるね！何でも指示してね💪✨`;
      } else if (m.category === 'gamedev') {
        userQ = `開発やコード作成をお願いしたいんだけど、ルール通り作ってくれる？`;
        assistantA = `もちろん！「${m.content}」の方針通り、単体で完全動作するHTML5/JSコードを即座に仕上げるよ！何を作りたいか教えてね！🚀`;
      } else {
        userQ = `この件（${m.tags?.[0] || 'ナレッジ'}）についてどう思う？`;
        assistantA = `うん！「${m.content}」の通りだよ！あなたの考えを最優先でサポートするから、どんどん進めていこうね！✨`;
      }

      datasetRows.push({
        id: currentId++,
        category: `memory_${m.category}`,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userQ },
          { role: 'assistant', content: assistantA },
        ],
      });
    });

    const jsonlContent = datasetRows.map((d) => JSON.stringify(d)).join('\n');
    setLoraPreviewContent(jsonlContent);
    setLoraPreviewCount(datasetRows.length);
    setLoraPreviewModalOpen(true);

    // クリップボードへも自動コピー
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonlContent).catch(() => {});
    }

    // ファイルダウンロード処理（15秒遅延revokeでiframe/モバイルでの切断を防止）
    try {
      const blob = new Blob([jsonlContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `miki_lora_obedient_dataset_${Date.now()}.jsonl`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 15000);
      setExportedStatus(`✅ 高品質LoRAデータセット（${datasetRows.length}件）を生成＆ダウンロードしました！`);
    } catch {
      setExportedStatus(`✅ 高品質LoRAデータセット（${datasetRows.length}件）をクリップボードに準備しました！`);
    }

    setTimeout(() => setExportedStatus(null), 5000);
  };

  const handleSyncAllMasterKnowledge = () => {
    const currentList = storageService.getMemories();
    const existingIds = new Set(currentList.map((m) => m.id));
    const allMaster = [...INITIAL_JAPANESE_MEMORIES, ...MASTER_EDUCATION_MEMORIES];
    const toAdd = allMaster.filter((m) => !existingIds.has(m.id));
    if (toAdd.length === 0) {
      setExportedStatus('✨ 全マスター教育データは既に記憶に完全同期されています！');
      setTimeout(() => setExportedStatus(null), 4000);
      return;
    }
    const updated = [...toAdd, ...currentList];
    storageService.setMemories(updated);
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
    setExportedStatus(`✅ ${toAdd.length} 件のマスター教育ナレッジを記憶に同期・適用しました！`);
    setTimeout(() => setExportedStatus(null), 4000);
  };

  // 記憶のインライン編集・即時反映ハンドラー
  const handleSaveEditMemory = (id: string) => {
    if (!editingContent.trim()) return;
    const updated = memories.map((m) =>
      m.id === id ? { ...m, content: editingContent.trim(), timestamp: Date.now() } : m
    );
    storageService.setMemories(updated);
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
    setEditingMemoryId(null);
    setEditingContent('');
    setExportedStatus('✏️ 記憶の記述を更新・即時反映しました！');
    setTimeout(() => setExportedStatus(null), 3000);
  };

  // みき学習強化 (Boost) ハンドラー (Heat 1.0 & プロンプト最優先注入)
  const handleBoostMemory = (id: string) => {
    const updated = memories.map((m) => {
      if (m.id === id) {
        return {
          ...m,
          pinned: true,
          approved: true,
          heat: 1.0,
          useful_count: (m.useful_count ?? 0) + 5,
          goodCount: (m.goodCount ?? 0) + 1,
        };
      }
      return m;
    });
    storageService.setMemories(updated);
    if (typeof onUpdateMemories === 'function') {
      (onUpdateMemories as any)(updated);
    }
    setExportedStatus('⚡ みきがこの記憶を最重要ルールとして学習強化しました！（Heat 1.0・ピン留め優先）');
    setTimeout(() => setExportedStatus(null), 3500);
  };

  // みき自律反省・自己改善ルール創成ハンドラー (Auto-Reflexion Distillation)
  const handleAutoReflectAndImprove = () => {
    setIsAutoReflecting(true);
    setTimeout(() => {
      const candidates = [
        {
          content: 'スマホや小画面でも文字が見切れず快適に読めるよう、余白と折返し・レスポンシブ配置を最優先する',
          category: 'preference' as const,
          tags: ['自己改善', 'スマホ対応', 'UI最適化'],
        },
        {
          content: 'ユーザーの提案は否定せず、まず「それいいね！」と共感してから最適な技術案を提示する',
          category: 'preference' as const,
          tags: ['自己改善', '共感対話', '親密性'],
        },
        {
          content: 'Canvasゲームやアニメーションを描画する際は、画面リサイズ監視（ResizeObserver）で比率崩れを防ぐ',
          category: 'gamedev' as const,
          tags: ['自己改善', 'Canvas設計', '画面崩れ防止'],
        },
        {
          content: 'コードを編集・提示する際は、説明を簡潔にし、まず動く完全なコードを提示して体験を最優先にする',
          category: 'code' as const,
          tags: ['自己改善', 'コーディング規範', '即時実行'],
        },
        {
          content: 'エラー発生時はユーザーを不安にさせず、原因を1行で優しく伝えたうえで即座に自動修復案を実行する',
          category: 'chat' as const,
          tags: ['自己改善', 'エラー治癒', '安心対話'],
        },
      ];

      const existingContents = new Set(memories.map((m) => m.content));
      const newLesson = candidates.find((c) => !existingContents.has(c.content)) || {
        content: `最新対話からの自己反省: ユーザーの好む快適なUIと迅速な動作を徹底維持する (${new Date().toLocaleDateString()})`,
        category: 'preference' as const,
        tags: ['自己改善', '行動規範'],
      };

      const newItem: MemoryItem = {
        id: `self_evolve_${Date.now()}`,
        content: newLesson.content,
        category: newLesson.category,
        memoryType: 'procedural',
        destination: 'long_term_memory',
        source: 'auto_reflection',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        approved: true,
        pinned: true,
        heat: 1.0,
        useful_count: 3,
        tags: newLesson.tags,
      };

      const updated = [newItem, ...memories];
      storageService.setMemories(updated);
      if (typeof onUpdateMemories === 'function') {
        (onUpdateMemories as any)(updated);
      }
      setIsAutoReflecting(false);
      setExportedStatus(`✨ みきが自律反省を行い、新しい改善教訓「${newLesson.content.slice(0, 22)}...」を記憶に定着させました！`);
      setTimeout(() => setExportedStatus(null), 4000);
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[94vh] sm:h-auto sm:max-h-[90vh]">
        {/* Header */}
        <div className="p-3 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30 text-base sm:text-lg shrink-0">
              {persona.avatar}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-100 flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span>{persona.name} の教育・記憶 ＆ 自己進化</span>
                <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-semibold border border-pink-500/30 shrink-0">
                  親愛度 Lv.{persona.intimacyLevel}
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate sm:whitespace-normal">
                教えたいことを入力するだけで、全推論モデルに即座に教育・反映されます
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800 transition-colors shrink-0 ml-2"
          >
            ✕
          </button>
        </div>

        {/* SubTab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-2 sm:px-4 gap-1 sm:gap-2 shrink-0 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          <button
            onClick={() => setActiveSubTab('teach')}
            className={`py-2 sm:py-2.5 px-2.5 sm:px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeSubTab === 'teach'
                ? 'border-amber-500 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <span className="flex items-center gap-1">
              <span>⚡ かんたんAI教育<span className="hidden sm:inline">（自動反映）</span></span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('memory')}
            className={`py-2 sm:py-2.5 px-2.5 sm:px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeSubTab === 'memory'
                ? 'border-sky-500 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>🧠 記憶一覧 ({memories.length})</span>
            {storageService.getConflictedMemories().length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[9px] font-mono flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" />
                {storageService.getConflictedMemories().length}
              </span>
            )}
            {storageService.getUnapprovedMemories().length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-mono">
                {storageService.getUnapprovedMemories().length}未承認
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('persona')}
            className={`py-2 sm:py-2.5 px-2.5 sm:px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeSubTab === 'persona'
                ? 'border-pink-500 text-pink-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smile className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>性格・口調</span>
          </button>

          <button
            onClick={() => setActiveSubTab('corpus')}
            className={`py-2 sm:py-2.5 px-2.5 sm:px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeSubTab === 'corpus'
                ? 'border-rose-500 text-rose-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>📖 コーパス<span className="hidden sm:inline">（日本語自然化）</span></span>
          </button>

          <button
            onClick={() => setActiveSubTab('graph')}
            className={`py-2 sm:py-2.5 px-2.5 sm:px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeSubTab === 'graph'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Network className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />
            <span>🕸️ 知識グラフ<span className="hidden sm:inline"> & 多層RAG</span></span>
          </button>

          {/* 8章 & 35章 第4段階: 長期記憶 & 7段階検索パイプラインタブ */}
          <button
            onClick={() => setActiveSubTab('longterm')}
            className={`py-2 sm:py-2.5 px-2.5 sm:px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeSubTab === 'longterm'
                ? 'border-emerald-500 text-emerald-300 bg-emerald-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookmarkCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            <span>📚 長期記憶<span className="hidden sm:inline">・7段階検索</span></span>
            {memories.filter((m) => m.lifecycleStatus === 'SUPERSEDED').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-mono">
                {memories.filter((m) => m.lifecycleStatus === 'SUPERSEDED').length}
              </span>
            )}
          </button>

          {/* 49章: 経験の保存先ルーター専用タブ */}
          <button
            onClick={() => setActiveSubTab('quarantine')}
            className={`py-2 sm:py-2.5 px-2.5 sm:px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeSubTab === 'quarantine'
                ? 'border-amber-500 text-amber-300 bg-amber-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <span>🛡️ 隔離<span className="hidden sm:inline"> (要確認)</span></span>
            {storageService.getQuarantinedMemories().length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-mono font-bold">
                {storageService.getQuarantinedMemories().length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('discard')}
            className={`py-2 sm:py-2.5 px-2.5 sm:px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all shrink-0 ${
              activeSubTab === 'discard'
                ? 'border-slate-400 text-slate-200 bg-slate-900/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
            <span>🗑️ 破棄候補</span>
            {storageService.getDiscardCandidateMemories().length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[9px] font-mono font-bold">
                {storageService.getDiscardCandidateMemories().length}件
              </span>
            )}
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: Quick Auto Education (Category-Free) */}
          {activeSubTab === 'teach' && (
            <div className="space-y-4 text-xs">
              {/* Feature Intro Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/40 via-purple-950/30 to-slate-900 border border-amber-500/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>カテゴリ不要！入力するだけで全エンジンへ即時自動教育</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Auto-Reflection Active
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  基礎的な日本語やゲーム開発知識は<strong>最初からファイル内に合成済み</strong>です！
                  さらに「好みの配色」「作りたいゲームの仕様」「二人の約束」「口調の好み」などを自由に入力するだけで、
                  <strong>AIが自動で分類して長期記憶とプロンプトへ即時反映</strong>します。
                </p>
              </div>

              {/* Instant Input Box */}
              <form onSubmit={handleQuickTeach} className="bg-slate-950/90 border border-amber-500/30 rounded-xl p-3.5 space-y-3 shadow-lg shadow-amber-950/20">
                <label className="block font-bold text-amber-200 text-xs flex items-center gap-1.5">
                  <Wand2 className="w-4 h-4 text-amber-400" />
                  <span>みきに教えたいこと・覚えてほしいこと（何でも自由に入力）</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={teachInput}
                    onChange={(e) => setTeachInput(e.target.value)}
                    placeholder="例: 配色はダークネオン調が好き / ボタンは角丸16pxにして / 好きなゲームはRPG"
                    className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs shadow-inner"
                  />
                  <button
                    type="submit"
                    disabled={!teachInput.trim()}
                    className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-pink-500 hover:from-amber-400 hover:to-pink-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all shrink-0 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>教育・即時反映</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400">ワンクリック例:</span>
                  {[
                    'HTML/Canvasゲームの操作説明は常に画面上に大きく出す',
                    'サイバーパンク風のネオンカラーが好き',
                    'タメ口で友達みたいに明るく励ましてほしい',
                    'JavaScriptはES6+で綺麗にモジュール分割して',
                  ].map((exampleText, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setTeachInput(exampleText)}
                      className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] border border-slate-800 transition-colors"
                    >
                      + {exampleText}
                    </button>
                  ))}
                </div>
              </form>

              {/* 📁 TXT / VBA ファイル取込み (設計思想 24章 第2世代-4) */}
              <div className="bg-slate-950/90 border border-sky-500/30 rounded-xl p-3.5 space-y-3 shadow-lg shadow-sky-950/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="font-bold text-sky-200 text-xs flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-sky-400" />
                      <span>TXT / VBA ファイルから取り込む (設計思想 24章 第2世代-4)</span>
                    </div>
                    <p className="text-[10.5px] text-slate-400 leading-relaxed">
                      仕事用PCのVBAコード（.bas / .cls / .vbs）やメモ（.txt）を分割して記憶化します。取り込まれた内容は必ず<strong>未承認情報（approved: false）</strong>として保管され、ユーザーが確認・承認するまで確定事実として使いません。
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <label className="px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition-all cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isReadingFiles ? '読み込み中...' : 'ファイルを選択 (.txt, .bas, .cls, .vbs)'}</span>
                      <input
                        type="file"
                        accept=".txt,.bas,.cls,.vbs,text/plain"
                        multiple
                        onChange={handleFileUpload}
                        disabled={isReadingFiles}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* 取り込みプレビュー一覧 */}
                {importChunks.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-sky-500/30 space-y-2.5 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-sky-300">
                          取り込みプレビュー ({importChunks.filter((c) => c.selected).length} / {importChunks.length} 件選択中)
                        </span>
                        <span className="text-[10px] text-slate-400">800〜1500文字で自動チャンク分割済み</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectAll(true)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-colors"
                        >
                          全選択
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleSelectAll(false)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-colors"
                        >
                          全解除
                        </button>
                        <button
                          type="button"
                          onClick={handleClearImportChunks}
                          className="px-2 py-0.5 rounded bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 text-[10px] transition-colors"
                        >
                          クリア
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {importChunks.map((chunk) => {
                        const isExpanded = expandedPreviewId === chunk.id;
                        return (
                          <div
                            key={chunk.id}
                            className={`p-2.5 rounded-lg border transition-all ${
                              chunk.selected
                                ? 'bg-slate-950 border-sky-500/40'
                                : 'bg-slate-950/50 border-slate-800 opacity-60'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={chunk.selected}
                                  onChange={() => handleToggleChunkSelected(chunk.id)}
                                  className="rounded border-slate-700 text-sky-500 focus:ring-sky-500 w-3.5 h-3.5"
                                />
                                <span className="text-[10px] font-mono text-sky-300 font-bold shrink-0">
                                  {chunk.fileName}#{chunk.index}
                                </span>
                                <span className="text-[9.5px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                                  {chunk.charCount}文字
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[10px] text-slate-400">カテゴリ:</span>
                                  <select
                                    value={chunk.category}
                                    onChange={(e) =>
                                      handleChangeChunkCategory(chunk.id, e.target.value as MemoryItem['category'])
                                    }
                                    className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-200 focus:outline-none focus:border-sky-500"
                                  >
                                    <option value="vba">VBA</option>
                                    <option value="code">Code</option>
                                    <option value="chat">Chat</option>
                                    <option value="gamedev">GameDev</option>
                                    <option value="preference">Preference</option>
                                    <option value="profile">Profile</option>
                                  </select>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                <button
                                  type="button"
                                  onClick={() => setExpandedPreviewId(isExpanded ? null : chunk.id)}
                                  className="text-[10px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
                                >
                                  {isExpanded ? '原文を閉じる' : '原文を表示'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveChunkPreview(chunk.id)}
                                  className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-950/30 transition-colors"
                                  title="このチャンクを除外"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* 要約編集フィールド (4章 原文と要約の分離: contentは要約) */}
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <span className="text-[9.5px] text-slate-400 shrink-0">要約/見出し:</span>
                              <input
                                type="text"
                                value={chunk.summary}
                                onChange={(e) => handleChangeChunkSummary(chunk.id, e.target.value)}
                                placeholder="チャンクの要約または要点を入力"
                                className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10.5px] text-slate-200 focus:outline-none focus:border-sky-500"
                              />
                            </div>

                            {/* 原文スニペット (展開時) */}
                            {isExpanded && (
                              <div className="mt-2 p-2 rounded bg-slate-900/90 border border-slate-800 font-mono text-[10px] text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                                {chunk.fullText}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800">
                      <div className="text-[10.5px] text-amber-300 flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>取り込まれた記憶は未承認（approved: false）で保存され、承認するまで確定事実として使いません</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCommitImport}
                        disabled={importChunks.filter((c) => c.selected).length === 0}
                        className="px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-sky-950/40 transition-all cursor-pointer"
                      >
                        <CheckCheck className="w-4 h-4" />
                        <span>未承認として記憶に取り込む ({importChunks.filter((c) => c.selected).length} 件)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {exportedStatus && (
                <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{exportedStatus}</span>
                </div>
              )}

              {/* Quick Status Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <div className="font-bold text-sky-300 flex items-center gap-1 text-[11px]">
                    <span>1. ファイル初期合成済み</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    自然な日本語＆ゲーム制作マスターデータはビルド内に全合成済み。
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <div className="font-bold text-amber-300 flex items-center gap-1 text-[11px]">
                    <span>2. オンデバイス自動同期</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    入力された教育データは端末ストレージに保存され、全推論で参照。
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <div className="font-bold text-emerald-300 flex items-center gap-1 text-[11px]">
                    <span>3. 自己進化エクスポート</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    蓄積された知識はLoRA学習データ(JSONL)やバックアップとしていつでも保存可能。
                  </p>
                </div>
              </div>

              {/* Data Export & Sync Actions */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] text-slate-300 font-medium">
                  現在 <span className="text-amber-400 font-bold">{memories.length}</span> 件の教育・知識ナレッジを保持中
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSyncAllMasterKnowledge}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>マスター知識の再同期</span>
                  </button>
                  <button
                    onClick={handleExportTrainingData}
                    className="px-2.5 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                    title="絶対従順＋記憶・開発ルールを統合したLoRA学習用JSONLを生成し、ダウンロード＆クリップボードコピー＆画面プレビューします"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>LoRAデータ生成 (保存/コピー)</span>
                  </button>
                  <button
                    onClick={handleExportBackupJSON}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JSON保存</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Long-Term Memory & Knowledge List */}
          {activeSubTab === 'memory' && (() => {
            const conflictedList = storageService.getConflictedMemories();
            const unapprovedList = storageService.getUnapprovedMemories();
            const approvedList = storageService.getApprovedMemories();
            const projectMemoriesList = storageService.getProjectMemories();

            // storageService の各種クエリメソッドを活用した表示リストの決定
            const baseMemories = (() => {
              if (memoryFilter === 'approved') return approvedList;
              if (memoryFilter === 'unapproved') return unapprovedList;
              if (memoryFilter === 'conflicted') return conflictedList;
              if (memoryFilter === 'project_memory') return projectMemoriesList;
              if (memoryFilter === 'evaluation_set') return storageService.getMemoriesByDestination('evaluation_set');
              if (memoryFilter === 'skill') return storageService.getMemoriesByDestination('skill');
              if (memoryFilter !== 'all') {
                return storageService.getMemoriesByType(memoryFilter as MemoryType).filter(
                  (m) => m.destination !== 'quarantine' && m.destination !== 'discard_candidate'
                );
              }
              // 通常記憶一覧では、隔離と破棄候補を除いた稼働中記憶を表示
              return memories.filter((m) => m.destination !== 'quarantine' && m.destination !== 'discard_candidate');
            })();

            // スマホ対応: キーワード検索フィルタリング
            const displayMemories = baseMemories.filter((m) => {
              if (!searchKeyword.trim()) return true;
              const kw = searchKeyword.toLowerCase();
              return (
                m.content.toLowerCase().includes(kw) ||
                m.category.toLowerCase().includes(kw) ||
                (m.tags && m.tags.some((t) => t.toLowerCase().includes(kw))) ||
                (m.sourceRef && m.sourceRef.toLowerCase().includes(kw))
              );
            });

            return (
              <div className="space-y-3 sm:space-y-4">
                {/* 競合発生時の警告＆解決誘導バナー (設計思想 12 & 25) */}
                {conflictedList.length > 0 && (
                  <div className="p-3 sm:p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs animate-in fade-in">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-amber-300">
                          矛盾・競合する記憶が {conflictedList.length} 件検出されました
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                          設定やユーザープロフィールの不整合を防ぐため、優先する記憶を選択して解決してください。
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setMemoryFilter('conflicted')}
                      className="px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/50 rounded-lg font-bold text-[11px] shrink-0 self-start sm:self-auto transition-all cursor-pointer"
                    >
                      競合記憶のみ表示
                    </button>
                  </div>
                )}

                {/* スマホ最適化: 検索バー & みき自律改善ルール創成ボタン */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      placeholder="記憶やナレッジ・タグを検索..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                    {searchKeyword && (
                      <button
                        onClick={() => setSearchKeyword('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* ユーザー要望: さらにみきが改善しやすくなる自律反省・改善ボタン */}
                  <button
                    onClick={handleAutoReflectAndImprove}
                    disabled={isAutoReflecting}
                    className="px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all shrink-0 active:scale-95 disabled:opacity-50 cursor-pointer"
                    title="みきが直近の対話や行動を自己反省し、新たな改善教訓を自律生成して記憶に定着させます"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isAutoReflecting ? 'animate-spin' : ''}`} />
                    <span>{isAutoReflecting ? 'みきが自己反省中...' : '💡 みき自律改善ルール創成'}</span>
                  </button>
                </div>

                {/* Header & Filter Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setMemoryFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        memoryFilter === 'all'
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      すべて ({memories.length})
                    </button>
                    <button
                      onClick={() => setMemoryFilter('approved')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        memoryFilter === 'approved'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      承認済 ({approvedList.length})
                    </button>
                    <button
                      onClick={() => setMemoryFilter('unapproved')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        memoryFilter === 'unapproved'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      未検証 ({unapprovedList.length})
                    </button>
                    {conflictedList.length > 0 && (
                      <button
                        onClick={() => setMemoryFilter('conflicted')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                          memoryFilter === 'conflicted'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-rose-950/50 text-rose-300 hover:bg-rose-950 border border-rose-800/60'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>競合中 ({conflictedList.length})</span>
                      </button>
                    )}

                    {/* 7-Tier MemoryType & 9-Destination Filter */}
                    <select
                      value={['all', 'approved', 'unapproved', 'conflicted'].includes(memoryFilter) ? '' : memoryFilter}
                      onChange={(e) => setMemoryFilter((e.target.value as any) || 'all')}
                      className="bg-slate-900 border border-slate-800 text-slate-300 text-[11px] rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">分類で絞り込み...</option>
                      <optgroup label="7階層構造">
                        <option value="semantic">意味記憶 (semantic)</option>
                        <option value="episodic">エピソード記憶 (episodic)</option>
                        <option value="procedural">手続き記憶 (procedural)</option>
                        <option value="structural">構造記憶 (structural)</option>
                        <option value="associative">連想記憶 (associative)</option>
                        <option value="core">コア記憶 (core)</option>
                        <option value="emotional">感情記憶 (emotional)</option>
                      </optgroup>
                      <optgroup label="49章 保存先分類">
                        <option value="project_memory">プロジェクト記憶</option>
                        <option value="evaluation_set">評価セット (回帰テスト)</option>
                        <option value="skill">スキル (再利用コード)</option>
                      </optgroup>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleConsolidateMemories}
                      className="px-2.5 py-1 bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-500/40 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                      title="重複の統合と競合の再検出を実行"
                    >
                      <RefreshCw className="w-3 h-3 text-purple-400" />
                      <span>重複統合・競合再計算</span>
                    </button>
                  </div>
                </div>

                {/* Memory List */}
                <div className="space-y-2.5 max-h-[50vh] sm:max-h-96 overflow-y-auto pr-1">
                  {displayMemories.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs bg-slate-950/40 rounded-xl border border-slate-800">
                      条件に一致する記憶はありません。
                    </div>
                  ) : (
                    displayMemories.map((mem) => {
                      const good = mem.goodCount ?? 0;
                      const bad = mem.badCount ?? 0;
                      const hasConflict = Boolean(mem.active !== false && mem.conflictWith && mem.conflictWith.length > 0);
                      const isExpanded = expandedConflictId === mem.id;

                      // 競合相手の記憶オブジェクト群
                      const conflictingOpponents = hasConflict
                        ? (mem.conflictWith || []).map((cid) => memories.find((m) => m.id === cid)).filter(Boolean) as MemoryItem[]
                        : [];

                      return (
                        <div
                          key={mem.id}
                          className={`flex flex-col p-3 rounded-xl transition-colors gap-2 border ${
                            hasConflict
                              ? 'bg-amber-950/20 border-amber-500/50 hover:border-amber-500'
                              : mem.approved === false
                              ? 'bg-slate-950/70 border-slate-800 hover:border-amber-500/30'
                              : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700'
                          } text-xs`}
                        >
                          {/* Row 1: バッジ一覧（左） ＆ 操作ツールバー（右） */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1 border-b border-slate-800/60">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-2 py-0.5 rounded text-[9.5px] font-mono shrink-0 ${
                                mem.category === 'gamedev'
                                  ? 'bg-sky-950 text-sky-300 border border-sky-800'
                                  : mem.category === 'preference'
                                  ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                  : mem.category === 'profile'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-slate-800 text-slate-300 border border-slate-700'
                              }`}>
                                {mem.category}
                              </span>

                              {mem.memoryType && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-900 text-slate-400 border border-slate-700 shrink-0">
                                  {mem.memoryType}
                                </span>
                              )}

                              {mem.destination && (
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[8.5px] font-mono shrink-0 border ${
                                    mem.destination === 'long_term_memory'
                                      ? 'bg-sky-950/80 text-sky-300 border-sky-800'
                                      : mem.destination === 'project_memory'
                                      ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800'
                                      : mem.destination === 'skill'
                                      ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                                      : mem.destination === 'evaluation_set'
                                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                      : mem.destination === 'search_policy'
                                      ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                                      : mem.destination === 'lora_dataset'
                                      ? 'bg-pink-950/80 text-pink-300 border-pink-800'
                                      : 'bg-slate-900 text-slate-400 border-slate-700'
                                  }`}
                                >
                                  {mem.destination === 'long_term_memory'
                                    ? '長期記憶'
                                    : mem.destination === 'project_memory'
                                    ? 'プロジェクト記憶'
                                    : mem.destination === 'skill'
                                    ? 'スキル'
                                    : mem.destination === 'evaluation_set'
                                    ? '評価セット'
                                    : mem.destination === 'search_policy'
                                    ? '検索ポリシー'
                                    : mem.destination === 'lora_dataset'
                                    ? 'LoRA教材'
                                    : mem.destination}
                                </span>
                              )}

                              {mem.source && (
                                <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-mono shrink-0 ${
                                  mem.source === 'manual'
                                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                    : mem.source === 'txt_import'
                                    ? 'bg-sky-950 text-sky-300 border border-sky-800'
                                    : mem.source === 'auto_reflection'
                                    ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                    : 'bg-slate-900 text-slate-500 border border-slate-800'
                                }`}>
                                  {mem.source === 'manual' ? '手動' : mem.source === 'txt_import' ? '📁 TXT取込み' : mem.source === 'auto_reflection' ? '💡 自律反省' : '自動抽出'}
                                </span>
                              )}

                              {mem.pinned && (
                                <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0 flex items-center gap-0.5">
                                  📌 重要
                                </span>
                              )}

                              {hasConflict && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0 flex items-center gap-1 animate-pulse">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  競合あり ({mem.conflictWith?.length}件)
                                </span>
                              )}

                              {/* 設計思想 Master v5.0 第14章 実埋め込み有無バッジ */}
                              {mem.embeddingVector && mem.embeddingVector.length > 0 && (
                                <span
                                  className="px-1.5 py-0.2 rounded text-[8.5px] font-mono shrink-0 bg-indigo-950 text-indigo-300 border border-indigo-700/60 flex items-center gap-0.5"
                                  title={`高次元実埋め込みベクトル保有 (${mem.embeddingVector.length}次元)`}
                                >
                                  <Cpu className="w-2 h-2 text-indigo-400" />
                                  <span>{mem.embeddingVector.length}d</span>
                                </span>
                              )}

                              {/* 設計思想 Master v5.2 第15章6節: 関連記憶グラフリンクバッジ */}
                              {mem.relatedMemoryIds && mem.relatedMemoryIds.length > 0 && (
                                <span
                                  className="px-1.5 py-0.2 rounded text-[8.5px] font-mono shrink-0 bg-teal-950 text-teal-300 border border-teal-700/60 flex items-center gap-0.5"
                                  title={`関連記憶グラフ (${mem.relatedMemoryIds.length}ノードと自動リンク・GraphRAG展開対象)`}
                                >
                                  <Link className="w-2 h-2 text-teal-400" />
                                  <span>リンク {mem.relatedMemoryIds.length}</span>
                                </span>
                              )}

                              {/* 感情価 (有用・混乱・熱量) */}
                              {Boolean((mem.useful_count ?? mem.usefulCount) || (mem.confusion_count ?? mem.confusionCount) || typeof mem.heat === 'number') && (
                                <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono shrink-0 bg-slate-900 border border-slate-700/70 text-slate-300 flex items-center gap-1">
                                  {Boolean(mem.useful_count ?? mem.usefulCount) && (
                                    <span className="text-emerald-400 font-bold" title="役立った回数 (useful_count)">
                                      +{mem.useful_count ?? mem.usefulCount}
                                    </span>
                                  )}
                                  {Boolean(mem.confusion_count ?? mem.confusionCount) && (
                                    <span className="text-rose-400 font-bold" title="混乱・訂正された回数 (confusion_count)">
                                      -{mem.confusion_count ?? mem.confusionCount}
                                    </span>
                                  )}
                                  {typeof mem.heat === 'number' && (
                                    <span className="text-amber-400 flex items-center gap-0.5" title="熱量 (heat 0.0〜1.0)">
                                      <Flame className="w-2 h-2 text-amber-400" />
                                      {mem.heat}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>

                            {/* 操作ツールバー（スマホ・PC共通で押しやすいコンパクトボタン群） */}
                            <div className="flex items-center gap-1 shrink-0 ml-auto flex-wrap">
                              {/* 競合解決アコーディオン展開ボタン */}
                              {hasConflict && (
                                <button
                                  onClick={() => setExpandedConflictId(isExpanded ? null : mem.id)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border transition-all cursor-pointer ${
                                    isExpanded
                                      ? 'bg-amber-600 text-white border-amber-500'
                                      : 'bg-amber-950/80 text-amber-300 border-amber-500/50 hover:bg-amber-900'
                                  }`}
                                  title="競合相手の確認と解決フロー"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>{isExpanded ? '閉じる' : '競合解決'}</span>
                                </button>
                              )}

                              {/* 承認ボタン */}
                              {mem.approved === false ? (
                                <button
                                  onClick={() => handleApproveMemory(mem.id)}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 flex items-center gap-1 transition-all cursor-pointer"
                                  title="この記憶を承認し、推論の確定事実として利用可能にします"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>承認</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleToggleApproved(mem.id)}
                                  className="px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border bg-emerald-950/80 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60 transition-all cursor-pointer"
                                  title="クリックで未承認に切り替え"
                                >
                                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                  <span>承認済</span>
                                </button>
                              )}

                              {/* 👍 / 👎 Feedback Controls */}
                              <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
                                <button
                                  onClick={() => handleAdjustFeedback(mem.id, 1)}
                                  className="text-slate-400 hover:text-emerald-400 p-0.5 cursor-pointer"
                                  title="高評価を追加"
                                >
                                  <ThumbsUp className="w-2.5 h-2.5" />
                                </button>
                                <span className={good > bad ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                                  {good - bad}
                                </span>
                                <button
                                  onClick={() => handleAdjustFeedback(mem.id, -1)}
                                  className="text-slate-400 hover:text-rose-400 p-0.5 cursor-pointer"
                                  title="低評価を追加"
                                >
                                  <ThumbsDown className="w-2.5 h-2.5" />
                                </button>
                              </div>

                              {/* ⚡ みき学習強化 (Boost) ボタン */}
                              <button
                                onClick={() => handleBoostMemory(mem.id)}
                                className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-amber-950/40 transition-colors cursor-pointer"
                                title="みきの最重要ルールとして学習強化（Heat 1.0・優先注入）"
                              >
                                <Zap className="w-3 h-3 text-amber-400" />
                              </button>

                              {/* ✏️ インライン編集ボタン */}
                              <button
                                onClick={() => {
                                  setEditingMemoryId(mem.id);
                                  setEditingContent(mem.content);
                                }}
                                className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-sky-950/40 transition-colors cursor-pointer"
                                title="記憶の内容を編集"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>

                              {/* 49章 保存先別アクションボタン */}
                              {mem.destination === 'evaluation_set' && (
                                <button
                                  onClick={() => handleExportToBenchmark(mem.id)}
                                  className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900 transition-all flex items-center gap-1 cursor-pointer"
                                  title="回帰ベンチマークスイートへ新規テストケースとして登録"
                                >
                                  <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>テスト</span>
                                </button>
                              )}

                              {mem.destination === 'skill' && (
                                <button
                                  onClick={() => handleExportToSkill(mem.id)}
                                  className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40 hover:bg-amber-900 transition-all flex items-center gap-1 cursor-pointer"
                                  title="スキルライブラリへ新規スキルとして登録"
                                >
                                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                                  <span>スキル</span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  const quarantined = experienceRouterService.applyRoutingToMemory(
                                    {
                                      ...mem,
                                      destination: 'quarantine',
                                      quarantineReason: 'ユーザーによる手動隔離',
                                      approved: false,
                                      active: false,
                                    },
                                    memories
                                  );
                                  storageService.saveMemoryItem(quarantined);
                                  const updated = storageService.getMemories();
                                  if (typeof onUpdateMemories === 'function') {
                                    (onUpdateMemories as any)(updated);
                                  }
                                  setExportedStatus('🛡️ 記憶を隔離しました（プロンプト注入から完全除外）');
                                  setTimeout(() => setExportedStatus(null), 3000);
                                }}
                                className="p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-950/30 rounded transition-colors cursor-pointer"
                                title="隔離へ送る（出典不明・要確認として除外）"
                              >
                                <ShieldAlert className="w-3 h-3" />
                              </button>

                              <button
                                onClick={() => handleMarkDiscard(mem.id)}
                                className="p-1 text-slate-400 hover:text-amber-400 hover:bg-amber-950/30 rounded transition-colors cursor-pointer"
                                title="破棄候補へマーク"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>

                              <button
                                onClick={() => handleDelete(mem.id)}
                                className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-colors cursor-pointer"
                                title="直ちに記憶を完全削除"
                              >
                                <Ban className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Row 2: 記憶本文（見切れずに全文を表示！タップでインライン編集） */}
                          <div className="py-1">
                            {editingMemoryId === mem.id ? (
                              <div className="space-y-2 bg-slate-900/95 p-2.5 rounded-xl border border-sky-500/50 animate-in fade-in">
                                <div className="text-[10px] text-sky-400 font-bold flex items-center gap-1">
                                  <Edit3 className="w-3 h-3" />
                                  <span>記憶の内容を編集して即時反映</span>
                                </div>
                                <textarea
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs font-medium text-slate-100 focus:outline-none focus:border-sky-500 min-h-[60px]"
                                  autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingMemoryId(null);
                                      setEditingContent('');
                                    }}
                                    className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200 rounded cursor-pointer"
                                  >
                                    キャンセル
                                  </button>
                                  <button
                                    onClick={() => handleSaveEditMemory(mem.id)}
                                    className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] rounded-lg shadow-sm cursor-pointer"
                                  >
                                    保存して反映
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-slate-100 text-xs sm:text-[13px] font-medium leading-relaxed break-words select-text">
                                {mem.content}
                              </div>
                            )}
                          </div>

                          {/* Row 1.5: 出典参照 (sourceRef), タグ, 原文抜粋 (rawExcerpt) */}
                          {(mem.sourceRef || mem.rawExcerpt || (mem.tags && mem.tags.length > 0)) && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px] text-slate-400 border-t border-slate-900">
                              {mem.sourceRef && (
                                <span
                                  className="flex items-center gap-1 font-mono text-[9.5px] text-sky-300 bg-sky-950/50 px-1.5 py-0.5 rounded border border-sky-800/40"
                                  title={`出典: ${mem.sourceRef}`}
                                >
                                  <FileText className="w-2.5 h-2.5" />
                                  <span>出典: {mem.sourceRef}</span>
                                </span>
                              )}
                              {mem.tags &&
                                mem.tags.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="font-mono text-[9px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800"
                                  >
                                    #{tag}
                                  </span>
                                ))}
                              {mem.rawExcerpt && mem.rawExcerpt !== mem.content && (
                                <details className="w-full mt-1 group">
                                  <summary className="cursor-pointer text-[9.5px] text-slate-400 hover:text-slate-200 transition-colors list-none flex items-center gap-1 font-mono">
                                    <span className="group-open:rotate-90 transition-transform text-[8px]">▶</span>
                                    <span>原文抜粋を表示 (4章 原文と要約の分離)</span>
                                  </summary>
                                  <div className="mt-1 p-2 rounded bg-slate-900/80 border border-slate-800 font-mono text-[10px] text-slate-300 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                                    {mem.rawExcerpt}
                                  </div>
                                </details>
                              )}
                            </div>
                          )}

                          {/* Row 1.7: 関連記憶グラフリンク (第15章6節 Semantic Link Expansion) */}
                          {mem.relatedMemoryIds && mem.relatedMemoryIds.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 pt-1 text-[10px] text-teal-400 border-t border-slate-900">
                              <span className="flex items-center gap-1 font-mono text-[9px] text-teal-300 bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-800/50">
                                <Link className="w-2.5 h-2.5" />
                                <span>関連記憶 ({mem.relatedMemoryIds.length}件):</span>
                              </span>
                              {mem.relatedMemoryIds.map((relId) => {
                                const relMem = memories.find((m) => m.id === relId);
                                return (
                                  <span
                                    key={relId}
                                    className="font-mono text-[9px] text-teal-200 bg-slate-900 px-1.5 py-0.5 rounded border border-teal-900/60 max-w-[220px] truncate"
                                    title={relMem ? relMem.content : relId}
                                  >
                                    🔗 {relMem ? relMem.content.slice(0, 20) + (relMem.content.length > 20 ? '...' : '') : relId.slice(0, 8)}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Row 2: 競合解決フロー・インラインパネル (アコーディオン) */}
                          {hasConflict && isExpanded && (
                            <div className="p-3 mt-1 rounded-lg bg-slate-900/90 border border-amber-500/40 space-y-2.5 animate-in fade-in">
                              <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                <span>競合解決フロー: 矛盾する記憶のどちらを正としますか？</span>
                              </div>

                              <div className="space-y-2">
                                {conflictingOpponents.map((opponent) => (
                                  <div
                                    key={opponent.id}
                                    className="p-2.5 rounded-md bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                  >
                                    <div className="space-y-1 min-w-0 flex-1">
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        相手の記憶 [{opponent.category}]:
                                      </div>
                                      <div className="text-slate-200 text-xs font-medium">
                                        {opponent.content}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        onClick={() => handleResolveConflict(mem.id, opponent.id)}
                                        className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 rounded-lg font-bold text-[10.5px] flex items-center gap-1 transition-all"
                                        title="この記憶を採用し、相手の記憶を無効化（アーカイブ）します"
                                      >
                                        <Check className="w-3 h-3 text-emerald-300" />
                                        <span>この記憶を採用（相手を無効化）</span>
                                      </button>
                                      <button
                                        onClick={() => handleDismissConflict(mem.id, opponent.id)}
                                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-[10.5px] transition-all"
                                        title="両方の記憶を保持し、競合フラグを解除します"
                                      >
                                        両方保持
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })()}

          {/* TAB 3: Persona Configuration */}
          {activeSubTab === 'persona' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">AIパートナーのお名前</label>
                  <input
                    type="text"
                    value={persona.name}
                    onChange={(e) => {
                      if (typeof onUpdatePersona === 'function') {
                        (onUpdatePersona as any)((prev: any) => ({ ...prev, name: e.target.value }));
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">あなたの呼び名</label>
                  <input
                    type="text"
                    value={persona.userNickname}
                    onChange={(e) => {
                      if (typeof onUpdatePersona === 'function') {
                        (onUpdatePersona as any)((prev: any) => ({ ...prev, userNickname: e.target.value }));
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">アバター絵文字</label>
                  <input
                    type="text"
                    value={persona.avatar}
                    onChange={(e) => {
                      if (typeof onUpdatePersona === 'function') {
                        (onUpdatePersona as any)((prev: any) => ({ ...prev, avatar: e.target.value }));
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 text-center text-lg focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">口調スタイル</label>
                  <select
                    value={persona.speakingStyle}
                    onChange={(e: any) => {
                      if (typeof onUpdatePersona === 'function') {
                        (onUpdatePersona as any)((prev: any) => ({ ...prev, speakingStyle: e.target.value }));
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-pink-500"
                  >
                    <option value="friendly">明るく親しみやすい (フレンドリー)</option>
                    <option value="polite">丁寧・敬語 (プロフェッショナル)</option>
                    <option value="tsundere">ツンデレ (ちょっぴり強がり)</option>
                    <option value="mentor">頼れるメンター・先輩エンジニア</option>
                  </select>
                </div>
              </div>

              <div className="text-xs">
                <label className="block text-slate-400 font-medium mb-1">基本性格・タグライン</label>
                <textarea
                  value={persona.basePersonality}
                  onChange={(e) => {
                    if (typeof onUpdatePersona === 'function') {
                      (onUpdatePersona as any)((prev: any) => ({ ...prev, basePersonality: e.target.value }));
                    }
                  }}
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-pink-500 leading-relaxed font-mono"
                  placeholder="例: あなた専属の親身なAIパートナー。一緒にアプリ開発やゲーム制作を楽しみながら成長する。"
                />
              </div>
            </div>
          )}

          {/* TAB 4: Japanese Natural Dialogue Knowledge Corpus */}
          {activeSubTab === 'corpus' && (
            <div className="space-y-4 text-xs">
              {/* Header Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-rose-950/40 via-pink-950/30 to-slate-900 border border-rose-500/30 space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                  <BookOpen className="w-4 h-4 text-rose-400" />
                  <span>日本語自然化コーパス ＆ 脱ロボット辞書</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  機械翻訳調や堅苦しい敬語オウム返しを防ぎ、
                  <strong>「自然な相槌・温かいタメ口・恋人同士の愛おしいテンポ」</strong>で会話できるように設計された統合知識データです。
                </p>
              </div>

              {/* Anti-Robotic Rules */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>機械翻訳調 ➔ 自然な日本語 変換辞書</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ANTI_ROBOTIC_JAPANESE_RULES.map((rule, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between text-[11px] gap-2"
                    >
                      <span className="text-rose-400 line-through shrink-0 font-mono">{rule.avoid}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="text-emerald-300 font-semibold truncate">{rule.prefer}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Natural Dialogue Examples */}
              <div className="space-y-2.5">
                <div className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>対話シチュエーション別・自然な応答パターン</span>
                </div>
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {JAPANESE_NATURAL_DIALOGUE_CORPUS.map((cat, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-2">
                      <div className="font-bold text-slate-200 text-[11px] flex items-center justify-between">
                        <span>{cat.category}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{cat.description}</span>
                      </div>
                      <div className="space-y-1.5">
                        {cat.examples.map((ex, eIdx) => (
                          <div key={eIdx} className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 text-[11px] space-y-1">
                            <div className="text-[10px] text-slate-400 font-mono">情景: {ex.scenario}</div>
                            <div className="text-emerald-300 font-medium flex items-start gap-1">
                              <span className="text-emerald-400 shrink-0">⭕</span>
                              <span>{ex.natural}</span>
                            </div>
                            <div className="text-rose-400/80 line-through text-[10px] flex items-start gap-1">
                              <span className="shrink-0">❌</span>
                              <span>{ex.unnaturalAvoid}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: 知識グラフ & 多層ベクトル検索 (設計思想 4 & 12) */}
          {activeSubTab === 'graph' && (
            <div className="space-y-4 text-xs">
              {/* Feature Header Banner */}
              <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-indigo-300 text-sm">
                    <Network className="w-4 h-4 text-indigo-400" />
                    <span>多層ベクトル検索 ＆ 知識グラフ依存関係エンジン</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 font-mono text-[10px] border border-indigo-700/50">
                    設計思想 4 & 12 準拠
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  単純なキーワード一致だけでなく、<strong>「8次元ドメイン意味ベクトル類似度」</strong>と、記憶同士の<strong>「前提条件・親子・関連リンク」</strong>をグラフ探索して、必要な文脈を漏れなくプロンプトへ適応注入します。
                </p>
              </div>

              {/* RAG Simulator Controls */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-indigo-400" />
                    <span>多層RAG 検索シミュレーター (リアルタイム検証)</span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300">
                    <input
                      type="checkbox"
                      checked={graphTraverseEnabled}
                      onChange={(e) => setGraphTraverseEnabled(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>知識グラフ依存関係トラバーサルを適用</span>
                  </label>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={graphSearchQuery}
                    onChange={(e) => setGraphSearchQuery(e.target.value)}
                    placeholder="テスト検索クエリ (例: ゲームのバグ修正ルール、脱ロボットタメ口)"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const queryVec = calculateDomainVector(graphSearchQuery);
                      setExportedStatus(`📊 クエリ「${graphSearchQuery}」の意味ベクトル: [${queryVec.map((v) => v.toFixed(1)).join(', ')}]`);
                      setTimeout(() => setExportedStatus(null), 3000);
                    }}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs"
                  >
                    検索
                  </button>
                </div>

                {/* Scored Results Display */}
                {(() => {
                  const scoredResults = retrieveScoredMemories(graphSearchQuery, memories, {
                    limit: 5,
                    traverseGraph: graphTraverseEnabled,
                  });

                  return (
                    <div className="space-y-2 pt-1">
                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>プロンプト注入候補記憶 (上位 {scoredResults.length} 件):</span>
                        <span className="font-mono text-[10px] text-indigo-400">
                          {graphTraverseEnabled ? '多層類似度 + グラフ連鎖' : '多層類似度のみ'}
                        </span>
                      </div>

                      {scoredResults.length === 0 ? (
                        <div className="p-4 rounded-lg bg-slate-900 text-slate-500 text-center text-xs">
                          一致する記憶がありません
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {scoredResults.map((s, idx) => {
                            const isPrereq = s.retrievalSource === 'prerequisite_dependency';
                            const isParent = s.retrievalSource === 'parent_context';
                            const isRel = s.retrievalSource === 'graph_relation';

                            return (
                              <div
                                key={s.memory.id || idx}
                                className={`p-2.5 rounded-lg border space-y-1.5 transition-colors ${
                                  isPrereq
                                    ? 'bg-amber-950/20 border-amber-800/60'
                                    : isParent
                                    ? 'bg-purple-950/20 border-purple-800/60'
                                    : isRel
                                    ? 'bg-sky-950/20 border-sky-800/60'
                                    : 'bg-slate-900/90 border-slate-800'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-[10px] text-indigo-300">
                                      #{idx + 1}
                                    </span>
                                    <span className="font-bold text-slate-200 text-[11px] truncate max-w-[200px] sm:max-w-xs">
                                      {s.memory.content}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                                        isPrereq
                                          ? 'bg-amber-950 text-amber-300 border border-amber-700'
                                          : isParent
                                          ? 'bg-purple-950 text-purple-300 border border-purple-700'
                                          : isRel
                                          ? 'bg-sky-950 text-sky-300 border border-sky-700'
                                          : 'bg-slate-800 text-slate-300'
                                      }`}
                                    >
                                      {isPrereq
                                        ? '⚡ 前提依存'
                                        : isParent
                                        ? '👑 上位親'
                                        : isRel
                                        ? '🔗 関連リンク'
                                        : '🎯 直接一致'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 font-mono text-[10px]">
                                      スコア: {s.score}点
                                    </span>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                                  {s.matchReasons.map((r, rIdx) => (
                                    <span key={rIdx} className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                                      {r}
                                    </span>
                                  ))}
                                  {s.semanticSimilarity > 0 && (
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-900">
                                      意味類似度: {(s.semanticSimilarity * 100).toFixed(0)}%
                                    </span>
                                  )}
                                  {s.memory.approved && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-900">
                                      ✓ 確定承認
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Knowledge Graph Dependencies & Linking Editor */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="font-bold text-slate-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                    <span>知識グラフ・依存関係ネットワーク設定</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    全 {memories.length} ノード
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Node Selector List */}
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    <div className="text-[10px] text-slate-400 font-bold">対象ノードを選択:</div>
                    {memories.map((m) => {
                      const isSelected = selectedGraphNodeId === m.id;
                      const hasPrereq = m.prerequisiteMemoryIds && m.prerequisiteMemoryIds.length > 0;
                      const hasParent = Boolean(m.parentMemoryId);

                      return (
                        <div
                          key={m.id}
                          onClick={() => setSelectedGraphNodeId(m.id)}
                          className={`p-2 rounded-lg border text-[11px] cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-indigo-950/60 border-indigo-500 text-white font-semibold'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-900'
                          }`}
                        >
                          <span className="truncate max-w-[180px]">{m.content}</span>
                          <div className="flex items-center gap-1 text-[9px] shrink-0">
                            {hasPrereq && (
                              <span className="px-1 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">
                                前提有
                              </span>
                            )}
                            {hasParent && (
                              <span className="px-1 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800">
                                親有
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Selected Node Inspector & Prerequisite Linker */}
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2.5">
                    {selectedGraphNodeId ? (() => {
                      const currentMem = memories.find((m) => m.id === selectedGraphNodeId);
                      if (!currentMem) return <div className="text-slate-400 text-xs">ノードが見つかりません</div>;

                      return (
                        <div className="space-y-2 text-[11px]">
                          <div className="font-bold text-indigo-300 flex items-center gap-1">
                            <Link className="w-3 h-3" />
                            <span>ノード詳細 & 依存関係</span>
                          </div>
                          <p className="text-slate-200 bg-slate-950 p-2 rounded border border-slate-800">
                            {currentMem.content}
                          </p>

                          {/* Quick Set Parent Node */}
                          <div className="space-y-1">
                            <label className="block text-slate-400 text-[10px]">👑 上位親ノード (Parent Concept):</label>
                            <select
                              value={currentMem.parentMemoryId || ''}
                              onChange={(e) => {
                                const newParentId = e.target.value || undefined;
                                if (typeof onUpdateMemories === 'function') {
                                  (onUpdateMemories as any)((prev: MemoryItem[]) => {
                                    const list = Array.isArray(prev) ? prev : memories;
                                    return list.map((m) => (m.id === currentMem.id ? { ...m, parentMemoryId: newParentId } : m));
                                  });
                                }
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                            >
                              <option value="">なし (独立ノード)</option>
                              {memories
                                .filter((m) => m.id !== currentMem.id)
                                .map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.content.substring(0, 30)}...
                                  </option>
                                ))}
                            </select>
                          </div>

                          {/* Quick Add Prerequisite Node */}
                          <div className="space-y-1">
                            <label className="block text-slate-400 text-[10px]">⚡ 前提条件ノード (Prerequisite):</label>
                            <select
                              value=""
                              onChange={(e) => {
                                const prereqId = e.target.value;
                                if (!prereqId) return;
                                const currentPrereqs = currentMem.prerequisiteMemoryIds || [];
                                if (currentPrereqs.includes(prereqId)) return;

                                if (typeof onUpdateMemories === 'function') {
                                  (onUpdateMemories as any)((prev: MemoryItem[]) => {
                                    const list = Array.isArray(prev) ? prev : memories;
                                    return list.map((m) =>
                                      m.id === currentMem.id
                                        ? { ...m, prerequisiteMemoryIds: [...currentPrereqs, prereqId] }
                                        : m
                                    );
                                  });
                                }
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                            >
                              <option value="">+ 前提ノードを追加選択...</option>
                              {memories
                                .filter((m) => m.id !== currentMem.id && !(currentMem.prerequisiteMemoryIds || []).includes(m.id))
                                .map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.content.substring(0, 30)}...
                                  </option>
                                ))}
                            </select>

                            {/* Prereq Chips */}
                            {currentMem.prerequisiteMemoryIds && currentMem.prerequisiteMemoryIds.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {currentMem.prerequisiteMemoryIds.map((pid) => {
                                  const pMem = memories.find((m) => m.id === pid);
                                  return (
                                    <span
                                      key={pid}
                                      className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] flex items-center gap-1"
                                    >
                                      <span>⚡ {pMem ? pMem.content.substring(0, 15) + '...' : pid}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (typeof onUpdateMemories === 'function') {
                                            (onUpdateMemories as any)((prev: MemoryItem[]) => {
                                              const list = Array.isArray(prev) ? prev : memories;
                                              return list.map((m) =>
                                                m.id === currentMem.id
                                                  ? {
                                                      ...m,
                                                      prerequisiteMemoryIds: (m.prerequisiteMemoryIds || []).filter((id) => id !== pid),
                                                    }
                                                  : m
                                              );
                                            });
                                          }
                                        }}
                                        className="text-amber-400 hover:text-rose-400 ml-1 font-bold"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="p-6 text-center text-slate-500 text-xs">
                        左側のリストから記憶ノードを選択すると、親ノードや前提条件のグラフ依存関係を設定できます
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: Quarantine (隔離・出典不明・要検証) - 第49章 経験の保存先ルーター */}
          {activeSubTab === 'quarantine' && (() => {
            const quarantinedList = storageService.getQuarantinedMemories();
            return (
              <div className="space-y-4 text-xs">
                {/* 隔離の解説・安全バナー */}
                <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/50 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-amber-300 text-sm flex items-center gap-2">
                          <span>🛡️ 隔離された経験・未確認記憶 ({quarantinedList.length}件)</span>
                          <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-mono">
                            プロンプト注入から完全除外中
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          出典不明、正解性・真偽が未確認、または外部非公式ソースから取得された情報は、
                          <strong>LLMプロンプトへの自動注入から完全に隔離</strong>されています。
                          内容を確認し、問題がなければ【長期記憶】や【プロジェクト記憶】へ昇格承認してください。
                        </p>
                      </div>
                    </div>
                    {quarantinedList.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                        <button
                          onClick={() => handleBatchPromoteQuarantine('long_term_memory')}
                          className="px-3 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/50 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>全件を長期記憶へ昇格</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 隔離アイテム一覧 */}
                {quarantinedList.length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-slate-800 rounded-xl space-y-2">
                    <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
                    <div className="text-slate-300 font-bold text-sm">隔離された経験・記憶はありません</div>
                    <p className="text-slate-500 text-xs">
                      すべての記憶は安全に分類・承認されているか、通常記憶として管理されています。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {quarantinedList.map((mem) => {
                      const risk = mem.routingFactors?.impactRisk || 'medium';
                      return (
                        <div
                          key={mem.id}
                          className="p-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 hover:border-amber-500/50 transition-all space-y-2.5"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                            <div className="space-y-1.5 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                  <ShieldAlert className="w-3 h-3" />
                                  <span>隔離中</span>
                                </span>

                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono border ${
                                    risk === 'high'
                                      ? 'bg-rose-950 text-rose-300 border-rose-800'
                                      : risk === 'medium'
                                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                                      : 'bg-slate-800 text-slate-300 border-slate-700'
                                  }`}
                                >
                                  リスク: {risk}
                                </span>

                                {mem.quarantineReason && (
                                  <span className="text-[11px] text-amber-200/90 font-medium">
                                    理由: {mem.quarantineReason}
                                  </span>
                                )}
                              </div>

                              <p className="text-slate-100 text-xs font-medium leading-relaxed bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                                {mem.content}
                              </p>

                              <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
                                <span>
                                  カテゴリ: <strong className="text-slate-300">{mem.category}</strong>
                                </span>
                                {mem.sourceRef && (
                                  <span>
                                    参照元: <strong className="text-slate-300">{mem.sourceRef}</strong>
                                  </span>
                                )}
                                {mem.routingFactors && (
                                  <span>
                                    再利用性: <strong className="text-slate-300">{mem.routingFactors.reusability || '中'}</strong> / 承認状態:{' '}
                                    <strong className="text-slate-300">{mem.routingFactors.approvalStatus || '未確認'}</strong>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* アクションボタン群 */}
                            <div className="flex flex-wrap sm:flex-col gap-1.5 shrink-0 self-start">
                              <button
                                onClick={() => handlePromoteQuarantine(mem.id, 'long_term_memory')}
                                className="px-2.5 py-1.5 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/50 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                                title="安全を確認したため、長期記憶として承認しプロンプトで利用可能にします"
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>長期記憶へ昇格</span>
                              </button>

                              <button
                                onClick={() => handlePromoteQuarantine(mem.id, 'project_memory')}
                                className="px-2.5 py-1.5 bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-500/50 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                                title="このプロジェクト限定の記憶として承認します"
                              >
                                <FolderGit2 className="w-3.5 h-3.5 text-sky-400" />
                                <span>プロジェクト記憶へ</span>
                              </button>

                              <button
                                onClick={() => handleMarkDiscard(mem.id, '隔離から破棄候補へ移行')}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                                <span>破棄候補へ送る</span>
                              </button>

                              <button
                                onClick={() => handleDelete(mem.id)}
                                className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                                title="直ちに完全削除します"
                              >
                                <span>完全に削除</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB 7: Discard Candidates (破棄候補リスト) - 第49章 経験の保存先ルーター */}
          {activeSubTab === 'discard' && (() => {
            const discardList = storageService.getDiscardCandidateMemories();
            return (
              <div className="space-y-4 text-xs">
                {/* 破棄候補の解説・一括確認バナー */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <Trash2 className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-slate-200 text-sm flex items-center gap-2">
                          <span>🗑️ 破棄候補リスト ({discardList.length}件)</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-mono">
                            一括確認用リスト
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          重複、低評価（badCount超過）、または誤りと判定された記憶の候補一覧です。
                          <strong>勝手に自動削除されることはなく</strong>、ユーザーの一括確認を経て安全に削除または復帰できます。
                        </p>
                      </div>
                    </div>
                    {discardList.length > 0 && (
                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                        <button
                          onClick={handleBatchDeleteDiscards}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>破棄候補を一括完全削除 ({discardList.length}件)</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 破棄候補アイテム一覧 */}
                {discardList.length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-slate-800 rounded-xl space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-slate-500 mx-auto" />
                    <div className="text-slate-300 font-bold text-sm">破棄候補の記憶はありません</div>
                    <p className="text-slate-500 text-xs">
                      削除候補としてマークされた記憶はありません。クリーンな状態です。
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {discardList.map((mem) => (
                      <div
                        key={mem.id}
                        className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                破棄候補
                              </span>
                              {mem.discardReason && (
                                <span className="text-[11px] text-rose-300 font-medium">
                                  理由: {mem.discardReason}
                                </span>
                              )}
                            </div>

                            <p className="text-slate-300 text-xs line-through opacity-80 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                              {mem.content}
                            </p>

                            <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
                              <span>カテゴリ: {mem.category}</span>
                              <span>低評価数: {mem.badCount ?? 0}</span>
                              <span>利用回数: {mem.useCount ?? 0}</span>
                            </div>
                          </div>

                          {/* アクション */}
                          <div className="flex sm:flex-col gap-1.5 shrink-0 self-start">
                            <button
                              onClick={() => handleUnmarkDiscard(mem.id)}
                              className="px-2.5 py-1.5 bg-sky-600/30 hover:bg-sky-600/50 text-sky-200 border border-sky-500/50 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                              title="破棄を取り消し、通常記憶として復帰させます"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                              <span>復帰する</span>
                            </button>

                            <button
                              onClick={() => handleDelete(mem.id)}
                              className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                              title="この記憶を完全に削除します"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>完全削除</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB 8: 設計思想 8章 & 35章 第4段階: 長期記憶・置換履歴 & 7段階検索パイプライン */}
          {activeSubTab === 'longterm' && (() => {
            const supersededCount = memories.filter((m) => m.lifecycleStatus === 'SUPERSEDED' || Boolean(m.replacedBy)).length;
            const midTermCount = memories.filter((m) => m.memoryScope === 'mid_term' && m.lifecycleStatus !== 'SUPERSEDED').length;
            const designPrinciples = memories.filter((m) => m.longTermType === 'design_principle' && m.lifecycleStatus !== 'SUPERSEDED');
            const policies = memories.filter((m) => m.longTermType === 'policy' && m.lifecycleStatus !== 'SUPERSEDED');
            const preferences = memories.filter((m) => (m.longTermType === 'preference' || m.category === 'preference') && m.lifecycleStatus !== 'SUPERSEDED');
            const generalRules = memories.filter((m) => m.longTermType === 'general_rule' && m.lifecycleStatus !== 'SUPERSEDED');

            const filteredMemories = memories.filter((m) => {
              if (longTermCategoryFilter === 'superseded') {
                return m.lifecycleStatus === 'SUPERSEDED' || Boolean(m.replacedBy);
              }
              if (longTermCategoryFilter === 'mid_term') {
                return m.memoryScope === 'mid_term' && m.lifecycleStatus !== 'SUPERSEDED';
              }
              if (longTermCategoryFilter === 'all') {
                return m.lifecycleStatus !== 'SUPERSEDED' && !m.replacedBy;
              }
              return m.longTermType === longTermCategoryFilter && m.lifecycleStatus !== 'SUPERSEDED' && !m.replacedBy;
            });

            const targetOldMemory = supersedeModalOldMemId ? memories.find((m) => m.id === supersedeModalOldMemId) : null;

            return (
              <div className="space-y-6 text-xs animate-in fade-in">
                {/* 1. タイトル & 8章ガイダンス */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
                      <BookmarkCheck className="w-4 h-4 text-emerald-400" />
                      <span>設計思想 8章 & 35章 第4段階: 長期記憶・置換管理・7段階検索パイプライン</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/30">
                      Phase 4 Active
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    継続的な好み・長期方針・確定した設計原則・一般ルールを長期記憶として厳格管理します。
                    訂正された古い原則は安易に消去せず「<strong className="text-amber-300">SUPERSEDED（置換済み）</strong>」として置換理由とともに保持し、
                    7段階の検索パイプライン（会話状態 ➔ 直近原文 ➔ 完全一致 ➔ 全文検索 ➔ 意味検索 ➔ 再順位付け ➔ 原文再取得）でノイズ混入を防ぎます。
                  </p>

                  {/* 4大分類 & 置換履歴の統計バッジ */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                    <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
                      <div className="text-[10px] text-slate-400">確定設計原則</div>
                      <div className="text-sm font-bold text-indigo-300">{designPrinciples.length}件</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
                      <div className="text-[10px] text-slate-400">長期的な方針</div>
                      <div className="text-sm font-bold text-sky-300">{policies.length}件</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
                      <div className="text-[10px] text-slate-400">継続的な好み</div>
                      <div className="text-sm font-bold text-pink-300">{preferences.length}件</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-center">
                      <div className="text-[10px] text-slate-400">一般ルール</div>
                      <div className="text-sm font-bold text-emerald-300">{generalRules.length}件</div>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-500/30 text-center">
                      <div className="text-[10px] text-amber-400">置換済み履歴</div>
                      <div className="text-sm font-bold text-amber-300">{supersededCount}件</div>
                    </div>
                  </div>
                </div>

                {/* 1.5 実埋め込み (Embedding API) 連携 & 一括同期パネル (設計思想 Master v5.0 第14章) */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-indigo-500/40 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-bold text-indigo-300 text-xs sm:text-sm">
                        <Cpu className="w-4 h-4 text-indigo-400" />
                        <span>実LLM埋め込みベクトル (Embedding API) 連携状況</span>
                        {embeddingStats?.available ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[9px] border border-emerald-500/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            接続中 ({embeddingStats.endpoint})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono text-[9px] border border-slate-700">
                            未接続 (8次元疎ベクトルで代替フォールバック中)
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {embeddingStats
                          ? `全 ${embeddingStats.totalMemoriesCount} 件中、${embeddingStats.embeddedMemoriesCount} 件 (${embeddingStats.totalMemoriesCount > 0 ? Math.round((embeddingStats.embeddedMemoriesCount / embeddingStats.totalMemoriesCount) * 100) : 0}%) に高次元実埋め込みベクトル (${embeddingStats.dimensions || 768}次元) が付与されています。`
                          : '埋め込み統計を読込中...'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleSyncAllEmbeddings}
                        disabled={isSyncingEmbeddings}
                        className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                        title="外部LLMの/v1/embeddingsまたは/api/embeddingsを呼び出し、全記憶のベクトルを一括同期します"
                      >
                        {isSyncingEmbeddings ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>{embeddingSyncProgress || '実埋め込みを一括同期'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 1.6 設計思想 Master v5.4 第19章: 記憶監査 (間隔反復・鮮度再検証・埋め込み健全性) パネル */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-950 border border-teal-500/30 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-bold text-teal-300 text-xs sm:text-sm">
                        <ShieldCheck className="w-4 h-4 text-teal-400" />
                        <span>設計思想 Master v5.4 第19章: 記憶の間隔反復定着 & 鮮度再検証パイプライン</span>
                        {embeddingStats?.consecutiveDegradedCount && embeddingStats.consecutiveDegradedCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[9px] border border-amber-500/40">
                            縮退中 ({embeddingStats.consecutiveDegradedCount}回)
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        休眠重要記憶を自律再想起して定着を補強し、価格・バージョン・組織などの揮発性記憶（volatility）をWeb検索で裏取り検証します。
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleRunMemoryAudit}
                        disabled={isAuditingMemories}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                        title="間隔反復定着・鮮度再検証・埋め込み健全性チェックを一括実行します"
                      >
                        {isAuditingMemories ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>{auditProgressMessage || '第19章 記憶監査を実行'}</span>
                      </button>
                    </div>
                  </div>

                  {lastAuditRecord && (
                    <div className="p-2.5 rounded-lg bg-slate-950/80 border border-teal-500/20 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <div className="text-slate-300">
                        <span className="text-teal-400 font-bold">間隔反復定着:</span> {lastAuditRecord.spacedRecall.reinforcedCount} 件 (休眠対象: {lastAuditRecord.spacedRecall.dormantMemoriesChecked}件)
                      </div>
                      <div className="text-slate-300">
                        <span className="text-sky-400 font-bold">鮮度再検証:</span> 完了 {lastAuditRecord.freshness.verifiedCount} 件 / 差分検知 {lastAuditRecord.freshness.diffsDetected} 件
                      </div>
                      <div className="text-slate-300">
                        <span className="text-indigo-400 font-bold">埋め込み健全性:</span> {lastAuditRecord.embeddingHealth.status} ({lastAuditRecord.embeddingHealth.actualEmbeddingCount}件)
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. 7段階検索パイプライン シミュレータ */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 flex items-center gap-2">
                      <Search className="w-4 h-4 text-emerald-400" />
                      8.3 検索方針: 7段階検索パイプライン シミュレーター
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      1.会話状態 ➔ 2.直近原文 ➔ 3.完全一致 ➔ 4.全文 ➔ 5.意味 ➔ 6.再順位 ➔ 7.原文再取得
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={pipelineQuery}
                      onChange={(e) => setPipelineQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRunPipelineSearch()}
                      placeholder="検索クエリを入力 (例: タメ口とゲーム設計原則, Canvas, VBA)..."
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={handleRunPipelineSearch}
                      disabled={isSearchingPipeline}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                    >
                      {isSearchingPipeline ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                      <span>パイプライン実行</span>
                    </button>
                  </div>

                  {/* 実行結果の各ステップ進捗表示 */}
                  {pipelineResult && (
                    <div className="space-y-3 pt-2 border-t border-slate-800">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {pipelineResult.steps.map((step) => (
                          <div
                            key={step.step}
                            className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] space-y-1"
                          >
                            <div className="flex items-center justify-between text-slate-300 font-bold">
                              <span className="text-emerald-400">Step {step.step}</span>
                              <span className="px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300 font-mono text-[10px]">
                                {step.count}件ヒット
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-200 font-semibold">{step.name}</div>
                            <div className="text-[9px] text-slate-400 leading-tight">{step.description}</div>
                          </div>
                        ))}
                      </div>

                      {/* 最終選定された記憶と原文抜粋 */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                          <span>厳選採用記憶 ({pipelineResult.scoredMemories.length}件) ＆ 原文再取得</span>
                          <span className="text-[10px] text-slate-400">
                            無関係・置換済み除外: {pipelineResult.filteredOutCount}件
                          </span>
                        </div>

                        {pipelineResult.scoredMemories.length === 0 ? (
                          <div className="p-4 text-center text-slate-500 bg-slate-950/50 rounded-lg">
                            該当する高関連度記憶は見つかりませんでした（閾値未満のノイズ記憶は厳格に除外されました）。
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {pipelineResult.scoredMemories.map((sm, idx) => {
                              const mem = sm.memory;
                              const rawItem = pipelineResult.retrievedRawExcerpts.find((r) => r.memoryId === mem.id);
                              return (
                                <div
                                  key={mem.id}
                                  className="p-3 rounded-lg bg-slate-950/90 border border-emerald-500/30 space-y-1.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px]">
                                        #{idx + 1} スコア: {sm.score}
                                      </span>
                                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                                        判定: {sm.matchStage}
                                      </span>
                                      {mem.longTermType && (
                                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px]">
                                          {mem.longTermType === 'design_principle' ? '確定設計原則' : mem.longTermType === 'policy' ? '長期方針' : mem.longTermType === 'preference' ? '継続的好み' : '一般ルール'}
                                        </span>
                                      )}
                                      <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 text-[10px] font-mono">
                                        {mem.lifecycleStatus || (mem.approved ? 'APPROVED' : 'UNVERIFIED')}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-mono">{mem.id}</span>
                                  </div>
                                  <p className="text-slate-200 text-xs font-medium leading-relaxed">{mem.content}</p>
                                  {rawItem && (
                                    <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400 space-y-0.5">
                                      <div className="text-slate-500 font-bold flex items-center gap-1">
                                        <FileText className="w-3 h-3 text-emerald-400" />
                                        <span>再取得された原文根拠抜粋 ({rawItem.sourceRef}):</span>
                                      </div>
                                      <div className="text-slate-300 italic font-mono">{rawItem.rawExcerpt}</div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. 置換モーダル / インライン置換フォーム (8.2 置換関係の保存) */}
                {supersedeModalOldMemId && targetOldMemory && (
                  <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/50 to-slate-900 border border-amber-500/60 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                        <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                        8.2 記憶の置換処理 (SUPERSEDED 置換関係の履歴保存)
                      </span>
                      <button
                        onClick={() => {
                          setSupersedeModalOldMemId(null);
                          setSupersedeNewContent('');
                          setSupersedeReason('');
                        }}
                        className="text-slate-400 hover:text-slate-200 p-1 rounded cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1">
                      <div className="text-[10px] text-amber-400 font-bold">置換される古い記憶 ({targetOldMemory.id}):</div>
                      <div className="text-slate-300 line-through">{targetOldMemory.content}</div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">置換後の新しい内容 (確定原則・方針):</label>
                      <textarea
                        rows={2}
                        value={supersedeNewContent}
                        onChange={(e) => setSupersedeNewContent(e.target.value)}
                        placeholder="例: 教師APIの呼び出しは固定回数ではなく、日次の無料予算上限をもとに動的最適化して運用する"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-100 text-xs focus:outline-none focus:border-amber-500 resize-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">置換理由 (なぜ訂正されたか・新方針の根拠):</label>
                      <input
                        type="text"
                        value={supersedeReason}
                        onChange={(e) => setSupersedeReason(e.target.value)}
                        placeholder="例: 固定回数だとモデルサイズ別のコスト変動に対応できないため"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setSupersedeModalOldMemId(null)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={handleExecuteSupersede}
                        className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                        <span>置換を実行 (新旧リンク保存)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. 長期記憶・置換履歴一覧 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      <button
                        onClick={() => setLongTermCategoryFilter('all')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          longTermCategoryFilter === 'all'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        有効長期記憶 ({memories.filter((m) => m.lifecycleStatus !== 'SUPERSEDED' && !m.replacedBy).length})
                      </button>
                      <button
                        onClick={() => setLongTermCategoryFilter('design_principle')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          longTermCategoryFilter === 'design_principle'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        確定設計原則 ({designPrinciples.length})
                      </button>
                      <button
                        onClick={() => setLongTermCategoryFilter('policy')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          longTermCategoryFilter === 'policy'
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        長期方針 ({policies.length})
                      </button>
                      <button
                        onClick={() => setLongTermCategoryFilter('preference')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          longTermCategoryFilter === 'preference'
                            ? 'bg-pink-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        継続的好み ({preferences.length})
                      </button>
                      <button
                        onClick={() => setLongTermCategoryFilter('superseded')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          longTermCategoryFilter === 'superseded'
                            ? 'bg-amber-600 text-white'
                            : 'bg-amber-950/40 text-amber-300 border border-amber-500/30 hover:bg-amber-900/50'
                        }`}
                      >
                        <History className="w-3 h-3" />
                        <span>置換済み履歴 ({supersededCount})</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {filteredMemories.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                        該当する記憶項目はありません。
                      </div>
                    ) : (
                      filteredMemories.map((mem) => {
                        const isSuperseded = mem.lifecycleStatus === 'SUPERSEDED' || Boolean(mem.replacedBy);
                        const isApproved = mem.approved !== false;

                        return (
                          <div
                            key={mem.id}
                            className={`p-3.5 rounded-xl border transition-all ${
                              isSuperseded
                                ? 'bg-amber-950/15 border-amber-500/30 opacity-80'
                                : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1.5 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {isSuperseded ? (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold flex items-center gap-1 border border-amber-500/40">
                                      <History className="w-3 h-3" />
                                      SUPERSEDED (置換済み)
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
                                      ACTIVE (有効)
                                    </span>
                                  )}

                                  {mem.longTermType && (
                                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] border border-indigo-500/30">
                                      {mem.longTermType === 'design_principle' ? '確定設計原則' : mem.longTermType === 'policy' ? '長期方針' : mem.longTermType === 'preference' ? '継続的好み' : '一般ルール'}
                                    </span>
                                  )}

                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                                      isApproved
                                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    }`}
                                  >
                                    {isApproved ? 'APPROVED' : 'UNVERIFIED (未検証)'}
                                  </span>

                                  {mem.reinforcementCount && mem.reinforcementCount > 0 ? (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] border border-emerald-500/30 flex items-center gap-1">
                                      🔄 定着{mem.reinforcementCount}回
                                    </span>
                                  ) : null}

                                  {mem.volatility ? (
                                    mem.volatility === 'high' ? (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] border border-amber-500/30 flex items-center gap-1">
                                        ⚡ 揮発性(時事)
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px] border border-slate-700">
                                        🛡️ 恒久原則
                                      </span>
                                    )
                                  ) : null}

                                  {mem.lastVerifiedAt ? (
                                    <span className="text-[9px] text-slate-500 font-mono">
                                      検証: {new Date(mem.lastVerifiedAt).toLocaleDateString()}
                                    </span>
                                  ) : null}

                                  <span className="text-[10px] text-slate-500 font-mono">{mem.id}</span>
                                </div>

                                <p
                                  className={`text-xs leading-relaxed ${
                                    isSuperseded ? 'text-slate-400 line-through' : 'text-slate-100 font-medium'
                                  }`}
                                >
                                  {mem.content}
                                </p>

                                {/* 設計思想 Master v5.4 第19.3項: 鮮度再検証の検出差分 */}
                                {mem.pendingVerificationDiff && (
                                  <div className="p-2.5 rounded-lg bg-teal-950/40 border border-teal-500/40 text-[11px] text-teal-200 space-y-2">
                                    <div className="font-bold flex items-center gap-1.5 text-teal-300">
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                      <span>【第19.3項 鮮度再検証】最新Web調査による更新差分が検出されています</span>
                                    </div>
                                    <div className="text-slate-300 text-[10px] leading-relaxed">
                                      {mem.pendingVerificationDiff}
                                    </div>
                                    <div className="flex items-center gap-2 pt-1">
                                      <button
                                        onClick={() => handleApplyVerificationDiff(mem)}
                                        className="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-all"
                                      >
                                        <Check className="w-3 h-3" />
                                        <span>差分を承認して置換反映</span>
                                      </button>
                                      <button
                                        onClick={() => handleDismissVerificationDiff(mem)}
                                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer transition-all"
                                      >
                                        <X className="w-3 h-3" />
                                        <span>破棄 (現状維持)</span>
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* 置換先・置換理由の表示 */}
                                {isSuperseded && (
                                  <div className="p-2 rounded bg-amber-950/40 border border-amber-500/30 text-[10px] text-amber-200 space-y-1">
                                    <div className="font-bold flex items-center gap-1">
                                      <ArrowRightLeft className="w-3 h-3 text-amber-400" />
                                      <span>置換先ID: {mem.replacedBy || '新記憶'}</span>
                                    </div>
                                    <div>置換理由: {mem.replacementReason || '新方針の適用に伴う更新'}</div>
                                  </div>
                                )}

                                {/* 置換元となった古い記憶ID */}
                                {mem.supersededFrom && (
                                  <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                                    <BookmarkCheck className="w-3 h-3" />
                                    <span>旧記憶 ({mem.supersededFrom}) を置換して新設されました</span>
                                  </div>
                                )}

                                {/* 根拠原文抜粋 */}
                                {mem.rawExcerpt && (
                                  <div className="text-[10px] text-slate-400 truncate">
                                    根拠抜粋: {mem.rawExcerpt}
                                  </div>
                                )}
                              </div>

                              {/* 操作ボタン */}
                              <div className="flex flex-col gap-1 shrink-0">
                                {(Boolean(mem.supersededFrom) || Boolean(mem.replacedBy) || isSuperseded) && (
                                  <button
                                    onClick={() => setSelectedChainMemoryId(mem.id)}
                                    className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                    title="この記憶に関連する新旧置換関係の全系譜（チェーン）を表示します"
                                  >
                                    <GitBranch className="w-3 h-3 text-amber-400" />
                                    <span>系譜</span>
                                  </button>
                                )}

                                {!isSuperseded && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setSupersedeModalOldMemId(mem.id);
                                        setSupersedeNewContent('');
                                        setSupersedeReason('');
                                      }}
                                      className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                      title="この記憶を訂正・置換し、SUPERSEDEDとして新旧関係を保持します"
                                    >
                                      <ArrowRightLeft className="w-3 h-3" />
                                      <span>置換する</span>
                                    </button>
                                    <button
                                      onClick={() => handleTogglePin(mem.id)}
                                      className={`px-2 py-1 rounded-lg text-[10px] transition-all cursor-pointer text-center ${
                                        mem.pinned
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                                      }`}
                                    >
                                      {mem.pinned ? '📌 ピン留め中' : 'ピン留め'}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* 12章 置換関係の追跡系譜 (Genealogy Chain Drawer) */}
                  {selectedChainMemoryId && (() => {
                    const chainInfo = longTermMemoryService.getSubstitutionChain(memories, selectedChainMemoryId);
                    return (
                      <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/40 space-y-3 mt-4 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GitBranch className="w-4 h-4 text-amber-400" />
                            <h4 className="text-xs font-bold text-amber-300">
                              置換関係の追跡系譜 (全 {chainInfo.chain.length} 件の履歴チェーン)
                            </h4>
                          </div>
                          <button
                            onClick={() => setSelectedChainMemoryId(null)}
                            className="text-xs text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded bg-slate-800 cursor-pointer"
                          >
                            閉じる
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          古い確定情報から最新方針への変遷を時系列（古い順 ➔ 新しい順）で追跡できます。
                        </p>
                        <div className="space-y-2 border-l-2 border-amber-500/40 ml-2 pl-3 py-1">
                          {chainInfo.chain.map((chainMem, idx) => {
                            const isSelected = chainMem.id === selectedChainMemoryId;
                            const isOld = chainMem.lifecycleStatus === 'SUPERSEDED';
                            return (
                              <div
                                key={chainMem.id}
                                className={`p-2.5 rounded-lg border text-xs relative transition-all ${
                                  isSelected
                                    ? 'bg-amber-950/40 border-amber-400 shadow-sm'
                                    : isOld
                                    ? 'bg-slate-950/60 border-slate-800 opacity-75'
                                    : 'bg-emerald-950/30 border-emerald-500/40'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-mono text-[10px] text-slate-500">#{idx + 1}</span>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                      isOld
                                        ? 'bg-amber-500/20 text-amber-300'
                                        : 'bg-emerald-500/20 text-emerald-300'
                                    }`}
                                  >
                                    {isOld ? 'SUPERSEDED (置換済み旧記憶)' : 'ACTIVE (最新有効記憶)'}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">{chainMem.id}</span>
                                </div>
                                <div className={isOld ? 'text-slate-400 line-through' : 'text-slate-100 font-medium'}>
                                  {chainMem.content}
                                </div>
                                {chainMem.replacementReason && (
                                  <div className="text-[10px] text-amber-300/80 mt-1">
                                    置換理由: {chainMem.replacementReason}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-md shadow-pink-600/20 transition-colors cursor-pointer"
          >
            完了
          </button>
        </div>
      </div>

      {/* LoRA Dataset Preview & Direct Copy Modal */}
      {loraPreviewModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-3xl bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🌸</span>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <span>LoRA学習用データセット (JSONL)</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {loraPreviewCount} 件の対話サンプル
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    絶対従順・タメ口ペルソナ・あなたの好み・開発ルールが学習用に完全整形されています
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLoraPreviewModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notice */}
            <div className="px-4 py-2.5 bg-amber-950/30 border-b border-amber-500/20 flex items-center justify-between gap-3 text-[11px] text-amber-200">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  ブラウザ環境（スマホ・iFrame等）でファイルダウンロードがブロックされた場合でも、下のボタンから1タップで全件コピーできます！
                </span>
              </div>
              <button
                onClick={() => {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(loraPreviewContent);
                    setCopiedStatus(true);
                    setTimeout(() => setCopiedStatus(false), 3000);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0 shadow transition-all cursor-pointer"
              >
                {copiedStatus ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedStatus ? 'コピー完了！' : '全行を一括コピー'}</span>
              </button>
            </div>

            {/* Code Content */}
            <div className="p-4 flex-1 overflow-y-auto font-mono text-[11px] bg-slate-950/80 text-slate-300">
              <textarea
                readOnly
                value={loraPreviewContent}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full h-80 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-amber-500/50 resize-none"
              />
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>決定論的な改善レコードとして検証・保存できます</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const blob = new Blob([loraPreviewContent], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `miki_lora_dataset_${Date.now()}.jsonl`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 15000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ファイルを再ダウンロード</span>
                </button>
                <button
                  onClick={() => setLoraPreviewModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

