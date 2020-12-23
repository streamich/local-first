// @flow
import * as React from 'react';
import type { RecipeT, TagT } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import { Route, Link, useRouteMatch, useParams } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
    container: {
        // paddingTop: theme.spacing(8),
        fontSize: 20,
        lineHeight: 1.8,
        fontWeight: 300,
    },
    title: {
        fontSize: 24,
        marginBottom: 16,
    },
    tags: {
        display: 'flex',
        flexWrap: 'wrap',
    },
    tag: {
        width: 150,
        height: 150,
        color: 'inherit',
        boxShadow: '0 0 2px white',
        padding: 16,
        margin: 8,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textDecoration: 'none',
        borderRadius: 4,
    },
    recipes: {
        display: 'flex',
        flexWrap: 'wrap',
    },
    recipe: {
        width: 150,
        height: 150,
        color: 'inherit',
        boxShadow: '0 0 2px white',
        padding: 16,
        margin: 8,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textDecoration: 'none',
        borderRadius: 4,
    },

    instructionGroup: {
        padding: 16,
    },
    ingredientGroup: {
        padding: 16,
    },
    ingredient: {
        cursor: 'pointer',
        '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.1)',
        },
    },
    checkedIngredient: {
        textDecoration: 'line-through',
        textDecorationColor: 'rgba(255,255,255,0.3)',
        opacity: 0.8,
        cursor: 'pointer',
        '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.1)',
        },
    },
}));

const getType = (fmt) =>
    fmt == null ? null : fmt.ingredient ? 'ingredient' : fmt.instruction ? 'instruction' : null;

const renderOps = ({ ops }, styles) => {
    const lines: Array<{ chunks: *, type: ?string }> = [{ chunks: [], type: null }];
    ops.forEach((op) => {
        if (op.insert === '\n') {
            lines[lines.length - 1].type = getType(op.attributes);
            lines.push({ chunks: [], type: null });
        } else {
            const opLines = op.insert.split('\n');
            const first = opLines.shift();
            lines[lines.length - 1].chunks.push({ text: first, format: op.attributes });
            opLines.forEach((text) =>
                lines.push({ chunks: [{ text, format: op.attributes }], type: null }),
            );
        }
    });
    const groups = [];
    lines.forEach((line) => {
        if (!groups.length || groups[groups.length - 1].type !== line.type) {
            groups.push({ type: line.type, lines: [line] });
        } else {
            groups[groups.length - 1].lines.push(line);
        }
    });
    return groups.map(({ type, lines }, i) => {
        return (
            <div className={type != null ? styles[type + 'Group'] : null}>
                {lines.map((line, i) => {
                    const Comp = componentForFormat(line.type);
                    return (
                        <Comp
                            key={i}
                            children={line.chunks.map((chunk, i) => (
                                <span>{chunk.text}</span>
                            ))}
                        />
                    );
                })}
            </div>
        );
    });
};

const Plain = ({ children }) => (
    <div style={{ minHeight: '1em' }}>{children.length ? children : '&nbsp;'}</div>
);
const Instruction = ({ children }) => <div style={{ color: 'red' }}>{children}</div>;
const Ingredient = ({ children }) => {
    const [checked, setChecked] = React.useState(false);
    const styles = useStyles();
    return (
        <div
            className={checked ? styles.checkedIngredient : styles.ingredient}
            style={{ display: 'flex' }}
            onMouseDown={(_) => setChecked(!checked)}
        >
            {/* <img
            src={require('../icons/icon_plain.svg')}
            style={{ marginRight: 8, marginBottom: -3 }}
        /> */}
            <input
                checked={checked}
                type="checkbox"
                style={{ marginRight: 8, position: 'relative', top: 8 }}
            />
            <div style={{ flex: 1 }}>{children}</div>
        </div>
    );
};

const componentForFormat = (format: ?string) => {
    if (format == null) {
        return Plain;
    }
    if (format === 'instruction') {
        return Instruction;
    }
    if (format === 'ingredient') {
        return Ingredient;
    }
    return Plain;
};

const formatClass = (format) => {
    if (!format) {
        return null;
    }
    if (format.instruction) {
        return;
    }
};

const RecipeView = ({ client }: { client: Client<*> }) => {
    const match = useRouteMatch();
    const { id } = match.params;
    const [col, recipe] = useItem(React, client, 'recipes', id);
    const styles = useStyles();
    if (!recipe) {
        return <div>Recipe not found</div>;
    }
    return (
        <div className={styles.container}>
            <div className={styles.title}>{recipe.title}</div>
            {/* {JSON.stringify(recipe.contents.text)} */}
            {renderOps(recipe.contents.text, styles)}
        </div>
    );
};

export default RecipeView;
