import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';
import { TreeNode, DialogueNode } from '@/types/dialogue';
import { useDialogue } from '@/store/DialogueContext';
import PerformanceTag from '@/components/PerformanceTag';
import { getEmotionColor } from '@/utils/emotion';

interface Props {
  onNodeClick: (nodeId: string, roleId: string) => void;
  activeNodeId?: string;
}

type ViewMode = 'tree' | 'checklist';
type CheckCategory = 'broken' | 'orphan' | 'confluence' | 'end';

interface CheckItem {
  category: CheckCategory;
  nodeId: string;
  node?: DialogueNode;
  extraInfo?: string;
}

const CATEGORY_META: Record<CheckCategory, { label: string; icon: string; cls: string }> = {
  broken:     { label: '⚠️ 断链接点',  icon: '⚠️', cls: 'broken' },
  orphan:     { label: '🏝️ 孤立节点', icon: '🏝️', cls: 'orphan' },
  confluence: { label: '🔀 汇合节点', icon: '🔀', cls: 'confluence' },
  end:        { label: '■ 终点节点',  icon: '■',  cls: 'end' }
};

const DialogueTree: React.FC<Props> = ({ onNodeClick, activeNodeId }) => {
  const { getTreeData, getCharacterById, project } = useDialogue();
  const { trees, brokenLinks, allNodes, confluenceNodes, orphanNodes } = getTreeData();
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [selectedCheckId, setSelectedCheckId] = useState<string | null>(null);

  // 汇总所有检查项
  const checkItems = useMemo((): CheckItem[] => {
    const items: CheckItem[] = [];
    const allTrees: TreeNode[] = [];
    const collect = (t: TreeNode) => {
      allTrees.push(t);
      t.children.forEach(collect);
    };
    trees.forEach(collect);

    // 1. 断链接点
    allTrees.filter(t => t.hasBrokenLink).forEach(t => {
      items.push({
        category: 'broken',
        nodeId: t.id,
        node: t.node,
        extraInfo: `指向: ${t.brokenTargets.map(id => '#' + id).join(', ')}`
      });
    });

    // 2. 孤立节点
    orphanNodes.forEach(id => {
      const node = project.nodes[id];
      items.push({
        category: 'orphan',
        nodeId: id,
        node,
        extraInfo: '无入口，不在主路径上'
      });
    });

    // 3. 汇合节点
    confluenceNodes.forEach(id => {
      const treeNode = allTrees.find(t => t.id === id);
      items.push({
        category: 'confluence',
        nodeId: id,
        node: treeNode?.node || project.nodes[id],
        extraInfo: `${treeNode?.parentCount || 2}个入口`
      });
    });

    // 4. 终点节点
    allTrees.filter(t => t.isEnd && !t.hasBrokenLink).forEach(t => {
      items.push({
        category: 'end',
        nodeId: t.id,
        node: t.node,
        extraInfo: '路径结束（承接或选择后无后续）'
      });
    });

    return items;
  }, [trees, confluenceNodes, orphanNodes, project.nodes]);

  // 按类别分组
  const groupedCheckItems = useMemo(() => {
    const groups: Record<CheckCategory, CheckItem[]> = {
      broken: [], orphan: [], confluence: [], end: []
    };
    checkItems.forEach(item => groups[item.category].push(item));
    return groups;
  }, [checkItems]);

  const handleCheckItemClick = (item: CheckItem) => {
    // 第一次：高亮并跳转树；第二次：真正进入编辑
    if (selectedCheckId === item.nodeId) {
      // 第二次点击：进入编辑
      if (item.node) {
        Taro.showToast({ title: `编辑 #${item.nodeId} 连接`, icon: 'none' });
        onNodeClick(item.nodeId, item.node.role);
      }
      setSelectedCheckId(null);
    } else {
      // 第一次：选中高亮
      setSelectedCheckId(item.nodeId);
      // 同时调用 onNodeClick 让上层切换到对应角色并滚动到对应节点
      if (item.node) {
        onNodeClick(item.nodeId, item.node.role);
      }
    }
  };

  const renderNode = (tn: TreeNode, parentType: 'root' | 'linear' | 'branch', branchLabel?: string) => {
    const isActive = activeNodeId === tn.id || selectedCheckId === tn.id;
    const ch = getCharacterById(tn.node.role);

    return (
      <View className={styles.childBranch} key={tn.id + '-' + parentType + '-' + branchLabel}>
        {parentType === 'branch' && branchLabel && (
          <View className={styles.branchLabel}>{branchLabel}</View>
        )}
        {parentType === 'linear' && (
          <View className={styles.linearLabel}>→</View>
        )}
        <View
          className={classnames(
            styles.nodeContent,
            isActive && styles.activeContent,
            selectedCheckId === tn.id && styles.checkedContent,
            tn.hasBrokenLink && styles.brokenContent,
            tn.isConfluence && styles.confluenceContent,
            tn.isOrphan && styles.orphanContent
          )}
          onClick={() => {
            setSelectedCheckId(null);
            onNodeClick(tn.id, tn.node.role);
          }}
        >
          <View className={styles.nodeLeft}>
            <View className={styles.nodeHeaderRow}>
              <Text className={styles.nodeId}>#{tn.id}</Text>
              <Text className={styles.nodeChar} style={{ color: ch?.color }}>{ch?.name || '未知'}</Text>
            </View>
            {tn.isConfluence && (
              <View className={styles.confluenceBadge}>
                🔀 汇合 · {tn.parentCount}个入口
              </View>
            )}
            {tn.isOrphan && (
              <View className={styles.orphanBadge}>
                🏝️ 孤立节点
              </View>
            )}
          </View>
          <View className={styles.nodeRight}>
            <Text className={styles.nodeText}>{tn.node.text}</Text>
            <View className={styles.nodeTags}>
              <PerformanceTag
                type={tn.node.performance.type}
                label={tn.node.performance.label}
                intensity={tn.node.performance.intensity}
              />
              {tn.node.recorded && (
                <View className={styles.recordedIndicator}>✓ 已录</View>
              )}
              {tn.hasBrokenLink && (
                <View className={styles.brokenIndicator}>
                  ⚠️ {tn.brokenTargets.length}处断链
                </View>
              )}
              {!tn.hasBrokenLink && tn.node.choices && tn.node.choices.length > 0 && (
                <View className={styles.branchIndicator}>🔀 {tn.node.choices.length}个分支</View>
              )}
              {!tn.hasBrokenLink && tn.isEnd && (
                <View className={styles.endIndicator}>■ 终点</View>
              )}
              {tn.isConfluence && !tn.isEnd && (
                <View className={styles.confluenceIndicator}>🔀 汇合</View>
              )}
            </View>
          </View>
        </View>

        {tn.children.length > 0 && !tn.isConfluence && (
          <View className={styles.children}>
            {tn.node.nextNodeId && tn.children.find(c => c.id === tn.node.nextNodeId)
              ? renderNode(tn.children.find(c => c.id === tn.node.nextNodeId)!, 'linear')
              : null}
            {tn.node.choices && tn.node.choices.map((ch, idx) => {
              const child = tn.children.find(c => c.id === ch.nextNodeId);
              if (!child) return null;
              return renderNode(child, 'branch', `${String.fromCharCode(65 + idx)}. ${ch.text}`);
            })}
          </View>
        )}
        {tn.isConfluence && (
          <View className={styles.confluenceHint}>
            <Text className={styles.confluenceHintText}>
              （此节点为汇合点，详细子树见主路径）
            </Text>
          </View>
        )}
      </View>
    );
  };

  const endCount = groupedCheckItems.end.length;

  return (
    <View className={styles.wrapper}>
      {/* 视角切换 */}
      <View className={styles.viewTabs}>
        <View
          className={classnames(styles.viewTab, viewMode === 'tree' && styles.viewTabActive)}
          onClick={() => { setViewMode('tree'); setSelectedCheckId(null); }}
        >
          🌳 树状总览
        </View>
        <View
          className={classnames(styles.viewTab, viewMode === 'checklist' && styles.viewTabActive)}
          onClick={() => setViewMode('checklist')}
        >
          📋 检查清单（{checkItems.length}项）
        </View>
      </View>

      {/* 状态栏 - 树状视角 */}
      {viewMode === 'tree' && (
        <View className={styles.statusBar}>
          <ScrollView className={styles.statusScroll} scrollX showScrollbar={false}>
            <View className={styles.statusLeft}>
              <View className={styles.statusItem}>
                <Text>总节点</Text>
                <Text className={styles.statusNum}>{allNodes.size}</Text>
              </View>
              <View className={classnames(styles.statusItem, brokenLinks.length > 0 ? 'broken' : 'ok')}>
                <Text>{brokenLinks.length > 0 ? '⚠️ 断链' : '✅ 连接正常'}</Text>
                {brokenLinks.length > 0 && (
                  <Text className={styles.statusNum}>{brokenLinks.length}</Text>
                )}
              </View>
              <View className={classnames(styles.statusItem, confluenceNodes.length > 0 && 'confluence')}>
                <Text>🔀 汇合</Text>
                <Text className={styles.statusNum}>{confluenceNodes.length}</Text>
              </View>
              <View className={classnames(styles.statusItem, orphanNodes.length > 0 && 'orphan')}>
                <Text>🏝️ 孤立</Text>
                <Text className={styles.statusNum}>{orphanNodes.length}</Text>
              </View>
              <View className={styles.statusItem}>
                <Text>终点</Text>
                <Text className={styles.statusNum}>{endCount}</Text>
              </View>
            </View>
          </ScrollView>
          <Text className={styles.tip}>点击节点跳转编辑 · 自动切换角色</Text>
        </View>
      )}

      {/* 树状视图 */}
      {viewMode === 'tree' && (
        <>
          <ScrollView className={styles.treeContainer} scrollX>
            {trees.length === 0 ? (
              <Text className={styles.empty}>暂无对白节点</Text>
            ) : (
              trees.map((t, idx) => (
                <View key={t.id + '-' + idx} className={styles.treeRoot}>
                  {t.isOrphan && (
                    <View className={styles.orphanTreeLabel}>
                      🏝️ 孤立节点群 #{t.id} 起
                    </View>
                  )}
                  {idx === 0 && !t.isOrphan && (
                    <View className={styles.mainTreeLabel}>
                      🌳 主剧情（从起点开始）
                    </View>
                  )}
                  {renderNode(t, 'root')}
                </View>
              ))
            )}
          </ScrollView>

          <View className={styles.legend}>
            <View className={styles.legendItem}>
              <View className={styles.legendDot} style={{ background: getEmotionColor('normal') }}></View>
              <Text>正常</Text>
            </View>
            <View className={styles.legendItem}>
              <View className={styles.legendDot} style={{ background: getEmotionColor('whisper') }}></View>
              <Text>低语</Text>
            </View>
            <View className={styles.legendItem}>
              <View className={styles.legendDot} style={{ background: getEmotionColor('close') }}></View>
              <Text>亲近</Text>
            </View>
            <View className={styles.legendItem}>
              <View className={styles.legendDot} style={{ background: getEmotionColor('mimic') }}></View>
              <Text>模仿</Text>
            </View>
            <View className={styles.legendItem}>
              <View className={styles.legendDot} style={{ background: getEmotionColor('scream') }}></View>
              <Text>爆发</Text>
            </View>
            <View className={styles.legendItem}>
              <View className={styles.legendDot} style={{ background: '#FFC857' }}></View>
              <Text>汇合</Text>
            </View>
            <View className={styles.legendItem}>
              <View className={styles.legendDot} style={{ background: '#FF3B5C' }}></View>
              <Text>断链</Text>
            </View>
          </View>
        </>
      )}

      {/* 检查清单视图 */}
      {viewMode === 'checklist' && (
        <View className={styles.checklist}>
          {selectedCheckId && (
            <View className={styles.checkTip}>
              💡 已定位高亮节点 #{selectedCheckId}，再次点击同一项可直接进入编辑连接
            </View>
          )}
          <ScrollView className={styles.checkScroll} scrollY>
            {(Object.keys(groupedCheckItems) as CheckCategory[]).map(cat => {
              const items = groupedCheckItems[cat];
              const meta = CATEGORY_META[cat];
              return (
                <View key={cat} className={styles.checkCategory}>
                  <View className={classnames(styles.checkCatHeader, styles['cat-' + meta.cls])}>
                    <Text className={styles.checkCatTitle}>
                      {meta.icon} {meta.label}
                    </Text>
                    <View className={styles.checkCount}>{items.length}</View>
                  </View>
                  {items.length === 0 ? (
                    <View className={styles.checkCatEmpty}>
                      <Text>✨ 没有此项问题</Text>
                    </View>
                  ) : (
                    items.map(item => {
                      const ch = item.node ? getCharacterById(item.node.role) : undefined;
                      const isSelected = selectedCheckId === item.nodeId;
                      const isActive = activeNodeId === item.nodeId;
                      return (
                        <View
                          key={item.nodeId + '-' + cat}
                          className={classnames(
                            styles.checkItem,
                            isSelected && styles.checkItemSelected,
                            isActive && styles.checkItemActive,
                            styles['item-' + meta.cls]
                          )}
                          onClick={() => handleCheckItemClick(item)}
                        >
                          <View className={styles.checkItemHeader}>
                            <View
                              className={styles.checkAvatar}
                              style={{ background: ch?.color || '#7B3AED' }}
                            >
                              {item.node?.character.slice(0, 1) || '?'}
                            </View>
                            <View className={styles.checkItemMeta}>
                              <View className={styles.checkItemIdRow}>
                                <Text className={styles.checkItemId}>#{item.nodeId}</Text>
                                <Text className={styles.checkItemChar} style={{ color: ch?.color }}>
                                  {item.node?.character || '未知'}
                                </Text>
                                {item.extraInfo && (
                                  <Text className={styles.checkItemExtra}>
                                    {item.extraInfo}
                                  </Text>
                                )}
                              </View>
                              <Text className={styles.checkItemText}>
                                {item.node?.text || '(节点已删除)'}
                              </Text>
                            </View>
                          </View>
                          <View className={styles.checkItemFooter}>
                            {item.node && (
                              <PerformanceTag
                                type={item.node.performance.type}
                                label={item.node.performance.label}
                                intensity={item.node.performance.intensity}
                              />
                            )}
                            <View className={styles.checkItemAction}>
                              {isSelected ? '✏️ 再次点击编辑连接 →' : '📍 点我定位到树 →'}
                            </View>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View className={styles.checkSummary}>
            <View className={classnames(styles.summaryItem, groupedCheckItems.broken.length === 0 && 'ok')}>
              <Text>⚠️ 断链</Text>
              <Text className={styles.summaryNum}>{groupedCheckItems.broken.length}</Text>
            </View>
            <View className={classnames(styles.summaryItem, groupedCheckItems.orphan.length === 0 && 'ok')}>
              <Text>🏝️ 孤立</Text>
              <Text className={styles.summaryNum}>{groupedCheckItems.orphan.length}</Text>
            </View>
            <View className={styles.summaryItem}>
              <Text>🔀 汇合</Text>
              <Text className={styles.summaryNum}>{groupedCheckItems.confluence.length}</Text>
            </View>
            <View className={styles.summaryItem}>
              <Text>■ 终点</Text>
              <Text className={styles.summaryNum}>{endCount}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default DialogueTree;
