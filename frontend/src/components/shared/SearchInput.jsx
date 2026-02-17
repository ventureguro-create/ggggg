import { X } from 'lucide-react';

/**
 * Reusable search input component - NO ICON version
 * Clean input without magnifying glass icon
 */
export const SearchInput = ({ 
  value, 
  onChange, 
  placeholder = "Search...",
  className = "",
  inputClassName = "",
  testId = "search-input",
  onClear,
  autoFocus = false,
  size = "default" // "default" | "large"
}) => {
  const sizeClasses = {
    default: "py-3 px-4 pr-10 text-sm",
    large: "py-4 px-5 pr-10 text-base"
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      onChange({ target: { value: '' } });
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        data-testid={testId}
        className={`w-full bg-white border border-gray-200 rounded-2xl focus:outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all ${sizeClasses[size]} ${inputClassName}`}
        style={{ color: '#111827' }}
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
          type="button"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      )}
    </div>
  );
};

export default SearchInput;
