# Project Structure: OpenQuiz Monorepo

This document describes the codebase directory structure and architecture of the OpenQuiz (FOSS real-time multiplayer quiz) platform. It serves as a guide for contributors, developers, and self-hosters.

---

## Workspace Layout

```text
Quizz Project/
├── .agents/                    # Agent-specific skill assets
│   └── skills/
│       ├── quiz-maker/         # Custom skill for AI quiz generation
│       └── graphify/           # Custom skill for querying codebase knowledge graph
│
├── backend/                    # JVM Java 17 + Spring Boot 3 Backend
│   ├── pom.xml                 # Maven dependency management config
│   └── src/
│       └── main/
│           ├── java/com/d3/quiz/
│           │   ├── QuizApplication.java      # Main Spring Boot bootstrap class
│           │   ├── controller/
│           │   │   └── QuizController.java   # HTTP REST controller (health check)
│           │   ├── model/
│           │   │   ├── Quiz.java             # Quiz schema (questions, titles)
│           │   │   ├── Question.java         # Question schema (options, double points, timer)
│           │   │   ├── QuestionType.java     # Enum (MULTIPLE_CHOICE, TRUE_FALSE, DEBUGGING)
│           │   │   ├── Player.java           # Live player state (scores, answer records)
│           │   │   ├── GameSession.java      # Game state machine & point calculation
│           │   │   └── GameStatus.java       # Game state enum (LOBBY, ACTIVE, RESULTS, etc.)
│           │   └── websocket/
│           │       ├── WebSocketConfig.java  # WebSocket protocol routing configurations
│           │       ├── QuizWebSocketHandler.java # Core real-time websocket message handlers
│           │       └── WsMessage.java        # WebSocket message JSON model schema
│           └── resources/
│               └── application.properties    # Backend server port & logging configuration
│
├── frontend/                   # React + Vite + TypeScript Frontend
│   ├── index.html              # Frontend web app shell
│   ├── package.json            # Node.js dependencies & scripts
│   ├── vite.config.ts          # Vite build and configuration rules
│   └── src/
│       ├── main.tsx            # React application mounting entry-point
│       ├── App.tsx             # Main React view controller & client game engine
│       └── index.css           # Premium vanilla CSS styling system
│
└── PROJECT_STRUCTURE.md        # This codebase map file
```

---

## Component Roles & Communication

1. **Real-time Synchronization (WebSockets)**:
   - Communication is handled in real-time between clients (presenter screens and player phone screens) and the backend JVM instance using WebSocket messages (`/ws`).
   - The JSON data schema is mapped to `WsMessage.java` on the backend and typed structures in `App.tsx` on the frontend.
   
2. **State Machine Management**:
   - The server acts as the single source of truth (`GameSession.java`), processing tick rate count-downs, answer selections, and leaderboards.
   - Host key events (Space / Right Arrow) tell the backend to advance states, which then broadcasts state updates to all joined players.

3. **No-Database Portable Run**:
   - For fast self-hosting, quiz templates are stored in-memory (and can easily be extended to JSON files), making the server lightweight, privacy-respecting, and completely free from complex database setup.
