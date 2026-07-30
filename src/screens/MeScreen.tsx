import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useUserStore} from '@/store/useUserStore';
import {colors, radius, shadows, spacing, typography} from '@/theme/theme';
import {Button, HeroCard, ListItem, ScreenHeader, Stat} from '@/components/common';
import {TKey, useT} from '@/i18n';

const MENU: {labelKey: TKey; target: string; icon: string; color: string}[] = [
  {labelKey: 'me.menu.points', target: 'Points', icon: '🏅', color: colors.gold},
  {labelKey: 'me.menu.wallet', target: 'Wallet', icon: '👛', color: colors.primary},
  {labelKey: 'me.menu.airdrop', target: 'Airdrop', icon: '🎁', color: colors.accent},
  {labelKey: 'me.menu.tasks', target: 'Tasks', icon: '📋', color: colors.success},
  {labelKey: 'me.menu.activities', target: 'Activities', icon: '📍', color: colors.warning},
  {labelKey: 'me.menu.rank', target: 'Rank', icon: '🏆', color: colors.bronze},
  {labelKey: 'me.menu.settings', target: 'Settings', icon: '⚙️', color: colors.textSub},
  {labelKey: 'me.menu.help', target: 'Help', icon: '💬', color: colors.primaryDark},
];

export function MeScreen() {
  const navigation = useNavigation<any>();
  const t = useT();
  const profile = useUserStore((s) => s.profile);
  const login = useUserStore((s) => s.login);
  const logout = useUserStore((s) => s.logout);
  const inviteCode = (profile?.id ?? 'METRO').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('me.title')} />
      <ScrollView contentContainerStyle={{paddingBottom: spacing.xl}}>
        <HeroCard>
          {!profile ? (
            <>
              <Text style={{color: colors.white, fontSize: 20, fontWeight: '800'}}>
                {t('me.notLoggedIn')}
              </Text>
              <Text style={{color: 'rgba(255,255,255,0.85)', marginTop: spacing.xs, marginBottom: spacing.lg, fontSize: typography.sub, lineHeight: 19}}>
                {t('me.loginHint')}
              </Text>
              <Button
                title={t('me.guestLogin')}
                onPress={() => login('guest')}
                style={{marginHorizontal: 0, backgroundColor: colors.white}}
              />
              <Button
                title={t('me.phoneLogin')}
                variant="ghost"
                onPress={() => login('phone', {phone: '138****0000', name: '手机用户'})}
                style={{marginHorizontal: 0, marginBottom: 0, backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.6)'}}
              />
            </>
          ) : (
            <>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View style={styles.avatar}>
                  <Text style={{fontSize: 22, fontWeight: '800', color: colors.primary}}>
                    {profile.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{marginLeft: spacing.md, flex: 1}}>
                  <Text style={{color: colors.white, fontSize: 19, fontWeight: '800'}}>
                    {profile.name}
                  </Text>
                  <Text style={{color: 'rgba(255,255,255,0.8)', fontSize: typography.caption, marginTop: 2}}>
                    {profile.provider === 'guest' ? t('me.guestMode') : t('me.loggedIn')} ·{' '}
                    {profile.walletAddress ? t('me.walletBound') : t('me.walletUnbound')}
                  </Text>
                </View>
              </View>
              <View style={styles.statRow}>
                <Stat value={String(profile.totalRides)} label={t('me.statRides')} color={colors.white} />
                <View style={styles.statDivider} />
                <Stat value={String(profile.totalStops)} label={t('me.statStops')} color={colors.white} />
              </View>
            </>
          )}
        </HeroCard>

        {profile && (
          <View style={[styles.groupCard, {paddingVertical: spacing.lg, alignItems: 'center'}]}>
            <Text style={{fontWeight: '700', color: colors.textSub, fontSize: typography.sub}}>
              {t('me.inviteCode')}
            </Text>
            <Text style={{fontSize: 28, fontWeight: '800', color: colors.primary, letterSpacing: 4, marginVertical: spacing.xs}}>
              {inviteCode}
            </Text>
            <Text style={{color: colors.textFaint, fontSize: typography.caption, textAlign: 'center'}}>
              {t('me.inviteHint')}
            </Text>
          </View>
        )}

        <View style={styles.groupCard}>
          {MENU.map((m, i) => (
            <ListItem
              key={m.target}
              icon={m.icon}
              color={m.color}
              label={t(m.labelKey)}
              last={i === MENU.length - 1}
              onPress={() => navigation.navigate(m.target)}
            />
          ))}
        </View>

        {profile && (
          <Button title={t('me.logout')} variant="danger" onPress={() => logout()} style={{marginTop: spacing.sm}} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  statDivider: {width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.25)'},
  groupCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.card,
  },
});
