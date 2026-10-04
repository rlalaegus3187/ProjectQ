// 관리 화면 목록의 체크박스 선택 (전체 선택 / 일부 선택 → 일괄 처리)
//
//   const sel = useSelection(() => items.value);      // 행 목록 (각 행에 id)
//   <input type="checkbox" :checked="sel.allChecked.value" :indeterminate="sel.someChecked.value" @change="sel.toggleAll()" />
//   <input type="checkbox" :checked="sel.has(item.id)" @change="sel.toggle(item.id)" />
//   sel.ids.value      선택한 id 목록 (지금 목록에 있는 것만)
//   sel.clear()
import { ref, computed } from 'vue';

export function useSelection(rows) {
  const selected = ref(new Set());
  const rowIds = computed(() => (rows() || []).map((r) => r.id));
  // 목록이 바뀌어 사라진 행은 자동으로 빠짐
  const ids = computed(() => rowIds.value.filter((id) => selected.value.has(id)));
  const allChecked = computed(() => rowIds.value.length > 0 && ids.value.length === rowIds.value.length);
  const someChecked = computed(() => ids.value.length > 0 && !allChecked.value);

  const has = (id) => selected.value.has(id);
  function toggle(id) {
    const next = new Set(selected.value);
    if (next.has(id)) next.delete(id); else next.add(id);
    selected.value = next;
  }
  function toggleAll() {
    selected.value = allChecked.value ? new Set() : new Set(rowIds.value);
  }
  const clear = () => { selected.value = new Set(); };

  return { ids, allChecked, someChecked, has, toggle, toggleAll, clear };
}
