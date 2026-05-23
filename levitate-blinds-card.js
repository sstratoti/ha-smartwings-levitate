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
        label {
          font-size: 14px;
          color: var(--secondary-text-color);
          margin-bottom: 8px;
        }
        input {
          padding: 10px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-size: 14px;
        }
        input:focus {
          outline: none;
          border-color: var(--primary-color);
        }
      </style>
      <div class="card-config">
        <div class="input-group">
          <label>Name (Optional)</label>
          <input type="text" id="name" value="${this._config.name || ''}" placeholder="e.g. Kitchen Blinds">
        </div>
        <div class="input-group">
          <label>Top Rail Entity (Optional if Bottom Entity is set)</label>
          <input type="text" id="top_entity" value="${this._config.top_entity || ''}" placeholder="cover.my_blind_top">
        </div>
        <div class="input-group">
          <label>Bottom Rail Entity (Optional if Top Entity is set)</label>
          <input type="text" id="bottom_entity" value="${this._config.bottom_entity || ''}" placeholder="cover.my_blind_bottom">
        </div>
      </div>
    `;

    const updateConfig = () => {
      const newConfig = {
        ...this._config,
        name: this.shadowRoot.getElementById('name').value,
        top_entity: this.shadowRoot.getElementById('top_entity').value,
        bottom_entity: this.shadowRoot.getElementById('bottom_entity').value,
      };
      
      const event = new Event("config-changed", {
        bubbles: true,
        composed: true,
      });
      event.detail = { config: newConfig };
      this.dispatchEvent(event);
    };

    this.shadowRoot.getElementById('name').addEventListener('input', updateConfig);
    this.shadowRoot.getElementById('top_entity').addEventListener('input', updateConfig);
    this.shadowRoot.getElementById('bottom_entity').addEventListener('input', updateConfig);
  }
}
customElements.define('levitate-blinds-card-editor', LevitateBlindsCardEditor);


class LevitateBlindsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static getConfigElement() {
    return document.createElement("levitate-blinds-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:levitate-blinds-card",
      name: "Levitate Blinds",
      top_entity: "",
      bottom_entity: ""
    };
  }

  setConfig(config) {
    if (!config.top_entity && !config.bottom_entity) {
      throw new Error("Please define at least top_entity or bottom_entity");
    }
    this.config = config;
  }

  set hass(hass) {
    this._hass = hass;
    const topEntity = this.config.top_entity;
    const bottomEntity = this.config.bottom_entity;

    const topState = topEntity ? hass.states[topEntity] : null;
    const bottomState = bottomEntity ? hass.states[bottomEntity] : null;

    if (topEntity && !topState) return;
    if (bottomEntity && !bottomState) return;

    this.render(topState, bottomState);
  }

  render(topState, bottomState) {
    const hasTop = !!topState;
    const hasBottom = !!bottomState;

    const topPos = hasTop ? (topState.attributes.current_position ?? 0) : 100;
    const bottomPos = hasBottom ? (bottomState.attributes.current_position ?? 0) : 0;
    
    const topY = 100 - topPos;
    const bottomY = 100 - bottomPos;

    this.shadowRoot.innerHTML = `
      <style>
        ha-card {
          padding: ${this.config.slim ? '12px 6px' : '12px'};
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          background: var(--ha-card-background, var(--card-background-color, white));
          border-radius: var(--ha-card-border-radius, 12px);
          box-shadow: var(--ha-card-box-shadow, none);
        }
        .container {
          position: relative;
          width: ${this.config.slim ? '36px' : '60px'};
          height: 150px;
          background: var(--secondary-background-color, #eee);
          border-radius: 8px;
          overflow: hidden;
          border: 2px solid var(--divider-color, #ccc);
        }
        .fabric {
          position: absolute;
          left: 0;
          right: 0;
          background: var(--state-cover-active-color, var(--state-active-color, var(--primary-color, #03a9f4)));
          opacity: 0.6;
          top: ${Math.min(topY, bottomY)}%;
          bottom: ${100 - Math.max(topY, bottomY)}%;
          transition: all 0.3s ease;
        }
        .fabric.ghost {
          position: absolute;
          left: 0;
          right: 0;
          background: var(--state-cover-active-color, var(--state-active-color, var(--primary-color, #03a9f4)));
          opacity: 0.25;
          z-index: 2;
          transition: none;
          display: none;
        }
        .rail {
          position: absolute;
          left: -2px;
          right: -2px;
          height: 12px;
          background: var(--primary-text-color, #444);
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          z-index: 3;
          transition: top 0.3s ease;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .rail::after {
          content: '';
          width: 20px;
          height: 2px;
          background: var(--card-background-color, rgba(255,255,255,0.5));
          border-radius: 1px;
        }
        .rail.ghost {
          position: absolute;
          left: -2px;
          right: -2px;
          height: 12px;
          background: var(--primary-text-color, #444);
          border-radius: 4px;
          opacity: 0.4;
          border: 1px dashed var(--card-background-color, white);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          z-index: 4;
          transition: none;
          display: none;
          justify-content: center;
          align-items: center;
        }
        .rail.ghost::after {
          content: '';
          width: 20px;
          height: 2px;
          background: var(--card-background-color, rgba(255,255,255,0.5));
          border-radius: 1px;
        }
        .rail.top {
          display: ${hasTop ? 'flex' : 'none'};
          top: calc(${topY}% - 6px);
        }
        .rail.bottom {
          display: ${hasBottom ? 'flex' : 'none'};
          top: calc(${bottomY}% - 6px);
        }
        
        .controls {
          display: flex;
          gap: 20px;
          width: 100%;
          justify-content: center;
        }
        .slider-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .slider-label {
          font-size: 10px;
          font-weight: bold;
          text-transform: uppercase;
          color: var(--secondary-text-color);
        }
        input[type=range] {
          writing-mode: bt-lr;
          appearance: slider-vertical;
          width: 8px;
          height: 100px;
          padding: 0 10px;
          accent-color: var(--primary-color, #03a9f4);
        }
        .name {
          font-weight: 500;
          font-size: ${this.config.slim ? '11px' : '14px'};
          color: var(--primary-text-color);
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }
        .position-badge {
          background: var(--secondary-background-color, #eee);
          color: var(--primary-text-color);
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
        }
      </style>
      <ha-card>
        <div class="name">${this.config.name || 'Blind'}</div>
        <div class="container">
          <div class="fabric"></div>
          <div class="fabric ghost"></div>
          <div class="rail top"></div>
          <div class="rail bottom"></div>
          <div class="rail ghost top"></div>
          <div class="rail ghost bottom"></div>
          ${!hasTop || !hasBottom ? `
          <input type="range" id="overlaySlider" min="0" max="100" value="${hasBottom ? bottomPos : topPos}" style="
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            opacity: 0;
            cursor: pointer;
            writing-mode: bt-lr;
            appearance: slider-vertical;
            z-index: 10;
          ">
          ` : ''}
        </div>
        ${!hasTop || !hasBottom ? `
        <div class="position-badge">${hasBottom ? bottomPos : topPos}%</div>
        ` : `
        <div class="controls">
          <div class="slider-group">
            <div class="slider-label">Top</div>
            <input type="range" id="topSlider" min="0" max="100" value="${topPos}">
            <div class="slider-label">${topPos}%</div>
          </div>
          <div class="slider-group">
            <div class="slider-label">Bot</div>
            <input type="range" id="bottomSlider" min="0" max="100" value="${bottomPos}">
            <div class="slider-label">${bottomPos}%</div>
          </div>
        </div>
        `}
      </ha-card>
    `;

    const overlaySlider = this.shadowRoot.getElementById('overlaySlider');
    if (overlaySlider) {
      overlaySlider.addEventListener('change', (e) => {
        const entityId = hasBottom ? this.config.bottom_entity : this.config.top_entity;
        this._hass.callService('cover', 'set_cover_position', {
          entity_id: entityId,
          position: parseInt(e.target.value)
        });
      });
      overlaySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        const y = 100 - val;
        
        const ghostFabric = this.shadowRoot.querySelector('.fabric.ghost');
        const ghostRail = hasBottom 
          ? this.shadowRoot.querySelector('.rail.ghost.bottom')
          : this.shadowRoot.querySelector('.rail.ghost.top');
        const badge = this.shadowRoot.querySelector('.position-badge');
        
        if (ghostFabric) ghostFabric.style.display = 'block';
        if (ghostRail) ghostRail.style.display = 'flex';
        
        if (hasBottom) {
          if (ghostRail) ghostRail.style.top = `calc(${y}% - 6px)`;
          if (ghostFabric) {
            ghostFabric.style.top = '0%';
            ghostFabric.style.bottom = `${val}%`;
          }
        } else {
          if (ghostRail) ghostRail.style.top = `calc(${y}% - 6px)`;
          if (ghostFabric) {
            ghostFabric.style.top = `${y}%`;
            ghostFabric.style.bottom = '0%';
          }
        }
        if (badge) badge.textContent = `${val}%`;
      });
    }

    const topSlider = this.shadowRoot.getElementById('topSlider');
    if (topSlider) {
      topSlider.addEventListener('change', (e) => {
        this._hass.callService('cover', 'set_cover_position', {
          entity_id: this.config.top_entity,
          position: parseInt(e.target.value)
        });
      });
    }

    const bottomSlider = this.shadowRoot.getElementById('bottomSlider');
    if (bottomSlider) {
      bottomSlider.addEventListener('change', (e) => {
        this._hass.callService('cover', 'set_cover_position', {
          entity_id: this.config.bottom_entity,
          position: parseInt(e.target.value)
        });
      });
    }
  }

  getCardSize() {
    return 3;
  }
}

customElements.define('levitate-blinds-card', LevitateBlindsCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "levitate-blinds-card",
  name: "Levitate Blinds Card",
  description: "A specialized card for Top-Down Bottom-Up blinds.",
  preview: true
});