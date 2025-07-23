export default function handleMentionAll(sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages?.[0];
        if (!msg || !msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;

        // Obtener texto del mensaje
        const texto =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption ||
            '';

        const comando = '!mentionall';
        if (!texto.toLowerCase().startsWith(comando)) return; // Solo continuar si es el comando

        const isGroup = remoteJid?.endsWith('@g.us');
        if (!isGroup) {
            return sock.sendMessage(remoteJid, {
                text: '❌ Este comando solo está disponible en grupos.'
            });
        }

        const senderId = msg.participant || msg.key.participant || msg.key.remoteJid;
        const ownerId = '593997564480@s.whatsapp.net'; // Tu ID personal

        try {
            const groupMetadata = await sock.groupMetadata(remoteJid);
            const participants = groupMetadata?.participants || [];
            const botJid = sock?.user?.id;

            const admins = participants
                .filter(p => ['admin', 'superadmin'].includes(p.admin))
                .map(p => p.id);

            const isAuthorized = admins.includes(senderId) || senderId === ownerId;
            if (!isAuthorized) {
                return sock.sendMessage(remoteJid, {
                    text: '❌ Solo los administradores o el dueño del bot pueden usar este comando.'
                });
            }

            const mentions = [];
            const mentionLines = participants
                .filter(p => p.id !== botJid)
                .map(p => {
                    mentions.push(p.id);
                    return `│ •➤ @${p.id.split('@')[0]}`;
                });

            if (mentionLines.length === 0) {
                return sock.sendMessage(remoteJid, {
                    text: '⚠️ No se encontraron miembros para mencionar.'
                });
            }

            const total = mentionLines.length;
            const autorTag = senderId?.split('@')[0];

            const mensajePersonalizado = texto.slice(comando.length).trim() || 'Sin mensaje adicional';

            const mensajeFinal = `
∧,,,∧
( ̳• ·̫ • ̳) ♡°
┏∪∪━━━━━━━━━━┓

♡∙  !  MENCION GENERAL  ! 
  PARA ${total} MIEMBROS 🗣️ ∙♡

┗━━━━━━━━━━━━┛
╭────────────────• ✦
│» INFO : ${mensajePersonalizado}
│✁─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ • ✦
${mentionLines.join('\n')}
│──────────────── • ✦
│➥ Autor: @${autorTag}
│──────────────── • ✦
│◣◥◣◥◤◢◤◢◣◥◣◥◤◢◤◢
│║▌│█│║▌║││█║▌║▌║
│◣◥◣◥◤◢◤◢◣◥◣◥◤◢◤◢
╰───꒰  ׅ୭ 2.2.5 ୧ ׅ ꒱─── • ✦
`.trim();

            await sock.sendMessage(remoteJid, {
                text: mensajeFinal,
                mentions
            });

            console.log(`✅ !mentionall ejecutado correctamente por ${senderId}`);
        } catch (error) {
            console.error('❌ Error en !mentionall:', error);
            await sock.sendMessage(remoteJid, {
                text: '⚠️ Ha ocurrido un error al mencionar a todos los miembros.'
            });
        }
    });
}
