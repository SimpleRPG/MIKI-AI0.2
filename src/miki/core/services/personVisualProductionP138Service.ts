import { canonicalSha256Object } from './canonicalSha256Service';
import { garmentEvidenceLearningService, type GarmentEvidenceInput, type GarmentLearningProfile } from './garmentEvidenceLearningService';
import { garmentBoundaryRenderingPolicyService, type GarmentBoundaryRenderingPolicy } from './garmentBoundaryRenderingPolicyService';
import { RasterCanvas } from './rasterCanvasService';

export type PersonRenderQuality='PIXEL_NATIVE'|'PIXEL_ILLUSTRATION'|'ILLUSTRATION_2D'|'ILLUSTRATION_25D';
export interface P138ConfirmationAnswer{questionId:string;regionId:string;sourceSha256:string;profileSha256BeforeAnswer:string;decision:'PRESENT'|'ABSENT'|'UNKNOWN';}
export interface P138GarmentRecord{garmentId:string;regionId:string;kind:string;layer:string;evidenceProfile:GarmentLearningProfile;presence:string;gapState:string;gapObservationComplete:boolean;zeroGapConfidence:number;gaps:GarmentLearningProfile['gaps'];confirmationContract?:GarmentLearningProfile['confirmationContract'];boundaryRenderingPolicy:GarmentBoundaryRenderingPolicy;sourceSha256:string;evidenceProfileSha256:string;boundaryPolicySha256:string;revision:number;status:'PROVISIONAL'|'CONFIRMED';}
export interface P138VisualProfile{profileId:string;revision:number;subject:string;garments:P138GarmentRecord[];confirmationHistory:Array<{questionId:string;regionId:string;sourceSha256:string;profileSha256BeforeAnswer:string;profileSha256AfterAnswer:string;answer:string;answeredAt:number;consumed:boolean}>;profileSha256:string;}
export interface P138PngArtifact{quality:PersonRenderQuality;width:number;height:number;rgba:Uint8Array;png:Uint8Array;sha256:string;profileSha256:string;boundaryPolicySha256:string;}

class PersonVisualProductionP138Service{
 analyzeAndCreateProfile(subject:string,input:GarmentEvidenceInput):P138VisualProfile{const analyzed=garmentEvidenceLearningService.analyze(input);const evidence=analyzed.confirmationRequired&&!analyzed.confirmationContract?garmentEvidenceLearningService.issueConfirmation(analyzed):analyzed;const policy=garmentBoundaryRenderingPolicyService.resolve({profile:evidence,appearancePalette:input.appearancePalette,garmentPalette:input.garmentPalette,observedBoundaryConfidence:input.boundaryConfidence,observedSeamConfidence:input.seamConfidence,observedShadowConfidence:input.wrinkleConfidence,observedTextureDifference:input.textureDifference,garmentThickness:input.layerOverlapConfidence*.03});const garment:P138GarmentRecord={garmentId:`GAR-${input.regionId}`,regionId:input.regionId,kind:evidence.kind,layer:evidence.layer,evidenceProfile:evidence,presence:evidence.presence,gapState:evidence.gapState,gapObservationComplete:evidence.gapObservationComplete,zeroGapConfidence:evidence.zeroGapConfidence,gaps:evidence.gaps,confirmationContract:evidence.confirmationContract,boundaryRenderingPolicy:policy,sourceSha256:input.sourceSha256,evidenceProfileSha256:evidence.profileSha256,boundaryPolicySha256:policy.policySha256,revision:1,status:evidence.confirmationRequired?'PROVISIONAL':'CONFIRMED'};return this.seal({profileId:`P138-${input.regionId}`,revision:1,subject,garments:[garment],confirmationHistory:[],profileSha256:''});}
 consumeConfirmation(profile:P138VisualProfile,answer:P138ConfirmationAnswer):P138VisualProfile{this.verify(profile);const g=profile.garments.find(x=>x.regionId===answer.regionId);if(!g||!g.confirmationContract)throw new Error('GARMENT_CONFIRMATION_NOT_FOUND');const updated=garmentEvidenceLearningService.resolve(g.evidenceProfile,answer);const next=structuredClone(profile);const ng=next.garments.find(x=>x.regionId===answer.regionId)!;ng.evidenceProfile=updated;ng.presence=updated.presence;ng.confirmationContract=updated.confirmationContract;ng.evidenceProfileSha256=updated.profileSha256;ng.revision++;ng.status='CONFIRMED';next.revision++;next.confirmationHistory.push({questionId:answer.questionId,regionId:answer.regionId,sourceSha256:answer.sourceSha256,profileSha256BeforeAnswer:answer.profileSha256BeforeAnswer,profileSha256AfterAnswer:updated.profileSha256,answer:answer.decision,answeredAt:Date.now(),consumed:true});return this.seal(next);}
 confirmationQuestion(profile:P138VisualProfile):string|null{return profile.garments.some(g=>g.presence==='GARMENT_CONFIRMATION_REQUIRED')?'対象領域では外観と衣服候補の差を確定できません。衣服あり、衣服なし、不明のまま、のどれとして扱いますか？':null;}
 async render(profile:P138VisualProfile,quality:PersonRenderQuality):Promise<P138PngArtifact>{this.verify(profile);const policy=profile.garments[0].boundaryRenderingPolicy;const dims:Record<PersonRenderQuality,[number,number]>={PIXEL_NATIVE:[64,96],PIXEL_ILLUSTRATION:[256,384],ILLUSTRATION_2D:[512,768],ILLUSTRATION_25D:[768,1152]};const [w,h]=dims[quality],ss=quality==='ILLUSTRATION_2D'?3:quality==='ILLUSTRATION_25D'?2:1,c=new RasterCanvas(w,h,ss),s=w/256;const skin='#f2c6a8',hair='#302333',cloth='#ececec',shadow='#b8bdc8',deep='#777f91',light='#ffffff',shoe='#34333a';
  if(quality==='ILLUSTRATION_25D'){c.softEllipse(w*.52,h*.915,w*.185,h*.03,'#000000',.38);c.softEllipse(w*.545,h*.52,w*.20,h*.38,'#000000',.13);}
  c.ellipse(w*.5,h*.15,w*.105,h*.105,hair);c.ellipse(w*.482,h*.136,w*.096,h*.099,'#453550',.85);c.ellipse(w*.5,h*.165,w*.088,h*.092,skin);if(quality==='PIXEL_NATIVE'||quality==='PIXEL_ILLUSTRATION'){c.ellipse(w*.468,h*.158,w*.008,h*.006,'#332f36');c.ellipse(w*.532,h*.158,w*.008,h*.006,'#332f36');}if(quality==='PIXEL_NATIVE'||quality==='PIXEL_ILLUSTRATION')c.line(w*.49,h*.19,w*.51,h*.19,'#9c5d60',1,Math.max(1,s));
  if(quality==='ILLUSTRATION_2D'||quality==='ILLUSTRATION_25D'){
    // P468: 図形の貼り合わせではなく、筆（ストローク）で描く。目・眉・髪の流れ。
    c.softEllipse(w*.5,h*.242,w*.034,h*.013,'#d9a37e',.35); // 首の陰
    for(const ex of [w*.468,w*.532]){const ey=h*.16;const dir=ex<w*.5?-1:1;
      c.ellipse(ex,ey,w*.0165,h*.0092,'#fdfdfd',.96);
      c.gradientEllipse(ex,ey+h*.0005,w*.0092,h*.0082,'#2e2018','#7c4b26');
      c.ellipse(ex,ey+h*.0005,w*.004,h*.0042,'#14100c');
      c.ellipse(ex-w*.0035,ey-h*.003,w*.0028,h*.0028,'#ffffff');c.ellipse(ex+w*.003,ey+h*.0035,w*.0016,h*.0016,'#ffffff',.9);
      c.bezierStroke([ex-w*.017,ey-h*.002],[ex,ey-h*.014],[ex+w*.017,ey-h*.002],null,{color:'#2b2126',width:Math.max(1.2,s*1.2),taperIn:.35,taperOut:.35});
      c.bezierStroke([ex+dir*w*.0155,ey-h*.0035],[ex+dir*w*.0185,ey-h*.0055],[ex+dir*w*.0205,ey-h*.005],null,{color:'#2b2126',width:Math.max(1,s*.95),taperIn:.2,taperOut:.6});
      c.bezierStroke([ex-w*.013,ey-h*.0118],[ex,ey-h*.0168],[ex+w*.013,ey-h*.0118],null,{color:'#b98a68',width:Math.max(.7,s*.7),alpha:.55,taperIn:.3,taperOut:.3});
      c.strokePath([[ex-w*.011,ey+h*.0082],[ex+w*.011,ey+h*.0082]],{color:'#a9806a',width:Math.max(.8,s*.6),alpha:.4,taperIn:.3,taperOut:.3});
    }
    c.bezierStroke([w*.488,h*.19],[w*.5,h*.1945],[w*.512,h*.19],null,{color:'#9c5d60',width:Math.max(.9,s*.95),taperIn:.35,taperOut:.35}); // 微笑みの口
    c.bezierStroke([w*.45,h*.146],[w*.467,h*.1395],[w*.486,h*.1445],null,{color:'#4a3a3a',width:Math.max(1,s*1.1),alpha:.8,taperIn:.3,taperOut:.3});
    c.bezierStroke([w*.514,h*.1445],[w*.533,h*.1395],[w*.55,h*.146],null,{color:'#4a3a3a',width:Math.max(1,s*1.1),alpha:.8,taperIn:.3,taperOut:.3});
    c.line(w*.5,h*.166,w*.496,h*.179,'#d9a37e',.85,Math.max(1,s));
    c.softEllipse(w*.45,h*.186,w*.021,h*.012,'#e8977a',.32);c.softEllipse(w*.55,h*.186,w*.021,h*.012,'#e8977a',.32);
    // 髪: ベースの楕円の上に、流れのある毛束とハイライトを筆で足す
    c.bezierStroke([w*.408,h*.088],[w*.394,h*.16],[w*.402,h*.215],[w*.418,h*.268],{color:'#241a2e',width:w*.011,taperIn:.15,taperOut:.55});
    c.bezierStroke([w*.592,h*.088],[w*.606,h*.16],[w*.598,h*.215],[w*.582,h*.268],{color:'#241a2e',width:w*.011,taperIn:.15,taperOut:.55});
    c.bezierStroke([w*.415,h*.095],[w*.405,h*.17],[w*.415,h*.24],null,{color:'#55436a',width:w*.006,alpha:.75,taperIn:.2,taperOut:.5});
    c.bezierStroke([w*.585,h*.095],[w*.595,h*.17],[w*.585,h*.24],null,{color:'#55436a',width:w*.006,alpha:.75,taperIn:.2,taperOut:.5});
    // 前髪: 帯＋丸い毛束の重なりで下端を柔らかく波打たせ、毛束の分かれ目と額の陰を足す
    c.poly([[w*.415,h*.075],[w*.44,h*.052],[w*.475,h*.045],[w*.5,h*.043],[w*.525,h*.045],[w*.56,h*.052],[w*.585,h*.075],[w*.582,h*.088],[w*.418,h*.088]],hair);
    for(const bx of [.4375,.46875,.5,.53125,.5625])c.ellipse(w*bx,h*.09,w*.02,h*.0135,hair);
    c.strokePath([[w*.475,h*.05],[w*.474,h*.096]],{color:'#241a2e',width:Math.max(.8,s*.7),alpha:.55,taperIn:.2,taperOut:.3});
    c.strokePath([[w*.5,h*.048],[w*.5,h*.1]],{color:'#241a2e',width:Math.max(.8,s*.7),alpha:.55,taperIn:.2,taperOut:.3});
    c.strokePath([[w*.525,h*.05],[w*.526,h*.096]],{color:'#241a2e',width:Math.max(.8,s*.7),alpha:.55,taperIn:.2,taperOut:.3});
    c.softEllipse(w*.5,h*.121,w*.06,h*.011,'#d9a37e',.22); // 前髪の下の額の陰
    c.bezierStroke([w*.44,h*.078],[w*.472,h*.058],[w*.532,h*.066],null,{color:'#6d557f',width:w*.007,alpha:.45,taperIn:.3,taperOut:.3});
  }
  c.poly([[w*.42,h*.25],[w*.58,h*.25],[w*.64,h*.58],[w*.36,h*.58]],cloth);c.poly([[w*.42,h*.25],[w*.50,h*.25],[w*.47,h*.58],[w*.36,h*.58]],shadow);c.poly([[w*.50,h*.25],[w*.58,h*.25],[w*.64,h*.58],[w*.47,h*.58]],light);
  c.poly([[w*.42,h*.27],[w*.33,h*.31],[w*.28,h*.55],[w*.34,h*.57],[w*.43,h*.39]],cloth);c.poly([[w*.58,h*.27],[w*.67,h*.31],[w*.72,h*.55],[w*.66,h*.57],[w*.57,h*.39]],cloth);c.ellipse(w*.30,h*.58,w*.028,h*.04,skin);c.ellipse(w*.70,h*.58,w*.028,h*.04,skin);
  c.poly([[w*.40,h*.58],[w*.49,h*.58],[w*.47,h*.88],[w*.37,h*.88]],deep);c.poly([[w*.51,h*.58],[w*.60,h*.58],[w*.63,h*.88],[w*.53,h*.88]],'#687185');c.ellipse(w*.40,h*.90,w*.07,h*.025,shoe);c.ellipse(w*.60,h*.90,w*.07,h*.025,shoe);
  if(quality!=='PIXEL_NATIVE'){for(let i=0;i<5;i++)c.line(w*(.405+i*.045),h*.31,w*(.39+i*.05),h*.55,i%2?light:shadow,.22,Math.max(1,s));c.line(w*.43,h*.255,w*.50,h*.30,shadow,.65,Math.max(1,s));c.line(w*.57,h*.255,w*.50,h*.30,shadow,.65,Math.max(1,s));}
  if(policy.drawBoundary&&policy.boundaryColor){const col=policy.boundaryColor;c.line(w*.42,h*.25,w*.36,h*.58,col,policy.boundaryOpacity,Math.max(1,s));c.line(w*.58,h*.25,w*.64,h*.58,col,policy.boundaryOpacity,Math.max(1,s));}
  if(quality==='ILLUSTRATION_25D'){c.ellipse(w*.68,h*.36,w*.025,h*.20,'#ffffff',.25);c.line(w*.38,h*.58,w*.62,h*.58,'#000000',.18,Math.max(2,s*2));c.line(w*.37,h*.88,w*.47,h*.88,'#000000',.18,Math.max(2,s));}
  const png=await c.toPng();return{quality,width:w,height:h,rgba:c.toRgba(),png,sha256:await this.sha(png),profileSha256:profile.profileSha256,boundaryPolicySha256:policy.policySha256};}
 private seal(p:P138VisualProfile){p.profileSha256='';p.profileSha256=canonicalSha256Object(p);return p;}private verify(p:P138VisualProfile){const c=structuredClone(p);c.profileSha256='';if(canonicalSha256Object(c)!==p.profileSha256)throw new Error('P138_PROFILE_SHA_MISMATCH');}
 private async sha(d:Uint8Array){const h=await crypto.subtle.digest('SHA-256',d.slice().buffer);return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');}
}
export const personVisualProductionP138Service=new PersonVisualProductionP138Service();
