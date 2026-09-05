/**
 * Controller untuk menangani pengaduan masyarakat
 */

const path = require('path');
const fs = require('fs-extra');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const UnifiedModel = require('../models/UnifiedModel');
const JSONAdmin = require('../models/JSONAdmin');

// Fungsi untuk memformat formulir pengaduan
const formatComplaintForm = () => {
  const message = `*FORMULIR PENGADUAN MASYARAKAT*

Silakan isi formulir pengaduan dengan format berikut:

pengaduan
Nama: [isi nama Anda]
Alamat: [isi alamat Anda]
Aduan: [isi aduan Anda]

Contoh:
pengaduan
Nama: Budi
Alamat: Dusun Krajan
Aduan: Jalan rusak di depan rumah perlu perbaikan

Catatan: 
• Semua kolom wajib diisi
• Ketik *menu* untuk kembali ke menu utama

${'─'.repeat(35)}
_Dibuat oleh Mahasiswa UMSU_`;
  
  return {
    text: message
  };
};

// Fungsi untuk memproses pengaduan dari pesan
const processComplaintSubmission = async (chatModel, msg, sock, adminModel) => {
  try {
    // Inisialisasi model chat jika belum ada
    if (!chatModel) {
      chatModel = new UnifiedModel();
    }

    // Dapatkan ID pengirim dan nomor telepon
    const userId = msg.key.remoteJid.split('@')[0];
    const phoneNumber = userId.startsWith('62') ? userId : `62${userId.replace(/^0/, '')}`;
    
    // Dapatkan isi pesan
    const messageContent = msg.message.conversation || 
                          (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) || 
                          (msg.message.imageMessage && msg.message.imageMessage.caption) || 
                          (msg.message.videoMessage && msg.message.videoMessage.caption) || 
                          '';
    
    // Validasi format pesan
    const lines = messageContent.split('\n');
    const firstLine = lines[0].toLowerCase().trim();
    if (firstLine !== 'pengaduan') {
      throw new Error('Format pengaduan tidak valid. Ketik "pengaduan" di baris pertama.');
    }
    
    // Ekstrak informasi dari pesan
    let reporterName = '';
    let reporterAddress = '';
    let complaintLines = [];
    let isInComplaint = false;
    
    // Proses setiap baris pesan
    let foundNama = false;
    let foundAlamat = false;
    let foundAduan = false;
    
    for (const line of lines.slice(1)) { // Mulai dari baris kedua
      const lowerLine = line.toLowerCase().trim();
      
      if (lowerLine.startsWith('nama:')) {
        reporterName = line.substring(line.indexOf(':') + 1).trim();
        foundNama = true;
      } else if (lowerLine.startsWith('alamat:')) {
        reporterAddress = line.substring(line.indexOf(':') + 1).trim();
        foundAlamat = true;
      } else if (lowerLine.startsWith('aduan:')) {
        const complaint = line.substring(line.indexOf(':') + 1).trim();
        if (complaint) {
          complaintLines.push(complaint);
          foundAduan = true;
        }
      } else if (foundAduan && line.trim()) {
        complaintLines.push(line.trim());
      }
    }
    
    if (!foundNama) {
      throw new Error('Format tidak valid. Mohon sertakan "Nama:" dalam pengaduan.');
    }
    if (!foundAlamat) {
      throw new Error('Format tidak valid. Mohon sertakan "Alamat:" dalam pengaduan.');
    }
    if (!foundAduan) {
      throw new Error('Format tidak valid. Mohon sertakan "Aduan:" dalam pengaduan.');
    }
    
    const description = complaintLines.join('\n');
    
    // Validasi field wajib
    if (!reporterName) {
      throw new Error('Nama wajib diisi.');
    }
    if (!reporterAddress) {
      throw new Error('Alamat wajib diisi.');
    }
    if (!description) {
      throw new Error('Aduan wajib diisi.');
    }
    
    // Cek duplikasi nama pelapor
    const existingComplaints = await chatModel.getComplaintsByName(reporterName);
    if (existingComplaints && existingComplaints.length > 0) {
      const lastComplaint = existingComplaints[existingComplaints.length - 1];
      const timeDiff = Date.now() - new Date(lastComplaint.created_at).getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        throw new Error(`Anda sudah mengirim pengaduan dalam 24 jam terakhir. Silakan tunggu ${Math.ceil(24 - hoursDiff)} jam lagi.`);
      }
    }
    
    // Simpan media jika ada
    let mediaPath = null;
    if (msg.message.imageMessage || msg.message.videoMessage) {
      mediaPath = await saveComplaintMedia(msg);
    }
    
    // Buat objek keluhan
    const complaint = {
      user_id: userId,
      phone_number: phoneNumber,
      reporter_name: reporterName,
      reporter_address: reporterAddress,
      description: description,
      photo_path: mediaPath,
      status: 'pending'
    };
    
    // Tambahkan pengaduan ke database
    const saved = await chatModel.addComplaint(complaint);

    // Kirim notifikasi ke admin jika sock tersedia
    if (sock) {
      try {
        await notifyAdminsOfComplaint(sock, { id: saved.id, ...complaint });
      } catch (e) {
        console.error('Failed to notify admins about complaint:', e.message);
      }
    }
    
    return {
      response: `✅ *Pengaduan Berhasil Disimpan!*\n\n📋 *Detail Pengaduan:*\nID: ${saved.id}\nNama: ${reporterName}\nAlamat: ${reporterAddress}\nAduan: ${description}\nStatus: Menunggu Proses\n\n📞 Pengaduan Anda akan segera kami proses.\n\n💡 Ketik *menu* untuk kembali ke menu utama\n\n${'─'.repeat(35)}\n_Dibuat oleh Mahasiswa UMSU_`,
      context: {},
      reset: true
    };
  } catch (error) {
    console.error('Error processing complaint submission:', error.message);
    return {
      response: `❌ *Pengaduan Gagal*\n\n${error.message}\n\n${'─'.repeat(35)}\n_Dibuat oleh Mahasiswa UMSU_`,
      context: {},
      reset: true
    };
  }
};

// Fungsi untuk mendapatkan daftar pengaduan untuk admin
const getComplaintListForAdmin = async (models) => {
  try {
    const complaints = await models.complaint.getAllComplaints();
    
    if (!complaints || complaints.length === 0) {
      return {
        text: 'Belum ada pengaduan yang disubmit.\n\n' + '─'.repeat(35) + '\n_Dibuat oleh Mahasiswa UMSU_'
      };
    }
    
    let message = '*DAFTAR PENGADUAN MASYARAKAT*\n\n';
    
    complaints.forEach((complaint, index) => {
      const date = new Date(complaint.created_at).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      
      message += `*${index + 1}. Pengaduan #${complaint.id}*\n`;
      message += `   ID: ${complaint.id}\n`;
      message += `   Pelapor: ${complaint.reporter_name}\n`;
      message += `   Tanggal: ${date}\n`;
      message += `   Status: ${formatStatus(complaint.status)}\n\n`;
    });
    
    message += 'Untuk melihat detail pengaduan, ketik *!detail_pengaduan [ID]*\nContoh: *!detail_pengaduan 1*\n\n';
    message += '─'.repeat(35) + '\n_Dibuat oleh Mahasiswa UMSU_';
    
    return {
      text: message
    };
  } catch (error) {
    console.error('Error getting complaint list for admin:', error.message);
    return {
      text: 'Maaf, terjadi kesalahan saat memuat daftar pengaduan.\n\n' + '─'.repeat(35) + '\n_Dibuat oleh Mahasiswa UMSU_'
    };
  }
};

// Fungsi untuk mendapatkan detail pengaduan berdasarkan ID untuk admin
const getComplaintDetailForAdmin = async (models, complaintId) => {
  try {
    const complaint = await models.complaint.getComplaintById(complaintId);
    
    if (!complaint) {
      return {
        text: `Pengaduan dengan ID ${complaintId} tidak ditemukan.`
      };
    }
    
    const date = new Date(complaint.created_at).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    let message = '*DETAIL PENGADUAN*\n\n';
    message += `📋 *Info Pengaduan:*\n`;
    message += `• ID: ${complaint.id}\n`;
    message += `• Nama: ${complaint.reporter_name}\n`;
    message += `• Alamat: ${complaint.reporter_address}\n`;
    message += `• Deskripsi: ${complaint.description}\n\n`;
    message += `📅 Tanggal: ${date}\n`;
    message += `📊 Status: ${formatStatus(complaint.status)}\n\n`;
    
    if (complaint.photo_path) {
      message += '📸 Foto terlampir\n\n';
    }
    
    message += '⚡ *Perintah Admin:*\n';
    message += '• Ubah Status: *!update_status [ID] [status]*\n';
    message += '• Status: pending, processing, resolved, rejected';
    
    // Jika ada foto, siapkan untuk dikirim
    if (complaint.photo_path && fs.existsSync(complaint.photo_path)) {
      return {
        text: message,
        media: { path: complaint.photo_path }
      };
    }
    
    return {
      text: message
    };
  } catch (error) {
    console.error('Error getting complaint detail for admin:', error.message);
    return {
      text: 'Maaf, terjadi kesalahan saat memuat detail pengaduan.'
    };
  }
};

// Fungsi untuk mengubah status pengaduan
const updateComplaintStatus = async (models, complaintId, status) => {
  try {
    // Validasi status
    const validStatuses = ['pending', 'processing', 'resolved', 'rejected'];
    if (!validStatuses.includes(status.toLowerCase())) {
      return {
        text: `Status tidak valid. Status yang tersedia: ${validStatuses.join(', ')}`
      };
    }
    
    // Update status pengaduan
    await models.complaint.updateComplaintStatus(complaintId, status.toLowerCase());
    
    return {
      text: `Status pengaduan dengan ID ${complaintId} berhasil diubah menjadi ${formatStatus(status.toLowerCase())}.`
    };
  } catch (error) {
    console.error('Error updating complaint status:', error.message);
    return {
      text: 'Maaf, terjadi kesalahan saat mengubah status pengaduan.'
    };
  }
};

// Fungsi untuk memformat status pengaduan
const formatStatus = (status) => {
  const statusMap = {
    'pending': '⏳ Menunggu',
    'processing': '🔄 Diproses',
    'resolved': '✅ Selesai',
    'rejected': '❌ Ditolak'
  };
  
  return statusMap[status] || status;
};

// Fungsi untuk menyimpan file media (foto pengaduan)
const saveComplaintMedia = async (msg) => {
  try {
    // Cek apakah pesan mengandung media
    const mediaMessage = msg.message?.imageMessage || msg.message?.videoMessage;
    if (!mediaMessage) {
      throw new Error('Tidak ada media yang ditemukan dalam pesan');
    }
    
    // Validasi tipe media
    if (!mediaMessage.mimetype?.includes('image')) {
      throw new Error('Hanya file gambar yang diperbolehkan');
    }
    
    // Buat direktori untuk menyimpan media jika belum ada
    const mediaDir = path.join(process.cwd(), 'uploads', 'complaints');
    await fs.ensureDir(mediaDir);
    
    // Generate nama file unik dengan ID pengirim
    const timestamp = new Date().getTime();
    const senderId = msg.key.remoteJid.split('@')[0];
    const mediaPath = path.join(mediaDir, `complaint_${senderId}_${timestamp}.jpg`);
    
    // Simpan media ke file dengan penanganan error yang lebih baik
    let buffer;
    try {
      const stream = await downloadContentFromMessage(mediaMessage, 'image');
      
      buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }
      
      // Pastikan buffer tidak kosong
      if (buffer.length === 0) {
        throw new Error('Media buffer kosong');
      }
      
      // Coba simpan file
      await fs.writeFile(mediaPath, buffer);
      
      // Verifikasi file tersimpan
      const stats = await fs.stat(mediaPath);
      if (stats.size === 0) {
        throw new Error('File tersimpan kosong');
      }
      
      return mediaPath;
      
    } catch (downloadError) {
      console.error('Error saat mengunduh media:', downloadError.message);
      
      // Coba alternatif download jika tersedia
      if (mediaMessage.url) {
        try {
          const response = await fetch(mediaMessage.url);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          buffer = await response.buffer();
          
          // Pastikan buffer tidak kosong
          if (buffer.length === 0) {
            throw new Error('Media buffer dari URL kosong');
          }
          
          // Simpan dan verifikasi file
          await fs.writeFile(mediaPath, buffer);
          const stats = await fs.stat(mediaPath);
          if (stats.size === 0) {
            throw new Error('File tersimpan dari URL kosong');
          }
          
          return mediaPath;
        } catch (fetchError) {
          console.error('Error saat mengunduh dari URL:', fetchError.message);
          throw new Error('Gagal mengunduh media dari URL');
        }
      }
      
      throw new Error('Gagal menyimpan media pengaduan');
    }
  } catch (error) {
    console.error('Error saat menyimpan media pengaduan:', error.message);
    throw error;
  }
};

// Fungsi untuk mengirim notifikasi ke admin saat ada pengaduan baru
const notifyAdminsOfComplaintOld = async (sock, complaint) => {
  try {
    const adminPath = path.join(__dirname, '../database/admins.json');
    if (!fs.existsSync(adminPath)) {
      console.log('Admin file not found, skipping notification');
      return;
    }
    
    const adminData = JSON.parse(fs.readFileSync(adminPath, 'utf8'));
    const admins = adminData.admins || [];
    
    const date = new Date().toLocaleDateString('id-ID');
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    
    let notificationMessage = '🚨 *PENGADUAN BARU*\n\n';
    notificationMessage += `📋 *Info Pengaduan:*\n`;
    notificationMessage += `• ID: ${complaint.id}\n`;
    notificationMessage += `• Nama: ${complaint.reporter_name}\n`;
    notificationMessage += `• Alamat: ${complaint.reporter_address}\n`;
    notificationMessage += `• Deskripsi: ${complaint.description}\n\n`;
    notificationMessage += `📅 Tanggal: ${date} ${time}\n\n`;
    notificationMessage += '⚡ *Perintah Admin:*\n';
    notificationMessage += `• Detail: !detail_pengaduan ${complaint.id}\n`;
    notificationMessage += `• Update: !update_status ${complaint.id} [status]`;
    
    // Kirim notifikasi ke semua admin
    for (const admin of admins) {
      if (admin.phone_number) {
        const adminJid = admin.phone_number.includes('@') ? admin.phone_number : `${admin.phone_number}@s.whatsapp.net`;
        try {
          await sock.sendMessage(adminJid, { text: notificationMessage });
          console.log(`Notification sent to admin: ${admin.username}`);
        } catch (error) {
          console.error(`Failed to send notification to admin ${admin.username}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('Error notifying admins of complaint:', error.message);
  }
};

// Fungsi untuk mengirim notifikasi update status ke pengadu
const notifyComplainantStatusUpdateOld = async (sock, complaint, newStatus) => {
  try {
    const statusMessages = {
      'pending': '⏳ Menunggu Proses',
      'processing': '🔄 Sedang Diproses',
      'resolved': '✅ Selesai',
      'rejected': '❌ Ditolak'
    };
    
    const statusEmoji = {
      'pending': '⏳',
      'processing': '🔄',
      'resolved': '✅',
      'rejected': '❌'
    };
    
    const date = new Date().toLocaleDateString('id-ID');
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    
    let updateMessage = `${statusEmoji[newStatus]} *UPDATE PENGADUAN*\n\n`;
    updateMessage += `📋 *Info Pengaduan:*\n`;
    updateMessage += `• ID: ${complaint.id}\n`;
    updateMessage += `• Nama: ${complaint.reporter_name}\n`;
    updateMessage += `• Status: ${statusMessages[newStatus]}\n`;
    updateMessage += `• Tanggal: ${date} ${time}\n\n`;
    
    if (newStatus === 'processing') {
      updateMessage += '🔄 Pengaduan sedang diproses\n';
    } else if (newStatus === 'resolved') {
      updateMessage += '✅ Pengaduan telah selesai\n';
    } else if (newStatus === 'rejected') {
      updateMessage += '❌ Pengaduan tidak dapat diproses\n';
    }
    
    // Kirim notifikasi ke pengadu
    const complainantJid = complaint.phone_number.includes('@') ? complaint.phone_number : `${complaint.phone_number}@s.whatsapp.net`;
    
    await sock.sendMessage(complainantJid, { text: updateMessage });
    console.log(`Status update notification sent to complainant: ${complaint.phone_number}`);
    
  } catch (error) {
    console.error('Error notifying complainant of status update:', error.message);
  }
};

// Fungsi untuk menyimpan file media berita
const saveNewsMedia = async (msg) => {
  try {
    // Cek apakah pesan mengandung media
    if (!msg.message?.imageMessage && !msg.message?.videoMessage) {
      return null;
    }
    
    // Buat direktori untuk menyimpan media jika belum ada
    const mediaDir = path.join(process.cwd(), 'uploads', 'news');
    await fs.ensureDir(mediaDir);
    
    // Generate nama file unik
    const timestamp = new Date().getTime();
    const mediaPath = path.join(mediaDir, `news_${timestamp}.jpg`);
    
    // Simpan media ke file
    const stream = await downloadContentFromMessage(
      msg.message.imageMessage || msg.message.videoMessage,
      msg.message.imageMessage ? 'image' : 'video'
    );
    
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    
    await fs.writeFile(mediaPath, buffer);
    
    return mediaPath;
  } catch (error) {
    console.error('Error saving news media:', error.message);
    return null;
  }
};

// Fungsi untuk menyimpan file media wisata
const saveTourismMedia = async (msg) => {
  try {
    // Cek apakah pesan mengandung media
    if (!msg.message?.imageMessage && !msg.message?.videoMessage) {
      return null;
    }
    
    // Buat direktori untuk menyimpan media jika belum ada
    const mediaDir = path.join(process.cwd(), 'uploads', 'village_info');
    await fs.ensureDir(mediaDir);
    
    // Generate nama file unik
    const timestamp = new Date().getTime();
    const mediaPath = path.join(mediaDir, `tourism_${timestamp}.jpg`);
    
    // Simpan media ke file
    const stream = await downloadContentFromMessage(
      msg.message.imageMessage || msg.message.videoMessage,
      msg.message.imageMessage ? 'image' : 'video'
    );
    
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    
    await fs.writeFile(mediaPath, buffer);
    
    return mediaPath;
  } catch (error) {
    console.error('Error saving tourism media:', error.message);
    return null;
  }
};

// Fungsi untuk mengirim notifikasi pengaduan baru ke superadmin menggunakan NotificationSystem
const notifyAdminsOfComplaint = async (sock, complaint) => {
  try {
    const NotificationSystem = require('../utils/notificationSystem');
    const notificationSystem = new NotificationSystem();
    
    // Format nomor telepon ke format 08
    let formattedPhone = complaint.phone_number;
    if (formattedPhone.startsWith('62')) {
      formattedPhone = '0' + formattedPhone.substring(2);
    } else if (formattedPhone.startsWith('+62')) {
      formattedPhone = '0' + formattedPhone.substring(3);
    }
    
    // Buat pesan notifikasi dengan nomor telepon
    const notificationData = {
      ...complaint,
      formatted_phone: formattedPhone
    };
    
    // Kirim notifikasi menggunakan sistem notifikasi yang baru
    await notificationSystem.sendSuperAdminNotification(sock, 'new_complaint', notificationData);
    
    // Jika ada foto, kirim foto terpisah ke superadmin
    if (complaint.photo_path && fs.existsSync(complaint.photo_path)) {
      const adminModel = new JSONAdmin();
      const superadmins = adminModel.getSuperAdmins();
      
      const date = new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const time = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      for (const superadmin of superadmins) {
        if (superadmin.phone_number) {
          const jid = superadmin.phone_number.includes('@') ? 
            superadmin.phone_number : `${superadmin.phone_number}@s.whatsapp.net`;
          
          try {
            const buffer = fs.readFileSync(complaint.photo_path);
            
            // Buat caption yang lebih informatif
            const caption = `📸 *FOTO PENGADUAN #${complaint.id}*\n\n` +
                          `👤 Pelapor: ${complaint.reporter_name}\n` +
                          `📍 Alamat: ${complaint.reporter_address}\n` +
                          `📱 Telepon: ${formattedPhone}\n` +
                          `📝 Aduan: ${complaint.description}\n\n` +
                          `📅 Tanggal: ${date}\n` +
                          `⏰ Waktu: ${time}\n\n` +
                          `⚡ *Perintah Admin:*\n` +
                          `• Detail: !detail_pengaduan ${complaint.id}\n` +
                          `• Update: !update_status ${complaint.id} [status]`;
            
            // Kirim media dengan caption dan fallback ke dokumen jika gagal
            await sock.sendMessage(jid, { 
              image: buffer,
              mimetype: 'image/jpeg',
              caption: caption
            }).catch(async (error) => {
              console.error(`Failed to send image to superadmin ${superadmin.username}:`, error.message);
              // Jika gagal kirim sebagai gambar, coba kirim sebagai dokumen
              try {
                await sock.sendMessage(jid, {
                  document: buffer,
                  mimetype: 'image/jpeg',
                  fileName: `pengaduan_${complaint.id}.jpg`,
                  caption: caption
                });
              } catch (docError) {
                console.error(`Failed to send document to superadmin ${superadmin.username}:`, docError.message);
              }
            });
          } catch (err) {
            console.error(`Gagal mengirim media ke superadmin ${jid}:`, err.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error notifying admins of complaint:', error.message);
  }
};

// Fungsi untuk mengirim notifikasi ke pengadu ketika status berubah
const notifyComplainantStatusUpdate = async (sock, complaint, newStatus) => {
  try {
    if (!complaint.phone_number) {
      console.log('No phone number found for complaint:', complaint.id);
      return;
    }

    const jid = complaint.phone_number.includes('@') ? complaint.phone_number : `${complaint.phone_number}@s.whatsapp.net`;
    
    let statusText = '';
    let message = '';
    
    switch (newStatus) {
      case 'pending':
        statusText = '⏳ Menunggu';
        message = `🔔 *NOTIFIKASI PENGADUAN*\n\n` +
                 `Pengaduan Anda dengan ID *${complaint.id}* telah diterima dan sedang menunggu proses.\n\n` +
                 `📝 *Deskripsi:* ${complaint.description}\n\n` +
                 `📊 *Status:* ${statusText}\n\n` +
                 `Terima kasih atas laporan Anda. Tim kami akan segera menindaklanjuti.`;
        break;
      case 'processing':
        statusText = '🔄 Sedang Diproses';
        message = `🔔 *UPDATE PENGADUAN*\n\n` +
                 `Pengaduan Anda dengan ID *${complaint.id}* sedang dalam proses penanganan.\n\n` +
                 `📝 *Deskripsi:* ${complaint.description}\n\n` +
                 `📊 *Status:* ${statusText}\n\n` +
                 `Tim kami sedang bekerja untuk menyelesaikan masalah Anda.`;
        break;
      case 'resolved':
        statusText = '✅ Selesai';
        message = `🎉 *PENGADUAN SELESAI*\n\n` +
                 `Pengaduan Anda dengan ID *${complaint.id}* telah selesai ditangani.\n\n` +
                 `📝 *Deskripsi:* ${complaint.description}\n\n` +
                 `📊 *Status:* ${statusText}\n\n` +
                 `Terima kasih atas kesabaran Anda. Semoga masalah telah teratasi dengan baik.`;
        break;
      case 'rejected':
        statusText = '❌ Ditolak';
        message = `📋 *PENGADUAN DITOLAK*\n\n` +
                 `Pengaduan Anda dengan ID *${complaint.id}* tidak dapat diproses.\n\n` +
                 `📝 *Deskripsi:* ${complaint.description}\n\n` +
                 `📊 *Status:* ${statusText}\n\n` +
                 `Mohon maaf, pengaduan tidak memenuhi kriteria atau di luar kewenangan kami.`;
        break;
      default:
        return;
    }

    await sock.sendMessage(jid, { text: message });
    console.log(`Notifikasi status '${newStatus}' berhasil dikirim ke ${complaint.phone_number}`);
    
  } catch (error) {
    console.error('Error sending status notification to complainant:', error.message);
  }
};

module.exports = {
  formatComplaintForm,
  processComplaintSubmission,
  getComplaintListForAdmin,
  getComplaintDetailForAdmin,
  updateComplaintStatus,
  saveComplaintMedia,
  saveNewsMedia,
  saveTourismMedia,
  notifyComplainantStatusUpdate,
  notifyAdminsOfComplaint,
  notifyAdminsOfComplaintOld,
  notifyComplainantStatusUpdateOld
};