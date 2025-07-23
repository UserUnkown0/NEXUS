export default async function tagAllPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const m = messages?.[0];
      if (!m?.message || !m.key?.remoteJid?.endsWith('@g.us')) return;

      const groupId = m.key.remoteJid;
      const senderId = m.key.participant || m.key.remoteJid;

      const body =
        m.message?.conversation ||
        m.message?.extendedTextMessage?.text ||
        m.message?.imageMessage?.caption ||
        m.message?.videoMessage?.caption || '';

      const args = body.trim().split(/\s+/);
      const command = args.shift()?.toLowerCase();

      if (command !== '!tag') return;

      // Obtener metadatos del grupo
      let metadata;
      try {
        metadata = await sock.groupMetadata(groupId);
      } catch (err) {
        console.error('[❌ Error al obtener metadatos del grupo]:', err);
        return sock.sendMessage(groupId, {
          text: '❌ No pude acceder a la información del grupo. ¿Soy administrador?',
        });
      }

      // Verificar si quien ejecuta el comando es administrador
      const participantInfo = metadata.participants.find(p => p.id === senderId);
      const isAdmin = participantInfo?.admin === 'admin' || participantInfo?.admin === 'superadmin';

      if (!isAdmin) {
        return sock.sendMessage(groupId, {
          text: '🚫 Solo los administradores pueden usar el comando `!tag`.',
        });
      }

      // Filtrar participantes (excepto el bot)
      const participantes = metadata?.participants
        ?.map(p => p.id)
        ?.filter(id => id !== sock?.user?.id);

      if (!participantes || participantes.length === 0) {
        return sock.sendMessage(groupId, {
          text: '⚠️ No encontré miembros para etiquetar.',
        });
      }

      const mensajePrincipal = args.join(' ') || '👋';
      const autor = senderId.split('@')[0];

      const mensajeFinal = `${mensajePrincipal}\n\n👤 Etiquetado por: @${autor}`;

      // Enviar mensaje con menciones sin citar el mensaje original
      await sock.sendMessage(groupId, {
        text: mensajeFinal,
        mentions: participantes.concat(senderId),
      });

    } catch (e) {
      console.error('[❌ Error en el plugin tagAllPlugin]:', e);
    }
  });
}
