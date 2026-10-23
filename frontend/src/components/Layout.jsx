import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { IconBell, IconCalendar, IconChartBar, IconHome, IconLogout, IconMenu2, IconSearch, IconSettings, IconTransfer, IconUsers, IconX } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import './Layout.css';

const baseNav = [
  { to: '/', label: 'Главная', icon: IconHome },
  { to: '/athletes', label: 'База спортсменов', icon: IconUsers },
  { to: '/reports', label: 'Отчёты', icon: IconChartBar },
  { to: '/events', label: 'Календарь', icon: IconCalendar },
  { to: '/transfers', label: 'Трансферы', icon: IconTransfer },
  { to: '/settings', label: 'Настройки', icon: IconSettings },
];

export function FcadLogo({ size = 26 }) {
  return <span className="fc-logo"><svg width={size + 6} height={size} viewBox="0 0 38 30" aria-hidden="true"><defs><linearGradient id="fcg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#38d0ff"/><stop offset="1" stopColor="#2d6bff"/></linearGradient></defs><path d="M6 4h26l-3 7H13l-1.5 3.5H26l-3 7H8.5L6 26H1z" fill="url(#fcg)"/><path d="M30 14h6l-6 12h-6z" fill="#22c58b" opacity=".9"/></svg><b>FCAD</b></span>;
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const nav = baseNav;
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Пользователь';
  const initials = name.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();
  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  const search = e => { e.preventDefault(); navigate(`/athletes${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`); };

  return <div className={`fc-shell ${user?.is_staff ? 'is-staff' : 'is-member'}`}>
    <aside className={`fc-sidebar ${open ? 'open' : ''}`}><div className="fc-sidebar-head"><FcadLogo/><button className="fc-close" onClick={() => setOpen(false)} aria-label="Закрыть меню"><IconX size={20}/></button></div>
      <nav className="fc-nav">{nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => `fc-link ${isActive ? 'active' : ''}`}><Icon size={19} stroke={1.7}/><span>{label}</span></NavLink>)}</nav>
      <div className="fc-sidebar-foot">FCAD · 2026</div>
    </aside>
    <div className="fc-main"><header className="fc-topbar"><button className="fc-burger" onClick={() => setOpen(true)} aria-label="Открыть меню"><IconMenu2 size={22}/></button>
      <form className="fc-search" onSubmit={search}><IconSearch size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск по имени или клубу…"/></form>
      <div className="fc-top-right"><span className="fc-date">{today}</span><button className="fc-icon-btn" onClick={() => toast('Новых уведомлений нет.')} aria-label="Уведомления"><IconBell size={18}/></button><button className="fc-icon-btn" onClick={() => { logout(); toast('Вы вышли из системы.'); }} aria-label="Выйти"><IconLogout size={18}/></button><button className="fc-avatar" onClick={() => navigate('/settings')} title={name}>{user?.avatar_url ? <img src={user.avatar_url} alt=""/> : initials}</button></div>
    </header><main className="fc-content"><Outlet/></main></div>
    {open && <button className="fc-scrim" onClick={() => setOpen(false)} aria-label="Закрыть меню"/>}
  </div>;
}
