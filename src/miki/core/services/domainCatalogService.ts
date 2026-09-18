import type { MikiDomain } from './crossDomainCirculationService';
export const MIKI_DOMAINS:readonly MikiDomain[]=['core','autonomy','capability','conversation','data','execution','experience','improvement','learning','memory','promotion','research','safety','selfAwareness','selfDevelopment','strategy','unknown','verification'];
export const MIKI_WORKER_DOMAINS:readonly MikiDomain[]=MIKI_DOMAINS.filter(domain=>domain!=='core');
export function getMikiDomainOrder(domain:MikiDomain):number{return MIKI_DOMAINS.indexOf(domain)+1;}
export function isMikiDomain(value:string):value is MikiDomain{return (MIKI_DOMAINS as readonly string[]).includes(value);}
