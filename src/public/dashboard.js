const secretInput = document.getElementById('admin-secret');
const saveSecretButton = document.getElementById('save-secret');
const clearSecretButton = document.getElementById('clear-secret');
const refreshButton = document.getElementById('refresh-all');
const statsMessage = document.getElementById('stats-message');
const healthDot = document.getElementById('health-dot');
const healthStatus = document.getElementById('health-status');
const healthSummary = document.getElementById('health-summary');

const STORAGE_KEY = 'carinsight.adminSecret';

function formatTimestamp(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function formatUptime(totalSeconds) {
  if (typeof totalSeconds !== 'number') return '-';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}h ${minutes}m ${seconds}s`;
}

function getSecretFromPage() {
  return secretInput?.value?.trim() || '';
}

function setHealthState(status, summary) {
  healthDot.className = 'status-dot';

  if (status === 'ok') {
    healthDot.classList.add('status-ok');
    healthStatus.textContent = 'Operação saudável';
  } else if (status === 'warning') {
    healthDot.classList.add('status-warning');
    healthStatus.textContent = 'Operação com alertas';
  } else if (status === 'error') {
    healthDot.classList.add('status-error');
    healthStatus.textContent = 'Operação com falhas';
  } else {
    healthDot.classList.add('status-idle');
    healthStatus.textContent = 'Aguardando consulta';
  }

  healthSummary.textContent = summary;
}

async function loadHealth() {
  try {
    const response = await fetch('/health');
    const data = await response.json();

    const checks = Object.values(data.checks || {});
    const degraded = checks.filter(check => check.status !== 'healthy').length;
    const summary =
      degraded === 0
        ? 'Todos os checks públicos reportaram status saudável.'
        : `${degraded} check(s) públicos requerem atenção.`;

    setHealthState(
      data.status === 'ok' ? 'ok' : data.status === 'degraded' ? 'warning' : 'error',
      summary
    );

    document.getElementById('health-version').textContent = data.version || 'local';
    document.getElementById('health-uptime').textContent = formatUptime(data.uptime);
    document.getElementById('health-timestamp').textContent = formatTimestamp(data.timestamp);
  } catch (error) {
    setHealthState('error', 'Não foi possível consultar /health neste momento.');
  }
}

async function loadStats() {
  try {
    const secret = getSecretFromPage();
    const headers = secret ? { 'x-admin-secret': secret } : {};
    const response = await fetch('/stats', { headers });

    if (!response.ok) {
      if (response.status === 403) {
        statsMessage.textContent =
          'O endpoint /stats exige x-admin-secret. Cole o secret e tente novamente.';
      } else if (response.status === 503) {
        statsMessage.textContent =
          'As métricas administrativas estão desabilitadas porque o secret não está configurado no servidor.';
      } else {
        statsMessage.textContent = 'Não foi possível carregar /stats neste momento.';
      }

      document.getElementById('conversations').textContent = '-';
      document.getElementById('leads').textContent = '-';
      document.getElementById('recommendations').textContent = '-';
      return;
    }

    const data = await response.json();
    document.getElementById('conversations').textContent = String(data.conversations ?? '-');
    document.getElementById('leads').textContent = String(data.leads ?? '-');
    document.getElementById('recommendations').textContent = String(data.recommendations ?? '-');

    statsMessage.textContent = `Última atualização das métricas: ${formatTimestamp(data.timestamp)}.`;
  } catch (error) {
    statsMessage.textContent = 'Erro de rede ao consultar /stats.';
  }
}

function saveSecret() {
  const secret = getSecretFromPage();

  if (!secret) {
    statsMessage.textContent = 'Informe um secret antes de salvar.';
    return;
  }

  localStorage.setItem(STORAGE_KEY, secret);
  statsMessage.textContent = 'Secret salvo no navegador. Recarregando métricas.';
  loadStats();
}

function clearSecret() {
  localStorage.removeItem(STORAGE_KEY);
  secretInput.value = '';
  statsMessage.textContent = 'Secret removido do navegador.';
  loadStats();
}

function hydrateSecret() {
  const params = new URLSearchParams(window.location.search);
  const secretFromQuery = params.get('secret');
  const secretFromStorage = localStorage.getItem(STORAGE_KEY) || '';
  const secret = secretFromQuery || secretFromStorage;

  if (secretFromQuery) {
    localStorage.setItem(STORAGE_KEY, secretFromQuery);
  }

  secretInput.value = secret;
}

saveSecretButton?.addEventListener('click', saveSecret);
clearSecretButton?.addEventListener('click', clearSecret);
refreshButton?.addEventListener('click', () => {
  loadHealth();
  loadStats();
});

secretInput?.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    saveSecret();
  }
});

hydrateSecret();
loadHealth();
loadStats();
