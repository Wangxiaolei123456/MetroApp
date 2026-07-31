import React from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {useTripStore} from '@/store/useTripStore';
import {clearStationAlert} from '@/services/arrivalAnnounce';
import {useTheme} from '@/theme/ThemeProvider';
import {radius, spacing, typography} from '@/theme/theme';
import {useT} from '@/i18n';
import {StationAlertKind} from '@/types';

function titleFor(kind: StationAlertKind, t: ReturnType<typeof useT>): string {
  switch (kind) {
    case 'destination':
      return t('trip.alert.titleDestination');
    case 'transfer':
      return t('trip.alert.titleTransfer');
    case 'boarded':
      return t('trip.alert.titleBoarded');
    default:
      return t('trip.alert.titleArrival');
  }
}

function accentFor(
  kind: StationAlertKind,
  colors: {go: string; warning: string; primary: string},
): string {
  if (kind === 'destination' || kind === 'boarded') return colors.go;
  if (kind === 'transfer') return colors.warning;
  return colors.primary;
}

/** 全局到站/换乘弹窗：任意页面可见 */
export function StationAlertModal() {
  const t = useT();
  const {colors} = useTheme();
  const alert = useTripStore((s) => s.stationAlert);
  if (!alert) return null;

  const accent = accentFor(alert.kind, colors);

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={clearStationAlert}>
      <Pressable style={styles.backdrop} onPress={clearStationAlert}>
        <Pressable
          style={[styles.card, {backgroundColor: colors.card, borderColor: colors.borderStrong}]}
          onPress={(e) => e.stopPropagation()}>
          <View style={[styles.accentBar, {backgroundColor: accent}]} />
          <Text style={[styles.kicker, {color: accent}]}>{titleFor(alert.kind, t)}</Text>
          <Text style={[styles.message, {color: colors.text}]}>{alert.message}</Text>
          {!!alert.nextLineName && (
            <Text style={[styles.sub, {color: colors.textSub}]}>
              {t('trip.alert.nextLine', {line: alert.nextLineName})}
            </Text>
          )}
          <Pressable
            onPress={clearStationAlert}
            style={({pressed}) => [
              styles.btn,
              {backgroundColor: accent, opacity: pressed ? 0.85 : 1},
            ]}>
            <Text style={styles.btnText}>{t('trip.alert.gotIt')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  kicker: {
    fontSize: typography.caption,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: typography.h2,
    fontWeight: '700',
    lineHeight: 24,
  },
  sub: {
    marginTop: spacing.sm,
    fontSize: typography.sub,
    lineHeight: 20,
  },
  btn: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: typography.body,
  },
});
