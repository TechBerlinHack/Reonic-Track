import { useEffect, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { OfferCard, type Recommendation } from '@/components/OfferCard';

const HEATING_TYPES = [
  { value: 'Gas', label: 'Gas' },
  { value: 'Oil', label: 'Oil' },
  { value: 'HeatPump', label: 'Heat pump' },
  { value: 'DistrictHeat', label: 'District heating' },
  { value: 'OtherNonRenewable', label: 'Other (non-renewable)' },
] as const;

type HeatingType = (typeof HEATING_TYPES)[number]['value'];

type DesignMode = 'economy' | 'recommended' | 'max';

type Form = {
  annualDemandKwh: number;
  priceEurKwh: number;
  houseSize: number;
  inhabitants: number;
  hasEv: boolean;
  evKm: number;
  heatingType: HeatingType;
  heatDemandKwh: number;
  heatingCost: number;
  roofSafety: number;
  designMode: DesignMode;
  modulesOverride: number | null;
  batteryKwhOverride: number | null;
  includeBattery: boolean;
  includeHeatpump: boolean | null;
  includeWallbox: boolean | null;
};

const initialForm: Form = {
  annualDemandKwh: 4500,
  priceEurKwh: 0.39,
  houseSize: 140,
  inhabitants: 4,
  hasEv: false,
  evKm: 15000,
  heatingType: 'Gas',
  heatDemandKwh: 18000,
  heatingCost: 1800,
  roofSafety: 0.85,
  designMode: 'recommended',
  modulesOverride: null,
  batteryKwhOverride: null,
  includeBattery: true,
  includeHeatpump: null,
  includeWallbox: null,
};

type SubmitResult = {
  received: Form;
  recommendation: Recommendation;
  note?: string;
};

export function Installer() {
  const [form, setForm] = useState<Form>(initialForm);
  const [result, setResult] = useState<unknown>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<Record<string, boolean>>({});

  const update = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const { input, handleInputChange, handleSubmit, isLoading, addToolResult } =
    useChat({
      api: '/api/installer/chat',
      maxSteps: 5,
      async onToolCall({ toolCall }) {
        if (toolCall.toolName === 'setFormFields') {
          const fields = toolCall.args as Partial<Form>;
          const applied: Partial<Form> = {};
          for (const [k, v] of Object.entries(fields)) {
            if (v === undefined || v === null) continue;
            (applied as any)[k] = v;
          }
          const appliedKeys = Object.keys(applied);
          if (appliedKeys.length > 0) {
            setForm((prev) => ({ ...prev, ...applied }));
            setHighlighted((prev) => {
              const next = { ...prev };
              for (const k of appliedKeys) delete next[k];
              return next;
            });
            requestAnimationFrame(() => {
              setHighlighted((prev) => {
                const next = { ...prev };
                for (const k of appliedKeys) next[k] = true;
                return next;
              });
            });
          }
          addToolResult({ toolCallId: toolCall.toolCallId, result: { applied } });
        }
      },
    });

  const fieldClass = (key: keyof Form) => (highlighted[key as string] ? 'field-just-set' : '');

  const onFieldAnimationEnd = (key: keyof Form) => (e: React.AnimationEvent) => {
    if (e.animationName !== 'field-wiggle-glow') return;
    setHighlighted((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setUpdating(true);
      setError(null);
      try {
        const res = await fetch('/api/installer/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setResult(await res.json());
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setUpdating(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [form]);

  const numField = (key: keyof Form, label: string, step = 'any') => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        step={step}
        value={String(form[key])}
        onChange={(e) => update(key, Number(e.target.value) as never)}
        className={fieldClass(key)}
        onAnimationEnd={onFieldAnimationEnd(key)}
      />
    </div>
  );

  type NullableNumKey = {
    [K in keyof Form]: Form[K] extends number | null ? K : never;
  }[keyof Form];

  const nullableNumField = (
    key: NullableNumKey,
    label: string,
    placeholder: string,
    step = 'any',
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        step={step}
        value={form[key] === null ? '' : String(form[key])}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          update(key, (raw === '' ? null : Number(raw)) as never);
        }}
        className={fieldClass(key)}
        onAnimationEnd={onFieldAnimationEnd(key)}
      />
    </div>
  );

  const triStateField = (
    key: 'includeHeatpump' | 'includeWallbox',
    label: string,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <select
        id={key}
        className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${fieldClass(key)}`}
        value={form[key] === null ? 'auto' : form[key] ? 'yes' : 'no'}
        onChange={(e) => {
          const v = e.target.value;
          update(key, (v === 'auto' ? null : v === 'yes') as never);
        }}
        onAnimationEnd={onFieldAnimationEnd(key)}
      >
        <option value="auto">Auto</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );

  const offer = result as SubmitResult | null;
  const rec = offer?.recommendation;

  return (
    <main className="mx-auto max-w-6xl p-6 pb-40">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Installer</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[6fr_4fr]">
        <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer & house</CardTitle>
            <CardDescription>
              Add data about the household.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {numField('annualDemandKwh', 'Annual electricity demand (kWh)')}
              {numField('priceEurKwh', 'Power price (EUR/kWh)', '0.01')}
              {numField('houseSize', 'House size (sqm)')}
              {numField('inhabitants', 'Inhabitants', '1')}

              <div className="space-y-1.5">
                <Label htmlFor="heatingType">Heating type</Label>
                <select
                  id="heatingType"
                  className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${fieldClass('heatingType')}`}
                  value={form.heatingType}
                  onChange={(e) => update('heatingType', e.target.value as HeatingType)}
                  onAnimationEnd={onFieldAnimationEnd('heatingType')}
                >
                  {HEATING_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {numField('heatDemandKwh', 'Heat demand (kWh/year)')}
              {numField('heatingCost', 'Existing heating cost (EUR/year)')}
              {numField('roofSafety', 'Roof safety factor (0–1)', '0.05')}

              <div className="space-y-1.5">
                <Label htmlFor="hasEv">Has EV?</Label>
                <select
                  id="hasEv"
                  className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${fieldClass('hasEv')}`}
                  value={form.hasEv ? 'true' : 'false'}
                  onChange={(e) => update('hasEv', e.target.value === 'true')}
                  onAnimationEnd={onFieldAnimationEnd('hasEv')}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              {numField('evKm', 'EV annual km')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Design</CardTitle>
            <CardDescription>
              Pick a sizing target. Leave overrides blank to auto-size.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['economy', 'recommended', 'max'] as DesignMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => update('designMode', m)}
                    className={`h-10 rounded-md border text-sm capitalize transition-colors ${
                      form.designMode === m
                        ? 'border-primary bg-primary/10 font-medium'
                        : 'border-input bg-background hover:bg-accent'
                    } ${fieldClass('designMode')}`}
                    onAnimationEnd={onFieldAnimationEnd('designMode')}
                  >
                    {m === 'max' ? 'Max roof' : m}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {nullableNumField(
                'modulesOverride',
                'Modules (override)',
                rec ? `auto: ${rec.autoModules}` : 'auto',
                '1',
              )}
              {nullableNumField(
                'batteryKwhOverride',
                'Battery kWh (override)',
                rec ? `auto: ${rec.batteryKwh.toFixed(1)}` : 'auto',
                '0.5',
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="includeBattery">Battery</Label>
                <label
                  htmlFor="includeBattery"
                  className={`flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm ${fieldClass('includeBattery')}`}
                  onAnimationEnd={onFieldAnimationEnd('includeBattery')}
                >
                  <input
                    id="includeBattery"
                    type="checkbox"
                    checked={form.includeBattery}
                    onChange={(e) => update('includeBattery', e.target.checked)}
                    className="h-4 w-4"
                  />
                  Include
                </label>
              </div>
              {triStateField('includeHeatpump', 'Heat pump')}
              {triStateField('includeWallbox', 'Wallbox')}
            </div>
          </CardContent>
        </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <OfferCard rec={rec ?? null} updating={updating} note={offer?.note} />

          {error && (
            <Card className="border-destructive/50">
              <CardContent className="pt-6 text-sm text-destructive">
                Error: {error}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-6xl gap-2 px-6 py-3"
        >
          <Textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Describe the project — annual demand, heating, EV, etc."
            className="min-h-[44px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? 'Thinking…' : 'Send'}
          </Button>
        </form>
      </div>
    </main>
  );
}
