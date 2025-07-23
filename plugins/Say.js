export default function (sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages?.[0];
        if (!msg || !msg.message || msg.key.fromMe) return;

        try {
            const { remoteJid, participant } = msg.key;
            const text = extractText(msg);

            if (!text || !text.toLowerCase().startsWith('!say')) return;

            const messageContent = text.slice(4).trim();
            if (!messageContent) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Por favor, escribe algo después de *!say* para que lo repita.'
                });
                return;
            }

            const mentionedJids = getMentionedJids(msg);

            await sock.sendMessage(remoteJid, {
                text: messageContent,
                mentions: mentionedJids
            });

            console.log(`✅ [${remoteJid}] ${participant || 'Usuario'} usó !say: ${messageContent}`);

        } catch (err) {
            console.error('❌ Error al ejecutar el comando !say:', err);
        }
    });
}

function extractText(msg) {
    const message = msg.message;
    if (!message) return null;

    return (
        message.conversation ||
        message.extendedTextMessage?.text ||
        message.imageMessage?.caption ||
        message.videoMessage?.caption ||
        message.documentMessage?.caption ||
        message.messageContextInfo?.quotedMessage?.conversation ||
        null
    );
}

function getMentionedJids(msg) {
    const context = msg.message?.extendedTextMessage?.contextInfo ||
                    msg.message?.contextInfo;

    return context?.mentionedJid || [];
}
