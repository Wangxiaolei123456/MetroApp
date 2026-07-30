import React, {useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import MapView, {Marker, Polyline, PROVIDER_GOOGLE} from 'react-native-maps';
import {useNavigation} from '@react-navigation/native';
import {GeoPoint, Station} from '@/types';
import {getCityGraph} from '@/data/metroData';
import {watchLocation} from '@/services/location';
import {findEnclosingStation, findNearestStation} from '@/services/geofence';
import {usePlanStore} from '@/store/usePlanStore';
import {useSettingsStore} from '@/store/useSettingsStore';
import {colors, radius, shadows, spacing, typography} from '@/theme/theme';
import {Button, Chip} from '@/components/common';
import {useT} from '@/i18n';

export function MapScreen() {
  const navigation = useNavigation<any>();
  const t = useT();
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

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        key={cityId}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: graph.city.center.latitude,
          longitude: graph.city.center.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}>
        {plan &&
          plan.legs.map((leg, i) => (
            <Polyline
              key={'leg' + i}
              coordinates={leg.stationIds.map(
                (id) => graph.stations.find((s) => s.id === id)!.location,
              )}
              strokeColor={leg.lineColor}
              strokeWidth={5}
            />
          ))}
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

      {/* 当前状态浮层 */}
      <View style={styles.overlay}>
        <View style={styles.statusCard}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <View style={[styles.statusDot, {backgroundColor: here ? colors.success : colors.textFaint}]} />
            <Text style={{fontSize: typography.caption, color: colors.textSub, fontWeight: '600'}}>
              {here ? t('map.inStation') : t('map.notInStation')}
            </Text>
            <View style={{flex: 1}} />
            {here && here.isTransfer && <Chip text={t('common.transfer')} color={colors.warning} />}
          </View>
          <Text style={{fontSize: 19, fontWeight: '800', marginTop: spacing.xs, color: colors.text}}>
            {here ? here.name : t('map.nearest', {name: findNearestStation(graph, loc).station.name})}
          </Text>
          <View style={styles.btnRow}>
            <Button
              title={t('map.planRoute')}
              onPress={() => navigation.navigate('RoutePlan')}
              style={{flex: 1, marginHorizontal: 0, marginBottom: 0}}
            />
            <Button
              title={t('map.startOrViewTrip')}
              variant="soft"
              onPress={() => navigation.navigate('Trip')}
              style={{flex: 1, marginHorizontal: 0, marginBottom: 0}}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
  },
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.float,
  },
  statusDot: {width: 8, height: 8, borderRadius: 4, marginRight: 6},
  btnRow: {flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg},
});
