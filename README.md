# Fan Club · База спортсменов

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

Демо вход после генерации данных: `manager` / `FanClub2026!`.

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

Vite запускается на `http://localhost:5173`. API по умолчанию доступно на `http://127.0.0.1:8000/api`.

Все API маршруты, кроме регистрации и получения JWT, требуют заголовок `Authorization: Bearer <access-token>`.
