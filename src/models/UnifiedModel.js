/**
 * Unified Model - Menggabungkan semua model dalam satu file
 * Menggunakan SQLite untuk data penting dan JSON untuk data konfigurasi
 * Dibuat untuk menyederhanakan struktur aplikasi
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

class UnifiedModel {
  constructor(db) {
    this.db = db;
    this.dataDir = path.join(__dirname, '../database');
    this.configFile = path.join(this.dataDir, 'config.json');
    this.villageInfoFile = path.join(this.dataDir, 'village_info.json');
    this.menuStructureFile = path.join(this.dataDir, 'menu_structure.json');
    this.umkmFile = path.join(this.dataDir, 'umkm.json');
    
    // Pastikan direktori database ada
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    this.initializeJSONFiles();
  }

  // Inisialisasi file JSON
  initializeJSONFiles() {
    // Config default
    const defaultConfig = {
      app_name: "Bot WhatsApp Desa",
      version: "1.0.0",
      admin_roles: {
        super: ["all"],
        content: ["menu_management", "news_management", "umkm_management"],
        support: ["complaint_management", "user_support"]
      },
      daily_limits: {
        default: 50,
        admin: 1000
      }
    };

    // Village info default
    const defaultVillageInfo = {
      nama_desa: "Desa Contoh",
      alamat: "Alamat Desa",
      kepala_desa: "Nama Kepala Desa",
      kontak: "08123456789",
      email: "desa@example.com",
      website: "https://desa.example.com",
      jam_pelayanan: "08:00 - 16:00",
      fasilitas: [],
      sejarah: "Sejarah singkat desa",
      visi_misi: {
        visi: "Visi desa",
        misi: ["Misi 1", "Misi 2"]
      }
    };

    // Menu structure default
    const defaultMenuStructure = {
      main_menus: [
        {
          id: 1,
          name: "Informasi Desa",
          description: "Informasi umum tentang desa",
          order: 1,
          active: true,
          sub_menus: [
            { id: "1a", name: "Profil Desa", content_type: "village_info" },
            { id: "1b", name: "Struktur Organisasi", content_type: "text" },
            { id: "1c", name: "Visi & Misi", content_type: "village_info" }
          ]
        },
        {
          id: 2,
          name: "Layanan Publik",
          description: "Layanan yang tersedia untuk masyarakat",
          order: 2,
          active: true,
          sub_menus: [
            { id: "2a", name: "Surat Keterangan", content_type: "text" },
            { id: "2b", name: "Pengaduan", content_type: "form" },
            { id: "2c", name: "Jam Pelayanan", content_type: "village_info" }
          ]
        },
        {
          id: 3,
          name: "UMKM Desa",
          description: "Usaha Mikro Kecil Menengah di desa",
          order: 3,
          active: true,
          sub_menus: [
            { id: "3a", name: "Daftar UMKM", content_type: "umkm_list" },
            { id: "3b", name: "Kategori UMKM", content_type: "umkm_category" }
          ]
        }
      ]
    };

    // Buat file jika belum ada
    this.ensureJSONFile(this.configFile, defaultConfig);
    this.ensureJSONFile(this.villageInfoFile, defaultVillageInfo);
    this.ensureJSONFile(this.menuStructureFile, defaultMenuStructure);
  }

  // Pastikan file JSON ada
  ensureJSONFile(filePath, defaultData) {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    }
  }

  // Baca file JSON
  readJSONFile(filePath) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading JSON file ${filePath}:`, error.message);
      return null;
    }
  }

  // Tulis file JSON
  writeJSONFile(filePath, data) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error(`Error writing JSON file ${filePath}:`, error.message);
      return false;
    }
  }

  // ===== ADMIN MANAGEMENT =====
  
  // Mendapatkan semua admin
  getAllAdmins() {
    try {
      const stmt = this.db.prepare(
        'SELECT id, username, phone_number, role, is_active, created_at, last_login FROM admins'
      );
      return stmt.all();
    } catch (error) {
      console.error('Error getting all admins:', error.message);
      return [];
    }
  }

  // Mendapatkan admin berdasarkan username
  getAdminByUsername(username) {
    try {
      const stmt = this.db.prepare('SELECT * FROM admins WHERE username = ?');
      return stmt.get(username);
    } catch (error) {
      console.error('Error getting admin by username:', error.message);
      return null;
    }
  }

  // Mendapatkan admin berdasarkan nomor telepon
  getAdminByPhoneNumber(phoneNumber) {
    try {
      const stmt = this.db.prepare('SELECT * FROM admins WHERE phone_number = ?');
      return stmt.get(phoneNumber);
    } catch (error) {
      console.error('Error getting admin by phone number:', error.message);
      return null;
    }
  }

  // Menambahkan pengaduan baru
  addComplaint(complaint) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO complaints (
          user_id, phone_number, reporter_name, reporter_address,
          description, photo_path, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      
      const result = stmt.run(
        complaint.user_id,
        complaint.phone_number,
        complaint.reporter_name,
        complaint.reporter_address,
        complaint.description,
        complaint.photo_path,
        complaint.status
      );
      
      return { id: result.lastInsertRowid, ...complaint };
    } catch (error) {
      console.error('Error adding complaint:', error.message);
      throw error;
    }
  }

  // Mendapatkan pengaduan berdasarkan nama pelapor
  getComplaintsByName(reporterName) {
    try {
      const stmt = this.db.prepare('SELECT * FROM complaints WHERE reporter_name = ? ORDER BY created_at DESC');
      return stmt.all(reporterName);
    } catch (error) {
      console.error('Error getting complaints by reporter name:', error.message);
      return [];
    }
  }

  // Verifikasi login admin
  async verifyAdminLogin(username, password) {
    try {
      const admin = this.getAdminByUsername(username);
      if (!admin || !admin.is_active) {
        return null;
      }

      const isValid = await bcrypt.compare(password, admin.password);
      if (isValid) {
        // Update last login
        const updateStmt = this.db.prepare(
          'UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
        );
        updateStmt.run(admin.id);
        
        const { password: _, ...adminWithoutPassword } = admin;
        return adminWithoutPassword;
      }
      return null;
    } catch (error) {
      console.error('Error verifying admin login:', error.message);
      return null;
    }
  }

  // ===== USER MANAGEMENT =====
  
  // Mendapatkan semua pengguna
  getAllUsers() {
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM users ORDER BY created_at DESC'
      );
      return stmt.all();
    } catch (error) {
      console.error('Error getting all users:', error.message);
      return [];
    }
  }

  // Mendapatkan pengguna berdasarkan nomor telepon
  getUserByPhoneNumber(phoneNumber) {
    try {
      const stmt = this.db.prepare('SELECT * FROM users WHERE phone_number = ?');
      return stmt.get(phoneNumber);
    } catch (error) {
      console.error('Error getting user by phone number:', error.message);
      return null;
    }
  }

  // Ban user
  banUser(phoneNumber, bannedBy) {
    try {
      const stmt = this.db.prepare(
        'UPDATE users SET is_banned = 1, banned_by = ?, banned_at = CURRENT_TIMESTAMP WHERE phone_number = ?'
      );
      const result = stmt.run(bannedBy, phoneNumber);
      return result.changes > 0;
    } catch (error) {
      console.error('Error banning user:', error.message);
      return false;
    }
  }

  // Unban user
  unbanUser(phoneNumber) {
    try {
      const stmt = this.db.prepare(
        'UPDATE users SET is_banned = 0, banned_by = NULL, banned_at = NULL WHERE phone_number = ?'
      );
      const result = stmt.run(phoneNumber);
      return result.changes > 0;
    } catch (error) {
      console.error('Error unbanning user:', error.message);
      return false;
    }
  }
  
  // Mendapatkan atau membuat pengguna baru
  getOrCreateUser(phoneNumber) {
    try {
      // Cek apakah user sudah ada
      const existingUser = this.db.prepare(
        'SELECT * FROM users WHERE phone_number = ?'
      ).get(phoneNumber);

      if (existingUser) {
        // Update last_activity dan total_interactions
        this.db.prepare(
          'UPDATE users SET last_activity = CURRENT_TIMESTAMP, total_interactions = total_interactions + 1 WHERE phone_number = ?'
        ).run(phoneNumber);
        
        return existingUser;
      }

      // Buat user baru
      const result = this.db.prepare(
        'INSERT INTO users (phone_number, is_new_user, total_interactions) VALUES (?, 1, 1)'
      ).run(phoneNumber);

      return this.db.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).get(result.lastInsertRowid);
    } catch (error) {
      console.error('Error in getOrCreateUser:', error.message);
      throw error;
    }
  }

  // Cek limit harian pengguna
  checkDailyLimit(phoneNumber, maxLimit = 50, isAdmin = false) {
    try {
      if (isAdmin) return { canProceed: true, remainingLimit: 1000 };

      const today = new Date().toISOString().split('T')[0];
      
      const user = this.db.prepare(
        'SELECT daily_count, last_interaction_date FROM users WHERE phone_number = ?'
      ).get(phoneNumber);

      if (!user) {
        return { canProceed: true, remainingLimit: maxLimit - 1 };
      }

      if (user.last_interaction_date !== today) {
        // Reset daily count untuk hari baru
        this.db.prepare(
          'UPDATE users SET daily_count = 1, last_interaction_date = ? WHERE phone_number = ?'
        ).run(today, phoneNumber);
        return { canProceed: true, remainingLimit: maxLimit - 1 };
      }

      if (user.daily_count >= maxLimit) {
        return { canProceed: false, remainingLimit: 0 };
      }

      // Increment daily count
      this.db.prepare(
        'UPDATE users SET daily_count = daily_count + 1 WHERE phone_number = ?'
      ).run(phoneNumber);

      return { canProceed: true, remainingLimit: maxLimit - user.daily_count - 1 };
    } catch (error) {
      console.error('Error checking daily limit:', error.message);
      return { canProceed: true, remainingLimit: maxLimit };
    }
  }

  // Cek limit per jam (20 interaksi per jam)
  checkHourlyLimit(phoneNumber, maxHourlyLimit = 20, isAdmin = false) {
    try {
      if (isAdmin) return { canProceed: true, remainingLimit: 1000 };

      const now = new Date();
      const currentHour = now.getHours();
      const today = now.toISOString().split('T')[0];
      const hourKey = `${today}-${currentHour.toString().padStart(2, '0')}`;
      
      // Cek atau buat record untuk jam ini
      let hourlyRecord = this.db.prepare(
        'SELECT interaction_count FROM hourly_limits WHERE phone_number = ? AND hour_key = ?'
      ).get(phoneNumber, hourKey);

      if (!hourlyRecord) {
        // Buat record baru untuk jam ini
        this.db.prepare(
          'INSERT INTO hourly_limits (phone_number, hour_key, interaction_count) VALUES (?, ?, 1)'
        ).run(phoneNumber, hourKey);
        return { canProceed: true, remainingLimit: maxHourlyLimit - 1 };
      }

      if (hourlyRecord.interaction_count >= maxHourlyLimit) {
        return { 
          canProceed: false, 
          remainingLimit: 0,
          resetTime: `${(currentHour + 1).toString().padStart(2, '0')}:00`
        };
      }

      // Increment hourly count
      this.db.prepare(
        'UPDATE hourly_limits SET interaction_count = interaction_count + 1 WHERE phone_number = ? AND hour_key = ?'
      ).run(phoneNumber, hourKey);

      return { 
        canProceed: true, 
        remainingLimit: maxHourlyLimit - hourlyRecord.interaction_count - 1 
      };
    } catch (error) {
      console.error('Error checking hourly limit:', error.message);
      return { canProceed: true, remainingLimit: maxHourlyLimit };
    }
  }

  // Cleanup hourly limits yang sudah lebih dari 24 jam
  cleanupOldHourlyLimits() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const cutoffDate = yesterday.toISOString().split('T')[0];
      
      this.db.prepare(
        'DELETE FROM hourly_limits WHERE hour_key < ?'
      ).run(cutoffDate);
      
      console.log('🧹 Cleaned up old hourly limits');
    } catch (error) {
      console.error('Error cleaning up hourly limits:', error.message);
    }
  }

  // ===== CHAT MEMORY =====
  
  // Mendapatkan chat memory berdasarkan user ID
  getChatMemoryByUserId(userId) {
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM chat_memory WHERE user_id = ? ORDER BY last_updated DESC'
      );
      return stmt.all(userId);
    } catch (error) {
      console.error('Error getting chat memory by user ID:', error.message);
      return [];
    }
  }

  // Menambahkan chat memory baru
  addChatMemory(chatMemory) {
    try {
      const stmt = this.db.prepare(
        'INSERT INTO chat_memory (user_id, context) VALUES (?, ?)'
      );
      const result = stmt.run(
        chatMemory.user_id,
        chatMemory.context || JSON.stringify({})
      );
      return { id: result.lastInsertRowid, ...chatMemory };
    } catch (error) {
      console.error('Error adding chat memory:', error.message);
      throw error;
    }
  }

  // Membersihkan memori chat yang tidak aktif
  cleanupInactiveMemory(hours = 24) {
    try {
      const stmt = this.db.prepare(
        'DELETE FROM chat_memory WHERE last_updated < datetime("now", "-" || ? || " hours")'
      );
      const result = stmt.run(hours);
      console.log(`Cleaned up ${result.changes} inactive chat memories`);
      return result.changes;
    } catch (error) {
      console.error('Error cleaning up inactive memory:', error.message);
      return 0;
    }
  }

  // ===== COMPLAINTS =====
  
  // Mendapatkan semua pengaduan
  getAllComplaints() {
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM complaints ORDER BY created_at DESC'
      );
      return stmt.all();
    } catch (error) {
      console.error('Error getting all complaints:', error.message);
      return [];
    }
  }

  // Menambahkan pengaduan baru
  addComplaint(complaint) {
    try {
      const stmt = this.db.prepare(
        'INSERT INTO complaints (user_id, phone_number, complaint_code, reporter_name, reporter_address, description, photo_path, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      const result = stmt.run(
        complaint.user_id,
        complaint.phone_number,
        complaint.complaint_code,
        complaint.reporter_name,
        complaint.reporter_address,
        complaint.description,
        complaint.photo_path || null,
        complaint.status || 'pending'
      );
      return { id: result.lastInsertRowid, ...complaint };
    } catch (error) {
      console.error('Error adding complaint:', error.message);
      throw error;
    }
  }

  // Update status pengaduan
  updateComplaintStatus(id, status) {
    try {
      const stmt = this.db.prepare(
        'UPDATE complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      );
      const result = stmt.run(status, id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating complaint status:', error.message);
      return false;
    }
  }

  // Mendapatkan pengaduan berdasarkan ID
  getComplaintById(id) {
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM complaints WHERE id = ?'
      );
      return stmt.get(id);
    } catch (error) {
      console.error('Error getting complaint by ID:', error.message);
      return null;
    }
  }

  // ===== UMKM MANAGEMENT (JSON-based) =====
  
  // Mendapatkan semua UMKM
  getAllUMKM(status = 'aktif') {
    try {
      const umkmData = this.readJSONFile(this.umkmFile) || [];
      return umkmData.filter(umkm => umkm.status === status).sort((a, b) => a.nama.localeCompare(b.nama));
    } catch (error) {
      console.error('Error getting all UMKM:', error.message);
      return [];
    }
  }

  // Mendapatkan UMKM berdasarkan kategori
  getUMKMByKategori(kategori) {
    try {
      const umkmData = this.readJSONFile(this.umkmFile) || [];
      return umkmData
        .filter(umkm => umkm.kategori === kategori && umkm.status === 'aktif')
        .sort((a, b) => a.nama.localeCompare(b.nama));
    } catch (error) {
      console.error('Error getting UMKM by kategori:', error.message);
      return [];
    }
  }

  // Mencari UMKM berdasarkan nama
  searchUMKMByNama(keyword) {
    try {
      const umkmData = this.readJSONFile(this.umkmFile) || [];
      return umkmData
        .filter(umkm => 
          umkm.nama.toLowerCase().includes(keyword.toLowerCase()) && 
          umkm.status === 'aktif'
        )
        .sort((a, b) => a.nama.localeCompare(b.nama));
    } catch (error) {
      console.error('Error searching UMKM by nama:', error.message);
      return [];
    }
  }

  // Menambahkan UMKM baru
  addUMKM(umkmData) {
    try {
      const currentData = this.readJSONFile(this.umkmFile) || [];
      const newId = currentData.length > 0 ? Math.max(...currentData.map(u => u.id)) + 1 : 1;
      
      const newUMKM = {
        id: newId,
        nama: umkmData.nama,
        deskripsi: umkmData.deskripsi || '',
        kategori: umkmData.kategori || 'lainnya',
        alamat: umkmData.alamat || '',
        kontak_person: umkmData.kontak_person || '',
        nomor_telepon: umkmData.nomor_telepon || '',
        email: umkmData.email || '',
        jam_operasional: umkmData.jam_operasional || '',
        produk_layanan: umkmData.produk_layanan || '',
        harga_range: umkmData.harga_range || '',
        status: umkmData.status || 'aktif'
      };
      
      currentData.push(newUMKM);
      this.writeJSONFile(this.umkmFile, currentData);
      
      return newUMKM;
    } catch (error) {
      console.error('Error adding UMKM:', error.message);
      throw error;
    }
  }

  // ===== MENU & CONTENT MANAGEMENT (JSON-based) =====
  
  // Mendapatkan struktur menu
  getMenuStructure() {
    return this.readJSONFile(this.menuStructureFile);
  }

  // Update struktur menu
  updateMenuStructure(menuStructure) {
    return this.writeJSONFile(this.menuStructureFile, menuStructure);
  }

  // Mendapatkan menu berdasarkan ID
  getMenuById(id) {
    const menuStructure = this.getMenuStructure();
    if (!menuStructure) return null;
    
    return menuStructure.main_menus.find(menu => menu.id === parseInt(id));
  }

  // Mendapatkan submenu berdasarkan menu ID dan submenu ID
  getSubMenuById(menuId, subMenuId) {
    const menu = this.getMenuById(menuId);
    if (!menu || !menu.sub_menus) return null;
    
    return menu.sub_menus.find(subMenu => subMenu.id === subMenuId);
  }

  // ===== VILLAGE INFO MANAGEMENT (JSON-based) =====
  
  // Mendapatkan informasi desa
  getVillageInfo() {
    return this.readJSONFile(this.villageInfoFile);
  }

  // Update informasi desa
  updateVillageInfo(info) {
    return this.writeJSONFile(this.villageInfoFile, info);
  }

  // ===== CONFIG MANAGEMENT (JSON-based) =====
  
  // Mendapatkan konfigurasi
  getConfig() {
    return this.readJSONFile(this.configFile);
  }

  // Update konfigurasi
  updateConfig(config) {
    return this.writeJSONFile(this.configFile, config);
  }

  // Mendapatkan role permissions
  getRolePermissions(role) {
    const config = this.getConfig();
    return config?.admin_roles?.[role] || [];
  }

  // Cek permission admin
  hasPermission(adminRole, permission) {
    const permissions = this.getRolePermissions(adminRole);
    return permissions.includes('all') || permissions.includes(permission);
  }

  // ===== STATISTICS =====
  
  // Mendapatkan total pengaduan
  getTotalComplaints() {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as total FROM complaints');
      const result = stmt.get();
      return result.total || 0;
    } catch (error) {
      console.error('Error getting total complaints:', error.message);
      return 0;
    }
  }

  // Mendapatkan pengaduan bulan ini
  getComplaintsThisMonth() {
    try {
      const stmt = this.db.prepare(
        'SELECT COUNT(*) as total FROM complaints WHERE strftime("%Y-%m", created_at) = strftime("%Y-%m", "now")'
      );
      const result = stmt.get();
      return result.total || 0;
    } catch (error) {
      console.error('Error getting complaints this month:', error.message);
      return 0;
    }
  }

  // Mendapatkan total UMKM
  getTotalUMKM() {
    try {
      const umkmData = this.readJSONFile(this.umkmFile) || [];
      return umkmData.filter(umkm => umkm.status === 'aktif').length;
    } catch (error) {
      console.error('Error getting total UMKM:', error.message);
      return 0;
    }
  }

  // Mendapatkan total pengguna
  getTotalUsers() {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as total FROM users');
      const result = stmt.get();
      return result.total || 0;
    } catch (error) {
      console.error('Error getting total users:', error.message);
      return 0;
    }
  }

  // ===== UTILITY METHODS =====
  
  // Format pesan menu utama
  formatMainMenu() {
    const menuStructure = this.getMenuStructure();
    if (!menuStructure) return "Menu tidak tersedia";

    let menuText = "🏠 *MENU UTAMA*\n\n";
    
    menuStructure.main_menus.forEach(menu => {
      if (menu.active) {
        menuText += `${menu.id}. ${menu.name}\n`;
      }
    });
    
    menuText += "\n0. Keluar\n\n";
    menuText += "Ketik nomor menu yang ingin Anda pilih.";
    
    return menuText;
  }

  // Format pesan submenu
  formatSubMenu(menuId) {
    const menu = this.getMenuById(menuId);
    if (!menu) return "Menu tidak ditemukan";

    let menuText = `📋 *${menu.name.toUpperCase()}*\n\n`;
    
    menu.sub_menus.forEach(subMenu => {
      menuText += `${subMenu.id}. ${subMenu.name}\n`;
    });
    
    menuText += "\n0. Kembali ke Menu Utama\n\n";
    menuText += "Ketik kode submenu yang ingin Anda pilih.";
    
    return menuText;
  }

  // Format konten berdasarkan tipe
  formatContent(contentType, data = null) {
    switch (contentType) {
      case 'village_info':
        const villageInfo = this.getVillageInfo();
        return this.formatVillageInfo(villageInfo);
      
      case 'umkm_list':
        const umkmList = this.getAllUMKM();
        return this.formatUMKMList(umkmList);
      
      case 'umkm_category':
        return this.formatUMKMCategories();
      
      case 'text':
        return data || "Konten tidak tersedia";
      
      case 'form':
        return "Silakan kirim pengaduan Anda dengan format:\n\nNama: [Nama Anda]\nKategori: [Kategori Pengaduan]\nPengaduan: [Detail Pengaduan]";
      
      default:
        return "Tipe konten tidak dikenali";
    }
  }

  // Format informasi desa
  formatVillageInfo(info) {
    if (!info) return "Informasi desa tidak tersedia";
    
    return `🏛️ *${info.nama_desa}*\n\n` +
           `📍 Alamat: ${info.alamat}\n` +
           `👤 Kepala Desa: ${info.kepala_desa}\n` +
           `📞 Kontak: ${info.kontak}\n` +
           `📧 Email: ${info.email}\n` +
           `🌐 Website: ${info.website}\n` +
           `🕐 Jam Pelayanan: ${info.jam_pelayanan}`;
  }

  // Format daftar UMKM
  formatUMKMList(umkmList) {
    if (!umkmList || umkmList.length === 0) {
      return "Belum ada data UMKM yang tersedia";
    }

    let text = "🏪 *DAFTAR UMKM DESA*\n\n";
    
    umkmList.forEach((umkm, index) => {
      text += `${index + 1}. *${umkm.nama}*\n`;
      text += `   Kategori: ${umkm.kategori}\n`;
      text += `   Kontak: ${umkm.nomor_telepon}\n`;
      if (umkm.alamat) text += `   Alamat: ${umkm.alamat}\n`;
      text += "\n";
    });
    
    return text;
  }

  // Format kategori UMKM
  formatUMKMCategories() {
    try {
      const stmt = this.db.prepare('SELECT kategori, COUNT(*) as jumlah FROM umkm WHERE status = "aktif" GROUP BY kategori ORDER BY jumlah DESC');
      const categories = stmt.all();
      
      if (categories.length === 0) {
        return "Belum ada kategori UMKM yang tersedia";
      }

      let text = "📊 *KATEGORI UMKM*\n\n";
      
      categories.forEach((cat, index) => {
        text += `${index + 1}. ${cat.kategori} (${cat.jumlah} UMKM)\n`;
      });
      
      return text;
    } catch (error) {
      console.error('Error formatting UMKM categories:', error.message);
      return "Error mengambil data kategori UMKM";
    }
  }

  // ===== SPAM DETECTION METHODS =====
  
  // Cek apakah user sedang diblokir karena spam
  isUserBlocked(userPhone) {
    try {
      const stmt = this.db.prepare('SELECT * FROM spam_blocked_users WHERE user_phone = ? AND is_blocked = 1');
      const blocked = stmt.get(userPhone);
      return blocked !== undefined;
    } catch (error) {
      console.error('Error checking if user is blocked:', error.message);
      return false;
    }
  }

  // Tambah record spam detection
  addSpamRecord(userPhone, messageContent) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO spam_detection (user_phone, message_timestamp, message_content)
        VALUES (?, datetime('now'), ?)
      `);
      stmt.run(userPhone, messageContent);
      return true;
    } catch (error) {
      console.error('Error adding spam record:', error.message);
      return false;
    }
  }

  // Cek spam dalam 1 detik terakhir
  checkSpamInLastSecond(userPhone) {
    try {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM spam_detection 
        WHERE user_phone = ? 
        AND message_timestamp >= datetime('now', '-1 second')
      `);
      const result = stmt.get(userPhone);
      return result.count || 0;
    } catch (error) {
      console.error('Error checking spam in last second:', error.message);
      return 0;
    }
  }

  // Cek total spam dalam 5 detik terakhir
  checkSpamInLastFiveSeconds(userPhone) {
    try {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count FROM spam_detection 
        WHERE user_phone = ? 
        AND message_timestamp >= datetime('now', '-5 seconds')
      `);
      const result = stmt.get(userPhone);
      return result.count || 0;
    } catch (error) {
      console.error('Error checking spam in last 5 seconds:', error.message);
      return 0;
    }
  }

  // Blokir user karena spam
  blockUserForSpam(userPhone, spamCount) {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO spam_blocked_users 
        (user_phone, blocked_reason, spam_count, blocked_at, is_blocked, blocked_by)
        VALUES (?, 'spam_detection', ?, datetime('now'), 1, 'system')
      `);
      stmt.run(userPhone, spamCount);
      console.log(`🚫 User ${userPhone} diblokir karena spam (${spamCount} pesan dalam 5 detik)`);
      return true;
    } catch (error) {
      console.error('Error blocking user for spam:', error.message);
      return false;
    }
  }

  // Unblock user (untuk admin)
  unblockUser(userPhone, adminPhone) {
    try {
      const stmt = this.db.prepare(`
        UPDATE spam_blocked_users 
        SET is_blocked = 0, unblocked_at = datetime('now')
        WHERE user_phone = ?
      `);
      const result = stmt.run(userPhone);
      
      if (result.changes > 0) {
        console.log(`✅ User ${userPhone} di-unblock oleh admin ${adminPhone}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error unblocking user:', error.message);
      return false;
    }
  }

  // Dapatkan daftar user yang diblokir
  getBlockedUsers() {
    try {
      const stmt = this.db.prepare(`
        SELECT user_phone, blocked_reason, spam_count, blocked_at, blocked_by
        FROM spam_blocked_users 
        WHERE is_blocked = 1
        ORDER BY blocked_at DESC
      `);
      return stmt.all();
    } catch (error) {
      console.error('Error getting blocked users:', error.message);
      return [];
    }
  }

  // Bersihkan record spam lama (lebih dari 1 jam)
  cleanOldSpamRecords() {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM spam_detection 
        WHERE message_timestamp < datetime('now', '-1 hour')
      `);
      const result = stmt.run();
      if (result.changes > 0) {
        console.log(`🧹 Membersihkan ${result.changes} record spam lama`);
      }
      return result.changes;
    } catch (error) {
      console.error('Error cleaning old spam records:', error.message);
      return 0;
    }
  }
}

module.exports = UnifiedModel;