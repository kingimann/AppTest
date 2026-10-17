# engine/wasm

`pocket.wat` is the WebAssembly module embedded in `engine/pocket.js` (the `WASM_B64` constant). It has two exports:

- `astar(W, H, start, target, blocked, g, came, closed, heap, out)`: grid A* with a binary heap, 8 directions, no corner cutting.
- `mesh(vol, chunk, height, i0, j0, k0, size, palette, colours, out)`: one voxel chunk to triangles. Each vertex is 9 floats: position, normal and colour.

The JS callers (`findPath`, `Renderer3D.buildChunk`) lay out memory from byte 1024. Bytes 0–383 hold the six voxel faces.

## Rebuild after editing

```sh
npx -p wabt wat2wasm pocket.wat -o pocket.wasm
base64 -w0 pocket.wasm   # paste into WASM_B64 in engine/pocket.js
```

Keep the module under 4 KB so browsers allow compiling it synchronously at load (it is 1.5 KB now).
