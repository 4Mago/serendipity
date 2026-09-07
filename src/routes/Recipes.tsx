import { useRef, useState } from 'react';
import Sheet from '../components/Sheet';
import { api } from '../lib/api';
import { formatQuantity } from '../domain/units';
import { CATEGORIES, type Category, type Ingredient, type Recipe } from '../domain/types';
import { useCollection, useCreate, useRemove, useUpdate } from '../lib/hooks';

const CATEGORY_NAMES: Record<Category, string> = {
  produce: 'Frukt & grönt',
  bakery: 'Bröd',
  meat: 'Kött',
  fish: 'Fisk',
  dairy: 'Mejeri',
  frozen: 'Fryst',
  pantry: 'Skafferi',
  drinks: 'Dryck',
  household: 'Hushåll',
  other: 'Övrigt',
};

const BLANK: Partial<Recipe> = {
  title: '',
  servings: 2,
  steps: [],
  ingredients: [],
  tags: [],
  isFavourite: false,
};

export default function Recipes() {
  const recipes = useCollection('recipes');
  const create = useCreate('recipes');
  const update = useUpdate('recipes');
  const remove = useRemove('recipes');

  const [editing, setEditing] = useState<Partial<Recipe> | null>(null);
  const [viewing, setViewing] = useState<Recipe | null>(null);
  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();
  const sorted = [...(recipes.data ?? [])]
    .filter(
      (recipe) =>
        needle === '' ||
        recipe.title.toLowerCase().includes(needle) ||
        /* Searching by what's in the fridge is the more useful direction. */
        recipe.ingredients.some((row) => row.name.toLowerCase().includes(needle)),
    )
    .sort((a, b) => {
      if (a.isFavourite !== b.isFavourite) return a.isFavourite ? -1 : 1;
      return a.title.localeCompare(b.title, 'sv');
    });

  return (
    <section>
      <div className="page-head">
        <h2>Recept</h2>
        <button type="button" className="btn-plain" onClick={() => setEditing({ ...BLANK })}>
          + Nytt
        </button>
      </div>

      <div className="add-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Sök på namn eller ingrediens"
          aria-label="Sök recept"
        />
      </div>

      {recipes.isLoading && <p className="empty">Laddar…</p>}
      {!recipes.isLoading && sorted.length === 0 && (
        <p className="empty">Inga recept än. Lägg till ett så kan matsedeln använda det.</p>
      )}

      <div className="pick-list">
        {sorted.map((recipe) => (
          <button key={recipe.id} type="button" className="pick" onClick={() => setViewing(recipe)}>
            {recipe.imageId ? (
              <img className="recipe-thumb" src={`/api/uploads/${recipe.imageId}`} alt="" />
            ) : (
              <span className="recipe-thumb recipe-thumb-blank" aria-hidden="true" />
            )}
            <span className="pick-main">
              <span className="pick-title">{recipe.title}</span>
              {recipe.ingredients.length > 0 && (
                <span className="faint">{recipe.ingredients.length} ingredienser</span>
              )}
            </span>
            <span className="faint tabular">
              {recipe.isFavourite ? '♥ ' : ''}
              {recipe.servings}p
            </span>
          </button>
        ))}
      </div>

      {viewing && (
        <RecipeView
          recipe={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
        />
      )}

      {editing && (
        <RecipeEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(recipe) => {
            if (editing.id) update.mutate({ id: editing.id, patch: recipe });
            else create.mutate(recipe);
            setEditing(null);
          }}
          onRemove={
            editing.id
              ? () => {
                  remove.mutate(editing.id as string);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
    </section>
  );
}

function RecipeView({
  recipe,
  onClose,
  onEdit,
}: {
  recipe: Recipe;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <Sheet title={recipe.title} onClose={onClose}>
      {recipe.imageId && (
        <img className="recipe-photo" src={`/api/uploads/${recipe.imageId}`} alt={recipe.title} />
      )}

      <p className="label">
        {recipe.servings} portioner
        {recipe.cookMinutes ? ` · ${recipe.cookMinutes} min` : ''}
      </p>

      {recipe.ingredients.length > 0 && (
        <>
          <p className="label section-label">Ingredienser</p>
          <ul className="ing-view">
            {recipe.ingredients.map((row, index) => (
              <li key={index}>
                <span>{row.name}</span>
                <span className="faint tabular">
                  {row.quantity === null ? '' : formatQuantity(row.quantity)} {row.unit ?? ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {recipe.steps.length > 0 && (
        <>
          <p className="label section-label">Gör så här</p>
          <ol className="steps">
            {recipe.steps.map((step, index) => (
              <li key={index}>
                <span className="step-no tabular">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="actions">
        <button type="button" className="btn" onClick={onEdit}>
          Ändra
        </button>
      </div>
    </Sheet>
  );
}

interface EditorProps {
  initial: Partial<Recipe>;
  onClose: () => void;
  onSave: (recipe: Partial<Recipe>) => void;
  onRemove?: () => void;
}

function RecipeEditor({ initial, onClose, onSave, onRemove }: EditorProps) {
  const [title, setTitle] = useState(initial.title ?? '');
  const [servings, setServings] = useState(initial.servings ?? 2);
  const [isFavourite, setFavourite] = useState(initial.isFavourite ?? false);
  const [ingredients, setIngredients] = useState<Ingredient[]>(initial.ingredients ?? []);
  const [steps, setSteps] = useState((initial.steps ?? []).join('\n'));
  const [imageId, setImageId] = useState(initial.imageId);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const pickPhoto = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const result = await api.upload(file);
      setImageId(result.id);
    } catch {
      setUploadError('Bilden gick inte att ladda upp. Max 5 MB.');
    } finally {
      setUploading(false);
    }
  };

  const patch = (index: number, changes: Partial<Ingredient>) =>
    setIngredients((current) =>
      current.map((row, position) => (position === index ? { ...row, ...changes } : row)),
    );

  const addRow = () =>
    setIngredients((current) => [
      ...current,
      { name: '', quantity: null, unit: null, category: 'other' },
    ]);

  const save = () => {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      servings: Math.max(1, servings),
      isFavourite,
      /* Blank rows are noise, and an unnamed ingredient can never merge. */
      imageId,
      ingredients: ingredients.filter((row) => row.name.trim() !== ''),
      steps: steps
        .split('\n')
        .map((step) => step.trim())
        .filter(Boolean),
      tags: initial.tags ?? [],
    });
  };

  return (
    <Sheet title={initial.id ? 'Ändra recept' : 'Nytt recept'} onClose={onClose}>
      <div className="field">
        <label className="label" htmlFor="r-title">
          Namn
        </label>
        <input
          id="r-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Tomatpasta"
        />
      </div>

      <div className="field">
        <p className="label">Bild</p>
        {imageId && <img className="recipe-photo" src={`/api/uploads/${imageId}`} alt="" />}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void pickPhoto(file);
          }}
        />
        <div className="actions">
          <button type="button" className="btn-plain" onClick={() => fileInput.current?.click()}>
            {uploading ? 'Laddar upp…' : imageId ? 'Byt bild' : '+ Lägg till bild'}
          </button>
          {imageId && (
            <button type="button" className="btn-plain" onClick={() => setImageId(undefined)}>
              Ta bort bild
            </button>
          )}
        </div>
        {uploadError && <p className="hint sheet-action-danger">{uploadError}</p>}
      </div>

      <div className="field-row">
        <div className="field">
          <label className="label" htmlFor="r-serv">
            Portioner
          </label>
          <input
            id="r-serv"
            type="number"
            min={1}
            max={20}
            value={servings}
            onChange={(event) => setServings(Number(event.target.value))}
          />
        </div>
        <div className="field field-inline">
          <button
            type="button"
            className="chip"
            aria-pressed={isFavourite}
            onClick={() => setFavourite((value) => !value)}
          >
            ♥ Favorit
          </button>
        </div>
      </div>

      <p className="label section-label">Ingredienser</p>
      <p className="hint faint">
        Mängd och enhet är det som gör att inköpslistan kan slå ihop lika varor.
      </p>

      {ingredients.map((row, index) => (
        <div key={index} className="ing-row">
          <input
            value={row.name}
            onChange={(event) => patch(index, { name: event.target.value })}
            placeholder="Ingrediens"
            aria-label="Ingrediens"
          />
          <input
            className="ing-qty"
            inputMode="decimal"
            value={row.quantity === null ? '' : String(row.quantity)}
            onChange={(event) => {
              const raw = event.target.value.replace(',', '.');
              const parsed = raw.trim() === '' ? null : Number(raw);
              patch(index, { quantity: parsed !== null && Number.isFinite(parsed) ? parsed : null });
            }}
            placeholder="Antal"
            aria-label="Mängd"
          />
          <input
            className="ing-unit"
            value={row.unit ?? ''}
            onChange={(event) => patch(index, { unit: event.target.value || null })}
            placeholder="g / dl / st"
            aria-label="Enhet"
          />
          <select
            value={row.category}
            onChange={(event) => patch(index, { category: event.target.value as Category })}
            aria-label="Avdelning"
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_NAMES[category]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-plain"
            onClick={() => setIngredients((current) => current.filter((_, i) => i !== index))}
            aria-label="Ta bort ingrediens"
          >
            ×
          </button>
        </div>
      ))}

      <button type="button" className="btn-plain" onClick={addRow}>
        + Ingrediens
      </button>

      <div className="field">
        <label className="label section-label" htmlFor="r-steps">
          Gör så här
        </label>
        <textarea
          id="r-steps"
          rows={5}
          value={steps}
          onChange={(event) => setSteps(event.target.value)}
          placeholder="Ett steg per rad"
        />
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={save}>
          Spara
        </button>
        {onRemove && (
          <button type="button" className="btn-plain sheet-action-danger" onClick={onRemove}>
            Ta bort
          </button>
        )}
      </div>
    </Sheet>
  );
}
