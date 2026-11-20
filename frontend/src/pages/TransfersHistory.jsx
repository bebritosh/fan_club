import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconArrowRight,
  IconCheck,
  IconClock,
  IconLoader2,
  IconSearch,
  IconTransfer,
} from '@tabler/icons-react';
import { getTransfers, updateTransfer } from '../services/api';
import { useToast } from '../context/ToastContext.jsx';
import './EntityPages.css';
import './TransfersPage.css';

const ALL = 'Все переходы';
const APPROVED = 'Одобрен';
const PENDING = 'В процессе';
const REJECTED = 'Отклонён';
const FILTERS = [ALL, APPROVED, PENDING, REJECTED];

const initials = (name = '') =>
  name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const formatDate = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const badgeClass = (status) => {
  if (status === APPROVED) return 'ok';
  if (status === PENDING) return 'wait';
  return 'no';
};

export default function TransfersHistory() {
  const notify = useToast();
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState(ALL);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const refresh = () => getTransfers().then(setRows);

  useEffect(() => {
    refresh().catch(() => notify('Не удалось загрузить трансферы.', 'error'));
  }, []);

  const count = (status) =>
    status === ALL ? rows.length : rows.filter((row) => row.status === status).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter(
      (row) =>
        (filter === ALL || row.status === filter) &&
        (!q ||
          [row.athlete_name, row.from, row.to]
            .join(' ')
            .toLowerCase()
            .includes(q))
    );
  }, [rows, filter, query]);

  const totalAmount = rows
    .filter((row) => row.status === APPROVED)
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const changeStatus = async (row, status, successText) => {
    setBusyId(row.id);

    try {
      await updateTransfer(row.id, { status });
      await refresh();
      setRejecting(null);
      notify(successText);
    } catch {
      notify('Не удалось обновить статус перехода.', 'error');
    } finally {
      setBusyId(null);
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
          <span className="tr-stat-icon blue">
            <IconTransfer size={20} />
          </span>
          <div>
            <small>Всего переходов</small>
            <b>{rows.length}</b>
          </div>
        </div>
        <div className="tr-stat">
          <span className="tr-stat-icon orange">
            <IconClock size={20} />
          </span>
          <div>
            <small>Ожидают решения</small>
            <b>{count(PENDING)}</b>
          </div>
        </div>
        <div className="tr-stat">
          <span className="tr-stat-icon green">
            <IconCheck size={20} />
          </span>
          <div>
            <small>Сумма одобренных</small>
            <b>{totalAmount.toLocaleString('ru-RU')} ₸</b>
          </div>
        </div>
      </div>

      <section className="tr-card">
        <div className="tr-toolbar">
          <div className="tr-tabs">
            {FILTERS.map((item) => (
              <button
                key={item}
                className={filter === item ? 'on' : ''}
                onClick={() => setFilter(item)}
              >
                {item}
                <span>{count(item)}</span>
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
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <td className="muted">{formatDate(row.date)}</td>
                  <td>
                    <Link className="tr-athlete" to={`/athletes/${row.athlete}`}>
                      <span>{initials(row.athlete_name)}</span>
                      <b>{row.athlete_name}</b>
                    </Link>
                  </td>
                  <td>{row.from || 'Свободный агент'}</td>
                  <td>
                    <IconArrowRight size={16} className="tr-arrow" />
                  </td>
                  <td>{row.to || 'Без клуба'}</td>
                  <td className="tr-amount">
                    {row.amount
                      ? `${Number(row.amount).toLocaleString('ru-RU')} ₸`
                      : '—'}
                  </td>
                  <td>
                    <span className={`tr-badge ${badgeClass(row.status)}`}>
                      <i />
                      {row.status}
                    </span>
                  </td>
                  <td>
                    {row.status === PENDING && (
                      <div className="tr-actions">
                        <button
                          className="tr-approve"
                          disabled={busyId === row.id}
                          onClick={() => changeStatus(row, APPROVED, 'Переход одобрен.')}
                        >
                          {busyId === row.id ? (
                            <IconLoader2 size={15} className="fc-spin" />
                          ) : (
                            <IconCheck size={15} />
                          )}
                          Одобрить
                        </button>
                        <button
                          className="tr-reject"
                          disabled={busyId === row.id}
                          onClick={() => setRejecting(row)}
                        >
                          Отклонить
                        </button>
                      </div>
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

      {rejecting && (
        <div
          className="fc-confirm-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setRejecting(null)}
        >
          <section
            className="fc-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reject-title"
          >
            <h2 id="reject-title">Отклонить переход?</h2>
            <p>
              Вы уверены, что хотите отклонить перевод спортсмена{' '}
              {rejecting.athlete_name}?
            </p>
            <div className="fc-confirm-actions">
              <button
                className="fc-btn fc-btn-ghost"
                onClick={() => setRejecting(null)}
                disabled={busyId === rejecting.id}
              >
                Отмена
              </button>
              <button
                className="fc-btn-danger"
                onClick={() => changeStatus(rejecting, REJECTED, 'Переход отклонён.')}
                disabled={busyId === rejecting.id}
              >
                {busyId === rejecting.id && (
                  <IconLoader2 size={16} className="fc-spin" />
                )}
                Отклонить
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}