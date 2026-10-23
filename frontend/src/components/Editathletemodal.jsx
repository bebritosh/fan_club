import { useEffect, useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { saveAthlete } from '../services/api';
import { useToast } from '../context/ToastContext.jsx';

const STATUSES = ['Активен', 'Травма', 'Дисквалификация', 'Завершил карьеру'];

export default function EditAthleteModal({ athlete, clubs, onClose, onSaved }) {
  const notify = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    club: athlete.club_id || '',
    status: athlete.status,
    number: athlete.number,
    height: athlete.height,
    weight: athlete.weight,
  });

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveAthlete(
        {
          club: form.club ? Number(form.club) : null,
          status: form.status,
          number: Number(form.number),
          height: Number(form.height),
          weight: Number(form.weight),
        },
        athlete.id,
      );
      notify('Карточка спортсмена обновлена.');
      onSaved();
    } catch (err) {
      const message = Object.values(err.response?.data || {}).flat().join(' ');
      notify(message || 'Не удалось обновить карточку.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fc-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <form className="fc-modal" onSubmit={submit}>
        <div className="fc-modal-head">
          <h2>Изменить данные</h2>
          <button type="button" className="fc-modal-close" onClick={onClose} aria-label="Закрыть">
            <IconX size={19} />
          </button>
        </div>

        <div className="fc-add-row">
          <label className="fc-field">
            <span>Клуб</span>
            <select className="fc-select" value={form.club} onChange={e => set('club', e.target.value)}>
              <option value="">Без клуба</option>
              {clubs.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label className="fc-field">
            <span>Статус</span>
            <select className="fc-select" value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>

          <label className="fc-field">
            <span>Игровой номер</span>
            <input className="fc-input" type="number" min="0" max="99" value={form.number} onChange={e => set('number', e.target.value)} />
          </label>

          <div className="fc-add-pair">
            <label className="fc-field">
              <span>Рост, см</span>
              <input className="fc-input" type="number" min="100" max="250" value={form.height} onChange={e => set('height', e.target.value)} />
            </label>
            <label className="fc-field">
              <span>Вес, кг</span>
              <input className="fc-input" type="number" min="30" max="200" value={form.weight} onChange={e => set('weight', e.target.value)} />
            </label>
          </div>
        </div>

        <div className="fc-modal-foot">
          <button type="button" className="fc-btn fc-btn-ghost" onClick={onClose}>Отмена</button>
          <button className="fc-btn fc-btn-primary" disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить'}</button>
        </div>
      </form>
    </div>
  );
}