const express = require('express');
const { ExpressPeerServer } = require('peer');
const http = require('http');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: '*', // 调试时允许所有，正式上线可以改为你的 Vercel 域名
  methods: ['GET', 'POST']
}));

// Use the PORT environment variable provided by Render, or default to 9000
const port = process.env.PORT || 9000;

// Configure PeerJS Server
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/myapp', // The path must match the client configuration
  allow_discovery: true
});

app.use('/peerjs', peerServer);

// Health check endpoint for Render
app.get('/', (req, res) => {
  res.send('Draw & Guess Signaling Server is Running');
});

server.listen(port, () => {
  console.log(`Signaling server running on port ${port}`);
});

// Handle peer errors
peerServer.on('connection', (client) => {
  console.log('Client connected:', client.getId());
});

peerServer.on('disconnect', (client) => {
  console.log('Client disconnected:', client.getId());
});
