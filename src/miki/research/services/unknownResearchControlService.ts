export type UnknownResearchChoice='SEARCH'|'LOCAL_ONLY';
export function decideUnknownResearch(shouldRetry:boolean,userAllowsRetry:boolean):UnknownResearchChoice { if(!shouldRetry&&!userAllowsRetry)return 'LOCAL_ONLY';return 'SEARCH'; }
