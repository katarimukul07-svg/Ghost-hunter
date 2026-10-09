# Three-track music and Settings update

> **Update (2026-10-09): the ElevenLabs tracks were removed.** Eleven Music's
> terms exclude "Studio Games" (games released on more than one platform) on
> every plan except Enterprise Music, and the free plan also requires
> attribution. Echo Steps ships on iOS and Android, so the three MP3s and
> `assets/music/PROVENANCE.json` were replaced by two CC0 tracks from
> OpenGameArt plus code-generated styles with the old names. See
> `assets/music/LICENSES.md`. The rest of this page is history.

Replaces the procedural score with three generated instrumental tracks:
Echo Run (melodic EDM), Ghost Circuit (techno / breakbeat), Last Exit (acid techno).
Audio controls move from Shop into main-menu Settings, also accessible from Pause.
Track previews stop on exit, mute, app backgrounding, and death. Selection and
independent music/effects levels persist without changing coins or cosmetic ownership.

Each track is bundled as a 90-second, stereo 128 kbps MP3. Combined assets are
approximately 4.3 MB. They are precached for browser offline play and bundled in
native builds. Fetch failures can use a cached response even before the first
service worker takes control. Decoded buffers are released when switching tracks.
Short edge fades reduce clicks; musical loop transitions need listening review.

Generation and processing provenance is in assets/music/PROVENANCE.json.
Provider: ElevenLabs Music, model eleven_music_v2. No artist references or vocals
were requested. Generated once per track and normalized to -18 LUFS / -2 dBTP.

Validation covers playback in desktop/mobile Chromium and mobile WebKit, all three
previews offline, persisted preferences, mute, interruption, unchanged coins,
return from Pause, and Settings usability at 320/390 px. Existing effects headroom
render checks remain. User approved the 90-second previews after listening. Physical iPhone balance and loop checks are pending;
browser playback checks do not establish subjective music quality.

Local validation (2026-10-02): npm test passed static validation, backend checks,
and 122 browser tests (one existing skip). Mobile WebKit screenshots were
reviewed at 390x844 and 320x568; the smaller screen scrolls to all controls.

Linux CI exhausted the original 20-second total budget on two long WebKit
journeys (audio preferences and background purchases). Their individual test
budget is now 60 seconds; assertion timeouts and all behavior checks remain.
