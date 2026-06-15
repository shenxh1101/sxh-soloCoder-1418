const STORAGE_KEY = 'formula_graph_configs';

export class StorageManager {
    constructor() {
        this.configs = this.loadAll();
    }

    loadAll() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                return Array.isArray(parsed) ? parsed : [];
            }
        } catch (e) {
            console.error('加载配置失败:', e);
        }
        return [];
    }

    saveAll() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.configs));
            return true;
        } catch (e) {
            console.error('保存配置失败:', e);
            return false;
        }
    }

    list() {
        return this.configs.map(c => ({
            id: c.id,
            name: c.name,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt
        }));
    }

    get(id) {
        const config = this.configs.find(c => c.id === id);
        return config ? JSON.parse(JSON.stringify(config)) : null;
    }

    save(name, data) {
        const now = Date.now();
        const newConfig = {
            id: this.generateId(),
            name: name || '未命名配置',
            createdAt: now,
            updatedAt: now,
            data: JSON.parse(JSON.stringify(data))
        };
        
        this.configs.unshift(newConfig);
        this.saveAll();
        return newConfig;
    }

    update(id, data) {
        const index = this.configs.findIndex(c => c.id === id);
        if (index !== -1) {
            this.configs[index].updatedAt = Date.now();
            this.configs[index].data = JSON.parse(JSON.stringify(data));
            this.saveAll();
            return this.configs[index];
        }
        return null;
    }

    delete(id) {
        const index = this.configs.findIndex(c => c.id === id);
        if (index !== -1) {
            this.configs.splice(index, 1);
            this.saveAll();
            return true;
        }
        return false;
    }

    rename(id, newName) {
        const config = this.configs.find(c => c.id === id);
        if (config) {
            config.name = newName || '未命名配置';
            config.updatedAt = Date.now();
            this.saveAll();
            return config;
        }
        return null;
    }

    generateId() {
        return 'cfg_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }

    getCount() {
        return this.configs.length;
    }

    clearAll() {
        this.configs = [];
        this.saveAll();
    }

    exportAll() {
        return JSON.stringify(this.configs, null, 2);
    }

    importAll(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (Array.isArray(data)) {
                this.configs = data;
                this.saveAll();
                return data.length;
            }
        } catch (e) {
            console.error('导入配置失败:', e);
        }
        return 0;
    }
}
