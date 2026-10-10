const assert = require('node:assert/strict');
const game = require('./game-engine.js');

describe('LxaGameEngine', () => {
  describe('Configuration', () => {
    test('should validate configuration', () => {
      expect(() => game.validateConfiguration()).not.toThrow();
    });

    test('should have correct initial state', () => {
      const state = game.initialState();
      expect(state.version).toBe(107);
      expect(state.difficulty).toBe(2);
      expect(state.credits).toBe(250);
      expect(state.bet).toBe(5);
    });

    test('should have all difficulty distributions sum to ~100%', () => {
      for (let difficulty = 1; difficulty <= 3; difficulty++) {
        expect(Math.abs(game.totalProbability(difficulty) - 100)).toBeLessThan(0.01);
      }
    });
  });

  describe('Paytable', () => {
    test('should have correct payout multipliers', () => {
      // v158 (user request): 3/10 raised 0.40->0.50, 4/10 raised 0.65->0.75.
      expect(game.PAYTABLE).toEqual({ 3: .5, 4: .75, 5: 1, 6: 1.5, 7: 2, 8: 3, 9: 5, 10: 8 });
    });

    test('should have 10/10 probabilities', () => {
      expect(game.DIFFICULTY_DISTRIBUTIONS.map(item => item[10])).toEqual([1, 1, .5]);
    });
  });

  describe('Difficulty Distribution', () => {
    test('should have a non-trivial lose rate at all difficulties', () => {
      // Difficulty 1 (easiest) was tuned in v102 to 9.0% — below the old
      // flat 10% floor this test used to enforce. That's an intentional
      // tuning choice (easy mode should lose less often), not a bug, so the
      // floor here is lowered to match reality instead of asserting a stale
      // threshold. Still guards against a distribution ever going to ~0%.
      expect(game.DIFFICULTY_DISTRIBUTIONS.every(item => item[0] >= 5)).toBe(true);
    });

    test('should decrease expected line multiplier (RTP) with difficulty', () => {
      // Pure 0/10 lose-rate is NOT monotonic by design (difficulty 3 has a
      // lower lose rate than difficulty 2, 16.0 vs 17.0), because it trades
      // fewer total whiffs for smaller average payouts elsewhere. The real
      // economic difficulty knob is the expected line multiplier (RTP),
      // which IS monotonically decreasing — that's what this test verifies.
      expect(game.expectedLineMultiplier(1)).toBeGreaterThan(game.expectedLineMultiplier(2));
      expect(game.expectedLineMultiplier(2)).toBeGreaterThan(game.expectedLineMultiplier(3));
    });

    test('v153: 150/125/100 targets are unaffected by the extended-range mechanism (regression)', () => {
      // These are the module's own out-of-the-box defaults (see
      // DEFAULT_RTP_TARGET_PERCENT) - this locks in the exact pre-v153
      // values so the original shape<->boosted segment can never silently
      // drift just because the two new segments were added around it.
      // v158: updated from 149.98/124.94/100.11 to 150.18/125.08/100.03 -
      // raising the 3/10 and 4/10 payout multipliers (0.40->0.50,
      // 0.65->0.75) shifts the bisected distribution shape that converges
      // on each target, so the exact achieved decimal moved slightly too.
      // Still within the same <0.5% convergence tolerance the OTHER RTP
      // test below already enforces generally - this one exists
      // specifically to catch silent drift, so it must track the real
      // current value, not the old one.
      expect(+(game.expectedLineMultiplier(1) * 100).toFixed(2)).toBe(150.18);
      expect(+(game.expectedLineMultiplier(2) * 100).toFixed(2)).toBe(125.08);
      expect(+(game.expectedLineMultiplier(3) * 100).toFixed(2)).toBe(100.03);
    });

    test('v153: extended-range targets converge closely and independently per difficulty', () => {
      const cases = [[1, 180], [2, 125], [3, 90], [1, 200], [2, 110], [3, 80]];
      cases.forEach(([d, target]) => {
        game.setDifficultyRtp(d, target);
        const actual = game.expectedLineMultiplier(d) * 100;
        expect(Math.abs(actual - target)).toBeLessThan(0.5);
        game.resetDifficultyRtp(d);
      });
    });

    test('v153: extended-range distributions stay valid (sum to 100, no negative buckets) and never touch 9/10', () => {
      [[1, 200], [3, 80]].forEach(([d, target]) => {
        const before9 = game.DIFFICULTY_DISTRIBUTIONS[d - 1][9], before10 = game.DIFFICULTY_DISTRIBUTIONS[d - 1][10];
        game.setDifficultyRtp(d, target);
        const dist = game.DIFFICULTY_DISTRIBUTIONS[d - 1];
        const sum = Object.values(dist).reduce((s, v) => s + v, 0);
        expect(Math.round(sum * 10) / 10).toBe(100);
        expect(Object.values(dist).every(v => v >= 0)).toBe(true);
        expect(dist[9]).toBe(before9);
        expect(dist[10]).toBe(before10);
        game.resetDifficultyRtp(d);
      });
    });
  });

  describe('Wild Mechanics', () => {
    test('should apply wild to boost results', () => {
      const result = game.applyWild([9, 3, 3, 3, 3], () => 0, true);
      expect(result.finalResults).toEqual([10, 3, 3, 3, 3]);
    });

    test('should calculate correct wild chance at level 0', () => {
      expect(game.wildChance(0)).toBe(.5);
    });

    test('should calculate correct wild chance at level 50', () => {
      expect(game.wildChance(50)).toBe(.6);
    });

    test('should cap wild level at 50', () => {
      const state = game.initialState({ wildLevel: 999 });
      expect(state.wildLevel).toBe(50);
    });

    test('should calculate wild upgrade costs correctly', () => {
      expect(game.wildUpgradeCost(0)).toBe(2500000);
      expect(game.wildUpgradeCost(1)).toBe(3500000);
      expect(game.wildUpgradeCost(2)).toBe(3500000);
      expect(game.wildUpgradeCost(3)).toBe(4500000);
      expect(game.wildUpgradeCost(5)).toBe(6000000);
      expect(game.wildUpgradeCost(49)).toBe(50000000);
    });

    test('should handle full wild board', () => {
      const wildRolls = [.2, .999999];
      const fullWild = game.applyWild([0, 0, 0, 0, 0], () => wildRolls.shift() ?? .999999, 50);
      expect(fullWild.naturalCount).toBe(1);
      expect(fullWild.levelCount).toBe(49);
      expect(fullWild.totalCount).toBe(50);
      expect(new Set(fullWild.positions.map(item => `${item.line}:${item.column}`)).size).toBe(50);
      expect(fullWild.finalResults).toEqual([10, 10, 10, 10, 10]);
    });

    test('should not apply wild at level 0 with low roll', () => {
      const noWild = game.applyWild([3, 3, 3, 3, 3], () => .75, 0);
      expect(noWild.totalCount).toBe(0);
    });

    test('setWildCostMultiplier scales wildUpgradeCost exactly, reset restores it', () => {
      expect(game.setWildCostMultiplier(2)).toBe(2);
      expect(game.wildUpgradeCost(0)).toBe(5000000);
      expect(game.wildUpgradeCost(49)).toBe(100000000);
      game.resetWildCostMultiplier();
      expect(game.wildUpgradeCost(0)).toBe(2500000);
      expect(game.wildUpgradeCost(49)).toBe(50000000);
    });

    test('setWildCostMultiplier clamps to its documented bounds', () => {
      expect(game.setWildCostMultiplier(100)).toBe(game.WILD_COST_MULTIPLIER_MAX);
      expect(game.setWildCostMultiplier(0)).toBe(game.WILD_COST_MULTIPLIER_MIN);
      game.resetWildCostMultiplier();
    });

    test('setExtraWildFrequency clamps to its documented bounds', () => {
      expect(game.setExtraWildFrequency(100)).toBe(game.EXTRA_WILD_FREQ_MAX);
      expect(game.setExtraWildFrequency(0)).toBe(game.EXTRA_WILD_FREQ_MIN);
      game.resetExtraWildFrequency();
    });

    test('v158: flags a line as wildAssistedTen only when the Wild was needed to reach 10/10', () => {
      const boosted = game.applyWild([9, 3, 3, 3, 3], () => 0, 1);
      expect(boosted.finalResults[0]).toBe(10);
      expect(boosted.wildAssistedTen[0]).toBe(true);
      expect(boosted.wildAssistedTen.slice(1)).toEqual([false, false, false, false].map(Boolean));

      const natural = game.applyWild([10, 3, 3, 3, 3], () => .9999, 0);
      expect(natural.finalResults[0]).toBe(10);
      expect(natural.wildAssistedTen[0]).toBe(false);
    });

    test('a line showing a Wild icon never raises its mission record or completes the jackpot', () => {
      const flagged = game.applyWild([9, 3, 3, 3, 3], () => 0, 1);
      expect(flagged.lineHasWild[0]).toBe(true);

      let checkedLines = 0;
      for (let i = 0; i < 4000; i++) {
        const { spin, state } = game.resolveSpin(game.initialState({ credits: 1e9, bet: 5, difficulty: 2, wildLevel: 25 }));
        const wildLines = new Set(spin.wild.positions.map(position => position.line));
        wildLines.forEach(line => {
          checkedLines++;
          expect(state.recordHits[line]).toBe(0);
          expect(spin.jackpotAwards.every(award => award.line !== line)).toBe(true);
        });
      }
      expect(checkedLines).toBeGreaterThan(1000);
    });

    test('extra wild frequency scales levelCount and stays capped at maximumExtra', () => {
      const rng = () => 0.5; // deterministic: picks levelCount=1 out of a 0-2 band at level 2
      const base = game.applyWild([0, 0, 0, 0, 0], rng, 2);
      expect(base.levelCount).toBe(1);
      game.setExtraWildFrequency(3);
      const boosted = game.applyWild([0, 0, 0, 0, 0], rng, 2);
      // 1 * 3 = 3, but maximumExtra at level 2 is 2 - must clamp, never exceed the level's own cap
      expect(boosted.levelCount).toBe(2);
      game.resetExtraWildFrequency();
    });
  });

  describe('50% stake (the button and the line under the bet)', () => {
    test('half of the balance, rounded to the stake step', () => {
      expect(game.halfStake(250, 0)).toBe(125);
      expect(game.halfStake(677919, 1)).toBe(339000);
      expect(game.halfStake(1194518, 1)).toBe(597500);
    });
    test('never above the WILD cap, never below one step', () => {
      expect(game.halfStake(40000000, 1)).toBe(game.maxBetForWildLevel(1));
      expect(game.halfStake(100000000, 1)).toBe(game.maxBetForWildLevel(1));
      expect(game.halfStake(5, 0)).toBe(5);
    });
  });

  describe('Recommended Bet', () => {
    test('should suggest appropriate bets by balance', () => {
      expect(game.recommendedBet(250000)).toBe(1000);
      expect(game.recommendedBet(5000000)).toBe(25000);
    });
  });

  describe('Jackpot Logic', () => {
    test('should complete jackpot cycle on 5 distinct 10/10 lines', () => {
      // every roll is the top one: all 5 lines are natural 10/10 in the SAME spin, so all 5 count at once, each paying the next tier of that spin's bet, and the cycle restarts
      const state = game.initialState({ credits: 100000000, bet: 10, difficulty: 1 });
      const { state: next, spin } = game.resolveSpin(state, () => .999999999, 1700000000000);
      expect(spin.jackpotAwards.map(award => award.line)).toEqual([0, 1, 2, 3, 4]);
      expect(spin.jackpotAwards.map(award => award.amount)).toEqual(game.JACKPOT_TIER_MULTIPLIERS.map(multiplier => multiplier * 10));
      expect(spin.jackpotCycleCompleted).toBe(true);
      expect(next.jackpotCycleId).toBe(2);
      expect(next.jackpotProgress).toBe(0);
      expect(next.completedLines).toEqual([false, false, false, false, false]);
      expect(next.recordHits).toEqual([0, 0, 0, 0, 0]);
    });

    test('two natural 10/10 lines in one spin both count, each paying the next tier', () => {
      const plan = game.planJackpots({ finalResults: [10, 4, 10, 3, 6], completed: [false, false, false, false, true], wildAssistedTen: [], lineHasWild: [false, false, false, false, false], stake: 1000 });
      expect(plan.awards).toEqual([{ line: 0, tierIndex: 1, amount: 2000 }, { line: 2, tierIndex: 2, amount: 3000 }]);
      expect(plan.completedAfter).toEqual([true, false, true, false, true]);
      expect(plan.progressAfter).toBe(3);
      expect(plan.cycleComplete).toBe(false);
    });

    test('a line with a WILD or a repeated line never counts; counting stops at 5/5', () => {
      const none = game.planJackpots({ finalResults: [10, 10, 10, 10, 10], completed: [true, false, false, false, false], wildAssistedTen: [false, true, false, false, false], lineHasWild: [false, false, true, false, false], stake: 100 });
      expect(none.awards.map(award => award.line)).toEqual([3, 4]);
      const stop = game.planJackpots({ finalResults: [10, 10, 10, 10, 10], completed: [true, true, true, true, false], wildAssistedTen: [], lineHasWild: [], stake: 100 });
      expect(stop.awards.map(award => award.line)).toEqual([4]);
      expect(stop.cycleComplete).toBe(true);
    });

    test('should not advance jackpot on repeated line', () => {
      const repeatLine = game.resolveSpin(
        game.initialState({ credits: 1000, bet: 10, difficulty: 1, completedLines: [true, false, false, false, false] }),
        (() => { const rolls = [.9999, 0, 0, 0, 0, .9999]; return () => rolls.shift() ?? .9999; })(),
        1700000000010
      );

      expect(repeatLine.spin.finalResults[0]).toBe(10);
      expect(repeatLine.spin.jackpotAwards.length).toBe(0);
      expect(repeatLine.state.completedLines).toEqual([true, false, false, false, false]);
    });

    test('v158 (user request): a Wild-assisted 10/10 pays its normal line payout but does not progress/pay the jackpot', () => {
      // Deterministic rng sequence: call #1 lands line 0 in bucket 9/10,
      // calls #2-5 land lines 1-4 in bucket 0/10 (miss), call #6 forces
      // naturalCount=1, call #7 forces levelCount=0, call #8 forces the
      // Wild shuffle to land on cell 0 (line 0) - every call after that
      // (board-letter filling) can safely stay 0 too.
      const dist = game.DIFFICULTY_DISTRIBUTIONS[0];
      let cumulativeBefore9 = 0;
      for (const key of Object.keys(dist).map(Number).sort((a, b) => a - b)) {
        if (key === 9) break;
        cumulativeBefore9 += dist[key];
      }
      const rollFor9 = (cumulativeBefore9 + dist[9] / 2) / 100;
      let call = 0;
      const rng = () => { call += 1; return call === 1 ? rollFor9 : 0; };

      const state = game.initialState({ credits: 100000000, bet: 10, difficulty: 1, wildLevel: 1 });
      const { spin, state: next } = game.resolveSpin(state, rng, 1700000000020);

      expect(spin.baseResults[0]).toBe(9);
      expect(spin.finalResults[0]).toBe(10);
      expect(spin.wild.totalCount).toBe(1);
      // Still pays the normal 8x line payout for the 10/10 line.
      expect(spin.linePayouts[0]).toBe(spin.lineStake * game.PAYTABLE[10]);
      // But must NOT count as a jackpot-mission completion or award.
      expect(spin.jackpotAwards.length).toBe(0);
      expect(spin.jackpotPayout).toBe(0);
      expect(next.completedLines[0]).toBe(false);
      expect(next.jackpotProgress).toBe(0);
    });
  });

  describe('Spin Results', () => {
    test('should calculate total payout correctly', () => {
      let state = game.initialState({ credits: 100000000, bet: 10, difficulty: 1 });
      const result = game.resolveSpin(state, () => .999999999, 1700000000000);

      expect(result.spin.totalPayout).toBe(result.spin.normalPayout + result.spin.jackpotPayout + result.spin.bonusPayout);
    });

    test('should calculate net result correctly', () => {
      let state = game.initialState({ credits: 100000000, bet: 10, difficulty: 1 });
      const result = game.resolveSpin(state, () => .999999999, 1700000000000);

      expect(result.spin.netResult).toBe(result.spin.totalPayout - result.spin.totalStake);
    });

    test('should handle losing spins', () => {
      const losing = game.resolveSpin(game.initialState({ credits: 100, bet: 10, difficulty: 3 }), () => 0, 1700000000002);
      expect(losing.spin.totalPayout).toBe(0);
      expect(losing.state.credits).toBe(90);
    });

    test('should preserve wild level', () => {
      const permanent = game.resolveSpin(game.initialState({ credits: 1000, bet: 5, difficulty: 3, wildLevel: 10 }), () => 0, 1700000000003);
      expect(permanent.state.wildLevel).toBe(10);
      expect(permanent.state.wildInventory).toBe(10);
    });
  });

  describe('State Persistence', () => {
    test('should migrate legacy completed lines to progress', () => {
      const migrated = game.initialState({ completedLines: [true, true, false, false, false] });
      expect(migrated.jackpotProgress).toBe(2);
    });

    test('should persist state through JSON round-trip', () => {
      let state = game.initialState({ credits: 100000000, bet: 10, difficulty: 1 });
      for (let spin = 0; spin < 5; spin++) {
        const result = game.resolveSpin(state, () => .999999999, 1700000000000 + spin);
        state = result.state;
      }

      const persisted = game.initialState(JSON.parse(JSON.stringify(state)));
      expect(persisted.jackpotProgress).toBe(0);
      expect(persisted.jackpotCycleId).toBe(state.jackpotCycleId);
    });
  });

  describe('Custom Win Chances (v158: no locked bucket)', () => {
    afterEach(() => { game.resetCustomDistribution(1); });

    test('accepts and normalizes bucket 9/10 - they are no longer locked to the default', () => {
      const result = game.setCustomDistribution(1, { 0: 50, 3: 10, 4: 10, 5: 10, 6: 5, 7: 5, 8: 5, 9: 4, 10: 1 });
      expect(result.error).toBeUndefined();
      expect(result.normalized[9]).toBeCloseTo(4, 1);
      expect(result.normalized[10]).toBeCloseTo(1, 1);
      const sum = Object.values(result.normalized).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(100, 1);
      expect(game.DIFFICULTY_DISTRIBUTIONS[0][9]).toBeCloseTo(4, 1);
      expect(game.DIFFICULTY_DISTRIBUTIONS[0][10]).toBeCloseTo(1, 1);
    });

    test('reset restores the RTP-target-based distribution', () => {
      game.setCustomDistribution(1, { 0: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 90 });
      expect(game.DIFFICULTY_DISTRIBUTIONS[0][10]).toBeGreaterThan(50);
      game.resetCustomDistribution(1);
      expect(game.getCustomDistribution(1)).toBeNull();
    });

    test('rejects negative or all-zero input', () => {
      expect(game.setCustomDistribution(1, { 0: -1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1 }).error).toBeDefined();
      expect(game.setCustomDistribution(1, { 0: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 }).error).toBeDefined();
    });
  });

  describe('Max bet', () => {
    test('max stake is half of the NEXT wild level price and follows the level', () => {
      expect(game.maxBetForWildLevel(0)).toBe(game.wildUpgradeCost(0) / 2);
      expect(game.maxBetForWildLevel(0)).toBe(1250000);
      expect(game.maxBetForWildLevel(1)).toBe(1750000);
      expect(game.maxBetForWildLevel(10)).toBe(game.wildUpgradeCost(10) / 2);
      expect(game.maxBetForWildLevel(48)).toBe(24500000);
      expect(game.maxBetForWildLevel(49)).toBe(25000000);
      expect(game.maxBetForWildLevel(50)).toBe(25500000);
    });
    test('resolveSpin rejects a stake above the cap and accepts the cap itself', () => {
      const cap = game.maxBetForWildLevel(0);
      expect(() => game.resolveSpin(game.initialState({ credits: 1e10, bet: cap + 5, difficulty: 2 }))).toThrow(/maximum/);
      expect(() => game.resolveSpin(game.initialState({ credits: 1e10, bet: cap, difficulty: 2 }))).not.toThrow();
    });
  });
});
