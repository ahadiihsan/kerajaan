import { MultiplayerServer } from './multiplayerServer';

const PORT = parseInt(process.env.PORT || '3030', 10);
const server = new MultiplayerServer({ port: PORT });

console.log('====================================================');
console.log(`⚜  Emberbrook Hollow Multiplayer Server ⚜`);
console.log(`📡 Local Port: http://localhost:${PORT}`);
console.log(`🌐 Cloudflare Tunnel: https://empire.ahadiihsan.com`);
console.log(`⚡ WebSocket URL: wss://empire.ahadiihsan.com/ws`);
console.log('====================================================');

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Emberbrook Hollow Game Server...');
  server.stop();
  process.exit(0);
});
