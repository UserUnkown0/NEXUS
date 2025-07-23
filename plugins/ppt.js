// plugins/ppt.js

const opciones = ['🪨 Piedra', '📄 Papel', '✂️ Tijera'];
const ranking = new Map(); // Mapa de puntuaciones
const timeouts = new Map(); // Mapa de timeouts

export default function (sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const text = m.message?.conversation || m.message?.extendedTextMessage?.text;
    if (!text || !text.startsWith('!ppt')) return;

    const partes = text.trim().split(/\s+/);
    const eleccionUsuario = partes[1]?.toLowerCase();

    const eleccionesValidas = {
      piedra: '🪨 Piedra',
      papel: '📄 Papel',
      tijera: '✂️ Tijera'
    };

    if (!eleccionUsuario || !eleccionesValidas[eleccionUsuario]) {
      await sock.sendMessage(m.key.remoteJid, {
        text: "✋ Debes escribir *!ppt piedra*, *!ppt papel* o *!ppt tijera* para jugar."
      });
      return;
    }

    const jid = m.key.participant || m.key.remoteJid;
    const nombre = m.pushName || 'Usuario';

    // Inicializar puntaje si no existe
    if (!ranking.has(jid)) {
      ranking.set(jid, { bot: 0, user: 0 });
    }

    // Cancelar posibles timeouts anteriores
    if (timeouts.has(jid)) clearTimeout(timeouts.get(jid).advertencia);
    if (timeouts.has(jid)) clearTimeout(timeouts.get(jid).reset);

    // Mensaje inicial
    const msg = await sock.sendMessage(m.key.remoteJid, {
      text: "Piedra..."
    });

    await delay(1000);
    await sock.sendMessage(m.key.remoteJid, {
      edit: msg.key,
      text: "Piedra...\nPapel..."
    });

    await delay(1000);
    await sock.sendMessage(m.key.remoteJid, {
      edit: msg.key,
      text: "Piedra...\nPapel...\n¡Tijera!"
    });

    await delay(1000);

    const eleccionBot = opciones[Math.floor(Math.random() * 3)];
    const eleccionBotTexto = eleccionBot.split(' ')[1].toLowerCase();
    const resultado = obtenerResultado(eleccionUsuario, eleccionBotTexto);

    const puntaje = ranking.get(jid);

    if (resultado === 'usuario') puntaje.user++;
    else if (resultado === 'bot') puntaje.bot++;

    const mensajeFinal = `
┏━━━━━━━━━━━━┓
  🎮 *Resultados*:
🤖 Bot: ${puntaje.bot} / ${puntaje.user} @${jid.split('@')[0]}
🧠 Bot ha sacado:
${eleccionBot}

👤 ${nombre} ha sacado:
${eleccionesValidas[eleccionUsuario]}

📣 *Ganador:* ${resultado === 'empate' ? '🤝 Empate' : resultado === 'usuario' ? '🎉 ¡El usuario gana!' : '🤖 ¡El bot gana!'}
┗━━━━━━━━━━━━┛`.trim();

    await sock.sendMessage(m.key.remoteJid, {
      edit: msg.key,
      text: mensajeFinal,
      mentions: [jid]
    });

    // Configurar timeouts
    const advertencia = setTimeout(async () => {
      await sock.sendMessage(jid, {
        text: `⚠️ *¡Atención!* Tu partida de *!ppt* ha quedado incompleta con un marcador de *${puntaje.bot} / ${puntaje.user}*\n\n¿Deseas seguir jugando?\nUsa el comando *!ppt* para continuar.\n\nSi no respondes en 5 minutos, tu racha se reiniciará.`
      });
    }, 5 * 60 * 1000); // 5 minutos

    const reset = setTimeout(async () => {
      ranking.delete(jid);
      await sock.sendMessage(jid, {
        text: `😢 *Upps!!* Tu partida de *ppt* ha sido reiniciada por inactividad.\n\nNo te preocupes, puedes empezar una nueva racha escribiendo *!ppt* nuevamente.`
      });
    }, 10 * 60 * 1000); // 10 minutos

    timeouts.set(jid, { advertencia, reset });
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function obtenerResultado(usuario, bot) {
  if (usuario === bot) return 'empate';

  if (
    (usuario === 'piedra' && bot === 'tijera') ||
    (usuario === 'papel' && bot === 'piedra') ||
    (usuario === 'tijera' && bot === 'papel')
  ) {
    return 'usuario';
  } else {
    return 'bot';
  }
}
