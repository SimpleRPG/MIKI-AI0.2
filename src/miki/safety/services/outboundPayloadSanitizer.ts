import { abstractSanitizerService } from './abstractSanitizerService';

export interface OutboundPayloadAudit {
  allowed: boolean;
  sanitizedText: string;
  blockedReason?: string;
}

export interface OutboundPayloadSanitization<T, R extends OutboundPayloadAudit> {
  payload: T;
  allowed: boolean;
  blockedReason?: string;
  audit?: R;
}

/** Audit the exact JSON payload that will be sent, then parse only sanitized JSON. */
export function sanitizeOutboundPayload<T, R extends OutboundPayloadAudit>(
  payload: T,
  auditJson: (serialized: string) => R,
): OutboundPayloadSanitization<T, R> {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    return { payload, allowed: false, blockedReason: 'OUTBOUND_PAYLOAD_SERIALIZATION_FAILED' };
  }
  if (typeof serialized !== 'string') {
    return { payload, allowed: false, blockedReason: 'OUTBOUND_PAYLOAD_SERIALIZATION_EMPTY' };
  }
  // Mandatory baseline scrubbing is independent of the configurable privacy audit feature flag.
  const baseline = abstractSanitizerService.sanitizeText(serialized);
  const audit = auditJson(baseline.sanitized);
  const metadataAudit = {
    ...audit,
    sanitizedText: '',
    symbolReplacements: {},
    summary: 'Audit metadata retained; content and reversible mappings redacted.',
    violations: Array.isArray((audit as any).violations)
      ? (audit as any).violations.map((violation: any) => ({
          ...violation,
          snippet: `[REDACTED:${String(violation?.type || 'UNKNOWN')}]`,
        }))
      : [],
  } as R;
  if (!audit.allowed) {
    return { payload, allowed: false, blockedReason: audit.blockedReason, audit: metadataAudit };
  }
  try {
    return { payload: JSON.parse(audit.sanitizedText) as T, allowed: true, audit: metadataAudit };
  } catch {
    return { payload, allowed: false, blockedReason: 'SANITIZED_OUTBOUND_PAYLOAD_INVALID_JSON', audit: metadataAudit };
  }
}
