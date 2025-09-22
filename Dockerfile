FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app files
COPY . .

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port and start
EXPOSE 3000
CMD ["node", "server.js"]


