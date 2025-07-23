import fetch from 'node-fetch';
import libphonenumber from 'google-libphonenumber';
const PhoneNumberUtil = libphonenumber.PhoneNumberUtil.getInstance();
import * as dns from 'dns/promises';

// --- Configuración avanzada ---
const CONFIG = {
  HIBP_API_KEY: process.env.HIBP_API_KEY || '', 
  WHOIS_API_KEY: process.env.WHOIS_API_KEY || '',
  NUMVERIFY_API_KEY: process.env.NUMVERIFY_API_KEY || '',
  MAX_CONCURRENT_REQUESTS: 5,
  USER_AGENT: 'Advanced-OSINT-Tool/1.0',
  TIMEOUT_MS: 10000,
};

// --- Helpers de validación ---
const validators = {
  email: input => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input),
  ip: input => /^(25[0-5]|2[0-4]\d|1?\d\d?)(\.(25[0-5]|2[0-4]\d|1?\d\d?)){3}$/.test(input),
  domain: input => /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(input),
  phone: input => /^\+?[1-9]\d{6,14}$/.test(input),
};

// --- Función para hacer fetch con timeout y user-agent ---
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...options,
      headers: { 
        'User-Agent': CONFIG.USER_AGENT,
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

// --- Manejo de emails con HaveIBeenPwned ---
async function handleEmail(email) {
  const domain = email.split('@')[1];
  let output = `📧 *Email detectado:* ${email}\n- Dominio: ${domain}\n`;

  if (!CONFIG.HIBP_API_KEY) {
    output += '⚠️ Falta la API Key de HaveIBeenPwned para comprobar brechas.\n';
    return output;
  }

  try {
    const res = await fetchWithTimeout(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`, {
      headers: { 'hibp-api-key': CONFIG.HIBP_API_KEY },
    });

    if (res.status === 200) {
      const breaches = await res.json();
      const breachNames = breaches.map(b => b.Name).join(', ');
      output += `⚠️ Brechas encontradas: ${breachNames}\n`;
    } else if (res.status === 404) {
      output += '✅ No aparece en brechas conocidas.\n';
    } else {
      output += `❌ Error en consulta HaveIBeenPwned (Status: ${res.status})\n`;
    }
  } catch (err) {
    output += `❌ Error al consultar HaveIBeenPwned: ${err.message}\n`;
  }

  return output;
}

// --- Manejo de IPs con ip-api y DNS inverso ---
async function handleIP(ip) {
  let output = `🌍 *IP detectada:* ${ip}\n`;

  try {
    // Consulta ip-api
    const res = await fetchWithTimeout(`http://ip-api.com/json/${ip}?fields=status,country,city,regionName,isp,org,lat,lon,timezone,message`);
    const data = await res.json();

    if (data.status !== 'success') throw new Error(data.message || 'IP no válida');

    // Reverse DNS lookup (opcional y no bloqueante)
    let reverseDNS = 'N/A';
    try {
      const hostnames = await dns.reverse(ip);
      if (hostnames.length) reverseDNS = hostnames.join(', ');
    } catch {}

    output += `- País: ${data.country}\n- Ciudad: ${data.city}\n- Región: ${data.regionName}\n- ISP: ${data.isp}\n- Organización: ${data.org}\n- Ubicación: ${data.lat}, ${data.lon}\n- Zona Horaria: ${data.timezone}\n- DNS inverso: ${reverseDNS}\n`;
  } catch (err) {
    output += `❌ Error al consultar IP: ${err.message}\n`;
  }

  return output;
}

// --- Manejo avanzado de dominios con WHOIS + DNS ---
async function handleDomain(domain) {
  let output = `🌐 *Dominio detectado:* ${domain}\n`;

  // Chequeo DNS A records para validar existencia
  try {
    const records = await dns.resolve(domain, 'A');
    output += `- Registros DNS A: ${records.join(', ')}\n`;
  } catch {
    output += '❌ No se encontraron registros DNS A para este dominio.\n';
  }

  if (!CONFIG.WHOIS_API_KEY) {
    output += '⚠️ Falta la API Key de WHOIS para consulta avanzada.\n';
    output += `🔍 Puedes revisar manualmente: https://dnschecker.org/#A/${domain}\n`;
    return output;
  }

  try {
    const res = await fetchWithTimeout(`https://api.api-ninjas.com/v1/whois?domain=${domain}`, {
      headers: { 'X-Api-Key': CONFIG.WHOIS_API_KEY }
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);

    const data = await res.json();

    if (!data.domain_name) throw new Error('No se obtuvieron datos WHOIS');

    output += `- Registrador: ${data.registrar || 'N/A'}\n- Creación: ${data.creation_date || 'N/A'}\n- Expiración: ${data.expiration_date || 'N/A'}\n- Servidores DNS: ${data.name_servers ? data.name_servers.join(', ') : 'N/A'}\n`;
  } catch (err) {
    output += `❌ Error en consulta WHOIS: ${err.message}\n`;
  }

  output += `🔍 DNS Checker: https://dnschecker.org/#A/${domain}\n`;
  return output;
}

// --- Manejo avanzado de teléfono con libphonenumber + NumVerify ---
async function handlePhone(number) {
  let output = `📞 *Número detectado:* ${number}\n`;

  try {
    const parsed = PhoneNumberUtil.parse(number);
    const isValid = PhoneNumberUtil.isValidNumber(parsed);
    const region = PhoneNumberUtil.getRegionCodeForNumber(parsed);
    const formatted = PhoneNumberUtil.format(parsed, libphonenumber.PhoneNumberFormat.INTERNATIONAL);
    output += `- Formato internacional: ${formatted}\n- Válido: ${isValid}\n- Región: ${region}\n`;
  } catch {
    output += '❌ Número inválido o no reconocido internacionalmente.\n';
  }

  if (!CONFIG.NUMVERIFY_API_KEY) {
    output += '⚠️ Falta la API Key de NumVerify para detalles adicionales.\n';
    return output;
  }

  try {
    const res = await fetchWithTimeout(`http://apilayer.net/api/validate?access_key=${CONFIG.NUMVERIFY_API_KEY}&number=${encodeURIComponent(number)}`);
    const data = await res.json();

    if (data.valid) {
      output += `- País: ${data.country_name || 'N/A'}\n- Carrier: ${data.carrier || 'N/A'}\n- Tipo de línea: ${data.line_type || 'N/A'}\n`;
    } else {
      output += '❌ Número inválido según NumVerify.\n';
    }
  } catch (err) {
    output += `❌ Error en consulta NumVerify: ${err.message}\n`;
  }

  return output;
}

// --- Construye enlaces de búsqueda social con soporte avanzado ---
function buildSocialLinks(query) {
  const e = encodeURIComponent(query);
  return `
🔗 *Búsqueda OSINT General para:* ${query}

- Google: https://www.google.com/search?q=${e}
- Facebook: https://www.facebook.com/search/top/?q=${e}
- Instagram: https://www.instagram.com/${query}
- X (Twitter): https://x.com/search?q=${e}
- LinkedIn: https://www.linkedin.com/search/results/all/?keywords=${e}
- GitHub: https://github.com/${query}
- TikTok: https://www.tiktok.com/@${query}
- Telegram: https://t.me/${query}
- Reddit: https://www.reddit.com/search/?q=${e}
- Pipl (Persona): https://pipl.com/search/?q=${e}
- Hunter.io (Emails): https://hunter.io/search/${e}
`;
}

// --- Función principal para procesar el input ---
async function processInput(input) {
  input = input.trim();

  if (validators.email(input)) return await handleEmail(input);
  if (validators.ip(input)) return await handleIP(input);
  if (validators.domain(input)) return await handleDomain(input);
  if (validators.phone(input)) return await handlePhone(input);

  // Si no es ninguno, retorna búsquedas sociales generalizadas
  return buildSocialLinks(input);
}

// --- Ejemplo de integración con un bot WhatsApp (Baileys) ---
export default function osintPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages?.[0];
    if (!msg || !msg.message || msg.key.fromMe) return;

    const chat = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const match = text.match(/^!osint\s+(.+)/i);
    if (!match) return;

    const query = match[1].trim();
    const sender = msg.key.participant || chat;
    const mentions = [sender];

    await sock.sendPresenceUpdate('composing', chat);

    try {
      const response = await processInput(query);
      await sock.sendMessage(chat, { text: `🕵️‍♂️ *Análisis OSINT para:* _${query}_\n━━━━━━━━━━━━━━\n${response}\n━━━━━━━━━━━━━━\n👤 *Solicitado por:* @${sender.split('@')[0]}`, mentions });
    } catch (err) {
      await sock.sendMessage(chat, { text: `❌ Error general al procesar la solicitud: ${err.message}`, mentions });
    }
  });
}
