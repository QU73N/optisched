// PII redaction — Session 1 / Task C6 of HARDENING_PLAN.md
//
// Goal: never persist secrets or full PII inside `activity_logs.details`
// or `audit_logs.details`. Activity rows are queryable by Power Admin and
// System Admin, exported to CSV, and retained for ~365 days. They must
// not become a secondary credential store.
//
// Strategy:
//   1. Strip any key whose name matches a sensitive pattern.
//      The match is intentionally aggressive — false-redact > false-leak.
//   2. Truncate long string values to 500 chars (preserves debuggability,
//      caps storage cost, and prevents accidental dumps of paste content).
//   3. Replace email-like strings with `j***@domain` (preserves domain for
//      diagnostics, hides local-part).
//
// Apply at the edge: every call site that puts data into `details` should
// pipe through `redactPii()` before sending. `useActivityLogger.logActivity`
// does this automatically; ad-hoc callers benefit when they import this
// module and call it themselves on bigger payloads.

const SENSITIVE_KEY_PATTERN =
    /pass(word)?|secret|token|api[_-]?key|authorization|bearer|cookie|session(_id)?|csrf|otp|pin|ssn|credit[_-]?card|cc[_-]?number|cvv/i;

const EMAIL_PATTERN = /([A-Za-z0-9_.+-])([A-Za-z0-9_.+-]{1,})@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

const MAX_STRING_LEN = 500;
const MAX_DEPTH = 6;

/** Mask an email keeping first letter and full domain. */
export function redactEmail(input: string): string {
    return input.replace(EMAIL_PATTERN, (_m, first, _rest, domain) => `${first}***@${domain}`);
}

function redactString(s: string): string {
    const masked = redactEmail(s);
    return masked.length > MAX_STRING_LEN
        ? `${masked.slice(0, MAX_STRING_LEN)}…[truncated ${masked.length - MAX_STRING_LEN}]`
        : masked;
}

/**
 * Recursively redact PII / secrets from an arbitrary value tree.
 * - Sensitive-named keys → `'[REDACTED]'`
 * - Long strings → truncated
 * - Embedded emails → masked
 * - Cycles → '[circular]'
 * - Depth-limited to avoid pathological objects.
 */
export function redactPii<T = unknown>(value: T, depth = 0, seen = new WeakSet<object>()): T {
    if (value === null || value === undefined) return value;

    if (typeof value === 'string') {
        return redactString(value) as unknown as T;
    }

    if (typeof value !== 'object') return value;

    if (depth > MAX_DEPTH) return ('[max-depth]' as unknown) as T;

    const obj = value as object;
    if (seen.has(obj)) return ('[circular]' as unknown) as T;
    seen.add(obj);

    if (Array.isArray(value)) {
        return value.map(v => redactPii(v, depth + 1, seen)) as unknown as T;
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (SENSITIVE_KEY_PATTERN.test(k)) {
            out[k] = '[REDACTED]';
        } else {
            out[k] = redactPii(v, depth + 1, seen);
        }
    }
    return out as unknown as T;
}

/** Convenience for an `error` field that may be a string or an Error instance. */
export function redactErrorMessage(err: unknown): string | undefined {
    if (err === null || err === undefined) return undefined;
    if (err instanceof Error) return redactString(err.message);
    if (typeof err === 'string') return redactString(err);
    try {
        return redactString(JSON.stringify(redactPii(err)));
    } catch {
        return '[unserialisable error]';
    }
}
