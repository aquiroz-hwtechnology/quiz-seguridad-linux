const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const os = require('os');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'play.html'));
});

const PORT = process.env.PORT || 3000;

// ── Game State ──
let gameState = {
  phase: 'lobby',       // lobby | question | results | leaderboard | finished
  players: {},          // socketId -> { nickname, score, streak, answers[] }
  currentQuestion: -1,
  questionStartTime: null,
  questionTimer: null,
  answersThisRound: {},  // socketId -> { answer, time }
};

// ── Questions from the documents ──
const questions = [
  {
    q: "¿Qué es un virus informático?",
    options: [
      "Un programa que optimiza el sistema",
      "Un programa malicioso que se replica y causa daños",
      "Un tipo de hardware defectuoso",
      "Una actualización del sistema operativo"
    ],
    correct: 1,
    time: 20,
    category: "Virus"
  },
  {
    q: "¿Cuál es una característica fundamental de un virus informático?",
    options: [
      "No necesita un archivo huésped",
      "Se ejecuta de forma independiente",
      "Necesita un huésped (archivo o programa) para reproducirse",
      "Solo afecta a hardware"
    ],
    correct: 2,
    time: 20,
    category: "Virus"
  },
  {
    q: "¿Qué comando se usa en Linux para escanear todo el sistema con ClamAV?",
    options: [
      "clamscan -r /",
      "clamav --scan-all",
      "sudo scan-virus /",
      "antivirus --check /"
    ],
    correct: 0,
    time: 20,
    category: "Comandos Linux"
  },
  {
    q: "¿Qué herramienta se especializa en detectar rootkits en Linux?",
    options: [
      "ClamAV",
      "Wireshark",
      "rkhunter (Rootkit Hunter)",
      "BleachBit"
    ],
    correct: 2,
    time: 20,
    category: "Herramientas"
  },
  {
    q: "¿Qué es el Spyware?",
    options: [
      "Software que acelera la conexión a internet",
      "Software malicioso que recopila datos sin consentimiento del usuario",
      "Un tipo de firewall para Linux",
      "Un programa de copias de seguridad"
    ],
    correct: 1,
    time: 20,
    category: "Spyware"
  },
  {
    q: "¿Cuál de estos es un tipo de spyware?",
    options: [
      "Firewall",
      "Keylogger",
      "Compilador",
      "Servidor DNS"
    ],
    correct: 1,
    time: 15,
    category: "Spyware"
  },
  {
    q: "¿Qué es un paquete .deb?",
    options: [
      "Un archivo de texto plano",
      "El formato estándar de instalación en Debian/Ubuntu",
      "Un tipo de virus para Linux",
      "Un lenguaje de programación"
    ],
    correct: 1,
    time: 15,
    category: "Paquetes .deb"
  },
  {
    q: "¿Cuál es la diferencia principal entre dpkg y apt?",
    options: [
      "dpkg es más nuevo que apt",
      "apt no puede instalar paquetes",
      "dpkg NO resuelve dependencias, apt SÍ las resuelve automáticamente",
      "No hay diferencia, son exactamente iguales"
    ],
    correct: 2,
    time: 20,
    category: "Paquetes .deb"
  },
  {
    q: "¿Qué comando instala un paquete .deb manualmente?",
    options: [
      "sudo apt install archivo.deb",
      "sudo dpkg -i archivo.deb",
      "sudo rpm -i archivo.deb",
      "sudo install archivo.deb"
    ],
    correct: 1,
    time: 15,
    category: "Comandos Linux"
  },
  {
    q: "¿Qué significa Malware?",
    options: [
      "Software de mantenimiento",
      "Software malicioso (malicious software)",
      "Software de marketing",
      "Hardware defectuoso"
    ],
    correct: 1,
    time: 15,
    category: "Malware"
  },
  {
    q: "¿Cuál fue el primer programa que se propagaba por red?",
    options: [
      "Stuxnet",
      "Elk Cloner",
      "Creeper (1971)",
      "ILOVEYOU"
    ],
    correct: 2,
    time: 20,
    category: "Malware"
  },
  {
    q: "¿Qué tipo de malware cifra archivos y exige pago para recuperarlos?",
    options: [
      "Spyware",
      "Adware",
      "Ransomware",
      "Keylogger"
    ],
    correct: 2,
    time: 15,
    category: "Malware"
  },
  {
    q: "¿Qué es Wireshark?",
    options: [
      "Un antivirus para Linux",
      "Un software de análisis de paquetes de red libre y de código abierto",
      "Un firewall empresarial",
      "Un gestor de paquetes .deb"
    ],
    correct: 1,
    time: 20,
    category: "Herramientas"
  },
  {
    q: "¿Qué significa UFW?",
    options: [
      "Universal File Watcher",
      "Uncomplicated Firewall",
      "Ubuntu Free Wireless",
      "Unix Framework for Web"
    ],
    correct: 1,
    time: 15,
    category: "Herramientas"
  },
  {
    q: "¿Qué hace el comando 'sudo freshclam'?",
    options: [
      "Instala ClamAV",
      "Elimina virus del sistema",
      "Actualiza la base de datos de firmas de ClamAV",
      "Desinstala ClamAV"
    ],
    correct: 2,
    time: 20,
    category: "Comandos Linux"
  },
  {
    q: "¿Dónde se encuentran los logs del sistema en Linux?",
    options: [
      "/home/logs",
      "/var/log",
      "/etc/logs",
      "/usr/log"
    ],
    correct: 1,
    time: 15,
    category: "Comandos Linux"
  },
  {
    q: "¿Qué hace el comando 'lsof -i' en Linux?",
    options: [
      "Lista archivos del sistema",
      "Muestra todas las conexiones de red activas",
      "Instala paquetes de red",
      "Configura la interfaz de red"
    ],
    correct: 1,
    time: 20,
    category: "Comandos Linux"
  },
  {
    q: "¿Qué navegador usa la red Tor para proteger el anonimato?",
    options: [
      "LibreWolf",
      "Firefox",
      "Tor Browser",
      "Chromium"
    ],
    correct: 2,
    time: 15,
    category: "Herramientas"
  },
  {
    q: "¿Qué es BleachBit?",
    options: [
      "Un antivirus para Linux",
      "Un navegador web seguro",
      "Una herramienta que elimina archivos innecesarios como caché y cookies",
      "Un gestor de contraseñas"
    ],
    correct: 2,
    time: 20,
    category: "Herramientas"
  },
  {
    q: "¿Qué hace apt-cache show?",
    options: [
      "Instala un paquete",
      "Muestra información completa de un paquete: versión, descripción, dependencias",
      "Elimina un paquete del sistema",
      "Actualiza todos los paquetes"
    ],
    correct: 1,
    time: 20,
    category: "Paquetes .deb"
  },
  {
    q: "¿Qué son las dependencias en el contexto de paquetes Linux?",
    options: [
      "Virus que se adjuntan a los paquetes",
      "Librerías y paquetes obligatorios que un programa necesita para funcionar",
      "Archivos temporales del sistema",
      "Actualizaciones pendientes"
    ],
    correct: 1,
    time: 20,
    category: "Paquetes .deb"
  },
  {
    q: "¿Qué tipo de malware se disfraza de software legítimo para abrir puertas traseras?",
    options: [
      "Virus",
      "Gusano (Worm)",
      "Troyano",
      "Adware"
    ],
    correct: 2,
    time: 15,
    category: "Malware"
  },
  {
    q: "¿Cuál es una señal de infección por malware en un equipo?",
    options: [
      "El equipo funciona más rápido",
      "El equipo va muy lento sin razón aparente",
      "Se actualizan los programas automáticamente",
      "Aparecen nuevas actualizaciones disponibles"
    ],
    correct: 1,
    time: 15,
    category: "Malware"
  },
  {
    q: "¿Qué extensión de navegador bloquea rastreadores automáticamente según la EFF?",
    options: [
      "uBlock Origin",
      "Privacy Badger",
      "AdBlock Plus",
      "NoScript"
    ],
    correct: 1,
    time: 20,
    category: "Herramientas"
  },
  {
    q: "¿Qué principio de seguridad garantiza que se acceda solo a los recursos necesarios?",
    options: [
      "Principio de máximo acceso",
      "Principio de mínimo privilegio",
      "Principio de transparencia total",
      "Principio de redundancia"
    ],
    correct: 1,
    time: 20,
    category: "Seguridad"
  },
  {
    q: "¿Qué hace el comando 'find / -perm -4000' en Linux?",
    options: [
      "Busca archivos mayores a 4000 bytes",
      "Busca archivos con permiso SUID que podrían ser explotados",
      "Encuentra 4000 archivos aleatorios",
      "Busca archivos creados hace 4000 días"
    ],
    correct: 1,
    time: 20,
    category: "Comandos Linux"
  },
  {
    q: "¿Dónde se configuran los repositorios en Linux?",
    options: [
      "/home/user/repos",
      "/etc/apt/sources.list",
      "/var/repos/config",
      "/usr/local/repos"
    ],
    correct: 1,
    time: 15,
    category: "Paquetes .deb"
  },
  {
    q: "¿Qué característica del malware le permite cambiar su código para evadir detección?",
    options: [
      "Persistencia",
      "Polimorfismo",
      "Autorreplicación",
      "Escalada de privilegios"
    ],
    correct: 1,
    time: 20,
    category: "Malware"
  },
  {
    q: "¿Qué comando habilita el firewall UFW en Linux?",
    options: [
      "sudo firewall start",
      "sudo ufw enable",
      "sudo iptables --on",
      "sudo firewalld activate"
    ],
    correct: 1,
    time: 15,
    category: "Comandos Linux"
  },
  {
    q: "¿Cuál de los siguientes NO es un vector de propagación de virus?",
    options: [
      "Archivos ejecutables infectados",
      "Correos con adjuntos maliciosos",
      "Actualizar el sistema operativo",
      "Descargas de sitios no oficiales"
    ],
    correct: 2,
    time: 20,
    category: "Virus"
  }
];

// ── Helper functions ──
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function getPlayerCount() {
  return Object.keys(gameState.players).length;
}

function resetGame() {
  for (const timer of [gameState.questionTimer]) {
    if (timer) clearTimeout(timer);
  }
  gameState = {
    phase: 'lobby',
    players: {},
    currentQuestion: -1,
    questionStartTime: null,
    questionTimer: null,
    answersThisRound: {},
  };
}

function calculateScore(isCorrect, responseTimeMs, totalTimeMs) {
  if (!isCorrect) return 0;
  const timeFraction = Math.max(0, 1 - (responseTimeMs / totalTimeMs));
  return Math.round(500 + 500 * timeFraction);
}

function getLeaderboard() {
  return Object.values(gameState.players)
    .map(p => ({ nickname: p.nickname, score: p.score, streak: p.streak }))
    .sort((a, b) => b.score - a.score);
}

// ── QR Code endpoint ──
app.get('/qr', async (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const url = `${protocol}://${host}/play`;
  try {
    const qrDataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2, color: { dark: '#1a1a2e', light: '#ffffff' } });
    res.json({ qr: qrDataUrl, url });
  } catch (err) {
    res.status(500).json({ error: 'QR generation failed' });
  }
});

app.get('/api/questions-count', (req, res) => {
  res.json({ count: questions.length });
});

// ── Socket.IO ──
io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  // Player joins
  socket.on('join', (nickname) => {
    if (gameState.phase !== 'lobby') {
      socket.emit('join-error', 'El juego ya está en curso. Espera a la siguiente ronda.');
      return;
    }
    const trimmed = nickname.trim().substring(0, 20);
    if (!trimmed) {
      socket.emit('join-error', 'Ingresa un nickname válido.');
      return;
    }
    const taken = Object.values(gameState.players).some(p => p.nickname.toLowerCase() === trimmed.toLowerCase());
    if (taken) {
      socket.emit('join-error', 'Ese nickname ya está en uso.');
      return;
    }
    gameState.players[socket.id] = {
      nickname: trimmed,
      score: 0,
      streak: 0,
      answers: [],
      correctCount: 0,
      totalAnswered: 0,
    };
    socket.emit('joined', { nickname: trimmed });
    io.emit('player-count', getPlayerCount());
    io.emit('player-joined', { nickname: trimmed, count: getPlayerCount() });
    console.log(`${trimmed} joined (${getPlayerCount()} players)`);
  });

  // Host starts the game
  socket.on('start-game', () => {
    if (gameState.phase !== 'lobby' || getPlayerCount() === 0) return;
    gameState.currentQuestion = -1;
    io.emit('game-started');
    nextQuestion();
  });

  // Host triggers next question
  socket.on('next-question', () => {
    nextQuestion();
  });

  // Player submits answer
  socket.on('answer', (data) => {
    const player = gameState.players[socket.id];
    if (!player || gameState.phase !== 'question') return;
    if (gameState.answersThisRound[socket.id]) return; // already answered

    const responseTime = Date.now() - gameState.questionStartTime;
    const question = questions[gameState.currentQuestion];
    const isCorrect = data.answer === question.correct;
    const points = calculateScore(isCorrect, responseTime, question.time * 1000);

    gameState.answersThisRound[socket.id] = {
      answer: data.answer,
      time: responseTime,
      correct: isCorrect,
      points,
    };

    if (isCorrect) {
      player.streak++;
      player.correctCount++;
    } else {
      player.streak = 0;
    }
    player.score += points;
    player.totalAnswered++;
    player.answers.push({ questionIndex: gameState.currentQuestion, answer: data.answer, correct: isCorrect, points, time: responseTime });

    socket.emit('answer-result', { correct: isCorrect, points, streak: player.streak, totalScore: player.score });

    const answeredCount = Object.keys(gameState.answersThisRound).length;
    io.emit('answer-count', { answered: answeredCount, total: getPlayerCount() });

    if (answeredCount >= getPlayerCount()) {
      clearTimeout(gameState.questionTimer);
      setTimeout(() => showResults(), 500);
    }
  });

  // Host shows leaderboard
  socket.on('show-leaderboard', () => {
    gameState.phase = 'leaderboard';
    const leaderboard = getLeaderboard();
    io.emit('leaderboard', { leaderboard, questionNum: gameState.currentQuestion + 1, totalQuestions: questions.length });
  });

  // Host resets game
  socket.on('reset-game', () => {
    resetGame();
    io.emit('game-reset');
  });

  socket.on('disconnect', () => {
    const player = gameState.players[socket.id];
    if (player) {
      console.log(`${player.nickname} disconnected`);
      delete gameState.players[socket.id];
      delete gameState.answersThisRound[socket.id];
      io.emit('player-count', getPlayerCount());
      io.emit('player-left', { nickname: player.nickname, count: getPlayerCount() });
    }
  });
});

function nextQuestion() {
  gameState.currentQuestion++;
  if (gameState.currentQuestion >= questions.length) {
    gameState.phase = 'finished';
    const leaderboard = getLeaderboard();
    const playerStats = Object.values(gameState.players).map(p => ({
      nickname: p.nickname,
      score: p.score,
      correctCount: p.correctCount,
      totalAnswered: p.totalAnswered,
      accuracy: p.totalAnswered > 0 ? Math.round((p.correctCount / p.totalAnswered) * 100) : 0,
    }));
    io.emit('game-finished', { leaderboard, playerStats });
    return;
  }

  gameState.phase = 'question';
  gameState.answersThisRound = {};
  gameState.questionStartTime = Date.now();

  const q = questions[gameState.currentQuestion];
  io.emit('question', {
    index: gameState.currentQuestion,
    total: questions.length,
    question: q.q,
    options: q.options,
    time: q.time,
    category: q.category,
  });

  gameState.questionTimer = setTimeout(() => {
    showResults();
  }, q.time * 1000 + 1000);
}

function showResults() {
  gameState.phase = 'results';
  const q = questions[gameState.currentQuestion];
  const answerDistribution = [0, 0, 0, 0];
  for (const a of Object.values(gameState.answersThisRound)) {
    if (a.answer >= 0 && a.answer < 4) answerDistribution[a.answer]++;
  }
  const totalPlayers = getPlayerCount();
  const answeredCount = Object.keys(gameState.answersThisRound).length;
  const correctCount = Object.values(gameState.answersThisRound).filter(a => a.correct).length;

  io.emit('question-results', {
    correctAnswer: q.correct,
    correctText: q.options[q.correct],
    distribution: answerDistribution,
    totalPlayers,
    answeredCount,
    correctCount,
    leaderboard: getLeaderboard().slice(0, 5),
  });
}

// ── Start Server ──
server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`\n🎮 Quiz Game Server running!`);
  console.log(`   Host panel:  http://localhost:${PORT}`);
  console.log(`   Players join: http://${ip}:${PORT}/play`);
  console.log(`   ${questions.length} questions loaded\n`);
});
