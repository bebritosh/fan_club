import { useEffect, useMemo, useState } from 'react';
import {
  IconCalendarEvent,
  IconPlus,
  IconSearch,
  IconTrash,
  IconTrophy,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import { deleteClub, getClubs, saveClub } from '../services/api';
import { useToast } from '../context/ToastContext.jsx';
import './ClubsPage.css';

const toList = (data) => (Array.isArray(data) ? data : data.results || []);

export default function ClubsDirectory() {
  const notify = useToast();

  const [clubs, setClubs] = useState([]);
  const [query, setQuery] = useState('');
  const [league, setLeague] = useState('');
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = () => getClubs().then((data) => setClubs(toList(data)));

  useEffect(() => {
    refresh().catch(() => notify('Не удалось загрузить клубы.', 'error'));
  }, []);

  const leagues = useMemo(
    () => [...new Set(clubs.map((club) => club.league))],
    [clubs]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    return clubs.filter(
      (club) =>
        (!league || club.league === league) &&
        (!q ||
          [club.name, club.short_name, club.coach]
            .join(' ')
            .toLowerCase()
            .includes(q))
    );
  }, [clubs, query, league]);

  const totalAthletes = clubs.reduce(
    (sum, club) => sum + (club.athlete_count ?? 0),
    0
  );

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);

    const data = Object.fromEntries(new FormData(e.currentTarget));

    try {
      await saveClub({ ...data, founded: Number(data.founded) });
      setModal(false);
      await refresh();
      notify('Клуб добавлен в каталог.');
    } catch (err) {
      const message = Object.values(err.response?.data || {})
        .flat()
        .join(' ');
      notify(message || 'Не удалось сохранить клуб.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (club) => {
    if (!window.confirm(`Удалить клуб «${club.name}»?`)) return;

    try {
      await deleteClub(club.id);
      await refresh();
      notify('Клуб удалён.');
    } catch {
      notify('Не удалось удалить клуб: проверьте связанные записи.', 'error');
    }
  };

  return (
    <div className="cl-page">
      <div className="cl-head">
        <div>
          <h1>Клубы</h1>
          <p>Команды федерации, составы и контактная информация.</p>
        </div>
        <button className="cl-primary" onClick={() => setModal(true)}>
          <IconPlus size={18} />
          Добавить клуб
        </button>
      </div>

      <div className="cl-stats">
        <div className="cl-stat">
          <span className="blue">
            <IconTrophy size={20} />
          </span>
          <div>
            <small>Клубов</small>
            <b>{clubs.length}</b>
          </div>
        </div>
        <div className="cl-stat">
          <span className="green">
            <IconUsers size={20} />
          </span>
          <div>
            <small>Спортсменов в клубах</small>
            <b>{totalAthletes}</b>
          </div>
        </div>
        <div className="cl-stat">
          <span className="orange">
            <IconCalendarEvent size={20} />
          </span>
          <div>
            <small>Лиг</small>
            <b>{leagues.length}</b>
          </div>
        </div>
      </div>

      <div className="cl-toolbar">
        <label className="cl-search">
          <IconSearch size={16} />
          <input
            placeholder="Название, короткое имя или тренер"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select value={league} onChange={(e) => setLeague(e.target.value)}>
          <option value="">Все лиги</option>
          {leagues.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="cl-grid">
        {visible.map((club) => (
          <article key={club.id} className="cl-card">
            <div className="cl-card-top">
              <div className="cl-logo" style={{ background: club.color }}>
                {club.short_name}
              </div>
              <button
                className="cl-delete"
                title="Удалить клуб"
                onClick={() => remove(club)}
              >
                <IconTrash size={18} />
              </button>
            </div>

            <h2>{club.name}</h2>
            <div className="cl-league">
              <IconTrophy size={14} />
              {club.league}
            </div>

            <div className="cl-coach">
              Главный тренер
              <b>{club.coach}</b>
            </div>

            <div className="cl-foot">
              <span>
                <IconCalendarEvent size={15} />
                С {club.founded} года
              </span>
              <span>
                <IconUsers size={15} />
                {club.athlete_count ?? 0}
              </span>
            </div>
          </article>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="cl-empty">Клубов по заданным условиям не найдено.</div>
      )}

      {modal && (
        <div
          className="cl-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setModal(false)}
        >
          <form className="cl-modal" onSubmit={submit}>
            <button
              type="button"
              className="cl-close"
              onClick={() => setModal(false)}
            >
              <IconX size={18} />
            </button>
            <h2>Добавить клуб</h2>

            <div className="cl-form">
              <label>
                Название
                <input name="name" required />
              </label>
              <label>
                Короткое имя
                <input name="short_name" maxLength="12" placeholder="FC" required />
              </label>
              <label>
                Год основания
                <input
                  name="founded"
                  type="number"
                  min="1800"
                  max="2100"
                  required
                />
              </label>
              <label>
                Лига
                <input name="league" required />
              </label>
              <label>
                Главный тренер
                <input name="coach" required />
              </label>
              <label>
                Цвет клуба
                <input name="color" type="color" defaultValue="#2d7bff" />
              </label>
            </div>

            <div className="cl-actions">
              <button
                type="button"
                className="cl-secondary"
                onClick={() => setModal(false)}
              >
                Отмена
              </button>
              <button className="cl-primary" disabled={busy}>
                {busy ? 'Сохранение…' : 'Сохранить клуб'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}