package com.d3.quiz.websocket;

import com.d3.quiz.model.Player;
import com.d3.quiz.model.Question;
import java.util.List;
import java.util.Map;

public class WsMessage {
    private String type;
    private String gamePin;
    private String nickname;
    private List<Integer> answerIndices;
    private Integer questionIndex;
    private Integer timer;
    
    // Payload structures
    private List<Player> players;
    private List<Player> leaderboard;
    private Question question;
    private Map<Integer, Integer> stats;
    private List<Integer> correctOptionIndices;
    private Integer scoreChange;
    private Integer score;
    private Boolean isCorrect;
    private Integer place;
    private String quizTitle;
    private String quizDescription;

    public WsMessage() {}

    public WsMessage(String type) {
        this.type = type;
    }

    // Getters and Setters
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getGamePin() { return gamePin; }
    public void setGamePin(String gamePin) { this.gamePin = gamePin; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public List<Integer> getAnswerIndices() { return answerIndices; }
    public void setAnswerIndices(List<Integer> answerIndices) { this.answerIndices = answerIndices; }

    public Integer getQuestionIndex() { return questionIndex; }
    public void setQuestionIndex(Integer questionIndex) { this.questionIndex = questionIndex; }

    public Integer getTimer() { return timer; }
    public void setTimer(Integer timer) { this.timer = timer; }

    public List<Player> getPlayers() { return players; }
    public void setPlayers(List<Player> players) { this.players = players; }

    public List<Player> getLeaderboard() { return leaderboard; }
    public void setLeaderboard(List<Player> leaderboard) { this.leaderboard = leaderboard; }

    public Question getQuestion() { return question; }
    public void setQuestion(Question question) { this.question = question; }

    public Map<Integer, Integer> getStats() { return stats; }
    public void setStats(Map<Integer, Integer> stats) { this.stats = stats; }

    public List<Integer> getCorrectOptionIndices() { return correctOptionIndices; }
    public void setCorrectOptionIndices(List<Integer> correctOptionIndices) { this.correctOptionIndices = correctOptionIndices; }

    public Integer getScoreChange() { return scoreChange; }
    public void setScoreChange(Integer scoreChange) { this.scoreChange = scoreChange; }

    public Integer getScore() { return score; }
    public void setScore(Integer score) { this.score = score; }

    public Boolean getIsCorrect() { return isCorrect; }
    public void setIsCorrect(Boolean isCorrect) { this.isCorrect = isCorrect; }

    public Integer getPlace() { return place; }
    public void setPlace(Integer place) { this.place = place; }

    public String getQuizTitle() { return quizTitle; }
    public void setQuizTitle(String quizTitle) { this.quizTitle = quizTitle; }

    public String getQuizDescription() { return quizDescription; }
    public void setQuizDescription(String quizDescription) { this.quizDescription = quizDescription; }
}
