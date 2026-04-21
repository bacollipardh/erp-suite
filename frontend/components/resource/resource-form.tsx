'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { resources, type ResourceField } from '@/lib/resources';
import { TextInput } from '@/components/crud/text-input';
import { TextareaInput } from '@/components/crud/textarea-input';
import { NumberInput } from '@/components/crud/number-input';
import { CheckboxInput } from '@/components/crud/checkbox-input';
import { SelectInput } from '@/components/crud/select-input';
import { FormActions } from '@/components/crud/form-actions';

function initialValue(field: ResourceField, record?: any) {
  if (record && record[field.name] !== undefined && record[field.name] !== null) {
    return record[field.name];
  }
  if (field.type === 'checkbox') return true;
  if (field.type === 'number') return 0;
  return '';
}

export function ResourceForm({
  resourceKey,
  mode,
  record,
  optionsMap,
}: {
  resourceKey: string;
  mode: 'create' | 'edit';
  record?: any;
  optionsMap: Record<string, any[]>;
}) {
  const config = resources[resourceKey];
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const initialState = useMemo(() => {
    const obj: Record<string, any> = {};
    for (const field of config.fields) {
      obj[field.name] = initialValue(field, record);
    }
    return obj;
  }, [config.fields, record]);

  const [form, setForm] = useState<Record<string, any>>(initialState);
  const [apiError, setApiError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setApiError(null);

    const payload: Record<string, any> = {};
    for (const field of config.fields) {
      const value = form[field.name];
      if (field.type === 'number') {
        payload[field.name] = value === '' || value === null ? undefined : Number(value);
      } else if (field.type === 'text' || field.type === 'email') {
        // Don't send empty strings for text/email — omit them so backend can apply its own defaults
        if (value !== '' && value !== null && value !== undefined) {
          payload[field.name] = value;
        }
      } else {
        payload[field.name] = value;
      }
    }

    try {
      if (mode === 'create') {
        await api.create(config.endpoint, payload);
      } else {
        await api.update(config.endpoint, record.id, payload);
      }
      router.push(`/${resourceKey}`);
      router.refresh();
    } catch (err: any) {
      try {
        const body = JSON.parse(err.message);
        setApiError(body.message ?? 'An error occurred');
      } catch {
        setApiError(err.message ?? 'An error occurred');
      }
    } finally {
      setBusy(false);
    }
  }

  function renderField(field: ResourceField) {
    const value = form[field.name];

    if (field.type === 'text' || field.type === 'email' || field.type === 'date') {
      return (
        <TextInput
          label={field.label}
          type={field.type === 'text' ? 'text' : field.type}
          value={value}
          onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
        />
      );
    }

    if (field.type === 'textarea') {
      return (
        <TextareaInput
          label={field.label}
          value={value}
          onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
        />
      );
    }

    if (field.type === 'number') {
      return (
        <NumberInput
          label={field.label}
          value={value}
          onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
        />
      );
    }

    if (field.type === 'checkbox') {
      return (
        <CheckboxInput
          label={field.label}
          checked={Boolean(value)}
          onChange={(checked) => setForm({ ...form, [field.name]: checked })}
        />
      );
    }

    if (field.type === 'select') {
      const options = (optionsMap[field.name] ?? []).map((row: any) => ({
        value: row.id,
        label: field.labelTemplate
          ? row[field.labelTemplate] ?? row.name ?? row.code ?? row.id
          : row[field.labelKey ?? 'name'] ?? row.name ?? row.code ?? row.id,
      }));

      return (
        <SelectInput
          label={field.label}
          value={value}
          onChange={(nextValue) => setForm({ ...form, [field.name]: nextValue })}
          options={options}
        />
      );
    }

    return null;
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 max-w-4xl">
      {apiError && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2.5">
          {apiError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {config.fields
          .filter((field) => field.type !== 'textarea' && field.type !== 'checkbox')
          .map((field) => (
            <div key={field.name}>{renderField(field)}</div>
          ))}
      </div>

      {config.fields.some((f) => f.type === 'textarea') && (
        <div className="space-y-3 pt-1">
          {config.fields.filter((field) => field.type === 'textarea').map((field) => (
            <div key={field.name}>{renderField(field)}</div>
          ))}
        </div>
      )}

      {config.fields.some((f) => f.type === 'checkbox') && (
        <div className="flex flex-wrap gap-4 pt-1">
          {config.fields.filter((field) => field.type === 'checkbox').map((field) => (
            <div key={field.name}>{renderField(field)}</div>
          ))}
        </div>
      )}

      <FormActions submitLabel={mode === 'create' ? 'Krijo' : 'Përditëso'} busy={busy} />
    </form>
  );
}
