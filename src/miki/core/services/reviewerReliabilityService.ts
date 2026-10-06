import { storageService } from '../../../services/storageService';
export type ReviewOutcome='CORRECT'|'INCORRECT'|'PARTIAL'|'REGRESSION_CAUSED'|'CORRECTION_REQUIRED';
export interface ReviewerReliabilityProfile{reviewerId:string;domain:string;sampleCount:number;correct:number;incorrect:number;partial:number;regressionCaused:number;correctionRequired:number;reliability:number;updatedAt:number;}
const KEY='miki_reviewer_reliability_v1';
class ReviewerReliabilityService{
 private profiles=new Map<string,ReviewerReliabilityProfile>();constructor(){this.load();}
 record(input:{reviewerId:string;domain:string;outcome:ReviewOutcome}):ReviewerReliabilityProfile{const key=this.key(input.reviewerId,input.domain);const row=this.profiles.get(key)||{reviewerId:input.reviewerId,domain:input.domain,sampleCount:0,correct:0,incorrect:0,partial:0,regressionCaused:0,correctionRequired:0,reliability:0.5,updatedAt:0};row.sampleCount+=1;if(input.outcome==='CORRECT')row.correct+=1;if(input.outcome==='INCORRECT')row.incorrect+=1;if(input.outcome==='PARTIAL')row.partial+=1;if(input.outcome==='REGRESSION_CAUSED')row.regressionCaused+=1;if(input.outcome==='CORRECTION_REQUIRED')row.correctionRequired+=1;const positive=row.correct+row.partial*0.5;const negative=row.incorrect+row.regressionCaused*2+row.correctionRequired;row.reliability=Math.max(0.1,Math.min(0.95,(positive+2)/(positive+negative+4)));row.updatedAt=Date.now();this.profiles.set(key,row);this.save();return{...row};}
 get(reviewerId:string,domain:string):ReviewerReliabilityProfile{return{...(this.profiles.get(this.key(reviewerId,domain))||{reviewerId,domain,sampleCount:0,correct:0,incorrect:0,partial:0,regressionCaused:0,correctionRequired:0,reliability:0.5,updatedAt:0})};}
 list():ReviewerReliabilityProfile[]{return[...this.profiles.values()].map(row=>({...row}));}
 private key(reviewerId:string,domain:string){return`${reviewerId}::${domain}`;}
 private save(){storageService.setItem(KEY,JSON.stringify(this.list()));}
 private load(){try{const rows=JSON.parse(storageService.getItem(KEY)||'[]') as ReviewerReliabilityProfile[];for(const row of rows)this.profiles.set(this.key(row.reviewerId,row.domain),row);}catch{}}
}
export const reviewerReliabilityService=new ReviewerReliabilityService();
