// =====================================================
// CANVAS - PAN, ZOOM & DRAG CONTROLLER
// =====================================================

export class CanvasController {
    constructor(options) {
        this.canvasView = options.canvasView;
        this.canvasContainer = options.canvasContainer;
        this.zoomDisplay = options.zoomDisplay;
        this.onNodeDrag = options.onNodeDrag || (() => {});
        this.onNodeDragEnd = options.onNodeDragEnd || (() => {});

        // Canvas state
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
        this.minZoom = 0.25;
        this.maxZoom = 2;

        // Pan state
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;

        // Drag state
        this.isDragging = false;
        this.dragNode = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        this._bindEvents();
    }

    _bindEvents() {
        // Pan start
        this.canvasView.addEventListener('mousedown', e => {
            if (e.target === this.canvasContainer || 
                e.target === this.canvasView || 
                e.target.id === 'passagesLayer') {
                this.isPanning = true;
                this.panStartX = e.clientX - this.x;
                this.panStartY = e.clientY - this.y;
                this.canvasContainer.classList.add('grabbing');
            }
        });

        // Pan & drag move
        document.addEventListener('mousemove', e => {
            if (this.isPanning) {
                this.x = e.clientX - this.panStartX;
                this.y = e.clientY - this.panStartY;
                this._updateTransform();
            }

            if (this.isDragging && this.dragNode) {
                const rect = this.canvasView.getBoundingClientRect();
                const x = (e.clientX - rect.left - this.x) / this.zoom - this.dragOffsetX;
                const y = (e.clientY - rect.top - this.y) / this.zoom - this.dragOffsetY;

                this.dragNode.style.left = x + 'px';
                this.dragNode.style.top = y + 'px';

                this.onNodeDrag(this.dragNode.dataset.name, x, y);
            }
        });

        // Pan & drag end
        document.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                this.canvasContainer.classList.remove('grabbing');
            }

            if (this.isDragging && this.dragNode) {
                this.onNodeDragEnd(this.dragNode.dataset.name);
                this.isDragging = false;
                this.dragNode = null;
            }
        });

        // Wheel zoom
        this.canvasView.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.setZoom(this.zoom + delta);
        }, { passive: false });

        // Touch pan start (any touch not on a passage node starts panning)
        this.canvasView.addEventListener('touchstart', e => {
            if (!e.target.closest('.passage-node')) {
                e.preventDefault();
                const touch = e.touches[0];
                this.isPanning = true;
                this.panStartX = touch.clientX - this.x;
                this.panStartY = touch.clientY - this.y;
            }
        }, { passive: false });

        // Touch pan & drag move
        document.addEventListener('touchmove', e => {
            const touch = e.touches[0];
            if (!touch) return;

            if (this.isPanning) {
                e.preventDefault();
                this.x = touch.clientX - this.panStartX;
                this.y = touch.clientY - this.panStartY;
                this._updateTransform();
            }

            if (this.isDragging && this.dragNode) {
                e.preventDefault();
                const rect = this.canvasView.getBoundingClientRect();
                const x = (touch.clientX - rect.left - this.x) / this.zoom - this.dragOffsetX;
                const y = (touch.clientY - rect.top - this.y) / this.zoom - this.dragOffsetY;

                this.dragNode.style.left = x + 'px';
                this.dragNode.style.top = y + 'px';

                this.onNodeDrag(this.dragNode.dataset.name, x, y);
            }
        }, { passive: false });

        // Touch pan & drag end
        document.addEventListener('touchend', () => {
            if (this.isPanning) {
                this.isPanning = false;
            }

            if (this.isDragging && this.dragNode) {
                this.onNodeDragEnd(this.dragNode.dataset.name);
                this.isDragging = false;
                this.dragNode = null;
            }
        });
    }

    _updateTransform() {
        this.canvasContainer.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.zoom})`;
        if (this.zoomDisplay) {
            this.zoomDisplay.textContent = Math.round(this.zoom * 100) + '%';
        }
    }

    setZoom(level) {
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, level));
        this._updateTransform();
    }

    zoomIn() {
        this.setZoom(this.zoom + 0.25);
    }

    zoomOut() {
        this.setZoom(this.zoom - 0.25);
    }

    reset() {
        this.x = -300;
        this.y = -200;
        this.zoom = 1;
        this._updateTransform();
    }

    // Center canvas on a specific point
    centerOn(x, y) {
        this.zoom = 1;
        const viewRect = this.canvasView.getBoundingClientRect();
        this.x = viewRect.width / 2 - x;
        this.y = viewRect.height / 2 - y;
        this._updateTransform();
    }

    // Start dragging a node
    startDrag(node, e) {
        this.isDragging = true;
        this.dragNode = node;

        const rect = node.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        this.dragOffsetX = (clientX - rect.left) / this.zoom;
        this.dragOffsetY = (clientY - rect.top) / this.zoom;
    }

    // Get position for centering new elements
    getCenterPosition() {
        const viewRect = this.canvasView.getBoundingClientRect();
        return {
            x: (-this.x + viewRect.width / 2) / this.zoom - 80,
            y: (-this.y + viewRect.height / 2) / this.zoom - 50
        };
    }
}
