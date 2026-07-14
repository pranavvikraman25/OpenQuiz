# OpenQuiz 🎯

OpenQuiz is a Free and Open-Source Software (FOSS) real-time interactive quiz platform, designed for developer communities, meetups, and conferences. Attendees join in seconds with just a nickname (no email, no tracking) by entering a PIN or scanning a dynamically generated QR code.

Built using a lightweight in-memory Spring Boot JVM backend and a highly responsive React frontend with a modern glassmorphic UI.

---

## 🚀 Features

- **Zero-Auth Player Entry:** Attendees join by nickname + PIN or scanning the QR code. No signup required.
- **Persistent Host Login:** Host sessions are password-protected and persist across browser reloads via local storage.
- **Speed-based Point System:** Earn up to 100 points per question, scaled based on how fast you answer.
- **Double Points Toggle:** Host can set specific questions to reward double points.
- **Real-Time Leaderboard & Podium:** Live score updates between rounds and a podium reveal sequence for the top 3 winners.
- **100% In-Memory State:** Fast, private, data-free, and stateless. Session states live entirely in JVM RAM.
- **Responsive Layout:** Dynamic UI adaptively scales for mobile viewports (players) and projector screens (hosts).

---

## 🛠️ Technology Stack

- **Backend:** Java 17, Spring Boot 3, Spring WebSockets
- **Frontend:** React 19, Vite, TypeScript, Vanilla CSS (Glassmorphic theme)
- **Local Tooling:** Maven, npm

---

## 💻 Local Quick Start

### 1. Prerequisites
- **Java 17** or higher
- **Node.js** (v18+) and **npm**

### 2. Run the Backend
```bash
cd backend
mvn spring-boot:run
# Backend server runs on http://localhost:8080
```

### 3. Run the Frontend
```bash
cd frontend
npm install
npm run dev
# Frontend dev server runs on http://localhost:5173
```

Navigate to `http://localhost:5173` to play!
- Click **Host a Session** and log in using default credentials: `admin` / `admin123`.

---

## 🌐 Production Deployment

Since this application utilizes persistent WebSockets, we recommend a split deployment or hosting on a provider that supports long-running persistent processes (not serverless).

### Option A: Split Deployment (Vercel + Railway) - *Recommended*

#### 1. Backend (Railway)
1. Sign up on [Railway](https://railway.app/).
2. Create a new project, select **Deploy from GitHub repository**, and link this repo.
3. In the service settings, set the **Root Directory** to `backend`.
4. Railway will automatically detect `pom.xml` and build/deploy your Spring Boot service.
5. In the **Variables** tab, add any necessary env vars (the port `PORT` is injected automatically).
6. Copy the public Railway domain generated for your backend (e.g. `https://my-backend-production.up.railway.app`).

#### 2. Frontend (Vercel)
1. Sign up on [Vercel](https://vercel.com/).
2. Import this repository.
3. In the project setup, set the **Root Directory** to `frontend`.
4. In **Environment Variables**, add:
   - `VITE_WS_URL` = `wss://my-backend-production.up.railway.app/ws` (replace with your backend's domain, changing `https:` to `wss:`).
5. Deploy!

### Option B: Monorepo Deployment (Railway Only)
You can deploy both directories from the same repo as separate services on Railway:
1. Create a service pointing to the repo with Root Directory `backend`.
2. Create a second service pointing to the same repo with Root Directory `frontend`.
3. In the frontend service settings, define `VITE_WS_URL` to point to the backend service domain.

---

## 📂 Codebase Structure

A comprehensive overview of directories and files can be found in [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).
- **`/backend`**: Spring Boot controllers, models (GameSession, Player, Question), and the core WebSocket handler.
- **`/frontend`**: React client application (`App.tsx`, `index.css`, custom build scripts).

---

## 📄 License

This project is licensed under the Free and Open Source Software model (FOSS). See LICENSE for details.
