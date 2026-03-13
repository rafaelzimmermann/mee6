FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including dev for dev mode)
RUN npm install

EXPOSE 5173

CMD ["npm", "run", "dev"]
