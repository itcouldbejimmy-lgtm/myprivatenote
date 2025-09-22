const express = require('express');
const cors = require('cors');
const path = require('path');
const { customAlphabet } = require('nanoid');
const { readStats, incrementCreated, incrementRead } = require('./statsStore');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// In-memory store for one-time notes (destroyed on read, no expiry)
const noteIdToEncryptedData = new Map();
// Simple in-memory stats (resets on process restart)
// Persistent stats (backed by JSON file)
let { totalNotesCreated, totalNotesRead } = readStats();
const generateNoteId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);

// No TTL cleanup required

// Create a one-time note
app.post('/api/notes', (req, res) => {
    const { encryptedPayload } = req.body || {};
    if (typeof encryptedPayload !== 'string' || encryptedPayload.length === 0) {
        return res.status(400).json({ error: 'encryptedPayload is required' });
    }
    const noteId = generateNoteId();
    noteIdToEncryptedData.set(noteId, { encryptedPayload });
    totalNotesCreated += 1; incrementCreated();
    res.json({ noteId });
});

// Read a one-time note (destroys on read)
app.get('/api/notes/:id', (req, res) => {
    const id = req.params.id;
    const record = noteIdToEncryptedData.get(id);
    if (!record) {
        return res.status(404).json({ error: 'Note not found or already read' });
    }
    noteIdToEncryptedData.delete(id);
    totalNotesRead += 1; incrementRead();
    res.json({ encryptedPayload: record.encryptedPayload });
});

// Basic stats endpoint
app.get('/api/stats', (_req, res) => {
    res.json({
        totalNotesCreated,
        totalNotesRead,
        currentlyStored: noteIdToEncryptedData.size
    });
});

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all to serve SPA index for any non-API route
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});


