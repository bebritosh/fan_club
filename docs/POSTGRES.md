# PostgreSQL и реальные данные

## Требования
- PostgreSQL 16 или новее, служба запущена, порт 5432.
- Роль fanclub с правом CREATEDB (нужно для тестов) и база fanclub в кодировке UTF8.

Создание (один раз, из SQL Shell под пользователем postgres):

    CREATE USER fanclub WITH PASSWORD '<пароль из .env>' CREATEDB;
    CREATE DATABASE fanclub OWNER fanclub ENCODING 'UTF8';

## Переменные окружения
Настройки читаются из backend/.env (файл не коммитится). Пример без секретов:

    DB_ENGINE=postgres
    DB_NAME=fanclub
    DB_USER=fanclub
    DB_PASSWORD=<пароль>
    DB_HOST=localhost
    DB_PORT=5432
    SECRET_KEY=<случайный ключ>
    DEBUG=True

В `config/settings.py` вызов `load_dotenv(..., override=True)` означает, что значения в `backend/.env` переопределяют одноимённые переменные системы.

## Запуск (из папки backend)

    python manage.py migrate
    python manage.py import_real_data --dry-run
    python manage.py import_real_data
    python manage.py verify_real_data
    python manage.py export_imputed_fields

В Windows перед запуском выполните chcp 65001 и задайте PYTHONUTF8=1, иначе кириллица в консоли отображается как ???? .

## Данные
Файл backend/data/real_data.json: 37 клубов, 232 спортсмена, 7 видов спорта (футбол 116, баскетбол 45, хоккей 21, теннис 21, MMA 13, Формула-1 9, бокс 7). Импорт идемпотентен.

Ограничения:
- Данные собраны по памяти и требуют сверки с официальными источниками. Составы, номера, рост и вес приблизительные.
- У 113 записей height, weight, number содержат значения по умолчанию модели (рост 180, вес 75, номер 0): в данных их нет, а модель не допускает NULL. Список в backend/data/imputed_fields.csv (не коммитится), создаётся командой export_imputed_fields.
- Вид спорта клуба в базе не хранится (в модели Club нет такого поля), его нужно определять по игрокам клуба.
- У теннисистов, бойцов и боксёров клуба нет (club = NULL).

## Возврат на SQLite
Задайте DB_ENGINE=sqlite в backend/.env. Файл db.sqlite3 создаётся заново командой migrate.

## Тесты
Запуск из папки backend: pytest. Тесты создают отдельную базу test_fanclub, поэтому роли нужно право CREATEDB. Рабочая база тестами не затрагивается.

## Пользователь manager
Служебный пользователь manager создаётся с is_staff=True. Пароль задаётся отдельно и в документации не публикуется.
