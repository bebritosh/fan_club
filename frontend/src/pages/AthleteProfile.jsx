import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IconArrowLeft, IconArrowUpRight, IconPencil, IconTrash, IconTrophy } from '@tabler/icons-react';
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { deleteAthlete, getAthlete, getClubs } from '../services/api';
import { buildMetrics } from '../services/mockData';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from '../components/Avatar.jsx';
import BodySilhouette from '../components/BodySilhouette.jsx';
import EditAthleteModal from '../components/EditAthleteModal.jsx';
import './ProfilePage.css';

const TABS = ['Обзор', 'Антропометрия', 'Состав тела', 'Физ. подготовка', 'Травмы', 'Трансферы', 'История'];

// Пока показываем метку «демо» у блоков с тестовыми данными. Поставь false, чтобы убрать.
const SHOW_DEMO_BADGE = true;

const STATUS_BADGE = {
  'Активен': 'fc-badge-green',
  'Травма': 'fc-badge-orange',
  'Дисквалификация': 'fc-badge-red',
  'Завершил карьеру': 'fc-badge-blue',
};

const tooltipStyle = {
  contentStyle: { background: '#0d1630', border: '1px solid #1c2a4a', borderRadius: 8, color: '#e8eefc', fontSize: 13 },
  itemStyle: { color: '#e8eefc' },
  labelStyle: { color: '#7d8bab' },
};

const formatDate = iso =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

/* ---------- Карточки ---------- */

function DemoTag() {
  return SHOW_DEMO_BADGE ? <span className="fc-demo">демо</span> : null;
}

function AnthropometryCard({ a, m }) {
  const rows = [
    ['Рост', `${a.height} см`],
    ['Вес', `${a.weight} кг`],
    ['ИМТ', m.bmi],
    ['Размах рук', `${m.armSpan} см`],
    ['Длина ноги', `${m.legLength} см`],
  ];
  return (
    <article className="fc-card">
      <div className="fc-card-head">
        <h2>Антропометрические данные</h2>
        <DemoTag />
      </div>
      <div className="fc-anthro">
        <BodySilhouette height={250} />
        <dl className="fc-anthro-list">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}

function CompositionCard({ m, tall }) {
  const donut = [
    { name: 'Жировая масса', value: m.fatPct, color: '#22c58b' },
    { name: 'Остальное', value: 100 - m.fatPct, color: '#2d7bff' },
  ];
  return (
    <article className="fc-card">
      <div className="fc-card-head">
        <h2>Состав тела</h2>
        <DemoTag />
      </div>

      <div className="fc-comp">
        <div className="fc-comp-donut">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={donut} dataKey="value" innerRadius={44} outerRadius={60} startAngle={90} endAngle={-270} stroke="none">
                {donut.map(d => <Cell key={d.name} fill={d.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="fc-comp-center">
            <b>{m.fatPct}%</b>
            <span>Жир. масса</span>
          </div>
        </div>

        <ul className="fc-comp-list">
          <li><span>Мышечная масса</span><b>{m.muscleMass} кг</b></li>
          <li><span>Жировая масса</span><b>{m.fatMass} кг</b></li>
          <li><span>Вода</span><b>{m.water}%</b></li>
        </ul>
      </div>

      <div className={`fc-trend ${tall ? 'tall' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={m.trend} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#1c2a4a" strokeDasharray="3 4" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#7d8bab', fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#7d8bab', fontSize: 11 }} domain={['auto', 'auto']} />
            <Tooltip {...tooltipStyle} formatter={(v, n) => [`${v} кг`, n]} />
            <Line type="monotone" dataKey="muscle" name="Мышечная масса" stroke="#2d7bff" strokeWidth={2.2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="fat" name="Жировая масса" stroke="#22c58b" strokeWidth={2.2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="fc-trend-legend">
        <span><i style={{ background: '#2d7bff' }} /> Мышечная масса</span>
        <span><i style={{ background: '#22c58b' }} /> Жировая масса</span>
      </div>
    </article>
  );
}

function DynamicsCard({ m }) {
  return (
    <article className="fc-card">
      <div className="fc-card-head">
        <h2>Динамика показателей</h2>
        <DemoTag />
      </div>
      <ul className="fc-dyn">
        {m.indicators.map(row => (
          <li key={row.label}>
            <span>{row.label}</span>
            <b>{row.value}</b>
            <em>
              <IconArrowUpRight size={14} /> {row.change}%
            </em>
          </li>
        ))}
      </ul>
    </article>
  );
}

/* ---------- Страница ---------- */

export default function AthleteProfile() {
  const { id } = useParams();
  const notify = useToast();
  const navigate = useNavigate();

  const [a, setA] = useState(null);
  const [clubs, setClubs] = useState([]);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState('Обзор');
  const [editing, setEditing] = useState(false);

  const refresh = () => getAthlete(id).then(setA).catch(() => setError(true));

  useEffect(() => {
    refresh();
    getClubs().then(r => setClubs(Array.isArray(r) ? r : r.results || [])).catch(() => {});
  }, [id]);

  const metrics = useMemo(() => (a ? buildMetrics(a) : null), [a]);

  const remove = async () => {
    if (!window.confirm(`Удалить карточку ${a.full_name}?`)) return;
    try {
      await deleteAthlete(a.id);
      notify('Карточка спортсмена удалена.');
      navigate('/athletes');
    } catch {
      notify('Не удалось удалить запись.', 'error');
    }
  };

  if (error) {
    return (
      <div className="fc-card fc-prof-msg">
        <h2>Спортсмен не найден</h2>
        <Link className="fc-more" to="/athletes">Вернуться к базе</Link>
      </div>
    );
  }
  if (!a) return <div className="fc-prof-msg">Загружаем карточку спортсмена…</div>;

  const stats = [
    ['Возраст', `${a.age} лет`, new Date(`${a.birth_date}T00:00:00`).toLocaleDateString('ru-RU')],
    ['Рост', `${a.height} см`, null],
    ['Вес', `${a.weight} кг`, null],
    ['Позиция', a.position, `№ ${a.number}`],
  ];

  return (
    <div>
      <Link to="/athletes" className="fc-back">
        <IconArrowLeft size={17} /> Назад
      </Link>

      {/* Шапка профиля */}
      <section className="fc-card fc-prof-head">
        <div className="fc-prof-person">
          <Avatar athlete={a} size={84} />
          <div>
            <h1>{a.name}</h1>
            <div className="fc-prof-chips">
              <span className="fc-chip">ID: {a.id}</span>
              <span className="fc-chip">
                <i style={{ background: a.club_color }} /> {a.club_name}
              </span>
              <span className="fc-chip">{a.sport}</span>
              <span className={`fc-badge ${STATUS_BADGE[a.status] || 'fc-badge-blue'}`}>{a.status}</span>
            </div>
          </div>
        </div>

        <div className="fc-prof-stats">
          {stats.map(([label, value, sub]) => (
            <div key={label}>
              <span>{label}</span>
              <b>{value}</b>
              {sub && <small>{sub}</small>}
            </div>
          ))}
        </div>

        <div className="fc-prof-actions">
          <button className="fc-btn fc-btn-ghost" onClick={() => setEditing(true)}>
            <IconPencil size={16} /> Редактировать
          </button>
          <button className="fc-btn fc-btn-ghost danger" onClick={remove} aria-label="Удалить">
            <IconTrash size={16} />
          </button>
        </div>
      </section>

      {/* Вкладки */}
      <div className="fc-tabs fc-prof-tabs">
        {TABS.map(t => (
          <button key={t} className={`fc-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Обзор' && (
        <div className="fc-overview">
          <AnthropometryCard a={a} m={metrics} />
          <CompositionCard m={metrics} />
          <DynamicsCard m={metrics} />
        </div>
      )}

      {tab === 'Антропометрия' && (
        <div className="fc-two">
          <AnthropometryCard a={a} m={metrics} />
        </div>
      )}

      {tab === 'Состав тела' && <CompositionCard m={metrics} tall />}

      {tab === 'Физ. подготовка' && (
        <div className="fc-two">
          <DynamicsCard m={metrics} />
        </div>
      )}

      {tab === 'Травмы' && (
        <section className="fc-card">
          <div className="fc-card-head">
            <h2>Медицинская карта</h2>
            <span className={`fc-badge ${a.status === 'Травма' ? 'fc-badge-orange' : 'fc-badge-green'}`}>
              {a.status === 'Травма' ? 'Требует внимания' : 'Допущен к соревнованиям'}
            </span>
          </div>
          <p className="fc-text">{a.medical || a.medical_notes || 'Медицинские данные не заполнены.'}</p>
        </section>
      )}

      {tab === 'Трансферы' && (
        <section className="fc-card">
          <div className="fc-card-head">
            <h2>История трансферов</h2>
            <Link className="fc-more" to="/transfers">Все трансферы</Link>
          </div>
          {a.transfers?.length ? (
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr><th>Дата</th><th>Откуда</th><th>Куда</th><th>Тип</th></tr>
                </thead>
                <tbody>
                  {a.transfers.map((t, i) => (
                    <tr key={t.id || i}>
                      <td className="muted">{formatDate(t.date)}</td>
                      <td>{t.from || 'Свободный агент'}</td>
                      <td>{t.to || 'Клуб не указан'}</td>
                      <td>{t.type || t.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="fc-text">История переходов ещё не добавлена.</p>
          )}
        </section>
      )}

      {tab === 'История' && (
        <section className="fc-card">
          <div className="fc-card-head">
            <h2>Достижения и награды</h2>
          </div>
          <ul className="fc-awards">
            {(a.achievements || []).map((x, i) => (
              <li key={i}>
                <IconTrophy size={19} />
                <b>{x}</b>
              </li>
            ))}
          </ul>
          {!a.achievements?.length && <p className="fc-text">Достижения пока не добавлены.</p>}
        </section>
      )}

      {editing && (
        <EditAthleteModal
          athlete={a}
          clubs={clubs}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); refresh(); }}
        />
      )}
    </div>
  );
}