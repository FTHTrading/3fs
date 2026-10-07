import { test } from 'node:test'; import assert from 'node:assert/strict';
import { layout } from '../../kit/js/network.js';
const nodes = [{ id: 'hub', label: '3fs.app', hub: true }, ...['usda', 'grants', 'lending', 'file', 'give', 'fund'].map(id => ({ id, label: id }))];
const edges = nodes.filter(n => !n.hub).map(n => ['hub', n.id]);
test('layout centers the hub and rings the doors at equal radius', () => {
  const m = layout(nodes, edges, { w: 800, h: 500 });
  const hub = m.nodes.find(n => n.id === 'hub'); assert.equal(hub.x, 400); assert.equal(hub.y, 250);
  const r = m.nodes.filter(n => !n.hub).map(n => Math.hypot(n.x - 400, n.y - 250));
  for (const v of r) assert.ok(Math.abs(v - r[0]) < 1);
  assert.equal(m.edges.length, 6); assert.equal(m.edges[0].x1, 400);
});
test('layout is deterministic', () => {
  assert.deepEqual(layout(nodes, edges, { w: 800, h: 500 }), layout(nodes, edges, { w: 800, h: 500 }));
});
