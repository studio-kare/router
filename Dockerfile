FROM oven/bun:latest AS builder

WORKDIR /build

# Copy package files
COPY package.json .
COPY bun.lock .

# Install dependencies
RUN bun install

# Copy source
COPY src ./src
COPY frontend ./frontend
COPY index.ts .
COPY index.html .
COPY frontend.tsx .

# Final stage
FROM oven/bun:latest

WORKDIR /app

# Copy node_modules and source from builder
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/src ./src
COPY --from=builder /build/frontend ./frontend
COPY --from=builder /build/index.ts .
COPY --from=builder /build/package.json .
COPY --from=builder /build/index.html .
COPY --from=builder /build/frontend.tsx .

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD bun run -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

# Run the application
CMD ["bun", "run", "index.ts"]
