import React, {useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {getCityGraph} from '@/data/metroData';
import {useSettingsStore} from '@/store/useSettingsStore';
import {ThemeColors, spacing, typography} from '@/theme/theme';
import {useTheme, useThemedStyles} from '@/theme/ThemeProvider';
import {Chip} from '@/components/common';
import {useT} from '@/i18n';
import {Station} from '@/types';

/**
 * 车站线路浏览页：
 * 一级 -> 展示当前城市所有线路；
 * 二级 -> 展示某条线路的所有站点，点击站点即设为行程终点并返回。
 */
export function StationInfoScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const t = useT();
  const {colors} = useTheme();
  const styles = useThemedStyles(makeStyles);
  const cityId = useSettingsStore((s) => s.cityId);
  const graph = getCityGraph(cityId);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  const selectedLine = selectedLineId
    ? graph.lines.find((l) => l.id === selectedLineId) ?? null
    : null;

  const stationsOfLine = selectedLine
    ? selectedLine.stationIds
        .map((id) => graph.stations.find((s) => s.id === id))
        .filter((s): s is Station => Boolean(s))
    : [];

  const chooseStation = (station: Station) => {
    navigation.navigate('RoutePlan', {
      toStationId: station.id,
      toStationName: station.name,
    });
  };

  const goBack = () => (selectedLine ? setSelectedLineId(null) : navigation.goBack());

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      {/* 顶部栏：一级返回上一页，二级返回线路列表 */}
      <View style={[styles.header, {paddingTop: insets.top + spacing.sm}]}>
        <Pressable
          onPress={goBack}
          hitSlop={8}
          style={({pressed}) => [
            {
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.elevated,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: spacing.md,
              opacity: pressed ? 0.7 : 1,
            },
          ]}>
          <Text style={{fontSize: 20, color: colors.text, marginTop: -2}}>‹</Text>
        </Pressable>
        <View style={{flex: 1}}>
          <Text style={styles.headerTitle}>
            {selectedLine ? selectedLine.name : t('stationInfo.title')}
          </Text>
          <Text style={styles.headerSub}>
            {selectedLine
              ? t('stationInfo.lineStations', {
                  name: selectedLine.name,
                  n: selectedLine.stationIds.length,
                })
              : t('stationInfo.subtitle')}
          </Text>
        </View>
      </View>

      {selectedLine ? (
        <FlatList
          data={stationsOfLine}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          renderItem={({item}) => (
            <Pressable
              onPress={() => chooseStation(item)}
              style={({pressed}) => [styles.stationRow, pressed && {backgroundColor: colors.pressed}]}>
              <View style={[styles.dot, {backgroundColor: selectedLine.color}]} />
              <View style={{flex: 1, marginLeft: spacing.md}}>
                <Text style={styles.stationName}>{item.name}</Text>
                {item.isTransfer && (
                  <Text style={styles.transferTag}>{t('common.transfer')}</Text>
                )}
              </View>
              <Chip text={t('stationInfo.setDestination')} color={colors.primary} />
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={graph.lines}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          renderItem={({item}) => (
            <Pressable
              onPress={() => setSelectedLineId(item.id)}
              style={({pressed}) => [styles.lineRow, pressed && {backgroundColor: colors.pressed}]}>
              <View style={[styles.dot, {backgroundColor: item.color}]} />
              <View style={{flex: 1, marginLeft: spacing.md}}>
                <Text style={styles.lineName}>{item.name}</Text>
              </View>
              <Text style={styles.count}>
                {t('stationInfo.stationsCount', {n: item.stationIds.length})}
              </Text>
              <Text style={{color: colors.textFaint, fontSize: 18, marginLeft: spacing.sm}}>›</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    headerTitle: {
      fontSize: typography.title,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 0.2,
    },
    headerSub: {
      fontSize: typography.sub,
      color: colors.textSub,
      marginTop: 2,
    },
    list: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
    },
    lineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    stationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    lineName: {
      fontSize: typography.body,
      fontWeight: '600',
      color: colors.text,
    },
    stationName: {
      fontSize: typography.body,
      fontWeight: '600',
      color: colors.text,
    },
    transferTag: {
      fontSize: typography.caption,
      color: colors.warning,
      marginTop: 2,
    },
    count: {
      fontSize: typography.sub,
      color: colors.textSub,
    },
  });
}
