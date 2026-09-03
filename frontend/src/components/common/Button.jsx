const VARIANTS = {
  primary: 'bg-[#6366f1] hover:bg-[#4f46e5] text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  outline: 'bg-transparent border border-[#334155] hover:bg-[#334155] text-[#f1f5f9]',
  ghost: 'bg-transparent hover:bg-[#334155] text-[#94a3b8]',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({
  variant = 'primary',
  children,
  onClick,
  disabled = false,
  loading = false,
  className = '',
  fullWidth = false,
  size = 'md',
  type = 'button',
}) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/50 disabled:opacity-50 disabled:cursor-not-allowed';
  const variantClass = VARIANTS[variant] || VARIANTS.primary;
  const sizeClass = SIZES[size] || SIZES.md;
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variantClass} ${sizeClass} ${widthClass} ${className}`}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
