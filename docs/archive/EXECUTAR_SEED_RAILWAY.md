import express from 'express';
import { execSync } from 'child_process';

const app = express();

// ⚠️ ATENÇÃO: Adicione autenticação em produção!
const SEED_SECRET = process.env.SEED_SECRET || 'dev-secret-change-me';

app.get('/admin/seed', async (req, res) => {
  const { secret } = req.query;
  
  // Validar secret
  if (secret !== SEED_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  try {
    console.log('🚀 Iniciando seed via HTTP...');
    
    // Executar seed
    execSync('npm run db:seed:robustcar', { stdio: 'inherit' });
    
    // Executar embeddings
    execSync('npm run embeddings:generate', { stdio: 'inherit' });
    
    res.json({ 
      success: true, 
      message: 'Seed e embeddings executados com sucesso!' 
    });
  } catch (error) {
    console.error('Erro ao executar seed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🔧 Seed endpoint rodando em http://localhost:${PORT}/admin/seed`);
});
