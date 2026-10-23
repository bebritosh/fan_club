import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconArrowRight, IconCheck, IconTransfer } from '@tabler/icons-react';
import { LoaderCircle } from 'lucide-react';
import { getTransfers, updateTransfer } from '../services/api';
import { useToast } from '../context/ToastContext.jsx';
import './EntityPages.css';

const ALL_TRANSFERS = 'Все переходы';
const PENDING = 'В процессе';

export default function TransfersHistory() {
  const notify = useToast();
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState(ALL_TRANSFERS);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);

  const refresh = () => getTransfers().then(result => setRows(Array.isArray(result) ? result : result.results || []));
  useEffect(() => {
    refresh().catch(() => notify('Не удалось загрузить трансферы.', 'error'));
  }, []);

  const visible = rows.filter(row => filter === ALL_TRANSFERS || row.status === filter);

  const approve = async row => {
    setBusyId(row.id);
    try {
      await updateTransfer(row.id, { status: 'Одобрен' });
      await refresh();
      notify('Переход одобрен.');
    } catch {
      notify('Не удалось обновить статус перехода.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await updateTransfer(rejecting.id, { status: 'Отклонён' });
      await refresh();
      setRejecting(null);
      notify('Переход отклонён.');
    } catch {
      notify('Не удалось обновить статус перехода.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="entity-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ПЕРЕХОДЫ МЕЖДУ КЛУБАМИ · {rows.length} ЗАПИСЕЙ</div>
          <h1>История трансферов</h1>
          <p>Отслеживайте перемещения спортсменов и согласования.</p>
        </div>
        <div className="transfer-summary">
          <b>{rows.filter(row => row.status === PENDING).length}</b>
          <span>ожидают решения</span>
        </div>
      </div>

      <div className="transfer-filters">
        {[ALL_TRANSFERS, 'Одобрен', PENDING].map(value => (
          <button key={value} onClick={() => setFilter(value)} className={filter === value ? 'selected' : ''}>
            {value}<span>{value === ALL_TRANSFERS ? rows.length : rows.filter(row => row.status === value).length}</span>
          </button>
        ))}
      </div>

      <section className="table-panel">
        <div className="table-scroll">
          <table className="data-table transfers-table">
            <thead><tr><th>Дата</th><th>Спортсмен</th><th>Откуда</th><th aria-label="Направление"/><th>Куда</th><th>Сумма контракта</th><th>Статус</th><th>Действия</th></tr></thead>
            <tbody>
              {visible.map(row => (
                <tr key={row.id}>
                  <td>{new Date(`${row.date}T00:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td><Link className="table-athlete" to={`/athletes/${row.athlete}`}><span>{row.athlete_name?.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><b>{row.athlete_name}</b></Link></td>
                  <td>{row.from || 'Свободный агент'}</td>
                  <td><IconArrowRight className="transfer-arrow"/></td>
                  <td>{row.to || 'Без клуба'}</td>
                  <td className="amount-cell">{row.amount ? `${Number(row.amount).toLocaleString('ru-RU')} ₸` : '—'}</td>
                  <td><span className={`status-pill ${row.status === 'Одобрен' ? 'status-active' : row.status === PENDING ? 'status-injured' : 'status-retired'}`}><i/>{row.status}</span></td>
                  <td>
                    {row.status === PENDING && (
                      <div className="transfer-actions">
                        <button className="transfer-action approve" disabled={busyId === row.id} onClick={() => approve(row)}>
                          {busyId === row.id ? <LoaderCircle className="fc-spin" size={16}/> : <IconCheck size={16}/>}
                          {busyId === row.id ? 'Обработка…' : 'Одобрить'}
                        </button>
                        <button className="transfer-action reject" disabled={busyId === row.id} onClick={() => setRejecting(row)}>Отклонить</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <div className="empty-state">Переходов с таким статусом нет.</div>}
        </div>
      </section>

      <div className="transfer-footnote"><IconTransfer/> Данные о переходах фиксируются в профиле каждого спортсмена.</div>

      {rejecting && (
        <div className="fc-confirm-backdrop" onMouseDown={event => event.target === event.currentTarget && setRejecting(null)}>
          <section className="fc-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reject-title">
            <h2 id="reject-title">Отклонить переход?</h2>
            <p>Вы уверены, что хотите отклонить перевод спортсмена {rejecting.athlete_name}?</p>
            <div className="fc-confirm-actions">
              <button className="fc-btn fc-btn-ghost" onClick={() => setRejecting(null)} disabled={busyId === rejecting.id}>Отмена</button>
              <button className="fc-btn-danger" onClick={reject} disabled={busyId === rejecting.id}>{busyId === rejecting.id && <LoaderCircle className="fc-spin" size={16}/>}Отклонить</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
