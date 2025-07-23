import fs from 'fs';

const PREMIUM_FILE = './Categorizador/db/premium.json';
const OWNER_JID = '593997564480@s.whatsapp.net'; // Tu número real aquí

// Cargar y guardar lista premium
function loadPremiumList() {
  if (!fs.existsSync(PREMIUM_FILE)) {
    fs.writeFileSync(PREMIUM_FILE, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(PREMIUM_FILE));
}

function savePremiumList(list) {
  fs.writeFileSync(PREMIUM_FILE, JSON.stringify(list, null, 2));
}

// Exportar para otros plugins
export function isPremium(jid) {
  const list = loadPremiumList();
  return list.includes(jid);
}

// Plugin principal
export default function premiumPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg?.message) return;

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const sender = isGroup
      ? msg.key.participant // En grupos
      : msg.key.remoteJid;  // En chats privados

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    if (!text.startsWith('!premium ')) return;

    // Solo el dueño puede usar el comando
    if (sender !== OWNER_JID) {
      await sock.sendMessage(from, {
        text: '🚫 Solo el *dueño del bot* puede usar este comando.',
        quoted: msg,
      });
      return;
    }

    const args = text.trim().split(' ');
    const command = args[1];
    const mention = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mention) {
      await sock.sendMessage(from, {
        text: '⚠️ Debes mencionar a un usuario. Ejemplo:\n*!premium add @usuario*',
        quoted: msg,
      });
      return;
    }

    const list = loadPremiumList();

    if (command === 'add') {
      if (list.includes(mention)) {
        await sock.sendMessage(from, {
          text: `⚠️ @${mention.split('@')[0]} ya está en la lista premium.`,
          mentions: [mention],
          quoted: msg,
        });
      } else {
        list.push(mention);
        savePremiumList(list);
        await sock.sendMessage(from, {
          text: `✅ Se agregó a @${mention.split('@')[0]} a la lista premium.`,
          mentions: [mention],
          quoted: msg,
        });
      }
    } else if (command === 'del') {
      if (!list.includes(mention)) {
        await sock.sendMessage(from, {
          text: `⚠️ @${mention.split('@')[0]} no está en la lista premium.`,
          mentions: [mention],
          quoted: msg,
        });
      } else {
        const updatedList = list.filter(j => j !== mention);
        savePremiumList(updatedList);
        await sock.sendMessage(from, {
          text: `🗑️ Se eliminó a @${mention.split('@')[0]} de la lista premium.`,
          mentions: [mention],
          quoted: msg,
        });
      }
    } else {
      await sock.sendMessage(from, {
        text: '❓ Comando inválido. Usa:\n*!premium add @usuario*\n*!premium del @usuario*',
        quoted: msg,
      });
    }
  });
}
