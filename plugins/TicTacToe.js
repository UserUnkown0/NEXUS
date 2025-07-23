import { randomInt } from 'crypto';

const games = {};
const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
const symbols = ['❌', '⭕'];

function renderBoard(board) {
  return `${board[0]} | ${board[1]} | ${board[2]}
———+———+———
${board[3]} | ${board[4]} | ${board[5]}
———+———+———
${board[6]} | ${board[7]} | ${board[8]}`;
}

function checkWinner(board, symbol) {
  const wins = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  return wins.some(line => line.every(i => board[i] === symbol));
}

function botMove(board, botSymbol, playerSymbol) {
  const empty = board.map((v, i) => v === emojis[i] ? i : null).filter(i => i !== null);
  for (let i of empty) {
    const temp = [...board]; temp[i] = botSymbol;
    if (checkWinner(temp, botSymbol)) return i;
  }
  for (let i of empty) {
    const temp = [...board]; temp[i] = playerSymbol;
    if (checkWinner(temp, playerSymbol)) return i;
  }
  return empty[Math.floor(Math.random() * empty.length)];
}

export default function tttPlugin(sock) {
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const from = m.key.remoteJid;
    const isGroup = from.endsWith('@g.us');
    const sender = m.key.participant || m.key.remoteJid;
    const userGameKey = `${from}:${sender}`; // Clave única por jugador + chat
    const body = m.message.conversation || m.message.extendedTextMessage?.text || '';

    if (body.startsWith('!ttt')) {
      const args = body.trim().split(/\s+/);
      const command = args[1];

      if (!command) {
        // Nuevo juego
        if (games[userGameKey]) {
          await sock.sendMessage(from, {
            text: '⚠️ Ya tienes una partida en curso. Usa *!ttt pos [1-9]* para continuar.',
            mentions: [sender]
          }, { quoted: m });
          return;
        }

        const playerSymbol = symbols[randomInt(2)];
        const botSymbol = playerSymbol === '❌' ? '⭕' : '❌';

        games[userGameKey] = {
          board: [...emojis],
          turn: 'player',
          playerSymbol,
          botSymbol
        };

        const board = renderBoard(games[userGameKey].board);

        await sock.sendMessage(from, {
          text:
`🎮 *Tic Tac Toe* 🎮

👤 Usuario: @${sender.split('@')[0]}
🤖 Bot

🪙 Fichas:
- Tú: ${playerSymbol}
- Bot: ${botSymbol}

${board}

Turno de: ${playerSymbol}
Usa: *!ttt pos [1-9]* para jugar.`,
          mentions: [sender]
        }, { quoted: m });

        return;
      }

      if (command === 'pos') {
        const game = games[userGameKey];
        if (!game) {
          await sock.sendMessage(from, { text: '❌ No tienes una partida activa. Usa *!ttt* para comenzar.' }, { quoted: m });
          return;
        }

        const pos = parseInt(args[2]) - 1;
        if (isNaN(pos) || pos < 0 || pos > 8) {
          await sock.sendMessage(from, { text: '⚠️ Posición inválida. Usa *!ttt pos [1-9]*.' }, { quoted: m });
          return;
        }

        if (game.board[pos] !== emojis[pos]) {
          await sock.sendMessage(from, { text: '⚠️ Casilla ocupada. Elige otra.' }, { quoted: m });
          return;
        }

        game.board[pos] = game.playerSymbol;

        if (checkWinner(game.board, game.playerSymbol)) {
          const board = renderBoard(game.board);
          delete games[userGameKey];
          await sock.sendMessage(from, {
            text: `${board}\n\n🎉 ¡Ganaste @${sender.split('@')[0]}!`,
            mentions: [sender]
          });
          return;
        }

        // Turno del bot
        const botPos = botMove(game.board, game.botSymbol, game.playerSymbol);
        game.board[botPos] = game.botSymbol;

        if (checkWinner(game.board, game.botSymbol)) {
          const board = renderBoard(game.board);
          delete games[userGameKey];
          await sock.sendMessage(from, { text: `${board}\n\n🤖 ¡El bot ha ganado!` });
          return;
        }

        const filled = game.board.every((cell, i) => cell !== emojis[i]);
        if (filled) {
          const board = renderBoard(game.board);
          delete games[userGameKey];
          await sock.sendMessage(from, { text: `${board}\n\n🤝 ¡Empate!` });
          return;
        }

        const board = renderBoard(game.board);
        await sock.sendMessage(from, {
          text: `${board}\n\nTurno de: ${game.playerSymbol}\nUsa: *!ttt pos [1-9]*`,
          mentions: [sender]
        });
      }
    }
  });
}
