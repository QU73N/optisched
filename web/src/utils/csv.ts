// CSV export helpers — Session 1 / Task C5 of HARDENING_PLAN.md
//
// Why this file exists:
//   1. Prevent CSV/Spreadsheet formula injection. Any cell whose first
//      character is one of `= + - @ \t \r` is interpreted as a formula by
//      Excel / Google Sheets / Numbers. An attacker who controls a logged
//      field (audit details, user-supplied notes) could embed
//      `=HYPERLINK(...)` or `=cmd|'/c calc'!A1` and exfiltrate / RCE on
//      whichever workstation opens the export.
//   2. Standardise CSV quoting so we never have to think about commas /
//      quotes / newlines inside cells again.
//
// Adopt this module instead of hand-building CSV strings.

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Escape a single cell value for safe inclusion in a CSV.
 * - Coerces nullish / undefined to empty string.
 * - Prefixes a leading apostrophe to neutralise formula triggers.
 * - Wraps in double quotes and doubles any embedded quotes when the value
 *   contains comma, quote, CR or LF.
 */
export function sanitizeCsvCell(value: unknown): string {
    let s = value === null || value === undefined ? '' : String(value);

    if (FORMULA_TRIGGER.test(s)) {
        s = `'${s}`;
    }

    if (/[",\r\n]/.test(s)) {
        s = `"${s.replace(/"/g, '""')}"`;
    }

    return s;
}

/**
 * Build a CSV row from an array of cells.
 */
export function toCsvRow(cells: readonly unknown[]): string {
    return cells.map(sanitizeCsvCell).join(',');
}

/**
 * Build a complete CSV document from a header row and data rows.
 * BOM is prepended so Excel auto-detects UTF-8.
 */
export function toCsv(
    header: readonly string[],
    rows: readonly (readonly unknown[])[],
): string {
    const BOM = '\ufeff';
    const lines = [toCsvRow(header), ...rows.map(toCsvRow)];
    return BOM + lines.join('\r\n') + '\r\n';
}

/**
 * Trigger a browser download of a CSV blob with the given filename.
 * Filename is sanitised to avoid path traversal characters.
 */
export function downloadCsv(filename: string, csv: string): void {
    const safeName = filename.replace(/[^\w.-]+/g, '_');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
        const a = document.createElement('a');
        a.href = url;
        a.download = safeName.endsWith('.csv') ? safeName : `${safeName}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } finally {
        // Defer revoke so click handler completes
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }
}
