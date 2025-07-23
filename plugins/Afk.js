import fs from 'fs';

const AUDIO_PATH = './Categorizador/Efect Plugins/SPIDERMAN BLACK SUIT THEME EFFECT SOUND  turururu tutuuu.mp3';
const AFK_TIMEOUT = 5 * 60 * 1000;
const AFK_MAX_DURATION = 12 * 60 * 60 * 1000; // 12 horas
const AFK_REMINDER_INTERVAL = 10 * 60 * 1000; // 10 minutos
const STATS_SUMMARY_INTERVAL = 60 * 60 * 1000; // 1 hora

const AFK_FILE = './Categorizador/db/afkData.json';
const ACTIVOS_FILE = './Categorizador/db/activosData.json';

// 🧠 Estado en memoria
let afkMap = new Map();
let activosMap = new Map();
let afkLastReminders = new Map(); // Para evitar spam en recordatorios
let lastStatsSummary = Date.now();

// 🧠 Cargar archivos
try {
  if (fs.existsSync(AFK_FILE)) {
    afkMap = new Map(JSON.parse(fs.readFileSync(AFK_FILE, 'utf-8')));
  }
  if (fs.existsSync(ACTIVOS_FILE)) {
    activosMap = new Map(JSON.parse(fs.readFileSync(ACTIVOS_FILE, 'utf-8')));
  }
} catch (err) {
  console.error('❌ Error al cargar archivos JSON:', err);
  afkMap = new Map();
  activosMap = new Map();
}

// 💾 Guardar
function guardarAFK() {
  try {
    fs.writeFileSync(AFK_FILE, JSON.stringify([...afkMap]), 'utf-8');
  } catch (err) {
    console.error('❌ Error al guardar afkData.json:', err);
  }
}
function guardarActivos() {
  try {
    fs.writeFileSync(ACTIVOS_FILE, JSON.stringify([...activosMap]), 'utf-8');
  } catch (err) {
    console.error('❌ Error al guardar activosData.json:', err);
  }
}

function msToTime(ms) {
  const secs = Math.floor(ms / 1000) % 60;
  const mins = Math.floor(ms / (1000 * 60)) % 60;
  const hrs = Math.floor(ms / (1000 * 60 * 60)) % 24;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hrs) parts.push(`${hrs}h`);
  if (mins) parts.push(`${mins}m`);
  if (secs || parts.length === 0) parts.push(`${secs}s`);
  return parts.join(' ');
}

function getTextFromMessage(msg) {
  return (
    msg?.message?.conversation ||
    msg?.message?.extendedTextMessage?.text ||
    msg?.message?.imageMessage?.caption ||
    msg?.message?.videoMessage?.caption ||
    ''
  ).trim();
}
function getMentions(msg) {
  return msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}

// 🧹 Limpieza automática de inactivos
function limpiezaAutomatica() {
  const ahora = Date.now();
  let cambiosAFK = false;
  let cambiosActivos = false;

  // Eliminar de activos después de 5 min
  for (const [user, time] of activosMap) {
    if (ahora - time > AFK_TIMEOUT) {
      activosMap.delete(user);
      cambiosActivos = true;
    }
  }

  // Eliminar de AFK si llevan más de 12h
  for (const [user, data] of afkMap) {
    if (ahora - data.since > AFK_MAX_DURATION) {
      afkMap.delete(user);
      afkLastReminders.delete(user);
      cambiosAFK = true;
    }
  }

  if (cambiosAFK) guardarAFK();
  if (cambiosActivos) guardarActivos();
}

export default function (sock) {
  // 🔁 Verificaciones periódicas
  setInterval(() => {
    limpiezaAutomatica();

    const ahora = Date.now();

    // 🔔 Recordatorio de AFK cada 10 min
    for (const [user, data] of afkMap) {
      const lastReminder = afkLastReminders.get(user) || 0;
      if (ahora - data.since > AFK_REMINDER_INTERVAL && ahora - lastReminder > AFK_REMINDER_INTERVAL) {
        afkLastReminders.set(user, ahora);
        sock.sendMessage(user, {
          text: `⏰ Sigues en modo AFK.\n📝 Motivo: _${data.reason}_\n⏳ Tiempo: *${msToTime(ahora - data.since)}*`,
        }).catch(console.error);
      }
    }

    // 📊 Resumen cada hora
    if (ahora - lastStatsSummary > STATS_SUMMARY_INTERVAL) {
      lastStatsSummary = ahora;
      if (afkMap.size || activosMap.size) {
        let resumen = '🕒 *Resumen automático:*\n';
        if (afkMap.size) resumen += `🌙 Usuarios AFK: ${afkMap.size}\n`;
        if (activosMap.size) resumen += `✅ Activos recientemente: ${activosMap.size}\n`;
        resumen += `🧠 Última limpieza: ${new Date().toLocaleTimeString()}`;

        // Puedes cambiar esto para enviarlo a un grupo específico:
        sock.sendMessage('status@broadcast', { text: resumen }).catch(console.error);
      }
    }
  }, 60 * 1000); // Cada 1 minuto

  // 🔁 Evento de mensajes
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const msg = messages?.[0];
      if (!msg?.message || msg.key.fromMe) return;

      const from = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;
      const pushName = msg.pushName || 'Usuario';
      const text = getTextFromMessage(msg);
      if (!text) return;

      const lower = text.toLowerCase();

      // 📊 Comando !afk stats
      if (lower === '!afk stats' || lower === '!afk status') {
        limpiezaAutomatica();
        const ahora = Date.now();
        let output = '📊 *Estado AFK/ACTIVO:*\n━━━━━━━━━━━━━━\n';

        if (afkMap.size === 0 && activosMap.size === 0) {
          output += '😴 Nadie está en AFK ni ha vuelto recientemente.';
        } else {
          for (const [user, data] of afkMap) {
            output += `🌙 AFK: @${user.split('@')[0]} – _${msToTime(ahora - data.since)}_\n`;
          }
          for (const [user, time] of activosMap) {
            output += `✅ Activo: @${user.split('@')[0]} – _${msToTime(ahora - time)}_\n`;
          }
        }

        output += '━━━━━━━━━━━━━━';
        await sock.sendMessage(from, {
          text: output,
          mentions: [...afkMap.keys(), ...activosMap.keys()],
        });
        return;
      }

      // 💤 Activar AFK
      if (lower.startsWith('!afk') && !lower.startsWith('!afk stats') && !lower.startsWith('!afk status')) {
        const reason = text.slice(4).trim() || 'Sin motivo';

        if (afkMap.has(sender)) {
          await sock.sendMessage(from, {
            text: `⚠️ *${pushName}*, ya estás en modo AFK.\n📝 Motivo: _${afkMap.get(sender).reason}_`,
          });
          return;
        }

        afkMap.set(sender, { reason, since: Date.now() });
        guardarAFK();

        await sock.sendMessage(from, {
          text: `🌙 *${pushName}* ha activado el modo AFK.\n📝 Motivo: _${reason}_`,
        });
        return;
      }

      // 🔔 Regreso del AFK
      if (afkMap.has(sender)) {
        const data = afkMap.get(sender);
        afkMap.delete(sender);
        afkLastReminders.delete(sender);
        guardarAFK();

        activosMap.set(sender, Date.now());
        guardarActivos();

        await sock.sendMessage(from, {
          text: `🔔 *${pushName}* ha vuelto del modo AFK.\n⏳ Estuviste fuera durante: *${msToTime(Date.now() - data.since)}*`,
        });

        try {
          if (fs.existsSync(AUDIO_PATH)) {
            const audioBuffer = fs.readFileSync(AUDIO_PATH);
            await sock.sendMessage(from, {
              audio: audioBuffer,
              mimetype: 'audio/mp4',
              ptt: true,
            });
          }
        } catch (err) {
          console.error(`❌ Error al enviar nota de voz: ${err.message}`);
        }

        return;
      }

      // 👀 Avisar si se menciona a alguien AFK
      const mentions = getMentions(msg);
      const ahora = Date.now();

      for (const mention of mentions) {
        if (afkMap.has(mention)) {
          const data = afkMap.get(mention);
          const tiempo = msToTime(ahora - data.since);
          await sock.sendMessage(from, {
            text: `🕵️‍♂️ @${mention.split('@')[0]} está en modo AFK.\n📝 Motivo: _${data.reason}_\n⏳ Desde hace: *${tiempo}*`,
            mentions: [mention],
          });
        }
      }

    } catch (err) {
      console.error('❌ Error en AFK Handler:', err);
    }
  });
}
