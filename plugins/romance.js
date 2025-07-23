export default function (sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const text = m.message?.conversation || m.message?.extendedTextMessage?.text;
    if (!text || !text.startsWith('!romance')) return;

    const mentionedJid = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

    if (mentionedJid.length < 2) {
      await sock.sendMessage(m.key.remoteJid, {
        text: "💔 Usa el comando así: *!romance @usuario1 @usuario2* (menciona a dos personas)."
      });
      return;
    }

    const [user1, user2] = mentionedJid;
    const compatibility = Math.floor(Math.random() * 101); // de 0 a 100%
    let reaction = "";

    if (compatibility >= 90) reaction = "💘 ¡Almas gemelas!";
    else if (compatibility >= 70) reaction = "💕 Muy compatibles";
    else if (compatibility >= 40) reaction = "💞 Podrían funcionar";
    else if (compatibility >= 20) reaction = "😅 Tal vez solo amigos";
    else reaction = "💔 Mejor ni lo intenten...";

    await sock.sendMessage(m.key.remoteJid, {
      text: `💖 *Compatibilidad amorosa* 💖\n\n@${user1.split('@')[0]} ❤️ @${user2.split('@')[0]}\n🔢 Compatibilidad: *${compatibility}%*\n${reaction}`,
      mentions: [user1, user2]
    });
  });
}
