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
  PerformanceType
} from '@/types/dialogue';
import { mockScriptProject, mockAnnotations } from '@/data/mockScript';

const STORAGE_KEY = 'horror_va_script_v1';

const buildInitialState = (): PersistState => {
  try {
    const cached = Taro.getStorageSync(STORAGE_KEY);
    if (cached && typeof cached === 'object' && cached.project && cached.project.nodes) {
      return cached as PersistState;
    }
  } catch (e) {
    // ignore
  }
  const nodes = { ...mockScriptProject.nodes };
  mockAnnotations.forEach(a => {
    if (nodes[a.dialogueId]) {
      nodes[a.dialogueId] = {
        ...nodes[a.dialogueId],
        annotations: [...(nodes[a.dialogueId].annotations || []), a]
      };
    }
  });
  return {
    project: { ...mockScriptProject, nodes },
    currentCharacterId: mockScriptProject.characters[0].id,
    rehearsalNodeId: mockScriptProject.startNodeId
  };
};

interface DialogueContextType {
  project: ScriptProject;
  currentCharacterId: string;
  setCurrentCharacterId: (id: string) => void;
  nodesList: DialogueNode[];
  annotations: Annotation[];
  rehearsalNodeId: string;
  setRehearsalNodeId: (id: string) => void;

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

  addAnnotation: (dialogueIds: string[], content: string, author: string) => void;
  getAnnotationsByDialogue: (dialogueId: string) => Annotation[];

  getCharacterById: (id: string) => Character | undefined;
  findNextNodeId: (parentId: string, choiceId?: string) => string | undefined;
}

const DialogueContext = createContext<DialogueContextType | null>(null);

export const DialogueProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const initial = useMemo<PersistState>(() => buildInitialState(), []);
  const [project, setProject] = useState<ScriptProject>(initial.project);
  const [currentCharacterId, setCurrentCharacterIdState] = useState<string>(initial.currentCharacterId);
  const [rehearsalNodeId, setRehearsalNodeIdState] = useState<string>(initial.rehearsalNodeId);

  const persist = useCallback((next: PersistState) => {
    try {
      Taro.setStorageSync(STORAGE_KEY, next);
    } catch (e) {
      // ignore quota errors
    }
  }, []);

  useEffect(() => {
    persist({ project, currentCharacterId, rehearsalNodeId });
  }, [project, currentCharacterId, rehearsalNodeId, persist]);

  const setCurrentCharacterId = useCallback((id: string) => {
    setCurrentCharacterIdState(id);
  }, []);

  const setRehearsalNodeId = useCallback((id: string) => {
    setRehearsalNodeIdState(id);
  }, []);

  const nodesList = useMemo(() => Object.values(project.nodes), [project.nodes]);

  // 所有批注（去重）
  const annotations = useMemo(() => {
    const seen = new Set<string>();
    const list: Annotation[] = [];
    Object.values(project.nodes).forEach(n => {
      (n.annotations || []).forEach(a => {
        if (!seen.has(a.id)) {
          seen.add(a.id);
          list.push(a);
        }
      });
    });
    return list;
  }, [project.nodes]);

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
    const baseId = `a-${Date.now()}`;
    const annTemplate = {
      content,
      author,
      role: 'director' as const,
      createdAt: Date.now()
    };
    setProject(p => {
      const next = { ...p, nodes: { ...p.nodes } };
      dialogueIds.forEach((did, idx) => {
        const target = next.nodes[did];
        if (!target) return;
        const ann: Annotation = {
          id: `${baseId}-${idx}`,
          dialogueId: did,
          ...annTemplate
        };
        next.nodes[did] = {
          ...target,
          annotations: [...(target.annotations || []), ann]
        };
      });
      return next;
    });
  }, []);

  const getAnnotationsByDialogue = useCallback((dialogueId: string): Annotation[] => {
    const node = project.nodes[dialogueId];
    return node?.annotations || [];
  }, [project.nodes]);

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
