import React, { useMemo } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';
import { RehearsalTrack, DialogueNode } from '@/types/dialogue';
import { useDialogue } from '@/store/DialogueContext';
import EmotionCurve from '@/components/EmotionCurve';
import { formatTime } from '@/utils/emotion';

interface Props {
  trackA: RehearsalTrack;
  trackB: RehearsalTrack;
  onClose: () => void;
}

interface DiffNode {
  nodeId: string;
  node?: DialogueNode;
  inA: boolean;
  inB: boolean;
  recordedA: boolean;
  recordedB: boolean;
  choiceA?: string;
  choiceB?: string;
  intensityA?: number;
  intensityB?: number;
  diffType: 'same' | 'path-diff' | 'record-diff' | 'intensity-diff' | 'choice-diff';
}

const TrackCompare: React.FC<Props> = ({ trackA, trackB, onClose }) => {
  const { project } = useDialogue();

  const diffData = useMemo(() => {
    const nodeMap = new Map<string, DiffNode>();
    const setA = new Set(trackA.pathNodeIds);
    const setB = new Set(trackB.pathNodeIds);
    const recordedA = new Set(trackA.recordedNodeIds);
    const recordedB = new Set(trackB.recordedNodeIds);

    const allNodeIds = [...new Set([...trackA.pathNodeIds, ...trackB.pathNodeIds])];

    allNodeIds.forEach(nid => {
      const node = project.nodes[nid];
      const inA = setA.has(nid);
      const inB = setB.has(nid);
      const recA = recordedA.has(nid);
      const recB = recordedB.has(nid);

      let diffType: DiffNode['diffType'] = 'same';
      if (!inA || !inB) {
        diffType = 'path-diff';
      } else if (recA !== recB) {
        diffType = 'record-diff';
      } else if (node && trackA.emotionCurve && trackB.emotionCurve) {
        const idxA = trackA.pathNodeIds.indexOf(nid);
        const idxB = trackB.pathNodeIds.indexOf(nid);
        const intA = trackA.emotionCurve[idxA]?.value;
        const intB = trackB.emotionCurve[idxB]?.value;
        if (intA !== undefined && intB !== undefined && Math.abs(intA - intB) >= 1) {
          diffType = 'intensity-diff';
        }
      }

      nodeMap.set(nid, {
        nodeId: nid,
        node,
        inA,
        inB,
        recordedA: recA,
        recordedB: recB,
        choiceA: trackA.choices[nid],
        choiceB: trackB.choices[nid],
        intensityA: node ? node.performance.intensity : undefined,
        intensityB: node ? node.performance.intensity : undefined,
        diffType
      });
    });

    const diffNodes = allNodeIds.map(id => nodeMap.get(id)!).filter(Boolean);

    const pathDiffCount = diffNodes.filter(n => n.diffType === 'path-diff').length;
    const recordDiffCount = diffNodes.filter(n => n.diffType === 'record-diff').length;
    const intensityDiffCount = diffNodes.filter(n => n.diffType === 'intensity-diff').length;
    const choiceDiffCount = Object.keys(trackA.choices).filter(nid => {
      return trackA.choices[nid] !== trackB.choices[nid];
    }).length;

    return {
      diffNodes,
      pathDiffCount,
      recordDiffCount,
      intensityDiffCount,
      choiceDiffCount,
      totalDiff: pathDiffCount + recordDiffCount + intensityDiffCount + choiceDiffCount
    };
  }, [trackA, trackB, project.nodes]);

  const findMaxDiffPoint = () => {
    let maxDiff = 0;
    let maxIdx = -1;
    const commonNodes = trackA.pathNodeIds.filter(id => trackB.pathNodeIds.includes(id));
    commonNodes.forEach(nid => {
      const idxA = trackA.pathNodeIds.indexOf(nid);
      const idxB = trackB.pathNodeIds.indexOf(nid);
      const intA = trackA.emotionCurve[idxA]?.value || 0;
      const intB = trackB.emotionCurve[idxB]?.value || 0;
      const diff = Math.abs(intA - intB);
      if (diff > maxDiff) {
        maxDiff = diff;
        maxIdx = idxA;
      }
    });
    return { maxDiff, maxIdx };
  };

  const { maxDiff, maxIdx } = findMaxDiffPoint();

  return (
    <View className={styles.wrapper}>
      <View className={styles.header}>
        <Text className={styles.title}>🔍 排练轨迹对比</Text>
        <View className={styles.closeBtn} onClick={onClose}>✕</View>
      </View>

      {/* 两个轨迹的基本信息 */}
      <View className={styles.trackHeaders}>
        <View className={styles.trackHeaderA}>
          <Text className={styles.trackLabel}>A 版</Text>
          <Text className={styles.trackName}>{trackA.title}</Text>
          <Text className={styles.trackMeta}>{trackA.actorName} · {formatTime(trackA.endedAt)}</Text>
        </View>
        <View className={styles.vsBadge}>VS</View>
        <View className={styles.trackHeaderB}>
          <Text className={styles.trackLabel}>B 版</Text>
          <Text className={styles.trackName}>{trackB.title}</Text>
          <Text className={styles.trackMeta}>{trackB.actorName} · {formatTime(trackB.endedAt)}</Text>
        </View>
      </View>

      {/* 差异统计 */}
      <View className={styles.statsRow}>
        <View className={styles.statCard}>
          <Text className={styles.statNum}>{diffData.pathDiffCount}</Text>
          <Text className={styles.statLabel}>路径差异</Text>
        </View>
        <View className={styles.statCard}>
          <Text className={styles.statNum}>{diffData.choiceDiffCount}</Text>
          <Text className={styles.statLabel}>选择不同</Text>
        </View>
        <View className={styles.statCard}>
          <Text className={styles.statNum}>{diffData.recordDiffCount}</Text>
          <Text className={styles.statLabel}>录制差异</Text>
        </View>
        <View className={styles.statCard}>
          <Text className={styles.statNum}>{maxDiff > 0 ? maxDiff.toFixed(1) : 0}</Text>
          <Text className={styles.statLabel}>最大情绪差</Text>
        </View>
      </View>

      {/* 情绪曲线对比 */}
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>📊 情绪曲线对比</Text>
        <View className={styles.curvesBox}>
          <View className={styles.curveLabelA}>A 版</View>
          <EmotionCurve points={trackA.emotionCurve} title="" />
          <View className={styles.curveLabelB}>B 版</View>
          <EmotionCurve points={trackB.emotionCurve} title="" />
        </View>
        {maxIdx >= 0 && (
          <View className={styles.maxDiffTip}>
            <Text>💡 情绪差异最大处：第 {maxIdx + 1} 句，相差 {maxDiff.toFixed(1)} 级</Text>
          </View>
        )}
      </View>

      {/* 逐句差异列表 */}
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>📝 逐句对比</Text>
        <ScrollView className={styles.diffList} scrollY>
          {diffData.diffNodes.map((item, idx) => (
            <View
              key={item.nodeId}
              className={classnames(
                styles.diffItem,
                item.diffType !== 'same' && styles.hasDiff
              )}
            >
              <View className={styles.diffIdx}>{idx + 1}</View>
              <View className={styles.diffContent}>
                <View className={styles.diffMeta}>
                  <Text className={styles.diffId}>#{item.nodeId}</Text>
                  {item.diffType === 'path-diff' && (
                    <View className={classnames(styles.diffTag, styles.path)}>路径差异</View>
                  )}
                  {item.diffType === 'record-diff' && (
                    <View className={classnames(styles.diffTag, styles.record)}>录制差异</View>
                  )}
                  {item.diffType === 'intensity-diff' && (
                    <View className={classnames(styles.diffTag, styles.intensity)}>情绪不同</View>
                  )}
                  {item.diffType === 'choice-diff' && (
                    <View className={classnames(styles.diffTag, styles.choice)}>选择不同</View>
                  )}
                </View>
                <Text className={styles.diffText}>
                  {item.node?.text || '(节点不存在)'}
                </Text>
                <View className={styles.diffCompare}>
                  <View className={styles.diffSideA}>
                    <Text className={styles.sideLabel}>A</Text>
                    <View className={styles.sideBadges}>
                      {item.inA ? (
                        <>
                          <View className={classnames(styles.recordBadge, item.recordedA && styles.recorded)}>
                            {item.recordedA ? '✓ 已录' : '○ 未录'}
                          </View>
                          {item.intensityA !== undefined && (
                            <Text className={styles.intensityText}>强度 {item.intensityA}</Text>
                          )}
                        </>
                      ) : (
                        <Text className={styles.missText}>— 不在路径</Text>
                      )}
                    </View>
                  </View>
                  <View className={styles.diffArrow}>↔</View>
                  <View className={styles.diffSideB}>
                    <Text className={styles.sideLabel}>B</Text>
                    <View className={styles.sideBadges}>
                      {item.inB ? (
                        <>
                          <View className={classnames(styles.recordBadge, item.recordedB && styles.recorded)}>
                            {item.recordedB ? '✓ 已录' : '○ 未录'}
                          </View>
                          {item.intensityB !== undefined && (
                            <Text className={styles.intensityText}>强度 {item.intensityB}</Text>
                          )}
                        </>
                      ) : (
                        <Text className={styles.missText}>— 不在路径</Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

export default TrackCompare;
