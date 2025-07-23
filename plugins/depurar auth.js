// plugins/depurarKeys.js
import fs from 'fs/promises';
import path from 'path';

const AUTH_DIR = process.env.AUTH_DIR || './auth_info';
const FILES_TO_KEEP = parseInt(process.env.FILES_TO_KEEP, 10) || 3;
const MIN_FILE_AGE_MS = 15 * 60 * 1000; // 15 minutos mínimo para borrar archivo modificado recientemente
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos

let depurarAutoActivated = false;
let depurarIntervalMs = DEFAULT_INTERVAL_MS;
let depurarTimer = null;
let depurarLock = false;

async function safeSendMessage(sock, jid, message) {
  try {
    await sock.sendMessage(jid, { text: message });
  } catch (err) {
    console.error(`[depurarKeys] Error enviando mensaje a ${jid}:`, err);
  }
}

async function depurarArchivos(sock, chatId, notify = true) {
  if (depurarLock) {
    if (notify) await safeSendMessage(sock, chatId, '⚠️ La depuración ya está en curso. Por favor espera...');
    return;
  }
  depurarLock = true;
  try {
    const allFiles = await fs.readdir(AUTH_DIR);

    const now = Date.now();

    // Archivos importantes a conservar siempre:
    const importantFiles = ['creds.json', 'app-state.json'];

    // Filtramos archivos que queremos analizar para eliminar
    const candidateFiles = [];

    for (const fileName of allFiles) {
      const filePath = path.join(AUTH_DIR, fileName);

      // Siempre conservar archivos importantes
      if (importantFiles.includes(fileName)) continue;

      // Queremos limpiar archivos tipo: pre-key, sender-key, session-*, ssession-*
      const isTargetFile =
        (fileName.includes('pre-key') ||
         fileName.includes('sender-key') ||
         fileName.includes('session') ||
         fileName.includes('ssession')) &&
        fileName.endsWith('.json');

      if (!isTargetFile) continue;

      // Obtener stats para saber antigüedad
      const stats = await fs.stat(filePath);
      const ageMs = now - stats.mtimeMs;

      // Si el archivo fue modificado hace menos de MIN_FILE_AGE_MS, lo conservamos
      if (ageMs < MIN_FILE_AGE_MS) {
        continue;
      }

      candidateFiles.push({
        name: fileName,
        path: filePath,
        mtimeMs: stats.mtimeMs,
        ageMs,
      });
    }

    // Ordenar archivos candidatos por fecha descendente (los más nuevos primero)
    candidateFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);

    if (candidateFiles.length <= FILES_TO_KEEP) {
      if (notify) {
        await safeSendMessage(sock, chatId,
          `ℹ️ Solo se encontraron ${candidateFiles.length} archivo(s) para depurar. No hay suficientes para eliminar.`);
      }
      depurarLock = false;
      return;
    }

    // Conservar los más recientes
    const toKeep = candidateFiles.slice(0, FILES_TO_KEEP);
    const toDelete = candidateFiles.slice(FILES_TO_KEEP);

    let deletedCount = 0;

    for (const file of toDelete) {
      try {
        await fs.unlink(file.path);
        deletedCount++;
      } catch (err) {
        console.warn(`[depurarKeys] No se pudo eliminar ${file.name}:`, err.message);
      }
    }

    if (notify) {
      await safeSendMessage(sock, chatId,
        `✅ Depuración completada.\n🗑️ Archivos eliminados: ${deletedCount}\n📦 Archivos conservados:\n- ${toKeep.map(f => f.name).join('\n- ')}`);
    }

  } catch (err) {
    console.error('[depurarKeys] Error durante la depuración:', err);
    if (notify) {
      await safeSendMessage(sock, chatId, '❌ Error al depurar archivos. Revisa logs para más detalles.');
    }
  } finally {
    depurarLock = false;
  }
}

function iniciarDepuracionAuto(sock, chatId) {
  if (depurarTimer) clearInterval(depurarTimer);
  depurarTimer = setInterval(() => {
    depurarArchivos(sock, chatId, false);
  }, depurarIntervalMs);
  depurarAutoActivated = true;
}

function detenerDepuracionAuto() {
  if (depurarTimer) {
    clearInterval(depurarTimer);
    depurarTimer = null;
  }
  depurarAutoActivated = false;
}

function formatearIntervalo(ms) {
  if (ms % 60000 === 0) return `${ms / 60000} minuto(s)`;
  if (ms % 1000 === 0) return `${ms / 1000} segundo(s)`;
  return `${ms} ms`;
}

export default function depurarKeysPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    if (!messages || messages.length === 0) return;
    const msg = messages[0];
    if (!msg || msg.key.fromMe || !msg.message) return;

    const from = msg.key.remoteJid;

    const text = (
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ''
    ).trim();

    if (!text.toLowerCase().startsWith('!depurar')) return;

    const cmd = text.toLowerCase();

    if (cmd === '!depurar') {
      await depurarArchivos(sock, from);
      return;
    }

    if (cmd === '!depurar auto on') {
      if (depurarAutoActivated) {
        await safeSendMessage(sock, from, '⚠️ La depuración automática ya está activada.');
        return;
      }
      iniciarDepuracionAuto(sock, from);
      await safeSendMessage(sock, from,
        `✅ Depuración automática activada.\n⏳ Intervalo actual: ${formatearIntervalo(depurarIntervalMs)}.`);
      return;
    }

    if (cmd === '!depurar auto off') {
      if (!depurarAutoActivated) {
        await safeSendMessage(sock, from, '⚠️ La depuración automática ya está desactivada.');
        return;
      }
      detenerDepuracionAuto();
      await safeSendMessage(sock, from, '🛑 Depuración automática desactivada.');
      return;
    }

    if (cmd.startsWith('!depurar auto ')) {
      const param = cmd.slice('!depurar auto '.length).trim();
      const match = param.match(/^(\d+)(s|m)$/);
      if (!match) {
        await safeSendMessage(sock, from,
          '⚠️ Formato inválido. Usa:\n- `!depurar auto 300s`\n- `!depurar auto 5m`');
        return;
      }

      const cantidad = parseInt(match[1], 10);
      const unidad = match[2];

      if (cantidad <= 0) {
        await safeSendMessage(sock, from, '⚠️ El valor debe ser mayor que 0.');
        return;
      }

      depurarIntervalMs = unidad === 'm' ? cantidad * 60000 : cantidad * 1000;

      if (depurarAutoActivated) {
        iniciarDepuracionAuto(sock, from);
      }

      await safeSendMessage(sock, from,
        `✅ Intervalo de depuración automática ajustado a ${formatearIntervalo(depurarIntervalMs)}.`);
      return;
    }

    if (cmd === '!depurar status') {
      await safeSendMessage(sock, from,
        `ℹ️ Estado depuración automática: ${depurarAutoActivated ? '🟢 Activada' : '🔴 Desactivada'}\n⏳ Intervalo: ${formatearIntervalo(depurarIntervalMs)}`);
      return;
    }

    if (cmd === '!depurar help') {
      await safeSendMessage(sock, from,
        `📚 *Comandos disponibles:*\n` +
        `- !depurar: Ejecutar depuración manualmente\n` +
        `- !depurar auto on: Activar depuración automática\n` +
        `- !depurar auto off: Desactivar depuración automática\n` +
        `- !depurar auto <n>s|m: Cambiar intervalo (segundos o minutos)\n` +
        `- !depurar status: Estado actual\n` +
        `- !depurar help: Mostrar este mensaje\n`
      );
      return;
    }

    await safeSendMessage(sock, from, '❓ Comando no reconocido. Usa `!depurar help` para ayuda.');
  });
}
