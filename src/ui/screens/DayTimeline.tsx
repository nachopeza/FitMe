import { MiniRing } from '../Ring';
import { Icon } from '../icons';
import { g } from '../components';
import { MEAL_SLOT_LABEL, type MealEntry, type MealSlot } from '../../domain/types';
import type { MealTarget } from '../../domain/meals';

/**
 * El día, en una sola espina.
 *
 * Antes esto eran tres secciones apiladas —las comidas con su objetivo, el
 * registro de lo comido y el contexto del día— que enseñaban lo mismo dos veces
 * y se leían como tres formularios seguidos. Puestas en orden de reloj sobre un
 * raíl, el día se lee como un día: dónde vas, qué queda por delante y en qué
 * comida te has quedado corto.
 *
 * Cada nodo sabe en qué estado está, y eso es lo que da el color: lo que ya
 * pasó y quedó corto se señala, lo cubierto se apaga, y lo que todavía no toca
 * se atenúa en vez de pedir nada.
 */

export type NodeState = 'done' | 'behind' | 'now' | 'ahead';

export interface MealNode {
  type: 'meal';
  slot: MealSlot;
  time: string;
  target: MealTarget;
  kcal: number;
  protein: number;
  entries: MealEntry[];
  state: NodeState;
}

export interface EventNode {
  type: 'event';
  key: string;
  time: string;
  icon: 'dumbbell' | 'weight';
  title: string;
  detail?: string;
  onOpen: () => void;
}

export type DayNode = MealNode | EventNode;

export function DayTimeline({
  nodes, onAdd, onOpenEntry,
}: {
  nodes: DayNode[];
  onAdd: (slot: MealSlot) => void;
  onOpenEntry: (id: string) => void;
}) {
  return (
    <ol className="tl">
      {nodes.map((node) => (node.type === 'meal'
        ? <MealRow key={node.slot} node={node} onAdd={onAdd} onOpenEntry={onOpenEntry} />
        : <EventRow key={node.key} node={node} />))}
    </ol>
  );
}

function MealRow({
  node, onAdd, onOpenEntry,
}: {
  node: MealNode;
  onAdd: (slot: MealSlot) => void;
  onOpenEntry: (id: string) => void;
}) {
  const tone = node.state === 'done' ? 'done' : node.state === 'behind' ? 'behind' : 'accent';
  const short = node.state === 'behind' ? Math.round(node.target.kcal - node.kcal) : 0;

  return (
    <li className={`tl-node is-${node.state}`}>
      <span className="tl-mark">
        <MiniRing
          value={node.kcal}
          target={node.target.kcal}
          tone={tone}
          size={40}
          label={`${MEAL_SLOT_LABEL[node.slot]}: ${Math.round(node.kcal)} de ${node.target.kcal} kcal`}
        />
      </span>

      <div className="tl-body">
        <div className="tl-head">
          <span className="tl-title">{MEAL_SLOT_LABEL[node.slot]}</span>
          <span className="tl-time">{node.time}</span>
        </div>
        <div className="tl-read">
          <b>{g(node.kcal)}</b> / {g(node.target.kcal)} kcal
          <span className="tl-prot">· {g(node.protein)} / {node.target.protein} g prot</span>
        </div>

        {node.entries.length > 0 && (
          <div className="tl-items">
            {node.entries.map((e) => (
              <button className="tl-item" key={e.id} onClick={() => onOpenEntry(e.id)}>
                <span className="tl-item-name">
                  {e.name || e.items.map((i) => i.foodName.replace(/\([^)]*\)/g, '').trim()).join(' + ')}
                </span>
                <span className="tl-item-kcal">{g(e.items.reduce((a, i) => a + i.nutrients.kcal, 0))}</span>
              </button>
            ))}
          </div>
        )}

        <button className="tl-add" onClick={() => onAdd(node.slot)}>
          <Icon name="plus" size={15} />
          {node.entries.length ? 'Añadir algo más' : short > 60 ? `Te faltan ${g(short)} kcal aquí` : 'Añadir'}
        </button>
      </div>
    </li>
  );
}

function EventRow({ node }: { node: EventNode }) {
  return (
    <li className="tl-node is-event">
      <span className="tl-mark">
        <span className="tl-dot"><Icon name={node.icon} size={17} /></span>
      </span>
      <button className="tl-body tl-event" onClick={node.onOpen}>
        <div className="tl-head">
          <span className="tl-title">{node.title}</span>
          <span className="tl-time">{node.time}</span>
        </div>
        {node.detail && <div className="tl-read">{node.detail}</div>}
      </button>
    </li>
  );
}
