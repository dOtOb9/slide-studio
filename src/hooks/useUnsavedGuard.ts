import { useEffect } from 'react';
import { isDirty } from '../app/model';
import { getModel, useModel } from '../app/store';

export function useUnsavedGuard() {
  const fileName = useModel((m) => m.fileName);
  const dirty = useModel(isDirty);

  useEffect(() => {
    document.title = `${dirty ? '● ' : ''}${fileName} - Slide Studio`;
  }, [fileName, dirty]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty(getModel())) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);
}
