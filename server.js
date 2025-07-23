import express from 'express';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
let PORT = process.env.PORT || 3000;

// Ruta del binario PHP
const phpPath = "/nix/store/mh30jsg3rmgi3177yhmfiadggwcknjr2-php-with-extensions-8.1.29/bin/php";

// Middleware para parsear datos POST
app.use(express.urlencoded({ extended: true }));

// ✅ MUEVE ESTE BLOQUE ARRIBA de express.static para que PHP se ejecute primero
app.use((req, res, next) => {
    if (req.path.endsWith('.php')) {
        const phpFile = path.join(__dirname, req.path);

        if (!phpFile.startsWith(__dirname)) {
            return res.status(403).send('❌ Acceso no permitido.');
        }

        if (!fs.existsSync(phpFile)) {
            return res.status(404).send('❌ Archivo PHP no encontrado.');
        }

        exec(`${phpPath} -f "${phpFile}"`, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Error al ejecutar PHP:', stderr || error.message);
                return res.status(500).send(`❌ Error al ejecutar PHP: ${stderr || error.message}`);
            }
            res.setHeader("Content-Type", "text/html; charset=utf-8"); // ✅ Muy importante para renderizar HTML
            res.send(stdout);
        });
    } else {
        next();
    }
});

// ⬇️ Se mantiene express.static debajo
app.use(express.static(__dirname));

/* ======================
   🔁 RUTAS UPTIME
====================== */

app.get('/', (req, res) => {
    const phpFile = path.join(__dirname, 'index.php');
    if (!fs.existsSync(phpFile)) {
        return res.status(404).send('❌ index.php no encontrado.');
    }

    exec(`${phpPath} -f "${phpFile}"`, (error, stdout, stderr) => {
        if (error) {
            console.error('❌ Error al ejecutar PHP:', stderr || error.message);
            return res.status(500).send(`❌ Error al ejecutar PHP: ${stderr || error.message}`);
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        console.log('📄 index.php procesado');
        res.send(stdout);
    });
});

app.get('/ping', (_, res) => {
    console.log('📡 Ping recibido');
    res.status(200).send('✅ Bot activo - Ping recibido');
});

app.get('/uptime', (_, res) => {
    res.status(200).send(`✅ Uptime OK - ${new Date().toISOString()}`);
});

app.get('/status', (_, res) => {
    res.json({
        status: '🟢 Activo',
        serverTime: new Date().toISOString(),
        platform: process.platform
    });
});

/* ======================
   ✉️ ENVÍO DE MENSAJES
====================== */

app.post('/send-message', (req, res) => {
    const message = req.body.message;

    if (!message || message.trim() === '') {
        return res.status(400).send('⚠️ El mensaje está vacío.');
    }

    const sanitized = message.replace(/"/g, '\\"');
    const command = `node sendMessage.js "${sanitized}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error('❌ Error al enviar mensaje:', stderr || error.message);
            return res.status(500).send(`❌ Error: ${stderr || error.message}`);
        }
        console.log('📤 Mensaje enviado');
        res.send(`✅ Mensaje enviado: ${stdout}`);
    });
});

/* ======================
   🚀 INICIO DEL SERVIDOR
====================== */

app.listen(PORT, () => {
    console.log(`🌐 Servidor activo en: http://localhost:${PORT}`);
    console.log(`📡 Uptime: http://localhost:${PORT}/ping, /uptime, /status`);
}).on('error', err => {
    console.error(`❌ Error al iniciar el servidor: ${err.message}`);
});
