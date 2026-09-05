/**
 * Sistem Update Menu TXT Real-time
 * Memungkinkan admin untuk mengedit menu melalui perintah bot
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class MenuUpdateSystem {
    constructor(menuDirectory = 'uploads/menus') {
        this.menuDirectory = path.resolve(menuDirectory);
        this.backupDirectory = path.join(this.menuDirectory, 'backups');
        this.ensureDirectories();
    }

    /**
     * Pastikan direktori ada
     */
    ensureDirectories() {
        if (!fs.existsSync(this.menuDirectory)) {
            fs.mkdirSync(this.menuDirectory, { recursive: true });
        }
        if (!fs.existsSync(this.backupDirectory)) {
            fs.mkdirSync(this.backupDirectory, { recursive: true });
        }
    }

    /**
     * Buat backup menu sebelum update
     */
    createBackup(menuId) {
        try {
            const sourceFile = path.join(this.menuDirectory, `${menuId}.txt`);
            if (!fs.existsSync(sourceFile)) {
                return false;
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(this.backupDirectory, `${menuId}_${timestamp}.txt`);
            
            fs.copyFileSync(sourceFile, backupFile);
            console.log(`💾 Backup menu '${menuId}' dibuat: ${backupFile}`);
            
            return true;
        } catch (error) {
            console.error(`❌ Error creating backup for '${menuId}':`, error);
            return false;
        }
    }

    /**
     * Update menu dengan konten baru
     */
    async updateMenu(menuId, newContent, adminId) {
        try {
            // Buat backup terlebih dahulu
            this.createBackup(menuId);
            
            const filePath = path.join(this.menuDirectory, `${menuId}.txt`);
            
            // Validasi konten
            if (!this.validateMenuContent(newContent)) {
                throw new Error('Format konten menu tidak valid');
            }
            
            // Tulis konten baru
            fs.writeFileSync(filePath, newContent, 'utf8');
            
            // Log update
            const logData = {
                menuId,
                adminId,
                timestamp: new Date().toISOString(),
                action: 'update',
                success: true
            };
            
            logger.info('Menu updated', logData);
            console.log(`✅ Menu '${menuId}' berhasil diupdate oleh admin ${adminId}`);
            
            return {
                success: true,
                message: `Menu '${menuId}' berhasil diupdate`,
                timestamp: logData.timestamp
            };
            
        } catch (error) {
            console.error(`❌ Error updating menu '${menuId}':`, error);
            
            const logData = {
                menuId,
                adminId,
                timestamp: new Date().toISOString(),
                action: 'update',
                success: false,
                error: error.message
            };
            
            logger.error('Menu update failed', logData);
            
            return {
                success: false,
                message: `Gagal mengupdate menu '${menuId}': ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * Tambah item baru ke menu
     */
    async addMenuItem(menuId, newItem, adminId) {
        try {
            const filePath = path.join(this.menuDirectory, `${menuId}.txt`);
            
            if (!fs.existsSync(filePath)) {
                throw new Error(`Menu '${menuId}' tidak ditemukan`);
            }
            
            // Buat backup
            this.createBackup(menuId);
            
            // Baca konten saat ini
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Format item baru
            const formattedItem = this.formatMenuItem(newItem);
            
            // Tambahkan item ke bagian ITEMS
            if (content.includes('ITEMS:')) {
                content += `${formattedItem}\n`;
            } else {
                content += `\nITEMS:\n${formattedItem}\n`;
            }
            
            // Tulis kembali
            fs.writeFileSync(filePath, content, 'utf8');
            
            console.log(`✅ Item baru ditambahkan ke menu '${menuId}' oleh admin ${adminId}`);
            
            return {
                success: true,
                message: `Item baru berhasil ditambahkan ke menu '${menuId}'`
            };
            
        } catch (error) {
            console.error(`❌ Error adding item to menu '${menuId}':`, error);
            return {
                success: false,
                message: `Gagal menambah item ke menu '${menuId}': ${error.message}`
            };
        }
    }

    /**
     * Hapus item dari menu
     */
    async removeMenuItem(menuId, itemIndex, adminId) {
        try {
            const filePath = path.join(this.menuDirectory, `${menuId}.txt`);
            
            if (!fs.existsSync(filePath)) {
                throw new Error(`Menu '${menuId}' tidak ditemukan`);
            }
            
            // Buat backup
            this.createBackup(menuId);
            
            // Baca dan parse konten
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            // Cari dan hapus item
            let itemCount = 0;
            let targetLineIndex = -1;
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().startsWith('- ')) {
                    itemCount++;
                    if (itemCount === itemIndex) {
                        targetLineIndex = i;
                        break;
                    }
                }
            }
            
            if (targetLineIndex === -1) {
                throw new Error(`Item dengan index ${itemIndex} tidak ditemukan`);
            }
            
            // Hapus baris
            lines.splice(targetLineIndex, 1);
            
            // Tulis kembali
            fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
            
            console.log(`✅ Item index ${itemIndex} dihapus dari menu '${menuId}' oleh admin ${adminId}`);
            
            return {
                success: true,
                message: `Item berhasil dihapus dari menu '${menuId}'`
            };
            
        } catch (error) {
            console.error(`❌ Error removing item from menu '${menuId}':`, error);
            return {
                success: false,
                message: `Gagal menghapus item dari menu '${menuId}': ${error.message}`
            };
        }
    }

    /**
     * Buat menu baru
     */
    async createNewMenu(menuId, title, description, items, adminId) {
        try {
            const filePath = path.join(this.menuDirectory, `${menuId}.txt`);
            
            if (fs.existsSync(filePath)) {
                throw new Error(`Menu '${menuId}' sudah ada`);
            }
            
            let content = `TITLE: ${title}\n`;
            if (description) {
                content += `DESCRIPTION: ${description}\n`;
            }
            content += `\nITEMS:\n`;
            
            // Tambahkan items
            if (items && items.length > 0) {
                items.forEach(item => {
                    content += this.formatMenuItem(item) + '\n';
                });
            }
            
            fs.writeFileSync(filePath, content, 'utf8');
            
            console.log(`✅ Menu baru '${menuId}' dibuat oleh admin ${adminId}`);
            
            return {
                success: true,
                message: `Menu baru '${menuId}' berhasil dibuat`
            };
            
        } catch (error) {
            console.error(`❌ Error creating new menu '${menuId}':`, error);
            return {
                success: false,
                message: `Gagal membuat menu baru '${menuId}': ${error.message}`
            };
        }
    }

    /**
     * Hapus menu
     */
    async deleteMenu(menuId, adminId) {
        try {
            const filePath = path.join(this.menuDirectory, `${menuId}.txt`);
            
            if (!fs.existsSync(filePath)) {
                throw new Error(`Menu '${menuId}' tidak ditemukan`);
            }
            
            // Buat backup sebelum hapus
            this.createBackup(menuId);
            
            // Hapus file
            fs.unlinkSync(filePath);
            
            console.log(`🗑️ Menu '${menuId}' dihapus oleh admin ${adminId}`);
            
            return {
                success: true,
                message: `Menu '${menuId}' berhasil dihapus`
            };
            
        } catch (error) {
            console.error(`❌ Error deleting menu '${menuId}':`, error);
            return {
                success: false,
                message: `Gagal menghapus menu '${menuId}': ${error.message}`
            };
        }
    }

    /**
     * Format item menu
     */
    formatMenuItem(item) {
        if (typeof item === 'string') {
            return `- ${item}`;
        }
        
        let formatted = `- ${item.name || item.text || 'Item'}`;
        if (item.description) {
            formatted += ` | ${item.description}`;
        }
        if (item.action) {
            formatted += ` | ${item.action}`;
        }
        
        return formatted;
    }

    /**
     * Validasi konten menu
     */
    validateMenuContent(content) {
        try {
            // Cek apakah ada TITLE
            if (!content.includes('TITLE:')) {
                return false;
            }
            
            // Cek format dasar
            const lines = content.split('\n');
            let hasValidStructure = false;
            
            for (const line of lines) {
                if (line.trim().startsWith('TITLE:') || 
                    line.trim().startsWith('DESCRIPTION:') || 
                    line.trim().startsWith('ITEMS:') ||
                    line.trim().startsWith('- ')) {
                    hasValidStructure = true;
                    break;
                }
            }
            
            return hasValidStructure;
        } catch (error) {
            return false;
        }
    }

    /**
     * Dapatkan daftar menu yang tersedia
     */
    getAvailableMenus() {
        try {
            const files = fs.readdirSync(this.menuDirectory);
            return files
                .filter(file => file.endsWith('.txt'))
                .map(file => path.basename(file, '.txt'));
        } catch (error) {
            console.error('❌ Error getting available menus:', error);
            return [];
        }
    }

    /**
     * Dapatkan konten menu untuk editing
     */
    getMenuContent(menuId) {
        try {
            const filePath = path.join(this.menuDirectory, `${menuId}.txt`);
            
            if (!fs.existsSync(filePath)) {
                return null;
            }
            
            return fs.readFileSync(filePath, 'utf8');
        } catch (error) {
            console.error(`❌ Error reading menu '${menuId}':`, error);
            return null;
        }
    }

    /**
     * Restore menu dari backup
     */
    async restoreFromBackup(menuId, backupTimestamp, adminId) {
        try {
            const backupFile = path.join(this.backupDirectory, `${menuId}_${backupTimestamp}.txt`);
            
            if (!fs.existsSync(backupFile)) {
                throw new Error(`Backup tidak ditemukan: ${backupTimestamp}`);
            }
            
            const targetFile = path.join(this.menuDirectory, `${menuId}.txt`);
            
            // Buat backup dari versi saat ini sebelum restore
            if (fs.existsSync(targetFile)) {
                this.createBackup(menuId);
            }
            
            // Copy backup ke file aktif
            fs.copyFileSync(backupFile, targetFile);
            
            console.log(`🔄 Menu '${menuId}' direstore dari backup ${backupTimestamp} oleh admin ${adminId}`);
            
            return {
                success: true,
                message: `Menu '${menuId}' berhasil direstore dari backup`
            };
            
        } catch (error) {
            console.error(`❌ Error restoring menu '${menuId}':`, error);
            return {
                success: false,
                message: `Gagal restore menu '${menuId}': ${error.message}`
            };
        }
    }

    /**
     * Dapatkan daftar backup untuk menu
     */
    getMenuBackups(menuId) {
        try {
            const files = fs.readdirSync(this.backupDirectory);
            return files
                .filter(file => file.startsWith(`${menuId}_`) && file.endsWith('.txt'))
                .map(file => {
                    const timestamp = file.replace(`${menuId}_`, '').replace('.txt', '');
                    const filePath = path.join(this.backupDirectory, file);
                    const stats = fs.statSync(filePath);
                    
                    return {
                        timestamp,
                        filename: file,
                        size: stats.size,
                        created: stats.mtime
                    };
                })
                .sort((a, b) => b.created - a.created);
        } catch (error) {
            console.error(`❌ Error getting backups for '${menuId}':`, error);
            return [];
        }
    }

    /**
     * Bersihkan backup lama
     */
    cleanupOldBackups(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 hari
        try {
            const files = fs.readdirSync(this.backupDirectory);
            const now = new Date();
            let cleanedCount = 0;
            
            files.forEach(file => {
                const filePath = path.join(this.backupDirectory, file);
                const stats = fs.statSync(filePath);
                
                if (now - stats.mtime > maxAge) {
                    fs.unlinkSync(filePath);
                    cleanedCount++;
                }
            });
            
            if (cleanedCount > 0) {
                console.log(`🧹 ${cleanedCount} backup lama dibersihkan`);
            }
            
            return cleanedCount;
        } catch (error) {
            console.error('❌ Error cleaning up old backups:', error);
            return 0;
        }
    }
}

module.exports = MenuUpdateSystem;