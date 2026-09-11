import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'eseltokens.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discordId TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        discriminator TEXT,
        avatar TEXT,
        balance INTEGER DEFAULT 0,
        role TEXT DEFAULT 'pending' CHECK(role IN ('pending', 'member', 'moderator', 'admin')),
        createdAt TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fromUserId INTEGER NOT NULL,
        toUserId INTEGER,
        type TEXT NOT NULL,
        amount INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (fromUserId) REFERENCES users(id),
        FOREIGN KEY (toUserId) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS blackjack_tables (
        id TEXT PRIMARY KEY,
        status TEXT DEFAULT 'waiting',
        deck TEXT DEFAULT '[]',
        dealerCards TEXT DEFAULT '[]',
        currentSeat INTEGER DEFAULT -1,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS blackjack_players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tableId TEXT NOT NULL,
        userId INTEGER NOT NULL,
        username TEXT NOT NULL,
        seatIndex INTEGER NOT NULL,
        hands TEXT DEFAULT '[]',
        currentHandIndex INTEGER DEFAULT 0,
        isReady INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (tableId) REFERENCES blackjack_tables(id) ON DELETE CASCADE,
        UNIQUE(tableId, seatIndex),
        UNIQUE(tableId, userId)
      );

      CREATE TABLE IF NOT EXISTS giveaways (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prize TEXT NOT NULL,
        duration INTEGER NOT NULL,
        winners INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        ended_at TEXT
      );

      CREATE TABLE IF NOT EXISTS giveaway_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        giveawayId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (giveawayId) REFERENCES giveaways(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(giveawayId, userId)
      );
      CREATE INDEX IF NOT EXISTS idx_giveaway_entries_giveaway ON giveaway_entries(giveawayId);
    `);

    // Add xp column if it doesn't exist
    const userCols = db.prepare("PRAGMA table_info(users)").all();
    if (!userCols.find(c => c.name === 'xp')) {
      db.exec('ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0');
    }

    // giveaways predates ends_at/winner_ids -- added so expiry can be checked cheaply (epoch ms)
    // and so finalized winners are recorded without overloading the "winners" (requested count) column.
    const giveawayCols = db.prepare("PRAGMA table_info(giveaways)").all();
    if (!giveawayCols.find(c => c.name === 'ends_at')) {
      db.exec('ALTER TABLE giveaways ADD COLUMN ends_at INTEGER');
    }
    if (!giveawayCols.find(c => c.name === 'winner_ids')) {
      db.exec('ALTER TABLE giveaways ADD COLUMN winner_ids TEXT');
    }

    // Crash game tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS crash_games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crash_point REAL NOT NULL,
        status TEXT DEFAULT 'betting',
        created_at INTEGER NOT NULL,
        started_at INTEGER,
        crashed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS crash_bets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        cashout_multiplier REAL,
        status TEXT DEFAULT 'active',
        FOREIGN KEY (game_id) REFERENCES crash_games(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // Jackpot tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS jackpot_games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT DEFAULT 'depositing',
        winner_user_id INTEGER,
        house_won INTEGER DEFAULT 0,
        total_pot INTEGER DEFAULT 0,
        house_cut INTEGER DEFAULT 0,
        winning_ticket REAL,
        created_at INTEGER NOT NULL,
        spinning_at INTEGER,
        finished_at INTEGER,
        FOREIGN KEY (winner_user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS jackpot_deposits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        amount INTEGER NOT NULL,
        ticket_start REAL NOT NULL,
        ticket_end REAL NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (game_id) REFERENCES jackpot_games(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);

    // Migrations — safe to run on every startup
    try { db.exec(`ALTER TABLE jackpot_games ADD COLUMN house_won INTEGER DEFAULT 0`); } catch { /* column already exists */ }

    // Reward state table (cooldowns/one-time rewards). Integers are epoch-ms.
    db.exec(`
      CREATE TABLE IF NOT EXISTS reward_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        rewardKey TEXT NOT NULL,
        lastClaimAt INTEGER NOT NULL,
        claimCount INTEGER DEFAULT 1,
        meta TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(userId, rewardKey)
      );
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(createdAt);
      CREATE INDEX IF NOT EXISTS idx_crash_games_status ON crash_games(status);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_crash_bets_game_user ON crash_bets(game_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_jackpot_games_status ON jackpot_games(status);
      CREATE INDEX IF NOT EXISTS idx_jackpot_deposits_game ON jackpot_deposits(game_id);
      CREATE INDEX IF NOT EXISTS idx_blackjack_players_table ON blackjack_players(tableId);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_state_user_key ON reward_state(userId, rewardKey);
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS voice_reward_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT UNIQUE NOT NULL,
        userId INTEGER NOT NULL,
        discordId TEXT NOT NULL,
        guildId TEXT,
        channelId TEXT,
        durationMs INTEGER NOT NULL DEFAULT 0,
        amountRequested INTEGER NOT NULL DEFAULT 0,
        amountGranted INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_voice_reward_claims_user ON voice_reward_claims(userId);
      CREATE INDEX IF NOT EXISTS idx_voice_reward_claims_created ON voice_reward_claims(createdAt);
    `);

    // Ad-slot system: centrally-managed placements across the landing page and
    // this app. "mode" defaults to 'house' (self-promo for our own shop products)
    // and is a ready-made hook for a real ad network later — see src/lib/ads.js.
    db.exec(`
      CREATE TABLE IF NOT EXISTS ad_slots (
        key TEXT PRIMARY KEY,
        enabled INTEGER DEFAULT 1,
        mode TEXT DEFAULT 'house' CHECK(mode IN ('house', 'adsense', 'custom', 'off')),
        title TEXT,
        description TEXT,
        imageEmoji TEXT,
        linkUrl TEXT,
        ctaText TEXT,
        badgeText TEXT DEFAULT 'Anzeige',
        networkClient TEXT,
        networkSlotId TEXT,
        updatedAt TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS ad_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slotKey TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('impression', 'click')),
        page TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (slotKey) REFERENCES ad_slots(key) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_ad_events_slot_type ON ad_events(slotKey, type);
      CREATE INDEX IF NOT EXISTS idx_ad_events_created ON ad_events(createdAt);
    `);

    // Seed default house ads so slots look intentional from day one instead of
    // empty boxes. INSERT OR IGNORE — only applies on first creation, never
    // overwrites content an admin has since edited via /admin/ads.
    db.prepare(
      `INSERT OR IGNORE INTO ad_slots (key, enabled, mode, title, description, imageEmoji, linkUrl, ctaText, badgeText)
       VALUES ('landing-midcontent', 1, 'house', 'Fahrstuhl Premium', 'Mehr Automatisierung, mehr Anpassung, mehr Komfort für deinen Discord-Server.', '🚀', 'https://shop.eselbande.com', 'Jetzt entdecken →', 'Anzeige')`
    ).run();
    db.prepare(
      `INSERT OR IGNORE INTO ad_slots (key, enabled, mode, title, description, imageEmoji, linkUrl, ctaText, badgeText)
       VALUES ('eseltokens-dashboard', 1, 'house', 'Eselbuilder Pro', 'KI-Server-Aufbau ohne Limits, mehr EselFreund-Minuten und Prio-Support.', '🤖', 'https://shop.eselbande.com', 'Pro holen →', 'Anzeige')`
    ).run();

    // Mines: minePositions bleibt server-seitig geheim (nie an den Client geschickt,
    // solange status='active') -- erst bei bust/cashout wird das volle Feld aufgedeckt.
    // Ein User darf immer nur ein aktives Spiel haben (partial unique index unten).
    db.exec(`
      CREATE TABLE IF NOT EXISTS mines_games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        bet INTEGER NOT NULL,
        mineCount INTEGER NOT NULL,
        gridSize INTEGER NOT NULL DEFAULT 25,
        minePositions TEXT NOT NULL,
        revealedTiles TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'cashed', 'busted')),
        multiplier REAL NOT NULL DEFAULT 1,
        payout INTEGER,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mines_games_user_active
        ON mines_games(userId) WHERE status = 'active';
      CREATE INDEX IF NOT EXISTS idx_mines_games_user ON mines_games(userId);
    `);
  }
  return db;
}

export default getDb;
