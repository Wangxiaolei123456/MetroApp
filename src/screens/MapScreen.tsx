import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GeoPoint, Station} from '@/types';
import {getCityGraph} from '@/data/metroData';
import {watchLocation} from '@/services/location';
import {findEnclosingStation, findNearestStation} from '@/services/geofence';
import {usePlanStore} from '@/store/usePlanStore';
import {useSettingsStore} from '@/store/useSettingsStore';
import {ThemeColors, radius, spacing, typography} from '@/theme/theme';
import {useTheme, useThemedStyles} from '@/theme/ThemeProvider';
import {Button, Chip} from '@/components/common';
import {useT} from '@/i18n';

export function MapScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const t = useT();
  const {colors, isDark} = useTheme();
  const styles = useThemedStyles(makeStyles);
  const cityId = useSettingsStore((s) => s.cityId);
  const graph = getCityGraph(cityId);
  const [loc, setLoc] = useState<GeoPoint>(graph.city.center);
  const [here, setHere] = useState<Station | null>(null);
  const mapRef = useRef<MapView>(null);
  const plan = usePlanStore((s) => s.plan);

  useEffect(() => {
    setLoc(graph.city.center);
    setHere(null);
    const w = watchLocation((p) => {
      setLoc(p);
      setHere(findEnclosingStation(graph, p));
    });
    return () => w.remove();
  }, [cityId]);

  const nearest = findNearestStation(graph, loc);

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        key={`${cityId}-${isDark}`}
        style={StyleSheet.absoluteFill}
        customMapStyle={isDark ? DARK_MAP_STYLE : undefined}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        initialRegion={{
          latitude: graph.city.center.latitude,
          longitude: graph.city.center.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}>
        {plan &&
          plan.legs.map((leg, i) => {
            const coords =
              leg.path ??
              leg.stationIds
                .map((id) => graph.stations.find((s) => s.id === id)?.location)
                .filter((p): p is GeoPoint => p != null);
            if (coords.length < 2) return null;
            return (
              <Polyline
                key={'leg' + i}
                coordinates={coords}
                strokeColor={leg.lineColor}
                strokeWidth={5}
              />
            );
          })}
        {plan && (
          <Marker
            coordinate={graph.stations.find((s) => s.id === plan.fromStationId)!.location}
            pinColor={colors.primary}
            title={t('common.origin')}
          />
        )}
        {plan && (
          <Marker
            coordinate={graph.stations.find((s) => s.id === plan.toStationId)!.location}
            pinColor={colors.danger}
            title={t('common.destination')}
          />
        )}
        <Marker coordinate={loc} title={t('common.myLocation')} />
      </MapView>

      <View style={[styles.overlay, {paddingBottom: Math.max(insets.bottom, spacing.lg)}]}>
        <View style={styles.statusCard}>
          <View style={styles.statusTop}>
            <View style={[styles.statusDot, {backgroundColor: here ? colors.go : colors.textFaint}]} />
            <Text style={styles.statusLabel}>
              {here ? t('map.inStation') : t('map.notInStation')}
            </Text>
            <View style={{flex: 1}} />
            {here?.isTransfer && <Chip text={t('common.transfer')} color={colors.warning} />}
          </View>
          <Text style={styles.stationName}>
            {here ? here.name : t('map.nearest', {name: nearest.station.name})}
          </Text>
          {!here && (
            <Text style={styles.meta}>
              {Math.round(nearest.distance)} m
            </Text>
          )}
          <View style={styles.btnRow}>
            <Button
              title={t('map.planRoute')}
              onPress={() => navigation.navigate('RoutePlan')}
              style={{flex: 1, marginHorizontal: 0, marginBottom: 0}}
            />
            <Button
              title={t('map.startOrViewTrip')}
              variant="go"
              onPress={() => navigation.navigate('Trip')}
              style={{flex: 1, marginHorizontal: 0, marginBottom: 0}}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

/** Google Maps 深色样式，与应用画布统一 */
const DARK_MAP_STYLE = [
  {elementType: 'geometry', stylers: [{color: '#0B0F17'}]},
  {elementType: 'labels.text.fill', stylers: [{color: '#8B95A8'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#0B0F17'}]},
  {featureType: 'road', elementType: 'geometry', stylers: [{color: '#1C2433'}]},
  {featureType: 'road', elementType: 'geometry.stroke', stylers: [{color: '#141A24'}]},
  {featureType: 'water', elementType: 'geometry', stylers: [{color: '#06090F'}]},
  {featureType: 'poi', elementType: 'geometry', stylers: [{color: '#141A24'}]},
  {featureType: 'poi', elementType: 'labels.text.fill', stylers: [{color: '#5C6678'}]},
  {featureType: 'transit', elementType: 'geometry', stylers: [{color: '#1C2433'}]},
  {featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{color: '#3D7EFF'}]},
];

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing.lg,
    },
    statusCard: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    statusTop: {flexDirection: 'row', alignItems: 'center'},
    statusDot: {width: 8, height: 8, borderRadius: 4, marginRight: 6},
    statusLabel: {
      fontSize: typography.caption,
      color: colors.textSub,
      fontWeight: '600',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    stationName: {
      fontSize: 22,
      fontWeight: '800',
      marginTop: spacing.sm,
      color: colors.text,
      letterSpacing: -0.3,
    },
    meta: {
      fontSize: typography.sub,
      color: colors.textFaint,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    btnRow: {flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg},
  });
}
