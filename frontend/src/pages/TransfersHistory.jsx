import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconArrowRight,
  IconCheck,
  IconClock,
  IconSearch,
  IconTransfer,
} from '@tabler/icons-react';
import { getTransfers, updateTransfer } from '../services/api';
import { useToast } from '../context/ToastContext.jsx';
import './TransfersPage.css';

const FILTERS = ['Все переходы', 'Одобрен', 'В процессе'];

const initials = (name = '') =>
  name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const formatDate = (d) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export default function TransfersHistory() {
  const notify = useToast();
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('Все переходы');
  const [query, setQuery] = useState('');

  const refresh = () => getTransfers().then(setRows);

  useEffect(() => {
    refresh().catch(() => notify('Не удалось загрузить трансферы.', 'error'));
  }, []);

  const count = (status) =>
    status === 'Все переходы'
      ? rows.length
      : rows.filter((r) => r.status === status).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === 'Все переходы' || r.status === filter) &&
        (!q ||
          [r.athlete_name, r.from, r.to]
            .join(' ')
            .toLowerCase()
            .includes(q))
    );
  }, [rows, filter, query]);

  const totalAmount = rows
    .filter((r) => r.status === 'Одобрен')
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  const approve = async (row) => {
    try {
      await updateTransfer(row.id, { status: 'Одобрен' });
      await refresh();
      notify('Переход одобрен.');
    } catch {
      notify('Не удалось обновить статус перехода.', 'error');
    }
  };

  return (
    <div className="tr-page">
      <div className="tr-head">
        <div>
          <h1>История трансферов</h1>
          <p>Отслеживайте перемещения спортсменов и согласования.</p>
        </div>
      </div>

      <div className="tr-stats">
        <div className="tr-stat">
          <span className="tr-stat-icon blue"><IconTransfer size={20} /></span>
          <div>
            <small>Всего переходов</small>
            <b>{rows.length}</b>
          </div>
        </div>
        <div className="tr-stat">
          <span className="tr-stat-icon orange"><IconClock size={20} /></span>
          <div>
            <small>Ожидают решения</small>
            <b>{count('В процессе')}</b>
          </div>
        </div>
        <div className="tr-stat">
          <span className="tr-stat-icon green"><IconCheck size={20} /></span>
          <div>
            <small>Сумма одобренных</small>
            <b>{totalAmount.toLocaleString('ru-RU')} ₸</b>
          </div>
        </div>
      </div>

      <section className="tr-card">
        <div className="tr-toolbar">
          <div className="tr-tabs">
            {FILTERS.map((f) => (
              <button
                key={f}
                className={filter === f ? 'on' : ''}
                onClick={() => setFilter(f)}
              >
                {f}
                <span>{count(f)}</span>
              </button>
            ))}
          </div>
          <label className="tr-search">
            <IconSearch size={16} />
            <input
              placeholder="Спортсмен или клуб"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        <div className="tr-scroll">
          <table className="tr-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Спортсмен</th>
                <th>Откуда</th>
                <th></th>
                <th>Куда</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td className="muted">{formatDate(r.date)}</td>
                  <td>
                    <Link className="tr-athlete" to={`/athletes/${r.athlete}`}>
                      <span>{initials(r.athlete_name)}</span>
                      <b>{r.athlete_name}</b>
                    </Link>
                  </td>
                  <td>{r.from || 'Свободный агент'}</td>
                  <td><IconArrowRight size={16} className="tr-arrow" /></td>
                  <td>{r.to || 'Без клуба'}</td>
                  <td className="tr-amount">
                    {r.amount
                      ? `${Number(r.amount).toLocaleString('ru-RU')} ₸`
                      : '—'}
                  </td>
                  <td>
                    <span
                      className={`tr-badge ${
                        r.status === 'Одобрен' ? 'ok' : 'wait'
                      }`}
                    >
                      <i />
                      {r.status}
                    </span>
                  </td>
                  <td>
                    {r.status === 'В процессе' && (
                      <button className="tr-approve" onClick={() => approve(r)}>
                        <IconCheck size={15} /> Одобрить
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && (
            <div className="tr-empty">Переходов не найдено.</div>
          )}
        </div>
      </section>
    </div>
  );
}