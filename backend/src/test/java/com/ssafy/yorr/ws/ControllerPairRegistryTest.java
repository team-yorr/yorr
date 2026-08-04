package com.ssafy.yorr.ws;

import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ControllerPairRegistryTest {

    private final ControllerPairRegistry pairs = new ControllerPairRegistry();

    @Test
    void pairsOnePhoneWithoutRegisteringAnotherGameParticipant() {
        WebSocketSession display = openSession("display");
        WebSocketSession controller = openSession("controller");

        ControllerPairRegistry.Pair created = pairs.create(display, "red");
        ControllerPairRegistry.Pair joined = pairs.join(controller, created.code().toLowerCase());

        assertThat(created.code()).matches("[23456789A-HJ-NP-Z]{6}");
        assertThat(joined.playerTone()).isEqualTo("red");
        assertThat(pairs.pairOfDisplay(display).controller()).isSameAs(controller);
        assertThat(pairs.pairOfController(controller).display()).isSameAs(display);
    }

    @Test
    void rejectsASecondPhoneWhileTheFirstOneIsConnected() {
        WebSocketSession display = openSession("display");
        String code = pairs.create(display, "blue").code();
        pairs.join(openSession("controller-a"), code);

        assertThatThrownBy(() -> pairs.join(openSession("controller-b"), code))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("controller_pair_full");
    }

    @Test
    void letsAPhoneReconnectAfterItLeaves() {
        WebSocketSession display = openSession("display");
        WebSocketSession first = openSession("controller-a");
        String code = pairs.create(display, "blue").code();
        pairs.join(first, code);

        ControllerPairRegistry.Removal removal = pairs.remove(first);
        WebSocketSession replacement = openSession("controller-b");
        ControllerPairRegistry.Pair rejoined = pairs.join(replacement, code);

        assertThat(removal.displayLeft()).isFalse();
        assertThat(rejoined.controller()).isSameAs(replacement);
    }

    @Test
    void closesThePairWhenTheDisplayLeaves() {
        WebSocketSession display = openSession("display");
        WebSocketSession controller = openSession("controller");
        String code = pairs.create(display, "blue").code();
        pairs.join(controller, code);

        ControllerPairRegistry.Removal removal = pairs.remove(display);

        assertThat(removal.displayLeft()).isTrue();
        assertThat(pairs.pairOfController(controller)).isNull();
        assertThatThrownBy(() -> pairs.join(openSession("replacement"), code))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static WebSocketSession openSession(String id) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(id);
        when(session.isOpen()).thenReturn(true);
        return session;
    }
}
