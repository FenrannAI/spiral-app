type Persistence = {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
};

export const persistence: Persistence = {
  async setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error("Failed to persist state", e);
    }
  },
  async getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error("Failed to read persisted state", e);
      return null;
    }
  },
  async removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error("Failed to remove persisted state", e);
    }
  },
  async clear() {
    try {
      localStorage.clear();
    } catch (e) {
      console.error("Failed to clear persisted state", e);
    }
  },
};