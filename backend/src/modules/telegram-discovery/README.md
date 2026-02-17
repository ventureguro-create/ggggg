# Telegram Discovery Module

## Version: 1.0.0

## Статус: ✅ Development Ready

---

## Описание

Изолированный модуль для обнаружения и ранжирования Telegram каналов в крипто-экосистеме.

### Функционал

- **Discovery** — автоматическое обнаружение каналов через forwards и mentions
- **Metrics** — сбор и расчёт метрик (views, engagement, growth)
- **Ranking** — ежедневный рейтинг каналов по качеству и влиянию
- **Fraud Detection** — обнаружение накрутки и бот-активности

---

## Изоляция модуля

Этот модуль полностью автономен:

✅ Свои MongoDB коллекции (`tg_*`)
✅ Свой namespace API (`/api/telegram/*`)
✅ Свои background jobs
✅ Свой adapter для Telegram API

> **Критерий чистоты:** Если удалить папку `modules/telegram-discovery/`, вся система продолжит работать.

---

## Структура

```
modules/telegram-discovery/
├── index.ts                    # Entry point
├── models/                     # MongoDB models
│   ├── tg_channel.model.ts     # Каналы
│   ├── tg_post.model.ts        # Посты
│   ├── tg_metrics.model.ts     # Метрики (hourly)
│   ├── tg_rankings.model.ts    # Рейтинги (daily)
│   ├── tg_discovery_edges.model.ts  # Граф связей
│   └── tg_candidates.model.ts  # Кандидаты на добавление
├── services/
│   ├── discovery.service.ts    # Логика discovery
│   ├── metrics.service.ts      # Расчёт метрик
│   ├── ranking.service.ts      # Scoring и ranking
│   └── fraud.service.ts        # Fraud detection
├── adapter/
│   └── telegram.adapter.ts     # Telegram API wrapper
├── jobs/
│   ├── discovery.job.ts        # Автообнаружение (10 min)
│   └── metrics.job.ts          # Сбор метрик (1h)
└── routes/
    └── telegram.routes.ts      # API endpoints
```

---

## MongoDB Collections

| Коллекция | Описание |
|-----------|----------|
| `tg_channels` | Telegram каналы |
| `tg_posts` | Посты из каналов |
| `tg_metrics` | Hourly метрики |
| `tg_rankings` | Daily рейтинги |
| `tg_discovery_edges` | Граф связей (forwards/mentions) |
| `tg_candidates` | Очередь кандидатов |

---

## API Endpoints

### Health & Status

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/telegram/health` | Health check модуля |

### Channels

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/telegram/channels` | Список каналов |
| GET | `/api/telegram/channels/:channelId` | Детали канала |
| POST | `/api/telegram/channels/seed` | Добавить seed канал |
| PATCH | `/api/telegram/channels/:channelId/status` | Изменить статус |

### Discovery

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/telegram/discovery/stats` | Статистика |
| GET | `/api/telegram/discovery/candidates` | Кандидаты |
| POST | `/api/telegram/discovery/process` | Обработать кандидата |

### Rankings

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/telegram/rankings` | Текущие рейтинги |
| POST | `/api/telegram/rankings/calculate` | Пересчитать |

### Fraud Detection

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/telegram/fraud/analyze/:channelId` | Анализ канала |
| POST | `/api/telegram/fraud/update-scores` | Обновить все scores |

### Metrics

| Method | Endpoint | Описание |
|--------|----------|----------|
| GET | `/api/telegram/metrics/:channelId` | История метрик |
| POST | `/api/telegram/metrics/calculate/:channelId` | Рассчитать |

---

## Быстрый старт

### 1. Добавить seed каналы

```bash
curl -X POST http://localhost:8001/api/telegram/channels/seed \
  -H "Content-Type: application/json" \
  -d '{"username": "durov", "title": "Pavel Durov", "tags": ["crypto"]}'
```

### 2. Рассчитать рейтинги

```bash
curl -X POST http://localhost:8001/api/telegram/rankings/calculate
```

### 3. Посмотреть рейтинги

```bash
curl http://localhost:8001/api/telegram/rankings
```

---

## Environment Variables

```env
TELEGRAM_DISCOVERY_ENABLED=true      # Включить модуль
TELEGRAM_API_ID=                     # Telegram API ID (optional)
TELEGRAM_API_HASH=                   # Telegram API Hash (optional)
```

> **Mock режим:** Если API credentials не заданы, модуль работает в mock режиме с тестовыми данными.

---

## Background Jobs

| Job | Интервал | Описание |
|-----|----------|----------|
| Discovery | 10 min | Обработка кандидатов |
| Metrics | 1 hour | Сбор метрик |
| Rankings | Daily (00:00) | Расчёт рейтингов |

> Jobs запускаются автоматически, если `MINIMAL_BOOT != 1`

---

## Scoring Formula

```
overallScore = 
  qualityScore * 0.25 +
  engagementScore * 0.25 +
  growthScore * 0.20 +
  consistencyScore * 0.15 -
  fraudScore * 0.15
```

### Component Scores

- **Quality** — качество контента (NLP analysis, placeholder 60)
- **Engagement** — views/subscribers ratio
- **Growth** — динамика подписчиков
- **Consistency** — регулярность постинга
- **Fraud** — подозрительная активность (вычитается)

---

## Fraud Indicators

- `suspiciousGrowth` — аномальный рост подписчиков
- `lowEngagement` — подозрительно низкий engagement
- `irregularPosting` — нерегулярные посты
- `botLikePatterns` — паттерны бот-активности
- `suspiciousViews` — накрученные просмотры

---

## TODO (Next Steps)

1. [ ] Интеграция с реальным Telegram API (MTProto)
2. [ ] NLP анализ для quality score
3. [ ] ML модель для fraud detection
4. [ ] Ingestion постов из каналов
5. [ ] WebSocket для real-time updates

---

## Контакты

FOMO Team
