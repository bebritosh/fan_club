import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconChevronRight } from '@tabler/icons-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getAthletes, getDashboard, getTransfers } from '../services/api';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from '../components/Avatar.jsx';
import './DashboardPage.css';

const SPORT_COLORS = ['#2d7bff', '#22c58b', '#f0a04b', '#a98bf0', '#4db8ff', '#f0626b'];

const MONTHS = {
  Jan: 'Янв', Feb: 'Фев', Mar: 'Мар', Apr: 'Апр', May: 'Май', Jun: 'Июн',
  Jul: 'Июл', Aug: 'Авг', Sep: 'Сен', Oct: 'Окт', Nov: 'Ноя', Dec: 'Дек',
};

const tooltipStyle = {
  contentStyle: {
    background: '#0d1630',
    border: '1px solid #1c2a4a',
    borderRadius: 8,
    color: '#e8eefc',
    fontSize: 13,
  },
  itemStyle: { color: '#e8eefc' },
  labelStyle: { color: '#7d8bab' },
};

const fmt = n => Number(n || 0).toLocaleString('ru-RU');
const ruMonth = m => MONTHS[String(m).slice(0, 3)] || m;
const toList = r => (Array.isArray(r) ? r : r?.results || []);

export default function Dashboard() {
  const notify = useToast();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [transfers, setTransfers] = useState([]);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(() => notify('Не удалось загрузить сводку. Проверьте соединение.', 'error'));
    getAthletes().then(r => setAthletes(toList(r))).catch(() => {});
    getTransfers().then(setTransfers).catch(() => {});
  }, []);

  const metrics = data?.metrics || {};
  const total = metrics.athletes ?? 0;
  const registrations = data?.registrations || [];

  // Рост базы: считаем нарастающим итогом от текущего количества назад
  const growth = useMemo(() => {
    const added = registrations.reduce((sum, r) => sum + r.athletes, 0);
    let running = total - added;
    return registrations.map(r => {
      running += r.athletes;
      return { month: ruMonth(r.month), total: running };
    });
  }, [registrations, total]);

  const lastMonth = registrations.at(-1)?.athletes ?? 0;
  const prevMonth = registrations.at(-2)?.athletes ?? 0;
  const monthChange = prevMonth > 0 ? Math.round(((lastMonth - prevMonth) / prevMonth) * 100) : null;

  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentTransfers = transfers.filter(t => new Date(t.date).getTime() >= monthAgo).length;

  const sports = (data?.sports || []).map((s, i) => ({
    name: s.sport,
    value: s.value,
    percent: total ? Math.round((s.value / total) * 100) : 0,
    color: SPORT_COLORS[i % SPORT_COLORS.length],
  }));

  const latest = [...athletes]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 4);

  const stats = [
    {
      label: 'Всего спортсменов',
      value: fmt(total),
      note: `+${fmt(registrations.reduce((s, r) => s + r.athletes, 0))} за 6 месяцев`,
    },
    {
      label: 'Новые записи',
      value: fmt(lastMonth),
      note: monthChange === null ? 'за месяц' : `${monthChange >= 0 ? '+' : ''}${monthChange}% к прошлому месяцу`,
      down: monthChange !== null && monthChange < 0,
    },
    {
      label: 'Трансферы',
      value: fmt(transfers.length),
      note: `+${fmt(recentTransfers)} за месяц`,
    },
    {
      label: 'Активные клубы',
      value: fmt(metrics.clubs),
      note: 'в каталоге федерации',
      neutral: true,
    },
  ];

  const name = user?.first_name || user?.username || '';

  return (
    <div className="fc-dash">
      <div className="fc-page-head">
        <div>
          <h1>Обзор</h1>
          <p>Добро пожаловать{name ? `, ${name}` : ''}!</p>
        </div>
      </div>

      <section className="fc-stats">
        {stats.map(s => (
          <div className="fc-card fc-stat" key={s.label}>
            <span className="fc-stat-label">{s.label}</span>
            <b className="fc-stat-value">{s.value}</b>
            <span className={`fc-stat-note ${s.neutral ? 'neutral' : s.down ? 'down' : ''}`}>{s.note}</span>
          </div>
        ))}
      </section>

      <section className="fc-dash-grid">
        <article className="fc-card">
          <div className="fc-card-head">
            <h2>Динамика роста базы спортсменов</h2>
          </div>
          <div className="fc-growth">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growth} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2d7bff" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2d7bff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#1c2a4a" strokeDasharray="3 4" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#7d8bab', fontSize: 12 }} dy={8} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#7d8bab', fontSize: 12 }}
                  allowDecimals={false}
                  domain={['dataMin - 4', 'dataMax + 4']}
                />
                <Tooltip {...tooltipStyle} formatter={v => [fmt(v), 'Спортсменов']} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#2d7bff"
                  strokeWidth={2.5}
                  fill="url(#growthFill)"
                  dot={{ r: 3.5, fill: '#2d7bff', stroke: '#0d1630', strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="fc-card">
          <div className="fc-card-head">
            <h2>Распределение по видам спорта</h2>
          </div>
          <div className="fc-donut-wrap">
            <div className="fc-donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sports}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={86}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {sports.map(s => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v, n) => [`${v} спортсменов`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="fc-donut-center">
                <b>{fmt(total)}</b>
                <span>спортсменов</span>
              </div>
            </div>

            <ul className="fc-legend">
              {sports.map(s => (
                <li key={s.name}>
                  <i style={{ background: s.color }} />
                  <span>{s.name}</span>
                  <b>{s.percent}%</b>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </section>

      <section className="fc-card fc-recent">
        <div className="fc-card-head">
          <h2>Последние добавленные спортсмены</h2>
          <Link className="fc-more" to="/athletes">
            Смотреть всех <IconChevronRight size={16} />
          </Link>
        </div>
        <div className="fc-recent-grid">
          {latest.map(a => (
            <Link className="fc-recent-card" key={a.id} to={`/athletes/${a.id}`}>
              <Avatar athlete={a} size={48} />
              <div className="fc-recent-info">
                <b>{a.name}</b>
                <span>{a.club_name}</span>
                <span>{a.sport}</span>
                <small>ID: {a.id}</small>
              </div>
            </Link>
          ))}
          {latest.length === 0 && <p className="fc-empty">Пока нет добавленных спортсменов.</p>}
        </div>
      </section>
    </div>
  );
}