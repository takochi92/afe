FROM python:3.12-alpine
WORKDIR /app
COPY server/server.py /app/server.py
COPY index.html /app/index.html
USER 1000:1000
ENV VAULT_DATA=/data
CMD ["python","/app/server.py"]
