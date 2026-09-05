/**
 * Controller untuk Menu TXT System
 * Menangani navigasi dan interaksi dengan menu berbasis file TXT
 */

const TxtMenuSystem = require('../utils/txtMenuSystem');
const logger = require('../utils/logger');

class TxtMenuController {
    constructor() {
        this.txtMenuSystem = new TxtMenuSystem();
        this.userSessions = new Map(); // Menyimpan session navigasi user
        this.isInitialized = false;
    }

    /**
     * Inisialisasi controller
     */
    async initialize() {
        try {
            if (process.env.NODE_ENV === 'development') {
                console.log('🔄 Menginisialisasi TXT Menu Controller...');
            }
            
            const success = await this.txtMenuSystem.initialize();
            if (success) {
                this.isInitialized = true;
                if (process.env.NODE_ENV === 'development') {
                    console.log('✅ TXT Menu Controller berhasil diinisialisasi');
                    
                    // Log statistik menu
                    const stats = this.txtMenuSystem.getStatistics();
                    console.log(`📊 Statistik Menu: ${stats.totalMenus} menu, ${stats.totalItems} item`);
                }
                
                return true;
            } else {
                console.error('❌ Gagal menginisialisasi TXT Menu Controller');
                return false;
            }
        } catch (error) {
            console.error('❌ Error inisialisasi TXT Menu Controller:', error);
            logger.error('TxtMenuController initialization error', { error: error.message });
            return false;
        }
    }

    /**
     * Handle pesan menu dari user
     */
    async handleMenuMessage(userId, message, sock) {
        try {
            if (!this.isInitialized) {
                return 'Sistem menu sedang dalam proses inisialisasi. Silakan coba lagi.';
            }

            const userMessage = message.toLowerCase().trim();
            
            // Dapatkan atau buat session user
            let userSession = this.getUserSession(userId);
            
            // Handle perintah khusus
            if (userMessage === 'menu' || userMessage === '/menu') {
                return await this.showMainMenu(userId);
            }
            
            if (userMessage === 'back' || userMessage === '/back') {
                return await this.goBack(userId);
            }
            
            if (userMessage === 'home' || userMessage === '/home') {
                return await this.goHome(userId);
            }
            
            // Handle navigasi berdasarkan nomor
            if (/^\d+$/.test(userMessage)) {
                return await this.handleNumberSelection(userId, parseInt(userMessage));
            }
            
            // Handle navigasi berdasarkan action ID
            if (userMessage.includes('_')) {
                return await this.handleActionSelection(userId, userMessage);
            }
            
            // Jika tidak ada yang cocok, tampilkan menu saat ini
            return await this.showCurrentMenu(userId);
            
        } catch (error) {
            console.error('❌ Error handling menu message:', error);
            logger.error('Menu message handling error', { 
                userId, 
                message, 
                error: error.message 
            });
            return 'Terjadi kesalahan dalam memproses menu. Silakan coba lagi.';
        }
    }

    /**
     * Dapatkan session user
     */
    getUserSession(userId) {
        if (!this.userSessions.has(userId)) {
            this.userSessions.set(userId, {
                currentMenu: 'main',
                menuHistory: [],
                lastActivity: new Date()
            });
        }
        
        // Update last activity
        const session = this.userSessions.get(userId);
        session.lastActivity = new Date();
        
        return session;
    }

    /**
     * Tampilkan menu utama
     */
    async showMainMenu(userId) {
        try {
            const session = this.getUserSession(userId);
            session.currentMenu = 'main';
            session.menuHistory = [];
            
            const menuContent = this.txtMenuSystem.formatMenuForWhatsApp('main');
            
            if (menuContent.includes('tidak ditemukan')) {
                return '❌ Menu utama tidak tersedia. Silakan hubungi administrator.';
            }
            
            return menuContent + '\n\n💡 *Cara Penggunaan:*\n- Ketik nomor pilihan (1, 2, 3, dst)\n- Ketik "back" untuk kembali\n- Ketik "home" untuk ke menu utama';
            
        } catch (error) {
            console.error('❌ Error showing main menu:', error);
            return 'Terjadi kesalahan dalam menampilkan menu utama.';
        }
    }

    /**
     * Tampilkan menu saat ini
     */
    async showCurrentMenu(userId) {
        try {
            const session = this.getUserSession(userId);
            const menuContent = this.txtMenuSystem.formatMenuForWhatsApp(session.currentMenu);
            
            if (menuContent.includes('tidak ditemukan')) {
                // Jika menu tidak ditemukan, kembali ke menu utama
                return await this.showMainMenu(userId);
            }
            
            return menuContent + '\n\n💡 Ketik nomor pilihan atau "back" untuk kembali';
            
        } catch (error) {
            console.error('❌ Error showing current menu:', error);
            return 'Terjadi kesalahan dalam menampilkan menu.';
        }
    }

    /**
     * Handle pemilihan berdasarkan nomor
     */
    async handleNumberSelection(userId, number) {
        try {
            const session = this.getUserSession(userId);
            const menu = this.txtMenuSystem.getMenu(session.currentMenu);
            
            if (!menu || !menu.items || menu.items.length === 0) {
                return 'Menu tidak tersedia atau kosong.';
            }
            
            if (number < 1 || number > menu.items.length) {
                return `❌ Pilihan tidak valid. Silakan pilih nomor 1-${menu.items.length}.`;
            }
            
            const selectedItem = menu.items[number - 1];
            
            // Jika ada action, proses action
            if (selectedItem.action) {
                return await this.processAction(userId, selectedItem.action, selectedItem);
            }
            
            return `✅ Anda memilih: *${selectedItem.name}*\n\n${selectedItem.description || 'Tidak ada deskripsi tersedia.'}`;
            
        } catch (error) {
            console.error('❌ Error handling number selection:', error);
            return 'Terjadi kesalahan dalam memproses pilihan.';
        }
    }

    /**
     * Handle pemilihan berdasarkan action ID
     */
    async handleActionSelection(userId, actionId) {
        try {
            return await this.processAction(userId, actionId);
        } catch (error) {
            console.error('❌ Error handling action selection:', error);
            return 'Terjadi kesalahan dalam memproses aksi.';
        }
    }

    /**
     * Proses action yang dipilih
     */
    async processAction(userId, action, item = null) {
        try {
            const session = this.getUserSession(userId);
            
            // Handle navigasi ke menu lain
            if (this.txtMenuSystem.getMenu(action)) {
                // Simpan menu saat ini ke history
                session.menuHistory.push(session.currentMenu);
                session.currentMenu = action;
                
                return await this.showCurrentMenu(userId);
            }
            
            // Handle action khusus
            switch (action) {
                case 'back_main':
                    return await this.showMainMenu(userId);
                    
                case 'info_desa':
                case 'admin_services':
                case 'umkm':
                case 'complaints':
                case 'news':
                case 'tourism':
                case 'contacts':
                case 'help':
                    // Navigasi ke submenu
                    session.menuHistory.push(session.currentMenu);
                    session.currentMenu = action;
                    return await this.showCurrentMenu(userId);
                    
                default:
                    // Action yang belum diimplementasi
                    const actionName = item ? item.name : action;
                    return `🔧 Fitur "${actionName}" sedang dalam pengembangan.\n\nSilakan pilih menu lain atau hubungi administrator untuk informasi lebih lanjut.\n\nKetik "back" untuk kembali ke menu sebelumnya.`;
            }
            
        } catch (error) {
            console.error('❌ Error processing action:', error);
            return 'Terjadi kesalahan dalam memproses aksi.';
        }
    }

    /**
     * Kembali ke menu sebelumnya
     */
    async goBack(userId) {
        try {
            const session = this.getUserSession(userId);
            
            if (session.menuHistory.length === 0) {
                return await this.showMainMenu(userId);
            }
            
            session.currentMenu = session.menuHistory.pop();
            return await this.showCurrentMenu(userId);
            
        } catch (error) {
            console.error('❌ Error going back:', error);
            return 'Terjadi kesalahan. Kembali ke menu utama.';
        }
    }

    /**
     * Kembali ke menu utama
     */
    async goHome(userId) {
        return await this.showMainMenu(userId);
    }

    /**
     * Cari menu berdasarkan kata kunci
     */
    async searchMenus(userId, keyword) {
        try {
            const results = this.txtMenuSystem.searchMenus(keyword);
            
            if (results.length === 0) {
                return `🔍 Tidak ditemukan menu dengan kata kunci "${keyword}".\n\nKetik "menu" untuk melihat semua menu yang tersedia.`;
            }
            
            let response = `🔍 *Hasil Pencarian untuk "${keyword}":*\n\n`;
            
            results.forEach((menu, index) => {
                response += `${index + 1}. *${menu.title}*\n`;
                if (menu.description) {
                    response += `   ${menu.description}\n`;
                }
                response += `\n`;
            });
            
            response += '💡 Ketik "menu" untuk melihat menu lengkap';
            
            return response;
            
        } catch (error) {
            console.error('❌ Error searching menus:', error);
            return 'Terjadi kesalahan dalam pencarian menu.';
        }
    }

    /**
     * Dapatkan statistik penggunaan menu
     */
    getUsageStatistics() {
        const menuStats = this.txtMenuSystem.getStatistics();
        const activeUsers = this.userSessions.size;
        
        return {
            ...menuStats,
            activeUsers,
            isInitialized: this.isInitialized
        };
    }

    /**
     * Bersihkan session yang tidak aktif
     */
    cleanupInactiveSessions() {
        const now = new Date();
        const maxInactiveTime = 30 * 60 * 1000; // 30 menit
        
        for (const [userId, session] of this.userSessions.entries()) {
            if (now - session.lastActivity > maxInactiveTime) {
                this.userSessions.delete(userId);
                console.log(`🧹 Session user ${userId} dibersihkan karena tidak aktif`);
            }
        }
    }

    /**
     * Reload menu dari file
     */
    async reloadMenus() {
        try {
            console.log('🔄 Memuat ulang menu dari file...');
            await this.txtMenuSystem.loadAllMenus();
            console.log('✅ Menu berhasil dimuat ulang');
            return true;
        } catch (error) {
            console.error('❌ Error reloading menus:', error);
            return false;
        }
    }

    /**
     * Shutdown controller
     */
    async shutdown() {
        try {
            console.log('🔄 Menutup TXT Menu Controller...');
            
            await this.txtMenuSystem.shutdown();
            this.userSessions.clear();
            this.isInitialized = false;
            
            console.log('✅ TXT Menu Controller berhasil ditutup');
        } catch (error) {
            console.error('❌ Error shutting down TXT Menu Controller:', error);
        }
    }
}

module.exports = TxtMenuController;