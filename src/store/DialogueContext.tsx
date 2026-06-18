import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import { ScriptProject, DialogueNode, Annotation, PerformanceHint, BranchChoice } from '@/types/dialogue';
import { mockScriptProject, mockAnnotations } from '@/data/mockScript';

interface DialogueContextType {
  project: ScriptProject;
  currentCharacterId: string;
  setCurrentCharacterId: (id: string) => void;
  nodesList: DialogueNode[];
  updateNodePerformance: (nodeId: string, perf: PerformanceHint) => void;
  updateNodeText: (nodeId: string, text: string) => void;
  updateNodeChoices: (nodeId: string, choices: BranchChoice[]) => void;
  setNextNode: (nodeId: string, nextId: string) => void;
  addNode: (parentId: string, node: DialogueNode, asChoice?: { text: string }) => void;
  toggleRecorded: (nodeId: string) => void;
  annotations: Annotation[];
  addAnnotation: (dialogueId: string, content: string, author: string) => void;
  getAnnotationsByDialogue: (dialogueId: string) => Annotation[];
  rehearsalNodeId: string;
  setRehearsalNodeId: (id: string) => void;
}

const DialogueContext = createContext<DialogueContextType | null>(null);

export const DialogueProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [project, setProject] = useState<ScriptProject>(() => {
    const nodes = { ...mockScriptProject.nodes };
    // 注入预存 annotations
    mockAnnotations.forEach(a => {
      if (nodes[a.dialogueId]) {
        nodes[a.dialogueId] = {
          ...nodes[a.dialogueId],
          annotations: [...(nodes[a.dialogueId].annotations || []), a]
        };
      }
    });
    return { ...mockScriptProject, nodes };
  });

  const [currentCharacterId, setCurrentCharacterId] = useState<string>(
    mockScriptProject.characters[0].id
  );
  const [rehearsalNodeId, setRehearsalNodeId] = useState<string>(
    mockScriptProject.startNodeId
  );
  const [extraAnnotations, setExtraAnnotations] = useState<Annotation[]>([]);

  const nodesList = useMemo(() => Object.values(project.nodes), [project.nodes]);

  const updateNodePerformance = (nodeId: string, perf: PerformanceHint) => {
    setProject(p => ({
      ...p,
      nodes: { ...p.nodes, [nodeId]: { ...p.nodes[nodeId], performance: perf } }
    }));
  };

  const updateNodeText = (nodeId: string, text: string) => {
    setProject(p => ({
      ...p,
      nodes: { ...p.nodes, [nodeId]: { ...p.nodes[nodeId], text } }
    }));
  };

  const updateNodeChoices = (nodeId: string, choices: BranchChoice[]) => {
    setProject(p => ({
      ...p,
      nodes: { ...p.nodes, [nodeId]: { ...p.nodes[nodeId], choices } }
    }));
  };

  const setNextNode = (nodeId: string, nextId: string) => {
    setProject(p => ({
      ...p,
      nodes: { ...p.nodes, [nodeId]: { ...p.nodes[nodeId], nextNodeId: nextId } }
    }));
  };

  const addNode = (parentId: string, node: DialogueNode, asChoice?: { text: string }) => {
    setProject(p => {
      const parent = p.nodes[parentId];
      const newNodes = { ...p.nodes, [node.id]: node };
      if (parent) {
        if (asChoice) {
          const newChoice: BranchChoice = {
            id: `ch-${Date.now()}`,
            text: asChoice.text,
            nextNodeId: node.id
          };
          newNodes[parentId] = {
            ...parent,
            choices: [...(parent.choices || []), newChoice]
          };
        } else {
          newNodes[parentId] = { ...parent, nextNodeId: node.id };
        }
      }
      return { ...p, nodes: newNodes };
    });
  };

  const toggleRecorded = (nodeId: string) => {
    setProject(p => ({
      ...p,
      nodes: {
        ...p.nodes,
        [nodeId]: { ...p.nodes[nodeId], recorded: !p.nodes[nodeId].recorded }
      }
    }));
  };

  const addAnnotation = (dialogueId: string, content: string, author: string) => {
    const ann: Annotation = {
      id: `a-${Date.now()}`,
      dialogueId,
      content,
      author,
      role: 'director',
      createdAt: Date.now()
    };
    setExtraAnnotations(list => [...list, ann]);
    setProject(p => {
      const target = p.nodes[dialogueId];
      if (!target) return p;
      return {
        ...p,
        nodes: {
          ...p.nodes,
          [dialogueId]: {
            ...target,
            annotations: [...(target.annotations || []), ann]
          }
        }
      };
    });
  };

  const getAnnotationsByDialogue = (dialogueId: string): Annotation[] => {
    const node = project.nodes[dialogueId];
    return node?.annotations || [];
  };

  const annotations = useMemo(() => {
    const fromNodes = Object.values(project.nodes).flatMap(n => n.annotations || []);
    return [...fromNodes, ...extraAnnotations];
  }, [project.nodes, extraAnnotations]);

  const value: DialogueContextType = {
    project,
    currentCharacterId,
    setCurrentCharacterId,
    nodesList,
    updateNodePerformance,
    updateNodeText,
    updateNodeChoices,
    setNextNode,
    addNode,
    toggleRecorded,
    annotations,
    addAnnotation,
    getAnnotationsByDialogue,
    rehearsalNodeId,
    setRehearsalNodeId
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
