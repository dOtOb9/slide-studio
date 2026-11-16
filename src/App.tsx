// 画面全体の配置だけを決める。
// 状態は app/store（Model）に、操作の意味は app/update に、各部分の描画は components/ にある。

import { Stage } from './components/Stage';
import { ThumbnailList } from './components/ThumbnailList';
import { Toolbar } from './components/Toolbar';
import { useKeyboard } from './hooks/useKeyboard';

export default function App() {
  useKeyboard();
  return (
    <div className="app">
      <Toolbar />
      <ThumbnailList />
      <Stage />
    </div>
  );
}
