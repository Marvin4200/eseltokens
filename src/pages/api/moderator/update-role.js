import getDb from '@/lib/db';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/authOptions';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || (session.user.role !== 'moderator' && session.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const db = getDb();

  if (req.method === 'POST') {
    const { userId, role } = req.body;

    // Moderators can only set pending <-> member
    if (!['pending', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Moderators can only assign pending or member roles' });
    }

    // Don't allow changing admin or moderator users
    const targetUser = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (targetUser.role === 'admin' || targetUser.role === 'moderator') {
      return res.status(403).json({ error: 'Cannot change role of admins or moderators' });
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
    res.status(200).json({ success: true });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
