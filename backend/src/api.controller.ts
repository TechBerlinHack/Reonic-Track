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

const ChatBody = z.object({
  messages: z.array(z.any()).min(1),
});

const InstallerBody = z.object({
  annualDemandKwh: z.number().positive(),
  priceEurKwh: z.number().positive(),
  houseSize: z.number().positive(),
  inhabitants: z.number().int().positive(),
  hasEv: z.boolean(),
  evKm: z.number().nonnegative(),
  heatingType: z.string(),
  heatDemandKwh: z.number().nonnegative(),
  heatingCost: z.number().nonnegative(),
  roofSafety: z.number().min(0).max(1),
});

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

    const includeHeatpump = ['Gas', 'Oil', 'OtherNonRenewable'].includes(
      input.heatingType,
    );
    const heatpumpKw = includeHeatpump
      ? Math.min(16, Math.max(5, input.heatDemandKwh / 1850))
      : 0;

    return {
      received: input,
      recommendation: {
        modules: 14,
        pvKwp: 6.0,
        batteryKwh: 6.2,
        inverterKw: 5.2,
        includeHeatpump,
        heatpumpKw: Number(heatpumpKw.toFixed(2)),
        includeWallbox: input.hasEv,
        wallboxKw: input.hasEv ? 11 : 0,
        capReason: 'demand sized' as const,
      },
      note: 'Stub response — sizing engine to be ported from viewer.html',
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
}
