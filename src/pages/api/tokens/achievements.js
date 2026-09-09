import getDb from '@/lib/db';
import { methodAllowed, requireSession } from '@/lib/apiGuards';
import { getLevelInfo, getLevelTitle } from '@/lib/leveling';

const LEVEL_MILESTONES = [5, 10, 20, 30, 50, 75, 100];
const BALANCE_MILESTONES = [1000, 10000, 50000, 100000];
const GIVEN_MILESTONES = [1000, 10000, 50000];
const JACKPOT_WIN_MILESTONES = [1, 10, 50];
const DAILY_STREAK_MILESTONES = [7, 30, 100];

// Achievements sind komplett abgeleitet, nichts wird als "freigeschaltet" gespeichert --
// bei jedem Aufruf frisch aus den bestehenden Tabellen berechnet. Vermeidet eine eigene
// Migration/Tabelle nur fuer Achievement-Status, der sich ohnehin 1:1 aus den Rohdaten ergibt.
export default async function handler(req, res) {
  if (!methodAllowed(req, res, ['GET'])) return;
  const session = await requireSession(req, res);
  if (!session) return;

  const userId = session.user.id;
  const db = getDb();

  const user = db.prepare('SELECT xp, balance FROM users WHERE id = ?').get(userId);
  const { level } = getLevelInfo(user?.xp || 0);
  const balance = user?.balance || 0;

  const givenTotal = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE fromUserId = ? AND type = 'give'`
  ).get(userId).total;

  const jackpotWins = db.prepare(
    'SELECT COUNT(*) as c FROM jackpot_games WHERE winner_user_id = ?'
  ).get(userId).c;

  const dailyState = db.prepare(
    `SELECT claimCount FROM reward_state WHERE userId = ? AND rewardKey = 'daily_reward'`
  ).get(userId);
  const dailyStreak = dailyState?.claimCount || 0;

  const endedGiveaways = db.prepare('SELECT winner_ids FROM giveaways WHERE ended_at IS NOT NULL').all();
  const giveawayWins = endedGiveaways.reduce((count, g) => {
    const winnerIds = JSON.parse(g.winner_ids || '[]');
    return count + (winnerIds.includes(userId) ? 1 : 0);
  }, 0);

  const achievements = [];

  for (const milestone of LEVEL_MILESTONES) {
    achievements.push({
      key: `level_${milestone}`,
      category: 'Level',
      icon: '⭐',
      label: `Level ${milestone} — ${getLevelTitle(milestone)}`,
      unlocked: level >= milestone,
      progress: Math.min(level / milestone, 1),
    });
  }

  for (const milestone of BALANCE_MILESTONES) {
    achievements.push({
      key: `balance_${milestone}`,
      category: 'Guthaben',
      icon: '🪙',
      label: `${milestone.toLocaleString('de-DE')} Tokens auf dem Konto`,
      unlocked: balance >= milestone,
      progress: Math.min(balance / milestone, 1),
    });
  }

  for (const milestone of GIVEN_MILESTONES) {
    achievements.push({
      key: `given_${milestone}`,
      category: 'Großzügigkeit',
      icon: '🎁',
      label: `${milestone.toLocaleString('de-DE')} Tokens an andere verschenkt`,
      unlocked: givenTotal >= milestone,
      progress: Math.min(givenTotal / milestone, 1),
    });
  }

  for (const milestone of JACKPOT_WIN_MILESTONES) {
    achievements.push({
      key: `jackpot_${milestone}`,
      category: 'Jackpot',
      icon: '🎰',
      label: milestone === 1 ? 'Ersten Jackpot geknackt' : `${milestone}× Jackpot geknackt`,
      unlocked: jackpotWins >= milestone,
      progress: Math.min(jackpotWins / milestone, 1),
    });
  }

  for (const milestone of DAILY_STREAK_MILESTONES) {
    achievements.push({
      key: `daily_${milestone}`,
      category: 'Daily',
      icon: '📅',
      label: `${milestone}× täglichen Bonus geholt`,
      unlocked: dailyStreak >= milestone,
      progress: Math.min(dailyStreak / milestone, 1),
    });
  }

  achievements.push({
    key: 'giveaway_win',
    category: 'Giveaways',
    icon: '🏆',
    label: 'Ein Giveaway gewonnen',
    unlocked: giveawayWins >= 1,
    progress: Math.min(giveawayWins / 1, 1),
  });

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  res.status(200).json({
    achievements,
    unlockedCount,
    totalCount: achievements.length,
  });
}
