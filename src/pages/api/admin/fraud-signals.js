import getDb from '@/lib/db';
import { methodAllowed, requireSession } from '@/lib/apiGuards';

// Heuristische Betrugs-/Abuse-Erkennung, kein Regelwerk mit automatischen Sperren -- die
// Signale sollen Mods/Admins nur auf verdaechtige Muster hinweisen, damit sie manuell
// nachschauen. Alles hier ist rein lesend (keine Schreibzugriffe), false positives sind
// bewusst in Kauf genommen -- lieber ein harmloses Paar zu viel melden als ein Farming-
// Netzwerk uebersehen.
const WINDOW_DAYS = 7;

export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['GET'])) return;
  const session = await requireSession(req, res, ['moderator', 'admin']);
  if (!session) return;

  const db = getDb();
  const since = `datetime('now', '-${WINDOW_DAYS} days')`;

  // 1) Haeufungs-/Funneling-Paare: dieselben zwei User schieben sich wiederholt oder in
  // grosser Summe Tokens per "give" zu (klassisches Muster fuer Alt-Account-Farming oder
  // Reward-Abuse ueber Umwege).
  const funnelingPairs = db.prepare(`
    SELECT t.fromUserId, t.toUserId, fu.username as fromUsername, tu.username as toUsername,
      COUNT(*) as transferCount, SUM(t.amount) as totalAmount, MAX(t.createdAt) as lastAt
    FROM transactions t
    JOIN users fu ON t.fromUserId = fu.id
    JOIN users tu ON t.toUserId = tu.id
    WHERE t.type = 'give' AND t.createdAt >= ${since}
    GROUP BY t.fromUserId, t.toUserId
    HAVING transferCount >= 3 OR totalAmount >= 2000
    ORDER BY totalAmount DESC
    LIMIT 25
  `).all();

  // 2) Ping-Pong: Tokens fliessen in beide Richtungen zwischen denselben zwei Accounts --
  // typisch fuer Versuche, Cooldowns/Reward-Limits durch Hin- und Herschieben zu umgehen.
  const pingPongPairs = db.prepare(`
    SELECT a.fromUserId as userA, a.toUserId as userB,
      ua.username as userAName, ub.username as userBName,
      a.forwardCount, a.forwardAmount, b.backwardCount, b.backwardAmount
    FROM (
      SELECT fromUserId, toUserId, COUNT(*) as forwardCount, SUM(amount) as forwardAmount
      FROM transactions
      WHERE type = 'give' AND createdAt >= ${since}
      GROUP BY fromUserId, toUserId
    ) a
    JOIN (
      SELECT fromUserId, toUserId, COUNT(*) as backwardCount, SUM(amount) as backwardAmount
      FROM transactions
      WHERE type = 'give' AND createdAt >= ${since}
      GROUP BY fromUserId, toUserId
    ) b ON b.fromUserId = a.toUserId AND b.toUserId = a.fromUserId
    JOIN users ua ON ua.id = a.fromUserId
    JOIN users ub ON ub.id = a.toUserId
    WHERE a.fromUserId < a.toUserId
    ORDER BY (a.forwardAmount + b.backwardAmount) DESC
    LIMIT 25
  `).all();

  // 3) Neue Accounts mit auffaellig hohen Eingaengen kurz nach Erstellung -- moegliche
  // Alt-Accounts, die frisch erstellt und sofort mit Tokens befuellt wurden.
  const freshBigReceivers = db.prepare(`
    SELECT u.id as userId, u.username, u.createdAt,
      SUM(t.amount) as receivedAmount, COUNT(*) as receivedCount
    FROM users u
    JOIN transactions t ON t.toUserId = u.id AND t.type = 'give'
    WHERE u.createdAt >= datetime('now', '-3 days')
    GROUP BY u.id
    HAVING receivedAmount >= 1000
    ORDER BY receivedAmount DESC
    LIMIT 25
  `).all();

  // 4) Hub-Accounts: ein Account bekommt von vielen verschiedenen Absendern Tokens --
  // moeglicher Sammelpunkt fuer ein Farming-Netzwerk aus mehreren Alt-Accounts.
  const hubReceivers = db.prepare(`
    SELECT t.toUserId as userId, u.username,
      COUNT(DISTINCT t.fromUserId) as distinctSenders, SUM(t.amount) as totalAmount
    FROM transactions t
    JOIN users u ON u.id = t.toUserId
    WHERE t.type = 'give' AND t.createdAt >= ${since}
    GROUP BY t.toUserId
    HAVING distinctSenders >= 5
    ORDER BY distinctSenders DESC
    LIMIT 25
  `).all();

  res.status(200).json({
    windowDays: WINDOW_DAYS,
    funnelingPairs,
    pingPongPairs,
    freshBigReceivers,
    hubReceivers,
  });
}
