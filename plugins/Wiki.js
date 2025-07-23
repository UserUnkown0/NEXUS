import fetch from 'node-fetch';

// Extrae el texto del mensaje
function getMessageBody(message) {
  if (!message) return '';
  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.documentMessage?.caption) return message.documentMessage.caption;
  return '';
}

// Envía mensaje de texto
async function sendText(sock, jid, text) {
  return sock.sendMessage(jid, { text });
}

// Consulta Wikipedia en español
async function fetchWikipediaSummary(query) {
  const apiUrl = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`No se encontró la página: ${res.status}`);
  return res.json();
}

// Plugin principal
export default function registerWikipediaPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg || msg.key.fromMe || !msg.message) return;

    const from = msg.key.remoteJid;
    const body = getMessageBody(msg.message).trim();

    if (!body.toLowerCase().startsWith('!wiki ')) return;

    const query = body.slice(6).trim();
    if (!query) {
      await sendText(sock, from, '❗ Escribe un término después de `!wiki`.');
      return;
    }

    try {
      const data = await fetchWikipediaSummary(query);

      if (data.type === 'disambiguation') {
        await sendText(sock, from,
          `⚠️ *${query}* es un término ambiguo. Por favor, sé más específico.\n\n🌐 Más info: ${data.content_urls.desktop.page}`
        );
        return;
      }

      const caption = 
`📚 *Wikipedia: ${data.title}*

${data.extract}

🔗 Más info: ${data.content_urls.desktop.page}`;

      if (data.thumbnail?.source) {
        await sock.sendMessage(from, {
          image: { url: data.thumbnail.source },
          caption
        }, { quoted: msg });
      } else {
        await sendText(sock, from, caption);
      }

    } catch (err) {
      console.error('❌ Error en !wiki:', err);
      await sendText(sock, from, '⚠️ Ocurrió un error al buscar en Wikipedia. Intenta más tarde.');
    }
  });
}
