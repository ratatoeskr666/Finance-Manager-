import Papa from 'papaparse';

export type CsvRow = Record<string, string>;

export type ParseOptions = {
  delimiter: string;
  encoding: string;
  /**
   * Skip a fixed number of lines before the header. Some Sparkasse exports
   * include a preamble; the user can adjust this in the import dialog.
   */
  skipLines?: number;
};

export type ParseResult = {
  headers: string[];
  rows: CsvRow[];
  rawText: string;
};

export async function readFileAsText(file: File, encoding: string): Promise<string> {
  const buffer = await file.arrayBuffer();
  // TextDecoder accepts the canonical encoding labels like 'utf-8', 'iso-8859-1', 'windows-1252'.
  const decoder = new TextDecoder(encoding, { fatal: false });
  return decoder.decode(buffer);
}

export function parseCsvText(text: string, opts: ParseOptions): ParseResult {
  const skipped = opts.skipLines && opts.skipLines > 0
    ? text.split(/\r?\n/).slice(opts.skipLines).join('\n')
    : text;
  const result = Papa.parse<CsvRow>(skipped, {
    header: true,
    delimiter: opts.delimiter,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });
  const headers = result.meta.fields ?? [];
  return { headers, rows: result.data, rawText: skipped };
}

export async function parseCsv(file: File, opts: ParseOptions): Promise<ParseResult> {
  const text = await readFileAsText(file, opts.encoding);
  return parseCsvText(text, opts);
}

/**
 * Read just the first kilobytes of a file and try to auto-detect a delimiter
 * by counting candidates on the first non-empty line. Returns ';' if neither
 * is clearly more frequent — German banks default to that.
 */
export function detectDelimiter(sample: string): ';' | ',' | '\t' {
  const line = sample.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  const counts = {
    ';': (line.match(/;/g) ?? []).length,
    ',': (line.match(/,/g) ?? []).length,
    '\t': (line.match(/\t/g) ?? []).length,
  };
  const best = (Object.entries(counts) as [';' | ',' | '\t', number][])
    .sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ';';
}
