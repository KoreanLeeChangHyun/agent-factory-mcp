export interface SelectionInput {
  keys: string[];
  selected: Set<string>;
  anchor: string | null;
  key: string;
  range?: boolean;
  toggle?: boolean;
}

export function selectKeys(input: SelectionInput): { selected: Set<string>; anchor: string } {
  if (input.range && input.anchor && input.keys.includes(input.anchor)) {
    const start = input.keys.indexOf(input.anchor);
    const end = input.keys.indexOf(input.key);
    return {
      selected: new Set(input.keys.slice(Math.min(start, end), Math.max(start, end) + 1)),
      anchor: input.anchor,
    };
  }
  const selected = input.toggle ? new Set(input.selected) : new Set<string>();
  if (input.toggle && selected.has(input.key)) selected.delete(input.key);
  else selected.add(input.key);
  return { selected, anchor: input.key };
}
