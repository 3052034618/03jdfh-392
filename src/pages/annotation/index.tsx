import React, { useState, useMemo } from 'react';
import { View, Text, Button, ScrollView, Textarea, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import { useDialogue } from '@/store/DialogueContext';
import { DialogueNode } from '@/types/dialogue';
import AnnotationCard from '@/components/AnnotationCard';
import PerformanceTag from '@/components/PerformanceTag';

const QUICK_LABELS = [
  '像诱导玩家怀疑自己',
  '停顿两秒再说',
  '保持温柔不能直接尖叫',
  '呼吸音要清楚',
  '尾音上扬 10%',
  '像怕被什么东西听见',
  '要有微妙的违和感'
];

type FilterType = 'all' | 'director' | 'audio' | string;
type SortType = 'time-desc' | 'time-asc' | 'count-desc' | 'count-asc';

const AnnotationPage: React.FC = () => {
  const {
    project,
    nodesList,
    setCurrentCharacterId,
    annotations,
    addAnnotation,
    addDialogueIdsToAnnotation
  } = useDialogue();

  const [localRoleId, setLocalRoleId] = useState<string>('all');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('李导');
  const [sortType, setSortType] = useState<SortType>('time-desc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showAddLinkPanel, setShowAddLinkPanel] = useState(false);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [addLinkSelectedIds, setAddLinkSelectedIds] = useState<string[]>([]);
  const [authorFilter, setAuthorFilter] = useState<string>('all');
  const [countFilter, setCountFilter] = useState<'all' | 'single' | 'multi'>('all');

  const uniqueAuthors = useMemo(() => {
    const authors = new Set<string>();
    annotations.forEach(a => authors.add(a.author));
    return Array.from(authors);
  }, [annotations]);

  // 角色统计：按批注去重（每条批注只算一次，不管关联多少句同角色台词）
  const byCharCountsDedup = useMemo(() => {
    const counts: Record<string, number> = {};
    annotations.forEach(a => {
      const rolesInThisAnn = new Set<string>();
      a.dialogueIds.forEach(did => {
        const node = project.nodes[did];
        if (node) rolesInThisAnn.add(node.role);
      });
      rolesInThisAnn.forEach(roleId => {
        counts[roleId] = (counts[roleId] || 0) + 1;
      });
    });
    return counts;
  }, [annotations, project.nodes]);

  const directorCount = annotations.filter(a => a.role === 'director').length;
  const audioCount = annotations.filter(a => a.role === 'audio').length;

  const filteredAnnotations = useMemo(() => {
    let list = [...annotations];

    if (filter === 'director') list = list.filter(a => a.role === 'director');
    else if (filter === 'audio') list = list.filter(a => a.role === 'audio');
    else if (filter !== 'all') list = list.filter(a => {
      return a.dialogueIds.some(did => {
        const node = project.nodes[did];
        return node?.role === filter;
      });
    });

    if (authorFilter !== 'all') {
      list = list.filter(a => a.author === authorFilter);
    }

    if (countFilter === 'single') {
      list = list.filter(a => a.dialogueIds.length === 1);
    } else if (countFilter === 'multi') {
      list = list.filter(a => a.dialogueIds.length >= 2);
    }

    if (sortType === 'time-desc') {
      list.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortType === 'time-asc') {
      list.sort((a, b) => a.createdAt - b.createdAt);
    } else if (sortType === 'count-desc') {
      list.sort((a, b) => b.dialogueIds.length - a.dialogueIds.length);
    } else if (sortType === 'count-asc') {
      list.sort((a, b) => a.dialogueIds.length - b.dialogueIds.length);
    }

    return list;
  }, [annotations, filter, authorFilter, countFilter, sortType, project.nodes]);

  const selectableNodes = useMemo(() => {
    if (localRoleId === 'all') return nodesList;
    return nodesList.filter(n => n.role === localRoleId);
  }, [nodesList, localRoleId]);

  const toggleNodeSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const insertQuickLabel = (label: string) => {
    setContent(prev => (prev ? prev + '\n' + label : label));
  };

  const handleSubmit = () => {
    if (!content.trim()) {
      Taro.showToast({ title: '请输入批注内容', icon: 'none' });
      return;
    }
    if (selectedIds.length === 0) {
      Taro.showToast({ title: '请至少选择一句台词', icon: 'none' });
      return;
    }
    addAnnotation(selectedIds, content.trim(), author.trim() || '导演');
    Taro.showToast({
      title: `已提交批注`,
      icon: 'success'
    });
    setContent('');
    setSelectedIds([]);
  };

  const firstSelected: DialogueNode | undefined = selectedIds[0]
    ? project.nodes[selectedIds[0]]
    : undefined;

  const switchLocalRole = (id: string) => {
    setLocalRoleId(id);
    setSelectedIds([]);
    if (id !== 'all') setCurrentCharacterId(id);
  };

  const handleAddDialogueToAnnotation = (annotationId: string) => {
    setEditingAnnotationId(annotationId);
    setAddLinkSelectedIds([]);
    setShowAddLinkPanel(true);
  };

  const toggleAddLinkSelect = (id: string) => {
    setAddLinkSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const confirmAddLink = () => {
    if (!editingAnnotationId) return;
    if (addLinkSelectedIds.length === 0) {
      Taro.showToast({ title: '请选择要追加的台词', icon: 'none' });
      return;
    }
    addDialogueIdsToAnnotation(editingAnnotationId, addLinkSelectedIds);
    Taro.showToast({ title: '已追加关联', icon: 'success' });
    setShowAddLinkPanel(false);
    setEditingAnnotationId(null);
    setAddLinkSelectedIds([]);
  };

  const sortLabel = {
    'time-desc': '时间倒序',
    'time-asc': '时间正序',
    'count-desc': '关联多→少',
    'count-asc': '关联少→多'
  };

  return (
    <ScrollView className={styles.page} scrollY>
      <View className={styles.header}>
        <Text className={styles.headerTitle}>📝 情绪批注</Text>
        <Text className={styles.headerSub}>
          圈出台词写下批注，统一多角色远程排练的心理恐怖表演尺度
        </Text>
      </View>

      {/* 角色切换（本页独立） */}
      <View className={styles.section}>
        <View className={styles.sectionTitle}>
          <Text className={styles.sectionText}>🎭 选择角色台词（可查看全部）</Text>
        </View>
        <ScrollView className={styles.charTabs} scrollX enhanced showScrollbar={false}>
          <View
            className={classnames(styles.charTab, localRoleId === 'all' && styles.activeTab)}
            onClick={() => switchLocalRole('all')}
          >
            <View
              className={styles.charAvatar}
              style={{ background: 'linear-gradient(135deg, #9D6BFF, #FF3B5C)' }}
            >全</View>
            <Text className={styles.charName}>全部角色</Text>
          </View>
          {project.characters.map(ch => (
            <View
              key={ch.id}
              className={classnames(styles.charTab, localRoleId === ch.id && styles.activeTab)}
              onClick={() => switchLocalRole(ch.id)}
            >
              <View className={styles.charAvatar} style={{ background: ch.color }}>
                {ch.name.slice(0, 1)}
              </View>
              <Text className={styles.charName}>{ch.name}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* 筛选栏 */}
      <View className={styles.filterSection}>
        <ScrollView className={styles.filterBar} scrollX enhanced showScrollbar={false}>
          <View
            className={classnames(styles.filterChip, filter === 'all' && styles.activeChip)}
            onClick={() => setFilter('all')}
          >
            <Text className={styles.filterText}>全部批注</Text>
            <View className={styles.filterCount}>{annotations.length}</View>
          </View>
          <View
            className={classnames(styles.filterChip, filter === 'director' && styles.activeChip)}
            onClick={() => setFilter('director')}
          >
            <Text className={styles.filterText}>导演批注</Text>
            <View className={styles.filterCount}>{directorCount}</View>
          </View>
          <View
            className={classnames(styles.filterChip, filter === 'audio' && styles.activeChip)}
            onClick={() => setFilter('audio')}
          >
            <Text className={styles.filterText}>录音师</Text>
            <View className={styles.filterCount}>{audioCount}</View>
          </View>
          {project.characters.map(ch => (
            <View
              key={ch.id}
              className={classnames(styles.filterChip, filter === ch.id && styles.activeChip)}
              onClick={() => setFilter(ch.id)}
            >
              <Text className={styles.filterText}>{ch.name}</Text>
              <View className={styles.filterCount}>{byCharCountsDedup[ch.id] || 0}</View>
            </View>
          ))}
        </ScrollView>

        <View className={styles.subFilterRow}>
          <ScrollView className={styles.subFilterBar} scrollX showScrollbar={false}>
            <Text className={styles.subFilterLabel}>作者:</Text>
            <View
              className={classnames(styles.subChip, authorFilter === 'all' && styles.subActive)}
              onClick={() => setAuthorFilter('all')}
            >全部</View>
            {uniqueAuthors.map(au => (
              <View
                key={au}
                className={classnames(styles.subChip, authorFilter === au && styles.subActive)}
                onClick={() => setAuthorFilter(au)}
              >{au}</View>
            ))}
          </ScrollView>
        </View>

        <View className={styles.subFilterRow}>
          <ScrollView className={styles.subFilterBar} scrollX showScrollbar={false}>
            <Text className={styles.subFilterLabel}>关联:</Text>
            <View
              className={classnames(styles.subChip, countFilter === 'all' && styles.subActive)}
              onClick={() => setCountFilter('all')}
            >全部</View>
            <View
              className={classnames(styles.subChip, countFilter === 'single' && styles.subActive)}
              onClick={() => setCountFilter('single')}
            >单句</View>
            <View
              className={classnames(styles.subChip, countFilter === 'multi' && styles.subActive)}
              onClick={() => setCountFilter('multi')}
            >多句</View>
          </ScrollView>
        </View>
      </View>

      {/* 选中台词面板 */}
      <View className={styles.selectPanel}>
        <View className={styles.panelLabel}>
          选择要批注的台词（{localRoleId === 'all' ? '全部角色' : project.characters.find(c => c.id === localRoleId)?.name}，可多选，已选 {selectedIds.length} 条）
        </View>
        <ScrollView className={styles.selectList} scrollY>
          {selectableNodes.length === 0 ? (
            <Text style={{ color: '#6E6E8A', fontSize: '24rpx', padding: '24rpx' }}>
              当前没有对白可选
            </Text>
          ) : (
            selectableNodes.map(node => {
              const checked = selectedIds.includes(node.id);
              const ch = project.characters.find(c => c.id === node.role);
              return (
                <View
                  key={node.id}
                  className={classnames(styles.selectItem, checked && styles.selectedItem)}
                  onClick={() => toggleNodeSelect(node.id)}
                >
                  <View
                    className={styles.selAvatar}
                    style={{ background: ch?.color || '#7B3AED' }}
                  >{node.character.slice(0, 1)}</View>
                  <View className={styles.selContent}>
                    <Text className={styles.selName}>#{node.id} · {node.character}</Text>
                    <Text className={styles.selText}>{node.text}</Text>
                    <View className={styles.selPerf}>
                      <PerformanceTag
                        type={node.performance.type}
                        label={node.performance.label}
                      />
                    </View>
                  </View>
                  <View className={classnames(styles.checkBox, checked && styles.checkedBox)}>
                    {checked && <Text className={styles.checkMark}>✓</Text>}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* 批注编辑器 */}
      <View className={styles.editorCard}>
        <View className={styles.editorHeader}>
          <Text className={styles.editorTitle}>✍️ 写下批注</Text>
          <View className={styles.editorMeta}>
            将应用到 {selectedIds.length} 句台词
          </View>
        </View>

        {firstSelected && (
          <View className={styles.selectedQuote}>
            <Text className={styles.quoteIcon}>“</Text>
            <Text className={styles.quoteName}>圈出示例：#{firstSelected.id} · {firstSelected.character}</Text>
            <Text className={styles.quoteText}>{firstSelected.text}</Text>
          </View>
        )}

        <Textarea
          className={styles.textarea}
          placeholder="例如：这里像诱导玩家怀疑自己；这里停顿两秒再说；保持温柔不能直接尖叫..."
          value={content}
          onInput={e => setContent(e.detail.value)}
          maxlength={500}
          autoHeight
        />
        <View className={styles.charCount}>
          {content.length} / 500
        </View>

        <View className={styles.quickLabels}>
          <Text className={styles.qlTitle}>💡 常用批注模板（点击插入）：</Text>
          {QUICK_LABELS.map(label => (
            <View
              key={label}
              className={styles.qlChip}
              onClick={() => insertQuickLabel(label)}
            >
              <Text className={styles.qlText}>{label}</Text>
            </View>
          ))}
        </View>

        <View className={styles.submitRow}>
          <Input
            className={styles.authorInput}
            placeholder="您的称呼"
            value={author}
            onInput={e => setAuthor(e.detail.value)}
            maxlength={10}
          />
          <Button
            className={classnames(styles.submitBtn, (!content.trim() || selectedIds.length === 0) && styles.disabled)}
            onClick={handleSubmit}
          >📤 提交批注</Button>
        </View>
      </View>

      {/* 批注列表 */}
      <View className={styles.sectionHeader}>
        <Text className={styles.sectionTitle}>
          📚 批注列表（{filteredAnnotations.length}）
        </Text>
        <View style={{ position: 'relative' }}>
          <Button className={styles.sortBtn} onClick={() => setShowSortMenu(!showSortMenu)}>
            ⇅ {sortLabel[sortType]}
          </Button>
          {showSortMenu && (
            <View className={styles.sortMenu}>
              {Object.entries(sortLabel).map(([key, label]) => (
                <View
                  key={key}
                  className={classnames(styles.sortItem, sortType === key && styles.sortItemActive)}
                  onClick={() => { setSortType(key as SortType); setShowSortMenu(false); }}
                >
                  {label}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {filteredAnnotations.length === 0 ? (
        <View className={styles.empty}>
          <Text className={styles.emptyIcon}>🗒️</Text>
          <Text className={styles.emptyTitle}>暂无批注</Text>
          <Text className={styles.emptyText}>
            选择台词并写下表演尺度批注，帮助多角色远程排练时统一心理恐怖的表演标准
          </Text>
        </View>
      ) : (
        filteredAnnotations.map(ann => (
          <AnnotationCard
            key={ann.id}
            annotation={ann}
            onAddDialogue={handleAddDialogueToAnnotation}
          />
        ))
      )}

      {/* 追加关联台词弹窗 */}
      {showAddLinkPanel && (
        <View className={styles.modalMask} onClick={() => setShowAddLinkPanel(false)}>
          <View className={styles.modalSheet} onClick={e => e.stopPropagation()}>
            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>➕ 追加关联台词</Text>
              <Button className={styles.closeBtn} onClick={() => setShowAddLinkPanel(false)}>✕</Button>
            </View>
            <View className={styles.modalTip}>
              选择要追加到这条批注的台词（可多选，已选 {addLinkSelectedIds.length} 条）
            </View>
            <ScrollView className={styles.modalList} scrollY>
              {nodesList.length === 0 ? (
                <Text style={{ color: '#6E6E8A', fontSize: '24rpx', padding: '32rpx' }}>
                  没有台词可选
                </Text>
              ) : (
                nodesList.map(node => {
                  const checked = addLinkSelectedIds.includes(node.id);
                  const alreadyLinked = editingAnnotationId
                    ? annotations.find(a => a.id === editingAnnotationId)?.dialogueIds.includes(node.id)
                    : false;
                  const ch = project.characters.find(c => c.id === node.role);
                  return (
                    <View
                      key={node.id}
                      className={classnames(
                        styles.selectItem,
                        checked && styles.selectedItem,
                        alreadyLinked && styles.alreadyLinked
                      )}
                      onClick={() => {
                        if (alreadyLinked) return;
                        toggleAddLinkSelect(node.id);
                      }}
                    >
                      <View
                        className={styles.selAvatar}
                        style={{ background: ch?.color || '#7B3AED' }}
                      >{node.character.slice(0, 1)}</View>
                      <View className={styles.selContent}>
                        <Text className={styles.selName}>#{node.id} · {node.character}</Text>
                        <Text className={styles.selText}>{node.text}</Text>
                        {alreadyLinked && (
                          <Text style={{ fontSize: 20, color: '#2FD4A6', marginTop: 4 }}>
                            ✓ 已关联
                          </Text>
                        )}
                      </View>
                      <View className={classnames(styles.checkBox, checked && styles.checkedBox)}>
                        {checked && <Text className={styles.checkMark}>✓</Text>}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
            <Button
              className={classnames(styles.primaryBtn, addLinkSelectedIds.length === 0 && styles.disabled)}
              onClick={confirmAddLink}
            >
              确认追加（{addLinkSelectedIds.length}条）
            </Button>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

export default AnnotationPage;
