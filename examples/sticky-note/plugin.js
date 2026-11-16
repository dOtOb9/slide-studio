// 外部プラグインの例「付箋」。
// Slide Studio の「🧩 プラグイン → ファイルから読み込む…」でこのファイルを選ぶと、ツールバーに「🗒 付箋」が増える。
//
// 外部プラグインの書き方:
//   - 1ファイルの ES モジュールにし、ほかのファイルを import しない。
//   - アプリの API は引数（api）で受け取る。default export は「api を受け取って Plugin を返す関数」。
//   - ビルドは要らない（素の JavaScript）。React も使わない（ツールバーの部品は DOM を直接作る）。
// API の一覧は Slide Studio の src/plugin-api/index.ts と README「プラグイン」を参照。

const NAME = 'sticky-note';
const COLORS = ['#fff3a0', '#ffd6e0', '#c9f2d0', '#cfe3ff'];

export default function stickyNote(api) {
  return {
    name: NAME,
    apiVersion: '1.0',
    title: '付箋',
    description: '色付きの付箋を貼る（外部プラグインの例）',

    // Msg は "sticky-note/出来事"。update は (Model, Msg) → Model の純粋関数
    update(model, msg) {
      switch (msg.type) {
        case 'sticky-note/Inserted': {
          const slide = api.currentSlide(model);
          if (!slide || api.isBusy(model)) return model;

          // プラグイン自身の状態（model.plugins['sticky-note']）に、貼った枚数を覚えておく。
          // 色を順に変え、少しずつずらして重ならないようにするため
          const count = api.getPluginState(model, NAME)?.count ?? 0;
          const offset = (count % 5) * 40;

          const { result: element, nextId } = api.withNewIds(model, (newId) => ({
            id: newId(),
            tag: 'div',
            attrs: { 'data-sticky': '' },
            style: `background:${COLORS[count % COLORS.length]}; padding:24px; font-size:32px; box-shadow:0 4px 12px rgba(0,0,0,.2)`,
            html: 'メモ',
            rect: { x: 80 + offset, y: 80 + offset, w: 360, h: 240 },
          }));
          // edit() で Deck を変えると、元に戻すの履歴に1件積まれる
          const next = api.edit(model, api.insertElement(model.deck, slide.id, element));
          return api.setPluginState({ ...next, nextId, selectedId: element.id }, NAME, { count: count + 1 });
        }
        default:
          return model;
      }
    },

    // ツールバーの部品: container の中に DOM を作り、片付ける関数を返す
    toolbar: {
      mount(container, ctx) {
        const button = document.createElement('button');
        button.className = 'button'; // アプリのボタンと同じ見た目にする
        button.textContent = '🗒 付箋';
        button.title = '付箋を貼る';
        button.onclick = () => ctx.dispatch({ type: 'sticky-note/Inserted' });

        // Model が変わるたびに、スライドが無ければ押せないようにする
        const refresh = () => {
          button.disabled = ctx.getModel().deck.slides.length === 0;
        };
        refresh();
        const unsubscribe = ctx.subscribe(refresh);

        container.append(button);
        return () => {
          unsubscribe();
          button.remove();
        };
      },
    },
  };
}
