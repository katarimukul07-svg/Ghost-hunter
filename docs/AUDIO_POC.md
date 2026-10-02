# Adaptive audio POC

## Objective and question
Can a small offline procedural score add identity and round progression without
external audio assets, dependencies, gameplay changes, or interruption leaks?

## Architecture and hypothesis
Use Web Audio, a fixed original 112 BPM A-minor motif, and a 120 ms lookahead.
A triangle bass starts at 110 Hz for a more phone-relevant range than the former
55 Hz drone. Round 5 adds a pulse; round 10 adds octave responses. Intensity
changes do not restart the score. Music and effects have independent saved gain
controls and effects briefly duck music. A master compressor controls overlap;
it is not a guarantee against every possible clipping scenario.

Track every oscillator, disconnect on completion, cap concurrent voices at 48,
and cancel pending notes and tails on pause/menu/background. Death first stops
the score and then schedules its own short stinger. No audio wall-clock effect
callbacks remain. Audio does not consume gameplay randomness.

## Tests and acceptance
- Full npm test: static validation and backend tests passed; 105 browser checks
  passed, one existing desktop-only-inapplicable finger test skipped.
- Focused audio suite after final controls/config edits: 9 passed across desktop
  Chromium, mobile Chromium, and mobile WebKit.
- Real browser score advances and resumes; native background cancels voices;
  death ends music and all its voices finish; mute cancels queued voices.
- Independent gains persist after reload; controls show only in SOUND tab.
- Offline 48 kHz rendering at full effects gain overlaps death, scanner,
  completion, bonus, and prize. Peak sample amplitude: Chromium 0.196172;
  WebKit 0.195323. RMS approximately 0.01662. Audible nonzero output with
  sample headroom for this scenario; these are not LUFS or true-peak readings.
- Security scan: 243 files, 503 history blobs, zero findings.

## Decision and limits
Accept procedural audio as the release-candidate implementation: existing
offline architecture, zero extra assets or runtime requests, bounded scheduling.
Keep scanner, prize, completion, bonus, and death semantically distinct.
Pack selection continues to color prize/completion; scanner uses a softer
triangle to avoid sustained square-wave harshness.

Physical iPhone speaker/headphone audition remains required. Automated renders
do not establish pleasantness, perceived loudness, device bass reproduction,
Bluetooth delay, interruption behavior on a real phone, or long-session fatigue.
Try rounds 1/5/10, rapid pickup+clear+scanner, death/retry, music-only,
effects-only, mute/unmute, and background/resume. Tune levels from that evidence.
Revisit sampled audio only if listening shows this score cannot meet quality.

## Rollback
Revert the adaptive-audio commit as a unit. No database or purchase changes.
