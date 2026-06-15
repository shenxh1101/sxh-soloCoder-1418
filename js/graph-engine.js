import { clamp, getNiceNumber, formatNumber, rgba } from './utils.js';

export class GraphEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        this.coordinateSystem = 'cartesian';
        
        this.xMin = -10;
        this.xMax = 10;
        this.yMin = -10;
        this.yMax = 10;
        
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1;
        
        this.showGrid = true;
        this.showAxes = true;
        this.showLabels = true;
        this.showKeyPoints = false;
        
        this.curves = [];
        this.scatterData = null;
        this.fitCurve = null;
        
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.mouseWorldX = 0;
        this.mouseWorldY = 0;
        
        this.onMouseMove = null;
        
        this.resizeObserver = null;
        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupResizeObserver();
        this.render();
    }

    setupCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        
        this.width = rect.width;
        this.height = rect.height;
    }

    setupResizeObserver() {
        this.resizeObserver = new ResizeObserver(() => {
            this.setupCanvas();
            this.render();
        });
        this.resizeObserver.observe(this.canvas);
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMoveHandler(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseLeave(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));
    }

    onMouseDown(e) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
    }

    onMouseMoveHandler(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        
        const worldPos = this.screenToWorld(screenX, screenY);
        this.mouseWorldX = worldPos.x;
        this.mouseWorldY = worldPos.y;
        
        if (this.onMouseMove) {
            this.onMouseMove(worldPos.x, worldPos.y, screenX, screenY);
        }
        
        if (this.isDragging) {
            const dx = e.clientX - this.lastMouseX;
            const dy = e.clientY - this.lastMouseY;
            
            this.offsetX += dx;
            this.offsetY += dy;
            
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            
            this.updateViewRangeFromOffset();
            this.render();
        }
    }

    onMouseUp() {
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
    }

    onMouseLeave() {
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
        if (this.onMouseMove) {
            this.onMouseMove(null, null);
        }
    }

    onWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const worldPosBefore = this.screenToWorld(mouseX, mouseY);
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.scale *= zoomFactor;
        
        this.scale = clamp(this.scale, 0.1, 100);
        
        const worldPosAfter = this.screenToWorld(mouseX, mouseY);
        
        const dxScreen = (worldPosBefore.x - worldPosAfter.x) * this.scale * (this.width / (this.xMax - this.xMin));
        const dyScreen = (worldPosAfter.y - worldPosBefore.y) * this.scale * (this.height / (this.yMax - this.yMin));
        
        this.offsetX -= dxScreen;
        this.offsetY -= dyScreen;
        
        this.updateViewRangeFromOffset();
        this.render();
    }

    onTouchStart(e) {
        if (e.touches.length === 1) {
            this.isDragging = true;
            this.lastMouseX = e.touches[0].clientX;
            this.lastMouseY = e.touches[0].clientY;
        }
    }

    onTouchMove(e) {
        if (this.isDragging && e.touches.length === 1) {
            e.preventDefault();
            const dx = e.touches[0].clientX - this.lastMouseX;
            const dy = e.touches[0].clientY - this.lastMouseY;
            
            this.offsetX += dx;
            this.offsetY += dy;
            
            this.lastMouseX = e.touches[0].clientX;
            this.lastMouseY = e.touches[0].clientY;
            
            this.updateViewRangeFromOffset();
            this.render();
        }
    }

    onTouchEnd() {
        this.isDragging = false;
    }

    screenToWorld(screenX, screenY) {
        const centerX = this.width / 2 + this.offsetX;
        const centerY = this.height / 2 + this.offsetY;
        
        const xScale = this.width / (this.xMax - this.xMin) * this.scale;
        const yScale = this.height / (this.yMax - this.yMin) * this.scale;
        
        const x = (screenX - centerX) / xScale;
        const y = (centerY - screenY) / yScale;
        
        return { x, y };
    }

    worldToScreen(worldX, worldY) {
        const centerX = this.width / 2 + this.offsetX;
        const centerY = this.height / 2 + this.offsetY;
        
        const xScale = this.width / (this.xMax - this.xMin) * this.scale;
        const yScale = this.height / (this.yMax - this.yMin) * this.scale;
        
        const screenX = centerX + worldX * xScale;
        const screenY = centerY - worldY * yScale;
        
        return { x: screenX, y: screenY };
    }

    updateViewRangeFromOffset() {
        const center = this.screenToWorld(this.width / 2, this.height / 2);
        const xRange = (this.xMax - this.xMin) / this.scale;
        const yRange = (this.yMax - this.yMin) / this.scale;
        
        this.xMin = center.x - xRange / 2;
        this.xMax = center.x + xRange / 2;
        this.yMin = center.y - yRange / 2;
        this.yMax = center.y + yRange / 2;
        
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1;
    }

    setView(xMin, xMax, yMin, yMax) {
        this.xMin = xMin;
        this.xMax = xMax;
        this.yMin = yMin;
        this.yMax = yMax;
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1;
        this.render();
    }

    zoomIn() {
        this.scale *= 1.2;
        this.updateViewRangeFromOffset();
        this.render();
    }

    zoomOut() {
        this.scale /= 1.2;
        this.updateViewRangeFromOffset();
        this.render();
    }

    resetView() {
        this.setView(-10, 10, -10, 10);
    }

    setCoordinateSystem(system) {
        this.coordinateSystem = system;
        this.render();
    }

    addCurve(curve) {
        if (this.curves.length >= 3) {
            return false;
        }
        this.curves.push(curve);
        this.render();
        return true;
    }

    removeCurve(id) {
        const index = this.curves.findIndex(c => c.id === id);
        if (index !== -1) {
            this.curves.splice(index, 1);
            this.render();
            return true;
        }
        return false;
    }

    updateCurve(id, updates) {
        const curve = this.curves.find(c => c.id === id);
        if (curve) {
            Object.assign(curve, updates);
            this.render();
            return true;
        }
        return false;
    }

    setScatterData(data) {
        this.scatterData = data;
        this.render();
    }

    setFitCurve(curve) {
        this.fitCurve = curve;
        this.render();
    }

    clearScatterData() {
        this.scatterData = null;
        this.fitCurve = null;
        this.render();
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        this.drawBackground();
        
        if (this.coordinateSystem === 'polar') {
            this.renderPolar();
        } else {
            this.renderCartesian();
        }
        
        if (this.showKeyPoints) {
            this.drawKeyPoints();
        }
    }
    
    renderCartesian() {
        if (this.showGrid) {
            this.drawGrid();
        }
        
        if (this.showAxes) {
            this.drawAxes();
        }
        
        if (this.showLabels) {
            this.drawTickLabels();
        }
        
        if (this.scatterData) {
            this.drawScatterPlot();
        }
        
        this.curves.forEach(curve => {
            if (curve.visible !== false) {
                this.drawCurve(curve);
            }
        });
        
        if (this.fitCurve) {
            this.drawFitCurve();
        }
    }
    
    renderPolar() {
        if (this.showGrid) {
            this.drawPolarGrid();
        }
        
        if (this.showAxes) {
            this.drawPolarAxes();
        }
        
        if (this.showLabels) {
            this.drawPolarLabels();
        }
        
        if (this.scatterData) {
            this.drawScatterPlot();
        }
        
        this.curves.forEach(curve => {
            if (curve.visible !== false) {
                this.drawPolarCurve(curve);
            }
        });
        
        if (this.fitCurve) {
            this.drawFitCurve();
        }
    }

    drawBackground() {
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#0a1628');
        gradient.addColorStop(1, '#0d1b2e');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(42, 65, 104, 0.5)';
        this.ctx.lineWidth = 1;
        
        const xStep = getNiceNumber((this.xMax - this.xMin) / 10, true);
        const yStep = getNiceNumber((this.yMax - this.yMin) / 10, true);
        
        const xStart = Math.floor(this.xMin / xStep) * xStep;
        for (let x = xStart; x <= this.xMax; x += xStep) {
            const screenPos = this.worldToScreen(x, 0);
            if (Math.abs(x) < 0.0001) continue;
            this.ctx.beginPath();
            this.ctx.moveTo(screenPos.x, 0);
            this.ctx.lineTo(screenPos.x, this.height);
            this.ctx.stroke();
        }
        
        const yStart = Math.floor(this.yMin / yStep) * yStep;
        for (let y = yStart; y <= this.yMax; y += yStep) {
            const screenPos = this.worldToScreen(0, y);
            if (Math.abs(y) < 0.0001) continue;
            this.ctx.beginPath();
            this.ctx.moveTo(0, screenPos.y);
            this.ctx.lineTo(this.width, screenPos.y);
            this.ctx.stroke();
        }
        
        this.ctx.strokeStyle = 'rgba(42, 65, 104, 0.2)';
        this.ctx.lineWidth = 1;
        
        for (let i = 0; i < 5; i++) {
            const xSubStep = xStep / 5;
            for (let x = xStart + i * xSubStep; x <= this.xMax; x += xStep) {
                const screenPos = this.worldToScreen(x, 0);
                if (Math.abs(x) < 0.0001) continue;
                this.ctx.beginPath();
                this.ctx.moveTo(screenPos.x, 0);
                this.ctx.lineTo(screenPos.x, this.height);
                this.ctx.stroke();
            }
        }
        
        for (let i = 0; i < 5; i++) {
            const ySubStep = yStep / 5;
            for (let y = yStart + i * ySubStep; y <= this.yMax; y += yStep) {
                const screenPos = this.worldToScreen(0, y);
                if (Math.abs(y) < 0.0001) continue;
                this.ctx.beginPath();
                this.ctx.moveTo(0, screenPos.y);
                this.ctx.lineTo(this.width, screenPos.y);
                this.ctx.stroke();
            }
        }
    }

    drawAxes() {
        const origin = this.worldToScreen(0, 0);
        
        this.ctx.strokeStyle = '#6b82a5';
        this.ctx.lineWidth = 2;
        
        if (origin.x >= 0 && origin.x <= this.width) {
            this.ctx.beginPath();
            this.ctx.moveTo(origin.x, 0);
            this.ctx.lineTo(origin.x, this.height);
            this.ctx.stroke();
        }
        
        if (origin.y >= 0 && origin.y <= this.height) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, origin.y);
            this.ctx.lineTo(this.width, origin.y);
            this.ctx.stroke();
        }
        
        this.ctx.fillStyle = '#6b82a5';
        
        if (origin.x >= 0 && origin.x <= this.width) {
            this.ctx.beginPath();
            this.ctx.moveTo(origin.x, 10);
            this.ctx.lineTo(origin.x - 5, 20);
            this.ctx.lineTo(origin.x + 5, 20);
            this.ctx.closePath();
            this.ctx.fill();
        }
        
        if (origin.y >= 0 && origin.y <= this.height) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.width - 10, origin.y);
            this.ctx.lineTo(this.width - 20, origin.y - 5);
            this.ctx.lineTo(this.width - 20, origin.y + 5);
            this.ctx.closePath();
            this.ctx.fill();
        }
        
        this.ctx.font = '12px sans-serif';
        this.ctx.fillStyle = '#9fb3d1';
        
        if (origin.x >= 0 && origin.x <= this.width) {
            this.ctx.fillText('y', origin.x + 8, 18);
        }
        
        if (origin.y >= 0 && origin.y <= this.height) {
            this.ctx.fillText('x', this.width - 15, origin.y - 8);
        }
    }

    drawTickLabels() {
        const xStep = getNiceNumber((this.xMax - this.xMin) / 10, true);
        const yStep = getNiceNumber((this.yMax - this.yMin) / 10, true);
        
        this.ctx.font = '11px sans-serif';
        this.ctx.fillStyle = '#6b82a5';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        
        const origin = this.worldToScreen(0, 0);
        const labelY = Math.min(Math.max(origin.y + 5, 5), this.height - 18);
        
        const xStart = Math.floor(this.xMin / xStep) * xStep;
        for (let x = xStart; x <= this.xMax; x += xStep) {
            if (Math.abs(x) < 0.0001) continue;
            const screenPos = this.worldToScreen(x, 0);
            if (screenPos.x > 20 && screenPos.x < this.width - 20) {
                const label = formatNumber(x, 2);
                this.ctx.fillText(label, screenPos.x, labelY);
            }
        }
        
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'middle';
        
        const labelX = Math.min(Math.max(origin.x - 8, 25), this.width - 5);
        
        const yStart = Math.floor(this.yMin / yStep) * yStep;
        for (let y = yStart; y <= this.yMax; y += yStep) {
            if (Math.abs(y) < 0.0001) continue;
            const screenPos = this.worldToScreen(0, y);
            if (screenPos.y > 15 && screenPos.y < this.height - 10) {
                const label = formatNumber(y, 2);
                this.ctx.fillText(label, labelX, screenPos.y);
            }
        }
        
        if (origin.x >= 0 && origin.x <= this.width && origin.y >= 0 && origin.y <= this.height) {
            this.ctx.textAlign = 'right';
            this.ctx.textBaseline = 'top';
            this.ctx.fillText('0', origin.x - 6, origin.y + 5);
        }
    }

    drawCurve(curve) {
        if (!curve.evaluator && !curve.func) return;
        
        const evaluator = curve.evaluator || curve.func;
        if (typeof evaluator !== 'function') return;
        
        this.ctx.strokeStyle = curve.color || '#00d4ff';
        this.ctx.lineWidth = curve.lineWidth || 2;
        
        if (curve.lineStyle === 'dashed') {
            this.ctx.setLineDash([8, 6]);
        } else if (curve.lineStyle === 'dotted') {
            this.ctx.setLineDash([2, 4]);
        } else {
            this.ctx.setLineDash([]);
        }
        
        this.ctx.beginPath();
        
        const xMin = (curve.xMin !== null && curve.xMin !== undefined) ? curve.xMin : this.xMin;
        const xMax = (curve.xMax !== null && curve.xMax !== undefined) ? curve.xMax : this.xMax;
        let step = (curve.step !== null && curve.step !== undefined) ? curve.step : ((xMax - xMin) / this.width * 2);
        
        if (step <= 0 || !isFinite(step)) {
            step = (xMax - xMin) / this.width * 2;
        }
        
        let isFirstPoint = true;
        let lastY = null;
        let lastScreenPos = null;
        
        for (let x = xMin; x <= xMax + step / 2; x += step) {
            let y;
            try {
                y = evaluator(x);
            } catch (e) {
                y = NaN;
            }
            
            if (typeof y === 'number' && isFinite(y)) {
                if (lastY !== null && (y > this.yMax * 100 || y < this.yMin * 100)) {
                    isFirstPoint = true;
                }
                
                const screenPos = this.worldToScreen(x, y);
                
                let shouldBreak = isFirstPoint;
                if (!shouldBreak && lastScreenPos && lastY !== null) {
                    const dx = screenPos.x - lastScreenPos.x;
                    const dy = screenPos.y - lastScreenPos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > Math.max(this.width, this.height) * 0.3) {
                        shouldBreak = true;
                    }
                    if (Math.abs(y - lastY) >= (this.yMax - this.yMin) * 10) {
                        shouldBreak = true;
                    }
                }
                
                if (shouldBreak) {
                    this.ctx.moveTo(screenPos.x, screenPos.y);
                    isFirstPoint = false;
                } else {
                    this.ctx.lineTo(screenPos.x, screenPos.y);
                }
                
                lastY = y;
                lastScreenPos = screenPos;
            } else {
                isFirstPoint = true;
                lastY = null;
                lastScreenPos = null;
            }
        }
        
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    drawScatterPlot() {
        if (!this.scatterData || !this.scatterData.x || !this.scatterData.y) return;
        
        const { x, y } = this.scatterData;
        
        this.ctx.fillStyle = '#a78bfa';
        this.ctx.strokeStyle = 'rgba(167, 139, 250, 0.5)';
        this.ctx.lineWidth = 1;
        
        for (let i = 0; i < x.length; i++) {
            const screenPos = this.worldToScreen(x[i], y[i]);
            
            if (screenPos.x >= 0 && screenPos.x <= this.width &&
                screenPos.y >= 0 && screenPos.y <= this.height) {
                this.ctx.beginPath();
                this.ctx.arc(screenPos.x, screenPos.y, 4, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
            }
        }
    }

    drawFitCurve() {
        if (!this.fitCurve || !this.fitCurve.evaluator) return;
        
        this.ctx.strokeStyle = this.fitCurve.color || '#34d399';
        this.ctx.lineWidth = this.fitCurve.lineWidth || 2;
        
        if (this.fitCurve.lineStyle === 'dashed') {
            this.ctx.setLineDash([8, 6]);
        } else {
            this.ctx.setLineDash([6, 4]);
        }
        
        this.ctx.beginPath();
        
        const step = (this.xMax - this.xMin) / this.width * 2;
        let isFirstPoint = true;
        
        for (let x = this.xMin; x <= this.xMax; x += step) {
            let y;
            try {
                y = this.fitCurve.evaluator(x);
            } catch (e) {
                y = NaN;
            }
            
            if (typeof y === 'number' && isFinite(y)) {
                const screenPos = this.worldToScreen(x, y);
                
                if (isFirstPoint) {
                    this.ctx.moveTo(screenPos.x, screenPos.y);
                    isFirstPoint = false;
                } else {
                    this.ctx.lineTo(screenPos.x, screenPos.y);
                }
            } else {
                isFirstPoint = true;
            }
        }
        
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    drawKeyPoints() {
        this.curves.forEach(curve => {
            if (curve.visible === false) return;
            if (!curve.evaluator) return;
            
            const evaluator = curve.evaluator;
            
            const zeros = this.findZeros(evaluator);
            
            zeros.forEach(x => {
                const screenPos = this.worldToScreen(x, 0);
                this.ctx.fillStyle = curve.color || '#00d4ff';
                this.ctx.beginPath();
                this.ctx.arc(screenPos.x, screenPos.y, 5, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.font = '10px monospace';
                this.ctx.fillStyle = '#fff';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`(${formatNumber(x, 2)}, 0)`, screenPos.x, screenPos.y - 8);
            });
        });
    }

    findZeros(evaluator) {
        const zeros = [];
        const step = (this.xMax - this.xMin) / 500;
        let prevY = evaluator(this.xMin);
        
        for (let x = this.xMin + step; x <= this.xMax; x += step) {
            const y = evaluator(x);
            if (prevY * y < 0) {
                const zeroX = this.bisection(evaluator, x - step, x);
                if (zeroX !== null) {
                    zeros.push(zeroX);
                }
            }
            prevY = y;
        }
        
        return zeros;
    }

    bisection(func, a, b, tolerance = 0.0001, maxIterations = 50) {
        let fa = func(a);
        
        for (let i = 0; i < maxIterations; i++) {
            const c = (a + b) / 2;
            const fc = func(c);
            
            if (Math.abs(fc) < tolerance || (b - a) / 2 < tolerance) {
                return c;
            }
            
            if (fa * fc < 0) {
                b = c;
            } else {
                a = c;
                fa = fc;
            }
        }
        
        return (a + b) / 2;
    }

    exportPNG() {
        return this.canvas.toDataURL('image/png');
    }

    exportSVG(curvesInfo = null, viewInfo = null, fitInfo = null, coordSystem = '直角坐标系') {
        const cssDpr = window.devicePixelRatio || 1;
        const graphW = this.width / cssDpr;
        const graphH = this.height / cssDpr;
        
        const headerHeight = 100 + (curvesInfo ? curvesInfo.length * 28 : 0) + (fitInfo ? 56 : 0);
        const totalH = graphH + headerHeight;
        
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${graphW}" height="${totalH}" viewBox="0 0 ${graphW} ${totalH}">`;
        
        svg += `<defs>
            <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#0a1628;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0d1b2e;stop-opacity:1" />
            </linearGradient>
        </defs>`;
        
        svg += `<rect width="${graphW}" height="${totalH}" fill="url(#bgGradient)"/>`;
        
        let y = 20;
        const now = new Date();
        const dateStr = now.toLocaleString('zh-CN');
        
        svg += `<text x="24" y="${y}" font-family="sans-serif" font-size="16" font-weight="bold" fill="#e8f0ff">公式编辑器 &amp; 函数绘图</text>`;
        svg += `<text x="${graphW - 24}" y="${y + 3}" font-family="sans-serif" font-size="12" fill="#6b82a5" text-anchor="end">${this.escapeXml(dateStr)}</text>`;
        y += 28;
        
        svg += `<line x1="24" y1="${y}" x2="${graphW - 24}" y2="${y}" stroke="#2a4168" stroke-width="1"/>`;
        y += 12;
        
        if (viewInfo) {
            const viewText = coordSystem + '    ' + 
                `视图范围: x [${formatNumber(viewInfo.xMin, 2)}, ${formatNumber(viewInfo.xMax, 2)}], y [${formatNumber(viewInfo.yMin, 2)}, ${formatNumber(viewInfo.yMax, 2)}]`;
            svg += `<text x="24" y="${y + 12}" font-family="sans-serif" font-size="12" fill="#9fb3d1">${this.escapeXml(viewText)}</text>`;
            y += 24;
        }
        
        if (curvesInfo && curvesInfo.length > 0) {
            svg += `<text x="24" y="${y + 12}" font-family="sans-serif" font-size="12" font-weight="bold" fill="#9fb3d1">曲线列表：</text>`;
            y += 20;
            
            curvesInfo.forEach((info, idx) => {
                svg += `<rect x="32" y="${y + 6}" width="20" height="4" fill="${info.color}"/>`;
                
                let styleText = '';
                if (info.lineStyle === 'dashed') {
                    styleText = ' [虚线]';
                } else if (info.lineStyle === 'dotted') {
                    styleText = ' [点线]';
                }
                
                let rangeText = '';
                if (info.xMin !== null && info.xMin !== undefined && info.xMax !== null && info.xMax !== undefined) {
                    rangeText = `    范围: [${formatNumber(info.xMin, 2)}, ${formatNumber(info.xMax, 2)}]`;
                }
                if (info.step !== null && info.step !== undefined) {
                    rangeText += `    步长: ${formatNumber(info.step, 4)}`;
                }
                
                const funcName = info.variable ? `r(${info.variable})` : 'f(x)';
                const formulaText = `${idx + 1}. ${funcName} = ${info.formula}${styleText}${rangeText}`;
                svg += `<text x="64" y="${y + 12}" font-family="monospace" font-size="12" fill="#e8f0ff">${this.escapeXml(formulaText)}</text>`;
                y += 28;
            });
        }
        
        if (fitInfo) {
            svg += `<text x="24" y="${y + 12}" font-family="sans-serif" font-size="12" font-weight="bold" fill="#9fb3d1">拟合结果：</text>`;
            y += 20;
            svg += `<rect x="32" y="${y + 6}" width="20" height="4" fill="#34d399"/>`;
            svg += `<text x="64" y="${y + 12}" font-family="monospace" font-size="12" fill="#e8f0ff">y = ${this.escapeXml(fitInfo.formula)}    R² = ${fitInfo.rSquared.toFixed(6)}</text>`;
            y += 28;
        }
        
        y += 4;
        svg += `<line x1="24" y1="${y}" x2="${graphW - 24}" y2="${y}" stroke="#2a4168" stroke-width="1"/>`;
        y += 8;
        
        const transformY = y;
        const scaleX = graphW / this.width;
        const scaleY = graphH / this.height;
        const scale = Math.min(scaleX, scaleY);
        const offsetX = (graphW - this.width * scale) / 2;
        
        svg += `<g transform="translate(${offsetX}, ${transformY}) scale(${scale})">`;
        
        if (this.showGrid) {
            if (this.coordinateSystem === 'polar') {
                svg += this.generatePolarGridSVG();
            } else {
                svg += this.generateGridSVG();
            }
        }
        
        if (this.showAxes) {
            if (this.coordinateSystem === 'polar') {
                svg += this.generatePolarAxesSVG();
            } else {
                svg += this.generateAxesSVG();
            }
        }
        
        if (this.scatterData) {
            svg += this.generateScatterSVG();
        }
        
        this.curves.forEach(curve => {
            if (curve.visible !== false) {
                if (this.coordinateSystem === 'polar') {
                    svg += this.generatePolarCurveSVG(curve);
                } else {
                    svg += this.generateCurveSVG(curve);
                }
            }
        });
        
        if (this.fitCurve) {
            svg += this.generateFitCurveSVG();
        }
        
        svg += `</g>`;
        
        svg += '</svg>';
        return svg;
    }
    
    escapeXml(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[<>&'"]/g, (c) => ({
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            "'": '&apos;',
            '"': '&quot;'
        }[c]));
    }
    
    generatePolarGridSVG() {
        let svg = '';
        const center = this.worldToScreen(0, 0);
        const maxR = Math.max(Math.abs(this.xMax), Math.abs(this.xMin), Math.abs(this.yMax), Math.abs(this.yMin));
        const rStep = getNiceNumber(maxR / 5, true);
        
        for (let r = rStep; r <= maxR; r += rStep) {
            const screenPos = this.worldToScreen(r, 0);
            const radius = Math.abs(screenPos.x - center.x);
            if (radius > 0) {
                svg += `<circle cx="${center.x}" cy="${center.y}" r="${radius}" fill="none" stroke="rgba(42,65,104,0.5)" stroke-width="1"/>`;
            }
        }
        
        const angleStep = Math.PI / 6;
        for (let theta = 0; theta < Math.PI * 2; theta += angleStep) {
            const x = maxR * Math.cos(theta);
            const y = maxR * Math.sin(theta);
            const screenPos = this.worldToScreen(x, y);
            svg += `<line x1="${center.x}" y1="${center.y}" x2="${screenPos.x}" y2="${screenPos.y}" stroke="rgba(42,65,104,0.5)" stroke-width="1"/>`;
        }
        
        return svg;
    }
    
    generatePolarAxesSVG() {
        let svg = '';
        const center = this.worldToScreen(0, 0);
        const maxR = Math.max(Math.abs(this.xMax), Math.abs(this.xMin), Math.abs(this.yMax), Math.abs(this.yMin));
        
        const rightPos = this.worldToScreen(maxR, 0);
        svg += `<line x1="${center.x}" y1="${center.y}" x2="${rightPos.x}" y2="${rightPos.y}" stroke="#6b82a5" stroke-width="2"/>`;
        svg += `<text x="${rightPos.x + 5}" y="${rightPos.y + 4}" font-family="sans-serif" font-size="12" fill="#6b82a5">0°</text>`;
        
        const topPos = this.worldToScreen(0, maxR);
        svg += `<text x="${topPos.x - 15}" y="${topPos.y - 5}" font-family="sans-serif" font-size="12" fill="#6b82a5">90°</text>`;
        
        const leftPos = this.worldToScreen(-maxR, 0);
        svg += `<text x="${leftPos.x - 30}" y="${leftPos.y + 4}" font-family="sans-serif" font-size="12" fill="#6b82a5">180°</text>`;
        
        const bottomPos = this.worldToScreen(0, -maxR);
        svg += `<text x="${bottomPos.x - 15}" y="${bottomPos.y + 15}" font-family="sans-serif" font-size="12" fill="#6b82a5">270°</text>`;
        
        return svg;
    }
    
    generatePolarCurveSVG(curve) {
        if (!curve.evaluator) return '';
        
        const evaluator = curve.evaluator;
        const thetaStart = (curve.xMin !== null && curve.xMin !== undefined) ? curve.xMin : 0;
        const thetaEnd = (curve.xMax !== null && curve.xMax !== undefined) ? curve.xMax : Math.PI * 2;
        let thetaStep = (curve.step !== null && curve.step !== undefined) ? curve.step : 0.01;
        
        if (thetaStep <= 0 || !isFinite(thetaStep)) {
            thetaStep = 0.01;
        }
        
        let pathData = '';
        let isFirstPoint = true;
        let lastScreenPos = null;
        
        for (let theta = thetaStart; theta <= thetaEnd + thetaStep / 2; theta += thetaStep) {
            let r;
            try {
                r = evaluator(theta);
            } catch (e) {
                r = NaN;
            }
            
            if (typeof r === 'number' && isFinite(r)) {
                const actualR = Math.abs(r);
                const actualTheta = r < 0 ? theta + Math.PI : theta;
                
                const x = actualR * Math.cos(actualTheta);
                const y = actualR * Math.sin(actualTheta);
                const screenPos = this.worldToScreen(x, y);
                
                let shouldBreak = isFirstPoint;
                
                if (!shouldBreak && lastScreenPos) {
                    const dx = screenPos.x - lastScreenPos.x;
                    const dy = screenPos.y - lastScreenPos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > Math.max(this.width, this.height) * 0.3) {
                        shouldBreak = true;
                    }
                }
                
                if (shouldBreak) {
                    pathData += `M ${screenPos.x} ${screenPos.y}`;
                    isFirstPoint = false;
                } else {
                    pathData += ` L ${screenPos.x} ${screenPos.y}`;
                }
                
                lastScreenPos = screenPos;
            } else {
                isFirstPoint = true;
                lastScreenPos = null;
            }
        }
        
        if (!pathData) return '';
        
        let dashArray = '';
        if (curve.lineStyle === 'dashed') {
            dashArray = ' stroke-dasharray="8,6"';
        } else if (curve.lineStyle === 'dotted') {
            dashArray = ' stroke-dasharray="2,4"';
        }
        
        return `<path d="${pathData}" fill="none" stroke="${curve.color || '#00d4ff'}" stroke-width="${curve.lineWidth || 2}"${dashArray}/>`;
    }

    generateGridSVG() {
        let svg = '';
        const xStep = getNiceNumber((this.xMax - this.xMin) / 10, true);
        const yStep = getNiceNumber((this.yMax - this.yMin) / 10, true);
        
        const xStart = Math.floor(this.xMin / xStep) * xStep;
        for (let x = xStart; x <= this.xMax; x += xStep) {
            if (Math.abs(x) < 0.0001) continue;
            const screenPos = this.worldToScreen(x, 0);
            svg += `<line x1="${screenPos.x}" y1="0" x2="${screenPos.x}" y2="${this.height}" stroke="rgba(42,65,104,0.5)" stroke-width="1"/>`;
        }
        
        const yStart = Math.floor(this.yMin / yStep) * yStep;
        for (let y = yStart; y <= this.yMax; y += yStep) {
            if (Math.abs(y) < 0.0001) continue;
            const screenPos = this.worldToScreen(0, y);
            svg += `<line x1="0" y1="${screenPos.y}" x2="${this.width}" y2="${screenPos.y}" stroke="rgba(42,65,104,0.5)" stroke-width="1"/>`;
        }
        
        return svg;
    }

    generateAxesSVG() {
        let svg = '';
        const origin = this.worldToScreen(0, 0);
        
        if (origin.x >= 0 && origin.x <= this.width) {
            svg += `<line x1="${origin.x}" y1="0" x2="${origin.x}" y2="${this.height}" stroke="#6b82a5" stroke-width="2"/>`;
        }
        
        if (origin.y >= 0 && origin.y <= this.height) {
            svg += `<line x1="0" y1="${origin.y}" x2="${this.width}" y2="${origin.y}" stroke="#6b82a5" stroke-width="2"/>`;
        }
        
        return svg;
    }

    generateCurveSVG(curve) {
        if (!curve.evaluator) return '';
        
        const evaluator = curve.evaluator;
        const xMin = (curve.xMin !== null && curve.xMin !== undefined) ? curve.xMin : this.xMin;
        const xMax = (curve.xMax !== null && curve.xMax !== undefined) ? curve.xMax : this.xMax;
        let step = (curve.step !== null && curve.step !== undefined) ? curve.step : ((xMax - xMin) / this.width * 2);
        
        if (step <= 0 || !isFinite(step)) {
            step = (xMax - xMin) / this.width * 2;
        }
        
        let pathData = '';
        let isFirstPoint = true;
        let lastScreenPos = null;
        
        for (let x = xMin; x <= xMax + step / 2; x += step) {
            let y;
            try {
                y = evaluator(x);
            } catch (e) {
                y = NaN;
            }
            
            if (typeof y === 'number' && isFinite(y)) {
                const screenPos = this.worldToScreen(x, y);
                
                let shouldBreak = isFirstPoint;
                if (!shouldBreak && lastScreenPos) {
                    const dx = screenPos.x - lastScreenPos.x;
                    const dy = screenPos.y - lastScreenPos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > Math.max(this.width, this.height) * 0.3) {
                        shouldBreak = true;
                    }
                }
                
                if (shouldBreak) {
                    pathData += `M ${screenPos.x} ${screenPos.y}`;
                    isFirstPoint = false;
                } else {
                    pathData += ` L ${screenPos.x} ${screenPos.y}`;
                }
                
                lastScreenPos = screenPos;
            } else {
                isFirstPoint = true;
                lastScreenPos = null;
            }
        }
        
        if (!pathData) return '';
        
        let dashArray = '';
        if (curve.lineStyle === 'dashed') {
            dashArray = ' stroke-dasharray="8,6"';
        } else if (curve.lineStyle === 'dotted') {
            dashArray = ' stroke-dasharray="2,4"';
        }
        
        return `<path d="${pathData}" fill="none" stroke="${curve.color || '#00d4ff'}" stroke-width="${curve.lineWidth || 2}"${dashArray}/>`;
    }

    generateScatterSVG() {
        if (!this.scatterData) return '';
        
        let svg = '';
        const { x, y } = this.scatterData;
        
        for (let i = 0; i < x.length; i++) {
            const screenPos = this.worldToScreen(x[i], y[i]);
            svg += `<circle cx="${screenPos.x}" cy="${screenPos.y}" r="4" fill="#a78bfa" stroke="rgba(167,139,250,0.5)" stroke-width="1"/>`;
        }
        
        return svg;
    }

    generateFitCurveSVG() {
        if (!this.fitCurve || !this.fitCurve.evaluator) return '';
        
        const evaluator = this.fitCurve.evaluator;
        const step = (this.xMax - this.xMin) / this.width * 2;
        let pathData = '';
        let isFirstPoint = true;
        
        for (let x = this.xMin; x <= this.xMax; x += step) {
            let y;
            try {
                y = evaluator(x);
            } catch (e) {
                y = NaN;
            }
            
            if (typeof y === 'number' && isFinite(y)) {
                const screenPos = this.worldToScreen(x, y);
                if (isFirstPoint) {
                    pathData += `M ${screenPos.x} ${screenPos.y}`;
                    isFirstPoint = false;
                } else {
                    pathData += ` L ${screenPos.x} ${screenPos.y}`;
                }
            } else {
                isFirstPoint = true;
            }
        }
        
        if (!pathData) return '';
        
        return `<path d="${pathData}" fill="none" stroke="${this.fitCurve.color || '#34d399'}" stroke-width="${this.fitCurve.lineWidth || 2}" stroke-dasharray="6,4"/>`;
    }

    getCurveCount() {
        return this.curves.length;
    }

    drawPolarGrid() {
        const center = this.worldToScreen(0, 0);
        const maxR = Math.max(Math.abs(this.xMax), Math.abs(this.xMin), Math.abs(this.yMax), Math.abs(this.yMin));
        
        const rStep = getNiceNumber(maxR / 5, true);
        
        this.ctx.strokeStyle = 'rgba(42, 65, 104, 0.5)';
        this.ctx.lineWidth = 1;
        
        for (let r = rStep; r <= maxR; r += rStep) {
            const screenPos = this.worldToScreen(r, 0);
            const radius = Math.abs(screenPos.x - center.x);
            
            if (radius > 0) {
                this.ctx.beginPath();
                this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        }
        
        const angleStep = Math.PI / 6;
        for (let theta = 0; theta < Math.PI * 2; theta += angleStep) {
            const x = maxR * Math.cos(theta);
            const y = maxR * Math.sin(theta);
            const screenPos = this.worldToScreen(x, y);
            
            this.ctx.beginPath();
            this.ctx.moveTo(center.x, center.y);
            this.ctx.lineTo(screenPos.x, screenPos.y);
            this.ctx.stroke();
        }
    }
    
    drawPolarAxes() {
        const center = this.worldToScreen(0, 0);
        const maxR = Math.max(Math.abs(this.xMax), Math.abs(this.xMin), Math.abs(this.yMax), Math.abs(this.yMin));
        
        this.ctx.strokeStyle = '#6b82a5';
        this.ctx.lineWidth = 2;
        
        const rightPos = this.worldToScreen(maxR, 0);
        this.ctx.beginPath();
        this.ctx.moveTo(center.x, center.y);
        this.ctx.lineTo(rightPos.x, rightPos.y);
        this.ctx.stroke();
        
        this.ctx.fillStyle = '#6b82a5';
        this.ctx.font = '12px sans-serif';
        this.ctx.fillText('0°', rightPos.x + 5, rightPos.y + 4);
        
        const topPos = this.worldToScreen(0, maxR);
        this.ctx.fillStyle = '#6b82a5';
        this.ctx.fillText('90°', topPos.x - 15, topPos.y - 5);
        
        const leftPos = this.worldToScreen(-maxR, 0);
        this.ctx.fillText('180°', leftPos.x - 30, leftPos.y + 4);
        
        const bottomPos = this.worldToScreen(0, -maxR);
        this.ctx.fillText('270°', bottomPos.x - 15, bottomPos.y + 15);
    }
    
    drawPolarLabels() {
        const center = this.worldToScreen(0, 0);
        const maxR = Math.max(Math.abs(this.xMax), Math.abs(this.xMin), Math.abs(this.yMax), Math.abs(this.yMin));
        const rStep = getNiceNumber(maxR / 5, true);
        
        this.ctx.font = '10px sans-serif';
        this.ctx.fillStyle = '#6b82a5';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        
        for (let r = rStep; r <= maxR; r += rStep) {
            const screenPos = this.worldToScreen(r, 0);
            const label = formatNumber(r, 2);
            this.ctx.fillText(label, screenPos.x + 4, center.y + 12);
        }
    }
    
    drawPolarCurve(curve) {
        if (!curve.evaluator && !curve.func) return;
        
        const evaluator = curve.evaluator || curve.func;
        if (typeof evaluator !== 'function') return;
        
        this.ctx.strokeStyle = curve.color || '#00d4ff';
        this.ctx.lineWidth = curve.lineWidth || 2;
        
        if (curve.lineStyle === 'dashed') {
            this.ctx.setLineDash([8, 6]);
        } else if (curve.lineStyle === 'dotted') {
            this.ctx.setLineDash([2, 4]);
        } else {
            this.ctx.setLineDash([]);
        }
        
        this.ctx.beginPath();
        
        const thetaStart = (curve.xMin !== null && curve.xMin !== undefined) ? curve.xMin : 0;
        const thetaEnd = (curve.xMax !== null && curve.xMax !== undefined) ? curve.xMax : Math.PI * 2;
        let thetaStep = (curve.step !== null && curve.step !== undefined) ? curve.step : 0.01;
        
        if (thetaStep <= 0 || !isFinite(thetaStep)) {
            thetaStep = 0.01;
        }
        
        let isFirstPoint = true;
        let lastScreenPos = null;
        let lastR = null;
        
        for (let theta = thetaStart; theta <= thetaEnd + thetaStep / 2; theta += thetaStep) {
            let r;
            try {
                r = evaluator(theta);
            } catch (e) {
                r = NaN;
            }
            
            if (typeof r === 'number' && isFinite(r)) {
                const actualR = Math.abs(r);
                const actualTheta = r < 0 ? theta + Math.PI : theta;
                
                const x = actualR * Math.cos(actualTheta);
                const y = actualR * Math.sin(actualTheta);
                const screenPos = this.worldToScreen(x, y);
                
                let shouldBreak = isFirstPoint;
                
                if (!shouldBreak && lastScreenPos && lastR !== null) {
                    const dx = screenPos.x - lastScreenPos.x;
                    const dy = screenPos.y - lastScreenPos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > Math.max(this.width, this.height) * 0.3) {
                        shouldBreak = true;
                    }
                }
                
                if (shouldBreak) {
                    this.ctx.moveTo(screenPos.x, screenPos.y);
                    isFirstPoint = false;
                } else {
                    this.ctx.lineTo(screenPos.x, screenPos.y);
                }
                
                lastScreenPos = screenPos;
                lastR = r;
            } else {
                isFirstPoint = true;
                lastScreenPos = null;
            }
        }
        
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    serialize() {
        return {
            coordinateSystem: this.coordinateSystem,
            xMin: this.xMin,
            xMax: this.xMax,
            yMin: this.yMin,
            yMax: this.yMax,
            showGrid: this.showGrid,
            showAxes: this.showAxes,
            showLabels: this.showLabels,
            showKeyPoints: this.showKeyPoints,
            curves: this.curves.map(c => ({
                id: c.id,
                color: c.color,
                lineStyle: c.lineStyle,
                lineWidth: c.lineWidth,
                visible: c.visible,
                formula: c.formula,
                variable: c.variable,
                latex: c.latex,
                jsExpression: c.jsExpression,
                xMin: c.xMin,
                xMax: c.xMax,
                step: c.step
            }))
        };
    }
}
