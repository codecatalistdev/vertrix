type Item = { id: string; start: number; end: number }

export function placeEvents(items: Item[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end)
  const clusters: Item[][] = []
  let cluster: Item[] = []
  let clusterEnd = -1

  for (const item of sorted) {
    if (cluster.length === 0 || item.start < clusterEnd) {
      cluster.push(item)
      clusterEnd = Math.max(clusterEnd, item.end)
    } else {
      clusters.push(cluster)
      cluster = [item]
      clusterEnd = item.end
    }
  }
  if (cluster.length) clusters.push(cluster)

  const placed = new Map<string, { col: number; cols: number }>()
  for (const group of clusters) {
    const columnEnds: number[] = []
    const assigned: { id: string; col: number }[] = []
    for (const item of group) {
      let column = columnEnds.findIndex((end) => end <= item.start)
      if (column === -1) {
        column = columnEnds.length
        columnEnds.push(item.end)
      } else {
        columnEnds[column] = item.end
      }
      assigned.push({ id: item.id, col: column })
    }
    const cols = Math.max(1, columnEnds.length)
    for (const item of assigned) placed.set(item.id, { col: item.col, cols })
  }
  return placed
}
