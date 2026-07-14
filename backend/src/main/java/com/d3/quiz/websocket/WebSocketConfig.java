package com.d3.quiz.websocket;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final QuizWebSocketHandler quizWebSocketHandler;

    public WebSocketConfig(QuizWebSocketHandler quizWebSocketHandler) {
        this.quizWebSocketHandler = quizWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(quizWebSocketHandler, "/ws")
                .setAllowedOrigins("*");
    }
}
