import fs from 'fs';

const RESPUESTAS = [
  "Sí.", "No.", "Tal vez.", "Posiblemente.", "Definitivamente sí.",
  "Definitivamente no.", "No estoy seguro.", "Pregúntame más tarde.",
  "Podría ser.", "Lo dudo.", "Claro que sí.", "No cuentes con ello.",
  "Todo apunta a que sí.", "Mis fuentes dicen que no."
];

const POSITIVAS = ["Sí.", "Definitivamente sí.", "Claro que sí.", "Todo apunta a que sí."];
const NEGATIVAS = ["No.", "Definitivamente no.", "No cuentes con ello.", "Mis fuentes dicen que no."];
const NEUTRALES = ["Tal vez.", "Posiblemente.", "No estoy seguro.", "Pregúntame más tarde.", "Podría ser.", "Lo dudo."];

const DB_PATH = './db_8ball.json';
const mensajesProcesados = new Set();

function obtenerCerteza(respuesta) {
  if (NEUTRALES.includes(respuesta)) return Math.floor(Math.random() * 21) + 10;
  if (["Todo apunta a que sí.", "Mis fuentes dicen que no."].includes(respuesta)) return Math.floor(Math.random() * 21) + 40;
  return Math.floor(Math.random() * 31) + 70;
}

function cargarDB() {
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, '{}');
  return JSON.parse(fs.readFileSync(DB_PATH));
}

function guardarDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export default function (sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m || !m.message || m.key.fromMe) return;

    const mensajeID = m.key.id;
    if (mensajesProcesados.has(mensajeID)) return;
    mensajesProcesados.add(mensajeID);
    setTimeout(() => mensajesProcesados.delete(mensajeID), 60000);

    const chatID = m.key.remoteJid;
    const texto = m.message?.conversation || m.message?.extendedTextMessage?.text || "";
    const authorID = m.key.participant || m.key.remoteJid;

    if (!/^!8ball(\s|$)/i.test(texto)) return;

    const args = texto.trim().split(/\s+/);
    const subcomando = args[1]?.toLowerCase();
    const mencionesOriginales = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const mentions = [...new Set([authorID, ...mencionesOriginales])];

    // Subcomando: stats
    if (subcomando === 'stats') {
      const db = cargarDB();
      const user = db[authorID];

      if (!user) {
        await sock.sendMessage(chatID, {
          text: "📊 No tienes estadísticas aún. ¡Haz tu primera pregunta con *!8ball*!",
        });
        return;
      }

      const total = user.total || 0;
      const pos = user.positivas || 0;
      const neg = user.negativas || 0;
      const neu = user.neutrales || 0;

      const pPos = ((pos / total) * 100).toFixed(1);
      const pNeg = ((neg / total) * 100).toFixed(1);
      const pNeu = ((neu / total) * 100).toFixed(1);

      await sock.sendMessage(chatID, {
        text:
`📊 *Tus estadísticas mágicas*
━━━━━━━━━━━━━━
• Preguntas totales: *${total}*
✅ Positivas: *${pos}* (*${pPos}%*)
❌ Negativas: *${neg}* (*${pNeg}%*)
🤔 Neutrales: *${neu}* (*${pNeu}%*)
━━━━━━━━━━━━━━`,
      });
      return;
    }

    // Subcomando: fake
    if (subcomando === 'fake') {
      const resto = texto.slice(texto.indexOf('fake') + 4).trim();
      const [pregunta, respuesta, certezaStr] = resto.split(/\s*\+\s*/);

      if (!pregunta || !respuesta || !certezaStr) {
        await sock.sendMessage(chatID, {
          text: "⚠️ Formato incorrecto.\nUsa: *!8ball fake pregunta + respuesta + certeza*\n\n_Ejemplo:_\n!8ball fake mati es adorable? + Sí + 100%",
        });
        return;
      }

      const certeza = parseInt(certezaStr);
      if (isNaN(certeza) || certeza < 0 || certeza > 100) {
        await sock.sendMessage(chatID, {
          text: "⚠️ La certeza debe ser un número entre 0 y 100.",
        });
        return;
      }

      await sock.sendMessage(chatID, {
        text:
`━━━━━━━━━━━━━━
🎱 *Pregunta:* _${pregunta.trim()}_
> 🧠 *Respuesta:* ${respuesta.trim()} (${certeza}% de certeza)
━━━━━━━━━━━━━━

『👤 *Autor:* @${authorID.split('@')[0]}』

  █║▌│█│║▌║││█║▌║▌║`,
        mentions
      });
      return;
    }

    // Pregunta normal
    const pregunta = args.slice(1).join(" ").trim();
    if (!pregunta) {
      await sock.sendMessage(chatID, {
        react: { text: "🧐", key: m.key },
      });

      await sock.sendMessage(chatID, {
        text: "🎱 *Por favor, escribe una pregunta.*\n\n> Ejemplo: *!8ball Voy a tener suerte hoy?*",
      });
      return;
    }

    await sock.sendMessage(chatID, { react: { text: "🧐", key: m.key } });
    await sock.sendPresenceUpdate('composing', chatID);
    await new Promise(r => setTimeout(r, 3000));
    await sock.sendPresenceUpdate('paused', chatID);
    await sock.sendMessage(chatID, { react: { text: "🎱", key: m.key } });

    const respuesta = RESPUESTAS[Math.floor(Math.random() * RESPUESTAS.length)];
    const certeza = obtenerCerteza(respuesta);

    const db = cargarDB();
    if (!db[authorID]) db[authorID] = { total: 0, positivas: 0, negativas: 0, neutrales: 0 };
    db[authorID].total++;
    if (POSITIVAS.includes(respuesta)) db[authorID].positivas++;
    else if (NEGATIVAS.includes(respuesta)) db[authorID].negativas++;
    else if (NEUTRALES.includes(respuesta)) db[authorID].neutrales++;
    guardarDB(db);

    await sock.sendMessage(chatID, {
      text:
`━━━━━━━━━━━━━━
🎱 *Pregunta:* _${pregunta}_
> 🧠 *Respuesta:* ${respuesta} (${certeza}% de certeza)
━━━━━━━━━━━━━━

『👤 *Autor:* @${authorID.split('@')[0]}』

  █║▌│█│║▌║││█║▌║▌║`,
      mentions,
    });
  });
}
