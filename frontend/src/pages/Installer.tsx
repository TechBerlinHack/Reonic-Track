import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialForm = {
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
};

type Form = typeof initialForm;

export function Installer() {
  const [form, setForm] = useState<Form>(initialForm);
  const [result, setResult] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/installer/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const numField = (
    key: keyof Form,
    label: string,
    step = 'any',
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        step={step}
        value={String(form[key])}
        onChange={(e) => update(key, Number(e.target.value) as never)}
      />
    </div>
  );

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Installer · project input</h1>
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          ← back
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer & house</CardTitle>
          <CardDescription>
            Fields mirror the <code>ProjectInput</code> shape from <code>DATA_MODELS.md</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {numField('annualDemandKwh', 'Annual electricity demand (kWh)')}
            {numField('priceEurKwh', 'Power price (EUR/kWh)', '0.01')}
            {numField('houseSize', 'House size (sqm)')}
            {numField('inhabitants', 'Inhabitants', '1')}

            <div className="space-y-1.5">
              <Label htmlFor="heatingType">Heating type</Label>
              <Input
                id="heatingType"
                value={form.heatingType}
                onChange={(e) => update('heatingType', e.target.value)}
              />
            </div>
            {numField('heatDemandKwh', 'Heat demand (kWh/year)')}
            {numField('heatingCost', 'Existing heating cost (EUR/year)')}
            {numField('roofSafety', 'Roof safety factor (0–1)', '0.05')}

            <div className="space-y-1.5">
              <Label htmlFor="hasEv">Has EV?</Label>
              <select
                id="hasEv"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.hasEv ? 'true' : 'false'}
                onChange={(e) => update('hasEv', e.target.value === 'true')}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
            {numField('evKm', 'EV annual km')}

            <div className="md:col-span-2 flex items-center justify-end gap-3 pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="mt-6 border-destructive/50">
          <CardContent className="pt-6 text-sm text-destructive">Error: {error}</CardContent>
        </Card>
      )}

      {result !== null && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Recommendation (stub)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md bg-muted p-4 text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
