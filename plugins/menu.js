// plugins/menuPrivado.js
const estadoUsuarios = new Map();

const MENU_PRINCIPAL = `👋 Hola {user}, bienvenido al *Asistente del Bot* 🤖

¿Cómo podemos ayudarte? Elige una opción:

1️⃣ Información del bot
2️⃣ Sobre el equipo
3️⃣ Ver prefijos disponibles
4️⃣ Contactar con el owner
5️⃣ Volver a mostrar este menú
6️⃣ Salir del menú

✍️ *Responde solo con el número de la opción.*`;

const OPCIONES = {
    1: `ℹ️ *Información del bot:*\n\nEste bot está diseñado para gestionar grupos, automatizar respuestas, ofrecer comandos útiles y ayudarte con múltiples tareas.`,
    2: `👥 *Sobre el equipo:*\n\nSomos desarrolladores apasionados por crear herramientas útiles para comunidades en WhatsApp. Innovación y soporte es nuestra prioridad.`,
    3: `🔧 *Prefijos disponibles:*\n\nActualmente puedes usar los siguientes prefijos para los comandos: \`!\`, \`.\`, y \`$\``,
    4: `📞 *Contactar con el owner:*\n\nPuedes escribirle directamente aquí:\nwa.me/593999999999`, // <— cámbialo por tu número
    5: null, // Vuelve a mostrar el menú
    6: `✅ Has salido del menú. Si necesitas ayuda, solo escribe *hola*.`
};

// Temporizador para borrar el estado tras inactividad (en milisegundos)
const TIEMPO_EXPIRACION_MS = 3 * 60 * 1000; // 3 minutos

function mostrarMenu(nombre) {
    return MENU_PRINCIPAL.replace('{user}', nombre);
}

function iniciarTemporizador(jid) {
    const anterior = estadoUsuarios.get(jid);
    if (anterior?.timeout) clearTimeout(anterior.timeout);

    const timeout = setTimeout(() => {
        estadoUsuarios.delete(jid);
    }, TIEMPO_EXPIRACION_MS);

    estadoUsuarios.set(jid, { estado: 'esperando_opcion', timeout });
}

export default {
    name: 'menuPrivado',
    type: 'all', // funciona con cualquier mensaje
    execute: async (sock, msg, m) => {
        const jid = msg.key.remoteJid;

        // Solo responder en chats privados
        if (!jid.endsWith('@s.whatsapp.net')) return;

        const nombre = m.pushName || 'usuario';
        const mensajeTexto = m.text?.trim() || '';

        // Verifica si el usuario ya está en el flujo
        const estadoActual = estadoUsuarios.get(jid);

        // Si el usuario no ha iniciado conversación
        if (!estadoActual) {
            await sock.sendMessage(jid, {
                text: mostrarMenu(nombre)
            });
            iniciarTemporizador(jid);
            return;
        }

        // Si está esperando una opción
        if (estadoActual.estado === 'esperando_opcion') {
            const opcion = parseInt(mensajeTexto);

            if (!isNaN(opcion) && opcion >= 1 && opcion <= 6) {
                if (opcion === 5) {
                    await sock.sendMessage(jid, {
                        text: mostrarMenu(nombre)
                    });
                } else {
                    await sock.sendMessage(jid, {
                        text: OPCIONES[opcion]
                    });

                    if (opcion === 6) {
                        estadoUsuarios.delete(jid);
                        return;
                    }
                }
                iniciarTemporizador(jid);
            } else {
                await sock.sendMessage(jid, {
                    text: `❌ *Opción inválida.*\nPor favor, responde con un número del 1 al 6.`
                });
            }
        }
    }
};
