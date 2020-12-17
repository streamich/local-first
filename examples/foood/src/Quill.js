// @flow
import * as React from 'react';
import Quill from 'quill';
import deepEqual from '@birchill/json-equalish';
import { type QuillDelta } from '../../../packages/rich-text-crdt/quill-deltas';

var ListItem = Quill.import('formats/list/item');
var ListContainer = Quill.import('formats/list');
var Block = Quill.import('blots/block');
var Inline = Quill.import('blots/inline');

class IngredientListItem extends Block {}
IngredientListItem.tagName = 'li';
IngredientListItem.className = 'ingredient-list';
IngredientListItem.blotName = 'ingredient';
IngredientListItem.requiredContainer = ListContainer;
ListContainer.allowedChildren.push(IngredientListItem);

Quill.register(IngredientListItem, true);

class InstructionListItem extends Block {}
InstructionListItem.tagName = 'li';
InstructionListItem.className = 'instruction-list';
InstructionListItem.blotName = 'instruction';
InstructionListItem.requiredContainer = ListContainer;
ListContainer.allowedChildren.push(InstructionListItem);

Quill.register(InstructionListItem, true);

class Measurement extends Inline {
    static create(value) {
        const node = super.create(value);
        node.setAttribute('data-measure', JSON.stringify(value));
        node.onmouseover = () => {
            console.log('mouse', node);
        };
        return node;
    }

    static formats(domNode) {
        const raw = domNode.getAttribute('data-measure');
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    format(name, value) {
        console.log('format measurement', name, value);
        if (name !== this.statics.blotName || !value) {
            super.format(name, value);
        } else {
            this.domNode.setAttribute('data-measure', JSON.stringify(value));
        }
    }
}
Measurement.blotName = 'measurement';
Measurement.tagName = 'SPAN';
Measurement.className = 'measurement';

Quill.register(Measurement, true);

const keymap = (props: *, registry: *): * => ({
    // theme: false,
    theme: 'snow',
    // registry: registry,
    placeholder: ' ',
    modules: {
        toolbar: [
            ['bold', 'italic', 'underline', 'strike', 'link'],
            [
                { ingredient: true },
                // ok
                { list: 'bullet' },
                { instruction: true },
            ],
        ],
        // imageResize: {},
        // cursors: true,
        /* "mention": {
        "mentionDenotationChars": [|"/"|],
        "source":
          (. searchTerm: string, renderList, mentionChar: string) =>
            renderList(.
              [|
                {"id": 0, "value": "Header"},
                {"id": 1, "value": "Normal"},
                {"id": 2, "value": "Code"},
              |],
              searchTerm,
            ),
      }, */
        // return TRUE if the handler *fell through*. return FALSE if the handler succeeded, and bubbling should stop.
        keyboard: {
            bindings: {
                // collapse: {
                //     key: 'z',
                //     collapsed: true,
                //     altKey: true,
                //     handler: () => props.onToggleCollapse(),
                // },
                // 'collapse-mac': {
                //     key: `Ω`,
                //     collapsed: true,
                //     altKey: true,
                //     handler: () => props.onToggleCollapse(),
                // },
            },
        },
    },
});

const QuillEditor = ({
    value,
    onChange,
    // getStamp,
    // siteId,
    innerRef,
    actions,
    className,
}: {
    value: Array<QuillDelta>,
    innerRef?: ?(node: ?Quill) => mixed,
    onChange: ({ ops: Array<QuillDelta> }) => mixed,
    // getStamp: () => string,
    // siteId: string,
    actions: *,
    className?: string,
}) => {
    const ref = React.useRef(null);
    const ui = React.useRef(null);

    const valueRef = React.useRef(value);
    if (ui.current && value !== valueRef.current) {
        const quill = ui.current;
        // const newContents = stateToQuillContents(value);
        const currentContents = quill.getContents().ops;
        if (!deepEqual(value, currentContents)) {
            console.log('new contents', value, currentContents);
            // const sel = quill.getSelection();
            // const pos = sel ? quillToTreePos(valueRef.current, sel) : null;
            quill.setContents(value, 'remote');
            // if (pos) {
            //     quill.setSelection(treeToQuillPos(value, pos));
            // }
        }
    }
    valueRef.current = value;

    React.useEffect(() => {
        // console.log(ref);
        const quill = (ui.current = new Quill(ref.current, keymap(actions)));
        if (innerRef) {
            innerRef(quill);
        }
        quill.setContents(value);
        // TODO: this focuses the editor automatically, which I don't want :/
        // I just want to prefill the selection to here, so that when it's "focus()"ed,
        // it doesn't select at the start. Might need to hack on quill to fix.
        // quill.setSelection(quill.getLength(), 0);

        quill.on('text-change', (delta: { ops: Array<QuillDelta> }, _oldDelta, source: string) => {
            if (source === 'remote') {
                return;
            }

            onChange(quill.getContents());
        });
        if (innerRef) {
            return () => {
                innerRef(null);
            };
        }
    }, []);

    return <div className={(className || '') + ' ql-container ql-bubble'} ref={ref} />;
};

export default QuillEditor;