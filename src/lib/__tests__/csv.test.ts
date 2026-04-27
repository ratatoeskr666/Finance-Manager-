import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsvText } from '../csv';

describe('detectDelimiter', () => {
  it('picks semicolon for German exports', () => {
    expect(detectDelimiter('Buchungstag;Betrag;Saldo\n01.01.2024;10,00;100,00')).toBe(';');
  });
  it('picks comma when comma is dominant', () => {
    expect(detectDelimiter('Date,Amount,Balance\n2024-01-01,10.00,100.00')).toBe(',');
  });
  it('falls back to semicolon when nothing matches', () => {
    expect(detectDelimiter('plain text without delimiters')).toBe(';');
  });
});

describe('parseCsvText', () => {
  it('parses semicolon-delimited German CSV with header', () => {
    const text = 'Buchungstag;Betrag;Verwendungszweck\n01.01.2024;-12,34;Test\n02.01.2024;100,00;Salary';
    const out = parseCsvText(text, { delimiter: ';', encoding: 'utf-8' });
    expect(out.headers).toEqual(['Buchungstag', 'Betrag', 'Verwendungszweck']);
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0].Buchungstag).toBe('01.01.2024');
    expect(out.rows[0].Betrag).toBe('-12,34');
  });

  it('skips preamble lines when skipLines is set', () => {
    const text = '# Sparkasse Export\n# generated on …\nDate;Amount\n01.01.2024;10,00';
    const out = parseCsvText(text, { delimiter: ';', encoding: 'utf-8', skipLines: 2 });
    expect(out.headers).toEqual(['Date', 'Amount']);
    expect(out.rows).toHaveLength(1);
  });

  it('handles quoted fields containing newlines (Verwendungszweck quirk)', () => {
    const text = 'Date;Amount;Note\n01.01.2024;10,00;"Line one\nLine two"';
    const out = parseCsvText(text, { delimiter: ';', encoding: 'utf-8' });
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].Note).toBe('Line one\nLine two');
  });
});
