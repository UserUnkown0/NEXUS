export default function fpromote(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg?.message || !msg?.key || msg.key.fromMe) return;

    const jid = msg.key.remoteJid;
    const from = msg.key.participant || msg.key.remoteJid;
    const isGroup = jid.endsWith('@g.us');

    // Obtener texto del mensaje
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    if (!isGroup || !text.trim().toLowerCase().startsWith('!fpromote')) return;

    // Obtener mencionados (solo el primero)
    const mentionedJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentionedJid) {
      await sock.sendMessage(jid, { text: '❌ Debes mencionar a un usuario para promocionarlo.', quoted: msg });
      return;
    }

    const userNumber = mentionedJid.split('@')[0];
    const hora = new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });

    const fakeMsg = `🛡️ *Sistema de Gestión de Grupo*\n\n👤 @${userNumber} ha sido *promovido a administrador del grupo*\n📅 ${hora} | 🛰️ Servidor: SG-3`;

    await sock.sendMessage(jid, {
      text: fakeMsg,
      mentions: [mentionedJid],
      quoted: msg,
    });
  });
}
