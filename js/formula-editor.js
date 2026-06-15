import { generateId } from './utils.js';

export class FormulaEditor {
    constructor(previewElement, inputElement) {
        this.previewElement = previewElement;
        this.inputElement = inputElement;
        this.tokens = [];
        this.cursorPosition = 0;
        this.variable = 'x';
        this.onChange = null;
    }

    insertToken(type, value, latex = null, jsValue = null, replacePlaceholder = true) {
        const token = {
            type,
            value,
            latex: latex || value,
            jsValue: jsValue || value
        };
        
        if (replacePlaceholder && this.cursorPosition < this.tokens.length && 
            this.tokens[this.cursorPosition].type === 'placeholder') {
            this.tokens.splice(this.cursorPosition, 1, token);
            this.cursorPosition++;
        } else {
            this.tokens.splice(this.cursorPosition, 0, token);
            this.cursorPosition++;
        }
        
        this.render();
        this.notifyChange();
    }

    insertNumber(num) {
        this.insertToken('number', num, num, num);
    }

    insertVariable(varName) {
        this.insertToken('variable', varName, varName, varName);
    }

    insertOperator(op) {
        const latexMap = {
            '+': '+',
            '-': '-',
            '*': ' \\cdot ',
            '/': '/'
        };
        const jsMap = {
            '+': '+',
            '-': '-',
            '*': '*',
            '/': '/'
        };
        this.insertToken('operator', op, latexMap[op] || op, jsMap[op] || op);
    }

    insertParen(paren) {
        this.insertToken('paren', paren, paren, paren);
    }

    insertConstant(name) {
        const constants = {
            'pi': { latex: '\\pi', js: 'Math.PI' },
            'e': { latex: 'e', js: 'Math.E' }
        };
        if (constants[name]) {
            this.insertToken('constant', name, constants[name].latex, constants[name].js);
        }
    }

    insertFunction(name) {
        const functions = {
            'sin': { latex: '\\sin', js: 'Math.sin' },
            'cos': { latex: '\\cos', js: 'Math.cos' },
            'tan': { latex: '\\tan', js: 'Math.tan' },
            'asin': { latex: '\\arcsin', js: 'Math.asin' },
            'acos': { latex: '\\arccos', js: 'Math.acos' },
            'atan': { latex: '\\arctan', js: 'Math.atan' },
            'log': { latex: '\\log', js: 'Math.log10' },
            'ln': { latex: '\\ln', js: 'Math.log' },
            'exp': { latex: 'e^', js: 'Math.exp' },
            'sqrt': { latex: '\\sqrt', js: 'Math.sqrt' },
            'abs': { latex: '\\left|', js: 'Math.abs' }
        };
        
        if (name === 'sqrt') {
            this.insertToken('function', 'sqrt', '\\sqrt{', 'Math.sqrt(');
            this.insertToken('placeholder', 'x', 'x', 'x');
            this.insertToken('close', '}', '}', ')');
            this.cursorPosition -= 2;
            this.render();
            this.notifyChange();
            return;
        }
        
        if (name === 'abs') {
            this.insertToken('function', 'abs', '\\left|', 'Math.abs(');
            this.insertToken('placeholder', 'x', 'x', 'x');
            this.insertToken('close', '|', '\\right|', ')');
            this.cursorPosition -= 2;
            this.render();
            this.notifyChange();
            return;
        }
        
        if (functions[name]) {
            const func = functions[name];
            this.insertToken('function', name, func.latex + '(', func.js + '(');
            this.insertToken('placeholder', 'x', 'x', 'x');
            this.insertToken('close', ')', ')', ')');
            this.cursorPosition -= 2;
            this.render();
            this.notifyChange();
            return;
        }
    }

    insertPower() {
        const prevToken = this.tokens[this.cursorPosition - 1];
        
        if (prevToken && (prevToken.type === 'number' || prevToken.type === 'variable' || prevToken.type === 'constant' || prevToken.type === 'close')) {
            this.insertToken('operator', '^', '^', '**');
            this.insertToken('placeholder', 'n', 'n', 'n');
            this.cursorPosition -= 1;
            this.render();
            this.notifyChange();
        } else {
            this.insertToken('placeholder', 'x', 'x', 'x');
            this.insertToken('operator', '^', '^', '**');
            this.insertToken('placeholder', 'n', 'n', 'n');
            this.cursorPosition -= 2;
            this.render();
            this.notifyChange();
        }
    }

    insertFraction() {
        this.insertToken('fraction', 'frac', '\\frac{', '(');
        this.insertToken('placeholder', 'a', 'a', 'a');
        this.insertToken('frac_sep', '}', '}{', ')/(');
        this.insertToken('placeholder', 'b', 'b', 'b');
        this.insertToken('frac_end', '}', '}', ')');
        this.cursorPosition -= 4;
        this.render();
        this.notifyChange();
    }

    insertSum() {
        this.insertToken('sum', 'sum', '\\sum_{n=1}^{', '');
        this.insertToken('placeholder', 'N', 'N', 'N');
        this.insertToken('sum_mid', '}', '} ', '');
        this.insertToken('placeholder', 'a_n', 'a_n', 'a_n');
        this.cursorPosition -= 2;
        this.render();
        this.notifyChange();
    }

    insertIntegral() {
        this.insertToken('integral', 'int', '\\int_{', '');
        this.insertToken('placeholder', 'a', 'a', 'a');
        this.insertToken('int_mid', '}', '}^{', '');
        this.insertToken('placeholder', 'b', 'b', 'b');
        this.insertToken('int_end', '}', '} ', '');
        this.insertToken('placeholder', 'f(x)', 'f(x)\\,dx', 'f(x)');
        this.cursorPosition -= 2;
        this.render();
        this.notifyChange();
    }

    backspace() {
        if (this.cursorPosition > 0) {
            this.tokens.splice(this.cursorPosition - 1, 1);
            this.cursorPosition--;
            this.render();
            this.notifyChange();
        }
    }

    clear() {
        this.tokens = [];
        this.cursorPosition = 0;
        this.render();
        this.notifyChange();
    }

    setVariable(variable) {
        this.variable = variable;
        this.notifyChange();
    }

    getLaTeX() {
        return this.tokens.map(t => t.latex).join('');
    }

    getJSExpression() {
        let js = '';
        for (let i = 0; i < this.tokens.length; i++) {
            const token = this.tokens[i];
            js += token.jsValue;
        }
        return js;
    }

    getFormulaString() {
        return this.tokens.map(t => t.value).join('');
    }

    evaluate(x) {
        try {
            const jsExpr = this.getJSExpression();
            if (!jsExpr) return 0;
            
            const func = new Function(this.variable, `return ${jsExpr};`);
            const result = func(x);
            
            if (typeof result === 'number' && isFinite(result)) {
                return result;
            }
            return NaN;
        } catch (e) {
            return NaN;
        }
    }

    createEvaluator() {
        try {
            const jsExpr = this.getJSExpression();
            if (!jsExpr) return () => 0;
            return new Function(this.variable, `return ${jsExpr};`);
        } catch (e) {
            return () => NaN;
        }
    }

    render() {
        const latex = this.getLaTeX() || '\\text{请输入公式}';
        
        try {
            if (window.katex) {
                katex.render(latex, this.previewElement, {
                    throwOnError: false,
                    displayMode: false
                });
            } else {
                this.previewElement.textContent = latex;
            }
        } catch (e) {
            this.previewElement.textContent = latex;
        }
        
        if (this.inputElement) {
            this.inputElement.value = this.getFormulaString();
        }
    }

    notifyChange() {
        if (typeof this.onChange === 'function') {
            this.onChange(this);
        }
    }

    serialize() {
        return {
            tokens: [...this.tokens],
            cursorPosition: this.cursorPosition,
            variable: this.variable
        };
    }

    deserialize(data) {
        if (data.tokens) {
            this.tokens = [...data.tokens];
        }
        if (typeof data.cursorPosition === 'number') {
            this.cursorPosition = data.cursorPosition;
        }
        if (data.variable) {
            this.variable = data.variable;
        }
        this.render();
        this.notifyChange();
    }

    isEmpty() {
        return this.tokens.length === 0;
    }

    isValid() {
        try {
            const evaluator = this.createEvaluator();
            const result = evaluator(1);
            return typeof result === 'number' && !isNaN(result);
        } catch (e) {
            return false;
        }
    }
}
