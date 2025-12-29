const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const options = {
  key: fs.readFileSync(path.join(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};

const PORT = 3000;

https.createServer(options, (req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Endpoint to send test message
  if (req.url === '/send-message' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      let to = process.env.TEST_PHONE_NUMBER || '5511949105033'; // Default fallback
      try {
        if (body) {
          const bodyJson = JSON.parse(body);
          if (bodyJson.to) {
            to = bodyJson.to;
          }
        }
      } catch (e) {
        console.error('Failed to parse request body', e);
      }

      const token = process.env.META_WHATSAPP_TOKEN;
      const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

      if (!token || !phoneId) {
        console.error('Missing Meta credentials in .env');
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing Meta credentials' }));
        return;
      }

      const data = JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
          name: 'hello_world',
          language: { code: 'en_US' }
        }
      });

      const reqOptions = {
        hostname: 'graph.facebook.com',
        path: `/v19.0/${phoneId}/messages`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      console.log('Sending message to:', to);

      const apiReq = https.request(reqOptions, (apiRes) => {
        let responseBody = '';
        apiRes.on('data', (chunk) => { responseBody += chunk; });
        apiRes.on('end', () => {
          console.log('Meta API Response:', responseBody);
          res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(responseBody);
        });
      });

      apiReq.on('error', (e) => {
        console.error('API Request Error:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      });

      apiReq.write(data);
      apiReq.end();
    });
    return;
  }

  // Serve index.html for root
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);

  // Basic MIME types
  const extname = path.extname(filePath);
  let contentType = 'text/html';
  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;
    case '.jpg':
      contentType = 'image/jpg';
      break;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code == 'ENOENT') {
        res.writeHead(404);
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
        res.end();
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });

}).listen(PORT, () => {
  console.log(`Server running at https://localhost:${PORT}/`);
  console.log('Note: You will see a security warning in the browser because the certificate is self-signed.');
});
