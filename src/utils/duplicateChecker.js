/**
 * Utility untuk memeriksa dan mencegah duplikasi pesan
 */

class DuplicateChecker {
  constructor() {
    // Cache untuk menyimpan pesan yang sudah dikirim
    this.messageCache = new Map();
    // Waktu cache dalam milidetik (5 menit)
    this.cacheTimeout = 5 * 60 * 1000;
    
    // Bersihkan cache secara berkala
    setInterval(() => {
      this.cleanExpiredCache();
    }, 60000); // Bersihkan setiap 1 menit
  }
  
  /**
   * Membuat hash sederhana dari string
   */
  createHash(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36);
  }
  
  /**
   * Membuat key unik untuk pesan berdasarkan pengirim dan konten
   */
  createMessageKey(senderId, messageContent) {
    // Normalisasi konten pesan
    const normalizedContent = messageContent
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[^a-z0-9\s]/g, ''); // Hapus karakter khusus
    
    return `${senderId}_${this.createHash(normalizedContent)}`;
  }
  
  /**
   * Memeriksa apakah pesan duplikat
   */
  isDuplicate(senderId, messageContent, timeWindow = 30000) {
    const messageKey = this.createMessageKey(senderId, messageContent);
    const now = Date.now();
    
    if (this.messageCache.has(messageKey)) {
      const lastSent = this.messageCache.get(messageKey);
      
      // Jika pesan dikirim dalam timeWindow, anggap duplikat
      if (now - lastSent < timeWindow) {
        console.log(`Duplicate message detected for ${senderId}: ${messageKey}`);
        return true;
      }
    }
    
    // Simpan timestamp pesan
    this.messageCache.set(messageKey, now);
    return false;
  }
  
  /**
   * Memeriksa duplikasi untuk menu/sub-menu
   */
  isMenuDuplicate(senderId, menuId, subMenuId = null) {
    const menuKey = subMenuId ? `${senderId}_menu_${menuId}_${subMenuId}` : `${senderId}_menu_${menuId}`;
    const now = Date.now();
    const timeWindow = 10000; // 10 detik untuk menu
    
    if (this.messageCache.has(menuKey)) {
      const lastAccess = this.messageCache.get(menuKey);
      
      if (now - lastAccess < timeWindow) {
        console.log(`Duplicate menu access detected: ${menuKey}`);
        return true;
      }
    }
    
    this.messageCache.set(menuKey, now);
    return false;
  }
  
  /**
   * Membersihkan cache yang sudah expired
   */
  cleanExpiredCache() {
    const now = Date.now();
    const expiredKeys = [];
    
    for (const [key, timestamp] of this.messageCache.entries()) {
      if (now - timestamp > this.cacheTimeout) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => {
      this.messageCache.delete(key);
    });
    
    if (expiredKeys.length > 0) {
      console.log(`Cleaned ${expiredKeys.length} expired cache entries`);
    }
  }
  
  /**
   * Mendapatkan statistik cache
   */
  getCacheStats() {
    return {
      totalEntries: this.messageCache.size,
      cacheTimeout: this.cacheTimeout,
      oldestEntry: this.messageCache.size > 0 ? 
        Math.min(...Array.from(this.messageCache.values())) : null
    };
  }
  
  /**
   * Membersihkan semua cache
   */
  clearCache() {
    const size = this.messageCache.size;
    this.messageCache.clear();
    console.log(`Cleared ${size} cache entries`);
    return size;
  }
  
  /**
   * Memeriksa duplikasi untuk response bot
   */
  isBotResponseDuplicate(senderId, responseType, content) {
    const responseKey = `${senderId}_bot_${responseType}_${this.createHash(content)}`;
    const now = Date.now();
    const timeWindow = 5000; // 5 detik untuk response bot
    
    if (this.messageCache.has(responseKey)) {
      const lastSent = this.messageCache.get(responseKey);
      
      if (now - lastSent < timeWindow) {
        console.log(`Duplicate bot response detected: ${responseKey}`);
        return true;
      }
    }
    
    this.messageCache.set(responseKey, now);
    return false;
  }
  
  /**
   * Wrapper untuk memeriksa semua jenis duplikasi
   */
  checkAllDuplicates(senderId, messageContent, messageType = 'general', additionalData = {}) {
    const checks = {
      isDuplicate: false,
      duplicateType: null,
      reason: null
    };
    
    // Cek duplikasi pesan umum
    if (this.isDuplicate(senderId, messageContent)) {
      checks.isDuplicate = true;
      checks.duplicateType = 'message';
      checks.reason = 'Pesan yang sama baru saja dikirim';
      return checks;
    }
    
    // Cek duplikasi menu jika ada data menu
    if (messageType === 'menu' && additionalData.menuId) {
      if (this.isMenuDuplicate(senderId, additionalData.menuId, additionalData.subMenuId)) {
        checks.isDuplicate = true;
        checks.duplicateType = 'menu';
        checks.reason = 'Menu yang sama baru saja diakses';
        return checks;
      }
    }
    
    // Cek duplikasi response bot
    if (messageType === 'bot_response' && additionalData.responseType) {
      if (this.isBotResponseDuplicate(senderId, additionalData.responseType, messageContent)) {
        checks.isDuplicate = true;
        checks.duplicateType = 'bot_response';
        checks.reason = 'Response bot yang sama baru saja dikirim';
        return checks;
      }
    }
    
    return checks;
  }
}

// Singleton instance
const duplicateChecker = new DuplicateChecker();

module.exports = {
  DuplicateChecker,
  duplicateChecker
};