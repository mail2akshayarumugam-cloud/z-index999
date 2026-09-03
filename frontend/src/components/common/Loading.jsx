const SIZES = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export default function Loading({ text, size = 'md' }) {
  const sizeClass = SIZES[size] || SIZES.md;

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <svg className={`animate-spin ${sizeClass} text-[#6366f1]`} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {text && <p className="text-sm text-[#94a3b8]">{text}</p>}
    </div>
  );
}
