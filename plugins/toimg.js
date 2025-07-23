import { downloadMediaMessage } from '@whiskeysockets/baileys';

export default function toImagePlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg || !msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    if (!isGroup) return;

    const content = msg.message?.extendedTextMessage?.text || msg.message?.conversation || '';
    if (!content.trim().toLowerCase().startsWith('!toimg')) return;

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const stickerMsg = quoted?.stickerMessage;

    if (!stickerMsg) {
      await sock.sendMessage(from, {
        text: '❌ Debes responder a un sticker para convertirlo en imagen.',
        quoted: msg,
      });
      return;
    }

    try {
      const buffer = await downloadMediaMessage(
        {
          message: quoted,
          key: {
            remoteJid: from,
            id: msg.message.extendedTextMessage.contextInfo.stanzaId,
            fromMe: false,
          },
        },
        'buffer',
        {},
        { logger: console, reuploadRequest: sock.updateMediaMessage }
      );

      if (!buffer) throw new Error('No se pudo descargar el sticker.');

      await sock.sendMessage(from, {
        image: buffer,
        caption: '🖼️ Aquí tienes tu sticker convertido a imagen.',
        quoted: msg,
      });
    } catch (err) {
      console.error('Error al convertir sticker en imagen:', err.stack);
      await sock.sendMessage(from, {
        text: '❌ Hubo un error al convertir el sticker. Asegúrate de responder a un sticker válido.',
        quoted: msg,
      });
    }
  });
}
