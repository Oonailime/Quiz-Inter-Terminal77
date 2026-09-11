process.env.QUIZ_URL ||= 'https://aquinointer.tech/terminal-77';
process.env.HEADLESS ||= '1';
process.env.CAPTURE_AUTH_QR = '1';
process.env.INSPECT_ONLY = '1';
process.env.USER_DATA_DIR ||= '.browser-profile';
process.env.KEEP_OPEN_MS ||= '15000';

await import('./terminal-rpa.mjs');
