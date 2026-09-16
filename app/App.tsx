import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Share, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { api, Availability, getToken, Group, HistoryRow, Item, Kind, Me, SearchResult, setStoredToken, Spin, Status } from './src/api';
import { Button, Chip, Field, gold, kindLabel, Poster, Wheel } from './src/ui';

type Page = 'home' | 'spin' | 'watchlist' | 'groups' | 'history' | 'profile';
const nav: { page: Page; label: string; icon: string }[] = [
  { page: 'home', label: 'Home', icon: '⌂' }, { page: 'spin', label: 'Spin', icon: '◉' }, { page: 'watchlist', label: 'Watchlist', icon: '▤' },
  { page: 'groups', label: 'Groups', icon: '◎' }, { page: 'history', label: 'History', icon: '◷' }, { page: 'profile', label: 'Profile', icon: '◌' },
];
const statusLabel = (value: Status) => ({ want: 'Want to watch', watching: 'Watching', watched: 'Watched' })[value];
const joinCode = (url: string | null) => { try { const u = new URL(url || ''); return u.searchParams.get('join') || u.searchParams.get('code') || ''; } catch { return ''; } };

export default function App() {
  const { width } = useWindowDimensions();
  const desktop = width >= 800;
  const [booting, setBooting] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(null), [me, setMe] = useState<Me | null>(null);
  const [groups, setGroups] = useState<Group[]>([]), [groupId, setGroupId] = useState<string | null>(null), [group, setGroup] = useState<Group | null>(null);
  const [watchlist, setWatchlist] = useState<Item[]>([]), [spin, setSpin] = useState<Spin | null>(null), [history, setHistory] = useState<HistoryRow[]>([]);
  const [page, setPage] = useState<Page>('home'), [selected, setSelected] = useState<string[]>([]), [filter, setFilter] = useState<'both' | Kind>('both');
  const [animating, setAnimating] = useState(false), [showOptions, setShowOptions] = useState(false), [options, setOptions] = useState<Availability | null>(null);
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register'), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [name, setName] = useState('');
  const [groupName, setGroupName] = useState(''), [roomCode, setRoomCode] = useState(''), [preview, setPreview] = useState<{ name: string; memberCount: number } | null>(null);
  const [invite, setInvite] = useState<{ code: string; link: string; expiresInDays: number } | null>(null);
  const [query, setQuery] = useState(''), [searchResults, setSearchResults] = useState<SearchResult[]>([]), [catalogueConnected, setCatalogueConnected] = useState(true);
  const [manualTitle, setManualTitle] = useState(''), [manualKind, setManualKind] = useState<Kind>('movie'), [profileName, setProfileName] = useState('');

  const perform = async (action: () => Promise<void>) => { setError(''); setBusy(true); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(false); } };
  const refreshBase = useCallback(async (t: string) => {
    const [person, memberships, titles] = await Promise.all([api<Me>('/api/me', t), api<Group[]>('/api/groups', t), api<Item[]>('/api/watchlist', t)]);
    setMe(person); setProfileName(person.name); setGroups(memberships); setWatchlist(titles);
    setGroupId((old) => old && memberships.some((g) => g.id === old) ? old : memberships[0]?.id || null);
  }, []);
  const refreshGroup = useCallback(async (t: string, id: string) => {
    const [detail, current, past] = await Promise.all([api<Group>(`/api/groups/${id}`, t), api<Spin | null>(`/api/groups/${id}/current`, t), api<HistoryRow[]>(`/api/groups/${id}/history`, t)]);
    setGroup(detail); setSpin(current); setHistory(past);
    setSelected((old) => {
      const eligible = (detail.members || []).filter((m) => m.active && detail.watchlists?.some((i) => i.profileId === m.profileId));
      const retained = old.filter((id) => eligible.some((m) => m.profileId === id));
      return retained.length ? retained : eligible.map((m) => m.profileId);
    });
  }, []);
  useEffect(() => {
    getToken().then(async (stored) => {
      if (stored) { try { await refreshBase(stored); setToken(stored); } catch { await setStoredToken(null); } }
      setBooting(false);
    });
    Linking.getInitialURL().then((url) => { const code = joinCode(url); if (code) { setRoomCode(code); setPage('groups'); } });
    const sub = Linking.addEventListener('url', ({ url }) => { const code = joinCode(url); if (code) { setRoomCode(code); setPage('groups'); } });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!token || !groupId) { setGroup(null); return; }
    refreshGroup(token, groupId).catch((e) => setError(e.message));
    const timer = setInterval(() => refreshGroup(token, groupId).catch(() => {}), 10000);
    return () => clearInterval(timer);
  }, [token, groupId, refreshGroup]);
  const members = group?.members || [], groupItems = group?.watchlists || [];
  const chosenMembers = useMemo(() => members.filter((m) => selected.includes(m.profileId)), [members, selected]);
  const canSpin = chosenMembers.length > 0 && chosenMembers.every((m) => groupItems.some((i) => i.profileId === m.profileId && (filter === 'both' || i.kind === filter)));
  const eligibleOwn = watchlist.filter((i) => i.status === 'want' || (i.kind === 'series' && i.status === 'watching')).length;
  const nextUp = history.find((item) => item.resultState === 'accepted');
  const recentTitles = watchlist.slice(0, 4);

  const authenticate = () => perform(async () => {
    const result = await api<{ token: string }>(`/api/auth/${authMode}`, null, 'POST', { email, password, name });
    await setStoredToken(result.token); setToken(result.token); await refreshBase(result.token); setPassword('');
  });
  const signOut = () => perform(async () => {
    if (token) await api('/api/auth/logout', token, 'POST');
    await setStoredToken(null); setToken(null); setMe(null); setGroups([]); setGroup(null); setPage('home');
  });
  const createGroup = () => perform(async () => {
    const created = await api<Group>('/api/groups', token, 'POST', { name: groupName });
    await refreshBase(token!); setGroupId(created.id); setGroup(created); setGroupName(''); setPage('spin');
  });
  const checkCode = () => perform(async () => setPreview(await api(`/api/invites/${roomCode.trim().toUpperCase()}`, null)));
  const joinGroup = () => perform(async () => {
    const joined = await api<Group>('/api/groups/join', token, 'POST', { code: roomCode });
    await refreshBase(token!); setGroupId(joined.id); setPreview(null); setRoomCode(''); setPage('spin');
  });
  const createInvite = () => perform(async () => setInvite(await api(`/api/groups/${groupId}/invite`, token, 'POST')));
  const confirmAction = (title: string, message: string, action: () => void) => {
    if (Platform.OS === 'web') { if (window.confirm(`${title}\n\n${message}`)) action(); }
    else Alert.alert(title, message, [{ text: 'Cancel' }, { text: 'Continue', style: 'destructive', onPress: action }]);
  };
  const revokeInvites = () => confirmAction('Revoke group invites?', 'Existing links and room codes will stop working.', () => perform(async () => {
    await api(`/api/groups/${groupId}/invites`, token, 'DELETE'); setInvite(null);
  }));
  const removeMember = (accountId: string, memberName: string) => confirmAction(`Remove ${memberName}?`, 'They will lose access to this group. Current invite codes will also be revoked.', () => perform(async () => {
    await api(`/api/groups/${groupId}/members/${accountId}`, token, 'DELETE'); setInvite(null); await refreshBase(token!); await refreshGroup(token!, groupId!);
  }));
  const transferOwnership = (accountId: string, memberName: string) => confirmAction(`Make ${memberName} the owner?`, 'You will become a group member. Only the new owner can manage invites and members.', () => perform(async () => {
    await api(`/api/groups/${groupId}/transfer`, token, 'POST', { accountId }); await refreshBase(token!); await refreshGroup(token!, groupId!);
  }));
  const leaveGroup = () => confirmAction(`Leave ${group?.name}?`, 'You will lose access to its spins and history, but keep your own watchlist.', () => perform(async () => {
    await api(`/api/groups/${groupId}/members/me`, token, 'DELETE'); setGroup(null); setInvite(null); await refreshBase(token!);
  }));
  const search = () => perform(async () => {
    if (query.trim().length < 2) throw new Error('Enter at least two letters to search');
    const result = await api<{ configured: boolean; results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(query.trim())}`, token);
    setCatalogueConnected(result.configured); setSearchResults(result.results);
  });
  const addItem = (item: Partial<Item>) => perform(async () => {
    await api('/api/watchlist', token, 'POST', item); setWatchlist(await api('/api/watchlist', token));
    setManualTitle(''); setQuery(''); setSearchResults([]); if (groupId) await refreshGroup(token!, groupId);
  });
  const changeStatus = (item: Item, status: Status) => perform(async () => {
    await api(`/api/watchlist/${item.id}`, token, 'PATCH', { status }); setWatchlist(await api('/api/watchlist', token)); if (groupId) await refreshGroup(token!, groupId);
  });
  const removeItem = (item: Item) => {
    const remove = () => perform(async () => { await api(`/api/watchlist/${item.id}`, token, 'DELETE'); setWatchlist(await api('/api/watchlist', token)); if (groupId) await refreshGroup(token!, groupId); });
    if (Platform.OS === 'web') { if (window.confirm(`Remove ${item.title} from your watchlist?`)) remove(); }
    else Alert.alert('Remove title?', `${item.title} will leave your watchlist.`, [{ text: 'Cancel' }, { text: 'Remove', style: 'destructive', onPress: remove }]);
  };
  const startSpin = () => perform(async () => {
    if (!groupId || !canSpin) return;
    const next = await api<Spin>(`/api/groups/${groupId}/spin`, token, 'POST', { selectedProfileIds: selected, filter, idempotencyKey: `${Date.now()}-${Math.random()}` });
    setSpin(next); setShowOptions(false); setOptions(null); setAnimating(true); setTimeout(() => setAnimating(false), 2900);
  });
  const spinAction = (action: 'skip' | 'accept') => perform(async () => {
    if (!spin || !groupId) return;
    const next = await api<Spin>(`/api/groups/${groupId}/${action}`, token, 'POST', { version: spin.version });
    setSpin(next); setShowOptions(false); setOptions(null); setHistory(await api(`/api/groups/${groupId}/history`, token));
  });
  const viewOptions = () => perform(async () => {
    setShowOptions(true); if (!spin?.result.tmdbId) { setOptions({ configured: true, offers: [] }); return; }
    setOptions(await api<Availability>(`/api/availability?kind=${spin.result.kind}&tmdbId=${spin.result.tmdbId}`, token));
  });

  if (booting) return <View style={s.boot}><ActivityIndicator color={gold} /><Text style={s.brand}>TV SHOWDOWN</Text></View>;
  if (!token) return <View style={s.root}><StatusBar barStyle="light-content" /><ScrollView contentContainerStyle={s.authContent}>
    <Text style={s.eyebrow}>WHAT SHALL WE WATCH?</Text><Text style={s.authTitle}>TV{`\n`}Showdown.</Text><Text style={s.intro}>Your watchlists. One wheel. Tonight’s pick.</Text>
    {roomCode ? <Text style={s.hint}>Invite code {roomCode} is ready. Sign in to join the group.</Text> : null}
    <View style={s.card}><View style={s.row}><Chip label="Create account" active={authMode === 'register'} onPress={() => setAuthMode('register')} /><Chip label="Sign in" active={authMode === 'login'} onPress={() => setAuthMode('login')} /></View>
      {authMode === 'register' && <Field label="Your name" value={name} onChangeText={setName} placeholder="What should the group call you?" />}
      <Field label="Email address" value={email} onChangeText={setEmail} email placeholder="you@example.com" />
      <Field label="Password" value={password} onChangeText={setPassword} secure placeholder="At least 12 characters" />
      <Button label={authMode === 'register' ? 'Create account' : 'Sign in'} onPress={authenticate} disabled={busy} />
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View><Text style={s.footer}>Made for film nights in the United Kingdom.</Text>
  </ScrollView></View>;

  return <View style={s.root}><StatusBar barStyle="light-content" /><View style={[s.shell, desktop && s.desktopShell]}>
    {desktop && <View style={s.sidebar}><Text style={s.brand}>TV <Text style={{ color: gold }}>SHOWDOWN</Text></Text><Text style={s.sideCaption}>THE FILM NIGHT DECIDER</Text>
      {nav.map((n) => <Pressable key={n.page} onPress={() => setPage(n.page)} style={[s.sideLink, page === n.page && s.sideLinkActive]}><Text style={s.sideIcon}>{n.icon}</Text><Text style={[s.sideText, page === n.page && { color: gold }]}>{n.label}</Text></Pressable>)}
      <Text style={s.sideFooter}>UNITED KINGDOM · ENGLISH (UK)</Text></View>}
    <View style={s.main}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, !desktop && s.contentMobile]}>
      {!desktop && <Text style={s.brand}>TV <Text style={{ color: gold }}>SHOWDOWN</Text></Text>}
      {error && <Pressable onPress={() => setError('')} style={s.errorBox}><Text style={s.error}>{error}  ·  Dismiss</Text></Pressable>}

      {page === 'home' && <><Text style={s.eyebrow}>WELCOME BACK{me?.name ? `, ${me.name.toUpperCase()}` : ''}</Text><Text style={s.title}>What’s next?</Text><Text style={s.muted}>Pick up where your group left off or head straight to a new decision.</Text>
        {!!groups.length && <View style={s.row}>{groups.map((g) => <Chip key={g.id} label={g.name} active={groupId === g.id} onPress={() => setGroupId(g.id)} />)}</View>}
        {!group ? <View style={s.homeHero}><Text style={s.eyebrow}>START A FILM NIGHT</Text><Text style={s.homeHeroTitle}>Bring your people and watchlists together.</Text><Text style={s.muted}>Create a group or join one with a room code, then let the wheel make tonight’s decision.</Text><View style={s.row}><Button label="Create or join a group" onPress={() => setPage('groups')} /><Button label="Build my watchlist" quiet onPress={() => setPage('watchlist')} /></View></View> : <>
          {spin?.state === 'active' && <Pressable accessibilityRole="button" onPress={() => setPage('spin')} style={s.homeNotice}><View style={{ flex: 1 }}><Text style={s.goldText}>A RESULT IS WAITING</Text><Text style={s.white}>{spin.result.profile_name}’s pick · {spin.result.title}</Text></View><Text style={s.goldText}>Open ›</Text></Pressable>}
          <View style={s.homeHero}><View style={s.homeHeading}><View><Text style={s.eyebrow}>NEXT UP · {group.name.toUpperCase()}</Text><Text style={s.homeHeroTitle}>{nextUp ? nextUp.title : 'No choice saved yet.'}</Text></View>{nextUp && <Text style={s.homePickBadge}>CHOSEN</Text>}</View>
            {nextUp ? <View style={s.featuredRow}><Poster title={nextUp.title} path={nextUp.posterPath} size={96} /><View style={{ flex: 1, gap: 8 }}><Text style={s.goldText}>{nextUp.winnerName}’s pick</Text><Text style={s.muted}>{kindLabel(nextUp.kind)}{nextUp.year ? ` · ${nextUp.year}` : ''}</Text><Text style={s.small} numberOfLines={3}>{nextUp.overview || 'The group’s latest accepted choice.'}</Text><Text style={s.small}>Chosen {new Date(nextUp.createdAt + 'Z').toLocaleString('en-GB')}</Text></View></View> : <Text style={s.muted}>Run the group’s first spin and save a result to see it featured here.</Text>}
            <View style={s.row}><Button label="Spin for tonight" onPress={() => setPage('spin')} /><Button label="Manage group" quiet onPress={() => setPage('groups')} /></View>
          </View>
          <View style={s.homePanels}><View style={[s.card, s.homePanel]}><Text style={s.eyebrow}>YOUR GROUP</Text><Text style={s.section}>{members.length} {members.length === 1 ? 'member' : 'members'}</Text><Text style={s.muted}>{groupItems.length} eligible {groupItems.length === 1 ? 'title' : 'titles'} shared for the wheel.</Text><Button label="View group" quiet onPress={() => setPage('groups')} /></View><View style={[s.card, s.homePanel]}><Text style={s.eyebrow}>YOUR WATCHLIST</Text><Text style={s.section}>{eligibleOwn} eligible</Text><Text style={s.muted}>{watchlist.length} {watchlist.length === 1 ? 'title' : 'titles'} saved across every status.</Text><Button label="Add titles" quiet onPress={() => setPage('watchlist')} /></View></View>
        </>}
        <View style={s.homeHeading}><Text style={s.section}>Recently added</Text><Pressable accessibilityRole="button" onPress={() => setPage('watchlist')}><Text style={s.goldText}>View watchlist ›</Text></Pressable></View>
        {!recentTitles.length ? <Text style={s.muted}>Your recent titles will appear here after you start building a watchlist.</Text> : <View style={s.homeShelf}>{recentTitles.map((item) => <Pressable accessibilityRole="button" key={item.id} onPress={() => setPage('watchlist')} style={s.homeTitleCard}><Poster title={item.title} path={item.posterPath} size={66} /><View style={{ flex: 1 }}><Text style={s.white} numberOfLines={2}>{item.title}</Text><Text style={s.small}>{kindLabel(item.kind)}{item.year ? ` · ${item.year}` : ''}</Text><Text style={s.goldText}>{statusLabel(item.status)}</Text></View></Pressable>)}</View>}
      </>}

      {page === 'spin' && <><Text style={s.eyebrow}>TONIGHT’S DECISION</Text><Text style={s.title}>The wheel decides.</Text>
        <View style={s.row}>{groups.map((g) => <Chip key={g.id} label={g.name} active={groupId === g.id} onPress={() => setGroupId(g.id)} />)}</View>
        {!group ? <View style={s.card}><Text style={s.section}>Bring everyone together</Text><Text style={s.muted}>Create a group or join one with a room code. Then add a few titles to your watchlist.</Text><Button label="Go to groups" onPress={() => setPage('groups')} /></View> : <>
          {spin && !animating && <View style={s.featured}><Text style={s.eyebrow}>{spin.state === 'accepted' ? 'TONIGHT’S PICK' : 'THE WHEEL HAS SPOKEN'}</Text><Text style={s.goldText}>{spin.result.profile_name}’s pick</Text>
            <View style={s.featuredRow}><Poster title={spin.result.title} path={spin.result.posterPath} size={105} /><View style={{ flex: 1 }}><Text style={s.featuredTitle}>{spin.result.title}</Text><Text style={s.muted}>{kindLabel(spin.result.kind)}{spin.result.year ? ` · ${spin.result.year}` : ''}</Text><Text style={s.small} numberOfLines={4}>{spin.result.overview || 'From the winning watchlist.'}</Text></View></View>
            {spin.state === 'active' ? <View style={s.row}><Button label="Watch this" onPress={viewOptions} disabled={busy} /><Button label="Skip title" quiet onPress={() => spinAction('skip')} disabled={!spin.canSkip || busy} /></View> : <Text style={s.goldText}>✓ Saved as tonight’s pick</Text>}
          </View>}
          {showOptions && <View style={s.card}><Text style={s.eyebrow}>UNITED KINGDOM</Text><Text style={s.section}>Where to watch</Text>
            {!options ? <ActivityIndicator color={gold} /> : !options.configured ? <Text style={s.muted}>Viewing options are not connected yet. Add a TMDB API token to enable UK availability.</Text> : options.offers.length ? <><Text style={s.muted}>JustWatch data via TMDB. Check the service before paying or subscribing.</Text>{options.offers.map((o, i) => <View key={`${o.provider}-${o.accessType}-${i}`} style={s.offer}><Text style={s.white}>{o.provider}</Text><Text style={s.goldText}>{o.accessType}</Text></View>)}{options.checkedAt && <Text style={s.small}>Checked {new Date(options.checkedAt).toLocaleString('en-GB')}</Text>}{options.link && <Button label="View options on TMDB" onPress={() => { Linking.openURL(options.link!); spinAction('accept'); }} />}</> : <Text style={s.muted}>No verified viewing options found in the United Kingdom. You can still save this pick.</Text>}
            {spin?.state === 'active' && <Button label="Save as tonight’s pick" quiet onPress={() => spinAction('accept')} disabled={busy} />}<Button label="Close" quiet onPress={() => setShowOptions(false)} /></View>}
          <View style={s.card}><Text style={s.eyebrow}>ROUND SETUP</Text><Text style={s.section}>Who’s in?</Text>
            <View style={s.memberGrid}>{members.map((m) => { const count = groupItems.filter((i) => i.profileId === m.profileId && (filter === 'both' || i.kind === filter)).length; return <Pressable key={m.profileId} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(m.profileId) }} onPress={() => setSelected((old) => old.includes(m.profileId) ? old.filter((id) => id !== m.profileId) : [...old, m.profileId])} style={[s.member, selected.includes(m.profileId) && s.memberSelected]}><View style={[s.avatar, { backgroundColor: m.colour || gold }]}><Text style={s.avatarText}>{m.name[0].toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={s.white}>{m.name}</Text><Text style={s.small}>{count} eligible {count === 1 ? 'title' : 'titles'}</Text></View><Text style={s.goldText}>{selected.includes(m.profileId) ? '✓' : '+'}</Text></Pressable>; })}</View>
            <Text style={s.label}>Include</Text><View style={s.row}><Chip label="Films & series" active={filter === 'both'} onPress={() => setFilter('both')} /><Chip label="Films" active={filter === 'movie'} onPress={() => setFilter('movie')} /><Chip label="Series" active={filter === 'series'} onPress={() => setFilter('series')} /></View>
            {!canSpin && <Text style={s.hint}>Everyone selected needs an eligible title for this filter.</Text>}
            <Text style={s.small}>Every selected person has equal odds, however long their watchlist is.</Text><Button label={spin?.state === 'active' ? 'Spin again' : 'Spin the wheel'} onPress={startSpin} disabled={!canSpin || busy || animating} />
          </View>
          {animating ? <View style={s.wheelCard}><Text style={s.eyebrow}>CHOOSING A PROFILE</Text><Wheel members={chosenMembers} winnerId={spin?.winnerProfileId} spinning /><Text style={s.white}>Let’s see whose list wins…</Text><Button label="Skip animation" quiet onPress={() => setAnimating(false)} /></View> : <View style={s.wheelCard}><Wheel members={chosenMembers.length ? chosenMembers : members} /><Text style={s.small}>Your film night, decided fairly.</Text></View>}
        </>}
      </>}

      {page === 'watchlist' && <><Text style={s.eyebrow}>YOUR PICKS</Text><Text style={s.title}>Watchlist</Text><Text style={s.muted}>Only you can edit your list. Eligible titles are visible to your groups.</Text>
        <View style={s.card}><Text style={s.section}>Add a title</Text><Field label="Search films and series" value={query} onChangeText={setQuery} placeholder="Search by title" /><Button label="Search catalogue" onPress={search} disabled={busy} />
          {!catalogueConnected && <Text style={s.hint}>Catalogue search needs a TMDB API token. You can add a title manually.</Text>}
          {searchResults.map((r) => <Pressable key={`${r.kind}-${r.tmdbId}`} onPress={() => addItem(r)} style={s.listRow}><Poster title={r.title} path={r.posterPath} size={44} /><View style={{ flex: 1 }}><Text style={s.white}>{r.title}</Text><Text style={s.small}>{kindLabel(r.kind)}{r.year ? ` · ${r.year}` : ''}</Text></View><Text style={s.goldText}>＋</Text></Pressable>)}
          <View style={s.rule} /><Text style={s.label}>Or add your own</Text><Field label="Title" value={manualTitle} onChangeText={setManualTitle} placeholder="Film or series title" /><View style={s.row}><Chip label="Film" active={manualKind === 'movie'} onPress={() => setManualKind('movie')} /><Chip label="Series" active={manualKind === 'series'} onPress={() => setManualKind('series')} /></View><Button label="Add to watchlist" onPress={() => addItem({ title: manualTitle, kind: manualKind })} disabled={!manualTitle.trim() || busy} />
        </View><Text style={s.section}>Your titles <Text style={s.small}>· {watchlist.length} total, {eligibleOwn} eligible</Text></Text>
        {!watchlist.length ? <Text style={s.muted}>Your list starts here. Add a film or series above.</Text> : watchlist.map((item) => <View key={item.id} style={s.itemCard}><Poster title={item.title} path={item.posterPath} size={62} /><View style={{ flex: 1, gap: 6 }}><Text style={s.white}>{item.title}</Text><Text style={s.small}>{kindLabel(item.kind)}{item.year ? ` · ${item.year}` : ''}</Text><View style={s.row}>{(['want', 'watching', 'watched'] as Status[]).map((status) => <Chip key={status} label={statusLabel(status)} active={item.status === status} onPress={() => changeStatus(item, status)} />)}</View><Pressable onPress={() => removeItem(item)}><Text style={s.remove}>Remove</Text></Pressable></View></View>)}
      </>}

      {page === 'groups' && <><Text style={s.eyebrow}>YOUR PEOPLE</Text><Text style={s.title}>Groups</Text><Text style={s.muted}>Keep your own watchlist, share it with the people you watch with.</Text>
        <View style={s.card}><Text style={s.section}>Create a group</Text><Field label="Group name" value={groupName} onChangeText={setGroupName} placeholder="Friday film club" /><Button label="Create group" onPress={createGroup} disabled={!groupName.trim() || busy} /></View>
        <View style={s.card}><Text style={s.section}>Join a group</Text><Field label="Room code" value={roomCode} onChangeText={(value) => { setRoomCode(value.toUpperCase()); setPreview(null); }} placeholder="Enter invite code" /><Button label="Check code" onPress={checkCode} disabled={!roomCode.trim() || busy} />
          {preview && <View style={s.preview}><Text style={s.white}>{preview.name}</Text><Text style={s.small}>{preview.memberCount} {preview.memberCount === 1 ? 'member' : 'members'}</Text><Button label="Join this group" onPress={joinGroup} disabled={busy} /></View>}</View>
        {groups.map((g) => <Pressable key={g.id} style={[s.itemCard, groupId === g.id && { borderColor: gold }]} onPress={() => { setGroupId(g.id); setInvite(null); }}><View style={{ flex: 1 }}><Text style={s.white}>{g.name}</Text><Text style={s.small}>{g.memberCount} members · United Kingdom</Text></View><Text style={s.goldText}>{groupId === g.id ? 'Selected' : 'View ›'}</Text></Pressable>)}
        {group && <View style={s.card}><Text style={s.section}>{group.name}</Text>{members.map((m) => <View key={m.accountId} style={s.memberLine}><View style={[s.avatar, { backgroundColor: m.colour || gold }]}><Text style={s.avatarText}>{m.name[0].toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={s.white}>{m.name}</Text>{m.role === 'owner' && <Text style={s.small}>Owner</Text>}</View>
          {group.role === 'owner' && m.accountId !== me?.id && <View style={s.row}><Pressable onPress={() => transferOwnership(m.accountId, m.name)}><Text style={s.goldText}>Make owner</Text></Pressable><Pressable onPress={() => removeMember(m.accountId, m.name)}><Text style={s.remove}>Remove</Text></Pressable></View>}
        </View>)}
          {group.role === 'owner' ? <><View style={s.rule} /><Button label="Create invite link & room code" onPress={createInvite} disabled={busy} />{invite && <View style={s.preview}><Text style={s.eyebrow}>ROOM CODE · EXPIRES IN 7 DAYS</Text><Text selectable style={s.code}>{invite.code}</Text><Text selectable style={s.small}>{invite.link}</Text><Button label="Share invite" quiet onPress={() => { Share.share({ message: `Join my TV Showdown group: ${invite.link}\nRoom code: ${invite.code}` }); }} /></View>}<Button label="Revoke all invites" quiet onPress={revokeInvites} disabled={busy} /></> : <><View style={s.rule} /><Button label="Leave group" quiet onPress={leaveGroup} disabled={busy} /></>}
        </View>}
      </>}

      {page === 'history' && <><Text style={s.eyebrow}>PREVIOUS ROUNDS</Text><Text style={s.title}>History</Text>{!history.length ? <Text style={s.muted}>No spins yet. The first result will appear here.</Text> : history.map((h) => <View key={h.id} style={s.itemCard}><Text style={s.historyStar}>✦</Text><View style={{ flex: 1 }}><Text style={s.white}>{h.title}</Text><Text style={s.small}>{h.winnerName}’s pick · {kindLabel(h.kind)} · {new Date(h.createdAt + 'Z').toLocaleString('en-GB')}</Text></View><Text style={s.goldText}>{h.resultState === 'accepted' ? 'Chosen' : h.state === 'superseded' ? 'Re-spun' : 'Pending'}</Text></View>)}</>}

      {page === 'profile' && <><Text style={s.eyebrow}>YOUR ACCOUNT</Text><Text style={s.title}>Profile</Text><View style={s.card}><Text style={s.section}>{me?.name}</Text><Text style={s.small}>{me?.email}</Text><Field label="Display name" value={profileName} onChangeText={setProfileName} /><Button label="Save name" onPress={() => perform(async () => { await api('/api/me', token, 'PATCH', { name: profileName }); await refreshBase(token!); })} disabled={!profileName.trim() || busy} /><Button label="Sign out" quiet onPress={signOut} /></View>
        <View style={s.card}><Text style={s.section}>About TV Showdown</Text><Text style={s.muted}>Every spin chooses one person, then one title from their eligible watchlist. Watching series stay in the draw.</Text><Text style={s.muted}>Viewing information is for the United Kingdom. Check the provider before paying.</Text><Text style={s.small}>This product uses the TMDB API but is not endorsed or certified by TMDB. UK viewing data: JustWatch via TMDB.</Text></View></>}
      {busy && <ActivityIndicator color={gold} />}
    </ScrollView>
      {!desktop && <View style={s.bottomNav}>{nav.map((n) => <Pressable key={n.page} accessibilityRole="tab" accessibilityState={{ selected: page === n.page }} onPress={() => { setPage(n.page); setError(''); }} style={s.bottomLink}><Text style={[s.bottomIcon, page === n.page && { color: gold }]}>{n.icon}</Text><Text style={[s.bottomText, page === n.page && { color: gold }]}>{n.label}</Text></Pressable>)}</View>}
    </View>
  </View></View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111114' }, boot: { flex: 1, backgroundColor: '#111114', alignItems: 'center', justifyContent: 'center', gap: 14 }, shell: { flex: 1 }, desktopShell: { flexDirection: 'row' }, main: { flex: 1 }, content: { width: '100%', maxWidth: 1050, alignSelf: 'center', padding: 32, paddingBottom: 90, gap: 18 }, contentMobile: { padding: 18, paddingTop: 26, paddingBottom: 100 },
  brand: { color: '#FFF9F2', fontSize: 19, fontWeight: '900', letterSpacing: 1.4 }, sidebar: { width: 235, backgroundColor: '#1B1A1E', borderRightWidth: 1, borderRightColor: '#343139', padding: 22, paddingTop: 36 }, sideCaption: { color: '#88818B', fontSize: 10, letterSpacing: 2, marginTop: 8, marginBottom: 42 }, sideLink: { padding: 13, flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 12, marginBottom: 5 }, sideLinkActive: { backgroundColor: '#37312B' }, sideIcon: { color: gold, fontSize: 21, width: 23 }, sideText: { color: '#B9B1B9', fontSize: 16, fontWeight: '700' }, sideFooter: { color: '#6F6A70', fontSize: 10, marginTop: 'auto' },
  eyebrow: { color: gold, fontWeight: '800', fontSize: 12, letterSpacing: 2.3 }, title: { color: '#FFF9F4', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 38, lineHeight: 44, fontWeight: '700' }, section: { color: '#FAF7F3', fontSize: 23, fontWeight: '700' }, featuredTitle: { color: '#FFF', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 34, lineHeight: 39 }, white: { color: '#FAF7F3', fontSize: 16, fontWeight: '700' }, goldText: { color: gold, fontSize: 14, fontWeight: '800' }, muted: { color: '#B9B2B8', fontSize: 15, lineHeight: 22 }, small: { color: '#9B959D', fontSize: 13, lineHeight: 19 }, label: { color: '#E1DADD', fontSize: 14, fontWeight: '700' }, intro: { color: '#C1B7BC', fontSize: 18 }, hint: { color: '#E7C287', fontSize: 14, lineHeight: 21 }, footer: { color: '#88818B', textAlign: 'center', marginTop: 25 },
  card: { backgroundColor: '#1E1D21', borderColor: '#3A363D', borderWidth: 1, borderRadius: 20, padding: 20, gap: 15 }, featured: { backgroundColor: '#2B232A', borderColor: '#6B4E47', borderWidth: 1, borderRadius: 22, padding: 22, gap: 16 }, featuredRow: { flexDirection: 'row', gap: 17, alignItems: 'center' }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }, rule: { backgroundColor: '#49434B', height: 1, marginVertical: 4 },
  homeHero: { backgroundColor: '#292126', borderColor: '#654A43', borderWidth: 1, borderRadius: 24, padding: 22, gap: 17 }, homeHeroTitle: { color: '#FFF9F4', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 30, lineHeight: 36, fontWeight: '700' }, homeHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, homePickBadge: { color: '#201A14', backgroundColor: gold, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, homeNotice: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#76603B', backgroundColor: '#352D21', borderRadius: 14, padding: 14 }, homePanels: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, homePanel: { minWidth: 240, flex: 1 }, homeShelf: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, homeTitleCard: { minWidth: 220, flexBasis: 230, flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 15, borderWidth: 1, borderColor: '#39353C', backgroundColor: '#1E1D21', padding: 11 },
  memberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, member: { minWidth: 165, flexBasis: 175, flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: '#29272B', borderWidth: 1, borderColor: '#49444D', borderRadius: 13 }, memberSelected: { borderColor: gold, backgroundColor: '#3A322B' }, avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' }, avatarText: { color: '#201C19', fontSize: 17, fontWeight: '900' }, wheelCard: { backgroundColor: '#211F23', borderRadius: 20, padding: 16, gap: 12, alignItems: 'center' },
  offer: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#48424A', paddingVertical: 10, gap: 10 }, itemCard: { backgroundColor: '#1E1D21', borderColor: '#39353C', borderWidth: 1, borderRadius: 15, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 13 }, listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#3C3740', paddingVertical: 9 }, remove: { color: '#DB999D', fontSize: 13, marginTop: 3 }, preview: { backgroundColor: '#363029', borderRadius: 12, padding: 13, gap: 10 }, code: { color: gold, fontSize: 28, fontWeight: '900', letterSpacing: 4 }, memberLine: { flexDirection: 'row', alignItems: 'center', gap: 11 }, historyStar: { color: gold, backgroundColor: '#463621', fontSize: 23, width: 44, height: 44, borderRadius: 22, textAlign: 'center', lineHeight: 44 },
  bottomNav: { flexDirection: 'row', backgroundColor: '#1E1C21', borderTopWidth: 1, borderTopColor: '#3C3840', paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 20 : 8 }, bottomLink: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2 }, bottomIcon: { color: '#88828A', fontSize: 21 }, bottomText: { color: '#928B93', fontSize: 10, fontWeight: '700' },
  errorBox: { backgroundColor: '#4F3033', borderColor: '#9A6063', borderWidth: 1, borderRadius: 10, padding: 12 }, error: { color: '#FFCECF', fontSize: 14 }, authContent: { flexGrow: 1, width: '100%', maxWidth: 540, alignSelf: 'center', justifyContent: 'center', padding: 25, gap: 20 }, authTitle: { color: '#FFFAF3', fontSize: 72, lineHeight: 74, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
});
