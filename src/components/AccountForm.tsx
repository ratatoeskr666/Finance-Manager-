import { useMemo, useState } from 'react';
import { PRESET_LIST, getPreset } from '../lib/presets';
import type { Account, ColumnMapping, PresetId } from '../lib/types';
import { paletteColor, randomId } from '../lib/format';
import { Button } from './ui/Button';
import { Label, NumberInput, Select, TextInput } from './ui/Field';

export function AccountForm({
  initial,
  existingCount,
  onSave,
  onCancel,
}: {
  initial?: Account;
  existingCount: number;
  onSave: (a: Account) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [presetId, setPresetId] = useState<PresetId>(initial?.presetId ?? 'sparkasse');
  const [color, setColor] = useState(initial?.color ?? paletteColor(existingCount));
  const [startingBalance, setStartingBalance] = useState<string>(
    initial?.startingBalance !== undefined ? String(initial.startingBalance) : '0',
  );

  const preset = useMemo(() => getPreset(presetId), [presetId]);

  const submit = () => {
    if (!name.trim()) return;
    const baseMapping: ColumnMapping = preset?.defaultMapping ?? {
      date: 'Date',
      amount: 'Amount',
      description: 'Description',
    };
    const account: Account = {
      id: initial?.id ?? randomId(),
      name: name.trim(),
      color,
      presetId,
      mapping: initial?.mapping ?? baseMapping,
      delimiter: initial?.delimiter ?? preset?.delimiter ?? ';',
      encoding: initial?.encoding ?? preset?.encoding ?? 'utf-8',
      decimal: initial?.decimal ?? preset?.decimal ?? ',',
      dateFormat: initial?.dateFormat ?? preset?.dateFormat ?? 'dd.MM.yyyy',
      startingBalance: Number(startingBalance) || 0,
      currency: 'EUR',
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    };
    onSave(account);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="account-name">Account name</Label>
        <TextInput
          id="account-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sparkasse Girokonto"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="preset">Bank preset</Label>
          <Select id="preset" value={presetId} onChange={(e) => setPresetId(e.target.value as PresetId)}>
            {PRESET_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="custom">Custom…</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="color">Color</Label>
          <div className="flex items-center gap-2">
            <input
              id="color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-slate-700 bg-slate-900"
            />
            <span className="text-xs text-slate-400">{color}</span>
          </div>
        </div>
      </div>
      <div>
        <Label htmlFor="starting-balance">Starting balance (EUR)</Label>
        <NumberInput
          id="starting-balance"
          value={startingBalance}
          step="0.01"
          onChange={(e) => setStartingBalance(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">
          Used when the CSV has no running balance column. The first transaction will be added to this value.
        </p>
      </div>
      {preset?.notes && <p className="rounded-lg bg-slate-800/60 p-3 text-xs text-slate-300">{preset.notes}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!name.trim()}>
          {initial ? 'Save' : 'Create account'}
        </Button>
      </div>
    </div>
  );
}
