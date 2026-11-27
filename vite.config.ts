import { defineConfig, Plugin } from 'vite';
import path from 'path';
import { MultiplayerServer } from './server/multiplayerServer';

function multiplayerPlugin(): Plugin {
  let mpServer: MultiplayerServer | null = null;
  return {
    name: 'emberbrook-multiplayer',
    configureServer(server) {
      if (!server.httpServer) return;
      mpServer = new MultiplayerServer({ noServer: true });

      server.httpServer.on('upgrade', (req, socket, head) => {
        if (req.url?.startsWith('/ws')) {
          mpServer!.wss.handleUpgrade(req, socket, head, (ws) => {
            mpServer!.wss.emit('connection', ws, req);
          });
        }
      });

      console.log('⚜ Emberbrook Hollow Multiplayer WebSocket engine attached on /ws');
    },
  };
}

export default defineConfig({
  plugins: [multiplayerPlugin()],
  server: {
    port: 3000,
    host: true,
    fs: {
      allow: ['.'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
