import React, { useMemo, useState } from 'react';
import { View, Text, Button, ScrollView, Textarea, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import { useDialogue } from '@/store/DialogueContext';
import { DialogueNode as NodeType, PerformanceHint, PerformanceType, BranchChoice } from '@/types/dialogue';
import DialogueNode from '@/components/DialogueNode';
import PerformanceTag from '@/components/PerformanceTag';
import DialogueTree from '@/components/DialogueTree';
import ExportPanel from '@/components/ExportPanel';
import { performanceOptions } from '@/data/mockScript';

type AttachMode = 'none' | 'linear' | 'choice';
type EditMode = 'text' | 'perf' | 'branch';
type ViewMode = 'list' | 'tree';

const ScriptPage: React.FC = () => {
  const {
    project,
    currentCharacterId,
    setCurrentCharacterId,
    nodesList,
    updateNodePerformance,
    updateNodeText,
    setNextNode,
    addChoice,
    removeChoice,
    updateChoice,
    createNode
  } = useDialogue();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode>('text');

  // 新增对白表单
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [newText, setNewText] = useState('');
  const [newPerfType, setNewPerfType] = useState<PerformanceType>('normal');
  const [newPerfLabel, setNewPerfLabel] = useState('假装正常');
  const [newIntensity, setNewIntensity] = useState(5);
  const [attachMode, setAttachMode] = useState<AttachMode>('none');
  const [attachParentId, setAttachParentId] = useState('');
  const [attachChoiceText, setAttachChoiceText] = useState('');

  // 分支选择弹窗
  const [targetPicker, setTargetPicker] = useState<null | {
    context: 'linearNext' | 'attachParent' | 'choiceTarget';
    nodeId?: string;
    choiceId?: string;
  }>(null);

  const [showExport, setShowExport] = useState(false);

  const character = project.characters.find(c => c.id === currentCharacterId);
  const filteredNodes = useMemo(
    () => nodesList.filter(n => n.role === currentCharacterId),
    [nodesList, currentCharacterId]
  );
  const allNodesOfRole = filteredNodes;
  const recordedCount = allNodesOfRole.filter(n => n.recorded).length;
  const branchCount = allNodesOfRole.filter(n => n.choices && n.choices.length > 0).length;
  const selectedNode: NodeType | null = selectedNodeId ? (project.nodes[selectedNodeId] || null) : null;

  const switchCharacter = (id: string) => {
    setCurrentCharacterId(id);
    setSelectedNodeId(null);
  };

  // 新增对白提交
  const handleCreateNode = () => {
    if (!newText.trim()) {
      Taro.showToast({ title: '请输入台词内容', icon: 'none' });
      return;
    }
    if (attachMode !== 'none' && !attachParentId) {
      Taro.showToast({ title: '请选择要连接的对白', icon: 'none' });
      return;
    }
    if (attachMode === 'choice' && !attachChoiceText.trim()) {
      Taro.showToast({ title: '请输入选项文案', icon: 'none' });
      return;
    }
    const perf: PerformanceHint = {
      type: newPerfType,
      label: newPerfLabel,
      intensity: newIntensity
    };
    const newId = createNode({
      role: currentCharacterId,
      character: character?.name || '未知角色',
      text: newText.trim(),
      performance: perf,
      parentId: attachMode === 'none' ? undefined : attachParentId,
      attachAs: attachMode === 'none' ? undefined : attachMode,
      choiceText: attachMode === 'choice' ? attachChoiceText.trim() : undefined
    });
    Taro.showToast({ title: '对白已添加', icon: 'success' });
    setNewText('');
    setNewIntensity(5);
    setAttachMode('none');
    setAttachParentId('');
    setAttachChoiceText('');
    setShowAddPanel(false);
    setSelectedNodeId(newId);
  };

  const selectPerfForNew = (type: PerformanceType, label: string) => {
    setNewPerfType(type);
    setNewPerfLabel(label);
  };

  const handleNodeClick = (n: NodeType) => {
    setSelectedNodeId(n.id);
    setEditMode('text');
    if (viewMode === 'tree') {
      // 切到列表视图方便编辑
      setTimeout(() => {
        Taro.pageScrollTo && Taro.pageScrollTo({ scrollTop: 0, duration: 300 });
      }, 100);
    }
  };

  // 从树节点点击跳转
  const handleTreeNodeClick = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setEditMode('text');
    setViewMode('list');
    Taro.showToast({ title: '已跳转到编辑区', icon: 'success', duration: 1000 });
    setTimeout(() => {
      Taro.pageScrollTo && Taro.pageScrollTo({ scrollTop: 0, duration: 300 });
    }, 300);
  };

  const selectPerformance = (type: PerformanceType, label: string) => {
    if (!selectedNodeId) return;
    const perf: PerformanceHint = {
      type,
      label,
      intensity: selectedNode?.performance.intensity ?? 5
    };
    updateNodePerformance(selectedNodeId, perf);
  };

  const handleIntensityChange = (v: number) => {
    setNewIntensity(v);
    if (selectedNodeId && selectedNode && editMode === 'perf') {
      const perf: PerformanceHint = { ...selectedNode.performance, intensity: v };
      updateNodePerformance(selectedNodeId, perf);
    }
  };

  const pickTargetNode = (nodeId: string) => {
    if (!targetPicker) return;
    const ctx = targetPicker.context;
    if (ctx === 'linearNext' && targetPicker.nodeId) {
      setNextNode(targetPicker.nodeId, nodeId);
    } else if (ctx === 'choiceTarget' && targetPicker.nodeId && targetPicker.choiceId) {
      updateChoice(targetPicker.nodeId, targetPicker.choiceId, { nextNodeId: nodeId });
    } else if (ctx === 'attachParent') {
      setAttachParentId(nodeId);
    }
    setTargetPicker(null);
    Taro.showToast({ title: '已设置', icon: 'success', duration: 1000 });
  };

  const openTargetPicker = (context: 'linearNext' | 'attachParent' | 'choiceTarget', nodeId?: string, choiceId?: string) => {
    setTargetPicker({ context, nodeId, choiceId });
  };

  const currentIntensity = selectedNode ? selectedNode.performance.intensity : newIntensity;

  return (
    <ScrollView className={styles.page} scrollY>
      {/* 顶部项目信息 */}
      <View className={styles.header}>
        <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text className={styles.projectTitle}>{project.title}</Text>
          <Button className={styles.ghostBtn} onClick={() => setShowExport(true)}>
            📤 导出
          </Button>
        </View>
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
          <Button className={styles.addBtn} onClick={() => setShowAddPanel(true)}>+ 新增对白</Button>
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

      {/* 视图切换：列表 / 树状 */}
      <View className={styles.section}>
        <View className={styles.viewTabs}>
          <Button
            className={classnames(styles.viewTab, viewMode === 'list' && styles.activeViewTab)}
            onClick={() => setViewMode('list')}
          >📜 列表视图</Button>
          <Button
            className={classnames(styles.viewTab, viewMode === 'tree' && styles.activeViewTab)}
            onClick={() => setViewMode('tree')}
          >🌳 对白树总览</Button>
        </View>
      </View>

      {/* ===== 新增对白表单 ===== */}
      {showAddPanel && (
        <View className={styles.section}>
          <View className={styles.editorCard}>
            <View className={styles.cardHeader}>
              <View>
                <Text className={styles.cardTitle}>➕ 新增对白</Text>
                <Text className={styles.cardSub}>角色：{character?.name}</Text>
              </View>
              <Button className={styles.closeBtn} onClick={() => setShowAddPanel(false)}>收起</Button>
            </View>

            <View className={styles.label}>台词内容</View>
            <Textarea
              className={styles.textarea}
              value={newText}
              onInput={e => setNewText(e.detail.value)}
              placeholder="输入角色台词，如：（钥匙插入门锁）终于租到这么便宜的房子了..."
              autoHeight
              maxlength={500}
            />

            <View className={styles.label}>选择表演风格</View>
            <View className={styles.perfSelector}>
              <View className={styles.perfTags}>
                {performanceOptions.map(opt => (
                  <PerformanceTag
                    key={opt.type}
                    type={opt.type}
                    label={opt.label}
                    selectable
                    selected={newPerfType === opt.type}
                    onClick={() => selectPerfForNew(opt.type, opt.label)}
                  />
                ))}
              </View>
            </View>

            <View className={styles.label}>情绪强度（{newIntensity}/10）</View>
            <View className={styles.intensityRow} style={{ marginBottom: '32rpx' }}>
              <Text className={styles.intensityLabel}>低张力</Text>
              <View className={styles.sliderTrack}>
                <View className={styles.sliderFill} style={{ width: `${(newIntensity / 10) * 100}%` }} />
                <View className={styles.sliderPoints}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
                    <View
                      key={v}
                      className={classnames(styles.sliderDot, v <= newIntensity && styles.activeDot)}
                      onClick={() => setNewIntensity(v)}
                    />
                  ))}
                </View>
              </View>
              <Text className={styles.intensityValue}>{newIntensity}</Text>
            </View>

            <View className={styles.attachGroup}>
              <View className={styles.label}>连接方式（保存后这句对白将出现在所选位置后面）</View>
              <View className={styles.attachOptions}>
                <Button
                  className={classnames(styles.attachOption, attachMode === 'none' && styles.active)}
                  onClick={() => { setAttachMode('none'); setAttachParentId(''); }}
                >
                  <Text className={styles.attachTitle}>不连接</Text>
                  <Text className={styles.attachDesc}>作为独立节点</Text>
                </Button>
                <Button
                  className={classnames(styles.attachOption, attachMode === 'linear' && styles.active)}
                  onClick={() => setAttachMode('linear')}
                >
                  <Text className={styles.attachTitle}>接在某句后面</Text>
                  <Text className={styles.attachDesc}>线性顺序</Text>
                </Button>
                <Button
                  className={classnames(styles.attachOption, attachMode === 'choice' && styles.active)}
                  onClick={() => setAttachMode('choice')}
                >
                  <Text className={styles.attachTitle}>作为分支选项</Text>
                  <Text className={styles.attachDesc}>玩家选择后进入</Text>
                </Button>
              </View>

              {attachMode !== 'none' && (
                <>
                  <View className={styles.labelRow}>
                    <Text className={styles.label}>
                      {attachMode === 'linear' ? '选择要接在后面的对白' : '选择父节点（有分支的对白）'}
                    </Text>
                    {attachParentId && (
                      <Text style={{ fontSize: 20, color: '#9D6BFF' }}>已选 #{attachParentId}</Text>
                    )}
                  </View>
                  <View className={styles.selectList}>
                    {nodesList.length === 0 ? (
                      <Text className={styles.emptyHint}>还没有对白可选</Text>
                    ) : (
                      nodesList.map(n => (
                        <View
                          key={n.id}
                          className={classnames(styles.selectItem, attachParentId === n.id && styles.selected)}
                          onClick={() => setAttachParentId(n.id)}
                        >
                          <View className={styles.selLeft}>
                            <Text className={styles.selName}>#{n.id} · {n.character}</Text>
                            <Text className={styles.selPreview}>{n.text}</Text>
                          </View>
                          <View className={classnames(styles.selCheck, attachParentId === n.id && styles.on)}>
                            {attachParentId === n.id && '✓'}
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </>
              )}

              {attachMode === 'choice' && attachParentId && (
                <>
                  <View className={styles.label}>选项文案（玩家看到的选项）</View>
                  <Input
                    className={styles.input}
                    value={attachChoiceText}
                    onInput={e => setAttachChoiceText(e.detail.value)}
                    placeholder="如：追问房东为什么不能开灯"
                    maxlength={60}
                  />
                </>
              )}
            </View>

            <Button
              className={classnames(styles.primaryBtn, !newText.trim() && styles.disabled)}
              onClick={handleCreateNode}
            >✅ 保存并添加到剧本</Button>
          </View>
        </View>
      )}

      {/* ===== 选中节点编辑器 ===== */}
      {selectedNode && !showAddPanel && (
        <View className={styles.section}>
          <View className={styles.editorCard}>
            <View className={styles.cardHeader}>
              <View>
                <Text className={styles.cardTitle}>✏️ 编辑对白 #{selectedNode.id}</Text>
                <Text className={styles.cardSub}>{selectedNode.character}</Text>
              </View>
              <Button className={styles.closeBtn} onClick={() => setSelectedNodeId(null)}>收起</Button>
            </View>

            <View className={styles.modeSwitch}>
              <Button
                className={classnames(styles.switchBtn, editMode === 'text' && styles.active)}
                onClick={() => setEditMode('text')}
              >📝 台词内容</Button>
              <Button
                className={classnames(styles.switchBtn, editMode === 'perf' && styles.active)}
                onClick={() => setEditMode('perf')}
              >🎭 表演提示</Button>
              <Button
                className={classnames(styles.switchBtn, editMode === 'branch' && styles.active)}
                onClick={() => setEditMode('branch')}
              >🔀 分支走向</Button>
            </View>

            {editMode === 'text' && (
              <>
                <View className={styles.label}>台词内容</View>
                <Textarea
                  className={styles.textarea}
                  value={selectedNode.text}
                  onInput={e => updateNodeText(selectedNode.id, e.detail.value)}
                  placeholder="输入角色台词..."
                  autoHeight
                  maxlength={500}
                />
              </>
            )}

            {editMode === 'perf' && (
              <View className={styles.perfSelector}>
                <View className={styles.label}>选择表演风格</View>
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
                <View className={styles.label}>情绪强度（{currentIntensity}/10）</View>
                <View className={styles.intensityRow}>
                  <Text className={styles.intensityLabel}>低张力</Text>
                  <View className={styles.sliderTrack}>
                    <View className={styles.sliderFill} style={{ width: `${(currentIntensity / 10) * 100}%` }} />
                    <View className={styles.sliderPoints}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
                        <View
                          key={v}
                          className={classnames(styles.sliderDot, v <= currentIntensity && styles.activeDot)}
                          onClick={() => handleIntensityChange(v)}
                        />
                      ))}
                    </View>
                  </View>
                  <Text className={styles.intensityValue}>{currentIntensity}</Text>
                </View>
              </View>
            )}

            {editMode === 'branch' && (
              <View className={styles.branchSection}>
                {selectedNode.choices && selectedNode.choices.length > 0 ? (
                  <>
                    <View className={styles.label}>
                      玩家分支选项（可修改文案、选择跳转目标、增删选项）
                    </View>
                    <View className={styles.choiceList}>
                      {selectedNode.choices.map((ch: BranchChoice, idx: number) => (
                        <View key={ch.id} className={styles.choiceEditor}>
                          <View className={styles.choiceHeader}>
                            <Text className={styles.choiceIdx}>选项 {String.fromCharCode(65 + idx)}</Text>
                            <Button
                              className={styles.choiceDel}
                              onClick={() => {
                                Taro.showModal({
                                  title: '删除选项',
                                  content: '确定要删除这个分支选项吗？',
                                  success: (res) => {
                                    if (res.confirm) removeChoice(selectedNode.id, ch.id);
                                  }
                                });
                              }}
                            >删除</Button>
                          </View>
                          <Input
                            className={styles.choiceInput}
                            value={ch.text}
                            placeholder="输入玩家看到的选项文案"
                            onInput={e => updateChoice(selectedNode.id, ch.id, { text: e.detail.value })}
                            maxlength={80}
                          />
                          <View className={styles.choiceTargetRow}>
                            <Button
                              className={styles.choiceTargetBtn}
                              onClick={() => openTargetPicker('choiceTarget', selectedNode.id, ch.id)}
                            >
                              <Text>
                                {ch.nextNodeId ? `跳转到 → #${ch.nextNodeId}` : '点击选择跳转到哪句对白'}
                              </Text>
                              <Text>›</Text>
                            </Button>
                          </View>
                        </View>
                      ))}
                    </View>
                    <Button
                      className={styles.choiceAddBtn}
                      onClick={() => addChoice(selectedNode.id)}
                      style={{ width: '100%', height: '72rpx', marginTop: '16rpx' }}
                    >+ 新增分支选项</Button>
                  </>
                ) : (
                  <>
                    <View className={styles.label}>线性走向</View>
                    <View className={styles.linearTarget}>
                      <Button
                        className={styles.choiceTargetBtn}
                        onClick={() => openTargetPicker('linearNext', selectedNode.id)}
                      >
                        <Text>
                          {selectedNode.nextNodeId
                            ? `下一句 → #${selectedNode.nextNodeId}（点击修改）`
                            : '点击设置下一句对白'}
                        </Text>
                        <Text>›</Text>
                      </Button>
                    </View>
                    <Button
                      className={styles.ghostBtn}
                      style={{ marginTop: '16rpx', width: '100%', height: '72rpx' }}
                      onClick={() => addChoice(selectedNode.id)}
                    >+ 转为分支模式（新增一个选项）</Button>
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {/* ===== 视图内容 ===== */}
      {viewMode === 'tree' ? (
        <View className={styles.section}>
          <View className={styles.nodesTitle}>
            <Text className={styles.sectionText}>🌳 对白树总览</Text>
          </View>
          <DialogueTree
            activeNodeId={selectedNodeId || undefined}
            onNodeClick={handleTreeNodeClick}
          />
        </View>
      ) : (
        <View className={styles.section}>
          <View className={styles.nodesTitle}>
            <Text className={styles.sectionText}>📜 对白列表（{filteredNodes.length}条）</Text>
            <Button className={styles.ghostBtn}>筛选</Button>
          </View>
          {filteredNodes.length === 0 ? (
            <View className={styles.editorCard}>
              <Text style={{ color: '#6E6E8A', fontSize: '26rpx' }}>
                该角色暂无对白段落，点击右上角"+ 新增对白"开始创作
              </Text>
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
      )}

      {/* 悬浮新增按钮 */}
      {!showAddPanel && viewMode === 'list' && (
        <View className={styles.fab} onClick={() => setShowAddPanel(true)}>
          <Text className={styles.fabIcon}>+</Text>
        </View>
      )}

      {/* 目标节点选择弹窗 */}
      {targetPicker && (
        <View className={styles.modalMask} onClick={() => setTargetPicker(null)}>
          <View className={styles.modalSheet} onClick={e => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>
                {targetPicker.context === 'linearNext' && '选择下一句对白'}
                {targetPicker.context === 'choiceTarget' && '选择分支要跳转到的对白'}
                {targetPicker.context === 'attachParent' && '选择父对白'}
              </Text>
              <Button className={styles.closeBtn} onClick={() => setTargetPicker(null)}>取消</Button>
            </View>
            <ScrollView className={styles.modalList} scrollY>
              {nodesList.length === 0 && (
                <Text className={styles.emptyHint} style={{ padding: '32rpx' }}>还没有对白</Text>
              )}
              {nodesList.map(n => {
                const curSelected =
                  (targetPicker.context === 'linearNext' && targetPicker.nodeId && project.nodes[targetPicker.nodeId]?.nextNodeId === n.id) ||
                  (targetPicker.context === 'choiceTarget' && targetPicker.nodeId && targetPicker.choiceId &&
                    project.nodes[targetPicker.nodeId]?.choices?.find(c => c.id === targetPicker.choiceId)?.nextNodeId === n.id) ||
                  (targetPicker.context === 'attachParent' && attachParentId === n.id);
                return (
                  <View
                    key={n.id}
                    className={styles.modalItem}
                    onClick={() => pickTargetNode(n.id)}
                  >
                    <View className={styles.modalItemTop}>
                      <View style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 24, fontWeight: 600, color: curSelected ? '#9D6BFF' : '#E8E8F0' }}>
                          #{n.id}
                        </Text>
                        <Text style={{ fontSize: 22, color: '#9E9EB0' }}>{n.character}</Text>
                      </View>
                      {curSelected && (
                        <Text style={{ color: '#9D6BFF', fontSize: 22, fontWeight: 600 }}>✓ 当前</Text>
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 24,
                        color: '#9E9EB0',
                        marginTop: 8,
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        overflow: 'hidden',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2
                      }}
                    >{n.text}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}

      {/* 导出面板 */}
      <ExportPanel visible={showExport} onClose={() => setShowExport(false)} />
    </ScrollView>
  );
};

export default ScriptPage;
