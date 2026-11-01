const express = require('express');
const path = require('path');

const app = express();
const rootArg = process.argv[2];
const portArg = process.argv[3];

const rootDir = rootArg
  ? path.resolve(process.cwd(), rootArg)
  : path.resolve(process.cwd(), 'src', 'public');
const port = Number(portArg || 4173);

app.use(express.static(rootDir));

app.get('/', (_req, res) => {
  res.sendFile(path.join(rootDir, 'landing.html'));
});

app.listen(port, () => {
  console.log(`STATIC_PREVIEW=http://localhost:${port}`);
  console.log(`STATIC_ROOT=${rootDir}`);
});
