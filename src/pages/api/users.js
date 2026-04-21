import getDb from '@/lib/db';

export default function handler(req, res) {
  const db = getDb();

  if (req.method === 'GET') {
    const users = db.prepare('SELECT id, discordId, username, avatar, balance, xp, role FROM users WHERE role != ?').all('pending');
    res.status(200).json(users);
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}