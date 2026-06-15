let _listeners = new Set();
let _idCounter  = 0;

function _parse(msg, opts, defaultDuration) {
  if (typeof opts === 'number') return { msg, title: undefined, duration: opts };
  const { title, duration = defaultDuration } = opts ?? {};
  return { msg, title, duration };
}

export const toast = {
  success: (msg, opts) => { const p = _parse(msg, opts, 3200); _emit({ type: 'success', ...p }); },
  error:   (msg, opts) => { const p = _parse(msg, opts, 4500); _emit({ type: 'error',   ...p }); },
  info:    (msg, opts) => { const p = _parse(msg, opts, 3000); _emit({ type: 'info',    ...p }); },
};

function _emit(t) {
  _listeners.forEach(fn => fn({ ...t, id: ++_idCounter }));
}

export function _subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
