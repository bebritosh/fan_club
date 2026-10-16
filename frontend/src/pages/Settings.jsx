import { useEffect, useState } from 'react';
import { IconBell, IconCheck, IconLock, IconPhoto, IconShieldCheck, IconUser } from '@tabler/icons-react';
import { changePassword, updateProfile } from '../services/api';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import './EntityPages.css';

export default function Settings() {
  const { user, setUser } = useAuth();
  const notify = useToast();
  const [saving, setSaving] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [preview, setPreview] = useState(user?.avatar_url);
  const [prefs, setPrefs] = useState(() => JSON.parse(localStorage.getItem('fc_notifications') || '{"events":true,"transfers":true,"medical":true}'));
  useEffect(() => setPreview(user?.avatar_url), [user]);

  const saveProfile = async e => {
    e.preventDefault(); setSaving(true);
    try { const profile = await updateProfile(new FormData(e.currentTarget)); setUser(profile); setPreview(profile.avatar_url); notify('Профиль успешно сохранён.'); }
    catch (err) { notify(Object.values(err.response?.data || {}).flat().join(' ') || 'Не удалось сохранить профиль.', 'error'); }
    finally { setSaving(false); }
  };
  const savePassword = async e => {
    e.preventDefault(); const form = e.currentTarget; setPwBusy(true);
    const data = Object.fromEntries(new FormData(form));
    if (data.new_password !== data.confirm_password) { notify('Новые пароли не совпадают.', 'error'); setPwBusy(false); return; }
    try { await changePassword({ old_password: data.old_password, new_password: data.new_password }); form.reset(); notify('Пароль изменён.'); }
    catch (err) { notify(Object.values(err.response?.data || {}).flat().join(' ') || 'Не удалось сменить пароль.', 'error'); }
    finally { setPwBusy(false); }
  };
  const toggle = key => setPrefs(prev => { const next = { ...prev, [key]: !prev[key] }; localStorage.setItem('fc_notifications', JSON.stringify(next)); notify('Настройки уведомлений обновлены.'); return next; });
  const selectAvatar = e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 3 * 1024 * 1024) { notify('Размер изображения должен быть меньше 3 МБ.', 'error'); e.target.value = ''; return; } setPreview(URL.createObjectURL(file)); };

  return <div className="entity-page settings-page">
    <div className="page-heading"><div><div className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО · ПЕРСОНАЛЬНЫЕ ДАННЫЕ</div><h1>Настройки</h1><p>Управляйте профилем и параметрами учётной записи.</p></div></div>
    <div className="settings-layout">
      <nav className="settings-nav"><a href="#profile"><IconUser/>Профиль</a><a href="#password"><IconLock/>Безопасность</a><a href="#notifications"><IconBell/>Уведомления</a><a href="#access"><IconShieldCheck/>Доступ</a></nav>
      <div className="settings-content">
        <section className="panel settings-section" id="profile"><div className="settings-title"><i><IconUser/></i><div><h2>Личные данные</h2><p>Информация вашего профиля менеджера.</p></div></div>
          <form onSubmit={saveProfile} className="settings-form"><div className="avatar-upload"><div className="settings-avatar">{preview ? <img src={preview} alt="Аватар профиля"/> : <span>{user?.first_name?.[0] || user?.username?.[0] || 'М'}</span>}</div><div><label className="upload-button"><IconPhoto/>Загрузить фото<input name="avatar" type="file" accept="image/png,image/jpeg,image/webp" onChange={selectAvatar}/></label><small>JPG, PNG или WebP. Не более 3 МБ.</small></div></div>
            <div className="settings-form-grid"><label>Имя<input name="first_name" defaultValue={user?.first_name || ''} required/></label><label>Фамилия<input name="last_name" defaultValue={user?.last_name || ''} required/></label><label>Email<input name="email" type="email" defaultValue={user?.email || ''} required/></label><label>Должность<input name="title" defaultValue={user?.title || 'Менеджер системы'}/></label></div><button className="button-primary" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить профиль'}</button>
          </form>
        </section>
        <section className="panel settings-section" id="password"><div className="settings-title"><i><IconLock/></i><div><h2>Смена пароля</h2><p>Используйте надёжный пароль длиной не менее 8 символов.</p></div></div>
          <form className="settings-form-grid password-form" onSubmit={savePassword}><label className="full-label">Текущий пароль<input name="old_password" type="password" required autoComplete="current-password"/></label><label>Новый пароль<input name="new_password" type="password" required minLength="8" autoComplete="new-password"/></label><label>Повторите новый пароль<input name="confirm_password" type="password" required minLength="8" autoComplete="new-password"/></label><button className="button-primary" disabled={pwBusy}>{pwBusy ? 'Обновление…' : 'Обновить пароль'}</button></form>
        </section>
        <section className="panel settings-section" id="notifications"><div className="settings-title"><i><IconBell/></i><div><h2>Уведомления</h2><p>Настройки сохраняются для этого браузера.</p></div></div>
          <div className="preference-list">{[['events','Мероприятия','Напоминания о предстоящих матчах и турнирах.'],['transfers','Трансферы','Изменения статусов переходов спортсменов.'],['medical','Медицинские статусы','Обновления по травмам и допускам.']].map(([key,title,desc])=><label className="preference-row" key={key}><span><b>{title}</b><small>{desc}</small></span><input type="checkbox" checked={Boolean(prefs[key])} onChange={()=>toggle(key)}/></label>)}</div>
        </section>
        <section className="panel settings-section" id="access"><div className="settings-title"><i><IconShieldCheck/></i><div><h2>Права доступа</h2><p>Уровень доступа в системе федерации.</p></div></div><div className="access-card"><span className="access-badge"><IconShieldCheck/>Менеджер</span><div><b>Полный доступ к рабочему пространству</b><small>Управление спортсменами, клубами, событиями и аналитикой.</small></div><IconCheck className="access-check"/></div></section>
      </div>
    </div>
  </div>;
}
