import React, { useState } from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';
import { Annotation, DialogueNode } from '@/types/dialogue';
import { useDialogue } from '@/store/DialogueContext';
import { formatTime } from '@/utils/emotion';

interface Props {
  annotation: Annotation;
  onClick?: () => void;
}

const extractKeywords = (text: string): string[] => {
  const patterns = [
    /"([^"]+)"/g,
    /「([^」]+)」/g,
    /像[^，。,.！!？?\s]+/g,
    /停顿[^，。,.！!？?\s]*/g,
    /不要[^，。,.！!？?\s]+/g,
    /必须[^，。,.！!？?\s]+/g,
    /保持[^，。,.！!？?\s]+/g
  ];
  const found: string[] = [];
  patterns.forEach(p => {
    const matches = text.match(p);
    if (matches) found.push(...matches.slice(0, 2));
  });
  return found.slice(0, 4);
};

const AnnotationCard: React.FC<Props> = ({ annotation, onClick }) => {
  const { project, getCharacterById } = useDialogue();
  const [expanded, setExpanded] = useState(false);

  const keywords = extractKeywords(annotation.content);
  const isAudio = annotation.role === 'audio';

  const linkedNodes: DialogueNode[] = annotation.dialogueIds
    .map(id => project.nodes[id])
    .filter(Boolean) as DialogueNode[];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
    onClick?.();
  };

  return (
    <View className={classnames(styles.card, expanded && styles.expanded)} onClick={handleClick}>
      <View className={styles.header}>
        <View className={styles.user}>
          <View className={classnames(styles.avatar, isAudio && styles.audioAvatar)}>
            {annotation.author.slice(0, 1)}
          </View>
          <View style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Text className={styles.userName}>
              {annotation.author}
              <Text className={styles.roleBadge}>
                {annotation.role === 'director' ? '导演' : '录音师'}
              </Text>
            </Text>
            <View style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text className={styles.time}>{formatTime(annotation.createdAt)}</Text>
              <View className={styles.linkBadge}>
                <Text>🔗 关联 {linkedNodes.length} 句</Text>
              </View>
            </View>
          </View>
        </View>
        <Text className={classnames(styles.arrow, expanded && styles.expandedArrow)}>▾</Text>
      </View>

      {expanded && linkedNodes.length > 0 && (
        <View className={styles.linkedSection}>
          <Text className={styles.linkedTitle}>📜 关联的台词：</Text>
          <View className={styles.linkedList}>
            {linkedNodes.map((node, idx) => {
              const ch = getCharacterById(node.role);
              return (
                <View key={node.id} className={styles.linkedItem}>
                  <View className={styles.linkedIdx}>{idx + 1}</View>
                  <View className={styles.linkedContent}>
                    <View className={styles.linkedMeta}>
                      <Text className={styles.linkedId}>#{node.id}</Text>
                      <Text className={styles.linkedChar} style={{ color: ch?.color }}>{node.character}</Text>
                    </View>
                    <Text className={styles.linkedText}>{node.text}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {!expanded && linkedNodes.length > 0 && (
        <View className={styles.dialogueRef}>
          <Text className={styles.refLabel}>
            针对 #{linkedNodes[0].id}
            {linkedNodes.length > 1 && ` 等 ${linkedNodes.length} 句`}
          </Text>
          <Text className={styles.refText}>{linkedNodes[0].text}</Text>
        </View>
      )}

      <View className={styles.content}>
        <Text className={styles.quoteMark}>“</Text>
        <Text>{annotation.content}</Text>
      </View>

      {keywords.length > 0 && (
        <View className={styles.keywords}>
          {keywords.map((k, i) => (
            <View className={styles.keyword} key={i}>
              <Text>🔑 {k.replace(/["「」]/g, '')}</Text>
            </View>
          ))}
        </View>
      )}

      <View className={styles.tags}>
        <View className={styles.tag}><Text>🎭 心理恐怖</Text></View>
        <View className={styles.tag}><Text>📐 表演尺度</Text></View>
      </View>
    </View>
  );
};

export default AnnotationCard;
