# Инструкция по развёртыванию — БЦ «Маяк» Admin

Документ для DevOps-инженера. Описывает всё необходимое для переноса системы на новый продакшн.

---

## Стек

| Слой | Технология |
|---|---|
| Фронтенд | React 18 + TypeScript + Vite (SPA) |
| Бэкенд API | Vercel Serverless Functions (Node.js, папка `/api`) |
| База данных | Supabase (PostgreSQL + Auth + Storage) |
| Хостинг | Vercel |
| Email | Resend |
| AI (опционально) | OpenAI GPT-4 + Anthropic Claude |

---

## 1. Supabase (база данных)

Это главное — вся бизнес-логика хранится здесь.

### Вариант A — перенести существующую базу (рекомендуется)
Текущий Supabase-проект: `mwyflynowovlvdcnkrun.supabase.co`

Нужно:
1. Сделать дамп схемы + данных через Supabase CLI:
   ```bash
   supabase db dump --db-url "postgresql://..." -f schema.sql
   supabase db dump --db-url "postgresql://..." --data-only -f data.sql
   ```
2. Создать новый Supabase-проект
3. Накатить дамп в новый проект
4. Обновить переменные окружения (см. раздел 4)

### Вариант B — новый Supabase-проект с нуля
Потребуется вручную воссоздать все таблицы. Список основных таблиц:

- `tenants` — арендаторы
- `units` — помещения/офисы
- `contracts` — договоры аренды
- `invoices` — счета
- `payments` — платежи
- `bank_transactions` — банковские транзакции
- `staff` — сотрудники
- `repairs` — заявки на ремонт
- `meter_readings` — показания счётчиков
- `inventory` — склад (товары)
- `inventory_categories` — категории склада
- `inventory_movements` — движение товаров
- `tenant_portal_access` — доступы арендаторов в портал
- `site_leads` — заявки с публичного сайта
- `letters` — письма арендаторам
- `counterparties` — контрагенты
- `tasks` — задачи
- `billing_items` — позиции биллинга
- `heat_readings` — показания тепла
- `documents` — документы

Для каждой таблицы потребуется настроить **Row Level Security (RLS)** политики.

---

## 2. Vercel (хостинг + API)

### Настройка проекта
1. Создать новый проект на [vercel.com](https://vercel.com)
2. Подключить репозиторий: `github.com/fzotov/mayak`
3. Framework Preset: **Vite**
4. Build Command: `pnpm run build`
5. Output Directory: `dist`
6. Install Command: `pnpm install`

### Serverless Functions
Все файлы из папки `/api` автоматически становятся Vercel Functions.
Среда выполнения: **Node.js 18+**

Текущий `vercel.json`:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## 3. Resend (email-рассылка)

Используется для:
- Отправки инвайтов арендаторам (регистрация в портале)
- Сброса пароля арендаторов
- Писем арендаторам

### Что нужно:
1. Аккаунт на [resend.com](https://resend.com)
2. Добавить и верифицировать домен `mayak-d.ru`
3. Получить API-ключ
4. Настроить DNS-записи для домена (SPF, DKIM, DMARC)

Отправка идёт от имени: `noreply@mayak-d.ru`

---

## 4. Переменные окружения (Environment Variables)

Нужно прописать в Vercel → Project Settings → Environment Variables:

| Переменная | Где взять | Описание |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API | URL проекта Supabase |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API | Публичный anon-ключ |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API | Секретный service_role ключ |
| `RESEND_API_KEY` | resend.com → API Keys | Ключ для отправки email |
| `OPENAI_API_KEY` | platform.openai.com | Для AI-функций (распознавание счетов, чат) |
| `ANTHROPIC_API_KEY` | console.anthropic.com | Для AI-функций (альтернативный AI) |

> ⚠️ `VITE_*` переменные встраиваются в сборку фронтенда и видны в браузере — только публичные ключи.
> Остальные переменные доступны только на стороне сервера (Vercel Functions).

---

## 5. Домен

1. В Vercel → Project → Domains добавить нужный домен
2. Настроить DNS у регистратора домена (A-запись или CNAME на Vercel)
3. Обновить в коде ссылку на прод-URL (сейчас `mayak-xi.vercel.app`):
   - В `api/request-password-reset.js` — ссылка в письме сброса пароля
   - В `api/send-tenant-invite.js` — ссылка в инвайте арендатора

---

## 6. Репозиторий

- GitHub: `https://github.com/fzotov/mayak`
- Ветка для деплоя: `main`

Vercel автоматически деплоит при каждом push в `main`.

---

## 7. Порядок развёртывания (чек-лист)

- [ ] Создать новый Supabase-проект
- [ ] Перенести базу данных (дамп + восстановление)
- [ ] Зарегистрироваться на Resend, добавить домен `mayak-d.ru`
- [ ] Создать Vercel-проект, подключить GitHub-репо
- [ ] Прописать все переменные окружения в Vercel
- [ ] Добавить домен в Vercel
- [ ] Обновить прод-URL в двух файлах API (см. п.5)
- [ ] Задеплоить (push в main или вручную через Vercel CLI)
- [ ] Проверить: вход в админку, вход в портал арендатора, отправку email

---

## 8. Локальная разработка

```bash
# Установить зависимости
pnpm install

# Запустить dev-сервер
pnpm run dev
# Открыть http://localhost:5173
```

Файл с переменными для локальной разработки: `.env.local` (не в git).

---

## Контакты по проекту

Репозиторий: `github.com/fzotov/mayak`  
Текущий прод: `mayak-xi.vercel.app`  
Текущая БД: `mwyflynowovlvdcnkrun.supabase.co`
