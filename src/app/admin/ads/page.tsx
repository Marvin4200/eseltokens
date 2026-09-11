'use client';

import { useEffect } from 'react';

// Nach admin.eselbande.com umgezogen (konsolidierte Admin-Oberflaeche).
export default function AdsRedirect() {
  useEffect(() => {
    window.location.replace('https://admin.eselbande.com/');
  }, []);

  return (
    <main style={{ maxWidth: 480, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
      <p>Die Werbeflächen-Verwaltung ist umgezogen.</p>
      <p>
        Du wirst weitergeleitet zu{' '}
        <a href="https://admin.eselbande.com/">admin.eselbande.com</a> …
      </p>
    </main>
  );
}
