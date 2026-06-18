import React, { useMemo, useState } from 'react';
import { View, Text, Button, ScrollView, Textarea } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import { useDialogue } from '@/store/DialogueContext';
import { DialogueNode as NodeType, PerformanceHint, PerformanceType, BranchChoice } from '@/types/dialogue';
import DialogueNode from '@/components/DialogueNode';
import PerformanceTag from '@/components/PerformanceTag';
import { performanceOptions } from '@/data/mockScript';

const SCRIPT_PAGE = 'pages/script/index';

const ScriptPage: React.FC = () => {
  const {
    project,
    currentCharacterId,
    setCurrentCharacterId,
    nodesList,
    updateNodePerformance,
    updateNodeText,
    updateNodeChoices,
    setNextNode,
    toggleRecorded
  } = useDialogue();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<'perf' | 'text' | 'branch'>('perf');
  const [newIntensity, setNewIntensity] = useState<number>(5);

  const filteredNodes = useMemo(() => {
    return nodesList.filter(n => n.role === currentCharacterId);
  }, [nodesList, currentCharacterId]);

  const allNodesOfRole = nodesList.filter(n => n.role === currentCharacterId);
  const recordedCount = allNodesOfRole.filter(n => n.recorded).length;
  const branchCount = allNodesOfRole.filter(n => n.choices && n.choices.length > 0).length;

  const selectedNode: NodeType | null = selectedNodeId ? (project.nodes[selectedNodeId] || null) : null;

  const switchCharacter = (id: string) => {
    setCurrentCharacterId(id);
    setSelectedNodeId(null);
  };

  const selectPerformance = (type: PerformanceType, label: string, intensity?: number) => {
    if (!selectedNodeId) return;
    const perf: PerformanceHint = {
      type,
      label,
      intensity: intensity ?? selectedNode?.performance.intensity ?? 5
    };
    updateNodePerformance(selectedNodeId, perf);
    Taro.showToast({ title: '表演提示已更新', icon: 'success', duration: 1200 });
  };

  const handleIntensityChange = (v: number) => {
    setNewIntensity(v);
    if (selectedNodeId && selectedNode) {
      const perf: PerformanceHint = {
        ...selectedNode.performance,
        intensity: v
      };
      updateNodePerformance(selectedNodeId, perf);
    }
  };

  const handleTextChange = (v: string) => {
    if (selectedNodeId) updateNodeText(selectedNodeId, v);
  };

  const handleNodeClick = (n: NodeType) => {
    setSelectedNodeId(n.id);
    setNewIntensity(n.performance.intensity);
  };

  const handleModeSwitch = (val: 'perf' | 'text' | 'branch') => {
    setEditMode(val);
  };

  return (
    <ScrollView className={styles.page} scrollY>
      {/* 顶部项目信息 */}
      <View className={styles.header}>
        <Text className={styles.projectTitle}>{project.title}</Text>
        <View className={styles.projectMeta}>
          <View className={styles.metaItem}>
            <View className={styles.metaDot}></View>
            <Text>{project.game}</Text>
          </View>
          <View className={styles.metaItem}>
            <View className={styles.metaDot} style={{ background: '#FF3B5C' }}></View>
            <Text>{project.scene}</Text>
          </View>
          <View className={styles.metaItem}>
            <View className={styles.metaDot} style={{ background: '#2FD4A6' }}></View>
            <Text>{project.characters.length}个角色</Text>
          </View>
        </View>

        <View className={styles.statBar}>
          <View className={styles.statCard}>
            <Text className={styles.statNum}>{allNodesOfRole.length}</Text>
            <Text className={styles.statLabel}>对白总数</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statNum} style={{ color: '#2FD4A6' }}>{recordedCount}</Text>
            <Text className={styles.statLabel}>已录制</Text>
          </View>
          <View className={styles.statCard}>
            <Text className={styles.statNum} style={{ color: '#FFC857' }}>{branchCount}</Text>
            <Text className={styles.statLabel}>分支节点</Text>
          </View>
        </View>
      </View>

      {/* 角色切换 */}
      <View className={styles.section}>
        <View className={styles.sectionTitle}>
          <Text className={styles.sectionText}>🎭 选择角色</Text>
          <Button className={styles.addBtn}>+ 新增角色</Button>
        </View>
        <ScrollView className={styles.charTabs} scrollX enhanced showScrollbar={false}>
          {project.characters.map(ch => (
            <View
              key={ch.id}
              className={classnames(styles.charTab, ch.id === currentCharacterId && styles.activeTab)}
              onClick={() => switchCharacter(ch.id)}
            >
              <View className={styles.charAvatar} style={{ background: ch.color }}>
                {ch.name.slice(0, 1)}
              </View>
              <Text className={styles.charName}>{ch.name}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* 选中节点编辑器 */}
      {selectedNode && (
        <View className={styles.section}>
          <View className={styles.sectionTitle}>
            <Text className={styles.sectionText}>✏️ 编辑对白 #{selectedNode.id}</Text>
            <Button
              className={styles.ghostBtn}
              onClick={() => setSelectedNodeId(null)}
            >收起</Button>
          </View>
          <View className={styles.editorCard}>
            {/* 模式切换 */}
            <View className={styles.modeSwitch}>
              <Button
                className={classnames(styles.switchBtn, editMode === 'text' && styles.active)}
                onClick={() => handleModeSwitch('text')}
              >📝 台词内容</Button>
              <Button
                className={classnames(styles.switchBtn, editMode === 'perf' && styles.active)}
                onClick={() => handleModeSwitch('perf')}
              >🎭 表演提示</Button>
              <Button
                className={classnames(styles.switchBtn, editMode === 'branch' && styles.active)}
                onClick={() => handleModeSwitch('branch')}
              >🔀 分支走向</Button>
            </View>

            {editMode === 'text' && (
              <>
                <View className={styles.label}>台词内容</View>
                <Textarea
                  className={styles.textarea}
                  value={selectedNode.text}
                  onInput={(e) => handleTextChange(e.detail.value)}
                  placeholder="输入角色台词..."
                  autoHeight
                  maxlength={500}
                />
              </>
            )}

            {editMode === 'perf' && (
              <View className={styles.perfSelector}>
                <View className={styles.label}>选择表演风格（点击切换）</View>
                <View className={styles.perfTags}>
                  {performanceOptions.map(opt => (
                    <PerformanceTag
                      key={opt.type}
                      type={opt.type}
                      label={opt.label}
                      selectable
                      selected={selectedNode.performance.type === opt.type}
                      onClick={() => selectPerformance(opt.type, opt.label)}
                    />
                  ))}
                </View>
                <View className={styles.label}>情绪强度（{newIntensity}/10）</View>
                <View className={styles.intensityRow}>
                  <Text className={styles.intensityLabel}>低张力</Text>
                  <View className={styles.sliderTrack}>
                    <View
                      className={styles.sliderFill}
                      style={{ width: `${(newIntensity / 10) * 100}%` }}
                    />
                    <View className={styles.sliderPoints}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
                        <View
                          key={v}
                          className={classnames(styles.sliderDot, v <= newIntensity && styles.activeDot)}
                          onClick={() => handleIntensityChange(v)}
                        />
                      ))}
                    </View>
                  </View>
                  <Text className={styles.intensityValue}>{newIntensity}</Text>
                </View>
              </View>
            )}

            {editMode === 'branch' && (
              <View className={styles.branchSection}>
                {selectedNode.choices && selectedNode.choices.length > 0 ? (
                  <>
                    <View className={styles.label}>玩家选择分支（{selectedNode.choices.length}条）</View>
                    <View className={styles.choiceList}>
                      {selectedNode.choices.map((ch: BranchChoice, idx: number) => (
                        <View className={styles.choiceRow} key={ch.id}>
                          <View className={styles.choiceIdx}>{String.fromCharCode(65 + idx)}</View>
                          <Text className={styles.choiceText}>{ch.text}</Text>
                          <View className={styles.choiceTarget}>→ #{ch.nextNodeId}</View>
                        </View>
                      ))}
                    </View>
                  </>
                ) : selectedNode.nextNodeId ? (
                  <>
                    <View className={styles.label}>线性走向</View>
                    <View className={styles.choiceRow}>
                      <View className={styles.choiceIdx}>→</View>
                      <Text className={styles.choiceText}>直接进入下一句</Text>
                      <View className={styles.choiceTarget}>#{selectedNode.nextNodeId}</View>
                    </View>
                    <Button
                      className={styles.ghostBtn}
                      style={{ marginTop: '24rpx' }}
                      onClick={() => updateNodeChoices(selectedNode.id, [
                        { id: `ch-new-1`, text: '选项A', nextNodeId: selectedNode.nextNodeId! },
                        { id: `ch-new-2`, text: '选项B', nextNodeId: selectedNode.nextNodeId! }
                      ])}
                    >转为分支模式</Button>
                  </>
                ) : (
                  <Text className={styles.label}>🎬 这是一条路径的终点</Text>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {/* 对白列表 */}
      <View className={styles.section}>
        <View className={styles.nodesTitle}>
          <Text className={styles.sectionText}>📜 对白列表（{filteredNodes.length}条）</Text>
          <Button className={styles.ghostBtn}>筛选</Button>
        </View>
        {filteredNodes.length === 0 ? (
          <View className={styles.editorCard}>
            <Text style={{ color: '#6E6E8A', fontSize: '26rpx' }}>该角色暂无对白段落</Text>
          </View>
        ) : (
          filteredNodes.map(node => (
            <DialogueNode
              key={node.id}
              node={node}
              active={selectedNodeId === node.id}
              onClick={() => handleNodeClick(node)}
            />
          ))
        )}
      </View>

      {/* 悬浮新增按钮 */}
      <View
        className={styles.fab}
        onClick={() => Taro.showToast({ title: '新增对白', icon: 'none' })}
      >
        <Text className={styles.fabIcon}>+</Text>
      </View>
    </ScrollView>
  );
};

export default ScriptPage;
