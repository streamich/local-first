// @flow
// @flow
import * as React from 'react';
import type { RecipeT, TagT, IngredientT, RecipeText } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import { Route, Link, useRouteMatch, useParams, useHistory } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import IconButton from '@material-ui/core/IconButton';
import Close from '@material-ui/icons/Close';
import ShoppingCart from '@material-ui/icons/ShoppingCart';
import LinkIcon from '@material-ui/icons/Link';
import { type PantryIngredient } from '../private-collections';

import { imageUrl } from './utils';
import Sidebar from './Sidebar';

const useStyles = makeStyles((theme) => ({
    recipe: {
        position: 'relative',
        width: 270,
        height: 200,
        color: 'inherit',
        margin: theme.spacing(1),
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        textDecoration: 'none',
        backgroundColor: 'rgb(100,100,100)',
        // borderRadius: 4,
    },
    'to-tryRecipe': {
        outline: `${theme.spacing(0.5)}px solid ${theme.palette.secondary.light}`,
    },
    approvedRecipe: {
        outline: `${theme.spacing(0.5)}px solid ${theme.palette.primary.light}`,
    },
    recipeImage: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    recipeTitle: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(50,50,50,0.7)',
        padding: theme.spacing(1),
    },
    approvedRecipeTitle: {},
    rejectedRecipeTitle: {
        fontStyle: 'italic',
        textDecoration: 'line-through',
        textDecorationColor: theme.palette.secondary.light,
    },
    tagRecipes: {
        fontSize: '80%',
    },
    ingredientNames: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        padding: 16,
        textAlign: 'justify',
        fontSize: 30,
    },
    ingredient: {
        paddingRight: '16px',
        // display: 'inline-block',
        fontFamily: 'serif',
        wordBreak: 'break-word',
    },
}));

export const minWidthForSidebar = 800;

const cx = (...args) => args.filter(Boolean).join(' ');

const escapeTitle = (title) => title.replace(/[^a-zA-Z0-9_-]+/g, '-');

export const RecipeBlock = ({
    actorId,
    recipe,
    tags,
    url,
    onClick,
    pantryIngredients,
}: {
    actorId: string,
    recipe: RecipeT,
    tags: { [key: string]: TagT },
    url: string,
    onClick?: () => mixed,
    pantryIngredients?: { [key: string]: PantryIngredient },
}) => {
    const styles = useStyles();

    const href = `/recipe/${recipe.id}/title/${escapeTitle(recipe.about.title)}`;

    const status = recipe.statuses[actorId];

    const onLinkClick = (evt) => {
        if (onClick && window.innerWidth >= minWidthForSidebar) {
            evt.preventDefault();
            onClick();
        } else {
            // let it pass
        }
    };

    if (recipe.about.image) {
        return (
            <Link
                to={href}
                onClick={onLinkClick}
                className={cx(
                    styles.recipe,
                    status ? styles[status.replace(' ', '-') + 'Recipe'] : null,
                )}
            >
                <img src={imageUrl(recipe.about.image, url)} className={styles.recipeImage} />
                <div
                    className={cx(
                        styles.recipeTitle,
                        status ? styles[status.replace(' ', '-') + 'RecipeTitle'] : null,
                    )}
                >
                    {recipe.about.title}
                </div>
                <PantryIcon recipe={recipe} pantryIngredients={pantryIngredients} />
            </Link>
        );
    }

    return (
        <Link
            to={href}
            onClick={onLinkClick}
            className={cx(
                styles.recipe,
                status ? styles[status.replace(' ', '-') + 'Recipe'] : null,
            )}
        >
            <div className={styles.ingredientNames}>
                {getIngredientNames(recipe.contents.text).map((name) => (
                    <span className={styles.ingredient}>{name.toLowerCase() + ' '}</span>
                ))}
            </div>
            <div
                className={cx(
                    styles.recipeTitle,
                    status ? styles[status.replace(' ', '-') + 'RecipeTitle'] : null,
                )}
            >
                {recipe.about.title}
            </div>
            <PantryIcon recipe={recipe} pantryIngredients={pantryIngredients} />
        </Link>
    );
};

const PantryIcon = ({ recipe, pantryIngredients }) => {
    if (!pantryIngredients) {
        return null;
    }

    const { used } = getIngredients(recipe);

    let contents = [];

    const all = used;

    const always = all.filter(
        (i) => pantryIngredients[i] && pantryIngredients[i].availability === 'always',
    );
    const sometimes = all.filter(
        (i) => pantryIngredients[i] && pantryIngredients[i].availability === 'sometimes',
    );
    const need = all.filter(
        (i) => !pantryIngredients[i] || pantryIngredients[i].availability === 'rarely',
    );

    if (need.length > 0) {
        const num = need.length < 3 ? 1 : need.length < 6 ? 2 : 3;
        for (let i = 0; i < num; i++) {
            contents.push(<ShoppingCart color="secondary" key={i} />);
        }
    } else if (sometimes.length > 0 || all.length === 0) {
        contents.push(<Help color="secondary" key={0} />);
    } else {
        contents.push(<Check color="secondary" key={0} />);
    }

    return <div style={{ position: 'absolute', top: 0, right: 0 }}>{contents}</div>;
};
import Help from '@material-ui/icons/Help';
import Check from '@material-ui/icons/Check';

const getIngredientNames = ({ ops }) =>
    ops
        .filter((op) => op.attributes && op.attributes.ingredientLink != null)
        .map((op) => (typeof op.insert === 'string' ? op.insert : ''));

const isIngredientLine = (op) =>
    op && op.insert === '\n' && op.attributes && op.attributes.ingredient;
const getLink = (op) => (op.attributes ? op.attributes.ingredientLink : null);

export const getIngredients = ({
    contents: {
        text: { ops },
    },
}: RecipeT) => {
    const used = {};
    const other = [];
    ops.forEach((op, i) => {
        if (
            isIngredientLine(op) &&
            isIngredientLine(ops[i - 2]) &&
            typeof ops[i - 1].insert === 'string' &&
            ops[i - 1].insert.trim() !== '\n'
        ) {
            other.push(ops[i - 1].insert);
        } else {
            const id = getLink(op);
            if (id) {
                used[id] = true;
            }
        }
    });
    return { used: Object.keys(used), other };
};

export default RecipeBlock;
