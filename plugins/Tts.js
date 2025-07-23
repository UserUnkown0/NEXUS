import { getAudioUrl } from 'google-tts-api';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function ttsPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const from = m.key.remoteJid;
    const isGroup = from.endsWith('@g.us');

    const body =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      '';

    // Comando !tts
    if (!body.startsWith('!tts ')) return;

    const text = body.slice(5).trim();
    if (!text) {
      await sock.sendMessage(from, { text: '❌ Escribe un texto para convertir a voz. Ej: !tts Hola mundo.' }, { quoted: m });
      return;
    }

    if (text.length > 200) {
      await sock.sendMessage(from, { text: '⚠️ El texto no puede tener más de 200 caracteres.' }, { quoted: m });
      return;
    }

    try {
      const url = getAudioUrl(text, {
        lang: 'es', // Cambia a 'en', 'fr', etc. si quieres otro idioma
        slow: false,
        host: 'https://translate.google.com',
      });

      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const filePath = path.join(__dirname, 'tts.mp3');
      fs.writeFileSync(filePath, response.data);

      await sock.sendMessage(from, {
        audio: fs.readFileSync(filePath),
        mimetype: 'audio/mp4',
        ptt: true // Esto lo hace sonar como nota de voz
      }, { quoted: m });

      fs.unlinkSync(filePath); // Eliminar archivo temporal
    } catch (error) {
      console.error('Error al generar TTS:', error);
      await sock.sendMessage(from, { text: '❌ Error al generar el audio. Intenta nuevamente.' }, { quoted: m });
    }
  });
}
