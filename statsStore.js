const fs = require('fs');
const path = require('path');

const dataDirPath = path.join(__dirname, 'data');
const statsFilePath = path.join(dataDirPath, 'stats.json');

function ensureDataFileExists() {
    if (!fs.existsSync(dataDirPath)) {
        fs.mkdirSync(dataDirPath, { recursive: true });
    }
    if (!fs.existsSync(statsFilePath)) {
        fs.writeFileSync(statsFilePath, JSON.stringify({ totalNotesCreated: 0, totalNotesRead: 0 }, null, 2));
    }
}

function readStats() {
    try {
        ensureDataFileExists();
        const raw = fs.readFileSync(statsFilePath, 'utf8');
        const json = JSON.parse(raw || '{}');
        return {
            totalNotesCreated: Number(json.totalNotesCreated) || 0,
            totalNotesRead: Number(json.totalNotesRead) || 0
        };
    } catch (_) {
        return { totalNotesCreated: 0, totalNotesRead: 0 };
    }
}

function writeStats(stats) {
    ensureDataFileExists();
    fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
}

function incrementCreated() {
    const stats = readStats();
    stats.totalNotesCreated += 1;
    writeStats(stats);
}

function incrementRead() {
    const stats = readStats();
    stats.totalNotesRead += 1;
    writeStats(stats);
}

module.exports = { readStats, incrementCreated, incrementRead };


