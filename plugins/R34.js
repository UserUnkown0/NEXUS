import fetch from 'node-fetch';

const isNSFWEnabled = new Set();
const cooldownMap = new Map();
const blacklist = ['loli', 'shota', 'child', 'baby', 'rape', 'cub'];

export default function r34Plugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg || !msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const lower = text.trim().toLowerCase();

    if (!from.endsWith('@g.us')) return; // Solo en grupos

    // Activación/desactivación del comando NSFW
    if (lower === '!nsfw on' || lower === '!nsfw off') {
      const metadata = await sock.groupMetadata(from);
      const isAdmin = metadata.participants.find(p => p.id === sender && p.admin);

      if (!isAdmin) {
        return sock.sendMessage(from, {
          text: '⛔ Solo los admins pueden cambiar los ajustes NSFW.'
        }, { quoted: msg });
      }

      if (lower === '!nsfw on') {
        isNSFWEnabled.add(from);
        return sock.sendMessage(from, { text: '✅ NSFW activado en este grupo.' }, { quoted: msg });
      } else {
        isNSFWEnabled.delete(from);
        return sock.sendMessage(from, { text: '❌ NSFW desactivado en este grupo.' }, { quoted: msg });
      }
    }

    // Comando !r34
    if (!text.toLowerCase().startsWith('!r34')) return;
    if (!isNSFWEnabled.has(from)) {
      return sock.sendMessage(from, {
        text: '⚠️ Comando desactivado. Usa `!nsfw on` para activarlo (solo admins).'
      }, { quoted: msg });
    }

    // Cooldown: 10s por grupo
    const lastUsed = cooldownMap.get(from) || 0;
    if (Date.now() - lastUsed < 10000) {
      return sock.sendMessage(from, {
        text: '🕐 Espera unos segundos antes de usar este comando otra vez.'
      }, { quoted: msg });
    }
    cooldownMap.set(from, Date.now());

    // Término de búsqueda
    const searchTerm = text.trim().slice(4).trim(); // Todo después de !r34
    if (!searchTerm) {
      return sock.sendMessage(from, {
        text: '❌ Debes escribir una búsqueda.\nEj: `!r34 samus aran`'
      }, { quoted: msg });
    }

    const safeSearch = searchTerm.toLowerCase();
    if (blacklist.some(word => safeSearch.includes(word))) {
      return sock.sendMessage(from, {
        text: '🚫 Esa búsqueda contiene términos prohibidos.'
      }, { quoted: msg });
    }

    try {
      const encodedQuery = encodeURIComponent(searchTerm.replace(/\s+/g, '_'));
      const res = await fetch(`https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=100&tags=${encodedQuery}`);
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        return sock.sendMessage(from, {
          text: `❌ No se encontraron resultados para: *${searchTerm}*`
        }, { quoted: msg });
      }

      // Filtrar por extensiones válidas
      const validImages = data.filter(p => p.file_url && /\.(jpg|jpeg|png|gif)$/i.test(p.file_url));
      if (validImages.length === 0) {
        return sock.sendMessage(from, {
          text: `⚠️ No se encontraron imágenes compatibles para: *${searchTerm}*`
        }, { quoted: msg });
      }

      const selected = validImages[Math.floor(Math.random() * validImages.length)];
      const imageBuffer = await fetch(selected.file_url).then(r => r.buffer());

      await sock.sendMessage(from, {
        image: imageBuffer,
        caption: `🔞 Resultado para: *${searchTerm}*`,
      }, { quoted: msg });

    } catch (err) {
      console.error('[❌ R34 Error]', err);
      return sock.sendMessage(from, {
        text: '❌ Ocurrió un error inesperado al procesar la búsqueda.'
      }, { quoted: msg });
    }
  });
}
