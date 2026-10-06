import { canonicalSha256Object } from './canonicalSha256Service';
import { canonicalPersonSurfaceP171Service,type CanonicalPersonSurface,type V3 } from './canonicalPersonSurfaceP171Service';
import type { FaceFeatureEvidenceP146 } from './realPhotoFaceFeatureP146Service';
import type { HeadPoseOcclusionP149 } from './headPoseOcclusionP149Service';
export interface P180Image{width:number;height:number;rgba:Uint8Array;sourceSha256:string}
export interface P180Pose{jointRotations:Record<string,V3>;yaw:number;pitch:number;roll:number}
export interface P180Artifact{width:number;height:number;png:Uint8Array;pngSha256:string;atlasPng:Uint8Array;atlasSha256:string;receiptSha256:string;metrics:Record<string,number>;graphMutations:Array<Record<string,unknown>>}
type WeightedVertex={position:V3;normal:V3;uv:{u:number;v:number};region:string;bones:Array<{joint:string;weight:number}>};
class UsablePersonGenerationP180Service{
 async generate(personId:string,images:P180Image[],face:FaceFeatureEvidenceP146,head:HeadPoseOcclusionP149,pose:P180Pose):Promise<P180Artifact>{if(!images.length)throw new Error('P180_IMAGE_REQUIRED');const base=canonicalPersonSurfaceP171Service.build(face.sourceSha256),mesh=this.deformAndWeight(base,face),atlas=this.fuseAtlas(images,face),skinned=this.skin(mesh,base,pose),render=this.rasterize(skinned,base,atlas,pose,1024,1536,face),png=await this.png(render.width,render.height,render.rgba),atlasPng=await this.png(atlas.width,atlas.height,atlas.rgba),pngSha256=await this.sha(png),atlasSha256=await this.sha(atlasPng),coverage=render.rgba.filter((_,i)=>i%4===3&&render.rgba[i]>0).length/(render.width*render.height),metrics={triangleCount:base.triangles.length,vertexCount:mesh.length,atlasObservedRatio:atlas.observed/atlas.total,opaqueCoverage:coverage,zVisiblePixels:render.visible,personSpecificDisplacement:mesh.reduce((s,v,i)=>s+Math.hypot(v.position.x-base.vertices[i].position.x,v.position.y-base.vertices[i].position.y,v.position.z-base.vertices[i].position.z),0)/mesh.length},graphMutations=[{semanticKind:'OBSERVATION',ownerDomain:'data',participantDomains:['learning','memory','verification'],subjectId:`person:${personId}`,payload:{sourceSha256List:images.map(x=>x.sourceSha256),faceEvidenceSha256:face.evidenceSha256,poseSha256:head.poseSha256}},{semanticKind:'EXPERIENCE',ownerDomain:'experience',participantDomains:['learning','memory','verification','improvement'],subjectId:`person:${personId}`,payload:{action:'PERSON_MESH_RENDER',result:{pngSha256,atlasSha256,metrics},reuseCondition:'validated output only'}},{semanticKind:'VALIDATION',ownerDomain:'verification',participantDomains:['learning','memory'],subjectId:`person:${personId}`,payload:{pngSha256,atlasSha256,traceable:true}}],receipt={personId,sourceSha256List:images.map(x=>x.sourceSha256),faceEvidenceSha256:face.evidenceSha256,poseSha256:head.poseSha256,surfaceSha256:base.surfaceSha256,pngSha256,atlasSha256,metrics};return{width:render.width,height:render.height,png,pngSha256,atlasPng,atlasSha256,receiptSha256:canonicalSha256Object(receipt),metrics,graphMutations}}
 private deformAndWeight(s:CanonicalPersonSurface,f:FaceFeatureEvidenceP146):WeightedVertex[]{const jaw=.82+f.ratios.jawTaper*.32,eye=.9+f.ratios.eyeSpacing*.20,nose=.9+f.ratios.noseLength*.30;return s.vertices.map(v=>{let p={...v.position};if(v.region==='face'){const lower=Math.max(0,Math.min(1,(.72-p.y)/.25));p.x*=eye*(1-lower)+jaw*lower;if(p.z>0)p.z*=nose}const bones=this.weights(v.region,p);return{...v,position:p,bones}})}
 private weights(region:string,p:V3){if(region==='face')return[{joint:'head',weight:.88},{joint:'neck',weight:.12}];if(region==='torso')return[{joint:p.y>.32?'spine':'root',weight:.75},{joint:p.y>.32?'neck':'spine',weight:.25}];if(region.startsWith('arm')){const side=p.x<0?'L':'R',t=Math.max(0,Math.min(1,(.43-p.y)/.55));return t<.55?[{joint:`shoulder${side}`,weight:1-t},{joint:`elbow${side}`,weight:t}]:[{joint:`elbow${side}`,weight:2-t},{joint:`wrist${side}`,weight:t-1}]};if(region.startsWith('leg'))return[{joint:'root',weight:1}];return[{joint:'root',weight:1}]}
 private skin(vs:WeightedVertex[],s:CanonicalPersonSurface,pose:P180Pose){const joints=new Map(s.joints.map(j=>[j.name,j]));return vs.map(v=>{let out={x:0,y:0,z:0};for(const b of v.bones){const j=joints.get(b.joint);if(!j)continue;const r=pose.jointRotations[b.joint]||{x:0,y:0,z:0},q=this.rotate({x:v.position.x-j.position.x,y:v.position.y-j.position.y,z:v.position.z-j.position.z},r);out.x+=(q.x+j.position.x)*b.weight;out.y+=(q.y+j.position.y)*b.weight;out.z+=(q.z+j.position.z)*b.weight}return{...v,position:out}})}
 private rotate(p:V3,r:V3){const rx=r.x*Math.PI/180,ry=r.y*Math.PI/180,rz=r.z*Math.PI/180;let y=p.y*Math.cos(rx)-p.z*Math.sin(rx),z=p.y*Math.sin(rx)+p.z*Math.cos(rx),x=p.x;const x2=x*Math.cos(ry)+z*Math.sin(ry);z=-x*Math.sin(ry)+z*Math.cos(ry);x=x2;return{x:x*Math.cos(rz)-y*Math.sin(rz),y:x*Math.sin(rz)+y*Math.cos(rz),z}}
 private fuseAtlas(images:P180Image[], f:FaceFeatureEvidenceP146) {
  const width=1024, height=1024;
  const rgba=new Uint8Array(width*height*4);
  const weight=new Float32Array(width*height);
  const regions=[
   {x:0,y:0,w:512,h:512,box:f.faceBox},
   {x:512,y:0,w:512,h:512,box:{x:f.faceBox.x-f.faceBox.width*.1,y:f.faceBox.y-f.faceBox.height*.25,width:f.faceBox.width*1.2,height:f.faceBox.height*.65}},
   {x:0,y:512,w:1024,h:512,box:{x:f.faceBox.x-f.faceBox.width*.8,y:f.faceBox.y+f.faceBox.height*.9,width:f.faceBox.width*2.6,height:f.faceBox.height*1.6}}
  ];
  let observed=0;
  for(const im of images){
   for(const rg of regions){
    for(let ty=0;ty<rg.h;ty+=2){
     for(let tx=0;tx<rg.w;tx+=2){
      const sx=Math.round(rg.box.x+(tx/rg.w)*rg.box.width);
      const sy=Math.round(rg.box.y+(ty/rg.h)*rg.box.height);
      if(sx<0||sy<0||sx>=im.width||sy>=im.height)continue;
      const si=(sy*im.width+sx)*4;
      if(im.rgba[si+3]<32)continue;
      for(let oy=0;oy<2;oy++){
       for(let ox=0;ox<2;ox++){
        const dx=rg.x+tx+ox,dy=rg.y+ty+oy;
        if(dx>=width||dy>=height)continue;
        const di=dy*width+dx,w0=weight[di],w1=1/(1+Math.abs(.5-tx/rg.w)+Math.abs(.5-ty/rg.h));
        for(let c=0;c<4;c++)rgba[di*4+c]=Math.round((rgba[di*4+c]*w0+im.rgba[si+c]*w1)/(w0+w1));
        weight[di]=w0+w1;
        if(w0===0)observed++;
       }
      }
     }
    }
   }
  }
  for(let i=0;i<weight.length;i++){
   if(weight[i]===0){rgba[i*4]=110;rgba[i*4+1]=100;rgba[i*4+2]=95;rgba[i*4+3]=255;}
  }
  return{width,height,rgba,observed,total:weight.length};
 }
 private rasterize(vs:WeightedVertex[],s:CanonicalPersonSurface,atlas:{width:number;height:number;rgba:Uint8Array},pose:P180Pose,width:number,height:number,f:FaceFeatureEvidenceP146){const rgba=new Uint8Array(width*height*4),depth=new Float32Array(width*height);depth.fill(Infinity);let visible=0;const yaw=pose.yaw*Math.PI/180,pitch=pose.pitch*Math.PI/180,roll=pose.roll*Math.PI/180,project=(p:V3)=>{let q=this.rotate(p,{x:pose.pitch,y:pose.yaw,z:pose.roll}),z=q.z+3.2,scale=1.35/z;return{x:width/2+q.x*width*scale,y:height*.45-q.y*height*scale,z}};const pv=vs.map(v=>({...project(v.position),u:v.uv.u,v:v.uv.v,n:v.normal,region:v.region}));for(const t of s.triangles){const a=pv[t.a],b=pv[t.b],c=pv[t.c],minX=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),maxX=Math.min(width-1,Math.ceil(Math.max(a.x,b.x,c.x))),minY=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),maxY=Math.min(height-1,Math.ceil(Math.max(a.y,b.y,c.y))),den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(den)<1e-6)continue;for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const w1=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/den,w2=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/den,w3=1-w1-w2;if(w1<0||w2<0||w3<0)continue;const z=w1*a.z+w2*b.z+w3*c.z,di=y*width+x;if(z>=depth[di])continue;depth[di]=z;visible++;const u=(w1*a.u+w2*b.u+w3*c.u)%1,v=Math.max(0,Math.min(1,w1*a.v+w2*b.v+w3*c.v)),tile=t.material==='face'?{x:0,y:0,w:512,h:512}:t.material==='torso'?{x:0,y:512,w:1024,h:512}:{x:512,y:0,w:512,h:512},tx=Math.min(atlas.width-1,Math.max(0,Math.floor(tile.x+u*tile.w))),ty=Math.min(atlas.height-1,Math.max(0,Math.floor(tile.y+v*tile.h))),si=(ty*atlas.width+tx)*4,nz=Math.max(.15,w1*a.n.z+w2*b.n.z+w3*c.n.z),shade=.32+.68*nz;rgba[di*4]=Math.round(atlas.rgba[si]*shade);rgba[di*4+1]=Math.round(atlas.rgba[si+1]*shade);rgba[di*4+2]=Math.round(atlas.rgba[si+2]*shade);rgba[di*4+3]=255}}return{width,height,rgba,visible}}
 private async png(w:number,h:number,p:Uint8Array){const raw=new Uint8Array((w*4+1)*h);for(let y=0;y<h;y++){const o=y*(w*4+1);raw[o]=0;raw.set(p.subarray(y*w*4,(y+1)*w*4),o+1)}const cs=new CompressionStream('deflate'),wr=cs.writable.getWriter(),compressed=new Response(cs.readable).arrayBuffer();await wr.write(raw.slice().buffer);await wr.close();const d=new Uint8Array(await compressed),sig=Uint8Array.from([137,80,78,71,13,10,26,10]),ih=new Uint8Array(13),v=new DataView(ih.buffer);v.setUint32(0,w);v.setUint32(4,h);ih.set([8,6,0,0,0],8);return this.cat(sig,this.chunk('IHDR',ih),this.chunk('IDAT',d),this.chunk('IEND',new Uint8Array()))}private chunk(t:string,d:Uint8Array){const b=new TextEncoder().encode(t),o=new Uint8Array(12+d.length),v=new DataView(o.buffer);v.setUint32(0,d.length);o.set(b,4);o.set(d,8);v.setUint32(8+d.length,this.crc(this.cat(b,d)));return o}private crc(d:Uint8Array){let c=0xffffffff;for(const b of d){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}private cat(...a:Uint8Array[]){const o=new Uint8Array(a.reduce((n,x)=>n+x.length,0));let p=0;for(const x of a){o.set(x,p);p+=x.length}return o}private async sha(d:Uint8Array){const h=await crypto.subtle.digest('SHA-256',d.slice().buffer);return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}}
export const usablePersonGenerationP180Service=new UsablePersonGenerationP180Service();
