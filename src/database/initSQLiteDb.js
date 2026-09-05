/**
 * Inisialisasi database SQLite dan data default
 */

const { connectSQLite } = require('../config/sqlite');
const { initMenuContentTables } = require('./menuContentSQLiteSchema');

// Inisialisasi koneksi database
const initSQLiteDatabase = () => {
  try {
    const db = connectSQLite();
    if (process.env.NODE_ENV === 'development') {
      console.log('Connected to SQLite database');
    }
    return db;
  } catch (error) {
    console.error('Error connecting to SQLite database:', error.message);
    throw error;
  }
};

// Inisialisasi tabel-tabel database
const initTables = (db) => {
  try {
    // Tabel menus
    db.exec(`
      CREATE TABLE IF NOT EXISTS menus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        order_num INTEGER NOT NULL,
        access_level TEXT DEFAULT 'public',
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabel sub_menus
    db.exec(`
      CREATE TABLE IF NOT EXISTS sub_menus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        menu_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        order_num INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (menu_id) REFERENCES menus(id)
      )
    `);

    // Tabel chat_memory
    db.exec(`
      CREATE TABLE IF NOT EXISTS chat_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        context TEXT,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Indeks untuk chat_memory
    db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_memory_user_id ON chat_memory(user_id)`);

    // Tabel users untuk tracking pengguna
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_number TEXT UNIQUE NOT NULL,
        name TEXT,
        is_new_user INTEGER DEFAULT 1,
        first_visit_date DATE DEFAULT CURRENT_DATE,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_interactions INTEGER DEFAULT 0,
        daily_count INTEGER DEFAULT 0,
        last_interaction_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabel daily_limits untuk tracking limit harian
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_limits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        date DATE DEFAULT CURRENT_DATE,
        interaction_count INTEGER DEFAULT 0,
        limit_reached INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      )
    `);
    
    // Indeks untuk daily_limits
    db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_limits_user_date ON daily_limits(user_id, date)`);

    // Tabel hourly_limits untuk limit per jam
    db.exec(`
      CREATE TABLE IF NOT EXISTS hourly_limits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_number TEXT NOT NULL,
        hour_key TEXT NOT NULL,
        interaction_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(phone_number, hour_key)
      )
    `);
    
    // Indeks untuk hourly_limits
    db.exec(`CREATE INDEX IF NOT EXISTS idx_hourly_limits_phone_hour ON hourly_limits(phone_number, hour_key)`);

    // Tabel chat_logs untuk tracking aktivitas chat
    db.exec(`
      CREATE TABLE IF NOT EXISTS chat_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_phone TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        message_content TEXT,
        response_type TEXT,
        session_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Indeks untuk chat_logs
    db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_logs_user_phone ON chat_logs(user_phone)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON chat_logs(created_at)`);

    // Tabel spam_detection untuk tracking pesan spam
    db.exec(`
      CREATE TABLE IF NOT EXISTS spam_detection (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_phone TEXT NOT NULL,
        message_timestamp TIMESTAMP NOT NULL,
        message_content TEXT,
        spam_score INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Indeks untuk spam_detection
    db.exec(`CREATE INDEX IF NOT EXISTS idx_spam_detection_phone ON spam_detection(user_phone)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_spam_detection_timestamp ON spam_detection(message_timestamp)`);

    // Tabel spam_blocked_users untuk user yang diblokir karena spam
    db.exec(`
      CREATE TABLE IF NOT EXISTS spam_blocked_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_phone TEXT NOT NULL UNIQUE,
        blocked_reason TEXT DEFAULT 'spam_detection',
        spam_count INTEGER DEFAULT 0,
        blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        unblocked_at TIMESTAMP NULL,
        is_blocked INTEGER DEFAULT 1,
        blocked_by TEXT DEFAULT 'system'
      )
    `);
    
    // Indeks untuk spam_blocked_users
    db.exec(`CREATE INDEX IF NOT EXISTS idx_spam_blocked_phone ON spam_blocked_users(user_phone)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_spam_blocked_status ON spam_blocked_users(is_blocked)`);

    // Tabel complaints
    db.exec(`
      CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        complaint_code TEXT NOT NULL,
        reporter_name TEXT,
        reporter_address TEXT,
        description TEXT,
        photo_path TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1
      )
    `);
    
    // Migrasi: Tambahkan kolom user_id dan phone_number jika belum ada
    try {
      db.exec('ALTER TABLE complaints ADD COLUMN user_id TEXT');
      console.log('Added user_id column to complaints table');
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        console.log('user_id column already exists or other error:', error.message);
      }
    }
    
    // Migrasi: Tambahkan kolom complaint_code jika belum ada
    try {
      db.exec('ALTER TABLE complaints ADD COLUMN complaint_code TEXT');
      console.log('Added complaint_code column to complaints table');
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        console.log('complaint_code column already exists or other error:', error.message);
      }
    }
    
    try {
      db.exec('ALTER TABLE complaints ADD COLUMN phone_number TEXT');
      console.log('Added phone_number column to complaints table');
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        console.log('phone_number column already exists or other error:', error.message);
      }
    }
    
    // Indeks untuk tabel complaints
    db.exec(`CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON complaints(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_complaints_phone ON complaints(phone_number)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status)`);

    // Tabel village_info
    db.exec(`
      CREATE TABLE IF NOT EXISTS village_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        image_path TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabel UMKM
    db.exec(`
      CREATE TABLE IF NOT EXISTS umkm (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama TEXT NOT NULL,
        deskripsi TEXT,
        kategori TEXT NOT NULL,
        alamat TEXT,
        kontak_telepon TEXT,
        kontak_whatsapp TEXT,
        kontak_email TEXT,
        jam_operasional TEXT,
        website TEXT,
        media_sosial TEXT,
        latitude REAL,
        longitude REAL,
        foto_path TEXT,
        status TEXT DEFAULT 'aktif',
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indeks untuk tabel UMKM
    db.exec(`CREATE INDEX IF NOT EXISTS idx_umkm_kategori ON umkm(kategori)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_umkm_status ON umkm(status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_umkm_active ON umkm(is_active)`);

    // Inisialisasi tabel konten menu
    initMenuContentTables(db);

    if (process.env.NODE_ENV === 'development') {
      console.log('All tables initialized successfully');
    }
  } catch (error) {
    console.error('Error initializing tables:', error.message);
    throw error;
  }
};

// Inisialisasi database dan tabel
const initDatabaseAndTables = () => {
  const db = initSQLiteDatabase();
  initTables(db);
  return db;
};

module.exports = {
  initSQLiteDatabase,
  initTables,
  initDatabaseAndTables
};