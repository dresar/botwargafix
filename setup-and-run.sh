#!/bin/bash

echo "========================================"
echo "    BOT WHATSAPP SETUP DAN JALANKAN"
echo "========================================"
echo

# Cek Node.js
echo "[INFO] Memeriksa instalasi Node.js..."
if ! command -v node &> /dev/null; then
    echo "[WARNING] Node.js belum terinstal!"
    echo "[INFO] Menginstal Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "[OK] Node.js sudah terinstal: $(node --version)"
fi

echo
echo "========================================"
echo "        PEMBERSIHAN CACHE"
echo "========================================"

# Bersihkan cache
echo "[INFO] Membersihkan cache npm..."
npm cache clean --force

if [ -d "node_modules" ]; then
    echo "[INFO] Menghapus folder node_modules..."
    rm -rf node_modules
fi

if [ -f "package-lock.json" ]; then
    echo "[INFO] Menghapus package-lock.json..."
    rm -f package-lock.json
fi

echo "[OK] Cache berhasil dibersihkan!"

echo
echo "========================================"
echo "       INSTALASI DEPENDENCIES"
echo "========================================"

echo "[INFO] Menginstal dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "[ERROR] Gagal menginstal dependencies!"
    exit 1
fi

echo "[OK] Dependencies berhasil diinstal!"

echo
echo "========================================"
echo "         INSTALASI PM2"
echo "========================================"

if ! command -v pm2 &> /dev/null; then
    echo "[WARNING] PM2 belum terinstal!"
    echo "[INFO] Menginstal PM2 secara global..."
    npm install -g pm2
    
    if [ $? -ne 0 ]; then
        echo "[ERROR] Gagal menginstal PM2!"
        exit 1
    fi
    
    echo "[OK] PM2 berhasil diinstal!"
else
    echo "[OK] PM2 sudah terinstal: $(pm2 --version)"
fi

echo
echo "========================================"
echo "         MENJALANKAN BOT WHATSAPP"
echo "========================================"

# Hentikan PM2 yang mungkin sedang berjalan
echo "[INFO] Menghentikan instance PM2 yang ada..."
pm2 stop whatsapp-bot 2>/dev/null
pm2 delete whatsapp-bot 2>/dev/null

echo "[INFO] Memulai bot WhatsApp dengan PM2..."
pm2 start ecosystem.config.js

if [ $? -ne 0 ]; then
    echo "[ERROR] Gagal memulai bot dengan PM2!"
    echo "[INFO] Mencoba menjalankan dengan Node.js biasa..."
    node index.js
else
    echo "[OK] Bot WhatsApp berhasil dimulai dengan PM2!"
    echo
    echo "[INFO] Perintah berguna:"
    echo "  - pm2 logs whatsapp-bot    : Lihat log dan QR code"
    echo "  - pm2 status              : Status aplikasi"
    echo "  - pm2 restart whatsapp-bot: Restart bot"
    echo "  - pm2 stop whatsapp-bot   : Hentikan bot"
    echo "  - pm2 monit              : Monitor real-time"
    echo
    echo "[INFO] Menampilkan log untuk melihat QR Code..."
    sleep 3
    pm2 logs whatsapp-bot --lines 50
fi

echo
echo "========================================"
echo "[INFO] Setup selesai!"