// 外部プラグインの例「付箋」。
// Slide Studio のツールバーのパズルのアイコン（プラグイン）→「ファイルから読み込む」でこのファイルを選ぶと、ツールバーに付箋のボタンが増える。
//
// 外部プラグインの書き方:
//   - 1ファイルの ES モジュールにし、ほかのファイルを import しない。
//   - アプリの API は引数（api）で受け取る。default export は「api を受け取って Plugin を返す関数」。
//   - ビルドは要らない（素の JavaScript）。React も使わない（ツールバーの部品は DOM を直接作る）。
// API の一覧は Slide Studio の src/plugin-api/index.ts と README「プラグイン」を参照。

const NAME = 'sticky-note';
const COLORS = ['#fff3a0', '#ffd6e0', '#c9f2d0', '#cfe3ff'];

// ボタンのアイコン（SVG）。アプリと同じ見た目にするため、アプリが使っている lucide のアイコン（ISC ライセンス）の形を写した。
// stroke="currentColor" にしておくと、ボタンの文字色（通常・hover・無効）に合わせて色が変わる
const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"/>' +
  '<path d="M15 3v5a1 1 0 0 0 1 1h5"/></svg>';

export default function stickyNote(api) {
  return {
    name: NAME,
    apiVersion: '1.1', // .icon-button（1.1 で足した共通クラス）を使う
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
        // アプリと同じ見た目にする共通クラス（README「プラグイン」）。アイコンだけのボタンなので、
        // 説明はツールチップ（title）と読み上げ用（aria-label）に書く
        button.className = 'icon-button';
        button.innerHTML = ICON;
        button.title = '付箋を貼る';
        button.setAttribute('aria-label', '付箋を貼る');
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
