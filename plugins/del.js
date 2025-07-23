export default function delPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg?.message || !msg?.key || msg.key.fromMe) return;

    const jid = msg.key.remoteJid;
    const from = msg.key.participant || msg.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    if (!isGroup || !text.trim().toLowerCase().startsWith('!del')) return;

    await sock.sendMessage(jid, { react: { text: '🗑️', key: msg.key } });

    const args = text.trim().split(/\s+/);
    const subcmd = args[1];

    try {
      // !del all <número>
      if (subcmd === 'all') {
        const count = parseInt(args[2]);
        if (isNaN(count) || count < 1 || count > 50) {
          await sock.sendMessage(jid, {
            text: '⚠️ Usa el comando correctamente:\n`!del all <cantidad>` (máx 50)',
            quoted: msg,
          });
          return;
        }
        const chat = sock.chats?.get(jid);
        if (!chat || !chat.messages) {
          await sock.sendMessage(jid, {
            text: '⚠️ No se encontraron mensajes para este grupo.',
            quoted: msg,
          });
          return;
        }
        const mensajes = [...chat.messages.values()].reverse();
        let deleted = 0;
        for (const m of mensajes) {
          if (m.key.fromMe && deleted < count) {
            await sock.sendMessage(jid, {
              delete: {
                remoteJid: jid,
                fromMe: true,
                id: m.key.id,
                participant: sock.user.id,
              },
            });
            deleted++;
          }
        }
        await sock.sendMessage(jid, { text: `✅ Se eliminaron *${deleted}* mensajes enviados por el bot.` });
        // Eliminar mensaje comando
        await sock.sendMessage(jid, {
          delete: { remoteJid: jid, id: msg.key.id, fromMe: false, participant: from },
        });
        return;
      }

      // !del @usuario <número>
      if (subcmd?.startsWith('@') && args.length >= 3) {
        const mentionId = subcmd.includes('@') ? subcmd.split('@').pop() + '@s.whatsapp.net' : null;
        const count = parseInt(args[2]);
        if (!mentionId) {
          await sock.sendMessage(jid, { text: '⚠️ Usuario inválido.', quoted: msg });
          return;
        }
        if (isNaN(count) || count < 1 || count > 50) {
          await sock.sendMessage(jid, { text: '⚠️ Debes indicar una cantidad válida (1-50).', quoted: msg });
          return;
        }
        const chat = sock.chats?.get(jid);
        if (!chat || !chat.messages) {
          await sock.sendMessage(jid, { text: '⚠️ No hay mensajes almacenados para este grupo.', quoted: msg });
          return;
        }
        const mensajes = [...chat.messages.values()].reverse();
        let deleted = 0;
        for (const m of mensajes) {
          if (m.key.participant === mentionId && deleted < count) {
            await sock.sendMessage(jid, {
              delete: {
                remoteJid: jid,
                fromMe: false,
                id: m.key.id,
                participant: mentionId,
              },
            });
            deleted++;
          }
        }
        await sock.sendMessage(jid, { text: `✅ Se eliminaron *${deleted}* mensajes de @${mentionId.split('@')[0]}.`, mentions: [mentionId] });
        await sock.sendMessage(jid, {
          delete: { remoteJid: jid, id: msg.key.id, fromMe: false, participant: from },
        });
        return;
      }

      // !del <mensajeID>
      if (args.length === 2 && args[1].length > 10) {
        const msgID = args[1];
        await sock.sendMessage(jid, {
          delete: { remoteJid: jid, id: msgID, fromMe: false, participant: from },
        });
        await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
        await sock.sendMessage(jid, {
          text: `🗑️ Mensaje eliminado por @${from.split('@')[0]}`,
          mentions: [from],
        });
        await sock.sendMessage(jid, {
          delete: { remoteJid: jid, id: msg.key.id, fromMe: false, participant: from },
        });
        return;
      }

      // !del (respondiendo mensaje)
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const quotedId = ctx?.stanzaId;
      const quotedParticipant = ctx?.participant;

      if (!quotedId || !quotedParticipant) {
        await sock.sendMessage(jid, {
          text: '⚠️ Usa `!del` respondiendo al *mensaje que deseas eliminar*.',
          quoted: msg,
        });
        return;
      }

      await sock.sendMessage(jid, {
        delete: { remoteJid: jid, fromMe: false, id: quotedId, participant: quotedParticipant },
      });

      await sock.sendMessage(jid, { react: { text: '✅', key: msg.key } });
      await sock.sendMessage(jid, {
        text: `🗑️ Mensaje eliminado por @${from.split('@')[0]}`,
        mentions: [from],
      });
      await sock.sendMessage(jid, {
        delete: { remoteJid: jid, id: msg.key.id, fromMe: false, participant: from },
      });
    } catch (err) {
      console.error('❌ Error al procesar comando !del:', err);
      await sock.sendMessage(jid, {
        text: '❌ Ocurrió un error al ejecutar el comando.',
        quoted: msg,
      });
    }
  });
}
