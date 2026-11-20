import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { IconChartBar, IconDownload, IconHeartRateMonitor, IconUsers } from '@tabler/icons-react';
import { getAnalytics } from '../services/api';
import { useToast } from '../context/ToastContext.jsx';
import './EntityPages.css';

const palette = ['#315fd2', '#4d9cde', '#65bdad', '#a38bdf', '#e5a449'];
const asRows = value => Array.isArray(value) ? value.filter(Boolean) : [];

export default function Analytics() {
  const notify = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    getAnalytics()
      .then(payload => { if (active) setData(payload && typeof payload === 'object' ? payload : {}); })
      .catch(() => { if (active) { setError(true); notify('Не удалось загрузить отчёты.', 'error'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const clubs = useMemo(() => asRows(data?.club_performance).filter(x => x.name), [data]);
  const sports = useMemo(() => asRows(data?.sports).filter(x => x.sport && Number.isFinite(Number(x.value))), [data]);
  const injuries = useMemo(() => asRows(data?.injuries).filter(x => x.season && Number.isFinite(Number(x.injuries))), [data]);
  const totalAthletes = sports.reduce((sum, row) => sum + Number(row.value), 0);
  const totalInjuries = injuries.reduce((sum, row) => sum + Number(row.injuries), 0);
  const hasData = clubs.length || sports.length || injuries.length;

  const exportCsv = () => {
    const rows = [['Клуб', 'Победы', 'Ничьи', 'Поражения', 'Спортсмены'], ...clubs.map(x => [x.name, x.wins ?? 0, x.draws ?? 0, x.losses ?? 0, x.athletes ?? 0])];
    if (!clubs.length) { notify('Нет данных для экспорта.', 'error'); return; }
    const content = '\ufeff' + rows.map(row => row.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'fan-club-reports.csv'; link.click(); URL.revokeObjectURL(url);
    notify('Отчёт CSV скачан.');
  };

  return <div className="entity-page">
    <div className="page-heading"><div><div className="eyebrow">ОТЧЁТЫ · ДАННЫЕ ФЕДЕРАЦИИ</div><h1>Отчёты и аналитика</h1><p>Состав спортсменов, результаты клубов и медицинские статусы.</p></div><button className="button-secondary" onClick={exportCsv} disabled={!clubs.length}><IconDownload/> Скачать CSV</button></div>
    {loading ? <div className="panel reports-state" role="status">Загружаем данные отчётов…</div> : error || !hasData ? <div className="panel reports-state"><IconChartBar size={30}/><h2>Нет данных для аналитики</h2><p>{error ? 'Проверьте соединение и попробуйте обновить страницу.' : 'Когда в системе появятся данные, здесь отобразятся отчёты.'}</p></div> : <>
      <div className="analytics-kpis"><div><i><IconUsers/></i><span>Спортсменов в отчёте</span><b>{totalAthletes}</b></div><div><i><IconChartBar/></i><span>Клубов в сравнении</span><b>{clubs.length}</b></div><div><i><IconHeartRateMonitor/></i><span>Медицинских статусов</span><b>{totalInjuries}</b></div></div>
      <div className="analytics-grid">
        {clubs.length > 0 && <section className="panel analytic-panel club-performance"><div className="panel-head"><div><h2>Результативность клубов</h2><p>Сравнение побед, ничьих и поражений</p></div></div><ResponsiveContainer width="100%" height={350}><BarChart data={clubs} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}><CartesianGrid vertical={false} stroke="#29364c" strokeDasharray="4 4"/><XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} tick={{ fontSize: 12, fill: '#9aa8bd' }}/><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8798b2' }}/><Tooltip contentStyle={{ background: "#101a2d", border: "1px solid #29364c", borderRadius: 10, color: "#f4f7fb" }} itemStyle={{ color: "#f4f7fb" }} labelStyle={{ color: "#aab7ca" }}/><Legend/><Bar dataKey="wins" name="Победы" fill="#315fd2" radius={[5,5,0,0]}/><Bar dataKey="draws" name="Ничьи" fill="#65bdad" radius={[5,5,0,0]}/><Bar dataKey="losses" name="Поражения" fill="#e7a4a0" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></section>}
        {sports.length > 0 && <section className="panel analytic-panel"><div className="panel-head"><div><h2>Распределение по видам спорта</h2><p>Количество спортсменов в базе</p></div></div><div className="analytics-pie"><ResponsiveContainer width="100%" height={320}><PieChart margin={{ top: 12, right: 16, bottom: 12, left: 16 }}><Pie data={sports} dataKey="value" nameKey="sport" innerRadius={72} outerRadius={105} paddingAngle={3}>{sports.map((x, i) => <Cell key={x.sport} fill={palette[i % palette.length]}/>)}</Pie><Tooltip contentStyle={{ background: "#101a2d", border: "1px solid #29364c", borderRadius: 10, color: "#f4f7fb" }}/></PieChart></ResponsiveContainer><div className="analytics-pie-center"><b>{totalAthletes}</b><span>спортсменов</span></div></div><div className="analytics-legend">{sports.map((x, i) => <div key={x.sport}><i style={{ background: palette[i % palette.length] }}/><span>{x.sport}</span><b>{x.value}</b></div>)}</div></section>}
        {injuries.length > 0 && <section className="panel analytic-panel injury-panel"><div className="panel-head"><div><h2>Медицинские статусы по сезонам</h2><p>Количество зафиксированных травм</p></div></div><ResponsiveContainer width="100%" height={290}><BarChart data={injuries} margin={{ top: 18, right: 12, left: -12, bottom: 0 }}><CartesianGrid vertical={false} stroke="#29364c" strokeDasharray="4 4"/><XAxis dataKey="season" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9aa8bd' }}/><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8798b2' }}/><Tooltip contentStyle={{ background: "#101a2d", border: "1px solid #29364c", borderRadius: 10, color: "#f4f7fb" }} itemStyle={{ color: "#f4f7fb" }} labelStyle={{ color: "#aab7ca" }}/><Bar dataKey="injuries" name="Травмы" fill="#e5a449" radius={[6,6,0,0]} barSize={48}/></BarChart></ResponsiveContainer></section>}
      </div>
    </>}
  </div>;
}
