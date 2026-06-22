/** RFC 4180 + neutralisation des injections de formule (Excel/Sheets). */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  // Préfixe les cellules débutant par un déclencheur de formule (=, +, -, @, TAB, CR).
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (s.includes('"')) s = s.replace(/"/g, '""');
  if (/[",\n\r]/.test(s)) s = `"${s}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  // BOM pour qu'Excel ouvre l'UTF-8 correctement.
  const lines: string[] = ['﻿' + headers.map(csvCell).join(',')];
  for (const r of rows) lines.push(r.map(csvCell).join(','));
  return lines.join('\r\n') + '\r\n';
}
