import { useState } from 'react';
import {
  IconFileTypeCsv,
  IconFileTypePdf,
  IconFileTypeXls,
  IconX,
} from '@tabler/icons-react';
import './ExportModal.css';

const FORMATS = [
  { id: 'pdf', label: 'PDF', icon: IconFileTypePdf },
  { id: 'xls', label: 'Excel', icon: IconFileTypeXls },
  { id: 'csv', label: 'CSV', icon: IconFileTypeCsv },
];

const SECTIONS = [
  { id: 'anthropometry', label: 'Антропометрия' },
  { id: 'composition', label: 'Состав тела' },
  { id: 'dynamics', label: 'Динамика показателей' },
  { id: 'transfers', label: 'История переходов' },
  { id: 'general', label: 'Общая информация' },
];

const REPORT_ORDER = ['general', 'anthropometry', 'composition', 'dynamics', 'transfers'];
const DEMO_SECTIONS = ['anthropometry', 'composition', 'dynamics'];

const DEMO_NOTE =
  'Антропометрия (кроме роста и веса), состав тела и динамика показателей — демонстрационные данные.';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const formatMoney = (amount) =>
  amount ? `${Number(amount).toLocaleString('ru-RU')} ₸` : '—';

function buildSections(athlete, metrics, months) {
  const transfers = athlete.transfers || [];

  const transferRows = transfers.length
    ? transfers.map((t) => [
        t.date,
        t.from || 'Свободный агент',
        t.to || 'Без клуба',
        formatMoney(t.amount),
        t.status || '—',
      ])
    : [['Переходов нет', '', '', '', '']];

  return {
    general: {
      title: 'Общая информация',
      tables: [
        {
          head: ['Показатель', 'Значение'],
          rows: [
            ['ФИО', athlete.full_name || athlete.name],
            ['ID', athlete.id],
            ['Клуб', athlete.club_name],
            ['Вид спорта', athlete.sport],
            ['Позиция', athlete.position],
            ['Номер', athlete.number],
            ['Статус', athlete.status],
            ['Дата рождения', athlete.birth_date],
            ['Возраст', `${athlete.age} лет`],
          ],
        },
      ],
    },
    anthropometry: {
      title: 'Антропометрия',
      tables: [
        {
          head: ['Показатель', 'Значение'],
          rows: [
            ['Рост', `${athlete.height} см`],
            ['Вес', `${athlete.weight} кг`],
            ['ИМТ', metrics.bmi],
            ['Размах рук', `${metrics.armSpan} см`],
            ['Длина ног', `${metrics.legLength} см`],
          ],
        },
      ],
    },
    composition: {
      title: 'Состав тела',
      tables: [
        {
          head: ['Показатель', 'Значение'],
          rows: [
            ['Мышечная масса', `${metrics.muscleMass} кг`],
            ['Жировая масса', `${metrics.fatMass} кг`],
            ['Жир', `${metrics.fatPct} %`],
            ['Вода', `${metrics.water} %`],
          ],
        },
      ],
    },
    dynamics: {
      title: 'Динамика показателей',
      tables: [
        {
          head: ['Показатель', 'Значение', 'Изменение'],
          rows: metrics.indicators.map((item) => [
            item.label,
            item.value,
            `+${item.change} %`,
          ]),
        },
        {
          head: ['Месяц', 'Мышечная масса, кг', 'Жировая масса, кг'],
          rows: metrics.trend
            .slice(-months)
            .map((item) => [item.month, item.muscle, item.fat]),
        },
      ],
    },
    transfers: {
      title: 'История переходов',
      tables: [
        {
          head: ['Дата', 'Откуда', 'Куда', 'Сумма', 'Статус'],
          rows: transferRows,
        },
      ],
    },
  };
}

function toCsv(sections, note) {
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const line = (cells) => cells.map(quote).join(';');
  const lines = [];

  sections.forEach((section) => {
    lines.push(line([section.title]));
    section.tables.forEach((table) => {
      lines.push(line(table.head));
      table.rows.forEach((row) => lines.push(line(row)));
      lines.push('');
    });
  });

  if (note) lines.push(line([note]));

  return `\ufeff${lines.join('\r\n')}`;
}

function renderTable(table) {
  const head = table.head.map((cell) => `<th>${escapeHtml(cell)}</th>`).join('');
  const rows = table.rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
    )
    .join('');

  return `<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function toHtml(athlete, sections, note) {
  const name = athlete.full_name || athlete.name;
  const date = new Date().toLocaleDateString('ru-RU');

  const body = sections
    .map(
      (section) =>
        `<h2>${escapeHtml(section.title)}</h2>${section.tables
          .map(renderTable)
          .join('')}`
    )
    .join('');

  const noteHtml = note ? `<p class="note">${escapeHtml(note)}</p>` : '';

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>FCAD — ${escapeHtml(name)}</title>
<style>
body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
h1 { margin: 0 0 4px; font-size: 22px; }
h2 { margin: 24px 0 8px; font-size: 16px; }
.sub { margin: 0; color: #6b7280; font-size: 13px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
th, td { border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; font-size: 13px; }
th { background: #eef2ff; }
.note { margin-top: 24px; color: #6b7280; font-size: 12px; }
</style>
</head>
<body>
<h1>FCAD — отчёт по спортсмену</h1>
<p class="sub">${escapeHtml(name)} · ${date}</p>
${body}
${noteHtml}
</body>
</html>`;
}

function downloadFile(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function printHtml(html) {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);

  frame.contentDocument.open();
  frame.contentDocument.write(html);
  frame.contentDocument.close();

  frame.contentWindow.onafterprint = () => frame.remove();
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }, 300);
  setTimeout(() => frame.remove(), 60000);
}

export default function ExportReportModal({ athlete, metrics, notify, onClose }) {
  const [format, setFormat] = useState('pdf');
  const [selected, setSelected] = useState(SECTIONS.map((item) => item.id));
  const [months, setMonths] = useState('6');

  const toggle = (id) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );

  const submit = (e) => {
    e.preventDefault();

    if (!selected.length) {
      notify('Выберите хотя бы один раздел.', 'error');
      return;
    }

    const all = buildSections(athlete, metrics, Number(months));
    const ids = REPORT_ORDER.filter((id) => selected.includes(id));
    const sections = ids.map((id) => all[id]);
    const note = ids.some((id) => DEMO_SECTIONS.includes(id)) ? DEMO_NOTE : '';
    const filename = `fcad_athlete_${athlete.id}`;

    if (format === 'csv') {
      downloadFile(toCsv(sections, note), 'text/csv;charset=utf-8', `${filename}.csv`);
    } else if (format === 'xls') {
      downloadFile(
        toHtml(athlete, sections, note),
        'application/vnd.ms-excel;charset=utf-8',
        `${filename}.xls`
      );
    } else {
      printHtml(toHtml(athlete, sections, note));
    }

    notify(format === 'pdf' ? 'Отчёт подготовлен к печати.' : 'Отчёт скачан.');
    onClose();
  };

  return (
    <div
      className="fc-modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form className="fc-modal ex-modal" onSubmit={submit}>
        <div className="fc-modal-head">
          <h2>Экспорт отчёта</h2>
          <button type="button" className="fc-modal-close" onClick={onClose}>
            <IconX size={18} />
          </button>
        </div>

        <div className="ex-formats">
          {FORMATS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={format === id ? 'on' : ''}
              onClick={() => setFormat(id)}
            >
              <Icon size={28} />
              {label}
            </button>
          ))}
        </div>

        <div className="ex-title">Выберите разделы</div>
        <div className="ex-sections">
          {SECTIONS.map((item) => (
            <label key={item.id}>
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => toggle(item.id)}
              />
              {item.label}
            </label>
          ))}
        </div>

        <label className="ex-period">
          Период динамики
          <select value={months} onChange={(e) => setMonths(e.target.value)}>
            <option value="3">Последние 3 месяца</option>
            <option value="6">Последние 6 месяцев</option>
          </select>
        </label>

        <div className="fc-modal-foot">
          <button type="button" className="fc-btn fc-btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button className="fc-btn fc-btn-primary">Экспорт</button>
        </div>
      </form>
    </div>
  );
}