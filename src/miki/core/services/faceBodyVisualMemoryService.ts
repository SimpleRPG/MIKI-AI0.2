import { canonicalSha256Object } from './canonicalSha256Service';
import { persistentVisualMemoryStoreService, type PersistentVisualMemoryRecord } from './persistentVisualMemoryStoreService';
import { visualProjectLearningCompositionService, type VisualKnowledgeMemory } from './visualProjectLearningCompositionService';
import type { VisualMemoryScope } from './visualConversationProjectGatewayService';
import type { BodyGeometryEstimate } from './visualLearningBody25dService';

export interface FaceGeometryProfile {
  faceWidthToHeight:number; jawWidthToFaceWidth:number; eyeLineToFaceHeight:number;
  eyeSpacingToFaceWidth:number; noseLengthToFaceHeight:number; mouthWidthToFaceWidth:number;
  foreheadToFaceHeight:number; chinToFaceHeight:number; headTilt:number;
  landmarkConfidence:number; occlusionRatio:number; perspectiveUncertainty:number;
}
export interface BodyVisualProfile {
  shoulderToHeight:number; waistToHeight:number; hipToHeight:number; torsoToHeight:number;
  legToHeight:number; garmentBulk:number; poseConfidence:number; silhouetteConfidence:number; uncertainty:number;
}
export interface FaceBodyMemoryContext { subject:string; sourceSha256List:string[]; scope:VisualMemoryScope; projectId?:string; familyId?:string; confidence:number; status?:'PROVISIONAL'|'GROWING'|'STABLE'; }
export interface FaceBodyMemoryPair { face?:PersistentVisualMemoryRecord; body?:PersistentVisualMemoryRecord; pairSha256:string; }

class FaceBodyVisualMemoryService {
  saveFace(profile:FaceGeometryProfile,context:FaceBodyMemoryContext):PersistentVisualMemoryRecord {this.validateRatios(profile,['faceWidthToHeight','jawWidthToFaceWidth','eyeLineToFaceHeight','eyeSpacingToFaceWidth','noseLengthToFaceHeight','mouthWidthToFaceWidth','foreheadToFaceHeight','chinToFaceHeight','landmarkConfidence','occlusionRatio','perspectiveUncertainty']);const memory=this.memory('FACE',context.subject,{profile,representation:'GEOMETRY_ONLY',identityMatching:false,rawImageStored:false,notMedicalAssessment:true},context);return persistentVisualMemoryStoreService.save(memory,context.scope,context);}
  saveBody(profile:BodyVisualProfile,context:FaceBodyMemoryContext):PersistentVisualMemoryRecord {this.validateRatios(profile,['shoulderToHeight','waistToHeight','hipToHeight','torsoToHeight','legToHeight','garmentBulk','poseConfidence','silhouetteConfidence','uncertainty']);const memory=this.memory('BODY',context.subject,{profile,representation:'GEOMETRY_ONLY',identityMatching:false,rawImageStored:false,notMedicalAssessment:true},context);return persistentVisualMemoryStoreService.save(memory,context.scope,context);}
  savePair(input:{face?:FaceGeometryProfile;body?:BodyVisualProfile;context:FaceBodyMemoryContext}):FaceBodyMemoryPair {if(!input.face&&!input.body)throw new Error('FACE_OR_BODY_PROFILE_REQUIRED');const face=input.face?this.saveFace(input.face,input.context):undefined;const body=input.body?this.saveBody(input.body,input.context):undefined;return{face,body,pairSha256:canonicalSha256Object({face:face?.memory.memorySha256,body:body?.memory.memorySha256,subject:input.context.subject})};}
  bodyFromEstimate(estimate:BodyGeometryEstimate):BodyVisualProfile {return{shoulderToHeight:estimate.shoulderToHeight,waistToHeight:estimate.waistToHeight,hipToHeight:estimate.hipToHeight,torsoToHeight:estimate.torsoToHeight,legToHeight:estimate.legToHeight,garmentBulk:estimate.garmentBulk,poseConfidence:estimate.poseConfidence,silhouetteConfidence:estimate.silhouetteConfidence,uncertainty:estimate.uncertainty};}
  loadForGeneration(query:{subject?:string;projectId?:string;familyId?:string;minConfidence?:number}){const records=persistentVisualMemoryStoreService.query({...query,kinds:['FACE','BODY'],limit:24});persistentVisualMemoryStoreService.markUsed(records.map(x=>x.memory.memoryId),query);return{face:records.filter(x=>x.memory.kind==='FACE').map(x=>x.memory),body:records.filter(x=>x.memory.kind==='BODY').map(x=>x.memory),memoryIds:records.map(x=>x.memory.memoryId),selectionSha256:canonicalSha256Object(records.map(x=>x.memory.memorySha256))};}
  private memory(kind:'FACE'|'BODY',subject:string|FaceBodyMemoryContext,payload:Record<string,unknown>,context?:FaceBodyMemoryContext):VisualKnowledgeMemory {const source=typeof subject==='string'?context! : subject;const name=typeof subject==='string'?subject:subject.subject;if(!name.trim()||!source.sourceSha256List.length)throw new Error('FACE_BODY_MEMORY_SOURCE_REQUIRED');return visualProjectLearningCompositionService.createMemory({kind,subject:name,payload,confidence:source.confidence,status:source.status??(source.confidence>=.88?'STABLE':source.confidence>=.68?'GROWING':'PROVISIONAL'),sourceSha256List:source.sourceSha256List});}
  private validateRatios(value:object,keys:string[]){for(const key of keys){const current=(value as Record<string,number>)[key];if(!Number.isFinite(current)||current<0||current>1)throw new Error(`INVALID_FACE_BODY_RATIO:${key}`);}if(Math.abs(((value as Record<string,number>).headTilt??0))>1)throw new Error('INVALID_HEAD_TILT');}
}
export const faceBodyVisualMemoryService=new FaceBodyVisualMemoryService();
