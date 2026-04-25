import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiController } from './api.controller';
import { InternalTokenMiddleware } from './internal-token.middleware';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [ApiController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(InternalTokenMiddleware)
      .exclude({ path: 'api/health', method: RequestMethod.GET })
      .forRoutes(ApiController);
  }
}
