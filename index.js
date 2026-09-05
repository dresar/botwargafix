/**
 * BotDesapulosarok - Aplikasi Layanan Informasi Desa Pulosarok
 * Aplikasi berbasis SQLite dengan sistem menu numerik dan 30+ fitur layanan desa
 * Terintegrasi dengan WhatsApp menggunakan Baileys
 */

require('dotenv').config();
const { connectToWhatsApp } = require('./src/config/whatsapp');
const { formatSubMenuMessage, getSubMenuContent } = require('./src/controllers/adminCommandController');
const idMenuController = require('./src/controllers/idMenuController');
const profanityFilter = require('./src/utils/profanityFilter');
const memoryMonitor = require('./scripts/memory-monitor');

// Fungsi untuk memformat menu utama menggunakan unifiedModel
const formatMenuMessage = async (unifiedModel) => {
  try {
    const menuStructure = unifiedModel.getMenuStructure();
    if (!menuStructure) return { text: 'Menu tidak tersedia' };
    
    const menus = menuStructure.main_menus;
    if (!menus || menus.length === 0) {
      return { text: 'Menu tidak tersedia saat ini' };
    }
    
    let menuText = `🎉 *Selamat Datang di Layanan Digital Desa Pulosarok!*\n\n`;
    menuText += `👋 Halo! Terima kasih telah menggunakan layanan digital kami.\n`;
    menuText += `Silakan pilih menu layanan yang Anda butuhkan:\n\n`;
    menuText += `═`.repeat(50) + '\n';
    menuText += `📋 *MENU LAYANAN UTAMA:*\n\n`;
    
    // Tampilkan menu 1-7 dengan jelas
    const menuItems = [
      { id: 1, name: "Informasi Desa", desc: "Profil, sejarah, dan data desa" },
      { id: 2, name: "Layanan Administrasi", desc: "Surat-menyurat dan dokumen" },
      { id: 3, name: "UMKM Desa", desc: "Usaha mikro dan produk lokal" },
      { id: 4, name: "Pariwisata", desc: "Destinasi dan objek wisata" },
      { id: 5, name: "Berita & Pengumuman", desc: "Informasi terkini desa" },
      { id: 6, name: "Layanan Kesehatan", desc: "Posyandu dan fasilitas kesehatan" },
      { id: 7, name: "Pendidikan", desc: "Sekolah dan program pendidikan" }
    ];
    
    menuItems.forEach(menu => {
      menuText += `${menu.id}️⃣ *${menu.name}*\n`;
      menuText += `   📝 ${menu.desc}\n\n`;
    });
    
    menuText += `─`.repeat(50) + '\n';
    menuText += `⚡ *KODE AKSES CEPAT:*\n\n`;
    menuText += `🔢 *Menu Utama:* Ketik angka **1, 2, 3, 4, 5, 6, 7**\n`;
    menuText += `📋 *Sub-Menu:* Ketik kode 1A, 1B, 1C, 2A, 2B, dst.\n`;
    menuText += `🏠 *Menu Utama:* Ketik *menu*\n`;
    menuText += `🔄 *Reset:* Ketik *reset*\n`;
    menuText += `📢 *Pengaduan:* Ketik *pengaduan*\n\n`;
    
    menuText += `⏰ *INFORMASI LIMIT PENGGUNAAN:*\n\n`;
    menuText += `📊 *Limit Harian:* Maksimal interaksi per hari\n`;
    menuText += `⏱️ *Limit Per Jam:* Maksimal 20 interaksi setiap jam\n`;
    menuText += `🔄 *Reset Otomatis:* Setiap jam (00:00, 01:00, dst.)\n`;
    menuText += `🧹 *Memory Chat:* Dibersihkan otomatis setiap 5 menit\n\n`;
    
    menuText += `💡 *CARA PENGGUNAAN:*\n\n`;
    menuText += `🔹 Ketik angka menu **1, 2, 3, 4, 5, 6, atau 7** untuk melihat layanan\n`;
    menuText += `🔹 Ketik kode cepat (contoh: 1A, 1B, 2A, 2B) untuk akses langsung\n`;
    menuText += `🔹 Ketik *menu* atau *reset* untuk kembali ke menu utama\n`;
    menuText += `🔹 Ketik *pengaduan* untuk melaporkan masalah\n\n`;
    
    menuText += `📞 *KONTAK DARURAT:*\n`;
    menuText += `• Polsek: 110\n`;
    menuText += `• Pemadam: 113\n`;
    menuText += `• Ambulans: 118\n\n`;
    
    menuText += `─`.repeat(45) + '\n';
    menuText += `👨‍💼 *UNTUK ADMIN DESA:*\n\n`;
    menuText += `🔧 *Kelola Layanan:* Tambah/edit menu dan konten\n`;
    menuText += `📊 *Kelola Data:* Update informasi desa dan UMKM\n`;
    menuText += `📋 *Kelola Pengaduan:* Respon dan tindak lanjut\n`;
    menuText += `⚙️ *Pengaturan:* Konfigurasi sistem bot\n\n`;
    menuText += `💡 *Akses Admin:* Ketik *!admin* untuk masuk\n\n`;
    
    menuText += `_🏛️ Melayani dengan Hati - Desa Pulosarok_\n`;
    menuText += `_Dibuat oleh Mahasiswa UMSU_`;
    
    return { text: menuText };
  } catch (error) {
    console.error('Error formatting menu message:', error.message);
    return { text: 'Terjadi kesalahan saat memuat menu. Silakan coba lagi.' };
  }
};
const { readMenuStructure } = require('./src/controllers/menuController');
const { formatComplaintForm, processComplaintSubmission, saveComplaintMedia } = require('./src/controllers/complaintController');
adminCommandController = require('./src/controllers/adminCommandController');
const { initSQLiteDatabase } = require('./src/database/initSQLiteDb');
const UnifiedModel = require('./src/models/UnifiedModel');
const NewsSearchController = require('./src/controllers/newsSearchController');
const logger = require('./src/utils/logger');
// ML imports removed
const TxtMenuController = require('./src/controllers/txtMenuController');

// Message deduplication untuk mencegah duplikasi
const processedMessages = new Set();
const MESSAGE_CLEANUP_INTERVAL = 300000; // 5 menit

// Cleanup processed messages secara berkala (silent mode untuk produksi)
setInterval(() => {
  processedMessages.clear();
  // Tidak perlu log cleanup di produksi
}, MESSAGE_CLEANUP_INTERVAL);

// Variabel untuk menyimpan instance database dan model
let db = null;
let models = null;

// Fungsi untuk menangani pesan WhatsApp
const handleMessage = async (models, msg, sock) => {
  try {
    // Dapatkan unified model dari models
    const unifiedModel = models.unifiedModel;
    
    // Dapatkan ID pengirim
    const senderId = msg.key.remoteJid.split('@')[0];
    
    // Cek apakah pengirim adalah admin
    const isAdmin = await unifiedModel.getAdminByPhoneNumber(senderId);
    
    // Cek dan kelola user (welcome untuk user baru)
    const user = unifiedModel.getOrCreateUser(senderId);
    
    // Dapatkan isi pesan
    const messageContent = msg.message.conversation || 
                          (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) || 
                          (msg.message.imageMessage && msg.message.imageMessage.caption) || 
                          (msg.message.videoMessage && msg.message.videoMessage.caption) || 
                          '';
    
    // ===== SISTEM ANTI-SPAM =====
    // Cek apakah user diblokir karena spam (kecuali admin)
    if (!isAdmin && unifiedModel.isUserBlocked(senderId)) {
      const blockedMessage = `🚫 *AKUN ANDA DIBLOKIR*\n\n` +
                           `⚠️ Akun Anda telah diblokir karena terdeteksi melakukan spam\n\n` +
                           `📋 *Alasan:* Mengirim pesan terlalu cepat (lebih dari 5 pesan dalam 5 detik)\n\n` +
                           `🔓 *Cara Unblock:* Hubungi admin desa untuk membuka blokir\n\n` +
                           `📞 *Kontak Admin:* Silakan hubungi admin melalui kontak resmi desa\n\n` +
                           `_Sistem ini dibuat untuk menjaga kualitas layanan bagi semua warga_`;
      return { text: blockedMessage };
    }
    
    // Deteksi spam untuk user biasa (bukan admin)
    if (!isAdmin) {
      // Tambahkan record pesan ke spam detection
      unifiedModel.addSpamRecord(senderId, messageContent);
      
      // Cek spam dalam 5 detik terakhir
      const spamCount = unifiedModel.checkSpamInLastFiveSeconds(senderId);
      
      // Jika lebih dari 5 pesan dalam 5 detik, blokir user
      if (spamCount >= 5) {
        unifiedModel.blockUserForSpam(senderId, spamCount);
        
        const spamBlockMessage = `🚫 *AKUN ANDA TELAH DIBLOKIR*\n\n` +
                               `⚠️ Terdeteksi spam: ${spamCount} pesan dalam 5 detik terakhir\n\n` +
                               `📋 *Kebijakan Anti-Spam:*\n` +
                               `• Maksimal 1 pesan per detik\n` +
                               `• Blokir otomatis setelah 5 pesan cepat\n\n` +
                               `🔓 *Cara Unblock:* Hubungi admin desa\n\n` +
                               `📞 *Kontak Admin:* Melalui kontak resmi desa\n\n` +
                               `_Terima kasih atas pengertian Anda_`;
        return { text: spamBlockMessage };
      }
      
      // Peringatan jika mendekati batas spam (3-4 pesan dalam 5 detik)
      if (spamCount >= 3) {
        const warningMessage = `⚠️ *PERINGATAN SPAM*\n\n` +
                             `📊 Anda telah mengirim ${spamCount} pesan dalam 5 detik terakhir\n\n` +
                             `🚫 *Batas:* Maksimal 5 pesan dalam 5 detik\n\n` +
                             `💡 *Saran:* Kirim pesan dengan lebih perlahan untuk menghindari pemblokiran\n\n` +
                             `_Sistem anti-spam aktif untuk menjaga kualitas layanan_`;
        
        // Kirim peringatan tapi tetap proses pesan
        await sock.sendMessage(msg.key.remoteJid, { text: warningMessage });
      }
    }
    
    // ===== FILTER KATA KASAR =====
    if (!isAdmin) {
      // Cek kata tidak pantas tanpa logging
      const profanityCheck = profanityFilter.containsProfanity(messageContent, true);
      if (profanityCheck.found) {
        const warningMessage = `🚫 *PERINGATAN: KATA TIDAK PANTAS TERDETEKSI*\n\n` +
                              `⚠️ Pesan Anda mengandung kata yang tidak pantas: "${profanityCheck.word}"\n\n` +
                              `📋 *Aturan Penggunaan Bot:*\n` +
                              `• Gunakan bahasa yang sopan dan santun\n` +
                              `• Hindari kata-kata kasar, SARA, atau tidak pantas\n` +
                              `• Hormati sesama pengguna layanan\n\n` +
                              `💡 *Saran:* Silakan kirim ulang pesan dengan bahasa yang lebih sopan\n\n` +
                              `🔄 *Pesan yang disarankan:* Ganti "${profanityCheck.word}" dengan kata yang lebih pantas\n\n` +
                              `_Sistem filter aktif untuk menjaga kenyamanan bersama_`;
        
        
        return { text: warningMessage };
      }
    }
    
    // Cek limit harian dan per jam untuk user biasa (bukan admin)
    if (!isAdmin) {
      // Cek limit harian
      const dailyLimit = unifiedModel.checkDailyLimit(senderId, 50, false);
      if (!dailyLimit.canProceed) {
        const limitMessage = `⚠️ *LIMIT HARIAN TERCAPAI*\n\n`;
        limitMessage += `📊 Anda telah mencapai batas maksimal **50 interaksi per hari**\n\n`;
        limitMessage += `🔄 *Reset Otomatis:* Besok pukul 00:00 WIB\n\n`;
        limitMessage += `💡 *Saran:* Gunakan fitur pencarian yang lebih spesifik atau hubungi admin desa untuk bantuan mendesak\n\n`;
        limitMessage += `📞 *Kontak Darurat:*\n• Polsek: 110\n• Pemadam: 113\n• Ambulans: 118\n\n`;
        limitMessage += `_Terima kasih atas pengertian Anda_`;
        return { text: limitMessage };
      }
      
      // Cek limit per jam
      const hourlyLimit = unifiedModel.checkHourlyLimit(senderId, 20, false);
      if (!hourlyLimit.canProceed) {
        const hourlyLimitMessage = `⏰ *LIMIT PER JAM TERCAPAI*\n\n`;
        hourlyLimitMessage += `📊 Anda telah mencapai batas maksimal **20 interaksi per jam**\n\n`;
        hourlyLimitMessage += `🔄 *Reset Otomatis:* Pukul ${hourlyLimit.resetTime} WIB\n\n`;
        hourlyLimitMessage += `💡 *Saran:* Silakan tunggu beberapa saat atau gunakan waktu istirahat untuk memikirkan pertanyaan yang lebih spesifik\n\n`;
        hourlyLimitMessage += `📞 *Kontak Darurat:*\n• Polsek: 110\n• Pemadam: 113\n• Ambulans: 118\n\n`;
        hourlyLimitMessage += `_Sistem ini dibuat untuk memberikan layanan yang adil bagi semua warga_`;
        return { text: hourlyLimitMessage };
      }
    }
    
    // Dapatkan chat memory
    let chatMemory = await unifiedModel.getChatMemoryByUserId(senderId)[0];
    let context = chatMemory ? JSON.parse(chatMemory.context || '{}') : {};

    // Normalisasi pesan singkat
    const cleanedMessage = (messageContent || '').trim();

    // ADMIN COMMANDS - Deteksi semua perintah admin dengan awalan !
    if (cleanedMessage.startsWith('!')) {
      const result = await adminCommandController.handleAdminCommand(
        models, 
        senderId, 
        cleanedMessage, 
        sock, 
        context
      );
      
      // Update context jika ada perubahan
      if (result.context) {
        Object.assign(context, result.context);
      }
      
      // Simpan chat memory
      await saveChatMemory(unifiedModel, senderId, messageContent, result.response, context);
      
      return result.response;
    }

    // Cek apakah pesan adalah ID angka (navigasi user)
    if (/^[1-7]$/.test(cleanedMessage)) {
      // Gunakan ID Menu System yang baru untuk menu utama (1-7)
      const menuResponse = await idMenuController.handleMenuRequest(cleanedMessage, models);
      await saveChatMemory(unifiedModel, senderId, messageContent, menuResponse.text, context);
      return menuResponse;
    }
    
    // Cek apakah pesan adalah ID submenu (contoh: 1A-7E)
    if (/^[1-7][A-E]$/i.test(cleanedMessage)) {
      // Gunakan ID Menu System yang baru untuk sub-menu (1A-7E)
      const menuResponse = await idMenuController.handleMenuRequest(cleanedMessage.toUpperCase(), models);
      await saveChatMemory(unifiedModel, senderId, messageContent, menuResponse.text, context);
      return menuResponse;
    }


    
    // Cek apakah pesan adalah perintah reset atau menu
    if (cleanedMessage.toLowerCase() === 'reset' || cleanedMessage.toLowerCase() === 'menu') {
      // Reset context
      context = {};
      
      // Gunakan ID Menu System yang baru
      const menuResponse = await idMenuController.handleMenuRequest('menu', models);
      await saveChatMemory(unifiedModel, senderId, messageContent, menuResponse.text, context);
      return menuResponse;
    }
    
    // Cek apakah ada context form pengaduan
    if (context.complaint_form) {
      // Proses pengaduan
      const result = await processComplaintSubmission(unifiedModel, msg, sock, unifiedModel);
      
      // Reset context setelah pengaduan selesai
      if (result.reset) {
        context = {};
      } else {
        context = { ...context, ...result.context };
      }
      
      // Simpan chat memory
      await saveChatMemory(unifiedModel, senderId, messageContent, result.response, context);
      
      return { text: result.response };
    }
    
    // Cek apakah sedang dalam proses edit berita
    if (context.editing_news) {
      const result = await adminCommandController.handleNewsEditStep(unifiedModel, senderId, messageContent, sock, context);
      
      // Update context
      if (result.context) {
        Object.assign(context, result.context);
      }
      
      // Simpan chat memory
      await saveChatMemory(unifiedModel, senderId, messageContent, result.response, context);
      
      return result.response;
    }
    
    // Cek apakah sedang dalam proses edit layanan
    if (context.editing_layanan) {
      const result = await adminCommandController.handleLayananEditStep(unifiedModel, senderId, messageContent, sock, context);
      
      // Update context
      if (result.context) {
        Object.assign(context, result.context);
      }
      
      // Simpan chat memory
      await saveChatMemory(unifiedModel, senderId, messageContent, result.response, context);
      
      return result.response;
    }
    
    // Cek apakah ada context menu
    if (context.menu_id) {
      // Jika ada sub_menu_id, berarti user sedang melihat konten sub-menu
      if (context.sub_menu_id) {
        // Cek apakah pesan adalah perintah kembali
        if (cleanedMessage.toLowerCase() === 'kembali' || cleanedMessage === '0') {
          // Hapus sub_menu_id dari context
          delete context.sub_menu_id;
          
          // Tampilkan sub-menu
          const response = await formatSubMenuMessage(unifiedModel, context.menu_id, senderId);
          if (!response) return { text: 'Sub-menu sedang dimuat...' };
          
          // Simpan chat memory
          await saveChatMemory(unifiedModel, senderId, messageContent, response, context);
          
          return response;
        }

        // Jika user mengetik angka 1..N saat berada di tampilan konten, anggap sebagai pindah ke menu utama tersebut
        const possibleMainMenu = parseInt(cleanedMessage);
        if (!isNaN(possibleMainMenu) && possibleMainMenu > 0) {
          const menusFS = await readMenuStructure();
          const targetMenu = menusFS.find(m => m.id === possibleMainMenu);
          if (targetMenu) {
            // Pindah ke menu utama yang baru dan bersihkan sub_menu_id lama
            context.menu_id = targetMenu.id;
            delete context.sub_menu_id;

            const response = await formatSubMenuMessage(unifiedModel, targetMenu.id, senderId);
           if (!response) return { text: 'Sub-menu sedang dimuat...' };
            await saveChatMemory(unifiedModel, senderId, messageContent, response, context);
            return response;
          }
        }

        // Cek apakah input adalah format sub-menu (1A, 2B, dll) untuk pindah ke sub-menu lain
        const subMenuPattern = /^(\d)([A-Z])$/i;
        const subMenuMatch = cleanedMessage.match(subMenuPattern);
        
        if (subMenuMatch) {
          const menuId = parseInt(subMenuMatch[1]);
          const subMenuLetter = subMenuMatch[2].toUpperCase();
          
          // Update context menu_id jika berbeda
          if (menuId !== parseInt(context.menu_id)) {
            context.menu_id = menuId;
          }
          
          const response = await getSubMenuContent(unifiedModel, menuId, subMenuLetter);
          if (!response) return { text: 'Konten sedang dimuat...' };
          context.sub_menu_id = `${menuId}${subMenuLetter}`;
          await saveChatMemory(unifiedModel, senderId, messageContent, response, context);
          return response;
        }
        
        // Dukung input huruf saja (A, B, C, ...) untuk berpindah konten sub-menu pada menu aktif saat ini
        if (/^[A-Za-z]$/.test(cleanedMessage)) {
          const letterOnly = cleanedMessage.toUpperCase();
          const activeMenuId = parseInt(context.menu_id);
          const response = await getSubMenuContent(unifiedModel, activeMenuId, letterOnly);
          context.sub_menu_id = `${activeMenuId}${letterOnly}`;
          await saveChatMemory(unifiedModel, senderId, messageContent, response, context);
          return response;
        }
        
        // Jika bukan perintah kembali, tampilkan pesan bantuan
        const response = 'Ketik kembali atau 0 untuk kembali ke menu sebelumnya, atau ketik menu untuk kembali ke menu utama.';
        
        // Simpan chat memory
        await saveChatMemory(unifiedModel, senderId, messageContent, response, context);
        
        return response;
      }
      
      // Jika tidak ada sub_menu_id, berarti user sedang melihat sub-menu
      // Cek apakah pesan adalah perintah kembali
      if (cleanedMessage.toLowerCase() === 'kembali' || cleanedMessage === '0') {
        // Hapus menu_id dari context
        delete context.menu_id;
        
        // Tampilkan menu utama
        const response = await formatMenuMessage(unifiedModel);
         if (!response) return { text: 'Menu sedang dimuat...' };
        
        // Simpan chat memory
        await saveChatMemory(unifiedModel, senderId, messageContent, response, context);
        
        return response;
      }

      // Validasi input tidak valid di awal (seperti 2AB, 12A, ABC123, dll)
      if (/^\d{2,}[A-Z]|^\d+[A-Z]{2,}|^[A-Z]{2,}\d*$/i.test(cleanedMessage)) {
        // Input tidak valid, kembali ke menu utama
        // Reset context dan kembali ke menu utama
        const newContext = { user_id: senderId };
        const menuResponse = await formatMenuMessage(unifiedModel);
       const response = `Input "${cleanedMessage}" tidak valid.\n\n` + (menuResponse ? menuResponse.text : 'Menu sedang dimuat...');
        await saveChatMemory(unifiedModel, senderId, messageContent, response, newContext);
        return response;
      }

      // Navigasi cepat ke menu utama lain dengan mengetik angka (mis. 2 untuk Menu 2) saat berada di daftar sub-menu
      const maybeMenuId = parseInt(cleanedMessage);
      if (!isNaN(maybeMenuId) && maybeMenuId > 0) {
        const menusFS = await readMenuStructure();
        const targetMenu = menusFS.find(m => m.id === maybeMenuId);
        // Jika angka yang diketik adalah ID menu utama yang berbeda dari menu aktif, pindahkan ke menu tersebut
        if (targetMenu && maybeMenuId !== parseInt(context.menu_id)) {
          context.menu_id = targetMenu.id;
          // Pastikan sub_menu_id lama memang tidak ada di state daftar sub-menu, tapi bersihkan untuk aman
          delete context.sub_menu_id;

          const response = await formatSubMenuMessage(unifiedModel, targetMenu.id);
          await saveChatMemory(unifiedModel, senderId, messageContent, response, context);
          return response;
        }
      }
      
      // Validasi input tidak valid (seperti 2AB, 12A, dll)
      if (/^\d{2,}[A-Z]|^\d+[A-Z]{2,}$/i.test(cleanedMessage)) {
        // Input tidak valid, kembali ke menu utama
        // Reset context dan kembali ke menu utama
        const newContext = { user_id: senderId };
        const response = await formatMenuMessage(unifiedModel);
        await saveChatMemory(unifiedModel, senderId, messageContent, response, newContext);
        return response;
      }
      


      // Dukung input huruf saja (A, B, C, ...) untuk memilih sub-menu pada menu aktif saat ini
      if (/^[A-Za-z]$/.test(cleanedMessage)) {
        const letterOnly = cleanedMessage.toUpperCase();
        const currentMenuId = parseInt(context.menu_id);
        // Memilih sub-menu dengan huruf
        const response = await getSubMenuContent(unifiedModel, currentMenuId, letterOnly);
        context.sub_menu_id = `${currentMenuId}${letterOnly}`;
        await saveChatMemory(unifiedModel, senderId, messageContent, response, context);
        return response;
      }
      
      // Cek apakah pesan adalah nomor sub-menu (format lama: 1, 2, 3)
      const subMenuNumber = parseInt(cleanedMessage);
      if (!isNaN(subMenuNumber) && subMenuNumber > 0) {
        // Ambil sub-menu dari struktur filesystem agar konsisten (termasuk virtual 4E/4F/4G)
        const menusFS = await readMenuStructure();
        const current = menusFS.find(m => m.id === parseInt(context.menu_id));
        if (current) {
          const subMenus = current.subMenus || [];
          if (subMenuNumber <= subMenus.length) {
            const subMenu = subMenus[subMenuNumber - 1];
            const letter = String(subMenu.letter || '').toUpperCase();
            // Tambahkan sub_menu_id ke context
            context.sub_menu_id = `${current.id}${letter}`;
            // Dapatkan konten sub-menu
            const response = await getSubMenuContent(unifiedModel, current.id, letter);
            // Simpan chat memory
            await saveChatMemory(unifiedModel, senderId, messageContent, response, context);
            // Log untuk debugging
            // Mengakses sub-menu numeric
            return response;
          }
        }
      }
      
      // Jika input tidak valid atau tidak dikenali, kembali ke menu utama
      // Input tidak dikenali, kembali ke menu utama
      const newContext = { user_id: senderId };
      const menuResponse = await formatMenuMessage(unifiedModel);
        const response = `Input "${cleanedMessage}" tidak valid.\n\n` + (menuResponse ? menuResponse.text : 'Menu sedang dimuat...');
      
      // Simpan chat memory dengan context baru
      await saveChatMemory(unifiedModel, senderId, messageContent, response, newContext);
      
      return response;
    }
    
    // Jika tidak ada context, cek apakah pesan adalah nomor menu
    const menuNumber = parseInt(cleanedMessage);
    if (!isNaN(menuNumber) && menuNumber > 0) {
      // Dapatkan menu berdasarkan nomor dari filesystem agar selalu 6 menu utama
      const menusFS = await readMenuStructure();
      
      // Cek apakah nomor menu valid
      if (menuNumber <= menusFS.length) {
        const menu = menusFS[menuNumber - 1];
        
        // Tambahkan menu_id ke context dan pastikan sub_menu_id lama dibersihkan
        context.menu_id = menu.id;
        delete context.sub_menu_id;
        
        // Tampilkan sub-menu
        const response = await formatSubMenuMessage(unifiedModel, menu.id, senderId);
        if (!response) return { text: 'Sub-menu sedang dimuat...' };
        
        // Simpan chat memory
        await saveChatMemory(unifiedModel, senderId, messageContent, response, context);
        
        return response;
      }
    }
    
    // Cek apakah pesan dimulai dengan 'pengaduan' (format baru)
    if (cleanedMessage.toLowerCase().startsWith('pengaduan')) {
      // Proses pengaduan langsung
      const result = await processComplaintSubmission(unifiedModel, msg, sock, unifiedModel);
      
      // Simpan chat memory
      await saveChatMemory(unifiedModel, senderId, messageContent, result.response, {});
      
      return { text: result.response };
    }
    
    // Cek apakah pesan adalah kata kunci pengaduan lama (untuk backward compatibility)
    if (cleanedMessage.toLowerCase().includes('keluhan') || 
        cleanedMessage.toLowerCase().includes('lapor')) {
      
      // Set context untuk form pengaduan
      context.complaint_form = {
        step: 'form',
        data: {}
      };
      
      // Tampilkan form pengaduan
      const response = formatComplaintForm();
      
      // Simpan chat memory
      await saveChatMemory(unifiedModel, senderId, messageContent, response.text, context);
      
      return response;
    }
    
    // Cek apakah pesan adalah perintah UMKM
    const umkmKeywords = ['daftar umkm', 'list umkm', 'kategori umkm', 'kategori', 'umkm'];
    const isUMKMCommand = umkmKeywords.some(keyword => 
      cleanedMessage.toLowerCase().includes(keyword) || 
      cleanedMessage.toLowerCase().startsWith('umkm ') ||
      cleanedMessage.toLowerCase().startsWith('cari umkm')
    );
    
    if (isUMKMCommand) {
      try {
        const { handleUMKMCommand } = require('./src/controllers/umkmController');
        const response = await handleUMKMCommand(cleanedMessage, senderId);
        
        // Simpan chat memory
        await saveChatMemory(unifiedModel, senderId, messageContent, response.text, context);
        
        return response;
      } catch (umkmError) {
        console.error('Error handling UMKM command:', umkmError.message);
        const errorResponse = {
          text: '❌ *Terjadi kesalahan saat memproses perintah UMKM*\n\n' +
                '🔄 Silakan coba lagi atau ketik "menu" untuk kembali ke menu utama.\n\n' +
                '─'.repeat(35) + '\n_Dibuat oleh Mahasiswa UMSU_'
        };
        
        await saveChatMemory(unifiedModel, senderId, messageContent, errorResponse.text, context);
        return errorResponse;
      }
    }
    
    // Cek apakah pesan adalah perintah pencarian berita
    const newsKeywords = ['berita', 'cari berita', 'kategori berita', 'berita terbaru', 'daftar berita'];
    const isNewsCommand = newsKeywords.some(keyword => 
      cleanedMessage.toLowerCase().includes(keyword) || 
      cleanedMessage.toLowerCase().startsWith('berita ') ||
      cleanedMessage.toLowerCase().startsWith('cari berita')
    );
    
    if (isNewsCommand) {
      try {
        const newsSearchController = new NewsSearchController();
        const response = newsSearchController.handleNewsCommand(cleanedMessage);
        
        // Simpan chat memory
        await saveChatMemory(unifiedModel, senderId, messageContent, response.text, context);
        
        return response;
      } catch (newsError) {
        console.error('Error handling news command:', newsError.message);
        const errorResponse = {
          text: '❌ *Terjadi kesalahan saat memproses perintah berita*\n\n' +
                '🔄 Silakan coba lagi atau ketik "menu" untuk kembali ke menu utama.'
        };
        
        await saveChatMemory(unifiedModel, senderId, messageContent, errorResponse.text, context);
        return errorResponse;
      }
    }
    
    // Jika tidak ada yang cocok, tampilkan pesan bantuan dan menu utama
    const invalidInputMessage = `❌ *Input Tidak Dikenali*\n\nMaaf, pesan "${cleanedMessage}" tidak dapat diproses.\n\n🔍 *Saran:*\n• Ketik *menu* untuk melihat daftar layanan\n• Gunakan kode menu (contoh: 1A, 2B)\n• Ketik *reset* untuk kembali ke awal\n• Gunakan kata kunci: pengaduan, layanan, info\n\n📋 *Menu Layanan:*\n\n`;
    
    const menuResponse = await formatMenuMessage(unifiedModel);
    const fullResponse = invalidInputMessage + (menuResponse ? menuResponse.text : 'Menu sedang dimuat...');
    
    await saveChatMemory(unifiedModel, senderId, messageContent, fullResponse, context);
    return { text: fullResponse };
  } catch (error) {
    console.error('Error dalam handleMessage:', error.message);
    return { text: 'Maaf, terjadi kesalahan. Silakan coba lagi.' };
  }
};

// Fungsi untuk menyimpan chat memory
const saveChatMemory = async (unifiedModel, userId, message, response, context) => {
  try {
    const respText = typeof response === 'string' ? response : (response && response.text) ? response.text : '';
    await unifiedModel.addChatMemory({
      user_id: userId,
      context: JSON.stringify({
        ...(context || {}),
        lastMessage: message,
        lastResponse: respText
      })
    });
  } catch (err) {
    console.error('Gagal menyimpan chat memory:', err.message);
  }
};

// Fungsi untuk menangani navigasi menu user dengan ID
const handleUserMenuNavigation = async (models, senderId, menuId, sock, context) => {
  try {
    // Menu ID 0 = kembali ke menu utama
    if (menuId === 0) {
      const menuResponse = await formatMenuMessage(unifiedModel);
      if (!menuResponse) return { text: 'Menu sedang dimuat...' };
      context = {}; // Reset context
      await saveChatMemory(unifiedModel, senderId, '0', menuResponse, context);
      return menuResponse;
    }
    
    // Validasi menu ID (1-6)
    if (menuId < 1 || menuId > 6) {
      const menuResponse = await formatMenuMessage(unifiedModel);
      const errorMsg = `❌ *ID Menu Tidak Valid*\n\nID menu harus antara 1-6.\n\n${menuResponse ? menuResponse.text : 'Menu sedang dimuat...'}`;
      await saveChatMemory(unifiedModel, senderId, menuId.toString(), { text: errorMsg }, {});
      return { text: errorMsg };
    }
    
    // Tampilkan submenu berdasarkan ID
    const subMenuResponse = await formatSubMenuMessage(unifiedModel, menuId, senderId);
    if (!subMenuResponse) return { text: 'Sub-menu sedang dimuat...' };
    context.current_menu = menuId;
    await saveChatMemory(unifiedModel, senderId, menuId.toString(), subMenuResponse, context);
    return subMenuResponse;
    
  } catch (error) {
    console.error('Error handling user menu navigation:', error.message);
    const menuResponse = await formatMenuMessage(unifiedModel);
    return menuResponse || { text: 'Menu sedang dimuat...' };
  }
};

// Fungsi untuk menangani navigasi submenu user dengan ID
const handleUserSubMenuNavigation = async (models, senderId, menuId, subMenuLetter, sock, context) => {
  try {
    // Validasi menu ID (1-6)
    if (menuId < 1 || menuId > 6) {
      const menuResponse = await formatMenuMessage(unifiedModel);
      const errorMsg = `❌ *ID Menu Tidak Valid*\n\nID menu harus antara 1-6.\n\n${menuResponse ? menuResponse.text : 'Menu sedang dimuat...'}`;
      await saveChatMemory(unifiedModel, senderId, `${menuId}${subMenuLetter}`, { text: errorMsg }, {});
      return { text: errorMsg };
    }
    
    // Dapatkan konten submenu
    const subMenuContent = await getSubMenuContent(unifiedModel, menuId, subMenuLetter);
    if (!subMenuContent) return { text: 'Konten sedang dimuat...' };
    context.current_menu = menuId;
    context.current_submenu = subMenuLetter;
    await saveChatMemory(unifiedModel, senderId, `${menuId}${subMenuLetter}`, subMenuContent, context);
    return subMenuContent;
    
  } catch (error) {
    console.error('Error handling user submenu navigation:', error.message);
    const menuResponse = await formatMenuMessage(unifiedModel);
    return menuResponse || { text: 'Menu sedang dimuat...' };
  }
};

// Fungsi untuk menangani perintah !admin
const handleAdminCommand = async (models, senderId, sock, context) => {
  try {
    // Cek apakah nomor WhatsApp adalah admin
    const admin = await unifiedModel.getAdminByPhoneNumber(senderId);
    
    if (!admin || !admin.is_active) {
      return {
        text: '❌ *Akses Ditolak*\n\nAnda tidak memiliki akses admin atau akun admin tidak aktif.\n\n📞 Hubungi super admin untuk mendapatkan akses.'
      };
    }
    
    // Set mode admin dalam context
    context.admin_mode = true;
    context.admin_id = admin.id;
    context.admin_role = admin.role;
    
    // Tampilkan menu admin
    const adminMenuText = formatAdminMenu(admin);
    
    // Simpan context admin
    await saveChatMemory(unifiedModel, senderId, '!admin', adminMenuText, context);
    
    return { text: adminMenuText };
  } catch (error) {
    console.error('Error handling admin command:', error.message);
    return { text: 'Terjadi kesalahan saat mengakses menu admin.' };
  }
};

// Fungsi untuk memformat menu admin
const formatAdminMenu = (admin) => {
  let menu = `🔐 *MENU ADMIN DESA PULOSAROK* 🔐\n`;
  menu += `═`.repeat(40) + '\n\n';
  menu += `👤 *Admin:* ${admin.username}\n`;
  menu += `📱 *Role:* ${admin.role.toUpperCase()}\n`;
  menu += `📞 *Phone:* ${admin.phone_number}\n\n`;
  
  menu += `🎯 *PERINTAH ADMIN UTAMA:*\n`;
  menu += `• Ketik *!admin* - Akses menu admin\n`;
  menu += `• Ketik *!menu* - Kembali ke menu publik\n`;
  menu += `• Ketik *!reset* - Reset semua sesi\n\n`;
  
  menu += `📋 *MENU ADMIN:*\n\n`;
  
  menu += `1️⃣ *Kelola Konten Menu*\n`;
  menu += `   • Edit konten layanan\n`;
  menu += `   • Update informasi desa\n`;
  menu += `   • Kelola file dan dokumen\n\n`;
  
  menu += `2️⃣ *Kelola Pengaduan*\n`;
  menu += `   • Lihat pengaduan masuk\n`;
  menu += `   • Respon pengaduan\n`;
  menu += `   • Status pengaduan\n\n`;
  
  menu += `3️⃣ *Kelola Admin*\n`;
  menu += `   • Tambah admin baru\n`;
  menu += `   • Edit data admin\n`;
  menu += `   • Kelola hak akses\n\n`;
  
  menu += `4️⃣ *Statistik & Laporan*\n`;
  menu += `   • Statistik penggunaan\n`;
  menu += `   • Laporan pengaduan\n`;
  menu += `   • Data pengguna aktif\n\n`;
  
  menu += `5️⃣ *Pengaturan Sistem*\n`;
  menu += `   • Backup database\n`;
  menu += `   • Pengaturan bot\n`;
  menu += `   • Maintenance mode\n\n`;
  
  menu += `0️⃣ *Keluar dari Admin*\n\n`;
  
  menu += `─`.repeat(40) + '\n';
  menu += `💡 *PANDUAN PENGGUNAAN:*\n\n`;
  
  menu += `🔹 *Navigasi Menu:*\n`;
  menu += `   • Ketik angka menu (1-5) untuk masuk submenu\n`;
  menu += `   • Ketik 0 untuk keluar dari mode admin\n`;
  menu += `   • Ketik !admin kapan saja untuk kembali ke menu ini\n\n`;
  
  menu += `🔹 *Perintah Khusus:*\n`;
  menu += `   • !admin = Akses menu admin (dari mana saja)\n`;
  menu += `   • !menu = Kembali ke layanan publik\n`;
  menu += `   • !reset = Reset semua sesi dan context\n\n`;
  
  menu += `🔹 *Tips Penggunaan:*\n`;
  menu += `   • Semua perintah admin dimulai dengan tanda !\n`;
  menu += `   • Gunakan angka untuk navigasi dalam menu\n`;
  menu += `   • Selalu ketik 0 untuk kembali ke menu sebelumnya\n\n`;
  
  menu += `⚠️ *PERINGATAN KEAMANAN:*\n`;
  menu += `• Jangan bagikan akses admin kepada orang lain\n`;
  menu += `• Selalu logout setelah selesai menggunakan\n`;
  menu += `• Gunakan fitur admin dengan bijak dan bertanggung jawab\n\n`;
  
  menu += `_🏛️ Sistem Admin - Desa Pulosarok_\n`;
  menu += `_Versi 2.0 - Enhanced Admin Interface_\n`;
  menu += `_Dibuat oleh Mahasiswa UMSU_`;
  
  return menu;
};

// Fungsi untuk menangani navigasi menu admin
const handleAdminMenu = async (models, senderId, message, sock, context) => {
  try {
    const cleanedMessage = message.trim();
    
    // Keluar dari mode admin
    if (cleanedMessage === '0' || cleanedMessage.toLowerCase() === 'keluar') {
      delete context.admin_mode;
      delete context.admin_id;
      delete context.admin_role;
      
      const response = '✅ *Keluar dari Mode Admin*\n\nAnda telah keluar dari mode admin.\n\nKetik *menu* untuk kembali ke layanan publik atau *!admin* untuk masuk kembali ke mode admin.';
      await saveChatMemory(unifiedModel, senderId, message, response, context);
      return { text: response };
    }
    
    // Menu 1: Kelola Konten Menu
    if (cleanedMessage === '1') {
      context.admin_submenu = 'content';
      const response = `📝 *KELOLA KONTEN MENU*\n\n` +
        `Pilih menu yang ingin diedit:\n\n` +
        `1A. Administrasi Kependudukan\n` +
        `2A. Perizinan\n` +
        `3A. Kesehatan\n` +
        `4A. Informasi Desa\n` +
        `5A. Pengaduan\n` +
        `6A. Aduan Layanan\n\n` +
        `Ketik kode menu (contoh: 1A) atau ketik 0 untuk kembali.`;
      
      await saveChatMemory(unifiedModel, senderId, message, response, context);
      return { text: response };
    }
    
    // Menu 2: Kelola Pengaduan
    if (cleanedMessage === '2') {
      context.admin_submenu = 'complaints';
      const response = `📋 *KELOLA PENGADUAN*\n\n` +
        `1. Lihat Pengaduan Baru\n` +
        `2. Lihat Semua Pengaduan\n` +
        `3. Pengaduan Selesai\n` +
        `4. Statistik Pengaduan\n\n` +
        `Ketik nomor pilihan atau 0 untuk kembali.`;
      
      await saveChatMemory(unifiedModel, senderId, message, response, context);
      return { text: response };
    }
    
    // Menu 3: Kelola Admin
    if (cleanedMessage === '3') {
      context.admin_submenu = 'admin_management';
      const response = `👥 *KELOLA ADMIN*\n\n` +
        `1. Lihat Semua Admin\n` +
        `2. Tambah Admin Baru\n` +
        `3. Edit Admin\n` +
        `4. Nonaktifkan Admin\n\n` +
        `Ketik nomor pilihan atau 0 untuk kembali.`;
      
      await saveChatMemory(unifiedModel, senderId, message, response, context);
      return { text: response };
    }
    
    // Menu 4: Statistik & Laporan
    if (cleanedMessage === '4') {
      context.admin_submenu = 'statistics';
      const response = `📊 *STATISTIK & LAPORAN*\n\n` +
        `1. Statistik Pengguna Harian\n` +
        `2. Statistik Menu Populer\n` +
        `3. Laporan Pengaduan Bulanan\n` +
        `4. Export Data\n\n` +
        `Ketik nomor pilihan atau 0 untuk kembali.`;
      
      await saveChatMemory(unifiedModel, senderId, message, response, context);
      return { text: response };
    }
    
    // Menu 5: Pengaturan Sistem
    if (cleanedMessage === '5') {
      context.admin_submenu = 'settings';
      const response = `⚙️ *PENGATURAN SISTEM*\n\n` +
        `1. Backup Database\n` +
        `2. Pengaturan Bot\n` +
        `3. Maintenance Mode\n` +
        `4. Log Sistem\n\n` +
        `Ketik nomor pilihan atau 0 untuk kembali.`;
      
      await saveChatMemory(unifiedModel, senderId, message, response, context);
      return { text: response };
    }
    
    // Handle submenu navigation
    if (context.admin_submenu) {
      return await handleAdminSubmenu(unifiedModel, senderId, message, sock, context);
    }
    
    // Pesan tidak dikenali dalam mode admin
    const admin = await unifiedModel.getAdminByPhoneNumber(senderId);
    let response = `❌ *Perintah Tidak Dikenali: "${message}"*\n\n`;
    response += `🔍 *Perintah yang tersedia:*\n`;
    response += `• Ketik angka 1-5 untuk memilih menu\n`;
    response += `• Ketik 0 untuk keluar dari mode admin\n`;
    response += `• Ketik !admin untuk refresh menu admin\n`;
    response += `• Ketik !menu untuk kembali ke layanan publik\n`;
    response += `• Ketik !reset untuk reset semua sesi\n\n`;
    response += `─`.repeat(40) + '\n\n';
    response += formatAdminMenu(admin);
    
    await saveChatMemory(unifiedModel, senderId, message, response, context);
    return { text: response };
  } catch (error) {
    console.error('Error handling admin menu:', error.message);
    return { text: 'Terjadi kesalahan dalam menu admin.\n\nDibuat oleh Mahasiswa UMSU' };
  }
};

// Fungsi untuk menangani submenu admin
const handleAdminSubmenu = async (models, senderId, message, sock, context) => {
  try {
    const cleanedMessage = message.trim();
    
    // Kembali ke menu admin utama
    if (cleanedMessage === '0') {
      delete context.admin_submenu;
      const admin = await unifiedModel.getAdminByPhoneNumber(senderId);
      const response = formatAdminMenu(admin);
      await saveChatMemory(unifiedModel, senderId, message, response, context);
      return { text: response };
    }
    
    // Handle berdasarkan submenu aktif
    switch (context.admin_submenu) {
      case 'content':
        return await handleContentManagement(unifiedModel, senderId, message, context);
      case 'complaints':
        return await handleComplaintManagement(unifiedModel, senderId, message, context);
      case 'admin_management':
        return await handleAdminManagement(unifiedModel, senderId, message, context);
      case 'statistics':
        return await handleStatistics(unifiedModel, senderId, message, context);
      case 'settings':
        return await handleSettings(unifiedModel, senderId, message, context);
      default:
        return { text: 'Submenu tidak dikenali.\n\nDibuat oleh Mahasiswa UMSU' };
    }
  } catch (error) {
    console.error('Error handling admin submenu:', error.message);
    return { text: 'Terjadi kesalahan dalam submenu admin.\n\nDibuat oleh Mahasiswa UMSU' };
  }
};

// Placeholder functions untuk submenu admin
const handleContentManagement = async (models, senderId, message, context) => {
  const response = `🚧 *KELOLA KONTEN MENU*\n\n` +
    `Fitur ini sedang dalam pengembangan dan akan segera tersedia.\n\n` +
    `📋 *Fitur yang akan tersedia:*\n` +
    `• Edit konten layanan administrasi\n` +
    `• Update informasi desa\n` +
    `• Kelola file dan dokumen\n` +
    `• Upload gambar dan media\n\n` +
    `💡 *Navigasi:*\n` +
    `• Ketik 0 untuk kembali ke menu admin\n` +
    `• Ketik !admin untuk refresh menu admin\n` +
    `• Ketik !menu untuk kembali ke layanan publik`;
  
  await saveChatMemory(unifiedModel, senderId, message, response, context);
  return { text: response };
};

const handleComplaintManagement = async (models, senderId, message, context) => {
  const response = `📋 *KELOLA PENGADUAN*\n\n` +
    `Fitur ini sedang dalam pengembangan dan akan segera tersedia.\n\n` +
    `📋 *Fitur yang akan tersedia:*\n` +
    `• Lihat pengaduan masuk\n` +
    `• Respon pengaduan warga\n` +
    `• Update status pengaduan\n` +
    `• Statistik pengaduan\n\n` +
    `💡 *Navigasi:*\n` +
    `• Ketik 0 untuk kembali ke menu admin\n` +
    `• Ketik !admin untuk refresh menu admin\n` +
    `• Ketik !menu untuk kembali ke layanan publik`;
  
  await saveChatMemory(unifiedModel, senderId, message, response, context);
  return { text: response };
};

const handleAdminManagement = async (models, senderId, message, context) => {
  const response = `👥 *KELOLA ADMIN*\n\n` +
    `Fitur ini sedang dalam pengembangan dan akan segera tersedia.\n\n` +
    `📋 *Fitur yang akan tersedia:*\n` +
    `• Lihat semua admin\n` +
    `• Tambah admin baru\n` +
    `• Edit data admin\n` +
    `• Kelola hak akses\n\n` +
    `💡 *Navigasi:*\n` +
    `• Ketik 0 untuk kembali ke menu admin\n` +
    `• Ketik !admin untuk refresh menu admin\n` +
    `• Ketik !menu untuk kembali ke layanan publik`;
  
  await saveChatMemory(unifiedModel, senderId, message, response, context);
  return { text: response };
};

const handleStatistics = async (models, senderId, message, context) => {
  const response = `📊 *STATISTIK & LAPORAN*\n\n` +
    `Fitur ini sedang dalam pengembangan dan akan segera tersedia.\n\n` +
    `📋 *Fitur yang akan tersedia:*\n` +
    `• Statistik pengguna harian\n` +
    `• Statistik menu populer\n` +
    `• Laporan pengaduan bulanan\n` +
    `• Export data sistem\n\n` +
    `💡 *Navigasi:*\n` +
    `• Ketik 0 untuk kembali ke menu admin\n` +
    `• Ketik !admin untuk refresh menu admin\n` +
    `• Ketik !menu untuk kembali ke layanan publik`;
  
  await saveChatMemory(unifiedModel, senderId, message, response, context);
  return { text: response };
};

const handleSettings = async (models, senderId, message, context) => {
  const response = `⚙️ *PENGATURAN SISTEM*\n\n` +
    `Fitur ini sedang dalam pengembangan dan akan segera tersedia.\n\n` +
    `📋 *Fitur yang akan tersedia:*\n` +
    `• Backup database\n` +
    `• Pengaturan bot WhatsApp\n` +
    `• Mode maintenance\n` +
    `• Log sistem\n\n` +
    `💡 *Navigasi:*\n` +
    `• Ketik 0 untuk kembali ke menu admin\n` +
    `• Ketik !admin untuk refresh menu admin\n` +
    `• Ketik !menu untuk kembali ke layanan publik`;
  
  await saveChatMemory(unifiedModel, senderId, message, response, context);
  return { text: response };
};



// Fungsi placeholder telah dipindahkan ke atas

// Fungsi untuk menjalankan bot
const startBot = async () => {
  try {
    // Inisialisasi database SQLite
    if (!db) {
      console.log('Initializing SQLite database...');
      const { initDatabaseAndTables } = require('./src/database/initSQLiteDb');
      db = initDatabaseAndTables();
      console.log('SQLite database initialized successfully');
      
      // Inisialisasi unified model
      console.log('Menginisialisasi unified model...');
      unifiedModel = new UnifiedModel(db);
      console.log('✅ Unified model initialized successfully');
      
      // Inisialisasi TXT Menu Controller
      console.log('Initializing TXT Menu System...');
      global.txtMenuController = new TxtMenuController();
      await global.txtMenuController.initialize();
      console.log('✅ TXT Menu System initialized successfully');
    }
    
    // Hubungkan ke WhatsApp dengan placeholder handler
    console.log('Connecting to WhatsApp...');
    let mlSocket = null;
    
    const originalSock = await connectToWhatsApp(async (sock, msg) => {
      // Placeholder handler - akan diganti dengan handler yang sebenarnya
      console.log('📨 Message received in placeholder handler');
    });
    
    // Use original socket directly
    mlSocket = originalSock;
    
    // Setup event handler yang sebenarnya dengan ML-wrapped socket
    mlSocket.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return; // Abaikan pesan dari diri sendiri
      
      // Basic message processing
      const messageContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      const senderId = msg.key.remoteJid.split('@')[0];
      
      try {
        // Buat objek models untuk handleMessage
        const models = { 
          unifiedModel,
          complaint: unifiedModel // UnifiedModel memiliki method getAllComplaints
        };
        
        // Dapatkan respons dari controller
        const response = await handleMessage(models, msg, mlSocket);
        
        // Kirim respons
        if (response) {
          // Pastikan respons dalam format yang benar untuk WhatsApp
          let messageContent;
          
          if (typeof response === 'string') {
            messageContent = { text: response };
          } else if (response.text) {
            messageContent = { text: response.text };
          } else if (typeof response === 'object') {
            // Jika respons adalah objek tapi tidak memiliki properti text, pastikan ada properti yang valid
            messageContent = { text: JSON.stringify(response) };
          } else {
            // Fallback jika respons tidak dalam format yang diharapkan
            messageContent = { text: 'Respons tidak valid\n\nDibuat oleh Mahasiswa UMSU' };
          }
          
          // Log pesan yang dikirim
          logger.logInteraction(msg.key.remoteJid, 'Bot Response', messageContent.text || JSON.stringify(messageContent));
          
          // Kirim pesan
          await mlSocket.sendMessage(msg.key.remoteJid, messageContent);
        }
      } catch (error) {
        console.error('Error processing message:', error.message);
        const errorMessage = {
          text: 'Maaf, terjadi kesalahan dalam memproses pesan Anda. Silakan coba lagi nanti.\n\nDibuat oleh Mahasiswa UMSU'
        };
        // Log pesan error
        logger.logInteraction(msg.key.remoteJid, 'Error Response', errorMessage.text);
        
        // Kirim pesan error
        await mlSocket.sendMessage(msg.key.remoteJid, errorMessage);
      }
    });
    
    const sock = mlSocket;
    
    // Log initialization success
    console.log('✅ Bot system initialized successfully');
    
    return sock;
  } catch (error) {
    console.error('Error starting bot:', error.message);
    throw error;
  }
};

// Jalankan bot dan setup interval cleanup
(async () => {
  try {
    const bot = await startBot();
    if (bot) {
      console.log('Bot WhatsApp berhasil dimulai');
      
      // Mulai memory monitoring untuk VPS
      if (process.env.NODE_ENV === 'production') {
        memoryMonitor.startMonitoring();
        console.log('🔍 Memory monitoring started for production');
      }
    } else {
      console.error('Gagal memulai bot WhatsApp');
    }

    // Jadwalkan pembersihan chat memory otomatis (optimized untuk VPS)
    const chatCleanupInterval = process.env.NODE_ENV === 'production' ? 3 * 60 * 1000 : 5 * 60 * 1000; // 3 menit di produksi
    setInterval(async () => {
      try {
        if (models && models.unifiedModel) {
          // Cleanup chat memory yang tidak aktif lebih dari 3 menit di produksi
          const cleanupTime = process.env.NODE_ENV === 'production' ? 0.05 : 0.0833; // 3 menit vs 5 menit
          const { cleanupInactiveMemory } = require('./src/controllers/adminCommandController');
          await cleanupInactiveMemory(models.unifiedModel, cleanupTime);
          if (process.env.NODE_ENV === 'development') {
            console.log('🧹 Chat memory cleanup completed');
          }
        }
      } catch (error) {
        console.error('Error during chat memory cleanup:', error.message);
      }
    }, chatCleanupInterval);
    
    // Jadwalkan pembersihan hourly limits yang sudah lebih dari 24 jam
    setInterval(async () => {
      try {
        if (models && models.unifiedModel) {
          await models.unifiedModel.cleanupOldHourlyLimits();
        }
      } catch (error) {
        console.error('Error during hourly limits cleanup:', error.message);
      }
    }, 60 * 60 * 1000); // 1 jam
    
    // Jadwalkan pembersihan processed messages cache (optimized untuk VPS)
    const cacheCleanupInterval = process.env.NODE_ENV === 'production' ? 5 * 60 * 1000 : 10 * 60 * 1000; // 5 menit di produksi
    setInterval(() => {
      try {
        processedMessages.clear();
        if (process.env.NODE_ENV === 'development') {
          console.log('🧹 Processed messages cache cleared');
        }
        
        // Manual garbage collection di produksi
        if (process.env.NODE_ENV === 'production' && global.gc) {
          global.gc();
        }
      } catch (error) {
        console.error('Error clearing processed messages cache:', error.message);
      }
    }, cacheCleanupInterval);
  } catch (error) {
    console.error('Error saat memulai bot WhatsApp:', error.message);
  }
})();

module.exports = {
  startBot
};