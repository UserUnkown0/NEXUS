// handlers/messageHandler.js
import chalk from 'chalk';

export async function handleMessage(m) {
    try {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        console.log(chalk.cyan(`📩 Mensaje recibido: ${msg.message?.conversation || '[Otro tipo de mensaje]'}`));
        // Aquí iría tu lógica para responder o procesar mensajes
    } catch (error) {
        console.error(chalk.redBright('❌ Error procesando el mensaje:'), error);
    }
}

