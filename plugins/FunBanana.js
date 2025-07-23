export default function (sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const msg = messages?.[0];
            if (!msg?.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const command = text.trim().toLowerCase();

            if (!command.startsWith('!banana')) return;

            const sizes = [5, 7, 10, 12, 14, 16, 18, 20, 24, 28, 30, 33, 35, 38, 40];
            const randomSize = sizes[Math.floor(Math.random() * sizes.length)];

            const bananaEmoji = '🍌';
            const reactionEmoji = '🤔';

            let targetName = msg.pushName || 'Usuario';
            let mentions = [];

            // Detectar menciones
            const context = msg.message?.extendedTextMessage?.contextInfo;
            const mentioned = context?.mentionedJid?.[0];
            if (mentioned) {
                targetName = `@${mentioned.split('@')[0]}`;
                mentions = [mentioned];
            }

            // Mensaje final
            const result = `${bananaEmoji} ¿Cuánto mide tu banana?\nLa banana de *${targetName}* mide *${randomSize} cm* ${reactionEmoji}`;

            await sock.sendMessage(from, {
                text: result,
                mentions
            });

        } catch (error) {
            console.error('❌ Error en plugin !banana:', error);
        }
    });
}
