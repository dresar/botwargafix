/**
 * Controller untuk mengelola menu - menggabungkan fungsi konten dan import menu
 */

const fs = require('fs-extra');
const path = require('path');
// SQLite imports removed - using JSON files only

// Cache untuk menu structure
let menuStructureCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 menit dalam milliseconds

// Fungsi untuk membersihkan cache
const clearMenuCache = () => {
  menuStructureCache = null;
  cacheTimestamp = null;
  console.log('📝 Menu cache cleared');
};

// Fungsi untuk mengecek apakah cache masih valid
const isCacheValid = () => {
  if (!menuStructureCache || !cacheTimestamp) return false;
  return (Date.now() - cacheTimestamp) < CACHE_DURATION;
};

// ===== FUNGSI KONTEN MENU =====

// Fungsi untuk mengkonversi konten txt ke format JSON yang lebih formal
const convertTxtToJson = (txtContent) => {
  try {
    // Parsing konten txt
    const lines = txtContent.split('\n');
    const result = {
      title: '',
      description: '',
      sections: [],
      requirements: [],
      procedures: [],
      contact: {},
      fees: [],
      processingTime: '',
      legalBasis: [],
      notes: []
    };

    let currentSection = null;
    let currentList = null;
    let currentListType = null; // 'requirements', 'procedures', 'fees', 'legalBasis', 'notes'

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip baris kosong
      if (!line) continue;

      // Deteksi judul utama (# Judul)
      if (line.startsWith('# ')) {
        result.title = line.substring(2).trim();
        continue;
      }

      // Deteksi sub-judul (## Sub Judul)
      if (line.startsWith('## ')) {
        const sectionTitle = line.substring(3).trim();
        
        // Reset current list type
        currentListType = null;
        
        // Cek jenis section berdasarkan judul
        if (sectionTitle.toLowerCase().includes('persyaratan') || sectionTitle.toLowerCase().includes('requirements')) {
          currentListType = 'requirements';
          currentList = result.requirements;
        } else if (sectionTitle.toLowerCase().includes('prosedur') || sectionTitle.toLowerCase().includes('procedure')) {
          currentListType = 'procedures';
          currentList = result.procedures;
        } else if (sectionTitle.toLowerCase().includes('biaya') || sectionTitle.toLowerCase().includes('fee')) {
          currentListType = 'fees';
          currentList = result.fees;
        } else if (sectionTitle.toLowerCase().includes('dasar hukum') || sectionTitle.toLowerCase().includes('legal')) {
          currentListType = 'legalBasis';
          currentList = result.legalBasis;
        } else if (sectionTitle.toLowerCase().includes('catatan') || sectionTitle.toLowerCase().includes('note')) {
          currentListType = 'notes';
          currentList = result.notes;
        } else if (sectionTitle.toLowerCase().includes('kontak') || sectionTitle.toLowerCase().includes('contact')) {
          // Khusus untuk kontak, kita tidak menggunakan list
          currentListType = 'contact';
          currentList = null;
        } else if (sectionTitle.toLowerCase().includes('waktu') || sectionTitle.toLowerCase().includes('time')) {
          // Khusus untuk waktu pemrosesan, kita tidak menggunakan list
          currentListType = 'processingTime';
          currentList = null;
        } else if (sectionTitle.toLowerCase().includes('deskripsi') || sectionTitle.toLowerCase().includes('description')) {
          // Khusus untuk deskripsi, kita tidak menggunakan list
          currentListType = 'description';
          currentList = null;
        } else {
          // Section lainnya
          currentSection = {
            title: sectionTitle,
            content: ''
          };
          result.sections.push(currentSection);
          currentListType = null;
          currentList = null;
        }
        continue;
      }

      // Deteksi item list (- Item)
      if (line.startsWith('- ') && currentListType && currentList) {
        const itemContent = line.substring(2).trim();
        currentList.push(itemContent);
        continue;
      }

      // Deteksi key-value pair untuk kontak (Key: Value)
      if (currentListType === 'contact' && line.includes(':')) {
        const [key, value] = line.split(':').map(part => part.trim());
        if (key && value) {
          result.contact[key.toLowerCase()] = value;
        }
        continue;
      }

      // Simpan waktu pemrosesan
      if (currentListType === 'processingTime') {
        result.processingTime = line;
        continue;
      }

      // Simpan deskripsi
      if (currentListType === 'description') {
        result.description += line + ' ';
        continue;
      }

      // Tambahkan konten ke section saat ini
      if (currentSection) {
        currentSection.content += line + ' ';
      }
    }

    // Trim deskripsi
    result.description = result.description.trim();

    // Trim konten section
    result.sections.forEach(section => {
      section.content = section.content.trim();
    });

    return result;
  } catch (error) {
    console.error('Error converting TXT to JSON:', error.message);
    throw error;
  }
};

// Fungsi untuk mendapatkan konten menu dari file (hanya JSON)
const getMenuContentFromFile = async (menuId, subMenuId) => {
  try {
    // Tentukan path ke file konten JSON
    const menuPath = path.join(
      process.cwd(),
      'uploads',
      'menus',
      `${menuId}-menu`
    );
    const subMenuPath = path.join(menuPath, `${subMenuId}-sub-menu`);
    const jsonPath = path.join(subMenuPath, 'content.json');

    // Cek apakah file JSON ada
    if (!await fs.pathExists(jsonPath)) {
      return null;
    }

    // Baca konten file JSON
    const jsonContent = await fs.readFile(jsonPath, 'utf8');

    // Parse JSON
    const parsedContent = JSON.parse(jsonContent);

    return {
      menu_id: menuId,
      sub_menu_id: subMenuId,
      content_json: parsedContent
    };
  } catch (error) {
    console.error('Error getting menu content from file:', error.message);
    throw error;
  }
};

// Fungsi untuk menyimpan konten menu ke file dan database (hanya JSON)
const saveMenuContent = async (menuId, subMenuId, jsonContent, adminId = null) => {
  try {
    // Tentukan path ke file konten JSON
    const menuPath = path.join(
      process.cwd(),
      'uploads',
      'menus',
      `${menuId}-menu`
    );
    const subMenuPath = path.join(menuPath, `${subMenuId}-sub-menu`);
    const jsonPath = path.join(subMenuPath, 'content.json');

    // Buat direktori jika belum ada
    await fs.ensureDir(subMenuPath);

    // Tulis konten ke file JSON
    await fs.writeFile(jsonPath, JSON.stringify(jsonContent, null, 2), 'utf8');
    
    // Bersihkan cache karena ada perubahan
    clearMenuCache();
    
    let result = {
      menu_id: menuId,
      sub_menu_id: subMenuId,
      content_json: jsonContent,
      file_path: jsonPath,
      saved_at: new Date().toISOString(),
      admin_id: adminId
    };

    console.log(`Menu content saved: ${menuId}-${subMenuId}`);
    return result;
  } catch (error) {
    console.error('Error saving menu content:', error.message);
    throw error;
  }
};

// Fungsi untuk mengkonversi semua file txt ke JSON
const convertAllTxtToJson = async () => {
  try {
    const menuBasePath = path.join(process.cwd(), 'uploads', 'menus');
    
    if (!await fs.pathExists(menuBasePath)) {
      console.log('Folder menus tidak ditemukan');
      return { success: false, message: 'Folder menus tidak ditemukan' };
    }

    const mainMenus = await fs.readdir(menuBasePath);
    let convertedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const mainMenu of mainMenus) {
      const mainMenuPath = path.join(menuBasePath, mainMenu);
      const mainMenuStat = await fs.stat(mainMenuPath);
      
      if (mainMenuStat.isDirectory()) {
        const subMenus = await fs.readdir(mainMenuPath);
        
        for (const subMenu of subMenus) {
          const subMenuPath = path.join(mainMenuPath, subMenu);
          const subMenuStat = await fs.stat(subMenuPath);
          
          if (subMenuStat.isDirectory()) {
            const txtPath = path.join(subMenuPath, 'content.txt');
            const jsonPath = path.join(subMenuPath, 'content.json');
            
            // Cek apakah file txt ada dan json belum ada
            if (await fs.pathExists(txtPath) && !await fs.pathExists(jsonPath)) {
              try {
                const txtContent = await fs.readFile(txtPath, 'utf8');
                const jsonContent = convertTxtToJson(txtContent);
                
                await fs.writeFile(jsonPath, JSON.stringify(jsonContent, null, 2), 'utf8');
                convertedCount++;
                console.log(`Converted: ${mainMenu}/${subMenu}`);
              } catch (error) {
                errorCount++;
                errors.push(`${mainMenu}/${subMenu}: ${error.message}`);
                console.error(`Error converting ${mainMenu}/${subMenu}:`, error.message);
              }
            }
          }
        }
      }
    }

    return {
      success: true,
      message: `Konversi selesai. ${convertedCount} file berhasil dikonversi, ${errorCount} error.`,
      convertedCount,
      errorCount,
      errors
    };
  } catch (error) {
    console.error('Error during conversion:', error.message);
    return { success: false, message: `Error: ${error.message}` };
  }
};

// ===== FUNGSI IMPORT MENU =====

// Fungsi untuk membaca struktur menu dari folder dengan cache
const readMenuStructure = async () => {
  try {
    // Cek cache terlebih dahulu
    if (isCacheValid()) {
      console.log('📋 Using cached menu structure');
      return menuStructureCache;
    }
    
    console.log('📁 Reading menu structure from files...');
    const menuBasePath = path.join(process.cwd(), 'uploads', 'menus');
    const mainMenus = await fs.readdir(menuBasePath);
    
    const menuStructure = [];
    
    // Urutkan menu utama berdasarkan ID numerik
    const sortedMainMenus = mainMenus.sort((a, b) => {
      const aId = parseInt(a.split('-')[0]);
      const bId = parseInt(b.split('-')[0]);
      return aId - bId;
    });
    
    for (const mainMenu of sortedMainMenus) {
      // Pastikan ini adalah folder
      const mainMenuPath = path.join(menuBasePath, mainMenu);
      const mainMenuStat = await fs.stat(mainMenuPath);
      
      if (mainMenuStat.isDirectory()) {
        const mainMenuId = parseInt(mainMenu.split('-')[0]);
        const mainMenuName = mainMenu.split('-')[1].replace(/_/g, ' ');
        
        // Baca sub-menu
        const subMenus = await fs.readdir(mainMenuPath);
        
        // Urutkan sub-menu berdasarkan ID
        const sortedSubMenus = subMenus.sort((a, b) => {
          const aId = a.split('-')[0];
          const bId = b.split('-')[0];
          return aId.localeCompare(bId);
        });
        
        const subMenuList = [];
        
        for (const subMenu of sortedSubMenus) {
          // Pastikan ini adalah folder
          const subMenuPath = path.join(mainMenuPath, subMenu);
          const subMenuStat = await fs.stat(subMenuPath);
          
          if (subMenuStat.isDirectory()) {
            const subMenuId = subMenu.split('-')[0];
            const subMenuName = subMenu.split('-')[1].replace(/_/g, ' ');
            
            // Cek apakah ada file content.json
            const contentPath = path.join(subMenuPath, 'content.json');
            let content = '';
            
            if (await fs.pathExists(contentPath)) {
              try {
                const contentRaw = await fs.readFile(contentPath, 'utf-8');
                const contentObj = JSON.parse(contentRaw);
                // Convert JSON object to readable text for backward compatibility
                content = contentObj.title || '';
                if (contentObj.description) {
                  content += (content ? '\n\n' : '') + contentObj.description;
                }
              } catch (error) {
                console.warn(`Warning: Failed to parse content.json for ${subMenu}:`, error.message);
                content = '';
              }
            }
            
            subMenuList.push({
              id: subMenuId,
              name: subMenuName,
              content: content,
              order_num: parseInt(subMenuId) || 1
            });
          }
        }
        
        menuStructure.push({
          id: mainMenuId,
          name: mainMenuName,
          subMenus: subMenuList,
          order_num: mainMenuId
        });
      }
    }
    
    // Simpan ke cache
    menuStructureCache = menuStructure;
    cacheTimestamp = Date.now();
    console.log(`💾 Menu structure cached (${menuStructure.length} menus)`);
    
    return menuStructure;
  } catch (error) {
    console.error('Error saat membaca struktur menu:', error.message);
    return [];
  }
};

// Fungsi untuk mendapatkan menu berdasarkan ID dari file system
const getMenuByIdFS = async (menuId) => {
  try {
    const menus = await readMenuStructure();
    return menus.find((m) => m.id === parseInt(menuId));
  } catch (error) {
    console.error('Error getting menu by ID:', error.message);
    return null;
  }
};

// Fungsi untuk mengimpor menu dari struktur folder (JSON only)
const importMenusFromFolders = async () => {
  try {
    // Baca struktur menu dari folder
    const menuStructure = await readMenuStructure();
    
    if (menuStructure.length === 0) {
      console.log('Tidak ada menu yang ditemukan di folder');
      return { success: false, message: 'Tidak ada menu yang ditemukan di folder' };
    }
    
    console.log(`Ditemukan ${menuStructure.length} menu utama dari file JSON`);
    let totalSubMenus = 0;
    menuStructure.forEach(menu => {
      totalSubMenus += menu.subMenus ? menu.subMenus.length : 0;
    });
    
    return {
      success: true,
      message: 'Menu berhasil dibaca dari file JSON',
      importedMenus: menuStructure.length,
      importedSubMenus: totalSubMenus,
    };
    
    return {
      success: true,
      message: `Menu berhasil dibaca dari file JSON: ${menuStructure.length} menu utama, ${totalSubMenus} sub-menu`,
      menuStructure: menuStructure
    };
  } catch (error) {
    console.error('Error saat mengimpor menu dari folder:', error.message);
    return { success: false, message: `Error: ${error.message}` };
  }
};

// Fungsi untuk menghapus data menu duplikat (JSON only - placeholder)
const removeDuplicateMenus = async () => {
  try {
    // Untuk sistem JSON, fungsi ini tidak diperlukan karena tidak ada database
    return {
      success: true,
      message: 'Tidak ada duplikat dalam sistem JSON.'
    };
  } catch (error) {
    console.error('Error saat menghapus menu duplikat:', error.message);
    return { success: false, message: `Error: ${error.message}` };
  }
};

// Fungsi untuk menambahkan menu via WhatsApp (JSON only)
const addMenuViaWhatsApp = async (menuData) => {
  try {
    // Untuk sistem JSON, kita hanya mengembalikan struktur data
    // Implementasi aktual akan dilakukan di level file system
    return {
      success: true,
      message: `Menu "${menuData.name}" akan ditambahkan ke sistem JSON.`,
      menu: {
        name: menuData.name,
        description: menuData.description || '',
        order_num: menuData.order_num || 1
      }
    };
  } catch (error) {
    console.error('Error saat menambahkan menu via WhatsApp:', error.message);
    return { success: false, message: `Error: ${error.message}` };
  }
};

// Fungsi untuk menambahkan sub-menu via WhatsApp (JSON only)
const addSubMenuViaWhatsApp = async (subMenuData) => {
  try {
    // Untuk sistem JSON, kita hanya mengembalikan struktur data
    return {
      success: true,
      message: `Sub-menu "${subMenuData.name}" akan ditambahkan ke sistem JSON.`,
      subMenu: {
        menu_id: subMenuData.menu_id,
        name: subMenuData.name,
        description: subMenuData.description || '',
        order_num: subMenuData.order_num || 1
      }
    };
  } catch (error) {
    console.error('Error saat menambahkan sub-menu via WhatsApp:', error.message);
    return { success: false, message: `Error: ${error.message}` };
  }
};

module.exports = {
  // Fungsi konten menu
  convertTxtToJson,
  getMenuContentFromFile,
  saveMenuContent,
  convertAllTxtToJson,
  
  // Fungsi import menu (JSON only)
  readMenuStructure,
  getMenuByIdFS,
  importMenusFromFolders,
  removeDuplicateMenus,
  addMenuViaWhatsApp,
  addSubMenuViaWhatsApp,
  
  // Fungsi cache
  clearMenuCache
};