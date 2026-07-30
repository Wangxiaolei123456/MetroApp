import React, {useState} from 'react';
import {
  Clipboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {ChainEnv} from '@/types';
import {useWalletStore} from '@/store/useWalletStore';
import {ThemeColors, spacing, typography} from '@/theme/theme';
import {useTheme, useThemedStyles} from '@/theme/ThemeProvider';
import {Button, Card, Chip, HeroCard, IconBubble, ScreenHeader} from '@/components/common';
import {useT} from '@/i18n';

function abbreviate(addr: string, head = 8, tail = 6) {
  if (!addr || addr.length <= head + tail) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function WalletScreen() {
  const navigation = useNavigation<any>();
  const t = useT();
  const {colors} = useTheme();
  const styles = useThemedStyles(makeStyles);
  const {meta, balances, nfts, txs, loading, error, lastReward, create, import: importWallet, switchEnv, refresh} =
    useWalletStore();
  const [mnemonic, setMnemonic] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyAddr = (value: string, key: string) => {
    Clipboard.setString(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  if (!meta) {
    return (
      <View style={{flex: 1, backgroundColor: colors.background}}>
        <ScreenHeader title={t('wallet.title')} subtitle={t('wallet.subtitleCreate')} />
        <ScrollView>
          <Card>
            <View style={{alignItems: 'center', paddingVertical: spacing.md}}>
              <IconBubble icon="👛" size={64} />
              <Text
                style={{
                  color: colors.textSub,
                  marginTop: spacing.md,
                  marginBottom: spacing.lg,
                  textAlign: 'center',
                  fontSize: typography.sub,
                  lineHeight: 19,
                }}>
                {t('wallet.keychainNote')}
              </Text>
              {error && (
                <Text
                  style={{
                    color: colors.danger,
                    fontSize: typography.sub,
                    marginBottom: spacing.sm,
                    textAlign: 'center',
                  }}>
                  {error}
                </Text>
              )}
            </View>
            <Button
              title={loading ? t('wallet.creating') : t('wallet.create')}
              loading={loading}
              onPress={() => create('testnet')}
              style={{marginHorizontal: 0}}
            />
            <Button
              title={t('wallet.import')}
              variant="soft"
              onPress={() => setShowImport((v) => !v)}
              style={{marginHorizontal: 0, marginBottom: 0}}
            />
            {showImport && (
              <View style={{marginTop: spacing.md}}>
                <TextInput
                  placeholder={t('wallet.mnemonicPlaceholder')}
                  placeholderTextColor={colors.textFaint}
                  value={mnemonic}
                  onChangeText={setMnemonic}
                  multiline
                  style={styles.input}
                />
                {error && (
                  <Text style={{color: colors.danger, fontSize: typography.sub, marginBottom: spacing.sm}}>
                    {error}
                  </Text>
                )}
                <Button
                  title={t('wallet.importBtn')}
                  loading={loading}
                  onPress={() => importWallet(mnemonic, 'testnet')}
                  style={{marginHorizontal: 0, marginBottom: 0}}
                />
              </View>
            )}
          </Card>
        </ScrollView>
      </View>
    );
  }

  const evmBal = balances.find((b) => b.chain === 'evm');

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title={t('wallet.title')} subtitle={t('wallet.subtitleAssets')} />
      <ScrollView>
        <HeroCard>
          <View style={styles.headRow}>
            <View style={styles.envPill}>
              <View
                style={[
                  styles.envDot,
                  {backgroundColor: meta.env === 'testnet' ? colors.warning : colors.success},
                ]}
              />
              <Text style={{color: colors.white, fontSize: typography.caption, fontWeight: '700'}}>
                {meta.env === 'testnet' ? t('wallet.testnet') : t('wallet.mainnet')}
              </Text>
            </View>
            <Pressable
              onPress={() => refresh()}
              hitSlop={8}
              style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}>
              <Text style={{color: colors.white, fontSize: typography.sub, fontWeight: '600'}}>
                ⟳ {t('wallet.refresh')}
              </Text>
            </Pressable>
          </View>

          {/* EVM 主余额 */}
          <Text
            style={{
              fontSize: typography.caption,
              color: 'rgba(255,255,255,0.7)',
              marginTop: spacing.lg,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}>
            {t('wallet.chainEvm')} · {evmBal?.symbol ?? 'UPTICK'}
          </Text>
          <Text
            style={{
              color: colors.white,
              fontSize: 36,
              fontWeight: '800',
              letterSpacing: -0.5,
              marginTop: 2,
              fontVariant: ['tabular-nums'],
            }}>
            {evmBal?.amount ?? '—'}
          </Text>

          {!!meta.evmAddress && (
            <AddressRow
              label={t('wallet.evmAddress')}
              value={meta.evmAddress}
              copied={copied === 'evm'}
              onCopy={() => copyAddr(meta.evmAddress!, 'evm')}
              copyLabel={copied === 'evm' ? t('wallet.copied') : t('wallet.copy')}
            />
          )}
          <AddressRow
            label={t('wallet.address')}
            value={meta.address}
            copied={copied === 'cosmos'}
            onCopy={() => copyAddr(meta.address, 'cosmos')}
            copyLabel={copied === 'cosmos' ? t('wallet.copied') : t('wallet.copy')}
          />

          <View style={styles.switchRow}>
            {(['testnet', 'mainnet'] as ChainEnv[]).map((e) => (
              <PressableChip
                key={e}
                text={e === 'testnet' ? t('wallet.testnet') : t('wallet.mainnet')}
                active={meta.env === e}
                onPress={async () => {
                  if (e === meta.env) return;
                  await switchEnv(e);
                }}
              />
            ))}
          </View>
        </HeroCard>

        <Card>
          <Text style={styles.cardTitle}>{t('wallet.tokenBalance')}</Text>
          <Text style={{color: colors.textFaint, fontSize: typography.caption, marginBottom: spacing.sm}}>
            {t('wallet.rideTokenNote')}
          </Text>
          {lastReward?.hash && lastReward.amount != null && (
            <Text style={{color: colors.success, fontSize: typography.caption, marginBottom: spacing.sm}}>
              {t('wallet.rewardOk', {n: lastReward.amount})} · {abbreviate(lastReward.hash, 10, 8)}
            </Text>
          )}
          {lastReward?.error && (
            <Text style={{color: colors.danger, fontSize: typography.caption, marginBottom: spacing.sm}}>
              {t('wallet.rewardFail', {msg: lastReward.error})}
            </Text>
          )}
          {balances.map((b, i) => (
            <View
              key={b.denom + (b.chain ?? '') + b.symbol}
              style={[styles.balRow, i === balances.length - 1 && {borderBottomWidth: 0}]}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1}}>
                <View style={styles.tokenBubble}>
                  <Text style={{fontSize: 13, fontWeight: '800', color: colors.primary}}>
                    {b.symbol.slice(0, 1)}
                  </Text>
                </View>
                <View style={{flex: 1}}>
                  <Text style={{color: colors.text, fontWeight: '600'}}>{b.symbol}</Text>
                  <Chip
                    text={b.chain === 'evm' ? t('wallet.chainEvm') : t('wallet.chainCosmos')}
                    color={b.chain === 'evm' ? colors.accent : colors.primary}
                  />
                </View>
              </View>
              <Text style={{fontWeight: '800', color: colors.text, fontSize: 16, fontVariant: ['tabular-nums']}}>
                {b.amount}
              </Text>
            </View>
          ))}
        </Card>

        <Card>
          <Text style={styles.cardTitle}>{t('wallet.nfts')}</Text>
          {nfts.length === 0 ? (
            <Text style={{color: colors.textFaint, fontSize: typography.sub}}>{t('wallet.noNft')}</Text>
          ) : (
            nfts.map((n) => (
              <Text key={n.id} style={{color: colors.text, paddingVertical: 3}}>
                🖼 {n.name} · {n.collection} #{n.tokenId}
              </Text>
            ))
          )}
        </Card>

        <Card>
          <Text style={styles.cardTitle}>{t('wallet.txs')}</Text>
          {txs.length === 0 ? (
            <Text style={{color: colors.textFaint, fontSize: typography.sub}}>{t('wallet.noTx')}</Text>
          ) : (
            txs.map((tx) => (
              <Text key={tx.hash} style={{color: colors.textSub, fontSize: typography.sub, paddingVertical: 2}}>
                {tx.type} · {tx.status} · {new Date(tx.time).toLocaleDateString()}
              </Text>
            ))
          )}
        </Card>

        <Button title={t('wallet.gotoAirdrop')} onPress={() => navigation.navigate('Airdrop')} />
        <Button title={t('wallet.sign')} variant="soft" onPress={() => navigation.navigate('Me')} />
      </ScrollView>
    </View>
  );
}

function AddressRow({
  label,
  value,
  copied,
  onCopy,
  copyLabel,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  copyLabel: string;
}) {
  const {colors} = useTheme();
  return (
    <View style={{marginTop: spacing.md}}>
      <Text style={{fontSize: typography.caption, color: 'rgba(255,255,255,0.7)'}}>{label}</Text>
      <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: spacing.sm}}>
        <Text
          style={{flex: 1, fontWeight: '700', color: colors.white, fontSize: typography.sub, lineHeight: 19}}
          numberOfLines={1}>
          {abbreviate(value, 10, 8)}
        </Text>
        <Pressable
          onPress={onCopy}
          hitSlop={8}
          style={({pressed}) => ({
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: copied ? 'rgba(0,194,129,0.35)' : 'rgba(255,255,255,0.16)',
            opacity: pressed ? 0.7 : 1,
          })}>
          <Text style={{color: colors.white, fontSize: typography.caption, fontWeight: '700'}}>
            {copyLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function PressableChip({text, active, onPress}: {text: string; active: boolean; onPress: () => void}) {
  const {colors} = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.chip,
        {
          backgroundColor: active ? colors.white : 'rgba(255,255,255,0.14)',
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      <Text style={{color: active ? colors.primary : colors.white, fontSize: typography.sub, fontWeight: '700'}}>
        {text}
      </Text>
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    headRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
    cardTitle: {fontWeight: '700', color: colors.text, marginBottom: spacing.sm, fontSize: typography.h2},
    envPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderRadius: 999,
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
    },
    envDot: {width: 8, height: 8, borderRadius: 4},
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: spacing.md,
      color: colors.text,
      minHeight: 80,
      textAlignVertical: 'top',
      marginBottom: spacing.sm,
      backgroundColor: colors.background,
    },
    switchRow: {flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg},
    chip: {paddingHorizontal: spacing.lg, paddingVertical: 7, borderRadius: 999},
    balRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    tokenBubble: {
      width: 30,
      height: 30,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary + '44',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
