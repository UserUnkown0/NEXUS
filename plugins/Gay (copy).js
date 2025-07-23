import fetch from 'node-fetch';

const cooldown = new Map();
const userAttempts = new Map(); // Intentos restantes por usuario
const processingQueue = [];

const MAX_USES_BEFORE_COOLDOWN = 3;
const COOLDOWN_TIME = 15000; // 15 segundos

// Frases aleatorias: divertidas, absurdas, épicas
const GAY_PHRASES = [
  "🏳️‍🌈 ¡@{name} ha sido oficialmente declarado GAY! 🏳️‍🌈",
  "💅 ¡@{name} acaba de salir del closet, felicidades reina! 💅",
  "🌈 @{name} ha alcanzado el nivel máximo de FABULOSIDAD 🌈",
  "🎉 @{name} acaba de unirse al equipo arcoíris 🎉",
  "🔥 @{name} fue atrapado viendo RuPaul’s Drag Race... confirmado 🔥",
  "👑 @{name} se ha coronado como la reina del arcoíris 👑",
  "🪩 @{name} fue absorbido por una disco gay y nunca volvió igual 🪩",
  "💖 @{name} brilló tanto que ahora es considerado patrimonio LGBT 💖",
  "🥒 @{name} fue visto acariciando un pepino mientras cantaba el himno nacional en japonés.",
  "🦖 @{name} es 87% dinosaurio y 13% arcoíris, según el Instituto de Cosas Raras.",
  "🚽 @{name} cayó en el inodoro interdimensional y regresó más gay que nunca.",
  "📦 @{name} pidió una caja por Amazon y le llegó su certificado gay firmado por Diosito.",
  "🐓 @{name} fue perseguido por una gallina gay en la dimensión 5D.",
  "🧼 @{name} se resbaló en la ducha mientras cantaba Shakira. Despertó gay.",
  "🐸 @{name} besó a una rana y se convirtió en influencer de maquillaje LGBT.",
  "📸 @{name} aparece en todos los memes LGBT. Coincidencia? No lo creo 📸",
  "🎭 @{name} fingía ser hetero... pero no aguantó la actuación 🎭",
  "🧃 @{name} bebió juguito de gay y ahora brilla por dentro 🧃",
  "👁️ @{name} vio una bandera LGBT y comenzó a bailar sin control 👁️",
  "🕺 @{name} fue visto bailando con tacones y purpurina. ¡GAY confirmado! 🕺",
];

export default async function (sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    if (!messages?.length) return;

    const m = messages[0];
    const jid = m.key.remoteJid;
    if (!jid?.endsWith('@g.us')) return;

    const text = m.message?.conversation ||
                 m.message?.extendedTextMessage?.text || '';
    const command = text.trim().split(/\s+/)[0]?.toLowerCase();

    const validCommands = ['!gey', '!gay', '!gei'];
    if (!validCommands.includes(command)) return;

    const mentions = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const sender = m.key.participant;

    if (mentions.length === 0) {
      return sock.sendMessage(jid, {
        text: '📌 Debes mencionar al menos a un usuario: *!gay @usuario*'
      }, { quoted: m });
    }

    const now = Date.now();

    // Validar cooldown + intentos por usuario
    const cdEnd = cooldown.get(sender);
    if (cdEnd && now < cdEnd) {
      const remaining = ((cdEnd - now) / 1000).toFixed(1);
      return sock.sendMessage(jid, {
        text: `🚀 Espera *${remaining}s*… tu comando está recargando energía 🔋`,
        mentions: [sender]
      }, { quoted: m });
    }

    let attempts = userAttempts.get(sender) ?? MAX_USES_BEFORE_COOLDOWN;
    if (attempts <= 0) {
      cooldown.set(sender, now + COOLDOWN_TIME);
      userAttempts.set(sender, MAX_USES_BEFORE_COOLDOWN);
      return sock.sendMessage(jid, {
        text: `⛔ Has usado todos tus intentos. Enfriando motores… espera *${COOLDOWN_TIME / 1000}s* ⚡`,
        mentions: [sender]
      }, { quoted: m });
    }

    // Restar intento y avisar cuantos quedan
    userAttempts.set(sender, attempts - 1);
    const remainingAttempts = attempts - 1;

    if (remainingAttempts > 0) {
      await sock.sendMessage(jid, {
        text: `✨ ¡Perfecto! Te quedan *${remainingAttempts}* intento(s) antes de que el comando se tome un descanso. 🛌`,
        mentions: [sender]
      }, { quoted: m });
    } else {
      await sock.sendMessage(jid, {
        text: `🔥 Último intento usado. Después de este, cooldown de *${COOLDOWN_TIME / 1000}s* activado. ⏳`,
        mentions: [sender]
      }, { quoted: m });
    }

    // Agregar a cola para procesar uno por uno
    processingQueue.push(() => processMentions(sock, m, jid, mentions));
    if (processingQueue.length === 1) processNext();
  });
}

async function processNext() {
  if (!processingQueue.length) return;
  const next = processingQueue[0];

  try {
    await next();
  } catch (err) {
    console.error('❌ Error en procesamiento:', err);
  } finally {
    processingQueue.shift();
    if (processingQueue.length) processNext();
  }
}

async function processMentions(sock, m, jid, mentions) {
  try {
    await sock.sendMessage(jid, { react: { text: '🏳️‍🌈', key: m.key } });

    for (const mentionedJid of mentions) {
      let profilePic = 'https://i.ibb.co/TgY9v1d/placeholder.png';
      let name = mentionedJid.split('@')[0];

      try {
        profilePic = await sock.profilePictureUrl(mentionedJid, 'image');
      } catch {
        console.warn(`⚠️ No se pudo obtener la foto de perfil de ${mentionedJid}`);
      }

      try {
        const [contact] = await sock.onWhatsApp(mentionedJid);
        name = contact?.notify || name;
      } catch {
        console.warn(`⚠️ No se pudo obtener el nombre de ${mentionedJid}`);
      }

      try {
        const url = `https://some-random-api.com/canvas/gay?avatar=${encodeURIComponent(profilePic)}`;
        const res = await fetch(url);

        if (!res.ok || !res.headers.get('content-type')?.includes('image')) {
          throw new Error(`API inválida o imagen corrupta (status: ${res.status})`);
        }

        const imgBuffer = await res.buffer();
        const randomText = GAY_PHRASES[Math.floor(Math.random() * GAY_PHRASES.length)].replace('{name}', name);

        await sock.sendMessage(jid, {
          image: imgBuffer,
          caption: randomText,
          mentions: [mentionedJid]
        }, { quoted: m });

      } catch (err) {
        console.error(`❌ Error generando imagen para ${mentionedJid}:`, err.message);
        const errorMsg = err.message.includes('API') ?
          `⚠️ La API falló al generar la imagen para @${name}. Intenta más tarde.` :
          `❌ No se pudo procesar a @${name}.`;

        await sock.sendMessage(jid, {
          text: errorMsg,
          mentions: [mentionedJid]
        }, { quoted: m });
      }
    }
  } catch (err) {
    console.error('❌ Error general en processMentions:', err);
  }
}
