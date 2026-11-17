import { NotesPane } from './components/NotesPane';
import { Stage } from './components/Stage';
import { ThumbnailList } from './components/ThumbnailList';
import { Toolbar } from './components/Toolbar';
import { useKeyboard } from './hooks/useKeyboard';
import { useUnsavedGuard } from './hooks/useUnsavedGuard';

export default function App() {
  useKeyboard();
  useUnsavedGuard();
  return (
    <div className="app">
      <Toolbar />
      <ThumbnailList />
      <div className="main-column">
        <Stage />
        <NotesPane />
      </div>
    </div>
  );
}
