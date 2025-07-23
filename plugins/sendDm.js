export default async function (sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const m = messages[0];
      if (!m.message || !m.key.remoteJid?.endsWith('@g.us')) return;

      const text =
        m.message?.conversation ||
        m.message?.extendedTextMessage?.text ||
        '';
      const command = text.trim().split(/\s+/)[0]?.toLowerCase();

      if (command !== '!senddm') return;

      const groupJid = m.key.remoteJid;
      const senderJid = m.key.participant || m.participant || m.key.remoteJid;

      const groupMetadata = await sock.groupMetadata(groupJid);
      const participants = groupMetadata.participants || [];

      const isAdmin = participants.find(
        (p) => p.id === senderJid && (p.admin === 'admin' || p.admin === 'superadmin')
      );

      if (!isAdmin) {
        return await sock.sendMessage(groupJid, {
          text: '❌ Este comando solo puede ser usado por administradores.',
        }, { quoted: m });
      }

      const mentions =
        m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      if (mentions.length === 0) {
        return await sock.sendMessage(groupJid, {
          text: '📌 Debes mencionar a un usuario.\n\nEjemplo:\n*!senddm @usuario Tu mensaje aquí*',
        }, { quoted: m });
      }

      const recipientJid = mentions[0];

      // Extraer texto después del comando y mención
      const cleanedText = text.replace(/^!senddm\s+/, '').trim();
      const mentionRegex = /@\d{5,}/;
      const messageText = cleanedText.replace(mentionRegex, '').trim();

      if (!messageText) {
        return await sock.sendMessage(groupJid, {
          text: '✏️ Debes escribir un mensaje para enviarle al usuario.',
        }, { quoted: m });
      }

      // Obtener nombre del administrador
      let senderName = senderJid.split('@')[0];
      try {
        const [contact] = await sock.onWhatsApp(senderJid);
        senderName = contact?.notify || senderName;
      } catch (e) {}

      // Enviar mensaje privado al usuario mencionado
      const finalMessage =
        `💌 *Has recibido un mensaje privado del grupo "${groupMetadata.subject}":*\n\n` +
        `${messageText}\n\n🖊️ Enviado por: @${senderName}`;

      await sock.sendMessage(recipientJid, {
        text: finalMessage,
        mentions: [senderJid],
      });

      // Confirmar en el grupo que se envió correctamente
      await sock.sendMessage(groupJid, {
        text: `✅ Mensaje enviado a @${recipientJid.split('@')[0]} por privado.`,
        mentions: [recipientJid],
      }, { quoted: m });

    } catch (error) {
      console.error('❌ Error en !senddm:', error);
      try {
        await sock.sendMessage(m.key.remoteJid, {
          text: '⚠️ Hubo un error al intentar enviar el mensaje privado. Intenta nuevamente.',
        }, { quoted: messages[0] });
      } catch (e) {
        console.error('⚠️ Error al enviar el mensaje de error:', e);
      }
    }
  });
}
