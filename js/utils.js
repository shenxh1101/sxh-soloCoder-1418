export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function formatNumber(num, decimals = 4) {
    if (Math.abs(num) < 0.0001 && num !== 0) {
        return num.toExponential(2);
    }
    return parseFloat(num.toFixed(decimals)).toString();
}

export function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
        return { x: [], y: [], headers: ['x', 'y'] };
    }
    
    let startIndex = 0;
    let headers = ['x', 'y'];
    
    const firstLine = lines[0].split(/[,;]/);
    if (isNaN(parseFloat(firstLine[0])) && isNaN(parseFloat(firstLine[firstLine.length - 1]))) {
        headers = firstLine.map(h => h.trim());
        startIndex = 1;
    }
    
    const x = [];
    const y = [];
    
    for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].trim().split(/[,;\t]/);
        if (parts.length >= 2) {
            const xi = parseFloat(parts[0]);
            const yi = parseFloat(parts[1]);
            if (!isNaN(xi) && !isNaN(yi)) {
                x.push(xi);
                y.push(yi);
            }
        }
    }
    
    return { x, y, headers };
}

export function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function downloadCanvasAsPNG(canvas, filename) {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function getNiceNumber(range, round) {
    const exponent = Math.floor(Math.log10(range));
    const fraction = range / Math.pow(10, exponent);
    let niceFraction;
    
    if (round) {
        if (fraction < 1.5) niceFraction = 1;
        else if (fraction < 3) niceFraction = 2;
        else if (fraction < 7) niceFraction = 5;
        else niceFraction = 10;
    } else {
        if (fraction <= 1) niceFraction = 1;
        else if (fraction <= 2) niceFraction = 2;
        else if (fraction <= 5) niceFraction = 5;
        else niceFraction = 10;
    }
    
    return niceFraction * Math.pow(10, exponent);
}

export function rgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
