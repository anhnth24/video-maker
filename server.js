// Chùa online - TikTok Live overlay server
// Kết nối TikTok Live (tiktok-live-connector), chuẩn hoá event, đẩy xuống trình duyệt qua Socket.IO.
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');

const PORT = Number(process.env.PORT) || 3000;
const SIGN_API_KEY = process.env.SIGN_API_KEY || undefined; // Euler Stream key (tuỳ chọn)

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server);

let connection = null;
let status = { state: 'idle', username: null, error: null, viewers: 0 };

function setStatus(patch) {
  status = { ...status, ...patch };
  io.emit('status', status);
}

function toUser(u) {
  if (!u) return null;
  const id = String(u.uniqueId || u.userId || '');
  if (!id) return null;
  return {
    id,
    nickname: u.nickname || u.uniqueId || 'Ẩn danh',
    avatar: u.profilePicture?.url?.[0] || null,
  };
}

function emitEvent(evt) {
  io.emit('live', evt);
}

async function connect(username) {
  await disconnect();
  setStatus({ state: 'connecting', username, error: null });

  const conn = new TikTokLiveConnection(username, {
    signApiKey: SIGN_API_KEY,
    processInitialData: false,
    enableExtendedGiftInfo: true,
  });
  connection = conn;

  conn.on(WebcastEvent.MEMBER, (d) => {
    const user = toUser(d.user);
    if (user) emitEvent({ type: 'join', user });
  });

  conn.on(WebcastEvent.CHAT, (d) => {
    const user = toUser(d.user);
    if (user) emitEvent({ type: 'chat', user, text: d.comment || '' });
  });

  conn.on(WebcastEvent.LIKE, (d) => {
    const user = toUser(d.user);
    if (user) emitEvent({ type: 'like', user, count: d.likeCount || 1 });
  });

  conn.on(WebcastEvent.GIFT, (d) => {
    const giftType = d.giftDetails?.giftType;
    // Gift dạng streak (giftType 1): chỉ xử lý khi streak kết thúc
    if (giftType === 1 && !d.repeatEnd) return;
    const user = toUser(d.user);
    if (!user) return;
    const info = d.extendedGiftInfo || {};
    emitEvent({
      type: 'gift',
      user,
      gift: {
        id: d.giftId,
        name: d.giftDetails?.giftName || info.name || 'Quà',
        count: d.repeatCount || 1,
        diamonds: d.giftDetails?.diamondCount || info.diamond_count || 0,
        image: d.giftDetails?.giftImage?.url?.[0] || info.image?.url_list?.[0] || null,
      },
    });
  });

  conn.on(WebcastEvent.ROOM_USER, (d) => {
    if (typeof d.viewerCount === 'number') setStatus({ viewers: d.viewerCount });
  });

  conn.on(WebcastEvent.STREAM_END, () => setStatus({ state: 'ended' }));
  if (ControlEvent?.DISCONNECTED) {
    conn.on(ControlEvent.DISCONNECTED, () => {
      if (connection === conn) setStatus({ state: 'disconnected' });
    });
  }
  if (ControlEvent?.ERROR) {
    conn.on(ControlEvent.ERROR, (e) => console.error('[tiktok] error', e?.info || e));
  }

  try {
    const state = await conn.connect();
    console.log(`[tiktok] connected to @${username}, roomId=${state.roomId}`);
    setStatus({ state: 'connected' });
  } catch (err) {
    console.error('[tiktok] connect failed:', err?.message || err);
    if (connection === conn) connection = null;
    setStatus({ state: 'error', error: err?.message || String(err) });
    throw err;
  }
}

async function disconnect() {
  if (!connection) return;
  const conn = connection;
  connection = null;
  try { await conn.disconnect(); } catch (_) { /* ignore */ }
  setStatus({ state: 'idle' });
}

app.get('/api/status', (_req, res) => res.json(status));

app.post('/api/connect', async (req, res) => {
  const username = String(req.body?.username || '').trim().replace(/^@/, '');
  if (!username) return res.status(400).json({ error: 'Thiếu username' });
  try {
    await connect(username);
    res.json(status);
  } catch (err) {
    res.status(502).json({ error: err?.message || String(err) });
  }
});

app.post('/api/disconnect', async (_req, res) => {
  await disconnect();
  res.json(status);
});

// Giả lập event để test khi không có live: POST /api/simulate {type, user?, gift?}
app.post('/api/simulate', (req, res) => {
  const evt = req.body;
  if (!evt?.type || !evt?.user?.id) return res.status(400).json({ error: 'Cần type và user.id' });
  emitEvent(evt);
  res.json({ ok: true });
});

io.on('connection', (socket) => socket.emit('status', status));

server.listen(PORT, () => {
  console.log(`Chùa online đang chạy: http://localhost:${PORT}`);
  console.log(`Overlay (ẩn bảng điều khiển): http://localhost:${PORT}/?overlay=1`);
  if (process.env.TIKTOK_USERNAME) {
    connect(process.env.TIKTOK_USERNAME).catch(() => {});
  }
});
