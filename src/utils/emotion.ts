import { EmotionPoint, PerformanceType, DialogueNode } from '@/types/dialogue';

export const getEmotionColor = (type: PerformanceType): string => {
  const map: Record<PerformanceType, string> = {
    normal: '#2FD4A6',
    whisper: '#3BA7FF',
    close: '#FFC857',
    mimic: '#C874FF',
    scream: '#FF3B5C',
    pause: '#FFC857'
  };
  return map[type] || '#9E9EB0';
};

export const getEmotionLabel = (type: PerformanceType): string => {
  const map: Record<PerformanceType, string> = {
    normal: '正常',
    whisper: '低语',
    close: '亲近',
    mimic: '模仿',
    scream: '爆发',
    pause: '停顿'
  };
  return map[type] || '未知';
};

// 获取一条路径上的情绪曲线点
export const buildEmotionCurve = (path: DialogueNode[]): EmotionPoint[] => {
  return path.map((node, idx) => ({
    index: idx,
    value: node.performance.intensity,
    label: node.performance.label,
    type: node.performance.type
  }));
};

// 根据起点和分支选择，递归收集一条完整路径
export const collectPath = (
  nodesMap: Record<string, DialogueNode>,
  startId: string,
  choiceMap: Record<string, string> = {}
): DialogueNode[] => {
  const result: DialogueNode[] = [];
  let currentId: string | undefined = startId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const node = nodesMap[currentId];
    if (!node) break;
    result.push(node);

    if (node.choices && node.choices.length > 0) {
      const chosenNext = choiceMap[node.id];
      if (chosenNext) {
        currentId = chosenNext;
      } else {
        currentId = node.choices[0].nextNodeId;
      }
    } else {
      currentId = node.nextNodeId;
    }
  }
  return result;
};

// 获取SVG路径字符串（用于情绪曲线图）
export const buildSvgPath = (
  points: EmotionPoint[],
  width: number,
  height: number,
  padding: { top: number; bottom: number; left: number; right: number }
): string => {
  if (points.length === 0) return '';
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const stepX = points.length > 1 ? chartW / (points.length - 1) : 0;

  const toX = (i: number) => padding.left + stepX * i;
  const toY = (v: number) => padding.top + chartH - (v / 10) * chartH;

  if (points.length === 1) {
    const x = toX(0);
    const y = toY(points[0].value);
    return `M ${x - 10} ${y} L ${x + 10} ${y}`;
  }

  let d = `M ${toX(0)} ${toY(points[0].value)}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const x0 = toX(i - 1);
    const y0 = toY(prev.value);
    const x1 = toX(i);
    const y1 = toY(cur.value);
    const cx = (x0 + x1) / 2;
    d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  }
  return d;
};

// 格式化时间戳
export const formatTime = (ts: number): string => {
  const date = new Date(ts);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
};

// 格式化录制时长（秒 → mm:ss）
export const formatDuration = (seconds: number): string => {
  if (!seconds || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// 格式化相对时间（多久之前）
export const formatRelative = (ts: number): string => {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`;
  return formatTime(ts);
};
