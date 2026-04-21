import getDb from '@/lib/db';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/authOptions';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || (session.user.role !== 'moderator' && session.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const db = getDb();

  if (req.method === 'GET') {
    const users = db.prepare('SELECT id, discordId, username, avatar, balance, role FROM users').all();
    res.status(200).json(users);
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
