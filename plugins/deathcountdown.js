import fs from 'fs';
import path from 'path';

const deathDataPath = path.join('./db', 'deathcountdown.json');
const alertSettingsPath = path.join('./db', 'death_alerts.json');

if (!fs.existsSync('./db')) fs.mkdirSync('./db');
if (!fs.existsSync(deathDataPath)) fs.writeFileSync(deathDataPath, '{}');
if (!fs.existsSync(alertSettingsPath)) fs.writeFileSync(alertSettingsPath, '{}');

function loadDeathData() {
    return JSON.parse(fs.readFileSync(deathDataPath, 'utf-8'));
}

function saveDeathData(data) {
    fs.writeFileSync(deathDataPath, JSON.stringify(data, null, 2));
}

function loadAlertSettings() {
    return JSON.parse(fs.readFileSync(alertSettingsPath, 'utf-8'));
}

function saveAlertSettings(data) {
    fs.writeFileSync(alertSettingsPath, JSON.stringify(data, null, 2));
}

export default function (sock) {
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages?.[0];
        if (!msg || !msg.message || msg.key.fromMe) return;

        const remoteJid = msg?.key?.remoteJid;
        const sender = msg?.key?.participant || msg?.key?.remoteJid;
        if (!remoteJid || !sender) return;

        const text = extractText(msg)?.trim();
        if (!text?.toLowerCase().startsWith('!deathcountdown')) return;

        const args = text.split(' ');
        const alertConfig = loadAlertSettings();

        // Configurar alertas
        if (args[1]?.toLowerCase() === 'alert') {
            const days = parseInt(args[2]);
            if (isNaN(days) || days < 1) {
                await sock.sendMessage(remoteJid, {
                    text: '❌ Usa un número válido de días. Ejemplo: !deathcountdown alert 3',
                    quoted: msg
                });
                return;
            }

            alertConfig[sender] = days;
            saveAlertSettings(alertConfig);

            await sock.sendMessage(remoteJid, {
                text: `🔔 Se configuraron alertas cada *${days} días*.`,
                quoted: msg
            });
            return;
        }

        const deathData = loadDeathData();
        let userDeath = deathData[sender];

        if (!userDeath) {
            const now = new Date();
            const years = Math.floor(Math.random() * 100);
            const days = Math.floor(Math.random() * 365);
            const hours = Math.floor(Math.random() * 24);
            const minutes = Math.floor(Math.random() * 60);
            const seconds = Math.floor(Math.random() * 60);

            const deathDate = new Date(
                now.getFullYear() + years,
                now.getMonth(),
                now.getDate() + days,
                hours,
                minutes,
                seconds
            );

            userDeath = { deathDate: deathDate.toISOString(), alertsSent: [] };
            deathData[sender] = userDeath;
            saveDeathData(deathData);
        }

        const deathDate = new Date(userDeath.deathDate);
        const now = new Date();
        const diffMs = deathDate - now;

        if (diffMs <= 0) {
            await sock.sendMessage(remoteJid, {
                text: '💀 Ya has muerto... 😵',
                quoted: msg
            });
            return;
        }

        const remaining = getRemainingTime(diffMs);

        const deathString = `🕒 *Tiempo restante a tu muerte:*\n${remaining.years} años, ${remaining.days} días, ${remaining.hours} horas, ${remaining.minutes} minutos, ${remaining.seconds} segundos\n\n📅 *Fecha exacta de muerte:* ${formatDate(deathDate)}`;

        await sock.sendMessage(remoteJid, {
            text: deathString,
            quoted: msg
        });
    });

    // Recordatorio automático cada hora
    setInterval(() => sendDeathReminders(sock), 1000 * 60 * 60);
}

// Enviar recordatorios automáticos
async function sendDeathReminders(sock) {
    const deathData = loadDeathData();
    const alertConfig = loadAlertSettings();
    const now = new Date();

    for (const user in deathData) {
        const data = deathData[user];
        const deathDate = new Date(data.deathDate);
        const remainingMs = deathDate - now;

        if (remainingMs <= 0) continue;

        const totalDays = remainingMs / (1000 * 60 * 60 * 24);
        if (totalDays < 2) continue;

        const interval = alertConfig[user] || 2;
        const lastAlert = data.alertsSent?.[data.alertsSent.length - 1];
        const nextAlertDate = lastAlert ? new Date(lastAlert) : new Date(now.getTime() - interval * 86400000);

        const timeSinceLastAlert = now - nextAlertDate;
        if (timeSinceLastAlert >= interval * 86400000) {
            const remaining = getRemainingTime(remainingMs);
            const countdownText = `🕒 Te quedan ${remaining.years} años, ${remaining.days} días, ${remaining.hours} horas, ${remaining.minutes} minutos y ${remaining.seconds} segundos antes de tu muerte.\n📅 Fecha final: *${formatDate(deathDate)}*`;

            await sock.sendMessage(user, {
                text: `☠️ *Recordatorio de muerte*\n\n${countdownText}`
            });

            // Guardar marca de alerta enviada
            data.alertsSent = [...(data.alertsSent || []), now.toISOString()];
            deathData[user] = data;
            saveDeathData(deathData);
        }
    }
}

// Extraer texto
function extractText(msg) {
    const message = msg.message;
    return (
        message?.conversation ||
        message?.extendedTextMessage?.text ||
        message?.imageMessage?.caption ||
        message?.videoMessage?.caption ||
        message?.documentMessage?.caption ||
        null
    );
}

// Calcular tiempo restante
function getRemainingTime(ms) {
    let total = Math.floor(ms / 1000);
    const seconds = total % 60;
    total = Math.floor(total / 60);
    const minutes = total % 60;
    total = Math.floor(total / 60);
    const hours = total % 24;
    total = Math.floor(total / 24);
    const days = total % 365;
    const years = Math.floor(total / 365);
    return { years, days, hours, minutes, seconds };
} 

// Formato legible
function formatDate(date) {
    return date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}
