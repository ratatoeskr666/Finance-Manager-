import { useMemo, useState } from 'react';
import type { Category, CategoryRule } from '../lib/types';
import { Button } from './ui/Button';
import { Label, NumberInput, Select, TextInput } from './ui/Field';
import { Modal } from './ui/Modal';
import { paletteColor, randomId } from '../lib/format';

type Props = {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  rules: CategoryRule[];
  onUpsertCategory: (c: Category) => void | Promise<void>;
  onRemoveCategory: (id: string) => void | Promise<void>;
  onSetRules: (rules: CategoryRule[]) => void | Promise<void>;
  /** Counterparty values seen in transactions, used as autocomplete hints. */
  counterpartySuggestions: string[];
};

export function CategoryManager({
  open,
  onClose,
  categories,
  rules,
  onUpsertCategory,
  onRemoveCategory,
  onSetRules,
  counterpartySuggestions,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = useMemo(() => categories.find((c) => c.id === editingId) ?? null, [categories, editingId]);
  const editingRules = useMemo(
    () => (editing ? rules.filter((r) => r.categoryId === editing.id) : []),
    [editing, rules],
  );

  const addCategory = () => {
    const cat: Category = {
      id: randomId(),
      name: 'New category',
      color: paletteColor(categories.length),
      icon: '🏷️',
    };
    void onUpsertCategory(cat);
    setEditingId(cat.id);
  };

  return (
    <Modal open={open} onClose={onClose} title="Manage categories" size="xl">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-2">
          <Button onClick={addCategory} className="w-full">
            + New category
          </Button>
          <div className="flex flex-col gap-1">
            {categories.length === 0 && (
              <p className="rounded-lg bg-slate-800/40 p-3 text-xs text-slate-400">
                No categories yet. Click "New category" to create one.
              </p>
            )}
            {categories.map((c) => {
              const ruleCount = rules.filter((r) => r.categoryId === c.id).length;
              return (
                <button
                  key={c.id}
                  onClick={() => setEditingId(c.id)}
                  className={[
                    'flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition',
                    editingId === c.id
                      ? 'border-cyan-500/60 bg-cyan-500/5 text-cyan-100'
                      : 'border-transparent text-slate-200 hover:bg-slate-800',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                    <span>
                      {c.icon ? `${c.icon} ` : ''}
                      {c.name}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">{ruleCount} rules</span>
                </button>
              );
            })}
          </div>
        </aside>
        <section className="min-h-[360px]">
          {!editing ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
              Select a category on the left to edit its name, color, and rules.
            </div>
          ) : (
            <CategoryEditor
              category={editing}
              rules={editingRules}
              counterpartySuggestions={counterpartySuggestions}
              onChange={(c) => onUpsertCategory(c)}
              onDelete={() => {
                if (
                  confirm(
                    `Delete "${editing.name}"? Its rules and any manual assignments to it will be removed.`,
                  )
                ) {
                  void onRemoveCategory(editing.id);
                  setEditingId(null);
                }
              }}
              onChangeRules={(next) => {
                const others = rules.filter((r) => r.categoryId !== editing.id);
                onSetRules([...others, ...next]);
              }}
            />
          )}
        </section>
      </div>
    </Modal>
  );
}

function CategoryEditor({
  category,
  rules,
  counterpartySuggestions,
  onChange,
  onDelete,
  onChangeRules,
}: {
  category: Category;
  rules: CategoryRule[];
  counterpartySuggestions: string[];
  onChange: (c: Category) => void;
  onDelete: () => void;
  onChangeRules: (next: CategoryRule[]) => void;
}) {
  const update = (patch: Partial<Category>) => onChange({ ...category, ...patch });

  const addRule = (preset?: Partial<CategoryRule>) => {
    const r: CategoryRule = {
      id: randomId(),
      categoryId: category.id,
      field: 'counterparty',
      mode: 'contains',
      pattern: '',
      caseSensitive: false,
      ...preset,
    };
    onChangeRules([...rules, r]);
  };

  const updateRule = (id: string, patch: Partial<CategoryRule>) => {
    onChangeRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRule = (id: string) => onChangeRules(rules.filter((r) => r.id !== id));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_120px_120px]">
        <div>
          <Label>Name</Label>
          <TextInput value={category.name} onChange={(e) => update({ name: e.target.value })} />
        </div>
        <div>
          <Label>Icon</Label>
          <TextInput
            value={category.icon ?? ''}
            placeholder="🏷️"
            onChange={(e) => update({ icon: e.target.value || undefined })}
          />
        </div>
        <div>
          <Label>Color</Label>
          <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-2">
            <input
              type="color"
              value={category.color}
              onChange={(e) => update({ color: e.target.value })}
              className="h-6 w-8 cursor-pointer border-none bg-transparent p-0"
            />
            <span className="text-xs text-slate-400">{category.color}</span>
          </div>
        </div>
        <div>
          <Label>Monthly budget (€)</Label>
          <NumberInput
            value={category.budget ?? ''}
            placeholder="optional"
            step="0.01"
            onChange={(e) =>
              update({ budget: e.target.value === '' ? undefined : Number(e.target.value) || undefined })
            }
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-slate-100">Rules</h3>
          <span className="text-xs text-slate-500">
            First matching rule wins. Manual assignments on individual transactions always override rules.
          </span>
        </div>
        <div className="space-y-2">
          {rules.map((r) => (
            <RuleRow
              key={r.id}
              rule={r}
              counterpartySuggestions={counterpartySuggestions}
              onChange={(patch) => updateRule(r.id, patch)}
              onRemove={() => removeRule(r.id)}
            />
          ))}
        </div>
        <div className="mt-3">
          <Button variant="subtle" onClick={() => addRule()}>
            + Add rule
          </Button>
        </div>
      </div>

      <div className="flex justify-between border-t border-slate-800 pt-4">
        <Button variant="danger" onClick={onDelete}>
          Delete category
        </Button>
      </div>
    </div>
  );
}

function RuleRow({
  rule,
  counterpartySuggestions,
  onChange,
  onRemove,
}: {
  rule: CategoryRule;
  counterpartySuggestions: string[];
  onChange: (patch: Partial<CategoryRule>) => void;
  onRemove: () => void;
}) {
  const listId = `cp-suggestions-${rule.id}`;
  return (
    <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2 sm:grid-cols-[140px_140px_1fr_auto_auto]">
      <Select value={rule.field} onChange={(e) => onChange({ field: e.target.value as CategoryRule['field'] })}>
        <option value="counterparty">Counterparty</option>
        <option value="description">Description</option>
        <option value="any">Either</option>
      </Select>
      <Select value={rule.mode} onChange={(e) => onChange({ mode: e.target.value as CategoryRule['mode'] })}>
        <option value="contains">contains</option>
        <option value="equals">equals</option>
        <option value="regex">regex</option>
      </Select>
      <TextInput
        value={rule.pattern}
        onChange={(e) => onChange({ pattern: e.target.value })}
        placeholder={rule.mode === 'regex' ? '^Allianz' : 'Allianz'}
        list={rule.field !== 'description' ? listId : undefined}
      />
      <datalist id={listId}>
        {counterpartySuggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={!!rule.caseSensitive}
          onChange={(e) => onChange({ caseSensitive: e.target.checked })}
          className="accent-cyan-400"
        />
        Aa
      </label>
      <Button
        variant="ghost"
        className="!px-2 text-xs text-rose-300 hover:!bg-rose-900/20"
        onClick={onRemove}
        aria-label="Remove rule"
      >
        ✕
      </Button>
    </div>
  );
}
