import { Card, CardContent } from '@/components/ui/card';

export type Recommendation = {
  modules: number;
  autoModules: number;
  maxModules: number;
  pvKwp: number;
  batteryKwh: number;
  inverterKw: number;
  includeHeatpump: boolean;
  heatpumpKw: number;
  includeWallbox: boolean;
  wallboxKw: number;
  capReason: string;
  annualPvKwh: number;
  selfConsumedKwh: number;
  exportedKwh: number;
  firstYearValue: number;
  heatingSavings: number;
};

function OfferRow({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
      <div className="flex items-baseline gap-1 whitespace-nowrap">
        <span className="text-lg font-semibold tabular-nums">{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

export function OfferCard({
  rec,
  updating,
  note,
  placeholder,
}: {
  rec: Recommendation | null;
  updating: boolean;
  note?: string;
  placeholder?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="relative border-b bg-gradient-to-br from-primary/15 via-primary/5 to-background px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Recommended system
          </div>
          {updating && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              updating
            </span>
          )}
        </div>
        {rec ? (
          <>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tabular-nums tracking-tight">
                {rec.pvKwp.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">
                kWp PV system
              </span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              sized by {rec.capReason}
            </div>
          </>
        ) : (
          <div className="mt-2 h-12 animate-pulse rounded bg-muted/50" />
        )}
      </div>
      <CardContent className="pt-5">
        {rec ? (
          <dl className="divide-y divide-border/60">
            <OfferRow
              label="PV modules"
              value={`${rec.modules}`}
              unit="panels"
              sub={`${rec.pvKwp.toFixed(2)} kWp peak`}
            />
            <OfferRow
              label="Battery storage"
              value={rec.batteryKwh.toFixed(1)}
              unit="kWh"
            />
            <OfferRow
              label="Inverter"
              value={rec.inverterKw.toFixed(1)}
              unit="kW"
            />
            {rec.includeHeatpump && (
              <OfferRow
                label="Heat pump"
                value={rec.heatpumpKw.toFixed(1)}
                unit="kW"
              />
            )}
            {rec.includeWallbox && (
              <OfferRow
                label="EV wallbox"
                value={`${rec.wallboxKw}`}
                unit="kW"
              />
            )}
            <OfferRow
              label="Money saved in the first year"
              value={`EUR ${rec.firstYearValue.toLocaleString('en-US')}`}
              sub={
                rec.heatingSavings > 0
                  ? `self-consumption + feed-in + heating savings`
                  : `self-consumption + feed-in`
              }
            />
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            {placeholder ?? 'Generating offer from form values…'}
          </p>
        )}
        {note && (
          <p className="mt-4 border-t border-border/50 pt-3 text-[11px] italic text-muted-foreground">
            {note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
