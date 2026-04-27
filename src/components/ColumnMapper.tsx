import type { ColumnMapping } from '../lib/types';
import { Label, Select } from './ui/Field';

const NONE = '__none__';

export function ColumnMapper({
  headers,
  mapping,
  onChange,
}: {
  headers: string[];
  mapping: ColumnMapping;
  onChange: (m: ColumnMapping) => void;
}) {
  const set = (patch: Partial<ColumnMapping>) => onChange({ ...mapping, ...patch });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <Label>Date column *</Label>
        <Select value={mapping.date} onChange={(e) => set({ date: e.target.value })}>
          {headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Amount column *</Label>
        <Select value={mapping.amount} onChange={(e) => set({ amount: e.target.value })}>
          {headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Balance column (optional)</Label>
        <Select
          value={mapping.balance ?? NONE}
          onChange={(e) => set({ balance: e.target.value === NONE ? undefined : e.target.value })}
        >
          <option value={NONE}>— derive from amounts —</option>
          {headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Description column (optional)</Label>
        <Select
          value={mapping.description ?? NONE}
          onChange={(e) => set({ description: e.target.value === NONE ? undefined : e.target.value })}
        >
          <option value={NONE}>— none —</option>
          {headers.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
