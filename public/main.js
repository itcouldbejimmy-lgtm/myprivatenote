// Utility: base64
function toBase64Url(bytes) {
    const bin = String.fromCharCode(...bytes);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(b64url) {
    const pad = '==='.slice((b64url.length + 3) % 4);
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const str = atob(b64);
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
    return bytes;
}

async function generateKeyAndEncrypt(plaintext) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data));
    const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    return {
        encryptedPayload: `${toBase64Url(iv)}.${toBase64Url(ciphertext)}`,
        keyB64: toBase64Url(rawKey)
    };
}

async function decryptWithKey(encryptedPayload, keyB64) {
    const [ivB64, ctB64] = encryptedPayload.split('.');
    const iv = fromBase64Url(ivB64);
    const ciphertext = fromBase64Url(ctB64);
    const rawKey = fromBase64Url(keyB64);
    const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
    const plaintextBytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext));
    return new TextDecoder().decode(plaintextBytes);
}

const createView = document.getElementById('create-view');
const linkView = document.getElementById('link-view');
const readView = document.getElementById('read-view');
const notFoundView = document.getElementById('not-found');

const noteInput = document.getElementById('note-input');
const createBtn = document.getElementById('create-btn');
const shareLink = document.getElementById('share-link');
const copyBtn = document.getElementById('copy-btn');
const newBtn = document.getElementById('new-btn');
const destroyedNewBtn = document.getElementById('destroyed-new-btn');
const backBtn = document.getElementById('back-btn');
const noteDisplay = document.getElementById('note-display');

// Starfield animation
const starsCanvas = document.getElementById('stars');
const ctx = starsCanvas?.getContext?.('2d');
let stars = [];
let width = 0, height = 0, dpr = 1;
function resize() {
    if (!starsCanvas || !ctx) return;
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    width = window.innerWidth;
    height = window.innerHeight;
    starsCanvas.width = Math.floor(width * dpr);
    starsCanvas.height = Math.floor(height * dpr);
    starsCanvas.style.width = width + 'px';
    starsCanvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    spawnStars();
}
function spawnStars() {
    const count = Math.floor((width * height) / 8000);
    stars = new Array(count).fill(0).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.6 + 0.2,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        tw: Math.random() * 2 * Math.PI
    }));
}
function step() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    for (const s of stars) {
        s.x += s.vx; s.y += s.vy; s.tw += 0.02;
        if (s.x < 0) s.x = width; if (s.x > width) s.x = 0;
        if (s.y < 0) s.y = height; if (s.y > height) s.y = 0;
        const alpha = 0.6 + 0.4 * Math.sin(s.tw);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(step);
}
if (starsCanvas && ctx) {
    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(step);
}

function show(view) {
    for (const v of [createView, linkView, readView, notFoundView]) v.classList.add('hidden');
    view.classList.remove('hidden');
}

createBtn?.addEventListener('click', async () => {
    const text = (noteInput.value || '').trim();
    if (!text) return;
    createBtn.disabled = true;
    try {
        const { encryptedPayload, keyB64 } = await generateKeyAndEncrypt(text);
        const resp = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptedPayload })
        });
        if (!resp.ok) throw new Error('Failed to create note');
        const { noteId } = await resp.json();
        const url = `${location.origin}/n/${noteId}#${keyB64}`;
        shareLink.value = url;
        show(linkView);
    } catch (e) {
        alert('Error creating note.');
    } finally {
        createBtn.disabled = false;
    }
});

copyBtn?.addEventListener('click', async () => {
    if (!shareLink.value) return;
    try { await navigator.clipboard.writeText(shareLink.value); copyBtn.textContent = 'Copied!'; setTimeout(()=>copyBtn.textContent='Copy Link', 1200); } catch {}
});

newBtn?.addEventListener('click', () => { location.href = '/'; });
destroyedNewBtn?.addEventListener('click', () => { location.href = '/'; });
backBtn?.addEventListener('click', () => { location.href = '/'; });

async function tryReadNote() {
    if (!location.pathname.startsWith('/n/')) return;
    const id = location.pathname.split('/n/')[1];
    const keyB64 = location.hash.startsWith('#') ? location.hash.slice(1) : '';
    if (!id || !keyB64) {
        show(notFoundView);
        return;
    }
    try {
        const resp = await fetch(`/api/notes/${id}`);
        if (!resp.ok) { show(notFoundView); return; }
        const { encryptedPayload } = await resp.json();
        const plaintext = await decryptWithKey(encryptedPayload, keyB64);
        noteDisplay.textContent = plaintext;
        show(readView);
        history.replaceState({}, '', '/'); // prevent re-reading link on refresh
    } catch (e) {
        show(notFoundView);
    }
}

tryReadNote();


