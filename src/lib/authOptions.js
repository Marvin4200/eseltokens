import DiscordProvider from 'next-auth/providers/discord';
import getDb from '@/lib/db';

const authOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'identify',
          prompt: 'none',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      const db = getDb();
      const discordId = profile.id;

      const existing = db.prepare('SELECT * FROM users WHERE discordId = ?').get(discordId);

      if (existing) {
        db.prepare('UPDATE users SET username = ?, discriminator = ?, avatar = ? WHERE discordId = ?')
          .run(profile.username, profile.discriminator || '', profile.avatar || '', discordId);
      } else {
        db.prepare('INSERT INTO users (discordId, username, discriminator, avatar, role) VALUES (?, ?, ?, ?, ?)')
          .run(discordId, profile.username, profile.discriminator || '', profile.avatar || '', 'pending');
      }

      return true;
    },
    async jwt({ token, account, profile }) {
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
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
};

export default authOptions;
