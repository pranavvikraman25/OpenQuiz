package com.d3.quiz.model;

import java.util.ArrayList;
import java.util.List;

public class Quiz {
    private String id;
    private String title;
    private String description;
    private List<Question> questions = new ArrayList<>();

    public Quiz() {}

    public Quiz(String id, String title, String description, List<Question> questions) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.questions = questions;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public List<Question> getQuestions() { return questions; }
    public void setQuestions(List<Question> questions) { this.questions = questions; }
}
