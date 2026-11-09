import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root = new URL('./', import.meta.url);
const view = readFileSync(new URL('view.js', root), 'utf8');
const css = readFileSync(new URL('style.css', root), 'utf8');
const out = `window.__ModuleLoader__.load({id:'dsh-codex-model-picker',factory(require){\nconst React = require('react');\nconst {createPortal} = require('react-dom');\nconst CSS = ${JSON.stringify(css)};\n${view}\n}});\n`;
writeFileSync(new URL('client.js', root), out);
console.log('Built', fileURLToPath(new URL('client.js', root)));
