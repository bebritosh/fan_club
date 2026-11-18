import { useEffect, useMemo, useState } from 'react';
import {
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconMapPin,
  IconPlus,
  IconTrash,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { deleteEvent, getClubs, getEvents, saveEvent } from '../services/api';
import { useToast } from '../context/ToastContext.jsx';
import './CalendarPage.css';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const TYPE_CLASS = {
  Турнир: 'tournament',
  Матч: 'match',
  Встреча: 'meeting',
};

const toKey = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const toList = (data) => (Array.isArray(data) ? data : data.results || []);

export default function EventsCalendar() {
  const notify = useToast();
  const today = new Date();

  const [events, setEvents] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [month, setMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selected, setSelected] = useState(toKey(today));
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = () => getEvents().then((data) => setEvents(toList(data)));

  useEffect(() => {
    refresh().catch(() => notify('Не удалось загрузить события.', 'error'));
    getClubs()
      .then((data) => setClubs(toList(data)))
      .catch(() => {});
  }, []);

  const byDate = useMemo(() => {
    const map = {};
    events.forEach((event) => {
      if (!map[event.date]) map[event.date] = [];
      map[event.date].push(event);
    });
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const offset = (new Date(year, m, 1).getDay() + 6) % 7;
    const days = new Date(year, m + 1, 0).getDate();
    const total = Math.ceil((offset + days) / 7) * 7;

    return Array.from({ length: total }, (_, i) => {
      const day = i - offset + 1;
      if (day < 1 || day > days) return null;
      return toKey(new Date(year, m, day));
    });
  }, [month]);

  const dayEvents = byDate[selected] || [];

  const upcoming = events
    .filter((event) => event.date >= toKey(today))
    .slice(0, 4);

  const monthTitle = month.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });

  const selectedTitle = new Date(`${selected}T00:00:00`).toLocaleDateString(
    'ru-RU',
    { day: 'numeric', month: 'long' }
  );

  const shiftMonth = (step) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + step, 1));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);

    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);
    data.clubs = form.getAll('clubs').map(Number);

    try {
      await saveEvent(data);
      setModal(false);
      await refresh();
      notify('Мероприятие добавлено в календарь.');
    } catch (err) {
      const message = Object.values(err.response?.data || {})
        .flat()
        .join(' ');
      notify(message || 'Не удалось создать событие.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (event) => {
    if (!window.confirm(`Удалить событие «${event.title}»?`)) return;

    try {
      await deleteEvent(event.id);
      await refresh();
      notify('Событие удалено.');
    } catch {
      notify('Не удалось удалить событие.', 'error');
    }
  };

  const renderEvent = (event, withDelete) => (
    <article key={event.id} className="cal-event">
      <span className={`cal-bar ${TYPE_CLASS[event.type]}`} />
      <div className="cal-event-body">
        <div className="cal-event-top">
          <span className={`cal-tag ${TYPE_CLASS[event.type]}`}>
            {event.type}
          </span>
          {withDelete && (
            <button
              className="cal-delete"
              title="Удалить событие"
              onClick={() => remove(event)}
            >
              <IconTrash size={16} />
            </button>
          )}
        </div>
        <h3>{event.title}</h3>
        <div className="cal-meta">
          <span>
            <IconClock size={14} />
            {event.time?.slice(0, 5)}
          </span>
          <span>
            <IconMapPin size={14} />
            {event.location}
          </span>
          <span>
            <IconUsers size={14} />
            {(event.club_names || []).join(' · ') || 'Без клуба'}
          </span>
        </div>
        {withDelete && event.description && <p>{event.description}</p>}
      </div>
    </article>
  );

  return (
    <div className="cal-page">
      <div className="cal-head">
        <div>
          <h1>Календарь</h1>
          <p>Турниры, матчи и встречи по датам.</p>
        </div>
        <button className="cal-primary" onClick={() => setModal(true)}>
          <IconPlus size={18} />
          Создать событие
        </button>
      </div>

      <div className="cal-layout">
        <section className="cal-card">
          <div className="cal-month-bar">
            <h2>{monthTitle}</h2>
            <div className="cal-nav">
              <button onClick={() => shiftMonth(-1)}>
                <IconChevronLeft size={18} />
              </button>
              <button
                className="cal-today"
                onClick={() => {
                  setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                  setSelected(toKey(today));
                }}
              >
                Сегодня
              </button>
              <button onClick={() => shiftMonth(1)}>
                <IconChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="cal-grid">
            {WEEKDAYS.map((day) => (
              <div key={day} className="cal-weekday">
                {day}
              </div>
            ))}

            {cells.map((key, i) => {
              if (!key) return <div key={i} className="cal-cell empty" />;

              const list = byDate[key] || [];
              const classes = ['cal-cell'];
              if (key === selected) classes.push('selected');
              if (key === toKey(today)) classes.push('today');

              return (
                <button
                  key={key}
                  className={classes.join(' ')}
                  onClick={() => setSelected(key)}
                >
                  <span className="cal-num">{Number(key.slice(8))}</span>
                  <span className="cal-dots">
                    {list.slice(0, 3).map((event) => (
                      <i key={event.id} className={TYPE_CLASS[event.type]} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="cal-legend">
            <span>
              <i className="tournament" /> Турнир
            </span>
            <span>
              <i className="match" /> Матч
            </span>
            <span>
              <i className="meeting" /> Встреча
            </span>
          </div>
        </section>

        <aside className="cal-side">
          <section className="cal-card">
            <h2 className="cal-side-title">События: {selectedTitle}</h2>
            {dayEvents.length === 0 ? (
              <div className="cal-empty">В этот день событий нет.</div>
            ) : (
              <div className="cal-list">
                {dayEvents.map((event) => renderEvent(event, true))}
              </div>
            )}
          </section>

          <section className="cal-card">
            <h2 className="cal-side-title">Ближайшие</h2>
            {upcoming.length === 0 ? (
              <div className="cal-empty">Предстоящих событий нет.</div>
            ) : (
              <div className="cal-list">
                {upcoming.map((event) => renderEvent(event, false))}
              </div>
            )}
          </section>
        </aside>
      </div>

      {modal && (
        <div
          className="cal-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setModal(false)}
        >
          <form className="cal-modal" onSubmit={submit}>
            <button
              type="button"
              className="cal-close"
              onClick={() => setModal(false)}
            >
              <IconX size={18} />
            </button>
            <h2>Новое мероприятие</h2>

            <div className="cal-form">
              <label className="wide">
                Название
                <input name="title" required />
              </label>
              <label>
                Тип
                <select name="type">
                  <option>Турнир</option>
                  <option>Матч</option>
                  <option>Встреча</option>
                </select>
              </label>
              <label>
                Дата
                <input name="date" type="date" defaultValue={selected} required />
              </label>
              <label>
                Время
                <input name="time" type="time" required />
              </label>
              <label>
                Локация
                <input name="location" required />
              </label>
              <label className="wide">
                Клубы
                <select name="clubs" multiple size="4">
                  {clubs.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}
                    </option>
                  ))}
                </select>
                <small>Удерживайте Ctrl, чтобы выбрать несколько клубов.</small>
              </label>
              <label className="wide">
                Описание
                <textarea name="description" rows="3" />
              </label>
            </div>

            <div className="cal-actions">
              <button
                type="button"
                className="cal-secondary"
                onClick={() => setModal(false)}
              >
                Отмена
              </button>
              <button className="cal-primary" disabled={busy}>
                {busy ? 'Сохранение…' : 'Создать событие'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}