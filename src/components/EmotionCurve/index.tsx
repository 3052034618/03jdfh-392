import React, { useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import styles from './index.module.scss';
import { EmotionPoint } from '@/types/dialogue';
import { getEmotionColor, buildSvgPath } from '@/utils/emotion';

interface Props {
  points: EmotionPoint[];
  currentIndex?: number;
  title?: string;
  highlightReason?: string;
}

const SVG_W = 600;
const SVG_H = 240;
const PADDING = { top: 20, bottom: 40, left: 40, right: 20 };

const EmotionCurve: React.FC<Props> = ({
  points,
  currentIndex = -1,
  title = '分支情绪曲线',
  highlightReason
}) => {
  const chartData = useMemo(() => {
    const pathD = buildSvgPath(points, SVG_W, SVG_H, PADDING);
    const chartW = SVG_W - PADDING.left - PADDING.right;
    const chartH = SVG_H - PADDING.top - PADDING.bottom;
    const stepX = points.length > 1 ? chartW / (points.length - 1) : 0;
    const toX = (i: number) => PADDING.left + stepX * i;
    const toY = (v: number) => PADDING.top + chartH - (v / 10) * chartH;

    return { pathD, toX, toY, chartW, chartH };
  }, [points]);

  if (points.length === 0) {
    return (
      <View className={styles.wrapper}>
        <Text className={styles.title}>暂无数据</Text>
      </View>
    );
  }

  return (
    <View className={styles.wrapper}>
      <View className={styles.header}>
        <Text className={styles.title}>{title}</Text>
        <View className={styles.legend}>
          <View className={styles.legendItem}>
            <View className={styles.legendDot} style={{ background: '#2FD4A6' }}></View>
            <Text>低张力</Text>
          </View>
          <View className={styles.legendItem}>
            <View className={styles.legendDot} style={{ background: '#FF3B5C' }}></View>
            <Text>高张力</Text>
          </View>
        </View>
      </View>

      <View className={styles.chartBox}>
        <svg className={styles.svg} viewBox={`0 0 ${SVG_W} ${SVG_H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2FD4A6" />
              <stop offset="40%" stopColor="#9D6BFF" />
              <stop offset="100%" stopColor="#FF3B5C" />
            </linearGradient>
          </defs>

          {/* Y 轴 */}
          <line className={styles.axis} x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={SVG_H - PADDING.bottom} />
          {/* X 轴 */}
          <line className={styles.axis} x1={PADDING.left} y1={SVG_H - PADDING.bottom} x2={SVG_W - PADDING.right} y2={SVG_H - PADDING.bottom} />

          {/* 网格线 + Y 轴标签 */}
          {[0, 2.5, 5, 7.5, 10].map(v => {
            const y = PADDING.top + chartData.chartH - (v / 10) * chartData.chartH;
            return (
              <g key={`grid-${v}`}>
                <line
                  className={styles.gridLine}
                  x1={PADDING.left}
                  y1={y}
                  x2={SVG_W - PADDING.right}
                  y2={y}
                />
                <text className={styles.axisLabel} x={PADDING.left - 8} y={y}>
                  {v}
                </text>
              </g>
            );
          })}

          {/* 当前位置标记线 */}
          {currentIndex >= 0 && (
            <line
              className={styles.currentMarker}
              x1={chartData.toX(currentIndex)}
              y1={PADDING.top}
              x2={chartData.toX(currentIndex)}
              y2={SVG_H - PADDING.bottom}
            />
          )}

          {/* 贝塞尔曲线路径 */}
          <path className={styles.curvePath} d={chartData.pathD} />

          {/* 节点 */}
          {points.map((p, i) => {
            const cx = chartData.toX(i);
            const cy = chartData.toY(p.value);
            const color = getEmotionColor(p.type);
            const isActive = i === currentIndex;
            return (
              <g key={p.index}>
                <circle
                  className={`${styles.point} ${isActive ? styles.active : ''}`}
                  cx={cx}
                  cy={cy}
                  r={isActive ? 9 : 6}
                  fill={color}
                  style={{ color }}
                />
                <text
                  className={styles.xLabel}
                  x={cx}
                  y={SVG_H - PADDING.bottom + 10}
                >
                  {`第${i + 1}句`}
                </text>
              </g>
            );
          })}
        </svg>
      </View>

      {highlightReason && (
        <View className={styles.highlightInfo}>
          <Text className={styles.highlightTitle}>🎭 导演点评</Text>
          <Text className={styles.highlightText}>{highlightReason}</Text>
        </View>
      )}
    </View>
  );
};

export default EmotionCurve;
