import { useEffect, useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { saveAthlete } from '../services/api';
import { useToast } from '../context/ToastContext.jsx';
import Avatar from './Avatar.jsx';

const SPORTS = ['Футбол', 'Баскетбол', 'Хоккей', 'Волейбол', 'Бокс', 'Борьба', 'Лёгкая атлетика'];
const POSITIONS = ['Нападающий', 'Полузащитник', 'Защитник', 'Вратарь', 'Другая'];

const EMPTY = {
  full_name: '',
  birth_date: '',
  gender: 'М',
  club: '',
  sport: '',
  position: '',
  height: '',
  weight: '',
  photo_url: '',
};

export default function AddAthleteModal({ clubs, onClose, onSaved }) {
  const notify = useToast();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  // Закрытие по клавише Esc
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const submit = async e => {
    e.preventDefault();
    setBusy(true);

    // «Иванов Алексей Петрович» → имя, фамилия, отчество
    const parts = form.full_name.trim().split(/\s+/);

    try {
      await saveAthlete({
        first_name: parts[0],
        last_name: parts[1] || 'Спортсмен',
        middle_name: parts.slice(2).join(' '),
        gender: form.gender,
        birth_date: form.birth_date,
        sport: form.sport,
        position: form.position,
        club: form.club ? Number(form.club) : null,
        number: 0,
        status: 'Активен',
        height: Number(form.height || 180),
        weight: Number(form.weight || 75),
        photo_url: form.photo_url.trim(),
        achievements: [],
        medical_notes: '',
      });
      notify('Спортсмен добавлен в базу.');
      onSaved();
    } catch (err) {
      const message = Object.values(err.response?.data || {}).flat().join(' ');
      notify(message || 'Не удалось сохранить карточку.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fc-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <form className="fc-modal" onSubmit={submit}>
        <div className="fc-modal-head">
          <h2>Добавить спортсмена</h2>
          <button type="button" className="fc-modal-close" onClick={onClose} aria-label="Закрыть">
            <IconX size={19} />
          </button>
        </div>

        <div className="fc-add-grid">
          <div className="fc-add-photo">
            <Avatar athlete={{ name: form.full_name || '?', gender: form.gender, photo_url: form.photo_url }} size={96} />
            <input
              className="fc-input"
              placeholder="Ссылка на фото"
              value={form.photo_url}
              onChange={e => set('photo_url', e.target.value)}
            />
          </div>

          <div className="fc-add-fields">
            <label className="fc-field">
              <span>ФИО <i>*</i></span>
              <input
                className="fc-input"
                required
                placeholder="Введите полное имя"
                value={form.full_name}
                onChange={e => set('full_name', e.target.value)}
              />
            </label>

            <label className="fc-field">
              <span>Дата рождения <i>*</i></span>
              <input
                className="fc-input"
                type="date"
                required
                value={form.birth_date}
                onChange={e => set('birth_date', e.target.value)}
              />
            </label>

            <div className="fc-field">
              <span>Пол <i>*</i></span>
              <div className="fc-seg">
                <button type="button" className={form.gender === 'М' ? 'active' : ''} onClick={() => set('gender', 'М')}>
                  Мужской
                </button>
                <button type="button" className={form.gender === 'Ж' ? 'active' : ''} onClick={() => set('gender', 'Ж')}>
                  Женский
                </button>
              </div>
            </div>
          </div>
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
            <span>Вид спорта <i>*</i></span>
            <select className="fc-select" required value={form.sport} onChange={e => set('sport', e.target.value)}>
              <option value="">Выберите вид спорта</option>
              {SPORTS.map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="fc-field">
            <span>Позиция <i>*</i></span>
            <select className="fc-select" required value={form.position} onChange={e => set('position', e.target.value)}>
              <option value="">Выберите позицию</option>
              {POSITIONS.map(p => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>

          <div className="fc-add-pair">
            <label className="fc-field">
              <span>Рост, см</span>
              <input className="fc-input" type="number" min="100" max="260" placeholder="180" value={form.height} onChange={e => set('height', e.target.value)} />
            </label>
            <label className="fc-field">
              <span>Вес, кг</span>
              <input className="fc-input" type="number" min="30" max="200" placeholder="75" value={form.weight} onChange={e => set('weight', e.target.value)} />
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