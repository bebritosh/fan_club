export default function Avatar({ athlete, size = 44 }) {
  const name = athlete?.name || athlete?.full_name || '';
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();

  return (
    <span
      className={`fc-ava ${athlete?.gender === 'Ж' ? 'f' : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {athlete?.photo_url ? <img src={athlete.photo_url} alt="" /> : initials}
    </span>
  );
}