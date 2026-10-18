import { useEffect, useState } from 'react';

// Returns `value` only after it stopped changing for `delay` ms (so we don't call the API on every keystroke).
export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
