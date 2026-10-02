# Three-track music and Settings update

Replaces the procedural score with three generated instrumental tracks:
Neon Rush (melodic EDM), Night Drive (driving techno), Acid Chase (acid techno).
Audio controls move from Shop into main-menu Settings, also accessible from Pause.
Track previews stop on exit, mute, app backgrounding, and death. Selection and
independent music/effects levels persist without changing coins or cosmetic ownership.

Each track is bundled as a 60-second, stereo 128 kbps MP3. Combined assets are
approximately 2.9 MB. They are precached for browser offline play and bundled in
native builds. Fetch failures can use a cached response even before the first
service worker takes control. Decoded buffers are released when switching tracks.
Short edge fades reduce clicks; musical loop transitions need listening review.

Generation and processing provenance is in assets/music/PROVENANCE.json.
Provider: ElevenLabs Music, model eleven_music_v2. No artist references or vocals
were requested. Generated once per track and normalized to -18 LUFS / -2 dBTP.

Validation covers playback in Chromium, Firefox, and mobile WebKit, all three
previews offline, persisted preferences, mute, interruption, unchanged coins,
return from Pause, and Settings usability at 320/390 px. Existing effects headroom
render checks remain. Physical iPhone listening and preference review are pending;
browser playback checks do not establish subjective music quality.

Local validation (2026-10-02): npm test passed static validation, backend checks,
and 122 browser tests (one existing skip). Mobile WebKit screenshots were
reviewed at 390x844 and 320x568; the smaller screen scrolls to all controls.
