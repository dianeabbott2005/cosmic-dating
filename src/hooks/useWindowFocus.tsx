import { useState, useEffect } from 'react';

export const useWindowFocus = () => {
  const [isFocused, setIsFocused] = useState(true); // Assume focused initially

  useEffect(() => {
    const onFocus = () => setIsFocused(true);
    const onBlur = () => setIsFocused(false);

    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    // Set initial state in case the tab starts unfocused
    setIsFocused(document.visibilityState === 'visible');

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return isFocused;
};