import React, { createContext, useContext, useMemo, useState, useEffect, ReactNode, useCallback } from 'react';
import Taro from '@tarojs/taro';
import {
  ScriptProject,
  DialogueNode,
  Annotation,
  PerformanceHint,
  BranchChoice,
  PersistState,
  Character,
  PerformanceType,
  RehearsalTrack,
  TreeNode,
  EmotionPoint
} from '@/types/dialogue';
import { mockScriptProject, mockAnnotations } from '@/data/mockScript';

const STORAGE_KEY = 'horror_va_script_v2';

const normalizeAnnotations = (anns: any[]): Annotation[] => {
  return anns.map(a => ({
    ...a,
    dialogueIds: a.dialogueIds || (a.dialogueId ? [a.dialogueId] : [])
  }));
};

const buildInitialState = (): PersistState => {
  try {
    const cached = Taro.getStorageSync(STORAGE_KEY);
    if (cached && typeof cached === 'object' && cached.project && cached.project.nodes) {
      const normalized = {
        ...cached,
        annotations: normalizeAnnotations(cached.annotations || []),
        rehearsalTracks: cached.rehearsalTracks || []
      };
      return normalized as PersistState;
    }
  } catch (e) {
    // ignore
  }
  const nodes = { ...mockScriptProject.nodes };
  const normalizedMockAnns = normalizeAnnotations(mockAnnotations);
  // 把旧的单 id 批注按内容合并到多 id
  const mergedAnns: Annotation[] = [];
  const seenKey = new Map<string, number>();
  normalizedMockAnns.forEach(a => {
    const key = `${a.content}__${a.author}__${a.role}`;
    const existingIdx = seenKey.get(key);
    if (typeof existingIdx === 'number') {
      const did = a.dialogueIds[0];
      if (did && !mergedAnns[existingIdx].dialogueIds.includes(did)) {
        mergedAnns[existingIdx].dialogueIds.push(did);
      }
    } else {
      seenKey.set(key, mergedAnns.length);
      mergedAnns.push({ ...a });
    }
  });

  // 注入到 nodes
  Object.values(nodes).forEach(n => { n.annotations = []; });
  mergedAnns.forEach(a => {
    a.dialogueIds.forEach(did => {
      if (nodes[did]) {
        nodes[did].annotations!.push(a);
      }
    });
  });

  return {
    project: { ...mockScriptProject, nodes },
    currentCharacterId: mockScriptProject.characters[0].id,
    rehearsalNodeId: mockScriptProject.startNodeId,
    rehearsalTracks: [],
    annotations: mergedAnns
  };
};

// 构建树状结构
const buildTree = (project: ScriptProject): { trees: TreeNode[]; brokenLinks: string[]; allNodes: Set<string>; confluenceNodes: string[]; orphanNodes: string[] } => {
  const nodes = project.nodes;
  const allNodeIds = new Set(Object.keys(nodes));

  // 第一步：计算每个节点的父节点数（汇合节点检测）
  const parentCount: Record<string, number> = {};
  Object.keys(nodes).forEach(nid => { parentCount[nid] = 0; });
  Object.values(nodes).forEach(node => {
    if (node.nextNodeId && nodes[node.nextNodeId]) {
      parentCount[node.nextNodeId] = (parentCount[node.nextNodeId] || 0) + 1;
    }
    if (node.choices) {
      node.choices.forEach(ch => {
        if (ch.nextNodeId && nodes[ch.nextNodeId]) {
          parentCount[ch.nextNodeId] = (parentCount[ch.nextNodeId] || 0) + 1;
        }
      });
    }
  });

  // 第二步：检测真正的断链（指向不存在的节点）
  const brokenLinks: string[] = [];
  const brokenTargetsMap: Record<string, string[]> = {};
  Object.values(nodes).forEach(node => {
    if (node.nextNodeId && !nodes[node.nextNodeId]) {
      brokenLinks.push(`${node.id}→${node.nextNodeId}`);
      if (!brokenTargetsMap[node.id]) brokenTargetsMap[node.id] = [];
      brokenTargetsMap[node.id].push(node.nextNodeId);
    }
    if (node.choices) {
      node.choices.forEach(ch => {
        if (ch.nextNodeId && !nodes[ch.nextNodeId]) {
          brokenLinks.push(`${node.id}[${ch.text}]→${ch.nextNodeId}`);
          if (!brokenTargetsMap[node.id]) brokenTargetsMap[node.id] = [];
          brokenTargetsMap[node.id].push(ch.nextNodeId);
        }
      });
    }
  });

  // 第三步：识别孤立节点（没有任何父节点，且不是起点）
  const orphanNodes: string[] = [];
  Object.keys(nodes).forEach(nid => {
    if (parentCount[nid] === 0 && nid !== project.startNodeId) {
      orphanNodes.push(nid);
    }
  });

  // 第四步：识别汇合节点
  const confluenceNodes: string[] = [];
  Object.entries(parentCount).forEach(([nid, count]) => {
    if (count >= 2) confluenceNodes.push(nid);
  });

  // 第五步：构建树结构（DFS，处理汇合节点时允许重复访问但标记为汇合）
  const visited = new Set<string>();
  const trees: TreeNode[] = [];

  const buildNode = (nodeId: string, level: number, isOrphanRoot: boolean = false): TreeNode | null => {
    const node = nodes[nodeId];
    if (!node) return null;

    const alreadyVisited = visited.has(nodeId);
    if (alreadyVisited) {
      // 汇合点：返回一个简化节点，不继续递归
      return {
        id: nodeId,
        node,
        level,
        children: [],
        hasBrokenLink: false,
        isEnd: false,
        isConfluence: true,
        parentCount: parentCount[nodeId] || 0,
        isOrphan: false,
        brokenTargets: brokenTargetsMap[nodeId] || []
      };
    }
    visited.add(nodeId);

    const children: TreeNode[] = [];
    let hasBroken = (brokenTargetsMap[nodeId] || []).length > 0;

    if (node.nextNodeId) {
      const child = buildNode(node.nextNodeId, level + 1);
      if (child) children.push(child);
    }
    if (node.choices) {
      node.choices.forEach(ch => {
        if (ch.nextNodeId && nodes[ch.nextNodeId]) {
          const child = buildNode(ch.nextNodeId, level + 1);
          if (child) children.push(child);
        }
      });
    }

    const isEnd = !node.nextNodeId && (!node.choices || node.choices.length === 0);
    const isConfluence = (parentCount[nodeId] || 0) >= 2;
    const isOrphan = isOrphanRoot && orphanNodes.includes(nodeId);

    return {
      id: nodeId,
      node,
      level,
      children,
      hasBrokenLink: hasBroken,
      isEnd,
      isConfluence,
      parentCount: parentCount[nodeId] || 0,
      isOrphan,
      brokenTargets: brokenTargetsMap[nodeId] || []
    };
  };

  // 从 startNodeId 开始（主树）
  const mainTree = buildNode(project.startNodeId, 0);
  if (mainTree) trees.push(mainTree);

  // 孤立节点作为单独的树
  orphanNodes.forEach(nid => {
    if (!visited.has(nid)) {
      const orphanTree = buildNode(nid, 0, true);
      if (orphanTree) trees.push(orphanTree);
    }
  });

  return { trees, brokenLinks, allNodes: allNodeIds, confluenceNodes, orphanNodes };
};

interface DialogueContextType {
  project: ScriptProject;
  currentCharacterId: string;
  setCurrentCharacterId: (id: string) => void;
  nodesList: DialogueNode[];
  annotations: Annotation[];
  rehearsalNodeId: string;
  setRehearsalNodeId: (id: string) => void;
  rehearsalTracks: RehearsalTrack[];

  updateNodePerformance: (nodeId: string, perf: PerformanceHint) => void;
  updateNodeText: (nodeId: string, text: string) => void;
  updateNodeChoices: (nodeId: string, choices: BranchChoice[]) => void;
  addChoice: (nodeId: string) => void;
  removeChoice: (nodeId: string, choiceId: string) => void;
  updateChoice: (nodeId: string, choiceId: string, patch: Partial<BranchChoice>) => void;
  setNextNode: (nodeId: string, nextId: string) => void;

  createNode: (params: {
    role: string;
    character: string;
    text: string;
    performance: PerformanceHint;
    parentId?: string;
    attachAs?: 'linear' | 'choice';
    choiceText?: string;
  }) => string;

  markRecorded: (nodeId: string, duration: number) => void;

  // 批注：一次可以关联多句，列表去重显示
  addAnnotation: (dialogueIds: string[], content: string, author: string) => void;
  getAnnotationsByDialogue: (dialogueId: string) => Annotation[];
  addDialogueIdsToAnnotation: (annotationId: string, dialogueIds: string[]) => void;
  removeDialogueIdsFromAnnotation: (annotationId: string, dialogueIds: string[]) => void;
  deleteAnnotation: (annotationId: string) => void;

  // 排练轨迹
  saveRehearsalTrack: (params: {
    pathNodeIds: string[];
    choices: Record<string, string>;
    recordedNodeIds: string[];
    emotionCurve: EmotionPoint[];
    actorName: string;
    note?: string;
  }) => string;
  deleteRehearsalTrack: (trackId: string) => void;
  loadRehearsalTrack: (trackId: string) => RehearsalTrack | undefined;

  // 树状总览
  getTreeData: () => { trees: TreeNode[]; brokenLinks: string[]; allNodes: Set<string>; confluenceNodes: string[]; orphanNodes: string[] };

  // 导出
  exportAllAsText: () => string;

  getCharacterById: (id: string) => Character | undefined;
  findNextNodeId: (parentId: string, choiceId?: string) => string | undefined;
}

const DialogueContext = createContext<DialogueContextType | null>(null);

export const DialogueProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const initial = useMemo<PersistState>(() => buildInitialState(), []);
  const [project, setProject] = useState<ScriptProject>(initial.project);
  const [currentCharacterId, setCurrentCharacterIdState] = useState<string>(initial.currentCharacterId);
  const [rehearsalNodeId, setRehearsalNodeIdState] = useState<string>(initial.rehearsalNodeId);
  const [rehearsalTracks, setRehearsalTracks] = useState<RehearsalTrack[]>(initial.rehearsalTracks);
  const [globalAnnotations, setGlobalAnnotations] = useState<Annotation[]>(initial.annotations);

  const persist = useCallback((next: PersistState) => {
    try {
      Taro.setStorageSync(STORAGE_KEY, next);
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    persist({ project, currentCharacterId, rehearsalNodeId, rehearsalTracks, annotations: globalAnnotations });
  }, [project, currentCharacterId, rehearsalNodeId, rehearsalTracks, globalAnnotations, persist]);

  const setCurrentCharacterId = useCallback((id: string) => {
    setCurrentCharacterIdState(id);
  }, []);

  const setRehearsalNodeId = useCallback((id: string) => {
    setRehearsalNodeIdState(id);
  }, []);

  const nodesList = useMemo(() => Object.values(project.nodes), [project.nodes]);

  const annotations = useMemo(() => globalAnnotations, [globalAnnotations]);

  const updateNodePerformance = useCallback((nodeId: string, perf: PerformanceHint) => {
    setProject(p => ({
      ...p,
      nodes: { ...p.nodes, [nodeId]: { ...p.nodes[nodeId], performance: perf } }
    }));
  }, []);

  const updateNodeText = useCallback((nodeId: string, text: string) => {
    setProject(p => ({
      ...p,
      nodes: { ...p.nodes, [nodeId]: { ...p.nodes[nodeId], text } }
    }));
  }, []);

  const updateNodeChoices = useCallback((nodeId: string, choices: BranchChoice[]) => {
    setProject(p => ({
      ...p,
      nodes: { ...p.nodes, [nodeId]: { ...p.nodes[nodeId], choices } }
    }));
  }, []);

  const addChoice = useCallback((nodeId: string) => {
    setProject(p => {
      const target = p.nodes[nodeId];
      if (!target) return p;
      const newChoice: BranchChoice = {
        id: `ch-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        text: '',
        nextNodeId: ''
      };
      return {
        ...p,
        nodes: {
          ...p.nodes,
          [nodeId]: {
            ...target,
            choices: [...(target.choices || []), newChoice]
          }
        }
      };
    });
  }, []);

  const removeChoice = useCallback((nodeId: string, choiceId: string) => {
    setProject(p => {
      const target = p.nodes[nodeId];
      if (!target || !target.choices) return p;
      return {
        ...p,
        nodes: {
          ...p.nodes,
          [nodeId]: {
            ...target,
            choices: target.choices.filter(c => c.id !== choiceId)
          }
        }
      };
    });
  }, []);

  const updateChoice = useCallback((nodeId: string, choiceId: string, patch: Partial<BranchChoice>) => {
    setProject(p => {
      const target = p.nodes[nodeId];
      if (!target || !target.choices) return p;
      return {
        ...p,
        nodes: {
          ...p.nodes,
          [nodeId]: {
            ...target,
            choices: target.choices.map(c =>
              c.id === choiceId ? { ...c, ...patch } : c
            )
          }
        }
      };
    });
  }, []);

  const setNextNode = useCallback((nodeId: string, nextId: string) => {
    setProject(p => ({
      ...p,
      nodes: { ...p.nodes, [nodeId]: { ...p.nodes[nodeId], nextNodeId: nextId } }
    }));
  }, []);

  const createNode = useCallback((params: {
    role: string;
    character: string;
    text: string;
    performance: PerformanceHint;
    parentId?: string;
    attachAs?: 'linear' | 'choice';
    choiceText?: string;
  }): string => {
    const newId = `n-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newNode: DialogueNode = {
      id: newId,
      role: params.role,
      character: params.character,
      text: params.text,
      performance: params.performance,
      recorded: false,
      annotations: []
    };
    setProject(p => {
      const nextNodes = { ...p.nodes, [newId]: newNode };
      if (params.parentId && p.nodes[params.parentId]) {
        const parent = p.nodes[params.parentId];
        if (params.attachAs === 'choice') {
          const newChoice: BranchChoice = {
            id: `ch-${Date.now()}`,
            text: params.choiceText || '新选项',
            nextNodeId: newId
          };
          nextNodes[params.parentId] = {
            ...parent,
            choices: [...(parent.choices || []), newChoice]
          };
        } else {
          nextNodes[params.parentId] = { ...parent, nextNodeId: newId };
        }
      }
      return { ...p, nodes: nextNodes };
    });
    return newId;
  }, []);

  const markRecorded = useCallback((nodeId: string, duration: number) => {
    setProject(p => {
      const target = p.nodes[nodeId];
      if (!target) return p;
      return {
        ...p,
        nodes: {
          ...p.nodes,
          [nodeId]: {
            ...target,
            recorded: true,
            duration,
            lastRecordedAt: Date.now()
          }
        }
      };
    });
  }, []);

  const addAnnotation = useCallback((dialogueIds: string[], content: string, author: string) => {
    const dedupKey = `${content}__${author}__director`;
    const existingIdx = globalAnnotations.findIndex(a => `${a.content}__${a.author}__${a.role}` === dedupKey);

    let ann: Annotation;
    let nextAnns: Annotation[];

    if (existingIdx >= 0) {
      // 已存在相同内容：合并 dialogueIds
      const cur = globalAnnotations[existingIdx];
      const mergedIds = Array.from(new Set([...cur.dialogueIds, ...dialogueIds]));
      ann = { ...cur, dialogueIds: mergedIds, createdAt: Date.now() };
      nextAnns = globalAnnotations.map((a, i) => i === existingIdx ? ann : a);
    } else {
      ann = {
        id: `a-${Date.now()}`,
        dialogueIds: [...dialogueIds],
        content,
        author,
        role: 'director',
        createdAt: Date.now()
      };
      nextAnns = [...globalAnnotations, ann];
    }

    setGlobalAnnotations(nextAnns);

    // 同步到 nodes
    setProject(p => {
      const next = { ...p, nodes: { ...p.nodes } };
      dialogueIds.forEach(did => {
        const target = next.nodes[did];
        if (!target) return;
        // 移除旧的重复项（同 content+author）后再加入
        const others = (target.annotations || []).filter(
          a => !(a.content === content && a.author === author)
        );
        next.nodes[did] = {
          ...target,
          annotations: [...others, ann]
        };
      });
      return next;
    });
  }, [globalAnnotations]);

  const getAnnotationsByDialogue = useCallback((dialogueId: string): Annotation[] => {
    return globalAnnotations.filter(a => a.dialogueIds.includes(dialogueId));
  }, [globalAnnotations]);

  const addDialogueIdsToAnnotation = useCallback((annotationId: string, dialogueIds: string[]) => {
    const ann = globalAnnotations.find(a => a.id === annotationId);
    if (!ann) return;

    const mergedIds = Array.from(new Set([...ann.dialogueIds, ...dialogueIds]));
    const updated: Annotation = { ...ann, dialogueIds: mergedIds, createdAt: Date.now() };

    setGlobalAnnotations(prev => prev.map(a => a.id === annotationId ? updated : a));

    setProject(p => {
      const next = { ...p, nodes: { ...p.nodes } };
      dialogueIds.forEach(did => {
        const target = next.nodes[did];
        if (!target) return;
        const others = (target.annotations || []).filter(a => a.id !== annotationId);
        next.nodes[did] = { ...target, annotations: [...others, updated] };
      });
      return next;
    });
  }, [globalAnnotations]);

  const removeDialogueIdsFromAnnotation = useCallback((annotationId: string, dialogueIds: string[]) => {
    const ann = globalAnnotations.find(a => a.id === annotationId);
    if (!ann) return;

    const remainingIds = ann.dialogueIds.filter(id => !dialogueIds.includes(id));
    const updated: Annotation = { ...ann, dialogueIds: remainingIds, createdAt: Date.now() };

    if (remainingIds.length === 0) {
      // 没有关联台词了就删除整个批注
      setGlobalAnnotations(prev => prev.filter(a => a.id !== annotationId));
      setProject(p => {
        const next = { ...p, nodes: { ...p.nodes } };
        dialogueIds.forEach(did => {
          const target = next.nodes[did];
          if (!target) return;
          next.nodes[did] = {
            ...target,
            annotations: (target.annotations || []).filter(a => a.id !== annotationId)
          };
        });
        return next;
      });
    } else {
      setGlobalAnnotations(prev => prev.map(a => a.id === annotationId ? updated : a));
      setProject(p => {
        const next = { ...p, nodes: { ...p.nodes } };
        dialogueIds.forEach(did => {
          const target = next.nodes[did];
          if (!target) return;
          next.nodes[did] = {
            ...target,
            annotations: (target.annotations || []).filter(a => a.id !== annotationId)
          };
        });
        // 给保留的台词更新批注
        remainingIds.forEach(did => {
          const target = next.nodes[did];
          if (!target) return;
          const others = (target.annotations || []).filter(a => a.id !== annotationId);
          next.nodes[did] = { ...target, annotations: [...others, updated] };
        });
        return next;
      });
    }
  }, [globalAnnotations]);

  const deleteAnnotation = useCallback((annotationId: string) => {
    const ann = globalAnnotations.find(a => a.id === annotationId);
    if (!ann) return;

    setGlobalAnnotations(prev => prev.filter(a => a.id !== annotationId));

    setProject(p => {
      const next = { ...p, nodes: { ...p.nodes } };
      ann.dialogueIds.forEach(did => {
        const target = next.nodes[did];
        if (!target) return;
        next.nodes[did] = {
          ...target,
          annotations: (target.annotations || []).filter(a => a.id !== annotationId)
        };
      });
      return next;
    });
  }, [globalAnnotations]);

  const saveRehearsalTrack = useCallback((params: {
    pathNodeIds: string[];
    choices: Record<string, string>;
    recordedNodeIds: string[];
    emotionCurve: EmotionPoint[];
    actorName: string;
    note?: string;
  }): string => {
    const now = Date.now();
    const track: RehearsalTrack = {
      id: `t-${now}`,
      title: `排练 · ${new Date(now).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
      startedAt: now - (params.pathNodeIds.length * 60_000),
      endedAt: now,
      actorName: params.actorName,
      pathNodeIds: params.pathNodeIds,
      choices: params.choices,
      recordedNodeIds: params.recordedNodeIds,
      emotionCurve: params.emotionCurve,
      note: params.note
    };
    setRehearsalTracks(prev => [track, ...prev]);
    return track.id;
  }, []);

  const deleteRehearsalTrack = useCallback((trackId: string) => {
    setRehearsalTracks(prev => prev.filter(t => t.id !== trackId));
  }, []);

  const loadRehearsalTrack = useCallback((trackId: string): RehearsalTrack | undefined => {
    return rehearsalTracks.find(t => t.id === trackId);
  }, [rehearsalTracks]);

  const getTreeData = useCallback(() => buildTree(project), [project]);

  const exportAllAsText = useCallback((): string => {
    const lines: string[] = [];
    lines.push('═'.repeat(60));
    lines.push(`🎬 ${project.title}`);
    lines.push(`   游戏: ${project.game} / 场景: ${project.scene}`);
    lines.push(`   角色: ${project.characters.map(c => c.name).join('、')}`);
    lines.push('═'.repeat(60));
    lines.push('');

    // 按遍历顺序导出对白树
    lines.push('【对白树】');
    lines.push('-'.repeat(40));

    const { trees } = buildTree(project);
    const dumpTree = (tn: TreeNode) => {
      const indent = '    '.repeat(tn.level);
      const n = tn.node;
      const perfLabel = n.performance.label;
      const intensity = n.performance.intensity;
      const rec = n.recorded ? `[✓ ${n.duration}s]` : '[ 待录 ]';
      lines.push(`${indent}▶ #${n.id} · ${n.character} ${rec}`);
      lines.push(`${indent}  ${n.text}`);
      lines.push(`${indent}  🎭 ${perfLabel} (强度:${intensity}/10)`);
      if (n.choices && n.choices.length > 0) {
        n.choices.forEach((ch, idx) => {
          const target = project.nodes[ch.nextNodeId];
          lines.push(`${indent}     ${String.fromCharCode(65 + idx)}. "${ch.text}" → #${ch.nextNodeId}${target ? '' : ' [⚠️ 断链]'}`);
        });
      } else if (n.nextNodeId) {
        const target = project.nodes[n.nextNodeId];
        lines.push(`${indent}     → 下一句 #${n.nextNodeId}${target ? '' : ' [⚠️ 断链]'}`);
      } else {
        lines.push(`${indent}     ■ 路径终点`);
      }
      const anns = globalAnnotations.filter(a => a.dialogueIds.includes(n.id));
      anns.forEach(a => {
        lines.push(`${indent}     📝 ${a.author}: ${a.content}`);
      });
      lines.push('');
      tn.children.forEach(dumpTree);
    };
    trees.forEach(dumpTree);

    if (globalAnnotations.length > 0) {
      lines.push('═'.repeat(60));
      lines.push('【导演批注汇总】');
      lines.push('-'.repeat(40));
      globalAnnotations.forEach((a, i) => {
        lines.push(`${i + 1}. [${a.dialogueIds.map(id => '#' + id).join(', ')}] ${a.author}:`);
        lines.push(`   ${a.content}`);
        lines.push('');
      });
    }

    if (rehearsalTracks.length > 0) {
      lines.push('═'.repeat(60));
      lines.push('【排练轨迹记录】');
      lines.push('-'.repeat(40));
      rehearsalTracks.forEach((t, i) => {
        const dateStr = new Date(t.startedAt).toLocaleString('zh-CN');
        const avgIntensity = t.emotionCurve.length > 0
          ? (t.emotionCurve.reduce((s, p) => s + p.value, 0) / t.emotionCurve.length).toFixed(1)
          : '-';
        lines.push(`${i + 1}. ${t.title}`);
        lines.push(`   演员: ${t.actorName} | 时间: ${dateStr}`);
        lines.push(`   路径: ${t.pathNodeIds.length}句 | 录制: ${t.recordedNodeIds.length}句 | 平均情绪: ${avgIntensity}`);
        lines.push(`   节点: ${t.pathNodeIds.map(id => '#' + id).join(' → ')}`);
        if (t.note) lines.push(`   备注: ${t.note}`);
        lines.push('');
      });
    }

    lines.push('═'.repeat(60));
    lines.push(`导出时间: ${new Date().toLocaleString('zh-CN')}`);
    return lines.join('\n');
  }, [project, globalAnnotations, rehearsalTracks]);

  const getCharacterById = useCallback((id: string): Character | undefined => {
    return project.characters.find(c => c.id === id);
  }, [project.characters]);

  const findNextNodeId = useCallback((parentId: string, choiceId?: string): string | undefined => {
    const parent = project.nodes[parentId];
    if (!parent) return undefined;
    if (choiceId && parent.choices) {
      const ch = parent.choices.find(c => c.id === choiceId);
      return ch?.nextNodeId;
    }
    return parent.nextNodeId;
  }, [project.nodes]);

  const value: DialogueContextType = {
    project,
    currentCharacterId,
    setCurrentCharacterId,
    nodesList,
    annotations,
    rehearsalNodeId,
    setRehearsalNodeId,
    rehearsalTracks,
    updateNodePerformance,
    updateNodeText,
    updateNodeChoices,
    addChoice,
    removeChoice,
    updateChoice,
    setNextNode,
    createNode,
    markRecorded,
    addAnnotation,
    getAnnotationsByDialogue,
    addDialogueIdsToAnnotation,
    removeDialogueIdsFromAnnotation,
    deleteAnnotation,
    saveRehearsalTrack,
    deleteRehearsalTrack,
    loadRehearsalTrack,
    getTreeData,
    exportAllAsText,
    getCharacterById,
    findNextNodeId
  };

  return (
    <DialogueContext.Provider value={value}>
      {children}
    </DialogueContext.Provider>
  );
};

export const useDialogue = (): DialogueContextType => {
  const ctx = useContext(DialogueContext);
  if (!ctx) throw new Error('useDialogue must be used within DialogueProvider');
  return ctx;
};

export { PerformanceType };
