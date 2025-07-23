import 'dotenv/config';
import chalk from 'chalk';

const ALERT_JID = process.env.ALERTA_SALIDA_JID || '5219991234567-1234567890@g.us'; // Tu grupo privado o número

export default async function (sock) {
  // 1. Cuando un admin elimina al bot del grupo
  sock.ev.on('group-participants.update', async (update) => {
    try {
      const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
      const groupId = update.id;

      if (update.action === 'remove' && update.participants.includes(botJid)) {
        let groupName = 'Grupo desconocido';
        try {
          const metadata = await sock.groupMetadata(groupId);
          groupName = metadata.subject;
        } catch (err) {
          console.warn(`⚠️ No se pudo obtener metadata de ${groupId}`);
        }

        const fecha = new Date().toLocaleString('es-EC', {
          timeZone: 'America/Guayaquil',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          day: '2-digit', month: '2-digit', year: 'numeric'
        });

        const mensaje = `🚨 *El bot fue eliminado de un grupo*\n\n`
                      + `📛 Nombre: *${groupName}*\n`
                      + `🆔 ID: ${groupId}\n`
                      + `📅 Fecha: ${fecha}`;

        await sock.sendMessage(ALERT_JID, { text: mensaje });
        console.log(chalk.red(`🔔 Bot eliminado del grupo: ${groupName} (${groupId})`));
      }
    } catch (e) {
      console.error('❌ Error en eliminación de grupo:', e);
    }
  });

  // 2. Detectar si un grupo ya no existe o fue eliminado completamente
  sock.ev.on('groups.update', async (updates) => {
    for (const update of updates) {
      const groupId = update.id;

      if (update.announce === true || update.restrict === true || update.suspended === true) {
        // Posible cierre o eliminación
        try {
          const metadata = await sock.groupMetadata(groupId);
          const groupName = metadata.subject;
          const fecha = new Date().toLocaleString('es-EC', {
            timeZone: 'America/Guayaquil',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            day: '2-digit', month: '2-digit', year: 'numeric'
          });

          const mensaje = `⚠️ *El grupo parece haber sido eliminado o restringido*\n\n`
                        + `📛 Grupo: *${groupName}*\n`
                        + `🆔 ID: ${groupId}\n`
                        + `📅 Fecha: ${fecha}`;

          await sock.sendMessage(ALERT_JID, { text: mensaje });
          console.log(chalk.yellow(`⚠️ Posible eliminación de grupo detectada: ${groupName}`));
        } catch (err) {
          if (err.message?.includes('GROUP_NOT_FOUND') || err.message?.includes('not found')) {
            const mensaje = `⚠️ *No se pudo acceder al grupo ${groupId}*\nPosiblemente fue eliminado por WhatsApp.`;
            await sock.sendMessage(ALERT_JID, { text: mensaje });
            console.log(chalk.gray(`🔍 Grupo no encontrado: ${groupId}`));
          }
        }
      }
    }
  });
}
