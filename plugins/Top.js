export default function topPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || !msg.message.conversation) return;

    const text = msg.message.conversation;
    const jid = msg.key.remoteJid;

    // Solo responder en grupos
    if (!jid.endsWith('@g.us')) return;

    if (text.toLowerCase().startsWith('!top')) {
      try {
        const title = text.substring(4).trim();
        if (!title) {
          await sock.sendMessage(jid, {
            text: '✋ Escribe algo después de !top. Ej: !top más llorones del grupo',
          });
          return;
        }

        let metadata;
        try {
          metadata = await sock.groupMetadata(jid);
        } catch {
          return;
        }

        const participants = metadata.participants.map(p => p.id).filter(Boolean);
        if (participants.length === 0) return;

        // Mezclar y obtener top
        const shuffled = participants.sort(() => Math.random() - 0.5);
        const top10 = shuffled.slice(0, Math.min(10, participants.length));

        const emojis = ['👑', '🥈', '🥉', '🔥', '✨', '🎉', '💥', '🌟', '🍭', '💫'];

        const message = top10
          .map((id, index) => `${index + 1}. @${id.split('@')[0]} ${emojis[index] || ''}`)
          .join('\n');

        await sock.sendMessage(jid, {
          text: `📊 *Top 10 ${title}*\n\n${message}`,
          mentions: top10
        });

      } catch (err) {
        console.error('❌ Error en !top:', err);
        await sock.sendMessage(jid, {
          text: '⚠️ Hubo un problema al generar el top.',
        });
      }
    }
  });
}
