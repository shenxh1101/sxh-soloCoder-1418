import { parseCSV } from './utils.js';

export class DataFitter {
    constructor() {
        this.csvData = null;
        this.degree = 2;
        this.coefficients = null;
        this.rSquared = null;
    }

    loadCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    this.csvData = parseCSV(text);
                    
                    if (this.csvData.x.length < 2) {
                        reject(new Error('数据点不足，至少需要2个数据点'));
                        return;
                    }
                    
                    this.coefficients = null;
                    this.rSquared = null;
                    
                    resolve(this.csvData);
                } catch (err) {
                    reject(err);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('文件读取失败'));
            };
            
            reader.readAsText(file);
        });
    }

    setData(x, y) {
        if (!x || !y || x.length !== y.length || x.length < 2) {
            throw new Error('无效的数据');
        }
        this.csvData = { x: [...x], y: [...y], headers: ['x', 'y'] };
        this.coefficients = null;
        this.rSquared = null;
    }

    setDegree(degree) {
        const deg = parseInt(degree);
        if (deg < 1 || deg > 5) {
            throw new Error('多项式次数必须在1到5之间');
        }
        this.degree = deg;
        this.coefficients = null;
        this.rSquared = null;
    }

    fit() {
        if (!this.csvData || !this.csvData.x || !this.csvData.y) {
            throw new Error('没有数据可拟合');
        }
        
        const { x, y } = this.csvData;
        const n = x.length;
        const degree = this.degree;
        
        if (n <= degree) {
            throw new Error('数据点数量必须大于多项式次数');
        }
        
        this.coefficients = this.leastSquares(x, y, degree);
        this.rSquared = this.calculateRSquared(x, y, this.coefficients);
        
        return {
            coefficients: this.coefficients,
            rSquared: this.rSquared,
            degree: this.degree
        };
    }

    leastSquares(x, y, degree) {
        const n = x.length;
        const m = degree + 1;
        
        const X = [];
        for (let i = 0; i < n; i++) {
            const row = [];
            for (let j = 0; j < m; j++) {
                row.push(Math.pow(x[i], j));
            }
            X.push(row);
        }
        
        const XtX = this.matrixMultiply(this.transpose(X), X);
        const Xty = this.matrixMultiply(this.transpose(X), y.map(v => [v]));
        
        const coefficients = this.solveLinearSystem(XtX, Xty.map(v => v[0]));
        
        return coefficients;
    }

    transpose(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const result = [];
        
        for (let j = 0; j < cols; j++) {
            const row = [];
            for (let i = 0; i < rows; i++) {
                row.push(matrix[i][j]);
            }
            result.push(row);
        }
        
        return result;
    }

    matrixMultiply(A, B) {
        const rowsA = A.length;
        const colsA = A[0].length;
        const colsB = B[0].length;
        
        const result = [];
        
        for (let i = 0; i < rowsA; i++) {
            const row = [];
            for (let j = 0; j < colsB; j++) {
                let sum = 0;
                for (let k = 0; k < colsA; k++) {
                    sum += A[i][k] * B[k][j];
                }
                row.push(sum);
            }
            result.push(row);
        }
        
        return result;
    }

    solveLinearSystem(A, b) {
        const n = A.length;
        const augmented = [];
        
        for (let i = 0; i < n; i++) {
            augmented.push([...A[i], b[i]]);
        }
        
        for (let col = 0; col < n; col++) {
            let maxRow = col;
            let maxVal = Math.abs(augmented[col][col]);
            
            for (let row = col + 1; row < n; row++) {
                if (Math.abs(augmented[row][col]) > maxVal) {
                    maxVal = Math.abs(augmented[row][col]);
                    maxRow = row;
                }
            }
            
            if (maxVal < 1e-10) {
                throw new Error('矩阵奇异，无法求解');
            }
            
            if (maxRow !== col) {
                [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];
            }
            
            const pivot = augmented[col][col];
            for (let j = col; j <= n; j++) {
                augmented[col][j] /= pivot;
            }
            
            for (let row = 0; row < n; row++) {
                if (row !== col) {
                    const factor = augmented[row][col];
                    for (let j = col; j <= n; j++) {
                        augmented[row][j] -= factor * augmented[col][j];
                    }
                }
            }
        }
        
        const solution = [];
        for (let i = 0; i < n; i++) {
            solution.push(augmented[i][n]);
        }
        
        return solution;
    }

    calculateRSquared(x, y, coefficients) {
        const n = x.length;
        const yMean = y.reduce((a, b) => a + b, 0) / n;
        
        let ssTotal = 0;
        let ssResidual = 0;
        
        for (let i = 0; i < n; i++) {
            const yPredicted = this.evaluatePolynomial(x[i], coefficients);
            ssTotal += Math.pow(y[i] - yMean, 2);
            ssResidual += Math.pow(y[i] - yPredicted, 2);
        }
        
        if (ssTotal === 0) return 1;
        
        return 1 - ssResidual / ssTotal;
    }

    evaluatePolynomial(x, coefficients) {
        let result = 0;
        for (let i = 0; i < coefficients.length; i++) {
            result += coefficients[i] * Math.pow(x, i);
        }
        return result;
    }

    createEvaluator() {
        if (!this.coefficients) {
            return null;
        }
        
        const coeffs = [...this.coefficients];
        return (x) => {
            let result = 0;
            for (let i = 0; i < coeffs.length; i++) {
                result += coeffs[i] * Math.pow(x, i);
            }
            return result;
        };
    }

    getFormulaString() {
        if (!this.coefficients) return '';
        
        const coeffs = this.coefficients;
        let formula = '';
        
        for (let i = coeffs.length - 1; i >= 0; i--) {
            const coeff = coeffs[i];
            if (Math.abs(coeff) < 0.0001 && coeffs.length > 1) continue;
            
            const sign = coeff >= 0 ? (formula ? ' + ' : '') : (formula ? ' - ' : '-');
            const absCoeff = Math.abs(coeff);
            
            if (i === 0) {
                formula += `${sign}${this.formatCoeff(absCoeff)}`;
            } else if (i === 1) {
                formula += `${sign}${absCoeff !== 1 ? this.formatCoeff(absCoeff) : ''}x`;
            } else {
                formula += `${sign}${absCoeff !== 1 ? this.formatCoeff(absCoeff) : ''}x^${i}`;
            }
        }
        
        return formula || '0';
    }

    getLaTeXFormula() {
        if (!this.coefficients) return '';
        
        const coeffs = this.coefficients;
        let latex = '';
        
        for (let i = coeffs.length - 1; i >= 0; i--) {
            const coeff = coeffs[i];
            if (Math.abs(coeff) < 0.0001 && coeffs.length > 1) continue;
            
            const sign = coeff >= 0 ? (latex ? ' + ' : '') : (latex ? ' - ' : '-');
            const absCoeff = Math.abs(coeff);
            
            if (i === 0) {
                latex += `${sign}${this.formatCoeff(absCoeff)}`;
            } else if (i === 1) {
                latex += `${sign}${absCoeff !== 1 ? this.formatCoeff(absCoeff) : ''}x`;
            } else {
                latex += `${sign}${absCoeff !== 1 ? this.formatCoeff(absCoeff) : ''}x^{${i}}`;
            }
        }
        
        return latex || '0';
    }

    formatCoeff(value) {
        if (Math.abs(value - Math.round(value)) < 0.0001) {
            return Math.round(value).toString();
        }
        return value.toFixed(4).replace(/\.?0+$/, '');
    }

    getDataRange() {
        if (!this.csvData || !this.csvData.x || !this.csvData.y) {
            return { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
        }
        
        const { x, y } = this.csvData;
        
        const xMin = Math.min(...x);
        const xMax = Math.max(...x);
        const yMin = Math.min(...y);
        const yMax = Math.max(...y);
        
        const xPadding = (xMax - xMin) * 0.1 || 1;
        const yPadding = (yMax - yMin) * 0.1 || 1;
        
        return {
            xMin: xMin - xPadding,
            xMax: xMax + xPadding,
            yMin: yMin - yPadding,
            yMax: yMax + yPadding
        };
    }

    hasData() {
        return this.csvData !== null && this.csvData.x && this.csvData.x.length > 0;
    }

    hasFit() {
        return this.coefficients !== null;
    }

    getDataCount() {
        return this.csvData ? this.csvData.x.length : 0;
    }

    serialize() {
        return {
            csvData: this.csvData ? { ...this.csvData } : null,
            degree: this.degree,
            coefficients: this.coefficients ? [...this.coefficients] : null,
            rSquared: this.rSquared
        };
    }

    deserialize(data) {
        if (data.csvData) {
            this.csvData = { ...data.csvData };
        }
        if (typeof data.degree === 'number') {
            this.degree = data.degree;
        }
        if (data.coefficients) {
            this.coefficients = [...data.coefficients];
        }
        if (typeof data.rSquared === 'number') {
            this.rSquared = data.rSquared;
        }
    }
}
