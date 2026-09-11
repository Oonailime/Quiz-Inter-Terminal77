process.env.QUIZ_URL ||= 'https://aquinointer.tech/terminal-77';
process.env.HEADLESS ||= '1';
process.env.CAPTURE_AUTH_QR = '1';
process.env.PAUSE_BEFORE_START ||= '0';
process.env.USER_DATA_DIR ||= '.browser-profile';
process.env.MAX_QUESTIONS ||= '10';
process.env.KEEP_OPEN_MS ||= '0';

if (!process.env.FORUM_HANDLE?.trim()) {
  throw new Error(
    'Defina FORUM_HANDLE com o seu perfil antes de iniciar o Terminal 77.',
  );
}

await import('./terminal-rpa.mjs');
