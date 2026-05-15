const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

/**
 * 💾 Database Backup Script
 * ------------------------
 * Handles local SQLite backup. 
 * For PostgreSQL/MySQL, this should be updated to use pg_dump / mysqldump.
 */

const backupDir = path.join(__dirname, '../backups');
const dbFile = path.join(__dirname, '../database.sqlite');

if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `backup-${timestamp}.sqlite`);

async function runBackup() {
    console.log('🚀 Starting Database Backup...');

    if (fs.existsSync(dbFile)) {
        // SQLite Backup (Copy file)
        try {
            fs.copyFileSync(dbFile, backupPath);
            console.log(`✅ SQLite Backup successful: ${backupPath}`);
            
            // Clean up old backups (older than 7 days)
            const files = fs.readdirSync(backupDir);
            const now = Date.now();
            files.forEach(file => {
                const filePath = path.join(backupDir, file);
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > 7 * 24 * 60 * 60 * 1000) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️ Deleted old backup: ${file}`);
                }
            });
        } catch (err) {
            console.error('❌ SQLite Backup failed:', err);
        }
    } else {
        console.warn('⚠️ No local SQLite file found. If using PostgreSQL/MySQL, please use cloud-native backup tools or update this script.');
    }
}

runBackup();
