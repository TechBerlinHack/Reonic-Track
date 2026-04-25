import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class InternalTokenMiddleware implements NestMiddleware {
  private readonly token = process.env.INTERNAL_TOKEN;

  use(req: Request, _res: Response, next: NextFunction) {
    if (!this.token) {
      next();
      return;
    }
    if (req.headers['x-internal-token'] !== this.token) {
      throw new UnauthorizedException('Missing or invalid internal token');
    }
    next();
  }
}
