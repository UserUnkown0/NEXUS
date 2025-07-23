// main.js
import 'dotenv/config';
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';
import pino from 'pino';
import chalk from 'chalk';
import os from 'os';
import figlet from 'figlet';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

import { handleMessage } from './handlers/messageHandler.js';

const logger = pino({ level: 'silent' });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const qrPath = path.join(__dirname, 'public', 'qr.png');

async function displayQR(qr) {
    console.log(chalk.blueBright('\n📌 Escanea este código QR para autenticar tu bot:\n'));
    await qrcode.toFile(qrPath, qr, { width: 300 });
    console.log(chalk.greenBright(`✅ Código QR guardado en ${qrPath}`));
}

function showSystemInfo() {
    const totalRam = os.totalmem() / (1024 ** 3);
    const freeRam = os.freemem() / (1024 ** 3);

    console.log(chalk.blueBright('╭───────────────────────────────╮'));
    console.log(chalk.blueBright('│ ') + chalk.cyanBright.bold('📌 Información del sistema') + chalk.blueBright(' │'));
    console.log(chalk.blueBright('├───────────────────────────────┤'));
    console.log(chalk.blueBright('│ ') + chalk.yellow(`🖥️  ${os.type()} ${os.release()} - ${os.arch()}`));
    console.log(chalk.blueBright('│ ') + chalk.yellow(`💾 Total RAM: ${totalRam.toFixed(2)} GB`));
    console.log(chalk.blueBright('│ ') + chalk.yellow(`💽 RAM libre: ${freeRam.toFixed(2)} GB`));
    console.log(chalk.blueBright('╰───────────────────────────────╯\n'));
}

async function loadPlugins(sock) {
    const pluginsDir = path.join(__dirname, 'plugins');

    if (!fs.existsSync(pluginsDir)) {
        console.log(chalk.yellowBright('⚠️ La carpeta "plugins" no existe. Creándola...'));
        fs.mkdirSync(pluginsDir);
    }

    const files = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));

    for (const file of files) {
        try {
            const pluginPath = path.join(pluginsDir, file);
            const { default: plugin } = await import(`file://${pluginPath}`);
            if (typeof plugin === 'function') {
                plugin(sock);
                console.log(chalk.greenBright(`✅ Plugin cargado: ${file}`));
            } else {
                console.log(chalk.redBright(`⚠️ El plugin ${file} no exporta una función válida.`));
            }
        } catch (error) {
            console.error(chalk.redBright(`❌ Error al cargar el plugin ${file}:`), error);
        }
    }
}

function startServer() {
    const serverPath = path.join(__dirname, 'server.js');

    if (!fs.existsSync(serverPath)) {
        console.log(chalk.redBright(`❌ No se encontró server.js en: ${serverPath}`));
        return;
    }

    console.log(chalk.greenBright('🚀 Iniciando server.js...'));

    const serverProcess = spawn('node', [serverPath], { stdio: 'inherit' });

    serverProcess.on('error', (err) => {
        console.error(chalk.redBright('❌ Error al iniciar server.js:'), err);
    });

    serverProcess.on('exit', (code) => {
        console.log(chalk.redBright(`⚠️ server.js se cerró con código ${code}`));
    });
}

function startTrafficScripts() {
    const trafficDir = path.join(__dirname, 'traffic');

    if (!fs.existsSync(trafficDir)) {
        console.log(chalk.yellowBright('⚠️ La carpeta "traffic" no existe. No se iniciarán scripts de traffic.'));
        return;
    }

    const files = fs.readdirSync(trafficDir).filter(file => file.endsWith('.js'));

    if (files.length === 0) {
        console.log(chalk.yellowBright('⚠️ No se encontraron scripts .js en la carpeta "traffic".'));
        return;
    }

    for (const file of files) {
        const scriptPath = path.join(trafficDir, file);
        console.log(chalk.greenBright(`🚀 Iniciando script traffic: ${file}`));

        const trafficProcess = spawn('node', [scriptPath]);

        trafficProcess.stdout.on('data', (data) => {
            process.stdout.write(chalk.cyanBright(`[traffic:${file}] `) + data.toString());
        });

        trafficProcess.stderr.on('data', (data) => {
            process.stderr.write(chalk.redBright(`[traffic:${file} ERROR] `) + data.toString());
        });

        trafficProcess.on('error', (err) => {
            console.error(chalk.redBright(`[traffic:${file}] Error al iniciar:`), err);
        });

        trafficProcess.on('exit', (code) => {
            console.log(chalk.yellowBright(`[traffic:${file}] Proceso finalizado con código ${code}`));
        });
    }
}

export async function startBot() {
    try {
        console.clear();
        console.log(chalk.cyanBright(figlet.textSync('WhatsApp Bot', { horizontalLayout: 'fitted' })));
        console.log(chalk.greenBright.bold('🚀 Iniciando bot...\n'));
        showSystemInfo();

        startServer();
        startTrafficScripts();

        const { state, saveCreds } = await useMultiFileAuthState('auth_info');

        const sock = makeWASocket({
            auth: state,
            logger,
            printQRInTerminal: false
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                await displayQR(qr);
            }

            if (connection === 'open') {
                console.log(chalk.greenBright(`✅ ${process.env.BOT_NAME} está conectado.`));
                await loadPlugins(sock);
            } else if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(chalk.redBright('⚠️ Conexión cerrada.'));

                if (shouldReconnect) {
                    console.log(chalk.yellowBright('🔄 Intentando reconectar...'));
                    setTimeout(startBot, 5000);
                } else {
                    console.log(chalk.redBright('❌ Se cerró la sesión. Borra "auth_info" si deseas volver a escanear el QR.'));
                }
            } else if (connection === 'connecting') {
                console.log(chalk.blueBright('🔄 Conectando...'));
            } else if (connection === 'authenticating') {
                console.log(chalk.magentaBright('🔑 Esperando autenticación...'));
            }
        });

        sock.ev.on('messages.upsert', handleMessage);

    } catch (error) {
        console.error(chalk.redBright('❌ Error al iniciar el bot:'), error);
    }
}

// Ejecutar directamente si se llama main.js
if (process.argv[1] && process.argv[1].endsWith('main.js')) {
    startBot();
}
