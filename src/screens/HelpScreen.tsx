import React, {useState} from 'react';
import {ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {colors, spacing, typography} from '@/theme/theme';
import {Button, Card, ScreenHeader} from '@/components/common';
import {TKey, useT} from '@/i18n';

const FAQ: {q: TKey; a: TKey}[] = [
  {q: 'help.faq1q', a: 'help.faq1a'},
  {q: 'help.faq2q', a: 'help.faq2a'},
  {q: 'help.faq3q', a: 'help.faq3a'},
  {q: 'help.faq4q', a: 'help.faq4a'},
  {q: 'help.faq5q', a: 'help.faq5a'},
];

export function HelpScreen() {
  const t = useT();
  const [feedback, setFeedback] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('help.title')} subtitle={t('help.subtitle')} />
      <ScrollView contentContainerStyle={{paddingBottom: spacing.xl}}>
        <Card>
          {FAQ.map((f, i) => (
            <View key={i} style={[styles.faq, i === FAQ.length - 1 && {borderBottomWidth: 0}]}>
              <View style={{flexDirection: 'row', gap: spacing.sm}}>
                <Text style={styles.qBadge}>Q</Text>
                <Text style={{fontWeight: '700', color: colors.text, flex: 1, lineHeight: 20}}>{t(f.q)}</Text>
              </View>
              <Text style={{color: colors.textSub, fontSize: typography.sub, marginTop: spacing.xs, lineHeight: 19, marginLeft: 28}}>
                {t(f.a)}
              </Text>
            </View>
          ))}
        </Card>

        <Card>
          <Text style={{fontWeight: '700', color: colors.text, marginBottom: spacing.sm, fontSize: typography.h2}}>
            {t('help.feedback')}
          </Text>
          <TextInput
            editable
            multiline
            style={styles.input}
            value={feedback}
            onChangeText={setFeedback}
            placeholder={t('help.feedbackPlaceholder')}
            placeholderTextColor={colors.textFaint}
          />
          <Button
            title={sent ? t('help.submitted') : t('help.submit')}
            disabled={sent || !feedback}
            onPress={() => setSent(true)}
            style={{marginHorizontal: 0, marginBottom: 0}}
          />
        </Card>

        <Card>
          <Text style={{fontWeight: '700', color: colors.text }}>{t('help.docs')}</Text>
          <Text style={{color: colors.primary, fontSize: typography.sub, marginTop: spacing.xs }} onPress={() => {}}>
            {t('help.docsLink')}
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  faq: {paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border},
  qBadge: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 20,
    overflow: 'hidden',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
    backgroundColor: colors.background,
  },
});
