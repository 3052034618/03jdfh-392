import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import styles from './index.module.scss';

interface Props {
  onComplete?: (duration: number) => void;
  hintText?: string;
}

const BAR_COUNT = 18;

const Recorder: React.FC<Props> = ({ onComplete, hintText }) => {
  const [status, setStatus] = useState<'idle' | 'recording' | 'done'>('idle');
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);
  const [barHeights, setBarHeights] = useState<number[]>(() =>
    new Array(BAR_COUNT).fill(16)
  );

  useEffect(() => {
    let rafId: number | null = null;
    if (status === 'recording') {
      const animate = () => {
        setBarHeights(
          new Array(BAR_COUNT).fill(0).map(() => 16 + Math.random() * 64)
        );
        rafId = requestAnimationFrame(animate);
      };
      rafId = requestAnimationFrame(animate);
    } else {
      setBarHeights(new Array(BAR_COUNT).fill(16));
    }
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [status]);

  useEffect(() => {
    if (status === 'recording') {
      timerRef.current = window.setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleStart = () => {
    Taro.vibrateShort && Taro.vibrateShort({ type: 'light' });
    setStatus('recording');
    setSeconds(0);
  };

  const handleStop = () => {
    Taro.vibrateShort && Taro.vibrateShort({ type: 'medium' });
    setStatus('done');
  };

  const handleConfirm = () => {
    onComplete?.(seconds);
    setStatus('idle');
    setSeconds(0);
  };

  const handleRetry = () => {
    setStatus('idle');
    setSeconds(0);
  };

  return (
    <View className={styles.wrapper}>
      <Text className={styles.statusText}>
        {status === 'idle' && '🎙️ 准备就绪，点击下方开始录制'}
        {status === 'recording' && '🔴 正在录音...'}
        {status === 'done' && `✅ 录制完成（${formatTime(seconds)}）`}
      </Text>

      <Text
        className={classnames(styles.timer, status === 'recording' && styles.danger)}
      >
        {formatTime(seconds)}
      </Text>

      <View className={styles.visualizer}>
        {barHeights.map((h, i) => (
          <View
            key={i}
            className={styles.bar}
            style={{ height: `${h}rpx`, opacity: 0.4 + (h / 80) * 0.6 }}
          />
        ))}
      </View>

      <View className={styles.buttonRow}>
        {status === 'idle' && (
          <Button className={styles.mainBtn} onClick={handleStart}>
            <View className={styles.innerCircle} />
            <Text>开始录音</Text>
          </Button>
        )}

        {status === 'recording' && (
          <Button className={styles.mainBtn} onClick={handleStop}>
            <View className={classnames(styles.innerCircle, styles.recording)} />
            <Text>停止</Text>
          </Button>
        )}

        {status === 'done' && (
          <>
            <Button className={styles.subBtn} onClick={handleRetry}>🔄 重录</Button>
            <Button className={classnames(styles.subBtn, styles.primary)} onClick={handleConfirm}>
              ✅ 确认保存
            </Button>
          </>
        )}
      </View>

      {hintText && status !== 'done' && (
        <View className={styles.tips}>
          <Text className={styles.tipsTitle}>💡 表演提示</Text>
          <Text className={styles.tipsText}>{hintText}</Text>
        </View>
      )}
    </View>
  );
};

export default Recorder;
