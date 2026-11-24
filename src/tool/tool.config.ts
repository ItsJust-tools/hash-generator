import type { ToolConfig } from '@itsjust/core';

const toolConfig: ToolConfig = {
  id: 'hash-generator',
  name: 'Hash Generator',
  category: 'Developer',
  description: 'Generate cryptographic hashes and HMACs from text or files, entirely client-side.',
  version: '1.0.0',
  exportFormats: ['png', 'jpeg', 'webp', 'pdf'],
  features: {
    sidebar: true,
    export: true,
    autoSave: true,
    undoRedo: false,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    brand: 'Hash Generator',
  },
} as ToolConfig;

export default toolConfig;
export { toolConfig };
