// Upload or paste a list, check which column is which, then import.
import React, { useState } from 'react';
import { Upload, ClipboardPaste } from 'lucide-react';
import { Button, Notice, Select, TextArea } from './ui';
import { guessRoles, looksLikeHeader, mapRows, parseText, readFile, ROLE_LABELS, type ColumnRole, type MappedRow, type Table } from './importFile';

interface Props {
  allowed: ColumnRole[];
  required: ColumnRole[];
  busy?: boolean;
  importLabel: string;
  onImport: (rows: MappedRow[]) => void;
  children?: React.ReactNode; // extra options shown before the import button
}

export const ImportWizard: React.FC<Props> = ({ allowed, required, busy, importLabel, onImport, children }) => {
  const [table, setTable] = useState<Table | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [roles, setRoles] = useState<ColumnRole[]>([]);
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  const load = (t: Table, name: string) => {
    if (!t.length) {
      setError('That file looks empty.');
      return;
    }
    const header = looksLikeHeader(t[0]);
    setHasHeader(header);
    setRoles(guessRoles(t, header, allowed));
    setTable(t);
    setFileName(name);
    setError('');
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    try {
      load(await readFile(f), f.name);
    } catch (err: any) {
      setError(err.message || 'Could not read that file.');
    }
  };

  const rows = table ? mapRows(table, hasHeader, roles) : [];
  const missing = required.filter(r => !roles.includes(r) && !(r === 'name' && roles.includes('first_name')));
  const width = table ? Math.max(...table.slice(0, 20).map(r => r.length)) : 0;

  if (!table) {
    return (
      <div className="space-y-3">
        <label
          className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-700 hover:border-cyan-600 rounded-xl p-6 cursor-pointer text-center"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            onFile(e.dataTransfer.files[0]);
          }}
        >
          <Upload className="w-6 h-6 text-cyan-400" />
          <span className="text-sm font-bold text-slate-200">Drop a file here or click to choose</span>
          <span className="text-xs text-slate-500">Excel (.xlsx), CSV, TSV, TXT, or phone contacts (.vcf)</span>
          <input type="file" accept=".xlsx,.xlsm,.xls,.csv,.tsv,.txt,.vcf" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
        </label>
        <div className="text-center">
          <Button small onClick={() => setShowPaste(!showPaste)}>
            <ClipboardPaste className="w-3.5 h-3.5" /> Or paste a list
          </Button>
        </div>
        {showPaste && (
          <div className="space-y-2">
            <TextArea
              rows={6}
              value={paste}
              onChange={e => setPaste(e.target.value)}
              placeholder={'Copy cells from Excel / Google Sheets and paste here, or type one per line:\nJane Doe, (305) 555-0123\nJohn Smith, 786-555-0199'}
            />
            <Button kind="primary" disabled={!paste.trim()} onClick={() => load(parseText(paste), 'pasted list')}>
              Read pasted list
            </Button>
          </div>
        )}
        {error && <Notice kind="error">{error}</Notice>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>
          <strong className="text-slate-200">{fileName}</strong>: {rows.length} rows. Check that each column is labeled right.
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={hasHeader}
              className="accent-cyan-500"
              onChange={e => {
                setHasHeader(e.target.checked);
                setRoles(guessRoles(table, e.target.checked, allowed));
              }}
            />
            First row is column titles
          </label>
          <Button small onClick={() => setTable(null)}>
            Choose a different file
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-800 rounded-xl">
        <table className="text-xs w-full">
          <thead className="bg-slate-950">
            <tr>
              {Array.from({ length: width }).map((_, i) => (
                <th key={i} className="p-2 text-left align-top min-w-[140px]">
                  {hasHeader && <div className="text-slate-500 font-normal mb-1 truncate">{table[0][i]}</div>}
                  <Select
                    value={roles[i] || 'ignore'}
                    onChange={e => setRoles(roles.map((r, j) => (j === i ? (e.target.value as ColumnRole) : r)))}
                    className="!py-1 !text-xs"
                  >
                    {(['ignore', ...allowed] as ColumnRole[]).map(r => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </Select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.slice(hasHeader ? 1 : 0, (hasHeader ? 1 : 0) + 6).map((r, i) => (
              <tr key={i} className="border-t border-slate-800">
                {Array.from({ length: width }).map((_, j) => (
                  <td key={j} className={`p-2 truncate max-w-[220px] ${roles[j] === 'ignore' ? 'text-slate-600' : 'text-slate-300'}`}>
                    {r[j]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {missing.length > 0 && <Notice kind="warn">Pick which column is the {missing.map(m => ROLE_LABELS[m]).join(' and ')}.</Notice>}
      {children}
      <Button kind="primary" disabled={busy || missing.length > 0 || !rows.length} onClick={() => onImport(rows)}>
        <Upload className="w-3.5 h-3.5" /> {importLabel.replace('{n}', String(rows.length))}
      </Button>
    </div>
  );
};
