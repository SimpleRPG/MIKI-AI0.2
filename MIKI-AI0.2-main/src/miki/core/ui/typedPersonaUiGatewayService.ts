import { coreTaskIngressService } from '../services/coreTaskIngressService';
import { personaProfileService, type PersonaProfile, type PersonaProfileReceipt } from '../../conversation/services/personaProfileService';

export interface PersonaUiSaveResult {
  status: 'SUCCESS' | 'BLOCKED' | 'FAILED';
  taskId?: string;
  summary: string;
  profile?: PersonaProfile;
  receipt?: PersonaProfileReceipt;
}

class TypedPersonaUiGatewayService {
  getProfile(): PersonaProfile { return personaProfileService.get(); }
  getDefaultProfile(): PersonaProfile { return personaProfileService.getDefault(); }
  preview(profile: PersonaProfile) { return personaProfileService.preview(profile); }

  async saveProfile(input: Pick<PersonaProfile, 'name' | 'personalityText' | 'avatarId'>): Promise<PersonaUiSaveResult> {
    const core = await coreTaskIngressService.submit({
      kind: 'USER_REQUEST',
      goal: '会話・人格設定を保存する',
      source: 'conversation',
      payload: { operation: 'SAVE_PERSONA_PROFILE', requestedBy: 'PERSONA_SETTINGS_UI', name: input.name, avatarId: input.avatarId, personalityTextLength: input.personalityText.length },
    });
    if (core.task.status !== 'COMPLETED') return { status: 'BLOCKED', taskId: core.task.taskId, summary: 'coreが保存を完了確定していません。' };
    try {
      const saved = await personaProfileService.save(input);
      return { status: 'SUCCESS', taskId: core.task.taskId, summary: '会話・人格設定を保存しました。', ...saved };
    } catch (error) {
      return { status: 'FAILED', taskId: core.task.taskId, summary: error instanceof Error ? error.message : 'PERSONA_PROFILE_SAVE_FAILED' };
    }
  }
}

export const typedPersonaUiGatewayService = new TypedPersonaUiGatewayService();
export type { PersonaProfile } from '../../conversation/services/personaProfileService';
