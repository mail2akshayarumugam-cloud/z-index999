function getColor(score) {
  if (score >= 90) return '#dc2626';
  if (score >= 70) return '#ef4444';
  if (score >= 40) return '#f59e0b';
  return '#22c55e';
}

function getBgColor(score) {
  if (score >= 90) return 'bg-red-600/20';
  if (score >= 70) return 'bg-red-500/20';
  if (score >= 40) return 'bg-amber-500/20';
  return 'bg-green-500/20';
}

export default function RiskMeter({ score = 0, level, showLabel = true }) {
  const color = getColor(score);
  const clampedWidth = Math.min(Math.max(score, 0), 100);

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-bold" style={{ color }}>{Math.round(score)}</span>
          {level && (
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
              {level}
            </span>
          )}
        </div>
      )}
      <div className={`w-full h-3 rounded-full ${getBgColor(score)} overflow-hidden`}>
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${clampedWidth}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
