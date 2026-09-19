# Flow Component Architecture

This directory houses the visual flow editor that powers Banana Flow. The implementation is now centered around a dedicated Zustand store that keeps every board's graph, actions, and async status in sync across the canvas, node components, and persistence layer.

## Structure

### Core Pieces
- `container.tsx` – Wraps `ReactFlow` with the per-board store and wires store selectors into the canvas.
- `controls/` – Buttons and tooltips for spawning additional nodes through the shared store actions.
- `nodes/` – Individual node UIs (image, prompt, output) that read/write node data via the callbacks injected by the store.
- `types.ts` – Shared type helpers used across the flow feature.

### State Management
- `src/stores/board-store.tsx` – Creates a store per board, hydrates initial nodes/edges from the Drizzle-backed `getBoard` server action, attaches callbacks, debounces saves back to `updateBoard`, and owns helpers like `generateImage`, `createNodeWithType`, and `deleteNode`.

## Key Benefits

- **Single source of truth** – Nodes, edges, async status, and persistence timers live in the store so every component stays in sync.
- **Reusable actions** – Controls and nodes consume the same store actions, preventing duplicate logic for creation or image generation.
- **Hydration aware** – Boards reload their saved graph, and freshly created boards receive a default workflow from the store if no state exists yet.
- **Extensible** – Adding a new node type only requires defining its UI and registering it in the store/node map; actions remain the same.
- **Composable outputs** – Generated images are written back to node data so downstream nodes can connect and reuse them without extra plumbing.

## Usage

```tsx
<FlowContainer
  boardId={board.id}
  initialNodes={board.nodes}
  initialEdges={board.edges}
/>
```

`FlowContainer` ensures the board store is created (or reused) for the given `boardId`, then renders `ReactFlow` with the state and callbacks provided by the store.
