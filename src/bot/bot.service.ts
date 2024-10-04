import { Injectable } from '@nestjs/common';
import { Ctx, Hears, Start, Update } from 'nestjs-telegraf';
import { Context } from 'telegraf';

@Update()
@Injectable()
export class BotService {
  @Start()
  async startCommand(@Ctx() ctx: Context) {
    await ctx.reply('Добро пожаловать в бот URL-Keeprt');
  }

  @Hears('hello')
  async hearsHello(@Ctx() ctx: Context) {
    await ctx.reply('Hello there! How can I help you today?');
  }
}
