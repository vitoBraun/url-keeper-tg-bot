import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RepositoryService } from 'src/repository/repository.service';
import { RepositoryModule } from 'src/repository/repository.module';

import * as LocalSession from 'telegraf-session-local';

@Module({
  imports: [
    ConfigModule.forRoot(),
    RepositoryModule,
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>('TELEGRAM_BOT_TOKEN'),
        middlewares: [
          new LocalSession({ database: 'session_db.json' }).middleware(),
        ],
      }),
    }),
  ],
  providers: [BotService, RepositoryService],
})
export class BotModule {}
