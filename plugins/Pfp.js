import fetch from 'node-fetch';

export default function pfpPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    if (!messages || messages.length === 0) return;

    const m = messages[0];
    const from = m.key.remoteJid;
    const isGroup = from?.endsWith('@g.us');
    const body =
      m.message?.conversation ||
      m.message?.extendedTextMessage?.text ||
      '';

    if (!body.toLowerCase().startsWith('!pfp')) return;

    const args = body.trim().split(/\s+/); // ['!pfp', 'user', '@usuario'] o ['!pfp', 'group']
    const subcommand = args[1]?.toLowerCase();

    // Subcomando: !pfp group
    if (subcommand === 'group') {
      if (!isGroup) {
        return await sock.sendMessage(from, {
          text: '❌ Este comando solo puede usarse en grupos.',
          quoted: m
        });
      }

      try {
        const groupPfp = await sock.profilePictureUrl(from, 'image');
        await sock.sendMessage(from, {
          image: { url: groupPfp },
          caption: '🖼️ Esta es la imagen del grupo.',
          quoted: m
        });
      } catch {
        await sock.sendMessage(from, {
          text: '⚠️ Este grupo no tiene imagen o no tengo permisos para verla.',
          quoted: m
        });
      }
      return;
    }

    // Subcomando: !pfp user @usuario (o respuesta)
    if (subcommand === 'user') {
      let targetJid;

      // Mención
      const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid;
      if (mentions?.length) {
        targetJid = mentions[0];
      }

      // Respuesta
      const quoted = m.message?.extendedTextMessage?.contextInfo?.participant;
      if (!targetJid && quoted) {
        targetJid = quoted;
      }

      if (!targetJid) {
        return await sock.sendMessage(from, {
          text: '❌ Debes mencionar a un usuario o responderle con `!pfp user`.',
          quoted: m
        });
      }

      try {
        const userPfp = await sock.profilePictureUrl(targetJid, 'image');
        const res = await fetch(userPfp);
        const buffer = await res.buffer();

        await sock.sendMessage(from, {
          image: buffer,
          caption: `🖼️ Foto de perfil de @${targetJid.split('@')[0]}`,
          mentions: [targetJid],
          quoted: m
        });
      } catch (err) {
        console.error('❌ Error al obtener imagen:', err);
        await sock.sendMessage(from, {
          text: `❌ No se pudo obtener la foto de perfil de @${targetJid.split('@')[0]}`,
          mentions: [targetJid],
          quoted: m
        });
      }
      return;
    }

    // Subcomando inválido
    await sock.sendMessage(from, {
      text: '❌ Subcomando inválido. Usa:\n- `!pfp user @usuario`\n- `!pfp group`',
      quoted: m
    });
  });
}
