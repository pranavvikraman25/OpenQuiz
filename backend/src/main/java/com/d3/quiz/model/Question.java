package com.d3.quiz.model;

import java.util.ArrayList;
import java.util.List;

public class Question {
    private String id;
    private String text;
    private QuestionType type;
    private List<String> options = new ArrayList<>();
    private List<Integer> correctOptionIndices = new ArrayList<>();
    private int timerSeconds = 20;
    private boolean doublePoints = false;
    private String codeSnippet; // For debugging questions

    // Constructors
    public Question() {}

    public Question(String id, String text, QuestionType type, List<String> options, List<Integer> correctOptionIndices, int timerSeconds, boolean doublePoints, String codeSnippet) {
        this.id = id;
        this.text = text;
        this.type = type;
        this.options = options;
        this.correctOptionIndices = correctOptionIndices;
        this.timerSeconds = timerSeconds;
        this.doublePoints = doublePoints;
        this.codeSnippet = codeSnippet;
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public QuestionType getType() { return type; }
    public void setType(QuestionType type) { this.type = type; }

    public List<String> getOptions() { return options; }
    public void setOptions(List<String> options) { this.options = options; }

    public List<Integer> getCorrectOptionIndices() { return correctOptionIndices; }
    public void setCorrectOptionIndices(List<Integer> correctOptionIndices) { this.correctOptionIndices = correctOptionIndices; }

    public int getTimerSeconds() { return timerSeconds; }
    public void setTimerSeconds(int timerSeconds) { this.timerSeconds = timerSeconds; }

    public boolean isDoublePoints() { return doublePoints; }
    public void setDoublePoints(boolean doublePoints) { this.doublePoints = doublePoints; }

    public String getCodeSnippet() { return codeSnippet; }
    public void setCodeSnippet(String codeSnippet) { this.codeSnippet = codeSnippet; }
}
