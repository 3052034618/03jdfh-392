import React from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';
import { TreeNode } from '@/types/dialogue';
import { useDialogue } from '@/store/DialogueContext';
import PerformanceTag from '@/components/PerformanceTag';
import { getEmotionColor } from '@/utils/emotion';

interface Props {
  onNodeClick: (nodeId: string) => void;
  activeNodeId?: string;
}

const DialogueTree: React.FC<Props> = ({ onNodeClick, activeNodeId }) => {
  const { getTreeData, getCharacterById } = useDialogue();
  const { trees, brokenLinks, allNodes } = getTreeData();

  const renderNode = (tn: TreeNode, parentType: 'root' | 'linear' | 'branch', branchLabel?: string) => {
    const isActive = activeNodeId === tn.id;
    const ch = getCharacterById(tn.node.role);
    const childrenCount = tn.children.length;

    return (
      <View className={styles.childBranch} key={tn.id}>
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
            tn.hasBrokenLink && styles.brokenContent
          )}
          onClick={() => onNodeClick(tn.id)}
        >
          <View className={styles.nodeLeft}>
            <Text className={styles.nodeId}>#{tn.id}</Text>
            <Text className={styles.nodeChar}>{ch?.name || '未知'}</Text>
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
                <View className={styles.endIndicator}>✓ 已录</View>
              )}
              {tn.hasBrokenLink && (
                <View className={styles.brokenIndicator}>⚠️ 断链</View>
              )}
              {!tn.hasBrokenLink && tn.node.choices && tn.node.choices.length > 0 && (
                <View className={styles.branchIndicator}>🔀 {tn.node.choices.length}个分支</View>
              )}
              {!tn.hasBrokenLink && tn.isEnd && (
                <View className={styles.endIndicator}>■ 终点</View>
              )}
            </View>
          </View>
        </View>

        {tn.children.length > 0 && (
          <View className={styles.children}>
            {tn.node.nextNodeId && tn.children[0] && tn.children[0].id === tn.node.nextNodeId ? (
              renderNode(tn.children[0], 'linear')
            ) : null}
            {tn.node.choices && tn.node.choices.map((ch, idx) => {
              const child = tn.children.find(c => c.id === ch.nextNodeId);
              if (!child) return null;
              return renderNode(child, 'branch', `${String.fromCharCode(65 + idx)}. ${ch.text}`);
            })}
            {/* 处理不是通过 nextNodeId 或 choices 链接的子节点（一般不会出现） */}
            {tn.children.filter(c =>
              c.id !== tn.node.nextNodeId &&
              !tn.node.choices?.some(ch => ch.nextNodeId === c.id)
            ).map(orphan => renderNode(orphan, 'linear'))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View className={styles.wrapper}>
      <View className={styles.statusBar}>
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
          <View className={styles.statusItem}>
            <Text>路径终点</Text>
            <Text className={styles.statusNum}>
              {trees.reduce((s, t) => s + (t.isEnd && !t.hasBrokenLink ? 1 : 0) + t.children.filter(c => c.isEnd && !c.hasBrokenLink).length, 0)}
            </Text>
          </View>
        </View>
        <Text className={styles.tip}>点击节点跳转编辑</Text>
      </View>

      <ScrollView className={styles.treeContainer} scrollX>
        {trees.length === 0 ? (
          <Text className={styles.empty}>暂无对白节点</Text>
        ) : (
          trees.map(t => renderNode(t, 'root'))
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
      </View>
    </View>
  );
};

export default DialogueTree;
