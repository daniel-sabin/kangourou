import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'

const setMark = StateEffect.define<number | null>()
const mark = Decoration.mark({ class: 'cm-error-mark' })

const field = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const e of tr.effects) {
      if (!e.is(setMark)) continue
      if (e.value === null) return Decoration.none
      const doc = tr.state.doc
      const from = Math.min(Math.max(e.value, 0), doc.length)
      const word = /^[^\s,;()]+/.exec(doc.sliceString(from, Math.min(from + 200, doc.length)))
      const to = Math.min(from + Math.max(word?.[0].length ?? 1, 1), doc.length)
      return to > from ? Decoration.set([mark.range(from, to)]) : Decoration.none
    }
    if (tr.docChanged) return Decoration.none
    return deco
  },
  provide: (f) => EditorView.decorations.from(f),
})

export const errorMarkExtension = field

export function setErrorMark(view: EditorView, from: number | null) {
  view.dispatch({ effects: setMark.of(from) })
}
