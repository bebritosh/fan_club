import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IconChevronLeft, IconChevronRight, IconDownload, IconPlus } from '@tabler/icons-react';
import { getAthletes, getClubs } from '../services/api';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from '../components/Avatar.jsx';
import AddAthleteModal from '../components/AddAthleteModal.jsx';
import './AthletesList.css'; // старые стили, их ещё использует профиль спортсмена и трансферы
import './AthletesPage.css';

const EMPTY_FILTERS = {
  name: '',
  id: '',
  ageMin: '',
  ageMax: '',
  gender: 'Все',
  sport: '',
  position: '',
  heightMin: '',
  heightMax: '',
  weightMin: '',
  weightMax: '',
};

const SORTS = {
  new: { label: 'По дате добавления', fn: (a, b) => new Date(b.created_at) - new Date(a.created_at) },
  name: { label: 'По имени', fn: (a, b) => a.name.localeCompare(b.name, 'ru') },
  age: { label: 'По возрасту', fn: (a, b) => a.age - b.age },
  height: { label: 'По росту', fn: (a, b) => b.height - a.height },
};

const toList = r => (Array.isArray(r) ? r : r?.results || []);

// Для диапазона «от — до»: пустое поле значит «без ограничения»
const inRange = (value, min, max) =>
  (min === '' || value >= Number(min)) && (max === '' || value <= Number(max));

// Список номеров страниц: 1 … 4 5 6 … 12
function pageList(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const list = new Set([1, pages, page - 1, page, page + 1]);
  const sorted = [...list].filter(p => p >= 1 && p <= pages).sort((a, b) => a - b);
  const result = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('…');
    result.push(p);
  });
  return result;
}

export default function AthletesList() {
  const notify = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, name: searchParams.get('q') || '' });
  const [sort, setSort] = useState('new');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modal, setModal] = useState(false);

  const refresh = () => getAthletes().then(r => setRows(toList(r)));

  useEffect(() => {
    refresh().catch(() => notify('Не удалось загрузить спортсменов.', 'error'));
    getClubs().then(r => setClubs(toList(r))).catch(() => {});
  }, []);

  // Поиск из верхней панели (?q=...) подставляется в фильтр «Имя»
  const urlQuery = searchParams.get('q') || '';
  useEffect(() => {
    setFilters(prev => ({ ...prev, name: urlQuery }));
    setPage(1);
  }, [urlQuery]);

  const setFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const sports = useMemo(() => [...new Set(rows.map(a => a.sport))].sort(), [rows]);
  const positions = useMemo(() => [...new Set(rows.map(a => a.position))].sort(), [rows]);

  const filtered = useMemo(() => {
    const f = filters;
    const name = f.name.trim().toLowerCase();
    return rows
      .filter(a => !name || a.full_name.toLowerCase().includes(name))
      .filter(a => !f.id.trim() || String(a.id).startsWith(f.id.trim()))
      .filter(a => inRange(a.age, f.ageMin, f.ageMax))
      .filter(a => f.gender === 'Все' || a.gender === f.gender)
      .filter(a => !f.sport || a.sport === f.sport)
      .filter(a => !f.position || a.position === f.position)
      .filter(a => inRange(a.height, f.heightMin, f.heightMax))
      .filter(a => inRange(a.weight, f.weightMin, f.weightMax))
      .sort(SORTS[sort].fn);
  }, [rows, filters, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const start = (current - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  const exportCsv = () => {
    const header = ['ID', 'ФИО', 'Возраст', 'Рост', 'Вес', 'Клуб', 'Вид спорта', 'Статус'];
    const body = filtered.map(a => [a.id, a.full_name, a.age, a.height, a.weight, a.club_name, a.sport, a.status]);
    const csv =
      '\ufeff' +
      [header, ...body]
        .map(row => row.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(';'))
        .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'athletes.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    notify('CSV-файл сформирован.');
  };

  return (
    <div>
      <div className="fc-page-head">
        <div>
          <h1>База спортсменов</h1>
          <p>Найдено: {filtered.length} из {rows.length}</p>
        </div>
        <div className="fc-page-actions">
          <label className="fc-sort">
            <span>Сортировать:</span>
            <select className="fc-select" value={sort} onChange={e => setSort(e.target.value)}>
              {Object.entries(SORTS).map(([key, s]) => (
                <option key={key} value={key}>{s.label}</option>
              ))}
            </select>
          </label>
          <button className="fc-btn fc-btn-ghost" onClick={exportCsv}>
            <IconDownload size={17} /> Экспорт CSV
          </button>
          <button className="fc-btn fc-btn-primary" onClick={() => setModal(true)}>
            <IconPlus size={17} /> Добавить спортсмена
          </button>
        </div>
      </div>

      <div className="fc-ath-layout">
        {/* ---------- Панель фильтров ---------- */}
        <aside className="fc-card fc-filters">
          <div className="fc-filters-head">
            <h2>Фильтры</h2>
            <button className="fc-reset" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}>
              Сбросить
            </button>
          </div>

          <label className="fc-field">
            <span>Имя / Фамилия</span>
            <input className="fc-input" placeholder="Иванов / Алексей" value={filters.name} onChange={e => setFilter('name', e.target.value)} />
          </label>

          <label className="fc-field">
            <span>ID спортсмена</span>
            <input className="fc-input" placeholder="Например, 12" value={filters.id} onChange={e => setFilter('id', e.target.value)} />
          </label>

          <div className="fc-field">
            <span>Возраст</span>
            <div className="fc-range">
              <input className="fc-input" type="number" min="0" placeholder="от" value={filters.ageMin} onChange={e => setFilter('ageMin', e.target.value)} />
              <i>—</i>
              <input className="fc-input" type="number" min="0" placeholder="до" value={filters.ageMax} onChange={e => setFilter('ageMax', e.target.value)} />
            </div>
          </div>

          <div className="fc-field">
            <span>Пол</span>
            <div className="fc-seg">
              {[['Все', 'Все'], ['М', 'Мужской'], ['Ж', 'Женский']].map(([value, label]) => (
                <button key={value} className={filters.gender === value ? 'active' : ''} onClick={() => setFilter('gender', value)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="fc-field">
            <span>Вид спорта</span>
            <select className="fc-select" value={filters.sport} onChange={e => setFilter('sport', e.target.value)}>
              <option value="">Все виды спорта</option>
              {sports.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>

          <label className="fc-field">
            <span>Позиция</span>
            <select className="fc-select" value={filters.position} onChange={e => setFilter('position', e.target.value)}>
              <option value="">Все позиции</option>
              {positions.map(p => <option key={p}>{p}</option>)}
            </select>
          </label>

          <div className="fc-filters-sub">Физические параметры</div>

          <div className="fc-field">
            <span>Рост (см)</span>
            <div className="fc-range">
              <input className="fc-input" type="number" placeholder="от" value={filters.heightMin} onChange={e => setFilter('heightMin', e.target.value)} />
              <i>—</i>
              <input className="fc-input" type="number" placeholder="до" value={filters.heightMax} onChange={e => setFilter('heightMax', e.target.value)} />
            </div>
          </div>

          <div className="fc-field">
            <span>Вес (кг)</span>
            <div className="fc-range">
              <input className="fc-input" type="number" placeholder="от" value={filters.weightMin} onChange={e => setFilter('weightMin', e.target.value)} />
              <i>—</i>
              <input className="fc-input" type="number" placeholder="до" value={filters.weightMax} onChange={e => setFilter('weightMax', e.target.value)} />
            </div>
          </div>
        </aside>

        {/* ---------- Таблица ---------- */}
        <section className="fc-card fc-ath-table">
          <div className="fc-table-wrap">
            <table className="fc-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Имя</th>
                  <th>Возраст</th>
                  <th>Рост</th>
                  <th>Вес</th>
                  <th>Клуб</th>
                  <th>Вид спорта</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(a => (
                  <tr key={a.id} className="clickable" onClick={() => navigate(`/athletes/${a.id}`)}>
                    <td className="muted">{a.id}</td>
                    <td>
                      <span className="fc-name-cell">
                        <Avatar athlete={a} size={36} />
                        <b>{a.name}</b>
                      </span>
                    </td>
                    <td>{a.age}</td>
                    <td>{a.height}</td>
                    <td>{a.weight}</td>
                    <td>
                      <span className="fc-club-cell">
                        <i style={{ background: a.club_color }} />
                        {a.club_name}
                      </span>
                    </td>
                    <td>{a.sport}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 && <p className="fc-empty-big">По вашему запросу спортсмены не найдены.</p>}
          </div>

          <div className="fc-ath-foot">
            <span className="fc-foot-count">
              {filtered.length ? `${start + 1}–${Math.min(start + pageSize, filtered.length)}` : 0} из {filtered.length}
            </span>

            <div className="fc-pager">
              <button onClick={() => setPage(current - 1)} disabled={current === 1} aria-label="Назад">
                <IconChevronLeft size={16} />
              </button>
              {pageList(current, pages).map((p, i) =>
                p === '…' ? (
                  <span key={`gap${i}`}>…</span>
                ) : (
                  <button key={p} className={p === current ? 'current' : ''} onClick={() => setPage(p)}>
                    {p}
                  </button>
                ),
              )}
              <button onClick={() => setPage(current + 1)} disabled={current >= pages} aria-label="Вперёд">
                <IconChevronRight size={16} />
              </button>
            </div>

            <label className="fc-sort">
              <span>Показывать:</span>
              <select className="fc-select" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {[10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
        </section>
      </div>

      {modal && (
        <AddAthleteModal
          clubs={clubs}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); refresh(); }}
        />
      )}
    </div>
  );
}