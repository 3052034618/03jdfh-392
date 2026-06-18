import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Button, Textarea, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import { RehearsalTrack, DialogueNode, TrackReview } from '@/types/dialogue';
import { useDialogue } from '@/store/DialogueContext';
import EmotionCurve from '@/components/EmotionCurve';
import { formatTime } from '@/utils/emotion';

interface Props {
  trackA: RehearsalTrack;
  trackB: RehearsalTrack;
  onClose: () => void;
}

// 更细分的差异类型
type DiffCategory =
  | 'same'              // 完全一致
  | 'only-a'            // 只在A版出现
  | 'only-b'            // 只在B版出现
  | 'choice-diff'       // 选择不同（分支点）
  | 'both-record-diff'  // 两版都录但表现不同
  | 'record-only-a'     // 只有A版录了
  | 'record-only-b';    // 只有B版录了

interface DiffNode {
  nodeId: string;
  node?: DialogueNode;
  inA: boolean;
  inB: boolean;
  recordedA: boolean;
  recordedB: boolean;
  choiceA?: string;
  choiceB?: string;
  choiceAText?: string;
  choiceBText?: string;
  emotionA?: number;
  emotionB?: number;
  perfA?: string;
  perfB?: string;
  diffCategory: DiffCategory;
  isBranchPoint: boolean;
}

interface BranchPoint {
  nodeId: string;
  node?: DialogueNode;
  fromA: boolean;
  fromB: boolean;
  choiceAId?: string;
  choiceBId?: string;
  choiceAText?: string;
  choiceBText?: string;
  nextAId?: string;
  nextBId?: string;
  nextAName?: string;
  nextBName?: string;
  sameChoice: boolean;
}

const CATEGORY_LABELS: Record<DiffCategory, { label: string; cls: string }> = {
  same: { label: '一致', cls: 'same' },
  'only-a': { label: '仅A版', cls: 'onlyA' },
  'only-b': { label: '仅B版', cls: 'onlyB' },
  'choice-diff': { label: '选择不同', cls: 'choice' },
  'both-record-diff': { label: '同录不同表现', cls: 'bothDiff' },
  'record-only-a': { label: '仅A版录制', cls: 'recA' },
  'record-only-b': { label: '仅B版录制', cls: 'recB' }
};

const TrackCompare: React.FC<Props> = ({ trackA, trackB, onClose }) => {
  const { project, setTrackReview } = useDialogue();
  const [activeFilter, setActiveFilter] = useState<'all' | 'diff' | 'branch'>('all');
  const [recommendTarget, setRecommendTarget] = useState<'A' | 'B' | ''>(
    trackA.review?.recommended ? 'A' : trackB.review?.recommended ? 'B' : ''
  );
  const [reviewReason, setReviewReason] = useState('');
  const [reviewer, setReviewer] = useState('李导');

  // 合并路径并保持顺序
  const mergedPath = useMemo(() => {
    const result: string[] = [];
    const seen = new Set<string>();
    let i = 0, j = 0;
    // 双指针合并，尽量保持各自的顺序
    while (i < trackA.pathNodeIds.length || j < trackB.pathNodeIds.length) {
      while (i < trackA.pathNodeIds.length && seen.has(trackA.pathNodeIds[i])) i++;
      while (j < trackB.pathNodeIds.length && seen.has(trackB.pathNodeIds[j])) j++;
      if (i < trackA.pathNodeIds.length) {
        const id = trackA.pathNodeIds[i++];
        seen.add(id);
        result.push(id);
      }
      if (j < trackB.pathNodeIds.length && !seen.has(trackB.pathNodeIds[j])) {
        const id = trackB.pathNodeIds[j++];
        seen.add(id);
        result.push(id);
      }
    }
    return result;
  }, [trackA.pathNodeIds, trackB.pathNodeIds]);

  // 找出所有分支点（A或B做过选择的节点）
  const branchPoints = useMemo((): BranchPoint[] => {
    const allBranchNodeIds = new Set([
      ...Object.keys(trackA.choices),
      ...Object.keys(trackB.choices)
    ]);
    return Array.from(allBranchNodeIds).map(nodeId => {
      const node = project.nodes[nodeId];
      const ca = trackA.choices[nodeId];
      const cb = trackB.choices[nodeId];
      const choiceAObj = node?.choices?.find(c => c.id === ca);
      const choiceBObj = node?.choices?.find(c => c.id === cb);
      return {
        nodeId,
        node,
        fromA: !!ca,
        fromB: !!cb,
        choiceAId: ca,
        choiceBId: cb,
        choiceAText: choiceAObj?.text,
        choiceBText: choiceBObj?.text,
        nextAId: choiceAObj?.nextNodeId,
        nextBId: choiceBObj?.nextNodeId,
        nextAName: choiceAObj?.nextNodeId ? project.nodes[choiceAObj.nextNodeId]?.character : undefined,
        nextBName: choiceBObj?.nextNodeId ? project.nodes[choiceBObj.nextNodeId]?.character : undefined,
        sameChoice: !!ca && !!cb && ca === cb
      };
    });
  }, [trackA.choices, trackB.choices, project.nodes]);

  // 计算逐句差异
  const diffData = useMemo(() => {
    const setA = new Set(trackA.pathNodeIds);
    const setB = new Set(trackB.pathNodeIds);
    const recordedA = new Set(trackA.recordedNodeIds);
    const recordedB = new Set(trackB.recordedNodeIds);
    const diffNodes: DiffNode[] = [];

    mergedPath.forEach(nid => {
      const node = project.nodes[nid];
      const inA = setA.has(nid);
      const inB = setB.has(nid);
      const recA = recordedA.has(nid);
      const recB = recordedB.has(nid);

      let category: DiffCategory = 'same';
      if (!inA && inB) category = 'only-b';
      else if (inA && !inB) category = 'only-a';
      else {
        // 两版都在路径中
        const hasChoiceDiff = trackA.choices[nid] !== undefined
          && trackB.choices[nid] !== undefined
          && trackA.choices[nid] !== trackB.choices[nid];
        if (hasChoiceDiff) {
          category = 'choice-diff';
        } else if (recA && recB) {
          // 两版都录了，看情绪是否有显著差异
          const idxA = trackA.pathNodeIds.indexOf(nid);
          const idxB = trackB.pathNodeIds.indexOf(nid);
          const eA = trackA.emotionCurve[idxA]?.value || 0;
          const eB = trackB.emotionCurve[idxB]?.value || 0;
          if (Math.abs(eA - eB) >= 1) {
            category = 'both-record-diff';
          }
        } else if (recA && !recB) {
          category = 'record-only-a';
        } else if (!recA && recB) {
          category = 'record-only-b';
        }
      }

      const choiceAId = trackA.choices[nid];
      const choiceBId = trackB.choices[nid];
      const choiceAObj = node?.choices?.find(c => c.id === choiceAId);
      const choiceBObj = node?.choices?.find(c => c.id === choiceBId);
      const idxA = trackA.pathNodeIds.indexOf(nid);
      const idxB = trackB.pathNodeIds.indexOf(nid);

      diffNodes.push({
        nodeId: nid,
        node,
        inA,
        inB,
        recordedA: recA,
        recordedB: recB,
        choiceA: choiceAId,
        choiceB: choiceBId,
        choiceAText: choiceAObj?.text,
        choiceBText: choiceBObj?.text,
        emotionA: idxA >= 0 ? trackA.emotionCurve[idxA]?.value : undefined,
        emotionB: idxB >= 0 ? trackB.emotionCurve[idxB]?.value : undefined,
        perfA: node?.performance.label,
        perfB: node?.performance.label,
        diffCategory: category,
        isBranchPoint: !!(choiceAId || choiceBId)
      });
    });

    // 分类统计
    const counts: Record<DiffCategory, number> = {
      same: 0, 'only-a': 0, 'only-b': 0, 'choice-diff': 0,
      'both-record-diff': 0, 'record-only-a': 0, 'record-only-b': 0
    };
    diffNodes.forEach(n => counts[n.diffCategory]++);

    const diffBranchPoints = branchPoints.filter(b => !b.sameChoice).length;

    return {
      diffNodes,
      counts,
      diffBranchPoints,
      totalDiff:
        counts['only-a'] + counts['only-b'] + counts['choice-diff']
        + counts['both-record-diff'] + counts['record-only-a'] + counts['record-only-b']
    };
  }, [mergedPath, trackA, trackB, project.nodes, branchPoints]);

  const findMaxDiffPoint = () => {
    let maxDiff = 0;
    let maxNodeId: string | null = null;
    const commonNodes = trackA.pathNodeIds.filter(id => trackB.pathNodeIds.includes(id));
    commonNodes.forEach(nid => {
      const idxA = trackA.pathNodeIds.indexOf(nid);
      const idxB = trackB.pathNodeIds.indexOf(nid);
      const intA = trackA.emotionCurve[idxA]?.value || 0;
      const intB = trackB.emotionCurve[idxB]?.value || 0;
      const diff = Math.abs(intA - intB);
      if (diff > maxDiff) {
        maxDiff = diff;
        maxNodeId = nid;
      }
    });
    return { maxDiff, maxNodeId };
  };

  const { maxDiff, maxNodeId } = findMaxDiffPoint();

  const filteredNodes = diffData.diffNodes.filter(n => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'diff') return n.diffCategory !== 'same';
    if (activeFilter === 'branch') return n.isBranchPoint;
    return true;
  });

  const handleSubmitReview = () => {
    if (!recommendTarget) {
      Taro.showToast({ title: '请选择推荐版本', icon: 'none' });
      return;
    }
    if (!reviewReason.trim()) {
      Taro.showToast({ title: '请填写采用理由', icon: 'none' });
      return;
    }
    const targetTrack = recommendTarget === 'A' ? trackA : trackB;
    const otherTrack = recommendTarget === 'A' ? trackB : trackA;
    const review: TrackReview = {
      recommended: true,
      reason: reviewReason.trim(),
      reviewedAt: Date.now(),
      reviewerName: reviewer.trim() || '导演',
      comparedWithId: otherTrack.id
    };
    setTrackReview(targetTrack.id, review);
    // 取消另一条的推荐标记
    if (otherTrack.review?.recommended) {
      setTrackReview(otherTrack.id, { ...otherTrack.review, recommended: false });
    }
    Taro.showToast({ title: '评审结论已保存', icon: 'success' });
  };

  return (
    <View className={styles.wrapper}>
      <View className={styles.header}>
        <Text className={styles.title}>🔍 导演轨迹评审</Text>
        <View className={styles.closeBtn} onClick={onClose}>✕</View>
      </View>

      {/* 两个轨迹的基本信息 */}
      <View className={styles.trackHeaders}>
        <View className={classnames(styles.trackHeaderA, recommendTarget === 'A' && styles.recommended)}>
          <Text className={styles.trackLabel}>A 版</Text>
          {trackA.review?.recommended && <View className={styles.recBadge}>⭐ 推荐</View>}
          <Text className={styles.trackName}>{trackA.title}</Text>
          <Text className={styles.trackMeta}>{trackA.actorName} · {formatTime(trackA.endedAt)}</Text>
        </View>
        <View className={styles.vsBadge}>VS</View>
        <View className={classnames(styles.trackHeaderB, recommendTarget === 'B' && styles.recommended)}>
          <Text className={styles.trackLabel}>B 版</Text>
          {trackB.review?.recommended && <View className={styles.recBadge}>⭐ 推荐</View>}
          <Text className={styles.trackName}>{trackB.title}</Text>
          <Text className={styles.trackMeta}>{trackB.actorName} · {formatTime(trackB.endedAt)}</Text>
        </View>
      </View>

      {/* 差异统计 */}
      <View className={styles.statsRow}>
        <View className={styles.statCard}>
          <Text className={styles.statNum}>{diffData.counts['only-a'] + diffData.counts['only-b']}</Text>
          <Text className={styles.statLabel}>仅一版出现</Text>
        </View>
        <View className={styles.statCard}>
          <Text className={styles.statNum}>{diffData.diffBranchPoints}</Text>
          <Text className={styles.statLabel}>选择不同</Text>
        </View>
        <View className={styles.statCard}>
          <Text className={styles.statNum}>{diffData.counts['both-record-diff']}</Text>
          <Text className={styles.statLabel}>同录不同表现</Text>
        </View>
        <View className={styles.statCard}>
          <Text className={styles.statNum}>{maxDiff > 0 ? maxDiff.toFixed(1) : 0}</Text>
          <Text className={styles.statLabel}>最大情绪差</Text>
        </View>
      </View>

      {/* 分支点集中对比 */}
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>🔀 分支选择对比</Text>
        {branchPoints.length === 0 ? (
          <View className={styles.emptyBox}>
            <Text style={{ color: '#6E6E8A', fontSize: 24 }}>无分支选择点</Text>
          </View>
        ) : (
          <ScrollView className={styles.branchList} scrollY>
            {branchPoints.map((bp, i) => (
              <View
                key={bp.nodeId}
                className={classnames(
                  styles.branchItem,
                  !bp.sameChoice && styles.branchDiff
                )}
              >
                <View className={styles.branchHeader}>
                  <Text className={styles.branchIdx}>分支点 {i + 1}</Text>
                  {!bp.sameChoice && <View className={classnames(styles.diffTag, styles.choice)}>选择不同</View>}
                  {bp.sameChoice && <View className={classnames(styles.diffTag, styles.same)}>一致</View>}
                </View>
                <Text className={styles.branchFrom}># {bp.nodeId} · {bp.node?.text?.slice(0, 30) || '未知节点'}{bp.node?.text && bp.node.text.length > 30 ? '...' : ''}</Text>
                <View className={styles.branchCompare}>
                  <View className={styles.branchSideA}>
                    <Text className={styles.sideLabel}>A版选择</Text>
                    {bp.fromA ? (
                      <View>
                        <Text className={styles.choiceText}>「{bp.choiceAText || '?'}」</Text>
                        <Text className={styles.choiceNext}>→ #{bp.nextAId} ({bp.nextAName || ''})</Text>
                      </View>
                    ) : (
                      <Text className={styles.missText}>— 未到此处</Text>
                    )}
                  </View>
                  <View className={styles.diffArrow}>↔</View>
                  <View className={styles.branchSideB}>
                    <Text className={styles.sideLabel}>B版选择</Text>
                    {bp.fromB ? (
                      <View>
                        <Text className={styles.choiceText}>「{bp.choiceBText || '?'}」</Text>
                        <Text className={styles.choiceNext}>→ #{bp.nextBId} ({bp.nextBName || ''})</Text>
                      </View>
                    ) : (
                      <Text className={styles.missText}>— 未到此处</Text>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
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
        {maxNodeId && (
          <View className={styles.maxDiffTip}>
            <Text>💡 情绪差异最大处：#{maxNodeId}「{project.nodes[maxNodeId]?.text?.slice(0, 20) || ''}...」，相差 {maxDiff.toFixed(1)} 级</Text>
          </View>
        )}
      </View>

      {/* 过滤标签 */}
      <View className={styles.filterBar}>
        <View
          className={classnames(styles.filterChip, activeFilter === 'all' && styles.activeChip)}
          onClick={() => setActiveFilter('all')}
        >全部（{diffData.diffNodes.length}）</View>
        <View
          className={classnames(styles.filterChip, activeFilter === 'diff' && styles.activeChip)}
          onClick={() => setActiveFilter('diff')}
        >仅差异（{diffData.totalDiff}）</View>
        <View
          className={classnames(styles.filterChip, activeFilter === 'branch' && styles.activeChip)}
          onClick={() => setActiveFilter('branch')}
        >仅分支点（{branchPoints.length}）</View>
      </View>

      {/* 逐句差异列表 */}
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>📝 逐句对比</Text>
        <ScrollView className={styles.diffList} scrollY>
          {filteredNodes.map((item) => {
            const catInfo = CATEGORY_LABELS[item.diffCategory];
            return (
              <View
                key={item.nodeId}
                className={classnames(
                  styles.diffItem,
                  item.diffCategory !== 'same' && styles.hasDiff
                )}
              >
                <View className={styles.diffContent}>
                  <View className={styles.diffMeta}>
                    <Text className={styles.diffId}>#{item.nodeId} · {item.node?.character || ''}</Text>
                    {item.isBranchPoint && <View className={styles.branchTag}>分支点</View>}
                    {item.diffCategory !== 'same' && (
                      <View className={classnames(styles.diffTag, styles[catInfo.cls])}>{catInfo.label}</View>
                    )}
                  </View>
                  <Text className={styles.diffText}>
                    {item.node?.text || '(节点不存在)'}
                  </Text>

                  {/* 分支选择对比 */}
                  {item.isBranchPoint && (
                    <View className={styles.inlineChoice}>
                      <View className={styles.inlineSideA}>
                        <Text style={{ fontSize: 20, color: '#4A90FF', fontWeight: 600 }}>A选: </Text>
                        <Text style={{ fontSize: 20, color: '#E0E0F0' }}>
                          {item.choiceAText || (item.inA ? '—' : '未到')}
                        </Text>
                      </View>
                      <View className={styles.inlineSideB}>
                        <Text style={{ fontSize: 20, color: '#B597FF', fontWeight: 600 }}>B选: </Text>
                        <Text style={{ fontSize: 20, color: '#E0E0F0' }}>
                          {item.choiceBText || (item.inB ? '—' : '未到')}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View className={styles.diffCompare}>
                    <View className={styles.diffSideA}>
                      <Text className={styles.sideLabel}>A</Text>
                      <View className={styles.sideBadges}>
                        {item.inA ? (
                          <>
                            <View className={classnames(styles.recordBadge, item.recordedA && styles.recorded)}>
                              {item.recordedA ? '✓ 已录' : '○ 未录'}
                            </View>
                            {item.perfA && (
                              <Text className={styles.intensityText}>{item.perfA} {item.emotionA ? `(${item.emotionA.toFixed(1)})` : ''}</Text>
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
                            {item.perfB && (
                              <Text className={styles.intensityText}>{item.perfB} {item.emotionB ? `(${item.emotionB.toFixed(1)})` : ''}</Text>
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
            );
          })}
        </ScrollView>
      </View>

      {/* 评审结论区 */}
      <View className={styles.reviewSection}>
        <Text className={styles.sectionTitle}>🎯 评审结论</Text>
        <View className={styles.recButtons}>
          <Button
            className={classnames(styles.recBtn, styles.recBtnA, recommendTarget === 'A' && styles.recBtnActive)}
            onClick={() => setRecommendTarget('A')}
          >⭐ 推荐 A 版</Button>
          <Button
            className={classnames(styles.recBtn, styles.recBtnB, recommendTarget === 'B' && styles.recBtnActive)}
            onClick={() => setRecommendTarget('B')}
          >⭐ 推荐 B 版</Button>
        </View>
        <View className={styles.reviewForm}>
          <Input
            className={styles.reviewerInput}
            placeholder="评审人"
            value={reviewer}
            onInput={e => setReviewer(e.detail.value)}
            maxlength={10}
          />
        </View>
        <Textarea
          className={styles.reasonInput}
          placeholder="请填写采用理由：如A版情绪曲线更贴合恐怖氛围，B版第8句表现更好但整体节奏偏快..."
          value={reviewReason}
          onInput={e => setReviewReason(e.detail.value)}
          maxlength={300}
          autoHeight
        />
        <Button
          className={classnames(styles.submitReviewBtn, (!recommendTarget || !reviewReason.trim()) && styles.disabled)}
          onClick={handleSubmitReview}
        >📌 提交评审结论</Button>
      </View>
    </View>
  );
};

export default TrackCompare;
