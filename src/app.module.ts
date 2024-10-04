import { Module } from '@nestjs/common';

import { BotModule } from './bot/bot.module';
import { RepositoryModule } from './repository/repository.module';

@Module({
  imports: [BotModule, RepositoryModule],
})
export class AppModule {}
