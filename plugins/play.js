  import fs from 'fs';
import util from 'util';
import yts from 'yt-search';
import fetch from 'node-fetch';
import ytdlp from 'yt-dlp-exec';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';

const unlinkPromise = util.promisify(fs.unlink);
const statPromise = util.promisify(fs.stat);
const audioFolder = path.resolve('./playaudios');
if (!fs.existsSync(audioFolder)) {
  fs.mkdirSync(audioFolder, { recursive: true });
}

function formatBytes(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

function getAudioQuality(seconds) {
  if (seconds <= 300) return '128k'; // ≤ 5 min
  if (seconds <= 600) return '96k';  // ≤ 10 min
  return '64k';                      // > 10 min
}

const userQueue = new Map();
const cooldowns = new Map();

export default function registerPlayPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const msg = messages[0];
      const from = msg.key.remoteJid;
      const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
      if (!body || !body.toLowerCase().startsWith('!play ') || msg.key.fromMe) return;

      const now = Date.now();
      const last = cooldowns.get(from);
      if (last && now - last < 15000) {
        await sock.sendMessage(from, {
          text: '⏳ Espera 15 segundos entre cada uso de !play.'
        });
        return;
      }

      cooldowns.set(from, now);

      const query = body.slice(6).trim();
      if (!query) {
        await sock.sendMessage(from, { text: '❗ Escribe el nombre de una canción después de `!play`' });
        return;
      }

      if (userQueue.get(from)) {
        await sock.sendMessage(from, { text: '⌛ Espera a que termine tu descarga anterior...' });
        return;
      }
      userQueue.set(from, true);

      const search = await yts(query);
      const video = search.videos[0];
      if (!video) {
        await sock.sendMessage(from, { text: '❌ No se encontró el video.' });
        userQueue.delete(from);
        return;
      }

      const { title, timestamp, url, author, image, seconds } = video;
      const audioFile = path.join(audioFolder, `audio_${Date.now()}.mp3`);
      const quality = getAudioQuality(seconds);

      await sock.sendMessage(from, {
        image: { url: image },
        caption:
`「✦」Descargando *${title}*

> ✐ Canal » ${author.name}
> ⴵ Duración » ${timestamp}
> ✰ Calidad: ${quality}
> 🜸 Link » ${url}`
      });

      const downloadStart = Date.now();
      await ytdlp(url, {
        extractAudio: true,
        audioFormat: 'mp3',
        output: audioFile,
        quiet: true,
        ffmpegLocation: ffmpegPath,
        audioQuality: 0,
        postprocessorArgs: [`-b:a ${quality}`]
      });

      const stats = await statPromise(audioFile);
      const sizeInMB = stats.size / (1024 * 1024);
      const sizeFormatted = formatBytes(stats.size);

      if (sizeInMB > 60) {
        await sock.sendMessage(from, {
          text: `El tamaño del audio no puede ser mayor a 60.00MB (Tamaño: ${sizeFormatted})`
        });
        await unlinkPromise(audioFile).catch(() => {});
        userQueue.delete(from);
        return;
      }

      const elapsed = ((Date.now() - downloadStart) / 1000).toFixed(1);
      await sock.sendMessage(from, {
        audio: { url: audioFile },
        mimetype: 'audio/mpeg',
        ptt: false,
        caption:
`> ✐ Canal » ${author.name}
> ⴵ Duración » ${timestamp}
> ✰ Calidad: ${quality}
> ❒ Tamaño » ${sizeFormatted}
> 🜸 Link » ${url}
> ⏱ Descargado en: ${elapsed}s`
      });

      setTimeout(async () => {
        if (fs.existsSync(audioFile)) {
          try {
            await unlinkPromise(audioFile);
            console.log(`✅ Eliminado: ${audioFile}`);
          } catch (err) {
            console.error(`❌ No se pudo eliminar: ${audioFile}`, err);
          }
        }
      }, 5000);

    } catch (err) {
      console.error('❌ Error en !play:', err);
      await sock.sendMessage(messages[0].key.remoteJid, {
        text: '⚠️ Ocurrió un error al procesar tu solicitud. Intenta nuevamente.'
      });
    } finally {
      const from = messages[0].key.remoteJid;
      userQueue.delete(from);
    }
  });
}
