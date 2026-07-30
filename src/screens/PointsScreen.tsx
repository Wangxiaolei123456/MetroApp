import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {usePointsStore, selectPointsStats} from '@/store/usePointsStore';
import {useUserStore} from '@/store/useUserStore';
import {currentLevel, nextLevel} from '@/services/pointsEngine';
import {BADGES} from '@/data/mockData';
import {PointsSource} from '@/types';
import {ThemeColors, spacing, typography} from '@/theme/theme';
import {useTheme, useThemedStyles} from '@/theme/ThemeProvider';
import {Card, Chip, Empty, HeroCard, ProgressBar, ScreenHeader, SectionTitle} from '@/components/common';
import {CrossfadeNumber, FadeInUp} from '@/components/motion';
import {TKey, useT} from '@/i18n';

const SOURCE_KEY: Record<PointsSource, TKey> = {
  ride: 'points.source.ride',
  transfer: 'points.source.transfer',
  long_distance: 'points.source.long_distance',
  activity_checkin: 'points.source.activity_checkin',
  task: 'points.source.task',
  invite: 'points.source.invite',
  newbie: 'points.source.newbie',
  airdrop_exchange: 'points.source.airdrop_exchange',
};

export function PointsScreen() {
  const t = useT();
  const {colors} = useTheme();
  const styles = useThemedStyles(makeStyles);
  const stats = usePointsStore(selectPointsStats);
  const txs = usePointsStore((s) => s.txs);
  const profile = useUserStore((s) => s.profile);
  const level = currentLevel(profile?.totalStops ?? 0);
  const next = nextLevel(profile?.totalStops ?? 0);
  const progress = next
    ? Math.min(100, Math.round(((profile?.totalStops ?? 0) / next.minTotalStops) * 100))
    : 100;

  const badges = BADGES.map((b) => ({
    ...b,
    unlocked:
      (b.id === 'b_first' && (profile?.totalRides ?? 0) > 0) ||
      (b.id === 'b_transfer') ||
      (b.id === 'b_10' && (profile?.totalStops ?? 0) >= 10) ||
      (b.id === 'b_wallet' && !!profile?.walletAddress) ||
      (b.id === 'b_invite'),
  }));

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('points.title')} subtitle={t('points.subtitle')} />
      <ScrollView>
        <FadeInUp>
          <HeroCard>
            <Text
              style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: typography.sub,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}>
              {t('points.balance')}
            </Text>
            <CrossfadeNumber
              value={stats.balance}
              height={52}
              style={{
                color: colors.textOnBrand,
                fontSize: 44,
                fontWeight: '800',
                letterSpacing: -0.5,
                fontVariant: ['tabular-nums'],
              }}
            />
            <View style={styles.row}>
              <View style={styles.pill}>
                <Text style={styles.pillText}>{t('points.totalEarned', {n: stats.totalEarned})}</Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillText}>{t('points.locked', {n: stats.lockedBalance})}</Text>
              </View>
            </View>
          </HeroCard>
        </FadeInUp>

        <Card>
          <View style={styles.levelHead}>
            <Text style={{fontSize: typography.h2, fontWeight: '700', color: colors.text}}>
              Lv.{level.level} {level.name}
            </Text>
            {next && <Chip text={t('points.nextLevel', {name: next.name})} />}
          </View>
          <ProgressBar pct={progress} style={{marginTop: spacing.md}} />
          <Text style={{fontSize: typography.caption, color: colors.textSub, marginTop: spacing.sm}}>
            {t('points.progressStops', {n: profile?.totalStops ?? 0})}
            {next ? t('points.progressNeed', {n: next.minTotalStops}) : t('points.maxLevel')}
          </Text>
        </Card>

        <Card>
          <Text style={{fontWeight: '700', color: colors.text, marginBottom: spacing.md, fontSize: typography.h2}}>
            {t('points.badges')}
          </Text>
          <View style={styles.badgeRow}>
            {badges.map((b) => (
              <View key={b.id} style={styles.badge}>
                <View style={[styles.badgeBubble, !b.unlocked && {backgroundColor: colors.background}]}>
                  <Text style={{fontSize: 26, opacity: b.unlocked ? 1 : 0.3}}>{b.icon}</Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: typography.caption,
                    marginTop: 4,
                    color: b.unlocked ? colors.text : colors.textFaint,
                  }}>
                  {b.name}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <SectionTitle>{t('points.txs', {n: txs.length})}</SectionTitle>
        {txs.length === 0 ? (
          <Empty text={t('points.empty')} icon="🪙" />
        ) : (
          txs
            .slice()
            .reverse()
            .map((tx) => (
              <Card key={tx.id} style={{padding: spacing.md, marginBottom: spacing.sm}}>
                <View style={styles.txRow}>
                  <View style={{flex: 1, marginRight: spacing.md}}>
                    <Text style={{color: colors.text, fontWeight: '600'}}>
                      {tx.note ?? t(SOURCE_KEY[tx.source])}
                    </Text>
                    <Text style={{color: colors.textFaint, fontSize: typography.caption, marginTop: 2}}>
                      {new Date(tx.createdAt).toLocaleString()}
                      {tx.locked ? t('points.lockedTag') : ''}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontWeight: '800',
                      fontSize: 16,
                      color: tx.amount > 0 ? colors.success : colors.danger,
                    }}>
                    {tx.amount > 0 ? '+' : ''}
                    {tx.amount}
                  </Text>
                </View>
              </Card>
            ))
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm},
    pill: {
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderRadius: 999,
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
    },
    pillText: {color: colors.white, fontSize: typography.caption, fontWeight: '600'},
    levelHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
    badgeRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md},
    badge: {alignItems: 'center', width: 64},
    badgeBubble: {
      width: 52,
      height: 52,
      borderRadius: 18,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary + '44',
      alignItems: 'center',
      justifyContent: 'center',
    },
    txRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  });
}
