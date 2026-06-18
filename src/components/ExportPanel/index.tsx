import React, { useMemo, useState } from 'react';
import { View, Text, Button, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import { useDialogue } from '@/store/DialogueContext';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type TabType = 'all' | 'script' | 'annotations' | 'tracks';

const ExportPanel: React.FC<Props> = ({ visible, onClose }) => {
  const { exportAllAsText, project, annotations, rehearsalTracks } = useDialogue();
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const fullText = useMemo(() => exportAllAsText(), [exportAllAsText]);

  const scriptText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`【${project.title}】- 对白剧本`);
    lines.push(`游戏: ${project.game} / 场景: ${project.scene}`);
    lines.push('');
    const seen = new Set<string>();
    Object.values(project.nodes).forEach(n => {
      if (seen.has(n.id)) return;
      seen.add(n.id);
      lines.push(`#${n.id} · ${n.character}`);
      lines.push(`  ${n.text}`);
      lines.push(`  🎭 ${n.performance.label} (${n.performance.intensity}/10)`);
      if (n.recorded) lines.push(`  ✓ 已录制 ${n.duration}s`);
      if (n.choices) {
        n.choices.forEach((c, i) => {
          lines.push(`  ${String.fromCharCode(65 + i)}. "${c.text}" → #${c.nextNodeId}`);
        });
      } else if (n.nextNodeId) {
        lines.push(`  → #${n.nextNodeId}`);
      }
      lines.push('');
    });
    return lines.join('\n');
  }, [project]);

  const annText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`【${project.title}】- 导演批注汇总`);
    lines.push(`共 ${annotations.length} 条批注，关联 ${new Set(annotations.flatMap(a => a.dialogueIds)).size} 句台词`);
    lines.push('');
    annotations.forEach((a, i) => {
      lines.push(`${i + 1}. [${a.dialogueIds.map(id => '#' + id).join(', ')}] ${a.author} (${a.role === 'director' ? '导演' : '录音师'}):`);
      lines.push(`   ${a.content}`);
      lines.push('');
    });
    return lines.join('\n');
  }, [annotations, project.title]);

  const trackText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`【${project.title}】- 排练轨迹记录`);
    lines.push(`共 ${rehearsalTracks.length} 条排练记录`);
    lines.push('');
    rehearsalTracks.forEach((t, i) => {
      const avg = t.emotionCurve.length > 0
        ? (t.emotionCurve.reduce((s, p) => s + p.value, 0) / t.emotionCurve.length).toFixed(1)
        : '-';
      lines.push(`${i + 1}. ${t.title}`);
      lines.push(`   演员: ${t.actorName} | 节点: ${t.pathNodeIds.length} | 录制: ${t.recordedNodeIds.length} | 平均情绪: ${avg}`);
      lines.push(`   路径: ${t.pathNodeIds.map(id => '#' + id).join(' → ')}`);
      if (t.note) lines.push(`   备注: ${t.note}`);
      lines.push('');
    });
    return lines.join('\n');
  }, [rehearsalTracks, project.title]);

  const displayText = {
    all: fullText,
    script: scriptText,
    annotations: annText,
    tracks: trackText
  }[activeTab];

  const handleCopy = async () => {
    try {
      await Taro.setClipboardData({ data: displayText });
      Taro.showToast({ title: '已复制到剪贴板', icon: 'success' });
    } catch (e) {
      Taro.showToast({ title: '复制失败', icon: 'none' });
    }
  };

  const handleShare = () => {
    Taro.showToast({ title: '分享功能即将上线', icon: 'none' });
  };

  if (!visible) return null;

  return (
    <View className={styles.mask} onClick={onClose}>
      <View className={styles.sheet} onClick={e => e.stopPropagation()}>
        <View className={styles.header}>
          <Text className={styles.title}>📤 导出台本</Text>
          <Button className={styles.closeBtn} onClick={onClose}>×</Button>
        </View>

        <View className={styles.tabs}>
          <Button
            className={classnames(styles.tab, activeTab === 'all' && styles.active)}
            onClick={() => setActiveTab('all')}
          >全部</Button>
          <Button
            className={classnames(styles.tab, activeTab === 'script' && styles.active)}
            onClick={() => setActiveTab('script')}
          >对白剧本</Button>
          <Button
            className={classnames(styles.tab, activeTab === 'annotations' && styles.active)}
            onClick={() => setActiveTab('annotations')}
          >导演批注</Button>
          <Button
            className={classnames(styles.tab, activeTab === 'tracks' && styles.active)}
            onClick={() => setActiveTab('tracks')}
          >排练记录</Button>
        </View>

        <ScrollView className={styles.content} scrollY>
          <View className={styles.previewBox}>
            <Text className={styles.previewText}>{displayText}</Text>
          </View>
        </ScrollView>

        <View className={styles.footer}>
          <Button className={styles.secBtn} onClick={handleShare}>📤 分享</Button>
          <Button className={styles.primaryBtn} onClick={handleCopy}>📋 复制全部文本</Button>
        </View>
      </View>
    </View>
  );
};

export default ExportPanel;
