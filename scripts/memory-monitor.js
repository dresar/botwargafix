// Script monitoring memori untuk VPS produksi
const fs = require('fs');
const path = require('path');
const productionConfig = require('../production.config.js');

class MemoryMonitor {
    constructor() {
        this.config = productionConfig.monitoring;
        this.isMonitoring = false;
        this.logFile = path.join(__dirname, '../logs/memory.log');
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            rss: Math.round(usage.rss / 1024 / 1024), // MB
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
            external: Math.round(usage.external / 1024 / 1024), // MB
            timestamp: new Date().toISOString()
        };
    }

    logMemoryUsage(usage, level = 'info') {
        const logEntry = `[${usage.timestamp}] ${level.toUpperCase()}: RSS=${usage.rss}MB, Heap=${usage.heapUsed}/${usage.heapTotal}MB, External=${usage.external}MB\n`;
        
        // Log ke console hanya jika dalam mode development
        if (process.env.NODE_ENV === 'development') {
            console.log(logEntry.trim());
        }
        
        // Selalu log ke file
        fs.appendFileSync(this.logFile, logEntry);
    }

    checkMemoryThresholds(usage) {
        const totalMemory = usage.rss;
        
        if (totalMemory >= this.config.memoryCriticalThreshold) {
            this.logMemoryUsage(usage, 'critical');
            this.performEmergencyCleanup();
            return 'critical';
        } else if (totalMemory >= this.config.memoryWarningThreshold) {
            this.logMemoryUsage(usage, 'warning');
            this.performGarbageCollection();
            return 'warning';
        }
        
        return 'normal';
    }

    performGarbageCollection() {
        if (global.gc) {
            global.gc();
            if (process.env.NODE_ENV === 'development') {
                console.log('🗑️ Manual garbage collection performed');
            }
        }
    }

    performEmergencyCleanup() {
        // Bersihkan cache yang tidak perlu
        if (global.processedMessages) {
            const oldSize = global.processedMessages.size;
            global.processedMessages.clear();
            if (process.env.NODE_ENV === 'development') {
                console.log(`🚨 Emergency cleanup: Cleared ${oldSize} processed messages`);
            }
        }

        // Force garbage collection
        this.performGarbageCollection();
        
        // Log emergency action
        const logEntry = `[${new Date().toISOString()}] EMERGENCY: Memory cleanup performed\n`;
        fs.appendFileSync(this.logFile, logEntry);
    }

    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        const interval = this.config.memoryCheckInterval * 1000;
        
        if (process.env.NODE_ENV === 'development') {
            console.log(`🔍 Memory monitoring started (interval: ${this.config.memoryCheckInterval}s)`);
        }
        
        this.monitoringInterval = setInterval(() => {
            const usage = this.getMemoryUsage();
            const status = this.checkMemoryThresholds(usage);
            
            // Log setiap 10 menit dalam mode normal
            if (Date.now() % (10 * 60 * 1000) < interval) {
                this.logMemoryUsage(usage, 'info');
            }
        }, interval);

        // Cleanup log files yang lama setiap hari
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldLogs();
        }, 24 * 60 * 60 * 1000);
    }

    stopMonitoring() {
        if (!this.isMonitoring) return;
        
        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        if (process.env.NODE_ENV === 'development') {
            console.log('🔍 Memory monitoring stopped');
        }
    }

    cleanupOldLogs() {
        try {
            const stats = fs.statSync(this.logFile);
            const fileSizeMB = stats.size / 1024 / 1024;
            
            // Jika file log lebih dari 10MB, rotate
            if (fileSizeMB > 10) {
                const backupFile = this.logFile.replace('.log', `-${Date.now()}.log`);
                fs.renameSync(this.logFile, backupFile);
                
                // Hapus backup yang lebih dari 7 hari
                setTimeout(() => {
                    if (fs.existsSync(backupFile)) {
                        fs.unlinkSync(backupFile);
                    }
                }, 7 * 24 * 60 * 60 * 1000);
            }
        } catch (error) {
            // Ignore errors in log cleanup
        }
    }

    getMemoryReport() {
        const usage = this.getMemoryUsage();
        return {
            current: usage,
            thresholds: {
                warning: this.config.memoryWarningThreshold,
                critical: this.config.memoryCriticalThreshold
            },
            status: this.checkMemoryThresholds(usage)
        };
    }
}

// Export singleton instance
const memoryMonitor = new MemoryMonitor();

// Auto-start monitoring jika dijalankan langsung
if (require.main === module) {
    memoryMonitor.startMonitoring();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        memoryMonitor.stopMonitoring();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        memoryMonitor.stopMonitoring();
        process.exit(0);
    });
}

module.exports = memoryMonitor;