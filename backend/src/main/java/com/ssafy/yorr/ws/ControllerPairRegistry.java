package com.ssafy.yorr.ws;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * A short-lived relay between one game display and one phone controller.
 * The controller is deliberately not registered as a room participant: it only
 * forwards input to the browser that already owns the player session.
 */
@Component
public class ControllerPairRegistry {

    private static final char[] CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ".toCharArray();
    private static final int CODE_LENGTH = 6;

    public record Pair(String code, String playerTone, WebSocketSession display, WebSocketSession controller) {}

    public record Removal(Pair pair, boolean displayLeft) {}

    private final SecureRandom random = new SecureRandom();
    private final Map<String, Pair> byCode = new HashMap<>();
    private final Map<String, String> codeByDisplay = new HashMap<>();
    private final Map<String, String> codeByController = new HashMap<>();

    public synchronized Pair create(WebSocketSession display, String playerTone) {
        remove(display);
        String code = nextCode();
        Pair pair = new Pair(code, normalizeTone(playerTone), display, null);
        byCode.put(code, pair);
        codeByDisplay.put(display.getId(), code);
        return pair;
    }

    public synchronized Pair join(WebSocketSession controller, String rawCode) {
        remove(controller);
        String code = normalizeCode(rawCode);
        Pair current = byCode.get(code);
        if (current == null || current.display() == null || !current.display().isOpen()) {
            throw new IllegalArgumentException("controller_pair_not_found");
        }
        if (current.controller() != null && current.controller().isOpen()) {
            throw new IllegalStateException("controller_pair_full");
        }
        Pair joined = new Pair(code, current.playerTone(), current.display(), controller);
        byCode.put(code, joined);
        codeByController.put(controller.getId(), code);
        return joined;
    }

    public synchronized Pair pairOfDisplay(WebSocketSession display) {
        String code = codeByDisplay.get(display.getId());
        return code == null ? null : byCode.get(code);
    }

    public synchronized Pair pairOfController(WebSocketSession controller) {
        String code = codeByController.get(controller.getId());
        return code == null ? null : byCode.get(code);
    }

    public synchronized Removal remove(WebSocketSession session) {
        String displayCode = codeByDisplay.remove(session.getId());
        if (displayCode != null) {
            Pair removed = byCode.remove(displayCode);
            if (removed != null && removed.controller() != null) {
                codeByController.remove(removed.controller().getId());
            }
            return removed == null ? null : new Removal(removed, true);
        }

        String controllerCode = codeByController.remove(session.getId());
        if (controllerCode == null) return null;
        Pair current = byCode.get(controllerCode);
        if (current == null) return null;
        Pair detached = new Pair(current.code(), current.playerTone(), current.display(), null);
        byCode.put(controllerCode, detached);
        return new Removal(current, false);
    }

    private String nextCode() {
        String code;
        do {
            StringBuilder candidate = new StringBuilder(CODE_LENGTH);
            for (int index = 0; index < CODE_LENGTH; index++) {
                candidate.append(CODE_ALPHABET[random.nextInt(CODE_ALPHABET.length)]);
            }
            code = candidate.toString();
        } while (byCode.containsKey(code));
        return code;
    }

    private static String normalizeCode(String rawCode) {
        if (rawCode == null) return "";
        return rawCode.trim().toUpperCase(Locale.ROOT);
    }

    private static String normalizeTone(String playerTone) {
        return "red".equalsIgnoreCase(playerTone) ? "red" : "blue";
    }
}
