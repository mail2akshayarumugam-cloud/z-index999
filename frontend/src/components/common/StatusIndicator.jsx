const STATUS_CONFIG = {
  safe: { color: 'bg-green-500', ping: false },
  warning: { color: 'bg-amber-500', ping: false },
  danger: { color: 'bg-red-500', ping: true },
  critical: { color: 'bg-red-600', ping: true },
};

export default function StatusIndicator({ status = 'safe', label }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.safe;

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-3 w-3">
        {config.ping && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.color} opacity-75`} />
        )}
        <span className={`relative inline-flex rounded-full h-3 w-3 ${config.color}`} />
      </span>
      {label && <span className="text-sm text-[#94a3b8]">{label}</span>}
    </div>
  );
}
