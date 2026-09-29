function segments(value:string):string[]{return value.replace(/\\/g,'/').split('/').filter(part=>part&&part!=='.');}
function normalize(value:string):string{
 const absolute=value.replace(/\\/g,'/').startsWith('/');const output:string[]=[];
 for(const part of segments(value)){if(part==='..'){if(output.length&&output[output.length-1]!=='..')output.pop();else if(!absolute)output.push(part);}else output.push(part);}
 return `${absolute?'/':''}${output.join('/')}`|| (absolute?'/':'.');
}
function dirname(value:string):string{const normalized=normalize(value);const index=normalized.lastIndexOf('/');if(index<0)return '.';if(index===0)return '/';return normalized.slice(0,index);}
function join(...values:string[]):string{return normalize(values.filter(Boolean).join('/'));}
function relative(from:string,to:string):string{
 const fromParts=segments(normalize(from));const toParts=segments(normalize(to));let index=0;
 while(index<fromParts.length&&index<toParts.length&&fromParts[index]===toParts[index])index+=1;
 const parts=[...Array(fromParts.length-index).fill('..'),...toParts.slice(index)];return parts.join('/')||'.';
}
export const portablePosixPathService={normalize,dirname,join,relative};
