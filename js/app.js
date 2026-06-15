import { FormulaEditor } from './formula-editor.js';
import { GraphEngine } from './graph-engine.js';
import { DataFitter } from './data-fitter.js';
import { StorageManager } from './storage-manager.js';
import { generateId, downloadFile, downloadCanvasAsPNG, formatNumber } from './utils.js';

const CURVE_COLORS = ['#00d4ff', '#a78bfa', '#fb923c'];
const LINE_STYLES = ['solid', 'dashed', 'dotted'];

class App {
    constructor() {
        this.formulaEditor = null;
        this.graphEngine = null;
        this.dataFitter = null;
        this.storageManager = null;
        
        this.currentCurveId = null;
        
        this.init();
    }

    init() {
        this.waitForKaTeX().then(() => {
            this.initModules();
            this.bindEvents();
            this.updateUI();
        });
    }

    waitForKaTeX() {
        return new Promise((resolve) => {
            if (window.katex) {
                resolve();
            } else {
                const check = () => {
                    if (window.katex) {
                        resolve();
                    } else {
                        setTimeout(check, 50);
                    }
                };
                check();
            }
        });
    }

    initModules() {
        const formulaPreview = document.getElementById('formulaPreview');
        const formulaInput = document.getElementById('formulaInput');
        this.formulaEditor = new FormulaEditor(formulaPreview, formulaInput);
        
        const canvas = document.getElementById('graphCanvas');
        this.graphEngine = new GraphEngine(canvas);
        
        this.dataFitter = new DataFitter();
        
        this.storageManager = new StorageManager();
    }

    bindEvents() {
        this.bindOperatorButtons();
        this.bindFormulaActions();
        this.bindVariableSettings();
        this.bindAddCurve();
        this.bindGraphControls();
        this.bindDisplayOptions();
        this.bindViewRange();
        this.bindCoordSystem();
        this.bindDataFitter();
        this.bindStorage();
        this.bindExport();
        this.bindMouseTooltip();
    }

    bindOperatorButtons() {
        document.querySelectorAll('.op-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const op = btn.dataset.op;
                const value = btn.dataset.value;
                
                switch (op) {
                    case 'number':
                        this.formulaEditor.insertNumber(value);
                        break;
                    case 'operator':
                        this.formulaEditor.insertOperator(value);
                        break;
                    case 'paren':
                        this.formulaEditor.insertParen(value);
                        break;
                    case 'variable':
                        this.formulaEditor.insertVariable(value);
                        break;
                    case 'constant':
                        this.formulaEditor.insertConstant(value);
                        break;
                    case 'function':
                        this.formulaEditor.insertFunction(value);
                        break;
                    case 'power':
                        this.formulaEditor.insertPower();
                        break;
                    case 'sqrt':
                        this.formulaEditor.insertFunction('sqrt');
                        break;
                    case 'fraction':
                        this.formulaEditor.insertFraction();
                        break;
                    case 'abs':
                        this.formulaEditor.insertFunction('abs');
                        break;
                    case 'sum':
                        this.formulaEditor.insertSum();
                        break;
                    case 'integral':
                        this.formulaEditor.insertIntegral();
                        break;
                }
                
                btn.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    btn.style.transform = '';
                }, 100);
            });
        });
    }

    bindFormulaActions() {
        document.getElementById('btnClear').addEventListener('click', () => {
            this.formulaEditor.clear();
        });
        
        document.getElementById('btnBackspace').addEventListener('click', () => {
            this.formulaEditor.backspace();
        });
        
        document.addEventListener('keydown', (e) => {
            if (document.activeElement.tagName === 'INPUT') return;
            
            if (e.key === 'Backspace') {
                e.preventDefault();
                this.formulaEditor.backspace();
            } else if (e.key === 'Escape') {
                this.formulaEditor.clear();
            } else if (/^[0-9]$/.test(e.key)) {
                e.preventDefault();
                this.formulaEditor.insertNumber(e.key);
            } else if (['+', '-', '*', '/'].includes(e.key)) {
                e.preventDefault();
                this.formulaEditor.insertOperator(e.key);
            } else if (e.key === '(' || e.key === ')') {
                e.preventDefault();
                this.formulaEditor.insertParen(e.key);
            } else if (e.key === '.') {
                e.preventDefault();
                this.formulaEditor.insertNumber('.');
            } else if (/^[a-zA-Z]$/.test(e.key)) {
                e.preventDefault();
                const key = e.key.toLowerCase();
                if (key === 'x' || key === 't') {
                    this.formulaEditor.insertVariable(key);
                } else if (key === 'p') {
                    this.formulaEditor.insertConstant('pi');
                }
            } else if (e.key === '^') {
                e.preventDefault();
                this.formulaEditor.insertPower();
            }
        });
        
        this.formulaEditor.onChange = () => {
            this.updateStatus();
        };
    }

    bindVariableSettings() {
        const variableSelect = document.getElementById('variableSelect');
        variableSelect.addEventListener('change', (e) => {
            this.formulaEditor.setVariable(e.target.value);
        });
    }

    bindAddCurve() {
        document.getElementById('btnAddCurve').addEventListener('click', () => {
            this.addCurve();
        });
    }

    addCurve() {
        if (this.graphEngine.getCurveCount() >= 3) {
            alert('最多只能添加 3 条曲线');
            return;
        }
        
        if (this.formulaEditor.isEmpty()) {
            alert('请先输入公式');
            return;
        }
        
        if (!this.formulaEditor.isValid()) {
            alert('公式无效，请检查公式');
            return;
        }
        
        const curveIndex = this.graphEngine.getCurveCount();
        const evaluator = this.formulaEditor.createEvaluator();
        const variable = this.formulaEditor.variable;
        const formulaStr = this.formulaEditor.getFormulaString();
        const latex = this.formulaEditor.getLaTeX();
        
        const curve = {
            id: generateId(),
            color: CURVE_COLORS[curveIndex],
            lineStyle: LINE_STYLES[curveIndex % 3],
            lineWidth: 2,
            visible: true,
            evaluator: evaluator,
            variable: variable,
            formula: formulaStr,
            latex: latex
        };
        
        if (this.graphEngine.addCurve(curve)) {
            this.updateCurveList();
            this.updateStatus();
            this.updateLegend();
        }
    }

    updateCurveList() {
        const curveList = document.getElementById('curveList');
        curveList.innerHTML = '';
        
        this.graphEngine.curves.forEach((curve, index) => {
            const item = document.createElement('div');
            item.className = 'curve-item';
            
            const styleOptions = ['solid', 'dashed', 'dotted'];
            const styleLabels = { solid: '实线', dashed: '虚线', dotted: '点线' };
            
            let styleButtons = '';
            styleOptions.forEach(style => {
                const active = curve.lineStyle === style ? 'active' : '';
                styleButtons += `<button class="line-style-btn ${active}" data-style="${style}" data-id="${curve.id}" title="${styleLabels[style]}"></button>`;
            });
            
            item.innerHTML = `
                <div class="curve-main-row">
                    <div class="curve-color" style="background: ${curve.color}" data-id="${curve.id}" title="点击更换颜色"></div>
                    <span class="curve-formula" title="${curve.formula}">${curve.formula || 'f(x)'}</span>
                    <div class="curve-actions">
                        <button class="curve-action-btn" data-action="toggle" data-id="${curve.id}" title="${curve.visible ? '隐藏' : '显示'}">
                            ${curve.visible ? '👁️' : '👁️‍🗨️'}
                        </button>
                        <button class="curve-action-btn delete" data-action="delete" data-id="${curve.id}" title="删除">✕</button>
                    </div>
                </div>
                <div class="curve-style-row">
                    <span class="curve-style-label">线型</span>
                    <div class="line-style-selector">
                        ${styleButtons}
                    </div>
                </div>
            `;
            
            curveList.appendChild(item);
        });
        
        curveList.querySelectorAll('.curve-color').forEach(el => {
            el.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.cycleCurveColor(id);
            });
        });
        
        curveList.querySelectorAll('.curve-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                
                if (action === 'delete') {
                    this.removeCurve(id);
                } else if (action === 'toggle') {
                    this.toggleCurveVisibility(id);
                }
            });
        });
        
        curveList.querySelectorAll('.line-style-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const style = btn.dataset.style;
                this.setCurveLineStyle(id, style);
            });
        });
    }
    
    setCurveLineStyle(id, style) {
        if (this.graphEngine.updateCurve(id, { lineStyle: style })) {
            this.updateCurveList();
            this.updateLegend();
        }
    }

    cycleCurveColor(id) {
        const curve = this.graphEngine.curves.find(c => c.id === id);
        if (curve) {
            const currentIndex = CURVE_COLORS.indexOf(curve.color);
            const nextIndex = (currentIndex + 1) % CURVE_COLORS.length;
            this.graphEngine.updateCurve(id, { color: CURVE_COLORS[nextIndex] });
            this.updateCurveList();
            this.updateLegend();
        }
    }

    removeCurve(id) {
        if (this.graphEngine.removeCurve(id)) {
            this.updateCurveList();
            this.updateStatus();
            this.updateLegend();
        }
    }

    toggleCurveVisibility(id) {
        const curve = this.graphEngine.curves.find(c => c.id === id);
        if (curve) {
            this.graphEngine.updateCurve(id, { visible: !curve.visible });
            this.updateCurveList();
            this.updateLegend();
        }
    }

    bindGraphControls() {
        document.getElementById('btnZoomIn').addEventListener('click', () => {
            this.graphEngine.zoomIn();
            this.updateViewInputs();
        });
        
        document.getElementById('btnZoomOut').addEventListener('click', () => {
            this.graphEngine.zoomOut();
            this.updateViewInputs();
        });
        
        document.getElementById('btnResetView').addEventListener('click', () => {
            this.graphEngine.resetView();
            this.updateViewInputs();
        });
    }

    bindDisplayOptions() {
        document.getElementById('showGrid').addEventListener('change', (e) => {
            this.graphEngine.showGrid = e.target.checked;
            this.graphEngine.render();
        });
        
        document.getElementById('showAxes').addEventListener('change', (e) => {
            this.graphEngine.showAxes = e.target.checked;
            this.graphEngine.render();
        });
        
        document.getElementById('showLabels').addEventListener('change', (e) => {
            this.graphEngine.showLabels = e.target.checked;
            this.graphEngine.render();
        });
        
        document.getElementById('showKeyPoints').addEventListener('change', (e) => {
            this.graphEngine.showKeyPoints = e.target.checked;
            this.graphEngine.render();
        });
    }

    bindViewRange() {
        document.getElementById('btnApplyView').addEventListener('click', () => {
            const xMin = parseFloat(document.getElementById('viewXMin').value);
            const xMax = parseFloat(document.getElementById('viewXMax').value);
            const yMin = parseFloat(document.getElementById('viewYMin').value);
            const yMax = parseFloat(document.getElementById('viewYMax').value);
            
            if (xMin < xMax && yMin < yMax) {
                this.graphEngine.setView(xMin, xMax, yMin, yMax);
            } else {
                alert('无效的视图范围');
            }
        });
    }

    updateViewInputs() {
        document.getElementById('viewXMin').value = formatNumber(this.graphEngine.xMin, 2);
        document.getElementById('viewXMax').value = formatNumber(this.graphEngine.xMax, 2);
        document.getElementById('viewYMin').value = formatNumber(this.graphEngine.yMin, 2);
        document.getElementById('viewYMax').value = formatNumber(this.graphEngine.yMax, 2);
    }

    bindCoordSystem() {
        document.querySelectorAll('.coord-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.coord-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const coord = tab.dataset.coord;
                this.graphEngine.setCoordinateSystem(coord);
            });
        });
    }

    bindDataFitter() {
        const fileInput = document.getElementById('csvFileInput');
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadCSVFile(file);
            }
        });
        
        document.querySelectorAll('.degree-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.degree-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.dataFitter.setDegree(parseInt(btn.dataset.degree));
                
                if (this.dataFitter.hasData()) {
                    this.fitCurve();
                }
            });
        });
        
        document.getElementById('btnFitCurve').addEventListener('click', () => {
            this.fitCurve();
        });
    }

    async loadCSVFile(file) {
        try {
            await this.dataFitter.loadCSV(file);
            
            document.getElementById('csvInfo').textContent = `${file.name} (${this.dataFitter.getDataCount()} 个点)`;
            document.getElementById('btnFitCurve').disabled = false;
            
            const range = this.dataFitter.getDataRange();
            this.graphEngine.setView(range.xMin, range.xMax, range.yMin, range.yMax);
            this.updateViewInputs();
            
            this.graphEngine.setScatterData(this.dataFitter.csvData);
            
            this.fitCurve();
            
        } catch (err) {
            alert('加载CSV失败: ' + err.message);
        }
    }

    fitCurve() {
        try {
            const result = this.dataFitter.fit();
            
            const evaluator = this.dataFitter.createEvaluator();
            this.graphEngine.setFitCurve({
                evaluator: evaluator,
                color: '#34d399',
                lineWidth: 2,
                lineStyle: 'dashed'
            });
            
            document.getElementById('fitResult').style.display = 'block';
            document.getElementById('fitFormula').textContent = this.dataFitter.getFormulaString();
            document.getElementById('fitRSquared').textContent = result.rSquared.toFixed(6);
            
            this.updateLegend();
            
        } catch (err) {
            alert('拟合失败: ' + err.message);
        }
    }

    bindStorage() {
        document.getElementById('btnSave').addEventListener('click', () => {
            document.getElementById('saveModal').style.display = 'flex';
            document.getElementById('saveNameInput').focus();
        });
        
        document.getElementById('btnCancelSave').addEventListener('click', () => {
            document.getElementById('saveModal').style.display = 'none';
        });
        
        document.getElementById('btnConfirmSave').addEventListener('click', () => {
            const name = document.getElementById('saveNameInput').value.trim();
            if (name) {
                this.saveConfig(name);
                document.getElementById('saveModal').style.display = 'none';
                document.getElementById('saveNameInput').value = '';
            } else {
                alert('请输入配置名称');
            }
        });
        
        document.getElementById('btnLoad').addEventListener('click', () => {
            this.refreshSavedConfigList();
            document.getElementById('loadModal').style.display = 'flex';
        });
        
        document.getElementById('btnCancelLoad').addEventListener('click', () => {
            document.getElementById('loadModal').style.display = 'none';
        });
        
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.style.display = 'none';
                }
            });
        });
        
        document.getElementById('saveNameInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('btnConfirmSave').click();
            }
        });
    }

    saveConfig(name) {
        const data = {
            formula: this.formulaEditor.serialize(),
            graph: this.graphEngine.serialize(),
            dataFitter: this.dataFitter.serialize()
        };
        
        const config = this.storageManager.save(name, data);
        if (config) {
            alert('保存成功！');
        }
    }

    refreshSavedConfigList() {
        const list = document.getElementById('savedConfigList');
        const configs = this.storageManager.list();
        
        list.innerHTML = '';
        
        if (configs.length === 0) {
            list.innerHTML = '<div style="text-align:center;color:#6b82a5;padding:20px;">暂无保存的配置</div>';
            return;
        }
        
        configs.forEach(config => {
            const item = document.createElement('div');
            item.className = 'saved-config-item';
            
            item.innerHTML = `
                <div style="flex:1;">
                    <div class="saved-config-name">${config.name}</div>
                    <div class="saved-config-date">${this.storageManager.formatDate(config.updatedAt)}</div>
                </div>
                <div class="saved-config-actions">
                    <button class="saved-config-delete" data-id="${config.id}" title="删除">删除</button>
                </div>
            `;
            
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('saved-config-delete')) {
                    this.loadConfig(config.id);
                    document.getElementById('loadModal').style.display = 'none';
                }
            });
            
            item.querySelector('.saved-config-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('确定要删除这个配置吗？')) {
                    this.storageManager.delete(config.id);
                    this.refreshSavedConfigList();
                }
            });
            
            list.appendChild(item);
        });
    }

    loadConfig(id) {
        const config = this.storageManager.get(id);
        if (!config || !config.data) return;
        
        const data = config.data;
        
        if (data.formula) {
            this.formulaEditor.deserialize(data.formula);
            
            const varSelect = document.getElementById('variableSelect');
            if (varSelect) {
                varSelect.value = data.formula.variable || 'x';
            }
        }
        
        if (data.graph) {
            const graphData = data.graph;
            
            this.graphEngine.setCoordinateSystem(graphData.coordinateSystem || 'cartesian');
            
            document.querySelectorAll('.coord-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.coord === (graphData.coordinateSystem || 'cartesian'));
            });
            
            this.graphEngine.setView(
                graphData.xMin || -10,
                graphData.xMax || 10,
                graphData.yMin || -10,
                graphData.yMax || 10
            );
            
            this.graphEngine.showGrid = graphData.showGrid !== false;
            this.graphEngine.showAxes = graphData.showAxes !== false;
            this.graphEngine.showLabels = graphData.showLabels !== false;
            this.graphEngine.showKeyPoints = graphData.showKeyPoints || false;
            
            document.getElementById('showGrid').checked = this.graphEngine.showGrid;
            document.getElementById('showAxes').checked = this.graphEngine.showAxes;
            document.getElementById('showLabels').checked = this.graphEngine.showLabels;
            document.getElementById('showKeyPoints').checked = this.graphEngine.showKeyPoints;
            
            this.updateViewInputs();
            
            if (graphData.curves && graphData.curves.length > 0) {
                this.graphEngine.curves = [];
                
                graphData.curves.forEach(curveData => {
                    if (curveData.formula && curveData.variable) {
                        try {
                            const savedVariable = this.formulaEditor.variable;
                            this.formulaEditor.setVariable(curveData.variable);
                            
                            const evaluator = this.formulaEditor.createEvaluator();
                            
                            const curve = {
                                id: curveData.id || generateId(),
                                color: curveData.color || '#00d4ff',
                                lineStyle: curveData.lineStyle || 'solid',
                                lineWidth: curveData.lineWidth || 2,
                                visible: curveData.visible !== false,
                                evaluator: evaluator,
                                variable: curveData.variable,
                                formula: curveData.formula,
                                latex: curveData.latex || curveData.formula
                            };
                            
                            this.graphEngine.curves.push(curve);
                            
                            this.formulaEditor.setVariable(savedVariable);
                        } catch (e) {
                            console.error('加载曲线失败:', e);
                        }
                    }
                });
                
                this.graphEngine.render();
                this.updateCurveList();
                this.updateLegend();
            }
        }
        
        if (data.dataFitter) {
            this.dataFitter.deserialize(data.dataFitter);
            
            if (this.dataFitter.hasData()) {
                this.graphEngine.setScatterData(this.dataFitter.csvData);
                document.getElementById('csvInfo').textContent = `已加载 (${this.dataFitter.getDataCount()} 个点)`;
                document.getElementById('btnFitCurve').disabled = false;
                
                document.querySelectorAll('.degree-btn').forEach(btn => {
                    btn.classList.toggle('active', parseInt(btn.dataset.degree) === this.dataFitter.degree);
                });
                
                if (this.dataFitter.hasFit()) {
                    const evaluator = this.dataFitter.createEvaluator();
                    this.graphEngine.setFitCurve({
                        evaluator: evaluator,
                        color: '#34d399',
                        lineWidth: 2,
                        lineStyle: 'dashed'
                    });
                    
                    document.getElementById('fitResult').style.display = 'block';
                    document.getElementById('fitFormula').textContent = this.dataFitter.getFormulaString();
                    document.getElementById('fitRSquared').textContent = this.dataFitter.rSquared.toFixed(6);
                }
            }
        }
        
        this.updateStatus();
        alert('加载成功！');
    }

    bindExport() {
        document.getElementById('btnExport').addEventListener('click', () => {
            document.getElementById('exportModal').style.display = 'flex';
        });
        
        document.getElementById('btnCancelExport').addEventListener('click', () => {
            document.getElementById('exportModal').style.display = 'none';
        });
        
        document.querySelectorAll('.export-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const format = btn.dataset.format;
                this.exportGraph(format);
                document.getElementById('exportModal').style.display = 'none';
            });
        });
    }

    exportGraph(format) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        
        if (format === 'png') {
            downloadCanvasAsPNG(this.graphEngine.canvas, `graph-${timestamp}.png`);
        } else if (format === 'svg') {
            const svgContent = this.graphEngine.exportSVG();
            downloadFile(`graph-${timestamp}.svg`, svgContent, 'image/svg+xml');
        }
    }

    bindMouseTooltip() {
        const tooltip = document.getElementById('canvasTooltip');
        
        this.graphEngine.onMouseMove = (worldX, worldY, screenX, screenY) => {
            const statusCoord = document.getElementById('statusCoord');
            
            if (worldX !== null && worldY !== null) {
                statusCoord.textContent = `(${formatNumber(worldX, 2)}, ${formatNumber(worldY, 2)})`;
                
                tooltip.style.display = 'block';
                tooltip.style.left = Math.min(screenX + 15, this.graphEngine.width - 150) + 'px';
                tooltip.style.top = Math.min(screenY + 15, this.graphEngine.height - 50) + 'px';
                tooltip.textContent = `x: ${formatNumber(worldX, 3)}\ny: ${formatNumber(worldY, 3)}`;
            } else {
                statusCoord.textContent = '—';
                tooltip.style.display = 'none';
            }
        };
    }

    updateLegend() {
        const legend = document.getElementById('canvasLegend');
        legend.innerHTML = '';
        
        this.graphEngine.curves.forEach(curve => {
            if (curve.visible === false) return;
            
            const item = document.createElement('div');
            item.className = 'legend-item';
            
            let borderStyle = 'solid';
            if (curve.lineStyle === 'dashed') {
                borderStyle = '3px dashed';
            } else if (curve.lineStyle === 'dotted') {
                borderStyle = '3px dotted';
            }
            
            item.innerHTML = `
                <div class="legend-line" style="background: ${curve.color}; border-top: ${borderStyle} ${curve.color};"></div>
                <span class="legend-label">${curve.formula || 'f(x)'}</span>
            `;
            
            legend.appendChild(item);
        });
        
        if (this.dataFitter && this.dataFitter.hasFit()) {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `
                <div class="legend-line" style="background: #34d399; border-top: 2px dashed #34d399;"></div>
                <span class="legend-label">拟合曲线 (R²=${this.dataFitter.rSquared?.toFixed(4) || '?'})</span>
            `;
            legend.appendChild(item);
        }
        
        if (this.dataFitter && this.dataFitter.hasData()) {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `
                <div class="legend-line" style="background: #a78bfa; width: 8px; height: 8px; border-radius: 50%;"></div>
                <span class="legend-label">散点数据</span>
            `;
            legend.appendChild(item);
        }
        
        legend.style.display = legend.children.length > 0 ? 'block' : 'none';
    }

    updateStatus() {
        const formula = this.formulaEditor.getFormulaString();
        document.getElementById('statusFormula').textContent = formula || '无';
        document.getElementById('statusCurveCount').textContent = `${this.graphEngine.getCurveCount()} / 3`;
    }

    updateUI() {
        this.updateCurveList();
        this.updateStatus();
        this.updateViewInputs();
        this.updateLegend();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new App();
});
