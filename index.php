<?php
session_start();

// Desactiva caché para evitar mostrar QR antiguos
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

// Rutas posibles para el QR generado
$qrImage = "public/qr.png";
$qrImagePath = "qr_code.png";

// Verifica si alguna imagen existe
$qrToShow = file_exists($qrImage) ? $qrImage : (file_exists($qrImagePath) ? $qrImagePath : "");
?>
<!DOCTYPE html>
<html lang="es">
<head> 
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Phantom Bot</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #efeae2;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 40px;
            box-shadow: 10px 4px 15px rgba(0, 0, 0, 0.1);
            width: 800px;
            max-width: 90%;
            border: 3px solid black;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .instructions {
            text-align: left;
            font-size: 16px;
            width: 55%;
        }
        .qr-section {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        img {
            width: 300px;
            height: auto;
            border: 2px solid black;
            border-radius: 10px;
        }
        .checkbox {
            display: flex;
            align-items: center;
            margin-top: 10px;
            font-size: 14px;
        }
        .checkbox input {
            margin-right: 8px;
        }
        .btn {
            display: inline-block;
            background-color: #0b81ff;
            color: white;
            text-decoration: none;
            font-size: 14px;
            padding: 10px 15px;
            border-radius: 8px;
            text-align: center;
            margin-top: 10px;
            transition: 0.3s;
        }
        .btn:hover {
            background-color: #0969d9;
        }
        .footer {
            font-size: 12px;
            color: gray;
            margin-top: 20px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="instructions">
            <h1>Inicia sesión con Phantom Bot</h1>
            <p>1. Abre WhatsApp en tu teléfono.</p>
            <p>2. Toca Menú en Android o Ajustes en iPhone.</p>
            <p>3. Toca <strong>Dispositivos vinculados</strong> y, luego, <strong>Vincular un dispositivo</strong>.</p>
            <p>4. Apunta tu teléfono hacia esta pantalla para escanear el código QR.</p>

            <a href="#" class="btn">Iniciar sesión con número de teléfono</a>
        </div>

        <div class="qr-section">
            <?php if (!empty($qrToShow)): ?>
                <img id="qr-image" src="<?= htmlspecialchars($qrToShow) . '?t=' . time() ?>" alt="Código QR">
            <?php else: ?>
                <p><strong>Código QR no disponible por el momento.</strong></p>
            <?php endif; ?>
            <div class="checkbox">
                <input type="checkbox" checked> <span>Mantener la sesión iniciada en este navegador</span>
            </div>
        </div>
    </div>

    <div class="footer">
        Tus mensajes personales están cifrados de extremo a extremo
    </div>

    <script>
        (function() {
            const refreshInterval = 60000; // 60 segundos
            const qrImage = document.getElementById('qr-image');

            function refreshQR() {
                if (qrImage) {
                    const newSrc = qrImage.src.split('?')[0] + '?t=' + new Date().getTime();
                    fetch(newSrc, { method: 'HEAD' })
                        .then(response => {
                            if (response.ok) {
                                qrImage.src = newSrc;
                            } else {
                                console.warn("QR no disponible, reintenta en el siguiente ciclo.");
                            }
                        })
                        .catch(err => {
                            console.error("Error al recargar QR:", err);
                        });
                }
            }

            setInterval(refreshQR, refreshInterval);
        })();
    </script>
</body>
</html>
