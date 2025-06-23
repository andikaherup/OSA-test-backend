# Email Security Dashboard Backend

## Overview

This backend powers the Email Security Dashboard, providing RESTful APIs and real-time updates via WebSocket. It is built with Node.js and Express, and integrates with Python scripts for advanced email analysis.

## Features

- RESTful API endpoints for managing email security data
- Real-time notifications and updates using WebSocket
- Modular structure for scalability and maintainability
- Integration with Python scripts for specialized processing

## Current Project Structure

```
email-security-dashboard-backend/
├── package.json
├── .gitignore
├── server.js
├── routes/
├── models/
├── controllers/
├── middleware/
├── config/
└── python-scripts/
```

## Getting Started

1. Install dependencies: `npm install`
2. Start development server: `npm run dev` (to be configured)
3. Start everything using Docker: `npm run docker:up`

## WebSocket Integration

This backend uses WebSocket (via the `ws` or `socket.io` library) to push real-time updates to connected clients. The WebSocket server is initialized in `server.js`. Clients can subscribe to events such as new email alerts or security status changes.

## Python Script Integration

The `python-scripts/` directory contains Python scripts for tasks like email analysis and threat detection. These scripts are invoked from the Node.js backend as needed.

## Configuration

- Environment variables are managed in the `config/` directory.
- WebSocket and API ports can be configured via `.env` files.
