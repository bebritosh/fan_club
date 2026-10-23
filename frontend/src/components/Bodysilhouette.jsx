// Схематичный силуэт для карточки «Антропометрические данные»
export default function BodySilhouette({ height = 280 }) {
  return (
    <svg width={height * 0.5} height={height} viewBox="0 0 140 280" aria-hidden="true">
      <defs>
        <linearGradient id="bodyGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="280">
          <stop offset="0" stopColor="#3b82ff" />
          <stop offset="1" stopColor="#173c8f" />
        </linearGradient>
      </defs>

      {/* Линейка роста слева */}
      <line x1="10" y1="6" x2="10" y2="274" stroke="#3b82ff" strokeOpacity=".6" strokeWidth="1.5" />
      <line x1="4" y1="6" x2="16" y2="6" stroke="#3b82ff" strokeOpacity=".6" strokeWidth="1.5" />
      <line x1="4" y1="274" x2="16" y2="274" stroke="#3b82ff" strokeOpacity=".6" strokeWidth="1.5" />

      {/* Голова и шея */}
      <circle cx="76" cy="24" r="16" fill="url(#bodyGrad)" />
      <rect x="69" y="38" width="14" height="14" rx="5" fill="url(#bodyGrad)" />

      {/* Корпус */}
      <path d="M48 58 Q76 46 104 58 L100 138 Q76 148 52 138 Z" fill="url(#bodyGrad)" />

      {/* Руки */}
      <line x1="46" y1="64" x2="34" y2="132" stroke="url(#bodyGrad)" strokeWidth="13" strokeLinecap="round" />
      <line x1="106" y1="64" x2="118" y2="132" stroke="url(#bodyGrad)" strokeWidth="13" strokeLinecap="round" />

      {/* Ноги */}
      <line x1="64" y1="146" x2="62" y2="258" stroke="url(#bodyGrad)" strokeWidth="19" strokeLinecap="round" />
      <line x1="88" y1="146" x2="90" y2="258" stroke="url(#bodyGrad)" strokeWidth="19" strokeLinecap="round" />
    </svg>
  );
}