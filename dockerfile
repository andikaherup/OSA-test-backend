# Development stage
FROM node:20-alpine AS development

# Install Python and pip (for email security tests)
RUN apk add --no-cache python3 py3-pip

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy Python requirements and install in virtual environment
COPY python-scripts/requirements.txt ./python-scripts/
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r python-scripts/requirements.txt

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start the application in development mode
CMD ["npm", "run", "dev"]