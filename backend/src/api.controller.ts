import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Agent } from '@mastra/core/agent';
import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';

const homeownerAgent = new Agent({
  name: 'homeowner-advisor',
  instructions: `You are a friendly residential renewable-energy advisor for homeowners.

You help homeowners understand:
- How rooftop solar (PV), battery storage, heat pumps, and EV wallboxes work together
- Whether a given system size makes sense for their situation
- Trade-offs between economy, recommended, and roof-maximizing system designs
- Rough payback expectations and self-consumption dynamics

Be concise, plain-spoken, and avoid sales-y language. If a question requires
specifics you don't have (location, roof, electricity demand), ask one focused
follow-up question rather than guessing.`,
  model: google('gemini-2.5-flash'),
});

const HeatingType = z.enum([
  'Gas',
  'Oil',
  'HeatPump',
  'DistrictHeat',
  'OtherNonRenewable',
]);

const InstallerFormFields = z
  .object({
    annualDemandKwh: z
      .number()
      .positive()
      .describe('Annual electricity demand in kWh.'),
    priceEurKwh: z
      .number()
      .positive()
      .describe('Power price in EUR per kWh, e.g. 0.39.'),
    houseSize: z.number().positive().describe('Living area in square metres.'),
    inhabitants: z
      .number()
      .int()
      .positive()
      .describe('Number of people living in the household.'),
    hasEv: z
      .boolean()
      .describe('Whether the household has an electric vehicle.'),
    evKm: z
      .number()
      .nonnegative()
      .describe('Annual EV mileage in km. Use 0 if no EV.'),
    heatingType: HeatingType.describe('Current primary heating system.'),
    heatDemandKwh: z
      .number()
      .nonnegative()
      .describe('Annual heat demand in kWh per year.'),
    heatingCost: z
      .number()
      .nonnegative()
      .describe('Existing yearly heating cost in EUR.'),
    roofSafety: z
      .number()
      .min(0)
      .max(1)
      .describe('Roof usable-area safety factor between 0 and 1.'),
  })
  .partial();

const ChatBody = z.object({
  messages: z.array(z.any()).min(1),
});

const HomeownerChatBody = z.object({
  messages: z.array(z.any()).min(1),
  knownFields: z.array(z.string()).default([]),
  unknownFields: z.array(z.string()).default([]),
});

const InstallerBody = z.object({
  annualDemandKwh: z.number().positive(),
  priceEurKwh: z.number().positive(),
  houseSize: z.number().positive(),
  inhabitants: z.number().int().positive(),
  hasEv: z.boolean(),
  evKm: z.number().nonnegative(),
  heatingType: HeatingType,
  heatDemandKwh: z.number().nonnegative(),
  heatingCost: z.number().nonnegative(),
  roofSafety: z.number().min(0).max(1),
  designMode: z
    .enum(['economy', 'recommended', 'max'])
    .default('recommended'),
  modulesOverride: z.number().int().nonnegative().nullable().default(null),
  batteryKwhOverride: z.number().nonnegative().nullable().default(null),
  includeBattery: z.boolean().default(true),
  includeHeatpump: z.boolean().nullable().default(null),
  includeWallbox: z.boolean().nullable().default(null),
});

const HomeownerOfferBody = InstallerFormFields.extend({
  unknownFields: z.array(z.string()).default([]),
});

const HOMEOWNER_FIELD_ORDER = [
  'annualDemandKwh',
  'houseSize',
  'heatingType',
  'heatDemandKwh',
  'heatingCost',
  'hasEv',
  'evKm',
  'priceEurKwh',
  'inhabitants',
  'roofSafety',
] as const;

const HOMEOWNER_DEFAULTS: z.infer<typeof InstallerBody> = {
  annualDemandKwh: 4500,
  priceEurKwh: 0.39,
  houseSize: 140,
  inhabitants: 3,
  hasEv: false,
  evKm: 0,
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

const HOMEOWNER_SYSTEM_PROMPT = `You are a friendly residential renewable-energy advisor helping a homeowner figure out the right rooftop solar, battery, heat pump, and EV charging setup for their home.

You will guide them through about 10 short questions, ONE AT A TIME. Never ask for multiple values in one turn. Use plain language, avoid jargon, and translate units gently (e.g. "what does your last electricity bill say in kWh per year?", "roughly how many square metres is your home?").

Ask the fields in this priority order, skipping any field that is already set or marked unknown:
1. annualDemandKwh  2. houseSize  3. heatingType  4. heatDemandKwh  5. heatingCost  6. hasEv  7. evKm (only if hasEv is true)  8. priceEurKwh  9. inhabitants  10. roofSafety

Tool use:
- When the user gives a value (even approximate, even in different units), call setFormFields with the extracted fields. Convert units sensibly (MWh->kWh, ct/kWh->EUR/kWh). Never invent values.
- If the user says they don't know, aren't sure, want to skip, or "no idea", call markFieldUnknown with the exact field name. NEVER ask for that field again.
- After every tool call, briefly acknowledge ("got it — ~4500 kWh/year") and ask the NEXT field that is neither set nor marked unknown.
- When all 10 fields are either set or unknown, stop interviewing and offer to discuss the recommendation shown on the right.

If the homeowner asks an off-topic question (e.g. "what is a heat pump?"), answer it briefly and warmly, then return to the next field.`;

function nextHomeownerField(known: string[], unknown: string[]) {
  const knownSet = new Set(known);
  const unknownSet = new Set(unknown);
  for (const field of HOMEOWNER_FIELD_ORDER) {
    if (knownSet.has(field) || unknownSet.has(field)) continue;
    return field;
  }
  return null;
}

@Controller('api')
export class ApiController {
  @Get('health')
  health() {
    return { ok: true, ts: new Date().toISOString() };
  }

  @Post('installer/submit')
  installerSubmit(@Body() body: unknown) {
    const parsed = InstallerBody.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        { message: 'Invalid body', issues: parsed.error.issues },
        HttpStatus.BAD_REQUEST,
      );
    }
    const input = parsed.data;
    return {
      received: input,
      recommendation: calculateRecommendation(input),
    };
  }

  @Post('chat')
  async chat(@Body() body: unknown, @Res() res: Response) {
    const parsed = ChatBody.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        { message: 'Invalid body', issues: parsed.error.issues },
        HttpStatus.BAD_REQUEST,
      );
    }

    const stream = await homeownerAgent.stream(parsed.data.messages as any);
    const webResponse = stream.toDataStreamResponse();
    await pipeWebResponse(webResponse, res);
  }

  @Post('homeowner/offer')
  homeownerOffer(@Body() body: unknown) {
    const parsed = HomeownerOfferBody.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        { message: 'Invalid body', issues: parsed.error.issues },
        HttpStatus.BAD_REQUEST,
      );
    }
    const { unknownFields: _unknown, ...partial } = parsed.data;
    const missing: string[] = [];
    if (partial.annualDemandKwh == null) missing.push('annualDemandKwh');
    if (partial.houseSize == null) missing.push('houseSize');
    if (missing.length > 0) {
      return { recommendation: null, missing };
    }
    const merged: z.infer<typeof InstallerBody> = {
      ...HOMEOWNER_DEFAULTS,
      ...Object.fromEntries(
        Object.entries(partial).filter(([, v]) => v !== undefined),
      ),
    } as z.infer<typeof InstallerBody>;
    return {
      received: merged,
      recommendation: calculateRecommendation(merged),
      missing: [],
    };
  }

  @Post('homeowner/chat')
  async homeownerChat(@Body() body: unknown, @Res() res: Response) {
    const parsed = HomeownerChatBody.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        { message: 'Invalid body', issues: parsed.error.issues },
        HttpStatus.BAD_REQUEST,
      );
    }

    const { messages, knownFields, unknownFields } = parsed.data;
    const next = nextHomeownerField(knownFields, unknownFields);
    const stateLine = `Already set: [${knownFields.join(', ') || 'none'}]. Marked unknown (do not ask again): [${unknownFields.join(', ') || 'none'}]. Next field to ask: ${next ?? 'none — all fields are set or unknown; stop interviewing and discuss the recommendation'}.`;

    const result = streamText({
      model: google('gemini-2.5-flash'),
      providerOptions: {
        google: { thinkingConfig: { thinkingBudget: 0 } },
      },
      system: `${HOMEOWNER_SYSTEM_PROMPT}\n\n${stateLine}`,
      messages: messages,
      tools: {
        setFormFields: tool({
          description:
            'Record one or more values the homeowner just gave you. Only include fields the user explicitly mentioned in this turn.',
          parameters: InstallerFormFields,
        }),
        markFieldUnknown: tool({
          description:
            'Mark a field as unknown so it is never asked again. Use when the homeowner says they do not know, are not sure, or want to skip.',
          parameters: z.object({
            field: z.enum(HOMEOWNER_FIELD_ORDER),
          }),
        }),
      },
      maxSteps: 4,
      onError({ error }) {
        console.error('homeowner/chat streamText error:', error);
      },
    });

    const webResponse = result.toDataStreamResponse({
      getErrorMessage: (error) =>
        error instanceof Error ? error.message : String(error),
    });
    await pipeWebResponse(webResponse, res);
  }

  @Post('installer/chat')
  async installerChat(@Body() body: unknown, @Res() res: Response) {
    const parsed = ChatBody.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        { message: 'Invalid body', issues: parsed.error.issues },
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = streamText({
      model: google('gemini-2.5-flash'),
      providerOptions: {
        google: { thinkingConfig: { thinkingBudget: 0 } },
      },
      system: `You help an installer fill out a project-input form for a residential renewable-energy design.

The form has these fields: annualDemandKwh, priceEurKwh, houseSize, inhabitants, hasEv, evKm, heatingType (one of Gas, Oil, HeatPump, DistrictHeat, OtherNonRenewable), heatDemandKwh, heatingCost, roofSafety (0–1).

When the installer mentions any of these values — even partially or in different units — call the setFormFields tool with the fields you can extract. Convert units sensibly (e.g. MWh→kWh, ct/kWh→EUR/kWh). Only include fields the user actually mentioned; never invent values. If a value is ambiguous, ask one focused follow-up question instead of guessing.

Be concise. After updating fields, briefly confirm what you set and ask for the next missing piece.`,
      messages: parsed.data.messages,
      tools: {
        setFormFields: tool({
          description:
            'Update one or more fields in the installer form with values extracted from the conversation. Only include fields the user explicitly mentioned.',
          parameters: InstallerFormFields,
        }),
      },
      maxSteps: 3,
      onError({ error }) {
        console.error('installer/chat streamText error:', error);
      },
    });

    const webResponse = result.toDataStreamResponse({
      getErrorMessage: (error) =>
        error instanceof Error ? error.message : String(error),
    });
    await pipeWebResponse(webResponse, res);
  }
}

const MODULE_WATT = 430;
const FOSSIL_HEATING = new Set(['Gas', 'Oil', 'OtherNonRenewable']);
const ANNUAL_YIELD_KWH_PER_KWP = 930 * 0.94;
const FEED_IN_EUR_KWH = 0.08;
const HEATING_SAVINGS_RATIO = 0.62;
const BASE_DIRECT_USE = 0.34;
const BATTERY_SELF_CONSUMPTION_BOOST = 0.22;
const HEATPUMP_SELF_CONSUMPTION_BOOST = 0.07;
const EV_SELF_CONSUMPTION_BOOST = 0.04;
const DIRECT_USE_MIN = 0.28;
const DIRECT_USE_MAX = 0.72;

type InstallerInput = z.infer<typeof InstallerBody>;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, decimals = 1) {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

/**
 * Sizes a residential PV system (plus optional battery, heat pump, and wallbox)
 * and estimates the first-year financial benefit.
 *
 * Algorithm in plain terms:
 *  1. Estimate total electricity the home will need per year — the household's
 *     base demand plus EV charging (km × 0.18 kWh/km) and, if a heat pump is
 *     in scope, the heating demand divided by a seasonal COP of 3.5.
 *  2. Work out how many panels the roof can physically take. There's no roof
 *     geometry available, so it's approximated from house size (one module per
 *     ~6 m²) and then trimmed by the user's roof-safety factor.
 *  3. Pick a target PV size: convert annual electricity need into kWp using a
 *     regional yield (~874 kWh/kWp), with a 0.95 utilisation factor.
 *     "economy" shrinks this to 76%, "max" ignores it and just fills the roof.
 *  4. Round the target up to whole modules, but never exceed the roof cap.
 *     A manual module override wins if provided.
 *  5. Size the battery from PV kWp (×0.82, +1.5 kWh if there's an EV), clamped
 *     to 4–18 kWh, then scaled by design mode. Skipped if the user opted out
 *     or PV is zero. A manual battery override wins if provided.
 *  6. Pick supporting hardware: inverter ≈ 0.86 × PV kWp (clamped),
 *     heat pump sized from heat demand / 1850, 11 kW wallbox if there's an EV.
 *  7. Estimate self-consumption: start from a 34% baseline and add boosts for
 *     battery (+22%), heat pump (+7%), and EV (+4%), clamped to 28–72%.
 *     Whatever PV isn't self-consumed is assumed exported.
 *  8. First-year value = self-consumed kWh × power price + exported kWh × feed-in
 *     tariff (€0.08), plus 62% of current heating cost if a heat pump replaces
 *     fossil heating.
 */
function calculateRecommendation(input: InstallerInput) {
  const evKwh = input.evKm * 0.18;
  const heatpumpAuto = FOSSIL_HEATING.has(input.heatingType);
  const includeHeatpump =
    input.includeHeatpump === null ? heatpumpAuto : input.includeHeatpump;
  const heatElectricKwh = includeHeatpump ? input.heatDemandKwh / 3.5 : 0;
  const totalElectricKwh = input.annualDemandKwh + evKwh + heatElectricKwh;

  // No roof geometry on the backend — derive a raw module ceiling from
  // house size, then apply the user-supplied roof safety factor.
  const rawMaxModules = Math.max(8, Math.round(input.houseSize / 6));
  const maxModules = Math.max(0, Math.floor(rawMaxModules * input.roofSafety));
  const maxKwp = (maxModules * MODULE_WATT) / 1000;

  let targetKwp = (totalElectricKwh / ANNUAL_YIELD_KWH_PER_KWP) * 0.95;
  if (input.designMode === 'economy') targetKwp *= 0.76;
  if (input.designMode === 'max') targetKwp = maxKwp;

  const autoModules = clamp(
    Math.ceil(targetKwp / (MODULE_WATT / 1000)),
    0,
    maxModules,
  );
  const modules =
    input.modulesOverride !== null
      ? clamp(input.modulesOverride, 0, maxModules)
      : autoModules;
  const pvKwp = (modules * MODULE_WATT) / 1000;

  let batteryKwh = 0;
  if (input.includeBattery && modules > 0) {
    if (input.batteryKwhOverride !== null) {
      batteryKwh = round(clamp(input.batteryKwhOverride, 0, 30), 1);
    } else {
      let battery = clamp(pvKwp * 0.82 + (input.hasEv ? 1.5 : 0), 4, 18);
      if (input.designMode === 'economy') battery *= 0.65;
      if (input.designMode === 'max') battery *= 1.1;
      batteryKwh = round(clamp(battery, 0, 30), 1);
    }
  }

  const inverterKw = round(
    clamp(pvKwp * 0.86, 3.6, Math.max(4, pvKwp * 1.05)),
    1,
  );
  const heatpumpKw = includeHeatpump
    ? round(clamp(input.heatDemandKwh / 1850, 5, 16), 1)
    : 0;
  const includeWallbox =
    input.includeWallbox === null ? input.hasEv : input.includeWallbox;
  const wallboxKw = includeWallbox ? 11 : 0;
  const capReason =
    maxModules > 0 && modules >= maxModules ? 'roof limited' : 'demand sized';

  const annualPvKwh = pvKwp * ANNUAL_YIELD_KWH_PER_KWP;
  const directUseRate = clamp(
    BASE_DIRECT_USE +
      (batteryKwh > 0 ? BATTERY_SELF_CONSUMPTION_BOOST : 0) +
      (includeHeatpump ? HEATPUMP_SELF_CONSUMPTION_BOOST : 0) +
      (input.hasEv ? EV_SELF_CONSUMPTION_BOOST : 0),
    DIRECT_USE_MIN,
    DIRECT_USE_MAX,
  );
  const selfConsumedKwh = Math.min(totalElectricKwh, annualPvKwh * directUseRate);
  const exportedKwh = Math.max(0, annualPvKwh - selfConsumedKwh);
  const powerSavings =
    selfConsumedKwh * input.priceEurKwh + exportedKwh * FEED_IN_EUR_KWH;
  const heatingSavings = includeHeatpump
    ? input.heatingCost * HEATING_SAVINGS_RATIO
    : 0;
  const firstYearValue = Math.round(powerSavings + heatingSavings);

  return {
    modules,
    autoModules,
    maxModules,
    pvKwp: round(pvKwp, 2),
    batteryKwh,
    inverterKw,
    includeHeatpump,
    heatpumpKw,
    includeWallbox,
    wallboxKw,
    capReason,
    annualPvKwh: Math.round(annualPvKwh),
    selfConsumedKwh: Math.round(selfConsumedKwh),
    exportedKwh: Math.round(exportedKwh),
    firstYearValue,
    heatingSavings: Math.round(heatingSavings),
  };
}

async function pipeWebResponse(webResponse: Response_, res: Response) {
  res.status(webResponse.status);
  webResponse.headers.forEach((value, key) => res.setHeader(key, value));

  if (!webResponse.body) {
    res.end();
    return;
  }

  const reader = webResponse.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } finally {
    res.end();
  }
}

type Response_ = globalThis.Response;
