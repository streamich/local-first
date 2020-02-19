// @flow
import type { Node, CRDT, Spans } from './types';
import { toKey, length } from './utils';

// Ok I actually need a better plan
// char-space -> crdt-space
// and back.
// 'abc'
// we need to select an "anchoring"
// certainly the 'start' of a selection anchors right
// and the 'end' anchors left.
// dunno what a good default is for the cursor when
// not selecting, but that can be decided.

/*

| a | b | c | d | e |
0   1   2   3   4   5

yeah just 1 or 0 for the side, true or false.

0(left) is [0:root,1]
0(right) is [1:a, 0]
1(left) is [1:a, 1]
1(right) is [2:a, 0]

*/

const posToPreLocForNode = (node, pos) => {
    if (pos === 1) {
        return node.id;
    }
    if (pos > node.size) {
        throw new Error(`pos ${pos} not in node ${toKey(node.id)}`);
    }
    if (!node.deleted) {
        if (pos <= node.text.length) {
            return [node.id[0] + pos - 1, node.id[1]];
        }
        pos -= node.text.length;
    }
    for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (pos <= child.size) {
            return posToPreLocForNode(child, pos);
        }
        pos -= child.size;
    }
    throw new Error(
        `Node size caches must have been miscalculated! Pos ${pos} not found in node ${toKey(
            node.id,
        )}, even though node's size is ${node.size}`,
    );
};

// This represents the loc that is before the pos...
const posToPreLoc = (crdt, pos) => {
    if (pos === 0) {
        return [0, 'root'];
    }
    for (let i = 0; i < crdt.roots.length; i++) {
        if (pos <= crdt.roots[i].size) {
            return posToPreLocForNode(crdt.roots[i], pos);
        }
        pos -= crdt.roots[i].size;
    }
    throw new Error(`Pos ${pos} is outside the bounds`);
};

const posToPostLocForNode = (node, pos) => {
    if (pos === 0) {
        return node.id;
    }
    if (pos >= node.size) {
        throw new Error(`post pos ${pos} not in node ${toKey(node.id)}`);
    }
    if (!node.deleted) {
        if (pos < node.text.length) {
            return [node.id[0] + pos, node.id[1]];
        }
        pos -= node.text.length;
    }
    for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (pos < child.size) {
            return posToPostLocForNode(child, pos);
        }
        pos -= child.size;
    }
    throw new Error(
        `Node size caches must have been miscalculated! Post pos ${pos} not found in node ${toKey(
            node.id,
        )}, even though node's size is ${node.size}`,
    );
};

// this represents the loc that is after the pos
const posToPostLoc = (crdt, pos) => {
    for (let i = 0; i < crdt.roots.length; i++) {
        if (pos < crdt.roots[i].size) {
            return posToPostLocForNode(crdt.roots[i], pos);
        }
        pos -= crdt.roots[i].size;
    }
    if (pos === 0) {
        return [1, 'root'];
    }
    throw new Error(`Pos ${pos} is outside the bounds`);
};

type Loc = { id: number, site: string, pre: boolean };

export const posToLoc = function<Format>(
    crdt: CRDT<Format>,
    pos: number,
    // if true, loc is the char to the left of the pos (the "pre-loc")
    // if false, loc is the char to the right of the pos (the "post-loc")
    anchorLeft: boolean,
    // Note that I don't currently support anchoring to the right
    // of the end of the string, but I probably could?
    // ok 1:root is the end, 0:root is the start. cool beans
): Loc {
    const total = length(crdt);
    if (pos > total) {
        throw new Error(`Loc is outside of the bounds`);
    }
    const [id, site] = anchorLeft
        ? posToPreLoc(crdt, pos)
        : posToPostLoc(crdt, pos);
    return { id, site, pre: anchorLeft };
};

export const nodeForLoc = function<Format>(
    crdt: CRDT<Format>,
    loc: Loc,
): ?Node<Format> {
    for (let i = loc.id; i >= 0; i--) {
        const k = toKey([i, loc.site]);
        if (crdt.map[k]) {
            return crdt.map[k];
        }
    }
};

export const charactersBeforeNode = function<Format>(
    crdt: CRDT<Format>,
    node: Node<Format>,
): number {
    let total = 0;
    while (node) {
        const siblings =
            node.parent === '0:root'
                ? crdt.roots
                : crdt.map[node.parent].children;
        const idx = siblings.indexOf(node);
        if (idx === -1) {
            throw new Error(
                `node not found in parents children ${toKey(node.id)} ${
                    node.parent
                } - ${siblings.map(s => toKey(s.id)).join(';')}`,
            );
        }
        for (let i = 0; i < idx; i++) {
            total += siblings[i].size;
        }
        if (node.parent === '0:root') {
            break;
        } else {
            node = crdt.map[node.parent];
            if (!node.deleted) {
                total += node.text.length;
            }
        }
    }
    return total;
};

export const locToPos = function<Format>(crdt: CRDT<Format>, loc: Loc): number {
    if (loc.site === 'root') {
        return loc.id === 0 ? 0 : length(crdt);
    }
    // step 1: find the node this loc is within
    const node = nodeForLoc(crdt, loc);
    if (!node) {
        throw new Error(`Loc does not exist in tree ${JSON.stringify(loc)}`);
    }
    // step 2: find the position-in-text for this node
    const nodePos = charactersBeforeNode(crdt, node);
    // step 3: add 1 based on whether it's pre or post
    const offset = loc.id - node.id[0];
    return nodePos + offset + (loc.pre ? 1 : 0);
};
