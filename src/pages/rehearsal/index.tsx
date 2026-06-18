import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Button, ScrollView, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import { useDialogue } from '@/store/DialogueContext';
import { DialogueNode, BranchChoice, Annotation, RehearsalTrack } from '@/types/dialogue';
import PerformanceTag from '@/components/PerformanceTag';
import EmotionCurve from '@/components/EmotionCurve';
import Recorder from '@/components/Recorder';
import TrackCard from '@/components/TrackCard';
import TrackCompare from '@/components/TrackCompare';
import { collectPath, buildEmotionCurve, getEmotionColor, formatDuration, formatRelative } from '@/utils/emotion';

type PageMode = 'rehearse' | 'tracks';

const RehearsalPage: React.FC = () => {
  const {
    project,
    markRecorded,
    getAnnotationsByDialogue,
    saveRehearsalTrack,
    rehearsalTracks
  } = useDialogue();

  const [pageMode, setPageMode] = useState<PageMode>('rehearse');
  const [choiceMap, setChoiceMap] = useState<Record<string, string>>({});
  const [choiceIdMap, setChoiceIdMap] = useState<Record<string, string>>({});
  const [pathIdx, setPathIdx] = useState(0);
  const [recordedInSession, setRecordedInSession] = useState<string[]>([]);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [actorName, setActorName] = useState('');
  const [trackNote, setTrackNote] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedTrackAId, setSelectedTrackAId] = useState<string | null>(null);
  const [selectedTrackBId, setSelectedTrackBId] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  const currentPath = useMemo(() => {
    return collectPath(project.nodes, project.startNodeId, choiceMap);
  }, [project.nodes, project.startNodeId, choiceMap]);

  const pathEmotion = useMemo(() => buildEmotionCurve(currentPath), [currentPath]);
  const currentNode: DialogueNode | undefined = currentPath[pathIdx];
  const previousNode: DialogueNode | undefined = currentPath[pathIdx - 1];
  const isAtEnd = currentPath.length > 0 && pathIdx >= currentPath.length - 1;

  useEffect(() => {
    if (pathIdx >= currentPath.length) {
      setPathIdx(Math.max(0, currentPath.length - 1));
    }
  }, [currentPath.length, pathIdx]);

  const annotations: Annotation[] = currentNode
    ? getAnnotationsByDialogue(currentNode.id)
    : [];
  const firstAnnotation = annotations[0];

  const goPrev = () => {
    if (pathIdx > 0) {
      setPathIdx(pathIdx - 1);
    }
  };

  const goNext = () => {
    if (currentNode && currentNode.choices && currentNode.choices.length > 0) {
      Taro.showToast({ title: '请先选择分支', icon: 'none' });
      return;
    }
    if (pathIdx < currentPath.length - 1) {
      setPathIdx(pathIdx + 1);
    }
  };

  const selectChoice = (choice: BranchChoice) => {
    setChoiceMap(prev => ({ ...prev, [currentNode!.id]: choice.nextNodeId }));
    setChoiceIdMap(prev => ({ ...prev, [currentNode!.id]: choice.id }));
    setTimeout(() => {
      setPathIdx(p => p + 1);
    }, 80);
  };

  const handleRecordComplete = (duration: number) => {
    if (currentNode) {
      markRecorded(currentNode.id, duration);
      setRecordedInSession(prev => 
        prev.includes(currentNode.id) ? prev : [...prev, currentNode.id]
      );
      Taro.showToast({ title: `已保存（${duration}秒）`, icon: 'success' });
    }
  };

  const resetRehearsal = () => {
    setChoiceMap({});
    setChoiceIdMap({});
    setPathIdx(0);
    setRecordedInSession([]);
    Taro.showToast({ title: '已重置排练路径', icon: 'none' });
  };

  const jumpToStart = () => {
    setPathIdx(0);
  };

  const handleFinishAndSave = () => {
    if (recordedInSession.length === 0) {
      Taro.showToast({ title: '本次还没有录制任何台词', icon: 'none' });
      return;
    }
    setShowSaveSheet(true);
  };

  const handleSaveTrack = () => {
    if (!actorName.trim()) {
      Taro.showToast({ title: '请输入演员姓名', icon: 'none' });
      return;
    }
    saveRehearsalTrack({
      pathNodeIds: currentPath.map(n => n.id),
      choices: choiceIdMap,
      recordedNodeIds: recordedInSession,
      emotionCurve: pathEmotion,
      actorName: actorName.trim(),
      note: trackNote.trim() || undefined
    });
    setShowSaveSheet(false);
    setActorName('');
    setTrackNote('');
    setRecordedInSession([]);
    Taro.showToast({ title: '轨迹已保存', icon: 'success' });
    setTimeout(() => {
      setPageMode('tracks');
    }, 600);
  };

  const handleResumeTrack = (track: RehearsalTrack) => {
    const nextChoiceMap: Record<string, string> = {};
    const nextChoiceIdMap: Record<string, string> = {};
    Object.entries(track.choices).forEach(([nodeId, choiceId]) => {
      nextChoiceIdMap[nodeId] = choiceId;
      const node = project.nodes[nodeId];
      if (node?.choices) {
        const choice = node.choices.find(c => c.id === choiceId);
        if (choice) {
          nextChoiceMap[nodeId] = choice.nextNodeId;
        }
      }
    });
    setChoiceMap(nextChoiceMap);
    setChoiceIdMap(nextChoiceIdMap);
    setRecordedInSession(track.recordedNodeIds);
    setPathIdx(0);
    setPageMode('rehearse');
    Taro.showToast({ title: '已加载轨迹，可继续排练', icon: 'success' });
  };

  const handleDeleteTrack = () => {
    // 刷新列表
  };

  const handleSelectTrackA = (trackId: string) => {
    setSelectedTrackAId(prev => prev === trackId ? null : trackId);
  };

  const handleSelectTrackB = (trackId: string) => {
    setSelectedTrackBId(prev => prev === trackId ? null : trackId);
  };

  const startCompare = () => {
    if (!selectedTrackAId || !selectedTrackBId) {
      Taro.showToast({ title: '请先选择两条轨迹', icon: 'none' });
      return;
    }
    setShowCompare(true);
  };

  const toggleCompareMode = () => {
    setCompareMode(prev => !prev);
    setSelectedTrackAId(null);
    setSelectedTrackBId(null);
  };

  const selectedTrackA = rehearsalTracks.find(t => t.id === selectedTrackAId);
  const selectedTrackB = rehearsalTracks.find(t => t.id === selectedTrackBId);

  if (!currentNode) {
    return (
      <ScrollView className={styles.page} scrollY>
        <View className={styles.emptyCard}>
          <Text className={styles.emptyIcon}>🎬</Text>
          <Text className={styles.emptyTitle}>暂无排练内容</Text>
          <Text className={styles.emptyText}>请先到"剧本导入"页导入对白剧本</Text>
          <Button className={styles.emptyBtn}>前往剧本导入</Button>
        </View>
      </ScrollView>
    );
  }

  const nextHintReason = firstAnnotation
    ? firstAnnotation.content
    : currentPath.length > 2 && pathIdx < currentPath.length - 1
      ? '注意情绪曲线的走向：当前位置不是情绪最高点，为后续爆发保留张力'
      : undefined;

  const character = project.characters.find(c => c.id === currentNode.role);
  const prevCharacter = previousNode
    ? project.characters.find(c => c.id === previousNode.role)
    : undefined;

  return (
    <>
      <ScrollView className={styles.page} scrollY>
        {/* 顶部模式切换 */}
        <View className={styles.modeTabs}>
          <Button
            className={classnames(styles.modeTab, pageMode === 'rehearse' && styles.activeModeTab)}
            onClick={() => setPageMode('rehearse')}
          >
            🎤 正在排练
          </Button>
          <Button
            className={classnames(styles.modeTab, pageMode === 'tracks' && styles.activeModeTab)}
            onClick={() => setPageMode('tracks')}
          >
            📋 历史轨迹 ({rehearsalTracks.length})
          </Button>
        </View>

        {pageMode === 'tracks' ? (
          <View>
            <View className={styles.tracksHeader}>
              <View>
                <Text className={styles.tracksTitle}>排练轨迹记录</Text>
                <Text className={styles.tracksSub}>
                  每次从开头走到结尾后生成一条记录，可回看或继续录
                </Text>
              </View>
              <View style={{ display: 'flex', gap: '16rpx' }}>
                <Button
                  className={classnames(styles.compareToggle, compareMode && styles.compareActive)}
                  onClick={toggleCompareMode}
                >
                  {compareMode ? '取消对比' : '🔍 对比'}
                </Button>
              </View>
            </View>

            {compareMode && rehearsalTracks.length >= 2 && (
              <View className={styles.compareBar}>
                <View className={styles.compareInfo}>
                  <Text className={styles.compareInfoText}>
                    已选 A: {selectedTrackA?.title || '未选择'}
                  </Text>
                  <Text className={styles.compareInfoText}>
                    已选 B: {selectedTrackB?.title || '未选择'}
                  </Text>
                </View>
                <Button
                  className={classnames(
                    styles.compareStart,
                    (!selectedTrackAId || !selectedTrackBId) && styles.disabled
                  )}
                  onClick={startCompare}
                >
                  开始对比 →
                </Button>
              </View>
            )}

            {rehearsalTracks.length === 0 ? (
              <View className={styles.emptyTracks}>
                <Text className={styles.emptyTracksIcon}>📭</Text>
                <Text className={styles.emptyTracksTitle}>暂无排练记录</Text>
                <Text className={styles.emptyTracksText}>
                  完成一次完整的排练路径后，点击"保存本次轨迹"即可保存
                </Text>
              </View>
            ) : (
              rehearsalTracks.map(track => (
                <TrackCard
                  key={track.id}
                  track={track}
                  onResume={handleResumeTrack}
                  onDelete={handleDeleteTrack}
                  compareMode={compareMode}
                  selectedA={selectedTrackAId === track.id}
                  selectedB={selectedTrackBId === track.id}
                  onSelectA={handleSelectTrackA}
                  onSelectB={handleSelectTrackB}
                />
              ))
            )}
          </View>
        ) : (
          <>
            {/* 顶部进度条 */}
            <View className={styles.header}>
              <View className={styles.progressBar}>
                <View className={styles.stepIndicator}>
                  <View className={styles.stepChip}>第 {pathIdx + 1} 句</View>
                  <Text className={styles.totalText}>共 {currentPath.length} 句</Text>
                </View>
                <View style={{ display: 'flex', gap: '16rpx' }}>
                  <Button
                    className={classnames(styles.navBtn, pathIdx === 0 && styles.disabled)}
                    onClick={goPrev}
                  >‹</Button>
                  <Button
                    className={classnames(
                      styles.navBtn,
                      (pathIdx >= currentPath.length - 1 || (currentNode.choices && currentNode.choices.length > 0)) && styles.disabled
                    )}
                    onClick={goNext}
                  >›</Button>
                </View>
              </View>

              <View className={styles.pathDots}>
                {currentPath.map((_, i) => (
                  <View
                    key={i}
                    className={classnames(
                      styles.dot,
                      i < pathIdx && styles.passed,
                      i === pathIdx && styles.current
                    )}
                  />
                ))}
              </View>
            </View>

            {/* 上一句提示 */}
            {previousNode && (
              <View className={styles.previousBlock}>
                <View className={styles.prevLabel}>
                  <Text>🎧 听到的上一句（请先感受情境）</Text>
                </View>
                <View className={styles.prevMeta}>
                  {prevCharacter && (
                    <View
                      className={styles.roleAvatar}
                      style={{
                        width: '40rpx',
                        height: '40rpx',
                        fontSize: '20rpx',
                        background: prevCharacter.color
                      }}
                    >
                      {prevCharacter.name.slice(0, 1)}
                    </View>
                  )}
                  <Text className={styles.prevName}>{previousNode.character}</Text>
                </View>
                <Text className={styles.prevText}>"{previousNode.text}"</Text>
                <View className={styles.prevTag}>
                  <PerformanceTag
                    type={previousNode.performance.type}
                    label={previousNode.performance.label}
                  />
                </View>
              </View>
            )}

            {/* 当前台词卡 */}
            <View className={styles.currentCard}>
              <View className={styles.currentHeader}>
                <View className={styles.currentRole}>
                  <View
                    className={styles.roleAvatar}
                    style={{ background: character?.color || '#7B3AED' }}
                  >
                    {character?.name?.slice(0, 1) || '?'}
                  </View>
                  <View>
                    <Text className={styles.roleName}>{currentNode.character}</Text>
                    <View style={{ marginTop: '4rpx' }}>
                      <PerformanceTag
                        type={currentNode.performance.type}
                        label={currentNode.performance.label}
                        intensity={currentNode.performance.intensity}
                      />
                    </View>
                  </View>
                </View>
                <View className={styles.nodeBadge}>#{currentNode.id}</View>
              </View>

              <View className={styles.currentText}>{currentNode.text}</View>

              <View className={styles.currentFooter}>
                <View className={styles.intensityBox}>
                  <Text className={styles.intensityLabel}>情绪强度</Text>
                  <View className={styles.intensityBar}>
                    <View
                      className={styles.intensityFill}
                      style={{ width: `${(currentNode.performance.intensity / 10) * 100}%` }}
                    />
                  </View>
                  <Text
                    className={styles.intensityNum}
                    style={{ color: getEmotionColor(currentNode.performance.type) }}
                  >
                    {currentNode.performance.intensity}
                  </Text>
                </View>
                {currentNode.recorded && (
                  <Text
                    style={{
                      fontSize: '22rpx',
                      color: '#2FD4A6',
                      fontWeight: 500
                    }}
                  >
                    ✅ 已录制
                    {currentNode.duration ? ` · ${formatDuration(currentNode.duration)}` : ''}
                    {currentNode.lastRecordedAt ? `（${formatRelative(currentNode.lastRecordedAt)}）` : ''}
                  </Text>
                )}
              </View>
            </View>

            {/* 导演批注提示 */}
            {firstAnnotation && (
              <View className={styles.annotationsTip}>
                <View className={styles.annTitle}>
                  <Text>📝 {firstAnnotation.author}的批注</Text>
                </View>
                <Text className={styles.annContent}>{firstAnnotation.content}</Text>
              </View>
            )}

            {/* 录音组件 */}
            <View style={{ marginBottom: '32rpx' }}>
              <Recorder
                onComplete={handleRecordComplete}
                hintText={`导演要求：${currentNode.performance.label}。注意情绪强度为 ${currentNode.performance.intensity}/10`}
              />
            </View>

            {/* 分支选择 */}
            {currentNode.choices && currentNode.choices.length > 0 && (
              <View className={styles.choicesBlock}>
                <View className={styles.choicesHeader}>
                  <Text className={styles.choicesTitle}>🔀 玩家选择后将进入</Text>
                  <Text className={styles.choicesSub}>请选择分支继续排练</Text>
                </View>
                {currentNode.choices.map((ch, idx) => (
                  <View
                    key={ch.id}
                    className={styles.choiceCard}
                    onClick={() => selectChoice(ch)}
                  >
                    <View className={styles.choiceLetter}>{String.fromCharCode(65 + idx)}</View>
                    <View className={styles.choiceBody}>
                      <Text className={styles.choiceMain}>{ch.text}</Text>
                      <Text className={styles.choiceHint}>将进入对白 #{ch.nextNodeId}</Text>
                    </View>
                    <Text className={styles.choiceArrow}>→</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 情绪曲线 */}
            <View style={{ marginBottom: '32rpx' }}>
              <EmotionCurve
                points={pathEmotion}
                currentIndex={pathIdx}
                title="本分支情绪曲线（看清张力走向）"
                highlightReason={nextHintReason}
              />
            </View>

            {/* 路径终点操作 */}
            {isAtEnd && (!currentNode.choices || currentNode.choices.length === 0) && (
              <View className={styles.endBlock}>
                <View className={styles.endHeader}>
                  <Text className={styles.endIcon}>🏁</Text>
                  <Text className={styles.endTitle}>已到达路径终点</Text>
                </View>
                <Text className={styles.endText}>
                  本次排练共 {currentPath.length} 句，已录制 {recordedInSession.length} 句
                </Text>
                <Button className={styles.saveTrackBtn} onClick={handleFinishAndSave}>
                  💾 保存本次轨迹
                </Button>
              </View>
            )}

            {/* 重置操作 */}
            <View className={styles.resetRow}>
              <Button className={styles.resetBtn} onClick={jumpToStart}>⏮ 回到开头</Button>
              <Button className={classnames(styles.resetBtn, styles.primaryReset)} onClick={resetRehearsal}>
                🔄 重新选择分支
              </Button>
            </View>
          </>
        )}
      </ScrollView>

      {/* 保存轨迹弹窗 */}
      {showSaveSheet && (
        <View className={styles.modalMask} onClick={() => setShowSaveSheet(false)}>
          <View className={styles.modalSheet} onClick={e => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>💾 保存排练轨迹</Text>
              <Button className={styles.closeBtn} onClick={() => setShowSaveSheet(false)}>✕</Button>
            </View>
            <ScrollView className={styles.modalList} scrollY>
              <View className={styles.formGroup}>
                <Text className={styles.formLabel}>演员姓名</Text>
                <Input
                  className={styles.formInput}
                  placeholder="请输入演员姓名"
                  value={actorName}
                  onInput={e => setActorName(e.detail.value)}
                  maxlength={20}
                />
              </View>
              <View className={styles.formGroup}>
                <Text className={styles.formLabel}>备注（可选）</Text>
                <Input
                  className={styles.formInput}
                  placeholder="例如：第三次试录、情绪偏强版等"
                  value={trackNote}
                  onInput={e => setTrackNote(e.detail.value)}
                  maxlength={50}
                />
              </View>
              <View className={styles.trackSummary}>
                <Text className={styles.summaryTitle}>轨迹概览</Text>
                <View className={styles.summaryRow}>
                  <Text className={styles.summaryLabel}>路径长度</Text>
                  <Text className={styles.summaryValue}>{currentPath.length} 句</Text>
                </View>
                <View className={styles.summaryRow}>
                  <Text className={styles.summaryLabel}>本次录制</Text>
                  <Text className={styles.summaryValue}>{recordedInSession.length} 句</Text>
                </View>
                <View className={styles.summaryRow}>
                  <Text className={styles.summaryLabel}>分支选择</Text>
                  <Text className={styles.summaryValue}>{Object.keys(choiceMap).length} 次</Text>
                </View>
              </View>
            </ScrollView>
            <Button
              className={classnames(styles.primaryBtn, (!actorName.trim() || recordedInSession.length === 0) && styles.disabled)}
              onClick={handleSaveTrack}
            >
              确认保存
            </Button>
          </View>
        </View>
      )}

      {/* 轨迹对比弹窗 */}
      {showCompare && selectedTrackA && selectedTrackB && (
        <View className={styles.modalMask} onClick={() => setShowCompare(false)}>
          <View className={classnames(styles.modalSheet, styles.compareSheet)} onClick={e => e.stopPropagation()}>
            <TrackCompare
              trackA={selectedTrackA}
              trackB={selectedTrackB}
              onClose={() => setShowCompare(false)}
            />
          </View>
        </View>
      )}
    </>
  );
};

export default RehearsalPage;
