import { useEffect } from 'react';
import { PlanView } from './plan/PlanView';
import { useStore } from './store';
import { Scene3D } from './three/Scene3D';
import { Inspector } from './ui/Inspector';
import { DrawingsModal, HelpModal, Toast } from './ui/Modals';
import { Catalog, Outliner } from './ui/Sidebar';
import { TopBar } from './ui/TopBar';

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const st = useStore.getState();
      if (st.drawings || st.helpOpen) {
        if (e.key === 'Escape') st.set({ drawings: null, helpOpen: false });
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      const id = st.selectedId;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (id) st.duplicateItem(id);
        return;
      }
      if (mod) return;
      // the draw tool takes digits / Enter / Backspace / Esc for itself
      if (st.planTool === 'draw' && /^([0-9.]|Enter|Backspace|Escape)$/.test(e.key)) return;
      const step = (st.grid || 10) * (e.shiftKey ? 10 : 1);
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          if (id) {
            e.preventDefault();
            st.deleteItem(id);
          }
          break;
        case 'Escape':
          if (st.planTool !== 'select') st.set({ planTool: 'select' });
          else st.select(null);
          break;
        case 'r':
        case 'R':
          if (id) st.rotateBy(id, e.shiftKey ? -90 : 90);
          break;
        case 'q':
          if (id) st.rotateBy(id, -15);
          break;
        case 'e':
          if (id) st.rotateBy(id, 15);
          break;
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown':
          if (!id) break;
          e.preventDefault();
          st.nudge(id, e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0);
          break;
        case 'v':
          st.set({ planTool: 'select' });
          break;
        case 'w':
          st.set({ planTool: 'walls', view: st.view === '3d' ? 'split' : st.view });
          break;
        case 'd':
          st.set({ planTool: 'draw', view: st.view === '3d' ? 'split' : st.view });
          break;
        case 'f':
          st.set({ fitNonce: st.fitNonce + 1 });
          break;
        case '?':
          st.set({ helpOpen: true });
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function App() {
  const view = useStore((s) => s.view);
  useShortcuts();
  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <aside className="left">
          <Catalog />
          <Outliner />
        </aside>
        <section className={`views view-${view}`}>
          {view !== '3d' && (
            <div className="pane">
              <PlanView />
            </div>
          )}
          {view !== 'plan' && (
            <div className="pane">
              <Scene3D />
            </div>
          )}
        </section>
        <aside className="right">
          <Inspector />
        </aside>
      </div>
      <DrawingsModal />
      <HelpModal />
      <Toast />
    </div>
  );
}
