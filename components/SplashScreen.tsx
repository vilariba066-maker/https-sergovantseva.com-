'use client';
import { useState, useEffect } from 'react';

export default function SplashScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('splashShown')) return;
    sessionStorage.setItem('splashShown', '1');
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div
      onAnimationEnd={() => setVisible(false)}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        backgroundColor: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'splashFadeOut 3s ease forwards',
        pointerEvents: 'none',
      }}
    >
      <img
        src="/wp-content/themes/main/img/logo.svg"
        alt="Natalia Sergovantseva"
        style={{ height: '140px', width: 'auto' }}
      />
    </div>
  );
}
