import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { FcadLogo } from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import './AuthPage.css';

const EMPTY_FORM = {
  username: '',
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  password_confirm: '',
};

const STATS = [
  { value: '232', label: 'Спортсмена в базе' },
  { value: '37', label: 'Клубов и академий' },
  { value: '7', label: 'Видов спорта' },
];

export default function AuthPage() {
  const { user, login, register } = useAuth();
  const notify = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  if (user) return <Navigate to="/" replace />;

  const isLogin = mode === 'login';

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);

    try {
      if (isLogin) {
        await login({ username: form.username, password: form.password });
      } else {
        await register(form);
      }

      notify(isLogin ? 'Вы вошли в систему.' : 'Аккаунт создан. Добро пожаловать!');
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      const message = Object.values(err.response?.data || {})
        .flat()
        .join(' ');
      notify(message || 'Не удалось войти. Проверьте данные.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="au-screen">
      <section className="au-hero">
        <FcadLogo size={30} />

        <div className="au-hero-body">
          <h1>
            Платформа спортивной аналитики и база данных спортсменов
          </h1>
          <p className="au-slogan">Данные. Аналитика. Развитие.</p>
          <p className="au-text">
            FCAD — современная платформа для анализа спортивных данных,
            управления базой спортсменов и принятия решений на основе точной
            информации.
          </p>
        </div>

        <div className="au-stats">
          {STATS.map((item) => (
            <div key={item.label}>
              <b>{item.value}</b>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <main className="au-side">
        <form className="au-card" onSubmit={submit}>
          <div className="au-card-logo">
            <FcadLogo size={26} />
          </div>

          <h2>{isLogin ? 'С возвращением' : 'Создайте аккаунт'}</h2>
          <p className="au-sub">
            {isLogin
              ? 'Войдите, чтобы продолжить работу с системой.'
              : 'Зарегистрируйтесь, чтобы получить доступ к платформе.'}
          </p>

          {!isLogin && (
            <div className="au-row">
              <label>
                Имя
                <input
                  name="first_name"
                  value={form.first_name}
                  onChange={change}
                  placeholder="Алия"
                  required
                />
              </label>
              <label>
                Фамилия
                <input
                  name="last_name"
                  value={form.last_name}
                  onChange={change}
                  placeholder="Мухамедова"
                  required
                />
              </label>
            </div>
          )}

          <label>
            Имя пользователя
            <input
              name="username"
              value={form.username}
              onChange={change}
              autoComplete="username"
              placeholder="Введите имя пользователя"
              required
            />
          </label>

          {!isLogin && (
            <label>
              Email
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={change}
                placeholder="name@federation.kz"
                required
              />
            </label>
          )}

          <label>
            Пароль
            <div className="au-password">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={change}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                placeholder="Не менее 8 символов"
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
              </button>
            </div>
          </label>

          {!isLogin && (
            <label>
              Повторите пароль
              <input
                type="password"
                name="password_confirm"
                value={form.password_confirm}
                onChange={change}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
          )}

          <button className="au-submit" disabled={busy}>
            {busy ? 'Подождите…' : isLogin ? 'Войти в систему' : 'Создать аккаунт'}
          </button>

          <div className="au-switch">
            {isLogin ? 'Впервые в системе?' : 'Уже есть аккаунт?'}{' '}
            <button type="button" onClick={() => setMode(isLogin ? 'register' : 'login')}>
              {isLogin ? 'Создать аккаунт' : 'Войти'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}