/* LXA v130 game engine – the only source for game maths. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LxaGameEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LINE_COUNT = 5;
  const COLUMN_COUNT = 10;
  const WILD = '__BONUS_WILD__';
  // Natural Wild has a fixed 50% chance per spin; permanent levels add 0.2
  // percentage points each. The level still controls the possible Wild count.
  // 1 percentage point per permanent level. Layer 2 independently adds a
  // uniform random number of extra Wilds from 0 to the current level.
  // Even at level 50 the Wild remains probabilistic: the chance tops out at
  // 60%, while a rare high-count event can still reach 50 Wild symbols.
  // v148: every knob below (WILD chance/scaling, paytable, jackpot tier
  // value, jackpot frequency, wild cap) is now admin-adjustable, same
  // pattern as v142's RTP knob - a frozen DEFAULT_* backup, a live mutable
  // value everything else reads through closure, and setX/resetX/getX
  // functions. Nothing here is exposed as raw per-bucket editing (the user
  // explicitly didn't want a screen full of percentages) - each concept is
  // one dial (a percent or a multiplier).
  const DEFAULT_NATURAL_WILD_CHANCE = 0.50;
  const WILD_LEVEL_MAX = 50;
  const DEFAULT_WILD_CHANCE_PER_LEVEL = 0.002;
  let NATURAL_WILD_CHANCE = DEFAULT_NATURAL_WILD_CHANCE;
  let WILD_CHANCE_PER_LEVEL = DEFAULT_WILD_CHANCE_PER_LEVEL;
  function setWildChancePercent(percent) { NATURAL_WILD_CHANCE = Math.max(0, Math.min(100, Number(percent) || 0)) / 100; return NATURAL_WILD_CHANCE * 100; }
  function resetWildChancePercent() { NATURAL_WILD_CHANCE = DEFAULT_NATURAL_WILD_CHANCE; }
  const getDefaultWildChancePercent = () => DEFAULT_NATURAL_WILD_CHANCE * 100;
  // Per-level scaling is capped at 5% (not 100%) as an input sanity bound -
  // wildChance() below already caps the TOTAL at 100% regardless, this just
  // keeps a single admin keystroke from being able to hit that ceiling by level 1.
  function setWildPerLevelPercent(percent) { WILD_CHANCE_PER_LEVEL = Math.max(0, Math.min(5, Number(percent) || 0)) / 100; return WILD_CHANCE_PER_LEVEL * 100; }
  function resetWildPerLevelPercent() { WILD_CHANCE_PER_LEVEL = DEFAULT_WILD_CHANCE_PER_LEVEL; }
  const getDefaultWildPerLevelPercent = () => DEFAULT_WILD_CHANCE_PER_LEVEL * 100;

  // v152 BUG FIX: `Number(x) || fallback` treats a real, explicit 0 as
  // "missing" (0 is falsy in JS) and silently replaces it with the
  // fallback instead of clamping it - caught by a jest test on the two new
  // WILD multipliers below, then found to already affect payoutMultiplier/
  // jackpotValueMultiplier too (same copy-pasted pattern, pre-existing).
  // This helper only substitutes the fallback for genuinely invalid input
  // (NaN/undefined/non-numeric), so an explicit 0 still clamps normally.
  const safeMultiplier = (value, fallback) => { const n = Number(value); return Number.isFinite(n) ? n : fallback; };
  // v158 (user request): 3/10 raised 0.40->0.50, 4/10 raised 0.65->0.75 -
  // this was already a latent UI/engine mismatch before this edit: the
  // static payout display text in index.html (.payout-card-row/.payout-row)
  // already showed "× 0,50"/"× 0,75" for 3/10 and 4/10, but this constant
  // (the actual single source of truth every payout calculation reads from,
  // client and server) was still 0.40/0.65 - the displayed paytable was
  // lying about the real payout. Now they match. 5/10 through 10/10 were
  // already correct and are unchanged.
  const DEFAULT_PAYTABLE = Object.freeze({ 3: 0.50, 4: 0.75, 5: 1.00, 6: 1.50, 7: 2.00, 8: 3.00, 9: 5.00, 10: 8.00 });
  let payoutMultiplier = 1;
  let PAYTABLE = { ...DEFAULT_PAYTABLE };
  const PAYOUT_MULTIPLIER_MIN = 0.2, PAYOUT_MULTIPLIER_MAX = 5;
  function setPayoutMultiplier(multiplier) {
    payoutMultiplier = Math.max(PAYOUT_MULTIPLIER_MIN, Math.min(PAYOUT_MULTIPLIER_MAX, safeMultiplier(multiplier, 1)));
    PAYTABLE = Object.fromEntries(Object.entries(DEFAULT_PAYTABLE).map(([hits, value]) => [hits, Math.round(value * payoutMultiplier * 100) / 100]));
    return payoutMultiplier;
  }
  function resetPayoutMultiplier() { setPayoutMultiplier(1); }
  const getPayoutMultiplier = () => payoutMultiplier;

  // v135: jackpot tiers are a multiple of the CURRENT bet, not a fixed sum.
  // A 5€ bet and a 25.000€ bet both pay a jackpot proportional to what was
  // risked; this is what keeps RTP sane at every bet size instead of only at
  // the bet size the fixed euro amounts happened to be tuned for.
  const DEFAULT_JACKPOT_TIER_MULTIPLIERS = Object.freeze([1, 2, 3, 4, 5]);
  let jackpotValueMultiplier = 1;
  let JACKPOT_TIER_MULTIPLIERS = [...DEFAULT_JACKPOT_TIER_MULTIPLIERS];
  const JACKPOT_VALUE_MULTIPLIER_MIN = 0.2, JACKPOT_VALUE_MULTIPLIER_MAX = 10;
  function setJackpotValueMultiplier(multiplier) {
    jackpotValueMultiplier = Math.max(JACKPOT_VALUE_MULTIPLIER_MIN, Math.min(JACKPOT_VALUE_MULTIPLIER_MAX, safeMultiplier(multiplier, 1)));
    JACKPOT_TIER_MULTIPLIERS = DEFAULT_JACKPOT_TIER_MULTIPLIERS.map(value => Math.round(value * jackpotValueMultiplier * 100) / 100);
    return jackpotValueMultiplier;
  }
  function resetJackpotValueMultiplier() { setJackpotValueMultiplier(1); }
  const getJackpotValueMultiplier = () => jackpotValueMultiplier;

  // v135: only this many Wild symbols on a line count toward the *normal*
  // paytable payout, no matter how many actually landed (natural + level
  // Wilds combined can still be up to 50). Every landed Wild still counts in
  // full toward completing a line to 10/10 for jackpot purposes below --
  // this cap only stops Wild from also inflating the ordinary per-spin win.
  const DEFAULT_PAYTABLE_WILD_CAP = 1;
  let PAYTABLE_WILD_CAP = DEFAULT_PAYTABLE_WILD_CAP;
  function setWildCap(count) { PAYTABLE_WILD_CAP = Math.max(1, Math.min(COLUMN_COUNT, Math.round(Number(count) || 1))); return PAYTABLE_WILD_CAP; }
  function resetWildCap() { PAYTABLE_WILD_CAP = DEFAULT_PAYTABLE_WILD_CAP; }

  // v141 chance ladder (2026-09-29, user request): RTP raised across all three
  // tiers - SWEET ~122%, SPICY ~107%, BRUTAL ~97% expected line multiplier
  // (previously ~103.3/88.85/85.3%). Mass was moved out of 0/10 (miss) and
  // 3/10 (lowest paying bucket, 0.40x) into 5/10-8/10. 9/10 and 10/10 were
  // deliberately left UNCHANGED from the v102 ladder on every tier, so
  // jackpot-mission pacing (which only advances on a fresh 10/10 line) is
  // unaffected by this RTP change - only the ordinary per-spin payout grew.
  // 0/10–2/10 are losing results; the established 3/10–10/10 paytable stays intact.
  const DEFAULT_DIFFICULTY_DISTRIBUTIONS = Object.freeze([
    Object.freeze({ 0: 7.8, 1: 0, 2: 0, 3: 22.7, 4: 20.7, 5: 16.5, 6: 12.1, 7: 8.8, 8: 6.4, 9: 4.0, 10: 1.0 }),
    Object.freeze({ 0: 13.5, 1: 0, 2: 0, 3: 22.2, 4: 19.3, 5: 16.4, 6: 11.6, 7: 8.3, 8: 5.7, 9: 2.0, 10: 1.0 }),
    Object.freeze({ 0: 13.9, 1: 0, 2: 0, 3: 23.8, 4: 20.7, 5: 16.0, 6: 11.2, 7: 7.6, 8: 4.8, 9: 1.5, 10: 0.5 })
  ]);
  // v152 (user request): out-of-the-box TARGET RTP per difficulty, applied
  // automatically through the same admin buildDistributionForRtp() blend
  // below (no separate mechanism) - so it's a real starting point, not a
  // hardcoded ceiling: an admin can still move any difficulty up or down
  // from here at any time via the RTP panel, same as always. Verified
  // achievable via direct simulation before setting these (not assumed):
  // difficulty 1 converges to ~149.98% for a 150 target, difficulty 2 to
  // ~124.94% for 125, difficulty 3 to ~100.11% for 100 - all within ~0.1pp.
  // NOTE (found while verifying, see project memory for detail): the
  // current blend only interpolates between the DEFAULT shape above and a
  // fixed "boosted" shape, so each difficulty has a real achievable
  // ceiling/floor narrower than the 50-300% input clamp suggests -
  // difficulty 1 tops out around ~154%, difficulty 3 bottoms out around
  // ~97% (its DEFAULT shape IS the floor, nothing pushes it lower). A
  // requested target outside that range converges to whichever end is
  // closest, not the literal number typed in. 150/125/100 all sit safely
  // inside every difficulty's real range; more extreme targets (e.g. a
  // ~180% or ~90% ask) would need the blend extended with a third shape
  // and were not built here - flag before assuming they're reachable.
  const DEFAULT_RTP_TARGET_PERCENT = [150, 125, 100];
  // v142: admin-adjustable RTP (2026-09-29, user request) — a live, mutable
  // copy of the defaults above. Only setDifficultyRtp/resetDifficultyRtp
  // ever replace an entry; everything else (distributionFor, spins already
  // in flight) just reads whatever is currently here. Starts equal to the
  // defaults so behavior is unchanged until an admin actually sets something.
  let activeDifficultyDistributions = DEFAULT_DIFFICULTY_DISTRIBUTIONS.map(d => ({ ...d }));

  const clampDifficulty = value => Math.min(3, Math.max(1, Number(value) || 2));
  const distributionFor = difficulty => activeDifficultyDistributions[clampDifficulty(difficulty) - 1];
  const totalProbability = difficulty => Object.values(distributionFor(difficulty)).reduce((sum, value) => sum + value, 0);
  const expectedLineMultiplier = difficulty => Object.entries(distributionFor(difficulty)).reduce((sum, [hits, probability]) => sum + (probability / 100) * (PAYTABLE[hits] || 0), 0);
  const RTP_MIN_PERCENT = 50, RTP_MAX_PERCENT = 300;
  // Rebuilds one difficulty's bucket distribution to hit `targetRtpPercent`,
  // starting from that difficulty's DEFAULT shape (never the currently-active
  // one, so repeated admin edits stay predictable instead of compounding).
  // 9/10 and 10/10 are always kept at their default values - jackpot-mission
  // pacing must never change just because someone retunes ordinary RTP (see
  // the v141 comment above). The rest of the mass is blended between the
  // default shape and a "boosted" shape (weight moved out of 0/10 and 3/10,
  // the lowest-paying bucket, into 5/10-8/10) via one scalar t, solved by
  // bisection so the result lands on the exact requested percentage.
  // v154 (supersedes v153's fixed-alpha version - user explicitly rejected
  // pre-calibrating per-target constants as "if target===200" thinking).
  // GENERAL, continuous, per-difficulty-independent RTP calibration.
  // Architecture: SUPPRESSED <-> SHAPE <-> BOOSTED <-> SUPERBOOSTED.
  // The middle segment (SHAPE<->BOOSTED) is the ORIGINAL mechanism,
  // mathematically untouched - same shapes, same bisection - reached for
  // any target inside [rtp(shape), rtp(boosted)]. For a target outside
  // that range, SUPPRESSED/SUPERBOOSTED are NOT fixed pre-built shapes -
  // they are computed live, per call, by bisecting DIRECTLY between the
  // relevant boundary (shape or boosted) and a universal extreme reference
  // (EXTREME_LOW/EXTREME_HIGH) for whatever target was actually requested.
  // This makes calibration a pure function of (difficulty, target) with NO
  // stored per-target constants anywhere - changing a target from 180 to
  // 250 needs zero code changes, same as changing it from 180 to 179.
  // EXTREME_LOW/HIGH are universal fractions of a difficulty's free mass
  // (same shape-skew for every difficulty, exactly like `boosted` already
  // is) - deliberately moderate, not maximally concentrated (the
  // theoretical single-bucket extreme would be ~11.5%/~313% for DULCE,
  // but dumping all free mass into one bucket would spike volatility far
  // more than any tested target actually needs - see VOLATILITY CONTROL
  // in project memory). These ARE the hard outer bound of what this
  // mechanism can reach; a target beyond rtp(EXTREME_HIGH) or below
  // rtp(EXTREME_LOW) clamps there and is reported, not forced further.
  // Buckets 9 and 10 are NEVER touched by either (jackpot pacing stays
  // exactly as designed, same guarantee as the original blend).
  const EXTREME_HIGH_FRACTIONS = { 0: 0.01, 3: 0.02, 4: 0.04, 5: 0.08, 6: 0.15, 7: 0.25, 8: 0.45 };
  const EXTREME_LOW_FRACTIONS = { 0: 0.35, 3: 0.35, 4: 0.15, 5: 0.08, 6: 0.04, 7: 0.02, 8: 0.01 };
  const rtpOf = d => Object.entries(d).reduce((sum, [hits, p]) => sum + (p / 100) * (PAYTABLE[hits] || 0), 0) * 100;
  // Shared bisection: identical logic/shape to the pre-v153 inline version
  // (same clamp-at-endpoint checks, same 60 iterations), just parametrized
  // by which two shapes to blend between, so every segment (including the
  // untouched middle one) goes through the exact same math.
  function bisectBlend(from, to, fixed, target) {
    const blend = t => { const out = {}; for (const key of Object.keys(from)) out[key] = (1 - t) * from[key] + t * to[key]; return { ...out, ...fixed }; };
    if (target <= rtpOf(blend(0))) return blend(0);
    if (target >= rtpOf(blend(1))) return blend(1);
    let lo = 0, hi = 1;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (rtpOf(blend(mid)) < target) lo = mid; else hi = mid;
    }
    return blend((lo + hi) / 2);
  }
  // Reports the real achievable range for a difficulty, split into the
  // range reachable without leaving the original shape<->boosted segment
  // and the full extended range (out to EXTREME_LOW/HIGH). Exported so
  // callers (admin UI, diagnostics) can check realizability BEFORE setting
  // a target, instead of discovering a silent clamp after the fact.
  function rtpRangeForDifficulty(difficultyIndex) {
    const base = DEFAULT_DIFFICULTY_DISTRIBUTIONS[difficultyIndex];
    const fixed = { 9: base[9], 10: base[10] }, freeMass = 100 - fixed[9] - fixed[10];
    const shape = { 0: base[0], 3: base[3], 4: base[4], 5: base[5], 6: base[6], 7: base[7], 8: base[8] };
    const boosted = { 0: 0.06 * freeMass, 3: 0.10 * freeMass, 4: 0.16 * freeMass, 5: 0.20 * freeMass, 6: 0.20 * freeMass, 7: 0.16 * freeMass, 8: 0.12 * freeMass };
    const extremeLow = {}, extremeHigh = {};
    for (const key of Object.keys(shape)) { extremeLow[key] = EXTREME_LOW_FRACTIONS[key] * freeMass; extremeHigh[key] = EXTREME_HIGH_FRACTIONS[key] * freeMass; }
    return {
      originalMin: rtpOf({ ...shape, ...fixed }), originalMax: rtpOf({ ...boosted, ...fixed }),
      extendedMin: rtpOf({ ...extremeLow, ...fixed }), extendedMax: rtpOf({ ...extremeHigh, ...fixed })
    };
  }
  function buildDistributionForRtp(difficultyIndex, targetRtpPercent) {
    const base = DEFAULT_DIFFICULTY_DISTRIBUTIONS[difficultyIndex];
    const fixed = { 9: base[9], 10: base[10] };
    const freeMass = 100 - fixed[9] - fixed[10];
    const boosted = { 0: 0.06 * freeMass, 3: 0.10 * freeMass, 4: 0.16 * freeMass, 5: 0.20 * freeMass, 6: 0.20 * freeMass, 7: 0.16 * freeMass, 8: 0.12 * freeMass };
    const shape = { 0: base[0], 3: base[3], 4: base[4], 5: base[5], 6: base[6], 7: base[7], 8: base[8] };
    const target = Math.max(RTP_MIN_PERCENT, Math.min(RTP_MAX_PERCENT, Number(targetRtpPercent) || 0));
    const rtpShape = rtpOf({ ...shape, ...fixed }), rtpBoosted = rtpOf({ ...boosted, ...fixed });
    if (target < rtpShape) {
      const extremeLow = {}; for (const key of Object.keys(shape)) extremeLow[key] = EXTREME_LOW_FRACTIONS[key] * freeMass;
      // bisectBlend assumes rtp(from) <= rtp(to) (increasing in t, same as
      // the original shape->boosted direction) - extremeLow has LOWER rtp
      // than shape, so the pair must be passed low-to-high (extremeLow,
      // shape), not (shape, extremeLow), or its two early-return clamp
      // checks fire backwards and every below-floor target silently
      // collapses to rtpShape instead of actually going lower. Caught by
      // the jest convergence test (BRUTAL@80/90 both returned 96.875%).
      return roundToHundred(bisectBlend(extremeLow, shape, fixed, target));
    }
    if (target > rtpBoosted) {
      const extremeHigh = {}; for (const key of Object.keys(shape)) extremeHigh[key] = EXTREME_HIGH_FRACTIONS[key] * freeMass;
      return roundToHundred(bisectBlend(boosted, extremeHigh, fixed, target));
    }
    // Original shape<->boosted segment - untouched math, see comment above.
    return roundToHundred(bisectBlend(shape, boosted, fixed, target));
  }
  // Rounds every bucket to 1 decimal (matching the hand-tuned defaults'
  // precision), then patches any rounding residue into bucket 5 (the middle
  // of the curve, furthest from the fixed 9/10-10/10 buckets) so the whole
  // distribution still sums to exactly 100 - validateConfiguration() requires it.
  function roundToHundred(distribution) {
    const rounded = {};
    for (const key of Object.keys(distribution)) rounded[key] = Math.round(distribution[key] * 10) / 10;
    const sumNow = Object.values(rounded).reduce((a, b) => a + b, 0);
    rounded[5] = Math.round((rounded[5] + (100 - sumNow)) * 10) / 10;
    return rounded;
  }
  // v148: RTP target and jackpot-frequency multiplier are now two
  // INDEPENDENT stored knobs per difficulty (not just "whatever the active
  // distribution currently is"), each rebuilt from scratch by
  // recomputeDistribution() below. This makes the two admin controls
  // order-independent - setting jackpot frequency then RTP (or the reverse)
  // always lands on the same result, instead of the second call silently
  // discarding whatever the first one did to the same 9/10-10/10 buckets.
  let difficultyRtpTarget = [...DEFAULT_RTP_TARGET_PERCENT];
  let difficultyJackpotFreq = [1, 1, 1];
  // v156 (user request): explicit per-bucket override, independent of the
  // RTP-target bisection above. null (default) means "use the RTP target
  // as before, nothing changes here". When an admin sets one, it takes
  // PRECEDENCE over difficultyRtpTarget for that difficulty - this is the
  // one deterministic precedence rule in this module (custom distribution,
  // if present, wins; otherwise RTP target is authoritative), not two
  // competing sources fighting at runtime.
  // v158 (user request): ALL buckets including 9/10 are admin-editable here
  // (no fixed/locked bucket) - jackpotFreq below still applies on top as an
  // independent additional multiplier if an admin also sets one.
  let customDistribution = [null, null, null];
  // Pure: the distribution a difficulty WOULD have for a given line-RTP target (custom distribution still wins, jackpot frequency applied).
  function computeDistribution(index, lineTarget) {
    let dist = customDistribution[index]
      ? { ...customDistribution[index] }
      : buildDistributionForRtp(index, lineTarget);
    const freq = difficultyJackpotFreq[index];
    if (freq !== 1) {
      // Sanity caps (30%/20%) stop an extreme multiplier combined with an
      // already-high base from eating the entire distribution - the mid
      // tiers (0,3-8) always keep at least 10% of the mass between them.
      const nine = Math.min(30, dist[9] * freq);
      const ten = Math.min(20, dist[10] * freq);
      const freeMassOld = 100 - dist[9] - dist[10];
      const freeMassNew = Math.max(10, 100 - nine - ten);
      const scale = freeMassNew / freeMassOld;
      const scaled = { 9: nine, 10: ten };
      for (const key of [0, 3, 4, 5, 6, 7, 8]) scaled[key] = dist[key] * scale;
      dist = scaled;
    }
    return roundToHundred(dist);
  }
  function recomputeDistribution(index) { activeDifficultyDistributions[index] = computeDistribution(index, difficultyRtpTarget[index]); }
  // Apply the initial 150/125/100 targets immediately at module load, so
  // the very first spin (before any admin ever opens the RTP panel) is
  // already on-target - not left on the raw DEFAULT_DIFFICULTY_DISTRIBUTIONS
  // shape (which converges to a different RTP) until someone saves a value.
  [0, 1, 2].forEach(recomputeDistribution);
  function setDifficultyRtp(difficulty, targetRtpPercent) {
    const index = clampDifficulty(difficulty) - 1;
    difficultyRtpTarget[index] = Math.max(RTP_MIN_PERCENT, Math.min(RTP_MAX_PERCENT, Number(targetRtpPercent) || 0));
    recomputeDistribution(index);
    validateConfiguration();
    return expectedLineMultiplier(difficulty) * 100;
  }
  function resetDifficultyRtp(difficulty) {
    const index = clampDifficulty(difficulty) - 1;
    difficultyRtpTarget[index] = DEFAULT_RTP_TARGET_PERCENT[index];
    recomputeDistribution(index);
  }
  function resetAllDifficultyRtp() { [1, 2, 3].forEach(resetDifficultyRtp); }
  // v156/v158: sets an explicit per-bucket distribution for ALL buckets
  // (0,3-10; 0/10 is the miss bucket, 9/10 included - no locked bucket).
  // Auto-normalizes any non-negative input proportionally to 100 instead
  // of rejecting imperfect input - matches roundToHundred's existing
  // "patch residue, never leave an invalid distribution" philosophy
  // elsewhere in this file. Returns the normalized values actually
  // applied, or an { error } if the input itself was unusable
  // (negative/non-numeric/all-zero).
  function setCustomDistribution(difficulty, buckets) {
    const index = clampDifficulty(difficulty) - 1;
    const keys = [0, 3, 4, 5, 6, 7, 8, 9, 10];
    const raw = {};
    let rawSum = 0;
    for (const key of keys) {
      const value = Number(buckets ? buckets[key] : undefined);
      if (!Number.isFinite(value) || value < 0) return { error: `Invalid value for bucket ${key}/10.` };
      raw[key] = value; rawSum += value;
    }
    if (rawSum <= 0) return { error: 'Buckets cannot all be zero.' };
    const scale = 100 / rawSum;
    const normalized = {};
    for (const key of keys) normalized[key] = Math.round(raw[key] * scale * 10) / 10;
    customDistribution[index] = normalized;
    recomputeDistribution(index);
    validateConfiguration();
    return { ok: true, normalized };
  }
  function resetCustomDistribution(difficulty) {
    const index = clampDifficulty(difficulty) - 1;
    customDistribution[index] = null;
    recomputeDistribution(index);
  }
  function resetAllCustomDistribution() { [1, 2, 3].forEach(resetCustomDistribution); }
  function getCustomDistribution(difficulty) { return customDistribution[clampDifficulty(difficulty) - 1]; }
  const JACKPOT_FREQ_MIN = 0.2, JACKPOT_FREQ_MAX = 5;
  function setJackpotFrequency(difficulty, multiplier) {
    const index = clampDifficulty(difficulty) - 1;
    difficultyJackpotFreq[index] = Math.max(JACKPOT_FREQ_MIN, Math.min(JACKPOT_FREQ_MAX, Number(multiplier) || 1));
    recomputeDistribution(index);
    validateConfiguration();
    return difficultyJackpotFreq[index];
  }
  function resetJackpotFrequency(difficulty) {
    const index = clampDifficulty(difficulty) - 1;
    difficultyJackpotFreq[index] = 1;
    recomputeDistribution(index);
  }
  function resetAllJackpotFrequency() { [1, 2, 3].forEach(resetJackpotFrequency); }
  const getJackpotFrequency = difficulty => difficultyJackpotFreq[clampDifficulty(difficulty) - 1];
  // v152: this used to derive a "default" from the raw DEFAULT_DIFFICULTY_
  // DISTRIBUTIONS shape's own implied RTP (~122/107/97%) - now that there's
  // a real configured initial TARGET (150/125/100), the admin panel's
  // "default" placeholder should show that target, not the old shape's
  // incidental RTP.
  const getDefaultRtpPercent = difficulty => DEFAULT_RTP_TARGET_PERCENT[clampDifficulty(difficulty) - 1];
  // Money has CENT precision, exactly like the server's money(): no payout is rounded to a whole euro, so the return is the same at every stake
  // (the old whole-euro rounding paid guests up to ~18 points more at a 5 stake: 181.6 / 156.5 / 129.5 instead of 163.2 / 136.7 / 107.6).
  const cents = value => Math.round((Number(value) || 0) * 100) / 100;
  const recommendedBet = credits => Number(credits) >= 5000000 ? 25000 : Number(credits) >= 1000000 ? 5000 : Number(credits) >= 250000 ? 1000 : 5;
  // v152: two more admin-adjustable WILD knobs, same one-dial-per-concept
  // pattern as everything else here. wildUpgradeCost's ladder shape and
  // wildChance's natural-chance formula stay exactly as they were; each
  // multiplier only scales their OUTPUT, so resetting to ×1 always restores
  // the original numbers untouched.
  const DEFAULT_WILD_COST_MULTIPLIER = 1;
  let WILD_COST_MULTIPLIER = DEFAULT_WILD_COST_MULTIPLIER;
  const WILD_COST_MULTIPLIER_MIN = 0.2, WILD_COST_MULTIPLIER_MAX = 5;
  function setWildCostMultiplier(multiplier) { WILD_COST_MULTIPLIER = Math.max(WILD_COST_MULTIPLIER_MIN, Math.min(WILD_COST_MULTIPLIER_MAX, safeMultiplier(multiplier, 1))); return WILD_COST_MULTIPLIER; }
  function resetWildCostMultiplier() { WILD_COST_MULTIPLIER = DEFAULT_WILD_COST_MULTIPLIER; }
  // Continuous permanent Wild Bonus price ladder. Level ×1 starts at €2.5m;
  // ×2–×3 cost €3.5m, ×4–×5 cost €4.5m; from ×6 onward, each level costs
  // its value in millions, ending at €50m for ×50.
  const wildUpgradeCost = currentLevel => {
    const nextLevel = Math.max(1, Math.min(WILD_LEVEL_MAX, Math.floor(Number(currentLevel) || 0) + 1));
    const base = nextLevel === 1 ? 2500000 : nextLevel <= 3 ? 3500000 : nextLevel <= 5 ? 4500000 : nextLevel * 1000000;
    return Math.round(base * WILD_COST_MULTIPLIER);
  };
  // Highest allowed stake: half of what the NEXT Wild level costs (follows the admin cost multiplier). The
  // jackpot tiers pay a multiple of the stake, so an uncapped stake would turn money into a multiplier.
  // At the top level (50) there is no next level to buy, so the ladder simply continues: level 51 would cost
  // 51m, giving 25.5m (24.5m at WILD 48, 25m at WILD 49) instead of repeating the previous value.
  const maxBetForWildLevel = level => {
    const owned = Math.max(0, Math.floor(Number(level) || 0));
    const nextPrice = owned >= WILD_LEVEL_MAX ? Math.round((owned + 1) * 1000000 * WILD_COST_MULTIPLIER) : wildUpgradeCost(owned);
    return Math.max(5, Math.floor(nextPrice / 2));
  };
  // The 50% button: half of the balance, rounded to the stake step of that balance and never above the WILD cap. The line under the bet shows exactly this value.
  const stakeStep = balance => Number(balance) >= 5000000 ? 10000 : Number(balance) >= 1000000 ? 2500 : Number(balance) >= 250000 ? 500 : 5;
  const halfStake = (credits, level) => {
    const balance = Math.max(0, Number(credits) || 0), step = stakeStep(balance), cap = maxBetForWildLevel(level);
    return Math.min(cap, Math.max(step, Math.min(Math.max(step, balance), Math.round(balance * 0.5 / step) * step)));
  };
  const wildChance = level => Math.min(1, NATURAL_WILD_CHANCE + Math.max(0, Math.min(WILD_LEVEL_MAX, Number(level) || 0)) * WILD_CHANCE_PER_LEVEL);
  // v152: applyWild() (functions/lxa-account.js) draws the "level"-source
  // extra-Wild count from a fixed 78%/20%/2% band distribution capped by the
  // player's Wild level - that shape itself isn't exposed (would mean a
  // screen full of percentages), but its OUTPUT is scaled by this single
  // multiplier before being re-capped to the player's level, same "multiply
  // the result, don't hand-edit the distribution" pattern as jackpotFreq.
  const DEFAULT_EXTRA_WILD_FREQUENCY = 1;
  let EXTRA_WILD_FREQUENCY = DEFAULT_EXTRA_WILD_FREQUENCY;
  const EXTRA_WILD_FREQ_MIN = 0.2, EXTRA_WILD_FREQ_MAX = 5;
  function setExtraWildFrequency(multiplier) { EXTRA_WILD_FREQUENCY = Math.max(EXTRA_WILD_FREQ_MIN, Math.min(EXTRA_WILD_FREQ_MAX, safeMultiplier(multiplier, 1))); return EXTRA_WILD_FREQUENCY; }
  function resetExtraWildFrequency() { EXTRA_WILD_FREQUENCY = DEFAULT_EXTRA_WILD_FREQUENCY; }
  function validateConfiguration() {
    activeDifficultyDistributions.forEach((distribution, index) => {
      // Published percentages are rounded to three decimals; allow that final
      // 0.001 rounding residue while rejecting any meaningful imbalance.
      if (Math.abs(totalProbability(index + 1) - 100) > 0.01) throw new Error(`Difficulty ${index + 1} does not total 100%.`);
    });
    return true;
  }

  // ===================== TOTAL RTP: lines + WILD + jackpot, computed exactly =====================
  // The admin RTP target fixes only the LINE return (expectedLineMultiplier). WILD substitution and the jackpot pay on top of it
  // (about +7..12 points for a player without WILD levels). expectedTotalRtp() computes the real long-run return of one stake
  // for a player at a given WILD level, from the SAME rules resolveSpin/applyWild use (line buckets, WILD count law, paytable and
  // WILD cap, jackpot tiers and the cycle of 5 different lines), so the "connected" admin mode can solve for a TOTAL target
  // without simulating. Verified against seeded simulations in rtp-linked.test.js. Large-stake model: the per-line integer
  // rounding (cents()) in resolveSpin is ignored, so very small stakes pay slightly more than the figure.
  const BINOMIAL = (() => { const t = [[1]]; for (let n = 1; n <= 50; n++) { t[n] = [1]; for (let k = 1; k <= n; k++) t[n][k] = (t[n - 1][k - 1] || 0) + (t[n - 1][k] || 0); } return t; })();
  const choose = (n, k) => (n < 0 || k < 0 || k > n ? 0 : BINOMIAL[n][k]);
  // P(total WILD count = w) for a player at `level`: natural WILD (Bernoulli) plus the level extras (78% / 20% / 2% bands, scaled by the extra-WILD frequency).
  function wildCountDistribution(level) {
    const lv = Math.max(0, Math.min(WILD_LEVEL_MAX, Math.floor(Number(level) || 0)));
    const chance = wildChance(lv), out = new Array(COLUMN_COUNT * LINE_COUNT + 1).fill(0);
    for (const [natural, pNatural] of [[0, 1 - chance], [1, chance]]) {
      if (pNatural <= 0) continue;
      const maxExtra = Math.min(lv, COLUMN_COUNT * LINE_COUNT - natural), extra = new Map();
      const add = (count, p) => extra.set(count, (extra.get(count) || 0) + p);
      const band = (low, high, p) => { const n = high - low + 1; for (let k = low; k <= high; k++) add(k, p / n); };
      if (maxExtra <= 0) add(0, 1);
      else if (maxExtra <= 2) band(0, maxExtra, 1);
      else { band(0, Math.min(2, maxExtra), 0.78); band(3, Math.min(8, maxExtra), 0.20); band(Math.min(9, maxExtra), maxExtra, 0.02); }
      for (const [count, p] of extra) out[natural + Math.max(0, Math.min(maxExtra, Math.round(count * EXTRA_WILD_FREQUENCY)))] += pNatural * p;
    }
    return out;
  }
  function expectedTotalRtpFor(distribution, level) {
    const cells = COLUMN_COUNT * LINE_COUNT, pW = wildCountDistribution(level), probs = {};
    for (let hits = 0; hits <= COLUMN_COUNT; hits++) probs[hits] = (Number(distribution[hits]) || 0) / 100;
    // normal line payout per unit stake = expected paytable value of ONE line (5 lines x stake/5)
    let normal = 0;
    for (let w = 0; w <= cells; w++) {
      if (!pW[w]) continue;
      const all = choose(cells, w); let perLine = 0;
      for (let x = 0; x <= Math.min(COLUMN_COUNT, w); x++) {
        const px = choose(COLUMN_COUNT, x) * choose(cells - COLUMN_COUNT, w - x) / all;
        if (!px) continue;
        const bonus = Math.min(x, PAYTABLE_WILD_CAP); let value = 0;
        for (let hits = 0; hits <= COLUMN_COUNT; hits++) if (probs[hits]) value += probs[hits] * (PAYTABLE[Math.min(COLUMN_COUNT, hits + bonus)] || 0);
        perLine += px * value;
      }
      normal += pW[w] * perLine;
    }
    // jackpot: a spin pays tier[k] x stake when one of the (5-k) still-open lines is a natural 10/10 with no WILD on it. One tier per spin,
    // so a cycle of 5 awards takes sum(1/a_k) spins; a_k = P(award | k lines done) by inclusion-exclusion over WILD-free lines.
    const p10 = probs[COLUMN_COUNT]; let cycleSpins = 0, cycleAward = 0;
    for (let k = 0; k < LINE_COUNT; k++) {
      const open = LINE_COUNT - k; let none = 0;
      for (let w = 0; w <= cells; w++) {
        if (!pW[w]) continue;
        const all = choose(cells, w); let acc = 0;
        for (let j = 0; j <= open; j++) acc += choose(open, j) * Math.pow(-p10, j) * (choose(cells - COLUMN_COUNT * j, w) / all);
        none += pW[w] * acc;
      }
      const award = 1 - none;
      cycleSpins += award > 1e-12 ? 1 / award : Infinity; cycleAward += Number(JACKPOT_TIER_MULTIPLIERS[k]) || 0;
    }
    const jackpot = Number.isFinite(cycleSpins) && cycleSpins > 0 ? cycleAward / cycleSpins : 0;
    return (normal + jackpot) * 100;
  }
  const expectedTotalRtp = (difficulty, wildLevel = 0) => expectedTotalRtpFor(distributionFor(difficulty), wildLevel);
  // CONNECTED RTP: the admin value is the TOTAL return (lines + WILD + jackpot) for a player at `wildLevel`; the line target is solved so the
  // total lands on it (bisection, exact model, no simulation). A custom win-chance table keeps its precedence (skipped). A target outside
  // what the line buckets can reach is clamped and reported.
  function setDifficultyTotalRtp(difficulty, totalTargetPercent, wildLevel = 0) {
    const index = clampDifficulty(difficulty) - 1;
    if (customDistribution[index]) return { skipped: 'custom', lineTarget: difficultyRtpTarget[index], lineRtp: expectedLineMultiplier(difficulty) * 100, totalRtp: expectedTotalRtp(difficulty, wildLevel), clamped: false };
    const target = Math.max(RTP_MIN_PERCENT, Math.min(RTP_MAX_PERCENT, Number(totalTargetPercent) || 0));
    const totalAt = line => expectedTotalRtpFor(computeDistribution(index, line), wildLevel);
    let lo = RTP_MIN_PERCENT, hi = RTP_MAX_PERCENT, line, clamped = false;
    const atLo = totalAt(lo), atHi = totalAt(hi);
    if (target <= atLo) { line = lo; clamped = target < atLo - 0.05; }
    else if (target >= atHi) { line = hi; clamped = target > atHi + 0.05; }
    else { for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (totalAt(mid) < target) lo = mid; else hi = mid; } line = (lo + hi) / 2; }
    difficultyRtpTarget[index] = line; recomputeDistribution(index); validateConfiguration();
    return { lineTarget: Math.round(line * 1000) / 1000, lineRtp: expectedLineMultiplier(difficulty) * 100, totalRtp: expectedTotalRtp(difficulty, wildLevel), clamped };
  }
  // ONE place that turns the stored admin settings into engine state. The server (before every spin / settings read) and the browser (guest
  // mirror) both call it, so they cannot drift apart. Deterministic: the result depends only on `settings`, never on what a previous call left
  // behind (the payout multiplier is reset first because the line targets are calibrated against the standard paytable).
  function applyAdminSettings(settings) {
    const s = settings && typeof settings === 'object' ? settings : {};
    const has = v => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v));
    const pick = (obj, d) => (obj ? (obj[d] ?? obj[String(d)]) : undefined);
    resetPayoutMultiplier();
    [1, 2, 3].forEach(d => { const raw = pick(s, d); if (has(raw)) setDifficultyRtp(d, Number(raw)); else resetDifficultyRtp(d); });
    [1, 2, 3].forEach(d => { const buckets = pick(s.customDistribution, d); if (buckets) setCustomDistribution(d, buckets); else resetCustomDistribution(d); });
    [1, 2, 3].forEach(d => { const raw = pick(s.jackpotFreq, d); if (has(raw)) setJackpotFrequency(d, Number(raw)); else resetJackpotFrequency(d); });
    if (has(s.wildChance)) setWildChancePercent(Number(s.wildChance)); else resetWildChancePercent();
    if (has(s.wildPerLevel)) setWildPerLevelPercent(Number(s.wildPerLevel)); else resetWildPerLevelPercent();
    if (has(s.wildCap)) setWildCap(Number(s.wildCap)); else resetWildCap();
    if (has(s.wildCostMult)) setWildCostMultiplier(Number(s.wildCostMult)); else resetWildCostMultiplier();
    if (has(s.extraWildFreq)) setExtraWildFrequency(Number(s.extraWildFreq)); else resetExtraWildFrequency();
    if (has(s.payoutMult)) setPayoutMultiplier(Number(s.payoutMult)); else resetPayoutMultiplier();
    if (has(s.jackpotValueMult)) setJackpotValueMultiplier(Number(s.jackpotValueMult)); else resetJackpotValueMultiplier();
    const linked = s.rtpLinked === true || s.rtpLinked === 'true';
    const refLevel = Math.max(0, Math.min(WILD_LEVEL_MAX, Math.round(Number(s.rtpRefLevel) || 0)));
    // connected mode runs LAST, after every knob it depends on is final
    if (linked) [1, 2, 3].forEach(d => { const raw = pick(s, d); setDifficultyTotalRtp(d, has(raw) ? Number(raw) : getDefaultRtpPercent(d), refLevel); });
    return { linked, refLevel };
  }

  function selectLineResult(difficulty, rng = Math.random) {
    const roll = rng() * 100;
    let cursor = 0;
    for (const hits of Object.keys(distributionFor(difficulty)).map(Number).sort((a, b) => a - b)) {
      cursor += distributionFor(difficulty)[hits];
      if (roll < cursor || hits === 10) return hits;
    }
    return 10;
  }

  function makeBoard(finalResults, wildPositions, rng = Math.random) {
    const letters = 'LEONXOXANA'.split('');
    const alternatives = [...new Set(letters)];
    const board = Array.from({ length: LINE_COUNT }, (_, row) => Array.from({ length: COLUMN_COUNT }, (_, column) => {
      if (column < finalResults[row]) return letters[column];
      const options = alternatives.filter(letter => letter !== letters[column]);
      return options[Math.floor(rng() * options.length)];
    }));
    wildPositions.forEach(({ line, column }) => { board[line][column] = WILD; });
    return board;
  }

  function applyWild(baseResults, rng = Math.random, level = 0) {
    const wildLevel = Math.max(0, Math.min(WILD_LEVEL_MAX, Number(level) || 0));
    const chance = wildChance(wildLevel);
    const naturalCount = rng() < chance ? 1 : 0;
    // When Layer 1 has fired, the final 50-cell level has 0–49 extras, so
    // totals at level 50 are truly uniform from 1 through 50 (never 51).
    const maximumExtra = Math.min(wildLevel, COLUMN_COUNT * LINE_COUNT - naturalCount);
    // Keep the ×50 ceiling, but avoid the old uniform 0..level distribution:
    // most spins receive a small boost, medium boosts are occasional, and a
    // large 16..50 Wild hit remains a rare high-volatility event.
    let levelCount = 0;
    if (maximumExtra > 0) {
      const roll = rng();
      const pick = (low, high) => low + Math.floor(rng() * (high - low + 1));
      if (maximumExtra <= 2) levelCount = pick(0, maximumExtra);
      else if (roll < 0.78) levelCount = pick(0, Math.min(2, maximumExtra));
      else if (roll < 0.98) levelCount = pick(3, Math.min(8, maximumExtra));
      else levelCount = pick(Math.min(9, maximumExtra), maximumExtra);
    }
    levelCount = Math.max(0, Math.min(maximumExtra, Math.round(levelCount * EXTRA_WILD_FREQUENCY)));
    const totalCount = naturalCount + levelCount;
    const cells = Array.from({ length: LINE_COUNT * COLUMN_COUNT }, (_, index) => ({ line: Math.floor(index / COLUMN_COUNT), column: index % COLUMN_COUNT }));
    const positions = [];
    for (let index = 0; index < totalCount; index++) {
      const swapIndex = index + Math.floor(rng() * (cells.length - index));
      [cells[index], cells[swapIndex]] = [cells[swapIndex], cells[index]];
      positions.push({ ...cells[index], source: index === 0 && naturalCount ? 'natural' : 'level' });
    }
    // Every selected Wild substitutes the missing letter on its line before
    // payout/jackpot resolution. Positions remain unique across all 50 cells.
    const wildsPerLine = Array.from({ length: LINE_COUNT }, () => 0);
    positions.forEach(position => { wildsPerLine[position.line]++; });
    const finalResults = baseResults.map((hits, line) => Math.min(COLUMN_COUNT, hits + wildsPerLine[line]));
    // v135: paytableResults caps the Wild contribution for normal payout
    // purposes (see PAYTABLE_WILD_CAP above). finalResults above is left
    // untouched and stays the one used for jackpot-line completion.
    const paytableResults = baseResults.map((hits, line) => Math.min(COLUMN_COUNT, hits + Math.min(wildsPerLine[line], PAYTABLE_WILD_CAP)));
    // v158 (user request): a line that only reaches 10/10 because a Wild
    // substituted in (i.e. it would be below 10 on its natural symbols
    // alone) still pays its normal 10/10 line payout via paytableResults
    // above, but must NOT count as a jackpot-mission completion or award
    // the jackpot bonus - that stays reserved for a genuinely natural
    // (non-Wild) 10/10. See resolveSpin()/lxa-account.js jackpotLine.
    const wildAssistedTen = baseResults.map((hits, line) => hits < COLUMN_COUNT && finalResults[line] === COLUMN_COUNT);
    // A line that shows a Wild icon is excluded from the jackpot mission
    // altogether: it may still pay normally, but it can neither complete the
    // jackpot (5/5) nor raise that line's mission record.
    const lineHasWild = wildsPerLine.map(count => count > 0);
    return { finalResults, paytableResults, positions, chance, naturalCount, levelCount, totalCount, wildAssistedTen, lineHasWild };
  }

  function initialState(seed = {}) {
    const savedCompletedLines = Array.isArray(seed.completedLines)
      ? Array.from({ length: LINE_COUNT }, (_, index) => Boolean(seed.completedLines[index]))
      : null;
    const legacyProgress = Math.max(0, Math.min(LINE_COUNT, Number(seed.jackpotProgress) || 0));
    const completedLines = savedCompletedLines || Array.from({ length: LINE_COUNT }, (_, index) => index < legacyProgress);
    return {
      version: 107,
      credits: cents(seed.credits ?? 250),
      bank: cents(seed.bank ?? 0),
      wildLevel: Math.max(0, Math.min(WILD_LEVEL_MAX, Number(seed.wildLevel ?? seed.wildInventory) || 0)),
      // Compatibility alias for older saved UI data; this is no longer a consumable inventory.
      wildInventory: Math.max(0, Math.min(WILD_LEVEL_MAX, Number(seed.wildLevel ?? seed.wildInventory) || 0)),
      bet: cents(seed.bet ?? recommendedBet(seed.credits ?? 250)),
      difficulty: clampDifficulty(seed.difficulty ?? 2),
      round: Math.max(1, Number(seed.round) || 1),
      spinSequence: Math.max(0, Number(seed.spinSequence) || 0),
      jackpotCycleId: Math.max(1, Number(seed.jackpotCycleId) || 1),
      // Keep the actual completed line identities. Old meter-only saves use
      // their existing count as the first completed lines for compatibility.
      jackpotProgress: completedLines.filter(Boolean).length,
      jackpotFinished: false,
      completedLines,
      recordHits: Array.from({ length: LINE_COUNT }, (_, index) => Math.max(0, Math.min(10, Number(seed.recordHits?.[index]) || 0))),
      lastWin: cents(seed.lastWin ?? 0),
      lastSpin: seed.lastSpin || null,
      spinHistory: Array.isArray(seed.spinHistory) ? seed.spinHistory.slice(0, 50) : []
    };
  }

  // The jackpot lines of one spin. `completed` = the lines already done in this cycle. A line counts when it is a NATURAL 10/10 (no WILD on it, not WILD-assisted) and not done yet; the lines are taken in order,
  // each pays the tier of the progress it reaches (tier index = lines done before it), and the counting stops at 5/5 (the cycle restarts, the rest of the spin is not carried over).
  function planJackpots({ finalResults, completed, wildAssistedTen, lineHasWild, stake }) {
    const done = Array.from({ length: LINE_COUNT }, (_, index) => Boolean(completed && completed[index])), awards = [];
    let progress = done.filter(Boolean).length;
    for (let line = 0; line < LINE_COUNT && progress < LINE_COUNT; line++) {
      if (finalResults[line] === COLUMN_COUNT && !done[line] && !(wildAssistedTen && wildAssistedTen[line]) && !(lineHasWild && lineHasWild[line])) {
        awards.push({ line, tierIndex: progress, amount: cents(JACKPOT_TIER_MULTIPLIERS[progress] * stake) });
        done[line] = true; progress++;
      }
    }
    return { awards, completedAfter: done, progressAfter: progress, cycleComplete: awards.length > 0 && done.every(Boolean) };
  }
  function resolveSpin(rawState, rng = Math.random, now = Date.now()) {
    const state = initialState(rawState);
    if (state.credits < state.bet) throw new Error('Insufficient credits.');
    if (state.bet > maxBetForWildLevel(state.wildLevel)) throw new Error('Bet exceeds the maximum for this WILD level.');
    const totalStake = cents(state.bet);
    const lineStake = cents(totalStake / LINE_COUNT);
    const baseResults = Array.from({ length: LINE_COUNT }, () => selectLineResult(state.difficulty, rng));
    const wild = applyWild(baseResults, rng, state.wildLevel);
    const finalResults = wild.finalResults;
    const linePayouts = wild.paytableResults.map(hits => cents(lineStake * (PAYTABLE[hits] || 0)));
    const normalPayout = cents(linePayouts.reduce((sum, value) => sum + value, 0));
    const jackpotProgressBefore = state.jackpotProgress;
    // Jackpot progression requires a new line in this cycle. A repeated 10/10
    // still receives its normal payout but cannot pay another jackpot tier.
    // v158 (user request): a Wild-assisted 10/10 (see applyWild's
    // wildAssistedTen) also still receives its normal payout but never
    // counts toward the jackpot mission or its bonus - only a natural
    // (no-Wild) 10/10 can progress/complete the jackpot.
    // v160 (user request): EVERY new natural 10/10 line of the spin counts, not only the first one. Each one completes its line and pays the next tier (in line order) of THIS SPIN's bet; the
    // spin stops counting at 5/5 (the cycle restarts). See planJackpots.
    const plan = planJackpots({ finalResults, completed: state.completedLines, wildAssistedTen: wild.wildAssistedTen, lineHasWild: wild.lineHasWild, stake: totalStake });
    const jackpotAwards = plan.awards;
    const jackpotPayout = cents(jackpotAwards.reduce((sum, award) => sum + award.amount, 0));
    const completedAfterAward = plan.completedAfter;
    const reachedFiveOfFive = plan.cycleComplete;
    const progressAfter = plan.progressAfter;
    const persistedCompletedLines = reachedFiveOfFive ? Array(LINE_COUNT).fill(false) : completedAfterAward;
    // V118: line records belong to the current jackpot cycle. When 5/5 is
    // completed all lines are open again, so their records restart at 0/10.
    const recordHits = reachedFiveOfFive ? Array(LINE_COUNT).fill(0) : state.recordHits.map((record, index) => wild.lineHasWild[index] ? record : Math.max(record, finalResults[index]));
    const bonusPayout = 0;
    const totalPayout = cents(normalPayout + jackpotPayout + bonusPayout);
    const netResult = cents(totalPayout - totalStake);
    const spin = {
      id: `V107-${state.jackpotCycleId}-${state.spinSequence + 1}`,
      round: state.round,
      timestamp: new Date(now).toISOString(),
      difficulty: state.difficulty,
      totalStake,
      lineStake,
      baseResults,
      finalResults,
      linePayouts,
      normalPayout,
      wild: { appeared: wild.positions.length > 0, positions: wild.positions, naturalCount: wild.naturalCount, levelCount: wild.levelCount, totalCount: wild.totalCount },
      wildLevel: state.wildLevel,
      wildChance: wild.chance,
      jackpotProgressBefore,
      jackpotProgressAfter: reachedFiveOfFive ? 0 : progressAfter,
      jackpotAwards,
      jackpotPayout,
      jackpotCycleCompleted: reachedFiveOfFive,
      bonusPayout,
      totalPayout,
      netResult,
      board: makeBoard(finalResults, wild.positions, rng)
    };
    const next = initialState({
      ...state,
      credits: cents(state.credits - totalStake + totalPayout),
      wildLevel: state.wildLevel,
      wildInventory: state.wildLevel,
      round: state.round + 1,
      spinSequence: state.spinSequence + 1,
      jackpotCycleId: state.jackpotCycleId + (reachedFiveOfFive ? 1 : 0),
      jackpotProgress: reachedFiveOfFive ? 0 : progressAfter,
      jackpotFinished: false,
      completedLines: persistedCompletedLines,
      recordHits,
      lastWin: totalPayout,
      lastSpin: spin,
      spinHistory: [spin, ...state.spinHistory].slice(0, 50)
    });
    return { state: next, spin };
  }

  function debugReport(logger = console) {
    validateConfiguration();
    const rows = activeDifficultyDistributions.map((distribution, index) => ({
      difficulty: `${index + 1}/3`, ...Object.fromEntries(Object.entries(distribution).map(([hits, value]) => [`${hits}/10`, value])),
      total: totalProbability(index + 1), expectedLineMultiplier: Number(expectedLineMultiplier(index + 1).toFixed(6))
    }));
    logger.table?.(rows);
    return rows;
  }

  validateConfiguration();
  return Object.freeze({
    LINE_COUNT, COLUMN_COUNT, WILD, WILD_LEVEL_MAX,
    // v148: these five used to be plain frozen values here, which would
    // have frozen the EXPORT at whatever they were when the module first
    // loaded - now that admins can change them at runtime, they're getters
    // so every read reflects the current live value, same pattern already
    // used for DIFFICULTY_DISTRIBUTIONS below.
    get NATURAL_WILD_CHANCE() { return NATURAL_WILD_CHANCE; },
    get WILD_CHANCE_PER_LEVEL() { return WILD_CHANCE_PER_LEVEL; },
    get PAYTABLE() { return PAYTABLE; },
    get JACKPOT_TIER_MULTIPLIERS() { return JACKPOT_TIER_MULTIPLIERS; },
    get PAYTABLE_WILD_CAP() { return PAYTABLE_WILD_CAP; },
    get WILD_COST_MULTIPLIER() { return WILD_COST_MULTIPLIER; },
    get EXTRA_WILD_FREQUENCY() { return EXTRA_WILD_FREQUENCY; },
    get DIFFICULTY_DISTRIBUTIONS() { return activeDifficultyDistributions; },
    DEFAULT_DIFFICULTY_DISTRIBUTIONS, DEFAULT_PAYTABLE, DEFAULT_JACKPOT_TIER_MULTIPLIERS, DEFAULT_PAYTABLE_WILD_CAP,
    RTP_MIN_PERCENT, RTP_MAX_PERCENT, JACKPOT_FREQ_MIN, JACKPOT_FREQ_MAX,
    PAYOUT_MULTIPLIER_MIN, PAYOUT_MULTIPLIER_MAX, JACKPOT_VALUE_MULTIPLIER_MIN, JACKPOT_VALUE_MULTIPLIER_MAX,
    WILD_COST_MULTIPLIER_MIN, WILD_COST_MULTIPLIER_MAX, EXTRA_WILD_FREQ_MIN, EXTRA_WILD_FREQ_MAX,
    DEFAULT_WILD_COST_MULTIPLIER, DEFAULT_EXTRA_WILD_FREQUENCY,
    recommendedBet, wildUpgradeCost, maxBetForWildLevel, wildChance, initialState, selectLineResult, applyWild, resolveSpin, planJackpots, stakeStep, halfStake, totalProbability, expectedLineMultiplier,
    setDifficultyRtp, resetDifficultyRtp, resetAllDifficultyRtp, getDefaultRtpPercent, rtpRangeForDifficulty,
    setCustomDistribution, resetCustomDistribution, resetAllCustomDistribution, getCustomDistribution,
    setJackpotFrequency, resetJackpotFrequency, resetAllJackpotFrequency, getJackpotFrequency,
    setWildChancePercent, resetWildChancePercent, getDefaultWildChancePercent,
    setWildPerLevelPercent, resetWildPerLevelPercent, getDefaultWildPerLevelPercent,
    setPayoutMultiplier, resetPayoutMultiplier, getPayoutMultiplier,
    setJackpotValueMultiplier, resetJackpotValueMultiplier, getJackpotValueMultiplier,
    setWildCap, resetWildCap,
    setWildCostMultiplier, resetWildCostMultiplier,
    setExtraWildFrequency, resetExtraWildFrequency,
    debugReport, validateConfiguration,
    expectedTotalRtp, setDifficultyTotalRtp, applyAdminSettings
  });
});
