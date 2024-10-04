import { Injectable } from '@nestjs/common';
import { Ctx, Hears, On, Start, Update } from 'nestjs-telegraf';
import { RepositoryService } from 'src/repository/repository.service';

import * as crypto from 'crypto';
import { Context } from 'telegraf';

interface SessionContext extends Context {
  session: {
    action: string | null;
  };
}

@Update()
@Injectable()
export class BotService {
  constructor(private readonly repositoryService: RepositoryService) {}

  @Start()
  async onStart(@Ctx() ctx: SessionContext) {
    await ctx.reply('Добро пожаловать в бот URL-Keeper, выберите действие:', {
      reply_markup: {
        keyboard: [
          [{ text: 'Добавить ссылку' }],
          [{ text: 'Удалить ссылку' }],
          [{ text: 'Список ссылок' }],
          [{ text: 'Получить ссылку по коду' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  @Hears('Добавить ссылку')
  async onAddLink(@Ctx() ctx: SessionContext) {
    await ctx.reply('Отправьте URL, который хотите добавить.');

    ctx.session.action = 'addLink';
  }

  @Hears('Удалить ссылку')
  async onDeleteLink(@Ctx() ctx: SessionContext) {
    await ctx.reply('Отправьте короткий хэш ссылки, которую хотите удалить.');

    ctx.session.action = 'deleteLink';
  }

  @Hears('Список ссылок')
  async onGetListOfLinks(@Ctx() ctx: SessionContext) {
    const links = await this.repositoryService.url.findMany();

    if (links.length === 0) {
      await ctx.reply('Ссылки не найдены.');
    } else {
      const formattedLinks = links
        .map(
          (link) =>
            `Короткая: ${link.shortHash} - Оригинальная: ${link.original}`,
        )
        .join('\n');
      await ctx.reply(`Вот список ваших ссылок:\n${formattedLinks}`);
    }
  }

  @Hears('Получить ссылку по коду')
  async onGetLinkByHash(@Ctx() ctx: SessionContext) {
    await ctx.reply(
      'Отправьте короткий хэш-код ссылки, чтобы получиь ее оригинал',
    );

    ctx.session.action = 'getLinkByHash';
  }

  @On('text')
  async onText(@Ctx() ctx: SessionContext) {
    const userMessage = ctx.message['text'];

    switch (ctx.session.action) {
      case 'addLink':
        if (this.isValidUrl(userMessage)) {
          const shortHash = this.generateHash(userMessage);

          const existingUrl = await this.repositoryService.url.findFirst({
            where: { original: userMessage },
          });

          if (existingUrl) {
            await ctx.reply(
              `Ваша ссылка уже сохранена. Её короткий хэш: ${existingUrl.shortHash}`,
            );
          } else {
            await this.repositoryService.url.create({
              data: {
                original: userMessage,
                shortHash,
              },
            });

            await ctx.reply(`Ваша сокращённая ссылка: ${shortHash}`);
          }
        } else {
          await ctx.reply('Пожалуйста, введите правильный URL.');
        }
        break;

      case 'deleteLink':
        const urlToDelete = await this.repositoryService.url.findUnique({
          where: { shortHash: userMessage },
        });

        if (urlToDelete) {
          await this.repositoryService.url.delete({
            where: { shortHash: userMessage },
          });
          await ctx.reply('Ссылка успешно удалена.');
        } else {
          await ctx.reply(
            'Хэш не найден. Пожалуйста, предоставьте действительный короткий хэш.',
          );
        }
        break;

      case 'getLinkByHash':
        const urlEntry = await this.repositoryService.url.findUnique({
          where: { shortHash: userMessage },
        });

        if (urlEntry) {
          await ctx.reply(`Оригинальная ссылка: ${urlEntry.original}`);
        } else {
          await ctx.reply(
            'Хэш не найден. Пожалуйста, предоставьте действительный короткий хэш.',
          );
        }
        break;

      default:
        await ctx.reply('Пожалуйста, выберите действие из меню.');
    }

    ctx.session.action = null;
  }

  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  generateHash(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
  }
}
