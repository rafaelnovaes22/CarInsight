# 📊 Configuração do Prometheus + Grafana

> Guia completo para configurar monitoramento com Prometheus e Grafana no CarInsight.

---

## 🚀 Quick Start

```bash
# 1. Iniciar stack de monitoramento
docker-compose -f docker-compose.monitoring.yml up -d

# 2. Verificar se está rodando
docker-compose -f docker-compose.monitoring.yml ps

# 3. Acessar interfaces
open http://localhost:9090   # Prometheus
open http://localhost:3000   # Grafana (admin/admin)
```

---

## 📁 Estrutura de Arquivos

```
monitoring/
├── prometheus/
│   └── prometheus.yml          # Configuração do Prometheus
├── grafana/
│   ├── dashboards/
│   │   └── carinsight-dashboard.json  # Dashboard principal
│   └── provisioning/
│       ├── datasources/
│       │   └── datasources.yml        # Config auto do data source
│       └── dashboards/
│           └── dashboards.yml         # Config auto dos dashboards
└── README.md
docker-compose.monitoring.yml    # Stack completo
```

---

## 🔧 Configuração

### 1. Configurar Endpoint da Aplicação

Edite `monitoring/prometheus/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'carinsight-app'
    static_configs:
      # Desenvolvimento local
      - targets: ['host.docker.internal:3000']
        labels:
          environment: 'development'
      
      # Produção (Railway/Heroku)
      # - targets: ['seu-app.railway.app']
      #   labels:
      #     environment: 'production'
    
    metrics_path: /admin/prometheus
    scrape_interval: 15s
```

### 2. Configurar Grafana (Opcional)

Edite `docker-compose.monitoring.yml`:

```yaml
grafana:
  environment:
    - GF_SECURITY_ADMIN_USER=seu-usuario    # Mude o usuário admin
    - GF_SECURITY_ADMIN_PASSWORD=sua-senha # Mude a senha!
```

### 3. Iniciar Stack

```bash
# Subir serviços
docker-compose -f docker-compose.monitoring.yml up -d

# Ver logs
docker-compose -f docker-compose.monitoring.yml logs -f

# Parar
docker-compose -f docker-compose.monitoring.yml down

# Reset completo (remove dados)
docker-compose -f docker-compose.monitoring.yml down -v
```

---

## 📊 Dashboards

### Dashboard Principal

**URL:** http://localhost:3000/d/carinsight-main

**Panels:**

| Panel | Métrica | Descrição |
|-------|---------|-----------|
| Rate Limit Reqs/s | `rate_limit_requests_total` | Requisições por segundo |
| Allowed vs Blocked | Gráfico de linha | Taxa de bloqueios |
| Redis Connected | `redis_connected` | Status da conexão |
| Requests by Resource | Pie chart | Distribuição por recurso |
| P95 Latency | `rate_limit_duration_seconds` | Latência do rate limiting |
| LLM Requests | `llm_requests_total` | Chamadas por provider |
| LLM Latency | `llm_latency_seconds` | Latência P95 dos LLMs |
| Total Cost | `llm_cost_usd_total` | Custo acumulado |

---

## 🔍 Queries PromQL Úteis

### Rate Limiting

```promql
# Requisições por segundo
rate(carinsight_rate_limit_requests_total[5m])

# Taxa de bloqueios (%)
(
  sum(rate(carinsight_rate_limit_requests_total{status="blocked"}[5m]))
  /
  sum(rate(carinsight_rate_limit_requests_total[5m]))
) * 100

# Latência P95 por recurso
histogram_quantile(0.95,
  sum(rate(carinsight_rate_limit_duration_seconds_bucket[5m])) by (le, resource)
)

# Erros no rate limiting
rate(carinsight_rate_limit_errors_total[5m])
```

### LLM

```promql
# Custo por provider
sum by (provider) (carinsight_llm_cost_usd_total)

# Tokens por minuto
rate(carinsight_llm_tokens_used_total[1m])

# Taxa de erro por provider
(
  sum(rate(carinsight_llm_requests_total{status="error"}[5m])) by (provider)
  /
  sum(rate(carinsight_llm_requests_total[5m])) by (provider)
) * 100
```

### WhatsApp

```promql
# Mensagens recebidas por minuto
rate(carinsight_whatsapp_messages_received_total[1m])

# Taxa de sucesso no envio
(
  sum(rate(carinsight_whatsapp_messages_sent_total{status="success"}[5m]))
  /
  sum(rate(carinsight_whatsapp_messages_sent_total[5m]))
) * 100
```

---

## 🚨 Alertas (AlertManager)

Crie `monitoring/prometheus/alerts.yml`:

```yaml
groups:
  - name: carinsight-alerts
    rules:
      # Rate Limit muito alto de bloqueios
      - alert: HighRateLimitBlocking
        expr: |
          (
            sum(rate(carinsight_rate_limit_requests_total{status="blocked"}[5m]))
            /
            sum(rate(carinsight_rate_limit_requests_total[5m]))
          ) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Alta taxa de bloqueios no rate limit"
          description: "{{ $value }}% das requisições estão sendo bloqueadas"

      # Redis desconectado
      - alert: RedisDisconnected
        expr: carinsight_redis_connected == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis desconectado"
          description: "O serviço está usando fallback em memória"

      # Latência alta no LLM
      - alert: HighLLMLatency
        expr: |
          histogram_quantile(0.95,
            sum(rate(carinsight_llm_latency_seconds_bucket[5m])) by (le)
          ) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Latência alta nos LLMs"
          description: "P95 está acima de 5 segundos"

      # Custo alto
      - alert: HighLLMCost
        expr: |
          increase(carinsight_llm_cost_usd_total[1h]) > 10
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Custo alto em LLMs"
          description: "Gasto de ${{ $value }} na última hora"
```

Adicione ao `prometheus.yml`:

```yaml
rule_files:
  - "alerts.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

---

## 🌐 Deploy em Produção (Railway)

### Opção 1: Prometheus + Grafana como Serviços

Adicione ao `railway.yml`:

```yaml
services:
  prometheus:
    image: prom/prometheus:v2.47.0
    volumes:
      - prometheus-data:/prometheus
    environment:
      - SCRAPE_TARGET=${RAILWAY_STATIC_URL}
    
  grafana:
    image: grafana/grafana:10.1.0
    volumes:
      - grafana-data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
```

### Opção 2: Grafana Cloud (Mais Simples)

1. Crie conta em [grafana.com](https://grafana.com)
2. Obtenha `Grafana Cloud Prometheus URL` e `API Key`
3. Configure seu app para enviar métricas:

```bash
# Instalar agente
npm install @grafana/puppeteer-agent

# Ou use remote_write no Prometheus local
```

### Opção 3: Datadog / New Relic (Enterprise)

Veja `docs/MONITORING_OPTIONS.md` para comparação.

---

## 📝 Métricas Disponíveis

### Rate Limiting

| Métrica | Tipo | Labels | Descrição |
|---------|------|--------|-----------|
| `carinsight_rate_limit_requests_total` | Counter | resource, status | Total de requisições |
| `carinsight_rate_limit_blocked_total` | Counter | resource, reason | Total bloqueado |
| `carinsight_rate_limit_duration_seconds` | Histogram | resource, store_type | Latência |
| `carinsight_rate_limit_errors_total` | Counter | error_type | Erros |
| `carinsight_rate_limit_active_requests` | Gauge | resource, key_hash | Requisições ativas |

### LLM

| Métrica | Tipo | Labels | Descrição |
|---------|------|--------|-----------|
| `carinsight_llm_requests_total` | Counter | provider, model, status | Requisições |
| `carinsight_llm_latency_seconds` | Histogram | provider, model | Latência |
| `carinsight_llm_tokens_used_total` | Counter | provider, model, type | Tokens |
| `carinsight_llm_cost_usd_total` | Counter | provider, model | Custo |
| `carinsight_llm_circuit_breaker_state` | Gauge | provider | Estado CB |

### WhatsApp

| Métrica | Tipo | Labels | Descrição |
|---------|------|--------|-----------|
| `carinsight_whatsapp_messages_received_total` | Counter | type | Recebidas |
| `carinsight_whatsapp_messages_sent_total` | Counter | type, status | Enviadas |
| `carinsight_whatsapp_processing_duration_seconds` | Histogram | type | Processamento |
| `carinsight_whatsapp_active_conversations` | Gauge | - | Conversas ativas |

### Sistema

| Métrica | Tipo | Labels | Descrição |
|---------|------|--------|-----------|
| `carinsight_redis_connected` | Gauge | - | Conexão Redis |
| `carinsight_redis_operations_total` | Counter | operation, result | Ops Redis |
| `carinsight_db_queries_total` | Counter | operation, table | Queries |
| `carinsight_db_connections` | Gauge | - | Conexões DB |

---

## 🔗 Integrações

### Slack Alerts

Configure `alertmanager.yml`:

```yaml
route:
  receiver: 'slack'

receivers:
  - name: 'slack'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts'
        title: 'CarInsight Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
```

### PagerDuty

```yaml
receivers:
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'your-service-key'
        severity: '{{ .Labels.severity }}'
```

---

## 🧹 Manutenção

### Limpar dados antigos

```bash
# Prometheus retém 15 dias por padrão
# Para limpar manualmente:
curl -X POST http://localhost:9090/api/v1/admin/tsdb/clean_tombstones
```

### Backup

```bash
# Backup Prometheus
docker run --rm -v carinsight_prometheus-data:/data -v $(pwd):/backup alpine tar czf /backup/prometheus-backup.tar.gz -C /data .

# Backup Grafana
docker run --rm -v carinsight_grafana-data:/data -v $(pwd):/backup alpine tar czf /backup/grafana-backup.tar.gz -C /data .
```

---

## 📚 Recursos

- [Prometheus Docs](https://prometheus.io/docs/)
- [Grafana Docs](https://grafana.com/docs/)
- [PromQL Cheatsheet](https://promlabs.com/promql-cheat-sheet/)
- [Node Exporter Full Dashboard](https://grafana.com/grafana/dashboards/1860)

---

## ✅ Checklist

- [ ] Stack de monitoramento rodando
- [ ] App expondo métricas em `/admin/prometheus`
- [ ] Prometheus scrapando métricas
- [ ] Dashboard importado no Grafana
- [ ] Alertas configurados (opcional)
- [ ] Backup configurado (produção)
- [ ] Documentação do time atualizada
