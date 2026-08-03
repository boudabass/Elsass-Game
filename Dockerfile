FROM node:22-alpine AS base

# 1. Étape d'installation des dépendances
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Activer pnpm via corepack
RUN corepack enable pnpm

# Configurer pnpm pour ignorer l'erreur des scripts de build non approuvés
RUN pnpm config set ignore-scripts true

# Copier les fichiers de dépendances
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# 2. Étape de build
FROM base AS builder
WORKDIR /app
RUN corepack enable pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# 3. Étape de production (Image finale)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Sécurité : créer un utilisateur non-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copier uniquement les dossiers générés par le mode standalone
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Lancer le serveur optimisé
CMD ["node", "server.js"]