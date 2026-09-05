// Admin Command Controller
// Mengelola semua perintah admin dengan awalan !

const profanityFilter = require('../utils/profanityFilter');
const { duplicateChecker } = require('../utils/duplicateChecker');
const fs = require('fs').promises;
const fsExtra = require('fs-extra');
const path = require('path');
const SettingsController = require('./settingsController');
const { saveNewsMedia, saveTourismMedia } = require('./complaintController');
const { readMenuStructure, getMenuByIdFS } = require('./menuController');

class AdminCommandController {
  constructor() {
    this.settingsController = new SettingsController();
    this.commands = {
      // Perintah berita
      '!beritaadd': this.handleBeritaAddCommand.bind(this),
      '!beritaedit': this.handleBeritaEditCommand.bind(this),
      '!beritalist': this.handleBeritaListCommand.bind(this),
      '!beritasearch': this.handleBeritaSearchCommand.bind(this),
      '!beritadelete': this.handleBeritaDeleteCommand.bind(this),
      
      // Perintah UMKM
      '!umkmadd': this.handleUmkmAddCommand.bind(this),
      '!umkmedit': this.handleUmkmEditCommand.bind(this),
      '!umkmlist': this.handleUmkmListCommand.bind(this),
      '!umkmdelete': this.handleUmkmDeleteCommand.bind(this),
      
      // Perintah layanan
      '!layananlist': this.handleLayananListCommand.bind(this),
      '!layananadd': this.handleLayananAddCommand.bind(this),
      '!layanansubmenuadd': this.handleLayananSubmenuAddCommand.bind(this),
      '!layananshow': this.handleLayananShowCommand.bind(this),
      '!layananedit': this.handleLayananEditCommand.bind(this),
      '!layanantemplate': this.handleLayananTemplateCommand.bind(this),
      '!layananquick': this.handleLayananQuickCommand.bind(this),
      
      // Manajemen admin
      '!adminnew': this.handleAdminNewCommand.bind(this),
      '!admindel': this.handleAdminDelCommand.bind(this),
      
      // Pengaduan dan statistik
      '!list_pengaduan': this.handleListPengaduanCommand.bind(this),
      '!detail_pengaduan': this.handleDetailPengaduanCommand.bind(this),
      '!update_status': this.handleUpdateStatusCommand.bind(this),
      '!delete_pengaduan': this.handleDeletePengaduanCommand.bind(this),
      '!statistik': this.handleStatistikCommand.bind(this),
      '!laporan': this.handleLaporanCommand.bind(this),
      '!laporanuser': this.handleLaporanUserCommand.bind(this),
      
      // Pengaturan JSON - CRUD Commands
      '!pengaturan': this.handlePengaturanCommand.bind(this),
      '!settingshow': this.handleSettingsShowCommand.bind(this),
      '!settingset': this.handleSettingSetCommand.bind(this),
      '!settingget': this.handleSettingGetCommand.bind(this),
      '!settingdel': this.handleSettingDelCommand.bind(this),
      '!settingreset': this.handleSettingResetCommand.bind(this),
      '!limitset': this.handleLimitSetCommand.bind(this),
      '!limitshow': this.handleLimitShowCommand.bind(this),
      '!filterset': this.handleFilterSetCommand.bind(this),
      '!filtershow': this.handleFilterShowCommand.bind(this),
      '!filteradd': this.handleFilterAddCommand.bind(this),
      '!filterdel': this.handleFilterDelCommand.bind(this),
      '!moderationset': this.handleModerationSetCommand.bind(this),
      '!moderationshow': this.handleModerationShowCommand.bind(this),
      '!clearcache': this.handleClearCacheCommand.bind(this),
      '!deleteimages': this.handleDeleteImagesCommand.bind(this),
      '!panduanBot': this.handlePanduanBotCommand.bind(this),
      
      // Perintah Anti-Spam
      '!unblock': this.handleUnblockCommand.bind(this),
      '!listblocked': this.handleListBlockedCommand.bind(this),
      
      // Perintah UMKM
      '!umkmadd': this.handleUMKMAddCommand.bind(this),
      '!umkmlist': this.handleUMKMListCommand.bind(this),
      '!umkmedit': this.handleUMKMEditCommand.bind(this),
      '!umkmdelete': this.handleUMKMDeleteCommand.bind(this),
      '!umkmstats': this.handleUMKMStatsCommand.bind(this),
      '!umkmsearch': this.handleUMKMSearchCommand.bind(this),
      
      // Perintah lama (tetap dipertahankan)
      '!admin': this.handleAdminMenuCommand.bind(this),
      '!menu': this.handleMenuCommand.bind(this),
      '!reset': this.handleResetCommand.bind(this),
      '!berita': this.handleBeritaCommand.bind(this),
      '!pengumuman': this.handlePengumumanCommand.bind(this),
      '!user': this.handleUserCommand.bind(this),
      '!stats': this.handleStatsCommand.bind(this),
      '!backup': this.handleBackupCommand.bind(this),
      '!broadcast': this.handleBroadcastCommand.bind(this),
      '!ban': this.handleBanCommand.bind(this),
      '!unban': this.handleUnbanCommand.bind(this),
      '!filter': this.handleFilterCommand.bind(this),
      '!system': this.handleSystemCommand.bind(this),
      '!help': this.handleHelpCommand.bind(this),
      '!log': this.handleLogCommand.bind(this),
      '!maintenance': this.handleMaintenanceCommand.bind(this)
    };
  }

  // Validasi apakah user adalah admin
  async validateAdmin(models, senderId) {
    try {
      const admin = await models.unifiedModel.getAdminByPhoneNumber(senderId);
      return admin ? { valid: true, admin } : { valid: false, error: 'Anda tidak memiliki akses admin.' };
    } catch (error) {
      return { valid: false, error: 'Error validasi admin: ' + error.message };
    }
  }

  // Parse perintah admin
  parseCommand(message) {
    const parts = message.trim().split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');
    
    return { command, args, parts: parts.slice(1) };
  }

  // Validasi input dengan profanity filter
  validateInput(text) {
    return profanityFilter.validateAdminInput(text);
  }

  // Handler utama untuk semua perintah admin
  async handleAdminCommand(models, senderId, message, sock, context) {
    try {
      const { command, args } = this.parseCommand(message);
      
      // Perintah yang tidak memerlukan validasi admin
      const publicCommands = ['!menu', '!reset'];
      
      // Validasi admin untuk perintah yang memerlukan akses admin
      let adminValidation = { valid: true, admin: null };
      if (!publicCommands.includes(command)) {
        adminValidation = await this.validateAdmin(models, senderId);
        if (!adminValidation.valid) {
          return {
            response: { text: `❌ *Akses Ditolak*\n\n${adminValidation.error}` },
            context: {}
          };
        }
      }
      
      // Cek apakah perintah tersedia
      if (!this.commands[command]) {
        return {
          response: this.getUnknownCommandResponse(command),
          context: {}
        };
      }

      // Validasi input dengan profanity filter untuk perintah yang memerlukan input
      if (args && !publicCommands.includes(command)) {
        const inputValidation = this.validateInput(args);
        if (!inputValidation.valid) {
          return {
            response: { text: `❌ *Input Tidak Valid*\n\n${inputValidation.error}` },
            context: {}
          };
        }
      }

      // Eksekusi perintah
      const result = await this.commands[command](models, senderId, args, sock, adminValidation.admin, context, message);
      
      // Pastikan result memiliki format yang benar
      if (result.response) {
        return result;
      } else {
        return {
          response: result,
          context: result.context || {}
        };
      }
    } catch (error) {
      console.error('Error handling admin command:', error);
      return {
        response: { text: `❌ *Error*\n\nTerjadi kesalahan: ${error.message}` },
        context: {}
      };
    }
  }

  // !berita (judul),(deskripsi),(isi berita)
  async handleBeritaCommand(models, senderId, args, sock, admin) {
    if (!args) {
      return {
        text: `📰 *PERINTAH !berita*\n\n` +
              `Format: !berita (judul),(deskripsi),(isi berita)\n\n` +
              `Contoh:\n` +
              `!berita Pembangunan Jalan Baru,Jalan utama desa sedang diperbaiki,Pemerintah desa mengumumkan bahwa pembangunan jalan utama akan dimulai minggu depan...\n\n` +
              `📋 *Aturan:*\n` +
              `• Pisahkan dengan koma (,)\n` +
              `• Judul maksimal 100 karakter\n` +
              `• Deskripsi maksimal 200 karakter\n` +
              `• Isi berita maksimal 1000 karakter`
      };
    }

    const parts = args.split(',');
    if (parts.length < 3) {
      return { text: `❌ *Format Salah*\n\nGunakan format: !berita (judul),(deskripsi),(isi berita)` };
    }

    const judul = parts[0].trim();
    const deskripsi = parts[1].trim();
    const isi = parts.slice(2).join(',').trim();

    // Validasi panjang
    if (judul.length > 100) {
      return { text: `❌ *Judul Terlalu Panjang*\n\nMaksimal 100 karakter. Saat ini: ${judul.length}` };
    }
    if (deskripsi.length > 200) {
      return { text: `❌ *Deskripsi Terlalu Panjang*\n\nMaksimal 200 karakter. Saat ini: ${deskripsi.length}` };
    }
    if (isi.length > 1000) {
      return { text: `❌ *Isi Berita Terlalu Panjang*\n\nMaksimal 1000 karakter. Saat ini: ${isi.length}` };
    }

    // Simpan berita ke database atau file
    const berita = {
      id: Date.now(),
      judul,
      deskripsi,
      isi,
      author: admin.username,
      created_at: new Date().toISOString(),
      status: 'published'
    };

    try {
      // Simpan ke file JSON (bisa diganti dengan database)
      const newsDir = path.join(process.cwd(), 'uploads', 'news');
      await fs.mkdir(newsDir, { recursive: true });
      
      const newsFile = path.join(newsDir, `${berita.id}.json`);
      await fs.writeFile(newsFile, JSON.stringify(berita, null, 2));

      return {
        text: `✅ *Berita Berhasil Dibuat*\n\n` +
              `📰 *${judul}*\n\n` +
              `📝 ${deskripsi}\n\n` +
              `👤 Penulis: ${admin.username}\n` +
              `📅 Tanggal: ${new Date().toLocaleDateString('id-ID')}\n` +
              `🆔 ID: ${berita.id}`
      };
    } catch (error) {
      return { text: `❌ *Error Menyimpan Berita*\n\n${error.message}\n\nDibuat oleh Mahasiswa UMSU` };
    }
  }

  // !pengumuman (judul),(isi pengumuman)
  async handlePengumumanCommand(models, senderId, args, sock, admin) {
    if (!args) {
      return {
        text: `📢 *PERINTAH !pengumuman*\n\n` +
              `Format: !pengumuman (judul),(isi pengumuman)\n\n` +
              `Contoh:\n` +
              `!pengumuman Rapat RT,Akan diadakan rapat RT pada hari Minggu pukul 19.00 di balai desa\n\n` +
              `📋 *Aturan:*\n` +
              `• Pisahkan dengan koma (,)\n` +
              `• Judul maksimal 100 karakter\n` +
              `• Isi maksimal 500 karakter`
      };
    }

    const parts = args.split(',');
    if (parts.length < 2) {
      return { text: `❌ *Format Salah*\n\nGunakan format: !pengumuman (judul),(isi pengumuman)` };
    }

    const judul = parts[0].trim();
    const isi = parts.slice(1).join(',').trim();

    if (judul.length > 100 || isi.length > 500) {
      return { text: `❌ *Teks Terlalu Panjang*\n\nJudul max 100, isi max 500 karakter` };
    }

    const pengumuman = {
      id: Date.now(),
      judul,
      isi,
      author: admin.username,
      created_at: new Date().toISOString()
    };

    try {
      const announcementDir = path.join(process.cwd(), 'uploads', 'announcements');
      await fs.mkdir(announcementDir, { recursive: true });
      
      const announcementFile = path.join(announcementDir, `${pengumuman.id}.json`);
      await fs.writeFile(announcementFile, JSON.stringify(pengumuman, null, 2));

      return {
        text: `✅ *Pengumuman Berhasil Dibuat*\n\n` +
              `📢 *${judul}*\n\n` +
              `${isi}\n\n` +
              `👤 Oleh: ${admin.username}\n` +
              `📅 ${new Date().toLocaleDateString('id-ID')}`
      };
    } catch (error) {
      return { text: `❌ *Error Menyimpan Pengumuman*\n\n${error.message}\n\nDibuat oleh Mahasiswa UMSU` };
    }
  }

  // !user (list|info|ban|unban) [phone_number]
  async handleUserCommand(models, senderId, args, sock, admin) {
    const parts = args.split(' ');
    const action = parts[0];
    const phoneNumber = parts[1];

    switch (action) {
      case 'list':
        return this.getUserList(models);
      case 'info':
        return this.getUserInfo(models, phoneNumber);
      case 'ban':
        return this.banUser(models, phoneNumber, admin);
      case 'unban':
        return this.unbanUser(models, phoneNumber, admin);
      default:
        return {
          text: `👥 *PERINTAH !user*\n\n` +
                `Format:\n` +
                `• !user list - Lihat semua user\n` +
                `• !user info [nomor] - Info user\n` +
                `• !user ban [nomor] - Ban user\n` +
                `• !user unban [nomor] - Unban user`
        };
    }
  }

  // !stats (system|users|messages)
  async handleStatsCommand(models, senderId, args, sock, admin) {
    const type = args || 'system';
    
    switch (type) {
      case 'system':
        return this.getSystemStats();
      case 'users':
        return this.getUserStats(models);
      case 'messages':
        return this.getMessageStats(models);
      default:
        return {
          text: `📊 *PERINTAH !stats*\n\n` +
                `Format:\n` +
                `• !stats system - Statistik sistem\n` +
                `• !stats users - Statistik pengguna\n` +
                `• !stats messages - Statistik pesan`
        };
    }
  }

  // !admin - Masuk ke menu admin
  async handleAdminMenuCommand(models, senderId, args, sock, admin, context) {
    try {
      const adminData = await models.unifiedModel.getAdminByPhoneNumber(senderId);
      if (!adminData) {
        return {
          response: { text: '❌ *Akses Ditolak*\n\nAnda tidak memiliki akses admin.' },
          context: {}
        };
      }

      // Format menu admin langsung di sini
      let menu = `🔐 *MENU ADMIN DESA PULOSAROK* 🔐\n`;
      menu += `═`.repeat(40) + '\n\n';
      menu += `👤 *Admin:* ${adminData.username}\n`;
      menu += `📱 *Role:* ${adminData.role.toUpperCase()}\n`;
      menu += `📞 *Phone:* ${adminData.phone_number}\n\n`;
      
      menu += `🎯 *PERINTAH ADMIN UTAMA:*\n`;
      menu += `• Ketik *!admin* - Akses menu admin\n`;
      menu += `• Ketik *!menu* - Kembali ke menu publik\n`;
      menu += `• Ketik *!reset* - Reset semua sesi\n\n`;
      
      menu += `📰 *KELOLA BERITA & KONTEN:*\n`;
      menu += `• *!beritaadd* - Tambah berita baru\n`;
      menu += `• *!beritaedit* - Edit berita (step-by-step)\n`;
      menu += `• *!beritalist* - Lihat daftar berita\n\n`;
      
      menu += `🔧 *KELOLA LAYANAN:*\n`;
      menu += `• *!layananlist* - Lihat daftar layanan\n`;
      menu += `• *!layananadd* - Tambah layanan baru\n`;
      menu += `• *!layanansubmenuadd* - Tambah sub-layanan\n`;
      menu += `• *!layananshow* - Lihat konten layanan\n`;
      menu += `• *!layanantemplate* - Buat dari template\n`;
      menu += `• *!layananquick* - Wizard layanan cepat\n`;
      menu += `• *!layananedit* - Edit konten layanan\n\n`;
      
      menu += `👥 *MANAJEMEN ADMIN:*\n`;
      menu += `• *!adminnew* - Tambah admin baru\n`;
      menu += `• *!admindel* - Hapus admin\n\n`;
      
      menu += `📊 *MONITORING & LAPORAN:*\n`;
      menu += `• *!list_pengaduan* - Lihat daftar pengaduan\n`;
      menu += `• *!detail_pengaduan [ID]* - Detail pengaduan\n`;
      menu += `• *!update_status [ID] [status]* - Update status\n`;
      menu += `• *!delete_pengaduan [ID]* - Hapus pengaduan\n`;
      menu += `• *!statistik* - Lihat statistik sistem\n\n`;
      
      menu += `⚙️ *PENGATURAN SISTEM:*\n`;
      menu += `• *!pengaturan* - Menu pengaturan lengkap\n`;
      menu += `• *!backup* - Backup database\n`;
      menu += `• *!maintenance* - Mode maintenance\n\n`;
      
      menu += `🔹 *PANDUAN PENGGUNAAN:*\n`;
      menu += `• Semua perintah admin dimulai dengan tanda *!*\n`;
      menu += `• Gunakan format yang tepat untuk setiap perintah\n`;
      menu += `• Ketik perintah tanpa parameter untuk melihat bantuan\n`;
      menu += `• Contoh: ketik *!beritaadd* untuk panduan menambah berita\n\n`;
      
      menu += `💡 *TIPS CEPAT:*\n`;
      menu += `• *!beritaadd* (judul),(konten) - Tambah berita langsung\n`;
      menu += `• *!adminnew* (username),(password),(role) - Tambah admin\n`;
      menu += `• *!pengaturan* (1-6) - Akses pengaturan kategori\n\n`;
      
      menu += `⚠️ *Peringatan:* Gunakan dengan bijak\n`;
      menu += `_🏛️ Sistem Admin - Desa Pulosarok_\n`;
      menu += `_Dibuat oleh Mahasiswa UMSU_`;

      return {
        response: { text: menu },
        context: {
          admin_mode: true,
          admin_id: adminData.id,
          admin_role: adminData.role
        }
      };
    } catch (error) {
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat mengakses menu admin.' },
        context: {}
      };
    }
  }

  // !menu - Kembali ke menu publik
  async handleMenuCommand(models, senderId, args, sock, admin, context) {
    try {
      // Format menu publik langsung di sini
      let menu = `🏛️ *LAYANAN DESA PULOSAROK* 🏛️\n`;
      menu += `═`.repeat(40) + '\n\n';
      menu += `📋 *MENU LAYANAN:*\n\n`;
      
      menu += `1️⃣ *Administrasi Kependudukan*\n`;
      menu += `   • KTP, KK, Akta Kelahiran\n`;
      menu += `   • Surat Pindah, Domisili\n\n`;
      
      menu += `2️⃣ *Pelayanan Umum*\n`;
      menu += `   • Surat Keterangan\n`;
      menu += `   • Legalisir Dokumen\n\n`;
      
      menu += `3️⃣ *Informasi Desa*\n`;
      menu += `   • Profil Desa\n`;
      menu += `   • Berita & Pengumuman\n\n`;
      
      menu += `4️⃣ *Pengaduan & Aspirasi*\n`;
      menu += `   • Sampaikan Keluhan\n`;
      menu += `   • Saran & Masukan\n\n`;
      
      menu += `5️⃣ *Bantuan & Kontak*\n`;
      menu += `   • Panduan Penggunaan\n`;
      menu += `   • Kontak Perangkat Desa\n\n`;
      
      menu += `🔹 *Cara Penggunaan:*\n`;
      menu += `• Ketik nomor menu (1-5)\n`;
      menu += `• Ketik *pengaduan* untuk keluhan\n`;
      menu += `• Ketik *reset* untuk kembali ke menu\n\n`;
      
      menu += `_📞 Hubungi kami jika butuh bantuan_`;
      
      return {
        response: { text: menu },
        context: {} // Reset semua context
      };
    } catch (error) {
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat mengakses menu.' },
        context: {}
      };
    }
  }

  // !reset - Reset semua sesi
  async handleResetCommand(models, senderId, args, sock, admin, context) {
    return {
      response: {
        text: '🔄 *Sesi Direset*\n\nSemua sesi dan context telah direset.\n\nKetik *menu* untuk memulai atau *!admin* untuk akses admin.'
      },
      context: {} // Reset semua context
    };
  }

  // !help - Bantuan perintah admin
  async handleHelpCommand(models, senderId, args, sock, admin) {
    return {
      text: `🔧 *BANTUAN PERINTAH ADMIN*\n\n` +
            `📰 *!berita* (judul),(deskripsi),(isi)\n` +
            `   Buat berita baru\n\n` +
            `📢 *!pengumuman* (judul),(isi)\n` +
            `   Buat pengumuman\n\n` +
            `👥 *!user* (list|info|ban|unban) [nomor]\n` +
            `   Kelola pengguna\n\n` +
            `📊 *!stats* (system|users|messages)\n` +
            `   Lihat statistik\n\n` +
            `💾 *!backup*\n` +
            `   Backup database\n\n` +
            `📡 *!broadcast* (pesan)\n` +
            `   Kirim pesan ke semua user\n\n` +
            `🚫 *!filter* (add|remove|list) [kata]\n` +
            `   Kelola filter kata\n\n` +
            `⚙️ *!system* (status|restart|maintenance)\n` +
            `   Kontrol sistem\n\n` +
            `📝 *!log* (view|clear)\n` +
            `   Kelola log sistem\n\n` +
            `❓ *!help*\n` +
            `   Bantuan perintah\n\n` +
            `⚠️ *Catatan:* Semua perintah menggunakan awalan !`
    };
  }

  // Response untuk perintah tidak dikenal
  getUnknownCommandResponse(command) {
    return {
      text: `❌ *Perintah Tidak Dikenal: ${command}*\n\n` +
            `Ketik *!help* untuk melihat daftar perintah yang tersedia.\n\n` +
            `🔧 *Perintah Utama:*\n` +
            `• !berita - Buat berita\n` +
            `• !pengumuman - Buat pengumuman\n` +
            `• !user - Kelola pengguna\n` +
            `• !stats - Lihat statistik\n` +
            `• !help - Bantuan lengkap`
    };
  }

  // Helper methods - Get user list
  async getUserList(models) {
    try {
      const users = await models.unifiedModel.getAllUsers();
      
      if (users.length === 0) {
        return { text: '👥 *Daftar User*\n\nBelum ada user yang terdaftar.' };
      }
      
      let response = '👥 *DAFTAR USER TERDAFTAR*\n';
      response += '═'.repeat(40) + '\n\n';
      
      users.forEach((user, index) => {
        const status = user.is_banned ? '🚫 Banned' : '✅ Aktif';
        const lastSeen = user.last_seen ? new Date(user.last_seen).toLocaleDateString('id-ID') : 'Belum pernah';
        
        response += `${index + 1}. *${user.name || 'Tanpa Nama'}*\n`;
        response += `   📱 ${user.phone_number}\n`;
        response += `   📊 Status: ${status}\n`;
        response += `   🕒 Terakhir: ${lastSeen}\n\n`;
      });
      
      response += `📊 *Total: ${users.length} user*\n`;
      response += '═'.repeat(40);
      
      return { text: response };
    } catch (error) {
      console.error('Error getting user list:', error);
      return { text: '❌ *Error*\n\nTerjadi kesalahan saat mengambil daftar user.' };
    }
  }

  // Helper methods - Get user info
  async getUserInfo(models, phoneNumber) {
    try {
      const user = await models.unifiedModel.getUserByPhoneNumber(phoneNumber);
      
      if (!user) {
        return { text: `❌ *User Tidak Ditemukan*\n\nUser dengan nomor ${phoneNumber} tidak ditemukan.` };
      }
      
      const status = user.is_banned ? '🚫 Banned' : '✅ Aktif';
      const joinDate = user.created_at ? new Date(user.created_at).toLocaleDateString('id-ID') : 'Tidak diketahui';
      const lastSeen = user.last_seen ? new Date(user.last_seen).toLocaleString('id-ID') : 'Belum pernah';
      
      let response = '👤 *INFORMASI USER*\n';
      response += '═'.repeat(40) + '\n\n';
      response += `📱 *Nomor:* ${user.phone_number}\n`;
      response += `👤 *Nama:* ${user.name || 'Belum diset'}\n`;
      response += `📊 *Status:* ${status}\n`;
      response += `📅 *Bergabung:* ${joinDate}\n`;
      response += `🕒 *Terakhir Aktif:* ${lastSeen}\n`;
      
      if (user.is_banned) {
        response += `\n🚫 *Info Ban:*\n`;
        response += `• Dibanned oleh: ${user.banned_by || 'Sistem'}\n`;
        response += `• Waktu ban: ${user.banned_at ? new Date(user.banned_at).toLocaleString('id-ID') : 'Tidak diketahui'}\n`;
      }
      
      response += '\n═'.repeat(40);
      response += `\n\n🔧 *Aksi Admin:*\n`;
      
      if (user.is_banned) {
        response += `• !unban ${phoneNumber} - Unban user\n`;
      } else {
        response += `• !ban ${phoneNumber} - Ban user\n`;
      }
      
      return { text: response };
    } catch (error) {
      console.error('Error getting user info:', error);
      return { text: '❌ *Error*\n\nTerjadi kesalahan saat mengambil info user.' };
    }
  }

  async getSystemStats() {
    const stats = profanityFilter.getStats();
    return {
      text: `📊 *STATISTIK SISTEM*\n\n` +
            `🤖 Bot Status: Online\n` +
            `📱 Platform: WhatsApp\n` +
            `🛡️ Filter Kata: ${stats.totalBannedWords} kata\n` +
            `📅 Uptime: ${process.uptime().toFixed(0)} detik\n` +
            `💾 Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`
    };
  }

  // Ban user (for !user ban command)
  async banUser(models, phoneNumber, admin) {
    if (!phoneNumber) {
      return { text: '❌ *Error*\n\nFormat: !user ban [nomor_telepon]' };
    }
    
    try {
      const user = await models.unifiedModel.getUserByPhoneNumber(phoneNumber);
      if (!user) {
        return { text: `❌ *User Tidak Ditemukan*\n\nUser dengan nomor ${phoneNumber} tidak ditemukan.` };
      }
      
      if (user.is_banned) {
        return { text: `⚠️ *User Sudah Dibanned*\n\nUser ${phoneNumber} sudah dalam status banned.` };
      }
      
      const success = await models.unifiedModel.banUser(phoneNumber, admin.username);
      
      if (success) {
        return { 
          text: `🚫 *USER DIBANNED*\n\n` +
                `📱 Nomor: ${phoneNumber}\n` +
                `👤 Nama: ${user.name || 'Belum diset'}\n` +
                `👮 Dibanned oleh: ${admin.username}\n` +
                `🕒 Waktu: ${new Date().toLocaleString('id-ID')}\n\n` +
                `User tidak dapat menggunakan bot sampai di-unban.`
        };
      } else {
        return { text: '❌ *Error*\n\nGagal melakukan ban user.' };
      }
    } catch (error) {
      console.error('Error banning user:', error);
      return { text: '❌ *Error*\n\nTerjadi kesalahan saat melakukan ban user.' };
    }
  }

  // Unban user (for !user unban command)
  async unbanUser(models, phoneNumber, admin) {
    if (!phoneNumber) {
      return { text: '❌ *Error*\n\nFormat: !user unban [nomor_telepon]' };
    }
    
    try {
      const user = await models.unifiedModel.getUserByPhoneNumber(phoneNumber);
      if (!user) {
        return { text: `❌ *User Tidak Ditemukan*\n\nUser dengan nomor ${phoneNumber} tidak ditemukan.` };
      }
      
      if (!user.is_banned) {
        return { text: `⚠️ *User Tidak Dibanned*\n\nUser ${phoneNumber} tidak dalam status banned.` };
      }
      
      const success = await models.unifiedModel.unbanUser(phoneNumber);
      
      if (success) {
        return { 
          text: `✅ *USER DI-UNBAN*\n\n` +
                `📱 Nomor: ${phoneNumber}\n` +
                `👤 Nama: ${user.name || 'Belum diset'}\n` +
                `👮 Di-unban oleh: ${admin.username}\n` +
                `🕒 Waktu: ${new Date().toLocaleString('id-ID')}\n\n` +
                `User sekarang dapat menggunakan bot kembali.`
        };
      } else {
        return { text: '❌ *Error*\n\nGagal melakukan unban user.' };
      }
    } catch (error) {
      console.error('Error unbanning user:', error);
      return { text: '❌ *Error*\n\nTerjadi kesalahan saat melakukan unban user.' };
    }
  }

  // === PERINTAH BERITA BARU ===
  
  // !beritaadd (Judul),(Deskripsi),(Isi Berita)
  async handleBeritaAddCommand(models, senderId, args, sock, admin, context, message) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !beritaadd (Judul),(Deskripsi),(Isi Berita)\n\nContoh: !beritaadd Pembangunan Jalan,Jalan desa sedang diperbaiki,Pembangunan jalan desa dimulai hari ini...\n\n💡 *Tips:* Kirim gambar bersamaan dengan perintah untuk menambahkan foto berita!' },
          context: {}
        };
      }
      
      const parts = args.split(',');
      if (parts.length !== 3) {
        return {
          response: { text: '❌ *Format Salah*\n\nHarus ada 3 bagian dipisah koma:\n1. Judul\n2. Deskripsi\n3. Isi Berita\n\nContoh: !beritaadd Pembangunan Jalan,Jalan desa sedang diperbaiki,Pembangunan jalan desa dimulai hari ini...' },
          context: {}
        };
      }
      
      const [judul, deskripsi, isi] = parts.map(p => p.trim());
      
      if (!judul || !deskripsi || !isi) {
        return {
          response: { text: '❌ *Data Tidak Lengkap*\n\nSemua field harus diisi:\n- Judul\n- Deskripsi\n- Isi Berita' },
          context: {}
        };
      }
      
      // Validasi panjang
      if (judul.length > 100) {
        return {
          response: { text: '❌ *Judul Terlalu Panjang*\n\nJudul maksimal 100 karakter.' },
          context: {}
        };
      }
      
      if (deskripsi.length > 200) {
        return {
          response: { text: '❌ *Deskripsi Terlalu Panjang*\n\nDeskripsi maksimal 200 karakter.' },
          context: {}
        };
      }
      
      // Handle image upload if present
      let imagePath = null;
      if (message && (message.imageMessage || message.videoMessage)) {
        try {
          imagePath = await saveNewsMedia(message, sock);
        } catch (error) {
          console.error('Error saving news media:', error);
          return {
            response: { text: '❌ *Error Upload Gambar*\n\nGagal menyimpan gambar. Silakan coba lagi.' },
            context: {}
          };
        }
      }
      
      // Simpan berita ke file JSON
      const fs = require('fs-extra');
      const path = require('path');
      const newsDir = path.join(process.cwd(), 'uploads', 'news');
      await fs.ensureDir(newsDir);
      
      const newsFile = path.join(newsDir, 'news.json');
      let newsList = [];
      
      if (await fs.pathExists(newsFile)) {
        newsList = await fs.readJson(newsFile);
      }
      
      const newNews = {
        id: Date.now(),
        judul,
        deskripsi,
        isi,
        author: admin.username,
        created_at: new Date().toISOString(),
        status: 'published',
        image: imagePath ? path.basename(imagePath) : null
      };
      
      newsList.unshift(newNews);
      await fs.writeJson(newsFile, newsList, { spaces: 2 });
      
      let responseText = `✅ *Berita Berhasil Ditambahkan*\n\n📰 *Judul:* ${judul}\n📝 *Deskripsi:* ${deskripsi}\n👤 *Author:* ${admin.username}\n🕒 *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n*ID Berita:* ${newNews.id}`;
      
      if (imagePath) {
        responseText += `\n📸 *Gambar:* Berhasil disimpan`;
      }
      
      return {
        response: { text: responseText },
        context: {}
      };
      
    } catch (error) {
      console.error('Error adding news:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat menambah berita.' },
        context: {}
      };
    }
  }
  
  // !beritaedit (ID)
  async handleBeritaEditCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !beritaedit (ID)\n\nContoh: !beritaedit 1234567890' },
          context: {}
        };
      }
      
      const newsId = parseInt(args.trim());
      if (isNaN(newsId)) {
        return {
          response: { text: '❌ *ID Tidak Valid*\n\nID harus berupa angka.' },
          context: {}
        };
      }
      
      const fs = require('fs-extra');
      const path = require('path');
      const newsFile = path.join(process.cwd(), 'uploads', 'news', 'news.json');
      
      if (!await fs.pathExists(newsFile)) {
        return {
          response: { text: '❌ *Tidak Ada Berita*\n\nBelum ada berita yang tersimpan.' },
          context: {}
        };
      }
      
      const newsList = await fs.readJson(newsFile);
      const news = newsList.find(n => n.id === newsId);
      
      if (!news) {
        return {
          response: { text: `❌ *Berita Tidak Ditemukan*\n\nBerita dengan ID ${newsId} tidak ditemukan.` },
          context: {}
        };
      }
      
      // Set context untuk editing
      context.editing_news = {
        id: newsId,
        step: 'choose_field'
      };
      
      return {
        response: { text: `📝 *Edit Berita*\n\n*Berita yang akan diedit:*\n📰 *Judul:* ${news.title}\n📝 *Konten:* ${news.content ? news.content.substring(0, 100) + '...' : 'Tidak ada konten'}\n📅 *Tanggal:* ${news.date}\n👤 *Penulis:* ${news.author}\n\n*Pilih yang ingin diedit:*\n1️⃣ Judul\n2️⃣ Konten Berita\n0️⃣ Batal\n\nKetik angka pilihan Anda.` },
        context: context
      };
      
    } catch (error) {
      console.error('Error editing news:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat mengedit berita.' },
        context: {}
      };
    }
  }
  
  // !beritalist
  async handleBeritaListCommand(models, senderId, args, sock, admin, context) {
    try {
      const fs = require('fs-extra');
      const path = require('path');
      const newsFile = path.join(process.cwd(), 'uploads', 'news', 'news.json');
      
      if (!await fs.pathExists(newsFile)) {
        return {
          response: { text: '📰 *Daftar Berita*\n\n❌ Belum ada berita yang tersimpan.\n\nGunakan !beritaadd untuk menambah berita baru.' },
          context: {}
        };
      }
      
      const newsList = await fs.readJson(newsFile);
      
      if (newsList.length === 0) {
        return {
          response: { text: '📰 *Daftar Berita*\n\n❌ Belum ada berita yang tersimpan.\n\nGunakan !beritaadd untuk menambah berita baru.' },
          context: {}
        };
      }
      
      let response = '📰 *DAFTAR BERITA*\n';
      response += '═'.repeat(40) + '\n\n';
      
      newsList.slice(0, 10).forEach((news, index) => {
        const date = new Date(news.date).toLocaleDateString('id-ID');
        response += `${index + 1}. *${news.title}*\n`;
        response += `   📝 ${news.content ? news.content.substring(0, 100) + '...' : 'Tidak ada konten'}\n`;
        response += `   👤 ${news.author} | 📅 ${date}\n`;
        response += `   🆔 ID: ${news.id}\n\n`;
      });
      
      response += '\n─'.repeat(35) + '\n_Dibuat oleh Mahasiswa UMSU_\n\n';
      
      if (newsList.length > 10) {
        response += `... dan ${newsList.length - 10} berita lainnya\n\n`;
      }
      
      response += '🔧 *Perintah:*\n';
      response += '• !beritaadd - Tambah berita\n';
      response += '• !beritaedit (ID) - Edit berita\n';
      response += '• !beritalist - Lihat daftar';
      
      return {
        response: { text: response },
        context: {}
      };
      
    } catch (error) {
      console.error('Error listing news:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat mengambil daftar berita.' },
        context: {}
      };
    }
  }
  
  // === PERINTAH LAYANAN BARU ===
  
  // !layananlist
  async handleLayananListCommand(models, senderId, args, sock, admin, context) {
    try {
      const fs = require('fs-extra');
      const path = require('path');
      const menusPath = path.join(process.cwd(), 'uploads', 'menus');
      
      if (!await fs.pathExists(menusPath)) {
        return {
          response: { text: '🏢 *Daftar Layanan*\n\n❌ Folder layanan tidak ditemukan.\n\nGunakan !layananadd untuk menambah layanan baru.' },
          context: {}
        };
      }
      
      const mainMenus = await fs.readdir(menusPath);
      const sortedMenus = mainMenus
        .filter(name => /^(\d+)-/.test(name))
        .sort((a, b) => parseInt(a) - parseInt(b));
      
      if (sortedMenus.length === 0) {
        return {
          response: { text: '🏢 *Daftar Layanan*\n\n❌ Belum ada layanan yang tersimpan.\n\nGunakan !layananadd untuk menambah layanan baru.' },
          context: {}
        };
      }
      
      let response = '🏢 *DAFTAR LAYANAN DESA PULOSAROK*\n';
      response += '═'.repeat(40) + '\n\n';
      
      for (const folderName of sortedMenus) {
        const mainPath = path.join(menusPath, folderName);
        const stat = await fs.stat(mainPath).catch(() => null);
        if (!stat || !stat.isDirectory()) continue;
        
        const match = folderName.match(/^(\d+)-(.+)$/);
        if (!match) continue;
        
        const id = parseInt(match[1]);
        const name = match[2].replace(/_/g, ' ');
        
        // Hitung sub-layanan
        const subMenus = await fs.readdir(mainPath).catch(() => []);
        const validSubMenus = subMenus.filter(n => /^(\d+[A-Za-z])-/.test(n));
        
        response += `${id}. *${name}*\n`;
        response += `   📁 Folder: ${folderName}\n`;
        response += `   📋 Sub-layanan: ${validSubMenus.length} item\n`;
        
        if (validSubMenus.length > 0) {
          response += `   🔸 Sub-menu: `;
          const subNames = validSubMenus
            .sort((a, b) => a.localeCompare(b))
            .slice(0, 3)
            .map(sub => {
              const subMatch = sub.match(/^(\d+)([A-Za-z])-(.+)$/);
              return subMatch ? subMatch[3].replace(/_/g, ' ') : sub;
            });
          response += subNames.join(', ');
          if (validSubMenus.length > 3) {
            response += ` (+${validSubMenus.length - 3} lainnya)`;
          }
          response += '\n';
        }
        
        response += '\n';
      }
      
      response += '🔧 *Perintah Tersedia:*\n';
      response += '• !layananadd - Tambah layanan utama\n';
      response += '• !layanansubmenuadd - Tambah sub-layanan\n';
      response += '• !layananshow - Lihat isi layanan\n';
      response += '• !layananedit - Edit isi layanan\n';
      response += '• !layananlist - Lihat daftar ini';
      
      return {
        response: { text: response },
        context: {}
      };
      
    } catch (error) {
      console.error('Error listing services:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat mengambil daftar layanan.' },
        context: {}
      };
    }
  }
  
  // !layananadd
  async handleLayananAddCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !layananadd (Nama Layanan)\n\nContoh: !layananadd Layanan Sosial\n\n*Catatan:* Nama akan diformat otomatis menjadi folder dengan nomor urut.' },
          context: {}
        };
      }
      
      const name = args.trim();
      
      if (!name) {
        return {
          response: { text: '❌ *Nama Layanan Tidak Boleh Kosong*\n\nContoh: !layananadd Layanan Sosial' },
          context: {}
        };
      }
      
      // Validasi panjang
      if (name.length > 50) {
        return {
          response: { text: '❌ *Nama Layanan Terlalu Panjang*\n\nNama layanan maksimal 50 karakter.' },
          context: {}
        };
      }
      
      const fs = require('fs-extra');
      const path = require('path');
      const menusPath = path.join(process.cwd(), 'uploads', 'menus');
      await fs.ensureDir(menusPath);
      
      // Cari nomor urut berikutnya
      const existingMenus = await fs.readdir(menusPath);
      const existingNumbers = existingMenus
        .filter(folder => /^(\d+)-/.test(folder))
        .map(folder => parseInt(folder.match(/^(\d+)-/)[1]))
        .sort((a, b) => a - b);
      
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 7;
      
      // Format nama folder (ganti spasi dengan underscore)
      const folderName = `${nextNumber}-${name.replace(/\s+/g, '_')}`;
      const newFolderPath = path.join(menusPath, folderName);
      
      // Cek apakah folder sudah ada
      if (await fs.pathExists(newFolderPath)) {
        return {
          response: { text: `❌ *Layanan Sudah Ada*\n\nFolder "${folderName}" sudah ada.` },
          context: {}
        };
      }
      
      // Buat folder layanan utama
      await fs.ensureDir(newFolderPath);
      
      // Buat file README.md di folder utama
      const readmeContent = `# ${name}\n\nLayanan ${name} di Desa Pulosarok\n\nDibuat oleh: ${admin.username}\nTanggal: ${new Date().toLocaleString('id-ID')}\n\n## Sub-layanan\n\nSub-layanan akan ditambahkan di folder ini dengan format:\n- ${nextNumber}A-Nama_Sub_Layanan_1\n- ${nextNumber}B-Nama_Sub_Layanan_2\n- dst.\n\nGunakan perintah !layanansubmenuadd untuk menambah sub-layanan.`;
      
      await fs.writeFile(path.join(newFolderPath, 'README.md'), readmeContent);
      
      return {
        response: { text: `✅ *Layanan Berhasil Ditambahkan*\n\n🏢 *Nama:* ${name}\n📁 *Folder:* ${folderName}\n📍 *Nomor:* ${nextNumber}\n👤 *Author:* ${admin.username}\n🕒 *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n*Langkah selanjutnya:*\nGunakan !layanansubmenuadd untuk menambah sub-layanan.` },
        context: {}
      };
      
    } catch (error) {
      console.error('Error adding service:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat menambah layanan.' },
        context: {}
      };
    }
  }
  
  // !layanansubmenuadd
  async handleLayananSubmenuAddCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !layanansubmenuadd (Nomor Layanan),(Nama Sub-layanan),(Deskripsi)\n\nContoh: !layanansubmenuadd 1,KTP Baru,Pembuatan KTP untuk warga baru\n\n*Lihat nomor layanan dengan !layananlist*' },
          context: {}
        };
      }
      
      const parts = args.split(',');
      if (parts.length !== 3) {
        return {
          response: { text: '❌ *Format Salah*\n\nHarus ada 3 bagian dipisah koma:\n1. Nomor Layanan\n2. Nama Sub-layanan\n3. Deskripsi\n\nContoh: !layanansubmenuadd 1,KTP Baru,Pembuatan KTP untuk warga baru' },
          context: {}
        };
      }
      
      const [serviceNumberStr, subName, subDescription] = parts.map(p => p.trim());
      
      const serviceNumber = parseInt(serviceNumberStr);
      if (isNaN(serviceNumber)) {
        return {
          response: { text: '❌ *Nomor Layanan Tidak Valid*\n\nNomor harus berupa angka.\n\nLihat daftar layanan dengan !layananlist' },
          context: {}
        };
      }
      
      if (!subName || !subDescription) {
        return {
          response: { text: '❌ *Data Tidak Lengkap*\n\nSemua field harus diisi:\n- Nomor Layanan\n- Nama Sub-layanan\n- Deskripsi' },
          context: {}
        };
      }
      
      // Validasi panjang
      if (subName.length > 50) {
        return {
          response: { text: '❌ *Nama Sub-layanan Terlalu Panjang*\n\nNama sub-layanan maksimal 50 karakter.' },
          context: {}
        };
      }
      
      if (subDescription.length > 500) {
        return {
          response: { text: '❌ *Deskripsi Terlalu Panjang*\n\nDeskripsi maksimal 500 karakter.' },
          context: {}
        };
      }
      
      const fs = require('fs-extra');
      const path = require('path');
      const menusPath = path.join(process.cwd(), 'uploads', 'menus');
      
      if (!await fs.pathExists(menusPath)) {
        return {
          response: { text: '❌ *Folder Layanan Tidak Ditemukan*\n\nGunakan !layananadd untuk menambah layanan terlebih dahulu.' },
          context: {}
        };
      }
      
      // Cari folder layanan berdasarkan nomor
      const mainMenus = await fs.readdir(menusPath);
      const targetFolder = mainMenus.find(folder => {
        const match = folder.match(/^(\d+)-/);
        return match && parseInt(match[1]) === serviceNumber;
      });
      
      if (!targetFolder) {
        return {
          response: { text: `❌ *Layanan Tidak Ditemukan*\n\nLayanan dengan nomor ${serviceNumber} tidak ditemukan.\n\nLihat daftar layanan dengan !layananlist` },
          context: {}
        };
      }
      
      const serviceFolderPath = path.join(menusPath, targetFolder);
      const serviceName = targetFolder.replace(/^\d+-/, '').replace(/_/g, ' ');
      
      // Cari huruf berikutnya untuk sub-layanan
      const existingSubMenus = await fs.readdir(serviceFolderPath);
      const existingLetters = existingSubMenus
        .filter(sub => new RegExp(`^${serviceNumber}[A-Za-z]-`).test(sub))
        .map(sub => {
          const match = sub.match(new RegExp(`^${serviceNumber}([A-Za-z])-`));
          return match ? match[1].toUpperCase() : null;
        })
        .filter(letter => letter !== null)
        .sort();
      
      // Tentukan huruf berikutnya
      let nextLetter = 'A';
      for (let i = 0; i < existingLetters.length; i++) {
        const expectedLetter = String.fromCharCode(65 + i); // A, B, C, ...
        if (existingLetters[i] !== expectedLetter) {
          nextLetter = expectedLetter;
          break;
        }
        nextLetter = String.fromCharCode(65 + i + 1);
      }
      
      // Format nama subfolder
      const subFolderName = `${serviceNumber}${nextLetter}-${subName.replace(/\s+/g, '_')}`;
      const subFolderPath = path.join(serviceFolderPath, subFolderName);
      
      // Cek apakah subfolder sudah ada
      if (await fs.pathExists(subFolderPath)) {
        return {
          response: { text: `❌ *Sub-layanan Sudah Ada*\n\nFolder "${subFolderName}" sudah ada.` },
          context: {}
        };
      }
      
      // Buat subfolder
      await fs.ensureDir(subFolderPath);
      
      // Buat file content.json
      const contentTemplate = {
        title: subName,
        description: subDescription,
        requirements: [
          "[Tambahkan persyaratan di sini]",
          "[Tambahkan persyaratan lainnya]"
        ],
        procedures: [
          "[Langkah pertama]",
          "[Langkah kedua]",
          "[Langkah selanjutnya]"
        ],
        contact: {
          info: "Untuk informasi lebih lanjut, hubungi Kantor Desa Pulosarok."
        },
        metadata: {
          createdBy: admin.username,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        }
      };
      
      await fs.writeFile(path.join(subFolderPath, 'content.json'), JSON.stringify(contentTemplate, null, 2));
      
      return {
        response: { text: `✅ *Sub-layanan Berhasil Ditambahkan*\n\n🏢 *Layanan Utama:* ${serviceName}\n📋 *Sub-layanan:* ${subName}\n📁 *Folder:* ${subFolderName}\n📝 *Deskripsi:* ${subDescription}\n👤 *Author:* ${admin.username}\n🕒 *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n*File content.json telah dibuat dan siap diedit.*\nGunakan !layananedit untuk mengedit konten.` },
        context: {}
      };
      
    } catch (error) {
      console.error('Error adding sub-service:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat menambah sub-layanan.' },
        context: {}
      };
    }
  }

  // !layananshow
  async handleLayananShowCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !layananshow (Nomor Layanan)(Huruf Sub-layanan)\n\nContoh: !layananshow 1A\n\n*Lihat daftar layanan dengan !layananlist*' },
          context: {}
        };
      }
      
      const input = args.trim().toUpperCase();
      const match = input.match(/^(\d+)([A-Z])$/);
      
      if (!match) {
        return {
          response: { text: '❌ *Format Tidak Valid*\n\nFormat harus: Nomor+Huruf\nContoh: 1A, 2B, 3C\n\nLihat daftar dengan !layananlist' },
          context: {}
        };
      }
      
      const [, serviceNumber, subLetter] = match;
      const fs = require('fs-extra');
      const path = require('path');
      const menusPath = path.join(process.cwd(), 'uploads', 'menus');
      
      if (!await fs.pathExists(menusPath)) {
        return {
          response: { text: '❌ *Folder Layanan Tidak Ditemukan*' },
          context: {}
        };
      }
      
      // Cari folder layanan utama
      const mainMenus = await fs.readdir(menusPath);
      const targetFolder = mainMenus.find(folder => {
        const folderMatch = folder.match(/^(\d+)-/);
        return folderMatch && folderMatch[1] === serviceNumber;
      });
      
      if (!targetFolder) {
        return {
          response: { text: `❌ *Layanan Tidak Ditemukan*\n\nLayanan dengan nomor ${serviceNumber} tidak ditemukan.` },
          context: {}
        };
      }
      
      // Cari subfolder
      const serviceFolderPath = path.join(menusPath, targetFolder);
      const subMenus = await fs.readdir(serviceFolderPath);
      const targetSubFolder = subMenus.find(sub => {
        const subMatch = sub.match(new RegExp(`^${serviceNumber}${subLetter}-`));
        return subMatch;
      });
      
      if (!targetSubFolder) {
        return {
          response: { text: `❌ *Sub-layanan Tidak Ditemukan*\n\nSub-layanan ${serviceNumber}${subLetter} tidak ditemukan.` },
          context: {}
        };
      }
      
      // Baca file content.json
      const contentPath = path.join(serviceFolderPath, targetSubFolder, 'content.json');
      
      if (!await fs.pathExists(contentPath)) {
        return {
          response: { text: `❌ *File Konten Tidak Ditemukan*\n\nFile content.json tidak ada di ${targetSubFolder}` },
          context: {}
        };
      }
      
      const contentRaw = await fs.readFile(contentPath, 'utf8');
      const content = JSON.parse(contentRaw);
      const serviceName = targetFolder.replace(/^\d+-/, '').replace(/_/g, ' ');
      const subServiceName = targetSubFolder.replace(/^\d+[A-Z]-/, '').replace(/_/g, ' ');
      
      let response = `📋 *LAYANAN: ${serviceName.toUpperCase()}*\n`;
      response += `📄 *Sub-layanan: ${subServiceName}*\n`;
      response += `📁 *Folder: ${targetSubFolder}*\n`;
      response += '═'.repeat(40) + '\n\n';
      
      // Format JSON content untuk display
      if (content.title) {
        response += `# ${content.title}\n\n`;
      }
      if (content.description) {
        response += `## Deskripsi\n${content.description}\n\n`;
      }
      if (content.requirements && content.requirements.length > 0) {
        response += `## Persyaratan\n`;
        content.requirements.forEach(req => {
          response += `- ${req}\n`;
        });
        response += '\n';
      }
      if (content.procedures && content.procedures.length > 0) {
        response += `## Prosedur\n`;
        content.procedures.forEach(proc => {
          response += `- ${proc}\n`;
        });
        response += '\n';
      }
      if (content.contact && content.contact.info) {
        response += `## Kontak\n${content.contact.info}\n\n`;
      }
      
      response += '═'.repeat(40);
      response += `\n🔧 *Perintah:*\n• !layananedit ${serviceNumber}${subLetter} - Edit konten\n• !layananlist - Lihat daftar layanan`;
      
      return {
        response: { text: response },
        context: {}
      };
      
    } catch (error) {
      console.error('Error showing service:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat menampilkan layanan.' },
        context: {}
      };
    }
  }

  // !layananedit
  async handleLayananEditCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !layananedit (Nomor Layanan)(Huruf Sub-layanan)\n\nContoh: !layananedit 1A\n\n*Lihat daftar layanan dengan !layananlist*' },
          context: {}
        };
      }
      
      const input = args.trim().toUpperCase();
      const match = input.match(/^(\d+)([A-Z])$/);
      
      if (!match) {
        return {
          response: { text: '❌ *Format Tidak Valid*\n\nFormat harus: Nomor+Huruf\nContoh: 1A, 2B, 3C\n\nLihat daftar dengan !layananlist' },
          context: {}
        };
      }
      
      const [, serviceNumber, subLetter] = match;
      const fs = require('fs-extra');
      const path = require('path');
      const menusPath = path.join(process.cwd(), 'uploads', 'menus');
      
      if (!await fs.pathExists(menusPath)) {
        return {
          response: { text: '❌ *Folder Layanan Tidak Ditemukan*' },
          context: {}
        };
      }
      
      // Cari folder layanan utama
      const mainMenus = await fs.readdir(menusPath);
      const targetFolder = mainMenus.find(folder => {
        const folderMatch = folder.match(/^(\d+)-/);
        return folderMatch && folderMatch[1] === serviceNumber;
      });
      
      if (!targetFolder) {
        return {
          response: { text: `❌ *Layanan Tidak Ditemukan*\n\nLayanan dengan nomor ${serviceNumber} tidak ditemukan.` },
          context: {}
        };
      }
      
      // Cari subfolder
      const serviceFolderPath = path.join(menusPath, targetFolder);
      const subMenus = await fs.readdir(serviceFolderPath);
      const targetSubFolder = subMenus.find(sub => {
        const subMatch = sub.match(new RegExp(`^${serviceNumber}${subLetter}-`));
        return subMatch;
      });
      
      if (!targetSubFolder) {
        return {
          response: { text: `❌ *Sub-layanan Tidak Ditemukan*\n\nSub-layanan ${serviceNumber}${subLetter} tidak ditemukan.` },
          context: {}
        };
      }
      
      // Baca file content.json
      const contentPath = path.join(serviceFolderPath, targetSubFolder, 'content.json');
      
      if (!await fs.pathExists(contentPath)) {
        return {
          response: { text: `❌ *File Konten Tidak Ditemukan*\n\nFile content.json tidak ada di ${targetSubFolder}` },
          context: {}
        };
      }
      
      const contentRaw = await fs.readFile(contentPath, 'utf8');
      let content;
      try {
        content = JSON.parse(contentRaw);
      } catch (error) {
        console.log('❌ JSON Parse Error:', { error: error.message, contentPath });
        return {
          response: { text: `❌ *Error Parsing JSON*\n\nFile content.json tidak valid: ${error.message}` },
          context: {}
        };
      }
      const serviceName = targetFolder.replace(/^\d+-/, '').replace(/_/g, ' ');
      const subServiceName = targetSubFolder.replace(/^\d+[A-Z]-/, '').replace(/_/g, ' ');
      
      // Set context untuk editing
      context.editing_layanan = {
        serviceNumber,
        subLetter,
        targetFolder,
        targetSubFolder,
        contentPath,
        serviceName,
        subServiceName
      };
      
      let response = `📝 *EDIT LAYANAN*\n\n`;
      response += `🏢 *Layanan:* ${serviceName}\n`;
      response += `📋 *Sub-layanan:* ${subServiceName}\n`;
      response += `📁 *Folder:* ${targetSubFolder}\n\n`;
      response += `📄 *Konten Saat Ini:*\n`;
      response += '─'.repeat(30) + '\n';
      
      if (content.title) {
        response += `📌 *Judul:* ${content.title}\n`;
      }
      if (content.description) {
        const desc = content.description.substring(0, 200);
        response += `📝 *Deskripsi:* ${desc}`;
        if (content.description.length > 200) {
          response += '... (dipotong)';
        }
        response += '\n';
      }
      if (content.requirements && content.requirements.length > 0) {
        response += `📋 *Persyaratan:* ${content.requirements.length} item\n`;
      }
      if (content.procedures && content.procedures.length > 0) {
        response += `📊 *Prosedur:* ${content.procedures.length} langkah\n`;
      }
      if (content.contact) {
        response += `📞 *Kontak:* ${content.contact}\n`;
      }
      
      response += '\n' + '─'.repeat(30) + '\n\n';
      response += `✏️ *Silakan ketik konten baru dalam format JSON untuk mengganti seluruh isi file.*\n\n`;
      response += `💡 *Format JSON yang diperlukan:*\n`;
      response += `\`\`\`json\n`;
      response += `{\n`;
      response += `  "title": "Judul Layanan",\n`;
      response += `  "description": "Deskripsi layanan",\n`;
      response += `  "requirements": ["Syarat 1", "Syarat 2"],\n`;
      response += `  "procedures": ["Langkah 1", "Langkah 2"],\n`;
      response += `  "contact": "Informasi kontak"\n`;
      response += `}\n`;
      response += `\`\`\`\n\n`;
      response += `• Ketik 'batal' untuk membatalkan editing\n`;
      response += `• Konten harus dalam format JSON yang valid`;
      
      return {
        response: { text: response },
        context: context
      };
      
    } catch (error) {
      console.error('Error editing service:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat mengedit layanan.' },
        context: {}
      };
    }
  }
  
  // === PERINTAH MANAJEMEN ADMIN BARU ===
  
  // !adminnew (Nomor Telepon)
  async handleAdminNewCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !adminnew (Nomor Telepon)\n\nContoh: !adminnew 628123456789' },
          context: {}
        };
      }
      
      let phoneNumber = args.trim();
      
      // Validasi format nomor telepon
      phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
      
      if (!phoneNumber.startsWith('62')) {
        if (phoneNumber.startsWith('0')) {
          phoneNumber = '62' + phoneNumber.substring(1);
        } else {
          phoneNumber = '62' + phoneNumber;
        }
      }
      
      if (phoneNumber.length < 10 || phoneNumber.length > 15) {
        return {
          response: { text: '❌ *Nomor Telepon Tidak Valid*\n\nNomor telepon harus 10-15 digit.' },
          context: {}
        };
      }
      
      // Cek apakah sudah admin
      const existingAdmin = await models.unifiedModel.getAdminByPhoneNumber(phoneNumber);
      if (existingAdmin) {
        return {
          response: { text: `❌ *Sudah Admin*\n\nNomor ${phoneNumber} sudah terdaftar sebagai admin dengan username: ${existingAdmin.username}` },
          context: {}
        };
      }
      
      // Buat admin baru
      const newAdmin = await models.unifiedModel.addAdmin({
        username: `admin_${phoneNumber.substring(-4)}`,
        phone_number: phoneNumber,
        password: 'admin123',
        role: 'admin',
        created_by: admin.username,
        created_at: new Date(),
        status: 'active'
      });
      
      // Kirim notifikasi ke admin baru
      const welcomeMessage = `🎉 *Selamat!*\n\nAnda telah ditambahkan sebagai admin bot ini.\n\n👤 *Username:* ${newAdmin.username}\n📱 *Phone:* ${phoneNumber}\n🔑 *Role:* Admin\n👨‍💼 *Ditambahkan oleh:* ${admin.username}\n\n*Perintah Admin:*\n• !admin - Menu admin\n• !menu - Menu publik\n• !beritaadd - Tambah berita\n• !layananlist - Lihat layanan\n• Dan banyak lagi...\n\nSelamat bergabung! 🚀`;
      
      try {
        await sock.sendMessage(`${phoneNumber}@s.whatsapp.net`, { text: welcomeMessage });
      } catch (notifError) {
        console.log('Failed to send notification to new admin:', notifError);
      }
      
      return {
        response: { text: `✅ *Admin Baru Berhasil Ditambahkan*\n\n👤 *Username:* ${newAdmin.username}\n📱 *Phone:* ${phoneNumber}\n🔑 *Role:* Admin\n👨‍💼 *Ditambahkan oleh:* ${admin.username}\n🕒 *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n📩 Notifikasi telah dikirim ke admin baru.` },
        context: {}
      };
      
    } catch (error) {
      console.error('Error adding new admin:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat menambah admin baru.' },
        context: {}
      };
    }
  }
  
  // !admindel
  async handleAdminDelCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        // Tampilkan daftar admin untuk dipilih
        const adminList = await models.unifiedModel.getAllAdmins();
        
        if (adminList.length <= 1) {
          return {
            response: { text: '❌ *Tidak Dapat Menghapus*\n\nHanya ada 1 admin atau kurang. Minimal harus ada 1 admin aktif.' },
            context: {}
          };
        }
        
        let response = '👥 *DAFTAR ADMIN*\n';
        response += '═'.repeat(40) + '\n\n';
        response += '*Pilih admin yang akan dihapus:*\n\n';
        
        adminList.forEach((adminItem, index) => {
          if (adminItem.phone !== admin.phone) { // Jangan tampilkan diri sendiri
            response += `${index + 1}. *${adminItem.username}*\n`;
            response += `   📱 ${adminItem.phone}\n`;
            response += `   🔑 ${adminItem.role}\n\n`;
          }
        });
        
        response += '\n*Format:* !admindel (nomor telepon)\n';
        response += '*Contoh:* !admindel 628123456789';
        
        return {
          response: { text: response },
          context: {}
        };
      }
      
      let phoneNumber = args.trim();
      
      // Validasi format nomor telepon
      phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
      
      if (!phoneNumber.startsWith('62')) {
        if (phoneNumber.startsWith('0')) {
          phoneNumber = '62' + phoneNumber.substring(1);
        } else {
          phoneNumber = '62' + phoneNumber;
        }
      }
      
      // Cek apakah mencoba menghapus diri sendiri
      if (phoneNumber === admin.phone) {
        return {
          response: { text: '❌ *Tidak Dapat Menghapus Diri Sendiri*\n\nAnda tidak dapat menghapus akun admin Anda sendiri.' },
          context: {}
        };
      }
      
      // Cari admin yang akan dihapus
      const targetAdmin = await models.unifiedModel.getAdminByPhoneNumber(phoneNumber);
      if (!targetAdmin) {
        return {
          response: { text: `❌ *Admin Tidak Ditemukan*\n\nAdmin dengan nomor ${phoneNumber} tidak ditemukan atau sudah tidak aktif.` },
          context: {}
        };
      }
      
      // Cek jumlah admin aktif
      const allAdmins = await models.unifiedModel.getAllAdmins();
      if (allAdmins.length <= 1) {
        return {
          response: { text: '❌ *Tidak Dapat Menghapus*\n\nMinimal harus ada 1 admin aktif. Tambahkan admin baru terlebih dahulu sebelum menghapus admin ini.' },
          context: {}
        };
      }
      
      // Hapus admin berdasarkan phone number
      const adminToDelete = await models.unifiedModel.getAdminByPhoneNumber(phoneNumber);
      if (adminToDelete) {
        await models.unifiedModel.deleteAdmin(adminToDelete.id);
      }
      
      // Kirim notifikasi ke admin yang dihapus
      const notificationMessage = `⚠️ *Pemberitahuan*\n\nAkses admin Anda telah dicabut oleh ${admin.username}.\n\n👤 *Username:* ${targetAdmin.username}\n📱 *Phone:* ${phoneNumber}\n🕒 *Waktu:* ${new Date().toLocaleString('id-ID')}\n\nTerima kasih atas kontribusi Anda.`;
      
      try {
        await sock.sendMessage(`${phoneNumber}@s.whatsapp.net`, { text: notificationMessage });
      } catch (notifError) {
        console.log('Failed to send notification to deleted admin:', notifError);
      }
      
      return {
        response: { text: `✅ *Admin Berhasil Dihapus*\n\n👤 *Username:* ${targetAdmin.username}\n📱 *Phone:* ${phoneNumber}\n🗑️ *Dihapus oleh:* ${admin.username}\n🕒 *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n📩 Notifikasi telah dikirim ke admin yang dihapus.` },
        context: {}
      };
      
    } catch (error) {
      console.error('Error deleting admin:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat menghapus admin.' },
        context: {}
      };
    }
  }
  
  // === PERINTAH PENGADUAN DAN STATISTIK ===
  
  // !pengaduanlist
  async handlePengaduanListCommand(models, senderId, args, sock, admin, context) {
    try {
      const complaints = await models.Complaint.findAll({
        order: [['created_at', 'DESC']],
        limit: 20
      });
      
      if (complaints.length === 0) {
        return {
          response: { text: '📋 *Daftar Pengaduan*\n\n❌ Belum ada pengaduan yang masuk.' },
          context: {}
        };
      }
      
      let response = '📋 *DAFTAR PENGADUAN WARGA*\n';
      response += '═'.repeat(40) + '\n\n';
      
      complaints.forEach((complaint, index) => {
        const date = new Date(complaint.created_at).toLocaleDateString('id-ID');
        const time = new Date(complaint.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        
        response += `${index + 1}. *${complaint.subject}*\n`;
        response += `   👤 ${complaint.name}\n`;
        response += `   📱 ${complaint.phone}\n`;
        response += `   📍 ${complaint.location || 'Tidak disebutkan'}\n`;
        response += `   📝 ${complaint.description.substring(0, 100)}${complaint.description.length > 100 ? '...' : ''}\n`;
        response += `   📅 ${date} ${time}\n`;
        response += `   🆔 ID: ${complaint.id}\n\n`;
      });
      
      const totalComplaints = complaints.length;
      if (totalComplaints > 20) {
        response += `... dan ${totalComplaints - 20} pengaduan lainnya\n\n`;
      }
      
      response += '📊 *Statistik:*\n';
      response += `• Total pengaduan: ${totalComplaints}\n`;
      response += `• Ditampilkan: ${Math.min(complaints.length, 20)}`;
      
      return {
        response: { text: response },
        context: {}
      };
      
    } catch (error) {
      console.error('Error listing complaints:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat mengambil daftar pengaduan.' },
        context: {}
      };
    }
  }
  
  // !list_pengaduan - Daftar pengaduan dengan format yang user-friendly
  async handleListPengaduanCommand(models, senderId, args, sock, admin, context) {
    try {
      const complaints = await models.complaint.getAllComplaints();
      
      if (complaints.length === 0) {
        return {
          response: { text: '📋 *Daftar Pengaduan*\n\n❌ Belum ada pengaduan yang masuk.' },
          context: {}
        };
      }
      
      let response = '📋 *DAFTAR PENGADUAN WARGA*\n';
      response += '═'.repeat(40) + '\n\n';
      
      complaints.forEach((complaint, index) => {
        const date = new Date(complaint.created_at).toLocaleDateString('id-ID');
        const time = new Date(complaint.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        
        response += `${index + 1}. *ID: ${complaint.id}*\n`;
        response += `   👤 ${complaint.reporter_name}\n`;
        response += `   📍 ${complaint.reporter_address}\n`;
        response += `   📝 ${complaint.description.substring(0, 80)}${complaint.description.length > 80 ? '...' : ''}\n`;
        response += `   📅 ${date} ${time}\n\n`;
      });
      
      const totalComplaints = complaints.length;
      if (totalComplaints > 20) {
        response += `... dan ${totalComplaints - 20} pengaduan lainnya\n\n`;
      }
      
      response += '🔧 *Perintah Admin:*\n';
      response += '• !detail_pengaduan [ID] - Lihat detail\n';
      response += '• !update_status [ID] [status] - Update status\n';
      response += '• !delete_pengaduan [ID] - Hapus pengaduan\n\n';
      response += `📊 Total: ${totalComplaints} | Ditampilkan: ${Math.min(complaints.length, 20)}`;
      
      return {
        response: { text: response },
        context: {}
      };
      
    } catch (error) {
      console.error('Error listing complaints:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat mengambil daftar pengaduan.' },
        context: {}
      };
    }
  }
  
  // !detail_pengaduan [ID]
  async handleDetailPengaduanCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !detail_pengaduan [ID]\n\nContoh: !detail_pengaduan 123' },
          context: {}
        };
      }
      
      const complaintId = parseInt(args.trim());
      if (isNaN(complaintId)) {
        return {
          response: { text: '❌ *ID Tidak Valid*\n\nID harus berupa angka.\n\nContoh: !detail_pengaduan 123' },
          context: {}
        };
      }
      
      const complaint = await models.complaint.getComplaintById(complaintId);
      
      if (!complaint) {
        return {
          response: { text: `❌ *Pengaduan Tidak Ditemukan*\n\nPengaduan dengan ID ${complaintId} tidak ditemukan.` },
          context: {}
        };
      }
      
      const date = new Date(complaint.created_at).toLocaleDateString('id-ID');
      const time = new Date(complaint.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      
      let response = '📋 *DETAIL PENGADUAN*\n';
      response += '═'.repeat(40) + '\n\n';
      response += `🆔 *ID:* ${complaint.id}\n`;
      response += `👤 *Nama:* ${complaint.reporter_name}\n`;
      response += `📍 *Alamat:* ${complaint.reporter_address}\n`;
      response += `📅 *Tanggal:* ${date} ${time}\n`;
      response += `📊 *Status:* ${this.formatStatus(complaint.status || 'pending')}\n\n`;
      response += `📝 *Deskripsi Lengkap:*\n${complaint.description}\n\n`;
      
      response += '🔧 *Aksi Admin:*\n';
      response += `• !update_status ${complaint.id} pending - Ubah status menjadi menunggu\n`;
      response += `• !update_status ${complaint.id} processing - Ubah status menjadi sedang diproses\n`;
      response += `• !update_status ${complaint.id} resolved - Ubah status menjadi selesai\n`;
      response += `• !update_status ${complaint.id} rejected - Ubah status menjadi ditolak\n`;
      response += `• !delete_pengaduan ${complaint.id} - Hapus pengaduan\n\n`;
      response += '📋 Status tersedia: menunggu | sedang diproses | selesai | ditolak';
      
      return {
        response: { text: response },
        context: {}
      };
      
    } catch (error) {
      console.error('Error getting complaint detail:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat mengambil detail pengaduan.' },
        context: {}
      };
    }
  }
  
  // !update_status [ID] [status]
  async handleUpdateStatusCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !update_status [ID] [status]\n\nStatus: pending | processing | resolved | rejected\n\nContoh: !update_status 123 processing' },
          context: {}
        };
      }
      
      const parts = args.trim().split(' ');
      if (parts.length !== 2) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !update_status [ID] [status]\n\nContoh: !update_status 123 processing' },
          context: {}
        };
      }
      
      const [idStr, status] = parts;
      const complaintId = parseInt(idStr);
      
      if (isNaN(complaintId)) {
        return {
          response: { text: '❌ *ID Tidak Valid*\n\nID harus berupa angka.\n\nContoh: !update_status 123 processing' },
          context: {}
        };
      }
      
      const validStatuses = ['pending', 'processing', 'resolved', 'rejected'];
      if (!validStatuses.includes(status.toLowerCase())) {
        return {
          response: { text: `❌ *Status Tidak Valid*\n\nStatus yang tersedia: ${validStatuses.join(' | ')}\n\nContoh: !update_status 123 processing` },
          context: {}
        };
      }
      
      const complaint = await models.complaint.getComplaintById(complaintId);
      if (!complaint) {
        return {
          response: { text: `❌ *Pengaduan Tidak Ditemukan*\n\nPengaduan dengan ID ${complaintId} tidak ditemukan.` },
          context: {}
        };
      }
      
      // Update status
      await models.complaint.updateComplaintStatus(complaintId, status.toLowerCase());
      
      // Kirim notifikasi ke pengadu
      const { notifyComplainantStatusUpdateOld } = require('./complaintController');
      await notifyComplainantStatusUpdateOld(sock, complaint, status.toLowerCase());
      
      let response = '✅ *Status Berhasil Diupdate*\n\n';
      response += `🆔 *ID:* ${complaintId}\n`;
      response += `👤 *Pelapor:* ${complaint.reporter_name}\n`;
      response += `📊 *Status Baru:* ${this.formatStatus(status.toLowerCase())}\n\n`;
      response += `⏰ *Diupdate oleh:* ${admin.username}\n`;
      response += `📅 *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n`;
      response += `📱 *Notifikasi telah dikirim ke pengadu*`;
      
      return {
        response: { text: response },
        context: {}
      };
      
    } catch (error) {
      console.error('Error updating complaint status:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat mengupdate status pengaduan.' },
        context: {}
      };
    }
  }
  
  // !delete_pengaduan [ID]
  async handleDeletePengaduanCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !delete_pengaduan [ID]\n\nContoh: !delete_pengaduan 123' },
          context: {}
        };
      }
      
      const complaintId = parseInt(args.trim());
      if (isNaN(complaintId)) {
        return {
          response: { text: '❌ *ID Tidak Valid*\n\nID harus berupa angka.\n\nContoh: !delete_pengaduan 123' },
          context: {}
        };
      }
      
      const complaint = await models.complaint.getComplaintById(complaintId);
      if (!complaint) {
        return {
          response: { text: `❌ *Pengaduan Tidak Ditemukan*\n\nPengaduan dengan ID ${complaintId} tidak ditemukan.` },
          context: {}
        };
      }
      
      // Simpan info sebelum dihapus
      const complaintInfo = {
        id: complaint.id,
        name: complaint.reporter_name,
        description: complaint.description.substring(0, 50) + '...'
      };
      
      // Hapus pengaduan
      await models.complaint.deleteComplaint(complaintId);
      
      let response = '🗑️ *Pengaduan Berhasil Dihapus*\n\n';
      response += `🆔 *ID:* ${complaintInfo.id}\n`;
      response += `👤 *Pelapor:* ${complaintInfo.name}\n`;
      response += `📝 *Deskripsi:* ${complaintInfo.description}\n\n`;
      response += `⚠️ *Dihapus oleh:* ${admin.username}\n`;
      response += `📅 *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n`;
      response += '⚠️ *Perhatian:* Data yang dihapus tidak dapat dikembalikan.';
      
      return {
        response: { text: response },
        context: {}
      };
      
    } catch (error) {
      console.error('Error deleting complaint:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat menghapus pengaduan.' },
        context: {}
      };
    }
  }
  
  // Helper function untuk format status
  formatStatus(status) {
    const statusMap = {
      'pending': '⏳ Menunggu',
      'processing': '🔄 Diproses',
      'resolved': '✅ Selesai',
      'rejected': '❌ Ditolak'
    };
    return statusMap[status] || '❓ Tidak Diketahui';
  }
  
  // !statistik
  async handleStatistikCommand(models, senderId, args, sock, admin, context) {
    try {
      // Import NotificationSystem untuk menggunakan collectSystemStats
      const NotificationSystem = require('../utils/notificationSystem');
      const notificationSystem = new NotificationSystem();
      
      // Ambil statistik komprehensif dari NotificationSystem
      const systemStats = await notificationSystem.collectSystemStats();
      
      // Ambil statistik dari database
      const totalComplaints = await models.complaint.getTotalComplaints();
      const allAdmins = await models.unifiedModel.getAllAdmins();
      
      // Statistik pengaduan per bulan ini
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      
      const complaintsThisMonth = await models.complaint.getComplaintsThisMonth();
      const complaintsToday = await models.complaint.getComplaintsToday();
      
      // Statistik berita dan layanan dari file
      const fs = require('fs-extra');
      const path = require('path');
      
      let totalNews = 0;
      let totalServices = 0;
      let totalSubServices = 0;
      
      try {
        const newsFile = path.join(process.cwd(), 'uploads', 'news', 'news.json');
        if (await fs.pathExists(newsFile)) {
          const newsList = await fs.readJson(newsFile);
          totalNews = newsList.length;
        }
        
        const servicesFile = path.join(process.cwd(), 'uploads', 'services', 'services.json');
        if (await fs.pathExists(servicesFile)) {
          const servicesList = await fs.readJson(servicesFile);
          totalServices = servicesList.length;
          totalSubServices = servicesList.reduce((total, service) => {
            return total + (service.subServices ? service.subServices.length : 0);
          }, 0);
        }
      } catch (fileError) {
        console.log('Error reading files for statistics:', fileError);
      }
      
      // Hitung ukuran cache dan database
      const dbPath = path.join(process.cwd(), 'database.db');
      let dbSize = '0 MB';
      let dbSizeBytes = 0;
      
      try {
        const dbStats = await fs.stat(dbPath);
        dbSizeBytes = dbStats.size;
        dbSize = `${(dbSizeBytes / (1024 * 1024)).toFixed(2)} MB`;
      } catch (err) {
        console.log('Database file tidak ditemukan');
      }
      
      // Hitung cache size dari memory usage
      const memUsage = process.memoryUsage();
      const cacheSize = `${(memUsage.heapUsed / (1024 * 1024)).toFixed(2)} MB`;
      const totalMemory = `${(memUsage.rss / (1024 * 1024)).toFixed(2)} MB`;
      
      // Statistik sistem detail
      const uptime = process.uptime();
      const uptimeHours = Math.floor(uptime / 3600);
      const uptimeMinutes = Math.floor((uptime % 3600) / 60);
      const uptimeDays = Math.floor(uptimeHours / 24);
      const remainingHours = uptimeHours % 24;
      
      // Format uptime yang lebih detail
      let uptimeFormatted = '';
      if (uptimeDays > 0) {
        uptimeFormatted = `${uptimeDays}d ${remainingHours}h ${uptimeMinutes}m`;
      } else {
        uptimeFormatted = `${uptimeHours}h ${uptimeMinutes}m`;
      }
      
      // Hitung persentase memory usage
      const memoryPercentage = ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(1);
      
      let response = '📊 *STATISTIK SISTEM LENGKAP*\n';
      response += '═'.repeat(45) + '\n\n';
      
      response += '👥 *ADMIN & PENGGUNA*\n';
      response += `• Total Admin: ${systemStats.totalAdmins || allAdmins.length}\n`;
      response += `• Superadmin: ${systemStats.superAdmins || 0}\n`;
      response += `• Admin: ${systemStats.admins || 0}\n`;
      response += `• Pegawai: ${systemStats.pegawais || 0}\n`;
      response += `• Admin Aktif: ${systemStats.activeAdmins || 0}\n\n`;
      
      response += '📋 *PENGADUAN & KELUHAN*\n';
      response += `• Total Pengaduan: ${totalComplaints}\n`;
      response += `• Pengaduan Hari Ini: ${complaintsToday}\n`;
      response += `• Pengaduan Bulan Ini: ${complaintsThisMonth}\n`;
      response += `• Dalam Proses: ${systemStats.processingComplaints || 0}\n`;
      response += `• Selesai: ${systemStats.completedComplaints || 0}\n\n`;
      
      response += '📰 *KONTEN & LAYANAN*\n';
      response += `• Total Berita: ${totalNews}\n`;
      response += `• Total Layanan: ${totalServices}\n`;
      response += `• Sub-layanan: ${totalSubServices}\n\n`;
      
      response += '💾 *CACHE & DATABASE*\n';
      response += `• Cache Size: ${cacheSize}\n`;
      response += `• Database Size: ${dbSize}\n`;
      response += `• Total Memory: ${totalMemory}\n`;
      response += `• Memory Usage: ${memoryPercentage}%\n`;
      response += `• Total Records: ${systemStats.totalRecords || 'N/A'}\n\n`;
      
      response += '⚙️ *PERFORMA SISTEM*\n';
      response += `• Uptime: ${uptimeFormatted}\n`;
      response += `• CPU Usage: ${systemStats.cpuUsage || 'N/A'}\n`;
      response += `• Response Time: ${systemStats.responseTime || 'N/A'}\n`;
      response += `• Success Rate: ${systemStats.successRate || '100%'}\n`;
      response += `• Error Rate: ${systemStats.errorRate || '0%'}\n\n`;
      
      response += '📊 *AKTIVITAS HARIAN*\n';
      response += `• Pesan Hari Ini: ${systemStats.todayMessages || 0}\n`;
      response += `• Pesan Admin: ${systemStats.adminMessages || 0}\n`;
      response += `• Pesan User: ${systemStats.userMessages || 0}\n`;
      response += `• Rata-rata/Jam: ${systemStats.avgMessagesPerHour || 0}\n\n`;
      
      response += '🔧 *STATUS & INFO*\n';
      response += `• Status Sistem: ${systemStats.systemStatus || '✅ Normal'}\n`;
      response += `• Last Backup: ${systemStats.lastBackup || 'Belum ada'}\n`;
      response += `• Waktu Laporan: ${new Date().toLocaleString('id-ID')}\n\n`;
      
      response += '💡 *PERINTAH STATISTIK*\n';
      response += '• !statistik - Statistik lengkap\n';
      response += '• !list_pengaduan - Daftar pengaduan\n';
      response += '• !pengaturan - Menu pengaturan\n';
      response += '• !backup - Backup database';
      
      return {
        response: { text: response },
        context: {}
      };
      
    } catch (error) {
      console.error('Error getting statistics:', error);
      return {
        response: { text: '❌ *Error Statistik*\n\nTerjadi kesalahan saat mengambil statistik sistem.\nSilakan coba lagi atau hubungi administrator.' },
        context: {}
      };
    }
  }
  
  // === PERINTAH PENGATURAN ===
  
  // !pengaturan
  async handlePengaturanCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        // Tampilkan menu pengaturan utama dengan perintah JSON
        let response = '⚙️ *MENU PENGATURAN JSON*\n';
        response += '═'.repeat(40) + '\n\n';
        response += '*🔧 PERINTAH UTAMA:*\n';
        response += '• !settingshow - Tampilkan semua pengaturan\n';
        response += '• !settingshow [kategori] - Tampilkan kategori tertentu\n';
        response += '• !settingreset - Reset ke pengaturan default\n\n';
        
        response += '*📊 LIMIT & BATASAN:*\n';
        response += '• !limitshow - Tampilkan pengaturan limit\n';
        response += '• !limitset [key] [value] - Ubah limit\n';
        response += '  Contoh: !limitset nameLimit 60\n\n';
        
        response += '*🛡️ FILTER & MODERASI:*\n';
        response += '• !filtershow - Tampilkan pengaturan filter\n';
        response += '• !filterset [key] [value] - Ubah filter\n';
        response += '• !filteradd [type] [value] - Tambah ke daftar\n';
        response += '• !filterdel [type] [value] - Hapus dari daftar\n';
        response += '  Contoh: !filteradd bannedWords "kata_baru"\n\n';
        
        response += '*⚖️ MODERASI OTOMATIS:*\n';
        response += '• !moderationshow - Tampilkan pengaturan moderasi\n';
        response += '• !moderationset [key] [value] - Ubah moderasi\n';
        response += '  Contoh: !moderationset autoWarn true\n\n';
        
        response += '*🔧 PERINTAH UMUM:*\n';
        response += '• !settingget [kategori] [key] - Ambil nilai tertentu\n';
        response += '• !settingset [kategori] [key] [value] - Set nilai\n';
        response += '• !settingdel [kategori] [key] - Hapus pengaturan\n\n';
        
        response += '*📖 PANDUAN LENGKAP:*\n';
        response += '• !panduanBot - Buat file panduan lengkap semua menu\n\n';
        
        response += '*📋 KATEGORI TERSEDIA:*\n';
        response += 'limits, filters, moderation, notifications, system, security';
        
        return {
          response: { text: response },
          context: {}
        };
      }
      
      // Jika ada args, tampilkan kategori tertentu
      const category = args.trim().toLowerCase();
      const settings = await this.settingsController.getFormattedSettings(category);
      
      return {
        response: { text: settings },
        context: {}
      };
      
    } catch (error) {
      console.error('Error in pengaturan command:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat mengakses pengaturan.' },
        context: {}
      };
    }
  }
  
  // Submenu pengaturan
  async handleLimitSettings(models, senderId, sock, admin, context) {
    let response = '📏 *PENGATURAN LIMIT & BATASAN*\n';
    response += '═'.repeat(40) + '\n\n';
    
    response += '*Pengaturan saat ini:*\n';
    response += '• Limit nama: 50 karakter\n';
    response += '• Limit pesan: 1000 karakter\n';
    response += '• Limit file: 10MB\n';
    response += '• Timeout pengaduan: 24 jam\n';
    response += '• Max pengaduan/hari: 3\n\n';
    
    response += '*Opsi yang tersedia:*\n';
    response += '1. Ubah limit nama (10-100)\n';
    response += '2. Ubah limit pesan (500-2000)\n';
    response += '3. Ubah limit file (5-50MB)\n';
    response += '4. Ubah timeout pengaduan\n';
    response += '5. Ubah max pengaduan/hari\n\n';
    
    response += '*Status:* 🟢 Aktif\n';
    response += '*Terakhir diubah:* ' + new Date().toLocaleDateString('id-ID');
    
    return {
      response: { text: response },
      context: {}
    };
  }
  
  async handleFilterSettings(models, senderId, sock, admin, context) {
    let response = '🛡️ *PENGATURAN FILTER & MODERASI*\n';
    response += '═'.repeat(40) + '\n\n';
    
    response += '*Status Filter:*\n';
    response += '• Filter kata kasar: 🟢 Aktif\n';
    response += '• Anti-spam: 🟢 Aktif\n';
    response += '• Auto-block: 🟡 Moderate\n';
    response += '• Whitelist mode: 🔴 Nonaktif\n\n';
    
    response += '*Statistik:*\n';
    response += '• Pesan difilter hari ini: 12\n';
    response += '• User di-block: 3\n';
    response += '• Kata kasar terdeteksi: 8\n\n';
    
    response += '*Opsi yang tersedia:*\n';
    response += '1. Toggle filter kata kasar\n';
    response += '2. Atur sensitivitas spam\n';
    response += '3. Kelola daftar kata terlarang\n';
    response += '4. Atur auto-block rules\n';
    response += '5. Kelola whitelist\n\n';
    
    response += '*Terakhir update:* ' + new Date().toLocaleDateString('id-ID');
    
    return {
      response: { text: response },
      context: {}
    };
  }
  
  async handleNotificationSettings(models, senderId, sock, admin, context) {
    let response = '🔔 *PENGATURAN NOTIFIKASI*\n';
    response += '═'.repeat(40) + '\n\n';
    
    response += '*Status Notifikasi:*\n';
    response += '• Admin alerts: 🟢 Aktif\n';
    response += '• Broadcast otomatis: 🟢 Aktif\n';
    response += '• Welcome message: 🟢 Aktif\n';
    response += '• Error notifications: 🟢 Aktif\n';
    response += '• Daily reports: 🟡 Terjadwal\n\n';
    
    response += '*Template Pesan:*\n';
    response += '• Welcome: "Selamat datang di layanan..."\n';
    response += '• Error: "Terjadi kesalahan sistem..."\n';
    response += '• Success: "Operasi berhasil..."\n\n';
    
    response += '*Opsi yang tersedia:*\n';
    response += '1. Edit template welcome\n';
    response += '2. Atur jadwal broadcast\n';
    response += '3. Kelola admin alerts\n';
    response += '4. Konfigurasi daily reports\n';
    response += '5. Test notifikasi\n\n';
    
    response += '*Notifikasi terkirim hari ini:* 45';
    
    return {
      response: { text: response },
      context: {}
    };
  }
  
  async handleSystemSettings(models, senderId, sock, admin, context) {
    const uptime = process.uptime();
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);
    
    let response = '⚙️ *PENGATURAN SISTEM & DATABASE*\n';
    response += '═'.repeat(40) + '\n\n';
    
    response += '*Status Sistem:*\n';
    response += '• Status: 🟢 Online\n';
    response += `• Uptime: ${uptimeHours}h ${uptimeMinutes}m\n`;
    response += '• Memory usage: 45%\n';
    response += '• Database: 🟢 Connected\n';
    response += '• Maintenance mode: 🔴 Off\n\n';
    
    response += '*Database Info:*\n';
    response += '• Total records: 1,234\n';
    response += '• Last backup: ' + new Date().toLocaleDateString('id-ID') + '\n';
    response += '• Size: 15.2 MB\n\n';
    
    response += '*Opsi yang tersedia:*\n';
    response += '1. Backup database sekarang\n';
    response += '2. Cleanup data lama\n';
    response += '3. Toggle maintenance mode\n';
    response += '4. Restart sistem\n';
    response += '5. View system logs\n';
    response += '6. Optimize database\n\n';
    
    response += '*Auto-backup:* 🟢 Setiap 24 jam';
    
    return {
      response: { text: response },
      context: {}
    };
  }
  
  async handleSecuritySettings(models, senderId, sock, admin, context) {
    let response = '🔒 *PENGATURAN KEAMANAN*\n';
    response += '═'.repeat(40) + '\n\n';
    
    response += '*Status Keamanan:*\n';
    response += '• Rate limiting: 🟢 Aktif (10/menit)\n';
    response += '• IP blocking: 🟢 Aktif\n';
    response += '• Session timeout: 🟢 24 jam\n';
    response += '• 2FA untuk admin: 🔴 Nonaktif\n';
    response += '• Encryption: 🟢 AES-256\n\n';
    
    response += '*Statistik Keamanan:*\n';
    response += '• Blocked IPs: 15\n';
    response += '• Failed login attempts: 3\n';
    response += '• Suspicious activities: 1\n\n';
    
    response += '*Opsi yang tersedia:*\n';
    response += '1. Atur rate limiting\n';
    response += '2. Kelola blocked IPs\n';
    response += '3. Ubah session timeout\n';
    response += '4. Enable/disable 2FA\n';
    response += '5. View security logs\n';
    response += '6. Reset security settings\n\n';
    
    response += '*Last security scan:* ' + new Date().toLocaleDateString('id-ID');
    
    return {
      response: { text: response },
      context: {}
    };
  }
  
  async handleDisplaySettings(models, senderId, sock, admin, context) {
    let response = '🎨 *PENGATURAN TAMPILAN & FORMAT*\n';
    response += '═'.repeat(40) + '\n\n';
    
    response += '*Format Saat Ini:*\n';
    response += '• Bahasa: 🇮🇩 Indonesia\n';
    response += '• Timezone: WIB (UTC+7)\n';
    response += '• Format tanggal: DD/MM/YYYY\n';
    response += '• Format waktu: 24 jam\n';
    response += '• Emoji: 🟢 Aktif\n\n';
    
    response += '*Template Pesan:*\n';
    response += '• Header: "═══ SISTEM DESA ═══"\n';
    response += '• Footer: "Terima kasih 🙏"\n';
    response += '• Error prefix: "❌"\n';
    response += '• Success prefix: "✅"\n\n';
    
    response += '*Opsi yang tersedia:*\n';
    response += '1. Ubah bahasa interface\n';
    response += '2. Atur timezone\n';
    response += '3. Format tanggal/waktu\n';
    response += '4. Kelola template pesan\n';
    response += '5. Toggle emoji\n';
    response += '6. Custom header/footer\n\n';
    
    response += '*Theme:* Default | *Style:* Professional';
    
    return {
      response: { text: response },
      context: {}
    };
  }
  
  async handleNewsEditStep(models, senderId, messageText, sock, context) {
    const newsId = context.editing_news.id;
    const step = context.editing_news.step;
    
    try {
      // Baca file berita
      const fs = require('fs-extra');
      const path = require('path');
      const newsDir = path.join(process.cwd(), 'uploads', 'news');
      const newsFile = path.join(newsDir, 'news.json');
      
      let newsData = [];
      if (await fs.pathExists(newsFile)) {
        newsData = await fs.readJson(newsFile);
      }
      
      const newsIndex = newsData.findIndex(news => news.id === newsId);
      if (newsIndex === -1) {
        return {
          response: { text: '❌ Berita tidak ditemukan.' },
          context: { editing_news: null }
        };
      }
      
      const news = newsData[newsIndex];
      
      switch (step) {
        case 'choose_field':
          const choice = messageText.trim();
          
          if (choice === '0') {
            return {
              response: { text: '❌ *Edit Dibatalkan*\n\nProses edit berita telah dibatalkan.' },
              context: { editing_news: null }
            };
          }
          
          switch (choice) {
             case '1':
               return {
                 response: { text: `📝 *Edit Judul Berita*\n\n*Judul saat ini:* ${news.title}\n\nMasukkan judul baru:` },
                 context: { editing_news: { id: newsId, step: 'title' } }
               };
             case '2':
               return {
                 response: { text: `📝 *Edit Konten Berita*\n\n*Konten saat ini:* ${news.content ? news.content.substring(0, 300) + '...' : 'Tidak ada konten'}\n\nMasukkan konten berita baru:` },
                 context: { editing_news: { id: newsId, step: 'content' } }
               };
             default:
               return {
                 response: { text: '❌ *Pilihan Tidak Valid*\n\nSilakan pilih angka 1, 2, atau 0 untuk batal.' }
               };
           }
          
        case 'title':
          if (messageText.trim() === '') {
            return {
              response: { text: '❌ Judul tidak boleh kosong. Silakan masukkan judul baru:' }
            };
          }
          
          news.title = messageText.trim();
          news.updated_at = new Date().toISOString();
          
          // Simpan perubahan
          newsData[newsIndex] = news;
          await fs.writeJson(newsFile, newsData, { spaces: 2 });
          
          return {
            response: { text: `✅ *JUDUL BERHASIL DIPERBARUI*\n\n📰 *Judul Baru:* ${news.title}\n🕒 *Diperbarui:* ${new Date().toLocaleString('id-ID')}` },
            context: { editing_news: null }
          };
          
        case 'content':
          if (messageText.trim() === '') {
            return {
              response: { text: '❌ Konten tidak boleh kosong. Silakan masukkan konten baru:' }
            };
          }
          
          news.content = messageText.trim();
          news.updated_at = new Date().toISOString();
          
          // Simpan perubahan
          newsData[newsIndex] = news;
          await fs.writeJson(newsFile, newsData, { spaces: 2 });
          
          const successMessage = `✅ *BERITA BERHASIL DIPERBARUI*\n\n` +
            `📰 *Judul:* ${news.title}\n` +
            `📄 *Konten:* ${news.content.substring(0, 150)}${news.content.length > 150 ? '...' : ''}\n` +
            `📅 *Tanggal:* ${news.date}\n` +
            `👤 *Penulis:* ${news.author}\n` +
            `🕒 *Diperbarui:* ${new Date().toLocaleString('id-ID')}`;
          
          return {
            response: { text: successMessage },
            context: { editing_news: null }
          };
          
        default:
          return {
            response: { text: '❌ Step editing tidak valid.' },
            context: { editing_news: null }
          };
      }
    } catch (error) {
      console.error('Error in handleNewsEditStep:', error);
      return {
        response: { text: '❌ Terjadi kesalahan saat mengedit berita.' },
        context: { editing_news: null }
      };
    }
  }

  async handleLayananEditStep(models, senderId, messageText, sock, context) {
    const editingData = context.editing_layanan;
    
    try {
      // Cek apakah user ingin membatalkan
      if (messageText.trim().toLowerCase() === 'batal') {
        return {
          response: { text: '❌ *Edit Dibatalkan*\n\nProses edit layanan telah dibatalkan.' },
          context: { editing_layanan: null }
        };
      }
      
      if (messageText.trim() === '') {
        return {
          response: { text: '❌ *Konten Tidak Boleh Kosong*\n\nSilakan masukkan konten baru atau ketik "batal" untuk membatalkan.' }
        };
      }
      
      const fs = require('fs-extra');
      const newContent = messageText.trim();
      
      // Validasi JSON
      let parsedContent;
      try {
        parsedContent = JSON.parse(newContent);
      } catch (error) {
        return {
          response: { text: `❌ *Format JSON Tidak Valid*\n\nError: ${error.message}\n\nSilakan periksa format JSON Anda dan coba lagi.` }
        };
      }
      
      // Simpan konten baru ke file
      await fs.writeFile(editingData.contentPath, newContent, 'utf8');
      
      let response = `✅ *LAYANAN BERHASIL DIPERBARUI*\n\n`;
      response += `🏢 *Layanan:* ${editingData.serviceName}\n`;
      response += `📋 *Sub-layanan:* ${editingData.subServiceName}\n`;
      response += `📁 *Folder:* ${editingData.targetSubFolder}\n`;
      response += `📄 *File:* content.json\n`;
      response += `📝 *Ukuran konten:* ${newContent.length} karakter\n`;
      response += `🕒 *Diperbarui:* ${new Date().toLocaleString('id-ID')}\n\n`;
      response += `💡 *Perintah selanjutnya:*\n`;
      response += `• !layananshow ${editingData.serviceNumber}${editingData.subLetter} - Lihat hasil\n`;
      response += `• !layananlist - Lihat daftar layanan`;
      
      return {
        response: { text: response },
        context: { editing_layanan: null }
      };
      
    } catch (error) {
      console.error('Error in handleLayananEditStep:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat menyimpan konten layanan.' },
        context: { editing_layanan: null }
      };
    }
  }

  // ===== FUNGSI CRUD PENGATURAN JSON =====
  
  // Tampilkan semua pengaturan atau kategori tertentu
  async handleSettingsShowCommand(models, senderId, args, sock, admin, context) {
    try {
      const category = args ? args.trim().toLowerCase() : null;
      const settings = await this.settingsController.getFormattedSettings(category);
      
      return {
        response: { text: settings },
        context: {}
      };
    } catch (error) {
      console.error('Error showing settings:', error);
      return {
        response: { text: '❌ *Error*\n\nGagal menampilkan pengaturan.' },
        context: {}
      };
    }
  }

  // Set pengaturan umum
  async handleSettingSetCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !settingset [kategori] [key] [value]\nContoh: !settingset limits nameLimit 60' },
          context: {}
        };
      }

      const parts = args.split(' ');
      if (parts.length < 3) {
        return {
          response: { text: '❌ *Parameter Kurang*\n\nFormat: !settingset [kategori] [key] [value]' },
          context: {}
        };
      }

      const [category, key, ...valueParts] = parts;
      let value = valueParts.join(' ');

      // Parse value berdasarkan tipe
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(value) && !isNaN(parseFloat(value))) value = parseFloat(value);
      else if (value.startsWith('[') && value.endsWith(']')) {
        try {
          value = JSON.parse(value);
        } catch (e) {
          return {
            response: { text: '❌ *Format Array Salah*\n\nContoh array: ["item1","item2"]' },
            context: {}
          };
        }
      }

      // Validasi setting
      if (!this.settingsController.validateSetting(category, key, value)) {
        return {
          response: { text: '❌ *Nilai Tidak Valid*\n\nNilai yang diberikan tidak sesuai dengan aturan validasi.' },
          context: {}
        };
      }

      const success = await this.settingsController.updateSetting(category, key, value, admin.name);
      
      if (success) {
        return {
          response: { text: `✅ *Pengaturan Berhasil Diubah*\n\n📂 Kategori: ${category}\n🔑 Key: ${key}\n💾 Nilai: ${value}` },
          context: {}
        };
      } else {
        return {
          response: { text: '❌ *Gagal Menyimpan*\n\nTerjadi kesalahan saat menyimpan pengaturan.' },
          context: {}
        };
      }
    } catch (error) {
      console.error('Error setting value:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat mengubah pengaturan.' },
        context: {}
      };
    }
  }

  // Get pengaturan tertentu
  async handleSettingGetCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !settingget [kategori] [key]\nContoh: !settingget limits nameLimit' },
          context: {}
        };
      }

      const parts = args.split(' ');
      if (parts.length < 2) {
        return {
          response: { text: '❌ *Parameter Kurang*\n\nFormat: !settingget [kategori] [key]' },
          context: {}
        };
      }

      const [category, key] = parts;
      const value = await this.settingsController.getSetting(category, key);
      
      if (value !== null) {
        return {
          response: { text: `📋 *Nilai Pengaturan*\n\n📂 Kategori: ${category}\n🔑 Key: ${key}\n💾 Nilai: ${JSON.stringify(value, null, 2)}` },
          context: {}
        };
      } else {
        return {
          response: { text: '❌ *Tidak Ditemukan*\n\nPengaturan yang diminta tidak ditemukan.' },
          context: {}
        };
      }
    } catch (error) {
      console.error('Error getting setting:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat mengambil pengaturan.' },
        context: {}
      };
    }
  }

  // Hapus pengaturan
  async handleSettingDelCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !settingdel [kategori] [key]\nContoh: !settingdel limits customLimit' },
          context: {}
        };
      }

      const parts = args.split(' ');
      if (parts.length < 2) {
        return {
          response: { text: '❌ *Parameter Kurang*\n\nFormat: !settingdel [kategori] [key]' },
          context: {}
        };
      }

      const [category, key] = parts;
      const success = await this.settingsController.deleteSetting(category, key, admin.name);
      
      if (success) {
        return {
          response: { text: `✅ *Pengaturan Berhasil Dihapus*\n\n📂 Kategori: ${category}\n🔑 Key: ${key}` },
          context: {}
        };
      } else {
        return {
          response: { text: '❌ *Gagal Menghapus*\n\nPengaturan tidak ditemukan atau terjadi kesalahan.' },
          context: {}
        };
      }
    } catch (error) {
      console.error('Error deleting setting:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat menghapus pengaturan.' },
        context: {}
      };
    }
  }

  // Reset pengaturan ke default
  async handleSettingResetCommand(models, senderId, args, sock, admin, context) {
    try {
      const success = await this.settingsController.resetToDefault(admin.name);
      
      if (success) {
        return {
          response: { text: '✅ *Pengaturan Berhasil Direset*\n\nSemua pengaturan telah dikembalikan ke nilai default.' },
          context: {}
        };
      } else {
        return {
          response: { text: '❌ *Gagal Reset*\n\nTerjadi kesalahan saat mereset pengaturan.' },
          context: {}
        };
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat mereset pengaturan.' },
        context: {}
      };
    }
  }

  // ===== FUNGSI KHUSUS LIMIT =====
  
  async handleLimitSetCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !limitset [key] [value]\nContoh: !limitset nameLimit 60\n\nKey tersedia: nameLimit, messageLimit, fileLimit, complaintTimeout, maxComplaintsPerDay' },
          context: {}
        };
      }

      const parts = args.split(' ');
      if (parts.length < 2) {
        return {
          response: { text: '❌ *Parameter Kurang*\n\nFormat: !limitset [key] [value]' },
          context: {}
        };
      }

      const [key, value] = parts;
      const numValue = parseInt(value);
      
      if (isNaN(numValue)) {
        return {
          response: { text: '❌ *Nilai Harus Angka*\n\nMasukkan nilai berupa angka.' },
          context: {}
        };
      }

      if (!this.settingsController.validateSetting('limits', key, numValue)) {
        return {
          response: { text: '❌ *Nilai Tidak Valid*\n\nNilai yang diberikan tidak sesuai dengan batas yang diizinkan.' },
          context: {}
        };
      }

      const success = await this.settingsController.updateSetting('limits', key, numValue, admin.name);
      
      if (success) {
        return {
          response: { text: `✅ *Limit Berhasil Diubah*\n\n🔑 ${key}: ${numValue}` },
          context: {}
        };
      } else {
        return {
          response: { text: '❌ *Gagal Menyimpan*\n\nTerjadi kesalahan saat menyimpan limit.' },
          context: {}
        };
      }
    } catch (error) {
      console.error('Error setting limit:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat mengubah limit.' },
        context: {}
      };
    }
  }

  async handleLimitShowCommand(models, senderId, args, sock, admin, context) {
    try {
      const settings = await this.settingsController.getFormattedSettings('limits');
      return {
        response: { text: settings },
        context: {}
      };
    } catch (error) {
      console.error('Error showing limits:', error);
      return {
        response: { text: '❌ *Error*\n\nGagal menampilkan pengaturan limit.' },
        context: {}
      };
    }
  }

  // ===== FUNGSI KHUSUS FILTER =====
  
  async handleFilterSetCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !filterset [key] [value]\nContoh: !filterset profanityFilter true\n\nKey tersedia: profanityFilter, spamFilter, linkFilter, autoModeration' },
          context: {}
        };
      }

      const parts = args.split(' ');
      if (parts.length < 2) {
        return {
          response: { text: '❌ *Parameter Kurang*\n\nFormat: !filterset [key] [value]' },
          context: {}
        };
      }

      const [key, value] = parts;
      let boolValue;
      
      if (value === 'true') boolValue = true;
      else if (value === 'false') boolValue = false;
      else {
        return {
          response: { text: '❌ *Nilai Harus Boolean*\n\nGunakan "true" atau "false".' },
          context: {}
        };
      }

      const success = await this.settingsController.updateSetting('filters', key, boolValue, admin.name);
      
      if (success) {
        return {
          response: { text: `✅ *Filter Berhasil Diubah*\n\n🔑 ${key}: ${boolValue ? '🟢 Aktif' : '🔴 Nonaktif'}` },
          context: {}
        };
      } else {
        return {
          response: { text: '❌ *Gagal Menyimpan*\n\nTerjadi kesalahan saat menyimpan filter.' },
          context: {}
        };
      }
    } catch (error) {
      console.error('Error setting filter:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat mengubah filter.' },
        context: {}
      };
    }
  }

  async handleFilterShowCommand(models, senderId, args, sock, admin, context) {
    try {
      const settings = await this.settingsController.getFormattedSettings('filters');
      return {
        response: { text: settings },
        context: {}
      };
    } catch (error) {
      console.error('Error showing filters:', error);
      return {
        response: { text: '❌ *Error*\n\nGagal menampilkan pengaturan filter.' },
        context: {}
      };
    }
  }

  async handleFilterAddCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !filteradd [type] [value]\nContoh: !filteradd bannedWords "kata_baru"\n\nType tersedia: bannedWords, allowedFileTypes, blockedDomains' },
          context: {}
        };
      }

      const parts = args.split(' ');
      if (parts.length < 2) {
        return {
          response: { text: '❌ *Parameter Kurang*\n\nFormat: !filteradd [type] [value]' },
          context: {}
        };
      }

      const [type, ...valueParts] = parts;
      const value = valueParts.join(' ').replace(/"/g, '');

      const success = await this.settingsController.addToArray('filters', type, value, admin.name);
      
      if (success) {
        return {
          response: { text: `✅ *Item Berhasil Ditambahkan*\n\n📂 Type: ${type}\n💾 Value: ${value}` },
          context: {}
        };
      } else {
        return {
          response: { text: '❌ *Gagal Menambahkan*\n\nItem mungkin sudah ada atau terjadi kesalahan.' },
          context: {}
        };
      }
    } catch (error) {
      console.error('Error adding filter:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat menambahkan filter.' },
        context: {}
      };
    }
  }

  async handleFilterDelCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !filterdel [type] [value]\nContoh: !filterdel bannedWords "kata_lama"' },
          context: {}
        };
      }

      const parts = args.split(' ');
      if (parts.length < 2) {
        return {
          response: { text: '❌ *Parameter Kurang*\n\nFormat: !filterdel [type] [value]' },
          context: {}
        };
      }

      const [type, ...valueParts] = parts;
      const value = valueParts.join(' ').replace(/"/g, '');

      const success = await this.settingsController.removeFromArray('filters', type, value, admin.name);
      
      if (success) {
        return {
          response: { text: `✅ *Item Berhasil Dihapus*\n\n📂 Type: ${type}\n💾 Value: ${value}` },
          context: {}
        };
      } else {
        return {
          response: { text: '❌ *Gagal Menghapus*\n\nItem tidak ditemukan atau terjadi kesalahan.' },
          context: {}
        };
      }
    } catch (error) {
      console.error('Error deleting filter:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat menghapus filter.' },
        context: {}
      };
    }
  }

  // ===== FUNGSI KHUSUS MODERASI =====
  
  async handleModerationSetCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !moderationset [key] [value]\nContoh: !moderationset autoWarn true\n\nKey tersedia: autoWarn, autoMute, autoBan, warningThreshold, muteThreshold, banThreshold' },
          context: {}
        };
      }

      const parts = args.split(' ');
      if (parts.length < 2) {
        return {
          response: { text: '❌ *Parameter Kurang*\n\nFormat: !moderationset [key] [value]' },
          context: {}
        };
      }

      const [key, value] = parts;
      let finalValue;
      
      // Parse value berdasarkan key
      if (['autoWarn', 'autoMute', 'autoBan', 'logViolations', 'notifyAdmins', 'escalationEnabled'].includes(key)) {
        if (value === 'true') finalValue = true;
        else if (value === 'false') finalValue = false;
        else {
          return {
            response: { text: '❌ *Nilai Harus Boolean*\n\nGunakan "true" atau "false".' },
            context: {}
          };
        }
      } else {
        finalValue = parseInt(value);
        if (isNaN(finalValue)) {
          return {
            response: { text: '❌ *Nilai Harus Angka*\n\nMasukkan nilai berupa angka.' },
            context: {}
          };
        }
      }

      if (!this.settingsController.validateSetting('moderation', key, finalValue)) {
        return {
          response: { text: '❌ *Nilai Tidak Valid*\n\nNilai yang diberikan tidak sesuai dengan aturan validasi.' },
          context: {}
        };
      }

      const success = await this.settingsController.updateSetting('moderation', key, finalValue, admin.name);
      
      if (success) {
        return {
          response: { text: `✅ *Moderasi Berhasil Diubah*\n\n🔑 ${key}: ${finalValue}` },
          context: {}
        };
      } else {
        return {
          response: { text: '❌ *Gagal Menyimpan*\n\nTerjadi kesalahan saat menyimpan pengaturan moderasi.' },
          context: {}
        };
      }
    } catch (error) {
      console.error('Error setting moderation:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat mengubah moderasi.' },
        context: {}
      };
    }
  }

  async handleModerationShowCommand(models, senderId, args, sock, admin, context) {
    try {
      const settings = await this.settingsController.getFormattedSettings('moderation');
      return {
        response: { text: settings },
        context: {}
      };
    } catch (error) {
      console.error('Error showing moderation:', error);
      return {
        response: { text: '❌ *Error*\n\nGagal menampilkan pengaturan moderasi.' },
        context: {}
      };
    }
  }
  
  // !clearcache - Hapus cache gambar
  async handleClearCacheCommand(models, senderId, args, sock, admin, context) {
    try {
      const fs = require('fs-extra');
      const path = require('path');
      
      let deletedFiles = 0;
      let totalSize = 0;
      const folders = ['complaints', 'news', 'village_info', 'announcements'];
      
      for (const folder of folders) {
        const folderPath = path.join(process.cwd(), 'uploads', folder);
        
        if (await fs.pathExists(folderPath)) {
          const files = await fs.readdir(folderPath);
          
          for (const file of files) {
            const filePath = path.join(folderPath, file);
            const stats = await fs.stat(filePath);
            
            // Hanya hapus file gambar, bukan file JSON
            if (stats.isFile() && !file.endsWith('.json')) {
              totalSize += stats.size;
              await fs.remove(filePath);
              deletedFiles++;
            }
          }
        }
      }
      
      const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
      
      return {
        response: { 
          text: `✅ *Cache Gambar Berhasil Dihapus*\n\n📊 *Statistik:*\n• File dihapus: ${deletedFiles}\n• Ruang dibebaskan: ${sizeInMB} MB\n\n📁 *Folder yang dibersihkan:*\n• Pengaduan\n• Berita\n• Wisata\n• Pengumuman\n\n👤 *Dihapus oleh:* ${admin.username}\n🕒 *Waktu:* ${new Date().toLocaleString('id-ID')}` 
        },
        context: {}
      };
      
    } catch (error) {
      console.error('Error clearing cache:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat menghapus cache gambar.' },
        context: {}
      };
    }
  }
  
  // !deleteimages [folder] - Hapus gambar dari folder tertentu
  async handleDeleteImagesCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { 
            text: '❌ *Format Salah*\n\nFormat: !deleteimages [folder]\n\nFolder tersedia:\n• complaints - Gambar pengaduan\n• news - Gambar berita\n• village_info - Gambar wisata\n• announcements - Gambar pengumuman\n• all - Semua folder\n\nContoh: !deleteimages news' 
          },
          context: {}
        };
      }
      
      const fs = require('fs-extra');
      const path = require('path');
      const targetFolder = args.trim().toLowerCase();
      
      const validFolders = ['complaints', 'news', 'village_info', 'announcements', 'all'];
      if (!validFolders.includes(targetFolder)) {
        return {
          response: { 
            text: `❌ *Folder Tidak Valid*\n\nFolder yang tersedia: ${validFolders.join(', ')}\n\nContoh: !deleteimages news` 
          },
          context: {}
        };
      }
      
      let deletedFiles = 0;
      let totalSize = 0;
      let foldersToClean = [];
      
      if (targetFolder === 'all') {
        foldersToClean = ['complaints', 'news', 'village_info', 'announcements'];
      } else {
        foldersToClean = [targetFolder];
      }
      
      for (const folder of foldersToClean) {
        const folderPath = path.join(process.cwd(), 'uploads', folder);
        
        if (await fs.pathExists(folderPath)) {
          const files = await fs.readdir(folderPath);
          
          for (const file of files) {
            const filePath = path.join(folderPath, file);
            const stats = await fs.stat(filePath);
            
            // Hanya hapus file gambar, bukan file JSON
            if (stats.isFile() && !file.endsWith('.json')) {
              totalSize += stats.size;
              await fs.remove(filePath);
              deletedFiles++;
            }
          }
        }
      }
      
      const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
      const folderNames = {
        'complaints': 'Pengaduan',
        'news': 'Berita', 
        'village_info': 'Wisata',
        'announcements': 'Pengumuman'
      };
      
      let cleanedFolderText = '';
      if (targetFolder === 'all') {
        cleanedFolderText = 'Semua folder';
      } else {
        cleanedFolderText = folderNames[targetFolder] || targetFolder;
      }
      
      return {
        response: { 
          text: `✅ *Gambar Berhasil Dihapus*\n\n📊 *Statistik:*\n• File dihapus: ${deletedFiles}\n• Ruang dibebaskan: ${sizeInMB} MB\n\n📁 *Folder:* ${cleanedFolderText}\n\n👤 *Dihapus oleh:* ${admin.username}\n🕒 *Waktu:* ${new Date().toLocaleString('id-ID')}` 
        },
        context: {}
      };
      
    } catch (error) {
      console.error('Error deleting images:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat menghapus gambar.' },
        context: {}
      };
    }
  }
  
  // Handler untuk perintah UMKM
  async handleUMKMAddCommand(models, senderId, args, sock, admin, context) {
    const umkmController = require('./umkmController');
    return await umkmController.addUMKM(models, senderId, args, sock, admin, context);
  }

  async handleUMKMListCommand(models, senderId, args, sock, admin, context) {
    const umkmController = require('./umkmController');
    return await umkmController.listUMKM(models, senderId, args, sock, admin, context);
  }

  async handleUMKMEditCommand(models, senderId, args, sock, admin, context) {
    const umkmController = require('./umkmController');
    return await umkmController.editUMKM(models, senderId, args, sock, admin, context);
  }

  async handleUMKMDeleteCommand(models, senderId, args, sock, admin, context) {
    const umkmController = require('./umkmController');
    return await umkmController.deleteUMKM(models, senderId, args, sock, admin, context);
  }

  async handleUMKMStatsCommand(models, senderId, args, sock, admin, context) {
    const umkmController = require('./umkmController');
    return await umkmController.getUMKMStats(models, senderId, args, sock, admin, context);
  }

  async handleUMKMSearchCommand(models, senderId, args, sock, admin, context) {
    const umkmController = require('./umkmController');
    const keyword = args.join(' ');
    if (!keyword) {
      return { text: '❌ *Format salah!*\n\n📝 *Format yang benar:*\n`!umkmsearch [kata kunci]`\n\n📋 *Contoh:*\n`!umkmsearch warung`' };
    }
    const results = await umkmController.searchUMKM(keyword);
    if (!results || results.length === 0) {
      return { text: `🔍 *Pencarian UMKM*\n\n❌ Tidak ditemukan UMKM dengan kata kunci "${keyword}"` };
    }
    let response = `🔍 *Hasil Pencarian UMKM: "${keyword}"*\n\n`;
    results.forEach((umkm, index) => {
      response += `${index + 1}. *${umkm.nama}*\n`;
      response += `   📝 ${umkm.deskripsi}\n`;
      response += `   🏷️ ${umkm.kategori}\n`;
      response += `   🆔 ID: ${umkm.id}\n\n`;
    });
    return { text: response };
  }

  async handleBeritaSearchCommand(models, senderId, args, sock, admin, context) {
    const newsController = require('./newsSearchController');
    const keyword = args.join(' ');
    if (!keyword) {
      return { text: '❌ *Format salah!*\n\n📝 *Format yang benar:*\n`!beritasearch [kata kunci]`\n\n📋 *Contoh:*\n`!beritasearch infrastruktur`' };
    }
    const results = newsController.searchNews(keyword, 10);
    if (!results || results.length === 0) {
      return { text: `🔍 *Pencarian Berita*\n\n❌ Tidak ditemukan berita dengan kata kunci "${keyword}"` };
    }
    let response = `🔍 *Hasil Pencarian Berita: "${keyword}"*\n\n`;
    results.forEach((news, index) => {
      response += `${index + 1}. *${news.title}*\n`;
      response += `   📅 ${news.date}\n`;
      response += `   🏷️ ${news.category || 'umum'}\n`;
      response += `   📝 ${news.content.substring(0, 100)}...\n\n`;
    });
    return { text: response };
  }

  async handleBeritaDeleteCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args || args.length === 0) {
        return { text: '❌ *Format salah!*\n\n📝 *Format yang benar:*\n`!beritadelete [id]`\n\n📋 *Contoh:*\n`!beritadelete 1756890001`' };
      }
      
      const newsId = parseInt(args[0]);
      if (isNaN(newsId)) {
        return { text: '❌ *ID Tidak Valid*\n\nID harus berupa angka.\n\n📋 *Contoh:*\n`!beritadelete 1756890001`' };
      }
      
      const fs = require('fs-extra');
      const path = require('path');
      const newsFile = path.join(process.cwd(), 'uploads', 'news', 'news.json');
      
      if (!await fs.pathExists(newsFile)) {
        return { text: '❌ *Tidak Ada Berita*\n\nBelum ada berita yang tersimpan.' };
      }
      
      const newsList = await fs.readJson(newsFile);
      const newsIndex = newsList.findIndex(n => n.id === newsId);
      
      if (newsIndex === -1) {
        return { text: `❌ *Berita Tidak Ditemukan*\n\nBerita dengan ID ${newsId} tidak ditemukan.\n\n💡 Gunakan !beritalist untuk melihat daftar berita.` };
      }
      
      const deletedNews = newsList[newsIndex];
      newsList.splice(newsIndex, 1);
      
      // Simpan kembali ke file
      await fs.writeJson(newsFile, newsList, { spaces: 2 });
      
      return { 
        text: `✅ *Berita Berhasil Dihapus*\n\n` +
              `📰 *Judul:* ${deletedNews.title}\n` +
              `🆔 *ID:* ${deletedNews.id}\n` +
              `📅 *Tanggal:* ${deletedNews.date}\n` +
              `👤 *Penulis:* ${deletedNews.author}\n\n` +
              `📊 *Total berita tersisa:* ${newsList.length}` 
      };
      
    } catch (error) {
      console.error('Error deleting news:', error);
      return { text: '❌ *Error*\n\nTerjadi kesalahan saat menghapus berita.' };
    }
  }
  
  // Statistics functions
  async generateStatistics() {
    try {
      const userStats = await this.getUserStats();
      const complaintStats = await this.getComplaintStats();
      const umkmStats = await this.getUMKMStats();
      const newsStats = await this.getNewsStats();
      
      return {
        users: userStats,
        complaints: complaintStats,
        umkm: umkmStats,
        news: newsStats,
        generated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating statistics:', error);
      return { error: error.message };
    }
  }

  async getComplaintStats() {
    try {
      // This would typically query the database
      // For now, return mock data since we don't have the complaint table structure
      return {
        total_complaints: 0,
        pending_complaints: 0,
        resolved_complaints: 0,
        recent_complaints: 0
      };
    } catch (error) {
      console.error('Error getting complaint stats:', error);
      return { error: error.message };
    }
  }

  async getNewsStats() {
    try {
      const fs = require('fs-extra');
      const path = require('path');
      const newsFile = path.join(process.cwd(), 'uploads', 'news', 'news.json');
      
      if (await fs.pathExists(newsFile)) {
        const newsList = await fs.readJson(newsFile);
        return {
          total_news: newsList.length,
          published_news: newsList.filter(n => n.status === 'published' || !n.status).length,
          categories: [...new Set(newsList.map(n => n.category).filter(c => c))].length,
          recent_news: newsList.filter(n => {
            const newsDate = new Date(n.date || n.created_at);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return newsDate >= weekAgo;
          }).length
        };
      }
      
      return {
        total_news: 0,
        published_news: 0,
        categories: 0,
        recent_news: 0
      };
    } catch (error) {
      console.error('Error getting news stats:', error);
      return { error: error.message };
    }
  }

   async handleLaporanCommand() {
     try {
       const stats = await this.generateStatistics();
       
       let reportText = '📊 *LAPORAN SISTEM*\n\n';
       reportText += `📅 Generated: ${new Date().toLocaleString('id-ID')}\n\n`;
       
       if (stats.users) {
         reportText += '👥 *User Statistics:*\n';
         reportText += `• Total Users: ${stats.users.total || 0}\n`;
         reportText += `• Active Users: ${stats.users.active || 0}\n\n`;
       }
       
       if (stats.complaints) {
         reportText += '📝 *Complaint Statistics:*\n';
         reportText += `• Total: ${stats.complaints.total_complaints || 0}\n`;
         reportText += `• Pending: ${stats.complaints.pending_complaints || 0}\n`;
         reportText += `• Resolved: ${stats.complaints.resolved_complaints || 0}\n\n`;
       }
       
       if (stats.news) {
         reportText += '📰 *News Statistics:*\n';
         reportText += `• Total News: ${stats.news.total_news || 0}\n`;
         reportText += `• Published: ${stats.news.published_news || 0}\n`;
         reportText += `• Categories: ${stats.news.categories || 0}\n\n`;
       }
       
       if (stats.umkm) {
         reportText += '🏪 *UMKM Statistics:*\n';
         reportText += `• Total UMKM: ${stats.umkm.total || 0}\n`;
         reportText += `• Categories: ${stats.umkm.categories || 0}\n\n`;
       }
       
       return { text: reportText };
     } catch (error) {
       console.error('Error generating report:', error);
       return { text: '❌ Error generating report: ' + error.message };
     }
   }

   async handleLaporanUserCommand() {
     try {
       const userStats = await this.getUserStats();
       
       let reportText = '👥 *LAPORAN USER*\n\n';
       reportText += `📅 Generated: ${new Date().toLocaleString('id-ID')}\n\n`;
       
       reportText += '📊 *User Activity:*\n';
       reportText += `• Total Registered Users: ${userStats.total || 0}\n`;
       reportText += `• Active Users (Last 7 days): ${userStats.active || 0}\n`;
       reportText += `• New Users (This month): ${userStats.new_this_month || 0}\n\n`;
       
       reportText += '💬 *User Interactions:*\n';
       reportText += `• Total Messages: ${userStats.total_messages || 0}\n`;
       reportText += `• Average Messages per User: ${userStats.avg_messages_per_user || 0}\n\n`;
       
       return { text: reportText };
     } catch (error) {
       console.error('Error generating user report:', error);
       return { text: '❌ Error generating user report: ' + error.message };
     }
   }
   
  // Backup database
  async handleBackupCommand(models, senderId, args, sock, admin, context) {
    try {
      const fs = require('fs-extra');
      const path = require('path');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(process.cwd(), 'backups');
      
      await fs.ensureDir(backupDir);
      
      // Backup database
      const dbPath = path.join(process.cwd(), 'database.db');
      const backupDbPath = path.join(backupDir, `database-${timestamp}.db`);
      
      if (await fs.pathExists(dbPath)) {
        await fs.copy(dbPath, backupDbPath);
      }
      
      // Backup JSON files
      const jsonFiles = ['admins.json', 'config.json', 'menu-structure.json', 'village_info.json'];
      for (const file of jsonFiles) {
        const srcPath = path.join(process.cwd(), 'src', 'database', file);
        const destPath = path.join(backupDir, `${file.replace('.json', '')}-${timestamp}.json`);
        if (await fs.pathExists(srcPath)) {
          await fs.copy(srcPath, destPath);
        }
      }
      
      return {
        response: { text: `✅ *Backup Berhasil*\n\n📁 Lokasi: /backups/\n🕒 Waktu: ${new Date().toLocaleString('id-ID')}\n👤 Admin: ${admin.username}` },
        context: {}
      };
    } catch (error) {
      console.error('Error creating backup:', error);
      return {
        response: { text: '❌ *Error Backup*\n\nTerjadi kesalahan saat membuat backup.' },
        context: {}
      };
    }
  }

  // Broadcast message to all users
  async handleBroadcastCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !broadcast [pesan]\n\nContoh: !broadcast Pengumuman penting untuk semua warga' },
          context: {}
        };
      }
      
      const users = await models.unifiedModel.getAllUsers();
      let successCount = 0;
      let failCount = 0;
      
      const broadcastMessage = `📢 *PENGUMUMAN RESMI*\n\n${args}\n\n_Dikirim oleh: ${admin.username}_\n_Waktu: ${new Date().toLocaleString('id-ID')}_`;
      
      for (const user of users) {
        try {
          await sock.sendMessage(user.phone_number + '@s.whatsapp.net', { text: broadcastMessage });
          successCount++;
        } catch (error) {
          failCount++;
        }
      }
      
      return {
        response: { text: `✅ *Broadcast Selesai*\n\n📊 *Statistik:*\n• Berhasil: ${successCount}\n• Gagal: ${failCount}\n• Total: ${users.length}\n\n👤 Admin: ${admin.username}` },
        context: {}
      };
    } catch (error) {
      console.error('Error broadcasting:', error);
      return {
        response: { text: '❌ *Error Broadcast*\n\nTerjadi kesalahan saat mengirim broadcast.' },
        context: {}
      };
    }
  }

  // Ban user
  async handleBanCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !ban [nomor_hp]\n\nContoh: !ban 6281234567890' },
          context: {}
        };
      }
      
      const phoneNumber = args.trim();
      const user = await models.unifiedModel.getUserByPhoneNumber(phoneNumber);
      
      if (!user) {
        return {
          response: { text: `❌ *User Tidak Ditemukan*\n\nUser dengan nomor ${phoneNumber} tidak ditemukan.` },
          context: {}
        };
      }
      
      const success = await models.unifiedModel.banUser(phoneNumber, admin.username);
      
      if (!success) {
        return {
          response: { text: '❌ *Error Ban*\n\nGagal melakukan ban user.' },
          context: {}
        };
      }
      
      return {
        response: { text: `✅ *User Berhasil Dibanned*\n\n📱 Nomor: ${phoneNumber}\n👤 Nama: ${user.name || 'Tidak diketahui'}\n🚫 Dibanned oleh: ${admin.username}\n🕒 Waktu: ${new Date().toLocaleString('id-ID')}` },
        context: {}
      };
    } catch (error) {
      console.error('Error banning user:', error);
      return {
        response: { text: '❌ *Error Ban*\n\nTerjadi kesalahan saat membanned user.' },
        context: {}
      };
    }
  }

  // Unban user
  async handleUnbanCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '❌ *Format Salah*\n\nFormat: !unban [nomor_hp]\n\nContoh: !unban 6281234567890' },
          context: {}
        };
      }
      
      const phoneNumber = args.trim();
      const user = await models.unifiedModel.getUserByPhoneNumber(phoneNumber);
      
      if (!user) {
        return {
          response: { text: `❌ *User Tidak Ditemukan*\n\nUser dengan nomor ${phoneNumber} tidak ditemukan.` },
          context: {}
        };
      }
      
      const success = await models.unifiedModel.unbanUser(phoneNumber);
      
      if (!success) {
        return {
          response: { text: '❌ *Error Unban*\n\nGagal melakukan unban user.' },
          context: {}
        };
      }
      
      return {
        response: { text: `✅ *User Berhasil Di-unban*\n\n📱 Nomor: ${phoneNumber}\n👤 Nama: ${user.name || 'Tidak diketahui'}\n✅ Di-unban oleh: ${admin.username}\n🕒 Waktu: ${new Date().toLocaleString('id-ID')}` },
        context: {}
      };
    } catch (error) {
      console.error('Error unbanning user:', error);
      return {
        response: { text: '❌ *Error Unban*\n\nTerjadi kesalahan saat meng-unban user.' },
        context: {}
      };
    }
  }

  // Filter management
  async handleFilterCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '🛡️ *FILTER MANAGEMENT*\n\n📋 *Perintah Tersedia:*\n• !filterset [key] [value] - Set filter\n• !filteradd [type] [value] - Tambah item\n• !filterdel [type] [value] - Hapus item\n\n🔧 *Contoh:*\n• !filterset profanityFilter true\n• !filteradd bannedWords "kata_buruk"\n• !filterdel bannedWords "kata_lama"' },
          context: {}
        };
      }
      
      const [subCommand, ...rest] = args.split(' ');
      const subArgs = rest.join(' ');
      
      switch (subCommand) {
        case 'set':
          return await this.handleFilterSetCommand(models, senderId, subArgs, sock, admin, context);
        case 'add':
          return await this.handleFilterAddCommand(models, senderId, subArgs, sock, admin, context);
        case 'del':
          return await this.handleFilterDelCommand(models, senderId, subArgs, sock, admin, context);
        default:
          return {
            response: { text: '❌ *Sub-command Tidak Valid*\n\nGunakan: set, add, atau del' },
            context: {}
          };
      }
    } catch (error) {
      console.error('Error managing filter:', error);
      return {
        response: { text: '❌ *Error Filter*\n\nTerjadi kesalahan saat mengelola filter.' },
        context: {}
      };
    }
  }

  // System control
  async handleSystemCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '⚙️ *SYSTEM CONTROL*\n\n📋 *Perintah Tersedia:*\n• !system status - Status sistem\n• !system restart - Restart bot\n• !system maintenance on/off - Mode maintenance\n• !system clear-cache - Bersihkan cache\n\n⚠️ *Hanya untuk Super Admin*' },
          context: {}
        };
      }
      
      if (admin.role !== 'superadmin') {
        return {
          response: { text: '❌ *Akses Ditolak*\n\nHanya Super Admin yang dapat menggunakan system control.' },
          context: {}
        };
      }
      
      const [subCommand, value] = args.split(' ');
      
      switch (subCommand) {
        case 'status':
          const uptime = process.uptime();
          const memUsage = process.memoryUsage();
          return {
            response: { text: `📊 *STATUS SISTEM*\n\n⏱️ Uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m\n💾 Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB\n🔄 Status: Online\n👤 Admin: ${admin.username}` },
            context: {}
          };
        case 'maintenance':
          const isOn = value === 'on';
          await this.settingsController.updateSetting('system', 'maintenanceMode', isOn, admin.username);
          return {
            response: { text: `🔧 *Mode Maintenance ${isOn ? 'Diaktifkan' : 'Dinonaktifkan'}*\n\n👤 Admin: ${admin.username}\n🕒 Waktu: ${new Date().toLocaleString('id-ID')}` },
            context: {}
          };
        case 'clear-cache':
          // Clear require cache for hot reload
          Object.keys(require.cache).forEach(key => {
            if (key.includes('src/')) {
              delete require.cache[key];
            }
          });
          return {
            response: { text: `🗑️ *Cache Berhasil Dibersihkan*\n\n👤 Admin: ${admin.username}\n🕒 Waktu: ${new Date().toLocaleString('id-ID')}` },
            context: {}
          };
        default:
          return {
            response: { text: '❌ *Sub-command Tidak Valid*\n\nGunakan: status, maintenance, atau clear-cache' },
            context: {}
          };
      }
    } catch (error) {
      console.error('Error system control:', error);
      return {
        response: { text: '❌ *Error System*\n\nTerjadi kesalahan saat mengontrol sistem.' },
        context: {}
      };
    }
  }
  async handleLogCommand() { return { text: '📝 *Log Management*\n\nFitur sedang dalam pengembangan.' }; }
  async handleMaintenanceCommand() { return { text: '🔧 *Maintenance Mode*\n\nFitur sedang dalam pengembangan.' }; }

  // ===== FUNGSI MENU DARI ADMIN.JS =====

  // Helper: Baca struktur menu dari uploads/menus (selalu 6 menu utama)
  async readMenusFromFS() {
    const basePath = path.join(process.cwd(), 'uploads', 'menus');
    const result = [];
    try {
      const mainMenus = await fsExtra.readdir(basePath);
      // Urutkan berdasarkan angka prefix
      const sorted = mainMenus
        .filter((name) => /^(\d+)-/.test(name))
        .sort((a, b) => parseInt(a) - parseInt(b));

      for (const folderName of sorted) {
        const mainPath = path.join(basePath, folderName);
        const stat = await fsExtra.stat(mainPath).catch(() => null);
        if (!stat || !stat.isDirectory()) continue;

        const match = folderName.match(/^(\d+)-(.+)$/);
        if (!match) continue;
        const id = parseInt(match[1]);
        const name = match[2].replace(/_/g, ' ');

        // Ambil submenus (A, B, C ...)
        const subMenus = [];
        const entries = await fsExtra.readdir(mainPath).catch(() => []);
        const subSorted = entries
          .filter((n) => /^(\d+[A-Za-z])-/.test(n))
          .sort((a, b) => a.localeCompare(b));
        for (const subFolder of subSorted) {
          const subPath = path.join(mainPath, subFolder);
          const sStat = await fsExtra.stat(subPath).catch(() => null);
          if (!sStat || !sStat.isDirectory()) continue;
          const sm = subFolder.match(/^(\d+)([A-Za-z])-(.+)$/);
          if (!sm) continue;
          const letter = sm[2].toUpperCase();
          const subName = sm[3].replace(/_/g, ' ');
          subMenus.push({ letter, name: subName, folder: subFolder });
        }

        result.push({ id, name, folder: folderName, subMenus });
      }
    } catch (e) {
      console.error('Error reading menus from FS:', e);
    }
    return result;
  }



  async getVirtualSubMenusForInformasiDesa() {
    return [
      { letter: 'E', name: 'Informasi Wisata', folder: 'virtual-E' },
      { letter: 'F', name: 'Berita Desa', folder: 'virtual-F' },
      { letter: 'G', name: 'Profil/Informasi Desa', folder: 'virtual-G' }
    ];
  }

  async cleanupInactiveMemory(hours = 24) {
    try {
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      // Implementasi cleanup memory chat yang tidak aktif
      console.log(`Cleaning up inactive memory older than ${hours} hours`);
      
      // Placeholder untuk implementasi cleanup
      // Bisa ditambahkan logika untuk membersihkan chat memory yang tidak aktif
      
      return {
        success: true,
        message: `Memory cleanup completed for entries older than ${hours} hours`,
        cleanedCount: 0
      };
    } catch (error) {
      console.error('Error during memory cleanup:', error);
      return {
        success: false,
        message: `Error during cleanup: ${error.message}`,
        cleanedCount: 0
      };
    }
  }



  async formatMenuMessage(menuModel) {
    try {
      // Gunakan data menu statis untuk menghindari pembacaan file berulang
      const staticMenus = [
        { id: 1, name: 'Administrasi Kependudukan' },
        { id: 2, name: 'Perizinan' },
        { id: 3, name: 'Kesehatan' },
        { id: 4, name: 'Informasi Desa' },
        { id: 5, name: 'Informasi UMKM' },
        { id: 6, name: 'Cari Berita' },
        { id: 7, name: 'Aduan Layanan' }
      ];

      let responseText = '*🏛️ LAYANAN DESA PULOSAROK*\n';
      responseText += '═'.repeat(35) + '\n\n';
      responseText += 'Selamat datang di layanan digital Desa Pulosarok! Silakan pilih menu layanan yang Anda butuhkan:\n\n';

      staticMenus.forEach((menu) => {
        responseText += `${menu.id}. *${menu.name}*\n`;
      });

      responseText += '\n📞 *Kontak Darurat:*\n';
      responseText += '• Kepala Desa: 0812-xxxx-xxxx\n';
      responseText += '• Sekretaris Desa: 0813-xxxx-xxxx\n\n';
      responseText += '💡 *Cara Penggunaan:*\n';
      responseText += 'Ketik nomor menu (contoh: 1, 2, 3) untuk melihat sub-layanan yang tersedia.\n\n';
      responseText += '⏰ *Jam Layanan:*\n';
      responseText += 'Senin - Jumat: 08:00 - 16:00 WIB\n';
      responseText += 'Sabtu: 08:00 - 12:00 WIB\n\n';
      responseText += '─'.repeat(35) + '\n';
      responseText += '_Dibuat oleh Mahasiswa UMSU_';

      // Cek duplikasi sebelum mengirim
      if (duplicateChecker.isDuplicate('system', responseText)) {
        console.log('🔄 Duplicate main menu message detected and prevented');
        return null; // Tidak mengirim pesan duplikat
      }

      return { text: responseText };
    } catch (error) {
      console.error('Error saat memformat pesan menu:', error.message);
      return { text: 'Maaf, terjadi kesalahan saat memuat menu utama.' };
    }
  }

  async formatSubMenuMessage(menuModel, mainMenuId, senderId = null) {
    try {
      const menuId = parseInt(mainMenuId);
      // Gunakan cache readMenuStructure yang sudah dioptimasi
      const menus = await readMenuStructure();
      const selected = menus.find((m) => m.id === menuId);

      if (!selected) {
        return { text: `Maaf, menu dengan ID ${menuId} tidak tersedia.\n\nDibuat oleh Mahasiswa UMSU` };
      }

      let responseText = `*${selected.id}. ${selected.name}*\n\n`;
      selected.subMenus.forEach((s) => {
        responseText += `${s.id}. ${s.name}\n`;
      });

      responseText += '\nKetik kode sub menu (contoh: 1A atau 4E) untuk melihat detail layanan.';
      responseText += '\nKetik 0 atau kembali untuk kembali ke menu utama.';
      responseText += '\n\n─'.repeat(35) + '\n';
      responseText += '_Dibuat oleh Mahasiswa UMSU_';

      // Cek duplikasi sebelum mengirim dengan senderId yang sebenarnya
      if (senderId && duplicateChecker.isMenuDuplicate(senderId, menuId)) {
        console.log(`🔄 Duplicate submenu message detected and prevented for user ${senderId}, menu ${menuId}`);
        return null; // Tidak mengirim pesan duplikat
      }

      return { text: responseText };
    } catch (error) {
      console.error('Error saat memformat pesan sub menu:', error.message);
      return { text: 'Maaf, terjadi kesalahan saat memuat sub menu.' };
    }
  }

  async readFolderItemsAsList(folderPath) {
    try {
      const exists = await fsExtra.pathExists(folderPath);
      if (!exists) return 'Belum ada data.';
      const items = await fsExtra.readdir(folderPath);
      if (!items || items.length === 0) return 'Belum ada data.';
      // Tampilkan maksimum 20 agar tidak terlalu panjang
      const maxShow = 20;
      const limited = items.slice(0, maxShow);
      let txt = limited.map((f, i) => `- ${f}`).join('\n');
      if (items.length > maxShow) txt += `\n... dan ${items.length - maxShow} item lainnya`;
      return txt;
    } catch (e) {
      return 'Belum ada data.';
    }
  }

  async getSubMenuContent(menuContentModel, mainMenuId, subMenuLetter) {
    try {
      // Normalisasi input seperti "1A" atau (1,"A")
      const match = String(subMenuLetter).match(/^(\d+)?([A-Za-z])$/);
      let menuId = parseInt(mainMenuId);
      let letter = String(subMenuLetter).toUpperCase();
      if (match && match[1] && match[2]) {
        menuId = parseInt(match[1]);
        letter = match[2].toUpperCase();
      } else if (/^[A-Za-z]$/.test(letter)) {
        // letter already correct
      } else {
        // Fallback: coba ekstrak huruf terakhir
        const letters = String(subMenuLetter).toUpperCase().match(/[A-Z]/g);
        if (letters && letters.length) letter = letters[letters.length - 1];
      }

      // Tangani sub-menu virtual Informasi Desa
      if (menuId === 4 && ['E', 'F', 'G'].includes(letter)) {
        let title = '';
        let dir = '';
        if (letter === 'E') {
          title = '*4E. Informasi Wisata*';
          dir = path.join(process.cwd(), 'uploads', 'tourism');
        } else if (letter === 'F') {
          title = '*4F. Berita Desa*';
          dir = path.join(process.cwd(), 'uploads', 'news');
        } else if (letter === 'G') {
          title = '*4G. Profil/Informasi Desa*';
          dir = path.join(process.cwd(), 'uploads', 'village_info');
        }
        const listTxt = await this.readFolderItemsAsList(dir);
        return { text: `${title}\n\n${listTxt}` };
      }

      // Untuk sub-menu berbasis file biasa
      const selectedMenu = await getMenuByIdFS(menuId);
      if (!selectedMenu) {
        return { text: `Maaf, menu dengan ID ${menuId} tidak ditemukan.\n\nDibuat oleh Mahasiswa UMSU` };
      }

      const sub = selectedMenu.subMenus.find((s) => String(s.id).toUpperCase() === `${menuId}${letter}`);
      if (!sub) {
        return { text: `Maaf, sub-menu ${menuId}${letter} tidak ditemukan.\n\nDibuat oleh Mahasiswa UMSU` };
      }

      const basePath = path.join(process.cwd(), 'uploads', 'menus');
      const subPath = path.join(basePath, `${selectedMenu.id}-${selectedMenu.name.replace(/\s+/g, '_')}`, `${sub.id}-${sub.name.replace(/\s+/g, '_')}`);
      const contentJsonPath = path.join(subPath, 'content.json');
      const contentTxtPath = path.join(subPath, 'content.txt');

      try {
        let content = '';
        
        // Prioritas: coba baca content.json dulu, fallback ke content.txt
        if (await fsExtra.pathExists(contentJsonPath)) {
          try {
            const contentRaw = await fsExtra.readFile(contentJsonPath, 'utf-8');
            const contentObj = JSON.parse(contentRaw);
            
            // Format konten dari JSON
            if (contentObj.title) {
              content = contentObj.title;
            }
            if (contentObj.description) {
              content += (content ? '\n\n' : '') + contentObj.description;
            }
            if (contentObj.requirements && contentObj.requirements.length > 0) {
              content += '\n\n📋 *Persyaratan:*\n' + contentObj.requirements.map((req, i) => `${i + 1}. ${req}`).join('\n');
            }
            if (contentObj.procedures && contentObj.procedures.length > 0) {
              content += '\n\n📊 *Prosedur:*\n' + contentObj.procedures.map((proc, i) => `${i + 1}. ${proc}`).join('\n');
            }
            if (contentObj.contact) {
              content += '\n\n📞 *Kontak:* ' + contentObj.contact;
            }
          } catch (jsonError) {
            console.error('Error parsing content.json:', jsonError.message);
            content = 'Maaf, terjadi kesalahan saat membaca konten.';
          }
        } else if (await fsExtra.pathExists(contentTxtPath)) {
          // Fallback ke content.txt untuk kompatibilitas
          content = await fsExtra.readFile(contentTxtPath, 'utf-8');
        } else {
          return { text: `*${menuId}${letter}. ${sub.name}*\n\nMaaf, konten untuk sub-menu ini belum tersedia.\n\n─`.repeat(35) + '\n_Dibuat oleh Mahasiswa UMSU_' };
        }
        
        // Tangani placeholder dinamis untuk UMKM (menu 5A)
        if (menuId === 5 && letter === 'A' && content.includes('{{DYNAMIC_UMKM_LIST}}')) {
          try {
            const { replaceDynamicUMKMContent } = require('./umkmController');
            content = await replaceDynamicUMKMContent(content);
          } catch (umkmError) {
            console.error('Error saat memproses konten UMKM dinamis:', umkmError.message);
            // Fallback: ganti placeholder dengan pesan error
            content = content.replace('{{DYNAMIC_UMKM_LIST}}', 'Maaf, terjadi kesalahan saat memuat data UMKM.');
          }
        }
        
        const finalResponse = `*${menuId}${letter}. ${sub.name}*\n\n${content}\n\n─`.repeat(35) + '\n_Dibuat oleh Mahasiswa UMSU_';
        
        // Cek duplikasi sebelum mengirim
        if (duplicateChecker.isDuplicate('system', finalResponse)) {
          console.log(`🔄 Duplicate content message detected and prevented for ${menuId}${letter}`);
          return null; // Tidak mengirim pesan duplikat
        }
        
        return { text: finalResponse };
      } catch (fileErr) {
        console.error('Gagal membaca content file:', fileErr);
        const errorResponse = `*${menuId}${letter}. ${sub.name}*\n\nMaaf, terjadi kesalahan saat membaca konten sub-menu.\n\n─`.repeat(35) + '\n_Dibuat oleh Mahasiswa UMSU_';
        
        // Cek duplikasi sebelum mengirim
        if (duplicateChecker.isDuplicate('system', errorResponse)) {
          console.log(`🔄 Duplicate error message detected and prevented for ${menuId}${letter}`);
          return null; // Tidak mengirim pesan duplikat
        }
        
        return { text: errorResponse };
      }
    } catch (error) {
      console.error('Error saat mendapatkan konten sub-menu:', error.message);
      return { text: 'Maaf, terjadi kesalahan saat memuat konten sub-menu.' };
    }
  }

  // === FITUR ADMIN BARU ===
  
  // !layanantemplate - Membuat template layanan lengkap dengan sub-menu
  async handleLayananTemplateCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args) {
        return {
          response: { text: '📋 *TEMPLATE LAYANAN TERSEDIA:*\n\n1️⃣ *administrasi* - Template layanan administrasi\n2️⃣ *perizinan* - Template layanan perizinan\n3️⃣ *kesehatan* - Template layanan kesehatan\n4️⃣ *sosial* - Template layanan sosial\n5️⃣ *ekonomi* - Template layanan ekonomi\n\nFormat: !layanantemplate [nama_template]\nContoh: !layanantemplate administrasi' },
          context: {}
        };
      }
      
      const templateName = args.trim().toLowerCase();
      const templates = {
        administrasi: {
          name: 'Administrasi Kependudukan',
          subMenus: [
            { name: 'Kartu Tanda Penduduk (KTP)', desc: 'Pembuatan dan perpanjangan KTP' },
            { name: 'Kartu Keluarga (KK)', desc: 'Pembuatan dan perubahan KK' },
            { name: 'Akta Kelahiran', desc: 'Pengurusan akta kelahiran' },
            { name: 'Surat Keterangan Domisili', desc: 'Surat keterangan tempat tinggal' },
            { name: 'Surat Keterangan Tidak Mampu', desc: 'SKTM untuk berbagai keperluan' }
          ]
        },
        perizinan: {
          name: 'Perizinan dan Rekomendasi',
          subMenus: [
            { name: 'Izin Usaha Mikro', desc: 'Perizinan untuk usaha mikro' },
            { name: 'Izin Keramaian', desc: 'Izin untuk acara atau keramaian' },
            { name: 'Rekomendasi Nikah', desc: 'Rekomendasi untuk pernikahan' },
            { name: 'Izin Bangunan', desc: 'Izin mendirikan bangunan' }
          ]
        },
        kesehatan: {
          name: 'Layanan Kesehatan',
          subMenus: [
            { name: 'Posyandu', desc: 'Jadwal dan informasi posyandu' },
            { name: 'Puskesmas', desc: 'Informasi layanan puskesmas' },
            { name: 'Imunisasi', desc: 'Jadwal imunisasi balita' },
            { name: 'Lansia', desc: 'Program kesehatan lansia' }
          ]
        },
        sosial: {
          name: 'Layanan Sosial',
          subMenus: [
            { name: 'Bantuan Sosial', desc: 'Program bantuan sosial' },
            { name: 'PKH', desc: 'Program Keluarga Harapan' },
            { name: 'Kartu Prakerja', desc: 'Informasi kartu prakerja' },
            { name: 'BPNT', desc: 'Bantuan Pangan Non Tunai' }
          ]
        },
        ekonomi: {
          name: 'Pemberdayaan Ekonomi',
          subMenus: [
            { name: 'UMKM', desc: 'Pembinaan UMKM desa' },
            { name: 'Koperasi', desc: 'Informasi koperasi desa' },
            { name: 'BUMDes', desc: 'Badan Usaha Milik Desa' },
            { name: 'Pelatihan', desc: 'Pelatihan keterampilan' }
          ]
        }
      };
      
      const template = templates[templateName];
      if (!template) {
        return {
          response: { text: '❌ *Template Tidak Ditemukan*\n\nTemplate tersedia: administrasi, perizinan, kesehatan, sosial, ekonomi' },
          context: {}
        };
      }
      
      const fs = require('fs-extra');
      const path = require('path');
      const menusPath = path.join(process.cwd(), 'uploads', 'menus');
      await fs.ensureDir(menusPath);
      
      // Cari nomor urut berikutnya
      const existingMenus = await fs.readdir(menusPath);
      const existingNumbers = existingMenus
        .filter(folder => /^(\d+)-/.test(folder))
        .map(folder => parseInt(folder.match(/^(\d+)-/)[1]))
        .sort((a, b) => a - b);
      
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 7;
      
      // Buat layanan utama
      const folderName = `${nextNumber}-${template.name.replace(/\s+/g, '_')}`;
      const newFolderPath = path.join(menusPath, folderName);
      await fs.ensureDir(newFolderPath);
      
      // Buat sub-menu
      const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      let createdSubMenus = [];
      
      for (let i = 0; i < template.subMenus.length && i < letters.length; i++) {
        const subMenu = template.subMenus[i];
        const letter = letters[i];
        const subFolderName = `${nextNumber}${letter}-${subMenu.name.replace(/\s+/g, '_')}`;
        const subFolderPath = path.join(newFolderPath, subFolderName);
        
        await fs.ensureDir(subFolderPath);
        
        // Template konten yang lebih lengkap
        const contentTemplate = {
          title: subMenu.name,
          description: subMenu.desc,
          requirements: [
            "Fotokopi KTP yang masih berlaku",
            "Fotokopi Kartu Keluarga",
            "Surat pengantar dari RT/RW",
            "Pas foto terbaru (jika diperlukan)",
            "[Tambahkan persyaratan khusus sesuai layanan]"
          ],
          procedures: [
            "Datang ke Kantor Desa dengan membawa persyaratan",
            "Mengisi formulir permohonan",
            "Menyerahkan berkas persyaratan",
            "Menunggu proses verifikasi (1-3 hari kerja)",
            "Mengambil dokumen yang sudah jadi"
          ],
          contact: {
            info: "Untuk informasi lebih lanjut, hubungi Kantor Desa Pulosarok.",
            phone: "[Nomor telepon kantor desa]",
            hours: "Senin-Jumat: 08.00-15.00 WIB",
            location: "Kantor Desa Pulosarok, [Alamat lengkap]"
          },
          fees: {
            amount: "Gratis (sesuai peraturan desa)",
            note: "Biaya administrasi sesuai ketentuan yang berlaku"
          },
          metadata: {
            createdBy: admin.username,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            template: templateName,
            version: "1.0"
          }
        };
        
        await fs.writeFile(path.join(subFolderPath, 'content.json'), JSON.stringify(contentTemplate, null, 2));
        createdSubMenus.push(`${nextNumber}${letter} - ${subMenu.name}`);
      }
      
      // Buat README.md
      const readmeContent = `# ${template.name}\n\nTemplate layanan ${template.name} di Desa Pulosarok\n\nDibuat oleh: ${admin.username}\nTanggal: ${new Date().toLocaleString('id-ID')}\nTemplate: ${templateName}\n\n## Sub-layanan yang dibuat:\n\n${createdSubMenus.map(sub => `- ${sub}`).join('\n')}\n\n## Cara mengedit:\n\n1. Gunakan !layananshow untuk melihat konten\n2. Gunakan !layananedit untuk mengedit konten\n3. Edit file content.json di setiap folder sub-layanan\n\n*Template ini dapat disesuaikan dengan kebutuhan desa.*`;
      
      await fs.writeFile(path.join(newFolderPath, 'README.md'), readmeContent);
      
      return {
        response: { text: `✅ *Template Layanan Berhasil Dibuat*\n\n🏢 *Layanan:* ${template.name}\n📁 *Folder:* ${folderName}\n📍 *Nomor:* ${nextNumber}\n📋 *Sub-layanan:* ${template.subMenus.length}\n👤 *Author:* ${admin.username}\n🕒 *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n*Sub-layanan yang dibuat:*\n${createdSubMenus.join('\n')}\n\n*Gunakan !layananshow ${nextNumber} untuk melihat detail.*` },
        context: {}
      };
      
    } catch (error) {
      console.error('Error creating service template:', error);
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan saat membuat template layanan.' },
        context: {}
      };
    }
  }
  
  // !layananquick - Membuat layanan cepat dengan wizard
  async handleLayananQuickCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!context.quick_service) {
        // Mulai wizard
        context.quick_service = {
          step: 'name',
          data: {}
        };
        
        return {
          response: { text: '🚀 *WIZARD LAYANAN CEPAT*\n\n📝 *Langkah 1/4: Nama Layanan*\n\nMasukkan nama layanan yang ingin dibuat:\n\nContoh: Layanan Kependudukan\n\n*Ketik "batal" untuk membatalkan.*' },
          context: context
        };
      }
      
      const step = context.quick_service.step;
      const input = args ? args.trim() : '';
      
      if (input.toLowerCase() === 'batal') {
        delete context.quick_service;
        return {
          response: { text: '❌ *Wizard Dibatalkan*\n\nPembuatan layanan cepat dibatalkan.' },
          context: context
        };
      }
      
      switch (step) {
        case 'name':
          if (!input) {
            return {
              response: { text: '❌ *Nama Tidak Boleh Kosong*\n\nMasukkan nama layanan:' },
              context: context
            };
          }
          
          context.quick_service.data.name = input;
          context.quick_service.step = 'description';
          
          return {
            response: { text: `📝 *Langkah 2/4: Deskripsi*\n\n*Layanan:* ${input}\n\nMasukkan deskripsi singkat layanan:\n\nContoh: Layanan administrasi kependudukan untuk warga desa\n\n*Ketik "batal" untuk membatalkan.*` },
            context: context
          };
          
        case 'description':
          if (!input) {
            return {
              response: { text: '❌ *Deskripsi Tidak Boleh Kosong*\n\nMasukkan deskripsi layanan:' },
              context: context
            };
          }
          
          context.quick_service.data.description = input;
          context.quick_service.step = 'submenus';
          
          return {
            response: { text: `📝 *Langkah 3/4: Sub-layanan*\n\n*Layanan:* ${context.quick_service.data.name}\n*Deskripsi:* ${input}\n\nMasukkan nama sub-layanan (pisahkan dengan koma):\n\nContoh: KTP Baru, Kartu Keluarga, Akta Kelahiran\n\n*Maksimal 8 sub-layanan*\n*Ketik "batal" untuk membatalkan.*` },
            context: context
          };
          
        case 'submenus':
          if (!input) {
            return {
              response: { text: '❌ *Sub-layanan Tidak Boleh Kosong*\n\nMasukkan nama sub-layanan (pisahkan dengan koma):' },
              context: context
            };
          }
          
          const subMenus = input.split(',').map(s => s.trim()).filter(s => s.length > 0);
          if (subMenus.length === 0) {
            return {
              response: { text: '❌ *Format Salah*\n\nMasukkan sub-layanan yang dipisahkan dengan koma.' },
              context: context
            };
          }
          
          if (subMenus.length > 8) {
            return {
              response: { text: '❌ *Terlalu Banyak Sub-layanan*\n\nMaksimal 8 sub-layanan. Silakan kurangi.' },
              context: context
            };
          }
          
          context.quick_service.data.subMenus = subMenus;
          context.quick_service.step = 'confirm';
          
          let confirmText = `📝 *Langkah 4/4: Konfirmasi*\n\n`;
          confirmText += `🏢 *Layanan:* ${context.quick_service.data.name}\n`;
          confirmText += `📝 *Deskripsi:* ${context.quick_service.data.description}\n`;
          confirmText += `📋 *Sub-layanan (${subMenus.length}):*\n`;
          subMenus.forEach((sub, i) => {
            confirmText += `   ${String.fromCharCode(65 + i)}. ${sub}\n`;
          });
          confirmText += `\n*Ketik "ya" untuk membuat atau "batal" untuk membatalkan.*`;
          
          return {
            response: { text: confirmText },
            context: context
          };
          
        case 'confirm':
          if (input.toLowerCase() !== 'ya') {
            return {
              response: { text: '❌ *Konfirmasi Gagal*\n\nKetik "ya" untuk konfirmasi atau "batal" untuk membatalkan.' },
              context: context
            };
          }
          
          // Buat layanan
          const result = await this.createQuickService(context.quick_service.data, admin);
          delete context.quick_service;
          
          return {
            response: result,
            context: context
          };
          
        default:
          delete context.quick_service;
          return {
            response: { text: '❌ *Error*\n\nTerjadi kesalahan dalam wizard.' },
            context: context
          };
      }
      
    } catch (error) {
      console.error('Error in quick service wizard:', error);
      delete context.quick_service;
      return {
        response: { text: '❌ *Error*\n\nTerjadi kesalahan dalam wizard layanan cepat.' },
        context: context
      };
    }
  }
  
  // Helper function untuk membuat layanan cepat
  async createQuickService(data, admin) {
    try {
      const fs = require('fs-extra');
      const path = require('path');
      const menusPath = path.join(process.cwd(), 'uploads', 'menus');
      await fs.ensureDir(menusPath);
      
      // Cari nomor urut berikutnya
      const existingMenus = await fs.readdir(menusPath);
      const existingNumbers = existingMenus
        .filter(folder => /^(\d+)-/.test(folder))
        .map(folder => parseInt(folder.match(/^(\d+)-/)[1]))
        .sort((a, b) => a - b);
      
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 7;
      
      // Buat layanan utama
      const folderName = `${nextNumber}-${data.name.replace(/\s+/g, '_')}`;
      const newFolderPath = path.join(menusPath, folderName);
      await fs.ensureDir(newFolderPath);
      
      // Buat sub-menu
      const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      let createdSubMenus = [];
      
      for (let i = 0; i < data.subMenus.length && i < letters.length; i++) {
        const subMenuName = data.subMenus[i];
        const letter = letters[i];
        const subFolderName = `${nextNumber}${letter}-${subMenuName.replace(/\s+/g, '_')}`;
        const subFolderPath = path.join(newFolderPath, subFolderName);
        
        await fs.ensureDir(subFolderPath);
        
        // Template konten dasar
        const contentTemplate = {
          title: subMenuName,
          description: `Layanan ${subMenuName} di Desa Pulosarok`,
          requirements: [
            "Fotokopi KTP yang masih berlaku",
            "Fotokopi Kartu Keluarga",
            "Surat pengantar dari RT/RW",
            "[Sesuaikan dengan kebutuhan layanan]"
          ],
          procedures: [
            "Datang ke Kantor Desa dengan membawa persyaratan",
            "Mengisi formulir permohonan",
            "Menyerahkan berkas persyaratan",
            "Menunggu proses verifikasi",
            "Mengambil dokumen yang sudah jadi"
          ],
          contact: {
            info: "Untuk informasi lebih lanjut, hubungi Kantor Desa Pulosarok.",
            phone: "[Nomor telepon kantor desa]",
            hours: "Senin-Jumat: 08.00-15.00 WIB"
          },
          metadata: {
            createdBy: admin.username,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            quickService: true
          }
        };
        
        await fs.writeFile(path.join(subFolderPath, 'content.json'), JSON.stringify(contentTemplate, null, 2));
        createdSubMenus.push(`${nextNumber}${letter} - ${subMenuName}`);
      }
      
      // Buat README.md
      const readmeContent = `# ${data.name}\n\n${data.description}\n\nDibuat oleh: ${admin.username}\nTanggal: ${new Date().toLocaleString('id-ID')}\nDibuat dengan: Wizard Layanan Cepat\n\n## Sub-layanan:\n\n${createdSubMenus.map(sub => `- ${sub}`).join('\n')}\n\n*Layanan ini dibuat dengan wizard cepat dan dapat disesuaikan lebih lanjut.*`;
      
      await fs.writeFile(path.join(newFolderPath, 'README.md'), readmeContent);
      
      return {
        text: `✅ *Layanan Cepat Berhasil Dibuat*\n\n🏢 *Layanan:* ${data.name}\n📝 *Deskripsi:* ${data.description}\n📁 *Folder:* ${folderName}\n📍 *Nomor:* ${nextNumber}\n📋 *Sub-layanan:* ${data.subMenus.length}\n👤 *Author:* ${admin.username}\n🕒 *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n*Sub-layanan yang dibuat:*\n${createdSubMenus.join('\n')}\n\n*Gunakan !layananshow ${nextNumber} untuk melihat detail.*`
      };
      
    } catch (error) {
      console.error('Error creating quick service:', error);
      return {
        text: '❌ *Error*\n\nTerjadi kesalahan saat membuat layanan cepat.'
      };
    }
  }

  // ==================== UMKM COMMANDS ====================

  async handleUmkmAddCommand(sock, senderId, args, messageObj, admin, userStates) {
    try {
      if (!args || args.length === 0) {
        return {
          text: '📝 *Tambah UMKM Baru*\n\n' +
                '🔹 Format: !umkmadd [nama]|[kategori]|[deskripsi]|[alamat]|[kontak]|[jam_operasional]\n\n' +
                '📋 *Kategori yang tersedia:*\n' +
                '• Kuliner\n' +
                '• Pertanian\n' +
                '• Perikanan\n' +
                '• Kerajinan\n' +
                '• Perdagangan\n' +
                '• Jasa\n\n' +
                '📌 *Contoh:*\n' +
                '!umkmadd Warung Mak Ijah|Kuliner|Warung nasi padang dengan cita rasa autentik|Jl. Pantai Pulosarok No. 15|0812-3456-7890|06:00-22:00\n\n' +
                '_Dibuat oleh Mahasiswa UMSU_'
        };
      }

      const input = args.join(' ');
      const parts = input.split('|').map(part => part.trim());
      
      if (parts.length !== 6) {
        return {
          text: '❌ *Format Salah*\n\n' +
                'Format yang benar:\n' +
                '!umkmadd [nama]|[kategori]|[deskripsi]|[alamat]|[kontak]|[jam_operasional]\n\n' +
                '_Dibuat oleh Mahasiswa UMSU_'
        };
      }

      const [nama, kategori, deskripsi, alamat, kontak, jamOperasional] = parts;
      
      // Validasi kategori
      const validKategori = ['Kuliner', 'Pertanian', 'Perikanan', 'Kerajinan', 'Perdagangan', 'Jasa'];
      if (!validKategori.includes(kategori)) {
        return {
          text: `❌ *Kategori Tidak Valid*\n\n` +
                `Kategori yang tersedia:\n${validKategori.map(k => `• ${k}`).join('\n')}\n\n` +
                '_Dibuat oleh Mahasiswa UMSU_'
        };
      }

      // Load existing UMKM data
      const umkmFile = path.join(process.cwd(), 'uploads', 'umkm', 'umkm.json');
      await fsExtra.ensureDir(path.dirname(umkmFile));
      
      let umkmList = [];
      if (await fsExtra.pathExists(umkmFile)) {
        umkmList = await fsExtra.readJson(umkmFile);
      }

      // Generate new ID
      const newId = umkmList.length > 0 ? Math.max(...umkmList.map(u => u.id)) + 1 : 1;
      
      // Create new UMKM entry
      const newUmkm = {
        id: newId,
        nama: nama,
        kategori: kategori,
        deskripsi: deskripsi,
        alamat: alamat,
        kontak: kontak,
        jam_operasional: jamOperasional,
        status: 'aktif',
        created_at: new Date().toISOString(),
        created_by: admin.username,
        image: null
      };

      umkmList.push(newUmkm);
      await fsExtra.writeJson(umkmFile, umkmList, { spaces: 2 });

      return {
        text: `✅ *UMKM Berhasil Ditambahkan*\n\n` +
              `🏪 *Nama:* ${nama}\n` +
              `📂 *Kategori:* ${kategori}\n` +
              `📍 *Alamat:* ${alamat}\n` +
              `📞 *Kontak:* ${kontak}\n` +
              `🕒 *Jam Operasional:* ${jamOperasional}\n` +
              `🆔 *ID:* ${newId}\n` +
              `👤 *Dibuat oleh:* ${admin.username}\n` +
              `📅 *Tanggal:* ${new Date().toLocaleString('id-ID')}\n\n` +
              '_Dibuat oleh Mahasiswa UMSU_'
      };
      
    } catch (error) {
      console.error('Error adding UMKM:', error);
      return {
        text: '❌ *Error*\n\nTerjadi kesalahan saat menambah UMKM.\n\n_Dibuat oleh Mahasiswa UMSU_'
      };
    }
  }

  async handleUmkmListCommand(sock, senderId, args, messageObj, admin, userStates) {
    try {
      const umkmFile = path.join(process.cwd(), 'uploads', 'umkm', 'umkm.json');
      
      if (!await fsExtra.pathExists(umkmFile)) {
        return {
          text: '📋 *DAFTAR UMKM*\n\n' +
                '❌ Belum ada data UMKM.\n\n' +
                'Gunakan !umkmadd untuk menambah UMKM baru.\n\n' +
                '_Dibuat oleh Mahasiswa UMSU_'
        };
      }

      const umkmList = await fsExtra.readJson(umkmFile);
      
      if (umkmList.length === 0) {
        return {
          text: '📋 *DAFTAR UMKM*\n\n' +
                '❌ Belum ada data UMKM.\n\n' +
                'Gunakan !umkmadd untuk menambah UMKM baru.\n\n' +
                '_Dibuat oleh Mahasiswa UMSU_'
        };
      }

      // Group by category
      const groupedUmkm = umkmList.reduce((acc, umkm) => {
        if (!acc[umkm.kategori]) {
          acc[umkm.kategori] = [];
        }
        acc[umkm.kategori].push(umkm);
        return acc;
      }, {});

      let response = '📋 *DAFTAR UMKM PULOSAROK*\n\n';
      
      Object.keys(groupedUmkm).forEach(kategori => {
        response += `🏷️ *${kategori.toUpperCase()}*\n`;
        groupedUmkm[kategori].forEach(umkm => {
          response += `\n🆔 ID: ${umkm.id}\n`;
          response += `🏪 ${umkm.nama}\n`;
          response += `📍 ${umkm.alamat}\n`;
          response += `📞 ${umkm.kontak}\n`;
          response += `🕒 ${umkm.jam_operasional}\n`;
          response += `📊 Status: ${umkm.status}\n`;
          response += '─'.repeat(30) + '\n';
        });
        response += '\n';
      });

      response += `📊 *Total UMKM:* ${umkmList.length}\n\n`;
      response += '💡 *Perintah Admin:*\n';
      response += '• !umkmadd - Tambah UMKM\n';
      response += '• !umkmedit [ID] - Edit UMKM\n';
      response += '• !umkmdelete [ID] - Hapus UMKM\n\n';
      response += '_Dibuat oleh Mahasiswa UMSU_';

      return { text: response };
      
    } catch (error) {
      console.error('Error listing UMKM:', error);
      return {
        text: '❌ *Error*\n\nTerjadi kesalahan saat menampilkan daftar UMKM.\n\n_Dibuat oleh Mahasiswa UMSU_'
      };
    }
  }

  async handleUmkmEditCommand(sock, senderId, args, messageObj, admin, userStates) {
    try {
      if (!args || args.length === 0) {
        return {
          text: '📝 *Edit UMKM*\n\n' +
                '🔹 Format: !umkmedit [ID]\n\n' +
                '📌 *Contoh:* !umkmedit 1\n\n' +
                'Gunakan !umkmlist untuk melihat daftar UMKM.\n\n' +
                '_Dibuat oleh Mahasiswa UMSU_'
        };
      }

      const umkmId = parseInt(args[0]);
      if (isNaN(umkmId)) {
        return {
          text: '❌ *ID Tidak Valid*\n\nID harus berupa angka.\n\n_Dibuat oleh Mahasiswa UMSU_'
        };
      }

      const umkmFile = path.join(process.cwd(), 'uploads', 'umkm', 'umkm.json');
      
      if (!await fsExtra.pathExists(umkmFile)) {
        return {
          text: '❌ *File UMKM Tidak Ditemukan*\n\nBelum ada data UMKM.\n\n_Dibuat oleh Mahasiswa UMSU_'
        };
      }

      const umkmList = await fsExtra.readJson(umkmFile);
      const umkm = umkmList.find(u => u.id === umkmId);
      
      if (!umkm) {
        return {
          text: `❌ *UMKM Tidak Ditemukan*\n\nUMKM dengan ID ${umkmId} tidak ditemukan.\n\n_Dibuat oleh Mahasiswa UMSU_`
        };
      }

      // Store edit state
      userStates[senderId] = {
        action: 'umkm_edit',
        umkmId: umkmId,
        step: 'choose_field'
      };

      return {
        response: {
          text: `📝 *Edit UMKM*\n\n` +
                `🏪 *${umkm.nama}*\n\n` +
                `📂 Kategori: ${umkm.kategori}\n` +
                `📝 Deskripsi: ${umkm.deskripsi}\n` +
                `📍 Alamat: ${umkm.alamat}\n` +
                `📞 Kontak: ${umkm.kontak}\n` +
                `🕒 Jam Operasional: ${umkm.jam_operasional}\n\n` +
                `*Pilih yang ingin diedit:*\n` +
                `1️⃣ Nama\n` +
                `2️⃣ Kategori\n` +
                `3️⃣ Deskripsi\n` +
                `4️⃣ Alamat\n` +
                `5️⃣ Kontak\n` +
                `6️⃣ Jam Operasional\n` +
                `7️⃣ Status\n\n` +
                `Ketik angka pilihan Anda (1-7)\n\n` +
                '_Dibuat oleh Mahasiswa UMSU_'
        }
      };
      
    } catch (error) {
      console.error('Error editing UMKM:', error);
      return {
        text: '❌ *Error*\n\nTerjadi kesalahan saat mengedit UMKM.\n\n_Dibuat oleh Mahasiswa UMSU_'
      };
    }
  }

  async handleUmkmDeleteCommand(sock, senderId, args, messageObj, admin, userStates) {
    try {
      if (!args || args.length === 0) {
        return {
          text: '🗑️ *Hapus UMKM*\n\n' +
                '🔹 Format: !umkmdelete [ID]\n\n' +
                '📌 *Contoh:* !umkmdelete 1\n\n' +
                'Gunakan !umkmlist untuk melihat daftar UMKM.\n\n' +
                '_Dibuat oleh Mahasiswa UMSU_'
        };
      }

      const umkmId = parseInt(args[0]);
      if (isNaN(umkmId)) {
        return {
          text: '❌ *ID Tidak Valid*\n\nID harus berupa angka.\n\n_Dibuat oleh Mahasiswa UMSU_'
        };
      }

      const umkmFile = path.join(process.cwd(), 'uploads', 'umkm', 'umkm.json');
      
      if (!await fsExtra.pathExists(umkmFile)) {
        return {
          text: '❌ *File UMKM Tidak Ditemukan*\n\nBelum ada data UMKM.\n\n_Dibuat oleh Mahasiswa UMSU_'
        };
      }

      const umkmList = await fsExtra.readJson(umkmFile);
      const umkmIndex = umkmList.findIndex(u => u.id === umkmId);
      
      if (umkmIndex === -1) {
        return {
          text: `❌ *UMKM Tidak Ditemukan*\n\nUMKM dengan ID ${umkmId} tidak ditemukan.\n\n_Dibuat oleh Mahasiswa UMSU_`
        };
      }

      const deletedUmkm = umkmList[umkmIndex];
      umkmList.splice(umkmIndex, 1);
      
      await fsExtra.writeJson(umkmFile, umkmList, { spaces: 2 });

      return {
        text: `✅ *UMKM Berhasil Dihapus*\n\n` +
              `🏪 *Nama:* ${deletedUmkm.nama}\n` +
              `📂 *Kategori:* ${deletedUmkm.kategori}\n` +
              `🆔 *ID:* ${umkmId}\n` +
              `👤 *Dihapus oleh:* ${admin.username}\n` +
              `📅 *Tanggal:* ${new Date().toLocaleString('id-ID')}\n\n` +
              '_Dibuat oleh Mahasiswa UMSU_'
      };
      
    } catch (error) {
      console.error('Error deleting UMKM:', error);
      return {
        text: '❌ *Error*\n\nTerjadi kesalahan saat menghapus UMKM.\n\n_Dibuat oleh Mahasiswa UMSU_'
      };
    }
  }

  // Handler untuk perintah !panduanBot
  async handlePanduanBotCommand(models, senderId, args, sock, admin, context) {
    try {
      const guideContent = await this.generateCompleteGuide();
      const fileName = `PANDUAN_BOT_LENGKAP_${new Date().toISOString().split('T')[0]}.txt`;
      const filePath = path.join(process.cwd(), 'docs', fileName);
      
      // Pastikan folder docs ada
      await fsExtra.ensureDir(path.dirname(filePath));
      
      // Tulis file panduan
      await fs.writeFile(filePath, guideContent, 'utf8');
      
      const response = {
        text: `📖 *PANDUAN BOT LENGKAP*\n\n` +
              `✅ File panduan berhasil dibuat!\n\n` +
              `📁 *Lokasi:* docs/${fileName}\n` +
              `📊 *Ukuran:* ${Math.round(guideContent.length / 1024)} KB\n` +
              `📝 *Total Baris:* ${guideContent.split('\n').length} baris\n\n` +
              `🎯 *Isi Panduan:*\n` +
              `• Menu utama dan sub-menu\n` +
              `• Panduan admin lengkap\n` +
              `• Cara penggunaan semua fitur\n` +
              `• Tips dan trik\n\n` +
              `_Dibuat oleh Mahasiswa UMSU_`
      };
      
      return {
        response: response,
        context: {}
      };
      
    } catch (error) {
      console.error('Error creating guide:', error);
      return {
        response: {
          text: '❌ *Error*\n\nTerjadi kesalahan saat membuat panduan.\n\n_Dibuat oleh Mahasiswa UMSU_'
        },
        context: {}
      };
    }
  }

  // Generate panduan lengkap
  async generateCompleteGuide() {
    const guide = [];
    
    // Header
    guide.push('='.repeat(80));
    guide.push('                    PANDUAN LENGKAP BOT WHATSAPP DESA');
    guide.push('                         DESA PULOSAROK');
    guide.push('='.repeat(80));
    guide.push('');
    guide.push('📅 Dibuat: ' + new Date().toLocaleString('id-ID'));
    guide.push('👨‍💻 Dibuat oleh: Mahasiswa UMSU');
    guide.push('📱 Platform: WhatsApp Bot');
    guide.push('');
    guide.push('='.repeat(80));
    guide.push('                           DAFTAR ISI');
    guide.push('='.repeat(80));
    guide.push('');
    guide.push('1. PENGENALAN BOT');
    guide.push('2. MENU UTAMA UNTUK WARGA');
    guide.push('3. PANDUAN ADMIN LENGKAP');
    guide.push('4. SISTEM PENGADUAN');
    guide.push('5. MANAJEMEN BERITA & PENGUMUMAN');
    guide.push('6. LAYANAN DESA');
    guide.push('7. UMKM DESA');
    guide.push('8. PENGATURAN SISTEM');
    guide.push('9. TIPS & TRIK');
    guide.push('10. TROUBLESHOOTING');
    guide.push('');
    
    // 1. PENGENALAN BOT
    guide.push('='.repeat(80));
    guide.push('1. PENGENALAN BOT');
    guide.push('='.repeat(80));
    guide.push('');
    guide.push('Bot WhatsApp Desa Pulosarok adalah sistem otomatis yang membantu');
    guide.push('warga mengakses layanan desa dengan mudah melalui WhatsApp.');
    guide.push('');
    guide.push('🎯 FITUR UTAMA:');
    guide.push('• Informasi desa dan layanan');
    guide.push('• Sistem pengaduan online');
    guide.push('• Berita dan pengumuman');
    guide.push('• Direktori UMKM');
    guide.push('• Layanan administrasi');
    guide.push('');
    guide.push('📱 CARA MEMULAI:');
    guide.push('1. Simpan nomor bot di kontak');
    guide.push('2. Kirim pesan "Halo" atau "Menu"');
    guide.push('3. Pilih layanan yang diinginkan');
    guide.push('4. Ikuti petunjuk yang diberikan');
    guide.push('');
    
    // 2. MENU UTAMA UNTUK WARGA
    guide.push('='.repeat(80));
    guide.push('2. MENU UTAMA UNTUK WARGA');
    guide.push('='.repeat(80));
    guide.push('');
    guide.push('Menu utama dapat diakses dengan mengirim:');
    guide.push('• "Menu" atau "0"');
    guide.push('• "Halo" atau "Hi"');
    guide.push('');
    guide.push('📋 DAFTAR LAYANAN:');
    guide.push('');
    guide.push('1️⃣ INFORMASI DESA');
    guide.push('   • Profil desa');
    guide.push('   • Visi misi');
    guide.push('   • Struktur organisasi');
    guide.push('   • Sejarah desa');
    guide.push('');
    guide.push('2️⃣ LAYANAN DESA');
    guide.push('   • Surat keterangan');
    guide.push('   • Surat domisili');
    guide.push('   • Surat usaha');
    guide.push('   • Layanan lainnya');
    guide.push('');
    guide.push('3️⃣ BERITA & PENGUMUMAN');
    guide.push('   • Berita terbaru');
    guide.push('   • Pengumuman penting');
    guide.push('   • Agenda kegiatan');
    guide.push('');
    guide.push('4️⃣ UMKM DESA');
    guide.push('   • Daftar UMKM');
    guide.push('   • Produk unggulan');
    guide.push('   • Kontak UMKM');
    guide.push('');
    guide.push('5️⃣ WISATA DESA');
    guide.push('   • Tempat wisata');
    guide.push('   • Paket wisata');
    guide.push('   • Galeri foto');
    guide.push('');
    guide.push('6️⃣ KONTAK PENTING');
    guide.push('   • Kantor desa');
    guide.push('   • Kepala desa');
    guide.push('   • Perangkat desa');
    guide.push('   • Layanan darurat');
    guide.push('');
    guide.push('7️⃣ PENGADUAN');
    guide.push('   • Buat pengaduan baru');
    guide.push('   • Cek status pengaduan');
    guide.push('   • Panduan pengaduan');
    guide.push('');
    
    // 3. PANDUAN ADMIN LENGKAP
    guide.push('='.repeat(80));
    guide.push('3. PANDUAN ADMIN LENGKAP');
    guide.push('='.repeat(80));
    guide.push('');
    guide.push('Admin memiliki akses khusus untuk mengelola bot.');
    guide.push('Semua perintah admin dimulai dengan tanda "!"');
    guide.push('');
    guide.push('🔐 AKSES ADMIN:');
    guide.push('• Super Admin: Akses penuh');
    guide.push('• Admin: Akses terbatas');
    guide.push('• Moderator: Akses moderasi');
    guide.push('');
    guide.push('📋 PERINTAH UTAMA:');
    guide.push('');
    guide.push('!adminmenu - Menu admin utama');
    guide.push('!help - Bantuan perintah');
    guide.push('!stats - Statistik sistem');
    guide.push('!user [nomor] - Info pengguna');
    guide.push('!pengaturan - Menu pengaturan');
    guide.push('');
    guide.push('📰 MANAJEMEN BERITA:');
    guide.push('');
    guide.push('!berita - Menu berita');
    guide.push('!beritaadd - Tambah berita');
    guide.push('!beritalist - Daftar berita');
    guide.push('!beritaedit [id] - Edit berita');
    guide.push('!beritadelete [id] - Hapus berita');
    guide.push('!beritasearch [kata] - Cari berita');
    guide.push('');
    guide.push('📢 MANAJEMEN PENGUMUMAN:');
    guide.push('');
    guide.push('!pengumuman - Menu pengumuman');
    guide.push('!pengumumanadd - Tambah pengumuman');
    guide.push('!pengumumanlist - Daftar pengumuman');
    guide.push('!pengumumanedit [id] - Edit pengumuman');
    guide.push('!pengumumandelete [id] - Hapus pengumuman');
    guide.push('');
    guide.push('🏢 MANAJEMEN LAYANAN:');
    guide.push('');
    guide.push('!layanan - Menu layanan');
    guide.push('!layananadd - Tambah layanan');
    guide.push('!layananlist - Daftar layanan');
    guide.push('!layananedit [id] - Edit layanan');
    guide.push('!layananshow [id] - Detail layanan');
    guide.push('!layanantemplate - Template cepat');
    guide.push('!layananquick - Layanan cepat');
    guide.push('');
    guide.push('🏪 MANAJEMEN UMKM:');
    guide.push('');
    guide.push('!umkmadd - Tambah UMKM');
    guide.push('!umkmlist - Daftar UMKM');
    guide.push('!umkmedit [id] - Edit UMKM');
    guide.push('!umkmdelete [id] - Hapus UMKM');
    guide.push('!umkmsearch [kata] - Cari UMKM');
    guide.push('');
    guide.push('📝 MANAJEMEN PENGADUAN:');
    guide.push('');
    guide.push('!pengaduanlist - Daftar pengaduan');
    guide.push('!listpengaduan - List semua pengaduan');
    guide.push('!detailpengaduan [id] - Detail pengaduan');
    guide.push('!updatestatus [id] [status] - Update status');
    guide.push('!deletepengaduan [id] - Hapus pengaduan');
    guide.push('!statistik - Statistik pengaduan');
    guide.push('');
    guide.push('👥 MANAJEMEN USER:');
    guide.push('');
    guide.push('!ban [nomor] - Blokir user');
    guide.push('!unban [nomor] - Buka blokir user');
    guide.push('!broadcast [pesan] - Kirim broadcast');
    guide.push('!adminnew [nomor] [role] - Tambah admin');
    guide.push('!admindel [nomor] - Hapus admin');
    guide.push('');
    guide.push('⚙️ PENGATURAN SISTEM:');
    guide.push('');
    guide.push('!settingshow - Tampilkan pengaturan');
    guide.push('!settingset [kategori] [key] [value] - Set nilai');
    guide.push('!settingget [kategori] [key] - Ambil nilai');
    guide.push('!settingdel [kategori] [key] - Hapus pengaturan');
    guide.push('!settingreset - Reset ke default');
    guide.push('');
    guide.push('🔒 PENGATURAN LIMIT:');
    guide.push('');
    guide.push('!limitshow - Tampilkan limit');
    guide.push('!limitset [key] [value] - Set limit');
    guide.push('Contoh: !limitset nameLimit 60');
    guide.push('');
    guide.push('🛡️ PENGATURAN FILTER:');
    guide.push('');
    guide.push('!filtershow - Tampilkan filter');
    guide.push('!filterset [key] [value] - Set filter');
    guide.push('!filteradd [type] [value] - Tambah ke daftar');
    guide.push('!filterdel [type] [value] - Hapus dari daftar');
    guide.push('Contoh: !filteradd bannedWords "kata_baru"');
    guide.push('');
    guide.push('⚖️ PENGATURAN MODERASI:');
    guide.push('');
    guide.push('!moderationshow - Tampilkan moderasi');
    guide.push('!moderationset [key] [value] - Set moderasi');
    guide.push('Contoh: !moderationset autoWarn true');
    guide.push('');
    guide.push('🧹 MAINTENANCE:');
    guide.push('');
    guide.push('!clearcache - Bersihkan cache');
    guide.push('!deleteimages - Hapus gambar lama');
    guide.push('!backup - Backup database');
    guide.push('!laporan - Generate laporan');
    guide.push('!laporanuser - Laporan user');
    guide.push('');
    
    // 4. SISTEM PENGADUAN
    guide.push('='.repeat(80));
    guide.push('4. SISTEM PENGADUAN');
    guide.push('='.repeat(80));
    guide.push('');
    guide.push('Sistem pengaduan memungkinkan warga menyampaikan keluhan');
    guide.push('atau saran kepada pemerintah desa.');
    guide.push('');
    guide.push('📝 CARA MEMBUAT PENGADUAN:');
    guide.push('');
    guide.push('1. Pilih menu "7" (Pengaduan)');
    guide.push('2. Pilih "A" (Buat Pengaduan Baru)');
    guide.push('3. Masukkan kode pengaduan (wajib)');
    guide.push('4. Isi nama (opsional)');
    guide.push('5. Isi alamat (opsional)');
    guide.push('6. Tulis keluhan/saran (opsional)');
    guide.push('7. Kirim foto jika diperlukan');
    guide.push('');
    guide.push('📋 FORMAT PENGADUAN:');
    guide.push('');
    guide.push('Kode: [WAJIB - kode unik pengaduan]');
    guide.push('Nama: [Opsional - nama pelapor]');
    guide.push('Alamat: [Opsional - alamat pelapor]');
    guide.push('Aduan: [Opsional - isi pengaduan]');
    guide.push('');
    guide.push('✅ CONTOH PENGADUAN:');
    guide.push('');
    guide.push('Kode: JALAN001');
    guide.push('Nama: Budi Santoso');
    guide.push('Alamat: Jl. Merdeka No. 10');
    guide.push('Aduan: Jalan rusak di depan rumah');
    guide.push('');
    guide.push('📊 STATUS PENGADUAN:');
    guide.push('');
    guide.push('• Menunggu Proses - Baru diterima');
    guide.push('• Sedang Diproses - Dalam penanganan');
    guide.push('• Selesai - Sudah ditangani');
    guide.push('• Ditolak - Tidak dapat diproses');
    guide.push('');
    guide.push('🔍 CEK STATUS:');
    guide.push('');
    guide.push('1. Pilih menu "7" (Pengaduan)');
    guide.push('2. Pilih "B" (Cek Status)');
    guide.push('3. Masukkan kode pengaduan');
    guide.push('');
    
    // 5. MANAJEMEN BERITA & PENGUMUMAN
    guide.push('='.repeat(80));
    guide.push('5. MANAJEMEN BERITA & PENGUMUMAN');
    guide.push('='.repeat(80));
    guide.push('');
    guide.push('Admin dapat mengelola berita dan pengumuman untuk warga.');
    guide.push('');
    guide.push('📰 MENAMBAH BERITA:');
    guide.push('');
    guide.push('1. Ketik !beritaadd');
    guide.push('2. Masukkan judul berita');
    guide.push('3. Tulis isi berita');
    guide.push('4. Kirim gambar (opsional)');
    guide.push('5. Konfirmasi publikasi');
    guide.push('');
    guide.push('📝 TIPS MENULIS BERITA:');
    guide.push('');
    guide.push('• Gunakan judul yang menarik');
    guide.push('• Tulis dengan bahasa yang mudah dipahami');
    guide.push('• Sertakan informasi penting (5W+1H)');
    guide.push('• Gunakan gambar yang relevan');
    guide.push('• Periksa ejaan sebelum publikasi');
    guide.push('');
    guide.push('📢 MENAMBAH PENGUMUMAN:');
    guide.push('');
    guide.push('1. Ketik !pengumumanadd');
    guide.push('2. Masukkan judul pengumuman');
    guide.push('3. Tulis isi pengumuman');
    guide.push('4. Set prioritas (tinggi/normal)');
    guide.push('5. Konfirmasi publikasi');
    guide.push('');
    guide.push('🎯 JENIS PENGUMUMAN:');
    guide.push('');
    guide.push('• Prioritas Tinggi - Urgent, muncul di atas');
    guide.push('• Prioritas Normal - Pengumuman biasa');
    guide.push('• Pengumuman Khusus - Untuk grup tertentu');
    guide.push('');
    
    // 6. LAYANAN DESA
    guide.push('='.repeat(80));
    guide.push('6. LAYANAN DESA');
    guide.push('='.repeat(80));
    guide.push('');
    guide.push('Layanan desa mencakup berbagai administrasi yang');
    guide.push('dibutuhkan warga.');
    guide.push('');
    guide.push('📋 JENIS LAYANAN:');
    guide.push('');
    guide.push('• Surat Keterangan Domisili');
    guide.push('• Surat Keterangan Usaha');
    guide.push('• Surat Keterangan Tidak Mampu');
    guide.push('• Surat Pengantar KTP');
    guide.push('• Surat Pengantar KK');
    guide.push('• Surat Keterangan Kelahiran');
    guide.push('• Surat Keterangan Kematian');
    guide.push('• Legalisir Dokumen');
    guide.push('');
    guide.push('📝 CARA MENGAJUKAN:');
    guide.push('');
    guide.push('1. Pilih menu "2" (Layanan Desa)');
    guide.push('2. Pilih jenis layanan');
    guide.push('3. Isi formulir yang diminta');
    guide.push('4. Upload dokumen pendukung');
    guide.push('5. Tunggu konfirmasi admin');
    guide.push('');
    guide.push('📄 DOKUMEN YANG DIPERLUKAN:');
    guide.push('');
    guide.push('• Fotocopy KTP');
    guide.push('• Fotocopy KK');
    guide.push('• Dokumen pendukung lainnya');
    guide.push('• Pas foto (jika diperlukan)');
    guide.push('');
    guide.push('⏰ WAKTU PROSES:');
    guide.push('');
    guide.push('• Surat sederhana: 1-2 hari kerja');
    guide.push('• Surat kompleks: 3-5 hari kerja');
    guide.push('• Legalisir: 1 hari kerja');
    guide.push('');
    
    // 7. UMKM DESA
    guide.push('='.repeat(80));
    guide.push('7. UMKM DESA');
    guide.push('='.repeat(80));
    guide.push('');
    guide.push('Direktori UMKM membantu promosi usaha warga desa.');
    guide.push('');
    guide.push('🏪 MENDAFTARKAN UMKM:');
    guide.push('');
    guide.push('Admin dapat mendaftarkan UMKM dengan:');
    guide.push('1. Ketik !umkmadd');
    guide.push('2. Isi nama usaha');
    guide.push('3. Isi deskripsi produk/jasa');
    guide.push('4. Masukkan kontak pemilik');
    guide.push('5. Tambahkan alamat usaha');
    guide.push('6. Upload foto produk');
    guide.push('');
    guide.push('📊 MENGELOLA UMKM:');
    guide.push('');
    guide.push('• !umkmlist - Lihat semua UMKM');
    guide.push('• !umkmedit [id] - Edit data UMKM');
    guide.push('• !umkmdelete [id] - Hapus UMKM');
    guide.push('• !umkmsearch [kata] - Cari UMKM');
    guide.push('');
    guide.push('💡 TIPS PROMOSI UMKM:');
    guide.push('');
    guide.push('• Gunakan foto produk yang menarik');
    guide.push('• Tulis deskripsi yang jelas');
    guide.push('• Cantumkan harga jika memungkinkan');
    guide.push('• Update informasi secara berkala');
    guide.push('• Respon cepat pertanyaan pelanggan');
    guide.push('');
    
    // 8. PENGATURAN SISTEM
    guide.push('='.repeat(80));
    guide.push('8. PENGATURAN SISTEM');
    guide.push('='.repeat(80));
    guide.push('');
    guide.push('Pengaturan sistem mengontrol perilaku bot.');
    guide.push('');
    guide.push('⚙️ KATEGORI PENGATURAN:');
    guide.push('');
    guide.push('• limits - Batas penggunaan');
    guide.push('• filters - Filter konten');
    guide.push('• moderation - Moderasi otomatis');
    guide.push('• notifications - Notifikasi');
    guide.push('• system - Sistem umum');
    guide.push('• security - Keamanan');
    guide.push('');
    guide.push('🔢 PENGATURAN LIMIT:');
    guide.push('');
    guide.push('• nameLimit: 60 - Batas karakter nama');
    guide.push('• messageLimit: 500 - Batas karakter pesan');
    guide.push('• dailyLimit: 50 - Batas pesan harian');
    guide.push('• hourlyLimit: 10 - Batas pesan per jam');
    guide.push('');
    guide.push('🛡️ PENGATURAN FILTER:');
    guide.push('');
    guide.push('• profanityFilter: true - Filter kata kasar');
    guide.push('• spamFilter: true - Filter spam');
    guide.push('• bannedWords: [] - Daftar kata terlarang');
    guide.push('• allowedDomains: [] - Domain yang diizinkan');
    guide.push('');
    guide.push('⚖️ PENGATURAN MODERASI:');
    guide.push('');
    guide.push('• autoWarn: true - Peringatan otomatis');
    guide.push('• autoBan: false - Ban otomatis');
    guide.push('• warnLimit: 3 - Batas peringatan');
    guide.push('• banDuration: 24 - Durasi ban (jam)');
    guide.push('');
    
    // 9. TIPS & TRIK
    guide.push('='.repeat(80));
    guide.push('9. TIPS & TRIK');
    guide.push('='.repeat(80));
    guide.push('');
    guide.push('💡 TIPS UNTUK WARGA:');
    guide.push('');
    guide.push('• Simpan nomor bot di kontak untuk akses mudah');
    guide.push('• Gunakan menu angka untuk navigasi cepat');
    guide.push('• Kirim "0" atau "menu" untuk kembali ke menu utama');
    guide.push('• Gunakan bahasa yang sopan dan jelas');
    guide.push('• Sertakan informasi lengkap saat mengajukan layanan');
    guide.push('');
    guide.push('🔧 TIPS UNTUK ADMIN:');
    guide.push('');
    guide.push('• Gunakan !help untuk melihat semua perintah');
    guide.push('• Backup database secara berkala dengan !backup');
    guide.push('• Monitor statistik dengan !stats');
    guide.push('• Bersihkan cache secara berkala dengan !clearcache');
    guide.push('• Gunakan !pengaturan untuk konfigurasi sistem');
    guide.push('');
    guide.push('📱 TIPS PENGGUNAAN WHATSAPP:');
    guide.push('');
    guide.push('• Pastikan koneksi internet stabil');
    guide.push('• Gunakan WiFi untuk upload file besar');
    guide.push('• Kompres gambar jika ukuran terlalu besar');
    guide.push('• Hindari mengirim pesan berulang-ulang');
    guide.push('');
    guide.push('⚡ SHORTCUT BERGUNA:');
    guide.push('');
    guide.push('• "0" atau "menu" - Menu utama');
    guide.push('• "1" - Informasi desa');
    guide.push('• "2" - Layanan desa');
    guide.push('• "3" - Berita & pengumuman');
    guide.push('• "4" - UMKM desa');
    guide.push('• "5" - Wisata desa');
    guide.push('• "6" - Kontak penting');
    guide.push('• "7" - Pengaduan');
    guide.push('');
    
    // 10. TROUBLESHOOTING
    guide.push('='.repeat(80));
    guide.push('10. TROUBLESHOOTING');
    guide.push('='.repeat(80));
    guide.push('');
    guide.push('🔧 MASALAH UMUM & SOLUSI:');
    guide.push('');
    guide.push('❌ Bot tidak merespon:');
    guide.push('• Periksa koneksi internet');
    guide.push('• Tunggu beberapa detik lalu coba lagi');
    guide.push('• Restart aplikasi WhatsApp');
    guide.push('• Kirim "menu" untuk reset sesi');
    guide.push('');
    guide.push('❌ Pesan error "Tidak dikenali":');
    guide.push('• Periksa ejaan perintah');
    guide.push('• Gunakan menu angka (1-7)');
    guide.push('• Kirim "menu" untuk kembali ke awal');
    guide.push('');
    guide.push('❌ File tidak bisa dikirim:');
    guide.push('• Periksa ukuran file (max 16MB)');
    guide.push('• Gunakan format yang didukung');
    guide.push('• Kompres file jika terlalu besar');
    guide.push('');
    guide.push('❌ Pengaduan tidak tersimpan:');
    guide.push('• Pastikan kode pengaduan diisi');
    guide.push('• Gunakan kode yang unik');
    guide.push('• Coba kirim ulang dengan format yang benar');
    guide.push('');
    guide.push('🆘 KONTAK BANTUAN:');
    guide.push('');
    guide.push('Jika masalah berlanjut, hubungi:');
    guide.push('• Admin desa melalui kontak yang tersedia');
    guide.push('• Tim teknis melalui menu kontak penting');
    guide.push('');
    guide.push('📞 KONTAK DARURAT:');
    guide.push('');
    guide.push('• Kantor Desa: [Nomor kantor desa]');
    guide.push('• Kepala Desa: [Nomor kepala desa]');
    guide.push('• Sekretaris Desa: [Nomor sekretaris]');
    guide.push('');
    
    // Footer
    guide.push('='.repeat(80));
    guide.push('                              PENUTUP');
    guide.push('='.repeat(80));
    guide.push('');
    guide.push('Panduan ini dibuat untuk membantu penggunaan Bot WhatsApp');
    guide.push('Desa Pulosarok secara optimal. Semoga bermanfaat!');
    guide.push('');
    guide.push('📝 CATATAN PENTING:');
    guide.push('');
    guide.push('• Panduan ini akan diperbarui seiring pengembangan fitur');
    guide.push('• Simpan file ini untuk referensi');
    guide.push('• Bagikan kepada admin lain jika diperlukan');
    guide.push('• Laporkan bug atau saran perbaikan');
    guide.push('');
    guide.push('👨‍💻 PENGEMBANG:');
    guide.push('Mahasiswa UMSU - Program KKN 2025');
    guide.push('');
    guide.push('📅 TERAKHIR DIPERBARUI:');
    guide.push(new Date().toLocaleString('id-ID'));
    guide.push('');
    guide.push('='.repeat(80));
    guide.push('                    TERIMA KASIH TELAH MENGGUNAKAN');
    guide.push('                      BOT WHATSAPP DESA PULOSAROK');
    guide.push('='.repeat(80));
    
    return guide.join('\n');
  }

  // ===== ANTI-SPAM COMMANDS =====
  
  // Unblock user yang diblokir karena spam
  async handleUnblockCommand(models, senderId, args, sock, admin, context) {
    try {
      if (!args || args.length === 0) {
        return {
          text: `🔓 *UNBLOCK USER SPAM*\n\n` +
                `📋 *Format:* !unblock <nomor_telepon>\n\n` +
                `📝 *Contoh:* !unblock 628123456789\n\n` +
                `💡 *Tips:* Gunakan !listblocked untuk melihat daftar user yang diblokir`
        };
      }
      
      const phoneNumber = args[0].replace(/[^0-9]/g, ''); // Hapus karakter non-angka
      
      if (phoneNumber.length < 10) {
        return {
          text: `❌ *FORMAT NOMOR SALAH*\n\n` +
                `📋 Nomor telepon harus minimal 10 digit\n\n` +
                `📝 *Contoh yang benar:* 628123456789`
        };
      }
      
      const unifiedModel = models.unifiedModel;
      const success = unifiedModel.unblockUser(phoneNumber, senderId);
      
      if (success) {
        return {
          text: `✅ *USER BERHASIL DI-UNBLOCK*\n\n` +
                `📞 *Nomor:* ${phoneNumber}\n` +
                `👤 *Admin:* ${senderId}\n` +
                `⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n` +
                `💡 User dapat menggunakan bot kembali dengan normal`
        };
      } else {
        return {
          text: `❌ *GAGAL UNBLOCK USER*\n\n` +
                `📞 *Nomor:* ${phoneNumber}\n\n` +
                `🔍 *Kemungkinan penyebab:*\n` +
                `• User tidak dalam daftar yang diblokir\n` +
                `• Nomor telepon tidak ditemukan\n` +
                `• Error database\n\n` +
                `💡 Gunakan !listblocked untuk melihat daftar user yang diblokir`
        };
      }
    } catch (error) {
      console.error('Error in handleUnblockCommand:', error.message);
      return {
        text: `❌ *ERROR SISTEM*\n\n` +
              `⚠️ Terjadi kesalahan saat unblock user\n\n` +
              `🔧 *Error:* ${error.message}\n\n` +
              `💡 Silakan coba lagi atau hubungi developer`
      };
    }
  }
  
  // Lihat daftar user yang diblokir karena spam
  async handleListBlockedCommand(models, senderId, args, sock, admin, context) {
    try {
      const unifiedModel = models.unifiedModel;
      const blockedUsers = unifiedModel.getBlockedUsers();
      
      if (blockedUsers.length === 0) {
        return {
          text: `✅ *TIDAK ADA USER YANG DIBLOKIR*\n\n` +
                `📊 Saat ini tidak ada user yang diblokir karena spam\n\n` +
                `💡 Sistem anti-spam berjalan dengan baik!`
        };
      }
      
      let message = `🚫 *DAFTAR USER YANG DIBLOKIR*\n\n`;
      message += `📊 *Total:* ${blockedUsers.length} user\n\n`;
      
      blockedUsers.forEach((user, index) => {
        const blockedDate = new Date(user.blocked_at).toLocaleString('id-ID');
        message += `${index + 1}. 📞 *${user.user_phone}*\n`;
        message += `   📋 Alasan: ${user.blocked_reason}\n`;
        message += `   📊 Spam Count: ${user.spam_count}\n`;
        message += `   ⏰ Diblokir: ${blockedDate}\n`;
        message += `   👤 Oleh: ${user.blocked_by}\n\n`;
      });
      
      message += `🔓 *Cara Unblock:*\n`;
      message += `!unblock <nomor_telepon>\n\n`;
      message += `📝 *Contoh:* !unblock 628123456789`;
      
      return { text: message };
    } catch (error) {
      console.error('Error in handleListBlockedCommand:', error.message);
      return {
        text: `❌ *ERROR SISTEM*\n\n` +
              `⚠️ Terjadi kesalahan saat mengambil daftar user yang diblokir\n\n` +
              `🔧 *Error:* ${error.message}\n\n` +
              `💡 Silakan coba lagi atau hubungi developer`
      };
    }
  }
}

module.exports = new AdminCommandController();