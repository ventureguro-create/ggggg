# Connections Module - PRD

## Original Problem Statement
Развернуть модуль Connections из GitHub репозитория для дальнейшей разработки. Включает:
- Connection логика
- Twitter парсинг (без бота на данном этапе)
- Поднять парсер для дальнейшей доработки

## Architecture

### Services
| Сервис | Порт | Описание |
|--------|------|----------|
| Node.js Fastify | 8003 | Основной backend (TypeScript) |
| Python FastAPI Proxy | 8001 | API proxy для /api/* routes |
| React Frontend | 3000 | Админка + UI (craco + tailwind) |
| MongoDB | 27017 | База данных (connections_db) |

### Tech Stack
- **Backend**: Node.js 20+, Fastify 5, TypeScript, Mongoose 9
- **Frontend**: React 19, Tailwind CSS, Zustand, React Router 7
- **Database**: MongoDB (mongoose ODM)

## Core Requirements (Static)

### Connections Module Features
1. **Author/Influencer Scoring** - оценка влиятельности авторов
2. **Twitter Live Integration** - live data от Twitter
3. **Graph Analytics** - визуализация связей
4. **ML Routes** - машинное обучение для анализа
5. **Drift Detection** - обнаружение изменений
6. **Token Momentum** - анализ momentum токенов
7. **Cluster Attention** - кластерный анализ

### API Endpoints (Connections)
- `/api/connections/config` - конфигурация модуля
- `/api/connections/authors` - список авторов
- `/api/connections/unified` - унифицированные данные
- `/api/connections/graph` - граф связей
- `/api/connections/ml/*` - ML endpoints
- `/api/connections/drift/*` - drift endpoints
- `/api/connections/timeseries/*` - временные ряды

## What's Been Implemented

### Date: 2026-02-13 (Session 1)
- [x] Клонирован репозиторий из GitHub
- [x] Скопирован backend/frontend код в /app
- [x] Настроен Node.js backend с tsx для TypeScript
- [x] Создан Python proxy для маршрутизации API
- [x] Настроен supervisor для всех сервисов
- [x] Connections module зарегистрирован и работает
- [x] Frontend загружается с боковым меню Connections
- [x] Все тесты пройдены (backend 100%, frontend 95%)

### Date: 2026-02-13 (Session 2 - UI Fixes)
- [x] Reality Leaderboard: формула перенесена в tooltip, русский текст заменён на английский
- [x] Sort компонент: исправлено выравнивание иконки и текста
- [x] Influence Network: добавлена иконка в заголовок страницы
- [x] Narratives: добавлены "empty state" сообщения для пустых списков
- [x] Lifecycle Analytics: удалены сложные формулы, иконки "глаза", фиксированная ширина карточек, z-index тултипов
- [x] **Hover-анимации унифицированы**: удалены "прыгающие" эффекты (`hover:-translate-y-1`, `hover:scale`), применён единый стиль (только `hover:shadow-lg transition-shadow duration-300`)

### Disabled/Skipped
- Twitter module v4.0 отключен (конфликт routes с twitter-user)
- Telegram bot не настроен (не требуется на этом этапе)
- Twitter Parser V2 не запущен (требуется отдельная настройка)

## Prioritized Backlog

### P0 (Critical - Next)
1. [ ] Настроить Twitter Parser V2 на порту 5001
2. [ ] Seed данные в MongoDB для демо
3. [ ] Разрешить конфликт routes twitter-user vs twitter module

### P1 (High Priority)
1. [ ] Добавить данные авторов/influencers
2. [ ] Настроить egress slots для парсера
3. [ ] Интеграция с реальным Twitter API

### P2 (Medium Priority)
1. [ ] UI улучшения для Connections страниц
2. [ ] Добавить графики и визуализацию
3. [ ] Настроить WebSocket для real-time updates

### P3 (Future)
1. [ ] ML модели для scoring
2. [ ] Telegram notifications
3. [ ] Production deployment

## User Personas
1. **Admin** - управление системой, мониторинг
2. **Analyst** - анализ данных, просмотр графов
3. **Developer** - дальнейшая разработка и интеграция

## Environment Variables

### Backend (.env)
```
MONGODB_URI=mongodb://localhost:27017/connections_db
PORT=8003
MINIMAL_BOOT=1
CONNECTIONS_MODULE_ENABLED=true
WS_ENABLED=true
COOKIE_ENC_KEY=<generated>
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://narratives-hub-2.preview.emergentagent.com
WDS_SOCKET_PORT=443
```
