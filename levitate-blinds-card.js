class LevitateBlindsCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._editingIdx = null;
  }

  setConfig(config) {
    this._config = config;
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    ['top_entity', 'bottom_entity', 'tap_entity'].forEach(id => {
      const el = this.shadowRoot.getElementById(id);
      if (el) el.hass = hass;
    });
  }

  _testPreset(btn) {
    if (!this._hass) return;
    if (btn.top != null && this._config.top_entity) {
      const pos = !!this._config.invert_top ? 100 - btn.top : btn.top;
      this._hass.callService('cover', 'set_cover_position', { entity_id: this._config.top_entity, position: pos });
    }
    if (btn.bottom != null && this._config.bottom_entity) {
      const pos = !!this._config.invert_bottom ? 100 - btn.bottom : btn.bottom;
      this._hass.callService('cover', 'set_cover_position', { entity_id: this._config.bottom_entity, position: pos });
    }
  }

  render() {
    if (!this._config) return;
    const tapAction = this._config.tap_action || { action: 'more-info' };
    const presetStr = (this._config.presets || []).join(', ');
    const color = this._config.color || '#03a9f4';
    const presetButtons = this._config.preset_buttons || [];

    // Guard stale editing index
    if (this._editingIdx !== null && this._editingIdx >= presetButtons.length) {
      this._editingIdx = null;
    }
    const isEditing = this._editingIdx !== null;
    const editingBtn = isEditing ? presetButtons[this._editingIdx] : null;

    this.shadowRoot.innerHTML = `
      <style>
        .card-config { display: flex; flex-direction: column; gap: 16px; padding: 4px 0; }
        .section-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--secondary-text-color);
          padding-top: 12px;
          border-top: 1px solid var(--divider-color);
          margin-bottom: -4px;
        }
        .section-title:first-child { border-top: none; padding-top: 0; }
        .two-col { display: flex; gap: 16px; }
        .two-col > * { flex: 1; }
        label { font-size: 14px; color: var(--secondary-text-color); margin-bottom: 6px; display: block; }
        .checkbox-group { display: flex; align-items: center; gap: 8px; }
        .checkbox-group label { margin-bottom: 0; cursor: pointer; }
        input[type="text"], select {
          padding: 10px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-size: 14px;
          width: 100%;
          box-sizing: border-box;
        }
        input[type="text"]:focus, select:focus { outline: none; border-color: var(--primary-color); }
        input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; accent-color: var(--primary-color); }
        input[type="color"] {
          width: 40px; height: 34px; padding: 2px 3px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--card-background-color);
          cursor: pointer;
          vertical-align: middle;
        }
        .color-row { display: flex; align-items: center; gap: 10px; }
        .color-hint { font-size: 12px; color: var(--secondary-text-color); flex: 1; }
        ha-entity-picker { display: block; width: 100%; }
        #tap-entity-row { display: ${tapAction.action === 'none' ? 'none' : 'block'}; }
        .preset-btn-row {
          display: flex;
          align-items: center;
          padding: 8px 10px;
          background: var(--secondary-background-color, #f5f5f5);
          border-radius: 4px;
          gap: 8px;
          border: 1px solid transparent;
          transition: border-color 0.15s;
        }
        .preset-btn-row.is-editing { border-color: var(--primary-color); }
        .preset-move-col {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex-shrink: 0;
        }
        .preset-move-btn {
          background: none;
          border: 1px solid var(--divider-color);
          color: var(--secondary-text-color);
          border-radius: 3px;
          padding: 1px 5px;
          cursor: pointer;
          font-size: 11px;
          line-height: 1.4;
          white-space: nowrap;
        }
        .preset-move-btn:disabled { opacity: 0.25; cursor: default; }
        .preset-move-btn:not(:disabled):hover {
          border-color: var(--primary-color);
          color: var(--primary-color);
        }
        .preset-btn-info { flex: 1; min-width: 0; }
        .preset-btn-name { font-size: 13px; color: var(--primary-text-color); font-weight: 500; }
        .preset-btn-positions { font-size: 11px; color: var(--secondary-text-color); margin-top: 2px; }
        .preset-row-actions { display: flex; gap: 4px; flex-shrink: 0; }
        .preset-edit-btn {
          background: none;
          border: 1px solid var(--primary-color);
          color: var(--primary-color);
          border-radius: 4px;
          padding: 3px 8px;
          cursor: pointer;
          font-size: 12px;
          white-space: nowrap;
        }
        .preset-test-btn {
          background: none;
          border: 1px solid var(--secondary-text-color);
          color: var(--secondary-text-color);
          border-radius: 4px;
          padding: 3px 8px;
          cursor: pointer;
          font-size: 12px;
          white-space: nowrap;
        }
        .preset-remove-btn {
          background: none;
          border: 1px solid var(--error-color, red);
          color: var(--error-color, red);
          border-radius: 4px;
          padding: 3px 8px;
          cursor: pointer;
          font-size: 12px;
          white-space: nowrap;
        }
        .no-presets { font-size: 12px; color: var(--secondary-text-color); font-style: italic; }
        .add-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 12px;
          background: var(--secondary-background-color, #f5f5f5);
          border-radius: 4px;
          border: 1px solid ${isEditing ? 'var(--primary-color)' : 'var(--divider-color)'};
          border-style: ${isEditing ? 'solid' : 'dashed'};
        }
        .form-title {
          font-size: 12px;
          font-weight: 600;
          color: ${isEditing ? 'var(--primary-color)' : 'var(--secondary-text-color)'};
          margin-bottom: -4px;
        }
        .slider-group { display: flex; flex-direction: column; gap: 6px; }
        .slider-row {
          display: none;
          align-items: center;
          gap: 10px;
          padding: 2px 0 2px 26px;
        }
        .slider-row input[type="range"] { flex: 1; accent-color: var(--primary-color); cursor: pointer; }
        .slider-val {
          font-size: 13px;
          font-weight: 600;
          color: var(--primary-text-color);
          min-width: 36px;
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .form-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .add-btn {
          background: var(--primary-color);
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 14px;
        }
        .test-form-btn {
          background: none;
          border: 1px solid var(--primary-color);
          color: var(--primary-color);
          border-radius: 4px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 14px;
        }
        .cancel-btn {
          background: none;
          border: 1px solid var(--secondary-text-color);
          color: var(--secondary-text-color);
          border-radius: 4px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 14px;
        }
      </style>
      <div class="card-config">

        <div class="section-title">General</div>
        <div>
          <label>Name (Optional)</label>
          <input type="text" id="name" value="${this._config.name || ''}" placeholder="e.g. Kitchen Blinds">
        </div>

        <div class="section-title">Entities</div>
        <ha-entity-picker id="top_entity" label="Top Rail Entity (Optional if Bottom configured)" allow-custom-entity></ha-entity-picker>
        <ha-entity-picker id="bottom_entity" label="Bottom Rail Entity (Optional if Top configured)" allow-custom-entity></ha-entity-picker>
        <div class="two-col">
          <div class="checkbox-group">
            <input type="checkbox" id="invert_top" ${this._config.invert_top ? 'checked' : ''}>
            <label for="invert_top">Invert Top Position</label>
          </div>
          <div class="checkbox-group">
            <input type="checkbox" id="invert_bottom" ${this._config.invert_bottom ? 'checked' : ''}>
            <label for="invert_bottom">Invert Bottom Position</label>
          </div>
        </div>

        <div class="section-title">Appearance</div>
        <div class="checkbox-group">
          <input type="checkbox" id="slim" ${this._config.slim ? 'checked' : ''}>
          <label for="slim">Slim Mode (Compact layout)</label>
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="show_buttons" ${this._config.show_buttons !== false ? 'checked' : ''}>
          <label for="show_buttons">Show Open / Stop / Close buttons</label>
        </div>
        <div class="checkbox-group">
          <input type="checkbox" id="show_labels" ${this._config.show_labels !== false ? 'checked' : ''}>
          <label for="show_labels">Show position labels</label>
        </div>
        <div>
          <label>Track Preset Marks (comma-separated, 0–100)</label>
          <input type="text" id="presets" value="${presetStr}" placeholder="e.g. 25, 50, 75">
        </div>
        <div class="color-row">
          <label style="margin:0">Accent Color</label>
          <input type="color" id="color" value="${color}">
          <span class="color-hint">Overrides theme color</span>
        </div>

        <div class="section-title">Tap Action</div>
        <div>
          <label>Action</label>
          <select id="tap_action_type">
            <option value="more-info" ${tapAction.action !== 'none' ? 'selected' : ''}>More Info</option>
            <option value="none" ${tapAction.action === 'none' ? 'selected' : ''}>None</option>
          </select>
        </div>
        <div id="tap-entity-row">
          <ha-entity-picker id="tap_entity" label="Entity for More Info (default: bottom or top entity)" allow-custom-entity></ha-entity-picker>
        </div>

        <div class="section-title">Preset Buttons</div>
        <div id="preset-buttons-list"></div>
        <div class="add-form">
          <div class="form-title">${isEditing ? `Editing: ${editingBtn ? editingBtn.name : ''}` : 'New Preset Button'}</div>
          <div>
            <label>Button Name</label>
            <input type="text" id="new-preset-name" placeholder="e.g. Sunny">
          </div>
          <div class="slider-group">
            <div class="checkbox-group">
              <input type="checkbox" id="new-preset-top-enabled">
              <label for="new-preset-top-enabled">Set Top Rail Position</label>
            </div>
            <div class="slider-row" id="new-preset-top-row">
              <input type="range" id="new-preset-top" min="0" max="100" step="1" value="50">
              <span class="slider-val" id="new-preset-top-val">50%</span>
            </div>
          </div>
          <div class="slider-group">
            <div class="checkbox-group">
              <input type="checkbox" id="new-preset-bottom-enabled">
              <label for="new-preset-bottom-enabled">Set Bottom Rail Position</label>
            </div>
            <div class="slider-row" id="new-preset-bottom-row">
              <input type="range" id="new-preset-bottom" min="0" max="100" step="1" value="50">
              <span class="slider-val" id="new-preset-bottom-val">50%</span>
            </div>
          </div>
          <div class="form-actions">
            <button class="add-btn" id="add-preset-btn">${isEditing ? 'Save Changes' : '+ Add Button'}</button>
            <button class="test-form-btn" id="test-preset-btn">Test</button>
            ${isEditing ? '<button class="cancel-btn" id="cancel-edit-btn">Cancel</button>' : ''}
          </div>
        </div>

      </div>
    `;

    const fire = (config) => {
      const ev = new Event('config-changed', { bubbles: true, composed: true });
      ev.detail = { config };
      this.dispatchEvent(ev);
    };

    // Entity pickers
    const topPicker = this.shadowRoot.getElementById('top_entity');
    topPicker.hass = this._hass;
    topPicker.value = this._config.top_entity || '';
    topPicker.includeDomains = ['cover'];
    topPicker.addEventListener('value-changed', (e) => fire({ ...this._config, top_entity: e.detail.value }));

    const bottomPicker = this.shadowRoot.getElementById('bottom_entity');
    bottomPicker.hass = this._hass;
    bottomPicker.value = this._config.bottom_entity || '';
    bottomPicker.includeDomains = ['cover'];
    bottomPicker.addEventListener('value-changed', (e) => fire({ ...this._config, bottom_entity: e.detail.value }));

    const tapEntityPicker = this.shadowRoot.getElementById('tap_entity');
    tapEntityPicker.hass = this._hass;
    tapEntityPicker.value = tapAction.entity || '';
    tapEntityPicker.includeDomains = ['cover'];
    tapEntityPicker.addEventListener('value-changed', (e) => {
      fire({ ...this._config, tap_action: { ...tapAction, entity: e.detail.value } });
    });

    this.shadowRoot.getElementById('tap_action_type').addEventListener('change', (e) => {
      const action = e.target.value;
      this.shadowRoot.getElementById('tap-entity-row').style.display = action === 'none' ? 'none' : 'block';
      fire({ ...this._config, tap_action: { ...tapAction, action } });
    });

    this.shadowRoot.getElementById('name').addEventListener('input', (e) => {
      fire({ ...this._config, name: e.target.value });
    });

    this.shadowRoot.getElementById('presets').addEventListener('change', (e) => {
      const presets = e.target.value
        .split(',')
        .map(v => parseInt(v.trim(), 10))
        .filter(v => !isNaN(v) && v >= 0 && v <= 100);
      fire({ ...this._config, presets: presets.length ? presets : undefined });
    });

    this.shadowRoot.getElementById('color').addEventListener('change', (e) => {
      fire({ ...this._config, color: e.target.value });
    });

    ['slim', 'show_buttons', 'show_labels', 'invert_top', 'invert_bottom'].forEach(id => {
      this.shadowRoot.getElementById(id).addEventListener('change', (e) => {
        fire({ ...this._config, [id]: e.target.checked });
      });
    });

    // Preset buttons list
    const listEl = this.shadowRoot.getElementById('preset-buttons-list');

    if (presetButtons.length) {
      presetButtons.forEach((btn, idx) => {
        const row = document.createElement('div');
        row.className = 'preset-btn-row' + (this._editingIdx === idx ? ' is-editing' : '');

        // Up/down reorder column
        const moveCol = document.createElement('div');
        moveCol.className = 'preset-move-col';

        const upBtn = document.createElement('button');
        upBtn.className = 'preset-move-btn';
        upBtn.textContent = '▲';
        upBtn.title = 'Move up';
        upBtn.disabled = idx === 0;
        upBtn.addEventListener('click', () => {
          const newButtons = [...presetButtons];
          [newButtons[idx - 1], newButtons[idx]] = [newButtons[idx], newButtons[idx - 1]];
          if (this._editingIdx === idx) this._editingIdx = idx - 1;
          else if (this._editingIdx === idx - 1) this._editingIdx = idx;
          fire({ ...this._config, preset_buttons: newButtons });
        });

        const downBtn = document.createElement('button');
        downBtn.className = 'preset-move-btn';
        downBtn.textContent = '▼';
        downBtn.title = 'Move down';
        downBtn.disabled = idx === presetButtons.length - 1;
        downBtn.addEventListener('click', () => {
          const newButtons = [...presetButtons];
          [newButtons[idx], newButtons[idx + 1]] = [newButtons[idx + 1], newButtons[idx]];
          if (this._editingIdx === idx) this._editingIdx = idx + 1;
          else if (this._editingIdx === idx + 1) this._editingIdx = idx;
          fire({ ...this._config, preset_buttons: newButtons });
        });

        moveCol.appendChild(upBtn);
        moveCol.appendChild(downBtn);

        const info = document.createElement('div');
        info.className = 'preset-btn-info';
        const nameEl = document.createElement('div');
        nameEl.className = 'preset-btn-name';
        nameEl.textContent = btn.name || 'Unnamed';
        const posEl = document.createElement('div');
        posEl.className = 'preset-btn-positions';
        posEl.textContent = [
          btn.top != null ? `↑ ${btn.top}%` : null,
          btn.bottom != null ? `↓ ${btn.bottom}%` : null
        ].filter(Boolean).join('   ');
        info.appendChild(nameEl);
        info.appendChild(posEl);

        const actions = document.createElement('div');
        actions.className = 'preset-row-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'preset-edit-btn';
        editBtn.textContent = this._editingIdx === idx ? 'Editing…' : 'Edit';
        editBtn.disabled = this._editingIdx === idx;
        editBtn.addEventListener('click', () => {
          this._editingIdx = idx;
          this.render();
        });

        const testBtn = document.createElement('button');
        testBtn.className = 'preset-test-btn';
        testBtn.textContent = 'Test';
        testBtn.addEventListener('click', () => this._testPreset(btn));

        const removeBtn = document.createElement('button');
        removeBtn.className = 'preset-remove-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => {
          if (this._editingIdx === idx) this._editingIdx = null;
          const newButtons = presetButtons.filter((_, i) => i !== idx);
          fire({ ...this._config, preset_buttons: newButtons.length ? newButtons : undefined });
        });

        actions.appendChild(editBtn);
        actions.appendChild(testBtn);
        actions.appendChild(removeBtn);

        row.appendChild(moveCol);
        row.appendChild(info);
        row.appendChild(actions);
        listEl.appendChild(row);
      });
    } else {
      const empty = document.createElement('div');
      empty.className = 'no-presets';
      empty.textContent = 'No preset buttons yet.';
      listEl.appendChild(empty);
    }

    // Slider wiring
    const topEnabled = this.shadowRoot.getElementById('new-preset-top-enabled');
    const topRow = this.shadowRoot.getElementById('new-preset-top-row');
    const topSlider = this.shadowRoot.getElementById('new-preset-top');
    const topValEl = this.shadowRoot.getElementById('new-preset-top-val');

    topEnabled.addEventListener('change', () => {
      topRow.style.display = topEnabled.checked ? 'flex' : 'none';
      if (topEnabled.checked && this._hass && this._config.top_entity) {
        const state = this._hass.states[this._config.top_entity];
        if (state) {
          const raw = state.attributes.current_position ?? 50;
          const pos = Math.round(!!this._config.invert_top ? 100 - raw : raw);
          topSlider.value = pos;
          topValEl.textContent = pos + '%';
        }
      }
    });
    topSlider.addEventListener('input', () => {
      topValEl.textContent = topSlider.value + '%';
    });

    const bottomEnabled = this.shadowRoot.getElementById('new-preset-bottom-enabled');
    const bottomRow = this.shadowRoot.getElementById('new-preset-bottom-row');
    const bottomSlider = this.shadowRoot.getElementById('new-preset-bottom');
    const bottomValEl = this.shadowRoot.getElementById('new-preset-bottom-val');

    bottomEnabled.addEventListener('change', () => {
      bottomRow.style.display = bottomEnabled.checked ? 'flex' : 'none';
      if (bottomEnabled.checked && this._hass && this._config.bottom_entity) {
        const state = this._hass.states[this._config.bottom_entity];
        if (state) {
          const raw = state.attributes.current_position ?? 50;
          const pos = Math.round(!!this._config.invert_bottom ? 100 - raw : raw);
          bottomSlider.value = pos;
          bottomValEl.textContent = pos + '%';
        }
      }
    });
    bottomSlider.addEventListener('input', () => {
      bottomValEl.textContent = bottomSlider.value + '%';
    });

    // Pre-populate form when editing
    if (isEditing && editingBtn) {
      this.shadowRoot.getElementById('new-preset-name').value = editingBtn.name || '';
      if (editingBtn.top != null) {
        topEnabled.checked = true;
        topRow.style.display = 'flex';
        topSlider.value = editingBtn.top;
        topValEl.textContent = editingBtn.top + '%';
      }
      if (editingBtn.bottom != null) {
        bottomEnabled.checked = true;
        bottomRow.style.display = 'flex';
        bottomSlider.value = editingBtn.bottom;
        bottomValEl.textContent = editingBtn.bottom + '%';
      }
    }

    // Save / Add button
    this.shadowRoot.getElementById('add-preset-btn').addEventListener('click', () => {
      const nameVal = this.shadowRoot.getElementById('new-preset-name').value.trim();
      if (!nameVal) return;

      const newBtn = { name: nameVal };
      if (topEnabled.checked) newBtn.top = parseInt(topSlider.value, 10);
      if (bottomEnabled.checked) newBtn.bottom = parseInt(bottomSlider.value, 10);

      const newButtons = [...presetButtons];
      if (isEditing) {
        newButtons[this._editingIdx] = newBtn;
        this._editingIdx = null;
      } else {
        newButtons.push(newBtn);
      }
      fire({ ...this._config, preset_buttons: newButtons.length ? newButtons : undefined });
    });

    // Test button — fires current slider values without saving
    this.shadowRoot.getElementById('test-preset-btn').addEventListener('click', () => {
      this._testPreset({
        top: topEnabled.checked ? parseInt(topSlider.value, 10) : null,
        bottom: bottomEnabled.checked ? parseInt(bottomSlider.value, 10) : null
      });
    });

    // Cancel edit
    this.shadowRoot.getElementById('cancel-edit-btn')?.addEventListener('click', () => {
      this._editingIdx = null;
      this.render();
    });
  }
}
customElements.define('levitate-blinds-card-editor', LevitateBlindsCardEditor);


class LevitateBlindsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isDragging = false;
    this._justDragged = false;
    this.activeRail = null;
    this.optimisticTimeout = 0;
    this.optimisticTop = null;
    this.optimisticBottom = null;
    this.dragTopPos = null;
    this.dragBottomPos = null;
    this.longPressTimer = null;
    this.startY = 0;
    this.startPointerId = null;
    this.startTarget = null;
  }

  static getConfigElement() {
    return document.createElement("levitate-blinds-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:levitate-blinds-card",
      name: "Levitate Blinds",
      top_entity: "",
      bottom_entity: "",
      slim: false
    };
  }

  setConfig(config) {
    this.config = config;
    this.initDom();
  }

  _effectivePos(pos, invert) {
    return invert ? 100 - pos : pos;
  }

  _handleTap() {
    const tapAction = this.config.tap_action || { action: 'more-info' };
    if (tapAction.action === 'none') return;
    const entity = tapAction.entity || this.config.bottom_entity || this.config.top_entity;
    if (!entity) return;
    const ev = new Event('hass-more-info', { bubbles: true, composed: true });
    ev.detail = { entityId: entity };
    this.dispatchEvent(ev);
  }

  _callService(service) {
    if (!this._hass) return;
    [this.config.top_entity, this.config.bottom_entity]
      .filter(Boolean)
      .forEach(entity_id => this._hass.callService('cover', service, { entity_id }));
  }

  _renderPresets() {
    this.container.querySelectorAll('.preset-mark').forEach(el => el.remove());
    const presets = this.config.presets;
    if (!presets || !presets.length) return;

    const isDual = !!(this.config.top_entity && this.config.bottom_entity);

    presets.forEach(preset => {
      const mark = document.createElement('div');
      mark.className = 'preset-mark';
      mark.style.top = (100 - preset) + '%';
      mark.title = preset + '%';

      if (!isDual) {
        mark.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!this._hass) return;
          const isTop = !!this.config.top_entity;
          const entity = isTop ? this.config.top_entity : this.config.bottom_entity;
          const invert = isTop ? !!this.config.invert_top : !!this.config.invert_bottom;
          this._hass.callService('cover', 'set_cover_position', {
            entity_id: entity,
            position: invert ? 100 - preset : preset
          });
          if (isTop) { this.currentTopPos = preset; this.optimisticTop = preset; }
          else { this.currentBottomPos = preset; this.optimisticBottom = preset; }
          this.optimisticTimeout = Date.now() + 4000;
          this.updateVisuals();
        });
      } else {
        mark.style.pointerEvents = 'none';
      }

      this.container.insertBefore(mark, this.container.firstChild);
    });
  }

  _renderPresetButtons() {
    const container = this.shadowRoot.getElementById('preset-buttons');
    if (!container) return;
    container.innerHTML = '';

    const buttons = this.config.preset_buttons;
    if (!buttons || !buttons.length) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'flex';

    buttons.forEach(btn => {
      const el = document.createElement('button');
      el.className = 'preset-action-btn';
      el.textContent = btn.name || 'Preset';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this._hass) return;

        if (btn.top != null && this.config.top_entity) {
          const invert = !!this.config.invert_top;
          this._hass.callService('cover', 'set_cover_position', {
            entity_id: this.config.top_entity,
            position: invert ? 100 - btn.top : btn.top
          });
          this.currentTopPos = btn.top;
          this.optimisticTop = btn.top;
        }

        if (btn.bottom != null && this.config.bottom_entity) {
          const invert = !!this.config.invert_bottom;
          this._hass.callService('cover', 'set_cover_position', {
            entity_id: this.config.bottom_entity,
            position: invert ? 100 - btn.bottom : btn.bottom
          });
          this.currentBottomPos = btn.bottom;
          this.optimisticBottom = btn.bottom;
        }

        this.optimisticTimeout = Date.now() + 4000;
        this.updateVisuals();
      });
      container.appendChild(el);
    });
  }

  initDom() {
    const isSlim = !!this.config.slim;
    const showButtons = this.config.show_buttons !== false;
    const showLabels = this.config.show_labels !== false;
    const tapAction = this.config.tap_action || { action: 'more-info' };
    const accentColor = this.config.color
      ? this.config.color
      : 'var(--state-cover-active-color, var(--state-active-color, var(--primary-color, #03a9f4)))';
    const cardCursor = tapAction.action === 'none' ? 'default' : 'pointer';

    this.shadowRoot.innerHTML = `
      <style>
        ha-card {
          padding: ${isSlim ? '12px 10px' : '20px 24px'};
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: ${isSlim ? '8px' : '16px'};
          background: var(--ha-card-background, var(--card-background-color, white));
          border-radius: var(--ha-card-border-radius, 12px);
          box-shadow: var(--ha-card-box-shadow, none);
          box-sizing: border-box;
          width: 100%;
          cursor: ${cardCursor};
          user-select: none;
        }
        .container {
          position: relative;
          width: ${isSlim ? '40px' : '80px'};
          height: ${isSlim ? '150px' : '200px'};
          background: var(--secondary-background-color, #e0e0e0);
          border-radius: 8px;
          border: 2px solid var(--divider-color, #ccc);
          touch-action: none;
          overflow: visible;
        }
        .fabric {
          position: absolute;
          left: 0; right: 0;
          background: ${accentColor};
          opacity: 0.6;
          pointer-events: none;
          transition: top 0.3s ease, bottom 0.3s ease;
        }
        @keyframes moving-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 0.9; }
        }
        .fabric.is-moving { animation: moving-pulse 1.2s ease-in-out infinite; }
        .fabric.ghost {
          position: absolute;
          left: 0; right: 0;
          background: ${accentColor};
          opacity: 0.25;
          pointer-events: none;
          z-index: 2;
          display: none;
        }
        .rail {
          position: absolute;
          left: ${isSlim ? '-2px' : '-4px'};
          right: ${isSlim ? '-2px' : '-4px'};
          height: ${isSlim ? '12px' : '16px'};
          background: var(--primary-text-color, #444);
          border-radius: ${isSlim ? '3px' : '4px'};
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          z-index: 3;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: grab;
          touch-action: none;
          transition: top 0.3s ease;
        }
        .rail:active { cursor: grabbing; }
        .rail::after {
          content: '';
          width: ${isSlim ? '16px' : '24px'};
          height: ${isSlim ? '2px' : '3px'};
          background: var(--card-background-color, rgba(255,255,255,0.6));
          border-radius: 1px;
        }
        .rail.ghost {
          position: absolute;
          left: ${isSlim ? '-2px' : '-4px'};
          right: ${isSlim ? '-2px' : '-4px'};
          height: ${isSlim ? '12px' : '16px'};
          background: var(--primary-text-color, #444);
          border-radius: ${isSlim ? '3px' : '4px'};
          opacity: 0.4;
          border: 1px dashed var(--card-background-color, white);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          z-index: 4;
          display: none;
          justify-content: center;
          align-items: center;
          pointer-events: none;
          transform: scale(1);
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .rail.ghost::after {
          content: '';
          width: ${isSlim ? '16px' : '24px'};
          height: ${isSlim ? '2px' : '3px'};
          background: var(--card-background-color, rgba(255,255,255,0.6));
          border-radius: 1px;
        }
        .container.dragging .rail,
        .container.dragging .fabric { transition: none !important; }
        .container.dragging .rail.ghost { transform: scale(1.15); }
        .preset-mark {
          position: absolute;
          left: 0; right: 0;
          height: 2px;
          background: var(--primary-text-color, #444);
          opacity: 0.2;
          z-index: 1;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .preset-mark:hover { opacity: 0.5; }
        .position-tooltip {
          position: absolute;
          left: calc(100% + ${isSlim ? '6px' : '10px'});
          background: var(--primary-text-color, #444);
          color: var(--card-background-color, white);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          display: none;
          pointer-events: none;
          white-space: nowrap;
          z-index: 10;
          transform: translateY(-50%);
        }
        .unavailable-overlay {
          position: absolute;
          inset: 0;
          display: none;
          z-index: 20;
          border-radius: 6px;
          background: repeating-linear-gradient(
            45deg,
            transparent, transparent 4px,
            rgba(128,128,128,0.15) 4px, rgba(128,128,128,0.15) 8px
          );
        }
        .container.is-unavailable { pointer-events: none; opacity: 0.45; }
        .container.is-unavailable .unavailable-overlay { display: block; }
        .name {
          font-weight: 500;
          font-size: ${isSlim ? '12px' : '18px'};
          color: var(--primary-text-color);
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .position-labels {
          display: ${showLabels ? 'flex' : 'none'};
          gap: 16px;
          font-size: 12px;
          color: var(--secondary-text-color);
          justify-content: center;
          font-variant-numeric: tabular-nums;
        }
        .controls {
          display: ${showButtons ? 'flex' : 'none'};
          gap: ${isSlim ? '8px' : '12px'};
          justify-content: center;
        }
        .ctrl-btn {
          background: var(--secondary-background-color, #e0e0e0);
          border: none;
          border-radius: 50%;
          width: ${isSlim ? '32px' : '40px'};
          height: ${isSlim ? '32px' : '40px'};
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary-text-color);
          transition: background 0.15s, color 0.15s;
        }
        .ctrl-btn:hover { background: ${accentColor}; color: white; }
        .ctrl-btn ha-icon { --mdc-icon-size: ${isSlim ? '16px' : '20px'}; }
        .preset-buttons {
          display: none;
          flex-wrap: wrap;
          gap: ${isSlim ? '6px' : '8px'};
          justify-content: center;
          width: 100%;
        }
        .preset-action-btn {
          background: var(--secondary-background-color, #e0e0e0);
          border: 1px solid var(--divider-color, #ccc);
          border-radius: 16px;
          padding: ${isSlim ? '4px 10px' : '6px 14px'};
          cursor: pointer;
          font-size: ${isSlim ? '11px' : '12px'};
          font-weight: 500;
          color: var(--primary-text-color);
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .preset-action-btn:hover {
          background: ${accentColor};
          color: white;
          border-color: transparent;
        }
        .error {
          color: var(--error-color, red);
          font-size: 13px;
          text-align: center;
          padding: 8px;
        }
      </style>
      <ha-card>
        <div class="name">${this.config.name || 'Blind'}</div>
        <div id="error-msg" class="error" style="display:none">Please configure at least one blind entity.</div>
        <div class="container" id="container">
          <div class="fabric" id="fabric"></div>
          <div class="fabric ghost" id="fabric-ghost"></div>
          <div class="rail top" id="rail-top"></div>
          <div class="rail bottom" id="rail-bottom"></div>
          <div class="rail ghost top" id="rail-ghost-top"></div>
          <div class="rail ghost bottom" id="rail-ghost-bottom"></div>
          <div class="position-tooltip" id="position-tooltip"></div>
          <div class="unavailable-overlay"></div>
        </div>
        <div class="position-labels">
          <span id="label-top"></span>
          <span id="label-bottom"></span>
        </div>
        <div class="controls">
          <button class="ctrl-btn" id="btn-open" title="Open"><ha-icon icon="mdi:arrow-up-circle-outline"></ha-icon></button>
          <button class="ctrl-btn" id="btn-stop" title="Stop"><ha-icon icon="mdi:stop-circle-outline"></ha-icon></button>
          <button class="ctrl-btn" id="btn-close" title="Close"><ha-icon icon="mdi:arrow-down-circle-outline"></ha-icon></button>
        </div>
        <div class="preset-buttons" id="preset-buttons"></div>
      </ha-card>
    `;

    this.container = this.shadowRoot.getElementById('container');
    this.railTop = this.shadowRoot.getElementById('rail-top');
    this.railBottom = this.shadowRoot.getElementById('rail-bottom');
    this.railGhostTop = this.shadowRoot.getElementById('rail-ghost-top');
    this.railGhostBottom = this.shadowRoot.getElementById('rail-ghost-bottom');
    this.fabric = this.shadowRoot.getElementById('fabric');
    this.fabricGhost = this.shadowRoot.getElementById('fabric-ghost');
    this.errorMsg = this.shadowRoot.getElementById('error-msg');
    this.positionTooltip = this.shadowRoot.getElementById('position-tooltip');
    this.labelTop = this.shadowRoot.getElementById('label-top');
    this.labelBottom = this.shadowRoot.getElementById('label-bottom');

    this._renderPresets();
    this._renderPresetButtons();

    this.shadowRoot.getElementById('btn-open').addEventListener('click', (e) => { e.stopPropagation(); this._callService('open_cover'); });
    this.shadowRoot.getElementById('btn-stop').addEventListener('click', (e) => { e.stopPropagation(); this._callService('stop_cover'); });
    this.shadowRoot.getElementById('btn-close').addEventListener('click', (e) => { e.stopPropagation(); this._callService('close_cover'); });

    this.shadowRoot.querySelector('ha-card').addEventListener('click', () => {
      if (this._justDragged) return;
      this._handleTap();
    });

    const handlePointerDown = (e, railType) => {
      this.activeRail = railType;
      this.startY = e.clientY;
      this.startPointerId = e.pointerId;
      this.startTarget = e.target;

      this.longPressTimer = setTimeout(() => {
        this.isDragging = true;
        this.longPressTimer = null;
        this.container.classList.add('dragging');
        if (navigator.vibrate) navigator.vibrate(10);
        try { this.startTarget.setPointerCapture(this.startPointerId); } catch (err) {}

        this.dragTopPos = this.currentTopPos;
        this.dragBottomPos = this.currentBottomPos;

        this.fabricGhost.style.display = 'block';
        if (this.activeRail === 'top') this.railGhostTop.style.display = 'flex';
        else this.railGhostBottom.style.display = 'flex';
        this.positionTooltip.style.display = 'block';
        this.updateGhostVisuals();
      }, 220);
    };

    const handlePointerMove = (e) => {
      if (this.longPressTimer) {
        if (Math.abs(e.clientY - this.startY) > 8) {
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
          this.activeRail = null;
        }
        return;
      }
      if (!this.isDragging || !this.activeRail) return;

      const rect = this.container.getBoundingClientRect();
      let y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
      let position = Math.round(100 - (y / rect.height) * 100);

      if (this.activeRail === 'top') {
        if (this.config.bottom_entity && position < this.currentBottomPos) position = this.currentBottomPos;
        this.dragTopPos = position;
      } else {
        if (this.config.top_entity && position > this.currentTopPos) position = this.currentTopPos;
        this.dragBottomPos = position;
      }
      this.updateGhostVisuals();
    };

    const handlePointerUp = (e) => {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
        this.activeRail = null;
        return;
      }
      if (!this.isDragging) return;

      this.isDragging = false;
      this._justDragged = true;
      setTimeout(() => { this._justDragged = false; }, 150);

      this.container.classList.remove('dragging');
      try { this.startTarget.releasePointerCapture(this.startPointerId); } catch (err) {}

      this.fabricGhost.style.display = 'none';
      this.railGhostTop.style.display = 'none';
      this.railGhostBottom.style.display = 'none';
      this.positionTooltip.style.display = 'none';

      const isTop = this.activeRail === 'top';
      const entity = isTop ? this.config.top_entity : this.config.bottom_entity;
      const position = isTop ? this.dragTopPos : this.dragBottomPos;
      const invert = isTop ? !!this.config.invert_top : !!this.config.invert_bottom;

      if (isTop) this.currentTopPos = this.dragTopPos;
      else this.currentBottomPos = this.dragBottomPos;
      this.updateVisuals();

      this.optimisticTimeout = Date.now() + 4000;
      if (isTop) this.optimisticTop = position;
      else this.optimisticBottom = position;

      if (entity && this._hass) {
        this._hass.callService('cover', 'set_cover_position', {
          entity_id: entity,
          position: invert ? 100 - position : position
        });
      }
      this.activeRail = null;
    };

    this.railTop.addEventListener('pointerdown', (e) => { e.stopPropagation(); handlePointerDown(e, 'top'); });
    this.railBottom.addEventListener('pointerdown', (e) => { e.stopPropagation(); handlePointerDown(e, 'bottom'); });
    [this.railTop, this.railBottom].forEach(rail => {
      rail.addEventListener('pointermove', handlePointerMove);
      rail.addEventListener('pointerup', handlePointerUp);
      rail.addEventListener('pointercancel', handlePointerUp);
    });

    this.container.addEventListener('pointerdown', (e) => {
      if (this.config.top_entity && this.config.bottom_entity) return;
      handlePointerDown(e, this.config.top_entity ? 'top' : 'bottom');
    });
    this.container.addEventListener('pointermove', handlePointerMove);
    this.container.addEventListener('pointerup', handlePointerUp);
    this.container.addEventListener('pointercancel', handlePointerUp);
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.config) return;

    const hasTop = !!this.config.top_entity;
    const hasBottom = !!this.config.bottom_entity;

    if (!hasTop && !hasBottom) {
      this.container.style.display = 'none';
      this.errorMsg.style.display = 'block';
      this.errorMsg.innerText = 'Please configure at least one blind entity.';
      return;
    }
    this.container.style.display = 'block';

    const topState = hasTop ? hass.states[this.config.top_entity] : null;
    const bottomState = hasBottom ? hass.states[this.config.bottom_entity] : null;

    if ((hasTop && !topState) || (hasBottom && !bottomState)) {
      this.errorMsg.innerText = 'Entity not found. Check entity IDs.';
      this.errorMsg.style.display = 'block';
      return;
    }
    this.errorMsg.style.display = 'none';

    const topUnavail = topState && topState.state === 'unavailable';
    const bottomUnavail = bottomState && bottomState.state === 'unavailable';
    this.container.classList.toggle('is-unavailable', !!(topUnavail || bottomUnavail));

    const isMoving = (s) => s && (s.state === 'opening' || s.state === 'closing');
    this.fabric.classList.toggle('is-moving', !!(isMoving(topState) || isMoving(bottomState)));

    if (!this.isDragging) {
      const rawTop = topState ? (topState.attributes.current_position ?? 0) : 100;
      const rawBottom = bottomState ? (bottomState.attributes.current_position ?? 0) : 0;
      const realTop = this._effectivePos(rawTop, !!this.config.invert_top);
      const realBottom = this._effectivePos(rawBottom, !!this.config.invert_bottom);

      if (this.optimisticTimeout && Date.now() < this.optimisticTimeout) {
        this.currentTopPos = this.optimisticTop !== null ? this.optimisticTop : realTop;
        this.currentBottomPos = this.optimisticBottom !== null ? this.optimisticBottom : realBottom;
        if ((this.optimisticTop === null || Math.abs(realTop - this.optimisticTop) <= 2) &&
            (this.optimisticBottom === null || Math.abs(realBottom - this.optimisticBottom) <= 2)) {
          this.optimisticTimeout = 0;
          this.currentTopPos = realTop;
          this.currentBottomPos = realBottom;
        }
      } else {
        this.optimisticTimeout = 0;
        this.optimisticTop = null;
        this.optimisticBottom = null;
        this.currentTopPos = realTop;
        this.currentBottomPos = realBottom;
      }
      this.updateVisuals();
    }
  }

  updateVisuals() {
    const hasTop = !!this.config.top_entity;
    const hasBottom = !!this.config.bottom_entity;
    const isSlim = !!this.config.slim;
    const railHalfHeight = isSlim ? 6 : 8;

    const topY = hasTop ? (100 - (this.currentTopPos ?? 100)) : 0;
    const bottomY = hasBottom ? (100 - (this.currentBottomPos ?? 0)) : 100;

    if (hasTop) {
      this.railTop.style.top = topY + '%';
      this.railTop.style.marginTop = `-${railHalfHeight}px`;
      this.railTop.style.display = 'flex';
    } else {
      this.railTop.style.display = 'none';
    }

    if (hasBottom) {
      this.railBottom.style.top = bottomY + '%';
      this.railBottom.style.marginTop = `-${railHalfHeight}px`;
      this.railBottom.style.display = 'flex';
    } else {
      this.railBottom.style.display = 'none';
    }

    let minY, maxY;
    if (hasTop && hasBottom) { minY = Math.min(topY, bottomY); maxY = Math.max(topY, bottomY); }
    else if (hasTop) { minY = topY; maxY = 100; }
    else { minY = 0; maxY = bottomY; }

    this.fabric.style.top = minY + '%';
    this.fabric.style.bottom = (100 - maxY) + '%';

    if (hasTop && hasBottom) {
      this.labelTop.textContent = `↑ ${Math.round(this.currentTopPos ?? 0)}%`;
      this.labelBottom.textContent = `↓ ${Math.round(this.currentBottomPos ?? 0)}%`;
    } else if (hasTop) {
      this.labelTop.textContent = `${Math.round(this.currentTopPos ?? 0)}%`;
      this.labelBottom.textContent = '';
    } else {
      this.labelTop.textContent = '';
      this.labelBottom.textContent = `${Math.round(this.currentBottomPos ?? 0)}%`;
    }
  }

  updateGhostVisuals() {
    const hasTop = !!this.config.top_entity;
    const hasBottom = !!this.config.bottom_entity;
    const isSlim = !!this.config.slim;
    const railHalfHeight = isSlim ? 6 : 8;

    const dragTop = this.activeRail === 'top' ? this.dragTopPos : this.currentTopPos;
    const dragBottom = this.activeRail === 'bottom' ? this.dragBottomPos : this.currentBottomPos;

    const topY = hasTop ? (100 - (dragTop ?? 100)) : 0;
    const bottomY = hasBottom ? (100 - (dragBottom ?? 0)) : 100;

    if (this.activeRail === 'top' && hasTop) {
      this.railGhostTop.style.top = topY + '%';
      this.railGhostTop.style.marginTop = `-${railHalfHeight}px`;
      this.positionTooltip.style.top = topY + '%';
      this.positionTooltip.textContent = `${this.dragTopPos}%`;
    }
    if (this.activeRail === 'bottom' && hasBottom) {
      this.railGhostBottom.style.top = bottomY + '%';
      this.railGhostBottom.style.marginTop = `-${railHalfHeight}px`;
      this.positionTooltip.style.top = bottomY + '%';
      this.positionTooltip.textContent = `${this.dragBottomPos}%`;
    }

    let minY, maxY;
    if (hasTop && hasBottom) { minY = Math.min(topY, bottomY); maxY = Math.max(topY, bottomY); }
    else if (hasTop) { minY = topY; maxY = 100; }
    else { minY = 0; maxY = bottomY; }

    this.fabricGhost.style.top = minY + '%';
    this.fabricGhost.style.bottom = (100 - maxY) + '%';
  }

  getCardSize() { return 4; }
}

customElements.define('levitate-blinds-card', LevitateBlindsCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "levitate-blinds-card",
  name: "Levitate Blinds Card",
  description: "A specialized card for Top-Down Bottom-Up and single-motor blinds.",
  preview: true
});
