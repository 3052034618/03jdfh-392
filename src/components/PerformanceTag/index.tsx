import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';
import { PerformanceType } from '@/types/dialogue';

interface Props {
  type: PerformanceType;
  label: string;
  intensity?: number;
  selectable?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

const PerformanceTag: React.FC<Props> = ({
  type,
  label,
  intensity,
  selectable = false,
  selected = false,
  onClick
}) => {
  return (
    <View
      className={classnames(
        styles.tag,
        styles[type],
        selectable && styles.selectable,
        selected && styles.selected
      )}
      onClick={selectable ? onClick : undefined}
    >
      <Text>{label}</Text>
      {typeof intensity === 'number' && (
        <Text className={styles.intensity}>·{intensity}</Text>
      )}
    </View>
  );
};

export default PerformanceTag;
