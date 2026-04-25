import DiscordProvider from 'next-auth/providers/discord';
import getDb from '@/lib/db';
import { creditTokens, recordTransaction } from '@/lib/tokenLedger';

const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'identify',
          // prompt: 'none' removed — caused "State cookie was missing" behind reverse proxy
        },
      },
    }),
  ],
  cookies: {
    pkceCodeVerifier: {
      name: 'next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
    state: {
      name: 'next-auth.state',
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: true,
      },
    },
  },
  callbacks: {
    async signIn({ profile }) {
      if (!profile?.id || !profile?.username) {
        return false;
      }

      const db = getDb();
      const discordId = profile.id;
      const initialAdminId = process.env.INITIAL_ADMIN_DISCORD_ID;
      const desiredRole = discordId === initialAdminId ? 'admin' : 'pending';

      const existing = db.prepare('SELECT * FROM users WHERE discordId = ?').get(discordId);
      const starterAmount = Math.max(0, parseInt(process.env.STARTER_PACK_TOKENS || '500', 10) || 0);

      if (existing) {
        const nextRole = desiredRole === 'admin' && existing.role !== 'admin' ? 'admin' : existing.role;
        db.prepare('UPDATE users SET username = ?, discriminator = ?, avatar = ?, role = ? WHERE discordId = ?')
          .run(profile.username, profile.discriminator || '', profile.avatar || '', nextRole, discordId);
      } else {
        db.prepare('INSERT INTO users (discordId, username, discriminator, avatar, role) VALUES (?, ?, ?, ?, ?)')
          .run(discordId, profile.username, profile.discriminator || '', profile.avatar || '', desiredRole);
      }

      // Starter pack: grant once per user on first successful sign-in.
      // Uses reward_state to avoid schema changes to users.
      if (starterAmount > 0) {
        const user = db.prepare('SELECT id FROM users WHERE discordId = ?').get(discordId);
        if (user?.id) {
          const apply = db.transaction(() => {
            const already = db
              .prepare('SELECT 1 FROM reward_state WHERE userId = ? AND rewardKey = ?')
              .get(user.id, 'starter_pack');
            if (already) return;

            creditTokens(db, user.id, starterAmount);
            recordTransaction(db, { fromUserId: user.id, type: 'reward_starter_pack', amount: starterAmount });
            db.prepare(
              "INSERT INTO reward_state (userId, rewardKey, lastClaimAt, claimCount, meta, updatedAt) VALUES (?, ?, ?, 1, ?, datetime('now'))"
            ).run(user.id, 'starter_pack', Date.now(), JSON.stringify({ amount: starterAmount }));
          });
          apply();
        }
      }

      return true;
    },
    async jwt({ token, profile }) {
      if (profile) {
        token.discordId = profile.id;
      }
      return token;
    },
    async session({ session, token }) {
      const db = getDb();
      const user = db.prepare('SELECT * FROM users WHERE discordId = ?').get(token.discordId);
      if (user) {
        session.user.id = user.id;
        session.user.discordId = user.discordId;
        session.user.role = user.role;
        session.user.balance = user.balance;
        session.user.xp = user.xp || 0;
        session.user.name = user.username;
      }
      delete session.user.email;
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
};

export default authOptions;
