/**
 * Sistem Menu Berbasis File TXT
 * Dapat membaca dan memperbarui menu dari file TXT secara real-time
 */

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

class TxtMenuSystem {
    constructor(menuDirectory = 'uploads/menus') {
        this.menuDirectory = path.resolve(menuDirectory);
        this.menus = new Map();
        this.watchers = new Map();
        this.isInitialized = false;
        
        // Pastikan direktori menu ada
        this.ensureMenuDirectory();
    }

    /**
     * Pastikan direktori menu ada
     */
    ensureMenuDirectory() {
        if (!fs.existsSync(this.menuDirectory)) {
            fs.mkdirSync(this.menuDirectory, { recursive: true });
            if (process.env.NODE_ENV === 'development') {
                console.log(`📁 Direktori menu dibuat: ${this.menuDirectory}`);
            }
        }
    }

    /**
     * Inisialisasi sistem menu
     */
    async initialize() {
        try {
            if (process.env.NODE_ENV === 'development') {
                console.log('🔄 Menginisialisasi sistem menu TXT...');
            }
            
            // Baca semua file menu yang ada
            await this.loadAllMenus();
            
            // Setup file watcher untuk auto-reload
            this.setupFileWatcher();
            
            this.isInitialized = true;
            if (process.env.NODE_ENV === 'development') {
                console.log(`✅ Sistem menu TXT berhasil diinisialisasi dengan ${this.menus.size} menu`);
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error menginisialisasi sistem menu TXT:', error);
            return false;
        }
    }

    /**
     * Muat semua file menu dari direktori
     */
    async loadAllMenus() {
        try {
            const files = fs.readdirSync(this.menuDirectory);
            const txtFiles = files.filter(file => file.endsWith('.txt'));
            
            console.log(`📖 Memuat ${txtFiles.length} file menu TXT...`);
            
            for (const file of txtFiles) {
                const menuId = path.basename(file, '.txt');
                await this.loadMenu(menuId);
            }
            
            console.log(`📚 Berhasil memuat ${this.menus.size} menu`);
        } catch (error) {
            console.error('❌ Error memuat menu:', error);
        }
    }

    /**
     * Muat menu dari file TXT
     */
    async loadMenu(menuId) {
        try {
            const filePath = path.join(this.menuDirectory, `${menuId}.txt`);
            
            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️ File menu tidak ditemukan: ${filePath}`);
                return null;
            }
            
            const content = fs.readFileSync(filePath, 'utf8');
            const menuData = this.parseMenuContent(content, menuId);
            
            this.menus.set(menuId, menuData);
            console.log(`📄 Menu '${menuId}' berhasil dimuat`);
            
            return menuData;
        } catch (error) {
            console.error(`❌ Error memuat menu '${menuId}':`, error);
            return null;
        }
    }

    /**
     * Parse konten menu dari file TXT
     */
    parseMenuContent(content, menuId) {
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        
        const menuData = {
            id: menuId,
            title: '',
            description: '',
            items: [],
            lastUpdated: new Date().toISOString()
        };
        
        let currentSection = 'title';
        let currentItem = null;
        
        for (const line of lines) {
            // Deteksi section headers
            if (line.startsWith('TITLE:')) {
                menuData.title = line.substring(6).trim();
                currentSection = 'title';
            } else if (line.startsWith('DESCRIPTION:')) {
                menuData.description = line.substring(12).trim();
                currentSection = 'description';
            } else if (line.startsWith('ITEMS:')) {
                currentSection = 'items';
            } else if (line.startsWith('- ')) {
                // Item menu
                const itemText = line.substring(2).trim();
                const item = this.parseMenuItem(itemText);
                menuData.items.push(item);
            } else if (currentSection === 'description' && !menuData.description) {
                menuData.description = line;
            } else if (currentSection === 'title' && !menuData.title) {
                menuData.title = line;
            }
        }
        
        return menuData;
    }

    /**
     * Parse item menu individual
     */
    parseMenuItem(itemText) {
        // Format: "Nama Item | Deskripsi | Action"
        const parts = itemText.split('|').map(part => part.trim());
        
        return {
            name: parts[0] || itemText,
            description: parts[1] || '',
            action: parts[2] || '',
            id: this.generateItemId(parts[0] || itemText)
        };
    }

    /**
     * Generate ID untuk item menu
     */
    generateItemId(name) {
        return name.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 20);
    }

    /**
     * Setup file watcher untuk auto-reload
     */
    setupFileWatcher() {
        const watcher = chokidar.watch(`${this.menuDirectory}/*.txt`, {
            ignored: /^\./,
            persistent: true
        });
        
        watcher
            .on('add', (filePath) => {
                const menuId = path.basename(filePath, '.txt');
                console.log(`📁 File menu baru terdeteksi: ${menuId}`);
                this.loadMenu(menuId);
            })
            .on('change', (filePath) => {
                const menuId = path.basename(filePath, '.txt');
                console.log(`🔄 File menu diperbarui: ${menuId}`);
                this.loadMenu(menuId);
            })
            .on('unlink', (filePath) => {
                const menuId = path.basename(filePath, '.txt');
                console.log(`🗑️ File menu dihapus: ${menuId}`);
                this.menus.delete(menuId);
            });
        
        this.watchers.set('main', watcher);
        console.log('👁️ File watcher aktif untuk auto-reload menu');
    }

    /**
     * Dapatkan menu berdasarkan ID
     */
    getMenu(menuId) {
        return this.menus.get(menuId) || null;
    }

    /**
     * Dapatkan semua menu
     */
    getAllMenus() {
        return Array.from(this.menus.values());
    }

    /**
     * Dapatkan daftar ID menu
     */
    getMenuIds() {
        return Array.from(this.menus.keys());
    }

    /**
     * Cari menu berdasarkan kata kunci
     */
    searchMenus(keyword) {
        const results = [];
        const searchTerm = keyword.toLowerCase();
        
        for (const menu of this.menus.values()) {
            if (menu.title.toLowerCase().includes(searchTerm) ||
                menu.description.toLowerCase().includes(searchTerm) ||
                menu.items.some(item => 
                    item.name.toLowerCase().includes(searchTerm) ||
                    item.description.toLowerCase().includes(searchTerm)
                )) {
                results.push(menu);
            }
        }
        
        return results;
    }

    /**
     * Format menu untuk tampilan WhatsApp
     */
    formatMenuForWhatsApp(menuId) {
        const menu = this.getMenu(menuId);
        if (!menu) {
            return `❌ Menu '${menuId}' tidak ditemukan.`;
        }
        
        let message = `📋 *${menu.title}*\n\n`;
        
        if (menu.description) {
            message += `${menu.description}\n\n`;
        }
        
        if (menu.items.length > 0) {
            message += `📝 *Pilihan Menu:*\n`;
            menu.items.forEach((item, index) => {
                message += `${index + 1}. ${item.name}`;
                if (item.description) {
                    message += ` - ${item.description}`;
                }
                message += `\n`;
            });
        }
        
        message += `\n⏰ Terakhir diperbarui: ${new Date(menu.lastUpdated).toLocaleString('id-ID')}`;
        
        return message;
    }

    /**
     * Buat file menu baru
     */
    async createMenu(menuId, title, description = '', items = []) {
        try {
            const filePath = path.join(this.menuDirectory, `${menuId}.txt`);
            
            let content = `TITLE: ${title}\n`;
            if (description) {
                content += `DESCRIPTION: ${description}\n`;
            }
            content += `\nITEMS:\n`;
            
            items.forEach(item => {
                if (typeof item === 'string') {
                    content += `- ${item}\n`;
                } else {
                    content += `- ${item.name}`;
                    if (item.description) content += ` | ${item.description}`;
                    if (item.action) content += ` | ${item.action}`;
                    content += `\n`;
                }
            });
            
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Menu '${menuId}' berhasil dibuat`);
            
            return true;
        } catch (error) {
            console.error(`❌ Error membuat menu '${menuId}':`, error);
            return false;
        }
    }

    /**
     * Update file menu
     */
    async updateMenu(menuId, updates) {
        try {
            const menu = this.getMenu(menuId);
            if (!menu) {
                console.warn(`⚠️ Menu '${menuId}' tidak ditemukan untuk diupdate`);
                return false;
            }
            
            const updatedMenu = { ...menu, ...updates };
            
            return await this.createMenu(
                menuId,
                updatedMenu.title,
                updatedMenu.description,
                updatedMenu.items
            );
        } catch (error) {
            console.error(`❌ Error mengupdate menu '${menuId}':`, error);
            return false;
        }
    }

    /**
     * Hapus menu
     */
    async deleteMenu(menuId) {
        try {
            const filePath = path.join(this.menuDirectory, `${menuId}.txt`);
            
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Menu '${menuId}' berhasil dihapus`);
                return true;
            } else {
                console.warn(`⚠️ File menu '${menuId}' tidak ditemukan`);
                return false;
            }
        } catch (error) {
            console.error(`❌ Error menghapus menu '${menuId}':`, error);
            return false;
        }
    }

    /**
     * Dapatkan statistik sistem menu
     */
    getStatistics() {
        return {
            totalMenus: this.menus.size,
            menuIds: this.getMenuIds(),
            totalItems: Array.from(this.menus.values()).reduce((sum, menu) => sum + menu.items.length, 0),
            isInitialized: this.isInitialized,
            menuDirectory: this.menuDirectory
        };
    }

    /**
     * Tutup sistem dan cleanup
     */
    async shutdown() {
        console.log('🔄 Menutup sistem menu TXT...');
        
        // Tutup semua file watchers
        for (const watcher of this.watchers.values()) {
            await watcher.close();
        }
        
        this.watchers.clear();
        this.menus.clear();
        this.isInitialized = false;
        
        console.log('✅ Sistem menu TXT berhasil ditutup');
    }
}

module.exports = TxtMenuSystem;