const VALID_PREFIXES = new Set(["!", "$", "%", "&", "/", "#", "?", "."]);
const VALID_ALIASES = new Set(["help", "ayuda", ".menu"]);

const COMMANDS = [
  {
    command: "!promote <Mención usuario>",
    description: "Promueve al usuario a administrador.",
    category: "Admin",
  },
  {
    command: "!demote",
    description: "Despromueve al usuario de administrador.",
    category: "Admin",
  },
  {
    command: "!group <on/off>",
    description: "Solo admins pueden hablar.",
    category: "Admin",
  },
  {
    command: "!close + <segundos> + <texto>",
    description: "Cierra el grupo temporalmente.",
    category: "Admin",
  },
  {
    command: "!gay, !printgay, !gei + [Mención usuario]",
    description: "Convierte el perfil del usuario con la bandera gay.",
    category: "Diversión",
  },
  {
    command: "!banana + <Mención usuario>",
    description: "Mide tu banana o la de otro usuario.",
    category: "Diversión",
  },
  {
    command: "!romance <Mención usuario 1> + <Mención usuario2>",
    description: "Porcentaje de compatibilidad entre dos usuarios.",
    category: "Diversión",
  },
  {
    command: "!8ball <mensaje>",
    description: "Responde con sí o no.",
    category: "Diversión",
  },
  {
    command: "!toimg",
    description: "Convierte un sticker a imagen.",
    category: "Multimedia",
  },
  {
    command: "!s",
    description: "Convierte un sticker a imagen.",
    category: "Multimedia",
  },
  {
    command: "!pfp (user + mención /group)",
    description: "Muestra la foto de perfil del usuario o grupo.",
    category: "Multimedia",
  },
  {
    command: "!play <nombre canción>",
    description: "Reproduce audio de YouTube.",
    category: "Multimedia",
  },
  {
    command: "!tts <mensaje>",
    description: "Texto a voz con IA de Google.",
    category: "Multimedia",
  },
  {
    command: "!spy + <responder Foto,audio,video>",
    description: "[Premium] Reenvía contenido enviado una vez.",
    category: "Multimedia",
  },
  {
    command: "!help [página]",
    description: "Muestra esta lista de comandos con paginación.",
    category: "Utilidades",
  },
  {
    command: "!warn + <Mención usuario> + <Mensaje>",
    description: "Advierte al usuario mencionado.",
    category: "Utilidades",
  },
  {
    command: "!moneda",
    description: "Muestra cara o sello.",
    category: "Utilidades",
  },
  {
    command: "!wiki <término>",
    description: "Busca en Wikipedia.",
    category: "Utilidades",
  },
  {
    command: "!google <consulta>",
    description: "Busca resultados en Google (DuckDuckGo).",
    category: "Utilidades",
  },
  {
    command: "!pinterest <término>",
    description: "Busca imágenes en Pinterest.",
    category: "Utilidades",
  },
];

const COMMANDS_PER_PAGE = 5;
const COOLDOWN_MS = 5000;
const cooldownUsers = new Map();

function extractMessageText(msg) {
  const m = msg.message;
  return (
    m?.conversation ||
    m?.extendedTextMessage?.text ||
    m?.imageMessage?.caption ||
    m?.videoMessage?.caption ||
    m?.buttonsResponseMessage?.selectedButtonId ||
    m?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ""
  );
}

function isValidHelpCommand(text) {
  if (!text?.trim()) return false;
  const lower = text.toLowerCase();
  return [...VALID_PREFIXES].some((prefix) =>
    [...VALID_ALIASES].some((alias) => lower.startsWith(prefix + alias)),
  );
}

function parseHelpArgs(text) {
  const parts = text.trim().split(/\s+/).slice(1);
  const page = parts.find((p) => /^\d+$/.test(p))
    ? parseInt(parts.find((p) => /^\d+$/.test(p)))
    : null;
  const catInput = parts.find((p) => !/^\d+$/.test(p));
  return { page, category: catInput };
}

const categoriesMap = (() => {
  const map = {};
  for (const cmd of COMMANDS) {
    if (!map[cmd.category]) map[cmd.category] = [];
    map[cmd.category].push(cmd);
  }
  return map;
})();

function formatCommandsList(commands, page = 1) {
  const totalPages = Math.ceil(commands.length / COMMANDS_PER_PAGE);
  if (page > totalPages || page < 1) return null;

  const slice = commands.slice(
    (page - 1) * COMMANDS_PER_PAGE,
    page * COMMANDS_PER_PAGE,
  );
  const list = slice
    .map((cmd) => `🔹 *${cmd.command}*\n   ➤ ${cmd.description}`)
    .join("\n\n");

  return [
    "📚 *Lista de comandos disponibles:*",
    "",
    list,
    "",
    `Página *${page}* de *${totalPages}*`,
    "Usa `!help [página]` o `!help [categoría]` para explorar más.",
  ].join("\n");
}

function formatWelcome() {
  return [
    "*┌──────────── ∘°「NEXUBOT」°∘ ───────────┐*",
    "│",
    "│ ➥ Bienvenido: @user",
    "│",
    "│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ • ✦",
    "│ » _Prefix_ : *!* ",
    "│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ • ✦",
    "│   Aquí tienes la lista de comandos 📚",
    "│",
    "│ •➤ Usa *!help [número de página]* ",
    "│ •➤ Para ver por categorías escribe *!help categorias*",
    "│ •➤ Para ver por categorías escribe *!help [categoria]*",
    "│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─",
    "│  *Canal oficial*",
    "│ ➥ https://whatsapp.com/channel/0029VbAeSti2f3EKii6uLH2x",
    "│✐ Dev: IamLilSpooky",
    "*└─────────── °∘꒰  ׅ୭ 2.2.5 ୧ ׅ ꒱∘° ───────────┘*",
  ].join("\n");
}

function formatCategories() {
  const catList = Object.entries(categoriesMap)
    .map(([cat, cmds]) => `* ${cat} (${cmds.length} comandos)`)
    .join("\n");

  return [
    "📂 Categorías de comandos disponibles:",
    "",
    catList,
    "",
    "Usa `!help [categoría]` o `!help 1 [categoría]` para ver sus comandos.",
  ].join("\n");
}

export default function registerHelpPlugin(sock) {
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages?.[0];
      if (!msg?.message || msg.key?.fromMe) return;

      const from = msg.key?.remoteJid || "";
      const userId = msg.key?.participant || msg.key?.remoteJid || "unknown";
      const body = extractMessageText(msg);
      if (!body) return;

      if (!isValidHelpCommand(body)) return;

      const now = Date.now();
      if (cooldownUsers.get(userId) > now - COOLDOWN_MS) {
        await sock.sendMessage(from, {
          text: "⏳ Espera unos segundos antes de volver a usar el comando.",
        });
        return;
      }
      cooldownUsers.set(userId, now);

      const lowerText = body.toLowerCase();
      const { page, category } = parseHelpArgs(lowerText);

      if (!page && !category) {
        await sock.sendMessage(from, { text: formatWelcome() });
        return;
      }

      if (
        ["categorias", "categoría", "cat"].includes(category?.toLowerCase())
      ) {
        await sock.sendMessage(from, { text: formatCategories() });
        return;
      }

      if (page && !category) {
        const allCommandsSorted = Object.values(categoriesMap).flat();
        const formatted = formatCommandsList(allCommandsSorted, page);
        if (!formatted) {
          await sock.sendMessage(from, {
            text: `❌ Página inválida. Solo hay *${Math.ceil(allCommandsSorted.length / COMMANDS_PER_PAGE)}* páginas.`,
          });
          return;
        }
        await sock.sendMessage(from, { text: formatted });
        return;
      }

      const catKey = capitalize(category || "");
      if (catKey in categoriesMap) {
        const cmds = categoriesMap[catKey];
        const formatted = formatCommandsList(cmds, page || 1);
        if (!formatted) {
          await sock.sendMessage(from, {
            text: `❌ Página inválida. Solo hay *${Math.ceil(cmds.length / COMMANDS_PER_PAGE)}* páginas.`,
          });
          return;
        }
        await sock.sendMessage(from, { text: formatted });
        return;
      }

      // Categoría inválida
      await sock.sendMessage(from, {
        text: `❌ La categoría o palabra *"${category}"* no es válida.\n\n📌 Usa *!help categorias* para ver la lista de categorías disponibles.`,
      });
    } catch (err) {
      console.error("❌ Error en help plugin:", err);
    }
  });
}

// Helper
function capitalize(str = "") {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
