function random(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const round1 = n => Math.round(n * 10) / 10;

export function buildMetrics(athlete) {
  const rnd = random(athlete.id + 3);
  const { height, weight } = athlete;

  const bmi = round1(weight / (height / 100) ** 2);

  const fatPct = round1(9 + rnd() * 8);
  const fatMass = round1((weight * fatPct) / 100);
  const muscleMass = round1((weight - fatMass) * 0.86);
  const water = round1(56 + rnd() * 6);

  const now = new Date();
  const trend = Array.from({ length: 6 }, (_, i) => {
    const back = 5 - i;
    const date = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const month = date.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '');
    return {
      month: month[0].toUpperCase() + month.slice(1),
      muscle: round1(muscleMass - back * 0.35 + rnd() * 0.2),
      fat: round1(fatMass + back * 0.2 + rnd() * 0.15),
    };
  });

  const indicators = [
    { label: 'Скорость (100 м)', value: `${round1(10.9 + rnd() * 1.2)} с`, change: Math.round(1 + rnd() * 3) },
    { label: 'Выносливость (YO-YO)', value: `${round1(16 + rnd() * 3)}`, change: Math.round(3 + rnd() * 4) },
    { label: 'Сила (присед)', value: `${Math.round(100 + rnd() * 40)} кг`, change: Math.round(4 + rnd() * 5) },
    { label: 'Прыжок в длину', value: `${(2.6 + rnd() * 0.4).toFixed(2)} м`, change: Math.round(3 + rnd() * 4) },
    { label: 'VO2 max', value: `${Math.round(52 + rnd() * 9)} мл/кг/мин`, change: Math.round(2 + rnd() * 3) },
  ];

  return {
    bmi,
    armSpan: Math.round(height + rnd() * 8 - 1),
    legLength: Math.round(height * 0.505),
    fatPct,
    fatMass,
    muscleMass,
    water,
    trend,
    indicators,
  };
}