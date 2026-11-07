import { storageService } from '../../../services/storageService';
import { systemLogger } from '../../../services/systemLogger';
import { canonicalSha256Object } from './canonicalSha256Service';
import {
  reusableComponentFactoryService,
  type KnowledgeComponentArtifact,
} from './reusableComponentFactoryService';
import { personaProfileService } from '../../conversation/services/personaProfileService';

/*
 * P466: アバター設計図の土台 —「みきが自分の姿を自分で作る」ための入口。
 *
 * 設計の線引き（既存の思想に合わせる）:
 * - 描画ロジックそのものは発明しない。描くのは既存の描画基盤
 *   （rasterCanvasService と renderer 群）の仕事。
 * - みきが作るのは「設計図」＝見た目レイヤー（髪・顔・体・服・
 *   アクセサリ・背景）とパレットの組み合わせ。これを部品工場の
 *   候補（KNOWLEDGE / AVATAR_BLUEPRINT）として登録し、既存の
 *   検証・承認の流れに乗せる。
 * - 採用すると PersonaProfile の avatarId が設計図を指すようになり、
 *   avatarAssetVersion が上がる（版管理は personaProfileService の
 *   既存 semantics を使う）。
 *
 * avatarId → 画像実体の解決と画面表示は、この土台の次の接続とする。
 */

export interface AvatarBlueprint {
  /** 対象ペルソナの名前（任意のメモ）。 */
  personaName?: string;
  /** 見た目レイヤーの選択。キーは visualAssetLibraryService の VisualLayerKind に対応。 */
  layers: Partial<Record<
    | 'SUBJECT_APPEARANCE'
    | 'HAIR'
    | 'FACE_STYLE'
    | 'BODY_SHAPE'
    | 'GARMENT_UPPER'
    | 'GARMENT_LOWER'
    | 'OUTERWEAR'
    | 'FOOTWEAR'
    | 'ACCESSORY'
    | 'POSE'
    | 'BACKGROUND'
    | 'PALETTE'
    | 'MOTION',
    string
  >>;
  /** #rrggbb の配列。 */
  palette: string[];
  note?: string;
}

export interface AvatarBlueprintRecord {
  componentId: string;
  blueprint: AvatarBlueprint;
  createdAt: number;
}

const INDEX_KEY = 'miki_avatar_blueprints_v1';

class AvatarBlueprintService {
  private readIndex(): AvatarBlueprintRecord[] {
    try {
      const raw = storageService.getItem(INDEX_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as AvatarBlueprintRecord[]) : [];
    } catch {
      return [];
    }
  }

  private writeIndex(records: AvatarBlueprintRecord[]): void {
    try {
      storageService.setItem(INDEX_KEY, JSON.stringify(records.slice(-100)));
    } catch { /* 索引の保存失敗は登録を止めない */ }
  }

  /** 設計図を部品候補として登録する。 */
  public createBlueprint(blueprint: AvatarBlueprint): AvatarBlueprintRecord {
    for (const color of blueprint.palette) {
      if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('AVATAR_PALETTE_INVALID');
    }
    const body = {
      componentKind: 'KNOWLEDGE' as const,
      componentType: 'AVATAR_BLUEPRINT',
      purpose: `Avatar blueprint: ${blueprint.personaName || 'self'}`,
      interfaceContract: {
        input: 'persona appearance intent',
        output: 'layer and palette selection for avatar rendering',
      },
      inputs: ['appearance layers', 'palette'],
      outputs: ['avatar blueprint'],
      prerequisites: [],
      dependencies: ['visual-asset-library', 'raster-canvas'],
      appliesWhen: ['avatar rendering', 'self presentation'],
      doesNotApplyWhen: ['blueprint not yet approved'],
      sourceEpisodeIds: [],
      sourceLearningArtifactIds: [],
      environmentFingerprint: 'unknown',
      lifecycleStatus: 'CANDIDATE' as const,
      usageCount: 0,
      successCount: 0,
      failureCount: 0,
      claimIds: [],
      evidenceRefs: [],
      sourceUrls: [],
      sourceArtifactIds: [],
      verificationStatus: 'UNVERIFIED' as const,
      contradictionRefs: [],
      freshnessPolicy: 'REVALIDATE_ON_ENVIRONMENT_CHANGE',
      blueprint,
    };
    const canonicalSha256 = canonicalSha256Object(body);
    const component: KnowledgeComponentArtifact = {
      ...body,
      componentId: `RC-KNOWLEDGE-AVATAR-${canonicalSha256.slice(0, 18)}`,
      canonicalSha256,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as KnowledgeComponentArtifact;
    reusableComponentFactoryService.storeCandidates([component]);
    const record: AvatarBlueprintRecord = {
      componentId: component.componentId,
      blueprint,
      createdAt: Date.now(),
    };
    const index = this.readIndex();
    if (!index.some((r) => r.componentId === record.componentId)) {
      index.push(record);
      this.writeIndex(index);
    }
    systemLogger.info('SELF_IMPROVEMENT', `🎨 [AvatarBlueprint] 設計図を部品候補として登録: ${record.componentId}`);
    return record;
  }

  public listBlueprints(): AvatarBlueprintRecord[] {
    return this.readIndex();
  }

  public getBlueprint(componentId: string): AvatarBlueprintRecord | null {
    return this.readIndex().find((r) => r.componentId === componentId) || null;
  }

  /**
   * 設計図を現在のペルソナに採用する。avatarId が設計図を指すように
   * なり、avatarAssetVersion が上がる。
   */
  public async adoptBlueprint(componentId: string): Promise<{ avatarId: string; avatarAssetVersion: number }> {
    const record = this.getBlueprint(componentId);
    if (!record) throw new Error('AVATAR_BLUEPRINT_NOT_FOUND');
    const current = personaProfileService.get();
    const avatarId = `blueprint:${componentId}`;
    const { profile } = await personaProfileService.save({
      name: current.name,
      personalityText: current.personalityText,
      avatarId,
    });
    systemLogger.info('SELF_IMPROVEMENT', `🎨 [AvatarBlueprint] 設計図を採用: ${avatarId}（版 ${profile.avatarAssetVersion}）`);
    return { avatarId, avatarAssetVersion: profile.avatarAssetVersion };
  }
}

export const avatarBlueprintService = new AvatarBlueprintService();
