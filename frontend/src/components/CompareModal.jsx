import { useEffect, useMemo, useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { getAthletes } from '../services/api';
import { buildMetrics } from '../services/mockData';
import { COMPARE_ROWS } from '../services/compareRows';
import Avatar from './Avatar.jsx';
import './CompareModal.css';

const toList = (data) => (Array.isArray(data) ? data : data.results || []);

const isWinner = (row, mine, other) => {
  if (!row.better || mine === other) return false;
  return row.better === 'high' ? mine > other : mine < other;
};

export default function CompareModal({ athlete, onClose }) {
  const [others, setOthers] = useState([]);
  const [query, setQuery] = useState('');
  const [otherId, setOtherId] = useState('');

  useEffect(() => {
    getAthletes()
      .then((data) =>
        setOthers(toList(data).filter((item) => item.id !== athlete.id))
      )
      .catch(() => {});
  }, [athlete.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return others;

    return others.filter((item) =>
      [item.name, item.club_name, item.sport]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [others, query]);

  useEffect(() => {
    const selectedIsVisible = filtered.some((item) => String(item.id) === otherId);
    if (filtered.length && !selectedIsVisible) {
      setOtherId(String(filtered[0].id));
    }
  }, [filtered, otherId]);

  const other = others.find((item) => String(item.id) === otherId);
  const leftMetrics = useMemo(() => buildMetrics(athlete), [athlete]);
  const rightMetrics = useMemo(() => (other ? buildMetrics(other) : null), [other]);

  return (
    <div
      className="fc-modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="fc-modal cmp-modal">
        <div className="fc-modal-head">
          <h2>Сравнение спортсменов</h2>
          <button type="button" className="fc-modal-close" onClick={onClose}>
            <IconX size={18} />
          </button>
        </div>

        <div className="cmp-heads">
          <div className="cmp-person">
            <Avatar athlete={athlete} size={56} />
            <b>{athlete.name}</b>
            <small>
              {athlete.club_name} · {athlete.position}
            </small>
          </div>

          <span className="cmp-vs">VS</span>

          <div className="cmp-person">
            {other ? (
              <>
                <Avatar athlete={other} size={56} />
                <b>{other.name}</b>
                <small>
                  {other.club_name} · {other.position}
                </small>
              </>
            ) : (
              <small>Нет спортсмена для сравнения</small>
            )}
          </div>
        </div>

        <div className="cmp-pick">
          <input
            placeholder="Найти спортсмена по имени, клубу или виду спорта"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={otherId} onChange={(e) => setOtherId(e.target.value)}>
            {filtered.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.club_name}
              </option>
            ))}
          </select>
        </div>

        {other && rightMetrics && (
          <>
            <table className="cmp-table">
              <tbody>
                {COMPARE_ROWS.map((row) => {
                  const left = row.get(athlete, leftMetrics);
                  const right = row.get(other, rightMetrics);

                  return (
                    <tr key={row.label}>
                      <td className={isWinner(row, left, right) ? 'val win' : 'val'}>
                        {left}
                      </td>
                      <td className="lab">
                        {row.label}
                        {row.demo && <span className="cmp-demo">демо</span>}
                      </td>
                      <td className={isWinner(row, right, left) ? 'val win' : 'val'}>
                        {right}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="cmp-note">
              Зелёным выделено лучшее значение там, где можно сравнить «лучше / хуже».
            </p>
          </>
        )}

        <div className="fc-modal-foot">
          <button type="button" className="fc-btn fc-btn-primary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}