import { useEffect, useState } from 'react';
import {
  IconBell,
  IconCheck,
  IconLock,
  IconPhoto,
  IconShieldCheck,
  IconUser,
} from '@tabler/icons-react';
import { changePassword, updateProfile } from '../services/api';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import './SettingsPage.css';

const TABS = [
  { id: 'profile', label: 'Профиль', icon: IconUser },
  { id: 'security', label: 'Безопасность', icon: IconLock },
  { id: 'notifications', label: 'Уведомления', icon: IconBell },
  { id: 'access', label: 'Доступ', icon: IconShieldCheck },
];

const NOTIFICATIONS = [
  {
    key: 'events',
    title: 'Мероприятия',
    text: 'Напоминания о предстоящих матчах и турнирах.',
  },
  {
    key: 'transfers',
    title: 'Трансферы',
    text: 'Изменения статусов переходов спортсменов.',
  },
  {
    key: 'medical',
    title: 'Медицинские статусы',
    text: 'Обновления по травмам и допускам.',
  },
];

const DEFAULT_PREFS = { events: true, transfers: true, medical: true };

const readPrefs = () => {
  try {
    return JSON.parse(localStorage.getItem('fc_notifications')) || DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
};

const errorText = (err, fallback) =>
  Object.values(err.response?.data || {})
    .flat()
    .join(' ') || fallback;

export default function Settings() {
  const { user, setUser } = useAuth();
  const notify = useToast();

  const [tab, setTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [preview, setPreview] = useState(user?.avatar_url);
  const [prefs, setPrefs] = useState(readPrefs);

  useEffect(() => {
    setPreview(user?.avatar_url);
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const profile = await updateProfile(new FormData(e.currentTarget));
      setUser(profile);
      setPreview(profile.avatar_url);
      notify('Профиль успешно сохранён.');
    } catch (err) {
      notify(errorText(err, 'Не удалось сохранить профиль.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    if (data.new_password !== data.confirm_password) {
      notify('Новые пароли не совпадают.', 'error');
      return;
    }

    setPasswordBusy(true);

    try {
      await changePassword({
        old_password: data.old_password,
        new_password: data.new_password,
      });
      form.reset();
      notify('Пароль изменён.');
    } catch (err) {
      notify(errorText(err, 'Не удалось сменить пароль.'), 'error');
    } finally {
      setPasswordBusy(false);
    }
  };

  const toggle = (key) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    localStorage.setItem('fc_notifications', JSON.stringify(next));
    notify('Настройки уведомлений обновлены.');
  };

  const selectAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      notify('Размер изображения должен быть меньше 3 МБ.', 'error');
      e.target.value = '';
      return;
    }

    setPreview(URL.createObjectURL(file));
  };

  const letter = user?.first_name?.[0] || user?.username?.[0] || 'М';

  return (
    <div className="st-page">
      <div className="st-head">
        <h1>Настройки</h1>
        <p>Управляйте профилем и параметрами учётной записи.</p>
      </div>

      <div className="st-layout">
        <nav className="st-tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? 'on' : ''}
              onClick={() => setTab(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <section className="st-card">
          {tab === 'profile' && (
            <form onSubmit={saveProfile}>
              <h2>Личные данные</h2>
              <p className="st-sub">Информация вашего профиля менеджера.</p>

              <div className="st-avatar-row">
                <div className="st-avatar">
                  {preview ? <img src={preview} alt="Аватар" /> : <span>{letter}</span>}
                </div>
                <div>
                  <label className="st-upload">
                    <IconPhoto size={16} />
                    Загрузить фото
                    <input
                      name="avatar"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={selectAvatar}
                    />
                  </label>
                  <small>JPG, PNG или WebP. Не более 3 МБ.</small>
                </div>
              </div>

              <div className="st-grid">
                <label>
                  Имя
                  <input
                    name="first_name"
                    defaultValue={user?.first_name || ''}
                    required
                  />
                </label>
                <label>
                  Фамилия
                  <input
                    name="last_name"
                    defaultValue={user?.last_name || ''}
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    defaultValue={user?.email || ''}
                    required
                  />
                </label>
                <label>
                  Должность
                  <input
                    name="title"
                    defaultValue={user?.title || 'Менеджер системы'}
                  />
                </label>
              </div>

              <button className="st-primary" disabled={saving}>
                {saving ? 'Сохранение…' : 'Сохранить профиль'}
              </button>
            </form>
          )}

          {tab === 'security' && (
            <form onSubmit={savePassword}>
              <h2>Смена пароля</h2>
              <p className="st-sub">
                Используйте надёжный пароль длиной не менее 8 символов.
              </p>

              <div className="st-grid">
                <label className="wide">
                  Текущий пароль
                  <input
                    name="old_password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <label>
                  Новый пароль
                  <input
                    name="new_password"
                    type="password"
                    minLength="8"
                    autoComplete="new-password"
                    required
                  />
                </label>
                <label>
                  Повторите новый пароль
                  <input
                    name="confirm_password"
                    type="password"
                    minLength="8"
                    autoComplete="new-password"
                    required
                  />
                </label>
              </div>

              <button className="st-primary" disabled={passwordBusy}>
                {passwordBusy ? 'Обновление…' : 'Обновить пароль'}
              </button>
            </form>
          )}

          {tab === 'notifications' && (
            <div>
              <h2>Уведомления</h2>
              <p className="st-sub">Настройки сохраняются для этого браузера.</p>

              <div className="st-prefs">
                {NOTIFICATIONS.map((item) => (
                  <div key={item.key} className="st-pref">
                    <div>
                      <b>{item.title}</b>
                      <small>{item.text}</small>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(prefs[item.key])}
                      className={`st-switch ${prefs[item.key] ? 'on' : ''}`}
                      onClick={() => toggle(item.key)}
                    >
                      <i />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'access' && (
            <div>
              <h2>Права доступа</h2>
              <p className="st-sub">Уровень доступа в системе федерации.</p>

              <div className="st-access">
                <span className="st-role">
                  <IconShieldCheck size={16} />
                  Менеджер
                </span>
                <div>
                  <b>Полный доступ к рабочему пространству</b>
                  <small>
                    Управление спортсменами, клубами, событиями и аналитикой.
                  </small>
                </div>
                <IconCheck size={22} className="st-check" />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}