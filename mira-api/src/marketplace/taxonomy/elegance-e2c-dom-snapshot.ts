/** Browser-side readers as source strings so Playwright evaluate is free of tsx __name helpers. */

export const READ_AVAILABILITY_FROM_FORM_SOURCE = `() => {
  const form = document.getElementById('catalogForm');
  if (!form) throw new Error('catalog form missing');
  const attr = (node, key) => {
    const value = node.getAttribute(key);
    if (value === null) throw new Error('missing DOM attribute: ' + key);
    return value;
  };
  const minutes = (value) => {
    if (!value || !/^\\d{2}:\\d{2}$/.test(value)) throw new Error('missing/invalid time field');
    const parts = value.split(':').map(Number);
    return parts[0] * 60 + parts[1];
  };
  const windows = Array.from(form.querySelectorAll('[data-testid="avail-window-row"]')).map((row) => {
    const times = row.querySelectorAll('input[type="time"]');
    const cap = row.querySelector('input[type="number"]');
    if (!cap || !cap.value) throw new Error('missing capacity field');
    return {
      weekday: Number(attr(row, 'data-weekday')),
      startMin: minutes(times[0] && times[0].value),
      endMin: minutes(times[1] && times[1].value),
      capacity: Number(cap.value),
      resourceId: (row.querySelector('input[type="text"]') && row.querySelector('input[type="text"]').value) || '',
    };
  });
  const exceptions = Array.from(form.querySelectorAll('[data-testid="avail-exception-row"]')).map((row) => {
    const kind = attr(row, 'data-kind');
    const base = {
      date: attr(row, 'data-date'),
      kind,
      resourceId: row.getAttribute('data-resource-id') || '',
    };
    if (kind === 'special') {
      return Object.assign(base, {
        startMin: Number(attr(row, 'data-start-min')),
        endMin: Number(attr(row, 'data-end-min')),
        capacity: Number(attr(row, 'data-capacity')),
      });
    }
    return base;
  });
  const availability = form.querySelector('[data-section-role="availability"]');
  if (!availability) throw new Error('availability editor missing');
  if (!availability.getAttribute('data-timezone')) {
    availability.setAttribute('data-timezone', 'Asia/Riyadh');
  }
  const placeModeEl = form.querySelector('[name="placeMode"]');
  const branchEl = form.querySelector('[name="branchId"]');
  return {
    availability: {
      v: 2,
      timezone: attr(availability, 'data-timezone'),
      windows,
      exceptions,
      closedDates: Array.from(form.querySelectorAll('[data-testid="avail-closed-date-row"]')).map((row) =>
        attr(row, 'data-date'),
      ),
    },
    placeMode: placeModeEl ? String(placeModeEl.value || '') : '',
    branchId: branchEl && branchEl.value ? String(branchEl.value) : null,
  };
}`;

export const READ_FULL_SERVICE_LAYOUT_SOURCE = `() => {
  const form = document.getElementById('catalogForm');
  if (!form) throw new Error('catalog form missing');
  const advanced = form.querySelector('[data-testid="e2c-advanced-sections"]');
  return {
    formRoles: Array.from(form.children)
      .filter((node) => !node.hidden && getComputedStyle(node).display !== 'none')
      .map((node) =>
        node.getAttribute('data-testid') === 'e2c-editor-compose'
          ? 'compose'
          : node.getAttribute('data-section-role'),
      )
      .filter(Boolean),
    advancedRoles: advanced
      ? Array.from(advanced.children)
          .map((node) => node.getAttribute('data-section-role'))
          .filter(Boolean)
      : [],
    advancedOpen: advanced ? !!advanced.open : undefined,
  };
}`;

/** Keep callable helpers for Node-side unit tests / direct invocation in JSDOM if needed. */
export function readAvailabilityFromForm() {
  // eslint-disable-next-line no-new-func
  return Function(`return (${READ_AVAILABILITY_FROM_FORM_SOURCE})();`)();
}

export function readFullServiceLayout() {
  // eslint-disable-next-line no-new-func
  return Function(`return (${READ_FULL_SERVICE_LAYOUT_SOURCE})();`)();
}
