import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';
import { Annotation, DialogueNode } from '@/types/dialogue';
import { formatTime } from '@/utils/emotion';

interface Props {
  annotation: Annotation;
  dialogue?: DialogueNode;
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

const AnnotationCard: React.FC<Props> = ({ annotation, dialogue, onClick }) => {
  const keywords = extractKeywords(annotation.content);
  const isAudio = annotation.role === 'audio';

  return (
    <View className={styles.card} onClick={onClick}>
      <View className={styles.header}>
        <View className={styles.user}>
          <View className={classnames(styles.avatar, isAudio && styles.audioAvatar)}>
            {annotation.author.slice(0, 1)}
          </View>
          <Text className={styles.userName}>
            {annotation.author}
            <Text className={styles.roleBadge}>
              {annotation.role === 'director' ? '导演' : '录音师'}
            </Text>
          </Text>
        </View>
        <Text className={styles.time}>{formatTime(annotation.createdAt)}</Text>
      </View>

      {dialogue && (
        <View className={styles.dialogueRef}>
          <Text className={styles.refLabel}>针对 #{dialogue.id}</Text>
          <Text className={styles.refText}>{dialogue.text}</Text>
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
