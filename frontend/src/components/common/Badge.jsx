const COLORS = {
  LOW: 'bg-green-500/20 text-green-400 border-green-500/30',
  MEDIUM: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  HIGH: 'bg-red-500/20 text-red-400 border-red-500/30',
  CRITICAL: 'bg-red-600/20 text-red-300 border-red-600/30',
};

export default function Badge({ level = 'LOW', children }) {
  const color = COLORS[level] || COLORS.LOW;
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border ${color}`}>
      {children || level}
    </span>
  );
}
