const express = require('express');
const cors = require('cors');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 8088;

// Configuration CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname)));

// Proxy vers le backend pour les appels API
app.use('/api', createProxyMiddleware({
    target: 'http://207.180.205.248:3007',
    changeOrigin: true,
    pathRewrite: {
        '^/api': '/api' // Conserver le chemin /api
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`🔀 Proxy: ${req.method} ${req.url} -> http://207.180.205.248:3007${req.url}`);
    },
    onError: (err, req, res) => {
        console.error('❌ Erreur proxy:', err);
        res.status(500).json({ message: 'Erreur de communication avec le serveur' });
    }
}));

// Route pour la page d'accueil
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Démarrer le serveur
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n📚 Module public démarré sur :`);
    console.log(`   ➜ Local:    http://localhost:${PORT}`);
    console.log(`   ➜ Réseau:   http://207.180.205.248:${PORT}`);
    console.log(`   ➜ Page:     http://207.180.205.248:${PORT}/index.html`);
    console.log(`   ➜ API Proxy: http://207.180.205.248:${PORT}/api -> http://207.180.205.248:3007/api\n`);
});