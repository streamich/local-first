// @flow

const atLeft = (quill) => {
    const sel = quill.getSelection();
    if (!sel) return false;
    return sel.index === 0 && sel.length === 0;
};

const atRight = (quill) => {
    const sel = quill.getSelection();
    if (!sel) return false;
    console.log(sel.index, quill.getLength());
    return sel.length === 0 && sel.index === quill.getLength() - 1;
};

const atTop = (quill) => {
    const sel = quill.getSelection();
    if (!sel) return;
    return sel.length === 0 && quill.getBounds(sel.index).top === quill.getBounds(0).top;
};

const atBottom = (quill) => {
    const sel = quill.getSelection();
    if (!sel) return;
    return (
        sel.length === 0 &&
        quill.getBounds(sel.index).top === quill.getBounds(quill.getLength()).top
    );
};

const map = (props: *, registry: *): * => ({
    theme: false,
    // registry: registry,
    placeholder: ' ',
    modules: {
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
        keyboard: {
            bindings: {
                collapse: {
                    key: 'z',
                    collapsed: true,
                    altKey: true,
                    handler: () => props.onToggleCollapse(),
                },
                'collapse-mac': {
                    key: `Ω`,
                    collapsed: true,
                    altKey: true,
                    handler: () => props.onToggleCollapse(),
                },
                'left-at-start': {
                    key: 'ArrowLeft',
                    handler() {
                        return !(atLeft(this.quill) && props.onLeft() != null);
                    },
                },
                backspace: {
                    key: 8,
                    collapsed: true,
                    handler() {
                        if (atLeft(this.quill)) {
                            if (this.quill.getLength() == 1) {
                                return props.onBackspace(null) == null;
                            } else {
                                return props.onBackspace(this.quill.getContents()) == null;
                            }
                        } else {
                            return true;
                        }
                    },
                },
                'move-right': {
                    key: 'ArrowRight',
                    collapsed: true,
                    handler() {
                        return !(atRight(this.quill) && props.onRight() != null);
                    },
                },
                'j-down-mac': {
                    key: `∆`,
                    collapsed: true,
                    altKey: true,
                    handler: (evt) => {
                        props.onDown();
                        return false;
                    },
                },
                'j-down': {
                    key: 'j',
                    collapsed: true,
                    altKey: true,
                    handler: () => !(props.onDown() != null),
                },
                'k-up-mac': {
                    key: `˚`,
                    collapsed: true,
                    altKey: true,
                    handler: () => !(props.onUp() != null),
                },
                'k-up': {
                    key: 'k',
                    collapsed: true,
                    altKey: true,
                    handler: () => !(props.onUp() != null),
                },
                'escape-select': {
                    key: 27,
                    collapsed: false,
                    handler() {
                        let selection = this.quill.getSelection;
                        if (!selection) return;
                        this.quill.setSelection(selection.index + selection.length, 0, 'user');
                        return false;
                    },
                },
                'go-up': {
                    key: 38,
                    collapsed: true,
                    handler() {
                        return !(atTop(this.quill) && props.onUp() != null);
                    },
                },
                'go-down': {
                    key: 40,
                    collapsed: true,
                    handler() {
                        return !(atBottom(this.quill) && props.onDown() != null);
                    },
                },
                'create-child': {
                    key: 'o',
                    shortKey: true,
                    collapsed: true,
                    handler: () => {
                        props.onCreateChild();
                        return false;
                    },
                },
                'create-aunt': {
                    key: 'o',
                    shiftKey: true,
                    shortKey: true,
                    collapsed: true,
                    handler: () => {
                        props.onCreateAunt();
                        return false;
                    },
                },
                'shift-enter': {
                    key: 'Enter',
                    shortKey: true,
                    collapsed: true,
                    handler: () => {
                        props.onShortEnter();
                        return false;
                    },
                },
                enter: {
                    key: 'Enter',
                    collapsed: true,
                    handler: () => {
                        props.onEnter();
                        return false;
                    },
                },
            },
        },
    },
});

export default map;
