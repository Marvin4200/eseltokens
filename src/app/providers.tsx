'use client';

import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider basePath="/eseltokens/api/auth" refetchInterval={30} refetchOnWindowFocus={true}>{children}</SessionProvider>;
}