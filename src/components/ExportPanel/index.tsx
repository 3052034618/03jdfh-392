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

  // 路径导出：把分支选择、对应批注和轨迹备注串起来，并按角色筛选
  const pathText = useMemo(() => {
    if (!selectedTrack) {
      return '请选择一条排练轨迹，生成专属路径导出版本。';
    }
    const t = selectedTrack;
    const lines: string[] = [];
    // 角色筛选：过滤路径节点
    const pathNodes = roleFilter === 'all'
      ? t.pathNodeIds.map(id => ({ id, node: project.nodes[id] }))
      : t.pathNodeIds
          .map(id => ({ id, node: project.nodes[id] }))
          .filter(x => x.node && x.node.role === roleFilter);
    const roleName = roleFilter === 'all'
      ? '全角色'
      : project.characters.find(c => c.id === roleFilter)?.name || '';

    // 统计筛选后的数据
    const filteredNodeIds = pathNodes.map(p => p.id);
    const filteredRecorded = t.recordedNodeIds.filter(id => filteredNodeIds.includes(id));
    // 相关批注：只要关联了筛选后任意一个节点就算，且只显示筛选后节点的关联
    const relatedAnnotations = annotations.filter(a =>
      a.dialogueIds.some(did => filteredNodeIds.includes(did))
    );

    lines.push(`【${project.title}】- ${t.title} 专属排练台本`);
    lines.push(`演员: ${t.actorName} | 角色: ${roleName}`);
    lines.push(`创建时间: ${new Date(t.startedAt).toLocaleString('zh-CN')}`);
    lines.push(`台词总数: ${t.pathNodeIds.length} 句 | 当前角色相关: ${pathNodes.length} 句`);
    lines.push(`当前角色已录制: ${filteredRecorded.length} 句 | 相关批注: ${relatedAnnotations.length} 条`);
    if (t.note) {
      lines.push(`导演备注: ${t.note}`);
    }
    if (t.review?.recommended) {
      lines.push(`⭐ 评审结论: 推荐此版 - ${t.review.reason}`);
      lines.push(`   评审人: ${t.review.reviewerName}`);
    }
    lines.push('');
    lines.push('═'.repeat(40));
    lines.push('');

    // 其他角色提示：筛选角色不是全部时提示有跳过内容
    if (roleFilter !== 'all' && pathNodes.length < t.pathNodeIds.length) {
      const otherCount = t.pathNodeIds.length - pathNodes.length;
      lines.push(`（注：此台本已过滤，仅保留${roleName}相关内容，其余${otherCount}句其他角色台词已跳过）`);
      lines.push('');
    }

    // 遍历路径节点（保持原顺序，仅输出匹配角色的）
    pathNodes.forEach(({ id: nodeId, node }, filteredIndex) => {
      if (!node) return;
      const origIndex = t.pathNodeIds.indexOf(nodeId) + 1;

      const isRecorded = t.recordedNodeIds.includes(nodeId);
      const nodeAnns = annotations.filter(a => a.dialogueIds.includes(nodeId));
      const choiceId = t.choices[nodeId];
      const hasChoice = !!choiceId;

      lines.push(`【第${origIndex}句·筛选后第${filteredIndex + 1}句】#${node.id} · ${node.character}`);
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
        const nextIsTargetRole = nextNode
          ? (roleFilter === 'all' || nextNode.role === roleFilter)
          : true;
        lines.push(`  🎯 分支选择：「${choiceObj?.text || '?'}」`);
        if (choiceObj?.nextNodeId) {
          lines.push(`     → 进入 #${choiceObj.nextNodeId} (${nextNode?.character || ''})${!nextIsTargetRole ? '（进入其他角色）' : ''}`);
        }
        lines.push('');
      }

      if (nodeAnns.length > 0) {
        lines.push(`  💬 相关批注（${nodeAnns.length}条）:`);
        nodeAnns.forEach((a, ai) => {
          const roleLabel = a.role === 'director' ? '导演' : '录音师';
          lines.push(`     ${ai + 1}. [${roleLabel}·${a.author}] ${a.content}`);
          // 如果这条批注还关联了其他同角色台词，列出它们
          const otherRelated = a.dialogueIds
            .filter(did => did !== nodeId && filteredNodeIds.includes(did));
          if (otherRelated.length > 0) {
            const otherNodes = otherRelated.map(did => {
              const n = project.nodes[did];
              return `#${did}「${n?.text.slice(0, 10) || ''}...」`;
            });
            lines.push(`        (本条批注同时关联: ${otherNodes.join(', ')})`);
          }
        });
        lines.push('');
      }

      if (filteredIndex < pathNodes.length - 1) {
        lines.push('─'.repeat(30));
      }
      lines.push('');
    });

    // 集中输出批注摘要（角色筛选后）
    if (relatedAnnotations.length > 0) {
      lines.push('═'.repeat(40));
      lines.push('');
      lines.push(`� ${roleName === '全角色' ? '本路径全部批注' : `${roleName}相关批注汇总`}（${relatedAnnotations.length}条）`);
      lines.push('');
      relatedAnnotations.forEach((a, i) => {
        const roleLabel = a.role === 'director' ? '导演' : '录音师';
        // 仅列出筛选后角色的关联台词
        const relatedLines = a.dialogueIds
          .filter(did => filteredNodeIds.includes(did))
          .map(did => {
            const n = project.nodes[did];
            return `#${did}「${n?.text.slice(0, 15) || ''}${n?.text && n.text.length > 15 ? '...' : ''}」`;
          });
        lines.push(`${i + 1}. [${roleLabel}·${a.author}] ${a.content}`);
        lines.push(`   关联台词: ${relatedLines.join(', ')}`);
        lines.push('');
      });
    }

    // 情绪曲线摘要（仅筛选后节点）
    if (t.emotionCurve.length > 0) {
      lines.push('═'.repeat(40));
      lines.push('');
      lines.push(`📊 ${roleName === '全角色' ? '全路径' : roleName}情绪曲线摘要`);
      // 找到筛选后节点在原路径中的索引，对应情绪曲线
      const filteredEmotions = filteredNodeIds
        .map(nid => {
          const idx = t.pathNodeIds.indexOf(nid);
          return { idx, point: t.emotionCurve[idx], nodeId: nid };
        })
        .filter(x => x.point !== undefined);
      if (filteredEmotions.length > 0) {
        const avg = (filteredEmotions.reduce((s, x) => s + (x.point?.value || 0), 0) / filteredEmotions.length).toFixed(1);
        const maxItem = filteredEmotions.reduce((a, b) => ((a.point?.value || 0) > (b.point?.value || 0) ? a : b));
        const minItem = filteredEmotions.reduce((a, b) => ((a.point?.value || 0) < (b.point?.value || 0) ? a : b));
        const maxNode = maxItem.nodeId ? project.nodes[maxItem.nodeId] : null;
        const minNode = minItem.nodeId ? project.nodes[minItem.nodeId] : null;
        lines.push(`  平均情绪: ${avg}/10 | 最高: ${maxItem.point?.value}/10 | 最低: ${minItem.point?.value}/10`);
        if (maxNode) lines.push(`  情绪最高点: #${maxNode.id}「${maxNode.text.slice(0, 20)}...」`);
        if (minNode) lines.push(`  情绪最低点: #${minNode.id}「${minNode.text.slice(0, 20)}...」`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }, [selectedTrack, project, annotations, roleFilter]);

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
