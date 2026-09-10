FROM python:3.12-slim-bookworm AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build
COPY pyproject.toml README.md ./
COPY app ./app
COPY static ./static
COPY template ./template
COPY config ./config
COPY docs ./docs
COPY assets/ui-kit/index.html ./assets/ui-kit/
COPY assets/ui-kit/catalog ./assets/ui-kit/catalog
COPY assets/ui-kit/src ./assets/ui-kit/src
COPY assets/ui-kit/styles ./assets/ui-kit/styles
COPY assets/ui-kit/generated ./assets/ui-kit/generated
COPY assets/ui-kit/vendor ./assets/ui-kit/vendor
RUN python -m pip wheel --wheel-dir /wheels .

FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/opt/venv/bin:$PATH

RUN python -m venv /opt/venv \
    && useradd --create-home --uid 10001 --shell /usr/sbin/nologin agent-factory
COPY --from=builder /wheels /wheels
RUN python -m pip install --no-cache-dir /wheels/* && rm -rf /wheels

WORKDIR /srv/agent-factory
COPY --chown=agent-factory:agent-factory app ./app
COPY --chown=agent-factory:agent-factory config ./config
COPY --chown=agent-factory:agent-factory static ./static
COPY --chown=agent-factory:agent-factory template ./template
COPY --from=builder --chown=agent-factory:agent-factory /build/assets/ui-kit ./assets/ui-kit
COPY --chown=agent-factory:agent-factory .codex/skills/spec-platform/references/external-agent-reporting.md ./docs/external-agent-reporting.md
COPY --chown=agent-factory:agent-factory .codex/skills/spec-platform/references/planning-import.md ./docs/planning-import.md
RUN mkdir -p .backup uploads feedback exports \
    && chown -R agent-factory:agent-factory /srv/agent-factory

USER agent-factory
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
