# WhatsApp AI Customer Service & Booking SaaS (`whatsapp-ai-business-bot`)

A multi-tenant, enterprise-grade WhatsApp AI Customer Service and Booking SaaS platform engineered with clean separation between a **React + Vite + PWA** dashboard (deployable to Firebase Hosting) and a **Node.js + Express + MongoDB + Socket.IO + Gemini AI + WhatsApp Connector** backend (deployable to Oracle Cloud VM with PM2/Nginx for 24/7 continuous operation).

---

## Architecture Overview

- **Frontend (`/frontend`)**: React, Vite, PWA, Vanilla CSS design system, Socket.IO Client, Centralized API client. Deployable to Firebase Hosting.
- **Backend (`/backend`)**: Node.js, Express, MongoDB Atlas (Mongoose), Socket.IO Server, Gemini AI engine, Modular WhatsApp Connector (`@whiskeysockets/baileys`). Deployable to Oracle Cloud VM managed by PM2 & Nginx.
- **Documentation (`/docs`)**: In-depth architectural, setup, security, and deployment documentation.

---

## Directory Structure

```text
whatsapp-ai-business-bot/
├── frontend/                     # React + Vite + PWA Dashboard (Firebase Hosting)
│   ├── public/                   # PWA Manifest, Icons, Offline Assets
│   ├── src/
│   │   ├── assets/               # CSS Design System, Logos, Icons
│   │   ├── components/           # UI Components (Sidebar, Navbar, Modals, Cards)
│   │   ├── context/              # AuthContext, SocketContext, ThemeContext
│   │   ├── hooks/                # Custom Hooks (useAuth, useSocket, useApi)
│   │   ├── pages/                # Auth, Dashboard, WhatsApp, Chats, Bookings, AI
│   │   ├── services/             # Centralized API service layer
│   │   ├── utils/                # Formatters, Validators, Helpers
│   │   ├── App.jsx               # Main Router and Layout Shell
│   │   └── main.jsx              # Application Entry Point
│   ├── package.json
│   └── vite.config.js
│
├── backend/                      # Node.js + Express + Socket.IO (Oracle Cloud 24/7)
│   ├── src/
│   │   ├── config/               # DB, JWT, Gemini, Server & Rate-Limit Config
│   │   ├── controllers/          # Multi-tenant Route Controllers
│   │   ├── middleware/           # Auth, TenantGuard, RateLimiter, Validator
│   │   ├── models/               # Mongoose Multi-Tenant Schemas
│   │   ├── providers/            # AI (GeminiProvider), WhatsApp (QRConnector)
│   │   ├── routes/               # Modular REST API Endpoints
│   │   ├── services/             # Business Logic, Message Hub, AI Context, Booking
│   │   ├── sockets/              # Real-Time Socket.IO Server & Tenant Rooms
│   │   ├── utils/                # Sanitization, Token Helpers, Logger
│   │   └── server.js             # Express & Socket.IO Entry Point
│   ├── package.json
│   └── .env.example
│
├── docs/                         # Comprehensive Engineering & Deployment Docs
│   ├── ARCHITECTURE.md
│   ├── LOCAL_SETUP.md
│   ├── PRODUCTION_DEPLOYMENT.md
│   ├── RENDER_DEPLOYMENT.md
│   ├── ORACLE_DEPLOYMENT.md
│   ├── FIREBASE_DEPLOYMENT.md
│   ├── WHATSAPP_SETUP.md
│   ├── AI_SETUP.md
│   └── TROUBLESHOOTING.md
│
├── README.md
└── .gitignore
```

---

## Key Features

1. **Multi-Tenant Data Isolation**: Every business has its own isolated data partition (`businessId`). Zero cross-tenant data leakage.
2. **Modular WhatsApp Connector**: QR-based auto-reconnecting WhatsApp engine with session persistence across server reboots.
3. **No-Hallucination AI Guardrails**: Powered by Gemini API with dynamic business context injection. Never hallucinates prices or confirms unverified bookings.
4. **Intelligent Multilingual & Tone Detection**: Automatically communicates in English, Urdu, Roman Urdu, Malay, Arabic, or mixed dialects matching the customer's conversational style.
5. **Conversational Booking System**: Detects booking intent, progressively gathers missing information, and integrates with the dashboard.
6. **Live Human Handover**: Instant toggle between AI automation and human agent control with real-time Socket.IO synchronization.
7. **Production 24/7 Autonomous Operation**: Engineered to run uninterrupted on Oracle Cloud VM under PM2 even when local devices are offline.
