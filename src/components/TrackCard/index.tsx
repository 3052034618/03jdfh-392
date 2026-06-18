import React, { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import { RehearsalTrack } from '@/types/dialogue';
import { useDialogue } from '@/store/DialogueContext';
import EmotionCurve from '@/components/EmotionCurve';
import { formatTime } from '@/utils/emotion';

interface Props {
  track: RehearsalTrack;
  onResume?: (track: RehearsalTrack) => void;
  onDelete?: (trackId: string) => void;
  compareMode?: boolean;
  selectedA?: boolean;
  selectedB?: boolean;
  onSelectA?: (trackId: string) => void;
  onSelectB?: (trackId: string) => void;
}

const TrackCard: React.FC<Props> = ({
  track,
  onResume,
  onDelete,
  compareMode,
  selectedA,
  selectedB,
  onSelectA,
  onSelectB
}) => {
  const { project, deleteRehearsalTrack } = useDialogue();
  const [expanded, setExpanded] = useState(false);

  const avgIntensity = track.emotionCurve.length > 0
    ? (track.emotionCurve.reduce((s, p) => s + p.value, 0) / track.emotionCurve.length).toFixed(1)
    : '-';

  const handleDelete = () => {
    Taro.showModal({
      title: '删除排练记录',
      content: '确定要删除这条排练轨迹吗？',
      success: (res) => {
        if (res.confirm) {
          deleteRehearsalTrack(track.id);
          onDelete?.(track.id);
          Taro.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  };

  const handleResume = () => {
    onResume?.(track);
  };

  const handleSelectA = (e) => {
    e.stopPropagation();
    onSelectA?.(track.id);
  };

  const handleSelectB = (e) => {
    e.stopPropagation();
    onSelectB?.(track.id);
  };

  return (
    <View className={classnames(
      styles.card,
      expanded && styles.expanded,
      selectedA && styles.selectedA,
      selectedB && styles.selectedB
    )}>
      <View className={styles.header} onClick={() => setExpanded(!expanded)}>
        <View className={styles.main}>
          <View style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Text className={styles.title}>{track.title}</Text>
            {track.review?.recommended && (
              <View className={styles.recBadge}>⭐ 推荐</View>
            )}
          </View>
          <View className={styles.meta}>
            <View className={styles.metaItem}>
              <View className={styles.metaDot}></View>
              <Text>演员: {track.actorName}</Text>
            </View>
            <View className={styles.metaItem}>
              <View className={styles.metaDot} style={{ background: '#2FD4A6' }}></View>
              <Text>{formatTime(track.endedAt)}</Text>
            </View>
          </View>
        </View>
        <View style={{ display: 'flex', alignItems: 'center', gap: '16rpx' }}>
          <View className={styles.badges}>
            <View className={classnames(styles.badge, styles.pathBadge)}>
              {track.pathNodeIds.length}句
            </View>
            <View className={classnames(styles.badge, styles.recordedBadge)}>
              {track.recordedNodeIds.length}✓
            </View>
            <View className={classnames(styles.badge, styles.avgBadge)}>
              情绪{avgIntensity}
            </View>
          </View>
          <Text className={styles.arrow}>▾</Text>
        </View>
      </View>

      {compareMode && (
        <View className={styles.compareRow}>
          <Button
            className={classnames(styles.compareBtn, selectedA && styles.activeA)}
            onClick={handleSelectA}
          >
            {selectedA ? '✓ ' : ''}设为 A
          </Button>
          <Button
            className={classnames(styles.compareBtn, selectedB && styles.activeB)}
            onClick={handleSelectB}
          >
            {selectedB ? '✓ ' : ''}设为 B
          </Button>
        </View>
      )}

      {expanded && (
        <View className={styles.body}>
          <Text className={styles.sectionTitle}>📊 本次情绪曲线</Text>
          <View className={styles.chartBox}>
            <EmotionCurve points={track.emotionCurve} title="情绪曲线快照" />
          </View>

          <Text className={styles.sectionTitle}>🛤️ 路径节点</Text>
          <View className={styles.pathFlow}>
            {track.pathNodeIds.map((nid, idx) => {
              const node = project.nodes[nid];
              const isRecorded = track.recordedNodeIds.includes(nid);
              const choiceMade = Object.keys(track.choices).includes(nid);
              const choiceText = choiceMade
                ? node?.choices?.find(c => c.id === track.choices[nid])?.text
                : null;
              return (
                <React.Fragment key={nid}>
                  {idx > 0 && <Text className={styles.flowArrow}>→</Text>}
                  <View className={classnames(styles.nodeChip, isRecorded && styles.recorded)}>
                    #{nid} {isRecorded && '✓'}
                  </View>
                  {choiceText && (
                    <>
                      <Text className={styles.flowArrow}>↳</Text>
                      <View className={classnames(styles.nodeChip, styles.choice)}>"{choiceText.slice(0, 8)}…"</View>
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </View>

          {Object.keys(track.choices).length > 0 && (
            <>
              <Text className={styles.sectionTitle}>🔀 做出的分支选择</Text>
              <View className={styles.choicesList}>
                {Object.entries(track.choices).map(([nid, chId]) => {
                  const node = project.nodes[nid];
                  const choice = node?.choices?.find(c => c.id === chId);
                  const letter = node?.choices?.findIndex(c => c.id === chId);
                  return (
                    <View className={styles.choiceItem} key={`${nid}-${chId}`}>
                      <Text className={styles.choiceKey}>
                        #{nid} 选{typeof letter === 'number' ? String.fromCharCode(65 + letter) : ''}
                      </Text>
                      <Text className={styles.choiceText}>{choice?.text}</Text>
                      <Text className={styles.choiceTarget}>→ #{choice?.nextNodeId}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {track.note && (
            <>
              <Text className={styles.sectionTitle}>📝 备注</Text>
              <View className={styles.note}>
                <Text className={styles.note_text}>{track.note}</Text>
              </View>
            </>
          )}

          {track.review && (
            <>
              <Text className={styles.sectionTitle}>🎯 评审结论</Text>
              <View className={classnames(styles.reviewBox, track.review.recommended && styles.recReview)}>
                <View style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  {track.review.recommended && <Text style={{ fontSize: 28 }}>⭐</Text>}
                  <Text className={styles.reviewTitle}>
                    {track.review.recommended ? '推荐用于正式录制' : '评审记录'}
                  </Text>
                </View>
                <Text className={styles.reviewReason}>{track.review.reason}</Text>
                <Text className={styles.reviewMeta}>
                  —— {track.review.reviewerName} · {new Date(track.review.reviewedAt).toLocaleString('zh-CN')}
                </Text>
              </View>
            </>
          )}

          <View className={styles.actions}>
            <Button className={classnames(styles.actionBtn, styles.danger)} onClick={handleDelete}>
              🗑️ 删除
            </Button>
            <Button className={classnames(styles.actionBtn, styles.primary)} onClick={handleResume}>
              ▶️ 继续排练此路径
            </Button>
          </View>
        </View>
      )}
    </View>
  );
};

export default TrackCard;
