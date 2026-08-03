import React, {useEffect, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {usePointsStore, selectPointsStats} from '@/store/usePointsStore';
import {useUserStore} from '@/store/useUserStore';
import {useWalletStore} from '@/store/useWalletStore';
import {checkAll, claimAirdrop} from '@/services/airdropService';
import {fetchAirdropRules} from '@/services/opsService';
import {SAMPLE_AIRDROPS} from '@/data/opsSample';
import {ThemeColors, spacing, typography} from '@/theme/theme';
import {useTheme, useThemedStyles} from '@/theme/ThemeProvider';
import {Button, Card, Chip, ProgressBar, ScreenHeader} from '@/components/common';
import {useT} from '@/i18n';

export function AirdropScreen() {
  const navigation = useNavigation<any>();
  const t = useT();
  const {colors} = useTheme();
  const styles = useThemedStyles(makeStyles);
  const stats = usePointsStore(selectPointsStats);
  const profile = useUserStore((s) => s.profile);
  const walletMeta = useWalletStore((s) => s.meta);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  // H4 空投规则：从后端拉取，失败回落本地种子
  const [rules, setRules] = useState(SAMPLE_AIRDROPS);

  useEffect(() => {
    let alive = true;
    fetchAirdropRules().then((r) => alive && setRules(r));
    return () => {
      alive = false;
    };
  }, []);

  const activeDays = profile
    ? Math.max(1, Math.round((Date.now() - profile.createdAt) / 86400000))
    : 1;

  const eligibility = useMemo(
    () => checkAll({pointsBalance: stats.balance, totalStops: profile?.totalStops ?? 0, activeDays}, rules),
    [stats.balance, profile?.totalStops, activeDays, rules],
  );

  const handleClaim = async (ruleId: string) => {
    if (!walletMeta) {
      setResult(t('airdrop.needWallet'));
      return;
    }
    const rule = eligibility.find((e) => e.rule.id === ruleId)?.rule;
    if (!rule) return;
    setClaiming(ruleId);
    try {
      const r = await claimAirdrop(rule, walletMeta.address); // F2 链上签名领取
      setResult(t('airdrop.claimOk', {n: r.amount, tx: r.txHash}));
    } catch (e) {
      setResult(t('airdrop.claimFail', {msg: (e as Error).message}));
    } finally {
      setClaiming(null);
    }
  };

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('airdrop.title')} subtitle={t('airdrop.subtitle')} />
      <ScrollView contentContainerStyle={{paddingBottom: spacing.xl}}>
        {result && (
          <Card style={{backgroundColor: colors.successSoft}}>
            <Text style={{color: colors.success, fontWeight: '600'}}>{result}</Text>
          </Card>
        )}

        {eligibility.map(({rule, eligible, reasons}) => {
          const pct = Math.round((rule.distributed / rule.totalAmount) * 100);
          return (
            <Card key={rule.id}>
              <View style={styles.head}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1}}>
                  <Text style={{fontSize: 20}}>🎁</Text>
                  <Text style={{fontSize: typography.h2, fontWeight: '700', color: colors.text, flex: 1}} numberOfLines={1}>
                    {rule.name}
                  </Text>
                </View>
                <Chip text={eligible ? t('airdrop.eligible') : t('airdrop.notEligible')} color={eligible ? colors.success : colors.danger} />
              </View>
              <Text style={{color: colors.textSub, fontSize: typography.sub, marginVertical: spacing.xs, lineHeight: 18}}>
                {t('airdrop.ruleLine', {n: rule.perUserAmount, p: rule.minPoints, s: rule.minStops, d: rule.minActiveDays})}
              </Text>

              {/* F6 公示 */}
              <ProgressBar pct={pct} style={{marginTop: spacing.sm}} />
              <Text style={{fontSize: typography.caption, color: colors.textFaint, marginTop: spacing.xs}}>
                {t('airdrop.distributed', {a: rule.distributed, b: rule.totalAmount, pct})}
              </Text>

              {!eligible && reasons.length > 0 && (
                <View style={styles.reasonBox}>
                  <Text style={{color: colors.danger, fontSize: typography.caption, lineHeight: 16}}>
                    {t('airdrop.reasons', {reasons: reasons.join('，')})}
                  </Text>
                </View>
              )}
              <Button
                title={claiming === rule.id ? t('airdrop.signing') : eligible ? t('airdrop.claim') : t('airdrop.notEligible')}
                disabled={!eligible}
                loading={claiming === rule.id}
                onPress={() => handleClaim(rule.id)}
                style={{marginHorizontal: 0, marginTop: spacing.md, marginBottom: 0}}
              />
            </Card>
          );
        })}

        <Button title={t('airdrop.viewRank')} variant="soft" onPress={() => navigation.navigate('Rank')} />
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    head: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm},
    reasonBox: {
      backgroundColor: colors.dangerSoft,
      borderRadius: 10,
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
  });
}
