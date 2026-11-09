const h = React.createElement;
const NS = 'local-codex-picker';
const dictionaries = {
  zh: {
    label: '模型与推理强度',
    models: '选择模型',
    selectModel: '选择模型',
    off: 'Off',
    effortLabel: '推理强度',
    loading: '正在加载模型…',
    empty: '没有可用的模型',
    unavailable: '子智能体会话不能切换模型',
    sessionInUse: '会话正在被占用，稍后再试',
    failed: '切换失败：{message}'
  },
  en: {
    label: 'Model and reasoning effort',
    models: 'Choose model',
    selectModel: 'Choose model',
    off: 'Off',
    effortLabel: 'Reasoning effort',
    loading: 'Loading models…',
    empty: 'No models available',
    unavailable: 'Subagent sessions cannot switch models',
    sessionInUse: 'The session is in use — try again in a moment',
    failed: 'Could not switch: {message}'
  }
};

function IconBolt(props) {
  return h('svg', {viewBox: '0 0 20 20', width: 16, height: 16, fill: 'none', 'aria-hidden': true, ...props},
    h('path', {d: 'M11.4 2.4 4.8 11h4.1l-.9 6.6L15.2 9h-4.2l.4-6.6Z', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round', strokeLinecap: 'round'}));
}

function IconChevronDown(props) {
  return h('svg', {viewBox: '0 0 18 18', width: 14, height: 14, fill: 'none', 'aria-hidden': true, ...props},
    h('path', {d: 'M4.5 7 9 11.5 13.5 7', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round'}));
}

function IconChevronRight(props) {
  return h('svg', {viewBox: '0 0 18 18', width: 14, height: 14, fill: 'none', 'aria-hidden': true, ...props},
    h('path', {d: 'M7 4.5 11.5 9 7 13.5', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round'}));
}

function IconCheck(props) {
  return h('svg', {viewBox: '0 0 18 18', width: 14, height: 14, fill: 'none', 'aria-hidden': true, ...props},
    h('path', {d: 'M3.8 9.6 7.2 13 14.4 5.4', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round'}));
}

function findModel(groups, selection) {
  if (!selection) return undefined;
  for (const group of groups || []) {
    if (group.id !== selection.provider) continue;
    for (const model of group.models || []) {
      if (model.id === selection.model) return {group, model};
    }
  }
  return undefined;
}

function effortLevels(reasoning, t) {
  if (!reasoning) return [];
  const efforts = Array.isArray(reasoning.efforts) ? reasoning.efforts : [];
  return efforts.map((effort) => ({
    id: effort.id,
    name: effort.id === 'off' ? t('off') : (effort.name ?? effort.id)
  }));
}

/**
 * The stop a selection with nothing stored lands on: `medium` when the model
 * advertises it, otherwise the middle thinking level (never `off`).
 */
function preferredEffortId(levels, reasoning) {
  const ids = levels.map((level) => level.id);
  if (!ids.length) return undefined;
  const declared = reasoning?.defaultEffort;
  if (declared !== undefined && ids.includes(declared)) return declared;
  if (ids.includes('medium')) return 'medium';
  const thinking = levels.filter((level) => level.id !== 'off');
  const pool = thinking.length ? thinking : levels;
  return pool[Math.floor((pool.length - 1) / 2)].id;
}

function badgeText(badge) {
  if (!badge) return undefined;
  if (typeof badge === 'string') return badge;
  if (typeof badge.text === 'string') return badge.text;
  if (typeof badge.label === 'string') return badge.label;
  return undefined;
}

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

/** Mounts the stylesheet once alongside the control that owns it. */
function withStyle(Component) {
  return (props) => h(React.Fragment, null, h('style', null, CSS), h(Component, props));
}

/**
 * A horizontal detent slider: one stop per advertised reasoning effort. The
 * thumb always rests on a stop — it snaps to the nearest one while dragging
 * and an eased transition carries it between stops — so it never freezes
 * between levels. The stop being crossed is previewed live (the label updates
 * mid-drag) and a release commits it. Keyboard arrows move one stop at a time.
 */
function EffortSlider({levels, index, preview, busy, onCommit, onPreview, t}) {
  const trackRef = React.useRef(null);
  const rectRef = React.useRef(null);
  const draggingRef = React.useRef(false);
  const [dragIndex, setDragIndex] = React.useState(null);
  const count = levels.length;
  // The thumb only ever rests on a detent: idle it follows the committed (or
  // previewed) level, dragging it snaps to the nearest level and the CSS
  // transition carries it from one stop to the next.
  const idleIndex = preview !== null && preview !== undefined && preview >= 0 && preview < count ? preview : index;
  const shownIndex = dragIndex === null ? idleIndex : Math.max(0, Math.min(count - 1, dragIndex));
  const ratio = count > 1 ? shownIndex / (count - 1) : 0;

  React.useEffect(() => {
    if (dragIndex === null) return;
    onPreview?.(dragIndex);
  }, [dragIndex, onPreview]);

  const ratioAt = (clientX) => {
    // Cache the track rect for the whole gesture: reading layout on every
    // pointermove is what made the drag feel choppy.
    const rect = rectRef.current ?? trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const pad = 18;
    const usable = Math.max(1, rect.width - pad * 2);
    return Math.min(1, Math.max(0, (clientX - rect.left - pad) / usable));
  };
  const indexAt = (clientX) => {
    if (count <= 1) return 0;
    return Math.round(ratioAt(clientX) * (count - 1));
  };

  const onPointerDown = (event) => {
    if (busy) return;
    event.preventDefault();
    event.currentTarget.focus?.({preventScroll: true});
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {}
    draggingRef.current = true;
    rectRef.current = trackRef.current?.getBoundingClientRect() ?? null;
    setDragIndex(indexAt(event.clientX));
  };
  const onPointerMove = (event) => {
    if (!draggingRef.current) return;
    const next = indexAt(event.clientX);
    setDragIndex((previous) => previous === next ? previous : next);
  };
  const finish = (event, commit) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const target = indexAt(event.clientX);
    rectRef.current = null;
    setDragIndex(null);
    if (commit) {
      onPreview?.(target);
      if (target !== index) onCommit(target);
    } else {
      onPreview?.(null);
    }
  };
  const onPointerUp = (event) => finish(event, true);
  const onPointerCancel = (event) => finish(event, false);
  const onKeyDown = (event) => {
    if (busy) return;
    let next;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = index - 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = index + 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = count - 1;
    else return;
    event.preventDefault();
    next = Math.max(0, Math.min(count - 1, next));
    if (next !== index) onCommit(next);
  };

  return h('div', {
    ref: trackRef,
    className: 'cmp-slider',
    role: 'slider',
    tabIndex: busy ? -1 : 0,
    'aria-label': t('effortLabel'),
    'aria-valuemin': 0,
    'aria-valuemax': Math.max(0, count - 1),
    'aria-valuenow': shownIndex,
    'aria-valuetext': levels[shownIndex]?.name ?? '',
    'aria-disabled': busy || undefined,
    'data-dragging': dragIndex !== null ? 'true' : undefined,
    style: {'--cmp-ratio': String(ratio)},
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onKeyDown
  },
  h('div', {className: 'cmp-fill', 'aria-hidden': true}),
  levels.map((level, levelIndex) => h('div', {
    key: `dot-${levelIndex}`,
    className: 'cmp-dot',
    'data-covered': levelIndex <= shownIndex ? 'true' : undefined,
    'data-current': levelIndex === shownIndex ? 'true' : undefined,
    style: {'--cmp-pos': String(count > 1 ? levelIndex / (count - 1) : 0)},
    'aria-hidden': true
  })),
  h('div', {className: 'cmp-thumb', 'aria-hidden': true}));
}

function CodexPicker({locked, available, directory, load, select, t, renderSlot}) {
  const subscribe = React.useCallback((notify) => directory.subscribe(notify), [directory]);
  const getSnapshot = React.useCallback(() => directory.getSnapshot(), [directory]);
  const state = React.useSyncExternalStore(subscribe, getSnapshot);

  const [open, setOpen] = React.useState(false);
  const [listOpen, setListOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const [position, setPosition] = React.useState(null);
  const [previewIndex, setPreviewIndex] = React.useState(null);
  const handlePreview = React.useCallback((next) => setPreviewIndex(next), []);
  const triggerRef = React.useRef(null);
  const cardRef = React.useRef(null);
  const loadRef = React.useRef(load);
  loadRef.current = load;

  React.useEffect(() => {
    loadRef.current?.();
  }, []);

  const current = state.current;
  const pending = state.pending;
  const matchingPending = Boolean(pending && current && pending.provider === current.provider && pending.model === current.model);
  const shownSelection = matchingPending ? pending : current;
  const found = findModel(state.groups, shownSelection);
  const reasoning = found?.model?.reasoning;
  const levels = effortLevels(reasoning, t);
  const effortId = (matchingPending ? pending.reasoningEffort : current?.reasoningEffort)
    ?? preferredEffortId(levels, reasoning);
  const foundIndex = levels.findIndex((level) => level.id === effortId);
  const index = foundIndex >= 0 ? foundIndex : 0;
  const displayIndex = previewIndex !== null && previewIndex >= 0 && previewIndex < levels.length ? previewIndex : index;

  // Drop a live drag preview once it matches the committed state (or the card
  // closes); while a drag is in flight it intentionally wins over `index`.
  React.useEffect(() => {
    if (!open) setPreviewIndex(null);
  }, [open]);

  React.useEffect(() => {
    if (previewIndex !== null && previewIndex === index) setPreviewIndex(null);
  }, [previewIndex, index]);

  const modelName = found?.model?.name ?? shownSelection?.model ?? t('selectModel');
  const badge = badgeText(found?.model?.badge);

  const place = React.useCallback(() => {
    const anchor = triggerRef.current?.getBoundingClientRect();
    if (!anchor) return;
    const margin = 8;
    const gap = 8;
    const width = Math.min(324, window.innerWidth - margin * 2);
    const height = cardRef.current?.offsetHeight ?? 0;
    const left = Math.max(margin, Math.min(anchor.right - width, window.innerWidth - width - margin));
    let above = true;
    let top = anchor.top - gap - height;
    if (top < margin) {
      above = false;
      top = Math.min(anchor.bottom + gap, window.innerHeight - height - margin);
    }
    setPosition({left, top, width, above});
  }, []);

  React.useLayoutEffect(() => {
    if (open) place();
  }, [open, listOpen, levels.length, place]);

  React.useEffect(() => {
    if (!open) return;
    loadRef.current?.();
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener('resize', onMove);
    document.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      document.removeEventListener('scroll', onMove, true);
    };
  }, [open, place]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event) => {
      const target = event.target;
      if (triggerRef.current?.contains(target) || cardRef.current?.contains(target)) return;
      setOpen(false);
      setListOpen(false);
    };
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      setListOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const node = cardRef.current;
    if (!node) return;
    const target = node.querySelector('[role="slider"]') ?? node;
    target.focus?.({preventScroll: true});
  }, [open, levels.length]);

  const commit = (selection) => {
    if (!available || busy) return;
    setBusy(true);
    setToast(null);
    Promise.resolve(select(selection))
      .then((result) => {
        if (result && result.ok === false) {
          const code = result.error?.code ?? '';
          setToast(code === 'session/writer-held' ? t('sessionInUse') : t('failed', {message: `${code}: ${result.error?.message ?? ''}`}));
        }
      })
      .catch((error) => {
        setToast(t('failed', {message: String(error?.message ?? error)}));
      })
      .finally(() => {
        setBusy(false);
        setPreviewIndex(null);
      });
  };

  const commitEffortAt = (nextIndex) => {
    const level = levels[nextIndex];
    if (!current || level === undefined) return;
    if (level.id === effortId) return;
    commit({
      provider: current.provider,
      model: current.model,
      reasoningEffort: level.id
    });
  };

  const chooseModel = (group, model) => {
    setListOpen(false);
    if (!current) {
      commit({provider: group.id, model: model.id});
      return;
    }
    if (group.id === current.provider && model.id === current.model) return;
    const nextLevels = effortLevels(model.reasoning, t);
    const kept = nextLevels.some((level) => level.id === effortId)
      ? effortId
      : preferredEffortId(nextLevels, model.reasoning);
    commit({
      provider: group.id,
      model: model.id,
      ...(kept === undefined ? {} : {reasoningEffort: kept})
    });
  };

  const onListKeyDown = (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const options = Array.from(event.currentTarget.querySelectorAll('[role="option"]'));
    if (!options.length) return;
    const active = options.indexOf(document.activeElement);
    const next = event.key === 'ArrowDown' ? Math.min(options.length - 1, active + 1) : Math.max(0, active - 1);
    event.preventDefault();
    options[next]?.focus();
  };

  const fallbackLabel = h('span', {className: 'cmp-trigger-label'}, modelName);
  let labelNode = fallbackLabel;
  if (typeof renderSlot === 'function') {
    try {
      const contributed = renderSlot('conversation.input.model.label', {
        provider: {id: shownSelection?.provider ?? '', name: found?.group?.name ?? ''},
        model: found?.model ?? {id: shownSelection?.model ?? '', name: modelName},
        placement: 'trigger',
        selected: true
      }, {fallback: fallbackLabel});
      if (contributed !== undefined && contributed !== null && contributed !== false) labelNode = contributed;
    } catch {
      labelNode = fallbackLabel;
    }
  }

  const rows = [];
  for (const group of state.groups || []) {
    if (!group.models?.length) continue;
    rows.push(h('div', {key: `group-${group.id}`, className: 'cmp-group-head'}, group.name ?? group.id));
    for (const model of group.models) {
      const selected = shownSelection?.provider === group.id && shownSelection?.model === model.id;
      const optionBadge = badgeText(model.badge);
      rows.push(h('button', {
        key: `model-${group.id}/${model.id}`,
        type: 'button',
        className: 'cmp-option',
        role: 'option',
        'aria-selected': selected,
        'data-selected': selected ? 'true' : undefined,
        title: model.name ?? model.id,
        onClick: () => chooseModel(group, model)
      },
      h('span', {className: 'cmp-option-name'}, model.name ?? model.id),
      optionBadge ? h('span', {className: 'cmp-badge'}, optionBadge) : null,
      selected ? h(IconCheck, {className: 'cmp-option-check'}) : null));
    }
  }

  const card = open ? createPortal(h('div', {
    ref: cardRef,
    className: 'cmp-card',
    role: 'dialog',
    tabIndex: -1,
    'aria-label': t('label'),
    'aria-busy': busy || undefined,
    'data-placement': position?.above === false ? 'below' : 'above',
    style: position
      ? {left: position.left, top: position.top, width: position.width}
      : {left: 0, top: 0, visibility: 'hidden'}
  },
  levels.length ? h('div', {className: 'cmp-head'},
    h('span', {
      key: `effort-${displayIndex}`,
      className: 'cmp-effort',
      title: levels[displayIndex]?.name ?? ''
    }, levels[displayIndex]?.name ?? '')) : null,
  h('button', {
    type: 'button',
    className: 'cmp-model',
    disabled: !available,
    'aria-haspopup': 'listbox',
    'aria-expanded': listOpen,
    onClick: () => setListOpen((value) => !value)
  },
  h('span', {className: classNames('cmp-model-name', !current && 'cmp-model-name-muted')}, modelName),
  badge ? h('span', {className: 'cmp-badge'}, badge) : null,
  h(IconChevronRight, {className: 'cmp-model-chevron', 'data-open': listOpen ? 'true' : undefined})),
  listOpen && h('div', {
    className: 'cmp-list',
    role: 'listbox',
    'aria-label': t('models'),
    onKeyDown: onListKeyDown
  },
  (state.status === 'loading' || state.status === 'idle') && rows.length === 0 ? h('div', {className: 'cmp-note'}, t('loading')) : null,
  state.status === 'ready' && rows.length === 0 ? h('div', {className: 'cmp-note'}, t('empty')) : null,
  ...rows),
  levels.length >= 2 ? h(EffortSlider, {levels, index, preview: previewIndex, busy, onCommit: commitEffortAt, onPreview: handlePreview, t}) : null,
  toast ? h('div', {className: 'cmp-error', role: 'alert'}, toast) : null), document.body) : null;

  return h(React.Fragment, null,
    h('button', {
      ref: triggerRef,
      type: 'button',
      className: 'cmp-trigger',
      'aria-haspopup': 'dialog',
      'aria-expanded': open,
      'aria-label': t('label'),
      title: available ? t('label') : t('unavailable'),
      disabled: locked || !available,
      onClick: () => setOpen((value) => !value),
      onKeyDown: (event) => {
        if (event.key !== 'ArrowDown' || open) return;
        event.preventDefault();
        setOpen(true);
      }
    },
    h(IconBolt, {className: 'cmp-trigger-icon'}),
    labelNode,
    levels.length ? h('span', {className: 'cmp-trigger-effort'}, `· ${levels[displayIndex]?.name ?? ''}`) : null,
    h(IconChevronDown, {className: 'cmp-trigger-chevron', 'data-open': open ? 'true' : undefined})),
    card);
}

return {
  inject: ['slots', 'locale'],
  apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, dictionaries));
    // Replaces the shipped model seat: the single-slot registry renders the
    // lowest-priority registration, so -1 shadows the shipped occupant (0).
    ctx.inject(['slots', 'modelDirectories', 'sessions'], (scope) => {
      const models = scope.modelDirectories;
      const sessions = scope.sessions;
      scope.slots.inject('conversation.input.model', () => scope.slots.register({
        name: 'conversation.input.model',
        locale: NS,
        priority: -1,
        inject: (sessionId) => {
          const directory = models.directoryFor(sessionId);
          const available = sessions.subagentAddress(sessionId) === undefined;
          return {
            available,
            directory: directory.store,
            load: () => {
              if (available) directory.load().catch(() => {});
            },
            select: (selection) => available ? directory.select(selection) : Promise.resolve(undefined)
          };
        }
      }, withStyle(CodexPicker)));
    });
  }
};
