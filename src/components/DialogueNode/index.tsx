import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';
import { DialogueNode as NodeType } from '@/types/dialogue';
import PerformanceTag from '@/components/PerformanceTag';

interface Props {
  node: NodeType;
  active?: boolean;
  onClick?: () => void;
  showChoices?: boolean;
}

const DialogueNode: React.FC<Props> = ({ node, active = false, onClick, showChoices = true }) => {
  const annCount = (node.annotations || []).length;

  return (
    <View
      className={classnames(styles.card, active && styles.active)}
      onClick={onClick}
    >
      <View className={styles.header}>
        <View className={styles.role}>
          <View
            className={styles.avatar}
            style={{ background: node.role === 'c1' ? '#9D6BFF' : node.role === 'c2' ? '#FF3B5C' : '#2FD4A6' }}
          >
            {node.character.slice(0, 1)}
          </View>
          <View className={styles.nameBox}>
            <Text className={styles.name}>{node.character}</Text>
            <Text className={styles.nodeId}>#{node.id}</Text>
          </View>
        </View>

        <View className={styles.status}>
          {annCount > 0 && (
            <View className={styles.annotationCount}>
              <Text>📝</Text>
              <Text>{annCount}条批注</Text>
            </View>
          )}
          {node.recorded ? (
            <View className={styles.recordedBadge}>✅ 已录制</View>
          ) : (
            <View className={styles.pendingBadge}>⏳ 待录制</View>
          )}
        </View>
      </View>

      <View className={styles.text}>{node.text}</View>

      <View className={styles.footer}>
        <PerformanceTag
          type={node.performance.type}
          label={node.performance.label}
          intensity={node.performance.intensity}
        />
        {node.nextNodeId && !node.choices && (
          <Text className={styles.choiceArrow}>→ 下一句: #{node.nextNodeId}</Text>
        )}
      </View>

      {showChoices && node.choices && node.choices.length > 0 && (
        <View className={styles.choices}>
          <Text className={styles.choicesTitle}>🔀 玩家分支选项（{node.choices.length}条）</Text>
          {node.choices.map((ch, idx) => (
            <View className={styles.choiceItem} key={ch.id}>
              <Text className={styles.choiceLabel}>{String.fromCharCode(65 + idx)}.</Text>
              <Text className={styles.choiceText}>{ch.text}</Text>
              <Text className={styles.choiceArrow}>→ #{ch.nextNodeId}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default DialogueNode;
