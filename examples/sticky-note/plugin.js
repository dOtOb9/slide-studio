const NAME = 'sticky-note';
const COLORS = ['#fff3a0', '#ffd6e0', '#c9f2d0', '#cfe3ff'];

const LUCIDE_STICKY_NOTE_ICON_USING_CURRENT_COLOR =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"/>' +
  '<path d="M15 3v5a1 1 0 0 0 1 1h5"/></svg>';

const API_WITH_SHARED_ICON_BUTTON_CLASS = '1.1';

export default function stickyNote(api) {
  return {
    name: NAME,
    apiVersion: API_WITH_SHARED_ICON_BUTTON_CLASS,
    title: '付箋',
    description: '色付きの付箋を貼る（外部プラグインの例）',

    update(model, msg) {
      switch (msg.type) {
        case 'sticky-note/Inserted': {
          const slide = api.currentSlide(model);
          if (!slide || api.isBusy(model)) return model;

          const notesPostedSoFar = api.getPluginState(model, NAME)?.count ?? 0;
          const offsetSoNotesDoNotOverlap = (notesPostedSoFar % 5) * 40;

          const { result: element, nextId } = api.withNewIds(model, (newId) => ({
            id: newId(),
            tag: 'div',
            attrs: { 'data-sticky': '' },
            style: `background:${COLORS[notesPostedSoFar % COLORS.length]}; padding:24px; font-size:32px; box-shadow:0 4px 12px rgba(0,0,0,.2)`,
            html: 'メモ',
            rect: { x: 80 + offsetSoNotesDoNotOverlap, y: 80 + offsetSoNotesDoNotOverlap, w: 360, h: 240 },
          }));
          const next = api.edit(model, api.insertElement(model.deck, slide.id, element));
          return api.setPluginState({ ...next, nextId, selectedId: element.id }, NAME, { count: notesPostedSoFar + 1 });
        }
        default:
          return model;
      }
    },

    toolbar: {
      mount(container, ctx) {
        const button = document.createElement('button');
        button.className = 'icon-button';
        button.innerHTML = LUCIDE_STICKY_NOTE_ICON_USING_CURRENT_COLOR;
        button.title = '付箋を貼る';
        button.setAttribute('aria-label', '付箋を貼る');
        button.onclick = () => ctx.dispatch({ type: 'sticky-note/Inserted' });

        const disableWhenDeckHasNoSlides = () => {
          button.disabled = ctx.getModel().deck.slides.length === 0;
        };
        disableWhenDeckHasNoSlides();
        const unsubscribe = ctx.subscribe(disableWhenDeckHasNoSlides);

        container.append(button);
        return () => {
          unsubscribe();
          button.remove();
        };
      },
    },
  };
}
