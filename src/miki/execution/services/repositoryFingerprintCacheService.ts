interface Fingerprint{size:number;mtimeMs:number;sha256:string;}
class RepositoryFingerprintCacheService{private readonly rows=new Map<string,Fingerprint>();get(path:string,size:number,mtimeMs:number){const hit=this.rows.get(path);return hit&&hit.size===size&&hit.mtimeMs===mtimeMs?hit.sha256:undefined;}set(path:string,value:Fingerprint){this.rows.set(path,value);}invalidate(path:string){this.rows.delete(path);}clear(){this.rows.clear();}size(){return this.rows.size;}}
export const repositoryFingerprintCacheService=new RepositoryFingerprintCacheService();
