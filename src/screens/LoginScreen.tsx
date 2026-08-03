import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {ScreenHeader} from '@/components/common';
import {loginWithEmail, sendEmailCode, SocialProvider} from '@/services/web3Auth';
import {useWalletStore} from '@/store/useWalletStore';
import {useTheme} from '@/theme/ThemeProvider';
import {spacing, typography} from '@/theme/theme';
import {useT} from '@/i18n';

/**
 * 第三方登录选择页。
 * 顶部插画占位 + 标题 + 说明文案 + Email / Apple / Google 三个登录入口。
 * Email 采用「输入邮箱 → 发送验证码 → 输入验证码 → 登录」两步式流程。
 * 登录成功后自动返回上一页（监听 meta 变化）。
 */
export function LoginScreen() {
  const navigation = useNavigation<any>();
  const t = useT();
  const {colors} = useTheme();
  const meta = useWalletStore((s) => s.meta);
  const create = useWalletStore((s) => s.create);

  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailStep, setEmailStep] = useState<'input' | 'code'>('input');
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [formError, setFormError] = useState('');

  // 登录成功后自动返回上一页（钱包已绑定）
  useEffect(() => {
    if (meta && navigation.canGoBack?.()) {
      navigation.goBack();
    }
  }, [meta, navigation]);

  const onSocial = async (provider: SocialProvider) => {
    if (provider === 'email') return; // email 走两步流程
    setSocialLoading(provider);
    setFormError('');
    try {
      await create(provider, 'testnet');
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSocialLoading(null);
    }
  };

  const onSendCode = async () => {
    setSocialLoading('email');
    setFormError('');
    try {
      await sendEmailCode(email.trim());
      setEmailStep('code');
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSocialLoading(null);
    }
  };

  const onEmailLogin = async () => {
    setSocialLoading('email');
    setFormError('');
    try {
      await loginWithEmail(email.trim(), emailCode.trim());
      setEmailStep('input');
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('login.title')} />
      <ScrollView contentContainerStyle={{paddingBottom: spacing.xl}}>
        {/* 顶部插画占位（金色多面体 + 小行星），与 Cardible 视觉一致 */}
        <View style={{alignItems: 'center', paddingTop: spacing.md}}>
          <View
            style={{
              width: 220,
              height: 220,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.lg,
            }}>
            <Text style={{fontSize: 110}}>🪐</Text>
          </View>
        </View>

        <View style={{paddingHorizontal: spacing.lg, marginBottom: spacing.md}}>
          <Text
            style={{
              color: colors.text,
              fontSize: typography.title,
              fontWeight: '800',
              textAlign: 'center',
              marginBottom: spacing.sm,
            }}>
            {t('login.headline')}
          </Text>
          <Text
            style={{
              color: colors.textSub,
              fontSize: typography.sub,
              lineHeight: 20,
              textAlign: 'center',
              paddingHorizontal: spacing.md,
            }}>
            {t('login.subtitle')}
          </Text>
        </View>

        {formError ? (
          <Text
            style={{
              color: colors.danger,
              fontSize: typography.sub,
              textAlign: 'center',
              marginBottom: spacing.sm,
              paddingHorizontal: spacing.lg,
            }}>
            {formError}
          </Text>
        ) : null}

        <View style={{paddingHorizontal: spacing.lg, marginTop: spacing.md}}>
          {/* Email 两步式：输入邮箱 -> 发验证码 -> 输入验证码 -> 登录 */}
          {emailStep === 'input' ? (
            <>
              <TextInput
                placeholder={t('wallet.emailPlaceholder')}
                placeholderTextColor={colors.textFaint}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles(colors).input}
              />
              <LoginOptionButton
                icon="✉️"
                label={
                  socialLoading === 'email'
                    ? t('wallet.socialLogging')
                    : t('wallet.emailSendCode')
                }
                loading={socialLoading === 'email'}
                onPress={onSendCode}
              />
            </>
          ) : (
            <>
              <TextInput
                placeholder={t('wallet.emailCodePlaceholder')}
                placeholderTextColor={colors.textFaint}
                value={emailCode}
                onChangeText={setEmailCode}
                keyboardType="number-pad"
                style={styles(colors).input}
              />
              <LoginOptionButton
                icon="✉️"
                label={
                  socialLoading === 'email'
                    ? t('wallet.socialLogging')
                    : t('wallet.emailLoginBtn')
                }
                loading={socialLoading === 'email'}
                onPress={onEmailLogin}
              />
            </>
          )}

          {/* Apple 登录 */}
          <LoginOptionButton
            icon="🍎"
            label={
              socialLoading === 'apple'
                ? t('wallet.socialLogging')
                : t('wallet.loginApple')
            }
            loading={socialLoading === 'apple'}
            onPress={() => onSocial('apple')}
          />

          {/* Google 登录 */}
          <LoginOptionButton
            icon="🌐"
            label={
              socialLoading === 'google'
                ? t('wallet.socialLogging')
                : t('wallet.loginGoogle')
            }
            loading={socialLoading === 'google'}
            onPress={() => onSocial('google')}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function styles(c: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    input: {
      backgroundColor: c.elevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      color: c.text,
      fontSize: typography.body,
      marginBottom: spacing.md,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.elevated,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 16,
      marginBottom: spacing.md,
    },
    optionIcon: {
      fontSize: 22,
      marginRight: 12,
    },
    optionLabel: {
      color: c.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
  });
}

/**
 * 登录选项按钮：深色底 + 图标 + 文案，视觉参考 Cardible 的三个登录入口。
 */
function LoginOptionButton({
  icon,
  label,
  loading,
  onPress,
}: {
  icon: string;
  label: string;
  loading: boolean;
  onPress: () => void;
}) {
  const {colors} = useTheme();
  const s = styles(colors);
  return (
    <Pressable
      onPress={loading ? undefined : onPress}
      style={({pressed}) => [s.optionRow, {opacity: pressed ? 0.85 : 1}]}>
      <Text style={s.optionIcon}>{icon}</Text>
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={s.optionLabel}>{label}</Text>
      )}
    </Pressable>
  );
}