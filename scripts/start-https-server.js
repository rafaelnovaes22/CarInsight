const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const PORT = 3000;

// Serve arquivos estáticos de src/public
app.use(express.static(path.join(__dirname, 'src', 'public')));

const options = {
    key: fs.readFileSync(path.join(__dirname, 'meta-auth-demo', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'meta-auth-demo', 'cert.pem'))
};

https.createServer(options, app).listen(PORT, () => {
    console.log(`🚀 Servidor HTTPS rodando em https://localhost:${PORT}/facebook-login.html`);
});
