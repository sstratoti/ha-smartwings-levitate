class LevitateBlindsCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    this._config = config;
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    const topPicker = this.shadowRoot.getElementById('top_entity');
    if (topPicker) topPicker.hass = hass;
    const bottomPicker = this.shadowRoot.getElementById('bottom_entity');
    if (bottomPicker) bottomPicker.hass = hass;
  }

  render() {
    if (!this._config) return;

    this.shadowRoot.innerHTML = `
      <style>
        .card-config {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .input-group {
          display: flex;
          flex-direction: column;
        }
        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        label {
          font-size: 14px;
          color: var(--secondary-text-color);
          margin-bottom: 8px;
        }
        .checkbox-group label {
          margin-bottom: 0;
          cursor: pointer;
        }
        input[type="text"] {
          padding: 10px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-size: 14px;
        }
        input[type="text"]:focus {
          outline: none;
          border-color: var(--primary-color);
        }
        input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: var(--primary-color);
        }
        ha-entity-picker {
          display: block;
          width: 100%;
        }
      </style>
      <div class="card-config">
        <div class="input-group">
          <label>Name (Optional)</label>
          <input type="text" id="name" value="${this._config.name || ''}" placeholder="e.g. Kitchen Blinds">
        </div>
        <ha-entity-picker
          id="top_entity"
          label="Top Rail Entity (Optional if Bottom configured)"
          allow-custom-entity
        ></ha-entity-picker>
        <ha-entity-picker
          id="bottom_entity"
          label="Bottom Rail Entity (Optional if Top configured)"
          allow-custom-entity
        ></ha-entity-picker>
        <div class="checkbox-group">
          <input type="checkbox" id="slim" ${this._config.slim ? 'checked' : ''}>
          <label for="slim">Slim Mode (Compact layout)</label>
        </div>
      </div>
    `;

    const fireConfigChanged = (config) => {
      const event = new Event("config-changed", { bubbles: true, composed: true });
      event.detail = { config };
      this.dispatchEvent(event);
    };

    const topPicker = this.shadowRoot.getElementById('top_entity');
    topPicker.hass = this._hass;
    topPicker.value = this._config.top_entity || '';
    topPicker.includeDomains = ['cover'];
    topPicker.addEventListener('value-changed', (e) => {
      fireConfigChanged({ ...this._config, top_entity: e.detail.value });
    });

    const bottomPicker = this.shadowRoot.getElementById('bottom_entity');
    bottomPicker.hass = this._hass;
    bottomPicker.value = this._config.bottom_entity || '';
    bottomPicker.includeDomains = ['cover'];
    bottomPicker.addEventListener('value-changed', (e) => {
      fireConfigChanged({ ...this._config, bottom_entity: e.detail.value });
    });

    this.shadowRoot.getElementById('name').addEventListener('input', (e) => {
      fireConfigChanged({ ...this._config, name: e.target.value });
    });

    this.shadowRoot.getElementById('slim').addEventListener('change', (e) => {
      fireConfigChanged({ ...this._config, slim: e.target.checked });
    });
  }
}
customElements.define('levitate-blinds-card-editor', LevitateBlindsCardEditor);


class LevitateBlindsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.isDragging = false;
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

  initDom() {
    const isSlim = !!this.config.slim;
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
          left: 0;
          right: 0;
          background: var(--state-cover-active-color, var(--state-active-color, var(--primary-color, #03a9f4)));
          opacity: 0.6;
          pointer-events: none;
          transition: top 0.3s ease, bottom 0.3s ease;
        }
        .fabric.ghost {
          position: absolute;
          left: 0;
          right: 0;
          background: var(--state-cover-active-color, var(--state-active-color, var(--primary-color, #03a9f4)));
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
        .container.dragging .fabric {
          transition: none !important;
        }
        .container.dragging .rail.ghost {
          transform: scale(1.15);
        }
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
        .error {
          color: var(--error-color, red);
          font-size: 13px;
          text-align: center;
          padding: 8px;
        }
      </style>
      <ha-card>
        <div class="name">${this.config.name || 'Blind'}</div>
        <div id="error-msg" class="error" style="display: none;">Please configure at least one blind entity.</div>
        <div class="container" id="container">
          <div class="fabric" id="fabric"></div>
          <div class="fabric ghost" id="fabric-ghost"></div>
          <div class="rail top" id="rail-top"></div>
          <div class="rail bottom" id="rail-bottom"></div>
          <div class="rail ghost top" id="rail-ghost-top"></div>
          <div class="rail ghost bottom" id="rail-ghost-bottom"></div>
        </div>
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

    const handlePointerDown = (e, railType) => {
      this.activeRail = railType;
      this.startY = e.clientY;
      this.startPointerId = e.pointerId;
      this.startTarget = e.target;

      this.longPressTimer = setTimeout(() => {
        this.isDragging = true;
        this.longPressTimer = null;
        this.container.classList.add('dragging');
        try {
          this.startTarget.setPointerCapture(this.startPointerId);
        } catch (err) {}

        this.dragTopPos = this.currentTopPos;
        this.dragBottomPos = this.currentBottomPos;

        // Show ghosts
        this.fabricGhost.style.display = 'block';
        if (this.activeRail === 'top') {
          this.railGhostTop.style.display = 'flex';
        } else {
          this.railGhostBottom.style.display = 'flex';
        }
        this.updateGhostVisuals();
      }, 220); // Sweet spot long press duration for responsive but swipe-resilient activation
    };

    const handlePointerMove = (e) => {
      if (this.longPressTimer) {
        const dist = Math.abs(e.clientY - this.startY);
        if (dist > 8) { // If they swipe more than 8px vertically, it is a page scroll
          clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
          this.activeRail = null;
        }
        return;
      }

      if (!this.isDragging || !this.activeRail) return;
      const rect = this.container.getBoundingClientRect();
      let y = e.clientY - rect.top;
      y = Math.max(0, Math.min(y, rect.height));

      let pctFromTop = (y / rect.height) * 100;
      let position = Math.round(100 - pctFromTop);

      const hasTop = !!this.config.top_entity;
      const hasBottom = !!this.config.bottom_entity;

      if (this.activeRail === 'top') {
        if (hasBottom && position < this.currentBottomPos) {
          position = this.currentBottomPos;
        }
        this.dragTopPos = position;
      } else {
        if (hasTop && position > this.currentTopPos) {
          position = this.currentTopPos;
        }
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
      this.container.classList.remove('dragging');
      try {
        this.startTarget.releasePointerCapture(this.startPointerId);
      } catch (err) {}

      // Hide ghosts
      this.fabricGhost.style.display = 'none';
      this.railGhostTop.style.display = 'none';
      this.railGhostBottom.style.display = 'none';

      const entity = this.activeRail === 'top' ? this.config.top_entity : this.config.bottom_entity;
      const position = this.activeRail === 'top' ? this.dragTopPos : this.dragBottomPos;

      // Update positions immediately
      if (this.activeRail === 'top') {
        this.currentTopPos = this.dragTopPos;
      } else {
        this.currentBottomPos = this.dragBottomPos;
      }
      this.updateVisuals();

      // Optimistic UI update lock to prevent snapping back immediately
      this.optimisticTimeout = Date.now() + 4000;
      if (this.activeRail === 'top') {
        this.optimisticTop = position;
      } else {
        this.optimisticBottom = position;
      }

      if (entity && this._hass) {
        this._hass.callService('cover', 'set_cover_position', {
          entity_id: entity,
          position: position
        });
      }
      this.activeRail = null;
    };

    this.railTop.addEventListener('pointerdown', (e) => handlePointerDown(e, 'top'));
    this.railBottom.addEventListener('pointerdown', (e) => handlePointerDown(e, 'bottom'));
    this.railTop.addEventListener('pointermove', handlePointerMove);
    this.railBottom.addEventListener('pointermove', handlePointerMove);
    this.railTop.addEventListener('pointerup', handlePointerUp);
    this.railBottom.addEventListener('pointerup', handlePointerUp);
    this.railTop.addEventListener('pointercancel', handlePointerUp);
    this.railBottom.addEventListener('pointercancel', handlePointerUp);

    // Container-level listeners to support touch-anywhere container dragging for single-motor cards
    this.container.addEventListener('pointerdown', (e) => {
      const hasTop = !!this.config.top_entity;
      const hasBottom = !!this.config.bottom_entity;
      if (hasTop && hasBottom) return; // Dual-motor: user must target rails directly
      const railType = hasTop ? 'top' : 'bottom';
      handlePointerDown(e, railType);
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
      return;
    } else {
      this.container.style.display = 'block';
      this.errorMsg.style.display = 'none';
    }

    const topState = hasTop ? hass.states[this.config.top_entity] : null;
    const bottomState = hasBottom ? hass.states[this.config.bottom_entity] : null;

    if ((hasTop && !topState) || (hasBottom && !bottomState)) {
        this.errorMsg.innerText = "Entity not found. Check entity IDs.";
        this.errorMsg.style.display = 'block';
        return;
    }

    if (!this.isDragging) {
      const realTop = topState ? (topState.attributes.current_position ?? 0) : 100;
      const realBottom = bottomState ? (bottomState.attributes.current_position ?? 0) : 0;

      // Apply optimistic UI logic: ignore rapid state updates for 4 seconds after a drag
      if (this.optimisticTimeout && Date.now() < this.optimisticTimeout) {
        this.currentTopPos = this.optimisticTop !== null ? this.optimisticTop : realTop;
        this.currentBottomPos = this.optimisticBottom !== null ? this.optimisticBottom : realBottom;

        // If the real state has caught up to our optimistic state, we can unlock early
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

    const topY = hasTop ? (100 - (this.currentTopPos ?? 100)) : 0;
    const bottomY = hasBottom ? (100 - (this.currentBottomPos ?? 0)) : 100;

    const railHalfHeight = isSlim ? 6 : 8;

    if (hasTop) {
      this.railTop.style.top = topY + "%";
      this.railTop.style.marginTop = `-${railHalfHeight}px`;
      this.railTop.style.display = "flex";
    } else {
      this.railTop.style.display = "none";
    }

    if (hasBottom) {
      this.railBottom.style.top = bottomY + "%";
      this.railBottom.style.marginTop = `-${railHalfHeight}px`;
      this.railBottom.style.display = "flex";
    } else {
      this.railBottom.style.display = "none";
    }

    let minY, maxY;
    if (hasTop && hasBottom) {
      minY = Math.min(topY, bottomY);
      maxY = Math.max(topY, bottomY);
    } else if (hasTop) {
      minY = topY;
      maxY = 100;
    } else if (hasBottom) {
      minY = 0;
      maxY = bottomY;
    }

    this.fabric.style.top = minY + "%";
    this.fabric.style.bottom = (100 - maxY) + "%";
  }

  updateGhostVisuals() {
    const hasTop = !!this.config.top_entity;
    const hasBottom = !!this.config.bottom_entity;
    const isSlim = !!this.config.slim;

    const dragTop = this.activeRail === 'top' ? this.dragTopPos : this.currentTopPos;
    const dragBottom = this.activeRail === 'bottom' ? this.dragBottomPos : this.currentBottomPos;

    const topY = hasTop ? (100 - (dragTop ?? 100)) : 0;
    const bottomY = hasBottom ? (100 - (dragBottom ?? 0)) : 100;

    const railHalfHeight = isSlim ? 6 : 8;

    if (this.activeRail === 'top' && hasTop) {
      this.railGhostTop.style.top = topY + "%";
      this.railGhostTop.style.marginTop = `-${railHalfHeight}px`;
    }
    if (this.activeRail === 'bottom' && hasBottom) {
      this.railGhostBottom.style.top = bottomY + "%";
      this.railGhostBottom.style.marginTop = `-${railHalfHeight}px`;
    }

    let minY, maxY;
    if (hasTop && hasBottom) {
      minY = Math.min(topY, bottomY);
      maxY = Math.max(topY, bottomY);
    } else if (hasTop) {
      minY = topY;
      maxY = 100;
    } else if (hasBottom) {
      minY = 0;
      maxY = bottomY;
    }

    this.fabricGhost.style.top = minY + "%";
    this.fabricGhost.style.bottom = (100 - maxY) + "%";
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
