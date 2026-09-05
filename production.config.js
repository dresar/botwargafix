// Konfigurasi produksi untuk VPS dengan spesifikasi terbatas
// 1 core, 1GB RAM, 20GB storage

module.exports = {
  // Optimasi memori
  memory: {
    // Batasi heap memory ke 1GB (1024MB)
    maxOldSpaceSize: 1024,
    // Optimasi untuk ukuran yang lebih kecil
    optimizeForSize: true,
    // Garbage collection yang lebih agresif
    exposeGC: true
  },

  // Optimasi database
  database: {
    // Cache size untuk SQLite (dalam KB)
    cacheSize: 2000, // 2MB cache
    // Timeout untuk operasi database
    busyTimeout: 5000,
    // WAL mode untuk performa yang lebih baik
    walMode: true,
    // Synchronous mode untuk keamanan data
    synchronous: 'NORMAL'
  },

  // Optimasi WhatsApp
  whatsapp: {
    // Batasi cache pesan
    maxCachedMessages: 100,
    // Interval pembersihan cache (menit)
    cacheCleanupInterval: 30,
    // Timeout koneksi
    connectionTimeout: 60000
  },

  // Optimasi logging
  logging: {
    // Level log untuk produksi
    level: 'error',
    // Rotasi log harian
    maxFiles: 7,
    // Ukuran maksimal file log (MB)
    maxSize: 10
  },

  // Monitoring sistem
  monitoring: {
    // Interval monitoring memori (detik)
    memoryCheckInterval: 60,
    // Threshold peringatan memori (MB)
    memoryWarningThreshold: 800,
    // Threshold kritis memori (MB)
    memoryCriticalThreshold: 950
  },

  // Optimasi proses
  process: {
    // Cleanup interval untuk data lama (menit)
    cleanupInterval: 60,
    // Maksimal pesan yang disimpan dalam memori
    maxInMemoryMessages: 50,
    // Interval garbage collection manual (menit)
    gcInterval: 15
  }
};