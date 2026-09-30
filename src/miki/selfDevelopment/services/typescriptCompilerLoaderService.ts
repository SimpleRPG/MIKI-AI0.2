type TypeScriptModule=typeof import('typescript');
class TypeScriptCompilerLoaderService{private loading?:Promise<TypeScriptModule>;load():Promise<TypeScriptModule>{this.loading||=import('typescript');return this.loading;}preloadWhenIdle():void{const run=()=>void this.load();if('requestIdleCallback'in globalThis)(globalThis as any).requestIdleCallback(run,{timeout:5000});else setTimeout(run,1500);}}
export const typescriptCompilerLoaderService=new TypeScriptCompilerLoaderService();
