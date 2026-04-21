import getDb from '@/lib/db';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/authOptions';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const db = getDb();

  if (req.method === 'POST') {
    const { userId, xp } = req.body;
    const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
    db.prepare('UPDATE users SET xp = ? WHERE id = ?').run(safeXp, userId);
    res.status(200).json({ success: true });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
