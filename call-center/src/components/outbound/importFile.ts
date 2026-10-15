// Reads contact / appointment lists from Excel (.xlsx), CSV, TSV, plain text,
// vCard (.vcf, e.g. exported phone contacts) or pasted text, and guesses which
// column is which.
import { readSheet } from 'read-excel-file/browser';

export type Table = string[][];

export type ColumnRole =
  | 'ignore'
  | 'name'
  | 'first_name'
  | 'last_name'
  | 'phone'
  | 'email'
  | 'timezone'
  | 'notes'
  | 'service'
  | 'date'
  | 'time'
  | 'video'
  | 'duration'
  | 'extra';

const ALIASES: Record<Exclude<ColumnRole, 'ignore' | 'extra'>, RegExp> = {
  first_name: /^(first|first ?name|given ?name|fname)$/i,
  last_name: /^(last|last ?name|surname|family ?name|lname)$/i,
  name: /^(name|full ?name|customer|customer ?name|contact|contact ?name|client|client ?name|patient|lead|lead ?name)$/i,
  phone: /(phone|mobile|cell|tel|number|whatsapp)/i,
  email: /e-?mail/i,
  timezone: /^(time ?zone|tz)$/i,
  notes: /^(notes?|comments?|memo|details)$/i,
  service: /^(service|appointment ?type|type|reason|treatment)$/i,
  date: /^(date|appointment ?date|appt ?date|day|start ?date|when|datetime|date ?time|start)$/i,
  time: /^(time|appointment ?time|appt ?time|start ?time)$/i,
  video: /^(video|virtual|meet|google ?meet|online|telehealth)$/i,
  duration: /^(duration|length|minutes|mins)$/i,
};

function cellText(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) {
    // Excel dates come back as UTC dates holding the wall-clock time.
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
    const time = v.getUTCHours() || v.getUTCMinutes() ? ` ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}` : '';
    if (v.getUTCFullYear() < 1901) return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`; // time-only cell
    return date + time;
  }
  return String(v).trim();
}

export function parseDelimited(text: string): Table {
  const firstLine = text.split(/\r?\n/).find(l => l.trim()) || '';
  const counts = { ',': 0, '\t': 0, ';': 0, '|': 0 } as Record<string, number>;
  for (const ch of firstLine) if (ch in counts) counts[ch]++;
  const [best, bestCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const delim = bestCount > 0 ? best : ',';

  const rows: Table = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some(c => c)) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(c => c)) rows.push(row);
  return rows;
}

function parseVcf(text: string): Table {
  const rows: Table = [['Name', 'Phone', 'Email']];
  for (const card of text.split(/BEGIN:VCARD/i).slice(1)) {
    const unfolded = card.replace(/\r?\n[ \t]/g, '');
    const fn = unfolded.match(/^FN[^:]*:(.*)$/im)?.[1]?.trim() || '';
    const email = unfolded.match(/^EMAIL[^:]*:(.*)$/im)?.[1]?.trim() || '';
    const tels = [...unfolded.matchAll(/^TEL[^:]*:(.*)$/gim)].map(m => m[1].trim());
    const cell = tels.find((_, i) => /CELL|MOBILE/i.test(unfolded.match(/^TEL[^:]*:/gim)?.[i] || '')) || tels[0];
    if (cell) rows.push([fn, cell, email]);
  }
  return rows;
}

export async function readFile(file: File): Promise<Table> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
    const data = await readSheet(file);
    return data.map(r => r.map(cellText)).filter(r => r.some(c => c));
  }
  if (name.endsWith('.xls')) {
    throw new Error('Old .xls files are not supported. In Excel, choose File → Save As → Excel Workbook (.xlsx) or CSV, then upload that.');
  }
  if (name.endsWith('.numbers')) {
    throw new Error('Apple Numbers files: choose File → Export To → CSV or Excel, then upload that.');
  }
  const text = await file.text();
  if (name.endsWith('.vcf') || /^BEGIN:VCARD/i.test(text.trim())) return parseVcf(text);
  return parseText(text);
}

// Pasted text: a table copied from Excel/Google Sheets, CSV, or one number per line.
export function parseText(text: string): Table {
  if (/^BEGIN:VCARD/i.test(text.trim())) return parseVcf(text);
  return parseDelimited(text);
}

const PHONEISH = /^\+?[\d\s().-]{7,20}$/;

export function looksLikeHeader(row: string[]): boolean {
  return row.some(c => Object.values(ALIASES).some(r => r.test(c))) && !row.some(c => PHONEISH.test(c) && c.replace(/\D/g, '').length >= 10);
}

export function guessRoles(table: Table, hasHeader: boolean, allowed: ColumnRole[]): ColumnRole[] {
  const width = Math.max(...table.slice(0, 50).map(r => r.length), 0);
  const header = hasHeader ? table[0] : [];
  const sample = table.slice(hasHeader ? 1 : 0, 30);
  const roles: ColumnRole[] = [];
  const used = new Set<ColumnRole>();
  for (let i = 0; i < width; i++) {
    const h = header[i] || '';
    let role: ColumnRole = 'extra';
    for (const [r, re] of Object.entries(ALIASES) as [ColumnRole, RegExp][]) {
      if (allowed.includes(r) && re.test(h) && !used.has(r)) {
        role = r;
        break;
      }
    }
    if (role === 'extra') {
      const vals = sample.map(r => r[i] || '').filter(Boolean);
      const phoneShare = vals.filter(v => PHONEISH.test(v) && v.replace(/\D/g, '').length >= 10).length / (vals.length || 1);
      if (!used.has('phone') && phoneShare > 0.6) role = 'phone';
      else if (!used.has('email') && allowed.includes('email') && vals.length && vals.every(v => /@/.test(v))) role = 'email';
      else if (!hasHeader && !used.has('name') && vals.length && vals.every(v => /[a-z]/i.test(v) && !/@/.test(v))) role = 'name';
      else if (!hasHeader) role = 'ignore';
    }
    if (!allowed.includes(role)) role = hasHeader && allowed.includes('extra') ? 'extra' : 'ignore';
    if (role !== 'extra' && role !== 'ignore') used.add(role);
    roles.push(role);
  }
  return roles;
}

export interface MappedRow {
  name: string;
  phone: string;
  email?: string;
  timezone?: string;
  notes?: string;
  service?: string;
  date?: string;
  time?: string;
  video?: string;
  durationMinutes?: number;
  extra: Record<string, string>;
}

export function mapRows(table: Table, hasHeader: boolean, roles: ColumnRole[]): MappedRow[] {
  const header = hasHeader ? table[0] : roles.map((_, i) => `column ${i + 1}`);
  return table.slice(hasHeader ? 1 : 0).map(r => {
    const out: MappedRow = { name: '', phone: '', extra: {} };
    let first = '', last = '';
    roles.forEach((role, i) => {
      const v = (r[i] || '').trim();
      if (!v) return;
      switch (role) {
        case 'name': out.name = v; break;
        case 'first_name': first = v; break;
        case 'last_name': last = v; break;
        case 'phone': out.phone = out.phone || v; break;
        case 'email': out.email = v; break;
        case 'timezone': out.timezone = v; break;
        case 'notes': out.notes = v; break;
        case 'service': out.service = v; break;
        case 'date': out.date = v; break;
        case 'time': out.time = v; break;
        case 'video': out.video = v; break;
        case 'duration': out.durationMinutes = parseInt(v, 10) || undefined; break;
        case 'extra': out.extra[header[i] || `column ${i + 1}`] = v; break;
      }
    });
    if (!out.name) out.name = `${first} ${last}`.trim();
    return out;
  });
}

export const ROLE_LABELS: Record<ColumnRole, string> = {
  ignore: "Don't use",
  name: 'Full name',
  first_name: 'First name',
  last_name: 'Last name',
  phone: 'Phone',
  email: 'Email',
  timezone: 'Time zone',
  notes: 'Notes',
  service: 'Service',
  date: 'Date (or date + time)',
  time: 'Time',
  video: 'Video call? (yes/no)',
  duration: 'Length (minutes)',
  extra: 'Extra info for the AI',
};
