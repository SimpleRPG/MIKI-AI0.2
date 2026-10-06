import { canonicalSha256Object } from './canonicalSha256Service';

export interface P198View { yaw:number; pitch:number; }
export interface P198Render { width:number; height:number; rgba:Uint8Array; depth:Float32Array; labels:Uint16Array; metrics:Record<string,number>; renderSha256:string; }
interface Pt { x:number;y:number;z:number }
interface Palette { skin:[number,number,number]; hair:[number,number,number]; shirt:[number,number,number]; trousers:[number,number,number]; chair:[number,number,number]; background:[number,number,number] }

class AnatomicalProceduralPersonP198Service {
 render(seed:number,view:P198View,width=768,height=1024):P198Render {
  const rgba=new Uint8Array(width*height*4),depth=new Float32Array(width*height),labels=new Uint16Array(width*height);depth.fill(9);
  const p:Palette={skin:[196,151,130],hair:[45,34,29],shirt:[75,105,112],trousers:[66,71,78],chair:[105,66,42],background:[225,222,216]};
  this.background(width,height,rgba,depth,labels,p.background,seed);
  const q=(x:number,y:number,z:number):Pt=>this.project({x,y,z},view);
  // Chair behind the person.
  this.roundedRect(q(.34,.24,.83),q(.68,.64,.83),.035,83,p.chair,width,height,rgba,depth,labels,seed,.62,.12);
  this.capsule(q(.37,.59,.80),q(.67,.59,.80),.055,84,p.chair,width,height,rgba,depth,labels,seed,.66,.10);
  this.capsule(q(.39,.61,.79),q(.34,.94,.79),.025,85,p.chair,width,height,rgba,depth,labels,seed,.68,.08);
  this.capsule(q(.65,.61,.79),q(.70,.94,.79),.025,85,p.chair,width,height,rgba,depth,labels,seed,.68,.08);
  // Contact shadow.
  this.ellipse(q(.50,.935,.92),.205,.030,91,[38,33,29],width,height,rgba,depth,labels,seed,.95,.01,.55);
  // Neck and ears behind face.
  this.capsule(q(.50,.273,.45),q(.50,.337,.45),.040,19,p.skin,width,height,rgba,depth,labels,seed,.56,.18);
  this.ellipse(q(.414,.225,.43),.017,.029,18,p.skin,width,height,rgba,depth,labels,seed,.57,.16);
  this.ellipse(q(.586,.225,.43),.017,.029,18,p.skin,width,height,rgba,depth,labels,seed,.57,.16);
  // Torso uses a tapered anatomical polygon instead of one oversized ellipse.
  const torso=[q(.405,.322,.51),q(.595,.322,.51),q(.625,.49,.53),q(.572,.605,.55),q(.428,.605,.55),q(.375,.49,.53)];
  this.polygon(torso,22,p.shirt,width,height,rgba,depth,labels,seed,.73,.08);
  // Sleeves and arms.
  this.capsule(q(.405,.355,.48),q(.335,.505,.46),.045,23,p.shirt,width,height,rgba,depth,labels,seed,.72,.07);
  this.capsule(q(.595,.355,.48),q(.662,.505,.46),.045,23,p.shirt,width,height,rgba,depth,labels,seed,.72,.07);
  this.capsule(q(.335,.505,.38),q(.425,.585,.29),.030,24,p.skin,width,height,rgba,depth,labels,seed,.55,.18);
  this.capsule(q(.662,.505,.38),q(.575,.585,.29),.030,24,p.skin,width,height,rgba,depth,labels,seed,.55,.18);
  // Pelvis and seated legs. Thighs are horizontal/downward and lower legs descend to floor.
  this.roundedRect(q(.415,.555,.58),q(.585,.650,.58),.045,31,p.trousers,width,height,rgba,depth,labels,seed,.71,.07);
  this.capsule(q(.445,.620,.52),q(.355,.720,.47),.055,32,p.trousers,width,height,rgba,depth,labels,seed,.70,.06);
  this.capsule(q(.555,.620,.51),q(.645,.720,.46),.055,32,p.trousers,width,height,rgba,depth,labels,seed,.70,.06);
  this.capsule(q(.355,.720,.44),q(.392,.890,.37),.043,33,p.trousers,width,height,rgba,depth,labels,seed,.70,.06);
  this.capsule(q(.645,.720,.43),q(.608,.890,.36),.043,33,p.trousers,width,height,rgba,depth,labels,seed,.70,.06);
  this.capsule(q(.392,.890,.28),q(.337,.913,.24),.032,34,[49,43,40],width,height,rgba,depth,labels,seed,.52,.10);
  this.capsule(q(.608,.890,.27),q(.663,.913,.23),.032,34,[49,43,40],width,height,rgba,depth,labels,seed,.52,.10);
  // Hands and separated finger capsules.
  this.ellipse(q(.425,.585,.19),.034,.026,41,p.skin,width,height,rgba,depth,labels,seed,.52,.20);
  this.ellipse(q(.575,.585,.18),.034,.026,41,p.skin,width,height,rgba,depth,labels,seed,.52,.20);
  for(let side=0;side<2;side++)for(let f=0;f<5;f++){const baseX=side?.575:.425,dir=side?1:-1,spread=(f-2)*.008;this.capsule(q(baseX+spread,.585,.14+f*.002),q(baseX+spread+dir*.008,.615+Math.abs(f-2)*.002,.13+f*.002),.0052,42+side,p.skin,width,height,rgba,depth,labels,seed,.50,.18)}
  // Head volume, jaw and cheeks.
  this.ellipse(q(.50,.218,.36),.087,.108,11,p.skin,width,height,rgba,depth,labels,seed,.54,.20);
  this.ellipse(q(.50,.258,.34),.073,.066,12,p.skin,width,height,rgba,depth,labels,seed,.56,.18);
  // Hair cap and layered side strands.
  this.arcHair(q(.50,.205,.24),.095,.116,p.hair,width,height,rgba,depth,labels,seed);
  // Eye sockets, sclera, irises and eyelids.
  for(const side of [-1,1]){const ex=.50+side*.032;this.ellipse(q(ex,.214,.155),.018,.010,61,[225,220,211],width,height,rgba,depth,labels,seed,.40,.30);this.ellipse(q(ex+side*.002,.214,.125),.0065,.0065,62,[66,58,49],width,height,rgba,depth,labels,seed,.34,.38);this.ellipse(q(ex+side*.002,.214,.105),.0027,.0027,63,[25,23,21],width,height,rgba,depth,labels,seed,.25,.45);this.capsule(q(ex-.017,.206,.11),q(ex+.017,.207,.11),.0024,64,[98,65,56],width,height,rgba,depth,labels,seed,.50,.20)}
  // Brows.
  this.capsule(q(.452,.193,.11),q(.482,.190,.11),.0038,65,p.hair,width,height,rgba,depth,labels,seed,.45,.25);
  this.capsule(q(.518,.190,.11),q(.548,.193,.11),.0038,65,p.hair,width,height,rgba,depth,labels,seed,.45,.25);
  // Nose bridge, tip, wings, nostrils.
  this.capsule(q(.50,.218,.13),q(.50,.249,.085),.007,66,[186,136,116],width,height,rgba,depth,labels,seed,.50,.20);
  this.ellipse(q(.50,.250,.072),.014,.010,67,[190,139,119],width,height,rgba,depth,labels,seed,.48,.22);
  this.ellipse(q(.487,.253,.058),.004,.0028,68,[73,46,42],width,height,rgba,depth,labels,seed,.55,.08);
  this.ellipse(q(.513,.253,.058),.004,.0028,68,[73,46,42],width,height,rgba,depth,labels,seed,.55,.08);
  // Philtrum and lips with separate volumes.
  this.capsule(q(.50,.255,.07),q(.50,.264,.07),.0023,69,[149,102,90],width,height,rgba,depth,labels,seed,.55,.12);
  this.ellipse(q(.50,.271,.052),.020,.0065,70,[144,78,79],width,height,rgba,depth,labels,seed,.50,.20);
  this.ellipse(q(.50,.278,.050),.021,.0075,71,[171,101,100],width,height,rgba,depth,labels,seed,.48,.22);
  // Nasolabial and chin shading.
  this.capsule(q(.470,.250,.17),q(.462,.278,.18),.0022,72,[168,121,106],width,height,rgba,depth,labels,seed,.65,.08);
  this.capsule(q(.530,.250,.17),q(.538,.278,.18),.0022,72,[168,121,106],width,height,rgba,depth,labels,seed,.65,.08);
  this.ellipse(q(.50,.297,.20),.026,.012,73,[188,141,122],width,height,rgba,depth,labels,seed,.58,.15,.45);
  this.localAntialias(width,height,rgba,labels);
  const metrics=this.metrics(width,height,labels,depth),renderSha256=canonicalSha256Object({seed,view,metrics,head:Array.from(rgba.slice(0,2048)),tail:Array.from(rgba.slice(-2048)),labelsHead:Array.from(labels.slice(0,1024)),labelsTail:Array.from(labels.slice(-1024))});
  return{width,height,rgba,depth,labels,metrics,renderSha256};
 }
 private project(p:Pt,v:P198View):Pt{const yaw=v.yaw*Math.PI/180,pitch=v.pitch*Math.PI/180,x=p.x-.5,y=p.y-.5,z=p.z-.5,x1=x*Math.cos(yaw)+z*Math.sin(yaw),z1=-x*Math.sin(yaw)+z*Math.cos(yaw),y1=y*Math.cos(pitch)-z1*Math.sin(pitch),z2=y*Math.sin(pitch)+z1*Math.cos(pitch);return{x:.5+x1*(1-z2*.12),y:.5+y1*(1-z2*.08),z:.5+z2}}
 private background(w:number,h:number,rgba:Uint8Array,depth:Float32Array,labels:Uint16Array,c:number[],seed:number){for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,n=this.noise(x,y,seed)*2-1,g=.96+.04*y/h;rgba[i*4]=this.clamp(c[0]*g+n*2);rgba[i*4+1]=this.clamp(c[1]*g+n*2);rgba[i*4+2]=this.clamp(c[2]*g+n*2);rgba[i*4+3]=255;depth[i]=8;labels[i]=1}}
 private ellipse(c:Pt,rx:number,ry:number,label:number,color:number[],w:number,h:number,rgba:Uint8Array,depth:Float32Array,labels:Uint16Array,seed:number,rough:number,spec:number,alpha=1){this.shape(c.x*w,c.y*h,rx*w,ry*h,c.z,label,color,w,h,rgba,depth,labels,seed,rough,spec,alpha)}
 private shape(cx:number,cy:number,rx:number,ry:number,z:number,label:number,color:number[],w:number,h:number,rgba:Uint8Array,depth:Float32Array,labels:Uint16Array,seed:number,rough:number,spec:number,alpha=1){for(let y=Math.max(0,Math.floor(cy-ry));y<=Math.min(h-1,Math.ceil(cy+ry));y++)for(let x=Math.max(0,Math.floor(cx-rx));x<=Math.min(w-1,Math.ceil(cx+rx));x++){const dx=(x-cx)/rx,dy=(y-cy)/ry,d=dx*dx+dy*dy;if(d>1)continue;const i=y*w+x,zz=z-.035*Math.sqrt(1-d);if(zz>=depth[i])continue;const nz=Math.sqrt(Math.max(0,1-d)),nx=dx*.35,ny=dy*.25,light=Math.max(.28,.48+.52*(nx*-.32+ny*-.42+nz*.88)),micro=(this.noise(x,y,seed+label)-.5)*(2+rough*7),shine=Math.pow(Math.max(0,nx*-.25+ny*-.30+nz*.92),18)*spec*45;depth[i]=zz;labels[i]=label;for(let k=0;k<3;k++)rgba[i*4+k]=this.clamp(color[k]*light+micro+shine);rgba[i*4+3]=Math.round(255*alpha)}}
 private capsule(a:Pt,b:Pt,r:number,label:number,color:number[],w:number,h:number,rgba:Uint8Array,depth:Float32Array,labels:Uint16Array,seed:number,rough:number,spec:number){const steps=Math.max(2,Math.ceil(Math.hypot((b.x-a.x)*w,(b.y-a.y)*h)/(r*Math.min(w,h)*.45)));for(let i=0;i<=steps;i++){const t=i/steps;this.ellipse({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t},r,r,label,color,w,h,rgba,depth,labels,seed,rough,spec)}}
 private roundedRect(a:Pt,b:Pt,r:number,label:number,color:number[],w:number,h:number,rgba:Uint8Array,depth:Float32Array,labels:Uint16Array,seed:number,rough:number,spec:number){const y=(a.y+b.y)/2;for(let x=a.x;x<=b.x;x+=(r*.35))this.ellipse({x,y,z:(a.z+b.z)/2},r,Math.abs(b.y-a.y)/2,label,color,w,h,rgba,depth,labels,seed,rough,spec)}
 private polygon(pts:Pt[],label:number,color:number[],w:number,h:number,rgba:Uint8Array,depth:Float32Array,labels:Uint16Array,seed:number,rough:number,spec:number){const xs=pts.map(p=>p.x*w),ys=pts.map(p=>p.y*h),minX=Math.max(0,Math.floor(Math.min(...xs))),maxX=Math.min(w-1,Math.ceil(Math.max(...xs))),minY=Math.max(0,Math.floor(Math.min(...ys))),maxY=Math.min(h-1,Math.ceil(Math.max(...ys)));for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const xi=xs[i],yi=ys[i],xj=xs[j],yj=ys[j];if(((yi>y)!==(yj>y))&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside}if(!inside)continue;const i=y*w+x,z=pts.reduce((s,p)=>s+p.z,0)/pts.length;if(z>=depth[i])continue;const light=.72+.28*(1-y/h),micro=(this.noise(x,y,seed+label)-.5)*(3+rough*8);depth[i]=z;labels[i]=label;for(let k=0;k<3;k++)rgba[i*4+k]=this.clamp(color[k]*light+micro+spec*4);rgba[i*4+3]=255}}
 private arcHair(c:Pt,rx:number,ry:number,color:number[],w:number,h:number,rgba:Uint8Array,depth:Float32Array,labels:Uint16Array,seed:number){this.ellipse(c,rx,ry,51,color,w,h,rgba,depth,labels,seed,.42,.28);this.ellipse({x:c.x,y:c.y+.052,z:c.z-.02},rx*.84,ry*.68,11,[196,151,130],w,h,rgba,depth,labels,seed,.54,.20);for(let n=0;n<150;n++){const a=-Math.PI*.92+n/149*Math.PI*1.84,x=c.x+Math.cos(a)*rx*.92,y=c.y+Math.sin(a)*ry*.90,len=.018+(n%13)*.0014;this.capsule({x,y,z:c.z-.05},{x:x+Math.cos(a)*len,y:y+Math.sin(a)*len,z:c.z-.055},.0018,52,color,w,h,rgba,depth,labels,seed,.35,.32)}}
 private localAntialias(w:number,h:number,rgba:Uint8Array,labels:Uint16Array){const src=rgba.slice();for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if([i-1,i+1,i-w,i+w].every(n=>labels[n]===labels[i]))continue;for(let c=0;c<3;c++)rgba[i*4+c]=Math.round((src[i*4+c]*4+src[(i-1)*4+c]+src[(i+1)*4+c]+src[(i-w)*4+c]+src[(i+w)*4+c])/8)}}
 private metrics(w:number,h:number,labels:Uint16Array,depth:Float32Array){const countSet=(values:number[])=>{const set=new Set(values);let n=0;for(const v of labels)if(set.has(v))n++;return n},head=countSet([11,12,18,19,51,52,61,62,63,64,65,66,67,68,69,70,71,72,73]),torso=countSet([22,23,24]),legs=countSet([31,32,33,34]),hands=countSet([41,42,43]),chair=countSet([83,84,85]),eyes=countSet([61,62,63,64,65]),face=countSet([66,67,68,69,70,71,72,73]),foreground=head+torso+legs+hands+chair;return{headPixels:head,torsoPixels:torso,legPixels:legs,handPixels:hands,chairPixels:chair,eyePixels:eyes,faceDetailPixels:face,foregroundRatio:foreground/(w*h),headTorsoRatio:head/Math.max(1,torso),legsTorsoRatio:legs/Math.max(1,torso),handSeparation:hands>220?1:0,chairPresent:chair>1000?1:0,depthFinite:Array.from(depth).every(Number.isFinite)?1:0}}
 private noise(x:number,y:number,s:number){let n=(Math.imul(x+1,374761393)^Math.imul(y+1,668265263)^Math.imul(s+1,2246822519))>>>0;n=Math.imul(n^(n>>>13),1274126177)>>>0;return((n^(n>>>16))>>>0)/4294967295}
 private clamp(v:number){return Math.max(0,Math.min(255,Math.round(v)))}
}
export const anatomicalProceduralPersonP198Service=new AnatomicalProceduralPersonP198Service();
