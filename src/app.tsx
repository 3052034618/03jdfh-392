import React, { useEffect } from 'react';
import { useDidShow, useDidHide } from '@tarojs/taro';
import { DialogueProvider } from './store/DialogueContext';
import './app.scss';

function App(props) {
  useEffect(() => {});
  useDidShow(() => {});
  useDidHide(() => {});

  return <DialogueProvider>{props.children}</DialogueProvider>;
}

export default App;
