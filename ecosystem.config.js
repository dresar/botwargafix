module.exports = {
  apps: [{
    name: 'whatsapp-bot',
    script: 'index.js',
    instances: 1, // Hanya 1 instance untuk 1 core
    exec_mode: 'fork', // Fork mode untuk single instance
    
    // Memory Management - Optimasi untuk 1GB RAM
    max_memory_restart: '800M', // Restart jika memory > 800MB
    node_args: '--max-old-space-size=768', // Limit heap size Node.js untuk 1GB RAM
    
    // Environment
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      MAX_CACHE_SIZE: '200MB', // Batasi cache maksimal 200MB
      CACHE_TTL: '1800000', // Cache TTL 30 menit (lebih pendek)
      AUTO_CLEANUP_INTERVAL: '900000', // Cleanup otomatis setiap 15 menit
      MEMORY_THRESHOLD: '600MB', // Threshold untuk cleanup paksa
      
      // Database optimization untuk VPS kecil
      DB_POOL_MIN: 1,
      DB_POOL_MAX: 3,
      DB_IDLE_TIMEOUT: 60000,
      
      // Session management
      SESSION_CLEANUP_INTERVAL: '1800000', // 30 menit
      MAX_SESSIONS: 100 // Batasi session untuk menghemat memory
    },
    
    // Logging - Batasi ukuran log untuk storage terbatas
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_log_size: '50M', // Maksimal 50MB per file log
    max_log_files: 3, // Maksimal 3 file log (total ~150MB)
    
    // Auto Restart Configuration
    autorestart: true,
    watch: false, // Disable watch di production untuk performa
    max_restarts: 5, // Maksimal restart 5 kali untuk VPS kecil
    min_uptime: '30s', // Minimal uptime lebih lama untuk stabilitas
    
    // Performance Optimization
    kill_timeout: 3000, // Lebih cepat untuk VPS kecil
    listen_timeout: 5000,
    
    // Process Management
    ignore_watch: ['node_modules', 'logs', 'sessions', 'cache'],
    
    // Graceful shutdown
    wait_ready: true,
    
    // Cache & Memory Optimization
    cron_restart: '0 2 * * *', // Restart harian jam 2 pagi untuk clear cache
    
    // Health Check
    health_check_grace_period: 3000,
    
    // Advanced Settings untuk WhatsApp Bot
    increment_var: 'PORT',
    
    // Script untuk cleanup cache sebelum restart
    pre_reload: './scripts/cleanup-cache.js'
  }],
  
  // Deploy configuration (opsional)
  deploy: {
    production: {
      user: 'node',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:repo.git',
      path: '/var/www/production',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};