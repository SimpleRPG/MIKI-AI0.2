export function clamp(value,min,max){if(min>max)throw new RangeError('MIN_GREATER_THAN_MAX');if(value<min)return min;if(value>max)return max;return value;}
export function isReviewEligible(input){return input.buildPassed===true&&input.testPassed===true&&input.evidenceCount>0&&input.blockerCount===0;}
export function stableUnique(values){return [...new Set(values)];}
