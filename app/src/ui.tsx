import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { Kind, Member } from './api';

export const gold = '#F4C567';
const colours = ['#F4C567', '#D390A7', '#9EB8C1', '#A997CE', '#D98B74', '#93B9A6', '#D5B380', '#8C9FBE'];
export const kindLabel = (kind: Kind) => kind === 'movie' ? 'Film' : 'Series';
export const posterUrl = (path?: string | null) => path ? `https://image.tmdb.org/t/p/w342${path}` : null;

export function Button({ label, onPress, quiet = false, disabled = false }: { label: string; onPress: () => void; quiet?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, quiet && s.buttonQuiet, disabled && s.disabled, pressed && s.pressed]}>
    <Text style={[s.buttonText, quiet && s.buttonTextQuiet]}>{label}</Text>
  </Pressable>;
}
export function Field({ label, value, onChangeText, placeholder, secure = false, email = false, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; secure?: boolean; email?: boolean; multiline?: boolean }) {
  return <View style={{ gap: 7 }}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={[s.input, multiline && s.textArea]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#88838B" secureTextEntry={secure} keyboardType={email ? 'email-address' : 'default'} autoCapitalize={email ? 'none' : 'sentences'} multiline={multiline} numberOfLines={multiline ? 4 : 1} textAlignVertical={multiline ? 'top' : 'center'} /></View>;
}
export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[s.chip, active && s.chipActive]}><Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text></Pressable>;
}
export function Poster({ title, path, size = 72 }: { title: string; path?: string | null; size?: number }) {
  const uri = posterUrl(path);
  return uri ? <Image accessibilityLabel={`Poster for ${title}`} source={{ uri }} style={{ width: size, height: size * 1.43, borderRadius: 8, backgroundColor: '#483A43' }} />
    : <View style={[s.poster, { width: size, height: size * 1.43 }]}><Text style={s.posterStar}>✦</Text><Text style={s.posterTitle} numberOfLines={3}>{title}</Text></View>;
}

export function Wheel({ members, winnerId, spinning }: { members: Member[]; winnerId?: string; spinning?: boolean }) {
  const rotation = useRef(new Animated.Value(0)).current;
  const ids = members.map((m) => m.profileId).join(',');
  useEffect(() => {
    rotation.setValue(0);
    if (!spinning || !winnerId || !members.length) return;
    const slice = 360 / members.length;
    const index = members.findIndex((m) => m.profileId === winnerId);
    Animated.timing(rotation, { toValue: 1800 - (index + 0.5) * slice, duration: 2700, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [ids, winnerId, spinning]);
  const turn = rotation.interpolate({ inputRange: [0, 2160], outputRange: ['0deg', '2160deg'] });
  const n = Math.max(1, members.length), slice = 360 / n, size = 248, radius = 118, centre = size / 2;
  const point = (angle: number, r: number) => ({ x: centre + r * Math.cos(angle * Math.PI / 180), y: centre + r * Math.sin(angle * Math.PI / 180) });
  return <View style={s.wheelWrap} accessibilityLabel={`Profile wheel: ${members.map((m) => m.name).join(', ')}`}>
    <View style={s.pointer} /><Animated.View style={{ transform: [{ rotate: turn }] }}><Svg width={size} height={size}>
      {members.map((m, i) => {
        const a = point(-90 + i * slice, radius), b = point(-90 + (i + 1) * slice, radius), label = point(-90 + (i + 0.5) * slice, radius * 0.66);
        const d = n === 1 ? `M ${centre} ${centre - radius} A ${radius} ${radius} 0 1 1 ${centre - .01} ${centre - radius} Z` : `M ${centre} ${centre} L ${a.x} ${a.y} A ${radius} ${radius} 0 ${slice > 180 ? 1 : 0} 1 ${b.x} ${b.y} Z`;
        return <React.Fragment key={m.profileId}><Path d={d} fill={colours[i % colours.length]} stroke="#151518" strokeWidth={4} /><SvgText x={label.x} y={label.y} textAnchor="middle" alignmentBaseline="middle" fill="#181719" fontWeight="700" fontSize={n > 7 ? 10 : 14}>{m.name.slice(0, n > 7 ? 7 : 10)}</SvgText></React.Fragment>;
      })}
      <Circle cx={centre} cy={centre} r={24} fill="#161619" /><Circle cx={centre} cy={centre} r={9} fill={gold} />
    </Svg></Animated.View>
  </View>;
}

const s = StyleSheet.create({
  button: { alignSelf: 'flex-start', backgroundColor: gold, borderRadius: 13, paddingHorizontal: 19, paddingVertical: 13, minHeight: 46, justifyContent: 'center', alignItems: 'center' },
  buttonQuiet: { backgroundColor: '#2C2A2E', borderWidth: 1, borderColor: '#66616A' }, buttonText: { color: '#171519', fontWeight: '800', fontSize: 15 }, buttonTextQuiet: { color: '#F2EEF0' }, disabled: { opacity: .4 }, pressed: { opacity: .75 },
  label: { color: '#E0DBDB', fontSize: 14, fontWeight: '700' }, input: { color: '#FCF9F3', backgroundColor: '#28262A', borderWidth: 1, borderColor: '#5A535D', borderRadius: 11, paddingHorizontal: 13, minHeight: 46, fontSize: 16 }, textArea: { minHeight: 104, paddingTop: 12 },
  chip: { borderWidth: 1, borderColor: '#55515B', borderRadius: 24, backgroundColor: '#28262B', paddingHorizontal: 13, paddingVertical: 9 }, chipActive: { backgroundColor: '#58472D', borderColor: gold }, chipText: { color: '#C6C0C5', fontSize: 13, fontWeight: '700' }, chipTextActive: { color: '#FFE5B0' },
  poster: { backgroundColor: '#493540', borderRadius: 8, alignItems: 'center', justifyContent: 'space-around', padding: 5 }, posterStar: { color: gold, fontSize: 21 }, posterTitle: { color: '#FFF8EC', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  wheelWrap: { alignSelf: 'center', paddingTop: 13 }, pointer: { position: 'absolute', zIndex: 3, top: 0, left: '50%', marginLeft: -11, width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderTopWidth: 20, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: gold },
});
