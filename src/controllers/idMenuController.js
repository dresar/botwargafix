// ID Menu Controller
// Mengelola sistem menu berbasis ID (1, 1A-1E, 2, 2A-2E, dst.)

const fs = require('fs').promises;
const path = require('path');
const { duplicateChecker } = require('../utils/duplicateChecker');

class IdMenuController {
  constructor() {
    this.menuStructurePath = path.join(__dirname, '../database/menu-structure.json');
    this.menuStructure = null;
  }

  // Load menu structure dari JSON
  async loadMenuStructure() {
    try {
      if (!this.menuStructure) {
        const data = await fs.readFile(this.menuStructurePath, 'utf8');
        this.menuStructure = JSON.parse(data);
      }
      return this.menuStructure;
    } catch (error) {
      console.error('Error loading menu structure:', error);
      throw new Error('Gagal memuat struktur menu');
    }
  }

  // Mendapatkan menu utama (1-7)
  async getMainMenu() {
    try {
      const structure = await this.loadMenuStructure();
      const mainMenus = structure.menu_structure.main_menus;
      
      let response = '🏛️ *LAYANAN DESA PULOSAROK*\n\n';
      
      mainMenus.forEach(menu => {
        response += `${menu.icon} *${menu.id}.* ${menu.title}\n`;
      });
      
      response += '\n💡 Ketik angka (1-8) atau kode (1A-8E)\n';
      response += '_Dibuat oleh Mahasiswa UMSU_';
      
      return {
        text: response
      };
    } catch (error) {
      console.error('Error getting main menu:', error);
      return {
        text: '❌ *Error*\n\nTerjadi kesalahan saat memuat menu utama.'
      };
    }
  }

  // Mendapatkan sub-menu berdasarkan ID menu utama (1-7)
  async getSubMenu(menuId) {
    try {
      const structure = await this.loadMenuStructure();
      const mainMenu = structure.menu_structure.main_menus.find(menu => menu.id === menuId);
      
      if (!mainMenu) {
        return {
          text: `❌ *Menu Tidak Ditemukan*\n\nMenu dengan ID "${menuId}" tidak tersedia.\n\nKetik *menu* untuk melihat daftar menu utama.`
        };
      }
      
      let response = `${mainMenu.icon} *${mainMenu.title}*\n\n`;
      response += `📋 *${mainMenu.description}*\n\n`;
      response += '🔽 *Pilih sub-menu:*\n\n';
      
      mainMenu.sub_menus.forEach(subMenu => {
        response += `📌 *${subMenu.id}. ${subMenu.title}*\n`;
        response += `   ${subMenu.description}\n\n`;
      });
      
      response += '⚡ *KODE AKSES CEPAT:*\n';
      response += `• Ketik ${menuId}A, ${menuId}B, ${menuId}C untuk akses langsung\n`;
      response += '• Ketik 1-7 untuk menu utama lainnya\n';
      response += '• Ketik *menu* untuk kembali ke menu utama\n\n';
      response += '💡 *Cara menggunakan:*\n';
      response += `• Ketik kode sub-menu (contoh: *${menuId}A*) untuk melihat detail\n`;
      response += '• Ketik *menu* untuk kembali ke menu utama\n\n';
      response += '═'.repeat(40) + '\n';
      response += '_Dibuat oleh Mahasiswa UMSU_';
      
      return {
        text: response
      };
    } catch (error) {
      console.error('Error getting sub menu:', error);
      return {
        text: '❌ *Error*\n\nTerjadi kesalahan saat memuat sub-menu.'
      };
    }
  }

  // Mendapatkan detail sub-menu berdasarkan ID (1A-7E)
  async getSubMenuDetail(subMenuId, models = null) {
    try {
      const structure = await this.loadMenuStructure();
      const menuId = subMenuId.charAt(0); // Ambil angka pertama (1-7)
      const subId = subMenuId.substring(1); // Ambil huruf (A-E)
      
      const mainMenu = structure.menu_structure.main_menus.find(menu => menu.id === menuId);
      if (!mainMenu) {
        return {
          text: `❌ *Menu Tidak Ditemukan*\n\nMenu dengan ID "${menuId}" tidak tersedia.`
        };
      }
      
      const subMenu = mainMenu.sub_menus.find(sub => sub.id === subMenuId);
      if (!subMenu) {
        return {
          text: `❌ *Sub-Menu Tidak Ditemukan*\n\nSub-menu dengan ID "${subMenuId}" tidak tersedia.`
        };
      }
      
      let response = `${mainMenu.icon} *${subMenu.title}*\n\n`;
      response += `📋 *Deskripsi:*\n${subMenu.description}\n\n`;
      
      // Jika ada persyaratan
      if (subMenu.requirements && subMenu.requirements.length > 0) {
        response += '📄 *Persyaratan:*\n';
        subMenu.requirements.forEach((req, index) => {
          response += `${index + 1}. ${req}\n`;
        });
        response += '\n';
      }
      
      // Jika ada prosedur
      if (subMenu.procedures && subMenu.procedures.length > 0) {
        response += '📝 *Prosedur:*\n';
        subMenu.procedures.forEach((proc, index) => {
          response += `${index + 1}. ${proc}\n`;
        });
        response += '\n';
      }
      
      // Jika ada kontak
      if (subMenu.contact && subMenu.contact.info) {
        response += `📞 *Kontak:*\n${subMenu.contact.info}\n\n`;
      }
      
      // Jika ada konten dinamis
      if (subMenu.content) {
        let content = subMenu.content;
        
        // Replace dynamic content
        if (models) {
          content = await this.replaceDynamicContent(content, models);
        }
        
        response += `📖 *Informasi:*\n${content}\n\n`;
      }
      
      response += '💡 *Navigasi:*\n';
      response += `• Ketik *${menuId}* untuk kembali ke sub-menu\n`;
      response += '• Ketik *menu* untuk kembali ke menu utama\n\n';
      response += '═'.repeat(40) + '\n';
      response += '_Dibuat oleh Mahasiswa UMSU_';
      
      // Cek duplikasi sebelum mengirim
      if (duplicateChecker.isDuplicate('system', response)) {
        console.log(`🔄 Duplicate content detected for ${subMenuId}`);
        return null;
      }
      
      return {
        text: response
      };
    } catch (error) {
      console.error('Error getting sub menu detail:', error);
      return {
        text: '❌ *Error*\n\nTerjadi kesalahan saat memuat detail sub-menu.'
      };
    }
  }

  // Replace dynamic content dengan data dari database
  async replaceDynamicContent(content, models) {
    try {
      // Replace UMKM content
      if (content.includes('{{DYNAMIC_UMKM_LIST}}')) {
        const umkmList = await this.loadUmkmList();
        content = content.replace('{{DYNAMIC_UMKM_LIST}}', umkmList);
      }
      
      if (content.includes('{{DYNAMIC_UMKM_DETAIL}}')) {
        const umkmDetail = await this.loadUmkmDetail();
        content = content.replace('{{DYNAMIC_UMKM_DETAIL}}', umkmDetail.text);
      }
      
      if (content.includes('{{DYNAMIC_UMKM_CATEGORIES}}')) {
        const umkmCategories = await this.loadUmkmCategories();
        content = content.replace('{{DYNAMIC_UMKM_CATEGORIES}}', umkmCategories);
      }
      
      if (content.includes('{{DYNAMIC_UMKM_CONTACTS}}')) {
        const umkmContacts = await this.loadUmkmContacts();
        content = content.replace('{{DYNAMIC_UMKM_CONTACTS}}', umkmContacts);
      }
      
      if (content.includes('{{DYNAMIC_UMKM_KULINER}}')) {
        const umkmKuliner = await this.getUMKMByCategory(models, 'kuliner');
        content = content.replace('{{DYNAMIC_UMKM_KULINER}}', umkmKuliner);
      }
      
      if (content.includes('{{DYNAMIC_UMKM_KERAJINAN}}')) {
        const umkmKerajinan = await this.getUMKMByCategory(models, 'kerajinan');
        content = content.replace('{{DYNAMIC_UMKM_KERAJINAN}}', umkmKerajinan);
      }
      
      if (content.includes('{{DYNAMIC_UMKM_JASA}}')) {
        const umkmJasa = await this.getUMKMByCategory(models, 'jasa');
        content = content.replace('{{DYNAMIC_UMKM_JASA}}', umkmJasa);
      }
      
      // Replace News content
      if (content.includes('{{DYNAMIC_NEWS_LIST}}')) {
        const newsList = await this.getNewsList(models);
        content = content.replace('{{DYNAMIC_NEWS_LIST}}', newsList);
      }
      
      if (content.includes('{{DYNAMIC_NEWS_PEMERINTAHAN}}')) {
        const newsGov = await this.getNewsByCategory(models, 'pemerintahan');
        content = content.replace('{{DYNAMIC_NEWS_PEMERINTAHAN}}', newsGov);
      }
      
      if (content.includes('{{DYNAMIC_NEWS_PEMBANGUNAN}}')) {
        const newsDev = await this.getNewsByCategory(models, 'pembangunan');
        content = content.replace('{{DYNAMIC_NEWS_PEMBANGUNAN}}', newsDev);
      }
      
      if (content.includes('{{DYNAMIC_NEWS_SOSIAL}}')) {
        const newsSocial = await this.getNewsByCategory(models, 'sosial');
        content = content.replace('{{DYNAMIC_NEWS_SOSIAL}}', newsSocial);
      }
      
      if (content.includes('{{DYNAMIC_NEWS_ARCHIVE}}')) {
        const newsArchive = await this.getNewsArchive(models);
        content = content.replace('{{DYNAMIC_NEWS_ARCHIVE}}', newsArchive);
      }
      
      return content;
    } catch (error) {
      console.error('Error replacing dynamic content:', error);
      return content;
    }
  }

  // Helper methods untuk mendapatkan data dinamis
  async getUMKMList(models) {
    try {
      const umkmData = await models.umkm.getAllUMKM();
      if (!umkmData || umkmData.length === 0) {
        return 'Belum ada data UMKM yang tersedia.';
      }
      
      let list = '';
      umkmData.slice(0, 10).forEach((umkm, index) => {
        list += `${index + 1}. *${umkm.nama}*\n`;
        list += `   📍 ${umkm.alamat}\n`;
        list += `   📞 ${umkm.kontak}\n\n`;
      });
      
      return list;
    } catch (error) {
      return 'Terjadi kesalahan saat memuat data UMKM.';
    }
  }

  async getUMKMByCategory(models, category) {
    try {
      const umkmData = await models.umkm.getUMKMByKategori(category);
      if (!umkmData || umkmData.length === 0) {
        return `Belum ada data UMKM kategori ${category}.`;
      }
      
      let list = '';
      umkmData.slice(0, 5).forEach((umkm, index) => {
        list += `${index + 1}. *${umkm.nama}*\n`;
        list += `   📍 ${umkm.alamat}\n`;
        list += `   📞 ${umkm.kontak}\n\n`;
      });
      
      return list;
    } catch (error) {
      return `Terjadi kesalahan saat memuat data UMKM ${category}.`;
    }
  }

  async getNewsList(models) {
    try {
      const newsData = await models.news.getAllNews();
      if (!newsData || newsData.length === 0) {
        return 'Belum ada berita yang tersedia.';
      }
      
      let list = '';
      newsData.slice(0, 5).forEach((news, index) => {
        const date = new Date(news.date).toLocaleDateString('id-ID');
        list += `${index + 1}. *${news.title}*\n`;
        list += `   📅 ${date}\n`;
        list += `   📝 ${news.content ? news.content.substring(0, 100) + '...' : 'Tidak ada konten'}\n\n`;
      });
      
      list += '\n─'.repeat(35) + '\n_Dibuat oleh Mahasiswa UMSU_';
      
      return list;
    } catch (error) {
      return 'Terjadi kesalahan saat memuat berita.';
    }
  }

  async getNewsByCategory(models, category) {
    try {
      const newsData = await models.news.getNewsByCategory(category);
      if (!newsData || newsData.length === 0) {
        return `Belum ada berita kategori ${category}.`;
      }
      
      let list = '';
      newsData.slice(0, 3).forEach((news, index) => {
        const date = new Date(news.date).toLocaleDateString('id-ID');
        list += `${index + 1}. *${news.title}*\n`;
        list += `   📅 ${date}\n\n`;
      });
      
      list += '\n─'.repeat(35) + '\n_Dibuat oleh Mahasiswa UMSU_';
      
      return list;
    } catch (error) {
      return `Terjadi kesalahan saat memuat berita ${category}.`;
    }
  }

  async getNewsArchive(models) {
    try {
      // Ambil berita bulan lalu
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      
      const newsData = await models.news.getNewsByDateRange(
        lastMonth.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
      );
      
      if (!newsData || newsData.length === 0) {
        return 'Belum ada arsip berita.';
      }
      
      let list = '';
      newsData.slice(0, 5).forEach((news, index) => {
        const date = new Date(news.date).toLocaleDateString('id-ID');
        list += `${index + 1}. *${news.title}*\n`;
        list += `   📅 ${date}\n\n`;
      });
      
      list += '\n─'.repeat(35) + '\n_Dibuat oleh Mahasiswa UMSU_';
      
      return list;
    } catch (error) {
      return 'Terjadi kesalahan saat memuat arsip berita.';
    }
  }

  // Fungsi untuk memuat dan menampilkan daftar UMKM (tanpa gambar)
  async loadUmkmList() {
    try {
      const umkmPath = path.join(__dirname, '../../uploads/umkm/umkm.json');
      const data = await fs.readFile(umkmPath, 'utf8');
      const umkmData = JSON.parse(data);
      
      if (!umkmData || umkmData.length === 0) {
        return 'Belum ada data UMKM yang tersedia.';
      }
      
      let list = '📋 *DAFTAR UMKM AKTIF:*\n\n';
      
      umkmData.forEach((umkm, index) => {
        list += `🏪 *${index + 1}. ${umkm.nama}*\n`;
        list += `📂 Kategori: ${umkm.kategori}\n`;
        list += `📍 ${umkm.alamat}\n`;
        list += `📞 ${umkm.kontak}\n`;
        list += `🕒 ${umkm.jam_operasional}\n`;
        list += `\n`;
      });
      
      list += '─'.repeat(35) + '\n';
      list += `📊 *Total UMKM: ${umkmData.length} usaha*\n\n`;
      list += '💡 *Tips:*\n';
      list += '• Ketik *8B* untuk melihat detail UMKM\n';
      list += '• Hubungi langsung untuk pemesanan\n\n';
      list += '─'.repeat(35) + '\n_Dibuat oleh Mahasiswa UMSU_';
      
      return list;
    } catch (error) {
      return 'Terjadi kesalahan saat memuat daftar UMKM.';
    }
  }

  // Fungsi untuk menampilkan detail UMKM (dengan gambar jika ada)
  async loadUmkmDetail(umkmId = null) {
    try {
      const umkmPath = path.join(__dirname, '../../uploads/umkm/umkm.json');
      const data = await fs.readFile(umkmPath, 'utf8');
      const umkmData = JSON.parse(data);
      
      if (!umkmData || umkmData.length === 0) {
        return { text: 'Belum ada data UMKM yang tersedia.' };
      }
      
      // Jika tidak ada ID spesifik, tampilkan instruksi
      if (!umkmId) {
        let instruction = '🏪 *PILIH UMKM UNTUK DETAIL:*\n\n';
        umkmData.forEach((umkm, index) => {
          instruction += `${index + 1}. ${umkm.nama} (${umkm.kategori})\n`;
        });
        instruction += '\n💡 *Cara melihat detail:*\n';
        instruction += 'Ketik nomor UMKM yang ingin dilihat\n';
        instruction += 'Contoh: ketik *1* untuk melihat detail UMKM pertama\n\n';
        instruction += '─'.repeat(35) + '\n_Dibuat oleh Mahasiswa UMSU_';
        return { text: instruction };
      }
      
      // Cari UMKM berdasarkan ID
      const selectedUmkm = umkmData[umkmId - 1];
      if (!selectedUmkm) {
        return { text: '❌ UMKM tidak ditemukan. Silakan pilih nomor yang valid.' };
      }
      
      let detail = `🏪 *${selectedUmkm.nama.toUpperCase()}*\n\n`;
      detail += `📂 *Kategori:* ${selectedUmkm.kategori}\n`;
      detail += `📝 *Deskripsi:*\n${selectedUmkm.deskripsi}\n\n`;
      detail += `📍 *Alamat:*\n${selectedUmkm.alamat}\n\n`;
      detail += `📞 *Kontak:* ${selectedUmkm.kontak}\n`;
      detail += `🕒 *Jam Operasional:* ${selectedUmkm.jam_operasional}\n`;
      detail += `📊 *Status:* ${selectedUmkm.status}\n\n`;
      detail += `📅 *Terdaftar:* ${new Date(selectedUmkm.created_at).toLocaleDateString('id-ID')}\n\n`;
      detail += '─'.repeat(35) + '\n';
      detail += '💼 *Dukungan UMKM:*\n';
      detail += '• Pelatihan usaha gratis\n';
      detail += '• Bantuan promosi produk\n';
      detail += '• Konsultasi bisnis\n\n';
      detail += '─'.repeat(35) + '\n_Dibuat oleh Mahasiswa UMSU_';
      
      // Jika ada gambar, siapkan untuk dikirim
      const response = { text: detail };
      if (selectedUmkm.image && selectedUmkm.image !== null) {
        const imagePath = path.join(__dirname, '../../uploads/umkm/images/', selectedUmkm.image);
        try {
          await fs.access(imagePath);
          response.image = imagePath;
        } catch (imageError) {
          // Gambar tidak ditemukan, lanjutkan tanpa gambar
        }
      }
      
      return response;
    } catch (error) {
      return { text: 'Terjadi kesalahan saat memuat detail UMKM.' };
    }
  }

  // Fungsi untuk menampilkan UMKM berdasarkan kategori
  async loadUmkmCategories() {
    try {
      const umkmPath = path.join(__dirname, '../../uploads/umkm/umkm.json');
      const data = await fs.readFile(umkmPath, 'utf8');
      const umkmData = JSON.parse(data);
      
      if (!umkmData || umkmData.length === 0) {
        return 'Belum ada data UMKM yang tersedia.';
      }
      
      // Kelompokkan berdasarkan kategori
      const categories = {};
      umkmData.forEach(umkm => {
        if (!categories[umkm.kategori]) {
          categories[umkm.kategori] = [];
        }
        categories[umkm.kategori].push(umkm);
      });
      
      let categoryList = '📂 *UMKM BERDASARKAN KATEGORI:*\n\n';
      
      Object.keys(categories).forEach(category => {
        const icon = this.getCategoryIcon(category);
        categoryList += `${icon} *${category.toUpperCase()}* (${categories[category].length} usaha)\n`;
        categories[category].forEach(umkm => {
          categoryList += `   • ${umkm.nama}\n`;
        });
        categoryList += '\n';
      });
      
      categoryList += '─'.repeat(35) + '\n';
      categoryList += `📊 *Total: ${umkmData.length} UMKM dalam ${Object.keys(categories).length} kategori*\n\n`;
      categoryList += '─'.repeat(35) + '\n_Dibuat oleh Mahasiswa UMSU_';
      
      return categoryList;
    } catch (error) {
      return 'Terjadi kesalahan saat memuat kategori UMKM.';
    }
  }

  // Fungsi untuk menampilkan kontak UMKM
  async loadUmkmContacts() {
    try {
      const umkmPath = path.join(__dirname, '../../uploads/umkm/umkm.json');
      const data = await fs.readFile(umkmPath, 'utf8');
      const umkmData = JSON.parse(data);
      
      if (!umkmData || umkmData.length === 0) {
        return 'Belum ada data UMKM yang tersedia.';
      }
      
      let contactList = '📞 *KONTAK UMKM DESA PULOSAROK:*\n\n';
      
      umkmData.forEach((umkm, index) => {
        contactList += `🏪 *${index + 1}. ${umkm.nama}*\n`;
        contactList += `📞 ${umkm.kontak}\n`;
        contactList += `📂 ${umkm.kategori}\n`;
        contactList += `📍 ${umkm.alamat}\n\n`;
      });
      
      contactList += '─'.repeat(35) + '\n';
      contactList += '📱 *Tips Menghubungi:*\n';
      contactList += '• Hubungi di jam operasional\n';
      contactList += '• Konfirmasi ketersediaan produk\n';
      contactList += '• Tanyakan harga dan promo\n\n';
      contactList += '─'.repeat(35) + '\n_Dibuat oleh Mahasiswa UMSU_';
      
      return contactList;
    } catch (error) {
      return 'Terjadi kesalahan saat memuat kontak UMKM.';
    }
  }

  // Helper function untuk mendapatkan icon kategori
  getCategoryIcon(category) {
    const icons = {
      'Kuliner': '🍽️',
      'Perikanan': '🐟',
      'Pertanian': '🌾',
      'Kerajinan': '🎨',
      'Perdagangan': '🛒',
      'Jasa': '🔧'
    };
    return icons[category] || '🏪';
  }

  // Validasi format ID menu
  isValidMenuId(id) {
    // Format: 1-8 untuk menu utama (termasuk UMKM)
    return /^[1-8]$/.test(id);
  }

  // Validasi format ID sub-menu
  isValidSubMenuId(id) {
    // Format: 1A-8E untuk sub-menu (termasuk UMKM)
    return /^[1-8][A-E]$/.test(id);
  }

  // Handler utama untuk routing menu berdasarkan ID
  async handleMenuRequest(id, models = null) {
    try {
      // Jika input adalah 'menu', tampilkan menu utama
      if (id.toLowerCase() === 'menu') {
        return await this.getMainMenu();
      }
      
      // Jika input adalah angka 1-8, tampilkan sub-menu
      if (this.isValidMenuId(id)) {
        return await this.getSubMenu(id);
      }
      
      // Jika input adalah format 1A-8E, tampilkan detail sub-menu
      if (this.isValidSubMenuId(id.toUpperCase())) {
        return await this.getSubMenuDetail(id.toUpperCase(), models);
      }
      
      // Jika format tidak valid
      return {
        text: `❌ *Format Tidak Valid*\n\nFormat yang benar:\n• *menu* - Menu utama\n• *1-8* - Sub-menu\n• *1A-8E* - Detail layanan\n\nContoh: *menu*, *1*, *1A*, *7*, *7A*`
      };
    } catch (error) {
      console.error('Error handling menu request:', error);
      return {
        text: '❌ *Error*\n\nTerjadi kesalahan saat memproses permintaan menu.'
      };
    }
  }
}

module.exports = new IdMenuController();