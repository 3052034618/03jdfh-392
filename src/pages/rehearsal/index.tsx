import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Button, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import { useDialogue } from '@/store/DialogueContext';
import { DialogueNode, BranchChoice, Annotation } from '@/types/dialogue';
import PerformanceTag from '@/components/PerformanceTag';
import EmotionCurve from '@/components/EmotionCurve';
import Recorder from '@/components/Recorder';
import { collectPath, buildEmotionCurve, getEmotionColor, formatDuration, formatRelative } from '@/utils/emotion';

const RehearsalPage: React.FC = () => {
  const {
    project,
    rehearsalNodeId,
    setRehearsalNodeId,
    markRecorded,
    getAnnotationsByDialogue
  } = useDialogue();

  const [choiceMap, setChoiceMap] = useState<Record<string, string>>({});
  const [pathIdx, setPathIdx] = useState(0);
  const [justRecorded, setJustRecorded] = useState(false);

  // 根据选择构建当前路径
  const currentPath = useMemo(() => {
    return collectPath(project.nodes, project.startNodeId, choiceMap);
  }, [project.nodes, project.startNodeId, choiceMap]);

  const pathEmotion = useMemo(() => buildEmotionCurve(currentPath), [currentPath]);
  const currentNode: DialogueNode | undefined = currentPath[pathIdx];
  const previousNode: DialogueNode | undefined = currentPath[pathIdx - 1];

  useEffect(() => {
    // 重置路径索引时不要越界
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
      setJustRecorded(false);
    }
  };

  const goNext = () => {
    if (currentNode && currentNode.choices && currentNode.choices.length > 0) {
      // 有分支的情况需要先选择
      Taro.showToast({ title: '请先选择分支', icon: 'none' });
      return;
    }
    if (pathIdx < currentPath.length - 1) {
      setPathIdx(pathIdx + 1);
      setJustRecorded(false);
    }
  };

  const selectChoice = (choice: BranchChoice) => {
    setChoiceMap(prev => ({ ...prev, [currentNode!.id]: choice.nextNodeId }));
    // 下一句微延迟等路径更新
    setTimeout(() => {
      setPathIdx(p => p + 1);
      setJustRecorded(false);
    }, 80);
  };

  const handleRecordComplete = (duration: number) => {
    if (currentNode) {
      markRecorded(currentNode.id, duration);
      setJustRecorded(true);
      Taro.showToast({ title: `已保存（${duration}秒）`, icon: 'success' });
    }
  };

  const resetRehearsal = () => {
    setChoiceMap({});
    setPathIdx(0);
    setJustRecorded(false);
    Taro.showToast({ title: '已重置排练路径', icon: 'none' });
  };

  const jumpToStart = () => {
    setPathIdx(0);
    setJustRecorded(false);
  };

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
    <ScrollView className={styles.page} scrollY>
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

      {/* 重置操作 */}
      <View className={styles.resetRow}>
        <Button className={styles.resetBtn} onClick={jumpToStart}>⏮ 回到开头</Button>
        <Button className={classnames(styles.resetBtn, styles.primaryReset)} onClick={resetRehearsal}>
          🔄 重新选择分支
        </Button>
      </View>
    </ScrollView>
  );
};

export default RehearsalPage;
