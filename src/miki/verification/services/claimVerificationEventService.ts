export interface ClaimVerificationCompletedEvent { claimId:string; outcome:'SUPPORTED'|'DEVICE_VERIFIED'|'CONTRADICTED'|'UNRESOLVED'; promoted:boolean; occurredAt:number; }
type Handler=(event:ClaimVerificationCompletedEvent)=>void;
class ClaimVerificationEventService { private handlers=new Set<Handler>(); subscribe(handler:Handler){this.handlers.add(handler);return()=>this.handlers.delete(handler);} publish(event:ClaimVerificationCompletedEvent){for(const handler of [...this.handlers]){try{handler(event);}catch(error){console.error('[ClaimVerificationEvent] subscriber failed',error);}}} }
export const claimVerificationEventService=new ClaimVerificationEventService();
