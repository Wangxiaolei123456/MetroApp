import React, {useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View, ActivityIndicator} from 'react-native';
import {fetchMetrics, fetchPushes} from '@/services/opsService';
import {MetricPoint, PushItem} from '@/data/opsSample';
import {spacing, typography, ThemeColors} from '@/theme/theme';
import {useTheme, useThemedStyles} from '@/theme/ThemeProvider';
import {Card, ScreenHeader, SectionTitle} from '@/components/common';

const STATUS_LABEL: Record<string, string> = {
  sent: '已发送',
  scheduled: '待发送',
  draft: '草稿',
};

export function DashboardScreen() {
  const {colors} = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [pushes, setPushes] = useState<PushItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchMetrics(), fetchPushes()])
      .then(([m, p]) => {
        if (!alive) return;
        setMetrics(m);
        setPushes(p);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const latest = metrics[metrics.length - 1];
  const prev = metrics[metrics.length - 2];
  const delta = (cur?: number, before?: number) =>
    cur != null && before != null && before > 0 ? Math.round(((cur - before) / before) * 100) : 0;

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <ScreenHeader title="运营看板" subtitle="H3 · 实时概览" />
      <ScrollView contentContainerStyle={styles.body}>
        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        <SectionTitle>核心指标（最新一日）</SectionTitle>
        <View style={styles.grid}>
          <StatCard label="日活 DAU" value={latest?.dau ?? 0} delta={delta(latest?.dau, prev?.dau)} />
          <StatCard label="乘车次数" value={latest?.rides ?? 0} delta={delta(latest?.rides, prev?.rides)} />
          <StatCard label="发放积分" value={latest?.points ?? 0} delta={delta(latest?.points, prev?.points)} />
          <StatCard label="空投领取" value={latest?.claims ?? 0} delta={delta(latest?.claims, prev?.claims)} />
        </View>

        <SectionTitle>近 7 日趋势</SectionTitle>
        <Card>
          {metrics.map((m) => (
            <View key={m.date} style={styles.row}>
              <Text style={styles.date}>{m.date}</Text>
              <Text style={styles.metric}>乘车 {m.rides}</Text>
              <Text style={styles.metric}>积分 {m.points}</Text>
              <Text style={styles.metric}>领取 {m.claims}</Text>
            </View>
          ))}
        </Card>

        <SectionTitle>推送任务</SectionTitle>
        <Card>
          {pushes.length === 0 && <Text style={styles.empty}>暂无推送任务</Text>}
          {pushes.map((p) => (
            <View key={p.id} style={styles.row}>
              <View style={{flex: 1}}>
                <Text style={styles.pushTitle}>{p.title}</Text>
                <Text style={styles.metric}>
                  {p.target} · {p.channel}
                </Text>
              </View>
              <View style={styles.pushRight}>
                <Text style={[styles.badge, {color: colors.primary}]}>{STATUS_LABEL[p.status] ?? p.status}</Text>
                <Text style={styles.metric}>已发 {p.sent}</Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

function StatCard({label, value, delta}: {label: string; value: number; delta: number}) {
  const {colors} = useTheme();
  const up = delta > 0;
  return (
    <Card style={{width: '48%', marginBottom: spacing.sm}}>
      <Text style={{fontSize: typography.caption, color: colors.textSub}}>{label}</Text>
      <Text style={{fontSize: typography.title, fontWeight: '800', color: colors.text, marginVertical: 4}}>
        {value.toLocaleString()}
      </Text>
      <Text style={{fontSize: typography.caption, fontWeight: '600', color: up ? colors.success : colors.textSub}}>
        {up ? '▲' : delta < 0 ? '▼' : '–'} {Math.abs(delta)}%
      </Text>
    </Card>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    body: {padding: spacing.lg},
    loading: {paddingVertical: spacing.xl, alignItems: 'center'},
    grid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between'},
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    date: {width: 56, fontSize: typography.body, color: colors.text, fontWeight: '600'},
    metric: {flex: 1, fontSize: typography.caption, color: colors.textSub},
    pushTitle: {fontSize: typography.body, color: colors.text, fontWeight: '700'},
    pushRight: {alignItems: 'flex-end'},
    badge: {fontSize: typography.caption, fontWeight: '700', marginBottom: 2 },
    empty: {fontSize: typography.body, color: colors.textSub, paddingVertical: spacing.sm},
  });
