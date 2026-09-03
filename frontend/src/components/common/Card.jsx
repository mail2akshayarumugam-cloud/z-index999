export default function Card({ children, className = '', title, padding = true }) {
  return (
    <div className={`bg-[#1e293b] rounded-xl border border-[#334155] ${padding ? 'p-5' : ''} ${className}`}>
      {title && (
        <h3 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider mb-4">{title}</h3>
      )}
      {children}
    </div>
  );
}
