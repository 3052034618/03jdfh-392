export type PerformanceType = 
  | 'normal'    // 假装正常
  | 'whisper'   // 压低声音
  | 'close'     // 突然亲近
  | 'mimic'     // 像在模仿别人
  | 'scream'    // 尖叫爆发
  | 'pause';    // 停顿

export interface PerformanceHint {
  type: PerformanceType;
  label: string;
  intensity: number; // 1-10 情绪强度
}

export interface BranchChoice {
  id: string;
  text: string;
  nextNodeId: string;
}

export interface Annotation {
  id: string;
  dialogueIds: string[];      // 支持关联多句台词
  content: string;
  author: string;
  role: string;
  createdAt: number;
}

export interface DialogueNode {
  id: string;
  role: string;
  character: string;
  text: string;
  performance: PerformanceHint;
  choices?: BranchChoice[];
  nextNodeId?: string;
  annotations?: Annotation[];
  recorded?: boolean;
  duration?: number;
  lastRecordedAt?: number;
}

export interface Character {
  id: string;
  name: string;
  voiceType: string;
  color: string;
}

export interface ScriptProject {
  id: string;
  title: string;
  game: string;
  scene: string;
  characters: Character[];
  nodes: Record<string, DialogueNode>;
  startNodeId: string;
}

export interface EmotionPoint {
  index: number;
  value: number;
  label: string;
  type: PerformanceType;
}

// 排练轨迹：演员从开头走到结尾的一次完整记录
export interface RehearsalTrack {
  id: string;
  title: string;
  startedAt: number;
  endedAt: number;
  actorName: string;
  // 按顺序经过的节点 ID
  pathNodeIds: string[];
  // 做出的分支选择 { nodeId: choiceId }
  choices: Record<string, string>;
  // 录制完成的节点 ID 列表
  recordedNodeIds: string[];
  // 本次路径的情绪曲线快照
  emotionCurve: EmotionPoint[];
  // 备注
  note?: string;
}

// 树状总览节点
export interface TreeNode {
  id: string;
  node: DialogueNode;
  level: number;
  children: TreeNode[];
  hasBrokenLink: boolean;  // 断链（nextNodeId/choice.nextNodeId 指向不存在的节点）
  isEnd: boolean;          // 路径终点
  isConfluence: boolean;   // 汇合节点（有多个父节点指向它）
  parentCount: number;     // 父节点数量
  isOrphan: boolean;       // 孤立节点（不在主树上，没有父节点）
  brokenTargets: string[]; // 具体哪些指向是断的
}

export interface PersistState {
  project: ScriptProject;
  currentCharacterId: string;
  rehearsalNodeId: string;
  rehearsalTracks: RehearsalTrack[];
  annotations: Annotation[];   // 全局批注列表（去重存储）
}
