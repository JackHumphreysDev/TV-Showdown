# TV Showdown — Project Specification

**Status:** Product specification; the accompanying repository is a development build, not a production release.

**Platforms:** Responsive web app / installable PWA and native iOS and Android apps targeted for the same first release, subject to an early feasibility checkpoint.

**Launch region and language:** United Kingdom; UK English.
**Product premise:** Let a group stop debating what to watch. Each person has their own account, profile, and watchlist. They join a shared group, select the participating members, spin a wheel to pick a person, then get a random movie or show from that person's list.

## 1. Product decisions and assumptions

- Each person has a separate **account** with one personal profile and watchlist in the MVP. They can create or join multiple **groups**; their profile and watchlist travel with them. A title marked `Watched` is therefore no longer eligible in any of their groups.
- A group owner can invite others with a shareable invite link or a short room code. Joining requires signing in or creating an account and explicitly confirming the group. The owner manages invitations and membership; any active member can run a group spin.
- A spin is **two-stage**: first choose one of the selected profiles, then choose one eligible title from that profile's watchlist. One tap starts both selections; two consecutive animations reveal them.
- Each selected profile has an equal chance of winning, regardless of watchlist size. Within the winning profile's eligible list, each title has an equal chance. The wheel animation displays the already-determined result; it does not determine the result.
- `Want to Watch` movies and series, plus `Watching` series, are eligible for a spin. `Watched` titles are not eligible.
- The product helps people **decide** what to watch and shows legal viewing options for the United Kingdom. It does not stream content itself; availability can change, so the source and freshness of each option must be clear.
- The supplied screenshot is a **visual reference**, not a source of product requirements or reusable artwork. Its dark, cinematic presentation, prominent featured result, poster cards, warm accent color, and bottom navigation can inform the design. Original or properly licensed imagery must be used in the app.

## 2. Goals and success criteria

### User goals

1. Create an account and profile, then add movies or shows to a personal watchlist quickly.
2. Create a group or join one by invite link or room code, then choose which members are participating tonight.
3. Get an understandable, fair pick in a few seconds.
4. See where the pick can be watched, accept it, skip it, or start over.
5. Keep watchlists useful by marking titles watched or removing them.

### Product success measures

- Two people with separate accounts can join the same group, add at least one title each, and complete a first spin without assistance.
- A returning group member can start a spin from the group's home screen in three actions or fewer after opening the app.
- The result clearly names both the winning profile and the selected title.
- The result offers region-appropriate viewing options when available, without presenting stale or unverified links as confirmed availability.
- Users can explain why a profile or title was eligible, and a skipped title is not immediately repeated in that spin session.

## 3. MVP scope

### Must have

- Separate account creation and sign-in for each person; create or rename a personal profile with an optional avatar/color.
- Create a shared group; invite others by link or room code; join, leave, and switch between groups.
- Group owner controls invite generation/revocation and member removal. Active members can view the group's eligible watchlists and run spins; only an account owner can edit their own profile or watchlist.
- One watchlist per profile, with title type (`movie` or `series`), title, optional release year, poster, synopsis, runtime, and genre when metadata is available.
- Search a licensed title catalogue to add an item; provide a manual-entry fallback for missing titles or catalogue outages.
- Prevent the same title from being added twice to one profile's active watchlist. The same title may appear on different profiles' lists.
- Watchlist statuses: `Want to Watch`, `Watching`, and `Watched`. `Want to Watch` movies and series and `Watching` series participate in an MVP spin. `Watched` titles and `Watching` movies do not.
- Choose one or more active group members' profiles for a spin; optionally limit the spin to movies, series, or both.
- Profile wheel, title reveal, result screen, skip-title action, full re-spin action, and explicit `Mark Watched` action.
- **Where to Watch** options for the group's chosen country/region, including service, access type (subscription, free, rental, or purchase) where supplied, source/freshness, and a provider handoff link when available. An unknown or unsupported title gets an honest no-results state.
- Group result history showing profile, title, time, and whether the pick was accepted or skipped; synchronize the current result for group members.
- Responsive web/PWA and native iOS/Android clients using the same core flows and backend; keyboard operation, screen-reader labels, and reduced-motion support appropriate to each platform.

### Later, not required for the MVP

- Availability-based spin filters and personalized streaming-service preferences.
- Collaborative voting, vetoes, weighted odds, mood filters, AI recommendations, and cross-profile title merging.
- Notifications, calendar planning, social sharing, and native-only device features.

## 4. Primary user flow

1. Rachel creates an account and personal profile, adds titles to her watchlist, and creates a group.
2. Rachel shares an invite link or room code. Regis opens the link or enters the code, signs in or creates an account, reviews the group name and members, and confirms joining. He adds titles to his own watchlist.
3. On the group's **Spin** screen, a member selects participating profiles and chooses `Movies`, `Series`, or `Both`.
4. The app shows each selected profile's eligible item count. If any selected profile has zero eligible items under the filter, the app asks the member to invite that person to add an item or deselect the profile before spinning. It never silently changes the odds.
5. A member taps **Spin the Wheel**. The app records an eligibility snapshot, randomly selects a profile, then randomly selects one eligible title from that profile.
6. The profile wheel lands on the selected person, followed by a title-wheel/reel reveal. The group result screen features the title and says, for example, **Rachel's pick**.
7. A member opens **Watch This** to see where the title is currently available in the group's region. They can follow a provider link or save it as tonight's accepted pick. If no reliable option is found, the app says so and still allows saving the pick. Skipping or re-spinning updates the shared group result; provider handoff does not mark the title watched.
8. After watching, the winning profile's owner explicitly marks the title `Watched` on their own list. A skipped title remains on the watchlist.

## 5. Functional behavior

### Accounts, groups, profiles, and watchlists

| ID | Requirement |
| --- | --- |
| G-01 | Each account has one personal profile in the MVP and may belong to multiple groups. A group has one owner and any number of active members; membership has `Owner` or `Member` role. |
| G-02 | The owner may create a shareable invite link or short room code. Both must be unguessable, expire, and be revocable/rotatable. The code-entry screen does not reveal group details until a valid code is supplied. |
| G-03 | Opening a valid invite link or entering a valid room code sends an unauthenticated person to sign-in/sign-up, then returns them to a join confirmation showing the group name and member names. Joining is never automatic. |
| G-04 | Reusing an invite for someone who is already a member opens the group without creating a duplicate membership. Expired, revoked, invalid, and already-full (if a limit is configured) invites show distinct recovery actions. |
| G-05 | The owner can remove a member, and a member can leave. Access to the group's lists, current spin, and history ends immediately. Removing a member also rotates active join secrets so the removed person cannot rejoin using a previously shared code or link. An owner must transfer ownership or delete the group before leaving. |
| G-06 | Any active member may start, skip, re-spin, or accept the group's current spin. Only one spin session can be active for a group at a time; concurrent actions are resolved by the server and synchronized to all members. |
| P-01 | Each account owner can edit only their own profile and watchlist. A profile can be deactivated by its owner; a deactivated profile cannot join new spins but remains available to the owner for recovery. |
| P-02 | Each profile has a display name and optional avatar or color. If names collide in a group, the UI adds a clear distinguishing label; account-wide name uniqueness is not required. |
| P-03 | Group members can view one another's eligible titles (`Want to Watch` movies/series and `Watching` series) and counts. `Watched` titles, `Watching` movies, and private notes are visible only to the profile owner. Joining a group makes eligible titles visible to that group's members. |
| W-01 | An item can be added from catalogue search or entered manually. The app shows whether metadata is supplied by a catalogue or by a user. |
| W-02 | Each item has exactly one status. Status changes are reversible; deleting an item requires confirmation. |
| W-03 | A movie or series is selected as a whole title, not as a particular episode. Episode tracking is out of scope. |
| W-04 | A title's presence on multiple profiles' watchlists is allowed and does not merge those entries. |
| W-05 | `Want to Watch` movies and series and `Watching` series are eligible. `Watched` titles and `Watching` movies are not. Changing a series to `Watching` does not remove it from future spins. |

### Spinning and result handling

| ID | Requirement |
| --- | --- |
| S-01 | A spin requires at least one selected, active profile belonging to a current member of the group and at least one eligible title for **every** selected profile under the chosen type filter. |
| S-02 | For `n` selected profiles, each profile has probability `1/n`. If the chosen profile has `m` eligible titles, each of its titles has conditional probability `1/m`. No hidden popularity, rating, or list-length weighting is applied. |
| S-03 | The server determines and saves the selected profile and title before animation starts. The client animation must land on that saved result. |
| S-04 | The eligible profile and title IDs are snapshotted at spin start. Watchlist edits made during animation affect only later spins. If a selected member leaves or is removed during a spin, cancel the active session and require a fresh spin. |
| S-05 | For a pending result, **Skip Title** excludes that title for the remainder of the current spin session, keeps the same winning profile, and picks uniformly from its remaining eligible titles. It does not change the watchlist. |
| S-06 | If the winning profile has no unskipped eligible titles left, **Skip Title** is disabled and the UI offers **Spin Again** or a prompt for that profile's owner to add titles. |
| S-07 | **Spin Again** closes the current session as superseded, starts a new one, and reruns both stages with current eligibility. Previous skips do not carry over. |
| S-08 | **Watch This** opens viewing options. The member can select a provider handoff or **Save as Tonight's Pick**; either action marks the shared result `Accepted` in history. Merely opening options does not accept it. **Mark Watched** is separate, available only to the winning profile's owner, and changes only that owner's watchlist item. |
| S-09 | If connectivity fails before the saved result is returned, the app does not display a fake winner. The user can retry safely without creating two results for one tap. |
| S-10 | When one member starts, skips, accepts, or re-spins, other active members see the same current group result. A stale client must refresh before applying a conflicting action. |

### Viewing availability

| ID | Requirement |
| --- | --- |
| A-01 | Each group has a chosen country/region. The result and viewing-options screen display that region and let a member change it for the group. Availability is queried for the selected title and region; it does not influence random odds. |
| A-02 | Show legal providers by service and access type where the data source supplies them. Distinguish subscription/free access from rental or purchase; do not show a price unless it is supplied and fresh enough to trust. |
| A-03 | Each offer shows a provider handoff link when available, its data source, and a last-checked indicator. Clearly label unverified or outdated offers; do not claim guaranteed availability. |
| A-04 | If no offer is found, the provider is unavailable, or the title was entered manually without a confident catalogue match, show a clear `No verified viewing options found` state. The group can still accept the pick without a handoff. |
| A-05 | Opening a viewing-options link does not stream inside TV Showdown or automatically mark the watchlist item `Watched`. The current TMDB integration links to the title's viewing-options page, because it does not supply a direct link to each provider's title; direct provider handoff remains a later integration. |

### Search and metadata

- Search results show title, year, type, and poster where available so remakes and similarly named titles are distinguishable.
- A provider's title identifier is stored separately from a person's watchlist item. A catalogue title can be refreshed without overwriting user status or notes.
- If metadata cannot be loaded, the item's typed title remains usable for spinning. Posters and backdrops use accessible placeholders.
- Metadata, artwork, attribution, and caching must comply with the chosen provider's license and terms before launch.

## 6. Screens and UX direction

| Screen | Main content and actions |
| --- | --- |
| Welcome / sign-in | Short explanation, separate account creation, sign-in, and privacy link. |
| Home | Current group selector, featured **Next Up** or last accepted pick, quick **Spin** action, and recently added items. Empty state points to group creation/joining or adding a title. |
| Groups | Create and switch groups; see members; join by room code; leave group. The owner can manage members and generate/revoke invite links or room codes. |
| Join group | Invite-link or room-code entry, sign-in/sign-up continuation, group preview, and explicit join confirmation; clear invalid/expired invite states. |
| Members | Member cards with avatars and eligible item counts; profile owners can edit their own profile, while the owner can remove group members. |
| Profile watchlist | The owner's `Want to Watch`, `Watching`, and `Watched` tabs with add/edit/status actions; group members see one another's eligible titles in read-only mode. |
| Add title | Search, result disambiguation, manual-entry option, and add confirmation. |
| Spin setup | Select profile chips/cards, type filter, eligibility counts, visible odds explanation, and primary **Spin the Wheel** button. |
| Spin animation | First a labeled profile wheel; then a title wheel/reel or card reveal. Provide **Skip animation** and a reduced-motion version. |
| Result | Large title, poster/backdrop where licensed, winning profile attribution, type, year/runtime/genres if known, region, and **Watch This**, **Details**, **Skip Title**, **Spin Again**. |
| Where to Watch | Region-specific service offers with access type, source/freshness, and provider handoff; **Save as Tonight's Pick** and an honest no-results state. |
| History | Recent results with accepted/skipped state; no automatic assumption that a picked title was watched. |
| Settings | Personal profile, account, group management, data export/delete, accessibility preferences, and legal/metadata attribution. |

### Visual principles from the example

- Dark, high-contrast canvas with a warm accent for the primary action; keep text readable over imagery with strong overlays.
- Make the winning profile and title the visual focus, like the example's featured recommendation card.
- Use poster-card browsing for watchlists, but always show readable title text in case art is missing.
- Keep a clear mobile bottom navigation (for example, Home, Watchlists, Spin, History, Settings); use a side or top navigation on wider screens.
- Do not recreate the screenshot's film stills, logos, poster art, or exact layout without rights.

## 7. Data model (conceptual)

| Entity | Key fields |
| --- | --- |
| `Account` | ID, email, authentication reference, created/updated timestamps. |
| `Profile` | ID, account ID (unique), name, avatar/color, deactivated timestamp. |
| `Group` | ID, owner account ID, name, country/region, created/updated timestamps. |
| `GroupMembership` | ID, group ID, account ID, role, joined/left timestamps; unique active membership per group/account. |
| `GroupInvite` | ID, group ID, invite type (`Link` or `Room Code`), hashed token/code, expiration, revocation timestamp, creator ID. |
| `Title` | ID, external provider and provider ID (nullable), canonical name, type, release year, metadata and artwork references. |
| `WatchlistItem` | ID, profile ID, title ID or manual-title fields, status, added timestamp, updated timestamp, optional note. |
| `SpinSession` | ID, group ID, initiating account ID, selected profile IDs, type filter, eligibility snapshot, selected profile ID, start time, current state (`Active`, `Accepted`, `Superseded`, `Cancelled`) and version. |
| `SpinResult` | ID, session ID, chosen watchlist item ID, profile/title display snapshot, result order, state (`Pending`, `Skipped`, `Accepted`), timestamp. |
| `AvailabilityOffer` | Title ID, country/region, provider, access type, handoff URL, source, checked/expiry timestamps. |

Persist identifiers rather than copying the entire catalogue record into a watchlist item. Retain a minimal display snapshot in group history so past results remain understandable if metadata changes or a member leaves; remove or anonymize it when required by account deletion. Personal watchlists remain with their account owners when they leave a group. Every group, invite, list, spin, and history operation must enforce account ownership or active group membership as appropriate.

## 8. Technical approach

- Target one first release for responsive web/PWA and native iOS/Android apps. Share the backend, product rules, data contracts, and design system across clients. An early prototype must validate native wheel animation, invite deep links, provider handoff, and accessibility before committing to simultaneous release; any platform staggering requires an explicit product decision.
- Use a relational database for accounts, profiles, groups/memberships, invites, watchlists, and spin history. Enforce ownership, membership, and unique active watchlist entries at the database/API level.
- Provide operations for group creation/invite/join/member management, profile management, title search/manual creation, watchlist status changes, spin creation, title skip, result acceptance, availability lookup, and history retrieval.
- Generate random choices on the server with a uniform random-number source. Use a client-generated idempotency key for spin/skip requests so retries cannot create duplicate picks.
- Store a spin's eligibility snapshot and chosen result transactionally, with a single active session per group and version checks for concurrent member actions. The animated wheel receives the saved result and only visualizes it.
- Keep catalogue and availability-provider credentials on the server. Cache their data according to provider terms; refresh or label stale offers, and show graceful placeholders during outages. Confirm title matches before attaching availability to manual entries.
- Store only hashes of invite secrets; rate-limit code entry and join attempts, expire/revoke secrets, and validate deep links on the server after sign-in.
- Instrument basic product events (group joined, title added, spin started/completed, title skipped/accepted, availability opened) without logging invite secrets, private notes, or sensitive account data.

## 9. Accessibility, privacy, and quality

- All actions must work with keyboard and touch. Wheel slices need readable labels outside of color alone; the winner is announced in text and to assistive technology.
- Respect reduced-motion preferences and provide a non-animated reveal. Avoid flashing effects and ensure controls remain usable while an animation is running.
- Use legible contrast, large touch targets, visible focus states, text alternatives for posters, and loading/error/empty states.
- Accounts can export or delete their own profile and watchlist data. A group owner can delete a group without deleting members' personal watchlists. Only active members may see that group's eligible lists and history; leaving or removal revokes that access.
- Invite links and room codes are shareable access credentials: show expiry, allow owner revocation/rotation, and never expose them in analytics or application logs.
- The home and watchlist screens should remain usable on common phone widths without horizontal scrolling. Handle slow networks and catalogue outages without losing already-saved titles.
- Do not treat `Watch This` as evidence of actual viewing. Watching history should change only when the user explicitly updates it.

## 10. MVP acceptance scenarios

1. Given two profiles with at least one eligible item each, selecting both and spinning eventually displays one profile and one item from **that same profile's** list.
2. Given profiles with 2 and 20 eligible items, the profile selection still gives each profile equal odds; list size does not influence stage one.
3. Given a selected profile with no eligible movie under a Movies-only filter, Spin is blocked with an actionable explanation rather than silently excluding the profile.
4. Given one selected profile, the profile stage resolves to that profile and the title stage still runs.
5. Given a result with another eligible title in the winner's list, Skip Title returns a different title from that same profile and retains the skipped title on the watchlist.
6. Given every eligible title for a winning profile has been skipped, further title skipping is unavailable and the UI offers a full re-spin.
7. Given the group accepts a result, it appears as `Accepted` in history but the winning owner's watchlist item retains its prior status until that owner explicitly changes it.
8. Given catalogue search is unavailable, the user can add a manual movie or series and include it in a spin.
9. Given reduced motion is enabled, the same result is shown without a spinning animation.
10. Given a network retry or double tap, a spin creates only one saved result for that action.
11. Given two separate accounts, one can create a group, share a link or code, and the other can sign in, confirm joining, and appear as a selectable member.
12. Given an invalid, expired, or revoked invite, joining fails without revealing private group data; an existing member cannot create duplicate membership by reusing an invite.
13. Given a member is removed or leaves, they immediately lose group access but retain their own profile and watchlist.
14. Given a series has status `Watching`, it remains eligible under `Series` or `Both`; a `Watched` title and a `Watching` movie are not eligible.
15. Given a selected title with a verified viewing offer in the group's region, **Watch This** shows the service, access type, freshness, and a working provider handoff. If no verified offer exists, it says so and still allows accepting the pick.
16. Given two members act on the same group result at once, the server accepts one current-state transition and tells the stale client to refresh; group members then see the same result.
17. The account, join, watchlist, spin, result, and viewing-options flows are usable on responsive web/PWA, iOS, and Android before the targeted simultaneous launch.

## 11. Delivery sequence

1. **Foundation and feasibility:** Validate shared web/native UX; build separate-account auth, profiles, groups, invites/room codes, membership permissions, title catalogue integration plus manual entry, and watchlists.
2. **Decision loop:** Eligibility validation, two-stage random selection, synchronized wheel/reveal, result actions, and group history.
3. **Viewing handoff:** Region selection, licensed availability source, viewing-options UI, freshness/no-results handling, and provider deep links.
4. **Polish and release:** Web/PWA, iOS, and Android parity; accessibility, error states, analytics, privacy/security controls, and device/browser QA. Aim for simultaneous launch if the feasibility checkpoint succeeds.
5. **Post-MVP options:** Availability-based spin filters, personalized service preferences, voting, and other advanced features.

## 12. Confirmed decisions and release checkpoints

- United Kingdom is the first viewing-availability region; the interface uses UK English.
- TMDB provides catalogue metadata and UK availability supplied by JustWatch in the development build. Attribution and commercial licensing must be checked before public launch. This source currently supplies a TMDB viewing-options link, not direct provider-title links.
- One Expo codebase targets web, iOS and Android. Web has been exported and locally tested; native device tests, signing and distribution are still release checkpoints. The web build has not yet been assessed or packaged as an installable PWA.
