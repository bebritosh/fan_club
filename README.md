# Fan Club — база спортсменов

Backend: Django REST Framework, SQLite, JWT. Доступ к API: `http://127.0.0.1:8000/api/`.

## Запуск

```powershell
cd backend
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py setup_roles
python manage.py seed_demo
python manage.py runserver 127.0.0.1:8000
```

Демо-вход после `seed_demo`: `manager` / `FanClub2026!`. Команда устанавливает пароль заново и назначает пользователю группу `manager` и `is_staff=True`.

Swagger: `/api/docs/`; OpenAPI schema: `/api/schema/`; проверка сервиса: `/api/health/`.

Для локальной разработки frontend должен быть на `http://localhost:5173` или `http://127.0.0.1:5173`. Другие источники задаются через `CORS_ALLOWED_ORIGINS`.

## API

Для всех маршрутов, кроме регистрации, получения/обновления JWT и health, нужен заголовок `Authorization: Bearer <access>`.

| Метод | URL | Доступ | Назначение |
| --- | --- | --- | --- |
| POST | `/auth/register/` | Публичный, если включена регистрация | Регистрация менеджера |
| POST | `/auth/token/` | Публичный | Получить JWT |
| POST | `/auth/token/refresh/` | Публичный | Обновить access JWT |
| GET, PATCH | `/auth/me/` | Вошедший пользователь | Профиль |
| POST | `/auth/password/` | Вошедший пользователь | Смена пароля |
| GET | `/health/` | Публичный | Health check |
| GET | `/dashboard/` | Вошедший пользователь | Сводные данные главной страницы |
| GET | `/analytics/` | Вошедший пользователь | Данные отчётов |
| GET | `/athletes/` | Чтение: вошедший; запись: manager, medic или staff | CRUD спортсменов; фильтры, поиск, сортировка |
| GET | `/athletes/scout/` | Вошедший пользователь | Пагинированный подбор спортсменов |
| GET | `/athletes/compare/?ids=1,2` | Вошедший пользователь | Сравнение 2–4 спортсменов |
| GET | `/athletes/birthdays/?days=30` | Вошедший пользователь | Ближайшие дни рождения |
| GET | `/athletes/{id}/valuation/` | Вошедший пользователь | Расчётная оценка спортсмена |
| GET | `/athletes/{id}/similar/` | Вошедший пользователь | До пяти похожих спортсменов |
| POST | `/athletes/import/?dry_run=true` | Manager, medic или staff | Проверка/импорт CSV |
| POST | `/athletes/bulk/` | Manager, medic или staff | Массовое изменение спортсменов |
| GET, POST, PATCH, PUT, DELETE | `/clubs/` | Чтение: вошедший; запись: manager или staff | CRUD клубов |
| GET | `/clubs/{id}/balance/?year=2026` | Вошедший пользователь | Баланс по одобренным трансферам |
| GET | `/clubs/{id}/squad/` | Вошедший пользователь | Сводка состава клуба |
| GET, POST, PATCH, PUT, DELETE | `/transfers/` | Чтение: вошедший; запись: manager или staff | CRUD трансферов и проверка переходов |
| POST | `/transfers/{id}/approve/` | Manager или staff | Одобрить ожидающий трансфер |
| POST | `/transfers/{id}/reject/` | Manager или staff | Отклонить ожидающий трансфер |
| GET, POST, PATCH, PUT, DELETE | `/events/` | Чтение: вошедший; запись: manager или staff | CRUD мероприятий |
| GET | `/events/conflicts/` | Вошедший пользователь | Конфликты клуба по дате |
| GET | `/events/calendar.ics?club=1` | Вошедший пользователь | Экспорт календаря RFC 5545 |
| GET | `/search/?q=...` | Вошедший пользователь | Поиск спортсменов, клубов и событий |
| GET | `/notifications/` | Вошедший пользователь | Уведомления по рабочим событиям |
| GET | `/quality/` | Staff | Отчёт о качестве данных |
| GET | `/audit/` | Staff | Журнал действий с фильтрами |

Старые коллекционные маршруты по умолчанию продолжают возвращать массивы. Пагинация включается при передаче `page` или `page_size`; маршрут scout всегда возвращает объект с `count`, `next`, `previous`, `results`. Ошибки API возвращаются как `{"error":{"status":400,"details":...}}`.

## Роли

Создаются командой `python manage.py setup_roles`.

| Группа | Права на запись |
| --- | --- |
| `manager` | Спортсмены, клубы, трансферы, события |
| `medic` | Спортсмены |
| `analyst` | Только чтение |
| `viewer` | Только чтение |
| `is_staff` / superuser | Полный доступ и staff-эндпоинты |

Регистрация создаёт пользователя без группы; выдача роли выполняется отдельно. Публичная регистрация включена по умолчанию.

## Настройки окружения

| Переменная | Значение по умолчанию | Назначение |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | Локальный development ключ | Секрет Django; обязателен при `DJANGO_DEBUG=false` |
| `DJANGO_DEBUG` | `true` | Режим отладки |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Разрешённые host names, через запятую |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Разрешённые frontend origins |
| `REGISTRATION_ENABLED` | `true` | Включить/выключить регистрацию |
| `MAX_SQUAD_SIZE` | `40` | Максимальный состав клуба |
| `TRANSFER_WINDOWS` | `01-01:02-28,07-01:08-31` | Окна в формате `MM-DD:MM-DD`, через запятую |
| `ATHLETE_VALUE_BASE` | `1000000` | База оценки в KZT |
| `MAX_IMPORT_BYTES` | `5242880` | Максимальный размер CSV |
| `MAX_IMPORT_ROWS` | `500` | Максимум строк импорта |

Ошибки и вывод сериализаторов нормализуют legacy mojibake в текстовых значениях. Сами модели/миграции намеренно не менялись. Значения статусов модели остаются строками; сериализатор временно принимает русское значение, английский alias и legacy-строку.

## Ограничения данных

- В моделях пока нет матчей и истории травм. Сравнение результатов клубов возвращает нулевые показатели с `is_demo: true`; травматизм по сезонам вычисляется по доступному статусу и году создания записи и также помечается `is_demo: true`.
- Оценка спортсмена справочная, не является финансовой рекомендацией.
- Пагинация старых списков запрашивается явно, чтобы не менять привычный формат массивов для существующего frontend.
