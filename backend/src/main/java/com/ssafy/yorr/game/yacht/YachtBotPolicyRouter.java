package com.ssafy.yorr.game.yacht;

import com.ssafy.yorr.game.domain.ScoreBoard;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Primary
@Component
public class YachtBotPolicyRouter implements YachtBotPolicy {

    private final String policyName;
    private final ExpectimaxYachtBotPolicy expectimax;
    private final DistilledYachtBotPolicy distilled;

    public YachtBotPolicyRouter(
            @Value("${yorr.yacht.bot.policy:expectimax}") String policyName,
            ExpectimaxYachtBotPolicy expectimax,
            DistilledYachtBotPolicy distilled
    ) {
        this.policyName = policyName == null ? "expectimax" : policyName.trim().toLowerCase(java.util.Locale.ROOT);
        this.expectimax = expectimax;
        this.distilled = distilled;
    }

    @Override
    public ExpectimaxYachtBotPolicy.BotDecision decide(ScoreBoard board, List<Integer> dice, int rollCount) {
        return switch (policyName) {
            case "distilled" -> distilled.decide(board, dice, rollCount);
            case "expectimax" -> expectimax.decide(board, dice, rollCount);
            default -> expectimax.decide(board, dice, rollCount);
        };
    }

    @Override
    public Map<String, Double> metrics() {
        return switch (policyName) {
            case "distilled" -> distilled.metrics();
            default -> expectimax.metrics();
        };
    }
}
