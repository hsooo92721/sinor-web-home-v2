export {basicSetup} from 'codemirror';
export {EditorView,keymap} from '@codemirror/view';
export {EditorState} from '@codemirror/state';
export {indentUnit} from '@codemirror/language';
export {indentWithTab} from '@codemirror/commands';
export {html} from '@codemirror/lang-html';
export {oneDark} from '@codemirror/theme-one-dark';
import {format} from 'prettier/standalone';
import * as htmlPlugin from 'prettier/plugins/html';
import * as cssPlugin from 'prettier/plugins/postcss';
export function formatHtml(code){return format(code,{parser:'html',plugins:[htmlPlugin,cssPlugin],tabWidth:2,useTabs:false,printWidth:100,htmlWhitespaceSensitivity:'css',endOfLine:'lf'})}
