// =====================================================
// STORY RENDERER & PLAYER
// =====================================================

import { esc } from './utils.js';

export class StoryRenderer {
    constructor(options) {
        this.passagesLayer = options.passagesLayer;
        this.connectionsLayer = options.connectionsLayer;
        this.onPassageSelect = options.onPassageSelect || (() => {});
        this.onPassageEdit = options.onPassageEdit || (() => {});
        this.onPassageDragStart = options.onPassageDragStart || (() => {});

        this.currentStory = null;
        this.selectedPassage = null;
    }

    setStory(story) {
        this.currentStory = story;
        this.selectedPassage = null;
    }

    getSelectedPassage() {
        return this.selectedPassage;
    }

    setSelectedPassage(name) {
        this.selectedPassage = name;
    }

    // =====================================================
    // PASSAGE RENDERING
    // =====================================================
    render() {
        if (!this.currentStory?.passages) {
            this.passagesLayer.innerHTML = '';
            this.connectionsLayer.innerHTML = '';
            return;
        }

        this.passagesLayer.innerHTML = '';

        Object.values(this.currentStory.passages).forEach(p => {
            const node = this._createPassageNode(p);
            this.passagesLayer.appendChild(node);
        });

        this.renderConnections();
    }

    _createPassageNode(passage) {
        const isStart = passage.name === this.currentStory.startPassage;
        const links = this.extractLinks(passage.content);
        const preview = (passage.content || '').replace(/\[\[.+?\]\]/g, '').trim().slice(0, 60);

        const node = document.createElement('div');
        node.className = `passage-node ${isStart ? 'start' : ''} ${this.selectedPassage === passage.name ? 'selected' : ''}`;
        node.dataset.name = passage.name;
        node.style.left = (passage.x || 100) + 'px';
        node.style.top = (passage.y || 100) + 'px';

        node.innerHTML = `
            <div class="passage-node-header">${esc(passage.name)}</div>
            <div class="passage-node-content">${esc(preview)}${preview.length >= 60 ? '...' : ''}</div>
            ${links.length ? `<div class="passage-node-links">${links.map(l => `<span class="passage-link-tag">${esc(l)}</span>`).join('')}</div>` : ''}
        `;

        // Drag handling
        node.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            e.stopPropagation();

            // Select passage
            this.selectedPassage = passage.name;
            document.querySelectorAll('.passage-node').forEach(n => n.classList.remove('selected'));
            node.classList.add('selected');

            this.onPassageSelect(passage.name);
            this.onPassageDragStart(node, e);
        });

        // Double click to edit
        node.addEventListener('dblclick', e => {
            e.stopPropagation();
            this.onPassageEdit(passage.name);
        });

        return node;
    }

    // =====================================================
    // CONNECTIONS RENDERING
    // =====================================================
    renderConnections() {
        if (!this.currentStory?.passages) {
            this.connectionsLayer.innerHTML = '';
            return;
        }

        let svg = '';

        Object.values(this.currentStory.passages).forEach(passage => {
            const links = this.extractLinks(passage.content);
            const fromX = (passage.x || 100) + 80;
            const fromY = (passage.y || 100) + 50;

            links.forEach(targetName => {
                const target = this.currentStory.passages[targetName];
                if (!target) return;

                const toX = (target.x || 100) + 80;
                const toY = (target.y || 100) + 50;

                // Curved line
                const dx = toX - fromX;
                const dy = toY - fromY;

                const ctrlX = (fromX + toX) / 2 - dy * 0.2;
                const ctrlY = (fromY + toY) / 2 + dx * 0.2;

                svg += `<path class="connection-line" d="M${fromX},${fromY} Q${ctrlX},${ctrlY} ${toX},${toY}"/>`;

                // Arrow
                const angle = Math.atan2(toY - ctrlY, toX - ctrlX);
                const arrowSize = 8;
                const ax = toX - arrowSize * Math.cos(angle - 0.4);
                const ay = toY - arrowSize * Math.sin(angle - 0.4);
                const bx = toX - arrowSize * Math.cos(angle + 0.4);
                const by = toY - arrowSize * Math.sin(angle + 0.4);

                svg += `<polygon class="connection-arrow" points="${toX},${toY} ${ax},${ay} ${bx},${by}"/>`;
            });
        });

        this.connectionsLayer.innerHTML = svg;
    }

    // =====================================================
    // LINK EXTRACTION
    // =====================================================
    extractLinks(content) {
        if (!content) return [];
        const matches = content.match(/\[\[([^\]]+)\]\]/g) || [];
        return matches.map(m => {
            const inner = m.slice(2, -2);
            // Handle [[Display->Target]] syntax
            if (inner.includes('->')) {
                return inner.split('->')[1].trim();
            }
            // Handle [[Display|Target]] syntax
            const parts = inner.split('|');
            return parts[parts.length - 1].trim();
        });
    }

    // =====================================================
    // PASSAGE POSITION UPDATE
    // =====================================================
    updatePassagePosition(name, x, y) {
        if (this.currentStory?.passages[name]) {
            this.currentStory.passages[name].x = x;
            this.currentStory.passages[name].y = y;
        }
    }
}

// =====================================================
// STORY PLAYER
// =====================================================
export class StoryPlayer {
    constructor(contentElement) {
        this.contentElement = contentElement;
        this.currentStory = null;
    }

    setStory(story) {
        this.currentStory = story;
    }

    play(passageName) {
        if (!this.currentStory) return;

        const passage = this.currentStory.passages[passageName];
        if (!passage) {
            this.contentElement.innerHTML = `<p>Passage not found: ${passageName}</p>`;
            return;
        }

        let content = passage.content || '';

        // Convert links
        content = content.replace(/\[\[([^\]]+)\]\]/g, (match, inner) => {
            let display, target;
            if (inner.includes('->')) {
                [display, target] = inner.split('->').map(s => s.trim());
            } else if (inner.includes('|')) {
                [display, target] = inner.split('|').map(s => s.trim());
            } else {
                display = target = inner.trim();
            }
            return `<span class="story-link" data-target="${target.replace(/"/g, '&quot;')}">${display}</span>`;
        });

        // Paragraphs
        content = content.split('\n\n').map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

        this.contentElement.innerHTML = `<h1>${esc(this.currentStory.title)}</h1>${content}`;

        // Bind link clicks
        this.contentElement.querySelectorAll('.story-link').forEach(link => {
            link.addEventListener('click', () => {
                this.play(link.dataset.target);
            });
        });
    }
}
