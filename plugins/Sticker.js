import { downloadMediaMessage } from '@whiskeysockets/baileys';
import sharp from 'sharp';

export default function stickerPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg || !msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    if (!isGroup) return;

    const content =
      msg.message?.extendedTextMessage?.text || msg.message?.conversation || '';

    // Detectar comando exacto "!s" o "!s algo", pero no "!say"
    const command = content.trim().toLowerCase();
    const args = command.split(/\s+/);
    if (args[0] !== '!s') return;

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted || !quoted.imageMessage) {
      await sock.sendMessage(from, {
        text: '❌ Debes responder a una imagen para convertirla en sticker.',
        quoted: msg,
      });
      return;
    }

    try {
      const buffer = await downloadMediaMessage(
        { message: quoted, key: msg.message.extendedTextMessage.contextInfo.stanzaId },
        'buffer',
        {},
        { logger: console, reuploadRequest: sock.updateMediaMessage }
      );

      if (!buffer) throw new Error('No se pudo descargar la imagen.');

      const webpBuffer = await sharp(buffer)
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp()
        .toBuffer();

      await sock.sendMessage(from, {
        sticker: webpBuffer,
        quoted: msg,
      });
    } catch (err) {
      console.error('Error al crear el sticker:', err);
      await sock.sendMessage(from, {
        text: '❌ Hubo un error al crear el sticker. Asegúrate de responder a una imagen válida.',
        quoted: msg,
      });
    }
  });
}
