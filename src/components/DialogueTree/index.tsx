import React from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';
import { TreeNode } from '@/types/dialogue';
import { useDialogue } from '@/store/DialogueContext';
import PerformanceTag from '@/components/PerformanceTag';
import { getEmotionColor } from '@/utils/emotion';

interface Props {
  onNodeClick: (nodeId: string, roleId: string) => void;
  activeNodeId?: string;
}

const DialogueTree: React.FC<Props> = ({ onNodeClick, activeNodeId }) => {
  const { getTreeData, getCharacterById } = useDialogue();
  const { trees, brokenLinks, allNodes, confluenceNodes, orphanNodes } = getTreeData();

  const renderNode = (tn: TreeNode, parentType: 'root' | 'linear' | 'branch', branchLabel?: string) => {
    const isActive = activeNodeId === tn.id;
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
            tn.hasBrokenLink && styles.brokenContent,
            tn.isConfluence && styles.confluenceContent,
            tn.isOrphan && styles.orphanContent
          )}
          onClick={() => onNodeClick(tn.id, tn.node.role)}
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

  return (
    <View className={styles.wrapper}>
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
              <Text className={styles.statusNum}>
                {trees.reduce((s, t) => {
                  let count = 0;
                  const countEnds = (node: TreeNode) => {
                    if (node.isEnd && !node.hasBrokenLink) count++;
                    node.children.forEach(countEnds);
                  };
                  countEnds(t);
                  return s + count;
                }, 0)}
              </Text>
            </View>
          </View>
        </ScrollView>
        <Text className={styles.tip}>点击节点跳转编辑 · 自动切换角色</Text>
      </View>

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
    </View>
  );
};

export default DialogueTree;
