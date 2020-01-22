// @flow

import * as hlc from '@local-first/hybrid-logical-clock';
import type { HLC } from '@local-first/hybrid-logical-clock';
import * as crdt from '@local-first/nested-object-crdt';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import type { ClientMessage, ServerMessage } from '../../server/index';

type CRDTImpl<Delta, Data> = {
    createEmpty: () => Data,
    applyDelta: (Data, Delta) => Data,
    create: (v: any, stamp: string) => Data,
    createValue: (v: any, stamp: string) => Data,
    createDeepMap: (v: any, stamp: string) => Data,
    merge: (a: Data, b: Data) => Data,
    latestStamp: (a: Data) => string,
    value: (v: Data) => any,
    deltas: {
        remove: (stamp: string) => Delta,
        stamp: (delta: Delta) => string,
        set: (path: Array<string>, value: Data) => Delta,
        removeAt: (path: Array<string>, stamp: string) => Delta,
    },
};

type CollectionState<Delta, Data> = {
    hlc: HLC,
    data: { [key: string]: Data },
    deltas: Array<{ node: string, delta: Delta }>,
    listeners: Array<(Array<{ value: ?any, id: string }>) => void>,
    itemListeners: { [key: string]: Array<(value: ?any) => void> },
};

const newCollection = <Delta, Data>(
    sessionId: string,
): CollectionState<Delta, Data> => ({
    hlc: hlc.init(sessionId, Date.now()),
    data: {},
    deltas: [],
    listeners: [],
    itemListeners: {},
});

export type Collection<T> = {
    save: (id: string, value: T) => Promise<void>,
    setAttribute: (
        id: string,
        full: T,
        key: string,
        value: any,
    ) => Promise<void>,
    load: (id: string) => Promise<?T>,
    loadAll: () => Promise<{ [key: string]: T }>,
    delete: (id: string) => Promise<void>,
    onChanges: ((Array<{ value: ?T, id: string }>) => void) => () => void,
    onItemChange: (id: string, (value: ?T) => void) => () => void,
};

export type Backend = {
    getCollection: <T>(id: string) => Collection<T>,
    isConnected: () => boolean,
    getUsername: () => string,
    logout: () => void,
};

const make = <Delta, Data>(
    crdt: CRDTImpl<Delta, Data>,
    sessionId: string,
    send: (Array<ClientMessage<Delta, Data>>) => void,
): ({
    collections: { [key: string]: CollectionState<Delta, Data> },
    onMessage: (msg: ServerMessage<Delta, Data>) => void,
}) => {
    const collections: {
        [collectionId: string]: CollectionState<Delta, Data>,
    } = {};

    const applyDeltas = (
        col: CollectionState<Delta, Data>,
        deltas: Array<{ node: string, delta: Delta, ... }>,
    ) => {
        const changed = {};
        deltas.forEach(delta => {
            if (!col.data[delta.node]) {
                col.data[delta.node] = crdt.createEmpty();
            }
            changed[delta.node] = true;
            col.data[delta.node] = crdt.applyDelta(
                col.data[delta.node],
                delta.delta,
            );
        });
        if (col.listeners.length) {
            const changes = Object.keys(changed).map(id => ({
                id,
                value: crdt.value(col.data[id]),
            }));
            col.listeners.forEach(listener => {
                listener(changes);
            });
        }
        Object.keys(changed).forEach(id => {
            if (col.itemListeners[id]) {
                col.itemListeners[id].forEach(fn =>
                    fn(crdt.value(col.data[id])),
                );
            }
        });
    };

    return {
        collections,
        onMessage: (msg: ServerMessage<Delta, Data>) => {
            if (msg.type === 'sync') {
                if (!collections[msg.collection]) {
                    collections[msg.collection] = newCollection(sessionId);
                }
                const col = collections[msg.collection];
                applyDeltas(col, msg.deltas);
                let maxStamp = null;
                msg.deltas.forEach(delta => {
                    const stamp = crdt.deltas.stamp(delta.delta);
                    if (!maxStamp || stamp > maxStamp) {
                        maxStamp = stamp;
                    }
                });
                if (maxStamp) {
                    col.hlc = hlc.recv(
                        col.hlc,
                        hlc.unpack(maxStamp),
                        Date.now(),
                    );
                }
            } else if (msg.type === 'full') {
                if (!collections[msg.collection]) {
                    collections[msg.collection] = newCollection(sessionId);
                    // TODO find the latest hlc in here and update out hlc to match
                    collections[msg.collection].data = msg.data;
                } else {
                    const data = collections[msg.collection].data;
                    Object.keys(msg.data).forEach(id => {
                        if (data[id]) {
                            data[id] = crdt.merge(data[id], msg.data[id]);
                        } else {
                            data[id] = msg.data[id];
                        }
                    });
                }
                const col = collections[msg.collection];
                let maxStamp = null;
                Object.keys(msg.data).forEach(id => {
                    const stamp = crdt.latestStamp(msg.data[id]);
                    if (!maxStamp || stamp > maxStamp) {
                        maxStamp = stamp;
                    }
                });
                if (maxStamp) {
                    col.hlc = hlc.recv(
                        col.hlc,
                        hlc.unpack(maxStamp),
                        Date.now(),
                    );
                }
            }
        },
        getCollection: function<T>(key): Collection<T> {
            if (!collections[key]) {
                collections[key] = newCollection(sessionId);
            }
            const col = collections[key];
            const ts = () => {
                col.hlc = hlc.inc(col.hlc, Date.now());
                return hlc.pack(col.hlc);
            };
            return {
                save: (id: string, value: T) => {
                    const map = crdt.createDeepMap(value, ts());
                    const delta = crdt.deltas.set([], map);
                    col.deltas.push(delta);
                    applyDeltas(col, [{ node: id, delta }]);
                    return Promise.resolve();
                },
                setAttribute: (
                    id: string,
                    full: T,
                    key: string,
                    value: any,
                ) => {
                    const delta = crdt.deltas.set(
                        [key],
                        crdt.createValue(value, ts()),
                    );
                    col.deltas.push(delta);
                    applyDeltas(col, [{ node: id, delta }]);
                    return Promise.resolve();
                },
                load: (id: string) => {
                    return Promise.resolve(crdt.value(col.data[id]));
                },
                loadAll: () => {
                    const res = {};
                    Object.keys(col.data).forEach(id => {
                        const v = crdt.value(col.data[id]);
                        if (v != null) {
                            res[id] = v;
                        }
                    });
                    return Promise.resolve(res);
                },
                delete: (id: string) => {
                    const delta = crdt.deltas.remove(ts());
                    applyDeltas(col, [{ node: id, delta }]);
                    return Promise.resolve();
                },
                onChanges: (fn: (Array<{ value: ?T, id: string }>) => void) => {
                    col.listeners.push(fn);
                    return () =>
                        (col.listeners = col.listeners.filter(f => f !== fn));
                },
                onItemChange: (id: string, fn: (value: ?T) => void) => {
                    if (!col.listeners[id]) {
                        col.listeners[id] = [];
                    }
                    col.listeners[id].push(fn);
                    return () => {
                        col.listeners[id] = col.listeners[id].filter(
                            f => f !== fn,
                        );
                        if (!col.listeners[id].length) {
                            delete col.listeners[id];
                        }
                    };
                },
            };
        },
    };
};
