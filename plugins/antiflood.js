import fs from 'fs';
import path from 'path';

// Función auxiliar para verificar si el usuario es admin
async function isUserAdmin(sock, groupId, userId) {
  const metadata = await sock.groupMetadata(groupId);
  const participant = metadata.participants.find(p => p.id === userId);
  return participant && ['admin', 'superadmin'].includes(participant?.admin);
}

// Función para verificar flood de caracteres repetidos
function isRepeatedChar(str) {
  return /^([^\s])\1{4,}$/.test(str); // ej: aaaaa, !!!!!!, 00000
}

// Función para contar caracteres únicos
function uniqueCharRatio(str) {
  const unique = new Set(str.replace(/\s/g, '').split(''));
  return unique.size / str.length;
}

export default async function antifloodPlugin(sock) {
  const dbDir = './Categorizador/db';
  const dbFile = path.join(dbDir, 'antiflood.json');

  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify({ settings: {}, data: {}, logs: { logGroupId: null, whitelist: [] } }, null, 2));
  }

  let floodDB = JSON.parse(fs.readFileSync(dbFile));

  const saveDB = () => fs.writeFileSync(dbFile, JSON.stringify(floodDB, null, 2));
  const FLOOD_LIMIT = 5;
  const TIME_WINDOW = 7000;
  const MAX_WARNINGS = 3;
  const RESET_WARNINGS = 10 * 60 * 1000;

  const recentMessages = {};

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || !m.key.remoteJid.endsWith('@g.us') || m.key.fromMe) return;

    const groupId = m.key.remoteJid;
    const sender = m.key.participant;
    if (!sender || floodDB.logs.whitelist.includes(sender)) return;

    const body =
      m.message?.conversation ||
      m.message?.extendedTextMessage?.text ||
      m.message?.imageMessage?.caption ||
      m.message?.videoMessage?.caption ||
      '';

    const command = body.trim().split(/\s+/)[0]?.toLowerCase();

    // 🔧 Comandos de configuración antiflood
    if (command === '!antiflood') {
      const args = body.trim().split(/\s+/).slice(1);
      const isAdmin = await isUserAdmin(sock, groupId, sender);
      if (!isAdmin) return sock.sendMessage(groupId, { text: '⛔ Solo admins pueden usar este comando.' }, { quoted: m });

      const subcmd = args[0]?.toLowerCase();
      if (subcmd === 'on') {
        floodDB.settings[groupId] = true;
        saveDB();
        return sock.sendMessage(groupId, { text: '✅ Antiflood activado.' }, { quoted: m });
      }

      if (subcmd === 'off') {
        delete floodDB.settings[groupId];
        saveDB();
        return sock.sendMessage(groupId, { text: '⛔ Antiflood desactivado.' }, { quoted: m });
      }

      if (subcmd === 'status') {
        const active = floodDB.settings[groupId] ? '✅ Activado' : '⛔ Desactivado';
        const userWarns = floodDB.data[groupId] || {};
        const warnList = Object.entries(userWarns)
          .filter(([_, data]) => data.warnings > 0)
          .map(([jid, data]) => `- @${jid.split('@')[0]}: ${data.warnings} advertencia(s)`)
          .join('\n') || 'Ninguna advertencia.';
        return sock.sendMessage(groupId, {
          text: `🛡️ Estado antiflood: ${active}\n\n⚠️ Advertencias:\n${warnList}`,
          mentions: Object.keys(userWarns)
        }, { quoted: m });
      }

      if (subcmd === 'whitelist') {
        const action = args[1];
        const target = args[2];
        if (!action || !['add', 'remove'].includes(action) || !target) {
          return sock.sendMessage(groupId, { text: 'Uso: !antiflood whitelist add|remove <jid>' }, { quoted: m });
        }
        const list = floodDB.logs.whitelist;
        if (action === 'add' && !list.includes(target)) {
          list.push(target);
          saveDB();
          return sock.sendMessage(groupId, { text: `✅ ${target} añadido a whitelist.` }, { quoted: m });
        }
        if (action === 'remove') {
          const index = list.indexOf(target);
          if (index !== -1) {
            list.splice(index, 1);
            saveDB();
            return sock.sendMessage(groupId, { text: `✅ ${target} eliminado de whitelist.` }, { quoted: m });
          }
        }
        return sock.sendMessage(groupId, { text: `ℹ️ Acción no válida.` }, { quoted: m });
      }

      if (subcmd === 'setlog') {
        const logGroup = args[1];
        if (!logGroup?.endsWith('@g.us')) {
          return sock.sendMessage(groupId, { text: 'Uso: !antiflood setlog <groupid>' }, { quoted: m });
        }
        floodDB.logs.logGroupId = logGroup;
        saveDB();
        return sock.sendMessage(groupId, { text: `✅ Logs activados en ${logGroup}` }, { quoted: m });
      }

      return sock.sendMessage(groupId, {
        text: 'Comandos válidos:\n!antiflood on/off\n!antiflood status\n!antiflood whitelist add/remove <jid>\n!antiflood setlog <groupid>'
      }, { quoted: m });
    }

    // ⚠️ Detección de Flood
    if (!floodDB.settings[groupId]) return;

    const now = Date.now();
    const msgData = recentMessages[groupId] = recentMessages[groupId] || {};
    const userData = msgData[sender] = msgData[sender] || [];

    // Añadir nuevo mensaje
    userData.push({ body, time: now });
    // Filtrar solo los mensajes dentro de la ventana de tiempo
    msgData[sender] = userData.filter(msg => now - msg.time < TIME_WINDOW);

    const charFlood = isRepeatedChar(body);
    const lowVariety = uniqueCharRatio(body) < 0.2;
    const identicalMessages = userData.slice(-FLOOD_LIMIT).every(msg => msg.body === body);

    if (
      msgData[sender].length >= FLOOD_LIMIT ||
      charFlood ||
      lowVariety ||
      identicalMessages
    ) {
      floodDB.data[groupId] = floodDB.data[groupId] || {};
      const userEntry = floodDB.data[groupId][sender] = floodDB.data[groupId][sender] || {
        warnings: 0,
        lastWarning: now
      };

      // Resetear advertencias si ya pasó tiempo
      if (now - userEntry.lastWarning > RESET_WARNINGS) {
        userEntry.warnings = 0;
      }

      userEntry.warnings += 1;
      userEntry.lastWarning = now;

      saveDB();

      if (userEntry.warnings >= MAX_WARNINGS) {
        try {
          await sock.groupParticipantsUpdate(groupId, [sender], 'remove');
          await sock.sendMessage(groupId, {
            text: `🚫 @${sender.split('@')[0]} fue expulsado por flood.`
          }, { mentions: [sender] });

          if (floodDB.logs.logGroupId) {
            await sock.sendMessage(floodDB.logs.logGroupId, {
              text: `🚨 Usuario @${sender.split('@')[0]} fue expulsado de ${groupId} por flood.`,
              mentions: [sender]
            });
          }

          delete floodDB.data[groupId][sender];
          saveDB();
        } catch (err) {
          console.error('❌ No se pudo expulsar:', err);
        }
      } else {
        await sock.sendMessage(groupId, {
          text: `⚠️ @${sender.split('@')[0]} estás haciendo flood. Advertencia ${userEntry.warnings}/${MAX_WARNINGS}.`,
          mentions: [sender]
        });
      }
    }
  });
}
