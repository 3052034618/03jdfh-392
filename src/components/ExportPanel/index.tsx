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

type TabType = 'all' | 'script' | 'annotations' | 'tracks' | 'path';

const ExportPanel: React.FC<Props> = ({ visible, onClose }) => {
  const { exportAllAsText, project, annotations, rehearsalTracks, nodesList } = useDialogue();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedTrackId, setSelectedTrackId] = useState<string>('');
  const [showTrackPicker, setShowTrackPicker] = useState(false);
  const [showRolePicker, setShowRolePicker] = useState(false);

  const selectedTrack = useMemo(() => {
    return rehearsalTracks.find(t => t.id === selectedTrackId);
  }, [rehearsalTracks, selectedTrackId]);

  // 按角色筛选后的节点
  const filteredNodes = useMemo(() => {
    if (roleFilter === 'all') return nodesList;
    return nodesList.filter(n => n.role === roleFilter);
  }, [nodesList, roleFilter]);

  // 按角色筛选后的批注
  const filteredAnnotations = useMemo(() => {
    if (roleFilter === 'all') return annotations;
    return annotations.filter(a =>
      a.dialogueIds.some(did => {
        const node = project.nodes[did];
        return node?.role === roleFilter;
      })
    );
  }, [annotations, roleFilter, project.nodes]);

  const fullText = useMemo(() => exportAllAsText(), [exportAllAsText]);

  const scriptText = useMemo(() => {
    const lines: string[] = [];
    const roleName = roleFilter === 'all' ? '全部角色' : project.characters.find(c => c.id === roleFilter)?.name || '';
    lines.push(`【${project.title}】- 对白剧本`);
    lines.push(`游戏: ${project.game} / 场景: ${project.scene}`);
    lines.push(`角色范围: ${roleName} (共 ${filteredNodes.length} 句)`);
    lines.push('');
    lines.push('═'.repeat(40));
    lines.push('');

    filteredNodes.forEach((n, i) => {
      lines.push(`${i + 1}. #${n.id} · ${n.character}`);
      lines.push(`   ${n.text}`);
      lines.push(`   🎭 ${n.performance.label} (强度 ${n.performance.intensity}/10)`);
      if (n.recorded) lines.push(`   ✓ 已录制 · 时长 ${n.duration}s`);
      if (n.choices && n.choices.length > 0) {
        lines.push('   分支选择:');
        n.choices.forEach((c, idx) => {
          const targetNode = project.nodes[c.nextNodeId];
          const targetChar = targetNode?.character || '?';
          lines.push(`     ${String.fromCharCode(65 + idx)}. "${c.text}" → #${c.nextNodeId} (${targetChar})`);
        });
      } else if (n.nextNodeId) {
        const targetNode = project.nodes[n.nextNodeId];
        lines.push(`   承接 → #${n.nextNodeId} ${targetNode?.character || ''}`);
      }
      const nodeAnns = annotations.filter(a => a.dialogueIds.includes(n.id));
      if (nodeAnns.length > 0) {
        lines.push('   相关批注:');
        nodeAnns.forEach(a => {
          const roleLabel = a.role === 'director' ? '导演' : '录音师';
          lines.push(`     💬 [${roleLabel}·${a.author}] ${a.content}`);
        });
      }
      lines.push('');
    });
    return lines.join('\n');
  }, [project, filteredNodes, annotations]);

  const annText = useMemo(() => {
    const lines: string[] = [];
    const roleName = roleFilter === 'all' ? '全部角色' : project.characters.find(c => c.id === roleFilter)?.name || '';
    const anns = filteredAnnotations;
    const relatedNodeCount = new Set(anns.flatMap(a => a.dialogueIds)).size;

    lines.push(`【${project.title}】- 导演批注汇总`);
    lines.push(`角色范围: ${roleName}`);
    lines.push(`共 ${anns.length} 条批注，关联 ${relatedNodeCount} 句台词`);
    lines.push('');
    lines.push('═'.repeat(40));
    lines.push('');

    // 按角色分组
    if (roleFilter === 'all') {
      const byRole: Record<string, typeof anns> = {};
      anns.forEach(a => {
        const roles = new Set(a.dialogueIds.map(did => project.nodes[did]?.role).filter(Boolean));
        roles.forEach(r => {
          if (!byRole[r]) byRole[r] = [];
          byRole[r].push(a);
        });
      });

      Object.entries(byRole).forEach(([roleId, roleAnns]) => {
        const ch = project.characters.find(c => c.id === roleId);
        lines.push(`【${ch?.name || '未知角色'}】（${roleAnns.length}条）`);
        lines.push('');
        roleAnns.forEach((a, i) => {
          const roleLabel = a.role === 'director' ? '导演' : '录音师';
          lines.push(`  ${i + 1}. [${roleLabel}·${a.author}] 关联${a.dialogueIds.length}句`);
          lines.push(`     ${a.content}`);
          lines.push(`     关联台词: ${a.dialogueIds.map(id => {
            const node = project.nodes[id];
            return `#${id}「${node?.text.slice(0, 12) || ''}...」`;
          }).join(', ')}`);
          lines.push('');
        });
        lines.push('');
      });
    } else {
      anns.forEach((a, i) => {
        const roleLabel = a.role === 'director' ? '导演' : '录音师';
        lines.push(`${i + 1}. [${roleLabel}·${a.author}] 关联${a.dialogueIds.length}句台词`);
        lines.push(`   ${a.content}`);
        lines.push(`   关联台词:`);
        a.dialogueIds.forEach(did => {
          const node = project.nodes[did];
          lines.push(`     - #${did}「${node?.text || ''}」`);
        });
        lines.push('');
      });
    }

    return lines.join('\n');
  }, [filteredAnnotations, roleFilter, project]);

  const trackText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`【${project.title}】- 排练轨迹记录`);
    lines.push(`共 ${rehearsalTracks.length} 条排练记录`);
    lines.push('');
    lines.push('═'.repeat(40));
    lines.push('');
    rehearsalTracks.forEach((t, i) => {
      const avg = t.emotionCurve.length > 0
        ? (t.emotionCurve.reduce((s, p) => s + p.value, 0) / t.emotionCurve.length).toFixed(1)
        : '-';
      const maxEmo = t.emotionCurve.length > 0
        ? Math.max(...t.emotionCurve.map(p => p.value))
        : 0;
      lines.push(`${i + 1}. ${t.title}`);
      lines.push(`   演员: ${t.actorName} | 路径节点: ${t.pathNodeIds.length} | 已录制: ${t.recordedNodeIds.length}`);
      lines.push(`   平均情绪: ${avg}/10 | 情绪峰值: ${maxEmo}/10`);
      lines.push(`   创建时间: ${new Date(t.startedAt).toLocaleString('zh-CN')}`);
      if (t.note) lines.push(`   备注: ${t.note}`);
      lines.push('');
      lines.push(`   路径: ${t.pathNodeIds.map(id => '#' + id).join(' → ')}`);
      lines.push('');
      const choiceEntries = Object.entries(t.choices);
      if (choiceEntries.length > 0) {
        lines.push('   关键选择点:');
        choiceEntries.forEach(([fromNodeId, choiceId], idx) => {
          const fromNode = project.nodes[fromNodeId];
          const choice = fromNode?.choices?.find(c => c.id === choiceId);
          const toNode = choice ? project.nodes[choice.nextNodeId] : null;
          lines.push(`     ${idx + 1}. #${fromNodeId} → 选择「${choice?.text || '?'}」→ #${choice?.nextNodeId || '?'} (${toNode?.character || ''})`);
        });
        lines.push('');
      }
      lines.push('─'.repeat(30));
      lines.push('');
    });
    return lines.join('\n');
  }, [rehearsalTracks, project]);

  // 路径导出：把分支选择、对应批注和轨迹备注串起来
  const pathText = useMemo(() => {
    if (!selectedTrack) {
      return '请选择一条排练轨迹，生成专属路径导出版本。';
    }
    const t = selectedTrack;
    const lines: string[] = [];
    // 从路径第一个节点获取角色
    const firstNode = t.pathNodeIds.length > 0 ? project.nodes[t.pathNodeIds[0]] : null;
    const ch = firstNode ? project.characters.find(c => c.id === firstNode.role) : null;

    lines.push(`【${project.title}】- ${t.title} 专属排练台本`);
    lines.push(`演员: ${t.actorName} | 角色: ${ch?.name || '多角色'}`);
    lines.push(`创建时间: ${new Date(t.startedAt).toLocaleString('zh-CN')}`);
    lines.push(`路径节点: ${t.pathNodeIds.length} 句 | 已录制: ${t.recordedNodeIds.length} 句`);
    if (t.note) {
      lines.push(`导演备注: ${t.note}`);
    }
    lines.push('');
    lines.push('═'.repeat(40));
    lines.push('');

    // 遍历路径节点
    t.pathNodeIds.forEach((nodeId, index) => {
      const node = project.nodes[nodeId];
      if (!node) return;

      const isRecorded = t.recordedNodeIds.includes(nodeId);
      const nodeAnns = annotations.filter(a => a.dialogueIds.includes(nodeId));
      const choiceId = t.choices[nodeId];
      const hasChoice = !!choiceId;

      lines.push(`【第${index + 1}句】#${node.id} · ${node.character}`);
      lines.push('');
      lines.push(`  ${node.text}`);
      lines.push('');
      lines.push(`  情绪: ${node.performance.label} (${node.performance.intensity}/10)`);
      if (isRecorded) {
        lines.push(`  ✓ 本版已录制`);
      } else {
        lines.push(`  ⏳ 待录制`);
      }
      lines.push('');

      if (hasChoice && node.choices) {
        const choiceObj = node.choices.find(c => c.id === choiceId);
        const nextNode = choiceObj ? project.nodes[choiceObj.nextNodeId] : null;
        lines.push(`  🎯 分支选择：「${choiceObj?.text || '?'}」`);
        lines.push(`     → 进入 #${choiceObj?.nextNodeId || '?'} (${nextNode?.character || ''})`);
        lines.push('');
      }

      if (nodeAnns.length > 0) {
        lines.push(`  💬 相关批注（${nodeAnns.length}条）:`);
        nodeAnns.forEach((a, ai) => {
          const roleLabel = a.role === 'director' ? '导演' : '录音师';
          lines.push(`     ${ai + 1}. [${roleLabel}·${a.author}] ${a.content}`);
        });
        lines.push('');
      }

      if (index < t.pathNodeIds.length - 1) {
        lines.push('─'.repeat(30));
      }
      lines.push('');
    });

    // 情绪曲线摘要
    if (t.emotionCurve.length > 0) {
      lines.push('═'.repeat(40));
      lines.push('');
      lines.push('📊 情绪曲线摘要');
      const avg = (t.emotionCurve.reduce((s, p) => s + p.value, 0) / t.emotionCurve.length).toFixed(1);
      const maxVal = Math.max(...t.emotionCurve.map(p => p.value));
      const minVal = Math.min(...t.emotionCurve.map(p => p.value));
      lines.push(`  平均情绪: ${avg}/10 | 最高: ${maxVal}/10 | 最低: ${minVal}/10`);
      lines.push('');
      // 找出情绪最高的节点（用索引对应路径节点）
      let maxIdx = 0;
      let minIdx = 0;
      t.emotionCurve.forEach((p, i) => {
        if (p.value > t.emotionCurve[maxIdx].value) maxIdx = i;
        if (p.value < t.emotionCurve[minIdx].value) minIdx = i;
      });
      const topNodeId = t.pathNodeIds[maxIdx];
      const topNode = topNodeId ? project.nodes[topNodeId] : null;
      const lowNodeId = t.pathNodeIds[minIdx];
      const lowNode = lowNodeId ? project.nodes[lowNodeId] : null;
      if (topNode) {
        lines.push(`  情绪最高点: #${topNode.id}「${topNode.text.slice(0, 20)}...」(${maxVal}/10)`);
      }
      if (lowNode) {
        lines.push(`  情绪最低点: #${lowNode.id}「${lowNode.text.slice(0, 20)}...」(${minVal}/10)`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }, [selectedTrack, project, annotations]);

  const displayText = {
    all: fullText,
    script: scriptText,
    annotations: annText,
    tracks: trackText,
    path: pathText
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

  const currentRoleName = roleFilter === 'all'
    ? '全部角色'
    : project.characters.find(c => c.id === roleFilter)?.name || '全部';

  return (
    <View className={styles.mask} onClick={onClose}>
      <View className={styles.sheet} onClick={e => e.stopPropagation()}>
        <View className={styles.header}>
          <Text className={styles.title}>📤 导出台本</Text>
          <Button className={styles.closeBtn} onClick={onClose}>×</Button>
        </View>

        {/* 筛选栏 */}
        <View className={styles.filterBar}>
          <View className={styles.filterItem} onClick={() => setShowRolePicker(!showRolePicker)}>
            <Text className={styles.filterLabel}>角色:</Text>
            <View className={styles.filterValue}>
              <Text className={styles.filterValueText}>{currentRoleName}</Text>
              <Text className={styles.filterArrow}>▾</Text>
            </View>
          </View>
          {activeTab === 'path' && (
            <View className={styles.filterItem} onClick={() => setShowTrackPicker(!showTrackPicker)}>
              <Text className={styles.filterLabel}>轨迹:</Text>
              <View className={styles.filterValue}>
                <Text className={styles.filterValueText}>
                  {selectedTrack ? selectedTrack.title.slice(0, 10) + '...' : '请选择'}
                </Text>
                <Text className={styles.filterArrow}>▾</Text>
              </View>
            </View>
          )}
        </View>

        {/* 角色选择下拉 */}
        {showRolePicker && (
          <View className={styles.dropdown}>
            <View
              className={classnames(styles.dropItem, roleFilter === 'all' && styles.dropActive)}
              onClick={() => { setRoleFilter('all'); setShowRolePicker(false); }}
            >全部角色</View>
            {project.characters.map(ch => (
              <View
                key={ch.id}
                className={classnames(styles.dropItem, roleFilter === ch.id && styles.dropActive)}
                onClick={() => { setRoleFilter(ch.id); setShowRolePicker(false); }}
              >
                <View className={styles.dot} style={{ background: ch.color }} />
                {ch.name}
              </View>
            ))}
          </View>
        )}

        {/* 轨迹选择下拉 */}
        {showTrackPicker && (
          <View className={styles.dropdown}>
            {rehearsalTracks.length === 0 ? (
              <View className={styles.dropItem}>暂无排练轨迹</View>
            ) : (
              rehearsalTracks.map(t => (
                <View
                  key={t.id}
                  className={classnames(styles.dropItem, selectedTrackId === t.id && styles.dropActive)}
                  onClick={() => { setSelectedTrackId(t.id); setShowTrackPicker(false); }}
                >
                  <View className={styles.dropItemMain}>
                    <Text className={styles.dropTitle}>{t.title}</Text>
                    <Text className={styles.dropSub}>{t.actorName} · {t.pathNodeIds.length}句</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Tab 切换 */}
        <ScrollView className={styles.tabs} scrollX enhanced showScrollbar={false}>
          <Button
            className={classnames(styles.tab, activeTab === 'all' && styles.active)}
            onClick={() => setActiveTab('all')}
          >全部</Button>
          <Button
            className={classnames(styles.tab, activeTab === 'script' && styles.active)}
            onClick={() => setActiveTab('script')}
          >对白剧本</Button>
          <Button
            className={classnames(styles.tab, activeTab === 'path' && styles.active)}
            onClick={() => setActiveTab('path')}
          >排练路径</Button>
          <Button
            className={classnames(styles.tab, activeTab === 'annotations' && styles.active)}
            onClick={() => setActiveTab('annotations')}
          >导演批注</Button>
          <Button
            className={classnames(styles.tab, activeTab === 'tracks' && styles.active)}
            onClick={() => setActiveTab('tracks')}
          >排练记录</Button>
        </ScrollView>

        <ScrollView className={styles.content} scrollY>
          <View className={styles.previewBox}>
            <Text className={styles.previewText}>{displayText}</Text>
          </View>
        </ScrollView>

        <View className={styles.footer}>
          <Button className={styles.secBtn} onClick={handleShare}>📤 分享</Button>
          <Button className={styles.primaryBtn} onClick={handleCopy}>📋 复制文本</Button>
        </View>
      </View>
    </View>
  );
};

export default ExportPanel;
