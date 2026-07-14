package com.d3.quiz.websocket;

import com.d3.quiz.model.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

@Component
public class QuizWebSocketHandler extends TextWebSocketHandler {
    private static final Logger log = LoggerFactory.getLogger(QuizWebSocketHandler.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Active Game Sessions: GamePin -> GameSession
    private final Map<String, GameSession> activeSessions = new ConcurrentHashMap<>();
    
    // WS Session Mapping: SessionId -> GamePin
    private final Map<String, String> sessionToGamePin = new ConcurrentHashMap<>();
    
    // WS Session Mapping: SessionId -> WebSocketSession
    private final Map<String, WebSocketSession> wsSessions = new ConcurrentHashMap<>();
    
    // Timer schedulers per GamePin
    private final Map<String, ScheduledFuture<?>> activeTimers = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);

    // Preloaded Demo Quizzes
    private final Map<String, Quiz> availableQuizzes = new ConcurrentHashMap<>();

    public QuizWebSocketHandler() {
        preloadDemoQuizzes();
    }

    private void preloadDemoQuizzes() {
        // Quiz 1: Tech & Debugging Quiz
        List<Question> qList1 = new ArrayList<>();
        qList1.add(new Question("q1", 
            "Which of the following is NOT a hook in React?", 
            QuestionType.MULTIPLE_CHOICE, 
            Arrays.asList("useState", "useEffect", "useFetch", "useContext"), 
            Collections.singletonList(2), 
            20, 
            false, 
            null));
        
        qList1.add(new Question("q2", 
            "Is Java a purely object-oriented programming language?", 
            QuestionType.TRUE_FALSE, 
            Arrays.asList("True", "False"), 
            Collections.singletonList(1), // False, because of primitives
            20, 
            true, 
            null));

        qList1.add(new Question("q3", 
            "What will this JavaScript code output? Find the bug!", 
            QuestionType.DEBUGGING, 
            Arrays.asList("1, 2, 3", "3, 3, 3", "0, 1, 2", "ReferenceError"), 
            Collections.singletonList(1), 
            180, // 3 minutes for debugging
            true, 
            "for (var i = 0; i < 3; i++) {\n  setTimeout(() => console.log(i), 1000);\n}"));

        qList1.add(new Question("q4", 
            "Identify the correct way to declare a record in Java 17:", 
            QuestionType.MULTIPLE_CHOICE, 
            Arrays.asList("public class record Point(int x, int y) {}", 
                          "public record Point(int x, int y) {}", 
                          "public class Point extends Record {}", 
                          "new Point(int x, int y)"), 
            Collections.singletonList(1), 
            30, 
            false, 
            null));

        availableQuizzes.put("demo-tech", new Quiz("demo-tech", "Tech Community Quiz", "React, JVM, & JavaScript Debugging Quiz", qList1));
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        wsSessions.put(session.getId(), session);
        log.info("WebSocket connection established: {}", session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String sessionId = session.getId();
        wsSessions.remove(sessionId);
        String gamePin = sessionToGamePin.remove(sessionId);

        if (gamePin != null) {
            GameSession gameSession = activeSessions.get(gamePin);
            if (gameSession != null) {
                // If the host disconnected
                if (sessionId.equals(gameSession.getHostSessionId())) {
                    log.info("Host disconnected. Terminating game: {}", gamePin);
                    broadcastToSession(gameSession, new WsMessage("GAME_TERMINATED"));
                    cleanUpGame(gamePin);
                } else {
                    // Player disconnected
                    Player removed = gameSession.removePlayer(sessionId);
                    if (removed != null) {
                        log.info("Player {} left game {}", removed.getNickname(), gamePin);
                        broadcastPlayerList(gameSession);
                    }
                }
            }
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            WsMessage msg = objectMapper.readValue(message.getPayload(), WsMessage.class);
            String type = msg.getType();

            switch (type) {
                case "HOST_CREATE":
                    handleHostCreate(session, msg);
                    break;
                case "PLAYER_JOIN":
                    handlePlayerJoin(session, msg);
                    break;
                case "PLAYER_ANSWER":
                    handlePlayerAnswer(session, msg);
                    break;
                case "HOST_START_GAME":
                    handleHostStart(session, msg);
                    break;
                case "HOST_NEXT":
                    handleHostNext(session, msg);
                    break;
                case "GET_QUIZZES":
                    sendQuizzesList(session);
                    break;
                default:
                    log.warn("Unknown message type received: {}", type);
            }
        } catch (Exception e) {
            log.error("Error processing WebSocket message", e);
        }
    }

    private void sendQuizzesList(WebSocketSession session) throws IOException {
        List<Map<String, String>> quizList = availableQuizzes.values().stream()
            .map(q -> {
                Map<String, String> m = new HashMap<>();
                m.put("id", q.getId());
                m.put("title", q.getTitle());
                m.put("description", q.getDescription());
                m.put("questionsCount", String.valueOf(q.getQuestions().size()));
                return m;
            })
            .collect(Collectors.toList());

        WsMessage reply = new WsMessage("QUIZZES_LIST");
        // We reuse the players list or custom serialization, let's make it simpler by using map mapping or setting title
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(reply)
            .replace("}", ",\"quizzes\":" + objectMapper.writeValueAsString(quizList) + "}")));
    }

    private void handleHostCreate(WebSocketSession session, WsMessage msg) throws IOException {
        String quizId = msg.getGamePin(); // Host sends quizId in gamePin field for creation
        Quiz quiz = availableQuizzes.get(quizId);
        if (quiz == null) {
            // Fallback to first quiz if not found
            quiz = availableQuizzes.values().iterator().next();
        }

        // Generate game PIN (6 digits)
        String gamePin = String.format("%06d", new Random().nextInt(900000) + 100000);
        while (activeSessions.containsKey(gamePin)) {
            gamePin = String.format("%06d", new Random().nextInt(900000) + 100000);
        }

        GameSession gameSession = new GameSession(gamePin, quiz, session.getId());
        activeSessions.put(gamePin, gameSession);
        sessionToGamePin.put(session.getId(), gamePin);

        log.info("Game created: PIN = {}, Quiz = {}", gamePin, quiz.getTitle());

        WsMessage response = new WsMessage("GAME_CREATED");
        response.setGamePin(gamePin);
        response.setQuizTitle(quiz.getTitle());
        response.setQuizDescription(quiz.getDescription());
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
    }

    private void handlePlayerJoin(WebSocketSession session, WsMessage msg) throws IOException {
        String gamePin = msg.getGamePin();
        String nickname = msg.getNickname();

        GameSession gameSession = activeSessions.get(gamePin);
        if (gameSession == null) {
            sendError(session, "GAME_NOT_FOUND", "Game with PIN " + gamePin + " not found.");
            return;
        }

        if (gameSession.getStatus() != GameStatus.LOBBY) {
            sendError(session, "GAME_ALREADY_STARTED", "This game has already started.");
            return;
        }

        boolean joined = gameSession.addPlayer(session.getId(), nickname);
        if (!joined) {
            sendError(session, "NICKNAME_TAKEN", "Nickname is already taken in this lobby.");
            return;
        }

        sessionToGamePin.put(session.getId(), gamePin);
        log.info("Player {} joined game {}", nickname, gamePin);

        // Acknowledge join to player
        WsMessage ack = new WsMessage("JOIN_SUCCESS");
        ack.setGamePin(gamePin);
        ack.setNickname(nickname);
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(ack)));

        // Notify Host and all players
        broadcastPlayerList(gameSession);
    }

    private void handlePlayerAnswer(WebSocketSession session, WsMessage msg) {
        String gamePin = sessionToGamePin.get(session.getId());
        if (gamePin == null) return;

        GameSession gameSession = activeSessions.get(gamePin);
        if (gameSession == null || gameSession.getStatus() != GameStatus.ACTIVE) return;

        gameSession.submitAnswer(session.getId(), msg.getAnswerIndices());

        // Send confirmation to the player
        try {
            WsMessage confirm = new WsMessage("ANSWER_RECEIVED");
            confirm.setAnswerIndices(msg.getAnswerIndices());
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(confirm)));
        } catch (IOException e) {
            log.error("Error sending answer confirmation", e);
        }

        // Notify the host about the total number of answers submitted
        notifyHostAnswerCount(gameSession);

        // Check if everyone has answered, if so, end question immediately
        long answeredCount = gameSession.getPlayers().values().stream().filter(Player::isAnsweredThisQuestion).count();
        if (answeredCount == gameSession.getPlayers().size() && answeredCount > 0) {
            log.info("All players answered for game {}. Ending question early.", gamePin);
            endQuestion(gameSession);
        }
    }

    private void handleHostStart(WebSocketSession session, WsMessage msg) throws IOException {
        String gamePin = sessionToGamePin.get(session.getId());
        if (gamePin == null) return;

        GameSession gameSession = activeSessions.get(gamePin);
        if (gameSession == null || !session.getId().equals(gameSession.getHostSessionId())) return;

        log.info("Starting game: {}", gamePin);
        goToNextQuestion(gameSession);
    }

    private void handleHostNext(WebSocketSession session, WsMessage msg) throws IOException {
        String gamePin = sessionToGamePin.get(session.getId());
        if (gamePin == null) return;

        GameSession gameSession = activeSessions.get(gamePin);
        if (gameSession == null || !session.getId().equals(gameSession.getHostSessionId())) return;

        GameStatus status = gameSession.getStatus();
        log.info("Host command NEXT. Current status: {}", status);

        switch (status) {
            case PREVIEW:
                // Move from preview of question to active countdown
                startQuestionActive(gameSession);
                break;
            case ACTIVE:
                // Force end the timer early
                endQuestion(gameSession);
                break;
            case SHOW_ANSWER:
                // Move to leaderboard
                showLeaderboard(gameSession);
                break;
            case LEADERBOARD:
                // Move to next question or podium
                if (gameSession.getCurrentQuestionIndex() + 1 < gameSession.getQuiz().getQuestions().size()) {
                    goToNextQuestion(gameSession);
                } else {
                    showPodium(gameSession);
                }
                break;
            case PODIUM:
                // Game over clean up
                cleanUpGame(gamePin);
                break;
            default:
                break;
        }
    }

    private void goToNextQuestion(GameSession session) {
        cancelActiveTimer(session.getGamePin());
        session.setCurrentQuestionIndex(session.getCurrentQuestionIndex() + 1);
        session.setStatus(GameStatus.PREVIEW);
        session.prepareForNextQuestion();

        Question question = session.getCurrentQuestion();
        log.info("Question {} - Preview status", session.getCurrentQuestionIndex());

        WsMessage msg = new WsMessage("QUESTION_PREVIEW");
        msg.setQuestionIndex(session.getCurrentQuestionIndex() + 1);
        msg.setQuizTitle(session.getQuiz().getTitle());
        // Hide details from question object during preview except general info
        Question previewQ = new Question();
        previewQ.setText(question.getText());
        previewQ.setType(question.getType());
        previewQ.setTimerSeconds(question.getTimerSeconds());
        previewQ.setDoublePoints(question.isDoublePoints());
        previewQ.setCodeSnippet(question.getCodeSnippet());
        msg.setQuestion(previewQ);

        broadcastToSession(session, msg);
    }

    private void startQuestionActive(GameSession session) {
        session.setStatus(GameStatus.ACTIVE);
        session.setQuestionStartTimeMs(System.currentTimeMillis());
        Question question = session.getCurrentQuestion();
        session.setActiveTimerSeconds(question.getTimerSeconds());

        WsMessage msg = new WsMessage("QUESTION_ACTIVE");
        msg.setQuestion(question);
        msg.setTimer(question.getTimerSeconds());
        broadcastToSession(session, msg);

        // Schedule countdown
        startCountdown(session);
    }

    private void startCountdown(GameSession session) {
        String gamePin = session.getGamePin();
        cancelActiveTimer(gamePin);

        ScheduledFuture<?> timer = scheduler.scheduleAtFixedRate(() -> {
            try {
                synchronized (session) {
                    if (session.getStatus() != GameStatus.ACTIVE) {
                        cancelActiveTimer(gamePin);
                        return;
                    }

                    int timeLeft = session.getActiveTimerSeconds() - 1;
                    session.setActiveTimerSeconds(timeLeft);

                    // Broadcast tick
                    WsMessage tick = new WsMessage("TIMER_TICK");
                    tick.setTimer(timeLeft);
                    broadcastToSession(session, tick);

                    if (timeLeft <= 0) {
                        cancelActiveTimer(gamePin);
                        endQuestion(session);
                    }
                }
            } catch (Exception e) {
                log.error("Error in timer tick", e);
            }
        }, 1, 1, TimeUnit.SECONDS);

        activeTimers.put(gamePin, timer);
    }

    private void endQuestion(GameSession session) {
        cancelActiveTimer(session.getGamePin());
        session.setStatus(GameStatus.SHOW_ANSWER);
        session.calculateScores();

        Question question = session.getCurrentQuestion();

        // Send specific results to each player
        for (Map.Entry<String, Player> entry : session.getPlayers().entrySet()) {
            WebSocketSession ws = wsSessions.get(entry.getKey());
            if (ws != null && ws.isOpen()) {
                Player p = entry.getValue();
                WsMessage res = new WsMessage("PLAYER_RESULT");
                res.setIsCorrect(p.isLastAnswerCorrect());
                res.setScoreChange(p.getScoreChange());
                res.setScore(p.getScore());
                res.setAnswerIndices(p.getLastAnswerIndices());
                res.setCorrectOptionIndices(question.getCorrectOptionIndices());
                try {
                    ws.sendMessage(new TextMessage(objectMapper.writeValueAsString(res)));
                } catch (IOException e) {
                    log.error("Error sending player result", e);
                }
            }
        }

        // Host/Presenter message
        WsMessage hostMsg = new WsMessage("QUESTION_RESULTS");
        hostMsg.setStats(session.getAnswerStats());
        hostMsg.setCorrectOptionIndices(question.getCorrectOptionIndices());
        
        WebSocketSession hostWs = wsSessions.get(session.getHostSessionId());
        if (hostWs != null && hostWs.isOpen()) {
            try {
                hostWs.sendMessage(new TextMessage(objectMapper.writeValueAsString(hostMsg)));
            } catch (IOException e) {
                log.error("Error sending question results to host", e);
            }
        }
    }

    private void showLeaderboard(GameSession session) {
        session.setStatus(GameStatus.LEADERBOARD);

        List<Player> sortedPlayers = session.getPlayers().values().stream()
            .sorted(Comparator.comparingInt(Player::getScore).reversed())
            .collect(Collectors.toList());

        // Presenter leaderboard shows top 5
        List<Player> top5 = sortedPlayers.stream().limit(5).collect(Collectors.toList());

        // Broadcast leaderboard
        WsMessage msg = new WsMessage("LEADERBOARD_UPDATE");
        msg.setLeaderboard(top5);
        broadcastToSession(session, msg);

        // Tell individual players their current place
        for (int i = 0; i < sortedPlayers.size(); i++) {
            Player p = sortedPlayers.get(i);
            WebSocketSession ws = wsSessions.get(p.getSessionId());
            if (ws != null && ws.isOpen()) {
                WsMessage rankMsg = new WsMessage("PLAYER_RANK");
                rankMsg.setPlace(i + 1);
                rankMsg.setScore(p.getScore());
                try {
                    ws.sendMessage(new TextMessage(objectMapper.writeValueAsString(rankMsg)));
                } catch (IOException e) {
                    log.error("Error sending player rank", e);
                }
            }
        }
    }

    private void showPodium(GameSession session) {
        session.setStatus(GameStatus.PODIUM);

        List<Player> sortedPlayers = session.getPlayers().values().stream()
            .sorted(Comparator.comparingInt(Player::getScore).reversed())
            .collect(Collectors.toList());

        List<Player> podium = sortedPlayers.stream().limit(3).collect(Collectors.toList());

        WsMessage msg = new WsMessage("PODIUM_UPDATE");
        msg.setLeaderboard(podium);
        broadcastToSession(session, msg);
    }

    private void broadcastPlayerList(GameSession session) {
        WsMessage msg = new WsMessage("PLAYER_LIST_UPDATE");
        msg.setPlayers(new ArrayList<>(session.getPlayers().values()));
        broadcastToSession(session, msg);
    }

    private void notifyHostAnswerCount(GameSession session) {
        long count = session.getPlayers().values().stream().filter(Player::isAnsweredThisQuestion).count();
        WsMessage msg = new WsMessage("ANSWER_COUNT_UPDATE");
        msg.setTimer((int) count); // reuse timer field for simplicity

        WebSocketSession hostSession = wsSessions.get(session.getHostSessionId());
        if (hostSession != null && hostSession.isOpen()) {
            try {
                hostSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(msg)));
            } catch (IOException e) {
                log.error("Error sending answer count to host", e);
            }
        }
    }

    private void broadcastToSession(GameSession session, WsMessage msg) {
        String json;
        try {
            json = objectMapper.writeValueAsString(msg);
        } catch (IOException e) {
            log.error("Error serializing message", e);
            return;
        }

        TextMessage textMsg = new TextMessage(json);
        
        // Send to host
        WebSocketSession hostWs = wsSessions.get(session.getHostSessionId());
        if (hostWs != null && hostWs.isOpen()) {
            try {
                hostWs.sendMessage(textMsg);
            } catch (IOException e) {
                log.error("Error sending to host", e);
            }
        }

        // Send to players
        for (String sessId : session.getPlayers().keySet()) {
            WebSocketSession pWs = wsSessions.get(sessId);
            if (pWs != null && pWs.isOpen()) {
                try {
                    pWs.sendMessage(textMsg);
                } catch (IOException e) {
                    log.error("Error sending to player {}", sessId, e);
                }
            }
        }
    }

    private void sendError(WebSocketSession session, String errorType, String message) throws IOException {
        WsMessage err = new WsMessage("ERROR");
        err.setNickname(errorType); // reuse nickname field for error type code
        err.setQuizTitle(message);  // reuse quizTitle for description
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(err)));
    }

    private void cancelActiveTimer(String gamePin) {
        ScheduledFuture<?> timer = activeTimers.remove(gamePin);
        if (timer != null) {
            timer.cancel(true);
        }
    }

    private void cleanUpGame(String gamePin) {
        cancelActiveTimer(gamePin);
        GameSession session = activeSessions.remove(gamePin);
        if (session != null) {
            sessionToGamePin.remove(session.getHostSessionId());
            for (String pid : session.getPlayers().keySet()) {
                sessionToGamePin.remove(pid);
            }
        }
    }
}
