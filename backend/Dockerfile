# syntax=docker/dockerfile:1
# ── Сборка зависимостей ──────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH

COPY requirements.txt .
# --require-hashes: ставится ровно то, что зафиксировано в lock-файле
# (защита от подмены пакетов и «плавающих» версий).
RUN pip install --require-hashes -r requirements.txt

# ── Рабочий образ ────────────────────────────────────────────────────────────
FROM python:3.12-slim

# ffmpeg — для студии клипов, шрифт — для текста мемов, pg_dump — для бэкапа.
RUN apt-get update \
 && apt-get upgrade -y --no-install-recommends \
 && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core postgresql-client \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 1000 appuser

ENV PATH=/opt/venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ENV=production

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY --chown=appuser:appuser . .
RUN mkdir -p /app/static && chown appuser:appuser /app/static

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).status == 200 else 1)"

# Миграции перед стартом; реальный IP клиента принимаем только от прокси
# (FORWARDED_ALLOW_IPS задаётся в compose — адрес контейнера nginx/сети).
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips=\"${FORWARDED_ALLOW_IPS:-127.0.0.1}\" --no-server-header"]
