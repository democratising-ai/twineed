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

    // Start dragging a node
    startDrag(node, e) {
        this.isDragging = true;
        this.dragNode = node;

        const rect = node.getBoundingClientRect();
        this.dragOffsetX = (e.clientX - rect.left) / this.zoom;
        this.dragOffsetY = (e.clientY - rect.top) / this.zoom;
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
