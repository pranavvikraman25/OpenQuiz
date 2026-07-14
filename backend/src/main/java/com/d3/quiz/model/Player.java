package com.d3.quiz.model;

import java.util.ArrayList;
import java.util.List;

public class Player {
    private String sessionId;
    private String nickname;
    private int score = 0;
    private boolean answeredThisQuestion = false;
    private List<Integer> lastAnswerIndices = new ArrayList<>();
    private long lastAnswerTimeMs = 0; // Milliseconds from the start of the question timer
    private boolean isLastAnswerCorrect = false;
    private int scoreChange = 0;
    private int streak = 0;

    public Player() {}

    public Player(String sessionId, String nickname) {
        this.sessionId = sessionId;
        this.nickname = nickname;
    }

    public void resetQuestionState() {
        this.answeredThisQuestion = false;
        this.lastAnswerIndices = new ArrayList<>();
        this.lastAnswerTimeMs = 0;
        this.isLastAnswerCorrect = false;
        this.scoreChange = 0;
    }

    // Getters and Setters
    public String getSessionId() { return sessionId; }
    public void setSessionId(String sessionId) { this.sessionId = sessionId; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public int getScore() { return score; }
    public void setScore(int score) { this.score = score; }

    public boolean isAnsweredThisQuestion() { return answeredThisQuestion; }
    public void setAnsweredThisQuestion(boolean answeredThisQuestion) { this.answeredThisQuestion = answeredThisQuestion; }

    public List<Integer> getLastAnswerIndices() { return lastAnswerIndices; }
    public void setLastAnswerIndices(List<Integer> lastAnswerIndices) { this.lastAnswerIndices = lastAnswerIndices; }

    public long getLastAnswerTimeMs() { return lastAnswerTimeMs; }
    public void setLastAnswerTimeMs(long lastAnswerTimeMs) { this.lastAnswerTimeMs = lastAnswerTimeMs; }

    public boolean isLastAnswerCorrect() { return isLastAnswerCorrect; }
    public void setLastAnswerCorrect(boolean lastAnswerCorrect) { this.isLastAnswerCorrect = lastAnswerCorrect; }

    public int getScoreChange() { return scoreChange; }
    public void setScoreChange(int scoreChange) { this.scoreChange = scoreChange; }

    public int getStreak() { return streak; }
    public void setStreak(int streak) { this.streak = streak; }
}
