export const CATEGORY_COLORS = {
  'building-defects': '#b46b49',
  civil: '#9b8150',
  vision: '#577eab',
  agents: '#8c68a4',
  learning: '#6b78b4',
  federated: '#4c908a',
  nlp: '#a2638c',
  science: '#728d54',
  remote: '#4e9087',
  heat: '#c17b46',
  climate: '#6c8d60',
  mobility: '#997354',
  urban: '#818958',
  materials: '#9b7774',
  energy: '#b4943f',
  health: '#ba727b',
  biology: '#758d7b',
  ecology: '#4e966b',
  water: '#4a91aa',
  transport: '#8c835e',
  robotics: '#717d9d',
  economics: '#9d7b51',
  education: '#a4829d',
  social: '#8b779d',
  optimization: '#758b9c',
  software: '#63839a',
  other: '#929292',
};
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function edgeWeight(edge) {
  return edge.type === 'topic'
    ? clamp(Number(edge.score) || 0.4, 0.15, 1)
    : { citation: 0.85, author: 0.5, manual: 0.65 }[edge.type] || 0.4;
}
export function graphMetrics(papers, edges) {
  const neighbors = new Map(papers.map((p) => [p.id, new Map()]));
  for (const e of edges) {
    if (e.source === e.target || !neighbors.has(e.source) || !neighbors.has(e.target)) continue;
    const w = edgeWeight(e);
    for (const [a, b] of [
      [e.source, e.target],
      [e.target, e.source],
    ])
      neighbors.get(a).set(b, Math.max(neighbors.get(a).get(b) || 0, w));
  }
  return new Map(
    papers.map((p) => {
      const links = neighbors.get(p.id),
        strength = [...links.values()].reduce((s, w) => s + w, 0);
      return [
        p.id,
        { degree: links.size, strength, radius: 10 + Math.min(18, 6 * Math.sqrt(strength)) },
      ];
    }),
  );
}
export function graphBounds(nodes) {
  if (!nodes.length) return { x: 0, y: 0, width: 600, height: 400 };
  const left = Math.min(...nodes.map((n) => n.x - 102)),
    top = Math.min(...nodes.map((n) => n.y - n.radius - 15)),
    right = Math.max(...nodes.map((n) => n.x + 102)),
    bottom = Math.max(...nodes.map((n) => n.y + n.radius + 79));
  return { x: left, y: top, width: right - left, height: bottom - top };
}
export function fitCamera(bounds, width, height) {
  const scale = clamp(
    Math.min((width - 48) / Math.max(1, bounds.width), (height - 90) / Math.max(1, bounds.height)),
    0.15,
    1.25,
  );
  return {
    scale,
    x: width / 2 - (bounds.x + bounds.width / 2) * scale,
    y: (height - 36) / 2 - (bounds.y + bounds.height / 2) * scale,
  };
}
export function zoomCamera(camera, factor, point) {
  const scale = clamp(camera.scale * factor, 0.15, 4),
    ratio = scale / camera.scale;
  return {
    scale,
    x: point.x - (point.x - camera.x) * ratio,
    y: point.y - (point.y - camera.y) * ratio,
  };
}
export function layoutGraph(papers, edges) {
  const metrics = graphMetrics(papers, edges),
    adj = new Map(papers.map((p) => [p.id, new Set()]));
  for (const e of edges)
    if (adj.has(e.source) && adj.has(e.target) && e.source !== e.target) {
      adj.get(e.source).add(e.target);
      adj.get(e.target).add(e.source);
    }
  const visited = new Set(),
    components = [],
    isolates = [];
  for (const p of [...papers].sort((a, b) => a.id.localeCompare(b.id))) {
    if (visited.has(p.id)) continue;
    if (!adj.get(p.id).size) {
      visited.add(p.id);
      isolates.push(p.id);
      continue;
    }
    const ids = [],
      stack = [p.id];
    while (stack.length) {
      const id = stack.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      ids.push(id);
      stack.push(...adj.get(id));
    }
    components.push(
      ids.sort((a, b) => metrics.get(b).strength - metrics.get(a).strength || a.localeCompare(b)),
    );
  }
  components.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
  const positions = new Map();
  let offsetX = 0,
    offsetY = 0,
    rowHeight = 0;
  const cols = components.length > 1 ? 2 : 1;
  for (let c = 0; c < components.length; c++) {
    const ids = components[c],
      count = ids.length,
      radius = Math.max(130, count * 36),
      local = ids.map((id, i) => ({
        id,
        x: Math.cos((i / count) * Math.PI * 2 - Math.PI / 2) * radius,
        y: Math.sin((i / count) * Math.PI * 2 - Math.PI / 2) * radius,
        ...metrics.get(id),
      })),
      lookup = new Map(local.map((n) => [n.id, n]));
    const links = edges.filter((e) => lookup.has(e.source) && lookup.has(e.target));
    if (count <= 120)
      for (let iteration = 0; iteration < 120; iteration++) {
        const forces = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));
        for (let i = 0; i < count; i++)
          for (let j = i + 1; j < count; j++) {
            const a = local[i],
              b = local[j];
            let dx = b.x - a.x,
              dy = b.y - a.y;
            if (Math.abs(dx) + Math.abs(dy) < 0.1) {
              dx = 1;
              dy = 1;
            }
            const norm = Math.sqrt((dx / 230) ** 2 + (dy / 145) ** 2),
              push = Math.max(0, 1.25 - norm) * 17 + Math.min(2, 900 / (dx * dx + dy * dy));
            const d = Math.hypot(dx, dy);
            forces.get(a.id).x -= (dx / d) * push;
            forces.get(a.id).y -= (dy / d) * push;
            forces.get(b.id).x += (dx / d) * push;
            forces.get(b.id).y += (dy / d) * push;
          }
        for (const e of links) {
          const a = lookup.get(e.source),
            b = lookup.get(e.target),
            dx = b.x - a.x,
            dy = b.y - a.y,
            d = Math.hypot(dx, dy) || 1,
            force = (d - (230 + (1 - edgeWeight(e)) * 85)) * 0.014;
          forces.get(a.id).x += (dx / d) * force;
          forces.get(a.id).y += (dy / d) * force;
          forces.get(b.id).x -= (dx / d) * force;
          forces.get(b.id).y -= (dy / d) * force;
        }
        const cooling = 0.8 * (1 - iteration / 150);
        for (const n of local) {
          const f = forces.get(n.id);
          n.x += clamp(f.x - n.x * 0.003, -15, 15) * cooling;
          n.y += clamp(f.y - n.y * 0.003, -15, 15) * cooling;
        }
      }
    const bounds = graphBounds(local);
    for (const n of local)
      positions.set(n.id, { ...n, x: n.x - bounds.x + offsetX, y: n.y - bounds.y + offsetY });
    rowHeight = Math.max(rowHeight, bounds.height + 85);
    if (c % cols === cols - 1) {
      offsetX = 0;
      offsetY += rowHeight;
      rowHeight = 0;
    } else offsetX += bounds.width + 100;
  }
  const connected = graphBounds([...positions.values()]);
  const isolateX = positions.size ? connected.x + connected.width + 165 : 120;
  for (let i = 0; i < isolates.length; i++) {
    const id = isolates[i];
    positions.set(id, {
      id,
      x: isolateX + (i % 2) * 235,
      y: 55 + Math.floor(i / 2) * 155,
      ...metrics.get(id),
    });
  }
  return { positions, isolates, bounds: graphBounds([...positions.values()]) };
}
