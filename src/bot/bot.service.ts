import { Injectable } from '@nestjs/common';
import { Ctx, Hears, On, Start, Update } from 'nestjs-telegraf';
import { RepositoryService } from 'src/repository/repository.service';

import * as crypto from 'crypto';
import { Context } from 'telegraf';

interface SessionContext extends Context {
  session: {
    action: string | null;
    currentPage: number;
  };
}

const LINKS_ON_PAGE = 5;

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
    ctx.session.currentPage = ctx.session.currentPage || 1;

    const totalLinks = await this.repositoryService.url.count();
    const links = await this.repositoryService.url.findMany({
      skip: (ctx.session.currentPage - 1) * LINKS_ON_PAGE,
      take: LINKS_ON_PAGE,
    });

    if (links.length === 0) {
      await ctx.reply('Ссылки не найдены.');
    } else {
      const formattedLinks = links
        .map(
          (link) =>
            `Короткая: ${link.shortHash} - Оригинальная: ${link.original}`,
        )
        .join('\n');
      await ctx.reply(
        `Вот ссылки на странице ${ctx.session.currentPage}:\n${formattedLinks}`,
        { disable_web_page_preview: true } as any,
      );

      const buttons = [];
      if (ctx.session.currentPage > 1) {
        buttons.push([{ text: 'Предыдущая страница' }]);
      }
      if (totalLinks > ctx.session.currentPage * LINKS_ON_PAGE) {
        buttons.push([{ text: 'Следующая страница' }]);
      }
      buttons.push([{ text: 'Назад в меню' }]); // Back to menu button

      await ctx.reply('Навигация:', {
        reply_markup: {
          keyboard: buttons,
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
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

    if (userMessage === 'Предыдущая страница') {
      ctx.session.currentPage = Math.max(1, ctx.session.currentPage - 1);
      await this.onGetListOfLinks(ctx);
      return;
    }

    if (userMessage === 'Следующая страница') {
      ctx.session.currentPage += 1;
      await this.onGetListOfLinks(ctx);
      return;
    }

    if (userMessage === 'Назад в меню') {
      ctx.session.currentPage = 1;
      await this.onStart(ctx);
      return;
    }

    switch (ctx.session.action) {
      case 'addLink':
        if (this.validateURLWithRegexp(userMessage)) {
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

            await ctx.reply(`Хэш-код вашей ссылки: ${shortHash}`);
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

  validateURLWithRegexp(url) {
    const urlPattern =
      /^(https?:\/\/)([a-zA-Z0-9-]+\.[a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})?)(\/[^\s]*)?$/;
    return urlPattern.test(url);
  }

  generateHash(url: string): string {
    return crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
  }
}
