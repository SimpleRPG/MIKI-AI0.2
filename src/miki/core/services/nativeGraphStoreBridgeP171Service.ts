import { Capacitor,registerPlugin } from '@capacitor/core';
interface NativeGraphStorePlugin{commit(options:{payload:string}):Promise<Record<string,unknown>>;status():Promise<{available:boolean;store:string}>}
const plugin=registerPlugin<NativeGraphStorePlugin>('MIKIGraphStore');
class NativeGraphStoreBridgeP171Service{async commit(transactionId:string,expectedGeneration:number,graph:unknown){if(!Capacitor.isNativePlatform())return{mode:'WEB_LIMITED',committed:false};const payload=JSON.stringify({transaction_id:transactionId,expected_generation:expectedGeneration,graph_json:JSON.stringify(graph)});return plugin.commit({payload})}async status(){if(!Capacitor.isNativePlatform())return{available:false,store:'WEB_LIMITED'};return plugin.status()}}
export const nativeGraphStoreBridgeP171Service=new NativeGraphStoreBridgeP171Service();
