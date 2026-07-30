import React from 'react';
import {ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View} from 'react-native';
import {useSettingsStore} from '@/store/useSettingsStore';
import {SUPPORTED_CITIES} from '@/data/metroData';
import {SUPPORTED_LANGS, useT} from '@/i18n';
import {colors, spacing, typography} from '@/theme/theme';
import {Card, ScreenHeader} from '@/components/common';

export function SettingsScreen() {
  const {notification, privacy, setNotification, setPrivacy, cityId, setCityId, language, setLanguage} =
    useSettingsStore();
  const t = useT();

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('settings.title')} />
      <ScrollView>
        <Text style={styles.group}>{t('settings.langGroup')}</Text>
        <Card style={{paddingVertical: spacing.sm}}>
          {SUPPORTED_LANGS.map((l) => (
            <TouchableOpacity key={l.id} style={styles.cityRow} onPress={() => setLanguage(l.id)} activeOpacity={0.6}>
              <View style={{flex: 1}}>
                <Text style={{color: colors.text, fontSize: typography.body, fontWeight: language === l.id ? '700' : '400'}}>
                  {l.label}
                </Text>
                <Text style={{color: colors.textFaint, fontSize: typography.caption}}>{l.labelEn}</Text>
              </View>
              {language === l.id && (
                <View style={styles.check}>
                  <Text style={{color: colors.white, fontSize: 12, fontWeight: '800'}}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </Card>

        <Text style={styles.group}>{t('settings.cityGroup')}</Text>
        <Card style={{paddingVertical: spacing.sm}}>
          {SUPPORTED_CITIES.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.cityRow}
              onPress={() => setCityId(c.id)}
              activeOpacity={0.6}>
              <View style={{flex: 1}}>
                <Text style={{color: colors.text, fontSize: typography.body, fontWeight: cityId === c.id ? '700' : '400'}}>
                  {c.name}
                </Text>
                <Text style={{color: colors.textFaint, fontSize: typography.caption}}>{c.nameEn}</Text>
              </View>
              {cityId === c.id && (
                <View style={styles.check}>
                  <Text style={{color: colors.white, fontSize: 12, fontWeight: '800'}}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </Card>

        <Text style={styles.group}>{t('settings.notifGroup')}</Text>
        <Card style={{paddingVertical: spacing.sm}}>
          <Toggle label={t('settings.tripAlert')} value={notification.tripAlert} onToggle={(v) => setNotification({tripAlert: v})} />
          <Toggle label={t('settings.activityPush')} value={notification.activityPush} onToggle={(v) => setNotification({activityPush: v})} />
          <Toggle label={t('settings.airdropAlert')} value={notification.airdropAlert} onToggle={(v) => setNotification({airdropAlert: v})} />
        </Card>

        <Text style={styles.group}>{t('settings.privacyGroup')}</Text>
        <Card style={{paddingVertical: spacing.sm}}>
          <Toggle label={t('settings.location')} value={privacy.locationEnabled} onToggle={(v) => setPrivacy({locationEnabled: v})} />
          <Toggle label={t('settings.dataSharing')} value={privacy.dataSharing} onToggle={(v) => setPrivacy({dataSharing: v})} />
        </Card>

        <Text style={{fontSize: typography.caption, color: colors.textSub, margin: spacing.lg}}>
          {t('settings.footer')}
        </Text>
      </ScrollView>
    </View>
  );
}

function Toggle({label, value, onToggle}: {label: string; value: boolean; onToggle: (v: boolean) => void}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={{flex: 1, color: colors.text, fontSize: typography.body}}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{false: '#D6DAE3', true: colors.primary + '66'}}
        thumbColor={value ? colors.primary : '#f4f4f5'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    fontSize: typography.caption,
    color: colors.textFaint,
    marginHorizontal: spacing.xl,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  toggleRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm},
  cityRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm},
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
