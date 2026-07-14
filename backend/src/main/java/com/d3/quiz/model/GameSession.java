package com.d3.quiz.model;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class GameSession {
    private String gamePin;
    private Quiz quiz;
    private GameStatus status = GameStatus.LOBBY;
    private int currentQuestionIndex = -1;
    private String hostSessionId;
    private Map<String, Player> players = new ConcurrentHashMap<>();
    private long questionStartTimeMs = 0;
    private int activeTimerSeconds = 0;
    
    // Stats for the active question: OptionIndex -> Player Count
    private Map<Integer, Integer> answerStats = new ConcurrentHashMap<>();

    public GameSession(String gamePin, Quiz quiz, String hostSessionId) {
        this.gamePin = gamePin;
        this.quiz = quiz;
        this.hostSessionId = hostSessionId;
    }

    public synchronized boolean addPlayer(String sessionId, String nickname) {
        // Prevent duplicate nicknames
        for (Player p : players.values()) {
            if (p.getNickname().equalsIgnoreCase(nickname)) {
                return false;
            }
        }
        players.put(sessionId, new Player(sessionId, nickname));
        return true;
    }

    public synchronized Player removePlayer(String sessionId) {
        return players.remove(sessionId);
    }

    public Question getCurrentQuestion() {
        if (quiz == null || currentQuestionIndex < 0 || currentQuestionIndex >= quiz.getQuestions().size()) {
            return null;
        }
        return quiz.getQuestions().get(currentQuestionIndex);
    }

    public synchronized void submitAnswer(String sessionId, List<Integer> selectedIndices) {
        Player player = players.get(sessionId);
        if (player == null || status != GameStatus.ACTIVE) {
            return;
        }

        long responseTimeMs = System.currentTimeMillis() - questionStartTimeMs;
        Question question = getCurrentQuestion();
        if (question == null) return;

        // If the player previously answered, we need to subtract their previous selection from stats
        if (player.isAnsweredThisQuestion()) {
            for (Integer prevIdx : player.getLastAnswerIndices()) {
                answerStats.computeIfPresent(prevIdx, (k, v) -> Math.max(0, v - 1));
            }
        }

        // Check if selectedIndices is empty (user deselected everything)
        if (selectedIndices == null || selectedIndices.isEmpty()) {
            player.resetQuestionState();
            return;
        }

        // Record the new answer
        player.setAnsweredThisQuestion(true);
        player.setLastAnswerIndices(selectedIndices);
        player.setLastAnswerTimeMs(responseTimeMs);

        // Add to stats
        for (Integer idx : selectedIndices) {
            answerStats.put(idx, answerStats.getOrDefault(idx, 0) + 1);
        }
    }

    public synchronized void calculateScores() {
        Question question = getCurrentQuestion();
        if (question == null) return;

        List<Integer> correctIndices = question.getCorrectOptionIndices();

        for (Player player : players.values()) {
            if (!player.isAnsweredThisQuestion()) {
                player.setLastAnswerCorrect(false);
                player.setScoreChange(0);
                player.setStreak(0);
                continue;
            }

            // Grade the answer: check if player's selected options match correct options
            List<Integer> selected = player.getLastAnswerIndices();
            boolean isCorrect = isAnswerCorrect(selected, correctIndices);

            player.setLastAnswerCorrect(isCorrect);

            if (isCorrect) {
                // Scoring Formula: Base = 100
                int basePoints = 100;
                long responseTime = player.getLastAnswerTimeMs();
                double totalTime = question.getTimerSeconds() * 1000.0;

                // Speed factor: scale down points by up to 50% for slower responses
                double speedFactor = 1.0 - ((double) responseTime / totalTime) * 0.5;
                speedFactor = Math.max(0.5, Math.min(1.0, speedFactor)); // bounds check

                int pointsGained = (int) Math.round(basePoints * speedFactor);

                if (question.isDoublePoints()) {
                    pointsGained *= 2;
                }

                player.setScore(player.getScore() + pointsGained);
                player.setScoreChange(pointsGained);
                player.setStreak(player.getStreak() + 1);
            } else {
                player.setScoreChange(0);
                player.setStreak(0);
            }
        }
    }

    private boolean isAnswerCorrect(List<Integer> selected, List<Integer> correct) {
        if (selected.size() != correct.size()) return false;
        Set<Integer> selectedSet = new HashSet<>(selected);
        Set<Integer> correctSet = new HashSet<>(correct);
        return selectedSet.equals(correctSet);
    }

    public synchronized void prepareForNextQuestion() {
        for (Player player : players.values()) {
            player.resetQuestionState();
        }
        answerStats.clear();
    }

    // Getters and Setters
    public String getGamePin() { return gamePin; }
    public void setGamePin(String gamePin) { this.gamePin = gamePin; }

    public Quiz getQuiz() { return quiz; }
    public void setQuiz(Quiz quiz) { this.quiz = quiz; }

    public GameStatus getStatus() { return status; }
    public void setStatus(GameStatus status) { this.status = status; }

    public int getCurrentQuestionIndex() { return currentQuestionIndex; }
    public void setCurrentQuestionIndex(int currentQuestionIndex) { this.currentQuestionIndex = currentQuestionIndex; }

    public String getHostSessionId() { return hostSessionId; }
    public void setHostSessionId(String hostSessionId) { this.hostSessionId = hostSessionId; }

    public Map<String, Player> getPlayers() { return players; }
    public void setPlayers(Map<String, Player> players) { this.players = players; }

    public long getQuestionStartTimeMs() { return questionStartTimeMs; }
    public void setQuestionStartTimeMs(long questionStartTimeMs) { this.questionStartTimeMs = questionStartTimeMs; }

    public int getActiveTimerSeconds() { return activeTimerSeconds; }
    public void setActiveTimerSeconds(int activeTimerSeconds) { this.activeTimerSeconds = activeTimerSeconds; }

    public Map<Integer, Integer> getAnswerStats() { return answerStats; }
    public void setAnswerStats(Map<Integer, Integer> answerStats) { this.answerStats = answerStats; }
}
