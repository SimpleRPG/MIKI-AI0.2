/** 第61章: 能力境界付近の決定論的ベンチマークを生成・保存する。 */
import {storageService} from './storageService';
export interface BenchmarkCase{id:string;capability:string;input:string;expected:string;variants:string[];privateEval:boolean;createdAt:number;}
const KEY='miki_benchmark_factory_v1';
class BenchmarkFactoryService{private cases:BenchmarkCase[]=[];constructor(){try{const r=storageService.getItem(KEY);if(r)this.cases=JSON.parse(r)}catch{}}
 private save(){try{storageService.setItem(KEY,JSON.stringify(this.cases.slice(-1000)))}catch{}}
 generate(capability:string,input:string,expected:string,variants:string[]=[]){const c={id:`BENCH-${Date.now()}-${this.cases.length}`,capability,input,expected,variants,privateEval:true,createdAt:Date.now()};this.cases.push(c);this.save();return c;}
 generateBoundary(capability:string,base:string,expected:string){return this.generate(capability,base,expected,[base+' 条件を1つ変更',base+' 言い換え',base+' ノイズを追加',base+' 別分野へ転用']);}
 list(capability?:string){return this.cases.filter(c=>!capability||c.capability===capability)} }
export const benchmarkFactoryService=new BenchmarkFactoryService();
