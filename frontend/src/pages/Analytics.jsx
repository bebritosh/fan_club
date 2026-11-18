import { useEffect, useMemo, useState } from 'react';
import { IconDownload } from '@tabler/icons-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { getAthletes } from '../services/api';
import { buildMetrics } from '../services/mockData';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from '../components/Avatar.jsx';
import './AnalyticsPage.css';

const TABS = ['Антропометрия', 'Состав тела', 'Физ. подготовка', 'Сравнение игроков'];
const COLORS = ['#2d7bff', '#22c58b', '#f0a04b', '#a98bf0', '#4db8ff', '#f0626b'];
const SHORT = { Нападающий: 'Нап', Полузащитник: 'ПЗ', Защитник: 'Защ', Вратарь: 'Врат' };

const tooltipStyle = {
  contentStyle: { background: '#0d1630', border: '1px solid #1c2a4a', borderRadius: 8, color: '#e8eefc', fontSize: 13 },
  itemStyle: { color: '#e8eefc' },
  labelStyle: { color: '#7d8bab' },
  cursor: { fill: 'rgba(45,123,255,.08)' },
};
const axis = { fill: '#7d8bab', fontSize: 11 };

const toList = r => (Array.isArray(r) ? r : r?.results || []);
const avg = list => (list.length ? list.reduce((s, x) => s + x, 0) / list.length : 0);
const r1 = n => Math.round(n * 10) / 10;
const num = text => parseFloat(String(text).replace(',', '.'));

function DemoTag() {
  return <span className="fc-an-demo">демо</span>;
}

function ScatterCard({ groups, height }) {
  return (
    <article className="fc-card">
      <div className="fc-card-head">
        <h2>Рост и вес</h2>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, left: -8, bottom: 14 }}>
            <CartesianGrid stroke="#1c2a4a" strokeDasharray="3 4" />
            <XAxis type="number" dataKey="x" name="Рост" unit=" см" domain={['dataMin - 5', 'dataMax + 5']} tick={axis} axisLine={false} tickLine={false} />
            <YAxis type="number" dataKey="y" name="Вес" unit=" кг" domain={['dataMin - 5', 'dataMax + 5']} tick={axis} axisLine={false} tickLine={false} />
            <ZAxis range={[70, 70]} />
            <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: '3 3' }} formatter={(v, n) => [v, n]} labelFormatter={() => ''} />
            {groups.map((g, i) => (
              <Scatter key={g.name} name={g.name} data={g.points} fill={COLORS[i % COLORS.length]} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="fc-an-legend">
        {groups.map((g, i) => (
          <span key={g.name}><i style={{ background: COLORS[i % COLORS.length] }} /> {g.name}</span>
        ))}
      </div>
    </article>
  );
}

function CompositionCard({ data, height }) {
  return (
    <article className="fc-card">
      <div className="fc-card-head">
        <h2>Состав тела (%)</h2>
        <DemoTag />
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#1c2a4a" strokeDasharray="3 4" />
            <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
            <YAxis tick={axis} axisLine={false} tickLine={false} domain={[0, 100]} />
            <Tooltip {...tooltipStyle} formatter={(v, n) => [`${v}%`, n]} />
            <Bar dataKey="muscle" name="Мышечная масса" stackId="a" fill="#2d7bff" />
            <Bar dataKey="fat" name="Жировая масса" stackId="a" fill="#22c58b" />
            <Bar dataKey="other" name="Другое" stackId="a" fill="#a98bf0" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="fc-an-legend">
        <span><i style={{ background: '#2d7bff' }} /> Мышечная масса</span>
        <span><i style={{ background: '#22c58b' }} /> Жировая масса</span>
        <span><i style={{ background: '#a98bf0' }} /> Другое</span>
      </div>
    </article>
  );
}

function DynamicsCard({ data, height }) {
  return (
    <article className="fc-card">
      <div className="fc-card-head">
        <h2>Динамика показателей</h2>
        <DemoTag />
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#1c2a4a" strokeDasharray="3 4" />
            <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
            <YAxis tick={axis} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
            <Tooltip {...tooltipStyle} cursor={false} />
            <Line type="monotone" dataKey="speed" name="Скорость" stroke="#2d7bff" strokeWidth={2.2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="endurance" name="Выносливость" stroke="#22c58b" strokeWidth={2.2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="strength" name="Сила" stroke="#f0a04b" strokeWidth={2.2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="fc-an-legend">
        <span><i style={{ background: '#2d7bff' }} /> Скорость</span>
        <span><i style={{ background: '#22c58b' }} /> Выносливость</span>
        <span><i style={{ background: '#f0a04b' }} /> Сила</span>
      </div>
    </article>
  );
}

/* ---------- Сравнение двух спортсменов ---------- */

// better: 'high' — больше лучше, 'low' — меньше лучше, null — просто сравнение
const COMPARE_ROWS = [
  { label: 'Возраст', get: (a) => a.age, better: null },
  { label: 'Рост, см', get: (a) => a.height, better: null },
  { label: 'Вес, кг', get: (a) => a.weight, better: null },
  { label: 'ИМТ', get: (a, m) => m.bmi, better: null },
  { label: 'Жировая масса, %', get: (a, m) => m.fatPct, better: 'low', demo: true },
  { label: 'Мышечная масса, кг', get: (a, m) => m.muscleMass, better: 'high', demo: true },
  { label: 'Скорость (100 м), с', get: (a, m) => num(m.indicators[0].value), better: 'low', demo: true },
  { label: 'Выносливость (YO-YO)', get: (a, m) => num(m.indicators[1].value), better: 'high', demo: true },
  { label: 'Сила (присед), кг', get: (a, m) => num(m.indicators[2].value), better: 'high', demo: true },
  { label: 'VO2 max', get: (a, m) => num(m.indicators[4].value), better: 'high', demo: true },
];

function CompareCard({ items }) {
  const [aId, setAId] = useState('');
  const [bId, setBId] = useState('');

  useEffect(() => {
    if (items.length >= 2 && (!aId || !bId)) {
      setAId(String(items[0].a.id));
      setBId(String(items[1].a.id));
    }
  }, [items]);

  const left = items.find(x => String(x.a.id) === aId);
  const right = items.find(x => String(x.a.id) === bId);

  const picker = (value, onChange) => (
    <select className="fc-select" value={value} onChange={e => onChange(e.target.value)}>
      {items.map(x => (
        <option key={x.a.id} value={x.a.id}>{x.a.name}</option>
      ))}
    </select>
  );

  const mark = (row, mine, other) => {
    if (!row.better || mine === other) return '';
    const win = row.better === 'high' ? mine > other : mine < other;
    return win ? 'win' : '';
  };

  return (
    <article className="fc-card fc-compare">
      <div className="fc-card-head">
        <h2>Сравнение спортсменов</h2>
      </div>

      <div className="fc-compare-pick">
        <div>{picker(aId, setAId)}</div>
        <span>VS</span>
        <div>{picker(bId, setBId)}</div>
      </div>

      {left && right && (
        <>
          <div className="fc-compare-heads">
            <div>
              <Avatar athlete={left.a} size={56} />
              <b>{left.a.name}</b>
              <small>{left.a.club_name} · {left.a.position}</small>
            </div>
            <div />
            <div>
              <Avatar athlete={right.a} size={56} />
              <b>{right.a.name}</b>
              <small>{right.a.club_name} · {right.a.position}</small>
            </div>
          </div>

          <table className="fc-table fc-compare-table">
            <tbody>
              {COMPARE_ROWS.map(row => {
                const l = row.get(left.a, left.m);
                const r = row.get(right.a, right.m);
                return (
                  <tr key={row.label}>
                    <td className={`val ${mark(row, l, r)}`}>{l}</td>
                    <td className="lab">{row.label}{row.demo && <DemoTag />}</td>
                    <td className={`val ${mark(row, r, l)}`}>{r}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="fc-compare-note">Зелёным выделено лучшее значение там, где можно сравнить «лучше / хуже».</p>
        </>
      )}
    </article>
  );
}

/* ---------- Страница ---------- */

export default function Analytics() {
  const notify = useToast();
  const [rows, setRows] = useState([]);
  const [sport, setSport] = useState('');
  const [tab, setTab] = useState('Антропометрия');

  useEffect(() => {
    getAthletes()
      .then(r => setRows(toList(r)))
      .catch(() => notify('Не удалось загрузить данные для аналитики.', 'error'));
  }, []);

  const sports = useMemo(() => [...new Set(rows.map(a => a.sport))].sort(), [rows]);

  // Спортсмены (с учётом фильтра) вместе с демо-показателями
  const items = useMemo(
    () => rows.filter(a => !sport || a.sport === sport).map(a => ({ a, m: buildMetrics(a) })),
    [rows, sport],
  );

  const positions = useMemo(() => [...new Set(items.map(x => x.a.position))], [items]);

  // Точки для диаграммы «рост и вес» (настоящие данные)
  const scatter = positions.map(p => ({
    name: p,
    points: items.filter(x => x.a.position === p).map(x => ({ x: x.a.height, y: x.a.weight, name: x.a.name })),
  }));

  // Средний состав тела по позициям
  const composition = positions.map(p => {
    const group = items.filter(x => x.a.position === p);
    const muscle = avg(group.map(x => (x.m.muscleMass / x.a.weight) * 100));
    const fat = avg(group.map(x => x.m.fatPct));
    return { label: SHORT[p] || p.slice(0, 4), muscle: r1(muscle), fat: r1(fat), other: r1(100 - muscle - fat) };
  });

  // Динамика: растёт по среднему изменению показателей за 6 месяцев
  const dynamics = useMemo(() => {
    const change = i => avg(items.map(x => x.m.indicators[i].change));
    const months = ['Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт'];
    return months.map((month, step) => ({
      month,
      speed: r1(100 + (change(0) * step) / 5),
      endurance: r1(100 + (change(1) * step) / 5),
      strength: r1(100 + (change(2) * step) / 5),
    }));
  }, [items]);

  const averages = [
    ['Средний рост', `${Math.round(avg(items.map(x => x.a.height)))} см`],
    ['Средний вес', `${Math.round(avg(items.map(x => x.a.weight)))} кг`],
    ['Средний ИМТ', r1(avg(items.map(x => x.m.bmi)))],
    ['Средний возраст', `${Math.round(avg(items.map(x => x.a.age)))} лет`],
  ];

  const exportCsv = () => {
    const header = ['ID', 'ФИО', 'Позиция', 'Вид спорта', 'Рост', 'Вес', 'ИМТ'];
    const body = items.map(x => [x.a.id, x.a.full_name, x.a.position, x.a.sport, x.a.height, x.a.weight, x.m.bmi]);
    const csv = '\ufeff' + [header, ...body].map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(';')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'analytics.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    notify('CSV-файл сформирован.');
  };

  return (
    <div>
      <div className="fc-page-head">
        <div>
          <h1>Аналитика</h1>
          <p>Антропометрия, состав тела и физическая подготовка спортсменов</p>
        </div>
        <div className="fc-page-actions">
          <select className="fc-select fc-an-filter" value={sport} onChange={e => setSport(e.target.value)}>
            <option value="">Все виды спорта</option>
            {sports.map(s => <option key={s}>{s}</option>)}
          </select>
          <button className="fc-btn fc-btn-ghost" onClick={exportCsv} disabled={!items.length}>
            <IconDownload size={17} /> Экспорт CSV
          </button>
        </div>
      </div>

      <div className="fc-tabs fc-an-tabs">
        {TABS.map(t => (
          <button key={t} className={`fc-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Антропометрия' && (
        <div className="fc-an-grid">
          <ScatterCard groups={scatter} height={250} />
          <CompositionCard data={composition} height={250} />
          <DynamicsCard data={dynamics} height={250} />
        </div>
      )}

      {tab === 'Состав тела' && (
        <div className="fc-an-two">
          <CompositionCard data={composition} height={340} />
          <article className="fc-card">
            <div className="fc-card-head">
              <h2>Средние значения</h2>
            </div>
            <ul className="fc-an-avg">
              {averages.map(([k, v]) => (
                <li key={k}><span>{k}</span><b>{v}</b></li>
              ))}
            </ul>
          </article>
        </div>
      )}

      {tab === 'Физ. подготовка' && (
        <div className="fc-an-two">
          <DynamicsCard data={dynamics} height={340} />
          <ScatterCard groups={scatter} height={300} />
        </div>
      )}

      {tab === 'Сравнение игроков' && <CompareCard items={items} />}
    </div>
  );
}